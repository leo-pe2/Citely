import React from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { EventBus, PDFPageView } from 'pdfjs-dist/web/pdf_viewer.mjs'
import 'pdfjs-dist/web/pdf_viewer.css'
// Use Vite to resolve worker file URL
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - url import provided by Vite
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc as unknown as string

type SplitPdfProps = {
  onClose: () => void
  projectId: string
  path: string
  fileName: string
}

export default function SplitPdf({ onClose, projectId, path, fileName }: SplitPdfProps) {
  const [pdfData, setPdfData] = React.useState<Uint8Array | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [numPages, setNumPages] = React.useState<number>(0)
  const [pdfDoc, setPdfDoc] = React.useState<any | null>(null)
  const viewerRef = React.useRef<HTMLDivElement | null>(null)
  const [viewerWidth, setViewerWidth] = React.useState<number>(0)
  const [viewerHeight, setViewerHeight] = React.useState<number>(0)
  const eventBusRef = React.useRef<any | null>(null)

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

  // Load document and page count
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!pdfData) return
      try {
        const loadingTask = pdfjsLib.getDocument({ data: pdfData })
        const pdf = await loadingTask.promise
        if (cancelled) return
        setPdfDoc(pdf)
        setNumPages(pdf.numPages || 0)
        if (!eventBusRef.current) eventBusRef.current = new EventBus()
      } catch (e) {
        console.error('Failed to load PDF', e)
        if (!cancelled) setLoadError('Failed to load PDF')
      }
    })()
    return () => { cancelled = true }
  }, [pdfData])

  // Measure available width to fit pages nicely
  React.useEffect(() => {
    const el = viewerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewerWidth(Math.floor(entry.contentRect.width))
        setViewerHeight(Math.floor(entry.contentRect.height))
      }
    })
    ro.observe(el)
    const rect = el.getBoundingClientRect()
    setViewerWidth(Math.floor(rect.width))
    setViewerHeight(Math.floor(rect.height))
    return () => ro.disconnect()
  }, [])

  type HighlightRect = { left: number; top: number; width: number; height: number }

  function PdfPage({ pdf, pageNumber, fittedWidth, fittedHeight, eventBus }: { pdf: any; pageNumber: number; fittedWidth: number; fittedHeight: number; eventBus: any }) {
    const pageContainerRef = React.useRef<HTMLDivElement | null>(null)
    const [highlights, setHighlights] = React.useState<HighlightRect[]>([])

    React.useEffect(() => {
      let destroyed = false
      ;(async () => {
        try {
          const page = await pdf.getPage(pageNumber)
          const unscaled = page.getViewport({ scale: 1 })
          const widthScale = fittedWidth > 0 ? fittedWidth / unscaled.width : 1
          // Ignore height for scaling to guarantee width fits; still cap to 100%
          const heightScale = fittedHeight > 0 ? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY
          const scale = Math.max(0.1, Math.min(widthScale, heightScale, 1))
          const container = pageContainerRef.current!
          container.innerHTML = ''

          const annotationModeValue = (pdfjsLib as any).AnnotationMode?.ENABLE ?? 1
          const pageView: any = new PDFPageView({
            container,
            id: pageNumber,
            scale,
            defaultViewport: unscaled,
            eventBus,
            annotationMode: annotationModeValue,
            textLayerMode: 2,
          })
          pageView.setPdfPage(page)
          await pageView.draw()
        } catch (e) {
          if (!destroyed) console.error('Failed to render page', e)
        }
      })()
      return () => { destroyed = true }
    }, [pdf, pageNumber, fittedWidth, fittedHeight, eventBus])

    // Right-click to add highlight for the current selection
    const onContextMenu = React.useCallback((e: React.MouseEvent) => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) return
      const ranges: DOMRect[] = []
      for (let i = 0; i < selection.rangeCount; i += 1) {
        const range = selection.getRangeAt(i)
        const rects = Array.from(range.getClientRects())
        ranges.push(...rects)
      }
      if (ranges.length === 0) return
      const container = pageContainerRef.current!
      const containerRect = container.getBoundingClientRect()
      const newRects: HighlightRect[] = ranges.map(r => ({
        left: r.left - containerRect.left,
        top: r.top - containerRect.top,
        width: r.width,
        height: r.height,
      }))
      setHighlights(prev => [...prev, ...newRects])
      selection.removeAllRanges()
      e.preventDefault()
    }, [])

    return (
      <div className="relative mb-4 flex justify-center select-text" onContextMenu={onContextMenu}>
        <div ref={pageContainerRef} className="shadow-sm bg-white" />
        <div className="absolute inset-0 pointer-events-none">
          {highlights.map((h, idx) => (
            <div
              key={idx}
              className="absolute bg-yellow-300/60 rounded-sm"
              style={{ left: h.left, top: h.top, width: h.width, height: h.height }}
            />
          ))}
        </div>
      </div>
    )
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
        <div ref={viewerRef} className="w-1/2 h-full min-w-0 border-r border-gray-200 bg-gray-50 overflow-y-auto overflow-x-hidden overscroll-contain">
          {pdfData ? (
            <div className="pdfViewer w-full flex flex-col items-center p-4 gap-4">
              {pdfDoc && numPages > 0 && eventBusRef.current && (
                Array.from({ length: numPages }, (_, i) => (
                  <PdfPage
                    key={i}
                    pdf={pdfDoc}
                    pageNumber={i + 1}
                    fittedWidth={Math.max(0, viewerWidth - 32)}
                    fittedHeight={Math.max(0, viewerHeight - 32)}
                    eventBus={eventBusRef.current}
                  />
                ))
              )}
            </div>
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


