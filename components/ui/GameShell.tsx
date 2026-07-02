/**
 * Ambient background layer for the whole app: drifting fog, rising embers,
 * film-grain noise and a vignette. Pure CSS animations (GPU-only transforms),
 * fully static under prefers-reduced-motion, invisible to a11y tree.
 */

const EMBER_COUNT = 14

// Deterministic pseudo-random per index — stable between SSR and client.
function emberStyle(i: number): React.CSSProperties {
  const h = (i * 2654435761) % 1000
  const left = (h % 97) + 1.5 // 1.5%..98.5%
  const size = 2 + (h % 3) // 2..4px
  const dur = 9 + (h % 8) // 9..16s
  const delay = (h % 90) / 10 // 0..8.9s
  const drift = ((h % 60) - 30) * 1.4 // -42..40px
  const violet = h % 5 === 0
  return {
    left: `${left}%`,
    bottom: '-2vh',
    width: size,
    height: size,
    animationDuration: `${dur}s`,
    animationDelay: `${delay}s`,
    ['--ember-drift' as string]: `${drift}px`,
    ['--ember-peak' as string]: violet ? '0.45' : '0.7',
    background: violet
      ? 'radial-gradient(circle, #b79bf5 0%, rgba(124,58,237,0.4) 60%, transparent 100%)'
      : 'radial-gradient(circle, #f3e6a0 0%, rgba(202,162,74,0.5) 60%, transparent 100%)',
    boxShadow: violet ? '0 0 6px rgba(124,58,237,0.5)' : '0 0 6px rgba(202,162,74,0.55)',
  }
}

const NOISE_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")"

export function GameShell() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Fog blobs — big, blurred, drifting slowly. */}
      <div
        data-fog
        className="anim-ambient absolute left-[-15%] top-[-20%] h-[60vh] w-[70vw] rounded-full blur-[110px]"
        style={{
          background: 'radial-gradient(circle, rgba(202,162,74,0.10), transparent 65%)',
          animation: 'fogDrift 90s ease-in-out infinite',
        }}
      />
      <div
        data-fog
        className="anim-ambient absolute bottom-[-25%] right-[-10%] h-[55vh] w-[60vw] rounded-full blur-[120px]"
        style={{
          background: 'radial-gradient(circle, rgba(124,58,237,0.09), transparent 65%)',
          animation: 'fogDrift 110s ease-in-out infinite reverse',
        }}
      />
      <div
        data-fog
        className="anim-ambient absolute left-[20%] top-[45%] h-[40vh] w-[45vw] rounded-full blur-[100px]"
        style={{
          background: 'radial-gradient(circle, rgba(34,47,91,0.35), transparent 65%)',
          animation: 'fogDrift 70s ease-in-out infinite',
          animationDelay: '-30s',
        }}
      />

      {/* Embers rising from the bottom edge. */}
      {Array.from({ length: EMBER_COUNT }, (_, i) => (
        <span
          key={i}
          data-ember
          className="anim-ambient absolute rounded-full"
          style={{ ...emberStyle(i), animationName: 'emberRise', animationTimingFunction: 'linear', animationIterationCount: 'infinite' }}
        />
      ))}

      {/* Film grain. */}
      <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay" style={{ backgroundImage: NOISE_URI }} />

      {/* Vignette — draws the eye to centre stage. */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 90% at 50% 42%, transparent 55%, rgba(5,4,10,0.55) 100%)' }}
      />
    </div>
  )
}
