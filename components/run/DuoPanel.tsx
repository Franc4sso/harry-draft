'use client'
import { useState } from 'react'
import type { ActiveRelic, DraftedWizard, DuoProgress, DuoSignal } from '@/types'
import { duoProgress } from '@/game/engine/duos'
import { livingOf } from '@/game/engine/roster'
import { SIGNAL_COLOR, SIGNAL_HOWTO, SIGNAL_ICON, SIGNAL_LABEL } from '@/data/duos'

// Stesso linguaggio cromatico di SynergyTracker e del vecchio DuoBar: oro = attivo,
// verde = a un passo. I lontani restano spenti.
const GOLD = '#d9b65f'
const GREEN = '#3ecb6a'

type State = 'active' | 'near' | 'locked'
const stateOf = (p: DuoProgress): State => (p.active ? 'active' : p.missing.length === 1 ? 'near' : 'locked')
const ORDER: Record<State, number> = { active: 0, near: 1, locked: 2 }

/** Una gemma della ricetta: accesa = piena e luminosa, mancante = tratteggiata e spenta. */
function Gem({ signal, lit }: { signal: DuoSignal; lit: boolean }) {
  const c = SIGNAL_COLOR[signal]
  return (
    <span
      data-signal={signal}
      data-lit={lit ? '' : undefined}
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
      style={lit
        ? { color: c, background: `${c}1c`, boxShadow: `inset 0 0 0 1px ${c}, 0 0 10px -3px ${c}` }
        : { color: '#6f6b86', boxShadow: 'inset 0 0 0 1px currentColor' }}
    >
      <span aria-hidden>{SIGNAL_ICON[signal]}</span>
      {SIGNAL_LABEL[signal]}
    </span>
  )
}

/**
 * Pannello Duo nel run: la RICETTA di ognuna delle 6 combo. Attive e "a un passo" espanse
 * (ricetta + effetto + come accendere il segnale mancante); le lontane collassate a una riga,
 * espandibili al clic — la sidebar è larga 288px e 6 ricette intere non ci starebbero.
 * Puramente presentazionale sopra `duoProgress`.
 */
export function DuoPanel({ team, relics }: { team: DraftedWizard[]; relics: ActiveRelic[] }) {
  // Solo i maghi VIVI scendono in campo, quindi un Duo si accende qui esattamente quando si
  // accenderà in battaglia (resolvers/combat.ts calcola leftDuos da livingOf(team)).
  const progress = duoProgress(livingOf(team), relics)
  const [opened, setOpened] = useState<string | null>(null)

  const sorted = [...progress].sort((a, b) => ORDER[stateOf(a)] - ORDER[stateOf(b)])
  const activeCount = progress.filter(p => p.active).length

  return (
    <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2.5" data-testid="duo-panel">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Combo Duo</span>
        {activeCount > 0 && (
          <span className="rounded-full bg-[#caa24a]/20 px-1.5 text-[10px] font-semibold text-[#e8dcb6]">
            {activeCount} attiva{activeCount > 1 ? 'e' : ''}
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-1.5">
        {sorted.map((p) => {
          const st = stateOf(p)
          const expanded = st !== 'locked' || opened === p.duo.id
          const missing = p.missing[0]
          return (
            <li
              key={p.duo.id}
              data-duo={p.duo.id}
              data-state={st}
              className="rounded-lg border px-2 py-1.5"
              style={{
                borderColor: st === 'active' ? `${GOLD}66` : st === 'near' ? `${GREEN}55` : 'rgba(255,255,255,0.10)',
                background: st === 'active' ? `${GOLD}1f` : undefined,
                borderStyle: st === 'active' ? 'solid' : 'dashed',
                opacity: st === 'locked' ? 0.72 : 1,
              }}
            >
              {/* I lontani sono un bottone: il clic espande la ricetta. Gli altri sono già aperti. */}
              {st === 'locked' ? (
                <button
                  type="button"
                  onClick={() => setOpened(opened === p.duo.id ? null : p.duo.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-1 text-left"
                >
                  <span className="text-[11px] font-semibold text-white/55">{p.duo.name}</span>
                  <span className="flex items-center gap-1">
                    {p.duo.signals.map((s, i) => (
                      <Gem key={`${s}-${i}`} signal={s} lit={p.lit[i]!} />
                    ))}
                  </span>
                </button>
              ) : (
                <p
                  className="text-[13px] font-semibold leading-tight"
                  style={{ color: st === 'active' ? '#f3e6c4' : GREEN }}
                >
                  {p.duo.name}
                </p>
              )}

              {expanded && (
                <>
                  {st !== 'locked' && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {p.duo.signals.map((s, i) => (
                        <Gem key={`${s}-${i}`} signal={s} lit={p.lit[i]!} />
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-[11px] leading-snug text-[#c9bfa0]">{p.duo.desc}</p>
                  {missing && (
                    <p
                      data-testid={`howto-${p.duo.id}`}
                      className="mt-1 border-t border-white/10 pt-1 text-[10px] leading-snug text-white/50"
                    >
                      <span style={{ color: GREEN }}>accendi {SIGNAL_LABEL[missing]}:</span>{' '}
                      {SIGNAL_HOWTO[missing]}
                    </p>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
