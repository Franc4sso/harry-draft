import { Application, Container } from 'pixi.js'
import { AdvancedBloomFilter } from 'pixi-filters'

/**
 * A mounted Pixi WebGL overlay for the battle arena. The canvas is transparent
 * and `pointer-events: none`, sized to the arena element via `resizeTo`, so the
 * arena-relative `{x,y}%` coordinates already computed in BattleArena map 1:1.
 *
 * Browser-only: create it inside `useEffect` (never during SSR) and call
 * `destroy()` on cleanup.
 */
export interface PixiStage {
  app: Application
  /** Container all effects are added to (bloomed). */
  fx: Container
  /** The bloom filter on `fx` — pulse `bloomScale` on impact for a light kick. */
  bloom: AdvancedBloomFilter
  /** Resting bloomScale to return to after a pulse. */
  bloomBase: number
  /** Convert an arena percentage point (0–100) to canvas pixels. */
  toPx: (pt: { x: number; y: number }) => { x: number; y: number }
  size: () => { w: number; h: number }
  destroy: () => void
}

export async function createPixiStage(el: HTMLElement): Promise<PixiStage> {
  const app = new Application()
  await app.init({
    resizeTo: el,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1),
    powerPreference: 'high-performance',
  })

  const canvas = app.canvas
  canvas.style.position = 'absolute'
  canvas.style.inset = '0'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '5' // above the portraits (z<5), below the HUD/callouts (z>5)
  el.appendChild(canvas)

  const fx = new Container()
  const bloomBase = 1.0
  const bloom = new AdvancedBloomFilter({ threshold: 0.3, bloomScale: bloomBase, brightness: 1, blur: 6, quality: 5 })
  fx.filters = [bloom]
  app.stage.addChild(fx)

  const toPx = (pt: { x: number; y: number }) => ({
    x: (pt.x / 100) * app.screen.width,
    y: (pt.y / 100) * app.screen.height,
  })
  const size = () => ({ w: app.screen.width, h: app.screen.height })
  const destroy = () => {
    try {
      app.destroy({ removeView: true }, { children: true, texture: true })
    } catch {
      /* already torn down */
    }
  }

  return { app, fx, bloom, bloomBase, toPx, size, destroy }
}
