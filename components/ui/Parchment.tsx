import { cn } from '@/lib/cn'

export function Parchment({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={cn('parchment', className)}>{children}</div>
}
