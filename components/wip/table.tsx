import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '../../lib/utils.ts'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../ui/context-menu.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.tsx'
import { Button } from '../ui/button.tsx'
import { EmptyState } from './empty-state.tsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.tsx'

export type DataTableColumn<T> = {
  key: string
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

export type DataTableAction<T> = {
  label: string
  onSelect: (row: T) => void
  icon?: ReactNode
  shortcut?: string
  variant?: 'default' | 'destructive'
  disabled?: boolean
}

/**
 * Generic table surface with consistent spacing and empty-state treatment.
 */
export function DataTable<T extends { id: string }>({
  columns,
  rows,
  emptyTitle,
  emptyDescription,
  emptyAction,
  rowActions,
  onRowClick,
  getRowClassName,
  enableSelection = false,
  selectionLabel = 'rows selected',
}: {
  columns: DataTableColumn<T>[]
  rows: T[]
  emptyTitle: string
  emptyDescription: string
  emptyAction?: ReactNode
  rowActions?: (row: T) => DataTableAction<T>[]
  onRowClick?: (row: T) => void
  getRowClassName?: (row: T) => string
  enableSelection?: boolean
  selectionLabel?: string
}) {
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  const headerCheckboxRef = useRef<HTMLInputElement | null>(null)
  const selectableRowIds = useMemo(() => new Set(rows.map((row) => row.id)), [rows])

  const visibleSelectedRowIds = useMemo(() => {
    const next = new Set<string>()
    for (const id of selectedRowIds) {
      if (selectableRowIds.has(id)) {
        next.add(id)
      }
    }
    return next
  }, [selectedRowIds, selectableRowIds])

  const allRowsSelected = rows.length > 0 && visibleSelectedRowIds.size === rows.length
  const partiallySelected = visibleSelectedRowIds.size > 0 && visibleSelectedRowIds.size < rows.length

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = partiallySelected
    }
  }, [partiallySelected])

  const hasActionColumn = Boolean(rowActions)
  const selectedCount = visibleSelectedRowIds.size
  const selectedLabel = useMemo(
    () => `${selectedCount} ${selectionLabel}`,
    [selectedCount, selectionLabel],
  )

  function toggleRowSelection(rowId: string) {
    setSelectedRowIds((current) => {
      const next = new Set(current)
      if (next.has(rowId)) {
        next.delete(rowId)
      } else {
        next.add(rowId)
      }
      return next
    })
  }

  function toggleAllRows() {
    if (allRowsSelected) {
      setSelectedRowIds(new Set())
      return
    }
    setSelectedRowIds(new Set(rows.map((row) => row.id)))
  }

  function handleRowKeyDown(row: T, event: KeyboardEvent<HTMLTableRowElement>) {
    if (!onRowClick) {
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onRowClick(row)
    }
  }

  function renderActions(row: T) {
    const actions = rowActions?.(row) ?? []
    if (actions.length === 0) {
      return null
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(event) => event.stopPropagation()}
            aria-label="Open row actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Row actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.label}
              disabled={action.disabled}
              variant={action.variant}
              onSelect={() => action.onSelect(row)}
            >
              {action.icon}
              {action.label}
              {action.shortcut ? <span className="ml-auto text-[11px] text-neutral-500">{action.shortcut}</span> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  function renderContextMenu(row: T) {
    const actions = rowActions?.(row) ?? []
    if (actions.length === 0) {
      return null
    }

    return (
      <ContextMenuContent>
        <ContextMenuLabel>Row actions</ContextMenuLabel>
        <ContextMenuSeparator />
        {actions.map((action) => (
          <ContextMenuItem
            key={action.label}
            disabled={action.disabled}
            variant={action.variant}
            onSelect={() => action.onSelect(row)}
          >
            {action.icon}
            {action.label}
            {action.shortcut ? <span className="ml-auto text-[11px] text-neutral-500">{action.shortcut}</span> : null}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    )
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
  }

  return (
    <div className="space-y-3">
      {enableSelection && selectedCount > 0 ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <p className="font-medium">{selectedLabel}</p>
          <Button variant="ghost" size="sm" onClick={() => setSelectedRowIds(new Set())}>
            Clear selection
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {enableSelection ? (
              <TableHead className="w-11 pl-4 pr-0">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  checked={allRowsSelected}
                  onChange={toggleAllRows}
                  aria-label="Select all rows"
                  className="h-4 w-4 rounded border-neutral-300 text-emerald-700 focus:ring-emerald-500"
                />
              </TableHead>
            ) : null}
            {columns.map((column) => (
              <TableHead key={column.key} className={column.className}>
                {column.header}
              </TableHead>
            ))}
            {hasActionColumn ? <TableHead className="w-14 text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isVisibleSelected = visibleSelectedRowIds.has(row.id)
            const rowClassName = cn(
              onRowClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
              isVisibleSelected && 'bg-emerald-50/70',
              getRowClassName?.(row),
            )
            const rowElement = (
              <TableRow
                key={row.id}
                className={rowClassName}
                onClick={() => onRowClick?.(row)}
                onKeyDown={(event) => handleRowKeyDown(row, event)}
                tabIndex={onRowClick ? 0 : undefined}
                aria-selected={isVisibleSelected}
              >
                {enableSelection ? (
                  <TableCell className="pl-4 pr-0" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isVisibleSelected}
                      onChange={() => toggleRowSelection(row.id)}
                      aria-label={`Select row ${row.id}`}
                      className="h-4 w-4 rounded border-neutral-300 text-emerald-700 focus:ring-emerald-500"
                    />
                  </TableCell>
                ) : null}
                {columns.map((column) => (
                  <TableCell key={`${row.id}-${column.key}`} className={column.className}>
                    {column.cell(row)}
                  </TableCell>
                ))}
                {hasActionColumn ? (
                  <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                    <div className="flex justify-end">{renderActions(row)}</div>
                  </TableCell>
                ) : null}
              </TableRow>
            )

            if (!hasActionColumn) {
              return rowElement
            }

            return (
              <ContextMenu key={row.id}>
                <ContextMenuTrigger asChild>{rowElement}</ContextMenuTrigger>
                {renderContextMenu(row)}
              </ContextMenu>
            )
          })}
        </TableBody>
        </Table>
      </div>
    </div>
  )
}
