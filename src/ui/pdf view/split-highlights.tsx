import React from 'react'

type SplitHighlightsProps = {
  highlights: any[]
  onJumpTo: (id: string) => void
}

export default function SplitHighlights({ highlights, onJumpTo }: SplitHighlightsProps) {
  if (!highlights || highlights.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
        No highlights yet.
      </div>
    )
  }

  return (
    <div className="w-full h-full overflow-y-auto p-4">
      <ol className="space-y-4">
        {highlights.map((h, idx) => {
          const text = h?.content?.text || ''
          return (
            <li key={h.id}>
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-black text-white text-xs font-medium flex items-center justify-center select-none">
                  {idx + 1}
                </div>
                <button
                  className="flex-1 text-left text-sm text-gray-900 border border-gray-300 border-dashed rounded-md px-2 py-1 hover:bg-gray-50 inline-flex items-center"
                  onClick={() => onJumpTo(h.id)}
                  title="Go to highlight"
                >
                  {text || '—'}
                </button>
              </div>
            </li>
          )
        })}
      </ol>
      <div className="h-4" />
    </div>
  )
}


