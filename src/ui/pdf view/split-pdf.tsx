import React from 'react'
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
  const hasLoadedHighlightsRef = React.useRef<boolean>(false)
  const saveDebounceRef = React.useRef<number | null>(null)
  const lastSavedSnapshotRef = React.useRef<string>("[]")

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

  // Nudge the scroll container to trigger PdfHighlighter's internal layout without user click
  React.useEffect(() => {
    if (!hasLoadedHighlightsRef.current) return
    if (!blobUrl) return
    const container = viewerRef.current
    const id = window.setTimeout(() => {
      try { window.dispatchEvent(new Event('resize')) } catch {}
      if (container) {
        try { container.dispatchEvent(new Event('scroll')) } catch {}
        try {
          const current = container.scrollTop
          container.scrollTop = current + 1
          container.scrollTop = current
        } catch {}
      }
    }, 50)
    return () => { if (id) window.clearTimeout(id) }
  }, [blobUrl, rphHighlights])

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
                  key={`${blobUrl || fileName}:${rphHighlights.length}`}
                  pdfDocument={pdfDocument}
                  pdfScaleValue="page-fit"
                  onScrollChange={() => { /* noop */ }}
                  scrollRef={(scrollTo: any) => { console.log('PdfHighlighter mounted'); /* store if needed */ }}
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
                    <Highlight key={highlight.id} position={highlight.position} isScrolledTo={isScrolledTo} comment={highlight.comment} />
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
          {/* Right side reserved for notes and interactions */}
        </div>
      </div>
    </div>
  )
}


