'use client'
/**
 * /combat-lab — development harness for the combat redesign.
 * A full cinematic combat SCENE (backdrop, HUD, initiative, callouts, boss
 * treatment) driven by the real Pixi + GSAP + Howler VFX stack. Hand-built
 * LogEntry events let every effect + scene beat be iterated on live.
 * Not part of the game loop; a workbench for the redesign.
 */
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import type { LogEntry, Side, Spell } from '@/types'
import { SPELLS as GAME_SPELLS } from '@/data/spells'
import { createPixiStage, type PixiStage } from '@/lib/vfx/PixiStage'
import { createAudio, type AudioBus } from '@/lib/vfx/audio'
import { choreograph } from '@/lib/vfx/choreograph'
import { HEAT, HEAT_ZERO, heatNext, heatAmp, type HeatState } from '@/lib/vfx/crescendo'
import { spellVfxFor } from '@/lib/vfx/spellVfx'

const LMAX = 120
const RMAX = 220
type House = 'gryf' | 'slyth'
type ImpactKind = 'hit' | 'crit' | 'heal' | 'block' | 'dodge'

const E = (p: { action: string; type: LogEntry['type']; value?: number; flags?: LogEntry['flags']; targetSide?: Side }): LogEntry => ({
  turn: 1, actorId: 'a', targetId: 'b',
  targetSide: p.targetSide ?? 'right',
  actorSide: (p.targetSide ?? 'right') === 'left' ? 'right' : 'left',
  value: p.value, flags: p.flags ?? [], action: p.action, type: p.type,
})

const EMOJI: Record<string, string> = {
  base_attack: '⚔️', expelliarmus: '🪄', stupeficium: '⚡', sectumsempra: '🩸', bombarda: '💣',
  incendio: '🔥', avada: '💀', reducto: '💥', diffindo: '✂️', confringo: '🧨', flipendo: '🌀',
  oppugno: '🎯', fiendfyre: '🔥', serpensortia: '🐍', crucio: '🌩️', imperio: '👁️', petrificus: '🗿',
  levicorpus: '🙃', confundo: '😵', langlock: '🤐', tarantallegra: '💃', glacius: '❄️', silencio: '🔇',
  episkey: '✨', vulnera: '💚', rennervate: '🌟', anapneo: '🫧', ferula: '🩹', colletivo_scudo: '🛡️',
  incitamento: '📣', protego: '🛡️', protego_maxima: '🛡️', fianto: '🧱', salvio: '🌬️', riddikulus: '😄',
  expecto: '🦌', aegis: '🔰',
}
const TYPE_ORDER: LogEntry['type'][] = ['Attacco', 'Controllo', 'Cura', 'Difesa']

/** Scenario "Streak": la catena che il crescendo esiste per servire — crit → Duo → esecuzione,
 *  poi due frame fiacchi per vedere la stanza raffreddarsi. Il banco di taratura dei pesi. */
const STREAK: LogEntry[] = [
  E({ action: 'Stupeficium', type: 'Attacco', value: 22 }),
  E({ action: 'Sectumsempra', type: 'Attacco', value: 38, flags: ['crit'] }),
  E({ action: 'Confringo', type: 'Attacco', value: 52, flags: ['crit', 'duo'] }),
  E({ action: 'Avada Kedavra', type: 'Attacco', value: 130, flags: ['crit', 'kill'] }),
  E({ action: 'Stupeficium', type: 'Attacco', value: 18, flags: ['dodge'] }),
  E({ action: 'Stupeficium', type: 'Attacco', value: 0, flags: ['wait'] }),
]
const SHOWCASE = ['stupeficium', 'sectumsempra', 'incendio', 'avada', 'bombarda', 'glacius', 'serpensortia', 'crucio', 'protego', 'expecto', 'vulnera']

function entryFromSpell(sp: Spell, crit: boolean): LogEntry {
  const target: Side = sp.type === 'Cura' || sp.type === 'Difesa' ? 'left' : 'right'
  const flags: LogEntry['flags'] = []
  if (crit && (sp.type === 'Attacco' || sp.type === 'Controllo')) flags.push('crit')
  const value = sp.heal ?? Math.round((sp.power ?? 1.2) * 16)
  return E({ action: sp.name, type: sp.type, value, targetSide: target, flags })
}

