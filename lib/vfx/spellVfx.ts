import type { SpellArchetype } from '@/lib/spellArchetype'
import type { VfxColor } from './palette'
import { vfxColor } from './palette'
import * as FX from './effects'
import type { FxCtx } from './effects'

/** The impact/self signature an effect resolves to. */
export type Flourish =
  | 'burst' | 'explosion' | 'flames' | 'fiendfyre' | 'slash' | 'skull' | 'avada' | 'ice' | 'snake'
  | 'lightning' | 'stun' | 'lift' | 'swirl' | 'patronus' | 'hex' | 'buff' | 'heal'
  | 'disarm' | 'volley' | 'shove' | 'stone' | 'confusion' | 'silence' | 'dance'
  | 'mind' | 'revive' | 'bubbles' | 'bandage' | 'wall' | 'absorb' | 'rally' | 'wind'

export type Motion = 'bolt' | 'orb' | 'lob'

export interface SpellVfxConfig {
  kind: 'projectile' | 'self' | 'heal'
  color: VfxColor
  motion?: Motion
  /** Show the caster wind-up rune sigil (default true for projectiles). */
  sigil?: boolean
  /** What happens at the target (projectile) or caster (self). */
  impact: Flourish
  /** Power tier: 2/3 unlock cinematic screen effects (zoom-punch, god rays, screen flash). */
  tier?: 1 | 2 | 3
  /** Full-screen additive colour wash on a tier-3 impact ("the screen goes green"). */
  screen?: number
  audioCast?: string
  audioHit?: string
}

/* ---- spell colour identities (beyond the 8 archetype colours) ---- */
const C = {
  gold: { core: 0xf6e6a8, glow: 0xcaa24a, spark: [0xf6e6a8, 0xcaa24a] },
  concussive: { core: 0xfff2d8, glow: 0xffd37d, spark: [0xffd37d, 0xffffff] },
  green: { core: 0x9dff9f, glow: 0x2ecc40, spark: [0x2ecc40, 0xbfffb0] },
  venom: { core: 0xbdf06a, glow: 0x6fae2e, spark: [0xa9de5c, 0x6fae2e, 0x3a5a10] },
  crimson: { core: 0xff8a5a, glow: 0xe0402a, spark: [0xe05a4a, 0xff3b1a, 0xffcaba] },
  darkCrimson: { core: 0xff6a5a, glow: 0x8a1420, spark: [0xe05a4a, 0x7a1f1f, 0xffcaba] },
  fire: vfxColor('fire'),
  cursedFire: { core: 0xffb04a, glow: 0x7a1f8a, spark: [0xff9d3c, 0xa855f7, 0x2a0a06] },
  ice: { core: 0xd6f0ff, glow: 0x5ab6ff, spark: [0x9fd8ff, 0xffffff, 0x5ab6ff] },
  dark: vfxColor('dark'),
  purple: { core: 0xd8b4fe, glow: 0x9a4bff, spark: [0x9a4bff, 0xd8b4fe] },
  teal: { core: 0x7ff0e0, glow: 0x2fbfa8, spark: [0x2fbfa8, 0xbff7ee] },
  yellow: { core: 0xfff3a0, glow: 0xfde047, spark: [0xfde047, 0xfff3b0] },
  silver: { core: 0xffffff, glow: 0xbfe0ff, spark: [0xffffff, 0xdaf0ff, 0xbfe0ff] },
  bone: { core: 0xf2f2f2, glow: 0xbfc4cc, spark: [0xdfe4ea, 0xffffff] },
  shield: vfxColor('shield'),
  heal: vfxColor('heal'),
  beam: vfxColor('beam'),
} satisfies Record<string, VfxColor>

