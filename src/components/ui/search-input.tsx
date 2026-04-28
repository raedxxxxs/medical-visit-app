import { forwardRef, type InputHTMLAttributes } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string
  onValueChange: (next: string) => void
  containerClassName?: string
}

export const SearchInput = forwardRef<HTMLInputElement, Props>(
  ({ value, onValueChange, containerClassName, className, ...props }, ref) => (
    <div className={cn('relative', containerClassName)}>
      <Search
        aria-hidden
        className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
      />
      <Input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn('ps-10 pe-10', className)}
        {...props}
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onValueChange('')}
          aria-label="נקה חיפוש"
          className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-muted transition-colors hover:bg-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus-ring]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  ),
)
SearchInput.displayName = 'SearchInput'
