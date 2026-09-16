import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { ActiveEffect } from '@/types'
import { StatusPips } from '@/components/battle/StatusPips'
import { auraFor } from '@/components/battle/statusAura'
import '@/components/battle/statusAura.css'
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
  const aura = dead ? null : auraFor(effects)

  return (
    <div
      data-testid="duellante"
      data-unit-key={unit.key}
      data-dead={dead ? 'true' : undefined}
      data-aura={aura?.kind}
      className={cn(
        'relative overflow-hidden rounded-[13px] border-2 transition-[filter]',
        dead && 'grayscale',
        aura && `aura-full ${aura.className}`,
        className,
      )}
      // FIX ROUND 1 (review): the 420×376 mockup size used to live in the Tailwind class
      // list (`h-[376px] w-[420px]`), which collided with the caller's own `h-full w-full`
      // (BattleArena passes that so the duellante fills its percentage-sized stage slot).
      // `cn` (lib/cn.ts) is a plain string join with no tailwind-merge — it does NOT dedupe
      // conflicting utilities, so which one wins depends on Tailwind's stylesheet emission
      // order, not on className string order. That happened to resolve correctly today, but
      // silently — a build-tool detail, not a guarantee. Inline `style` doesn't have that
      // problem: a plain object spread always lets the caller's own `style` win over this
      // default, deterministically, with no dependency on CSS specificity or emission order.
      style={{ height: 376, width: 420, borderColor, ...style }}
    >
      <PortraitImage id={unit.id} house={unit.house} alt={unit.name} variant="bust" />

      {/* Texture interna dell'aura (foschia, braci, patina, tratteggio): DEVE
          restare dentro gli angoli arrotondati del ritratto, a differenza del
          bagliore esterno (che vive nel box-shadow di `.aura-full`, vedi
          statusAura.css — un box-shadow non è soggetto all'overflow-hidden
          del proprio elemento, un figlio posizionato invece sì). */}
      {aura && <div aria-hidden className={`aura-texture ${aura.className}`} />}

      <StatusPips effects={effects} />

      {/* Mockup `.big .nm`: ONE element carries both the name text and the darkening
          gradient behind it, via `background-image` + content-driven padding (`30px`
          top so the gradient reaches up over the face, `12px`/`10px` sides/bottom) —
          not two absolutely-positioned nodes (a gradient div UNDER a text div) with the
          gradient's height hardcoded to the box's 46%. That hardcoded height didn't
          track the actual text block, so a two-line name could clip the gradient short
          of the name's own top edge. One element sized by its own content can't. */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 px-3 pb-2.5 pt-[30px]"
        style={{ background: 'linear-gradient(0deg, rgba(7,5,14,.97), transparent)' }}
      >
        <div className="mb-1.5">
          <p className="font-display truncate text-[17px] font-black leading-tight text-white">
            {unit.name}
          </p>
          <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-white/65">
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
