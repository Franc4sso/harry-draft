import type { Stats } from '@/types'

/** I quattro colori delle statistiche, invariati rispetto a oggi: sono il
 *  riferimento che l'utente ha indicato per la sobrietà di tutto il resto. */
const CELLS = [
  { key: 'hp', label: 'HP', color: '#7cdc7d' },
  { key: 'atk', label: 'ATT', color: '#f08a8a' },
  { key: 'def', label: 'DIF', color: '#8ab6f0' },
  { key: 'spd', label: 'VEL', color: '#f0d48a' },
] as const

/**
 * Le statistiche come fascia coniata al piede della carta: quattro celle divise
 * da tacche sottili, numeri in cifre tabulari.
 *
 * `mt-auto` la incolla al fondo, così tre carte affiancate hanno la fascia alla
 * stessa altezza anche se la magia di una occupa una riga in più.
 *
 * `compact` — usata da `WizardCard` in densità `row`: la stessa griglia a quattro
 * colonne, ma con meno padding verticale e cifre più piccole, perché lì la fascia
 * sta a fianco di un ritratto largo 54px dentro una riga di lista, non al fondo di
 * una carta intera. Struttura e ordine delle celle restano identici — cambia solo
 * lo spazio che occupano.
 */
export function StatBand({ stats, currentHp, compact }: { stats: Stats; currentHp?: number; compact?: boolean }) {
  return (
    <div
      data-testid="stat-band"
      className={`grid grid-cols-4 ${compact ? '' : 'mt-auto border-t border-white/10 bg-black/30'}`}
    >
      {CELLS.map((c, i) => (
        <div key={c.key} data-stat={c.key} className={`relative text-center ${compact ? 'px-0.5 py-0' : 'px-0.5 pb-2.5 pt-2'}`}>
          {i > 0 && <span aria-hidden className="absolute inset-y-[26%] left-0 w-px bg-white/10" />}
          <span className={`block font-extrabold uppercase tracking-[.12em] text-white/40 ${compact ? 'text-[6.5px]' : 'text-[7.5px]'}`}>
            {c.label}
          </span>
          <span className={`block font-black tabular-nums ${compact ? 'mt-0.5 text-[11px]' : 'mt-1 text-[15px]'}`} style={{ color: c.color }}>
            {c.key === 'hp' && currentHp !== undefined ? `${currentHp}/${stats.hp}` : stats[c.key]}
          </span>
        </div>
      ))}
    </div>
  )
}
