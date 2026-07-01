'use client'
import { useState } from 'react'
import type { DraftedWizard, ActiveSynergy } from '@/types'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { Chip } from '@/components/ui/Chip'
import { Tooltip } from '@/components/ui/Tooltip'
import { RoleIcon } from '@/components/cards/RoleIcon'
import { houseTheme } from '@/lib/theme'
import { displayName } from '@/lib/displayName'
import { synergyBonusText, spellTypeChip } from '@/lib/glossary'
import { roleTooltip } from '@/lib/roleInfo'
import { SPELL_BY_ID } from '@/data/spells'

function SynergyChip({ s }: { s: ActiveSynergy }) {
  const bonus = synergyBonusText(s.synergy).join(' · ')
  const count = s.memberIds?.length ?? 0
  return (
    <span
      data-synergy={s.synergy.id}
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      style={{ color: '#f3e6c4', borderColor: 'rgba(202,162,74,0.6)', background: 'rgba(176,141,87,0.16)' }}
    >
      <span aria-hidden style={{ color: '#caa24a' }}>✦</span>
      {s.synergy.name.replace(/^\d+\s+/, '')}
      {count > 0 && (
        <span
          className="rounded-full bg-black/30 px-1.5 text-[#e8dcb6]"
          title={`${count} maghi in squadra`}
        >
          ×{count}
        </span>
      )}
      {bonus && <span className="text-[#c9bfa0]">{bonus}</span>}
    </span>
  )
}

/**
 * A single member row in the vertical sidebar. Folds in what used to be the
 * separate LOADOUT box: role icon (tooltip), equipped spell + type chip, and
 * a collapsible spell-pool selector (mirrors the old `LoadoutPanel`). Stays
 * collapsed by default to keep rows compact.
 */
function MemberRow({
  m, onSetSpell,
}: {
  m: DraftedWizard
  onSetSpell?: (wizardId: string, spellId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const theme = houseTheme(m.wizard.house)
  const spell = m.spell
  const typeChip = spell?.type ? spellTypeChip(spell.type) : undefined
  const spellPool = m.wizard.spellPool ?? []
  const canSelect = Boolean(onSetSpell) && spellPool.length > 0

  return (
    <div
      data-house={m.wizard.house}
      className="flex flex-col rounded-xl border bg-black/30 p-1.5"
      style={{ borderColor: `${theme.color}55` }}
    >
      <div className="flex items-center gap-2.5">
        <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg">
          <PortraitImage id={m.wizard.id} house={m.wizard.house} alt={m.wizard.name} variant="bust" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white/90">{displayName(m)}</span>
        {m.wizard.role && (
          <Tooltip
            triggerClassName="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-white/25 bg-black/40"
            content={roleTooltip(m.wizard.role)}
          >
            <RoleIcon role={m.wizard.role} size={11} className="text-white/85" />
          </Tooltip>
        )}
        <Chip label={`Lv. ${m.level ?? 1}`} color="#F0D98A" />
      </div>

      {spell && (
        <button
          type="button"
          onClick={canSelect ? () => setOpen((v) => !v) : undefined}
          aria-expanded={canSelect ? open : undefined}
          disabled={!canSelect}
          className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-black/20 px-1.5 py-1 text-left disabled:cursor-default"
        >
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-white/75">{spell.name}</span>
          {typeChip && <Chip label={typeChip.label} color={typeChip.color} icon={typeChip.icon} />}
        </button>
      )}

      {open && canSelect && (
        <div className="mt-1.5 flex flex-wrap gap-1 px-0.5" role="group" aria-label={`Incantesimi di ${m.wizard.name}`}>
          {spellPool.map((sid) => {
            const poolSpell = SPELL_BY_ID[sid]
            if (!poolSpell) return null
            const active = spell?.id === sid
            return (
              <button
                key={sid}
                type="button"
                onClick={() => onSetSpell?.(m.wizard.id, sid)}
                aria-pressed={active}
                title={poolSpell.desc}
                className={
                  'rounded-md border px-2 py-0.5 text-[11px] transition ' +
                  (active
                    ? 'border-amber-300/70 bg-amber-300/15 text-amber-100'
                    : 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10')
                }
              >
                {poolSpell.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * The current team + active synergies, kept in view across the run screens. Purely
 * presentational — reads the drafted team and the synergies the engine already
 * detected. `orientation` switches between the compact top strip ('horizontal',
 * default) and a left-hand sidebar ('vertical') used next to the map tree, where
 * members get larger portraits so they read better. In vertical mode, each row
 * also folds in the role icon, equipped spell, and a collapsible spell selector
 * (formerly the separate LOADOUT box) when `onSetSpell` is provided.
 */
export function TeamSynergyBar({
  team, synergies, orientation = 'horizontal', onSetSpell,
}: {
  team: DraftedWizard[]
  synergies: ActiveSynergy[]
  orientation?: 'horizontal' | 'vertical'
  /** Wires the inline spell selector in vertical rows; omit to hide it. */
  onSetSpell?: (wizardId: string, spellId: string) => void
}) {
  if (orientation === 'vertical') {
    return (
      <div
        data-testid="team-synergy-bar"
        className="flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
      >
        <div className="flex flex-col gap-2">
          {team.map((m) => <MemberRow key={m.wizard.id} m={m} onSetSpell={onSetSpell} />)}
        </div>

        {synergies.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Sinergie attive</span>
            <div className="flex flex-wrap gap-1.5">
              {synergies.map((s) => <SynergyChip key={s.synergy.id} s={s} />)}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      data-testid="team-synergy-bar"
      className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2"
    >
      {/* Roster — compact portrait + name + level per member. */}
      <div className="flex flex-wrap items-center gap-2">
        {team.map((m) => {
          const theme = houseTheme(m.wizard.house)
          return (
            <div
              key={m.wizard.id}
              data-house={m.wizard.house}
              className="flex items-center gap-2 rounded-xl border bg-black/30 py-1 pl-1 pr-2"
              style={{ borderColor: `${theme.color}55` }}
            >
              <span className="h-7 w-7 shrink-0 overflow-hidden rounded-lg">
                <PortraitImage id={m.wizard.id} house={m.wizard.house} alt={m.wizard.name} variant="bust" />
              </span>
              <span className="truncate text-xs font-semibold text-white/90">{displayName(m)}</span>
              <Chip label={`Lv. ${m.level ?? 1}`} color="#F0D98A" />
            </div>
          )
        })}
      </div>

      {/* Active synergies — gold chips, after the roster. */}
      {synergies.length > 0 && (
        <>
          <span aria-hidden className="mx-0.5 h-5 w-px bg-white/10" />
          <div className="flex flex-wrap items-center gap-1.5">
            {synergies.map((s) => <SynergyChip key={s.synergy.id} s={s} />)}
          </div>
        </>
      )}
    </div>
  )
}
