import React, { useEffect, useMemo, useRef, useState } from 'react'
import penIcon from '../assets/pen.svg'

type CategoryViewProps = {
  id: string
  name: string
}

type ProjectOverrides = Record<string, { name?: string; color?: string }>

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
  const [selectedColor, setSelectedColor] = useState<string>(() => readOverrides()[id]?.color ?? '#000000')

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
      if (containerRef.current && !containerRef.current.contains(t)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  useEffect(() => {
    function onOverridesChanged() {
      setSelectedColor(readOverrides()[id]?.color ?? '#000000')
    }
    window.addEventListener('project-overrides:changed', onOverridesChanged)
    return () => window.removeEventListener('project-overrides:changed', onOverridesChanged)
  }, [id])

  // Keep local selection in sync when switching categories or opening the menu
  useEffect(() => {
    setSelectedColor(readOverrides()[id]?.color ?? '#000000')
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

  const colors = ['#000000', '#003049', '#d62828', '#f77f00', '#fcbf49']

  return (
    <div className="p-4" ref={containerRef}>
      <div className="flex items-center gap-2">
        <h1 className="text-[46px] font-regular font-heading">{displayName}</h1>
        <div className="relative ml-3">
          <button
            className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-black flex items-center justify-center"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Edit category"
          >
            <img src={penIcon} alt="" className="w-4 h-4" />
          </button>

          {menuOpen ? (
            <div className="absolute left-full ml-2 top-0 bg-white border border-gray-200 rounded shadow-md w-[300px] p-3 z-10">
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
  )
}


