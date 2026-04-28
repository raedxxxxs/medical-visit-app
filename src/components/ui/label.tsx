import { type LabelHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface Props extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

export const Label = forwardRef<HTMLLabelElement, Props>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'text-sm font-medium text-text',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
      {required && (
        <span aria-hidden className="ms-1 text-[--color-danger-fg]">
          *
        </span>
      )}
    </label>
  ),
)
Label.displayName = 'Label'
