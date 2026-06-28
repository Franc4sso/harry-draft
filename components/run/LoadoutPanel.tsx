'use client'

import { useState } from 'react'
import { SPELL_BY_ID } from '@/data/spells'
import type { DraftedWizard } from '@/types'
import { PortraitImage } from '@/components/ui/PortraitImage'

export function LoadoutPanel({
  team, onSetSpell,
}: {
  team: DraftedWizard[]
  onSetSpell: (wizardId: string, spellId: string) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Loadout</span>
      <ul className="mt-2 flex flex-col gap-1.5">
        {team.map((m) => {
          const expanded = open === m.wizard.id
          return (
            <li key={m.wizard.id} className="rounded-xl bg-black/30">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : m.wizard.id)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-2 p-1.5 text-left"
              >
                <span className="h-8 w-8 shrink-0 overflow-hidden rounded-md">
                  <PortraitImage id={m.wizard.id} house={m.wizard.house} alt={m.wizard.name} variant="bust" />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/85">{m.wizard.name}</span>
                <span className="truncate text-[11px] text-white/55">{m.spell.name}</span>
              </button>
              {expanded && (
                <div className="flex flex-wrap gap-1 px-1.5 pb-1.5" role="group" aria-label={`Incantesimi di ${m.wizard.name}`}>
                  {m.wizard.spellPool.map((sid) => {
                    const spell = SPELL_BY_ID[sid]
                    if (!spell) return null
                    const active = m.spell.id === sid
                    return (
                      <button
                        key={sid}
                        type="button"
                        onClick={() => onSetSpell(m.wizard.id, sid)}
                        aria-pressed={active}
                        title={spell.desc}
                        className={
                          'rounded-md border px-2 py-0.5 text-[11px] transition ' +
                          (active
                            ? 'border-amber-300/70 bg-amber-300/15 text-amber-100'
                            : 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10')
                        }
                      >
                        {spell.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
