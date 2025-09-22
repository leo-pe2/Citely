import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import React from "react"

// Removed Button to avoid hover/focus borders shifting header layout

export type ItemRow = {
  title: string
  fileName: string
  authors?: string | null
  year?: number | null
  pages?: number | null
  status?: string | null
  doiOrIsbn?: string | null
  added?: string | null
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
  {
    accessorKey: "pages",
    header: "Pages",
    cell: ({ row }) => {
      const value = row.getValue("pages") as number | null
      return <div className="tabular-nums">{value ?? "-"}</div>
    },
  },
  {
    accessorKey: "doiOrIsbn",
    header: "DOI / ISBN",
    cell: ({ row }) => {
      const value = (row.getValue("doiOrIsbn") as string | null) ?? null
      const display = value && String(value).trim().length > 0 ? String(value) : "-"
      const isExpanded = row.getIsExpanded()
      return (
        <div className={isExpanded ? "whitespace-normal break-words" : "truncate"} title={value ?? undefined}>{display}</div>
      )
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
          formatted = `${d}/${mo}/${yy}`
        } else {
          try {
            const dt = new Date(raw)
            if (!Number.isNaN(dt.getTime())) {
              const d = dt.getDate()
              const mo = dt.getMonth() + 1
              const yy = String(dt.getFullYear()).slice(-2)
              formatted = `${d}/${mo}/${yy}`
            }
          } catch {}
        }
        display = formatted || raw
      }
      const isExpanded = row.getIsExpanded()
      return <div className={isExpanded ? "whitespace-normal break-words tabular-nums" : "tabular-nums"}>{display}</div>
    },
  },
]

