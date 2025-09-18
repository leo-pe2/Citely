import React from 'react'

type PdfZoomToolbarProps = {
  value: 'auto' | number
  onZoomOut: () => void
  onAuto: () => void
  onZoomIn: () => void
  roundedPx?: number
}

export default function PdfZoomToolbar({ value, onZoomOut, onAuto, onZoomIn, roundedPx = 20 }: PdfZoomToolbarProps) {
  const label = typeof value === 'number' ? `${Math.round(value * 100)}%` : 'Auto'
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-10">
      <div
        className="pointer-events-auto px-[6px] py-1 shadow-lg border border-gray-200 bg-white"
        style={{ borderRadius: `${roundedPx}px` }}
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="h-8 min-w-8 px-2 flex items-center justify-center text-black/90 hover:opacity-90 active:scale-[0.98] transition"
            title="Zoom out"
            aria-label="Zoom out"
            onClick={onZoomOut}
          >
            <span className="text-base leading-none">−</span>
          </button>
          <button
            type="button"
            className="h-8 min-w-[56px] px-2 flex items-center justify-center text-black/90 hover:opacity-90 active:scale-[0.98] transition border-x border-gray-200"
            title="Auto zoom"
            aria-label="Auto zoom"
            onClick={onAuto}
          >
            <span className="text-xs leading-none">{label}</span>
          </button>
          <button
            type="button"
            className="h-8 min-w-8 px-2 flex items-center justify-center text-black/90 hover:opacity-90 active:scale-[0.98] transition"
            title="Zoom in"
            aria-label="Zoom in"
            onClick={onZoomIn}
          >
            <span className="text-base leading-none">+</span>
          </button>
        </div>
      </div>
    </div>
  )
}


