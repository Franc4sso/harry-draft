'use client'
import { useState } from 'react'
import type { DraftedWizard } from '@/types'
import { Button } from '@/components/ui/Button'
import { Frame } from '@/components/ui/Frame'
import { Insegna } from '@/components/ui/Insegna'
import { Stagger, StaggerItem } from '@/components/ui/motion'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { houseTheme } from '@/lib/theme'
import { displayName } from '@/lib/displayName'
import { spellTypeChip } from '@/lib/glossary'
import { Chip } from '@/components/ui/Chip'
import type { Spell } from '@/types'
import { baseSpellOf, scaledSpell, SPELL_LEVEL_MAX } from '@/game/engine/spellForge'
import { STATUS_BY_ID } from '@/data/statuses'

const ACCENT = '#5ad1e0'
const round2 = (n: number) => Math.round(n * 100) / 100

/** The single headline number a player reads off a (possibly scaled) spell — the one stat
 *  "Aumento Magia" moves. Covers every spell shape: attack Potenza, Cura, Scudo, revive %,
 *  statusId buff/veleno magnitude, and control/ward Durata. Never a vague "efficacia". */
function spellHeadline(s: Spell): { label: string; value: number; suffix?: string } | null {
  if (s.power !== undefined && s.power > 0) return { label: 'Potenza', value: round2(s.power) }
  if (s.heal !== undefined && s.heal > 0) return { label: 'Cura', value: Math.round(s.heal) }
  if (s.revive !== undefined) return { label: 'Rianima', value: Math.round(s.revive * 100), suffix: '%' }
  for (const e of s.spec ?? []) {
    if (e.kind === 'damage') return { label: 'Potenza', value: round2(e.power) }
    if (e.kind === 'shield') return { label: 'Scudo', value: Math.round(e.amount) }
    if (e.kind === 'heal') return { label: 'Cura', value: Math.round(e.amount) }
    if (e.kind === 'protego') {
      if (e.count != null) return { label: 'Cariche', value: e.count }
      return { label: 'Durata', value: e.duration ?? STATUS_BY_ID['protego']!.defaultDuration, suffix: ' turni' }
    }
    if (e.kind === 'applyStatus') {
      if (e.statusId) {
        const def = STATUS_BY_ID[e.statusId]
        const mm = e.magMult ?? 1
        if (def?.statMod) return { label: 'Effetto', value: Math.abs(Math.round(def.statMod.amount * mm)) }
        if (def?.tickDamage != null) return { label: 'Veleno', value: Math.round(def.tickDamage * mm) }
        if (def?.family === 'control') return { label: 'Durata', value: e.duration ?? def.defaultDuration, suffix: ' turni' }
        if (def?.absorb != null) return { label: 'Scudo', value: Math.round(def.absorb * mm) }
      } else if (e.effect?.amount !== undefined) {
        return { label: 'Effetto', value: Math.abs(Math.round(e.effect.amount)) }
      } else if (e.effect?.kind === 'stun' && e.effect.duration !== undefined) {
        return { label: 'Durata', value: e.effect.duration, suffix: ' turni' }
      }
    }
  }
  const amt = s.effects?.map(e => e.amount).find((a): a is number => a !== undefined)
  if (amt !== undefined) return { label: 'Effetto', value: Math.abs(Math.round(amt)) }
  const stun = s.effects?.find(e => e.kind === 'stun' && e.duration !== undefined)
  if (stun) return { label: 'Durata', value: stun.duration!, suffix: ' turni' }
  return null
}

/** What one (or the next meaningful) level of "Aumento Magia" buys, as current → next. Some
 *  levers move continuously (power/heal/magnitude), others only at breakpoints (control
 *  durations, ward charges) — so if the immediate next level is flat, scan ahead to the
 *  level that actually lands the gain and label it (`atLevel`). */
function boostLine(dw: DraftedWizard): { label: string; from: number; to: number; suffix?: string; atLevel?: number } | null {
  const base = baseSpellOf(dw.spell)
  const cur = dw.spellLevel ?? 1
  if (cur >= SPELL_LEVEL_MAX) return null
  const here = spellHeadline(scaledSpell(base, cur))
  if (!here) return null
  for (let lvl = cur + 1; lvl <= SPELL_LEVEL_MAX; lvl++) {
    const there = spellHeadline(scaledSpell(base, lvl))
    if (there && there.value !== here.value) {
      return { label: here.label, from: here.value, to: there.value, suffix: here.suffix, atLevel: lvl > cur + 1 ? lvl : undefined }
    }
  }
  return null
}

