import * as Icons from 'lucide-react'
import type { IconName } from '@/lib/glossary'
import { cn } from '@/lib/cn'

export function Chip({
  label, color, icon, size = 'sm', className,
}: {
  label: string
  color: string
  icon?: IconName
  size?: 'sm' | 'md'
  className?: string
}) {
  const Icon = icon ? (Icons[icon] as React.ComponentType<{ size?: number }>) : null
  const px = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs'
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full border font-medium', px, className)}
      style={{ color, borderColor: `${color}55`, background: `${color}14`, boxShadow: `0 0 12px ${color}22` }}
    >
      {Icon ? <Icon size={size === 'md' ? 14 : 12} /> : null}
      {label}
    </span>
  )
}
