import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import chevronSelector from '../assets/sidebar/chevron-selector.svg'
import homeIcon from '../assets/sidebar/home.svg'
import chevronLeft from '../assets/sidebar/chevron-left.svg'
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
  const [isHomeActive, setIsHomeActive] = useState<boolean>(false)
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
        // On app start, always land on Home regardless of previous session
        setSelectedCategoryId(null)
        setIsHomeActive(true)
        onSelectHome?.()
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
    setIsHomeActive(false)
    onSelectCategory?.(category)
  }

  

  return (
    <motion.aside
      initial={false}
      animate={{ width: isOpen ? OPEN_WIDTH : CLOSED_WIDTH }}
      transition={{ type: 'spring', stiffness: 300, damping: 26, mass: 0.4 }}
      className={`relative mt-10 min-h-[calc(100vh-2.5rem)] border-r border-gray-200 bg-white flex flex-col pt-0`}
    >
      {/* Header removed to bring nav up */}
      {/* Edge toggle button aligned with header center */}
      <button
        className="absolute top-[41px] -translate-y-1/2 -right-[14px] h-7 w-7 rounded-full border border-gray-300 bg-white text-gray-600 shadow-sm hover:bg-gray-50 flex items-center justify-center z-20"
        aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
        aria-expanded={isOpen}
        title={isOpen ? 'Close sidebar' : 'Open sidebar'}
        onClick={() => setIsOpen((v) => !v)}
      >
        <img src={chevronLeft} alt="" className={`h-4 w-4 ${isOpen ? '' : 'rotate-180'} select-none pointer-events-none`} />
      </button>

      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          {isOpen && (
            <div className="mt-3">
              <div className="px-0 py-0 mb-1">
                <button
                  className={`relative z-0 flex items-center justify-between w-[208px] h-14 px-4 rounded-xl mx-auto before:content-[''] before:absolute before:inset-0 before:rounded-xl before:-z-10 ${isHomeActive ? 'before:bg-gray-300/20' : 'before:bg-transparent hover:before:bg-gray-100'}`}
                  type="button"
                  onClick={() => { setSelectedCategoryId(null); setIsHomeActive(true); localStorage.setItem('last-view', 'home'); onSelectHome?.(); }}
                >
                  <span className="flex items-center gap-2">
                    <img src={homeIcon} alt="" className="h-5 w-5" />
                    <span className="text-sm font-medium ml-[8px]">Home</span>
                  </span>
                  <span className="h-8 w-8" />
                </button>
              </div>

              <button
                className={`relative z-0 flex items-center justify-between w-[208px] h-14 px-4 rounded-xl mx-auto before:content-[''] before:absolute before:left-0 before:right-0 before:top-0 before:bottom-[4px] before:rounded-xl before:-z-10 before:pointer-events-none ${projectsExpanded ? 'before:bg-gray-300/20' : 'before:bg-transparent hover:before:bg-gray-100'}`}
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
                  <div className="relative w-[208px] mx-auto px-[9px] mt-0.8">
                    <div className="absolute left-[25px] top-[-4px] bottom-[27px] w-px bg-gray-300" />
                    <ul className="space-y-1 pl-6">
                    {projects.map((p) => (
                        <li key={p.id} className="relative">
                          <div className="rounded">
                              <button
                                className={`group relative flex items-center w-[158px] h-9 rounded-xl px-2 text-sm before:content-[''] before:absolute before:inset-y-0 before:-right-[17px] before:left-1 before:rounded-xl before:transition-colors ${selectedCategoryId === p.id ? 'before:bg-gray-300/20' : 'before:bg-transparent hover:before:bg-gray-300/20'}`}
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
                      <li key="__new__" className="relative">
                        <div className="rounded">
                          <button
                            className="relative flex items-center w-[158px] h-9 rounded-xl px-2 text-sm before:content-[''] before:absolute before:inset-y-0 before:-right-[17px] before:left-1 before:rounded-xl before:bg-gray-300/20 before:transition-colors"
                            onClick={() => setIsCreateOpen(true)}
                            aria-label="Create new project"
                          >
                            <span className="pointer-events-none absolute -left-[8px] top-[calc(50%-18px)] h-5 w-3">
                              <span className="block h-full w-full border-l border-b border-gray-300 rounded-bl-[14px]" />
                            </span>
                            <span className="relative z-10 ml-1 px-2">
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
                            </span>
                          </button>
                        </div>
                      </li>
                    </ul>
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
        title="Project name"
        placeholder="Math"
      />
      
    </motion.aside>
  )
}

export default Sidebar


