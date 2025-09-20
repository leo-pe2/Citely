import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import openIcon from '../assets/panel-right-open.svg'
import closeIcon from '../assets/panel-right-close.svg'
import workspaceIcon from '../assets/sidebar/workspace.svg'
import chevronSelector from '../assets/sidebar/chevron-selector.svg'
import homeIcon from '../assets/sidebar/home.svg'
import CreateProjectModal from './sidebar-popups/create-project'
import categoryIcon from '../assets/sidebar/category-svgrepo-com.svg'

type SidebarProps = {
  onSelectCategory?: (c: { id: string; name: string; path: string }) => void
  onSelectHome?: () => void
}

function Sidebar({ onSelectCategory, onSelectHome }: SidebarProps) {
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
  
  const [overrides, setOverrides] = useState<Record<string, { name?: string; color?: string }>>({})
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [projectsExpanded, setProjectsExpanded] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('projects-expanded')
      return stored === null ? true : stored === 'true'
    } catch {
      return true
    }
  })

  const OPEN_WIDTH = 256
  const CLOSED_WIDTH = 56

  

  useEffect(() => {
    try {
      localStorage.setItem('sidebar-open', isOpen ? 'true' : 'false')
    } catch {}
  }, [isOpen])

  useEffect(() => {
    try {
      localStorage.setItem('projects-expanded', projectsExpanded ? 'true' : 'false')
    } catch {}
  }, [projectsExpanded])

  useEffect(() => {
    const api = (window as unknown as {
      api?: { projects: { list: () => Promise<SidebarProject[]> } }
    }).api
    api?.projects
      .list()
      .then((items: SidebarProject[]) => {
        setProjects(items)
        const lastView = localStorage.getItem('last-view')
        if (lastView === 'home') {
          setSelectedCategoryId(null)
          onSelectHome?.()
          return
        }
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
      className={`min-h-screen border-r border-gray-200 bg-white flex flex-col pt-13.5`}
    >
      <div className={`h-12 flex items-center ${isOpen ? 'justify-between' : 'justify-center'} px-4 mt-0`}>
        {isOpen ? (
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center gap-2">
              <img src={workspaceIcon} alt="Workspace" className="h-5 w-5" />
              <span className="text-base font-medium">Workspace</span>
            </div>
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
        <div className="h-full overflow-auto">
          {isOpen && (
            <div>
              <div className="px-0 py-0">
                <button
                  className="w-full flex items-center justify-between px-4 py-2 rounded hover:bg-gray-100"
                  type="button"
                  onClick={() => onSelectHome?.()}
                >
                  <span className="flex items-center gap-2">
                    <img src={homeIcon} alt="" className="h-5 w-5" />
                    <span className="text-sm font-medium">Home</span>
                  </span>
                  <span className="h-8 w-8" />
                </button>
              </div>

              <button
                className="flex items-center justify-between w-[208px] h-14 px-4 rounded-xl hover:bg-gray-100 mx-auto"
                onClick={() => setProjectsExpanded((v) => !v)}
                aria-expanded={projectsExpanded}
              >
                <span className="flex items-center gap-2">
                  <img src={categoryIcon} alt="" className="h-5 w-5" />
                  <span className="text-sm font-medium ml-[8px]">Projects</span>
                </span>
                <span className="h-8 w-8 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`h-5 w-5 transition-transform ${projectsExpanded ? 'transform rotate-90' : ''}`}
                    aria-hidden="true"
                  >
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </span>
              </button>

              {projectsExpanded && (
                <>
                  <div className="relative w-[208px] mx-auto px-[9px] -mt-0.5">
                    <div className="absolute left-[25px] top-0 bottom-0 w-px bg-gray-300" />
                    <ul className="space-y-1 pl-6">
                      {projects.map((p) => (
                        <li key={p.id} className="relative">
                          <div className="rounded">
                              <button
                                className={`group relative flex items-center w-[158px] h-9 rounded-xl px-2 text-sm before:content-[''] before:absolute before:inset-y-0 before:-right-[17px] before:left-1 before:rounded-xl before:transition-colors ${selectedCategoryId === p.id ? 'before:bg-gray-100' : 'before:bg-transparent hover:before:bg-gray-100'}`}
                              onClick={() => selectCategory(p)}
                            >
                              <span className="pointer-events-none absolute -left-[8px] top-[calc(50%-18px)] h-5 w-3">
                                <span className="block h-full w-full border-l border-b border-gray-300 rounded-bl-[14px]" />
                              </span>
                              <span className="relative z-10 block truncate text-left ml-1 px-2">{overrides[p.id]?.name || p.name}</span>
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="px-2 py-2">
                    <button
                      className="flex w-full items-center justify-center rounded px-2 py-2 hover:bg-gray-200 bg-gray-100"
                      onClick={() => setIsCreateOpen(true)}
                      aria-label="Create new category"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 text-gray-500"
                        aria-hidden="true"
                      >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
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


