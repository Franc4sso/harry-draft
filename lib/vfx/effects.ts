import { Container, Graphics } from 'pixi.js'
import { GlowFilter } from 'pixi-filters'
import { gsap } from 'gsap'
import type { PixiStage } from './PixiStage'
import type { VfxColor } from './palette'
import { GOLD, GOLD_DEEP, CRIMSON } from './palette'

/** A pixel-space point on the canvas. */
export type Px = { x: number; y: number }

/** Shared context threaded through every effect: the stage + the GSAP timeline being built. */
export interface FxCtx {
  stage: PixiStage
  tl: gsap.core.Timeline
}

function glow(color: number, distance = 14, outer = 2): GlowFilter {
  return new GlowFilter({ color, distance, outerStrength: outer, innerStrength: 0.4, quality: 0.25 })
}

function orb(radius: number, core: number, halo: number): Container {
  const c = new Container()
  const glowRing = new Graphics().circle(0, 0, radius * 1.9).fill({ color: halo, alpha: 0.3 })
  const body = new Graphics().circle(0, 0, radius).fill({ color: core, alpha: 1 })
  c.addChild(glowRing, body)
  c.filters = [glow(halo, 18, 2.2)]
  return c
}

/**
 * A glowing projectile flying caster→target along a shallow arc, leaving a
 * fading trail. Returns the timeline time (seconds) at which it reaches impact.
 */
export function fxProjectile(ctx: FxCtx, from: Px, to: Px, color: VfxColor, opts: { at?: number; arc?: number } = {}): number {
  const { stage, tl } = ctx
  const at = opts.at ?? 0
  const flight = 0.4
  const p = orb(8, color.core, color.glow)
  p.position.set(from.x, from.y)
  p.alpha = 0
  stage.fx.addChild(p)

  const midY = (from.y + to.y) / 2 - (opts.arc ?? 34)

  tl.to(p, { alpha: 1, duration: 0.08 }, at)
  tl.to(p.scale, { x: 1.25, y: 1.25, duration: flight, ease: 'none' }, at)
  tl.to(p.position, { x: to.x, duration: flight, ease: 'power1.in' }, at)
  tl.to(p.position, { y: midY, duration: flight / 2, ease: 'sine.out' }, at)
  tl.to(p.position, { y: to.y, duration: flight / 2, ease: 'sine.in' }, at + flight / 2)

  // Trail: a handful of fading ghost dots dropped along the path.
  const trailN = 6
  for (let i = 1; i <= trailN; i++) {
    const t = at + (flight * i) / (trailN + 1)
    const dot = new Graphics().circle(0, 0, 4).fill({ color: color.glow, alpha: 0.5 })
    dot.alpha = 0
    stage.fx.addChild(dot)
    // Snapshot the projectile position at the drop moment, then fade in place.
    tl.add(() => dot.position.set(p.position.x, p.position.y), t)
    tl.to(dot, { alpha: 0.5, duration: 0.02 }, t)
    tl.to(dot.scale, { x: 0.2, y: 0.2, duration: 0.35, ease: 'power1.in' }, t)
    tl.to(dot, { alpha: 0, duration: 0.35, ease: 'power1.in', onComplete: () => dot.destroy() }, t)
  }

  tl.to(p, { alpha: 0, duration: 0.08, onComplete: () => p.destroy() }, at + flight)
  return at + flight
}

/** A bright additive flash at the impact point. */
export function fxFlash(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor, size: number): void {
  const f = new Graphics().circle(0, 0, size).fill({ color: color.core, alpha: 0.95 })
  f.position.set(x, y)
  f.blendMode = 'add'
  f.scale.set(0.3)
  ctx.stage.fx.addChild(f)
  ctx.tl.to(f.scale, { x: 1, y: 1, duration: 0.12, ease: 'power2.out' }, at)
  ctx.tl.to(f, { alpha: 0, duration: 0.3, ease: 'power2.out', onComplete: () => f.destroy() }, at + 0.05)
}

/** Expanding ring — reads as a shockwave without moving the camera. `radius` is a scale multiple. */
export function fxShockwave(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor, radius: number): void {
  const base = 18
  const ring = new Graphics().circle(0, 0, base).stroke({ width: 3, color: color.glow, alpha: 0.9 })
  ring.position.set(x, y)
  ring.scale.set(0.2)
  ring.filters = [glow(color.glow, 12, 1.6)]
  ctx.stage.fx.addChild(ring)
  ctx.tl.to(ring.scale, { x: radius, y: radius, duration: 0.5, ease: 'expo.out' }, at)
  ctx.tl.to(ring, { alpha: 0, duration: 0.5, ease: 'power2.out', onComplete: () => ring.destroy() }, at)
}

