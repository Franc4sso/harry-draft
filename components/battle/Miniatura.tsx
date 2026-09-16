import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { ActiveEffect } from '@/types'
import { StatusPips } from '@/components/battle/StatusPips'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { cn } from '@/lib/theme'

/**
 * Il ritratto piccolo dei quattro maghi che non stanno duellando in questo istante
 * (84×104 nel mockup "La corsia del tempo" v11, `.mini`). Riprende `#m-cho` / `#m-her`
 * dal disegno: bordo 1.5px nel colore del lato (rosso nemico, verde alleato), un
 * ritratto che riempie lo spazio con una vignetta radiale sopra, una barra vita 4px
 * nel colore del lato, e il nome troncato 8.5px su una striscia scura in fondo.
 *
 * Il punto di questo componente è quello che NON ha: niente banda statistiche, niente
 * riga incantesimo. Oggi la battaglia disegna sei card intere da ~250px per chi non
 * agisce e la riga del giocatore finisce tagliata sotto la piega — la miniatura porta
 * solo ritratto, vita, nome e pillole di stato, e lascia il resto alla scena grande
 * del duellante.
 *
 * `dimmed` è l'unità che in questo istante è IN scena come duellante grande: il suo
 * posto in fila resta (niente salti di layout quando cambia il turno), ma si smorza.
 * `dead` è un caduto: resta al suo posto, marcato in grigio, a HP 0 — stesso principio
 * del `Duellante`, il tavolo non perde il corpo a terra.
 */
export function Miniatura({
  unit, hp, maxHp, effects, dimmed, dead, className, style,
}: {
  unit: ReplayUnit
  hp: number
  maxHp: number
  effects: ActiveEffect[]
  /** L'unità è in scena come duellante: il posto resta, smorzato. */
  dimmed?: boolean
  dead?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const ratio = maxHp > 0 ? Math.min(1, Math.max(0, hp / maxHp)) : 0
  const isFoe = unit.side === 'right'
  const sideColor = isFoe ? 'rgba(240,114,114,.45)' : 'rgba(124,220,125,.4)'
  const hpColor = isFoe ? '#f07272' : '#7cdc7d'

  return (
    <div
      data-testid="miniatura"
      data-unit-key={unit.key}
      data-dimmed={dimmed ? 'true' : undefined}
      data-dead={dead ? 'true' : undefined}
      className={cn(
        'relative flex h-[104px] w-[84px] flex-col overflow-hidden rounded-[9px] border-[1.5px] transition-[opacity,transform,filter] duration-300 motion-reduce:transition-none',
        dimmed && 'scale-[.94] opacity-30',
        dead && 'grayscale opacity-[.28]',
        className,
      )}
      style={{ borderColor: sideColor, ...style }}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <PortraitImage id={unit.id} house={unit.house} alt={unit.name} variant="bust" />

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(120% 100% at 50% 20%, transparent 40%, rgba(7,5,14,.85) 100%)' }}
        />

        <StatusPips effects={effects} />
      </div>

      <div className="relative z-10 shrink-0 bg-black/40 px-1 pb-[3px] pt-[2px]">
        <p className="truncate text-[8.5px] font-bold leading-tight text-white">
          {unit.name}
        </p>
        <div className="mt-[2px] h-1 w-full overflow-hidden rounded-full bg-black/50">
          <div
            data-testid="miniatura-hp"
            className="h-full rounded-full transition-[width] duration-[.65s] ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none"
            style={{ width: `${ratio * 100}%`, background: hpColor }}
          />
        </div>
      </div>
    </div>
  )
}
