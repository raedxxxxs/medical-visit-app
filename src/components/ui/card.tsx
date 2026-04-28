import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds hover-elevation interaction. Use only for clickable cards. */
  interactive?: boolean
  /** Compact padding variant. */
  compact?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, compact, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-[--radius-md] border border-border bg-surface shadow-[--shadow-md] transition-[box-shadow,transform] duration-200',
        interactive &&
          'cursor-pointer hover:shadow-[--shadow-lg] hover:-translate-y-0.5',
        compact ? 'p-[--space-card-compact]' : '',
        className,
      )}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

export const CardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col gap-1.5 p-[--space-card]', className)}
    {...props}
  />
))
CardHeader.displayName = 'CardHeader'

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-lg font-semibold tracking-tight text-text', className)}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

export const CardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('p-[--space-card] pt-0', className)}
    {...props}
  />
))
CardContent.displayName = 'CardContent'
