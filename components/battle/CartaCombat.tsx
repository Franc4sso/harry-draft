'use client'
import type { CSSProperties } from 'react'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { ActiveEffect, Role } from '@/types'
import type { SpellType } from '@/types/spell'
import { SPELL_TYPE_META } from '@/lib/glossary'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { pilloleDi, auraDi } from '@/lib/battleStacks'
import '@/components/battle/vetrata.css'

/**
 * La carta di battaglia — 212×254, variante "Vetrata" del mockup
 * (https://claude.ai/artifact/PNqfY2yLXxHiY4ziu6QsUq, Variante B). NON è
 * WizardCard: quella resta la carta di pesca/reclutamento, questa vive solo
 * in battaglia e mostra HP correnti, pillole di stato sommate e l'aura.
 *
 * `data-unit-key` è di riferimento per il layer VFX (Pixi) che vi ancora i colpi:
 * non rinominare né rimuovere.
 */
export function CartaCombat({
  unit, hp, maxHp, effects, spell, role, level, ruolo, stato = 'vivo', className, style,
}: {
  unit: ReplayUnit
  hp: number
  maxHp: number
  effects: ActiveEffect[]
  spell?: { name: string; type: SpellType }
  role?: Role
  level?: number
  /** 'attore' accende la cornice dorata, 'bersaglio' quella rossa. */
  ruolo?: 'attore' | 'bersaglio' | null
  stato?: 'vivo' | 'caduto'
  className?: string
  style?: CSSProperties
}) {
  const caduto = stato === 'caduto' || hp <= 0
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100))) : 0
  const pillole = pilloleDi(effects)
  const aura = auraDi(effects)
  const effectiveRole = role ?? unit.role
  const effectiveLevel = level ?? unit.level
  const roleLabel = effectiveRole
    ? `${effectiveRole.toUpperCase()}${effectiveLevel ? ` · LV.${effectiveLevel}` : ''}`
    : undefined
  const spellMeta = spell ? SPELL_TYPE_META[spell.type] : undefined
  const sideColor = unit.side === 'left' ? 'var(--vg-ally)' : 'var(--vg-foe)'

  return (
    <div
      data-testid="carta-combat"
      data-unit-key={unit.key}
      data-side={unit.side}
      data-caduto={caduto}
      data-ruolo={ruolo ?? undefined}
      data-aura={aura?.kind ?? undefined}
      className={`carta-combat${className ? ` ${className}` : ''}`}
      style={style}
    >
      {ruolo === 'attore' && (
        <>
          <span className="cc-corner tl" style={{ '--k': 'var(--vg-gold)' } as CSSProperties} />
          <span className="cc-corner tr" style={{ '--k': 'var(--vg-gold)' } as CSSProperties} />
          <span className="cc-corner bl" style={{ '--k': 'var(--vg-gold)' } as CSSProperties} />
          <span className="cc-corner br" style={{ '--k': 'var(--vg-gold)' } as CSSProperties} />
        </>
      )}
      {ruolo === 'bersaglio' && (
        <>
          <span className="cc-corner tl" style={{ '--k': 'var(--vg-red)' } as CSSProperties} />
          <span className="cc-corner tr" style={{ '--k': 'var(--vg-red)' } as CSSProperties} />
          <span className="cc-corner bl" style={{ '--k': 'var(--vg-red)' } as CSSProperties} />
          <span className="cc-corner br" style={{ '--k': 'var(--vg-red)' } as CSSProperties} />
        </>
      )}

      {pillole.length > 0 && (
        <span className="cc-pips">
          {pillole.map(p => (
            <span
              key={p.kind}
              data-testid="carta-pillola"
              className="cc-pip"
              style={{ background: p.color }}
              title={p.label}
            >
              {p.glyph}
              {p.count !== undefined && <b>{p.count}</b>}
            </span>
          ))}
        </span>
      )}

      <div className="cc-inner">
        <div className="cc-por">
          <PortraitImage id={unit.id} house={unit.house} alt={unit.name} variant="card" />
          {caduto && <span className="cc-caduta">CADUTA</span>}
          {roleLabel && (
            <span className="cc-rl" style={{ color: sideColor }}>{roleLabel}</span>
          )}
          <span className="cc-nm">{unit.name}</span>
          {spell && spellMeta && (
            <span className="cc-sp">
              <SpellSigil color={spellMeta.color} />
              {spell.name}
            </span>
          )}
        </div>
        <div className="cc-hpw">
          <span data-testid="carta-hp-testo" className="cc-hpt">{hp}/{maxHp}</span>
          <i data-testid="carta-hp" style={{ width: `${pct}%` }} />
        </div>
        <div className="cc-st">
          <span><u>ATT</u>{unit.atk ?? '—'}</span>
          <span><u>DIF</u>{unit.def ?? '—'}</span>
          <span><u>VEL</u>{unit.spd ?? '—'}</span>
        </div>
      </div>
    </div>
  )
}

/** Sigillo del tipo di incantesimo — le stesse due lame incrociate del mockup, tinte
 *  col colore SPELL_TYPE_META del tipo. */
function SpellSigil({ color }: { color: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2 2l8 8M10 2l-8 8" stroke={color} strokeWidth="2" fill="none" />
    </svg>
  )
}
