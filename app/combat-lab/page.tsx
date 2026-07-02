'use client'
/**
 * /combat-lab — development harness for the combat VFX system.
 * Mounts the real Pixi + GSAP + Howler stack on a mock arena and fires
 * hand-built LogEntry events so each effect can be iterated on live.
 * Not part of the game loop; a workbench for the redesign.
 */
import { forwardRef, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { LogEntry, Side } from '@/types'
import { createPixiStage, type PixiStage } from '@/lib/vfx/PixiStage'
import { createAudio, type AudioBus } from '@/lib/vfx/audio'
import { choreograph } from '@/lib/vfx/choreograph'

const LMAX = 120
const RMAX = 200

type SpellDef = { label: string; emoji: string; group: string; make: () => LogEntry }

const E = (p: { action: string; type: LogEntry['type']; value?: number; flags?: LogEntry['flags']; targetSide?: Side }): LogEntry => ({
  turn: 1,
  actorId: 'a',
  targetId: 'b',
  targetSide: p.targetSide ?? 'right',
  actorSide: (p.targetSide ?? 'right') === 'left' ? 'right' : 'left',
  value: p.value,
  flags: p.flags ?? [],
  action: p.action,
  type: p.type,
})

const SPELLS: SpellDef[] = [
  { label: 'Colpo', emoji: '⚔️', group: 'Attacchi', make: () => E({ action: 'Stupeficium', type: 'Attacco', value: 22 }) },
  { label: 'Critico', emoji: '💥', group: 'Attacchi', make: () => E({ action: 'Stupeficium', type: 'Attacco', value: 46, flags: ['crit'] }) },
  { label: 'Maledizione', emoji: '🟣', group: 'Incantesimi', make: () => E({ action: 'Avada Kedavra', type: 'Attacco', value: 34 }) },
  { label: 'Controllo', emoji: '🔴', group: 'Incantesimi', make: () => E({ action: 'Confundo', type: 'Controllo', value: 16 }) },
  { label: 'Incendio', emoji: '🔥', group: 'Incantesimi', make: () => E({ action: 'Incendio', type: 'Attacco', value: 18, flags: ['dot'] }) },
  { label: 'Stun', emoji: '⚡', group: 'Controllo', make: () => E({ action: 'Petrificus Totalus', type: 'Controllo', value: 10, flags: ['stun'] }) },
  { label: 'Disarmo', emoji: '🪄', group: 'Controllo', make: () => E({ action: 'Expelliarmus', type: 'Attacco', value: 8 }) },
  { label: 'Protego', emoji: '🛡️', group: 'Difesa', make: () => E({ action: 'Protego', type: 'Difesa', flags: ['block'], targetSide: 'left' }) },
  { label: 'Schiva', emoji: '💨', group: 'Difesa', make: () => E({ action: 'Stupeficium', type: 'Attacco', value: 20, flags: ['dodge'] }) },
  { label: 'Cura', emoji: '✨', group: 'Supporto', make: () => E({ action: 'Episkey', type: 'Cura', value: 40, flags: ['heal'], targetSide: 'left' }) },
  { label: 'Esecuzione', emoji: '⚰️', group: 'Climax', make: () => E({ action: 'Sectumsempra', type: 'Attacco', value: 70, flags: ['crit', 'kill'] }) },
]

const GROUPS = ['Attacchi', 'Incantesimi', 'Controllo', 'Difesa', 'Supporto', 'Climax']

export default function CombatLab() {
  const arenaRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<PixiStage | null>(null)
  const audioRef = useRef<AudioBus | null>(null)
  const bustRef = useRef<Record<Side, HTMLDivElement | null>>({ left: null, right: null })

  const [hp, setHp] = useState({ left: LMAX, right: RMAX })
  const [reduced, setReduced] = useState(false)
  const [audioOn, setAudioOn] = useState(false)
  const [ready, setReady] = useState(false)

  // Mount the Pixi stage + audio bus (browser only).
  useEffect(() => {
    const el = arenaRef.current
    if (!el) return
    let disposed = false
    let stage: PixiStage | null = null

    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)

    createPixiStage(el).then((s) => {
      if (disposed) { s.destroy(); return }
      stage = s
      stageRef.current = s
      setReady(true)
    })
    createAudio().then((a) => {
      if (disposed) { a.dispose(); return }
      audioRef.current = a
      a.setMuted(true)
    })

    return () => {
      disposed = true
      stage?.destroy()
      stageRef.current = null
      audioRef.current?.dispose()
      audioRef.current = null
    }
  }, [])

  useEffect(() => { audioRef.current?.setMuted(!audioOn) }, [audioOn])

  const centerOf = useCallback((side: Side) => {
    const arena = arenaRef.current
    const el = bustRef.current[side]
    if (!arena || !el) return null
    const a = arena.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    return { x: ((r.left + r.width / 2 - a.left) / a.width) * 100, y: ((r.top + r.height / 2 - a.top) / a.height) * 100 }
  }, [])

  const react = useCallback((side: Side | undefined, kind: 'hit' | 'crit' | 'heal' | 'block' | 'dodge') => {
    if (!side) return
    const el = bustRef.current[side]
    const flash = el?.querySelector<HTMLDivElement>('[data-flash]')

    if (el && !reduced) {
      if (kind === 'dodge') {
        el.animate(
          [{ transform: 'translateX(0)', filter: 'blur(0)' }, { transform: 'translateX(-34px)', filter: 'blur(2px)', opacity: 0.65, offset: 0.5 }, { transform: 'translateX(0)', filter: 'blur(0)' }],
          { duration: 460, easing: 'cubic-bezier(.3,0,.2,1)' },
        )
      } else {
        el.animate(
          [{ transform: 'scale(1,1)' }, { transform: 'scale(1.13,.87)', offset: 0.25 }, { transform: 'scale(.95,1.06)', offset: 0.55 }, { transform: 'scale(1,1)' }],
          { duration: 440, easing: 'cubic-bezier(.22,1,.36,1)' },
        )
      }
    }
    if (flash && kind !== 'dodge' && !reduced) {
      const col = kind === 'crit' ? 'rgba(246,230,168,.85)' : kind === 'heal' ? 'rgba(121,230,160,.7)' : kind === 'block' ? 'rgba(142,201,255,.7)' : 'rgba(255,120,120,.7)'
      flash.style.background = `radial-gradient(circle, ${col}, transparent 72%)`
      flash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0 }], { duration: 300, easing: 'ease-out' })
    }

    setHp((h) => {
      if (kind === 'heal') return { ...h, [side]: Math.min(side === 'left' ? LMAX : RMAX, h[side] + 40) }
      if (kind === 'hit' || kind === 'crit') return { ...h, [side]: Math.max(0, h[side] - (kind === 'crit' ? 44 : 22)) }
      return h
    })
  }, [reduced])

  const fire = useCallback((entry: LogEntry) => {
    const stage = stageRef.current
    if (!stage) return
    const from = entry.actorSide ? centerOf(entry.actorSide) : null
    const to = entry.targetSide ? centerOf(entry.targetSide) : null
    choreograph(stage, { entry, from, to, budgetMs: 1100, reduced, audio: audioOn ? audioRef.current : null, onImpact: react })
  }, [centerOf, reduced, audioOn, react])

  const playAll = useCallback(() => {
    setHp({ left: LMAX, right: RMAX })
    SPELLS.forEach((s, i) => setTimeout(() => fire(s.make()), i * 1300))
  }, [fire])

  const bar = (side: Side) => {
    const max = side === 'left' ? LMAX : RMAX
    const ratio = Math.max(0, hp[side] / max)
    const col = ratio > 0.5 ? 'linear-gradient(90deg,#7CFC9B,#37b26b)' : ratio > 0.25 ? 'linear-gradient(90deg,#FFD37D,#e0a13a)' : 'linear-gradient(90deg,#FF8B6B,#c0392b)'
    return (
      <div className="relative h-3 w-40 max-w-[45vw] overflow-hidden rounded-full border border-[#f6e6a8]/25 bg-black/55">
        {/* ghost (crimson) lags behind */}
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${ratio * 100}%`, background: 'linear-gradient(90deg,#e05a4a,#7a1f1f)', transition: 'width .5s cubic-bezier(.4,0,.2,1) .22s' }} />
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${ratio * 100}%`, background: col, transition: 'width .18s cubic-bezier(.3,.9,.3,1)' }} />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] font-bold text-black/80 tabular-nums">{Math.round(hp[side])}</span>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#14100b] px-4 py-8 text-[#f3ead6]" style={{ backgroundImage: 'radial-gradient(1000px 500px at 50% -10%, rgba(202,162,74,.10), transparent 60%), radial-gradient(800px 400px at 50% 120%, rgba(90,63,214,.10), transparent 60%)' }}>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.34em] text-[#caa24a]">Combat VFX · Laboratorio</p>
          <h1 className="mt-1 font-serif text-4xl" style={{ backgroundImage: 'linear-gradient(120deg,#8a6420,#caa24a 32%,#f6e6a8 50%,#caa24a 68%,#8a6420)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Il Duello</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-[#c9b998]">Pixi + GSAP + Howler dal vivo. Nessuna camera shake — l'impatto è reazione del mondo. Premi un incantesimo.</p>
        </header>

        {/* ARENA */}
        <div
          ref={arenaRef}
          className="relative overflow-hidden rounded-2xl border border-[#caa24a]/40"
          style={{ height: 420, background: 'radial-gradient(120% 90% at 50% 12%, rgba(154,123,255,.10), transparent 55%), linear-gradient(180deg,#241a10,#160f08)', boxShadow: 'inset 0 0 120px rgba(0,0,0,.7)' }}
        >
          {/* duelists */}
          <Duelist ref={(el) => { bustRef.current.left = el }} side="left" emoji="🦁" name="Harry" bar={bar('left')} />
          <Duelist ref={(el) => { bustRef.current.right = el }} side="right" emoji="🐍" name="Voldemort" bar={bar('right')} />
          {!ready && <div className="absolute inset-0 grid place-items-center font-mono text-xs text-[#caa24a]/70">montaggio WebGL…</div>}
          {/* Pixi canvas is appended here as an absolute inset-0 overlay */}
        </div>

        {/* TOOLBAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#caa24a]/40 bg-[#20180f] px-4 py-3">
          <button onClick={playAll} className="rounded-lg bg-gradient-to-b from-[#f6e6a8] to-[#caa24a] px-5 py-2.5 font-serif text-[15px] font-semibold text-[#1a1206] shadow-lg transition hover:brightness-105">▶ Sequenza completa</button>
          <div className="flex items-center gap-5 font-mono text-[11px] text-[#c9b998]">
            <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={audioOn} onChange={(e) => setAudioOn(e.target.checked)} className="accent-[#caa24a]" /> Audio</label>
            <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} className="accent-[#caa24a]" /> Riduci movimento</label>
          </div>
          <button onClick={() => setHp({ left: LMAX, right: RMAX })} className="rounded-lg border border-[#caa24a]/50 px-4 py-2 text-[13px] text-[#c9b998] transition hover:border-[#caa24a] hover:text-[#f3ead6]">↺ Ripristina HP</button>
        </div>

        {/* SPELL DECK */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {GROUPS.map((g) => (
            <div key={g} className="flex flex-col gap-2 rounded-xl border border-[#caa24a]/25 bg-[#20180f] p-3">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#caa24a]">{g}</h3>
              {SPELLS.filter((s) => s.group === g).map((s) => (
                <button
                  key={s.label}
                  onClick={() => fire(s.make())}
                  disabled={!ready}
                  className="flex items-center gap-2.5 rounded-lg border border-[#caa24a]/20 bg-black/25 px-3 py-2 text-left text-[13.5px] transition hover:-translate-y-px hover:border-[#caa24a]/50 hover:bg-[#caa24a]/10 disabled:opacity-40"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-md border border-[#caa24a]/20 bg-black/40 text-[15px]">{s.emoji}</span>
                  {s.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

const Duelist = forwardRef<HTMLDivElement, { side: Side; emoji: string; name: string; bar: ReactNode }>(
  function Duelist({ side, emoji, name, bar }, ref) {
    const grad = side === 'left' ? 'radial-gradient(circle at 50% 34%, #b1442f, #5a140c 70%, #2a0a06)' : 'radial-gradient(circle at 50% 34%, #2f9c63, #0f4c2c 70%, #06251a)'
    return (
      <div className={`absolute bottom-[16%] flex flex-col items-center gap-3 ${side === 'left' ? 'left-[8%]' : 'right-[8%]'}`}>
        {/* the ref/anchor the FX measures; also the element that squashes */}
        <div ref={ref} data-unit-key={`${side}:${name.toLowerCase()}`} className="relative grid h-24 w-24 place-items-center rounded-full will-change-transform sm:h-28 sm:w-28" style={{ background: grad, boxShadow: 'inset 0 0 26px rgba(0,0,0,.6), 0 0 24px rgba(202,162,74,.22)' }}>
          <span className="text-5xl">{emoji}</span>
          <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-[#f6e6a8]/40" />
          <div data-flash className="pointer-events-none absolute inset-0 rounded-full opacity-0" />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="font-serif text-sm">{name}</span>
          {bar}
        </div>
      </div>
    )
  },
)
