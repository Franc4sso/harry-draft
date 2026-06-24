'use client'
import type { DraftedWizard } from '@/types'
import { WizardCard } from '@/components/cards/WizardCard'
import { affiliationChips } from '@/lib/affiliationChips'
import { HouseCrest } from '@/components/ui/HouseCrest'
import { RoleIcon } from '@/components/cards/RoleIcon'
import { cn } from '@/lib/theme'

export function DraftCandidateCard({
  drafted, hotSynergyIds, onPick, onConsider,
}: {
  drafted: DraftedWizard
  hotSynergyIds?: ReadonlySet<string>
  onPick?: () => void
  onConsider?: () => void
}) {
  const chips = affiliationChips(drafted.wizard)
  return (
    <div className="relative w-44" onPointerEnter={onConsider} onFocus={onConsider} tabIndex={0}>
      <WizardCard drafted={drafted} onClick={onPick} />
      <div
        data-testid="affiliation-strip"
        className="mt-1.5 flex flex-wrap items-center gap-1"
      >
        {chips.map((c) => {
          const hot = c.synergyId ? hotSynergyIds?.has(c.synergyId) ?? false : false
          const isSpecial = c.kind === 'special'
          return (
            <span
              key={c.id}
              data-synergy={c.synergyId}
              data-hot={hot ? '' : undefined}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
                hot && 'resa-animated',
              )}
              style={
                hot
                  ? { color: '#f3e6c4', borderColor: '#caa24a', background: 'rgba(120,90,40,0.6)', boxShadow: '0 0 8px rgba(202,162,74,0.6)' }
                  : isSpecial
                    ? { color: '#ead9b0', borderColor: 'rgba(176,141,87,0.55)', background: 'rgba(176,141,87,0.12)' }
                    : { color: 'rgba(255,255,255,0.82)', borderColor: 'rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.05)' }
              }
            >
              {c.kind === 'house' && <HouseCrest house={drafted.wizard.house} size={11} />}
              {c.kind === 'role' && <RoleIcon role={drafted.wizard.role} size={11} />}
              {isSpecial && <span aria-hidden style={{ color: '#caa24a' }}>◆</span>}
              {c.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
