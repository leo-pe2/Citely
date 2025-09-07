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
  }

  const todoItems = items.filter((it) => (pathToStatus[it.path] ?? 'todo') === 'todo')
  const ongoingItems = items.filter((it) => pathToStatus[it.path] === 'ongoing')
  const underReviewItems = items.filter((it) => pathToStatus[it.path] === 'underReview')
  const doneItems = items.filter((it) => pathToStatus[it.path] === 'done')

  function formatCount(n: number): string {
    return String(n).padStart(2, '0')
  }

  function DraggableCard({ it }: { it: ProjectItem }) {
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
        className="relative w-full h-[150px] rounded-xl bg-white overflow-hidden cursor-move"
        style={{ border: '1.5px solid #e6e6e6', ...style }}
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
        className={`min-h-[220px] flex flex-col gap-3 ${isOver ? 'bg-gray-50' : ''}`}
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
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="grid grid-cols-4 gap-6 items-start">
          <div className="flex flex-col">
            <div className="w-full flex items-center text-sm font-medium text-gray-700 border border-gray-200 rounded-xl px-3 py-2 mb-3" style={{ background: '#f7f8fa' }}>
              To Do ({formatCount(todoItems.length)})
            </div>
            <DroppableColumn id="todo">
              {todoItems.map((it) => (
                <DraggableCard key={it.path} it={it} />
              ))}
            </DroppableColumn>
          </div>
          <div className="flex flex-col">
            <div className="w-full flex items-center text-sm font-medium text-gray-700 border border-gray-200 rounded-xl px-3 py-2 mb-3" style={{ background: '#f7f8fa' }}>
              Ongoing ({formatCount(ongoingItems.length)})
            </div>
            <DroppableColumn id="ongoing">
              {ongoingItems.map((it) => (
                <DraggableCard key={it.path} it={it} />
              ))}
            </DroppableColumn>
          </div>
          <div className="flex flex-col">
            <div className="w-full flex items-center text-sm font-medium text-gray-700 border border-gray-200 rounded-xl px-3 py-2 mb-3" style={{ background: '#f7f8fa' }}>
              Under Review ({formatCount(underReviewItems.length)})
            </div>
            <DroppableColumn id="underReview">
              {underReviewItems.map((it) => (
                <DraggableCard key={it.path} it={it} />
              ))}
            </DroppableColumn>
          </div>
          <div className="flex flex-col">
            <div className="w-full flex items-center text-sm font-medium text-gray-700 border border-gray-200 rounded-xl px-3 py-2 mb-3" style={{ background: '#f7f8fa' }}>
              Done ({formatCount(doneItems.length)})
            </div>
            <DroppableColumn id="done">
              {doneItems.map((it) => (
                <DraggableCard key={it.path} it={it} />
              ))}
            </DroppableColumn>
          </div>
        </div>

        <DragOverlay>
          {activePath ? (
            <div
              className="relative rounded-xl bg-white overflow-hidden"
              style={{
                border: '1.5px solid #e6e6e6',
                boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
                width: activeSize?.width,
                height: activeSize?.height,
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


