'use client'
import type { ActiveDuo } from '@/types'
import { SIGNAL_ICON, SIGNAL_COLOR, SIGNAL_LABEL } from '@/data/duos'

/**
 * Il sigillo di una combo: un emblema diviso nei suoi DUE segnali, ciascuno col
 * proprio glifo e il proprio colore.
 *
 * Sostituisce la pill col solo nome, impilata in colonna — «vedere le combo una
 * sotto l'altra in un elenco, sono veramente brutte» (utente, 2026-09-16). Il
 * nome da solo non dice da COSA nasce la combo: Cancrena è veleno + esecuzione,
 * Muro Vivente è scudo/rigen + tank. I due colori lo dicono a colpo d'occhio, e
 * sono gli stessi che il resto del gioco usa per quei segnali (`SIGNAL_COLOR`),
 * non una palette parallela.
 *
 * Quando la combo scatta il sigillo si accende: è il feedback dal secondo scatto
 * in poi, quando l'annuncio grande al centro non si ripete più.
 */
export function SigilloDuo({ active, firing }: { active: ActiveDuo; firing: boolean }) {
  const { duo } = active
  const [a, b] = duo.signals

  return (
    <div
      data-testid="sigillo-duo"
      data-duo-pill={duo.id}
      data-firing={firing ? 'true' : undefined}
      title={duo.desc}
      className="flex flex-col items-center gap-1"
      style={{ transition: 'transform .25s, filter .25s', transform: firing ? 'scale(1.06)' : undefined }}
    >
      <div
        className="relative flex overflow-hidden"
        style={{
          width: 44,
          height: 44,
          // L'ottagono del nastro, ripreso qui: la scena ha già questa forma per i
          // sigilli degli incantesimi, e riusarla lega le due letture invece di
          // introdurre una terza geometria.
          clipPath: 'polygon(29% 0,71% 0,100% 29%,100% 71%,71% 100%,29% 100%,0 71%,0 29%)',
          boxShadow: firing
            ? `0 0 18px ${SIGNAL_COLOR[a!]}, inset 0 0 0 1px rgba(255,255,255,.35)`
            : 'inset 0 0 0 1px rgba(226,214,186,.22)',
          filter: firing ? undefined : 'saturate(.72) brightness(.86)',
        }}
      >
        {[a!, b!].map((sig, i) => (
          <span
            key={`${sig}-${i}`}
            data-testid="sigillo-duo-meta"
            data-segnale={sig}
            data-colore={SIGNAL_COLOR[sig]}
            aria-label={SIGNAL_LABEL[sig]}
            className="grid flex-1 place-items-center text-[13px] leading-none"
            style={{
              background: `linear-gradient(180deg, ${SIGNAL_COLOR[sig]}2e, ${SIGNAL_COLOR[sig]}12)`,
              color: SIGNAL_COLOR[sig],
            }}
          >
            {SIGNAL_ICON[sig]}
          </span>
        ))}
      </div>
      <span
        className="max-w-[92px] truncate text-center text-[8.5px] font-extrabold uppercase leading-none tracking-[.1em]"
        style={{ color: firing ? '#f3e6c4' : 'rgba(243,230,196,.55)' }}
      >
        {duo.name}
      </span>
    </div>
  )
}
