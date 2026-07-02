import { cn } from '@/lib/cn'

type Variant = 'panel' | 'card' | 'round'

export function Frame({
  children, variant = 'panel', className, innerClassName, ...rest
}: {
  children: React.ReactNode
  variant?: Variant
  className?: string
  innerClassName?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  const radius = variant === 'round' ? 'rounded-full [&>.frame-inner]:rounded-full' : ''
  return (
    <div {...rest} className={cn('frame-thick', radius, className)}>
      <div className={cn('frame-inner h-full w-full', innerClassName)}>{children}</div>
    </div>
  )
}
