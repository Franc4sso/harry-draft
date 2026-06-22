import { cn } from '@/lib/cn'

interface GlowPanelProps {
  children: React.ReactNode
  className?: string
  glow?: string
}

export function GlowPanel({ children, className, glow }: GlowPanelProps) {
  return (
    <div
      className={cn('glass rounded-2xl', className)}
      style={glow ? { boxShadow: `0 0 32px ${glow}33` } : undefined}
    >
      {children}
    </div>
  )
}
