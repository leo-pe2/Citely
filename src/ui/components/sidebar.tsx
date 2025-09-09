import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import openIcon from '../assets/panel-right-open.svg'
import closeIcon from '../assets/panel-right-close.svg'
import folderPlusIcon from '../assets/sidebar/folder-plus.svg'
import folderIconRaw from '../assets/sidebar/folder.svg?raw'
import folderOpenIconRaw from '../assets/sidebar/folder-open.svg?raw'
import CreateProjectModal from './sidebar-popups/create-project'

type SidebarProps = {
  onSelectCategory?: (c: { id: string; name: string; path: string }) => void
}

function Sidebar({ onSelectCategory }: SidebarProps) {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('sidebar-open')
      return stored === null ? true : stored === 'true'
    } catch {
      return true
    }
  })
  type SidebarProject = { id: string; name: string; path: string }
  const [projects, setProjects] = useState<SidebarProject[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  
  const [hoveredIconId, setHoveredIconId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<string, { name?: string; color?: string }>>({})

  const OPEN_WIDTH = 256
  const CLOSED_WIDTH = 56

  useEffect(() => {
    try {
      localStorage.setItem('sidebar-open', isOpen ? 'true' : 'false')
    } catch {}
  }, [isOpen])

  useEffect(() => {
    const api = (window as unknown as {
      api?: { projects: { list: () => Promise<SidebarProject[]> } }
    }).api
    api?.projects
      .list()
      .then((items: SidebarProject[]) => {
        setProjects(items)
        const lastId = localStorage.getItem('last-category-id')
        if (lastId) {
          const found = items.find((p) => p.id === lastId)
          if (found) {
            setSelectedCategoryId(found.id)
            onSelectCategory?.(found)
          }
        }
      })
      .catch(() => setProjects([]))
  }, [])

  function normalizeSvg(raw: string) {
    // Only adjust width/height on the root <svg> element. Avoid touching stroke-width, etc.
    return raw
      .replace(/(<svg[^>]*?)\swidth="[^"]+"/i, '$1 width="100%"')
      .replace(/(<svg[^>]*?)\sheight="[^"]+"/i, '$1 height="100%"')
  }

  function readOverrides() {
    try {
      const raw = localStorage.getItem('project-overrides')
      return raw ? (JSON.parse(raw) as Record<string, { name?: string; color?: string }>) : {}
    } catch {
      return {}
    }
  }

  useEffect(() => {
    setOverrides(readOverrides())
    function onChanged() {
      setOverrides(readOverrides())
    }
    function onDeleted(e: Event) {
      const detail = (e as CustomEvent<{ id: string }>).detail
      if (!detail) return
      setProjects((prev) => prev.filter((p) => p.id !== detail.id))
      if (localStorage.getItem('last-category-id') === String(detail.id)) {
        localStorage.removeItem('last-category-id')
      }
    }
    window.addEventListener('project-overrides:changed', onChanged)
    window.addEventListener('project:deleted', onDeleted)
    return () => {
      window.removeEventListener('project-overrides:changed', onChanged)
      window.removeEventListener('project:deleted', onDeleted)
    }
  }, [])

  async function handleCreateProject(name: string) {
    try {
      const api = (window as unknown as {
        api?: { projects: { create: (n: string) => Promise<SidebarProject> } }
      }).api
      if (!api) return
      const created = await api.projects.create(name)
      setProjects((prev) => [...prev, created])
    } catch (e) {
      // noop for now per user guidance to avoid unnecessary code
    }
  }

  

  function selectCategory(category: SidebarProject) {
    localStorage.setItem('last-category-id', category.id)
    setSelectedCategoryId(category.id)
    onSelectCategory?.(category)
  }

  

  return (
    <motion.aside
      initial={false}
      animate={{ width: isOpen ? OPEN_WIDTH : CLOSED_WIDTH }}
      transition={{ type: 'spring', stiffness: 300, damping: 26, mass: 0.4 }}
      className={`min-h-screen border-r border-gray-200 bg-white flex flex-col pt-4`}
    >
      <div className={`h-12 flex items-center ${isOpen ? 'justify-between' : 'justify-center'} px-4 mt-0`}>
        {isOpen ? (
          <div className="flex-1 overflow-hidden">
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key="sidebar-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="text-sm font-medium truncate pl-2"
              >
                My Library
              </motion.div>
            </AnimatePresence>
          </div>
        ) : null}

        <button
          className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100"
          aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={isOpen}
          title={isOpen ? 'Close sidebar' : 'Open sidebar'}
          onClick={() => setIsOpen((v) => !v)}
        >
          <img src={isOpen ? closeIcon : openIcon} alt="" className="h-5 w-5 shrink-0" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <motion.nav
          key="sidebar-content"
          className="h-full overflow-auto"
        >
          <AnimatePresence initial={false} mode="wait">
            {isOpen && (
              <motion.div
                key="new-project"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="px-2 py-1.5 mb-0"
              >
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-100"
                  onClick={() => setIsCreateOpen(true)}
                >
                  <img src={folderPlusIcon} alt="" className="h-4 w-4" />
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    className="whitespace-nowrap"
                  >
                    New Category
                  </motion.span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false} mode="wait">
            {isOpen && (
              <motion.ul
                key="project-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="space-y-0.5 px-2 -mt-0.5"
              >
                {projects.map((p) => (
                  <li key={p.id}>
                    <div className="rounded">
                      <button
                        className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-100"
                        onClick={() => selectCategory(p)}
                      >
                        <div
                          role="button"
                          className="h-4 w-4 cursor-pointer"
                          onMouseEnter={() => setHoveredIconId(p.id)}
                          onMouseLeave={() => setHoveredIconId(null)}
                          dangerouslySetInnerHTML={{
                            __html: normalizeSvg(
                              hoveredIconId === p.id || selectedCategoryId === p.id
                                ? folderOpenIconRaw
                                : folderIconRaw
                            ),
                          }}
                          style={{ color: overrides[p.id]?.color || '#000000', lineHeight: 0 }}
                        />
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="block truncate text-left"
                        >
                          {p.name}
                        </motion.span>
                      </button>

                      
                    </div>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </motion.nav>
      </div>
      <CreateProjectModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateProject}
        title="Create New Category"
        placeholder="Category name"
      />
      
    </motion.aside>
  )
}

export default Sidebar


