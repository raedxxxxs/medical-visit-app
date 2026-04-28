import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const sizes = { sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-5 w-5' } as const

export function Spinner({
  size = 'md',
  className,
  label,
}: {
  size?: keyof typeof sizes
  className?: string
  label?: string
}) {
  return (
    <Loader2
      role="status"
      aria-label={label ?? 'טוען'}
      className={cn('animate-spin text-text-muted', sizes[size], className)}
    />
  )
}
