import React from 'react'
import { DataTable } from '@table/data-table'
import { columns, type ItemRow } from '@table/columns'

type ItemsTableProps = { projectId: string }
type ProjectItem = { fileName: string; path: string }

export function ItemsTable({ projectId }: ItemsTableProps) {
  const [items, setItems] = React.useState<ProjectItem[]>([])
  const [pathToTitle, setPathToTitle] = React.useState<Record<string, string>>({})
  const [pathToStatus, setPathToStatus] = React.useState<Record<string, 'todo' | 'ongoing' | 'done'>>({})
  const [pathToInfo, setPathToInfo] = React.useState<Record<string, { authors: string | null; year: number | null; pages: number | null; doiOrIsbn: string | null; added: string | null }>>({})

  // Fetch items list
  React.useEffect(() => {
    let mounted = true
    async function loadItems() {
      try {
        const api = (window as unknown as { api?: { projects: { items?: { list?: (projectId: string) => Promise<{ items: ProjectItem[] }> } } } }).api
        const res = await api?.projects.items?.list?.(projectId)
        if (!mounted) return
        setItems(res?.items ?? [])
      } catch {
        if (!mounted) return
        setItems([])
      }
    }
    loadItems()
    return () => { mounted = false }
  }, [projectId])

  // Merge newly imported PDFs immediately without requiring a page switch
  React.useEffect(() => {
    function onItemImported(e: Event) {
      const detail = (e as CustomEvent<{ projectId: string; items: ProjectItem[] }>).detail
      if (!detail || detail.projectId !== projectId || !Array.isArray(detail.items) || detail.items.length === 0) return
      setItems((prev) => {
        const existing = new Set(prev.map((it) => it.path))
        const additions = detail.items.filter((it) => it && typeof it.path === 'string' && !existing.has(it.path))
        if (additions.length === 0) return prev
        return [...prev, ...additions]
      })
    }
    window.addEventListener('project:item:imported', onItemImported)
    return () => window.removeEventListener('project:item:imported', onItemImported)
  }, [projectId])

  // Fetch titles for current items
  React.useEffect(() => {
    let mounted = true
    async function loadTitles() {
      try {
        const api = (window as unknown as { api?: { projects: { items?: { getTitle?: (absolutePath: string) => Promise<{ title: string | null }> } } } }).api
        if (!api?.projects.items?.getTitle || items.length === 0) {
          if (mounted) setPathToTitle({})
          return
        }
        const entries = await Promise.all(
          items.map(async (it) => {
            try {
              const r = await api.projects.items!.getTitle!(it.path)
              return [it.path, (r?.title || '').trim()] as const
            } catch {
              return [it.path, ''] as const
            }
          })
        )
        if (!mounted) return
        setPathToTitle(Object.fromEntries(entries))
      } catch {
        if (!mounted) return
        setPathToTitle({})
      }
    }
    loadTitles()
    return () => { mounted = false }
  }, [items])

  // Fetch PDF info for current items
  React.useEffect(() => {
    let mounted = true
    async function loadInfo() {
      try {
        const api = (window as unknown as { api?: { projects: { items?: { getInfo?: (absolutePath: string) => Promise<{ authors: string | null; year: number | null; pages: number | null; doiOrIsbn: string | null; added: string | null }> } } } }).api
        if (!api?.projects.items?.getInfo || items.length === 0) {
          if (mounted) setPathToInfo({})
          return
        }
        const entries = await Promise.all(
          items.map(async (it) => {
            try {
              const r = await api.projects.items!.getInfo!(it.path)
              return [it.path, r] as const
            } catch {
              return [it.path, { authors: null, year: null, pages: null, doiOrIsbn: null, added: null }] as const
            }
          })
        )
        if (!mounted) return
        setPathToInfo(Object.fromEntries(entries))
      } catch {
        if (!mounted) return
        setPathToInfo({})
      }
    }
    loadInfo()
    return () => { mounted = false }
  }, [items])

  // Fetch kanban statuses
  React.useEffect(() => {
    let mounted = true
    async function loadStatuses() {
      try {
        const api = (window as unknown as { api?: { projects: { kanban?: { get?: (projectId: string) => Promise<Record<string, string>> } } } }).api
        const saved = await api?.projects.kanban?.get?.(projectId)
        if (!mounted) return
        if (!saved) { setPathToStatus({}); return }
        const normalized: Record<string, 'todo' | 'ongoing' | 'done'> = {}
        for (const [k, v] of Object.entries(saved)) {
          const sv = (v as any) === 'underReview' ? 'ongoing' : (v as 'todo' | 'ongoing' | 'done')
          if (sv === 'todo' || sv === 'ongoing' || sv === 'done') normalized[k] = sv
        }
        setPathToStatus(normalized)
      } catch {
        if (!mounted) return
        setPathToStatus({})
      }
    }
    loadStatuses()
    return () => { mounted = false }
  }, [projectId])

  // Derive rows from items + titles + statuses so updates propagate correctly
  const rows = React.useMemo<ItemRow[]>(() => {
    return items.map((it) => ({
      title: (pathToTitle[it.path] || '').trim() || it.fileName,
      fileName: it.fileName,
      authors: pathToInfo[it.path]?.authors ?? null,
      year: pathToInfo[it.path]?.year ?? null,
      pages: pathToInfo[it.path]?.pages ?? null,
      status: pathToStatus[it.path] ?? 'todo',
      doiOrIsbn: pathToInfo[it.path]?.doiOrIsbn ?? null,
      added: pathToInfo[it.path]?.added ?? null,
    }))
  }, [items, pathToTitle, pathToStatus, pathToInfo])

  return <DataTable columns={columns} data={rows} />
}


