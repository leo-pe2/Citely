import React from 'react'
import { DataTable } from './data-table'
import { createColumns, type ItemRow } from './columns'

type ItemsTableProps = { projectId: string }
type ProjectItem = { fileName: string; path: string }
type ItemStatus = 'todo' | 'ongoing' | 'done'
type StatusMap = Record<string, ItemStatus>

const STATUS_EVENT = 'project:item:status:updated'

export function ItemsTable({ projectId }: ItemsTableProps) {
  const [items, setItems] = React.useState<ProjectItem[]>([])
  const [pathToTitle, setPathToTitle] = React.useState<Record<string, string>>({})
  const [pathToStatus, setPathToStatus] = React.useState<StatusMap>({})
  const [pathToInfo, setPathToInfo] = React.useState<Record<string, { authors: string | null; year: number | null; pages: number | null; doiOrIsbn: string | null; added: string | null; lastUsed: string | null }>>({})
  const persistTimerRef = React.useRef<number | null>(null)

  const schedulePersist = React.useCallback((next: StatusMap) => {
    const api = (window as unknown as { api?: { projects: { kanban?: { set?: (projectId: string, statuses: Record<string, string>) => Promise<{ ok: true }> } } } }).api
    if (!api?.projects.kanban?.set) return
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current)
    const payload = { ...next }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null
      try {
        api.projects.kanban!.set!(projectId, payload as unknown as Record<string, string>)
      } catch {}
    }, 250)
  }, [projectId])

  const applyStatusUpdate = React.useCallback((absolutePath: string, nextStatus: ItemStatus, options?: { persist?: boolean }) => {
    setPathToStatus((prev) => {
      if (nextStatus === 'todo') {
        if (!(absolutePath in prev)) return prev
        const nextMap = { ...prev }
        delete nextMap[absolutePath]
        if (options?.persist !== false) schedulePersist(nextMap)
        return nextMap
      }
      const current = prev[absolutePath]
      if (current === nextStatus) return prev
      const nextMap = { ...prev, [absolutePath]: nextStatus }
      if (options?.persist !== false) schedulePersist(nextMap)
      return nextMap
    })
  }, [schedulePersist])

  const removeStatus = React.useCallback((absolutePath: string, options?: { persist?: boolean }) => {
    setPathToStatus((prev) => {
      if (!(absolutePath in prev)) return prev
      const nextMap = { ...prev }
      delete nextMap[absolutePath]
      if (options?.persist !== false) schedulePersist(nextMap)
      return nextMap
    })
  }, [schedulePersist])

  React.useEffect(() => {
    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current)
    }
  }, [])

  function normalizeStatus(value: unknown): ItemStatus {
    return value === 'ongoing' || value === 'done' ? value : 'todo'
  }

  const handleStatusClick = React.useCallback((row: ItemRow) => {
    const path = row.path
    if (!path) return
    const current = normalizeStatus(row.status)
    if (current === 'todo') return
    const next: ItemStatus = current === 'ongoing' ? 'done' : 'ongoing'
    applyStatusUpdate(path, next)
    window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail: { projectId, updates: { [path]: next } } }))
  }, [applyStatusUpdate, projectId])

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

  // Remove deleted item immediately
  React.useEffect(() => {
    function onDeleted(e: Event) {
      const detail = (e as CustomEvent<{ path: string }>).detail
      if (!detail || !detail.path) return
      setItems((prev) => prev.filter((it) => it.path !== detail.path))
      removeStatus(detail.path)
    }
    window.addEventListener('project:item:deleted', onDeleted)
    return () => window.removeEventListener('project:item:deleted', onDeleted)
  }, [removeStatus])

  // Update last used date immediately when notified
  React.useEffect(() => {
    function onLastUsed(e: Event) {
      const detail = (e as CustomEvent<{ projectId: string; path: string; date: string }>).detail
      if (!detail || detail.projectId !== projectId) return
      setPathToInfo((prev) => ({ ...prev, [detail.path]: { ...(prev[detail.path] || {}), lastUsed: detail.date } }))
    }
    window.addEventListener('project:item:last-used', onLastUsed)
    return () => window.removeEventListener('project:item:last-used', onLastUsed)
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
        const api = (window as unknown as { api?: { projects: { items?: { getInfo?: (absolutePath: string) => Promise<{ authors: string | null; year: number | null; pages: number | null; doiOrIsbn: string | null; added: string | null; lastUsed: string | null }> } } } }).api
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
        const normalized: StatusMap = {}
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

  React.useEffect(() => {
    function onStatusUpdated(e: Event) {
      const detail = (e as CustomEvent<{ projectId: string; updates?: Record<string, string>; remove?: string[] }>).detail
      if (!detail || detail.projectId !== projectId) return
      if (detail.updates) {
        for (const [absolutePath, status] of Object.entries(detail.updates)) {
          if (status === 'todo' || status === 'ongoing' || status === 'done') {
            applyStatusUpdate(absolutePath, status as ItemStatus, { persist: false })
          }
        }
      }
      if (Array.isArray(detail.remove)) {
        detail.remove.forEach((absolutePath) => {
          if (typeof absolutePath === 'string') removeStatus(absolutePath, { persist: false })
        })
      }
    }
    window.addEventListener(STATUS_EVENT, onStatusUpdated)
    return () => window.removeEventListener(STATUS_EVENT, onStatusUpdated)
  }, [projectId, applyStatusUpdate, removeStatus])

  // Derive rows from items + titles + statuses so updates propagate correctly
  const rows = React.useMemo<ItemRow[]>(() => {
    return items.map((it) => ({
      title: (pathToTitle[it.path] || '').trim() || it.fileName,
      fileName: it.fileName,
      authors: pathToInfo[it.path]?.authors ?? null,
      year: pathToInfo[it.path]?.year ?? null,
      status: pathToStatus[it.path] ?? 'todo',
      doiOrIsbn: pathToInfo[it.path]?.doiOrIsbn ?? null,
      added: pathToInfo[it.path]?.added ?? null,
      lastUsed: pathToInfo[it.path]?.lastUsed ?? null,
      path: it.path,
      projectId,
    }))
  }, [items, pathToTitle, pathToStatus, pathToInfo, projectId])

  const tableColumns = React.useMemo(() => createColumns(handleStatusClick), [handleStatusClick])

  return <DataTable columns={tableColumns} data={rows} />
}