/** Per-spell registry, keyed by the LogEntry.action display name (lowercased). */
const SPELL_VFX: Record<string, SpellVfxConfig> = {
  // ── Attacco ──
  'colpo base': { kind: 'projectile', color: C.gold, motion: 'bolt', sigil: false, impact: 'burst' },
  'expelliarmus': { kind: 'projectile', color: C.gold, motion: 'bolt', impact: 'disarm' },
  'stupeficium': { kind: 'projectile', color: C.crimson, motion: 'bolt', impact: 'stun' },
  'sectumsempra': { kind: 'projectile', color: C.darkCrimson, motion: 'bolt', impact: 'slash', tier: 2 },
  'bombarda': { kind: 'projectile', color: C.concussive, motion: 'lob', impact: 'explosion', tier: 2 },
  'incendio': { kind: 'projectile', color: C.fire, motion: 'lob', impact: 'flames' },
  'avada kedavra': { kind: 'projectile', color: C.green, motion: 'orb', impact: 'avada', tier: 3, screen: 0x2ecc40 },
  'reducto': { kind: 'projectile', color: C.concussive, motion: 'bolt', impact: 'explosion', tier: 2 },
  'diffindo': { kind: 'projectile', color: C.silver, motion: 'bolt', sigil: false, impact: 'slash' },
  'confringo': { kind: 'projectile', color: C.fire, motion: 'lob', impact: 'explosion', tier: 2 },
  'flipendo': { kind: 'projectile', color: C.concussive, motion: 'bolt', sigil: false, impact: 'shove' },
  'oppugno': { kind: 'projectile', color: C.gold, motion: 'bolt', sigil: false, impact: 'volley' },
  'ardemonio': { kind: 'projectile', color: C.cursedFire, motion: 'orb', impact: 'fiendfyre', tier: 3, screen: 0xff6a2a },
  'serpensortia': { kind: 'projectile', color: C.venom, motion: 'lob', impact: 'snake' },

  // ── Controllo ──
  'crucio': { kind: 'projectile', color: C.crimson, motion: 'bolt', impact: 'lightning', tier: 2 },
  'imperio': { kind: 'projectile', color: C.purple, motion: 'orb', impact: 'mind' },
  'petrificus totalus': { kind: 'projectile', color: C.bone, motion: 'bolt', impact: 'stone' },
  'levicorpus': { kind: 'projectile', color: C.purple, motion: 'bolt', impact: 'lift' },
  'confundo': { kind: 'projectile', color: C.teal, motion: 'orb', impact: 'confusion' },
  'langlock': { kind: 'projectile', color: C.dark, motion: 'bolt', sigil: false, impact: 'silence' },
  'tarantallegra': { kind: 'projectile', color: C.yellow, motion: 'bolt', impact: 'dance' },
  'glacius': { kind: 'projectile', color: C.ice, motion: 'bolt', impact: 'ice' },
  'silencio': { kind: 'projectile', color: C.purple, motion: 'bolt', impact: 'silence' },

  // ── Cura ──
  'episkey': { kind: 'heal', color: C.heal, impact: 'heal' },
  'vulnera sanentur': { kind: 'heal', color: C.heal, impact: 'heal', tier: 2 },
  'rennervate': { kind: 'heal', color: C.heal, impact: 'revive' },
  'anapneo': { kind: 'heal', color: C.heal, impact: 'bubbles' },
  'ferula': { kind: 'heal', color: C.heal, impact: 'bandage' },
  'colletivo scudo': { kind: 'self', color: C.gold, sigil: true, impact: 'buff' },
  'incitamento': { kind: 'self', color: C.gold, sigil: true, impact: 'rally' },

  // ── Difesa ──
  'protego': { kind: 'self', color: C.shield, sigil: true, impact: 'hex' },
  'protego maxima': { kind: 'self', color: C.shield, sigil: true, impact: 'hex' },
  'fianto duri': { kind: 'self', color: C.shield, sigil: true, impact: 'wall' },
  'salvio hexia': { kind: 'self', color: C.silver, sigil: true, impact: 'wind' },
  'riddikulus': { kind: 'self', color: C.gold, sigil: true, impact: 'rally' },
  'expecto patronum': { kind: 'self', color: C.silver, sigil: true, impact: 'patronus', tier: 3, screen: 0xdaf0ff },
  'aegis': { kind: 'self', color: C.shield, sigil: true, impact: 'absorb' },
}

export function spellVfxFor(action: string): SpellVfxConfig | null {
  return SPELL_VFX[action.trim().toLowerCase()] ?? null
}

