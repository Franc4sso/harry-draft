'use client'
import type { ActiveDuo } from '@/types'
import { SIGNAL_ICON } from '@/data/duos'

/**
 * I Duo attivi, sempre visibili in un angolo dell'arena: durante il combattimento la sidebar
 * non c'è, quindi senza queste il giocatore non sa nemmeno quali combo ha in campo. La pill del
 * Duo che sta scattando in questo frame si illumina — è il feedback "sottile" dal secondo
 * scatto in poi (il primo ha già avuto l'annuncio grande al centro).
 */
export function DuoPills({ duos, firingId }: { duos: ActiveDuo[]; firingId: string | null }) {
  if (duos.length === 0) return null
  return (
    <div className="pointer-events-none absolute left-3 top-2 z-20 flex flex-col items-start gap-1">
      {duos.map(({ duo }) => {
        const firing = duo.id === firingId
        return (
          <span
            key={duo.id}
            data-duo-pill={duo.id}
            data-firing={firing ? '' : undefined}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-all duration-200 sm:text-xs"
            style={{
              color: firing ? '#1a1305' : '#f3e6c4',
              background: firing ? '#d9b65f' : 'rgba(24,16,8,0.7)',
              boxShadow: firing ? '0 0 22px rgba(217,182,95,0.75)' : 'inset 0 0 0 1px rgba(217,182,95,0.45)',
            }}
          >
            <span aria-hidden>{SIGNAL_ICON[duo.signals[0]]}</span>
            {duo.name}
          </span>
        )
      })}
    </div>
  )
}
