import React, { useEffect, useMemo, useRef, useState } from 'react'
import AddedItem from './added-item'
import plusIcon from '../assets/plus.svg'
import { ItemsTable } from '@table/items-table'


type CategoryViewProps = {
  id: string
  name: string
}

type ProjectOverrides = Record<string, { name?: string; description?: string }>

function readOverrides(): ProjectOverrides {
  try {
    const raw = localStorage.getItem('project-overrides')
    return raw ? (JSON.parse(raw) as ProjectOverrides) : {}
  } catch {
    return {}
  }
}

function writeOverrides(next: ProjectOverrides) {
  localStorage.setItem('project-overrides', JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('project-overrides:changed'))
}

export default function CategoryView({ id, name }: CategoryViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [description, setDescription] = useState<string>(() => readOverrides()[id]?.description ?? '')
  const [hasItems, setHasItems] = useState<boolean>(false)
  const [activePage, setActivePage] = useState<'kanban' | 'table'>(() => {
    try {
      const v = localStorage.getItem('category-active-page')
      return v === 'table' ? 'table' : 'kanban'
    } catch {
      return 'kanban'
    }
  })

  const initialName = useMemo(() => {
    const o = readOverrides()
    return o[id]?.name ?? name
  }, [id, name])

  const [displayName, setDisplayName] = useState<string>(initialName)

  useEffect(() => {
    setDisplayName(initialName)
  }, [initialName])

  // Removed name edit menu

  useEffect(() => {
    function onOverridesChanged() {
      setDescription(readOverrides()[id]?.description ?? '')
    }
    window.addEventListener('project-overrides:changed', onOverridesChanged)
    return () => window.removeEventListener('project-overrides:changed', onOverridesChanged)
  }, [id])

  // Split view handled at Home level

  // Keep local selection in sync when switching categories
  useEffect(() => {
    setDescription(readOverrides()[id]?.description ?? '')
  }, [id])

  // Name editing removed

  function updateDescription(nextText: string) {
    const trimmed = nextText.replace(/\n/g, '').slice(0, 40)
    setDescription(trimmed)
    const o = readOverrides()
    const prev = o[id] || {}
    const next: ProjectOverrides = { ...o, [id]: { ...prev, description: trimmed || undefined } }
    writeOverrides(next)
  }

  async function handleDeleteCategory() {
    try {
      const api = (window as unknown as { api?: { projects: { delete: (idOrPath: string) => Promise<{ ok: true }> } } }).api
      await api?.projects.delete(id)
    } finally {
      window.dispatchEvent(new CustomEvent('project:deleted', { detail: { id } }))
    }
  }

  async function handleAddItem() {
    const api = (window as unknown as { api?: { projects: { items?: { importPdf: (projectId: string) => Promise<{ imported: { fileName: string; path: string }[] }> } } } }).api
    if (!api?.projects.items?.importPdf) return
    const res = await api.projects.items.importPdf(id)
    if (res.imported && res.imported.length > 0) {
      window.dispatchEvent(new CustomEvent('project:item:imported', { detail: { projectId: id, items: res.imported } }))
    }
  }

  async function refreshHasItems() {
    try {
      const api = (window as unknown as { api?: { projects: { items?: { exists: (projectId: string) => Promise<{ hasItems: boolean }> } } } }).api
      const res = await api?.projects.items?.exists?.(id)
      if (res) setHasItems(!!res.hasItems)
    } catch {}
  }

  useEffect(() => {
    refreshHasItems()
  }, [id])

  useEffect(() => {
    function onItemImported(e: Event) {
      const detail = (e as CustomEvent<{ projectId: string }>).detail
      if (detail && detail.projectId === id) setHasItems(true)
    }
    window.addEventListener('project:item:imported', onItemImported)
    return () => window.removeEventListener('project:item:imported', onItemImported)
  }, [id])

  return (
    <div className="pt-4 pr-4 pb-4 pl-6 flex flex-col min-h-screen" ref={containerRef}>
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[46px] leading-none font-regular font-heading">{displayName}</h1>
          <nav className="flex items-center gap-3 text-[14px] leading-none text-gray-600 self-center mt-[4px]">
            <button
              className={`${activePage === 'table' ? 'text-black' : 'hover:text-black'}`}
              onClick={() => {
                setActivePage('table')
                try { localStorage.setItem('category-active-page', 'table') } catch {}
              }}
            >
              Table
            </button>
            <button
              className={`${activePage === 'kanban' ? 'text-black' : 'hover:text-black'}`}
              onClick={() => {
                setActivePage('kanban')
                try { localStorage.setItem('category-active-page', 'kanban') } catch {}
              }}
            >
              Kanban
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-black flex items-center justify-center"
            onClick={handleAddItem}
            aria-label="Add item"
          >
            <img src={plusIcon} alt="" className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="mt-2">
        <input
          className="w-full text-base outline-none border-0 focus:ring-0 placeholder-gray-400 relative z-10"
          value={description}
          onChange={(e) => updateDescription(e.target.value)}
          placeholder={`A description about ${displayName}`}
          maxLength={40}
        />
      </div>

      <hr className="border-t border-gray-200 my-1.5" />

      <div className="flex-1 w-full mt-3">
        {activePage === 'kanban' ? (
          <div className="w-full">
            <AddedItem projectId={id} />
          </div>
        ) : (
          <ItemsTable projectId={id} />
        )}
      </div>
    </div>
  )
}


