import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import openIcon from '../assets/panel-right-open.svg'
import closeIcon from '../assets/panel-right-close.svg'

function Sidebar() {
  const [isOpen, setIsOpen] = useState(true)

  const OPEN_WIDTH = 256
  const CLOSED_WIDTH = 56

  return (
    <motion.aside
      initial={false}
      animate={{ width: isOpen ? OPEN_WIDTH : CLOSED_WIDTH }}
      transition={{ type: 'spring', stiffness: 260, damping: 30, mass: 0.4 }}
      className={`fixed left-0 top-0 bottom-0 z-30 h-full border-r border-gray-200 bg-white flex flex-col`}
    >
      <div className="h-12 flex items-center justify-between px-2">
        <div className="flex-1 overflow-hidden">
          <AnimatePresence initial={false} mode="wait">
            {isOpen && (
              <motion.div
                key="sidebar-title"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="text-sm font-medium truncate"
              >
                Library
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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
          <ul className="space-y-1 px-2">
            <li>
              <a className="flex items-center gap-2 rounded px-2 py-2 text-sm hover:bg-gray-100" href="#">
                <div className="flex-1 overflow-hidden">
                  <AnimatePresence initial={false} mode="wait">
                    {isOpen && (
                      <motion.span
                        key="item1-text"
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="block truncate"
                      >
                        Item 1
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </a>
            </li>
            <li>
              <a className="flex items-center gap-2 rounded px-2 py-2 text-sm hover:bg-gray-100" href="#">
                <div className="flex-1 overflow-hidden">
                  <AnimatePresence initial={false} mode="wait">
                    {isOpen && (
                      <motion.span
                        key="item2-text"
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="block truncate"
                      >
                        Item 2
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </a>
            </li>
          </ul>
        </motion.nav>
      </div>
    </motion.aside>
  )
}

export default Sidebar


