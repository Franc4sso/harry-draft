'use client'
import { motion, useReducedMotion } from 'framer-motion'
import type { ActiveRelic, DraftedWizard, DuoProgress } from '@/types'
import { duoProgress, previewDuos } from '@/game/engine/duos'
import { DuoRecipe } from '@/components/run/DuoPanel'
import { cn } from '@/lib/cn'

// Stesso linguaggio cromatico di SynergyTracker: verde = si attiva/avanza, oro = attiva.
const GOLD = '#d9b65f'
const GREEN = '#3ecb6a'

/**
 * Tracker COMPATTO delle Combo Duo per draft e recluta: una riga per combo — nome, ricetta
 * (due gemme fuse dal nodo "＋") — niente muri di testo. Quando il giocatore considera un
 * candidato (hover/focus), le righe sono ricalcolate CON il candidato e marcate
 * "si attiva" / "avanza" nello stesso linguaggio del SynergyTracker; le righe si riordinano
 * con un'animazione di layout così la combo che si accende sale in cima da sola. L'effetto
 * della combo compare solo quando è (o sta per essere) accesa: è il momento in cui serve.
 */
export function DuoTracker({ picks, considered, relics = [], className }: {
  picks: DraftedWizard[]
  considered?: DraftedWizard | null
  /** Al draft iniziale non esistono reliquie; al nodo recluta sì, e contano per i segnali tag. */
  relics?: ActiveRelic[]
  className?: string
}) {
  const reduce = useReducedMotion()
  const team = considered ? [...picks, considered] : picks
  const progress = duoProgress(team, relics)
  const preview = considered ? previewDuos(picks, relics, considered) : null
  const completes = new Set(preview?.completes.map(d => d.id))
  const advances = new Set(preview?.advances.map(d => d.id))

  const stateOf = (p: DuoProgress) => (p.active ? 'active' : p.missing.length === 1 ? 'near' : 'locked')
  const rank = (p: DuoProgress) =>
    completes.has(p.duo.id) ? 0 : p.active ? 1 : advances.has(p.duo.id) ? 2 : p.missing.length === 1 ? 3 : 4
  const sorted = [...progress].sort((a, b) => rank(a) - rank(b))

  return (
    <div className={cn('w-full', className)} data-testid="draft-duo-tracker">
      <div className="mb-1 flex items-center gap-2.5">
        <span aria-hidden className="h-px flex-1" style={{ background: 'linear-gradient(90deg,transparent,rgba(217,182,95,0.45),transparent)' }} />
        <span className="font-display text-[10.5px] uppercase tracking-[0.18em] text-[#d9b65f]">Combo Duo</span>
        <span aria-hidden className="h-px flex-1" style={{ background: 'linear-gradient(90deg,transparent,rgba(217,182,95,0.45),transparent)' }} />
      </div>
      <p className="mb-2.5 text-center text-[9px] tracking-[0.05em] text-white/45">
        due segnali accesi = combo in battaglia
      </p>

      <ul className="space-y-1.5">
        {sorted.map((p) => {
          const st = stateOf(p)
          const lights = completes.has(p.duo.id)
          const steps = advances.has(p.duo.id)
          const badge = lights ? 'si attiva' : st === 'active' ? 'attiva' : steps ? 'avanza' : null
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
              className={cn('rounded-lg border px-2 py-1.5', lights && 'synergy-node-pulse')}
              style={{
                borderColor: lights || steps ? `${GREEN}66` : st === 'active' ? `${GOLD}66` : 'rgba(255,255,255,0.10)',
                background: lights
                  ? `linear-gradient(135deg, ${GREEN}14, transparent 70%)`
                  : st === 'active'
                    ? `linear-gradient(135deg, ${GOLD}1a, transparent 70%)`
                    : undefined,
                borderStyle: st === 'active' && !lights ? 'solid' : 'dashed',
                opacity: st === 'locked' && !steps ? 0.75 : 1,
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className="text-[12px] font-semibold leading-tight"
                  style={{ color: st === 'active' ? '#f3e6c4' : steps ? GREEN : 'rgba(255,255,255,0.6)' }}
                >
                  {p.duo.name}
                </span>
                {badge && (
                  <span className="shrink-0 text-[10px] font-bold" style={{ color: lights || steps ? GREEN : GOLD }}>
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
