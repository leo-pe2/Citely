import React from 'react'

type CategoryViewProps = {
  name: string
}

export default function CategoryView({ name }: CategoryViewProps) {
  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold">{name}</h1>
    </div>
  )
}


