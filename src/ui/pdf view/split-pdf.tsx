import React from 'react'
import SplitHighlights from './split-highlights'
import { PdfLoader, PdfHighlighter, Highlight } from 'react-pdf-highlighter'
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
  const scrollToHighlightRef = React.useRef<((h: any) => void) | null>(null)
  const hasLoadedHighlightsRef = React.useRef<boolean>(false)
  const saveDebounceRef = React.useRef<number | null>(null)
  const lastSavedSnapshotRef = React.useRef<string>("[]")
  const isHighlighterReadyRef = React.useRef<boolean>(false)
  const pendingJumpRef = React.useRef<{ id: string; page?: number } | null>(null)
  function getPageNumberFromHighlight(h: any): number | undefined {
    if (!h || !h.position) return undefined
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
    } catch (e) {
      console.warn('[PDF] saveHighlightsNow failed', e)
    }
  }
  const blobUrl = React.useMemo(() => {
    if (!pdfData) return null
    try {
      const url = URL.createObjectURL(new Blob([pdfData], { type: 'application/pdf' }))
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
      } catch (e) {
        console.warn('[PDF] debounce-save failed', e)
      }
    }, 300)
    saveDebounceRef.current = id
    return () => {
      if (id) window.clearTimeout(id)
    }
  }, [projectId, fileName, rphHighlights])

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
      const hasScrollRef = !!scrollToHighlightRef.current
      if (pageNum) scrollViewerToPage(pageNum)
      if (hasPages || hasLayer || hasScrollRef) {
        if (hasScrollRef) {
          try { console.log('[PDF] ensureReady: using library scroll'); scrollToHighlightRef.current!(target || id) } catch {}
        }
        scrollToHighlightWithRetries(id, pageNum)
        pendingJumpRef.current = null
        return
      }
      if (tries < max) {
        try { window.dispatchEvent(new Event('resize')) } catch {}
        setTimeout(tick, step)
      } else {
        console.warn('[PDF] ensureReady: timed out waiting for pages/highlighter')
        if (pageNum) scrollViewerToPage(pageNum)
        scrollToHighlightWithRetries(id, pageNum)
        pendingJumpRef.current = null
      }
    }
    tick()
  }

  return (
    <div className="flex-1 min-w-0 w-full h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="text-base text-gray-800 truncate max-w-[70%]" title={fileName}>{fileName}</div>
        <button
          className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:border-black"
          onClick={onClose}
          aria-label="Close split view"
        >
          Close
        </button>
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
                  pdfScaleValue="page-fit"
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
                    // Show a minimal confirmation so user explicitly creates a highlight
                    return (
                      <div className="rounded-md bg-white border border-gray-300 shadow-sm p-2 flex items-center gap-2">
                        <button
                          className="px-2 py-0.5 text-xs rounded bg-black text-white hover:opacity-90"
                          onClick={() => {
                            const id = generateId()
                            const comment = { text: '', emoji: '' }
                            console.log('[PDF] add highlight', { id, position, content })
                            setRphHighlights((prev) => {
                              const next = [...prev, { id, position, content, comment }]
                              // Save immediately to avoid losing changes if the view is closed quickly
                              saveHighlightsNow(next)
                              return next
                            })
                            hideTip()
                          }}
                        >
                          Add highlight
                        </button>
                        <button
                          className="px-2 py-0.5 text-xs rounded border border-gray-300 hover:bg-gray-50"
                          onClick={() => {
                            console.log('[PDF] cancel add highlight')
                            hideTip()
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )
                  }}
                  highlightTransform={(highlight: any, _index: number, _setTip: any, _hideTip: any, _viewportToScaled: any, _screenshot: any, isScrolledTo: boolean) => (
                    <div key={highlight.id} data-hl-id={highlight.id}>
                      <Highlight position={highlight.position} isScrolledTo={isScrolledTo} comment={highlight.comment} />
                      {isScrolledTo ? <div style={{ display: 'none' }} data-hl-scrolled-flag={highlight.id} /> : null}
                    </div>
                  )}
                  highlights={rphHighlights}
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
        </div>
        <div className="w-1/2 h-full min-w-0">
          <SplitHighlights
            highlights={rphHighlights}
            onJumpTo={(id) => {
              console.log('[PDF] onJumpTo clicked', id)
              const target = rphHighlights.find((h) => h.id === id)
              if (target) {
                const pageNum = getPageNumberFromHighlight(target)
                // Try the library's scroll helper first if ready
                if (scrollToHighlightRef.current) {
                  try { console.log('[PDF] attempting scroll via library helper'); scrollToHighlightRef.current(target) } catch (e) { console.warn('[PDF] library helper scroll failed', e) }
                  if (pageNum) scrollViewerToPage(pageNum)
                  scrollToHighlightWithRetries(id, pageNum)
                } else {
                  console.warn('[PDF] scrollToHighlightRef not ready')
                  ensureReadyAndJump(id, pageNum, target)
                }
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
          />
        </div>
      </div>
    </div>
  )
}


