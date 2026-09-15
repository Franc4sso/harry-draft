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
 */
export function StatBand({ stats, currentHp }: { stats: Stats; currentHp?: number }) {
  return (
    <div
      data-testid="stat-band"
      className="mt-auto grid grid-cols-4 border-t border-white/10 bg-black/30"
    >
      {CELLS.map((c, i) => (
        <div key={c.key} data-stat={c.key} className="relative px-0.5 pb-2.5 pt-2 text-center">
          {i > 0 && <span aria-hidden className="absolute inset-y-[26%] left-0 w-px bg-white/10" />}
          <span className="block text-[7.5px] font-extrabold uppercase tracking-[.12em] text-white/40">
            {c.label}
          </span>
          <span className="mt-1 block text-[15px] font-black tabular-nums" style={{ color: c.color }}>
            {c.key === 'hp' && currentHp !== undefined ? `${currentHp}/${stats.hp}` : stats[c.key]}
          </span>
        </div>
      ))}
    </div>
  )
}
