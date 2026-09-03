import type { FormEvent } from 'react'
import { Button } from '../ui/button.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog.tsx'
import { Input } from '../ui/input.tsx'

type SaveViewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  viewName: string
  onViewNameChange: (value: string) => void
  onSave: () => void
  isPending: boolean
  errorMessage?: string | null
  submitLabel: string
}

export function SaveViewDialog({
  open,
  onOpenChange,
  viewName,
  onViewNameChange,
  onSave,
  isPending,
  errorMessage,
  submitLabel,
}: SaveViewDialogProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSave()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Save view</DialogTitle>
            <DialogDescription>
              Save the current filters as a personal view. Built-in presets stay unchanged.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-800" htmlFor="saved-view-name">
              View name
            </label>
            <Input
              id="saved-view-name"
              value={viewName}
              onChange={(event) => onViewNameChange(event.target.value)}
              placeholder="Qualified this week"
              disabled={isPending}
              autoFocus
            />
          </div>

          {errorMessage ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
