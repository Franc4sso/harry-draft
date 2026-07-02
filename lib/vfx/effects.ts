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
  fxImpactSpray(ctx, at, x, y, color.spark, 24, 0, Math.PI * 2, 100)
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