/** Radiating particle burst at the impact point. */
export function fxBurst(ctx: FxCtx, at: number, x: number, y: number, colors: number[], count: number, spread: number): void {
  const { stage, tl } = ctx
  for (let i = 0; i < count; i++) {
    const col = colors[i % colors.length] ?? 0xffffff
    const p = new Graphics().circle(0, 0, 2 + Math.random() * 3).fill({ color: col })
    p.position.set(x, y)
    p.filters = [glow(col, 8, 1.4)]
    stage.fx.addChild(p)
    const ang = Math.random() * Math.PI * 2
    const dist = spread * (0.4 + Math.random() * 0.85)
    const dur = 0.5 + Math.random() * 0.3
    tl.to(p.position, { x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist, duration: dur, ease: 'power2.out' }, at)
    tl.to(p.scale, { x: 0, y: 0, duration: dur, ease: 'power1.in', onComplete: () => p.destroy() }, at)
  }
}

/** Rising heal sparkles anchored on the target, no projectile. */
export function fxHeal(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  for (let i = 0; i < 12; i++) {
    const col = color.spark[i % color.spark.length] ?? color.glow
    const p = new Graphics().circle(0, 0, 2 + Math.random() * 2.5).fill({ color: col })
    p.position.set(x + (Math.random() * 2 - 1) * 34, y + 32)
    p.filters = [glow(color.glow, 8, 1.4)]
    stage.fx.addChild(p)
    const t = at + i * 0.045
    tl.to(p.position, { y: y - 44, duration: 0.9, ease: 'power1.out' }, t)
    tl.to(p, { alpha: 0, duration: 0.9, ease: 'power1.in', onComplete: () => p.destroy() }, t)
  }
}

/** Protego dome around the defender, expanding then dissipating. */
export function fxDome(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const dome = new Graphics().circle(0, 0, 52).fill({ color: color.glow, alpha: 0.16 }).stroke({ width: 3, color: color.core, alpha: 0.9 })
  dome.position.set(x, y)
  dome.scale.set(0.5)
  dome.alpha = 0
  dome.filters = [glow(color.glow, 20, 2)]
  ctx.stage.fx.addChild(dome)
  ctx.tl.to(dome, { alpha: 1, duration: 0.14 }, at)
  ctx.tl.to(dome.scale, { x: 1, y: 1, duration: 0.35, ease: 'back.out(2)' }, at)
  ctx.tl.to(dome, { alpha: 0, duration: 0.4, ease: 'power2.in', onComplete: () => dome.destroy() }, at + 0.55)
}

/** Rings around the target — a stun burst. */
export function fxStunRings(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  for (let i = 0; i < 3; i++) {
    const r = new Graphics().circle(0, 0, 16 + i * 8).stroke({ width: 2, color: color.glow, alpha: 0.8 })
    r.position.set(x, y - 30)
    r.scale.set(0.4)
    r.filters = [glow(color.glow, 8, 1.2)]
    ctx.stage.fx.addChild(r)
    const t = at + i * 0.06
    ctx.tl.to(r.scale, { x: 1, y: 0.5, duration: 0.5, ease: 'power2.out' }, t)
    ctx.tl.to(r, { alpha: 0, duration: 0.5, onComplete: () => r.destroy() }, t)
  }
}

/**
 * A brief scene-wide dim behind the impact — implies slow-motion on a crit/kill
 * WITHOUT touching time or moving the camera. Added behind the burst so sparks pop.
 */
export function fxSlowmo(ctx: FxCtx, at: number): void {
  const { w, h } = ctx.stage.size()
  const v = new Graphics().rect(0, 0, w, h).fill({ color: 0x120a1e, alpha: 1 })
  v.alpha = 0
  ctx.stage.fx.addChildAt(v, 0)
  ctx.tl.to(v, { alpha: 0.38, duration: 0.12, ease: 'power2.out' }, at)
  ctx.tl.to(v, { alpha: 0, duration: 0.55, ease: 'power2.out', onComplete: () => v.destroy() }, at + 0.14)
}

/** Finisher flourish for a killing blow: gold+crimson shock + rising embers. */
export function fxKill(ctx: FxCtx, at: number, x: number, y: number): void {
  fxShockwave(ctx, at, x, y, { core: GOLD, glow: GOLD_DEEP, spark: [GOLD] }, 6.5)
  for (let i = 0; i < 16; i++) {
    const col = i % 2 ? GOLD : CRIMSON
    const e = new Graphics().circle(0, 0, 2 + Math.random() * 2).fill({ color: col })
    e.position.set(x + (Math.random() * 2 - 1) * 30, y)
    e.filters = [glow(col, 8, 1.4)]
    ctx.stage.fx.addChild(e)
    const t = at + Math.random() * 0.15
    ctx.tl.to(e.position, { y: y - 60 - Math.random() * 40, duration: 1, ease: 'power1.out' }, t)
    ctx.tl.to(e, { alpha: 0, duration: 1, ease: 'power1.in', onComplete: () => e.destroy() }, t)
  }
}
