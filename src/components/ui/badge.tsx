import { type HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
  {
    variants: {
      variant: {
        default:
          'bg-primary-100 text-primary-800 ring-primary-200/60 dark:bg-primary-900/40 dark:text-primary-200 dark:ring-primary-800/60',
        success:
          'bg-[--color-success-bg] text-[--color-success-fg] ring-[--color-success-fg]/20',
        warning:
          'bg-[--color-warning-bg] text-[--color-warning-fg] ring-[--color-warning-fg]/20',
        danger:
          'bg-[--color-danger-bg] text-[--color-danger-fg] ring-[--color-danger-fg]/20',
        info:
          'bg-[--color-info-bg] text-[--color-info-fg] ring-[--color-info-fg]/20',
        neutral:
          'bg-[--color-surface-sunk] text-text-muted ring-border',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}
