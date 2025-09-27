import React from 'react'
import SplitHighlights from './split-highlights'
import { PdfLoader, PdfHighlighter, Highlight } from 'react-pdf-highlighter'
import PdfToolbar from './pdf-toolbar'
import PdfZoomToolbar from './pdf-zoom-toolbar'
import checkIcon from '../../assets/check.svg'
import xIcon from '../../assets/x.svg'
import filesCopyIcon from '../../assets/files_copy.svg'
import exportIcon from '../../assets/export.svg'
import { exportHighlightsAsPdf } from './export/pdf-export'
import { exportHighlightsAsMarkdown } from './export/markdown-export'
import type { ExportHighlight } from './export/types'
// react-pdf-highlighter includes PDF.js styles via its CSS import in index.css

type SplitPdfProps = {
  onClose: () => void
  projectId: string
  path: string
  fileName: string
}

export default function SplitPdf({ onClose, projectId, path, fileName }: SplitPdfProps) {
  const [pdfData, setPdfData] = React.useState<Uint8Array | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [numPages] = React.useState<number>(0)
  const [pdfDoc] = React.useState<any | null>(null)
  const viewerRef = React.useRef<HTMLDivElement | null>(null)
  const [viewerWidth, setViewerWidth] = React.useState<number>(0)
  const [viewerHeight, setViewerHeight] = React.useState<number>(0)
  const resizeRaf = React.useRef<number | null>(null)
  const [rphHighlights, setRphHighlights] = React.useState<any[]>([])
  const [tool, setTool] = React.useState<'highlighter' | 'camera'>('highlighter')
  const [pendingScreenshot, setPendingScreenshot] = React.useState<{ dataUrl: string } | null>(null)
  const [isCapturing, setIsCapturing] = React.useState<boolean>(false)
  const overlayHighlights = React.useMemo(() => rphHighlights.filter((h) => h && h.kind !== 'screenshot'), [rphHighlights])
  const scrollToHighlightRef = React.useRef<((h: any) => void) | null>(null)
  const hasLoadedHighlightsRef = React.useRef<boolean>(false)
  const saveDebounceRef = React.useRef<number | null>(null)
  const lastSavedSnapshotRef = React.useRef<string>("[]")
  const isHighlighterReadyRef = React.useRef<boolean>(false)
  const pendingJumpRef = React.useRef<{ id: string; page?: number } | null>(null)
  const [zoom, setZoom] = React.useState<'auto' | number>('auto')
  const pdfScaleValue = React.useMemo(() => (zoom === 'auto' ? 'page-fit' : zoom), [zoom])
  // Keep highlight filtering always on 'all' for now; left header now shows page nav only
  const [activeTab] = React.useState<'all' | 'annotations' | 'screenshots'>('all')
  const [pageTab, setPageTab] = React.useState<'annotate' | 'writing'>('annotate')
  const [searchQuery, setSearchQuery] = React.useState('')

  const STATUS_EVENT = 'project:item:status:updated'

  const updateKanbanStatus = React.useCallback(async (nextHighlights: any[]) => {
    const api = (window as any).api
    if (!api?.projects?.kanban?.get || !api?.projects?.kanban?.set) return
    try {
      const current = (await api.projects.kanban.get(projectId)) || {}
      const absolutePath: string = path
      const existing = current[absolutePath]
      if (Array.isArray(nextHighlights) && nextHighlights.length > 0) {
        if (!existing || existing === 'todo') {
          current[absolutePath] = 'ongoing'
          await api.projects.kanban.set(projectId, current)
          window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail: { projectId, updates: { [absolutePath]: 'ongoing' } } }))
        }
      } else if (existing === 'ongoing' || existing === 'done') {
        current[absolutePath] = 'todo'
        await api.projects.kanban.set(projectId, current)
        window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail: { projectId, updates: { [absolutePath]: 'todo' } } }))
      }
    } catch {}
  }, [path, projectId])

  // Trigger layout recalculation when zoom changes (pdf.js & overlay layers often listen to resize)
  React.useEffect(() => {
    try { window.dispatchEvent(new Event('resize')) } catch {}
  }, [pdfScaleValue])

  
  function getPageNumberFromHighlight(h: any): number | undefined {
    if (!h) return undefined
    // Support screenshots stored with screenshot.pageNumber
    if (h.kind === 'screenshot' && typeof h?.screenshot?.pageNumber === 'number') {
      return h.screenshot.pageNumber
    }
    if (!h.position) return undefined
    if (typeof h.position.pageNumber === 'number') return h.position.pageNumber
    if (h.position.boundingRect && typeof h.position.boundingRect.pageNumber === 'number') return h.position.boundingRect.pageNumber
    if (Array.isArray(h.position.rects) && h.position.rects.length > 0 && typeof h.position.rects[0]?.pageNumber === 'number') {
      return h.position.rects[0].pageNumber
    }
    return undefined
  }

  function getPdfJsContainer(): HTMLElement | null {
    const host = viewerRef.current
    if (!host) return null
    const pdfViewer = host.querySelector('.pdfViewer') as HTMLElement | null
    const container = pdfViewer?.parentElement as HTMLElement | null
    if (!container) return null
    return container
  }

  function getScrollableAncestor(element: HTMLElement | null): HTMLElement | null {
    const pdfContainer = getPdfJsContainer()
    if (element && pdfContainer && pdfContainer.contains(element)) {
      return pdfContainer
    }
    let el: HTMLElement | null = element?.parentElement || null
    try {
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el)
        const overflowY = style.overflowY
        if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
          return el
        }
        el = el.parentElement
      }
    } catch {}
    const docEl = document.scrollingElement as HTMLElement | null
    return docEl || pdfContainer || null
  }

  function generateId(): string {
    return `hl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  }

  function saveHighlightsNow(nextHighlights: any[]) {
    const api = (window as any).api
    if (!api?.projects?.highlights?.set) return
    try {
      console.log('[PDF] saveHighlightsNow count=', nextHighlights.length)
      api.projects.highlights.set(projectId, fileName, nextHighlights)
      lastSavedSnapshotRef.current = JSON.stringify(nextHighlights)
      void updateKanbanStatus(nextHighlights)
    } catch (e) {
      console.warn('[PDF] saveHighlightsNow failed', e)
    }
  }
  function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
    const ab = new ArrayBuffer(u8.byteLength)
    const view = new Uint8Array(ab)
    view.set(u8)
    return ab
  }
  const blobUrl = React.useMemo(() => {
    if (!pdfData) return null
    try {
      const url = URL.createObjectURL(new Blob([toArrayBuffer(pdfData)], { type: 'application/pdf' }))
      console.log('[PDF] blobUrl created')
      return url
    } catch (e) {
      console.warn('[PDF] blobUrl creation failed', e)
      return null
    }
  }, [pdfData])
  React.useEffect(() => {
    return () => { if (blobUrl) { URL.revokeObjectURL(blobUrl); console.log('[PDF] blobUrl revoked') } }
  }, [blobUrl])

  React.useEffect(() => {
    // Mark this PDF as last used when opened and notify tables to update immediately
    let cancelled = false
    ;(async () => {
      try {
        const api = (window as any).api
        await api?.projects?.items?.setLastUsed?.(path)
        if (cancelled) return
        const now = new Date()
        const yyyy = now.getFullYear()
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const dd = String(now.getDate()).padStart(2, '0')
        const todayIso = `${yyyy}-${mm}-${dd}`
        try {
          window.dispatchEvent(new CustomEvent('project:item:last-used', { detail: { projectId, path, date: todayIso } }))
        } catch {}
      } catch {}
    })()
    return () => { cancelled = true }
  }, [projectId, path, fileName])

  React.useEffect(() => {
    console.log('[PDF] reading file (base64) path=', path)
    let revoked = false
    let cancelled = false
    ;(async () => {
      try {
        const api = (window as any).api
        if (!api || !api.files || typeof api.files.readFileBase64 !== 'function') {
          throw new Error('Bridge unavailable: window.api.files.readFileBase64 not found. Please restart the Electron process to load the updated preload.')
        }
        const base64 = await api.files.readFileBase64(path)
        if (revoked) return
        const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
        if (cancelled) return
        setPdfData(binary)
        setLoadError(null)
        console.log('[PDF] file read -> pdfData set, bytes=', binary.byteLength)
      } catch (e) {
        console.error('Failed to read PDF', e)
        setLoadError(e instanceof Error ? e.message : 'Unknown error')
      }
    })()
    return () => {
      revoked = true
      cancelled = true
      console.log('[PDF] read effect cleanup')
    }
  }, [path])

  // Attach click listener (removed scroll log) to the internal pdf.js viewer container
  React.useEffect(() => {
    let removed = false
    function attach() {
      const container = getPdfJsContainer()
      if (!container) {
        if (!removed) setTimeout(attach, 100)
        return
      }
      const onClick = (e: Event) => {
        try { console.log('[PDF] pdf.js container click target=', (e.target as HTMLElement)?.className || (e.target as HTMLElement)?.nodeName) } catch {}
      }
      container.addEventListener('click', onClick)
      console.log('[PDF] pdf.js container listeners attached (click only)')
      return () => {
        removed = true
        container.removeEventListener('click', onClick as any)
        console.log('[PDF] pdf.js container listeners detached')
      }
    }
    const cleanup = attach()
    return () => { if (typeof cleanup === 'function') cleanup() }
  }, [])

  // Enable Ctrl/Cmd+C copy for selected PDF text within the PDF viewer
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key.toLowerCase() !== 'c') return
      try {
        const sel = window.getSelection()
        const text = sel ? sel.toString() : ''
        if (!text || text.trim().length === 0) return
        // Ensure selection is within the PDF viewer region to avoid hijacking global copy
        const container = viewerRef.current
        const anchorNode = sel?.anchorNode as Node | null
        const focusNode = sel?.focusNode as Node | null
        const withinViewer = !!(container && anchorNode && container.contains(anchorNode)) || !!(container && focusNode && container.contains(focusNode))
        if (!withinViewer) return
        // Attempt programmatic copy as a fallback
        navigator.clipboard?.writeText(text).catch(() => {})
        // Allow default menu handling too, but prevent double side-effects
        // Do not stopPropagation to keep app-wide shortcuts working
      } catch {}
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  }, [])

  // Rely on PdfLoader for document loading; keep local counters unused for now

  // Measure available width to fit pages nicely (outer wrapper)
  React.useEffect(() => {
    const el = viewerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (resizeRaf.current != null) cancelAnimationFrame(resizeRaf.current)
        const rect = entry.contentRect
        resizeRaf.current = requestAnimationFrame(() => {
          setViewerWidth(Math.floor(rect.width))
          setViewerHeight(Math.floor(rect.height))
          console.log('[PDF] ResizeObserver size=', Math.floor(rect.width), Math.floor(rect.height))
        })
      }
    })
    ro.observe(el)
    const rect = el.getBoundingClientRect()
    setViewerWidth(Math.floor(rect.width))
    setViewerHeight(Math.floor(rect.height))
    console.log('[PDF] initial viewer size=', Math.floor(rect.width), Math.floor(rect.height))
    return () => {
      ro.disconnect()
      if (resizeRaf.current != null) cancelAnimationFrame(resizeRaf.current)
    }
  }, [])

  // Load persisted highlights for this project/file
  React.useEffect(() => {
    let mounted = true
    console.log('[PDF] loading saved highlights', { projectId, fileName })
    ;(async () => {
      try {
        const api = (window as any).api
        const saved: any[] | undefined = await api?.projects?.highlights?.get?.(projectId, fileName)
        if (!mounted) return
        if (Array.isArray(saved)) {
          console.log('[PDF] loaded highlights count=', saved.length)
          setRphHighlights(saved)
          lastSavedSnapshotRef.current = JSON.stringify(saved)
        } else {
          console.log('[PDF] no saved highlights')
          setRphHighlights([])
          lastSavedSnapshotRef.current = "[]"
        }
        hasLoadedHighlightsRef.current = true
      } catch (e) {
        console.warn('[PDF] load highlights failed', e)
        setRphHighlights([])
        lastSavedSnapshotRef.current = "[]"
        hasLoadedHighlightsRef.current = true
      }
    })()
    return () => {
      mounted = false
      console.log('[PDF] load highlights effect cleanup')
    }
  }, [projectId, fileName])

  // In-app selection overlay state (for window-only capture)
  const selectionAnchorRef = React.useRef<{ x: number; y: number } | null>(null)
  const [selectionRect, setSelectionRect] = React.useState<{ x: number; y: number; width: number; height: number } | null>(null)

  // Debounce-save highlights whenever they change (after initial load)
  React.useEffect(() => {
    if (!hasLoadedHighlightsRef.current) return
    const api = (window as any).api
    if (!api?.projects?.highlights?.set) return
    if (saveDebounceRef.current) window.clearTimeout(saveDebounceRef.current)
    const id = window.setTimeout(() => {
      try {
        console.log('[PDF] debounce-save highlights count=', rphHighlights.length)
        api.projects.highlights.set(projectId, fileName, rphHighlights)
        lastSavedSnapshotRef.current = JSON.stringify(rphHighlights)
        void updateKanbanStatus(rphHighlights)
      } catch (e) {
        console.warn('[PDF] debounce-save failed', e)
      }
    }, 300)
    saveDebounceRef.current = id
    return () => {
      if (id) window.clearTimeout(id)
    }
  }, [projectId, fileName, rphHighlights, updateKanbanStatus])

  // Force layout refresh so highlights appear immediately without user interaction
  React.useEffect(() => {
    if (!hasLoadedHighlightsRef.current) return
    // Next frame dispatch a resize event which PdfHighlighter listens to for recalculating positions
    const id = window.setTimeout(() => {
      try { window.dispatchEvent(new Event('resize')); console.log('[PDF] dispatched resize after highlights change') } catch {}
    }, 0)
    return () => { if (id) window.clearTimeout(id) }
  }, [rphHighlights])

  // Flush unsaved changes on unmount
  React.useEffect(() => {
    return () => {
      if (!hasLoadedHighlightsRef.current) return
      const snapshot = JSON.stringify(rphHighlights)
      if (snapshot !== lastSavedSnapshotRef.current) {
        try { console.log('[PDF] unmount flush save'); saveHighlightsNow(rphHighlights) } catch {}
      }
    }
  }, [projectId, fileName, rphHighlights])
  
  // Allow quitting camera mode with Escape
  React.useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (tool === 'camera' || selectionRect || pendingScreenshot) {
        try { e.preventDefault() } catch {}
        setPendingScreenshot(null)
        setSelectionRect(null)
        selectionAnchorRef.current = null
        setTool('highlighter')
      }
    }
    window.addEventListener('keydown', onEsc)
    return () => { window.removeEventListener('keydown', onEsc) }
  }, [tool, selectionRect, pendingScreenshot])
  
  // Helper: find pdf.js page element and scroll viewer (pdf.js container) to it
  function scrollViewerToPage(pageNum: number): boolean {
    try {
      const pdfContainer = getPdfJsContainer()
      if (!pdfContainer) return false
      const pageEl = pdfContainer.querySelector(`.page[data-page-number="${pageNum}"]`) as HTMLElement | null
      if (!pageEl) {
        console.warn('[PDF] scrollViewerToPage: page element not found yet for', pageNum)
        return false
      }
      const cRect = pdfContainer.getBoundingClientRect()
      const pRect = pageEl.getBoundingClientRect()
      const nextTop = pdfContainer.scrollTop + (pRect.top - cRect.top) - 16
      console.log('[PDF] scrollViewerToPage', { pageNum, from: pdfContainer.scrollTop, to: nextTop })
      pdfContainer.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' })
      return true
    } catch (e) {
      console.warn('[PDF] scrollViewerToPage error', e)
      return false
    }
  }

  // Helper: try to locate a rendered highlight element
  function findHighlightElement(id: string): HTMLElement | null {
    const pdfContainer = getPdfJsContainer()
    const root: ParentNode = pdfContainer || viewerRef.current || document
    const el = root.querySelector(`[data-hl-id="${id}"]`) as HTMLElement | null
    const inner = el ? (el.querySelector('.Highlight__part') as HTMLElement | null) : null
    return inner || el
  }

  // Try scrolling to a highlight id with retries (to wait for render)
  function scrollToHighlightWithRetries(id: string, pageNum?: number) {
    let attempts = 0
    const maxAttempts = 12
    const delay = 150
    const tryOnce = () => {
      attempts += 1
      const el = findHighlightElement(id)
      if (el) {
        const scroller = getScrollableAncestor(el)
        if (scroller) {
          const sRect = scroller.getBoundingClientRect()
          const eRect = el.getBoundingClientRect()
          const nextTop = scroller.scrollTop + (eRect.top - sRect.top) - 24
          console.log('[PDF] retry: scrolling to highlight element', { attempts, nextTop })
          scroller.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' })
          return
        }
      }
      if (attempts < maxAttempts) {
        if (pageNum) scrollViewerToPage(pageNum)
        setTimeout(tryOnce, delay)
      } else {
        console.warn('[PDF] retry: failed to find highlight element after attempts', maxAttempts)
      }
    }
    tryOnce()
  }

  // Ensure PdfHighlighter/pages are ready, then perform jump
  function ensureReadyAndJump(id: string, pageNum: number | undefined, target: any) {
    pendingJumpRef.current = { id, page: pageNum }
    let tries = 0
    const max = 30
    const step = 150
    const tick = () => {
      tries += 1
      const pdfContainer = getPdfJsContainer()
      const hasPages = !!pdfContainer?.querySelector('.page')
      const hasLayer = !!pdfContainer?.querySelector('.PdfHighlighter__highlight-layer')
      if (pageNum) scrollViewerToPage(pageNum)
      if (hasPages || hasLayer) {
        // Only perform page scroll; avoid element alignment to prevent secondary adjustment
        pendingJumpRef.current = null
        return
      }
      if (tries < max) {
        try { window.dispatchEvent(new Event('resize')) } catch {}
        setTimeout(tick, step)
      } else {
        console.warn('[PDF] ensureReady: timed out waiting for pages/highlighter')
        if (pageNum) scrollViewerToPage(pageNum)
        pendingJumpRef.current = null
      }
    }
    tick()
  }

  // Determine pdf.js page location at a given window/client point
  function getPageLocationAtClientPoint(clientX: number, clientY: number): { pageNumber?: number; pageRelativeY?: number } {
    try {
      const pdfContainer = getPdfJsContainer()
      const root: ParentNode = pdfContainer || viewerRef.current || document
      const pages = root.querySelectorAll('.page') as NodeListOf<HTMLElement>
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i]
        const r = p.getBoundingClientRect()
        if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
          const val = p.getAttribute('data-page-number')
          const parsed = val ? parseInt(val, 10) : NaN
          const pageNumber = Number.isNaN(parsed) ? undefined : parsed
          const pageRelativeY = r.height > 0 ? Math.min(Math.max((clientY - r.top) / r.height, 0), 1) : undefined
          if (typeof pageNumber === 'number') {
            return { pageNumber, pageRelativeY }
          }
          return { pageRelativeY }
        }
      }
    } catch {}
    return {}
  }

  const exportButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const exportMenuRef = React.useRef<HTMLDivElement | null>(null)
  const [isExportMenuOpen, setIsExportMenuOpen] = React.useState(false)

  React.useEffect(() => {
    if (!isExportMenuOpen) return undefined
    function handlePointerDown(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (exportMenuRef.current?.contains(target)) return
      if (exportButtonRef.current?.contains(target)) return
      setIsExportMenuOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsExportMenuOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isExportMenuOpen])

  const exportHighlightsData = React.useCallback(async (format: 'pdf' | 'markdown') => {
    if (!Array.isArray(rphHighlights) || rphHighlights.length === 0) {
      alert('No highlights or screenshots to export yet.')
      return
    }
    try {
      const highlights = rphHighlights as ExportHighlight[]
      if (format === 'pdf') {
        await exportHighlightsAsPdf({ highlights, fileName })
      } else {
        exportHighlightsAsMarkdown({ highlights, fileName })
      }
    } catch (error) {
      console.error(`Failed to export ${format}`, error)
      alert(`Failed to export ${format === 'pdf' ? 'PDF' : 'Markdown'}`)
    }
  }, [rphHighlights, fileName])

  const handleExportPdf = React.useCallback(async () => {
    setIsExportMenuOpen(false)
    await exportHighlightsData('pdf')
  }, [exportHighlightsData])

  const handleExportMarkdown = React.useCallback(async () => {
    setIsExportMenuOpen(false)
    await exportHighlightsData('markdown')
  }, [exportHighlightsData])

  return (<>
    <div className="flex-1 min-w-0 w-full h-full flex flex-col">
      <div className="relative flex items-center pl-6 pr-4 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2 min-w-0">
          <nav className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5">
            <button
              className={`px-2.5 py-1.5 text-sm rounded ${pageTab === 'annotate' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setPageTab('annotate')}
            >
              Annotate
            </button>
            <button
              className={`px-2.5 py-1.5 text-sm rounded ${pageTab === 'writing' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setPageTab('writing')}
            >
              Writing
            </button>
          </nav>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 px-4 w-full max-w-md pointer-events-none z-40">
          <div className="relative pointer-events-auto flex items-center gap-2">
            <div className="relative flex-1">
              <input
                className="w-full h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 bg-white placeholder:text-gray-400 placeholder:text-center focus:placeholder-transparent focus:outline-none focus:ring-2 focus:ring-gray-200"
                placeholder="Search annotations or comments"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery ? (
                <button
                  className="absolute right-1.5 top-1.5 h-6 w-6 inline-flex items-center justify-center rounded hover:bg-gray-100"
                  onClick={() => setSearchQuery('')}
                  title="Clear"
                >
                  <img src={xIcon} alt="" className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <div className="relative">
              <button
                ref={exportButtonRef}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-gray-200 bg-white hover:bg-gray-50"
                onClick={() => setIsExportMenuOpen((prev) => !prev)}
                aria-label="Export highlights"
                aria-haspopup="menu"
                aria-expanded={isExportMenuOpen}
                title="Export"
              >
                <img src={exportIcon} alt="" className="h-4 w-4" />
              </button>
              {isExportMenuOpen ? (
                <div
                  ref={exportMenuRef}
                  className="absolute left-1/2 top-12 z-50 w-48 -translate-x-1/2 rounded-lg border border-gray-200 bg-white py-2 shadow-xl pointer-events-auto"
                  role="menu"
                >
                  <button
                    className="block w-full px-4 py-2 text-sm text-left text-gray-800 hover:bg-gray-100"
                    onClick={() => { void handleExportPdf() }}
                    role="menuitem"
                  >
                    Export as PDF
                  </button>
                  <button
                    className="block w-full px-4 py-2 text-sm text-left text-gray-800 hover:bg-gray-100"
                    onClick={() => { void handleExportMarkdown() }}
                    role="menuitem"
                  >
                    Export as Markdown
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3 min-w-0">
          <button
            className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-gray-200 bg-white hover:bg-gray-50"
            onClick={onClose}
            aria-label="Close split view"
            title="Close"
          >
            <img src={xIcon} alt="" className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex">
        <div ref={viewerRef} className="relative w-1/2 h-full min-w-0 border-r border-gray-200 bg-gray-50 overflow-y-auto overflow-x-hidden overscroll-contain pdf-viewer-container">
          {blobUrl ? (
            <PdfLoader
              key={blobUrl || fileName}
              url={blobUrl}
              workerSrc={undefined as unknown as string}
              beforeLoad={<div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">Loading PDF…</div>}
              onError={(e: any) => { console.error('PdfLoader error', e) }}
              errorMessage={<div className="w-full h-full flex items-center justify-center text-red-600 text-sm">Failed to load PDF</div>}
            >
              {(pdfDocument: any) => {
                console.log('PdfLoader loaded', { pages: pdfDocument?.numPages })
                return (
                <PdfHighlighter
                  key={blobUrl || fileName}
                  pdfDocument={pdfDocument}
                  pdfScaleValue={pdfScaleValue as any}
                  onScrollChange={() => { console.log('[PDF] PdfHighlighter onScrollChange') }}
                  scrollRef={(scrollTo: any) => {
                    console.log('[PDF] scrollRef set')
                    isHighlighterReadyRef.current = true
                    // Force a refresh of highlights prop to trigger overlay render now that viewer is ready
                    setTimeout(() => {
                      setRphHighlights((prev) => { console.log('[PDF] refreshing highlights after ready'); return prev.slice() })
                    }, 0)
                    scrollToHighlightRef.current = (arg: any) => {
                      try {
                        console.log('[PDF] scrollToHighlightRef called with', arg?.id || arg)
                        // Prefer scrolling with the full highlight object
                        try { scrollTo(arg); console.log('[PDF] scrollTo(arg) invoked') } catch (e) { console.warn('[PDF] scrollTo(arg) failed', e) }
                        // Fallback: try by id if available
                        const maybeId = typeof arg === 'string' ? arg : arg?.id
                        if (maybeId) {
                          try { scrollTo(maybeId); console.log('[PDF] scrollTo(id) invoked') } catch (e) { console.warn('[PDF] scrollTo(id) failed', e) }
                        }
                      } catch (e) {
                        console.warn('[PDF] scrollToHighlightRef error', e)
                      }
                    }
                    // If a jump was queued before ready, perform it now
                    const pending = pendingJumpRef.current
                    if (pending) {
                      console.log('[PDF] performing pending jump', pending)
                      const target = rphHighlights.find((h) => h.id === pending.id)
                      if (target) {
                        try { scrollToHighlightRef.current(target) } catch {}
                        scrollToHighlightWithRetries(pending.id, pending.page)
                      }
                      pendingJumpRef.current = null
                    }
                  }}
                  enableAreaSelection={(event: any) => false}
                  onSelectionFinished={(position: any, content: any, hideTip: () => void) => {
                    if (tool !== 'highlighter') return null
                    return (
                      <div className="px-[6px] py-1 shadow-lg border border-gray-200 bg-white rounded-[20px]">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="h-7 w-7 flex items-center justify-center hover:opacity-90 active:scale-[0.98] transition"
                            title="Add highlight"
                            aria-label="Add highlight"
                            onClick={() => {
                              const id = generateId()
                              const comment = { text: '', emoji: '' }
                              console.log('[PDF] add highlight', { id, position, content })
                              setRphHighlights((prev) => {
                                const next = [...prev, { id, position, content, comment }]
                                saveHighlightsNow(next)
                                return next
                              })
                              hideTip()
                            }}
                          >
                            <img src={checkIcon} alt="" className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            className="h-7 w-7 flex items-center justify-center hover:opacity-90 active:scale-[0.98] transition"
                            title="Copy text"
                            aria-label="Copy text"
                            onClick={() => {
                              try {
                                const text = (content && content.text) ? String(content.text) : ''
                                if (text && text.trim().length > 0) {
                                  navigator.clipboard?.writeText(text).catch(() => {})
                                }
                              } catch {}
                              hideTip()
                            }}
                          >
                            <img src={filesCopyIcon} alt="" className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  }}
                  highlightTransform={(highlight: any, _index: number, _setTip: any, _hideTip: any, _viewportToScaled: any, _screenshot: any, isScrolledTo: boolean) => (
                    highlight?.kind === 'screenshot' ? (
                      <div key={highlight.id} data-hl-id={highlight.id} />
                    ) : (
                      <div key={highlight.id} data-hl-id={highlight.id}>
                        <Highlight position={highlight.position} isScrolledTo={isScrolledTo} comment={highlight.comment} />
                        {isScrolledTo ? <div style={{ display: 'none' }} data-hl-scrolled-flag={highlight.id} /> : null}
                      </div>
                    )
                  )}
                  highlights={overlayHighlights}
                />
                )
              }}
            </PdfLoader>
          ) : loadError ? (
            <div className="w-full h-full flex items-center justify-center text-center px-6 text-red-600 text-sm">
              {loadError}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">Loading PDF…</div>
          )}
          {/* Selection rectangle overlay (window-only capture) */}
          {(tool === 'camera' || !!pendingScreenshot) && !isCapturing && (
            <div
              className="absolute inset-0 z-20 cursor-crosshair"
              onMouseDown={(e) => {
                if (pendingScreenshot) return
                // Only start selection within this left pane
                const host = e.currentTarget as HTMLDivElement
                const rect = host.getBoundingClientRect()
                const x = e.clientX - rect.left
                const y = e.clientY - rect.top
                selectionAnchorRef.current = { x, y }
                setSelectionRect({ x, y, width: 0, height: 0 })
              }}
              onMouseMove={(e) => {
                if (pendingScreenshot) return
                if (!selectionAnchorRef.current) return
                const host = e.currentTarget as HTMLDivElement
                const rect = host.getBoundingClientRect()
                const currX = e.clientX - rect.left
                const currY = e.clientY - rect.top
                const start = selectionAnchorRef.current
                const x = Math.min(start.x, currX)
                const y = Math.min(start.y, currY)
                const width = Math.abs(currX - start.x)
                const height = Math.abs(currY - start.y)
                setSelectionRect({ x, y, width, height })
              }}
              onMouseUp={async (e) => {
                if (pendingScreenshot) return
                if (!selectionRect || selectionRect.width < 2 || selectionRect.height < 2) {
                  setSelectionRect(null)
                  selectionAnchorRef.current = null
                  return
                }
                // Convert rect (in this pane) into window coordinates for capturePage
                const pane = e.currentTarget as HTMLDivElement
                const paneRect = pane.getBoundingClientRect()
                const xInWindow = Math.floor(paneRect.left + selectionRect.x)
                const yInWindow = Math.floor(paneRect.top + selectionRect.y)
                const w = Math.floor(selectionRect.width)
                const h = Math.floor(selectionRect.height)
                const api = (window as any).api
                // Hide overlay before capture to avoid tint/outline in image
                setIsCapturing(true)
                await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
                const res: { ok: boolean; dataUrl?: string } | undefined = await api?.screenshots?.captureRect?.({ x: xInWindow, y: yInWindow, width: w, height: h })
                if (res && res.ok && res.dataUrl) {
                  setPendingScreenshot({ dataUrl: res.dataUrl })
                } else {
                  // reset on failure
                  setSelectionRect(null)
                  selectionAnchorRef.current = null
                }
                setIsCapturing(false)
              }}
            >
              {selectionRect ? (
                <div
                  className="absolute border-2 border-gray-300 bg-gray-500/20"
                  style={{ left: selectionRect.x, top: selectionRect.y, width: selectionRect.width, height: selectionRect.height }}
                />
              ) : null}
              {pendingScreenshot && selectionRect ? (
                <div
                  className="absolute -translate-x-1/2"
                  style={{ left: selectionRect.x + (selectionRect.width / 2), top: selectionRect.y + selectionRect.height + 8 }}
                >
                  <div className="px-[6px] py-1 shadow-lg border border-gray-200 bg-white rounded-[20px]">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="h-7 w-7 flex items-center justify-center hover:opacity-90 active:scale-[0.98] transition"
                        title="Approve"
                        aria-label="Approve"
                        onClick={() => {
                          const snap = pendingScreenshot
                          const rect = selectionRect
                          if (!snap || !rect) return
                          const id = generateId()
                          // Compute page at the center of the selection in window coords
                          let pageNumber: number | undefined
                          let pageRelativeY: number | undefined
                          try {
                            const host = viewerRef.current as HTMLDivElement | null
                            if (host) {
                              const hostRect = host.getBoundingClientRect()
                              const cx = hostRect.left + rect.x + (rect.width / 2)
                              const cy = hostRect.top + rect.y + (rect.height / 2)
                              const location = getPageLocationAtClientPoint(cx, cy)
                              pageNumber = location.pageNumber
                              pageRelativeY = location.pageRelativeY
                            }
                          } catch {}
                          const dpr = (typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number') ? window.devicePixelRatio : 1
                          const screenshot = {
                            dataUrl: snap.dataUrl,
                            pageNumber,
                            cssWidth: rect.width,
                            cssHeight: rect.height,
                            devicePixelRatio: dpr,
                            ...(typeof pageRelativeY === 'number' ? { pageRelativeY } : {}),
                          }
                          const item = {
                            id,
                            kind: 'screenshot',
                            ...(typeof pageRelativeY === 'number' ? { pageRelativeY } : {}),
                            screenshot,
                            comment: { text: '', emoji: '' }
                          }
                          setRphHighlights((prev) => {
                            const next = [...prev, item]
                            saveHighlightsNow(next)
                            return next
                          })
                          setPendingScreenshot(null)
                          setSelectionRect(null)
                          selectionAnchorRef.current = null
                          setTool('highlighter')
                        }}
                      >
                        <img src={checkIcon} alt="" className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="h-7 w-7 flex items-center justify-center hover:opacity-90 active:scale-[0.98] transition"
                        title="Cancel"
                        aria-label="Cancel"
                        onClick={() => {
                          setPendingScreenshot(null)
                          setSelectionRect(null)
                          selectionAnchorRef.current = null
                          setTool('highlighter')
                        }}
                      >
                        <img src={xIcon} alt="" className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
          {/* Bottom toolbar overlay */}
          <PdfToolbar active={tool} onChangeActive={setTool} />
          {/* Zoom toolbar overlay (bottom-right) */}
          <PdfZoomToolbar
            value={zoom}
            onZoomOut={() => {
              setZoom((prev) => {
                const current = typeof prev === 'number' ? prev : 1
                const next = Math.max(0.5, Math.round((current - 0.2) * 100) / 100)
                return next
              })
            }}
            onAuto={() => setZoom('auto')}
            onZoomIn={() => {
              setZoom((prev) => {
                const current = typeof prev === 'number' ? prev : 1
                const next = Math.min(3, Math.round((current + 0.2) * 100) / 100)
                return next
              })
            }}
          />
        </div>
        <div className="w-1/2 h-full min-w-0">
          <SplitHighlights
            highlights={rphHighlights}
            onJumpTo={(id) => {
              console.log('[PDF] onJumpTo clicked', id)
              const target = rphHighlights.find((h) => h.id === id)
              if (target) {
                const pageNum = getPageNumberFromHighlight(target)
                // Use smooth scrolling consistently for highlights
                if (pageNum) scrollViewerToPage(pageNum)
              } else {
                console.warn('[PDF] onJumpTo: target not found in rphHighlights')
              }
            }}
            onDelete={(id) => {
              console.log('[PDF] delete highlight', id)
              setRphHighlights((prev) => prev.filter((h) => h.id !== id))
            }}
            onChangeComment={(id, text) => {
              setRphHighlights((prev) => prev.map((h) => h.id === id ? { ...h, comment: { ...(h.comment || {}), text } } : h))
            }}
            onJumpToPage={(page) => {
              // Scroll the viewer to the given page number
              scrollViewerToPage(page)
            }}
            activeTab={activeTab}
            searchQuery={searchQuery}
          />
        </div>
      </div>
    </div>
    </>
  )
}
