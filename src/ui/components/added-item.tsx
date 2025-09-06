import React from 'react'

type AddedItemProps = {
  projectId: string
}

export default function AddedItem({ projectId }: AddedItemProps) {
  return (
    <div className="w-full h-full flex items-center justify-center text-gray-600">
      <div className="text-center">
        <div className="text-lg">Items found in this category.</div>
        <div className="text-sm text-gray-500">(Display coming soon)</div>
      </div>
    </div>
  )
}


