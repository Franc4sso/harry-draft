import type { SpellArchetype } from '@/lib/spellArchetype'

/**
 * VFX colors for the Pixi layer, derived from lib/spellArchetype but expressed
 * as numeric hex (Pixi wants numbers) and enriched with a spark palette per
 * archetype. Warm-tuned to sit inside the Sala Comune identity.
 */
export interface VfxColor {
  /** Bright core of the projectile/flash. */
  core: number
  /** Outer glow / trail. */
  glow: number
  /** Particle colors for impact bursts. */
  spark: number[]
}

export const GOLD = 0xf6e6a8
export const GOLD_DEEP = 0xcaa24a
export const CRIMSON = 0xe05a4a

const PALETTE: Record<Exclude<SpellArchetype, 'none'>, VfxColor> = {
  beam:   { core: 0x9bffb4, glow: 0x7cfc9b, spark: [0x7cfc9b, 0xf6e6a8] },
  curse:  { core: 0xff9a9a, glow: 0xff6b6b, spark: [0xff6b6b, 0xff3b3b, 0xffd27d] },
  fire:   { core: 0xffc46a, glow: 0xff9d3c, spark: [0xff9d3c, 0xffd27d, 0xff5a2a] },
  dark:   { core: 0xc79bff, glow: 0xa855f7, spark: [0xa855f7, 0xd8b4fe, 0x5b21b6] },
  shield: { core: 0xcfeaff, glow: 0x7dd3fc, spark: [0x7dd3fc, 0xcfeeff] },
  heal:   { core: 0xb6f5cd, glow: 0x37b26b, spark: [0x79e6a0, 0xd7ffe6, 0xf6e6a8] },
  stun:   { core: 0xfff3a0, glow: 0xfde047, spark: [0xfde047, 0xfff3b0] },
  disarm: { core: 0xf3d888, glow: 0xcaa24a, spark: [0xcaa24a, 0xf6e6a8] },
}

const NONE_COLOR: VfxColor = { core: 0xffffff, glow: 0xffffff, spark: [0xffffff] }

export function vfxColor(a: SpellArchetype): VfxColor {
  return a === 'none' ? NONE_COLOR : PALETTE[a]
}
