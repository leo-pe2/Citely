import React from 'react'
import * as pdfjsLib from 'pdfjs-dist'
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
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

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

  // Render first page at 100% zoom using PDF.js
  React.useEffect(() => {
    let destroyed = false
    ;(async () => {
      if (!pdfData || !canvasRef.current) return
      try {
        const loadingTask = pdfjsLib.getDocument({ data: pdfData })
        const pdf = await loadingTask.promise
        if (destroyed) return
        const page = await pdf.getPage(1)
        const scale = 1
        const viewport = page.getViewport({ scale })

        const canvas = canvasRef.current!
        const context = canvas.getContext('2d')!
        const outputScale = Math.max(1, window.devicePixelRatio || 1)
        canvas.width = Math.floor(viewport.width * outputScale)
        canvas.height = Math.floor(viewport.height * outputScale)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        context.setTransform(outputScale, 0, 0, outputScale, 0, 0)

        await page.render({ canvasContext: context, viewport }).promise
      } catch (e) {
        if (!destroyed) {
          console.error('Failed to render PDF', e)
          setLoadError('Failed to render PDF')
        }
      }
    })()
    return () => {
      destroyed = true
    }
  }, [pdfData])

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
        <div className="w-1/2 h-full min-w-0 border-r border-gray-200 bg-gray-50 overflow-auto">
          {pdfData ? (
            <div className="w-full h-full flex items-start justify-center p-4">
              <canvas ref={canvasRef} className="shadow-sm bg-white" />
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


