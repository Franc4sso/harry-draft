'use client'
import { useEffect, useState } from 'react'
import { animate, motion, useReducedMotion } from 'framer-motion'
import { Trophy, Crown, Heart, Swords } from 'lucide-react'
import type { BattleResult, DraftedWizard } from '@/types'
import { Frame } from '@/components/ui/Frame'
import { Parchment } from '@/components/ui/Parchment'
import { SealButton } from '@/components/ui/SealButton'
import { FoilText, EASE_CINEMATIC } from '@/components/ui/motion'
import { SIGNAL_COLOR, SIGNAL_ICON } from '@/data/duos'
import { spoilNeedsTarget, type Spoil, type SpoilChoice } from '@/game/engine/spoils'
import { isDead, tagsOf } from '@/game/engine/roster'
import { displayName } from '@/lib/displayName'

/** Number that counts up from 0 on mount (static under reduced motion). */
function CountUp({ value, delay = 0 }: { value: number; delay?: number }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(reduce ? value : 0)
  useEffect(() => {
    if (reduce) return
    const controls = animate(0, value, {
      duration: 0.8,
      delay,
      ease: EASE_CINEMATIC,
      onUpdate: v => setShown(Math.round(v)),
    })
    return () => controls.stop()
  }, [value, delay, reduce])
  return <span className="tabular-nums">{shown}</span>
}

/** One-shot burst of gold sparks radiating from the trophy. */
function GoldBurst() {
  const reduce = useReducedMotion()
  if (reduce) return null
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2
        const dist = 70 + ((i * 37) % 30)
        return (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{ background: i % 3 === 0 ? '#f3e6a0' : '#caa24a', boxShadow: '0 0 8px rgba(202,162,74,0.8)' }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.9, delay: 0.25, ease: 'easeOut' }}
          />
        )
      })}
    </span>
  )
}

// Colore d'accento per carta: il Marchio prende il colore del SEGNALE che concede (lo stesso
// che il giocatore vede nel DuoTracker e sulle card), così la carta "parla la lingua" dei Duo.
const ACCENT_ALLENAMENTO = '#f5c451'
const ACCENT_RISTORO = '#7CFC9B'
function spoilAccent(s: Spoil): string {
  return s.kind === 'marchio' ? SIGNAL_COLOR[s.tag]
    : s.kind === 'allenamento' ? ACCENT_ALLENAMENTO : ACCENT_RISTORO
}

/** Chi può ricevere questa Spoglia. Un Marchio su chi ha già il tag sarebbe un no-op nel
 *  motore (vedi `applySpoil`): non lo offriamo, così la UI non promette scelte finte. */
function eligibleTargets(s: Spoil, team: DraftedWizard[]): DraftedWizard[] {
  const living = team.filter(d => !isDead(d))
  return s.kind === 'marchio' ? living.filter(d => !tagsOf(d).includes(s.tag)) : living
}

