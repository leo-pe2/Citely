import React, { useEffect, useMemo, useRef, useState } from 'react'
import AddedItem from './added-item'
import penIcon from '../assets/pen.svg'
import plusIcon from '../assets/plus.svg'
import Notes from './notes'

type CategoryViewProps = {
  id: string
  name: string
}

type ProjectOverrides = Record<string, { name?: string; color?: string; description?: string }>

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
  const [menuOpen, setMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [selectedColor, setSelectedColor] = useState<string>(() => readOverrides()[id]?.color ?? '#000000')
  const [description, setDescription] = useState<string>(() => readOverrides()[id]?.description ?? '')
  const [hasItems, setHasItems] = useState<boolean>(false)
  const [activePage, setActivePage] = useState<'kanban' | 'notes'>('kanban')

  const initialName = useMemo(() => {
    const o = readOverrides()
    return o[id]?.name ?? name
  }, [id, name])

  const [displayName, setDisplayName] = useState<string>(initialName)

  useEffect(() => {
    setDisplayName(initialName)
  }, [initialName])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuOpen) return
      const t = e.target as Node
      if (menuRef.current && !menuRef.current.contains(t)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  useEffect(() => {
    function onOverridesChanged() {
      setSelectedColor(readOverrides()[id]?.color ?? '#000000')
      setDescription(readOverrides()[id]?.description ?? '')
    }
    window.addEventListener('project-overrides:changed', onOverridesChanged)
    return () => window.removeEventListener('project-overrides:changed', onOverridesChanged)
  }, [id])

  // Split view handled at Home level

  // Keep local selection in sync when switching categories or opening the menu
  useEffect(() => {
    setSelectedColor(readOverrides()[id]?.color ?? '#000000')
    setDescription(readOverrides()[id]?.description ?? '')
  }, [id, menuOpen])

  function updateName(nextName: string) {
    setDisplayName(nextName)
    const o = readOverrides()
    const prev = o[id] || {}
    const next: ProjectOverrides = { ...o, [id]: { ...prev, name: nextName || undefined } }
    writeOverrides(next)
  }

  function updateColor(color: string) {
    setSelectedColor(color)
    const o = readOverrides()
    const prev = o[id] || {}
    const next: ProjectOverrides = { ...o, [id]: { ...prev, color } }
    writeOverrides(next)
  }

  function updateDescription(nextText: string) {
    const trimmed = nextText.replace(/\n/g, '').slice(0, 40)
    setDescription(trimmed)
    const o = readOverrides()
    const prev = o[id] || {}
    const next: ProjectOverrides = { ...o, [id]: { ...prev, description: trimmed || undefined } }
    writeOverrides(next)
  }

  const colors = ['#000000', '#5fa8d3', '#d62828', '#f77f00', '#fcbf49']

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
              className={`${activePage === 'kanban' ? 'text-black' : 'hover:text-black'}`}
              onClick={() => setActivePage('kanban')}
            >
              Kanban
            </button>
            <button
              className={`${activePage === 'notes' ? 'text-black' : 'hover:text-black'}`}
              onClick={() => setActivePage('notes')}
            >
              Notes
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
          <div className="relative" ref={menuRef}>
            <button
              className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-black flex items-center justify-center"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Edit category"
            >
              <img src={penIcon} alt="" className="w-4 h-4" />
            </button>

            {menuOpen ? (
              <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded shadow-md w-[300px] p-3 z-10">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Project name</label>
                    <input
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-black"
                      value={displayName}
                      onChange={(e) => updateName(e.target.value)}
                      placeholder="Enter name"
                    />
                  </div>
                  <div>
                    <div className="block text-xs text-gray-500 mb-1">Folder color</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {colors.map((c) => (
                        <button
                          key={c}
                          className={`w-6 h-6 rounded-full border ${
                            selectedColor === c ? 'border-gray-300 ring-2 ring-gray-300' : 'border-gray-300 hover:border-black'
                          }`}
                          style={{ backgroundColor: c }}
                          onClick={() => updateColor(c)}
                          aria-label={`Set color ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
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

      <hr className="border-t border-gray-200 my-4" />

      <div className="flex-1 w-full mt-2">
        {activePage === 'kanban' ? (
          <div className="w-full">
            <AddedItem projectId={id} />
          </div>
        ) : (
          <Notes />
        )}
      </div>
    </div>
  )
}