function ForgeCard({ dw, selected, onSelect }: { dw: DraftedWizard; selected: boolean; onSelect: () => void }) {
  const theme = houseTheme(dw.wizard.house)
  const level = dw.spellLevel ?? 1
  const maxed = level >= SPELL_LEVEL_MAX
  const typeChip = dw.spell?.type ? spellTypeChip(dw.spell.type) : undefined
  const boost = boostLine(dw)
  return (
    <Frame
      variant="card"
      className={maxed ? 'h-full opacity-60' : 'h-full cursor-pointer transition-transform duration-200 hover:-translate-y-1.5'}
      innerClassName="relative flex h-full flex-col items-center gap-2 p-4 text-center"
      style={{ boxShadow: selected ? `0 0 0 2px ${ACCENT}, 0 0 26px ${ACCENT}66` : `0 0 16px ${ACCENT}18` }}
      data-testid={`forge-${dw.wizard.id}`}
      role="button"
      tabIndex={maxed ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={maxed}
      onClick={maxed ? undefined : onSelect}
      onKeyDown={maxed ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
    >
      <span className="h-16 w-16 overflow-hidden rounded-xl ring-1" style={{ boxShadow: `0 0 0 1px ${theme.color}55` }}>
        <PortraitImage id={dw.wizard.id} house={dw.wizard.house} alt={dw.wizard.name} variant="bust" />
      </span>
      <h3 className="font-display text-base leading-tight">{displayName(dw)}</h3>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-white/80">{dw.spell?.name ?? '—'}</span>
        {typeChip && <Chip label={typeChip.label} color={typeChip.color} icon={typeChip.icon} />}
      </div>

      <span
        className="mt-0.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
        style={{ color: ACCENT, borderColor: `${ACCENT}66`, background: `${ACCENT}18` }}
      >
        Magia Lv. {level}{maxed ? ' · MAX' : ` → ${level + 1}`}
      </span>

      {maxed ? (
        <p className="mt-1 text-xs text-white/45">Maestria al culmine.</p>
      ) : boost ? (
        <p className="mt-1 text-sm text-white/70">
          {boost.label} <span className="text-white/40">{boost.from}{boost.suffix}</span>
          <span className="mx-1" style={{ color: ACCENT }}>→</span>
          <span className="font-semibold" style={{ color: ACCENT }}>{boost.to}{boost.suffix}</span>
          {boost.atLevel && <span className="ml-1 text-white/40">a Lv {boost.atLevel}</span>}
        </p>
      ) : (
        <p className="mt-1 text-sm text-white/50">Nessun bonus diretto — la maestria vale se cambi incantesimo</p>
      )}
    </Frame>
  )
}

/**
 * "Aumento Magia" node UI: pick one wizard to raise their equipped spell's mastery a level,
 * permanently scaling its power/heal for the rest of the run (capped at Lv {SPELL_LEVEL_MAX}).
 * The mastery follows the wizard even if they later swap spells. Non-combat, single choice.
 */
export function SpellForgeScreen({ team, onUpgrade }: {
  team: DraftedWizard[]
  onUpgrade: (wizardId: string) => void
}) {
  const [pick, setPick] = useState<string | null>(null)
  const anyUpgradable = team.some(d => (d.spellLevel ?? 1) < SPELL_LEVEL_MAX)

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6">
      <Insegna kicker="Camera degli Incantesimi" title="Aumenta una Magia" />
      <p className="max-w-xl text-center text-sm leading-relaxed text-white/60">
        Le rune antiche possono affinare l'incantesimo di un mago. Scegline uno: la sua magia salirà
        di livello, potenziandone le statistiche per il resto della run.
      </p>

      <Stagger delay={0.12} className="grid w-full max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {team.map(dw => (
          <StaggerItem key={dw.wizard.id} className="h-full">
            <ForgeCard dw={dw} selected={pick === dw.wizard.id} onSelect={() => setPick(dw.wizard.id)} />
          </StaggerItem>
        ))}
      </Stagger>

      {/* When every spell is already maxed there is nothing to pick, but the player must
          still be able to leave — proceed resolves the node as a no-op (any id works). */}
      <Button
        variant="primary"
        disabled={team.length === 0 || (anyUpgradable && !pick)}
        onClick={() => onUpgrade(pick ?? team[0]?.wizard.id ?? '')}
      >
        {anyUpgradable ? 'Incanta' : 'Prosegui'}
      </Button>
    </main>
  )
}
