import React, { useEffect, useRef, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors, type DragStartEvent, type DragEndEvent, type DragCancelEvent } from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import trashIcon from '../assets/trash.svg'
import openIcon from '../assets/square-arrow-out-up-right.svg'

type AddedItemProps = {
  projectId: string
}

type ProjectItem = { fileName: string; path: string }
type ItemStatus = 'todo' | 'ongoing' | 'done'

export default function AddedItem({ projectId }: AddedItemProps) {
  const [items, setItems] = useState<ProjectItem[]>([])
  const [pathToStatus, setPathToStatus] = useState<Record<string, ItemStatus>>({})
  const [activePath, setActivePath] = useState<string | null>(null)
  const [activeSize, setActiveSize] = useState<{ width: number; height: number } | null>(null)
  const [activeTitleWidth, setActiveTitleWidth] = useState<number | null>(null)
  const [activeTitleTop, setActiveTitleTop] = useState<number | null>(null)
  const [activeTitleLeft, setActiveTitleLeft] = useState<number | null>(null)
  const [overStatus, setOverStatus] = useState<ItemStatus | null>(null)
  const [saveDebounce, setSaveDebounce] = useState<number | null>(null)
  const nodeRefMap = useRef<Record<string, HTMLElement | null>>({})
  
  const [itemOverrides, setItemOverrides] = useState<Record<string, { displayName?: string }>>(() => {
    try {
      const raw = localStorage.getItem('item-overrides')
      return raw ? (JSON.parse(raw) as Record<string, { displayName?: string }>) : {}
    } catch {
      return {}
    }
  })
  const [confirmingDelete, setConfirmingDelete] = useState<{ path: string; fileName: string } | null>(null)

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
        // Migrate any legacy 'underReview' statuses to 'ongoing'
        const migrated: Record<string, ItemStatus> = {}
        for (const [k, v] of Object.entries(saved)) {
          migrated[k] = (v as any) === 'underReview' ? 'ongoing' : (v as ItemStatus)
        }
        setPathToStatus((prev) => ({ ...prev, ...migrated }))
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
      const titleEl = el.querySelector('.file-title') as HTMLElement | null
      if (titleEl) {
        const tRect = titleEl.getBoundingClientRect()
        setActiveTitleWidth(tRect.width)
        setActiveTitleTop(tRect.top - rect.top)
        setActiveTitleLeft(tRect.left - rect.left)
      } else {
        setActiveTitleWidth(null)
        setActiveTitleTop(null)
        setActiveTitleLeft(null)
      }
    } else {
      setActiveSize(null)
      setActiveTitleWidth(null)
      setActiveTitleTop(null)
      setActiveTitleLeft(null)
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const path = String(event.active.id)
    const overId = event.over?.id ? String(event.over.id) : null
    setActivePath(null)
    setActiveSize(null)
    setActiveTitleWidth(null)
    setOverStatus(null)
    if (!overId) return
    // Droppable ids are the status values
    const target = overId as ItemStatus
    if (target === 'todo' || target === 'ongoing' || target === 'done') {
      setPathToStatus((prev) => ({ ...prev, [path]: target }))
    }
  }

  function onDragCancel(_event?: DragCancelEvent) {
    setActivePath(null)
    setActiveSize(null)
    setActiveTitleWidth(null)
    setActiveTitleTop(null)
    setActiveTitleLeft(null)
    setOverStatus(null)
  }

  function getDisplayNameForPath(path: string, fileName: string): string {
    const o = itemOverrides[path]
    const name = (o?.displayName ?? '').trim()
    return name.length > 0 ? name : fileName
  }

  const todoItems = items.filter((it) => (pathToStatus[it.path] ?? 'todo') === 'todo')
  const ongoingItems = items.filter((it) => pathToStatus[it.path] === 'ongoing')
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
        className={`relative w-full h-[150px] rounded-xl overflow-hidden cursor-move ${bgClass} transition-colors duration-200 ease-out group`}
        style={{ ...style }}
      >
        <div className="absolute left-3 right-3 top-4 flex items-center gap-2">
          <div className="file-title text-sm text-gray-800 truncate w-1/2">{getDisplayNameForPath(it.path, it.fileName)}</div>
          <div className={`flex items-center gap-1 ml-auto opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150`}>
            <button
              type="button"
              aria-label="Delete PDF from project"
              className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-black/10"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                setConfirmingDelete({ path: it.path, fileName: it.fileName })
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              draggable={false}
            >
              <img src={trashIcon} alt="" className="w-4 h-4 -mt-px" draggable={false} />
            </button>
            <button
              type="button"
              aria-label="Open split view"
              className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-black/10"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                window.dispatchEvent(
                  new CustomEvent('project:item:split', {
                    detail: { projectId, path: it.path, fileName: it.fileName },
                  })
                )
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              draggable={false}
            >
              <img src={openIcon} alt="" className="w-4 h-4" draggable={false} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  function DroppableColumn({ id, children, itemCount }: { id: ItemStatus; children: React.ReactNode; itemCount: number }) {
    const { setNodeRef, isOver } = useDroppable({ id })
    return (
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-3 transition-colors duration-150`}
        style={{ minHeight: itemCount <= 1 ? 150 : 220 }}
      >
        {children}
      </div>
    )
  }

  return (
    <div className="w-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={(event) => {
          const id = event.over?.id ? String(event.over.id) : null
          if (id === 'todo' || id === 'ongoing' || id === 'done') {
            setOverStatus(id)
          } else {
            setOverStatus(null)
          }
        }}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="grid grid-cols-3 gap-6 items-start">
          <div className="flex flex-col">
            <div className="w-full bg-gray-100/60 rounded-xl p-3">
              <div className="mb-3 flex items-center gap-2">
                <div className="inline-flex items-center text-sm font-medium text-gray-700 rounded-full px-2 py-1 bg-gray-200/60">
                  <span className="inline-block h-2.5 w-2.5 rounded-full mr-2" style={{ backgroundColor: '#9ca3af' }} />
                  To Do
                </div>
                <span className="text-sm text-gray-600">{formatCount(todoItems.length)}</span>
              </div>
              <DroppableColumn id="todo" itemCount={todoItems.length}>
                {todoItems.map((it) => (
                  <DraggableCard key={it.path} it={it} bgClass="bg-gray-200/60" />
                ))}
              </DroppableColumn>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="w-full bg-[#f77f00]/30 rounded-xl p-3">
              <div className="mb-3 flex items-center gap-2">
                <div className="inline-flex items-center text-sm font-medium text-gray-700 rounded-full px-2 py-1 bg-[#f77f00]/45">
                  <span className="inline-block h-2.5 w-2.5 rounded-full mr-2" style={{ backgroundColor: '#f77f00' }} />
                  Ongoing
                </div>
                <span className="text-sm text-gray-600">{formatCount(ongoingItems.length)}</span>
              </div>
              <DroppableColumn id="ongoing" itemCount={ongoingItems.length}>
                {ongoingItems.map((it) => (
                  <DraggableCard key={it.path} it={it} bgClass="bg-[#f77f00]/45" />
                ))}
              </DroppableColumn>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="w-full bg-[#4c956c]/30 rounded-xl p-3">
              <div className="mb-3 flex items-center gap-2">
                <div className="inline-flex items-center text-sm font-medium text-gray-700 rounded-full px-2 py-1 bg-[#4c956c]/45">
                  <span className="inline-block h-2.5 w-2.5 rounded-full mr-2" style={{ backgroundColor: '#4c956c' }} />
                  Done
                </div>
                <span className="text-sm text-gray-600">{formatCount(doneItems.length)}</span>
              </div>
              <DroppableColumn id="done" itemCount={doneItems.length}>
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
                  if (status === 'ongoing') return '#f77f00' + '73' // ~45%
                  if (status === 'done') return '#4c956c' + '73' // ~45%
                  return 'rgba(229, 231, 235, 0.6)'
                })(),
              }}
            >
              <div
                className="absolute"
                style={{
                  left: activeTitleLeft ?? 12,
                  top: activeTitleTop ?? 16,
                }}
              >
                <div className="file-title text-sm text-gray-800 truncate" style={{ width: activeTitleWidth || undefined }}>
                  {(() => {
                    const it = items.find((it) => it.path === activePath)
                    return it ? getDisplayNameForPath(it.path, it.fileName) : ''
                  })()}
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {confirmingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmingDelete(null)} />
          <div className="relative z-10 w-[420px] rounded-xl border border-white/10 bg-white/80 backdrop-blur-md shadow-2xl p-5">
            <div className="text-lg font-medium text-gray-900 mb-1">Delete file and related data?</div>
            <div className="text-sm text-gray-700 mb-4">This will delete the PDF and its highlights. This action cannot be undone.</div>
            <div className="flex items-center justify-end gap-2">
              <button
                className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
                onClick={() => setConfirmingDelete(null)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 text-sm rounded bg-black text-white hover:opacity-90"
                onClick={async () => {
                  const target = confirmingDelete
                  if (!target) return
                  try {
                    const api = (window as unknown as { api?: { projects: { items?: { deleteAll?: (projectId: string, pdfFileName: string, absolutePath: string) => Promise<{ ok: true }> } } } }).api
                    await api?.projects.items?.deleteAll?.(projectId, target.fileName, target.path)
                  } finally {
                    // Clear local override and kanban status
                    setItemOverrides((prev) => {
                      const next = { ...prev }
                      delete next[target.path]
                      localStorage.setItem('item-overrides', JSON.stringify(next))
                      return next
                    })
                    setPathToStatus((prev) => {
                      const next = { ...prev }
                      delete next[target.path]
                      return next
                    })
                    setConfirmingDelete(null)
                    fetchItems()
                  }
                }}
              >
                Delete everything
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}


