'use client'
import type { DraftedWizard } from '@/types'
import { synergyProgress } from '@/game/engine/synergy'
import { ARCHETYPE_EFFECT } from '@/lib/archetypes'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/cn'

// Stessa palette del DuoTracker: oro = attivo, verde = vicino/avanza, bianco fioco = sopito.
const GOLD = '#d9b65f'
const GREEN = '#3ecb6a'

const ARCH_META: Record<string, { name: string; glyph: string; color: string }> = {
  tossicita:   { name: 'Veleno',    glyph: '☠', color: '#7ddc7d' },
  spietatezza: { name: 'Carnefice', glyph: '✖', color: '#ff8a7a' },
  bastione:    { name: 'Muro',      glyph: '⛨', color: '#7db7ff' },
  oscurita:    { name: 'Magie Oscure', glyph: '☾', color: '#b98cff' },
}

/**
 * Tracker COMPATTO delle Costellazioni (archetipi tag): una riga per archetipo — pip×need,
 * have/need, stato (sopito/vicino/attivo) ed effetto quando attivo. Sorella del DuoTracker:
 * stesso header, stesso stile riga, stessa gestione di `considered`. Mostra i 4 archetipi
 * con sistema (Veleno/Carnefice/Muro/Magie Oscure — Patto Oscuro attivato 2026-07-24).
 */
export function ArchetypeTracker({ picks, considered, className }: {
  picks: DraftedWizard[]
  considered?: DraftedWizard | null
  className?: string
}) {
  const team = considered ? [...picks, considered] : picks
  const rows = synergyProgress(team).flatMap(p => {
    const meta = ARCH_META[p.synergy.id]
    return meta ? [{ p, meta }] : []
  })

  return (
    <div className={cn('w-full', className)} data-testid="draft-archetype-tracker">
      <div className="mb-1 flex items-center gap-2.5">
        <span aria-hidden className="h-px flex-1" style={{ background: 'linear-gradient(90deg,transparent,rgba(217,182,95,0.45),transparent)' }} />
        <span className="font-display text-[10.5px] uppercase tracking-[0.18em] text-[#d9b65f]">Costellazioni</span>
        <span aria-hidden className="h-px flex-1" style={{ background: 'linear-gradient(90deg,transparent,rgba(217,182,95,0.45),transparent)' }} />
      </div>
      <p className="mb-2.5 text-center text-[9px] tracking-[0.05em] text-white/45">
        tre maghi dello stesso stile = archetipo acceso
      </p>

      <ul className="space-y-1.5">
        {rows.map(({ p, meta }) => {
          const state: 'active' | 'near' | 'off' = p.active ? 'active' : p.have === p.need - 1 ? 'near' : 'off'
          return (
            <li
              key={p.synergy.id}
              data-arch={p.synergy.id}
              data-state={state}
              className="rounded-lg border px-2 py-1.5"
              style={{
                borderColor: state === 'active' ? `${GOLD}66` : state === 'near' ? `${GREEN}66` : 'rgba(255,255,255,0.10)',
                background: state === 'active'
                  ? `linear-gradient(135deg, ${GOLD}1a, transparent 70%)`
                  : state === 'near'
                    ? `linear-gradient(135deg, ${GREEN}14, transparent 70%)`
                    : undefined,
                borderStyle: state === 'active' ? 'solid' : 'dashed',
                opacity: state === 'off' ? 0.75 : 1,
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <Tooltip
                  label={`Costellazione ${meta.name}`}
                  content={ARCHETYPE_EFFECT[p.synergy.id] ?? `Archetipo: ${meta.name}`}
                >
                  <span
                    className="text-[12px] font-semibold leading-tight"
                    style={{ color: state === 'active' ? '#f3e6c4' : state === 'near' ? GREEN : 'rgba(255,255,255,0.6)' }}
                  >
                    <span aria-hidden style={{ color: meta.color }}>{meta.glyph}</span> {meta.name}
                  </span>
                </Tooltip>
                <span className="shrink-0 text-[10px] font-bold" style={{ color: state === 'active' ? GOLD : state === 'near' ? GREEN : 'rgba(255,255,255,0.4)' }}>
                  {p.have}/{p.need}
                </span>
              </div>

              <div className="mt-1 flex items-center gap-1" aria-hidden>
                {Array.from({ length: p.need }).map((_, i) => (
                  <span
                    key={i}
                    className="text-[10px] leading-none"
                    style={{ color: i < p.have ? meta.color : 'rgba(255,255,255,0.18)' }}
                  >
                    ★
                  </span>
                ))}
              </div>

              {state === 'active' && (
                <p className="mt-1 text-[10px] leading-snug text-[#c9bfa0]">{ARCHETYPE_EFFECT[p.synergy.id]}</p>
              )}
              {state === 'near' && (
                <p className="mt-1 text-[10px] leading-snug text-[#8fdca0]">↳ recluta 1 mago {meta.name}</p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
