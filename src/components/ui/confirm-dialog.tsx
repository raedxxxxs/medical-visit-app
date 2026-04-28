import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<ConfirmOptions>({ message: '' })
  const resolverRef = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setOpts(options)
      setOpen(true)
      resolverRef.current = resolve
    })
  }, [])

  const finish = (value: boolean) => {
    setOpen(false)
    resolverRef.current?.(value)
    resolverRef.current = null
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={open}
        onClose={() => finish(false)}
        title={opts.title ?? 'אישור פעולה'}
        className="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text">{opts.message}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => finish(false)}>
              {opts.cancelLabel ?? 'ביטול'}
            </Button>
            <Button
              variant={opts.danger ? 'danger' : 'default'}
              onClick={() => finish(true)}
              autoFocus
            >
              {opts.confirmLabel ?? 'אישור'}
            </Button>
          </div>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
