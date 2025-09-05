import React, { useState } from 'react'
import Sidebar from '../components/sidebar'
import CategoryView from '../components/category-view'

function Home() {
  const [selected, setSelected] = useState<{ id: string; name: string; path: string } | null>(null)

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      <Sidebar onSelectCategory={(c) => setSelected(c)} />
      <main className="flex-1 min-w-0 w-full">
        {selected ? <CategoryView name={selected.name} /> : null}
      </main>
    </div>
  )
}

export default Home


