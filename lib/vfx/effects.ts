import { Container, Graphics } from 'pixi.js'
import { GlowFilter } from 'pixi-filters'
import { gsap } from 'gsap'
import './gsapSetup' // registers Physics2D/CustomWiggle (side effect)
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
  const glowRing = new Graphics().circle(0, 0, radius * 2).fill({ color: halo, alpha: 0.3 })
  const body = new Graphics().circle(0, 0, radius).fill({ color: core, alpha: 1 })
  const spec = new Graphics().circle(-radius * 0.3, -radius * 0.3, radius * 0.4).fill({ color: 0xffffff, alpha: 0.8 })
  c.addChild(glowRing, body, spec)
  c.filters = [glow(halo, 20, 2.4)]
  return c
}

/* ------------------------------------------------------------------ */
/* Screen-wide juice                                                   */
/* ------------------------------------------------------------------ */

/** Kick the bloom intensity up and let it settle — a light bloom "pop" on impact. */
export function fxBloomPulse(ctx: FxCtx, at: number, amount: number, dur: number): void {
  const b = ctx.stage.bloom
  const base = ctx.stage.bloomBase
  ctx.tl.to(b, { bloomScale: base + amount, duration: 0.08, ease: 'power2.out' }, at)
  ctx.tl.to(b, { bloomScale: base, duration: dur, ease: 'power2.out' }, at + 0.08)
}

/**
 * A brief scene-wide dim behind the impact — implies slow-motion on a crit/kill
 * WITHOUT touching time or moving the camera. Added behind everything so sparks pop.
 */
export function fxSlowmo(ctx: FxCtx, at: number): void {
  const { w, h } = ctx.stage.size()
  const v = new Graphics().rect(0, 0, w, h).fill({ color: 0x0a0612, alpha: 1 })
  v.alpha = 0
  ctx.stage.fx.addChildAt(v, 0)
  ctx.tl.to(v, { alpha: 0.42, duration: 0.12, ease: 'power2.out' }, at)
  ctx.tl.to(v, { alpha: 0, duration: 0.6, ease: 'power2.out', onComplete: () => v.destroy() }, at + 0.14)
}

/* ------------------------------------------------------------------ */
/* Casting                                                             */
/* ------------------------------------------------------------------ */

/** A rotating rune sigil that blooms under/at the caster — the wind-up telegraph. */
export function fxSigil(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor, dur = 0.4): void {
  const s = new Container()
  s.position.set(x, y)

  const outer = new Graphics().circle(0, 0, 34).stroke({ width: 2, color: color.glow, alpha: 0.85 })
  const inner = new Graphics().circle(0, 0, 22).stroke({ width: 1, color: color.core, alpha: 0.7 })
  const ticks = new Graphics()
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI / 6) * i
    ticks.moveTo(Math.cos(a) * 24, Math.sin(a) * 24).lineTo(Math.cos(a) * 34, Math.sin(a) * 34)
  }
  ticks.stroke({ width: 1, color: color.glow, alpha: 0.55 })
  const tri = new Graphics()
  for (let i = 0; i < 3; i++) {
    const a = ((Math.PI * 2) / 3) * i - Math.PI / 2
    if (i) tri.lineTo(Math.cos(a) * 19, Math.sin(a) * 19)
    else tri.moveTo(Math.cos(a) * 19, Math.sin(a) * 19)
  }
  tri.closePath().stroke({ width: 1, color: color.core, alpha: 0.5 })

  s.addChild(outer, inner, ticks, tri)
  s.filters = [glow(color.glow, 12, 1.8)]
  s.scale.set(0.4)
  s.alpha = 0
  ctx.stage.fx.addChild(s)

  ctx.tl.to(s, { alpha: 1, duration: 0.12 }, at)
  ctx.tl.to(s.scale, { x: 1, y: 1, duration: 0.32, ease: 'back.out(1.8)' }, at)
  ctx.tl.to(s, { rotation: Math.PI * 0.7, duration: dur + 0.2, ease: 'none' }, at)
  ctx.tl.to(s, { alpha: 0, duration: 0.2, ease: 'power2.in', onComplete: () => s.destroy() }, at + dur)
}

/**
 * A glowing projectile flying caster→target along a shallow arc, leaving a
 * ribbon trail (ticker-emitted). Returns the timeline time (s) of impact.
 */
export function fxProjectile(ctx: FxCtx, from: Px, to: Px, color: VfxColor, opts: { at?: number; arc?: number; flight?: number } = {}): number {
  const { stage, tl } = ctx
  const at = opts.at ?? 0
  const flight = opts.flight ?? 0.42
  const p = orb(7, color.core, color.glow)
  p.position.set(from.x, from.y)
  p.alpha = 0
  stage.fx.addChild(p)

  const midY = (from.y + to.y) / 2 - (opts.arc ?? 34)

  tl.to(p, { alpha: 1, duration: 0.06 }, at)
  tl.to(p.scale, { x: 1.3, y: 1.3, duration: flight, ease: 'none' }, at)
  tl.to(p.position, { x: to.x, duration: flight, ease: 'power1.in' }, at)
  tl.to(p.position, { y: midY, duration: flight / 2, ease: 'sine.out' }, at)
  tl.to(p.position, { y: to.y, duration: flight / 2, ease: 'sine.in' }, at + flight / 2)

  // Ribbon trail: drop fading segments as the projectile travels.
  const ticker = stage.app.ticker
  let frame = 0
  const emit = () => {
    if (frame++ % 2) return
    const seg = new Graphics().circle(0, 0, 3 + Math.random() * 2.5).fill({ color: color.glow, alpha: 0.7 })
    seg.position.set(p.position.x, p.position.y)
    seg.blendMode = 'add'
    stage.fx.addChild(seg)
    gsap.to(seg, { alpha: 0, duration: 0.42, ease: 'power1.in', onComplete: () => seg.destroy() })
    gsap.to(seg.scale, { x: 0.15, y: 0.15, duration: 0.42, ease: 'power1.in' })
  }
  tl.add(() => ticker.add(emit), at)
  tl.add(() => ticker.remove(emit), at + flight)
  tl.to(p, { alpha: 0, duration: 0.06, onComplete: () => p.destroy() }, at + flight)
  return at + flight
}

