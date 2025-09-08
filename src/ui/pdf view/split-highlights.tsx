import React from 'react'

type SplitHighlightsProps = {
  highlights: any[]
  onJumpTo: (id: string) => void
  onDelete: (id: string) => void
}

function getPageNumber(h: any): number | undefined {
  if (!h || !h.position) return undefined
  if (typeof h.position.pageNumber === 'number') return h.position.pageNumber
  if (h.position.boundingRect && typeof h.position.boundingRect.pageNumber === 'number') return h.position.boundingRect.pageNumber
  if (Array.isArray(h.position.rects) && h.position.rects.length > 0 && typeof h.position.rects[0]?.pageNumber === 'number') {
    return h.position.rects[0].pageNumber
  }
  return undefined
}

export default function SplitHighlights({ highlights, onJumpTo, onDelete }: SplitHighlightsProps) {
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
          const pageNumber = getPageNumber(h)
          return (
            <li key={h.id}>
              <div className="relative grid grid-cols-[1.5rem_1fr] gap-x-2.5">
                <div className="col-[1] row-[1] flex items-stretch justify-center">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-black text-white text-[10px] font-medium flex items-center justify-center select-none leading-none mt-0.5">{idx + 1}</div>
                    <div className="w-px bg-gray-300 flex-1" />
                  </div>
                </div>
                <div className="col-[2] row-[1]">
                  <button
                    className="w-full text-left text-base text-gray-900 border border-gray-300 border-dashed rounded-md px-2 py-2 hover:bg-gray-50 inline-flex items-center"
                    onClick={() => onJumpTo(h.id)}
                    title="Go to highlight"
                  >
                    {text || '—'}
                  </button>
                </div>
                <div className="col-[1] row-[2] flex items-stretch justify-center">
                  <div className="w-px bg-gray-300 h-full" />
                </div>
                <div className="col-[2] row-[2]"><div className="h-3" /></div>
                <div className="col-[1] row-[3] flex items-stretch justify-center">
                  <div className="flex flex-col items-center w-full">
                    <div className="w-px bg-gray-300 flex-1" />
                    <div className="w-3 h-3 rounded-full bg-black" />
                    <div className="w-px bg-gray-300 flex-1" />
                  </div>
                </div>
                <div className="col-[2] row-[3]">
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="flex-1">
                      <span className="font-medium">Annotation</span>
                      <span className="mx-1 text-gray-400">/</span>
                      <span>Page {pageNumber ?? '—'}</span>
                    </div>
                    <button className="text-black hover:underline" onClick={() => onDelete(h.id)}>Delete</button>
                  </div>
                </div>
                <div className="col-[1] row-[4] flex items-stretch justify-center">
                  <div className="w-px bg-gray-300 h-full" />
                </div>
                <div className="col-[2] row-[4]"><div className="h-3" /></div>
                <div className="col-[1] row-[5] flex items-start justify-center">
                  <div className="w-3 h-3 rounded-full bg-black" />
                </div>
                <div className="col-[2] row-[5]">
                  <input
                    type="text"
                    placeholder="Your comment"
                    className="w-full px-2 py-2 rounded-md bg-gray-100 text-gray-900 placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      <div className="h-4" />
    </div>
  )
}


