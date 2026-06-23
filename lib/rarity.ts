import type { Tier } from '@/types'
import { tierLabel, tierColor } from '@/lib/theme'

export interface RarityStyle {
  tier: Tier
  label: string
  color: string
  borderColor: string
  glow: number
  hasGem: boolean
  hasCrown: boolean
  animated: boolean
  bgGradient: string
}

const GLOW: Record<Tier, number> = { 4: 0, 3: 0.4, 2: 0.7, 1: 1 }

const BG: Record<Tier, string> = {
  4: 'linear-gradient(160deg, #15131d 0%, #0e0c16 100%)',
  3: 'radial-gradient(120% 70% at 50% -10%, #16223a 0%, #0c0f1c 80%)',
  2: 'radial-gradient(120% 70% at 50% -10%, #241640 0%, #0e0a1c 80%)',
  1: 'radial-gradient(120% 75% at 50% -10%, #2a2212 0%, #100b06 78%)',
}

export function rarityStyle(tier: Tier): RarityStyle {
  const color = tierColor(tier)
  return {
    tier,
    label: tierLabel(tier),
    color,
    borderColor: tier === 1 ? '#caa24a' : color,
    glow: GLOW[tier],
    hasGem: tier <= 3,
    hasCrown: tier === 1,
    animated: tier === 1,
    bgGradient: BG[tier],
  }
}
