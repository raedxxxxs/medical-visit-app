import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-10 w-full rounded-[--radius-sm] border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted',
        'transition-[border-color,box-shadow,background-color] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus-ring] focus-visible:border-primary-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-[--color-danger-fg] aria-[invalid=true]:focus-visible:ring-[--color-danger-fg]',
        'dark:bg-[--color-surface-sunk]',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
