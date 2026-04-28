import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus-ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--color-surface] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-primary-600 text-white shadow-sm hover:bg-primary-700 dark:bg-primary-500 dark:text-neutral-950 dark:hover:bg-primary-400',
        outline:
          'border border-border bg-surface text-text hover:bg-muted hover:border-border-strong',
        ghost: 'text-text hover:bg-muted/60 hover:text-primary-700 dark:hover:text-primary-200',
        danger: 'bg-[--color-danger] text-white shadow-sm hover:opacity-90',
        subtle:
          'bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-900/40 dark:text-primary-200 dark:hover:bg-primary-900/60',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10 px-0',
        'icon-sm': 'h-8 w-8 px-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

type BaseProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { loading?: boolean }

// Compile-time enforcement: icon-sized buttons must have an aria-label.
type IconOnly = BaseProps & { size: 'icon' | 'icon-sm'; 'aria-label': string }
type Normal = BaseProps & { size?: Exclude<BaseProps['size'], 'icon' | 'icon-sm'> }
export type ButtonProps = IconOnly | Normal

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>
        {children}
      </span>
      {loading && (
        <Loader2 className="absolute inset-0 m-auto h-4 w-4 animate-spin" aria-hidden />
      )}
    </button>
  ),
)
Button.displayName = 'Button'