/* ------------------------------------------------------------------ */
/* Impact                                                              */
/* ------------------------------------------------------------------ */

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
export function fxShockwave(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor, radius: number, width = 3): void {
  const base = 18
  const ring = new Graphics().circle(0, 0, base).stroke({ width, color: color.glow, alpha: 0.9 })
  ring.position.set(x, y)
  ring.scale.set(0.2)
  ring.filters = [glow(color.glow, 12, 1.6)]
  ctx.stage.fx.addChild(ring)
  ctx.tl.to(ring.scale, { x: radius, y: radius, duration: 0.5, ease: 'expo.out' }, at)
  ctx.tl.to(ring, { alpha: 0, duration: 0.5, ease: 'power2.out', onComplete: () => ring.destroy() }, at)
}

/**
 * Directional particle spray: particles fan out in a cone around `dir` (radians)
 * with `spread` width. Pass spread = Math.PI * 2 for a full radial burst.
 */
export function fxImpactSpray(ctx: FxCtx, at: number, x: number, y: number, colors: number[], count: number, dir: number, spread: number, dist: number): void {
  const { stage, tl } = ctx
  for (let i = 0; i < count; i++) {
    const col = colors[i % colors.length] ?? 0xffffff
    const p = new Graphics().circle(0, 0, 1.5 + Math.random() * 3).fill({ color: col })
    p.position.set(x, y)
    p.blendMode = 'add'
    p.filters = [glow(col, 8, 1.4)]
    stage.fx.addChild(p)
    const ang = dir + (Math.random() - 0.5) * spread
    const d = dist * (0.35 + Math.random() * 0.9)
    const dur = 0.45 + Math.random() * 0.35
    const tx = x + Math.cos(ang) * d
    const ty = y + Math.sin(ang) * d
    tl.to(p.position, { x: tx, duration: dur, ease: 'power3.out' }, at)
    tl.to(p.position, { y: ty, duration: dur * 0.55, ease: 'power3.out' }, at)
    tl.to(p.position, { y: ty + 26, duration: dur * 0.45, ease: 'power1.in' }, at + dur * 0.55) // gravity fall
    tl.to(p.scale, { x: 0, y: 0, duration: dur, ease: 'power1.in', onComplete: () => p.destroy() }, at)
  }
}

/** Chunky spinning debris flung along the impact direction. */
export function fxDebris(ctx: FxCtx, at: number, x: number, y: number, color: number, count: number, dir: number): void {
  const { stage, tl } = ctx
  for (let i = 0; i < count; i++) {
    const s = 2 + Math.random() * 3
    const d = new Graphics().rect(-s, -s, s * 2, s * 2).fill({ color })
    d.position.set(x, y)
    d.rotation = Math.random() * Math.PI
    stage.fx.addChild(d)
    const ang = dir + (Math.random() - 0.5) * 1.6
    const dist = 40 + Math.random() * 50
    tl.to(d.position, { x: x + Math.cos(ang) * dist, duration: 0.6, ease: 'power2.out' }, at)
    tl.to(d.position, { y: y + Math.sin(ang) * dist + 30, duration: 0.6, ease: 'power1.in' }, at)
    tl.to(d, { rotation: d.rotation + (Math.random() - 0.5) * 8, alpha: 0, duration: 0.6, ease: 'power1.in', onComplete: () => d.destroy() }, at)
  }
}

/* ------------------------------------------------------------------ */
/* Archetype signatures                                                */
/* ------------------------------------------------------------------ */

/** Rising flames + embers for a fire hit. */
export function fxFlames(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  for (let i = 0; i < 16; i++) {
    const col = color.spark[i % color.spark.length] ?? color.glow
    const f = new Graphics().circle(0, 0, 3 + Math.random() * 4).fill({ color: col, alpha: 0.95 })
    f.position.set(x + (Math.random() * 2 - 1) * 22, y + 12)
    f.blendMode = 'add'
    stage.fx.addChild(f)
    const t = at + Math.random() * 0.12
    tl.to(f.position, { y: y - 42 - Math.random() * 44, x: f.position.x + (Math.random() * 2 - 1) * 16, duration: 0.55 + Math.random() * 0.4, ease: 'power1.out' }, t)
    tl.to(f.scale, { x: 0, y: 0, duration: 0.7, ease: 'power1.in', onComplete: () => f.destroy() }, t)
  }
}

