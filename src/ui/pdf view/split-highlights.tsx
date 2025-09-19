import React from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
// removed unused icons per UI simplification
import cameraIcon from '../assets/camera.svg'
import highlighterIcon from '../assets/highlighter.svg'

type SplitHighlightsProps = {
  highlights: any[]
  onJumpTo: (id: string) => void
  onDelete: (id: string) => void
  onChangeComment: (id: string, text: string) => void
  onJumpToPage?: (page: number) => void
  activeTab: 'all' | 'annotations' | 'screenshots'
  searchQuery: string
}

function getPageNumber(h: any): number | undefined {
  if (!h) return undefined
  // Support screenshots which store page number under screenshot.pageNumber
  if (h.kind === 'screenshot' && typeof h?.screenshot?.pageNumber === 'number') {
    return h.screenshot.pageNumber
  }
  if (!h.position) return undefined
  if (typeof h.position.pageNumber === 'number') return h.position.pageNumber
  if (h.position.boundingRect && typeof h.position.boundingRect.pageNumber === 'number') return h.position.boundingRect.pageNumber
  if (Array.isArray(h.position.rects) && h.position.rects.length > 0 && typeof h.position.rects[0]?.pageNumber === 'number') {
    return h.position.rects[0].pageNumber
  }
  return undefined
}