function calloutFor(entry: LogEntry, kind: ImpactKind): { text: string; tone: string } | null {
  if (kind === 'crit' && entry.flags.includes('kill')) return { text: 'ESECUZIONE', tone: '#e05a4a' }
  if (kind === 'crit') return { text: 'CRITICO', tone: '#f6e6a8' }
  if (kind === 'block') return { text: 'PARATO', tone: '#8ec9ff' }
  if (kind === 'dodge') return { text: 'SCHIVA', tone: '#8ec9ff' }
  if (kind === 'heal') return { text: 'CURA', tone: '#79e6a0' }
  if (entry.flags.includes('dot')) return { text: 'VELENO', tone: '#a9de5c' }
  return null
}

export default function CombatLab() {
  const arenaRef = useRef<HTMLDivElement>(null)
  const fxDomRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<PixiStage | null>(null)
  const audioRef = useRef<AudioBus | null>(null)
  const bustRef = useRef<Record<Side, HTMLDivElement | null>>({ left: null, right: null })

  const [hp, setHp] = useState({ left: LMAX, right: RMAX })
  const [turn, setTurn] = useState(0)
  const [callout, setCallout] = useState<{ text: string; tone: string; key: number } | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [reduced, setReduced] = useState(false)
  const [audioOn, setAudioOn] = useState(false)
  const [crit, setCrit] = useState(false)
  const [ready, setReady] = useState(false)
  // Crescendo: lo stato del calore vive in un ref (serve SUBITO dentro `fire`, prima del render)
  // e in uno state solo per la lettura numerica a schermo.
  const heatRef = useRef<HeatState>(HEAT_ZERO)
  const [heat, setHeat] = useState(0)
  const evKey = useRef(0)

  useEffect(() => {
    const el = arenaRef.current
    if (!el) return
    let disposed = false
    let stage: PixiStage | null = null
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    createPixiStage(el).then((s) => { if (disposed) { s.destroy(); return } stage = s; stageRef.current = s; setReady(true) })
    createAudio().then((a) => { if (disposed) { a.dispose(); return } audioRef.current = a; a.setMuted(true) })
    return () => { disposed = true; stage?.destroy(); stageRef.current = null; audioRef.current?.dispose(); audioRef.current = null }
  }, [])

  useEffect(() => { audioRef.current?.setMuted(!audioOn) }, [audioOn])

  const centerOf = useCallback((side: Side) => {
    const arena = arenaRef.current, el = bustRef.current[side]
    if (!arena || !el) return null
    const a = arena.getBoundingClientRect(), r = el.getBoundingClientRect()
    return { x: ((r.left + r.width / 2 - a.left) / a.width) * 100, y: ((r.top + r.height / 2 - a.top) / a.height) * 100 }
  }, [])

  const floatNumber = useCallback((side: Side, text: string, tone: ImpactKind) => {
    const c = centerOf(side), layer = fxDomRef.current
    if (!c || !layer) return
    const n = document.createElement('div')
    n.textContent = text
    const big = tone === 'crit'
    n.style.cssText = `position:absolute;left:${c.x}%;top:${c.y}%;transform:translate(-50%,-50%);font-family:var(--font-serif,Georgia,serif);font-weight:700;pointer-events:none;white-space:nowrap;text-shadow:0 2px 8px rgba(0,0,0,.7);z-index:12;` +
      (tone === 'crit' ? 'color:#f6e6a8;font-size:44px;text-shadow:0 0 18px rgba(246,230,168,.8),0 3px 8px rgba(0,0,0,.7);'
        : tone === 'heal' ? 'color:#79e6a0;font-size:28px;'
        : tone === 'dodge' || tone === 'block' ? 'color:#8ec9ff;font-size:22px;font-style:italic;'
        : 'color:#fff2d8;font-size:30px;')
    layer.appendChild(n)
    const dx = (Math.random() * 2 - 1) * 18, rise = big ? -90 : -66
    n.animate([
      { transform: `translate(-50%,-50%) translate(${dx}px,6px) scale(.4)`, opacity: 0 },
      { transform: `translate(-50%,-50%) translate(${dx}px,-10px) scale(${big ? 1.5 : 1.15})`, opacity: 1, offset: 0.2 },
      { transform: `translate(-50%,-50%) translate(${dx}px,${rise * 0.7}px) scale(1)`, opacity: 1, offset: 0.72 },
      { transform: `translate(-50%,-50%) translate(${dx}px,${rise}px) scale(.9)`, opacity: 0 },
    ], { duration: reduced ? 1 : big ? 1150 : 880, easing: 'cubic-bezier(.22,1,.36,1)' })
    setTimeout(() => n.remove(), 1250)
  }, [centerOf, reduced])

  const handleImpact = useCallback((entry: LogEntry, side: Side | undefined, kind: ImpactKind) => {
    if (!side) return
    const el = bustRef.current[side]
    const flash = el?.querySelector<HTMLDivElement>('[data-flash]')
    if (el && !reduced) {
      if (kind === 'dodge') el.animate([{ transform: 'translateX(0)', filter: 'blur(0)' }, { transform: 'translateX(-34px)', filter: 'blur(2px)', opacity: 0.65, offset: 0.5 }, { transform: 'translateX(0)', filter: 'blur(0)' }], { duration: 460, easing: 'cubic-bezier(.3,0,.2,1)' })
      else el.animate([{ transform: 'scale(1,1)' }, { transform: 'scale(1.13,.87)', offset: 0.25 }, { transform: 'scale(.95,1.06)', offset: 0.55 }, { transform: 'scale(1,1)' }], { duration: 440, easing: 'cubic-bezier(.22,1,.36,1)' })
    }
    if (flash && kind !== 'dodge' && !reduced) {
      const col = kind === 'crit' ? 'rgba(246,230,168,.85)' : kind === 'heal' ? 'rgba(121,230,160,.7)' : kind === 'block' ? 'rgba(142,201,255,.7)' : 'rgba(255,120,120,.7)'
      flash.style.background = `radial-gradient(circle, ${col}, transparent 72%)`
      flash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0 }], { duration: 300, easing: 'ease-out' })
    }
    // floating number
    const v = entry.value ?? 0
    if (kind === 'heal') floatNumber(side, `+${v}`, 'heal')
    else if (kind === 'dodge') floatNumber(side, 'mancato', 'dodge')
    else if (kind === 'block') floatNumber(side, 'parato', 'block')
    else if (v > 0) floatNumber(side, `-${v}`, kind === 'crit' ? 'crit' : 'hit')
    // callout
    const co = calloutFor(entry, kind)
    if (co) setCallout({ ...co, key: ++evKey.current })
    // hp
    setHp((h) => {
      if (kind === 'heal') return { ...h, [side]: Math.min(side === 'left' ? LMAX : RMAX, h[side] + v) }
      if ((kind === 'hit' || kind === 'crit') && v > 0) return { ...h, [side]: Math.max(0, h[side] - v) }
      return h
    })
    // log
    setLog((l) => [`${entry.action} → ${kind === 'heal' ? `+${v}` : v > 0 ? `-${v}` : kind}`, ...l].slice(0, 4))
  }, [reduced, floatNumber])

  const onScreen = useCallback((color: number) => {
    const el = screenRef.current
    if (!el || reduced) return
    el.style.background = `radial-gradient(circle, #${color.toString(16).padStart(6, '0')}, transparent 78%)`
    el.animate([{ opacity: 0 }, { opacity: 0.5, offset: 0.12 }, { opacity: 0 }], { duration: 600, easing: 'ease-out' })
  }, [reduced])

  const fire = useCallback((entry: LogEntry) => {
    const stage = stageRef.current
    if (!stage) return
    setTurn((t) => t + 1)
    // Avanza il calore con lo stesso passo puro che usa il replay, così quel che si tara qui
    // è esattamente quel che si vedrà in partita.
    const next = heatNext(heatRef.current, entry)
    heatRef.current = next
    setHeat(next.heat)
    const from = entry.actorSide ? centerOf(entry.actorSide) : null
    const to = entry.targetSide ? centerOf(entry.targetSide) : null
    const tier = spellVfxFor(entry.action)?.tier ?? 1
    const budgetMs = tier >= 3 ? 2000 : tier >= 2 ? 1500 : 1100
    choreograph(stage, { entry, from, to, budgetMs, intensity: next.heat, reduced, audio: audioOn ? audioRef.current : null, onImpact: (side, kind) => handleImpact(entry, side, kind), onScreen })
  }, [centerOf, reduced, audioOn, handleImpact, onScreen])

  const reset = useCallback(() => {
    setHp({ left: LMAX, right: RMAX }); setLog([]); setCallout(null)
    heatRef.current = HEAT_ZERO; setHeat(0)
  }, [])
  const playAll = useCallback(() => {
    reset()
    const list = SHOWCASE.map((id) => GAME_SPELLS.find((s) => s.id === id)).filter((s): s is Spell => !!s)
    list.forEach((sp, i) => setTimeout(() => fire(entryFromSpell(sp, false)), i * 1300))
  }, [fire, reset])

  const playStreak = useCallback(() => {
    reset()
    STREAK.forEach((e, i) => setTimeout(() => fire(e), i * 1150))
  }, [fire, reset])

  const activeSide: Side = turn % 2 === 0 ? 'left' : 'right'

  return (
    <main className="min-h-screen bg-[#14100b] px-4 py-8 text-[#f3ead6]" data-reduced={reduced || undefined} style={{ backgroundImage: 'radial-gradient(1000px 500px at 50% -10%, rgba(202,162,74,.10), transparent 60%), radial-gradient(800px 400px at 50% 120%, rgba(90,63,214,.10), transparent 60%)' }}>
      <style>{`
        @keyframes labFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes labAura{0%,100%{opacity:.3}50%{opacity:.65}}
        @keyframes labCallout{0%{opacity:0;transform:translate(-50%,-50%) scale(2.3);filter:blur(9px)}22%{opacity:1;transform:translate(-50%,-50%) scale(1);filter:blur(0)}76%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.1)}}
        [data-reduced] .labAnim{animation:none!important}
      `}</style>

      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.34em] text-[#caa24a]">Combat · Scena ricomposta</p>
          <h1 className="mt-1 font-serif text-4xl" style={{ backgroundImage: 'linear-gradient(120deg,#8a6420,#caa24a 32%,#f6e6a8 50%,#caa24a 68%,#8a6420)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Il Duello</h1>
        </header>

        {/* ===== ARENA ===== */}
        <div ref={arenaRef} className="relative overflow-hidden rounded-2xl border border-[#caa24a]/40" style={{ height: 480, boxShadow: 'inset 0 1px 0 rgba(246,230,168,.08), 0 40px 90px -40px rgba(0,0,0,.9)' }}>
          {/* backdrop */}
          <div aria-hidden className="absolute inset-0 z-0" style={{ background: 'radial-gradient(130% 100% at 50% 0%, #2a1e12 0%, #191007 55%, #0d0805 100%)' }} />
          <div aria-hidden className="absolute inset-x-0 top-0 z-0 h-1/2" style={{ background: 'radial-gradient(60% 90% at 50% 0%, rgba(154,123,255,.12), transparent 70%)' }} />
          {/* torch pools */}
          <div aria-hidden className="absolute left-[6%] top-[26%] z-0 h-40 w-40 rounded-full blur-2xl" style={{ background: 'radial-gradient(circle, rgba(224,90,74,.16), transparent 70%)' }} />
          <div aria-hidden className="absolute right-[6%] top-[26%] z-0 h-40 w-40 rounded-full blur-2xl" style={{ background: 'radial-gradient(circle, rgba(55,178,107,.14), transparent 70%)' }} />
          {/* floor plane + magic circle */}
          <div aria-hidden className="absolute inset-x-0 bottom-0 z-0 h-[42%]" style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,.6))' }} />
          <div aria-hidden className="labAnim absolute left-1/2 top-[70%] z-0 h-28 w-[78%] -translate-x-1/2 rounded-[50%] border border-[#caa24a]/20" style={{ background: 'radial-gradient(58% 78% at 50% 50%, rgba(202,162,74,.10), transparent 72%)', animation: reduced ? undefined : 'labAura 5s ease-in-out infinite' }} />
          <div aria-hidden className="absolute inset-0 z-0" style={{ boxShadow: 'inset 0 0 160px rgba(0,0,0,.78)' }} />

          {/* initiative */}
          <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#caa24a]/25 bg-black/55 px-3 py-1.5 backdrop-blur-sm">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#caa24a]">Turni</span>
            {Array.from({ length: 5 }).map((_, i) => {
              const isLeft = (turn + i) % 2 === 0
              const active = i === 0
              return <span key={i} className={`grid h-6 w-6 place-items-center rounded-full border text-[13px] transition-all ${active ? 'scale-110 border-[#caa24a] shadow-[0_0_0_2px_rgba(202,162,74,.5)]' : 'border-white/10 opacity-45'}`} style={{ background: 'rgba(0,0,0,.4)' }}>{isLeft ? '🦁' : '🐍'}</span>
            })}
          </div>

          {/* duelists */}
          <Duelist ref={(el) => { bustRef.current.left = el }} side="left" emoji="🦁" name="Harry" sub="Grifondoro" house="gryf" hp={hp.left} max={LMAX} active={activeSide === 'left'} reduced={reduced} />
          <Duelist ref={(el) => { bustRef.current.right = el }} side="right" emoji="🐍" name="Voldemort" sub="Signore Oscuro" house="slyth" boss hp={hp.right} max={RMAX} active={activeSide === 'right'} reduced={reduced} />

          {/* callout */}
          {callout && (
            <div key={callout.key} className="labAnim pointer-events-none absolute left-1/2 top-[40%] z-[11] font-serif text-5xl font-bold uppercase tracking-[0.12em]" style={{ color: callout.tone, textShadow: `0 0 30px ${callout.tone}, 0 4px 12px rgba(0,0,0,.8)`, animation: reduced ? undefined : 'labCallout 1.3s cubic-bezier(.22,1,.36,1)', transform: 'translate(-50%,-50%)' }}>{callout.text}</div>
          )}

          {/* calore della stanza (crescendo) — sotto tutto, opacità guidata dall'intensità */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              background: 'radial-gradient(120% 95% at 50% 60%, rgba(255,138,58,0.85), rgba(224,90,74,0.35) 45%, transparent 74%)',
              mixBlendMode: 'screen',
              opacity: reduced ? 0 : heatAmp(heat).room,
              transition: 'opacity 700ms cubic-bezier(.33,1,.68,1)',
            }}
          />

          {/* lettura numerica del calore — solo nel lab, per tarare pesi e decay */}
          <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-full border border-[#caa24a]/25 bg-black/60 px-3 py-1.5 font-mono text-[10px] text-[#c9b998] backdrop-blur-sm">
            <span className="uppercase tracking-[0.2em] text-[#caa24a]">Calore</span>
            <span className="w-24 overflow-hidden rounded-full bg-white/10" style={{ height: 5 }}>
              <span className="block h-full rounded-full" style={{ width: `${heat * 100}%`, background: 'linear-gradient(90deg,#caa24a,#ff8a3a,#e05a4a)', transition: 'width 400ms ease-out' }} />
            </span>
            <span data-heat-readout className="tabular-nums text-[#f3ead6]">{heat.toFixed(3)}</span>
          </div>

          {/* full-screen ultimate colour wash (tier-3) */}
          <div ref={screenRef} aria-hidden className="pointer-events-none absolute inset-0 z-[8] opacity-0" style={{ mixBlendMode: 'screen' }} />

          {/* DOM fx layer (floating numbers) */}
          <div ref={fxDomRef} aria-hidden className="pointer-events-none absolute inset-0 z-[12]" />

          {/* log */}
          <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-0.5 font-mono text-[10px] text-white/45">
            {log.map((l, i) => <span key={`${l}-${i}`} style={{ opacity: 1 - i * 0.22 }}>{l}</span>)}
          </div>

          {!ready && <div className="absolute inset-0 z-20 grid place-items-center font-mono text-xs text-[#caa24a]/70">montaggio WebGL…</div>}
          {/* Pixi canvas mounts here (z-5) */}
        </div>

        {/* ===== CONTROLS ===== */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#caa24a]/40 bg-[#20180f] px-4 py-3">
          <button onClick={playAll} className="rounded-lg bg-gradient-to-b from-[#f6e6a8] to-[#caa24a] px-5 py-2.5 font-serif text-[15px] font-semibold text-[#1a1206] shadow-lg transition hover:brightness-105">▶ Sequenza completa</button>
          <div className="flex items-center gap-5 font-mono text-[11px] text-[#c9b998]">
            <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={crit} onChange={(e) => setCrit(e.target.checked)} className="accent-[#caa24a]" /> Critico</label>
            <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={audioOn} onChange={(e) => setAudioOn(e.target.checked)} className="accent-[#caa24a]" /> Audio</label>
            <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} className="accent-[#caa24a]" /> Riduci movimento</label>
          </div>
          <button onClick={reset} className="rounded-lg border border-[#caa24a]/50 px-4 py-2 text-[13px] text-[#c9b998] transition hover:border-[#caa24a] hover:text-[#f3ead6]">↺ Ripristina</button>
        </div>

        {/* scenari (esiti di combattimento, non incantesimi) */}
        <div className="flex flex-wrap gap-2">
          <span className="self-center font-mono text-[10px] uppercase tracking-[0.2em] text-[#caa24a]/70">Scenari</span>
          <button onClick={() => fire(E({ action: 'Stupeficium', type: 'Attacco', value: 20, flags: ['dodge'] }))} disabled={!ready} className="rounded-lg border border-[#8ec9ff]/30 bg-black/25 px-3 py-1.5 text-[12.5px] transition hover:border-[#8ec9ff]/60 disabled:opacity-40">💨 Schiva</button>
          <button onClick={() => fire(E({ action: 'Stupeficium', type: 'Attacco', value: 20, flags: ['block'] }))} disabled={!ready} className="rounded-lg border border-[#8ec9ff]/30 bg-black/25 px-3 py-1.5 text-[12.5px] transition hover:border-[#8ec9ff]/60 disabled:opacity-40">🛡️ Parato</button>
          <button onClick={() => fire(E({ action: 'Avada Kedavra', type: 'Attacco', value: 130, flags: ['crit', 'kill'] }))} disabled={!ready} className="rounded-lg border border-[#e05a4a]/40 bg-black/25 px-3 py-1.5 text-[12.5px] transition hover:border-[#e05a4a]/70 disabled:opacity-40">⚰️ Esecuzione</button>
          <button onClick={playStreak} disabled={!ready} className="rounded-lg border border-[#ff8a3a]/50 bg-black/25 px-3 py-1.5 text-[12.5px] transition hover:border-[#ff8a3a] disabled:opacity-40" title="crit → Duo → esecuzione, poi due frame fiacchi: il crescendo che sale e si raffredda">🔥 Streak (crescendo)</button>
          {HEAT.hitStopMax === 0 && <span className="self-center font-mono text-[10px] text-[#c9b998]/50">hit-stop spento (HEAT.hitStopMax = 0)</span>}
        </div>

        {/* tutte le mosse reali, per tipo */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {TYPE_ORDER.map((t) => (
            <div key={t} className="flex flex-col gap-1.5 rounded-xl border border-[#caa24a]/25 bg-[#20180f] p-3">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#caa24a]">{t}</h3>
              {GAME_SPELLS.filter((s) => s.type === t && s.id !== 'base_attack').map((sp) => (
                <button key={sp.id} onClick={() => fire(entryFromSpell(sp, crit))} disabled={!ready} title={sp.desc} className="flex items-center gap-2 rounded-lg border border-[#caa24a]/15 bg-black/25 px-2.5 py-1.5 text-left text-[12.5px] transition hover:-translate-y-px hover:border-[#caa24a]/50 hover:bg-[#caa24a]/10 disabled:opacity-40">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded border border-[#caa24a]/20 bg-black/40 text-[13px]">{EMOJI[sp.id] ?? '✦'}</span>
                  <span className="truncate">{sp.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

/* ---------- scene sub-components ---------- */

function HpBar({ hp, max, house, boss }: { hp: number; max: number; house: House; boss?: boolean }) {
  const ratio = Math.max(0, hp / max)
  const col = ratio > 0.5 ? 'linear-gradient(90deg,#7CFC9B,#37b26b)' : ratio > 0.25 ? 'linear-gradient(90deg,#FFD37D,#e0a13a)' : 'linear-gradient(90deg,#FF8B6B,#c0392b)'
  const accent = house === 'gryf' ? '#e05a4a' : '#37b26b'
  return (
    <div className={`relative overflow-hidden rounded-full border ${boss ? 'h-3.5 w-56' : 'h-3 w-44'} max-w-[46vw]`} style={{ borderColor: `${accent}66`, background: 'rgba(0,0,0,.6)' }}>
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${ratio * 100}%`, background: 'linear-gradient(90deg,#e05a4a,#7a1f1f)', transition: 'width .5s cubic-bezier(.4,0,.2,1) .22s' }} />
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${ratio * 100}%`, background: col, transition: 'width .18s cubic-bezier(.3,.9,.3,1)' }} />
      {/* segment ticks */}
      <div aria-hidden className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent 0, transparent 27px, rgba(0,0,0,.35) 27px, rgba(0,0,0,.35) 28px)' }} />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] font-bold text-black/80 tabular-nums">{Math.round(hp)}</span>
    </div>
  )
}

const Duelist = forwardRef<HTMLDivElement, { side: Side; emoji: string; name: string; sub: string; house: House; boss?: boolean; hp: number; max: number; active: boolean; reduced: boolean }>(
  function Duelist({ side, emoji, name, sub, house, boss, hp, max, active, reduced }, ref) {
    const grad = house === 'gryf' ? 'radial-gradient(circle at 50% 34%, #b1442f, #5a140c 70%, #2a0a06)' : 'radial-gradient(circle at 50% 34%, #2f9c63, #0f4c2c 70%, #06251a)'
    const crest = house === 'gryf' ? '#e05a4a' : '#37b26b'
    const size = boss ? 'h-32 w-32 sm:h-36 sm:w-36 text-6xl' : 'h-24 w-24 sm:h-28 sm:w-28 text-5xl'
    return (
      <div className={`absolute bottom-[20%] z-[2] flex flex-col items-center gap-3 ${side === 'left' ? 'left-[7%]' : 'right-[7%]'}`}>
        {/* boss menace name banner */}
        {boss && <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#e05a4a]/80">✦ Boss ✦</span>}
        <div className="relative">
          <div aria-hidden className="absolute -bottom-3 left-1/2 h-4 w-24 -translate-x-1/2 rounded-[50%]" style={{ background: 'radial-gradient(circle, rgba(0,0,0,.6), transparent 70%)' }} />
          {/* aura (boss ominous / active glow) */}
          <div aria-hidden className="labAnim pointer-events-none absolute -inset-3 rounded-full" style={{ background: boss ? 'radial-gradient(circle, rgba(88,20,120,.5), transparent 70%)' : active ? 'radial-gradient(circle, rgba(202,162,74,.35), transparent 70%)' : 'transparent', animation: reduced || (!boss && !active) ? undefined : 'labAura 3.4s ease-in-out infinite' }} />
          <div
            ref={ref}
            data-unit-key={`${side}:${name.toLowerCase()}`}
            className={`labAnim relative grid place-items-center rounded-full will-change-transform ${size}`}
            style={{ background: grad, boxShadow: `inset 0 0 30px rgba(0,0,0,.6), 0 0 0 3px ${crest}55, 0 0 26px ${boss ? 'rgba(88,20,120,.4)' : 'rgba(202,162,74,.22)'}`, animation: reduced ? undefined : 'labFloat 4.6s ease-in-out infinite' }}
          >
            <span>{emoji}</span>
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-[#f6e6a8]/40" />
            <div data-flash className="pointer-events-none absolute inset-0 rounded-full opacity-0" />
            {active && <div aria-hidden className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[#caa24a] px-1.5 py-px font-mono text-[8px] uppercase tracking-wider text-black">Attivo</div>}
          </div>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="flex items-center gap-1.5 font-serif text-sm"><span className="inline-block h-2 w-2 rotate-45 rounded-[1px]" style={{ background: crest }} />{name}<span className="font-mono text-[9px] text-white/40">{sub}</span></span>
          <HpBar hp={hp} max={max} house={house} boss={boss} />
        </div>
      </div>
    )
  },
)