/** Jagged lightning arcs radiating from a dark hit. */
export function fxLightning(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  for (let k = 0; k < 5; k++) {
    const g = new Graphics()
    const ang = Math.random() * Math.PI * 2
    const len = 30 + Math.random() * 34
    const seg = 4
    g.moveTo(0, 0)
    for (let s = 1; s <= seg; s++) {
      const r = (len * s) / seg
      g.lineTo(Math.cos(ang) * r + (Math.random() * 2 - 1) * 11, Math.sin(ang) * r + (Math.random() * 2 - 1) * 11)
    }
    g.stroke({ width: 2, color: color.core, alpha: 0.9 })
    g.position.set(x, y)
    g.filters = [glow(color.glow, 10, 2)]
    stage.fx.addChild(g)
    tl.to(g, { alpha: 0, duration: 0.3, ease: 'power2.out', onComplete: () => g.destroy() }, at + k * 0.02)
  }
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

/** A column of light + rune sigil + rising motes for a heal. */
export function fxRuneColumn(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  const col = new Graphics().rect(-15, -74, 30, 96).fill({ color: color.core, alpha: 0.22 })
  col.position.set(x, y + 22)
  col.blendMode = 'add'
  col.alpha = 0
  stage.fx.addChild(col)
  tl.to(col, { alpha: 1, duration: 0.16 }, at)
  tl.to(col, { alpha: 0, duration: 0.6, ease: 'power2.out', onComplete: () => col.destroy() }, at + 0.32)

  fxSigil(ctx, at, x, y + 36, color, 0.7)
  for (let i = 0; i < 14; i++) {
    const c = color.spark[i % color.spark.length] ?? color.glow
    const p = new Graphics().circle(0, 0, 2 + Math.random() * 2.5).fill({ color: c })
    p.position.set(x + (Math.random() * 2 - 1) * 30, y + 30)
    p.blendMode = 'add'
    p.filters = [glow(color.glow, 8, 1.4)]
    stage.fx.addChild(p)
    const t = at + i * 0.04
    tl.to(p.position, { y: y - 46, duration: 0.9, ease: 'power1.out' }, t)
    tl.to(p, { alpha: 0, duration: 0.9, ease: 'power1.in', onComplete: () => p.destroy() }, t)
  }
}

/** Hexagonal Protego barrier that snaps up then dissipates. */
export function fxHexBarrier(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const hex = new Graphics()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2
    const px = Math.cos(a) * 52
    const py = Math.sin(a) * 52
    if (i) hex.lineTo(px, py)
    else hex.moveTo(px, py)
  }
  hex.closePath().fill({ color: color.glow, alpha: 0.14 }).stroke({ width: 3, color: color.core, alpha: 0.9 })
  hex.position.set(x, y)
  hex.scale.set(0.5)
  hex.alpha = 0
  hex.filters = [glow(color.glow, 20, 2)]
  ctx.stage.fx.addChild(hex)
  ctx.tl.to(hex, { alpha: 1, duration: 0.14 }, at)
  ctx.tl.to(hex.scale, { x: 1, y: 1, duration: 0.32, ease: 'back.out(2)' }, at)
  ctx.tl.to(hex, { alpha: 0, duration: 0.42, ease: 'power2.in', onComplete: () => hex.destroy() }, at + 0.55)
}

/** Finisher flourish for a killing blow: gold+crimson shock + rising embers. */
export function fxKill(ctx: FxCtx, at: number, x: number, y: number): void {
  fxShockwave(ctx, at, x, y, { core: GOLD, glow: GOLD_DEEP, spark: [GOLD] }, 7, 4)
  fxShockwave(ctx, at + 0.08, x, y, { core: GOLD, glow: CRIMSON, spark: [GOLD] }, 5, 2)
  const { stage, tl } = ctx
  for (let i = 0; i < 18; i++) {
    const col = i % 2 ? GOLD : CRIMSON
    const e = new Graphics().circle(0, 0, 2 + Math.random() * 2).fill({ color: col })
    e.position.set(x + (Math.random() * 2 - 1) * 30, y)
    e.blendMode = 'add'
    e.filters = [glow(col, 8, 1.4)]
    stage.fx.addChild(e)
    const t = at + Math.random() * 0.15
    tl.to(e.position, { y: y - 60 - Math.random() * 44, duration: 1, ease: 'power1.out' }, t)
    tl.to(e, { alpha: 0, duration: 1, ease: 'power1.in', onComplete: () => e.destroy() }, t)
  }
}

/* ------------------------------------------------------------------ */
/* Per-spell signature flourishes                                      */
/* ------------------------------------------------------------------ */

/** Generic energetic impact — flash + shockwave + directional spray + debris. */
export function fxBurstImpact(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor, dir: number, power: number, crit: boolean): void {
  fxFlash(ctx, at, x, y, color, crit ? 48 : 34)
  fxShockwave(ctx, at, x, y, color, (crit ? 4.4 : 2.8) + power * 2.2, crit ? 4 : 3)
  if (crit) fxShockwave(ctx, at + 0.06, x, y, color, 3 + power, 2)
  fxImpactSpray(ctx, at, x, y, color.spark, Math.round((crit ? 22 : 12) + power * 12), dir, 1.5, crit ? 100 : 74)
  fxDebris(ctx, at, x, y, color.glow, crit ? 6 : 4, dir)
}

/** Big concussive blast — Bombarda / Confringo / Reducto / Fiendfyre. */
export function fxExplosion(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  fxFlash(ctx, at, x, y, color, 58)
  fxShockwave(ctx, at, x, y, color, 5.4, 5)
  fxShockwave(ctx, at + 0.05, x, y, color, 3.6, 3)
  // fireball puffs
  for (let i = 0; i < 12; i++) {
    const col = color.spark[i % color.spark.length] ?? color.glow
    const b = new Graphics().circle(0, 0, 5 + Math.random() * 7).fill({ color: col, alpha: 0.85 })
    b.position.set(x + (Math.random() * 2 - 1) * 14, y + (Math.random() * 2 - 1) * 14)
    b.blendMode = 'add'
    stage.fx.addChild(b)
    const ang = Math.random() * Math.PI * 2
    const d = 30 + Math.random() * 46
    tl.to(b.position, { x: x + Math.cos(ang) * d, y: y + Math.sin(ang) * d, duration: 0.5, ease: 'power2.out' }, at)
    tl.to(b.scale, { x: 0, y: 0, duration: 0.6, ease: 'power1.in', onComplete: () => b.destroy() }, at)
  }
  fxImpactSpray(ctx, at, x, y, color.spark, 20, 0, Math.PI * 2, 100)
  fxPhysicsBurst(ctx, at, x, y, color.spark, 20, { speed: 320, gravity: 520, size: 3 })
  fxSmoke(ctx, at + 0.05, x, y, 9)
  fxDebris(ctx, at, x, y, color.glow, 9, 0)
}

