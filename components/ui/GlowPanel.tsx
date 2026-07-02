import { cn } from '@/lib/cn'

interface GlowPanelProps {
  children: React.ReactNode
  className?: string
  glow?: string
}

export function GlowPanel({ children, className, glow }: GlowPanelProps) {
  return (
    <div
      className={cn('panel-premium rounded-2xl', className)}
      style={
        glow
          ? {
              boxShadow: `0 1px 0 rgba(255,255,255,0.06) inset, 0 -12px 32px -18px rgba(202,162,74,0.18) inset, 0 18px 40px -18px rgba(0,0,0,0.7), 0 0 32px ${glow}33`,
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}
