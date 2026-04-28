import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Crumb {
  label: string
  to?: string
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null
  return (
    <nav aria-label="פירורי לחם" className={cn('text-sm text-text-muted', className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => {
          const isLast = i === items.length - 1
          return (
            <Fragment key={`${c.label}-${i}`}>
              <li>
                {c.to && !isLast ? (
                  <Link
                    to={c.to}
                    className="rounded-sm hover:text-text hover:underline"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className={cn(isLast && 'font-medium text-text')}
                  >
                    {c.label}
                  </span>
                )}
              </li>
              {!isLast && (
                <li aria-hidden className="flex items-center">
                  <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
