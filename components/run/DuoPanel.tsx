'use client'
import type { ActiveRelic, DraftedWizard, DuoProgress, DuoSignal, SignalCount } from '@/types'
import { duoProgress, signalCount } from '@/game/engine/duos'
import { livingOf } from '@/game/engine/roster'
import { SIGNAL_COLOR, SIGNAL_HOWTO, SIGNAL_ICON, SIGNAL_LABEL } from '@/data/duos'

// Stesso linguaggio cromatico di SynergyTracker: oro = attivo, verde = a un passo.
const GOLD = '#d9b65f'
const GREEN = '#3ecb6a'

type State = 'active' | 'near' | 'locked'
const stateOf = (p: DuoProgress): State => (p.active ? 'active' : p.missing.length === 1 ? 'near' : 'locked')
const ORDER: Record<State, number> = { active: 0, near: 1, locked: 2 }

/** Una gemma della ricetta con conteggio: accesa mostra ✓; spenta mostra quanti maghi contribuiscono
 *  su quanti servono ("1/2"); accesa da una reliquia mostra "✓ reliquia". Così a colpo d'occhio si
 *  vede QUANTO manca a ogni segnale, non solo che è spento. */
function Gem({ signal, lit, count }: { signal: DuoSignal; lit: boolean; count: SignalCount }) {
  const c = SIGNAL_COLOR[signal]
  const tail = count.byRelic ? '✓ reliquia' : lit ? '✓' : `${count.have}/${count.need}`
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
      <span className="tabular-nums opacity-90">{tail}</span>
    </span>
  )
}

/**
 * Pannello Duo nel run: la RICETTA di ognuna delle 6 combo. TUTTE espanse — ricetta (gemme col
 * conteggio 1/2), effetto, e come accendere ogni segnale mancante — così il giocatore capisce
 * sempre cosa gli serve, senza clic. Ordinate: attive → a un passo → lontane. Puramente
 * presentazionale sopra `duoProgress` + `signalCount`.
 */
export function DuoPanel({ team, relics }: { team: DraftedWizard[]; relics: ActiveRelic[] }) {
  // Solo i maghi VIVI scendono in campo, quindi un Duo si accende qui esattamente quando si
  // accenderà in battaglia (resolvers/combat.ts calcola leftDuos da livingOf(team)).
  const living = livingOf(team)
  const progress = duoProgress(living, relics)

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
                opacity: st === 'locked' ? 0.82 : 1,
              }}
            >
              <p
                className="text-[13px] font-semibold leading-tight"
                style={{ color: st === 'active' ? '#f3e6c4' : st === 'near' ? GREEN : 'rgba(255,255,255,0.6)' }}
              >
                {p.duo.name}
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-1">
                {p.duo.signals.map((s, i) => (
                  <Gem key={`${s}-${i}`} signal={s} lit={p.lit[i]!} count={signalCount(s, living, relics)} />
                ))}
              </div>

              <p className="mt-1 text-[11px] leading-snug text-[#c9bfa0]">{p.duo.desc}</p>

              {p.missing.map((sig, i) => (
                <p
                  key={sig}
                  // Il testid è sul PRIMO segnale mancante (senza indice) perché i test lo cercano
                  // così; gli eventuali segnali successivi restano renderizzati senza quell'ancora.
                  data-testid={i === 0 ? `howto-${p.duo.id}` : undefined}
                  className="mt-1 border-t border-white/10 pt-1 text-[10px] leading-snug text-white/50"
                >
                  <span style={{ color: GREEN }}>accendi {SIGNAL_LABEL[sig]}:</span>{' '}
                  {SIGNAL_HOWTO[sig]}
                </p>
              ))}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
