import React, { useEffect, useState } from 'react'

type AddedItemProps = {
  projectId: string
}

type ProjectItem = { fileName: string; path: string }

export default function AddedItem({ projectId }: AddedItemProps) {
  const [items, setItems] = useState<ProjectItem[]>([])

  async function fetchItems() {
    try {
      const api = (window as unknown as {
        api?: { projects: { items?: { list?: (projectId: string) => Promise<{ items: ProjectItem[] }> } } }
      }).api
      const res = await api?.projects.items?.list?.(projectId)
      setItems(res?.items ?? [])
    } catch {
      setItems([])
    }
  }

  useEffect(() => {
    fetchItems()
  }, [projectId])

  useEffect(() => {
    function onItemImported(e: Event) {
      const detail = (e as CustomEvent<{ projectId: string }>).detail
      if (detail && detail.projectId === projectId) {
        fetchItems()
      }
    }
    window.addEventListener('project:item:imported', onItemImported)
    return () => window.removeEventListener('project:item:imported', onItemImported)
  }, [projectId])

  if (!items.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-600">
        <div className="text-center">
          <div className="text-lg">No items to display.</div>
          <div className="text-sm text-gray-500">Import PDFs to see them here.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full overflow-auto">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4 place-items-start">
        {items.map((it) => (
          <div
            key={it.path}
            className="relative w-[250px] h-[150px] rounded-md border border-gray-200 bg-white shadow-sm overflow-hidden"
          >
            <div className="absolute inset-0 bg-gray-50" />
            <div className="absolute left-3 bottom-2 right-3 text-sm text-gray-800 truncate">{it.fileName}</div>
          </div>
        ))}
      </div>
    </div>
  )
}


