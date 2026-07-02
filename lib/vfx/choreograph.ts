import { gsap } from 'gsap'
import type { LogEntry, Side } from '@/types'
import { archetypeFor } from '@/lib/spellArchetype'
import type { PixiStage } from './PixiStage'
import { vfxColor } from './palette'
import * as FX from './effects'
import * as Screen from './screen'
import { spellVfxFor, defaultConfig, runFlourish } from './spellVfx'

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
  /** DOM-side full-screen colour wash for tier-3 ultimates. */
  onScreen?: (color: number) => void
}

/**
 * Turn one combat LogEntry into a GSAP-choreographed burst of Pixi effects.
 * Resolves a PER-SPELL signature (by action name) with an archetype fallback,
 * so every named move has its own look. Power tier drives cinematic screen
 * effects. Pure presentation; no camera shake.
 */
export function choreograph(stage: PixiStage, o: ChoreoOpts): gsap.core.Timeline | null {
  const side = o.entry.targetSide
  if (o.reduced) {
    o.onImpact?.(side, reactionKind(o.entry))
    return null
  }

  const cfg = spellVfxFor(o.entry.action) ?? defaultConfig(archetypeFor(o.entry))
  if (!cfg) return null
  const tier = cfg.tier ?? 1

  const from = o.from ? stage.toPx(o.from) : null
  const to = o.to ? stage.toPx(o.to) : null
  const flags = o.entry.flags
  const crit = flags.includes('crit')
  const kill = flags.includes('kill')
  const dodge = flags.includes('dodge')
  const block = flags.includes('block')
  const power = Math.min(1, (o.entry.value ?? 0) / 60)
  const dir = from && to ? Math.atan2(to.y - from.y, to.x - from.x) : 0

  const tl = gsap.timeline()
  const ctx: FX.FxCtx = { stage, tl }
  const at = (time: number, fn: () => void) => { tl.add(fn, time) }
  let nominal = 0.9

  if (cfg.kind === 'heal' && to) {
    runFlourish(ctx, 'heal', 0, to.x, to.y, cfg.color, { dir, power, crit })
    if (tier >= 2) { Screen.fxGodrays(ctx, 0.1, 0.6, 0.4); FX.fxBloomPulse(ctx, 0.1, 0.8, 0.5) }
    at(0.15, () => { o.audio?.play(cfg.audioHit ?? 'heal'); o.onImpact?.(side, 'heal') })
    nominal = tier >= 2 ? 1.2 : 1.05
  } else if (cfg.kind === 'self' && to) {
    if (cfg.sigil !== false) FX.fxSigil(ctx, 0, to.x, to.y, cfg.color, tier >= 3 ? 0.42 : 0.3)
    const flourAt = cfg.sigil !== false ? 0.2 : 0.05
    FX.fxBloomPulse(ctx, flourAt, tier >= 3 ? 1.4 : 0.7, 0.45)
    runFlourish(ctx, cfg.impact, flourAt, to.x, to.y, cfg.color, { dir, power, crit })
    if (tier >= 3) {
      Screen.fxGodrays(ctx, flourAt, 0.8, 0.55)
      Screen.fxZoomPunch(ctx, flourAt, to.x, to.y, 0.4)
      if (cfg.screen != null) { Screen.fxScreenFlash(ctx, flourAt, cfg.screen); o.onScreen?.(cfg.screen) }
    }
    at(flourAt, () => { o.audio?.play(cfg.audioHit ?? 'shield'); o.onImpact?.(side, cfg.impact === 'hex' ? 'block' : 'heal') })
    nominal = tier >= 3 ? 1.25 : 1.0
  } else if (cfg.kind === 'projectile' && to) {
    if (dodge) {
      if (from) { FX.fxSigil(ctx, 0.05, from.x, from.y, cfg.color, 0.24); FX.fxProjectile(ctx, from, to, cfg.color, { at: 0.2, arc: 18 }) }
      at(0.5, () => o.onImpact?.(side, 'dodge'))
      nominal = 0.78
    } else {
      // Charge-up: a stronger, longer sigil for high-tier spells.
      if (from && cfg.sigil !== false) FX.fxSigil(ctx, 0, from.x, from.y, cfg.color, tier >= 2 ? 0.36 : 0.3)
      if (from) at(0.08, () => o.audio?.play(cfg.audioCast ?? 'cast'))
      const arc = cfg.motion === 'lob' ? 58 : cfg.motion === 'orb' ? 46 : 30
      const flight = cfg.motion === 'bolt' ? 0.36 : 0.44
      const launchAt = from ? (tier >= 2 ? 0.24 : 0.2) : 0
      const impactAt = from ? FX.fxProjectile(ctx, from, to, cfg.color, { at: launchAt, arc, flight }) : 0

      if (block) {
        FX.fxHexBarrier(ctx, impactAt, to.x, to.y, vfxColor('shield'))
        FX.fxBloomPulse(ctx, impactAt, 0.7, 0.4)
        at(impactAt, () => { o.audio?.play('shield'); o.onImpact?.(side, 'block') })
      } else {
        if (crit || kill) FX.fxSlowmo(ctx, impactAt)
        FX.fxBloomPulse(ctx, impactAt, crit || kill || tier >= 3 ? 1.6 : tier >= 2 ? 1.0 : 0.7, 0.5)
        runFlourish(ctx, cfg.impact, impactAt, to.x, to.y, cfg.color, { dir, power, crit })
        FX.fxPhysicsBurst(ctx, impactAt, to.x, to.y, cfg.color.spark, tier >= 2 ? 18 : 10, { speed: 270, gravity: 520 })
        if (tier >= 2) Screen.fxZoomPunch(ctx, impactAt, to.x, to.y, tier >= 3 ? 0.62 : 0.42)
        if (tier >= 3) {
          Screen.fxGodrays(ctx, impactAt, 0.7, 0.5)
          FX.fxSmoke(ctx, impactAt, to.x, to.y, 8)
          if (cfg.screen != null) { Screen.fxScreenFlash(ctx, impactAt, cfg.screen); o.onScreen?.(cfg.screen) }
        }
        if (kill) FX.fxKill(ctx, impactAt + 0.1, to.x, to.y)
        at(impactAt, () => { o.audio?.play(cfg.audioHit ?? (crit || kill ? 'crit' : 'hit')); o.onImpact?.(side, crit || kill ? 'crit' : 'hit') })
      }
      nominal = impactAt + (tier >= 3 ? 1.1 : crit || kill || tier >= 2 ? 0.85 : 0.55)
    }
  } else {
    return null
  }

  const budgetSec = Math.max(0.4, o.budgetMs / 1000)
  tl.timeScale(Math.max(0.55, nominal / budgetSec))
  return tl
}

function reactionKind(entry: LogEntry): 'hit' | 'crit' | 'heal' | 'block' | 'dodge' {
  if (entry.flags.includes('heal')) return 'heal'
  if (entry.flags.includes('block')) return 'block'
  if (entry.flags.includes('dodge')) return 'dodge'
  if (entry.flags.includes('crit') || entry.flags.includes('kill')) return 'crit'
  return 'hit'
}
