import React, { useEffect, useRef, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors, type DragStartEvent, type DragEndEvent, type DragCancelEvent } from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

type AddedItemProps = {
  projectId: string
}

type ProjectItem = { fileName: string; path: string }
type ItemStatus = 'todo' | 'ongoing' | 'underReview' | 'done'

export default function AddedItem({ projectId }: AddedItemProps) {
  const [items, setItems] = useState<ProjectItem[]>([])
  const [pathToStatus, setPathToStatus] = useState<Record<string, ItemStatus>>({})
  const [activePath, setActivePath] = useState<string | null>(null)
  const [activeSize, setActiveSize] = useState<{ width: number; height: number } | null>(null)
  const [overStatus, setOverStatus] = useState<ItemStatus | null>(null)
  const [saveDebounce, setSaveDebounce] = useState<number | null>(null)
  const nodeRefMap = useRef<Record<string, HTMLElement | null>>({})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

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

  // Load persisted kanban statuses
  useEffect(() => {
    let mounted = true
    async function loadStatuses() {
      try {
        const api = (window as unknown as {
          api?: { projects: { kanban?: { get?: (projectId: string) => Promise<Record<string, string>> } } }
        }).api
        const saved = await api?.projects.kanban?.get?.(projectId)
        if (!mounted || !saved) return
        setPathToStatus((prev) => ({ ...prev, ...(saved as Record<string, ItemStatus>) }))
      } catch {}
    }
    loadStatuses()
    return () => {
      mounted = false
    }
  }, [projectId])

  // Persist statuses with debounce
  useEffect(() => {
    const api = (window as unknown as {
      api?: { projects: { kanban?: { set?: (projectId: string, statuses: Record<string, string>) => Promise<{ ok: true }> } } }
    }).api
    if (!api?.projects.kanban?.set) return
    if (saveDebounce) window.clearTimeout(saveDebounce)
    const id = window.setTimeout(() => {
      try {
        api.projects.kanban!.set!(projectId, pathToStatus as unknown as Record<string, string>)
      } catch {}
    }, 300)
    setSaveDebounce(id)
    return () => {
      if (id) window.clearTimeout(id)
    }
  }, [projectId, pathToStatus])

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

  function onDragStart(event: DragStartEvent) {
    const path = String(event.active.id)
    setActivePath(path)
    // Measure the dragged element to size the overlay accordingly
    const el = nodeRefMap.current[path]
    if (el) {
      const rect = el.getBoundingClientRect()
      setActiveSize({ width: rect.width, height: rect.height })
    } else {
      setActiveSize(null)
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const path = String(event.active.id)
    const overId = event.over?.id ? String(event.over.id) : null
    setActivePath(null)
    setActiveSize(null)
    setOverStatus(null)
    if (!overId) return
    // Droppable ids are the status values
    const target = overId as ItemStatus
    if (target === 'todo' || target === 'ongoing' || target === 'underReview' || target === 'done') {
      setPathToStatus((prev) => ({ ...prev, [path]: target }))
    }
  }

  function onDragCancel(_event?: DragCancelEvent) {
    setActivePath(null)
    setActiveSize(null)
    setOverStatus(null)
  }

  const todoItems = items.filter((it) => (pathToStatus[it.path] ?? 'todo') === 'todo')
  const ongoingItems = items.filter((it) => pathToStatus[it.path] === 'ongoing')
  const underReviewItems = items.filter((it) => pathToStatus[it.path] === 'underReview')
  const doneItems = items.filter((it) => pathToStatus[it.path] === 'done')

  function formatCount(n: number): string {
    return String(n)
  }

  function DraggableCard({ it, bgClass }: { it: ProjectItem; bgClass: string }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: it.path })
    const style: React.CSSProperties = {
      // Hide original element while dragging since we use DragOverlay
      transform: isDragging ? undefined : (transform ? CSS.Transform.toString(transform) : undefined),
      opacity: isDragging ? 0 : 1,
    }
    return (
      <div
        ref={(el) => {
          setNodeRef(el)
          nodeRefMap.current[it.path] = el
        }}
        {...attributes}
        {...listeners}
        className={`relative w-full h-[150px] rounded-xl overflow-hidden cursor-move ${bgClass} transition-colors duration-200 ease-out`}
        style={{ ...style }}
      >
        <div className="absolute left-3 bottom-2 right-3 text-sm text-gray-800 truncate">{it.fileName}</div>
      </div>
    )
  }

  function DroppableColumn({ id, children }: { id: ItemStatus; children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id })
    return (
      <div
        ref={setNodeRef}
        className={`min-h-[220px] flex flex-col gap-3 transition-colors duration-150`}
      >
        {children}
      </div>
    )
  }

  return (
    <div className="w-full h-full overflow-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={(event) => {
          const id = event.over?.id ? String(event.over.id) : null
          if (id === 'todo' || id === 'ongoing' || id === 'underReview' || id === 'done') {
            setOverStatus(id)
          } else {
            setOverStatus(null)
          }
        }}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="grid grid-cols-4 gap-6 items-start">
          <div className="flex flex-col">
            <div className="w-full bg-gray-100/60 rounded-xl p-3">
              <div className="mb-3 flex items-center gap-2">
                <div className="inline-flex items-center text-sm font-medium text-gray-700 rounded-full px-2 py-1 bg-gray-200/60">
                  To Do
                </div>
                <span className="text-sm text-gray-600">{formatCount(todoItems.length)}</span>
              </div>
              <DroppableColumn id="todo">
                {todoItems.map((it) => (
                  <DraggableCard key={it.path} it={it} bgClass="bg-gray-200/60" />
                ))}
              </DroppableColumn>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="w-full bg-[#fcbf49]/30 rounded-xl p-3">
              <div className="mb-3 flex items-center gap-2">
                <div className="inline-flex items-center text-sm font-medium text-gray-700 rounded-full px-2 py-1 bg-[#fcbf49]/60">
                  Ongoing
                </div>
                <span className="text-sm text-gray-600">{formatCount(ongoingItems.length)}</span>
              </div>
              <DroppableColumn id="ongoing">
                {ongoingItems.map((it) => (
                  <DraggableCard key={it.path} it={it} bgClass="bg-[#fcbf49]/60" />
                ))}
              </DroppableColumn>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="w-full bg-[#f77f00]/30 rounded-xl p-3">
              <div className="mb-3 flex items-center gap-2">
                <div className="inline-flex items-center text-sm font-medium text-gray-700 rounded-full px-2 py-1 bg-[#f77f00]/45">
                  Under Review
                </div>
                <span className="text-sm text-gray-600">{formatCount(underReviewItems.length)}</span>
              </div>
              <DroppableColumn id="underReview">
                {underReviewItems.map((it) => (
                  <DraggableCard key={it.path} it={it} bgClass="bg-[#f77f00]/45" />
                ))}
              </DroppableColumn>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="w-full bg-[#4c956c]/30 rounded-xl p-3">
              <div className="mb-3 flex items-center gap-2">
                <div className="inline-flex items-center text-sm font-medium text-gray-700 rounded-full px-2 py-1 bg-[#4c956c]/45">
                  Done
                </div>
                <span className="text-sm text-gray-600">{formatCount(doneItems.length)}</span>
              </div>
              <DroppableColumn id="done">
                {doneItems.map((it) => (
                  <DraggableCard key={it.path} it={it} bgClass="bg-[#4c956c]/45" />
                ))}
              </DroppableColumn>
            </div>
          </div>
        </div>

        <DragOverlay>
          {activePath ? (
            <div
              className="relative rounded-xl overflow-hidden transition-colors duration-200 ease-out"
              style={{
                width: activeSize?.width,
                height: activeSize?.height,
                background: (() => {
                  const status = overStatus ?? (pathToStatus[activePath] ?? 'todo')
                  if (status === 'ongoing') return '#fcbf49' + '99' // ~60%
                  if (status === 'underReview') return '#f77f00' + '73' // ~45%
                  if (status === 'done') return '#4c956c' + '73' // ~45%
                  return 'rgba(229, 231, 235, 0.6)'
                })(),
              }}
            >
              <div className="absolute left-3 bottom-2 right-3 text-sm text-gray-800 truncate">
                {items.find((it) => it.path === activePath)?.fileName || ''}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}


