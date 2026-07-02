import { gsap } from 'gsap'
import type { LogEntry, Side } from '@/types'
import { archetypeFor } from '@/lib/spellArchetype'
import type { PixiStage } from './PixiStage'
import { vfxColor } from './palette'
import * as FX from './effects'

/** Optional audio bus (Howler). Kept structural so choreograph doesn't hard-depend on it. */
export interface AudioLike {
  play: (cue: string) => void
}

export interface ChoreoOpts {
  entry: LogEntry
  /** Caster position in arena % (null for self/heal). */
  from?: { x: number; y: number } | null
  /** Target position in arena %. */
  to?: { x: number; y: number } | null
  /** Time budget for this event (ms) — the whole timeline is compressed to fit. */
  budgetMs: number
  reduced?: boolean
  audio?: AudioLike | null
  /** DOM-side reaction hook (bust squash/flash) fired at impact — keeps unit recoil out of Pixi. */
  onImpact?: (side: Side | undefined, kind: 'hit' | 'crit' | 'heal' | 'block' | 'dodge') => void
}

/**
 * Turn one combat LogEntry into a GSAP-choreographed burst of Pixi effects.
 * Pure presentation: reads only data the engine already emits (archetype,
 * flags, value). No camera shake — impact reads from the world's reaction.
 */
export function choreograph(stage: PixiStage, o: ChoreoOpts): gsap.core.Timeline | null {
  if (o.reduced) {
    // Reduced motion: no VFX, but still fire the DOM reaction + audio as instant cues.
    o.onImpact?.(o.entry.targetSide, reactionKind(o.entry))
    return null
  }

  const archetype = archetypeFor(o.entry)
  if (archetype === 'none') return null

  const color = vfxColor(archetype)
  const from = o.from ? stage.toPx(o.from) : null
  const to = o.to ? stage.toPx(o.to) : null
  const flags = o.entry.flags
  const crit = flags.includes('crit')
  const kill = flags.includes('kill')
  const dodge = flags.includes('dodge')
  const value = o.entry.value ?? 0
  const power = Math.min(1, value / 60)

  const tl = gsap.timeline()
  const ctx: FX.FxCtx = { stage, tl }
  let nominal = 0.9

  const side = o.entry.targetSide
  // Fire the DOM reaction + audio ON the timeline (at the real impact moment), not at build time.
  const at = (time: number, fn: () => void) => { tl.add(fn, time) }
  const dir = from && to ? Math.atan2(to.y - from.y, to.x - from.x) : 0

  if (archetype === 'heal' && to) {
    FX.fxRuneColumn(ctx, 0, to.x, to.y, color)
    at(0.15, () => { o.audio?.play('heal'); o.onImpact?.(side, 'heal') })
    nominal = 1.05
  } else if (archetype === 'shield' && to) {
    if (from) FX.fxSigil(ctx, 0.05, from.x, from.y, vfxColor('curse'), 0.26)
    if (from) FX.fxProjectile(ctx, from, to, vfxColor('curse'), { at: 0.2, arc: 26 })
    FX.fxHexBarrier(ctx, 0.5, to.x, to.y, color)
    FX.fxFlash(ctx, 0.6, to.x, to.y, color, 30)
    FX.fxBloomPulse(ctx, 0.6, 0.7, 0.4)
    FX.fxImpactSpray(ctx, 0.6, to.x, to.y, color.spark, 10, dir + Math.PI, 1.6, 48) // deflect back toward caster
    at(0.6, () => { o.audio?.play('shield'); o.onImpact?.(side, 'block') })
    nominal = 1.1
  } else if (dodge && to) {
    // Whiff: the bolt sails past; no impact FX, DOM does the sidestep.
    if (from) FX.fxSigil(ctx, 0.05, from.x, from.y, color, 0.24)
    if (from) FX.fxProjectile(ctx, from, to, color, { at: 0.2, arc: 18 })
    at(0.5, () => o.onImpact?.(side, 'dodge'))
    nominal = 0.78
  } else if (to) {
    // Telegraph: a rune sigil winds up at the caster before the bolt launches.
    if (from) { FX.fxSigil(ctx, 0, from.x, from.y, color, 0.3); at(0.08, () => o.audio?.play('cast')) }
    const launchAt = from ? 0.2 : 0
    const impactAt = from ? FX.fxProjectile(ctx, from, to, color, { at: launchAt, arc: archetype === 'dark' ? 46 : 34 }) : 0
    const spread = from ? 1.5 : Math.PI * 2

    if (crit || kill) FX.fxSlowmo(ctx, impactAt)
    FX.fxBloomPulse(ctx, impactAt, crit || kill ? 1.5 : 0.7, crit || kill ? 0.6 : 0.4)
    FX.fxFlash(ctx, impactAt, to.x, to.y, color, crit ? 48 : 34)
    FX.fxShockwave(ctx, impactAt, to.x, to.y, color, (crit ? 4.4 : 2.8) + power * 2.2, crit ? 4 : 3)
    if (crit || kill) FX.fxShockwave(ctx, impactAt + 0.06, to.x, to.y, color, (crit ? 3 : 2) + power, 2)
    FX.fxImpactSpray(ctx, impactAt, to.x, to.y, color.spark, Math.round((crit ? 22 : 12) + power * 12), dir, spread, crit ? 100 : 74)
    FX.fxDebris(ctx, impactAt, to.x, to.y, color.glow, crit ? 6 : 4, dir)
    if (archetype === 'fire') FX.fxFlames(ctx, impactAt, to.x, to.y, color)
    if (archetype === 'dark') FX.fxLightning(ctx, impactAt, to.x, to.y, color)
    if (archetype === 'stun') FX.fxStunRings(ctx, impactAt + 0.05, to.x, to.y, color)
    if (kill) FX.fxKill(ctx, impactAt + 0.1, to.x, to.y)
    at(impactAt, () => { o.audio?.play(crit || kill ? 'crit' : 'hit'); o.onImpact?.(side, crit || kill ? 'crit' : 'hit') })
    nominal = impactAt + (crit || kill ? 0.85 : 0.55)
  } else {
    return null
  }

  // Compress the whole timeline into the reveal budget (respects replay speed).
  const budgetSec = Math.max(0.4, o.budgetMs / 1000)
  tl.timeScale(Math.max(0.6, nominal / budgetSec))
  return tl
}

function reactionKind(entry: LogEntry): 'hit' | 'crit' | 'heal' | 'block' | 'dodge' {
  if (entry.flags.includes('heal')) return 'heal'
  if (entry.flags.includes('block')) return 'block'
  if (entry.flags.includes('dodge')) return 'dodge'
  if (entry.flags.includes('crit') || entry.flags.includes('kill')) return 'crit'
  return 'hit'
}
