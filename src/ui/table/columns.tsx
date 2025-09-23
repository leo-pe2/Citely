import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import React from "react"

// Removed Button to avoid hover/focus borders shifting header layout
import openIcon from "../assets/square-arrow-out-up-right.svg"
import trashIcon from "../assets/trash.svg"

export type ItemRow = {
  title: string
  fileName: string
  authors?: string | null
  year?: number | null
  status?: string | null
  doiOrIsbn?: string | null
  added?: string | null
  lastUsed?: string | null
  path?: string
  projectId?: string
}

export const columns: ColumnDef<ItemRow>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => (
      <button
        type="button"
        className="inline-flex items-center gap-1 text-left w-full p-0 m-0 bg-transparent border-0 hover:bg-transparent focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <span>Title</span>
        <ArrowUpDown className="h-4 w-4 opacity-60" />
      </button>
    ),
    cell: ({ row, table }) => {
      const v = row.getValue<string>("title")
      const isExpanded = row.getIsExpanded()
      return (
        <button
          type="button"
          className={`block w-full text-left ${isExpanded ? 'whitespace-normal break-words' : 'truncate'}`}
          title={v}
          onClick={() => row.toggleExpanded()}
          aria-expanded={isExpanded}
        >
          {v}
        </button>
      )
    },
  },
  {
    accessorKey: "authors",
    header: "Author(s)",
    cell: ({ row }) => {
      const value = (row.getValue("authors") as string | null) ?? null
      const display = value && String(value).trim().length > 0 ? String(value) : "-"
      const isExpanded = row.getIsExpanded()
      return (
        <div className={isExpanded ? "whitespace-normal break-words" : "truncate"}>{display}</div>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = (row.getValue("status") as string | null) ?? ""
      const cfg = (() => {
        if (status === 'ongoing') return { dot: '#f77f00', bg: 'bg-[#f77f00]/15', text: 'text-gray-700', label: 'Ongoing' }
        if (status === 'done') return { dot: '#4c956c', bg: 'bg-[#4c956c]/15', text: 'text-gray-700', label: 'Done' }
        return { dot: '#9ca3af', bg: 'bg-gray-300/30', text: 'text-gray-700', label: 'To Do' }
      })()
      return (
        <div className={`inline-flex items-center text-xs font-medium rounded-full px-2 py-1 ${cfg.bg} ${cfg.text}`}>
          <span className="inline-block h-2.5 w-2.5 rounded-full mr-2" style={{ backgroundColor: cfg.dot }} />
          {cfg.label}
        </div>
      )
    },
  },
  {
    accessorKey: "year",
    header: ({ column }) => (
      <button
        type="button"
        className="inline-flex items-center gap-1 text-left w-full p-0 m-0 bg-transparent border-0 hover:bg-transparent focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <span>Year</span>
        <ArrowUpDown className="h-4 w-4 opacity-60" />
      </button>
    ),
    cell: ({ row }) => {
      const value = row.getValue("year") as number | null
      return <div className="tabular-nums">{value ?? "-"}</div>
    },
  },
  // Last access column moved to end (after Added)
  {
    accessorKey: "doiOrIsbn",
    header: "DOI / ISBN",
    cell: ({ row }) => {
      const value = (row.getValue("doiOrIsbn") as string | null) ?? null
      const display = value && String(value).trim().length > 0 ? String(value) : "-"
      const isExpanded = row.getIsExpanded()
      const raw = (value || '').trim()
      // Detect DOI and render as URL
      const normalized = raw.replace(/^doi\s*[:=]?\s*/i, '')
      const doiMatch = /^10\.\d{4,9}\/[\-._;()\/:A-Za-z0-9]+$/.test(normalized)
      const looksLikeUrl = /^https?:\/\//i.test(raw)
      if (raw && (doiMatch || looksLikeUrl)) {
        const href = looksLikeUrl ? raw : `https://doi.org/${normalized}`
        return (
          <div className={isExpanded ? "whitespace-normal break-words" : "truncate"}>
            <a href={href} target="_blank" rel="noreferrer" className="no-underline hover:underline text-current" title={raw}>
              {display}
            </a>
          </div>
        )
      }
      return <div className={isExpanded ? "whitespace-normal break-words" : "truncate"} title={value ?? undefined}>{display}</div>
    },
  },
  {
    accessorKey: "added",
    header: "Added",
    cell: ({ row }) => {
      const value = (row.getValue("added") as string | null) ?? null
      let display = "-"
      const raw = value ? String(value).trim() : ""
      if (raw) {
        let formatted: string | null = null
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
        if (m) {
          const d = parseInt(m[3], 10)
          const mo = parseInt(m[2], 10)
          const yy = String(m[1]).slice(-2)
          formatted = `${d}.${mo}.${yy}`
        } else {
          try {
            const dt = new Date(raw)
            if (!Number.isNaN(dt.getTime())) {
              const d = dt.getDate()
              const mo = dt.getMonth() + 1
              const yy = String(dt.getFullYear()).slice(-2)
              formatted = `${d}.${mo}.${yy}`
            }
          } catch {}
        }
        display = formatted || raw
      }
      const isExpanded = row.getIsExpanded()
      return <div className={isExpanded ? "whitespace-normal break-words tabular-nums" : "tabular-nums"}>{display}</div>
    },
  },
  {
    accessorKey: "lastUsed",
    header: "Last access",
    cell: ({ row }) => {
      const value = (row.getValue("lastUsed") as string | null) ?? null
      let display = "-"
      const raw = value ? String(value).trim() : ""
      if (raw) {
        let formatted: string | null = null
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
        if (m) {
          const d = parseInt(m[3], 10)
          const mo = parseInt(m[2], 10)
          const yy = String(m[1]).slice(-2)
          formatted = `${d}.${mo}.${yy}`
        } else {
          try {
            const dt = new Date(raw)
            if (!Number.isNaN(dt.getTime())) {
              const d = dt.getDate()
              const mo = dt.getMonth() + 1
              const yy = String(dt.getFullYear()).slice(-2)
              formatted = `${d}.${mo}.${yy}`
            }
          } catch {}
        }
        display = formatted || raw
      }
      return <div className="tabular-nums">{display}</div>
    },
  },
  {
    id: "open",
    header: "",
    cell: ({ row }) => {
      const fileName = row.original.fileName
      const projectId = row.original.projectId
      const path = row.original.path
      const [showConfirm, setShowConfirm] = React.useState(false)
      return (
        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-gray-200 bg-white hover:bg-gray-50"
            title="Delete"
            aria-label="Delete PDF"
            onClick={() => { if (projectId && path && fileName) setShowConfirm(true) }}
          >
            <img src={trashIcon} alt="" className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-gray-200 bg-white hover:bg-gray-50"
            title="Open"
            aria-label="Open PDF"
            onClick={() => {
              try {
                if (!projectId || !path) return
                window.dispatchEvent(new CustomEvent('project:item:split', { detail: { projectId, path, fileName } }))
              } catch {}
            }}
          >
            <img src={openIcon} alt="" className="h-4 w-4" />
          </button>

          {showConfirm ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/50" onClick={() => setShowConfirm(false)} />
              <div className="relative z-10 w-[420px] rounded-xl border border-white/10 bg-white/80 backdrop-blur-md shadow-2xl p-5">
                <div className="text-lg font-medium text-gray-900 mb-1">Delete file and related data?</div>
                <div className="text-sm text-gray-700 mb-4">This will delete the PDF and its highlights. This action cannot be undone.</div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
                    onClick={() => setShowConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-3 py-1.5 text-sm rounded bg-black text-white hover:opacity-90"
                    onClick={async () => {
                      try {
                        const api = (window as unknown as { api?: { projects: { items?: { deleteAll?: (projectId: string, pdfFileName: string, absolutePath: string) => Promise<{ ok: true }> } } } }).api
                        await api?.projects.items?.deleteAll?.(projectId!, fileName!, path!)
                        window.dispatchEvent(new CustomEvent('project:item:deleted', { detail: { path } }))
                      } finally {
                        setShowConfirm(false)
                      }
                    }}
                  >
                    Delete everything
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )
    },
    enableSorting: false,
  },
]

