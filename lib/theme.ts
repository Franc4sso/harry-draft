import type { House, Role, Tier } from '@/types'
import { HOUSES } from '@/data/houses'

export { cn } from './cn'

export function houseTheme(house: House): { color: string; glow: string; gradient: string; ring: string } {
  const { color, glow } = HOUSES[house]
  return {
    color,
    glow,
    gradient: `linear-gradient(160deg, ${color} 0%, ${color}cc 45%, #0b0e14 100%)`,
    ring: `0 0 24px ${glow}66, 0 0 2px ${glow}aa`,
  }
}

export function roleIconName(role: Role): 'Swords' | 'Shield' | 'Heart' | 'Wand2' {
  switch (role) {
    case 'Attaccante': return 'Swords'
    case 'Tank': return 'Shield'
    case 'Supporto': return 'Heart'
    case 'Controllo': return 'Wand2'
  }
}

const TIER_LABELS: Record<Tier, string> = { 1: 'Leggendario', 2: 'Epico', 3: 'Raro', 4: 'Comune' }
const TIER_COLORS: Record<Tier, string> = { 1: '#ffd34d', 2: '#b06bff', 3: '#4da6ff', 4: '#9aa3ad' }

export function tierLabel(tier: Tier): string {
  return TIER_LABELS[tier]
}

export function tierColor(tier: Tier): string {
  return TIER_COLORS[tier]
}
