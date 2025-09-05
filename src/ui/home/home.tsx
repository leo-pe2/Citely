import React from 'react'
import Sidebar from '../components/sidebar'

function Home() {
  return (
    <div className="h-screen w-screen flex overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 w-full" />
    </div>
  )
}

export default Home


