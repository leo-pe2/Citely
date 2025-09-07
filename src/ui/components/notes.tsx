import React from 'react'

export default function Notes() {
  return (
    <div className="w-full h-full p-6 text-gray-700">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl font-medium mb-2">Notes</h2>
        <p className="text-sm text-gray-600 mb-4">This is a blank notes page. Add your thoughts here.</p>
        <div className="rounded-xl border border-gray-200 p-4" style={{ background: '#f7f8fa' }}>
          <p className="text-gray-700">Filler text: Start typing your notes...</p>
        </div>
      </div>
    </div>
  )
}
