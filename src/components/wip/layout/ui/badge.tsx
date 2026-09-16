import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from "@/src/lib/utils"

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        neutral: 'border-neutral-200 bg-neutral-100 text-neutral-700',
        warning: 'border-amber-200 bg-amber-50 text-amber-700',
        destructive: 'border-rose-200 bg-rose-50 text-rose-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
