import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import openIcon from '../assets/panel-right-open.svg'
import closeIcon from '../assets/panel-right-close.svg'
import folderPlusIcon from '../assets/sidebar/folder-plus.svg'
import folderIcon from '../assets/sidebar/folder.svg'
import CreateProjectModal from './sidebar-popups/create-project'

function Sidebar() {
  const [isOpen, setIsOpen] = useState(true)
  type SidebarProject = { id: string; name: string; path: string }
  const [projects, setProjects] = useState<SidebarProject[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const OPEN_WIDTH = 256
  const CLOSED_WIDTH = 56

  useEffect(() => {
    const api = (window as unknown as {
      api?: { projects: { list: () => Promise<SidebarProject[]> } }
    }).api
    api?.projects
      .list()
      .then((items: SidebarProject[]) => setProjects(items))
      .catch(() => setProjects([]))
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

  return (
    <motion.aside
      initial={false}
      animate={{ width: isOpen ? OPEN_WIDTH : CLOSED_WIDTH }}
      transition={{ type: 'spring', stiffness: 260, damping: 30, mass: 0.4 }}
      className={`h-full border-r border-gray-200 bg-white flex flex-col`}
    >
      <div className={`h-12 flex items-center ${isOpen ? 'justify-between' : 'justify-center'} px-2`}>
        {isOpen ? (
          <div className="flex-1 overflow-hidden">
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key="sidebar-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="text-sm font-medium truncate"
              >
                Library
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
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                className="px-2 py-2"
              >
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-gray-100"
                  onClick={() => setIsCreateOpen(true)}
                >
                  <img src={folderPlusIcon} alt="" className="h-4 w-4" />
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
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
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                className="space-y-1 px-2"
              >
                {projects.map((p) => (
                  <li key={p.id}>
                    <a className="flex items-center gap-2 rounded px-2 py-2 text-sm hover:bg-gray-100" href="#">
                      <div className="flex-1 overflow-hidden min-w-0">
                        <div className="flex items-center gap-2">
                          <img src={folderIcon} alt="" className="h-4 w-4" />
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="block truncate"
                          >
                            {p.name}
                          </motion.span>
                        </div>
                      </div>
                    </a>
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
      />
    </motion.aside>
  )
}

export default Sidebar


