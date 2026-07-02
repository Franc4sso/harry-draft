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

  if (archetype === 'heal' && to) {
    FX.fxHeal(ctx, 0, to.x, to.y, color)
    at(0.1, () => { o.audio?.play('heal'); o.onImpact?.(side, 'heal') })
    nominal = 1.0
  } else if (archetype === 'shield' && to) {
    if (from) FX.fxProjectile(ctx, from, to, vfxColor('curse'), { at: 0, arc: 28 })
    FX.fxDome(ctx, 0.3, to.x, to.y, color)
    FX.fxBurst(ctx, 0.42, to.x, to.y, color.spark, 8, 46)
    at(0.42, () => { o.audio?.play('shield'); o.onImpact?.(side, 'block') })
    nominal = 0.95
  } else if (dodge && to) {
    // Whiff: the bolt sails past; no impact FX, DOM does the sidestep.
    if (from) FX.fxProjectile(ctx, from, { x: to.x, y: to.y }, color, { at: 0, arc: 20 })
    at(0.32, () => o.onImpact?.(side, 'dodge'))
    nominal = 0.6
  } else if (to) {
    if (from) at(0, () => o.audio?.play('cast'))
    const impactAt = from ? FX.fxProjectile(ctx, from, to, color, { at: 0, arc: archetype === 'dark' ? 46 : 34 }) : 0
    if (crit || kill) FX.fxSlowmo(ctx, impactAt)
    FX.fxFlash(ctx, impactAt, to.x, to.y, color, crit ? 46 : 34)
    FX.fxShockwave(ctx, impactAt, to.x, to.y, color, (crit ? 4.2 : 2.6) + power * 2.2)
    FX.fxBurst(ctx, impactAt, to.x, to.y, color.spark, Math.round((crit ? 18 : 10) + power * 10), crit ? 92 : 64)
    if (archetype === 'stun') FX.fxStunRings(ctx, impactAt + 0.05, to.x, to.y, color)
    if (kill) FX.fxKill(ctx, impactAt + 0.1, to.x, to.y)
    at(impactAt, () => { o.audio?.play(crit || kill ? 'crit' : 'hit'); o.onImpact?.(side, crit || kill ? 'crit' : 'hit') })
    nominal = impactAt + (crit || kill ? 0.75 : 0.5)
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
