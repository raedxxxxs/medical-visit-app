import { type HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default:
          'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200',
        success:
          'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
        warning:
          'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
        danger:
          'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
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
