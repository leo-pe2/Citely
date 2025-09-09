import React from 'react'

type SplitHighlightsProps = {
  highlights: any[]
  onJumpTo: (id: string) => void
  onDelete: (id: string) => void
  onChangeComment: (id: string, text: string) => void
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

export default function SplitHighlights({ highlights, onJumpTo, onDelete, onChangeComment }: SplitHighlightsProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null)

  function getFirstSentence(input: string): string {
    if (!input) return ''
    const match = input.match(/^[\s\S]*?[.!?](?:\s|$)/)
    if (match && match[0].trim().length > 0) return match[0].trim()
    const firstLine = input.split('\n')[0]
    return firstLine
  }
  if (!highlights || highlights.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
        No highlights yet.
      </div>
    )
  }

  const orderedHighlights = React.useMemo(() => {
    const items = highlights.map((h, i) => ({ h, i, page: getPageNumber(h) ?? Number.POSITIVE_INFINITY }))
    items.sort((a, b) => (a.page === b.page ? a.i - b.i : a.page - b.page))
    return items.map((it) => it.h)
  }, [highlights])

  React.useEffect(() => {
    console.log('[HL] list render count=', orderedHighlights.length)
  }, [orderedHighlights])

  return (
    <div className="w-full h-full overflow-y-auto p-4">
      <ol className="space-y-4">
        {orderedHighlights.map((h, idx) => {
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
                    onClick={() => { console.log('[HL] click jump', h.id, 'page=', pageNumber); onJumpTo(h.id) }}
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
                    <button className="text-black hover:underline" onClick={() => { console.log('[HL] delete', h.id); onDelete(h.id) }}>Delete</button>
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
                  {editingId === h.id ? (
                    <textarea
                      rows={1}
                      autoFocus
                      placeholder="Your comment"
                      className="w-full px-2 py-2 rounded-md bg-gray-100 text-gray-900 placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/10 overflow-hidden resize-none"
                      value={h?.comment?.text ?? ''}
                      onChange={(e) => onChangeComment(h.id, e.target.value)}
                      onInput={(e) => {
                        const el = e.currentTarget
                        el.style.height = 'auto'
                        el.style.height = `${el.scrollHeight}px`
                      }}
                      onBlur={() => setEditingId(null)}
                      ref={(el) => {
                        if (el) {
                          el.style.height = 'auto'
                          el.style.height = `${el.scrollHeight}px`
                        }
                      }}
                    />
                  ) : (
                    <button
                      className="w-full text-left px-2 py-2 rounded-md bg-gray-100 text-gray-900 border border-gray-200 hover:bg-gray-50"
                      onClick={() => setEditingId(h.id)}
                      title="Edit comment"
                    >
                      {(h?.comment?.text ?? '').trim().length > 0 ? (
                        <>
                          {(() => {
                            const full = (h?.comment?.text ?? '').trim()
                            const first = getFirstSentence(full)
                            const hasMore = first.length < full.length
                            return (
                              <>
                                <span>{first}</span>
                                {hasMore ? <span className="text-gray-400"> …</span> : null}
                              </>
                            )
                          })()}
                        </>
                      ) : (
                        <span className="text-gray-400">Your comment</span>
                      )}
                    </button>
                  )}
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


