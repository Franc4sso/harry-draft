import type { Role } from '@/types'
import { roleIconName } from '@/lib/theme'
import { Swords, Shield, Heart, Wand2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ICONS: Record<'Swords' | 'Shield' | 'Heart' | 'Wand2', LucideIcon> = {
  Swords,
  Shield,
  Heart,
  Wand2,
}

export function RoleIcon({ role, size = 16, className }: { role: Role; size?: number; className?: string }) {
  const Icon = ICONS[roleIconName(role)]
  return <Icon size={size} className={className} aria-label={role} />
}
