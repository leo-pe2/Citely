import React, { useState } from 'react'
import Sidebar from '../components/sidebar'
import CategoryView from '../components/category-view'

function Home() {
  const [selected, setSelected] = useState<{ id: string; name: string; path: string } | null>(null)

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

  return (
    <div className="min-h-screen w-screen flex overflow-x-hidden">
      <Sidebar onSelectCategory={(c) => setSelected(c)} />
      <main className="flex-1 min-w-0 w-full">
        {selected ? <CategoryView id={selected.id} name={selected.name} /> : null}
      </main>
    </div>
  )
}

export default Home


