'use client'
import { motion, useReducedMotion } from 'framer-motion'
import type { ActiveRelic, DraftedWizard, DuoProgress, DuoSignal, House } from '@/types'
import {
  DUO_SIGNALS_IN_USE, duoProgress, previewDuos, previewDuoLoss,
  signalCount, signalGrade, tier2Contributors, tier2Of,
} from '@/game/engine/duos'
import { trioGateLoss } from '@/game/engine/trios'
import { DuoRecipe } from '@/components/run/DuoPanel'
import { SIGNAL_COLOR, SIGNAL_ICON, SIGNAL_LABEL } from '@/data/duos'
import { ARCHETYPE_EFFECT, tier2BonusText } from '@/lib/archetypes'
import { cn } from '@/lib/cn'

// Linguaggio cromatico: verde = si attiva/avanza, oro = attiva, rosa = si spegne (perdita).
const GOLD = '#d9b65f'
const GREEN = '#3ecb6a'
const ROSE = '#f07272'

/* ── UN SOLO PANNELLO ──────────────────────────────────────────────────────────────────────
 *
 * Fino al 2026-07-25 il draft montava DUE pannelli sullo stesso asse: questo (le Combo) e le
 * «Costellazioni» (le Sinergie). Due liste per una sola domanda. Dal piano "Un solo asse"
 * (Fase 2) c'è una lista sola, letta a DUE PROFONDITÀ:
 *
 *   1. I TUOI SEGNALI (il registro in alto) — quanto sei andato a fondo su ognuno:
 *      `veleno 2/3`. Grado 1 «acceso» (2 maghi o 1 reliquia) → abilita i Duo;
 *      grado 2 «potenziato» (3 maghi, le reliquie NON bastano) → +50% alla parola chiave.
 *      È l'ex-Costellazione, ora detta nella lingua dei segnali.
 *   2. CHE ACCENDONO (la lista sotto) — le combo che quei segnali fanno scattare.
 *
 * Il registro mostra SOLO i segnali che la squadra tocca davvero: a squadra vuota sparisce e il
 * pannello è esattamente il tracker storico. Gli stati sull'hover del candidato sono gli stessi
 * in entrambe le profondità (si accende / potenzia / si spegne / arretra), così il giocatore
 * legge una lingua sola.
 */

/** Ordine canonico del registro a parità di rilevanza: prima i segnali con un grado 2
 *  (i quattro tag), poi i segnali di ruolo. */
const SIGNAL_ORDER: DuoSignal[] = ['veleno', 'esecuzione', 'scudirigen', 'magieOscure', 'taunt', 'supporto', 'controllo']

interface SignalRow {
  signal: DuoSignal
  /** Grado con il candidato considerato incluso (quello che il giocatore sta per comprare). */
  grade: 0 | 1 | 2
  /** Grado PRIMA della pesca considerata (o dello swap, al nodo recluta). */
  before: 0 | 1 | 2
  /** Unità che contribuiscono: maghi col tag per i segnali-tag, maghi del ruolo per i ruoli. */
  have: number
  /** Passi della barra: 3 per i segnali con grado 2, altrimenti la soglia d'accensione. */
  max: number
  /** Il segnale è acceso da una reliquia (grado 1 senza i maghi). */
  byRelic: boolean
  /** Il grado 2 del segnale, se ne ha uno. */
  tier: ReturnType<typeof tier2Of>
}

function signalRows(after: DraftedWizard[], before: DraftedWizard[], relics: ActiveRelic[]): SignalRow[] {
  const rows: SignalRow[] = []
  for (const signal of SIGNAL_ORDER) {
    if (!DUO_SIGNALS_IN_USE.has(signal)) continue
    const tier = tier2Of(signal)
    const count = signalCount(signal, after, relics)
    const have = tier ? tier2Contributors(tier, after).length : count.have
    const row: SignalRow = {
      signal,
      grade: signalGrade(signal, after, relics),
      before: signalGrade(signal, before, relics),
      have,
      max: tier ? tier.need : count.need,
      byRelic: count.byRelic,
      tier,
    }
    // «Sei su questo segnale?» — lo mostra solo se la squadra lo tocca (o lo stava toccando).
    if (row.have > 0 || row.grade > 0 || row.before > 0) rows.push(row)
  }
  return rows
}

