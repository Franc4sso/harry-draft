'use client'
import type { TargetReason } from '@/types'
import { TARGET_REASON_LABEL } from '@/types'

/** Glifo per ciascuna ragione. Solo decorazione: il testo viene da
 *  `TARGET_REASON_LABEL`, che è la fonte del motore. */
const REASON_ICON: Record<TargetReason, string> = {
  taunt: '⚑',
  dive: '⚔',
  backline: '✦',
  weakest: '☍',
  threat: '✚',
}

/** Chi applica quella regola, in breve — la colonna "chi" della legenda. Deriva
 *  dai rami di `explainTarget` (game/engine/combat/targeting.ts), non da un'idea
 *  di come dovrebbe funzionare. */
const REASON_WHO: Record<TargetReason, string> = {
  taunt: 'Chiunque, se c’è un Tank',
  dive: 'Attaccante',
  backline: 'Controllo',
  weakest: 'Tank',
  threat: 'Supporto',
}

const ORDER: TargetReason[] = ['taunt', 'dive', 'backline', 'weakest', 'threat']

/**
 * La legenda "chi attacca chi", nella colonna di destra.
 *
 * Richiesta dell'utente (2026-09-16): «vorrei, non so in che parte del campo,
 * mettere una legenda per far capire chi deve attaccare chi, in base a
 * determinate dinamiche dell'app» — poi precisata: «io lo metterei al lato».
 *
 * NON inventa una tassonomia: le cinque ragioni e le loro etichette sono
 * `TARGET_REASON_LABEL`, le stesse che `explainTarget` produce e che il motore
 * attacca a `entry.reason`. Una seconda verità qui divergerebbe dal motore alla
 * prima modifica alle regole di bersaglio — ed è esattamente l'errore
 * ("una seconda verità che diverge") che ha già fatto fallire un piano in questo
 * progetto. Se il motore aggiunge una ragione, il tipo `TargetReason` rende
 * questo file un errore di compilazione invece che una legenda incompleta.
 *
 * `attiva` è la ragione del turno corrente: la riga si accende, così la legenda
 * non è solo un manuale ma spiega il colpo che si sta guardando.
 */
export function LegendaBersagli({ attiva = null, className, style }: {
  attiva?: TargetReason | null
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <aside
      data-testid="legenda-bersagli"
      aria-label="Come si scelgono i bersagli"
      className={`pointer-events-none flex flex-col gap-1.5${className ? ` ${className}` : ''}`}
      style={style}
    >
      <h3 className="text-[7.5px] font-extrabold uppercase tracking-[.2em]" style={{ color: 'var(--vg-gold, #b8963f)' }}>
        Bersagli
      </h3>
      {ORDER.map(reason => {
        const on = reason === attiva
        return (
          <div
            key={reason}
            data-testid={`bersaglio-${reason}`}
            data-attiva={on ? 'true' : undefined}
            className="flex items-start gap-1.5 rounded-sm px-1 py-0.5"
            style={{
              background: on ? 'rgba(184,150,63,.16)' : undefined,
              boxShadow: on ? 'inset 0 0 0 1px rgba(184,150,63,.45)' : undefined,
              transition: 'background .25s, box-shadow .25s',
            }}
          >
            <span aria-hidden className="text-[10px] leading-none" style={{ color: on ? '#e8d49a' : 'rgba(226,214,186,.45)' }}>
              {REASON_ICON[reason]}
            </span>
            <span className="min-w-0 leading-tight">
              <span
                className="block text-[8px] font-extrabold uppercase tracking-[.08em]"
                style={{ color: on ? '#f2eee4' : 'rgba(242,238,228,.72)' }}
              >
                {TARGET_REASON_LABEL[reason]}
              </span>
              <span className="block text-[7px]" style={{ color: 'rgba(242,238,228,.42)' }}>
                {REASON_WHO[reason]}
              </span>
            </span>
          </div>
        )
      })}
    </aside>
  )
}
