import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { ActiveEffect } from '@/types'
import { StatusPips } from '@/components/battle/StatusPips'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { cn } from '@/lib/theme'

/**
 * Il ritratto grande del duellante: chi agisce o chi subisce, mostrato a scena intera
 * (420×376 nel mockup "La corsia del tempo" v11). Riprende `.big` / `#actor` / `#target`
 * dal disegno: bordo 2px rosso (nemico) o oro (bersaglio), nome in Cinzel 900 17px su una
 * sfumatura in basso, un sottotitolo 9px letter-spaced che dice AGISCE/SUBISCE, le pillole
 * di stato in alto a sinistra, una barra vita 6px in fondo.
 *
 * Un caduto NON sparisce dalla scena: resta ritratto, in grigio (`data-dead`), a HP 0 —
 * altrimenti il duello perderebbe il corpo a terra che il tavolo racconta.
 */
export function Duellante({
  unit, hp, maxHp, role, effects, dead, className, style,
}: {
  unit: ReplayUnit
  hp: number
  maxHp: number
  /** 'attore' = chi agisce, 'bersaglio' = chi subisce. Decide sottotitolo e colore del bordo. */
  role: 'attore' | 'bersaglio'
  effects: ActiveEffect[]
  dead?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const ratio = maxHp > 0 ? Math.min(1, Math.max(0, hp / maxHp)) : 0
  const isFoe = unit.side === 'right'
  const borderColor = role === 'bersaglio' ? 'var(--gold-bright, #caa24a)' : isFoe ? 'rgba(240,114,114,.45)' : 'rgba(124,220,125,.45)'
  const subtitle = role === 'attore' ? 'AGISCE' : 'SUBISCE'
  const hpColor = ratio > 0.5 ? '#7CFC9B' : ratio > 0.25 ? '#FFD37D' : '#FF6B6B'

  return (
    <div
      data-testid="duellante"
      data-unit-key={unit.key}
      data-dead={dead ? 'true' : undefined}
      className={cn(
        'relative h-[376px] w-[420px] overflow-hidden rounded-[13px] border-2 transition-[filter]',
        dead && 'grayscale',
        className,
      )}
      style={{ borderColor, ...style }}
    >
      <PortraitImage id={unit.id} house={unit.house} alt={unit.name} variant="bust" />

      <StatusPips effects={effects} />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%]"
        style={{ background: 'linear-gradient(0deg, rgba(7,5,14,.97), transparent)' }}
      />

      <div className="absolute inset-x-3 bottom-[7px] z-10">
        <div className="mb-1.5">
          <p className="font-display truncate text-[17px] font-black leading-tight text-white">
            {unit.name}
          </p>
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/65">
            {subtitle}
          </p>
        </div>
        <div className="h-[6px] w-full overflow-hidden rounded-full bg-black/50">
          <div
            data-testid="duellante-hp"
            className="h-full rounded-full transition-[width]"
            style={{ width: `${ratio * 100}%`, background: hpColor }}
          />
        </div>
      </div>
    </div>
  )
}