/** La barra a scaglioni: un pallino per passo. Nei segnali-tag un trattino separa i due
 *  scaglioni — i primi due pallini ACCENDONO, il rombo dopo il trattino POTENZIA — così la
 *  barra dice da sola che le soglie sono due senza una riga di testo in più. I segnali di
 *  ruolo, che al grado 2 non arrivano, hanno solo pallini. */
function SignalPips({ row, color }: { row: SignalRow; color: string }) {
  return (
    <span className="flex items-center gap-[3px]" aria-hidden>
      {Array.from({ length: row.max }).map((_, i) => {
        const filled = i < Math.min(row.have, row.max) || (row.byRelic && i < 2)
        const isTier2Step = !!row.tier && i === row.max - 1
        return (
          <span key={i} className="flex items-center gap-[3px]">
            {isTier2Step && <span className="h-px w-1.5" style={{ background: 'rgba(255,255,255,0.25)' }} />}
            <span
              className="text-[9px] leading-none"
              style={{ color: filled ? color : 'rgba(255,255,255,0.18)' }}
            >
              {isTier2Step ? '⬥' : '●'}
            </span>
          </span>
        )
      })}
    </span>
  )
}

/** Una riga del registro: il segnale col suo grado, e cosa compra il passo successivo.
 *  `reduce` arriva dal chiamante (un solo `useReducedMotion` per pannello) e spegne il
 *  riordino animato quando il sistema chiede meno movimento. */