/** Fallback for entries with no bespoke spell (signature procs, unknown actions). */
export function defaultConfig(a: SpellArchetype): SpellVfxConfig | null {
  switch (a) {
    case 'heal': return { kind: 'heal', color: C.heal, impact: 'heal' }
    case 'shield': return { kind: 'self', color: C.shield, sigil: true, impact: 'hex' }
    case 'dark': return { kind: 'projectile', color: C.dark, motion: 'orb', impact: 'lightning' }
    case 'fire': return { kind: 'projectile', color: C.fire, motion: 'lob', impact: 'flames' }
    case 'stun': return { kind: 'projectile', color: C.yellow, motion: 'bolt', impact: 'stun' }
    case 'disarm': return { kind: 'projectile', color: C.gold, motion: 'bolt', impact: 'burst' }
    case 'curse': return { kind: 'projectile', color: C.crimson, motion: 'bolt', impact: 'burst' }
    case 'beam': return { kind: 'projectile', color: C.beam, motion: 'bolt', impact: 'burst' }
    default: return null
  }
}

/** Dispatch a flourish key to its effect(s). Each case is self-contained. */
export function runFlourish(ctx: FxCtx, key: Flourish, at: number, x: number, y: number, color: VfxColor, opts: { dir: number; power: number; crit: boolean }): void {
  const { dir, power, crit } = opts
  switch (key) {
    case 'explosion': FX.fxExplosion(ctx, at, x, y, color); break
    case 'slash': FX.fxSlash(ctx, at, x, y, color); FX.fxShockwave(ctx, at, x, y, color, 2.4, 2); break
    case 'skull': FX.fxSkull(ctx, at, x, y); break
    case 'avada': FX.fxAvada(ctx, at, x, y, dir); break
    case 'ice': FX.fxIceShards(ctx, at, x, y, color); break
    case 'snake': FX.fxSnake(ctx, at, x, y, color); break
    case 'flames': FX.fxFlash(ctx, at, x, y, color, 34); FX.fxShockwave(ctx, at, x, y, color, 2.6, 3); FX.fxFlames(ctx, at, x, y, color); break
    case 'fiendfyre': FX.fxFiendfyre(ctx, at, x, y, color, dir); break
    case 'lightning': FX.fxFlash(ctx, at, x, y, color, 36); FX.fxLightning(ctx, at, x, y, color); FX.fxShockwave(ctx, at, x, y, color, 2.6, 2); break
    case 'stun': FX.fxFlash(ctx, at, x, y, color, 34); FX.fxStunRings(ctx, at, x, y, color); FX.fxShockwave(ctx, at, x, y, color, 2.4, 2); break
    case 'lift': FX.fxLift(ctx, at, x, y, color); break
    case 'swirl': FX.fxSwirl(ctx, at, x, y, color); break
    case 'patronus': FX.fxPatronus(ctx, at, x, y); break
    case 'hex': FX.fxHexBarrier(ctx, at, x, y, color); break
    case 'buff': FX.fxBuffAura(ctx, at, x, y, color); break
    case 'heal': FX.fxRuneColumn(ctx, at, x, y, color); break
    case 'disarm': FX.fxDisarm(ctx, at, x, y, color); break
    case 'volley': FX.fxVolley(ctx, at, x, y, color); break
    case 'shove': FX.fxShove(ctx, at, x, y, color, dir); break
    case 'stone': FX.fxStone(ctx, at, x, y); break
    case 'confusion': FX.fxFlash(ctx, at, x, y, color, 26); FX.fxConfusion(ctx, at, x, y, color); break
    case 'silence': FX.fxSilence(ctx, at, x, y, color); break
    case 'dance': FX.fxFlash(ctx, at, x, y, color, 24); FX.fxDance(ctx, at, x, y, color); break
    case 'mind': FX.fxFlash(ctx, at, x, y, color, 26); FX.fxMind(ctx, at, x, y, color); break
    case 'revive': FX.fxRevive(ctx, at, x, y, color); break
    case 'bubbles': FX.fxBubbles(ctx, at, x, y, color); break
    case 'bandage': FX.fxBandage(ctx, at, x, y, color); break
    case 'wall': FX.fxWall(ctx, at, x, y, color); break
    case 'absorb': FX.fxAbsorb(ctx, at, x, y, color); break
    case 'rally': FX.fxRally(ctx, at, x, y, color); break
    case 'wind': FX.fxWind(ctx, at, x, y, color); break
    case 'burst':
    default: FX.fxBurstImpact(ctx, at, x, y, color, dir, power, crit)
  }
}
