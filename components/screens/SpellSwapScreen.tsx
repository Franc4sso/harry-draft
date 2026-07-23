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
import { SPELL_BY_ID } from '@/data/spells'

const ACCENT = '#5ad1e0'

function WizardCard({ dw, selected, onSelect }: { dw: DraftedWizard; selected: boolean; onSelect: () => void }) {
  const theme = houseTheme(dw.wizard.house)
  return (
    <Frame
      variant="card"
      className="h-full cursor-pointer transition-transform duration-200 hover:-translate-y-1.5"
      innerClassName="relative flex h-full flex-col items-center gap-2 p-4 text-center"
      style={{ boxShadow: selected ? `0 0 0 2px ${ACCENT}, 0 0 26px ${ACCENT}66` : `0 0 16px ${ACCENT}18` }}
      data-testid={`spellswap-wizard-${dw.wizard.id}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
    >
      <span className="h-16 w-16 overflow-hidden rounded-xl ring-1" style={{ boxShadow: `0 0 0 1px ${theme.color}55` }}>
        <PortraitImage id={dw.wizard.id} house={dw.wizard.house} alt={dw.wizard.name} variant="bust" />
      </span>
      <h3 className="font-display text-base leading-tight">{displayName(dw)}</h3>
      <span className="text-sm font-medium text-white/60">{dw.spell?.name ?? '—'}</span>
    </Frame>
  )
}

function SpellCard({ spellId, selected, onSelect }: { spellId: string; selected: boolean; onSelect: () => void }) {
  const spell = SPELL_BY_ID[spellId]
  if (!spell) return null
  const typeChip = spell.type ? spellTypeChip(spell.type) : undefined
  return (
    <Frame
      variant="card"
      className="h-full cursor-pointer transition-transform duration-200 hover:-translate-y-1.5"
      innerClassName="relative flex h-full flex-col items-center gap-2 p-4 text-center"
      style={{ boxShadow: selected ? `0 0 0 2px ${ACCENT}, 0 0 26px ${ACCENT}66` : `0 0 16px ${ACCENT}18` }}
      data-testid={`spellswap-spell-${spell.id}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
    >
      <h3 className="font-display text-base leading-tight">{spell.name}</h3>
      {typeChip && <Chip label={typeChip.label} color={typeChip.color} icon={typeChip.icon} />}
      {spell.desc && <p className="mt-1 text-sm text-white/60">{spell.desc}</p>}
    </Frame>
  )
}

/**
 * "Cambia Magia" node UI: pick a wizard, then pick one of the 2 offered attack spells to
 * replace their equipped spell. FREE — no cost of any kind (no maxHP, no relic, no team
 * size change), so there is nothing to display before confirming beyond the pick itself.
 * Non-combat, single choice.
 */
export function SpellSwapScreen({ team, offers, onConfirm }: {
  team: DraftedWizard[]
  offers: string[]
  onConfirm: (wizardId: string, spellId: string) => void
}) {
  const [wizardId, setWizardId] = useState<string | null>(null)
  const [spellId, setSpellId] = useState<string | null>(null)

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6" data-testid="spellswap-screen">
      <Insegna kicker="Camera degli Incantesimi" title="Cambia Magia" />
      <p className="max-w-xl text-center text-sm leading-relaxed text-white/60">
        Scegli un mago e una nuova magia d'attacco per lui: lo scambio è gratuito.
      </p>

      <Stagger delay={0.12} className="grid w-full max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {team.map(dw => (
          <StaggerItem key={dw.wizard.id} className="h-full">
            <WizardCard dw={dw} selected={wizardId === dw.wizard.id} onSelect={() => setWizardId(dw.wizard.id)} />
          </StaggerItem>
        ))}
      </Stagger>

      <Stagger delay={0.12} className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        {offers.map(id => (
          <StaggerItem key={id} className="h-full">
            <SpellCard spellId={id} selected={spellId === id} onSelect={() => setSpellId(id)} />
          </StaggerItem>
        ))}
      </Stagger>

      <Button
        variant="primary"
        disabled={!wizardId || !spellId}
        data-testid="spellswap-confirm"
        onClick={() => onConfirm(wizardId!, spellId!)}
      >
        Conferma
      </Button>
    </main>
  )
}
