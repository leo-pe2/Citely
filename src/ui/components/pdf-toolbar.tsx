import React from 'react'
import { motion } from 'framer-motion'
import highlighterIcon from '../assets/highlighter.svg'
import cameraIcon from '../assets/camera.svg'

type PdfToolbarProps = {
  roundedPx?: number
  active: 'highlighter' | 'camera'
  onChangeActive: (next: 'highlighter' | 'camera') => void
}

export default function PdfToolbar({ roundedPx = 20, active, onChangeActive }: PdfToolbarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center z-10">
      <div
        className="pointer-events-auto px-[6px] py-1 shadow-lg border border-gray-200 bg-white"
        style={{ borderRadius: `${roundedPx}px` }}
      >
        <div className="relative flex items-center gap-1.5">
          {/* Animated selection pill */}
          <motion.div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/5"
            initial={false}
            animate={{ x: active === 'highlighter' ? 0 : 38 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            aria-hidden
          />
          <button
            type="button"
            className="relative z-10 h-8 w-8 flex items-center justify-center hover:opacity-90 active:scale-[0.98] transition"
            title="Highlighter"
            aria-label="Highlighter"
            aria-pressed={active === 'highlighter'}
            onClick={() => onChangeActive('highlighter')}
          >
            <img src={highlighterIcon} alt="" className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="relative z-10 h-8 w-8 flex items-center justify-center hover:opacity-90 active:scale-[0.98] transition"
            title="Snapshot"
            aria-label="Snapshot"
            aria-pressed={active === 'camera'}
            onClick={() => onChangeActive('camera')}
          >
            <img src={cameraIcon} alt="" className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}