export default function SplitHighlights({ highlights, onJumpTo, onDelete, onChangeComment, onJumpToPage, activeTab, searchQuery }: SplitHighlightsProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = React.useState<string | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const prevCountRef = React.useRef<number>(highlights?.length ?? 0)
  const suppressClicksUntilRef = React.useRef<number>(0)

  async function copyAnnotationText(text: string) {
    try {
      const value = (text || '').trim()
      if (!value) return
      await navigator.clipboard?.writeText(value)
    } catch {}
  }

  async function copyImageFromDataUrl(dataUrl: string) {
    try {
      if (!dataUrl) return
      const anyWindow = window as unknown as { ClipboardItem?: any }
      if (anyWindow?.ClipboardItem) {
        const res = await fetch(dataUrl)
        const blob = await res.blob()
        const type = blob.type || 'image/png'
        const item = new anyWindow.ClipboardItem({ [type]: blob })
        await navigator.clipboard.write([item])
        return
      }
      await navigator.clipboard?.writeText(dataUrl)
    } catch {}
  }

  // Comment previews are capped to the first visual line via CSS truncation

  const orderedHighlights = React.useMemo(() => {
    const items = highlights.map((h, i) => ({ h, i, page: getPageNumber(h) ?? Number.POSITIVE_INFINITY }))
    items.sort((a, b) => (a.page === b.page ? a.i - b.i : a.page - b.page))
    return items.map((it) => it.h)
  }, [highlights])

  const totalScreenshots = React.useMemo(() => orderedHighlights.filter((h) => h?.kind === 'screenshot').length, [orderedHighlights])
  const totalAnnotations = React.useMemo(() => orderedHighlights.length - totalScreenshots, [orderedHighlights, totalScreenshots])

  const filteredHighlights = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return orderedHighlights.filter((h) => {
      if (activeTab === 'annotations' && h?.kind === 'screenshot') return false
      if (activeTab === 'screenshots' && h?.kind !== 'screenshot') return false
      if (!q) return true
      const text = (h?.content?.text ?? '').toLowerCase()
      const comment = (h?.comment?.text ?? '').toLowerCase()
      return text.includes(q) || comment.includes(q)
    })
  }, [orderedHighlights, activeTab, searchQuery])

  React.useEffect(() => {
    console.log('[HL] list render count=', orderedHighlights.length)
  }, [orderedHighlights])

  React.useEffect(() => {
    const currentCount = orderedHighlights.length
    const prev = prevCountRef.current
    prevCountRef.current = currentCount
    if (currentCount > prev) {
      const el = containerRef.current
      if (el) {
        // Scroll to bottom when new items are added
        el.scrollTop = el.scrollHeight
      }
    }
  }, [orderedHighlights])

  React.useEffect(() => {
    function onGlobalMouseDown() {
      if (menuOpenId) setMenuOpenId(null)
    }
    window.addEventListener('mousedown', onGlobalMouseDown)
    return () => window.removeEventListener('mousedown', onGlobalMouseDown)
  }, [menuOpenId])

  return (
    <div className="w-full h-full overflow-y-auto p-4" ref={containerRef}>
      {(!highlights || highlights.length === 0) ? (
        <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
          No highlights yet.
        </div>
      ) : (
        <>

          {filteredHighlights.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">No results</div>
          ) : activeTab === 'screenshots' ? (
            <ol className="mt-4 space-y-3">
              {filteredHighlights.map((h) => {
                const pageNumber = getPageNumber(h)
                return (
                  <li key={h.id}>
                    <div className="group rounded-xl border border-gray-200 bg-white p-3 shadow-sm hover:shadow transition">
                      <div className="flex items-start gap-3" onMouseDown={(e) => e.stopPropagation()}>
                        <div className="flex-1 min-w-0">
                          <div className="relative flex items-center gap-2 text-xs text-gray-600 mb-1">
                            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-1.5 py-0.5">
                              <img src={cameraIcon} alt="" className="h-3 w-3" />
                              Screenshot
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5">Page {pageNumber ?? '—'}</span>
                            <div className="ml-auto">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-gray-50"
                                    aria-label="More"
                                    title="More"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <circle cx="4" cy="10" r="1.5" fill="currentColor" />
                                      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
                                      <circle cx="16" cy="10" r="1.5" fill="currentColor" />
                                    </svg>
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" side="bottom" sideOffset={6} className="w-40 bg-white text-gray-900 border border-gray-200 shadow-md">
                                  <DropdownMenuItem className="hover:bg-gray-50" onClick={async () => { await copyImageFromDataUrl(h?.screenshot?.dataUrl || '') }}>
                                    Copy Image
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-red-600 focus:text-red-600 hover:bg-red-50" onClick={() => onDelete(h.id)}>
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                            <img
                              src={h?.screenshot?.dataUrl}
                              alt="Screenshot"
                              className="block w-full max-h-[240px] object-contain cursor-pointer"
                              onClick={() => {
                                if (Date.now() < suppressClicksUntilRef.current) return
                                try {
                                  const p = h?.screenshot?.pageNumber
                                  if (typeof p === 'number' && onJumpToPage) onJumpToPage(p)
                                } catch {}
                              }}
                            />
                          </div>
                          <div className="mt-2">
                            {editingId === h.id ? (
                              <textarea
                                rows={1}
                                autoFocus
                                placeholder="Your comment"
                                className="w-full px-2 py-2 rounded-lg bg-gray-100 text-gray-900 text-sm placeholder:text-sm placeholder-gray-400 focus:outline-none overflow-hidden resize-none"
                                value={h?.comment?.text ?? ''}
                                onChange={(e) => onChangeComment(h.id, e.target.value)}
                                onFocus={(e) => {
                                  try {
                                    const len = e.currentTarget.value.length
                                    e.currentTarget.setSelectionRange(len, len)
                                  } catch {}
                                }}
                                onInput={(e) => {
                                  const el = e.currentTarget
                                  el.style.height = 'auto'
                                  el.style.height = `${el.scrollHeight}px`
                                }}
                                onBlur={() => {
                                  setEditingId(null)
                                  suppressClicksUntilRef.current = Date.now() + 250
                                }}
                                ref={(el) => {
                                  if (el) {
                                    el.style.height = 'auto'
                                    el.style.height = `${el.scrollHeight}px`
                                  }
                                }}
                              />
                            ) : (
                              <button
                                className="w-full text-left px-2 py-2 rounded-lg bg-gray-100 text-gray-900 text-sm cursor-text"
                                onClick={() => setEditingId(h.id)}
                                title="Edit comment"
                              >
                                {(h?.comment?.text ?? '').trim().length > 0 ? (
                                  <span className="block truncate">{(h?.comment?.text ?? '').trim()}</span>
                                ) : (
                                  <span className="text-gray-400 text-sm">Your comment</span>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          ) : (
            <ol className="mt-4 space-y-3">
              {filteredHighlights.map((h, idx) => {
                const isScreenshot = h?.kind === 'screenshot'
                const text = h?.content?.text || ''
                const pageNumber = getPageNumber(h)
                return (
                  <li key={h.id}>
                    <div className="group rounded-xl border border-gray-200 bg-white p-3 shadow-sm hover:shadow transition">
                      <div className="flex items-start gap-3" onMouseDown={(e) => e.stopPropagation()}>
                        <div className="flex-1 min-w-0">
                          <div className="relative flex items-center gap-2 text-xs text-gray-600 mb-1">
                            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-1.5 py-0.5">
                              <img src={isScreenshot ? cameraIcon : highlighterIcon} alt="" className="h-3 w-3" />
                              {isScreenshot ? 'Screenshot' : 'Annotation'}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5">Page {pageNumber ?? '—'}</span>
                            <div className="ml-auto">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-gray-50"
                                    aria-label="More"
                                    title="More"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <circle cx="4" cy="10" r="1.5" fill="currentColor" />
                                      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
                                      <circle cx="16" cy="10" r="1.5" fill="currentColor" />
                                    </svg>
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" side="bottom" sideOffset={6} className="w-44 bg-white text-gray-900 border border-gray-200 shadow-md">
                                  {!isScreenshot ? (
                                    <DropdownMenuItem className="hover:bg-gray-50" onClick={async () => { await copyAnnotationText(text) }}>
                                      Copy Annotation
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem className="hover:bg-gray-50" onClick={async () => { await copyImageFromDataUrl(h?.screenshot?.dataUrl || '') }}>
                                      Copy Image
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-red-600 focus:text-red-600 hover:bg-red-50" onClick={() => onDelete(h.id)}>
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          {isScreenshot ? (
                            <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                              <img
                                src={h?.screenshot?.dataUrl}
                                alt="Screenshot"
                                className="block w-full max-h-[240px] object-contain cursor-pointer"
                                onClick={() => {
                                  if (Date.now() < suppressClicksUntilRef.current) return
                                  try {
                                    const p = h?.screenshot?.pageNumber
                                    if (typeof p === 'number' && onJumpToPage) onJumpToPage(p)
                                  } catch {}
                                }}
                              />
                            </div>
                          ) : (
                            <button
                              className="w-full text-left text-[15px] text-gray-900 rounded-lg px-2 py-2 hover:bg-gray-50"
                              onClick={() => { if (Date.now() < suppressClicksUntilRef.current) return; onJumpTo(h.id) }}
                              title="Go to highlight"
                            >
                              {text || '—'}
                            </button>
                          )}
                          <div className="mt-2">
                            {editingId === h.id ? (
                              <textarea
                                rows={1}
                                autoFocus
                                placeholder="Your comment"
                                className="w-full px-2 py-2 rounded-lg bg-gray-100 text-gray-900 text-sm placeholder:text-sm placeholder-gray-400 focus:outline-none overflow-hidden resize-none"
                                value={h?.comment?.text ?? ''}
                                onChange={(e) => onChangeComment(h.id, e.target.value)}
                                onFocus={(e) => {
                                  try {
                                    const len = e.currentTarget.value.length
                                    e.currentTarget.setSelectionRange(len, len)
                                  } catch {}
                                }}
                                onInput={(e) => {
                                  const el = e.currentTarget
                                  el.style.height = 'auto'
                                  el.style.height = `${el.scrollHeight}px`
                                }}
                                onBlur={() => {
                                  setEditingId(null)
                                  suppressClicksUntilRef.current = Date.now() + 250
                                }}
                                ref={(el) => {
                                  if (el) {
                                    el.style.height = 'auto'
                                    el.style.height = `${el.scrollHeight}px`
                                  }
                                }}
                              />
                            ) : (
                              <button
                                className="w-full text-left px-2 py-2 rounded-lg bg-gray-100 text-gray-900 text-sm cursor-text"
                                onClick={() => setEditingId(h.id)}
                                title="Edit comment"
                              >
                                {(h?.comment?.text ?? '').trim().length > 0 ? (
                                  <span className="block truncate">{(h?.comment?.text ?? '').trim()}</span>
                                ) : (
                                  <span className="text-gray-400 text-sm">Your comment</span>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                        {null}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
          <div className="h-4" />
        </>
      )}
    </div>
  )
}