function SignalLedgerRow({ row, reduce }: { row: SignalRow; reduce: boolean }) {
  const color = SIGNAL_COLOR[row.signal]
  const up = row.grade > row.before
  const down = row.grade < row.before
  const badge = down ? (row.grade === 0 ? 'si spegne' : 'arretra')
    : up ? (row.grade === 2 ? 'potenzia' : 'si accende')
    : row.grade === 2 ? 'potenziato'
    : row.grade === 1 ? 'acceso'
    : null
  const badgeColor = down ? ROSE : up ? GREEN : GOLD
  const tier = row.tier
  // Il terzo mago è a un passo: è la decisione che il registro esiste per illuminare.
  const oneFromTier2 = !!tier && row.grade < 2 && row.have === tier.need - 1
  // Il contatore mostra sempre lo scaglione IN CORSO, mai quello finale: da spento è "1/2"
  // (la soglia che accende, la stessa delle gemme nelle ricette qui sotto), da acceso in poi
  // è "2/3" (la soglia che potenzia). Un "1/3" a segnale spento farebbe credere che servano
  // tre maghi anche solo per accenderlo.
  const litNeed = tier ? 2 : row.max
  const stepNeed = row.grade === 0 ? litNeed : row.max
  const tone = down ? ROSE : up ? GREEN : row.grade > 0 ? '#f3e6c4' : 'rgba(255,255,255,0.6)'

  return (
    <motion.li
      layout={reduce ? false : 'position'}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      data-testid={`signal-${row.signal}`}
      data-signal={row.signal}
      data-grade={row.grade}
      data-tier2={row.grade === 2 ? '' : undefined}
      data-tier2-incoming={up && row.grade === 2 ? '' : undefined}
      data-grade-down={down ? '' : undefined}
      className="rounded-lg border px-2 py-1"
      style={{
        borderColor: down ? `${ROSE}aa` : up ? `${GREEN}66` : row.grade === 2 ? `${GOLD}66` : 'rgba(255,255,255,0.10)',
        background: down
          ? `linear-gradient(135deg, ${ROSE}1a, transparent 70%)`
          : row.grade === 2
            ? `linear-gradient(135deg, ${GOLD}1a, transparent 70%)`
            : up
              ? `linear-gradient(135deg, ${GREEN}12, transparent 70%)`
              : undefined,
        borderStyle: row.grade === 2 && !down ? 'solid' : 'dashed',
        opacity: row.grade === 0 && !up && !down ? 0.8 : 1,
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[11.5px] font-semibold leading-tight" style={{ color: tone }}>
          <span aria-hidden style={{ color }}>{SIGNAL_ICON[row.signal]}</span> {SIGNAL_LABEL[row.signal]}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <SignalPips row={row} color={color} />
          <span className="tabular-nums text-[10px] font-bold" style={{ color: row.grade > 0 ? badgeColor : 'rgba(255,255,255,0.45)' }}>
            {row.byRelic && row.have < 2 ? 'reliquia' : `${Math.min(row.have, stepNeed)}/${stepNeed}`}
          </span>
        </span>
      </div>

      {badge && (
        <p className="text-[9.5px] font-bold leading-tight" style={{ color: badgeColor }}>· {badge}</p>
      )}

      {tier && row.grade === 2 && (
        <>
          <p data-testid={`tier2-bonus-${row.signal}`} className="mt-0.5 text-[10px] font-semibold leading-snug" style={{ color: up ? GREEN : GOLD }}>
            {tier2BonusText(tier)}
          </p>
          <p className="text-[10px] leading-snug text-[#c9bfa0]">{ARCHETYPE_EFFECT[tier.id]}</p>
        </>
      )}

      {tier && oneFromTier2 && (
        <p data-testid={`tier2-next-${row.signal}`} className="mt-0.5 text-[10px] leading-snug text-[#8fdca0]">
          ↳ 1 mago {SIGNAL_LABEL[row.signal]} → potenziato: {tier2BonusText(tier)}
        </p>
      )}

      {tier && row.byRelic && row.have < tier.need && (
        <p className="mt-0.5 text-[9.5px] leading-snug text-white/40">
          la reliquia accende il segnale, ma non lo potenzia: servono {tier.need} maghi
        </p>
      )}
    </motion.li>
  )
}

/**
 * Pannello UNICO di draft e recluta: i tuoi SEGNALI col loro grado (`veleno 2/3`) e le COMBO
 * che accendono. Una riga per combo — nome, ricetta (due gemme fuse dal nodo "＋") — niente muri
 * di testo. Quando il giocatore considera un candidato (hover/focus), tutto è ricalcolato CON il
 * candidato: le combo si marcano "si attiva" / "avanza" e i segnali "si accende" / "potenzia",
 * così il salto 2→3 si VEDE prima del click. Le righe si riordinano con un'animazione di layout
 * (spenta con reduced-motion) così ciò che si accende sale in cima da sola. L'effetto della combo
 * compare solo quando è (o sta per essere) accesa: è il momento in cui serve.
 */
export function DuoTracker({ picks, considered, relics = [], prevTeam, className }: {
  picks: DraftedWizard[]
  considered?: DraftedWizard | null
  /** Al draft iniziale non esistono reliquie; al nodo recluta sì, e contano per i segnali tag. */
  relics?: ActiveRelic[]
  /** Squadra COMPLETA attuale prima dello swap (solo recruit a squadra piena). Se presente,
   *  il tracker mostra anche cosa lo swap SPEGNE. Assente al draft iniziale → invariato. */
  prevTeam?: DraftedWizard[]
  className?: string
}) {
  const reduce = useReducedMotion()
  const team = considered ? [...picks, considered] : picks
  const progress = duoProgress(team, relics)
  const preview = considered ? previewDuos(picks, relics, considered) : null
  const completes = new Set(preview?.completes.map(d => d.id))
  const advances = new Set(preview?.advances.map(d => d.id))

  const next = considered ? [...picks, considered] : picks
  const loss = prevTeam && considered ? previewDuoLoss(prevTeam, next, relics) : null
  const trioLost = prevTeam && considered ? trioGateLoss(prevTeam, next, relics) : []
  const breaks = new Set(loss?.breaks.map(d => d.id))
  const regresses = new Set(loss?.regresses.map(d => d.id))

  // Il "prima" dei segnali è lo stesso termine di paragone dei Duo: la squadra COMPLETA quando
  // lo swap ne toglie uno (recluta), altrimenti la squadra senza il candidato (draft).
  const beforeTeam = prevTeam && considered ? prevTeam : picks
  const ledger = signalRows(team, beforeTeam, relics)
  // Stessa scala di rilevanza delle combo: prima ciò che si perde, poi ciò che si guadagna.
  const signalRank = (r: SignalRow) =>
    r.grade < r.before ? 0
    : r.grade > r.before ? 1
    : r.grade === 2 ? 2
    : r.grade === 1 ? 3
    : 4
  const ledgerSorted = [...ledger].sort((a, b) => signalRank(a) - signalRank(b))

  const stateOf = (p: DuoProgress) => (p.active ? 'active' : p.missing.length === 1 ? 'near' : 'locked')
  const rank = (p: DuoProgress) =>
    breaks.has(p.duo.id) ? 0
    : completes.has(p.duo.id) ? 1
    : p.active ? 2
    : regresses.has(p.duo.id) ? 3
    : advances.has(p.duo.id) ? 4
    : p.missing.length === 1 ? 5
    : 6
  const sorted = [...progress].sort((a, b) => rank(a) - rank(b))

  return (
    <div className={cn('w-full', className)} data-testid="draft-duo-tracker">
      <div className="mb-1 flex items-center gap-2.5">
        <span aria-hidden className="h-px flex-1" style={{ background: 'linear-gradient(90deg,transparent,rgba(217,182,95,0.45),transparent)' }} />
        <span className="font-display text-[10.5px] uppercase tracking-[0.18em] text-[#d9b65f]">Combo Duo</span>
        <span aria-hidden className="h-px flex-1" style={{ background: 'linear-gradient(90deg,transparent,rgba(217,182,95,0.45),transparent)' }} />
      </div>
      <p className="mb-2.5 text-center text-[9px] leading-snug tracking-[0.05em] text-white/45">
        due segnali accesi = combo in battaglia · il terzo mago potenzia il segnale
      </p>

      {trioLost.length > 0 && (
        <div className="mb-2 space-y-1">
          {trioLost.map(h => (
            <p
              key={h}
              data-testid={`trio-loss-${h}`}
              className="rounded-md border px-2 py-1 text-[10px] font-semibold"
              style={{ borderColor: `${ROSE}aa`, background: `${ROSE}1a`, color: ROSE }}
            >
              ⚠ Trio di {h} si spegne
            </p>
          ))}
        </div>
      )}

      {ledgerSorted.length > 0 && (
        <>
          <ul className="space-y-1" data-testid="signal-ledger">
            {ledgerSorted.map(row => (
              <SignalLedgerRow key={row.signal} row={row} reduce={!!reduce} />
            ))}
          </ul>
          <div className="my-2 flex items-center gap-2" aria-hidden>
            <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.14))' }} />
            <span className="text-[8.5px] uppercase tracking-[0.2em] text-white/35">che accendono</span>
            <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg,rgba(255,255,255,0.14),transparent)' }} />
          </div>
        </>
      )}

      <ul className="space-y-1.5">
        {sorted.map((p) => {
          const st = stateOf(p)
          const lights = completes.has(p.duo.id)
          const steps = advances.has(p.duo.id)
          const broke = breaks.has(p.duo.id)
          const regressed = regresses.has(p.duo.id)
          const badge = broke ? 'si spegne'
            : lights ? 'si attiva'
            : st === 'active' ? 'attiva'
            : regressed ? 'arretra'
            : steps ? 'avanza'
            : null
          const showDesc = st === 'active' // include le righe che "si attivano": sono active nel team col candidato
          return (
            <motion.li
              key={p.duo.id}
              layout={reduce ? false : 'position'}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              data-duo={p.duo.id}
              data-state={st}
              data-completes={lights ? '' : undefined}
              data-advances={steps ? '' : undefined}
              data-breaks={broke ? '' : undefined}
              data-regresses={regressed ? '' : undefined}
              className={cn('rounded-lg border px-2 py-1.5', lights && 'synergy-node-pulse')}
              style={{
                borderColor: broke ? `${ROSE}aa` : lights || steps ? `${GREEN}66` : st === 'active' ? `${GOLD}66` : regressed ? `${GOLD}55` : 'rgba(255,255,255,0.10)',
                background: broke
                  ? `linear-gradient(135deg, ${ROSE}22, transparent 70%)`
                  : lights
                    ? `linear-gradient(135deg, ${GREEN}14, transparent 70%)`
                    : st === 'active'
                      ? `linear-gradient(135deg, ${GOLD}1a, transparent 70%)`
                      : undefined,
                borderStyle: broke || (st === 'active' && !lights) ? 'solid' : 'dashed',
                opacity: st === 'locked' && !steps && !regressed ? 0.75 : 1,
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className="text-[12px] font-semibold leading-tight"
                  style={{ color: broke ? ROSE : st === 'active' ? '#f3e6c4' : steps ? GREEN : 'rgba(255,255,255,0.6)' }}
                >
                  {p.duo.name}
                </span>
                {badge && (
                  <span className="shrink-0 text-[10px] font-bold" style={{ color: broke ? ROSE : lights || steps ? GREEN : GOLD }}>
                    · {badge}
                  </span>
                )}
              </div>
              <DuoRecipe p={p} team={team} relics={relics} completing={lights} />
              {showDesc && <p className="mt-1 text-[10px] leading-snug text-[#c9bfa0]">{p.duo.desc}</p>}
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}