/** Diagonal cutting slashes — Sectumsempra / Diffindo. */
export function fxSlash(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  for (let k = 0; k < 3; k++) {
    const ang = -Math.PI / 4 + (k - 1) * 0.35
    const len = 48
    const g = new Graphics()
    g.moveTo(-Math.cos(ang) * len, -Math.sin(ang) * len).lineTo(Math.cos(ang) * len, Math.sin(ang) * len)
    g.stroke({ width: 3.5, color: color.core, alpha: 0.95 })
    g.position.set(x + (k - 1) * 9, y)
    g.filters = [glow(color.glow, 12, 2.2)]
    g.alpha = 0
    stage.fx.addChild(g)
    const t = at + k * 0.06
    tl.to(g, { alpha: 1, duration: 0.05 }, t)
    tl.to(g, { alpha: 0, duration: 0.3, ease: 'power2.out', onComplete: () => g.destroy() }, t + 0.12)
  }
  fxImpactSpray(ctx, at + 0.05, x, y, color.spark, 14, -Math.PI / 4, 1.1, 76)
}

/** The killing curse: green death flash + a forming skull + rising mist. Avada Kedavra. */
export function fxSkull(ctx: FxCtx, at: number, x: number, y: number): void {
  const { stage, tl } = ctx
  const green: VfxColor = { core: 0x9dff9f, glow: 0x2ecc40, spark: [0x2ecc40, 0xbfffb0] }
  fxFlash(ctx, at, x, y, green, 60)
  const s = new Container()
  s.position.set(x, y - 6)
  const head = new Graphics().circle(0, 0, 15).fill({ color: 0xdfffe4, alpha: 0.92 })
  const jaw = new Graphics().roundRect(-9, 9, 18, 10, 4).fill({ color: 0xdfffe4, alpha: 0.92 })
  const eyeL = new Graphics().circle(-6, -1, 4).fill({ color: 0x0a2a10 })
  const eyeR = new Graphics().circle(6, -1, 4).fill({ color: 0x0a2a10 })
  const nose = new Graphics().poly([0, 3, -2.5, 8, 2.5, 8]).fill({ color: 0x0a2a10 })
  s.addChild(head, jaw, eyeL, eyeR, nose)
  s.filters = [glow(0x2ecc40, 20, 2.6)]
  s.scale.set(0.4)
  s.alpha = 0
  stage.fx.addChild(s)
  tl.to(s, { alpha: 1, duration: 0.12 }, at)
  tl.to(s.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out(1.6)' }, at)
  tl.to(s, { alpha: 0, duration: 0.55, ease: 'power2.in', onComplete: () => s.destroy() }, at + 0.5)
  for (let i = 0; i < 12; i++) {
    const m = new Graphics().circle(0, 0, 2 + Math.random() * 2).fill({ color: 0x2ecc40 })
    m.position.set(x + (Math.random() * 2 - 1) * 26, y + 10)
    m.blendMode = 'add'
    stage.fx.addChild(m)
    const t = at + Math.random() * 0.2
    tl.to(m.position, { y: y - 40 - Math.random() * 30, duration: 0.9, ease: 'power1.out' }, t)
    tl.to(m, { alpha: 0, duration: 0.9, ease: 'power1.in', onComplete: () => m.destroy() }, t)
  }
}

/** Crystalline ice shards bursting outward + frost ring. Glacius. */
export function fxIceShards(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  fxFlash(ctx, at, x, y, color, 40)
  fxShockwave(ctx, at, x, y, color, 3, 2)
  for (let i = 0; i < 8; i++) {
    const ang = (Math.PI * 2 * i) / 8 + Math.random() * 0.3
    const shard = new Graphics().poly([0, -14, 4, 0, 0, 4, -4, 0]).fill({ color: color.core, alpha: 0.9 }).stroke({ width: 1, color: 0xffffff, alpha: 0.7 })
    shard.position.set(x, y)
    shard.rotation = ang + Math.PI / 2
    shard.scale.set(0.2)
    shard.filters = [glow(color.glow, 8, 1.6)]
    stage.fx.addChild(shard)
    const t = at + i * 0.015
    tl.to(shard.position, { x: x + Math.cos(ang) * 34, y: y + Math.sin(ang) * 34, duration: 0.35, ease: 'power3.out' }, t)
    tl.to(shard.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out(2)' }, t)
    tl.to(shard, { alpha: 0, duration: 0.4, ease: 'power2.in', onComplete: () => shard.destroy() }, t + 0.35)
  }
}

/** Serpent strike + venom spray. Serpensortia. */
export function fxSnake(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  const g = new Graphics()
  g.moveTo(-30, 8)
  g.bezierCurveTo(-14, -14, 8, 16, 26, -6)
  g.stroke({ width: 5, color: color.core, alpha: 0.9 })
  g.position.set(x, y)
  g.filters = [glow(color.glow, 12, 2)]
  g.alpha = 0
  g.scale.set(0.5, 0.5)
  stage.fx.addChild(g)
  tl.to(g, { alpha: 1, duration: 0.08 }, at)
  tl.to(g.scale, { x: 1.1, y: 1.1, duration: 0.18, ease: 'power3.out' }, at)
  tl.to(g, { alpha: 0, duration: 0.3, ease: 'power2.out', onComplete: () => g.destroy() }, at + 0.2)
  // venom drip
  fxImpactSpray(ctx, at + 0.1, x + 24, y, color.spark, 8, Math.PI / 2, 1.4, 40)
}

/** A coiling fire-serpent that lunges through the target — Fiendfyre (Ardemonio) set-piece. */
export function fxFiendfyre(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor, dir: number): void {
  const { stage, tl } = ctx
  const d = dir >= 0 ? 1 : -1
  // Eruption: cursed-fire flash + shockwave as the beast bursts out.
  fxFlash(ctx, at, x, y, color, 46)
  fxShockwave(ctx, at, x, y, color, 3, 3)

  // The beast: a snaking spine with a fanged head, lunging in along the attack direction.
  const beast = new Container()
  const spine = new Graphics()
    .moveTo(-52, 12).bezierCurveTo(-26, -24, -2, 24, 20, -8).bezierCurveTo(34, -24, 46, -6, 58, -16)
    .stroke({ width: 11, color: color.glow, alpha: 0.9 })
  const core = new Graphics()
    .moveTo(-52, 12).bezierCurveTo(-26, -24, -2, 24, 20, -8).bezierCurveTo(34, -24, 46, -6, 58, -16)
    .stroke({ width: 4.5, color: color.core, alpha: 0.95 })
  core.blendMode = 'add'
  const head = new Graphics().poly([48, -24, 72, -16, 48, -8]).fill({ color: color.core, alpha: 0.95 })
  const eye = new Graphics().circle(56, -16, 2.6).fill({ color: 0xfff2d8 })
  eye.blendMode = 'add'
  beast.addChild(spine, core, head, eye)
  beast.position.set(x - d * 44, y)
  beast.scale.set(d, 1)
  beast.alpha = 0
  beast.filters = [glow(color.glow, 20, 2.8)]
  stage.fx.addChild(beast)
  tl.to(beast, { alpha: 1, duration: 0.1 }, at)
  tl.to(beast.position, { x, duration: 0.24, ease: 'power3.out' }, at)
  tl.to(beast.scale, { x: d * 1.18, y: 1.18, duration: 0.24, ease: 'power2.out' }, at)
  tl.to(beast, { alpha: 0, duration: 0.36, ease: 'power2.in', onComplete: () => beast.destroy() }, at + 0.28)

  // Fire trailing the coil + embers thrown on impact.
  fxFlames(ctx, at + 0.06, x - d * 22, y + 6, color)
  fxFlames(ctx, at + 0.14, x + d * 14, y - 8, color)
  fxImpactSpray(ctx, at + 0.16, x, y, color.spark, 16, d > 0 ? 0 : Math.PI, 1.8, 64)
}

/** Rotating disorienting spiral — Confundo / Silencio / Imperio. */
export function fxSwirl(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  const s = new Container()
  s.position.set(x, y)
  for (let i = 0; i < 3; i++) {
    const r = new Graphics().arc(0, 0, 16 + i * 8, 0, Math.PI * 1.4).stroke({ width: 2, color: i % 2 ? color.core : color.glow, alpha: 0.8 })
    r.rotation = (i * Math.PI) / 3
    s.addChild(r)
  }
  s.filters = [glow(color.glow, 10, 1.6)]
  s.scale.set(0.3)
  s.alpha = 0
  stage.fx.addChild(s)
  tl.to(s, { alpha: 1, duration: 0.12 }, at)
  tl.to(s.scale, { x: 1, y: 1, duration: 0.35, ease: 'back.out(1.6)' }, at)
  tl.to(s, { rotation: Math.PI * 1.6, duration: 0.7, ease: 'power1.inOut' }, at)
  tl.to(s, { alpha: 0, duration: 0.3, ease: 'power2.in', onComplete: () => s.destroy() }, at + 0.55)
}

/** Upward pull — Levicorpus / Imperio lift. */
export function fxLift(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  for (let i = 0; i < 10; i++) {
    const p = new Graphics().rect(-1.5, -6, 3, 12).fill({ color: color.core, alpha: 0.8 })
    p.position.set(x + (Math.random() * 2 - 1) * 26, y + 24)
    p.blendMode = 'add'
    p.filters = [glow(color.glow, 8, 1.4)]
    stage.fx.addChild(p)
    const t = at + i * 0.03
    tl.to(p.position, { y: y - 40, duration: 0.6, ease: 'power2.out' }, t)
    tl.to(p, { alpha: 0, duration: 0.6, ease: 'power1.in', onComplete: () => p.destroy() }, t)
  }
  fxShockwave(ctx, at, x, y + 20, color, 2.4, 2)
}

/** Silver holy light burst — Expecto Patronum. */
export function fxPatronus(ctx: FxCtx, at: number, x: number, y: number): void {
  const { stage, tl } = ctx
  const silver: VfxColor = { core: 0xffffff, glow: 0xbfe0ff, spark: [0xffffff, 0xdaf0ff, 0xbfe0ff] }
  fxFlash(ctx, at, x, y, silver, 64)
  fxShockwave(ctx, at, x, y, silver, 4.4, 4)
  // radiating soft rays
  for (let i = 0; i < 12; i++) {
    const ang = (Math.PI * 2 * i) / 12
    const ray = new Graphics().rect(-2, 0, 4, 46).fill({ color: 0xdaf0ff, alpha: 0.5 })
    ray.position.set(x, y)
    ray.rotation = ang
    ray.pivot.set(0, 0)
    ray.blendMode = 'add'
    ray.scale.set(1, 0.2)
    stage.fx.addChild(ray)
    tl.to(ray.scale, { y: 1, duration: 0.3, ease: 'power2.out' }, at)
    tl.to(ray, { alpha: 0, duration: 0.5, ease: 'power2.out', onComplete: () => ray.destroy() }, at + 0.2)
  }
  for (let i = 0; i < 14; i++) {
    const m = new Graphics().circle(0, 0, 2 + Math.random() * 2).fill({ color: 0xffffff })
    m.position.set(x + (Math.random() * 2 - 1) * 30, y + 20)
    m.blendMode = 'add'
    stage.fx.addChild(m)
    const t = at + Math.random() * 0.2
    tl.to(m.position, { y: y - 40 - Math.random() * 30, duration: 0.9, ease: 'power1.out' }, t)
    tl.to(m, { alpha: 0, duration: 0.9, ease: 'power1.in', onComplete: () => m.destroy() }, t)
  }
}

/** Rising aura + up-chevron for a self stat buff — Riddikulus / Salvio / Fianto / Aegis / ally buffs. */
export function fxBuffAura(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  const ring = new Graphics().circle(0, 0, 40).stroke({ width: 3, color: color.glow, alpha: 0.8 })
  ring.position.set(x, y + 10)
  ring.scale.set(1, 0.4)
  ring.alpha = 0
  ring.filters = [glow(color.glow, 14, 1.8)]
  stage.fx.addChild(ring)
  tl.to(ring, { alpha: 0.9, duration: 0.14 }, at)
  tl.to(ring.position, { y: y - 30, duration: 0.6, ease: 'power2.out' }, at)
  tl.to(ring, { alpha: 0, duration: 0.6, ease: 'power2.out', onComplete: () => ring.destroy() }, at + 0.1)
  for (let i = 0; i < 12; i++) {
    const p = new Graphics().circle(0, 0, 2 + Math.random() * 2).fill({ color: color.spark[i % color.spark.length] ?? color.glow })
    p.position.set(x + (Math.random() * 2 - 1) * 30, y + 22)
    p.blendMode = 'add'
    stage.fx.addChild(p)
    const t = at + i * 0.03
    tl.to(p.position, { y: y - 34, duration: 0.7, ease: 'power1.out' }, t)
    tl.to(p, { alpha: 0, duration: 0.7, ease: 'power1.in', onComplete: () => p.destroy() }, t)
  }
}

/* ------------------------------------------------------------------ */
/* Physics-driven particles (GSAP Physics2DPlugin)                     */
/* ------------------------------------------------------------------ */

/** Real velocity/gravity particle spray — embers, debris, blood. Angles in degrees (0 = right, -90 = up). */
export function fxPhysicsBurst(
  ctx: FxCtx, at: number, x: number, y: number, colors: number[], count: number,
  opts: { speed?: number; gravity?: number; angleMin?: number; angleRange?: number; size?: number; life?: number } = {},
): void {
  const { stage, tl } = ctx
  const speed = opts.speed ?? 280
  const gravity = opts.gravity ?? 500
  const angleMin = opts.angleMin ?? 0
  const angleRange = opts.angleRange ?? 360
  for (let i = 0; i < count; i++) {
    const col = colors[i % colors.length] ?? 0xffffff
    const sz = opts.size ?? 1.5 + Math.random() * 3
    const p = new Graphics().circle(0, 0, sz).fill({ color: col })
    p.position.set(x, y)
    p.blendMode = 'add'
    p.filters = [glow(col, 6, 1.2)]
    stage.fx.addChild(p)
    const dur = opts.life ?? 0.7 + Math.random() * 0.5
    tl.to(p, { duration: dur, physics2D: { velocity: speed * (0.5 + Math.random() * 0.85), angle: angleMin + Math.random() * angleRange, gravity }, ease: 'none' }, at)
    tl.to(p.scale, { x: 0.15, y: 0.15, duration: dur, ease: 'power1.in' }, at)
    tl.to(p, { alpha: 0, duration: dur, ease: 'power1.in', onComplete: () => p.destroy() }, at)
  }
}

/** Dark rolling smoke puffs rising + expanding. Non-additive so they read as mass. */
export function fxSmoke(ctx: FxCtx, at: number, x: number, y: number, count = 8): void {
  const { stage, tl } = ctx
  for (let i = 0; i < count; i++) {
    const g = new Graphics().circle(0, 0, 6 + Math.random() * 8).fill({ color: 0x2a211a, alpha: 0.5 })
    g.position.set(x + (Math.random() * 2 - 1) * 16, y)
    stage.fx.addChild(g)
    const t = at + Math.random() * 0.1
    tl.to(g.position, { y: y - 40 - Math.random() * 44, x: g.position.x + (Math.random() * 2 - 1) * 30, duration: 0.9 + Math.random() * 0.4, ease: 'power1.out' }, t)
    tl.to(g.scale, { x: 2.6, y: 2.6, duration: 1.1, ease: 'power1.out' }, t)
    tl.to(g, { alpha: 0, duration: 1.1, ease: 'power1.in', onComplete: () => g.destroy() }, t)
  }
}

/* ------------------------------------------------------------------ */
/* Signature flourishes for the rest of the roster                     */
/* ------------------------------------------------------------------ */

/** Expelliarmus: the target's wand spins away + gold sparks. */
export function fxDisarm(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  fxFlash(ctx, at, x, y, color, 30)
  const wand = new Graphics().roundRect(-2, -14, 4, 28, 2).fill({ color: 0xcaa24a }).stroke({ width: 1, color: 0xf6e6a8, alpha: 0.8 })
  wand.position.set(x, y)
  wand.filters = [glow(0xf6e6a8, 8, 1.6)]
  stage.fx.addChild(wand)
  tl.to(wand, { duration: 0.8, physics2D: { velocity: 320, angle: -55, gravity: 380 }, ease: 'none' }, at)
  tl.to(wand, { rotation: 14, duration: 0.8, ease: 'none' }, at)
  tl.to(wand, { alpha: 0, duration: 0.8, ease: 'power1.in', onComplete: () => wand.destroy() }, at)
  fxPhysicsBurst(ctx, at, x, y, [0xf6e6a8, 0xcaa24a], 10, { speed: 220, gravity: 300 })
}

/** Oppugno: a rapid volley of flung objects, each a small pop. */
export function fxVolley(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  for (let k = 0; k < 4; k++) {
    const t = at + k * 0.06
    const ox = (Math.random() * 2 - 1) * 16, oy = (Math.random() * 2 - 1) * 16
    fxFlash(ctx, t, x + ox, y + oy, color, 18)
    fxPhysicsBurst(ctx, t, x + ox, y + oy, color.spark, 5, { speed: 190, gravity: 420 })
  }
  fxShockwave(ctx, at + 0.18, x, y, color, 2.6, 2)
}

/** Flipendo: a concussive crescent shove that knocks the target back. */
export function fxShove(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor, dir: number): void {
  const { stage, tl } = ctx
  const arc = new Graphics().arc(0, 0, 30, dir - 0.9, dir + 0.9).stroke({ width: 6, color: color.core, alpha: 0.85 })
  arc.position.set(x, y)
  arc.filters = [glow(color.glow, 12, 2)]
  arc.scale.set(0.5)
  arc.alpha = 0
  stage.fx.addChild(arc)
  tl.to(arc, { alpha: 1, duration: 0.06 }, at)
  tl.to(arc.scale, { x: 1.7, y: 1.7, duration: 0.4, ease: 'power3.out' }, at)
  tl.to(arc.position, { x: x + Math.cos(dir) * 26, y: y + Math.sin(dir) * 26, duration: 0.4, ease: 'power3.out' }, at)
  tl.to(arc, { alpha: 0, duration: 0.4, ease: 'power2.out', onComplete: () => arc.destroy() }, at)
  const deg = (dir * 180) / Math.PI
  fxPhysicsBurst(ctx, at, x, y, color.spark, 12, { speed: 320, gravity: 200, angleMin: deg - 40, angleRange: 80 })
}

/** Petrificus Totalus: grey cracks spread + stone dust. */
export function fxStone(ctx: FxCtx, at: number, x: number, y: number): void {
  const { stage, tl } = ctx
  const grey: VfxColor = { core: 0xcfc8be, glow: 0x8a8278, spark: [0x8a8278, 0xcfc8be] }
  fxFlash(ctx, at, x, y, grey, 34)
  for (let k = 0; k < 6; k++) {
    const g = new Graphics()
    const ang = (Math.PI * 2 * k) / 6 + Math.random() * 0.4
    g.moveTo(0, 0)
    for (let s = 1; s <= 3; s++) g.lineTo(Math.cos(ang) * ((26 * s) / 3) + (Math.random() * 2 - 1) * 6, Math.sin(ang) * ((26 * s) / 3) + (Math.random() * 2 - 1) * 6)
    g.stroke({ width: 2, color: 0x5a544c, alpha: 0.9 })
    g.position.set(x, y)
    stage.fx.addChild(g)
    tl.to(g, { alpha: 0, duration: 0.5, ease: 'power2.out', onComplete: () => g.destroy() }, at + 0.12)
  }
  fxPhysicsBurst(ctx, at, x, y, [0x8a8278, 0x5a544c], 10, { speed: 140, gravity: 600, angleMin: 200, angleRange: 140 })
}

/** Confundo: dizzy stars orbit the target's head. */
export function fxConfusion(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  for (let i = 0; i < 5; i++) {
    const st = new Graphics().star(0, 0, 5, 6, 3).fill({ color: color.core, alpha: 0.9 })
    const a0 = (Math.PI * 2 * i) / 5
    st.position.set(x + Math.cos(a0) * 24, y - 24 + Math.sin(a0) * 8)
    st.filters = [glow(color.glow, 8, 1.4)]
    st.scale.set(0)
    stage.fx.addChild(st)
    const t = at + i * 0.05
    tl.to(st.scale, { x: 1, y: 1, duration: 0.2, ease: 'back.out(2)' }, t)
    tl.to(st, { rotation: Math.PI * 2, duration: 0.75, ease: 'none' }, t)
    tl.to(st.position, { x: x + Math.cos(a0 + 2.2) * 26, duration: 0.75, ease: 'sine.inOut' }, t)
    tl.to(st, { alpha: 0, duration: 0.55, ease: 'power1.in', onComplete: () => st.destroy() }, t + 0.35)
  }
}

/** Silencio / Langlock: a ring snaps shut over the target. */
export function fxSilence(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  const ring = new Graphics().circle(0, 0, 44).stroke({ width: 4, color: color.core, alpha: 0.9 })
  ring.position.set(x, y)
  ring.filters = [glow(color.glow, 10, 1.6)]
  stage.fx.addChild(ring)
  tl.to(ring.scale, { x: 0.1, y: 0.1, duration: 0.3, ease: 'power3.in' }, at)
  tl.to(ring, { alpha: 0, duration: 0.2, ease: 'power2.in', onComplete: () => ring.destroy() }, at + 0.26)
  fxFlash(ctx, at + 0.28, x, y, color, 22)
}

/** Tarantallegra: playful bouncing motes. */
export function fxDance(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  for (let i = 0; i < 8; i++) {
    const n = new Graphics().circle(0, 0, 3).fill({ color: color.core })
    n.position.set(x + (Math.random() * 2 - 1) * 22, y + 20)
    n.blendMode = 'add'
    n.filters = [glow(color.glow, 6, 1.2)]
    stage.fx.addChild(n)
    const t = at + i * 0.04
    tl.to(n.position, { x: n.position.x + (Math.random() * 2 - 1) * 40, y: y - 32 - Math.random() * 16, duration: 0.6, ease: 'sine.inOut' }, t)
    tl.to(n, { alpha: 0, duration: 0.6, ease: 'power1.in', onComplete: () => n.destroy() }, t)
  }
}

/** Imperio: an eerie eye opens with reaching tendrils. */
export function fxMind(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  const eye = new Container()
  eye.position.set(x, y - 4)
  const sclera = new Graphics().ellipse(0, 0, 20, 11).fill({ color: color.core, alpha: 0.9 })
  const pupil = new Graphics().circle(0, 0, 5).fill({ color: 0x1a0a2a })
  eye.addChild(sclera, pupil)
  eye.filters = [glow(color.glow, 12, 2)]
  eye.scale.set(0.3, 0)
  eye.alpha = 0
  stage.fx.addChild(eye)
  tl.to(eye, { alpha: 1, duration: 0.12 }, at)
  tl.to(eye.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out(1.6)' }, at)
  tl.to(eye, { alpha: 0, duration: 0.4, ease: 'power2.in', onComplete: () => eye.destroy() }, at + 0.5)
  for (let k = 0; k < 5; k++) {
    const g = new Graphics()
    const ang = (Math.PI * 2 * k) / 5
    g.moveTo(0, 0).bezierCurveTo(Math.cos(ang) * 14, Math.sin(ang) * 14 - 8, Math.cos(ang) * 26, Math.sin(ang) * 26 + 8, Math.cos(ang) * 36, Math.sin(ang) * 36)
    g.stroke({ width: 2, color: color.glow, alpha: 0.7 })
    g.position.set(x, y)
    g.alpha = 0
    stage.fx.addChild(g)
    tl.to(g, { alpha: 0.8, duration: 0.15 }, at + 0.05)
    tl.to(g, { alpha: 0, duration: 0.4, ease: 'power2.out', onComplete: () => g.destroy() }, at + 0.35)
  }
}

/** Rennervate: a bright revive pulse + rising light. */
export function fxRevive(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  fxFlash(ctx, at, x, y, color, 42)
  fxShockwave(ctx, at, x, y, color, 3.4, 3)
  fxRuneColumn(ctx, at + 0.05, x, y, color)
}

/** Anapneo: airy bubbles rise and pop. */
export function fxBubbles(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  for (let i = 0; i < 12; i++) {
    const b = new Graphics().circle(0, 0, 3 + Math.random() * 4).fill({ color: color.glow, alpha: 0.12 }).stroke({ width: 1.5, color: color.core, alpha: 0.7 })
    b.position.set(x + (Math.random() * 2 - 1) * 26, y + 22)
    b.filters = [glow(color.glow, 6, 1)]
    stage.fx.addChild(b)
    const t = at + i * 0.04
    tl.to(b.position, { y: y - 44 - Math.random() * 20, x: b.position.x + (Math.random() * 2 - 1) * 14, duration: 0.9, ease: 'power1.out' }, t)
    tl.to(b, { alpha: 0, duration: 0.9, ease: 'power1.in', onComplete: () => b.destroy() }, t)
  }
}

/** Ferula: bandages sweep across the target. */
export function fxBandage(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  fxFlash(ctx, at, x, y, color, 24)
  for (let k = 0; k < 3; k++) {
    const band = new Graphics().rect(-30, -4, 60, 8).fill({ color: 0xf0e6d0, alpha: 0.85 })
    band.position.set(x - 42, y - 16 + k * 14)
    band.rotation = -0.15
    band.alpha = 0
    stage.fx.addChild(band)
    const t = at + k * 0.08
    tl.to(band, { alpha: 0.85, duration: 0.1 }, t)
    tl.to(band.position, { x: x + 42, duration: 0.5, ease: 'power2.inOut' }, t)
    tl.to(band, { alpha: 0, duration: 0.3, ease: 'power2.out', onComplete: () => band.destroy() }, t + 0.4)
  }
}

/** Fianto Duri: a brick wall rises in front of the caster. */
export function fxWall(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  const wall = new Graphics().rect(-30, -34, 60, 68).fill({ color: 0x6a5a44, alpha: 0.88 }).stroke({ width: 2, color: color.core, alpha: 0.8 })
  for (let r = -2; r <= 2; r++) wall.moveTo(-30, r * 14).lineTo(30, r * 14)
  wall.stroke({ width: 1, color: 0x3a3020, alpha: 0.6 })
  wall.position.set(x, y + 64)
  wall.alpha = 0
  wall.filters = [glow(color.glow, 10, 1.4)]
  stage.fx.addChild(wall)
  tl.to(wall, { alpha: 1, duration: 0.1 }, at)
  tl.to(wall.position, { y, duration: 0.32, ease: 'back.out(1.4)' }, at)
  tl.to(wall, { alpha: 0, duration: 0.4, ease: 'power2.in', onComplete: () => wall.destroy() }, at + 0.6)
  fxPhysicsBurst(ctx, at + 0.3, x, y + 34, [0x6a5a44, 0x8a7a5a], 8, { speed: 130, gravity: 500, angleMin: 200, angleRange: 140 })
}

/** Aegis: a barrier that pulls surrounding energy inward. */
export function fxAbsorb(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  fxHexBarrier(ctx, at, x, y, color)
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI * 2 * i) / 10
    const p = new Graphics().circle(0, 0, 3).fill({ color: color.glow })
    p.position.set(x + Math.cos(ang) * 60, y + Math.sin(ang) * 60)
    p.blendMode = 'add'
    stage.fx.addChild(p)
    tl.to(p.position, { x, y, duration: 0.45, ease: 'power2.in' }, at)
    tl.to(p, { alpha: 0, duration: 0.45, ease: 'power2.in', onComplete: () => p.destroy() }, at + 0.2)
  }
}

/** Riddikulus / Incitamento: rallying chevrons rise. */
export function fxRally(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  for (let k = 0; k < 3; k++) {
    const ch = new Graphics().moveTo(-12, 6).lineTo(0, -6).lineTo(12, 6).stroke({ width: 3, color: color.core, alpha: 0.9 })
    ch.position.set(x, y + 10 + k * 6)
    ch.filters = [glow(color.glow, 8, 1.4)]
    ch.alpha = 0
    stage.fx.addChild(ch)
    const t = at + k * 0.08
    tl.to(ch, { alpha: 1, duration: 0.1 }, t)
    tl.to(ch.position, { y: y - 30 - k * 6, duration: 0.6, ease: 'power2.out' }, t)
    tl.to(ch, { alpha: 0, duration: 0.6, ease: 'power1.in', onComplete: () => ch.destroy() }, t)
  }
  fxShockwave(ctx, at, x, y, color, 2.4, 2)
}

/** Salvio Hexia: swirling wind gusts deflect around the caster. */
export function fxWind(ctx: FxCtx, at: number, x: number, y: number, color: VfxColor): void {
  const { stage, tl } = ctx
  for (let k = 0; k < 4; k++) {
    const g = new Graphics().arc(0, 0, 24 + k * 6, -0.8, 1.4).stroke({ width: 2.5, color: color.core, alpha: 0.7 })
    g.position.set(x, y)
    g.rotation = (k * Math.PI) / 2
    g.filters = [glow(color.glow, 8, 1.2)]
    g.alpha = 0
    stage.fx.addChild(g)
    const t = at + k * 0.05
    tl.to(g, { alpha: 0.8, duration: 0.1 }, t)
    tl.to(g, { rotation: g.rotation + Math.PI * 1.2, duration: 0.6, ease: 'power1.out' }, t)
    tl.to(g, { alpha: 0, duration: 0.5, ease: 'power2.out', onComplete: () => g.destroy() }, t + 0.2)
  }
}
