import * as React from 'react'
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'
import { cn } from '../../lib/utils.js'

export const ContextMenu = ContextMenuPrimitive.Root
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger
export const ContextMenuGroup = ContextMenuPrimitive.Group
export const ContextMenuPortal = ContextMenuPrimitive.Portal
export const ContextMenuSub = ContextMenuPrimitive.Sub
export const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup

export const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, onClick, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      className={cn(
        'z-50 min-w-[11rem] max-h-[var(--radix-context-menu-content-available-height)] overflow-x-hidden overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1.5 shadow-sm data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className,
      )}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.(event)
      }}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
))
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName

export const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
    inset?: boolean
    variant?: 'default' | 'destructive'
  }
>(({ className, inset, variant = 'default', onPointerUp, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    data-inset={inset}
    data-variant={variant}
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-neutral-700 outline-none transition-colors focus:bg-neutral-100 focus:text-neutral-950 data-[inset=true]:pl-8 data-[variant=destructive]:text-rose-700 data-[variant=destructive]:focus:bg-rose-50 data-[variant=destructive]:focus:text-rose-700 data-disabled:pointer-events-none data-disabled:opacity-50',
      className,
    )}
    onPointerUp={(event) => {
      if (event.button === 2) {
        event.preventDefault()
      }
      onPointerUp?.(event)
    }}
    {...props}
  />
))
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName

export const ContextMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(({ className, children, checked, onPointerUp, ...props }, ref) => (
  <ContextMenuPrimitive.CheckboxItem
    ref={ref}
    checked={checked}
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-lg py-2 pl-8 pr-2.5 text-sm text-neutral-700 outline-none transition-colors focus:bg-neutral-100 focus:text-neutral-950 data-disabled:pointer-events-none data-disabled:opacity-50',
      className,
    )}
    onPointerUp={(event) => {
      if (event.button === 2) {
        event.preventDefault()
      }
      onPointerUp?.(event)
    }}
    {...props}
  >
    <span className="pointer-events-none absolute left-2.5 flex h-4 w-4 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.CheckboxItem>
))
ContextMenuCheckboxItem.displayName = ContextMenuPrimitive.CheckboxItem.displayName

export const ContextMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>
>(({ className, children, onPointerUp, ...props }, ref) => (
  <ContextMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-lg py-2 pl-8 pr-2.5 text-sm text-neutral-700 outline-none transition-colors focus:bg-neutral-100 focus:text-neutral-950 data-disabled:pointer-events-none data-disabled:opacity-50',
      className,
    )}
    onPointerUp={(event) => {
      if (event.button === 2) {
        event.preventDefault()
      }
      onPointerUp?.(event)
    }}
    {...props}
  >
    <span className="pointer-events-none absolute left-2.5 flex h-4 w-4 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Circle className="h-2.5 w-2.5 fill-current" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.RadioItem>
))
ContextMenuRadioItem.displayName = ContextMenuPrimitive.RadioItem.displayName

export const ContextMenuLabel = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Label
    ref={ref}
    data-inset={inset}
    className={cn('px-2.5 py-1.5 text-xs font-medium text-neutral-500 data-[inset=true]:pl-8', className)}
    {...props}
  />
))
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName

export const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator ref={ref} className={cn('my-1 h-px bg-neutral-200', className)} {...props} />
))
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName

export const ContextMenuShortcut = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<'span'>
>(({ className, ...props }, ref) => (
  <span ref={ref} className={cn('ml-auto text-[11px] tracking-wider text-neutral-500', className)} {...props} />
))
ContextMenuShortcut.displayName = 'ContextMenuShortcut'

export const ContextMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & {
    inset?: boolean
    customSuffix?: React.ReactNode
  }
>(({ className, inset, children, customSuffix, ...props }, ref) => (
  <ContextMenuPrimitive.SubTrigger
    ref={ref}
    data-inset={inset}
    className={cn(
      'flex cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-neutral-700 outline-none transition-colors focus:bg-neutral-100 focus:text-neutral-950 data-[state=open]:bg-neutral-100 data-[state=open]:text-neutral-950 data-[inset=true]:pl-8',
      className,
    )}
    {...props}
  >
    {children}
    {customSuffix ?? <ChevronRight className="ml-auto h-4 w-4" />}
  </ContextMenuPrimitive.SubTrigger>
))
ContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName

export const ContextMenuSubContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(({ className, onClick, ...props }, ref) => (
  <ContextMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      'z-50 min-w-[11rem] rounded-xl border border-neutral-200 bg-white p-1.5 shadow-sm data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
      className,
    )}
    onClick={(event) => {
      event.stopPropagation()
      onClick?.(event)
    }}
    {...props}
  />
))
ContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName
