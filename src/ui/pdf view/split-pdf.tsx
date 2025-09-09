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
  function getPageNumberFromHighlight(h: any): number | undefined {
    if (!h || !h.position) return undefined
    if (typeof h.position.pageNumber === 'number') return h.position.pageNumber
    if (h.position.boundingRect && typeof h.position.boundingRect.pageNumber === 'number') return h.position.boundingRect.pageNumber
    if (Array.isArray(h.position.rects) && h.position.rects.length > 0 && typeof h.position.rects[0]?.pageNumber === 'number') {
      return h.position.rects[0].pageNumber
    }
    return undefined
  }

  function getScrollableAncestor(element: HTMLElement | null): HTMLElement | null {
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
    return docEl || null
  }

  function generateId(): string {
    return `hl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  }

  function saveHighlightsNow(nextHighlights: any[]) {
    const api = (window as any).api
    if (!api?.projects?.highlights?.set) return
    try {
      api.projects.highlights.set(projectId, fileName, nextHighlights)
      lastSavedSnapshotRef.current = JSON.stringify(nextHighlights)
    } catch {}
  }
  const blobUrl = React.useMemo(() => {
    if (!pdfData) return null
    try {
      return URL.createObjectURL(new Blob([pdfData], { type: 'application/pdf' }))
    } catch {
      return null
    }
  }, [pdfData])
  React.useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [blobUrl])

  React.useEffect(() => {
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
      } catch (e) {
        console.error('Failed to read PDF', e)
        setLoadError(e instanceof Error ? e.message : 'Unknown error')
      }
    })()
    return () => {
      revoked = true
      cancelled = true
    }
  }, [path])

  // Rely on PdfLoader for document loading; keep local counters unused for now

  // Measure available width to fit pages nicely
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
        })
      }
    })
    ro.observe(el)
    const rect = el.getBoundingClientRect()
    setViewerWidth(Math.floor(rect.width))
    setViewerHeight(Math.floor(rect.height))
    return () => {
      ro.disconnect()
      if (resizeRaf.current != null) cancelAnimationFrame(resizeRaf.current)
    }
  }, [])

  // Load persisted highlights for this project/file
  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const api = (window as any).api
        const saved: any[] | undefined = await api?.projects?.highlights?.get?.(projectId, fileName)
        if (!mounted) return
        if (Array.isArray(saved)) {
          setRphHighlights(saved)
          lastSavedSnapshotRef.current = JSON.stringify(saved)
        } else {
          setRphHighlights([])
          lastSavedSnapshotRef.current = "[]"
        }
        hasLoadedHighlightsRef.current = true
      } catch {
        setRphHighlights([])
        lastSavedSnapshotRef.current = "[]"
        hasLoadedHighlightsRef.current = true
      }
    })()
    return () => {
      mounted = false
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
        api.projects.highlights.set(projectId, fileName, rphHighlights)
        lastSavedSnapshotRef.current = JSON.stringify(rphHighlights)
      } catch {}
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
      try { window.dispatchEvent(new Event('resize')) } catch {}
    }, 0)
    return () => { if (id) window.clearTimeout(id) }
  }, [rphHighlights])

  // Flush unsaved changes on unmount
  React.useEffect(() => {
    return () => {
      if (!hasLoadedHighlightsRef.current) return
      const snapshot = JSON.stringify(rphHighlights)
      if (snapshot !== lastSavedSnapshotRef.current) {
        try { saveHighlightsNow(rphHighlights) } catch {}
      }
    }
  }, [projectId, fileName, rphHighlights])
  

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
                  onScrollChange={() => { /* noop */ }}
                  scrollRef={(scrollTo: any) => {
                    scrollToHighlightRef.current = (arg: any) => {
                      try {
                        // Prefer scrolling with the full highlight object
                        try { scrollTo(arg) } catch {}
                        // Fallback: try by id if available
                        const maybeId = typeof arg === 'string' ? arg : arg?.id
                        if (maybeId) {
                          try { scrollTo(maybeId) } catch {}
                        }
                      } catch {}
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
                            const comment = { text: content?.text || '', emoji: '' }
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
              const target = rphHighlights.find((h) => h.id === id)
              if (target) {
                // Try the library's scroll helper first
                if (scrollToHighlightRef.current) {
                  try { scrollToHighlightRef.current(target) } catch {}
                }
                // Fallback A: scroll to the specific highlight element (prefer the actual part rect)
                const tryScrollToHighlightEl = () => {
                  try {
                    const containerRoot = viewerRef.current
                    const el = (containerRoot || document).querySelector(`[data-hl-id="${id}"]`) as HTMLElement | null
                    const inner = el ? (el.querySelector('.Highlight__part') as HTMLElement | null) : null
                    const targetEl = inner || el
                    const scroller = getScrollableAncestor(targetEl)
                    if (targetEl && scroller) {
                      const sRect = scroller.getBoundingClientRect()
                      const eRect = targetEl.getBoundingClientRect()
                      const nextTop = scroller.scrollTop + (eRect.top - sRect.top) - 24
                      scroller.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' })
                      return true
                    }
                  } catch {}
                  return false
                }
                if (!tryScrollToHighlightEl()) {
                  try { setTimeout(tryScrollToHighlightEl, 50) } catch {}
                }
                // Fallback B: scroll the viewer to the page top if needed
                try {
                  const pageNum = getPageNumberFromHighlight(target)
                  const container = viewerRef.current
                  if (pageNum && container) {
                    const pageEl = container.querySelector(`div.react-pdf__Page[data-page-number="${pageNum}"]`) as HTMLElement | null
                    if (pageEl) {
                      const cRect = container.getBoundingClientRect()
                      const pRect = pageEl.getBoundingClientRect()
                      const nextTop = container.scrollTop + (pRect.top - cRect.top) - 16
                      container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' })
                    }
                  }
                } catch {}
              }
            }}
            onDelete={(id) => {
              setRphHighlights((prev) => prev.filter((h) => h.id !== id))
            }}
          />
        </div>
      </div>
    </div>
  )
}


