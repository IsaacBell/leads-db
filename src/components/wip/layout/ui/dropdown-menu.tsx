import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'
import { cn } from '../../lib/utils.js'

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal
export const DropdownMenuGroup = DropdownMenuPrimitive.Group
export const DropdownMenuSub = DropdownMenuPrimitive.Sub
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 8, align = 'start', onClick, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      className={cn(
        'z-50 min-w-[11rem] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-x-hidden overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1.5 shadow-sm data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className,
      )}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.(event)
      }}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
    variant?: 'default' | 'destructive'
  }
>(({ className, inset, variant = 'default', onClick, onPointerDown, onPointerUp, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    data-inset={inset}
    data-variant={variant}
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-neutral-700 outline-none transition-colors focus:bg-neutral-100 focus:text-neutral-950 data-[inset=true]:pl-8 data-[variant=destructive]:text-rose-700 data-[variant=destructive]:focus:bg-rose-50 data-[variant=destructive]:focus:text-rose-700 data-disabled:pointer-events-none data-disabled:opacity-50',
      className,
    )}
    onClick={(event) => {
      event.stopPropagation()
      onClick?.(event)
    }}
    onPointerDown={(event) => {
      event.stopPropagation()
      onPointerDown?.(event)
    }}
    onPointerUp={(event) => {
      if (event.button === 2) {
        event.preventDefault()
      }
      onPointerUp?.(event)
    }}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, onClick, onPointerDown, onPointerUp, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    checked={checked}
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-lg py-2 pl-8 pr-2.5 text-sm text-neutral-700 outline-none transition-colors focus:bg-neutral-100 focus:text-neutral-950 data-disabled:pointer-events-none data-disabled:opacity-50',
      className,
    )}
    onClick={(event) => {
      event.stopPropagation()
      onClick?.(event)
    }}
    onPointerDown={(event) => {
      event.stopPropagation()
      onPointerDown?.(event)
    }}
    onPointerUp={(event) => {
      if (event.button === 2) {
        event.preventDefault()
      }
      onPointerUp?.(event)
    }}
    {...props}
  >
    <span className="pointer-events-none absolute left-2.5 flex h-4 w-4 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName

export const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem> & {
    showIndicator?: boolean
  }
>(({ className, children, showIndicator = true, onClick, onPointerDown, onPointerUp, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-lg py-2 pr-2.5 text-sm text-neutral-700 outline-none transition-colors focus:bg-neutral-100 focus:text-neutral-950 data-disabled:pointer-events-none data-disabled:opacity-50',
      showIndicator ? 'pl-8' : 'pl-2.5',
      className,
    )}
    onClick={(event) => {
      event.stopPropagation()
      onClick?.(event)
    }}
    onPointerDown={(event) => {
      event.stopPropagation()
      onPointerDown?.(event)
    }}
    onPointerUp={(event) => {
      if (event.button === 2) {
        event.preventDefault()
      }
      onPointerUp?.(event)
    }}
    {...props}
  >
    {showIndicator ? (
      <span className="pointer-events-none absolute left-2.5 flex h-4 w-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Circle className="h-2.5 w-2.5 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
    ) : null}
    {children}
  </DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    data-inset={inset}
    className={cn('px-2.5 py-1.5 text-xs font-medium text-neutral-500 data-[inset=true]:pl-8', className)}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn('my-1 h-px bg-neutral-200', className)} {...props} />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

export const DropdownMenuShortcut = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<'span'>
>(({ className, ...props }, ref) => (
  <span ref={ref} className={cn('ml-auto text-[11px] tracking-wider text-neutral-500', className)} {...props} />
))
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut'

export const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean
    customSuffix?: React.ReactNode
  }
>(({ className, inset, children, customSuffix, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
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
  </DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName

export const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, onClick, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
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
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName
