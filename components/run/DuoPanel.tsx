'use client'
import { useState } from 'react'
import type { ActiveRelic, DraftedWizard, DuoProgress, DuoSignal, SignalCount } from '@/types'
import { detectDuos, duoProgress, signalCount } from '@/game/engine/duos'
import { livingOf } from '@/game/engine/roster'
import { trioGates } from '@/game/engine/trios'
import { SIGNAL_COLOR, SIGNAL_HOWTO, SIGNAL_ICON, SIGNAL_LABEL } from '@/data/duos'
import { trioText } from '@/game/engine/trioText'

// Linguaggio cromatico: oro = attivo, verde = a un passo.
const GOLD = '#d9b65f'
const GREEN = '#3ecb6a'

type State = 'active' | 'near' | 'locked'
const stateOf = (p: DuoProgress): State => (p.active ? 'active' : p.missing.length === 1 ? 'near' : 'locked')
const ORDER: Record<State, number> = { active: 0, near: 1, locked: 2 }

/** Una gemma della ricetta con conteggio: accesa mostra ✓; spenta mostra quanti maghi contribuiscono
 *  su quanti servono ("1/2"); accesa da una reliquia mostra "✓ reliquia". Così a colpo d'occhio si
 *  vede QUANTO manca a ogni segnale, non solo che è spento. L'icona è un medaglione che si RIEMPIE
 *  del colore del segnale quando è acceso. Condivisa col DuoTracker di draft/recluta. */
export function Gem({ signal, lit, count }: { signal: DuoSignal; lit: boolean; count: SignalCount }) {
  const c = SIGNAL_COLOR[signal]
  const tail = count.byRelic ? '✓ reliquia' : lit ? '✓' : `${count.have}/${count.need}`
  return (
    <span
      data-signal={signal}
      data-lit={lit ? '' : undefined}
      className="inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-1.5 text-[10px] font-semibold"
      style={lit
        ? { color: c, background: `${c}1f`, boxShadow: `inset 0 0 0 1px ${c}, 0 0 12px -3px ${c}` }
        : { color: '#6f6b86', boxShadow: 'inset 0 0 0 1px currentColor' }}
    >
      <span
        aria-hidden
        className="grid h-4 w-4 place-items-center rounded-full text-[9px] leading-none"
        style={lit
          ? { background: c, color: '#120e1c', boxShadow: `0 0 8px ${c}aa` }
          : { boxShadow: 'inset 0 0 0 1px currentColor' }}
      >
        {SIGNAL_ICON[signal]}
      </span>
      {SIGNAL_LABEL[signal]}
      <span className="tabular-nums opacity-90">{tail}</span>
    </span>
  )
}

/** La RICETTA di un Duo: le due gemme fuse da un nodo "＋" che si accende d'oro quando il
 *  sigillo è completo (o verde quando STA per completarsi con la pesca considerata). È il
 *  glifo del sistema: due segnali → una combo. Condivisa tra sidebar e tracker del draft. */
export function DuoRecipe({ p, team, relics, completing = false }: {
  p: DuoProgress
  team: DraftedWizard[]
  relics: ActiveRelic[]
  completing?: boolean
}) {
  const both = p.lit.every(Boolean)
  const link = completing ? GREEN : both ? GOLD : 'rgba(255,255,255,0.22)'
  const [s0, s1] = p.duo.signals
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <Gem signal={s0} lit={p.lit[0]!} count={signalCount(s0, team, relics)} />
      <span
        aria-hidden
        className="grid h-3.5 w-3.5 place-items-center rounded-full text-[9px] font-bold leading-none"
        style={{
          color: both || completing ? '#120e1c' : link,
          background: both || completing ? link : 'transparent',
          boxShadow: both || completing ? `0 0 8px ${link}` : `inset 0 0 0 1px ${link}`,
        }}
      >
        ＋
      </span>
      <Gem signal={s1} lit={p.lit[1]!} count={signalCount(s1, team, relics)} />
    </div>
  )
}

/** Una riga Duo. Attiva/a-un-passo mostra tutto (ricetta, effetto, come accendere il segnale
 *  mancante). LONTANA (2 segnali spenti) si compatta a nome+gemme e si espande su tap — sono
 *  le righe lontane, moltiplicate per desc+howto, che facevano muro. */
function DuoRow({ p, living, relics }: { p: DuoProgress; living: DraftedWizard[]; relics: ActiveRelic[] }) {
  const st = stateOf(p)
  const [open, setOpen] = useState(false)
  const expanded = st !== 'locked' || open

  return (
    <li
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
      <div className="flex items-center justify-between gap-2">
        <p
          className="text-[13px] font-semibold leading-tight"
          style={{ color: st === 'active' ? '#f3e6c4' : st === 'near' ? GREEN : 'rgba(255,255,255,0.6)' }}
        >
          {p.duo.name}
        </p>
        {st === 'locked' && (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? 'Comprimi' : 'Espandi'} ${p.duo.name}`}
            onClick={() => setOpen(v => !v)}
            className="shrink-0 rounded px-1 text-[10px] font-bold text-white/40 transition-colors hover:text-white/80"
          >
            {open ? '▴' : '▾'}
          </button>
        )}
      </div>

      <DuoRecipe p={p} team={living} relics={relics} />

      {expanded && (
        <>
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
        </>
      )}
    </li>
  )
}

/**
 * Pannello Duo nel run: la RICETTA di ognuna delle 6 combo. Attive e a-un-passo espanse
 * (ricetta con conteggio, effetto, come accendere il segnale mancante); le lontane compattate
 * a nome+gemme, espandibili. Ordinate: attive → a un passo → lontane. Puramente
 * presentazionale sopra `duoProgress` + `signalCount`. `frameless` toglie header e bordo
 * quando il pannello vive già dentro un contenitore intestato (es. il tab "Combo" della sidebar).
 */
export function DuoPanel({ team, relics, frameless = false }: { team: DraftedWizard[]; relics: ActiveRelic[]; frameless?: boolean }) {
  // Solo i maghi VIVI scendono in campo, quindi un Duo si accende qui esattamente quando si
  // accenderà in battaglia (resolvers/combat.ts calcola leftDuos da livingOf(team)).
  const living = livingOf(team)
  const progress = duoProgress(living, relics)

  const sorted = [...progress].sort((a, b) => ORDER[stateOf(a)] - ORDER[stateOf(b)])
  const activeCount = progress.filter(p => p.active).length

  // Trio di casata: stessa gate/grade logic di trioEffects in game/engine/trios.ts, condivisa
  // via trioGates così le due non possono divergere.
  const duos = detectDuos(living, relics)
  const activeTrios = trioGates(living, duos)

  return (
    <div
      className={frameless ? 'flex flex-col gap-1.5' : 'flex flex-col gap-1.5 border-t border-white/10 pt-2.5'}
      data-testid="duo-panel"
    >
      {!frameless && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Combo Duo</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-[#caa24a]/20 px-1.5 text-[10px] font-semibold text-[#e8dcb6]">
              {activeCount} attiva{activeCount > 1 ? 'e' : ''}
            </span>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {sorted.map((p) => <DuoRow key={p.duo.id} p={p} living={living} relics={relics} />)}
      </ul>

      {activeTrios.length > 0 && (
        <div className="flex flex-col gap-1.5" data-testid="trio-panel">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Trio di Casata</span>
          <ul className="flex flex-col gap-1.5">
            {activeTrios.map(({ house, grade }) => (
              <li
                key={house}
                data-house={house}
                className="rounded-lg border px-2 py-1.5"
                style={{ borderColor: `${GOLD}66`, background: `${GOLD}1f`, borderStyle: 'solid' }}
              >
                <p className="text-[13px] font-semibold leading-tight" style={{ color: '#f3e6c4' }}>{house}</p>
                <p className="mt-1 text-[11px] leading-snug text-[#c9bfa0]">{trioText(house, grade)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
