import React from 'react'
import Sidebar from '../components/sidebar'

function Home() {
  return (
    <div className="h-screen w-screen flex overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 w-full">
        <div className="h-12 border-b border-gray-200 flex items-center px-4">
          <div className="text-sm font-medium">Home</div>
        </div>
        <div className="p-4">
          <div className="text-base">Main content</div>
        </div>
      </main>
    </div>
  )
}

export default Home


