import React, { useState } from 'react'
import Sidebar from '../components/sidebar'
import CategoryView from '../components/category-view'
import SplitPdf from '../pdf view/split-pdf'

function Home() {
  const [selected, setSelected] = useState<{ id: string; name: string; path: string } | null>(null)
  const [splitContext, setSplitContext] = useState<{
    projectId: string
    path: string
    fileName: string
  } | null>(null)

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
    <div className="h-screen w-screen flex overflow-hidden">
      <Sidebar onSelectCategory={(c) => setSelected(c)} />
      <main className="flex-1 min-w-0 w-full h-full min-h-0">
        {splitContext ? (
          <SplitPdf
            onClose={() => setSplitContext(null)}
            projectId={splitContext.projectId}
            path={splitContext.path}
            fileName={splitContext.fileName}
          />
        ) : selected ? (
          <CategoryView id={selected.id} name={selected.name} />
        ) : null}
      </main>
    </div>
  )
}

export default Home


