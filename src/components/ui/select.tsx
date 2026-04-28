import { type SelectHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-10 w-full rounded-[--radius-sm] border border-border bg-surface px-3 py-2 text-sm text-text',
        'transition-[border-color,box-shadow,background-color] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus-ring] focus-visible:border-primary-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-[--color-danger-fg] aria-[invalid=true]:focus-visible:ring-[--color-danger-fg]',
        'dark:bg-[--color-surface-sunk]',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
)
Select.displayName = 'Select'
