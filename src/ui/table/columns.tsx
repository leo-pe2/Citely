import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import React from "react"

import { Button } from "@/components/ui/button"

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
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-0"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Title
        <ArrowUpDown />
      </Button>
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
    cell: ({ row }) => (
      <div className="truncate">{(row.getValue("authors") as string | null) ?? ""}</div>
    ),
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
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-0"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Year
        <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => <div className="tabular-nums">{(row.getValue("year") as number | null) ?? ""}</div>,
  },
  {
    accessorKey: "pages",
    header: "Pages",
    cell: ({ row }) => <div className="tabular-nums">{(row.getValue("pages") as number | null) ?? ""}</div>,
  },
  {
    accessorKey: "doiOrIsbn",
    header: "DOI / ISBN",
    cell: ({ row }) => <div className="truncate" title={(row.getValue("doiOrIsbn") as string | null) ?? undefined}>{(row.getValue("doiOrIsbn") as string | null) ?? ""}</div>,
  },
  {
    accessorKey: "added",
    header: "Added",
    cell: ({ row }) => <div className="tabular-nums">{(row.getValue("added") as string | null) ?? ""}</div>,
  },
]

