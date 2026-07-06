/**
 * Ambient background layer for the whole app: warm "Sala Comune" glow —
 * candlelit amber/brass fog and a heavy vignette. Fully static (no CSS
 * animations, no embers, no noise layer) to keep the compositor cost low
 * on every route. Invisible to a11y tree.
 */

export function GameShell() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Fog blobs — big, blurred, static. Warm amber/brass "Sala Comune" haze. */}
      <div
        data-fog
        className="absolute left-[-15%] top-[-20%] h-[60vh] w-[70vw] rounded-full blur-[60px]"
        style={{
          background: 'radial-gradient(circle, rgba(202,162,74,0.14), transparent 65%)',
        }}
      />
      <div
        data-fog
        className="absolute bottom-[-25%] right-[-10%] h-[55vh] w-[60vw] rounded-full blur-[60px]"
        style={{
          background: 'radial-gradient(circle, rgba(140,90,40,0.16), transparent 65%)',
        }}
      />
      <div
        data-fog
        className="absolute left-[20%] top-[45%] h-[40vh] w-[45vw] rounded-full blur-[60px]"
        style={{
          background: 'radial-gradient(circle, rgba(90,50,20,0.4), transparent 65%)',
        }}
      />

      {/* Vignette — heavy, warm-dark, draws the eye to centre stage. */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 90% at 50% 42%, transparent 45%, rgba(20,12,4,0.72) 100%)' }}
      />
    </div>
  )
}
