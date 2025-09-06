import React, { useEffect, useState } from 'react'

type AddedItemProps = {
  projectId: string
}

type ProjectItem = { fileName: string; path: string }
type ItemStatus = 'todo' | 'ongoing' | 'underReview' | 'done'

export default function AddedItem({ projectId }: AddedItemProps) {
  const [items, setItems] = useState<ProjectItem[]>([])
  const [pathToStatus, setPathToStatus] = useState<Record<string, ItemStatus>>({})

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
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', it.path)
          e.dataTransfer.effectAllowed = 'move'
        }}
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


