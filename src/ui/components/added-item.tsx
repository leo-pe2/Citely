import React, { useEffect, useRef, useState } from 'react'

// Use a 1x1 transparent canvas on Windows to suppress native ghost reliably
function createTransparentCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 1, 1)
  }
  return canvas
}
function isWindows(): boolean {
  return /Windows/i.test(navigator.userAgent)
}

type AddedItemProps = {
  projectId: string
}

type ProjectItem = { fileName: string; path: string }
type ItemStatus = 'todo' | 'ongoing' | 'underReview' | 'done'

export default function AddedItem({ projectId }: AddedItemProps) {
  const [items, setItems] = useState<ProjectItem[]>([])
  const [pathToStatus, setPathToStatus] = useState<Record<string, ItemStatus>>({})
  const dragVisualRef = useRef<HTMLDivElement | null>(null)
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null)
  const dragSourceRef = useRef<HTMLDivElement | null>(null)
  const dragShimRef = useRef<HTMLDivElement | null>(null)
  const todoColRef = useRef<HTMLDivElement | null>(null)
  const ongoingColRef = useRef<HTMLDivElement | null>(null)
  const underReviewColRef = useRef<HTMLDivElement | null>(null)
  const doneColRef = useRef<HTMLDivElement | null>(null)
  const onWindows = isWindows()

  async function fetchItems() {
    try {
      const api = (window as unknown as {
        api?: { projects: { items?: { list?: (projectId: string) => Promise<{ items: ProjectItem[] }> } } }
      }).api
      const res = await api?.projects.items?.list?.(projectId)
      const fetched = res?.items ?? []
      setItems(fetched)
      // Ensure each fetched item has a status; default to todo if unseen
      setPathToStatus((prev) => {
        const next = { ...prev }
        for (const it of fetched) {
          if (!next[it.path]) next[it.path] = 'todo'
        }
        return next
      })
    } catch {
      setItems([])
    }
  }

  useEffect(() => {
    fetchItems()
  }, [projectId])

  useEffect(() => {
    function onItemImported(e: Event) {
      const detail = (e as CustomEvent<{ projectId: string; items?: { path: string }[] }>).detail
      if (!detail || detail.projectId !== projectId) return
      // Default any newly imported paths to 'todo' immediately
      if (detail.items && detail.items.length > 0) {
        setPathToStatus((prev) => {
          const next = { ...prev }
          for (const it of detail.items!) {
            if (it?.path) next[it.path] = 'todo'
          }
          return next
        })
      }
      fetchItems()
    }
    window.addEventListener('project:item:imported', onItemImported)
    return () => window.removeEventListener('project:item:imported', onItemImported)
  }, [projectId])

  function handleDrop(targetStatus: ItemStatus, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const path = e.dataTransfer.getData('text/plain')
    if (!path) return
    setPathToStatus((prev) => ({ ...prev, [path]: targetStatus }))
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
  }

  const todoItems = items.filter((it) => (pathToStatus[it.path] ?? 'todo') === 'todo')
  const ongoingItems = items.filter((it) => pathToStatus[it.path] === 'ongoing')
  const underReviewItems = items.filter((it) => pathToStatus[it.path] === 'underReview')
  const doneItems = items.filter((it) => pathToStatus[it.path] === 'done')

  function formatCount(n: number): string {
    return String(n).padStart(2, '0')
  }

  function renderCard(it: ProjectItem) {
    return (
      <div
        key={it.path}
        className="relative w-full h-[150px] rounded-xl bg-white overflow-hidden cursor-move"
        style={{ border: '1.5px solid #e6e6e6' }}
        draggable={!onWindows}
        onDragStart={!onWindows ? (e) => {
          e.dataTransfer.setData('text/plain', it.path)
          e.dataTransfer.effectAllowed = 'move'

          // Keep native ghost on non-Windows
          try {
          } catch {}

          // Create a fixed-position visual that follows the cursor
          const target = e.currentTarget as HTMLDivElement
          const rect = target.getBoundingClientRect()

          const visual = target.cloneNode(true) as HTMLDivElement
          visual.style.position = 'fixed'
          visual.style.top = rect.top + 'px'
          visual.style.left = rect.left + 'px'
          visual.style.width = rect.width + 'px'
          visual.style.height = rect.height + 'px'
          visual.style.pointerEvents = 'none'
          visual.style.zIndex = '9999'
          visual.style.opacity = '1'
          visual.style.boxShadow = '0 10px 25px rgba(0,0,0,0.25)'
          visual.style.background = 'white'
          document.body.appendChild(visual)

          dragVisualRef.current = visual
          dragSourceRef.current = target
          // Dim the source slightly to indicate drag without removing it from layout
          target.style.opacity = '0.2'

          // Track the offset so the cursor stays at the same relative position
          const offsetX = e.clientX - rect.left
          const offsetY = e.clientY - rect.top
          dragOffsetRef.current = { x: offsetX, y: offsetY }

        } : undefined}
        onDrag={!onWindows ? (e) => {
          const visual = dragVisualRef.current
          const offset = dragOffsetRef.current
          if (!visual || !offset) return
          if (e.clientX === 0 && e.clientY === 0) return
          const left = e.clientX - offset.x
          const top = e.clientY - offset.y
          visual.style.left = left + 'px'
          visual.style.top = top + 'px'
        } : undefined}
        onDragEnd={!onWindows ? () => {
          // Cleanup visual and restore source
          if (dragVisualRef.current && dragVisualRef.current.parentNode) {
            dragVisualRef.current.parentNode.removeChild(dragVisualRef.current)
          }
          dragVisualRef.current = null
          dragOffsetRef.current = null
          if (dragSourceRef.current) {
            dragSourceRef.current.style.opacity = ''
          }
          dragSourceRef.current = null
          if (dragShimRef.current && dragShimRef.current.parentNode) {
            dragShimRef.current.parentNode.removeChild(dragShimRef.current)
          }
          dragShimRef.current = null
        } : undefined}
        onPointerDown={onWindows ? (e) => {
          const target = e.currentTarget as HTMLDivElement
          const rect = target.getBoundingClientRect()
          const path = it.path
          e.preventDefault()

          const placeholder = document.createElement('div')
          placeholder.style.width = rect.width + 'px'
          placeholder.style.height = rect.height + 'px'
          placeholder.style.border = '1.5px solid transparent'

          const parent = target.parentElement
          if (!parent) return
          parent.insertBefore(placeholder, target)

          target.style.position = 'fixed'
          target.style.top = rect.top + 'px'
          target.style.left = rect.left + 'px'
          target.style.width = rect.width + 'px'
          target.style.height = rect.height + 'px'
          target.style.zIndex = '9999'
          target.style.pointerEvents = 'none'
          target.style.boxShadow = '0 10px 25px rgba(0,0,0,0.25)'
          document.body.appendChild(target)

          const offsetX = e.clientX - rect.left
          const offsetY = e.clientY - rect.top

          const move = (ev: PointerEvent) => {
            const left = ev.clientX - offsetX
            const top = ev.clientY - offsetY
            target.style.left = left + 'px'
            target.style.top = top + 'px'
            ev.preventDefault()
          }
          const up = (ev: PointerEvent) => {
            window.removeEventListener('pointermove', move, true)
            window.removeEventListener('pointerup', up, true)

            const x = ev.clientX
            const y = ev.clientY
            const inRect = (ref: React.RefObject<HTMLDivElement | null>) => {
              const el = ref.current
              if (!el) return false
              const r = el.getBoundingClientRect()
              return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
            }
            let status: ItemStatus | null = null
            if (inRect(todoColRef)) status = 'todo'
            else if (inRect(ongoingColRef)) status = 'ongoing'
            else if (inRect(underReviewColRef)) status = 'underReview'
            else if (inRect(doneColRef)) status = 'done'

            target.style.position = ''
            target.style.top = ''
            target.style.left = ''
            target.style.width = ''
            target.style.height = ''
            target.style.zIndex = ''
            target.style.pointerEvents = ''
            target.style.boxShadow = ''
            parent.insertBefore(target, placeholder)
            placeholder.remove()

            if (status) {
              setPathToStatus((prev) => ({ ...prev, [path]: status! }))
            }
          }
          window.addEventListener('pointermove', move, true)
          window.addEventListener('pointerup', up, true)
        } : undefined}
      >
        <div className="absolute left-3 bottom-2 right-3 text-sm text-gray-800 truncate">{it.fileName}</div>
      </div>
    )
  }

  return (
    <div className="w-full h-full overflow-auto">
      <div className="grid grid-cols-4 gap-6 items-start">
        <div className="flex flex-col">
          <div className="w-full flex items-center text-sm font-medium text-gray-700 border border-gray-200 rounded-xl px-3 py-2 mb-3" style={{ background: '#f7f8fa' }}>
            To Do ({formatCount(todoItems.length)})
          </div>
          <div
            className="min-h-[220px] flex flex-col gap-3"
            ref={todoColRef}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop('todo', e)}
          >
            {todoItems.map(renderCard)}
          </div>
        </div>
        <div className="flex flex-col">
          <div className="w-full flex items-center text-sm font-medium text-gray-700 border border-gray-200 rounded-xl px-3 py-2 mb-3" style={{ background: '#f7f8fa' }}>
            Ongoing ({formatCount(ongoingItems.length)})
          </div>
          <div
            className="min-h-[220px] flex flex-col gap-3"
            ref={ongoingColRef}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop('ongoing', e)}
          >
            {ongoingItems.map(renderCard)}
          </div>
        </div>
        <div className="flex flex-col">
          <div className="w-full flex items-center text-sm font-medium text-gray-700 border border-gray-200 rounded-xl px-3 py-2 mb-3" style={{ background: '#f7f8fa' }}>
            Under Review ({formatCount(underReviewItems.length)})
          </div>
          <div
            className="min-h-[220px] flex flex-col gap-3"
            ref={underReviewColRef}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop('underReview', e)}
          >
            {underReviewItems.map(renderCard)}
          </div>
        </div>
        <div className="flex flex-col">
          <div className="w-full flex items-center text-sm font-medium text-gray-700 border border-gray-200 rounded-xl px-3 py-2 mb-3" style={{ background: '#f7f8fa' }}>
            Done ({formatCount(doneItems.length)})
          </div>
          <div
            className="min-h-[220px] flex flex-col gap-3"
            ref={doneColRef}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop('done', e)}
          >
            {doneItems.map(renderCard)}
          </div>
        </div>
      </div>
    </div>
  )
}


