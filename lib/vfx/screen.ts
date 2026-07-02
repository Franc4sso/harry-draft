import { ZoomBlurFilter, GodrayFilter } from 'pixi-filters'
import { Graphics, Rectangle } from 'pixi.js'
import type { FxCtx } from './effects'

/**
 * Screen-space cinematic punches for the strongest spells, using the pixi-filters
 * suite applied temporarily to the whole fx layer. Every function is defensive:
 * if a filter API mismatches it no-ops rather than breaking the timeline.
 */

function asArr(f: unknown): unknown[] {
  return Array.isArray(f) ? f.slice() : f ? [f] : []
}
function attach(stage: FxCtx['stage'], filter: unknown): () => void {
  try {
    const { w, h } = stage.size()
    stage.fx.filterArea = new Rectangle(0, 0, w, h)
    stage.fx.filters = [...asArr(stage.fx.filters), filter] as never
  } catch { /* filter unsupported */ }
  return () => {
    try { stage.fx.filters = asArr(stage.fx.filters).filter((x) => x !== filter) as never } catch { /* noop */ }
  }
}

/** Radial punch-zoom centred on the impact — a hit that "kicks" without moving the camera. */
export function fxZoomPunch(ctx: FxCtx, at: number, x: number, y: number, strength = 0.5, dur = 0.45): void {
  let f: ZoomBlurFilter
  try { f = new ZoomBlurFilter({ strength: 0, center: [x, y], innerRadius: 44, radius: -1 }) } catch { return }
  const rm = attach(ctx.stage, f)
  ctx.tl.to(f, { strength, duration: 0.09, ease: 'power2.out' }, at)
  ctx.tl.to(f, { strength: 0, duration: dur, ease: 'power2.out', onComplete: rm }, at + 0.09)
}

/** Volumetric god rays — for Avada Kedavra and Expecto Patronum. */
export function fxGodrays(ctx: FxCtx, at: number, dur = 0.7, gain = 0.5): void {
  let f: GodrayFilter
  try { f = new GodrayFilter({ gain: 0, lacunarity: 2.6, alpha: 0, time: 0 }) } catch { return }
  const rm = attach(ctx.stage, f)
  const p = { t: 0 }
  ctx.tl.to(f, { gain, alpha: 0.65, duration: 0.15, ease: 'power2.out' }, at)
  ctx.tl.to(p, { t: 1.4, duration: dur, ease: 'none', onUpdate: () => { try { f.time = p.t } catch { /* noop */ } } }, at)
  ctx.tl.to(f, { gain: 0, alpha: 0, duration: dur * 0.6, ease: 'power2.in', onComplete: rm }, at + dur * 0.45)
}

/** A full-canvas additive colour wash — the "the screen goes green" beat for ultimates. */
export function fxScreenFlash(ctx: FxCtx, at: number, color: number, alpha = 0.42, dur = 0.42): void {
  const { w, h } = ctx.stage.size()
  const g = new Graphics().rect(0, 0, w, h).fill({ color, alpha: 1 })
  g.alpha = 0
  g.blendMode = 'add'
  ctx.stage.fx.addChildAt(g, 0)
  ctx.tl.to(g, { alpha, duration: 0.08, ease: 'power2.out' }, at)
  ctx.tl.to(g, { alpha: 0, duration: dur, ease: 'power2.out', onComplete: () => g.destroy() }, at + 0.08)
}
