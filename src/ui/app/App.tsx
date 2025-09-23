import React, { useState } from 'react'
import Sidebar from '../components/sidebar/sidebar'
import HomePage from '../pages/home/home-page'
import CategoryView from '../components/common/category-view'
import SplitPdf from '../features/pdf/split-pdf'

function App() {
  const [selected, setSelected] = useState<{ id: string; name: string; path: string } | null>(null)
  const [splitContext, setSplitContext] = useState<{
    projectId: string
    path: string
    fileName: string
  } | null>(null)
  const [showHome, setShowHome] = useState<boolean>(() => {
    try {
      const already = sessionStorage.getItem('app-session-initialized')
      if (!already) {
        sessionStorage.setItem('app-session-initialized', 'true')
        // Persist homepage as last view so sidebar reflects it and stays after launch
        localStorage.setItem('last-view', 'home')
        return true
      }
      // Respect persisted last view after initial launch
      return localStorage.getItem('last-view') === 'home'
    } catch {
      return false
    }
  })

  React.useEffect(() => {
    function onDeleted(e: Event) {
      const detail = (e as CustomEvent<{ id: string }>).detail
      if (detail && selected?.id === detail.id) {
        setSelected(null)
      }
    }
    window.addEventListener('project:deleted', onDeleted)
    return () => window.removeEventListener('project:deleted', onDeleted)
  }, [selected])

  React.useEffect(() => {
    function onSplit(e: Event) {
      const detail = (e as CustomEvent<{ projectId: string; path: string; fileName: string }>).detail
      if (!detail) return
      setSplitContext({ projectId: detail.projectId, path: detail.path, fileName: detail.fileName })
    }
    window.addEventListener('project:item:split', onSplit)
    return () => window.removeEventListener('project:item:split', onSplit)
  }, [])

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-white">
      <div className="fixed top-0 left-0 right-0 h-10 bg-white app-drag" />
      {!splitContext && (
        <Sidebar
          onSelectCategory={(c) => {
            setShowHome(false)
            try { localStorage.setItem('last-view', 'category') } catch {}
            setSelected(c)
          }}
          onSelectHome={() => {
            setSelected(null)
            setShowHome(true)
            try { localStorage.setItem('last-view', 'home') } catch {}
          }}
        />
      )}
      <main className="flex-1 min-w-0 w-full h-full min-h-0 pt-10">
        {splitContext ? (
          <SplitPdf
            onClose={() => setSplitContext(null)}
            projectId={splitContext.projectId}
            path={splitContext.path}
            fileName={splitContext.fileName}
          />
        ) : showHome ? (
          <HomePage />
        ) : selected ? (
          <CategoryView id={selected.id} name={selected.name} />
        ) : null}
      </main>
    </div>
  )
}

export default App