/** Una delle tre Spoglie, come carta scegliibile. */
function SpoilCard({ spoil, selected, onSelect }: { spoil: Spoil; selected: boolean; onSelect: () => void }) {
  const color = spoilAccent(spoil)
  return (
    <Frame
      variant="card"
      className="h-full cursor-pointer transition-transform duration-200 hover:-translate-y-1.5"
      innerClassName="relative flex h-full flex-col items-center gap-2 p-5 text-center"
      style={{ boxShadow: selected ? `0 0 0 2px ${color}, 0 0 26px ${color}66` : `0 0 18px ${color}22` }}
      data-testid={`spoil-card-${spoil.id}`}
      data-spoil-kind={spoil.kind}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(120% 80% at 50% 0%, ${color}1f, transparent 62%)` }}
      />
      <span
        aria-hidden
        className="relative grid h-14 w-14 place-items-center rounded-full border text-2xl"
        style={{ borderColor: `${color}66`, background: `${color}1a`, color }}
      >
        {spoil.kind === 'marchio'
          ? SIGNAL_ICON[spoil.tag]
          : spoil.kind === 'allenamento'
            ? <Swords size={24} />
            : <Heart size={24} />}
      </span>

      <h3 className="relative font-display text-base leading-tight">{spoil.title}</h3>
      <p className="relative text-sm leading-relaxed text-white/75">{spoil.desc}</p>

      {/* IL PERCHÉ, scritto: è il motivo per cui questa fetta esiste — il Duo smette di essere
          una sorpresa e diventa un obiettivo che il giocatore può PUNTARE. */}
      {spoil.kind === 'marchio' && spoil.completes && (
        <span
          data-testid="spoil-completes"
          data-duo={spoil.completes.id}
          className="relative mt-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide"
          style={{ borderColor: '#f5c45180', background: 'rgba(245,196,81,0.14)', color: '#f7dfa4' }}
        >
          <span aria-hidden>✦</span> Completa {spoil.completes.name.toUpperCase()}
        </span>
      )}
    </Frame>
  )
}

/** Between-battle interstitial after the player wins a regular stage. */
export function VictoryScreen({
  result, mvpName, battleNumber, enemyCount, bossNext, onNext, fallenNames = [],
  spoils, team = [], onChooseSpoil,
}: {
  result: BattleResult
  mvpName: string
  battleNumber: number
  enemyCount: number
  bossNext: boolean
  onNext: () => void
  /** Names of player wizards permanently lost this battle. */
  fallenNames?: string[]
  /** LE SPOGLIE DELLA VITTORIA — le tre carte fra cui scegliere. Assenti (campagna: nodi
   *  élite/boss; modalità infinita: sempre — vedi §6 del piano) ⇒ la schermata resta il
   *  vecchio "Prosegui" e `onNext` avanza. */
  spoils?: Spoil[]
  /** Squadra viva, per scegliere il bersaglio delle Spoglie che lo richiedono. */
  team?: DraftedWizard[]
  /** Applica la scelta e prosegue. La scelta È l'avanzamento: niente "Prosegui" separato. */
  onChooseSpoil?: (choice: SpoilChoice) => void
}) {
  const reduce = useReducedMotion()
  const [pickedId, setPickedId] = useState<string | null>(null)
  const survivors = result.finalSnapshot.filter(s => s.alive).length

  const choosing = Boolean(spoils && spoils.length > 0 && onChooseSpoil)
  const picked = spoils?.find(s => s.id === pickedId) ?? null
  const targets = picked ? eligibleTargets(picked, team) : []

  const onSelectSpoil = (s: Spoil) => {
    // Le Spoglie senza bersaglio (Ristoro) si applicano subito; le altre chiedono su CHI.
    if (spoilNeedsTarget(s)) { setPickedId(s.id); return }
    onChooseSpoil?.({ spoilId: s.id })
  }

  return (
    <main data-testid="victory-screen" className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
      <div className={`mx-auto flex w-full flex-col items-center gap-6 ${choosing ? 'max-w-4xl' : 'max-w-sm gap-8'}`}>
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          className="relative flex flex-col items-center gap-2"
        >
          <GoldBurst />
          <motion.span
            initial={reduce ? false : { rotate: -8, scale: 0.7 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.15 }}
          >
            <Trophy size={choosing ? 36 : 48} className="text-amber-300" style={{ filter: 'drop-shadow(0 0 18px rgba(245,196,81,0.55))' }} />
          </motion.span>
          <FoilText as="h1" className={`font-display font-bold ${choosing ? 'text-3xl' : 'text-4xl'}`}>Vittoria!</FoilText>
          <p className="text-white/50 text-sm">
            Sfida {battleNumber} di {enemyCount} superata
          </p>
        </motion.div>

        {/* LA SCELTA — il protagonista della schermata. */}
        {choosing && (
          <motion.section
            data-testid="spoils-choice"
            initial={reduce ? false : { opacity: 0, y: 18, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.5, delay: 0.3, ease: EASE_CINEMATIC }}
            className="flex w-full flex-col items-center gap-4"
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] uppercase tracking-[0.25em] text-white/45">Le spoglie della vittoria</span>
              <FoilText as="h2" className="font-display text-2xl font-bold">Scegline una</FoilText>
            </div>

            <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-3">
              {spoils!.map(s => (
                <SpoilCard key={s.id} spoil={s} selected={pickedId === s.id} onSelect={() => onSelectSpoil(s)} />
              ))}
            </div>

            {picked && (
              <div data-testid="spoil-targets" className="w-full">
                <p className="mb-2 text-center text-[10px] uppercase tracking-[0.25em] text-white/45">
                  {picked.kind === 'marchio' ? 'Marchia quale mago?' : 'Allena quale mago?'}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {targets.map(dw => (
                    <button
                      key={dw.wizard.id}
                      data-testid={`spoil-target-${dw.wizard.id}`}
                      onClick={() => onChooseSpoil?.({ spoilId: picked.id, wizardId: dw.wizard.id })}
                      className="rounded-lg border px-3 py-2 text-sm transition-colors hover:border-white/50"
                      style={{ borderColor: 'rgba(255,255,255,0.18)' }}
                    >
                      {displayName(dw)}
                    </button>
                  ))}
                  {targets.length === 0 && (
                    <p className="text-sm text-white/50">Nessun mago può ricevere questa Spoglia.</p>
                  )}
                </div>
              </div>
            )}
          </motion.section>
        )}

        {/* Il referto della battaglia — resta, ma subordinato alla scelta. */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 18, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.55, delay: 0.35, ease: EASE_CINEMATIC }}
          className={choosing ? 'w-full max-w-md' : 'w-full'}
        >
          <Frame variant="panel" innerClassName="relative rounded-[11px] p-0">
            <Parchment className="absolute inset-0 rounded-[11px]" aria-hidden />
            <div className="relative flex flex-col gap-3 rounded-[11px] p-5">
              <div className="flex items-center gap-2 text-amber-200">
                <Crown size={18} />
                <span className="text-sm">
                  MVP: <span className="font-display">{mvpName}</span>
                </span>
              </div>
              <div className="flex justify-between text-sm text-white/70">
                <span>Turni</span><CountUp value={result.turns} delay={0.55} />
              </div>
              <div className="flex justify-between text-sm text-white/70">
                <span>Maghi superstiti</span><CountUp value={survivors} delay={0.7} />
              </div>
              {fallenNames.length > 0 && (
                <div className="flex flex-col gap-1 text-sm text-rose-300/90 border-t border-white/10 pt-2">
                  <span className="text-rose-300">Caduti per sempre</span>
                  <span className="text-white/70">{fallenNames.join(', ')}</span>
                </div>
              )}
            </div>
          </Frame>
        </motion.div>

        {/* Senza Spoglie la schermata resta com'era: un solo bottone di avanzamento. */}
        {!choosing && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.75, ease: EASE_CINEMATIC }}
          >
            <SealButton onClick={onNext}>
              {bossNext ? 'Affronta il Boss' : 'Prossima sfida'}
            </SealButton>
          </motion.div>
        )}
      </div>
    </main>
  )
}
