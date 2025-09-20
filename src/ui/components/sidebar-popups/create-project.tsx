import React, { useEffect, useState } from 'react'

type CreateProjectModalProps = {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string) => void | Promise<void>
  title?: string
  placeholder?: string
}

export default function CreateProjectModal({ isOpen, onClose, onCreate, title = 'Create New Project', placeholder = 'Enter name' }: CreateProjectModalProps) {
  const [name, setName] = useState('')

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter') handleCreate()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, name])

  useEffect(() => {
    if (isOpen) setName('')
  }, [isOpen])

  if (!isOpen) return null

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    await onCreate(trimmed)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
   >
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative z-10 w-full max-w-sm rounded-lg bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-base font-medium">{title}</div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          className="mb-4 w-full rounded border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-300"
        />
        <div className="flex items-center justify-end gap-2">
          <button
            className="rounded px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-black disabled:opacity-50"
            onClick={handleCreate}
            disabled={!name.trim()}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}


