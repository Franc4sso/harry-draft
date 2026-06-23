'use client'
import type { DraftedWizard } from '@/types'
import { WizardCard } from '@/components/cards/WizardCard'
import { wizardAffiliations } from '@/lib/affiliations'

export function DraftCandidateCard({
  drafted, hotSynergyIds, onPick, onConsider,
}: {
  drafted: DraftedWizard
  hotSynergyIds?: ReadonlySet<string>
  onPick?: () => void
  onConsider?: () => void
}) {
  const affs = wizardAffiliations(drafted.wizard)
  return (
    <div
      className="flex w-60 flex-col gap-2"
      onPointerEnter={onConsider}
      onFocus={onConsider}
      tabIndex={0}
    >
      <WizardCard drafted={drafted} onClick={onPick} />
      {affs.length > 0 && (
        <div className="flex flex-wrap gap-1 px-1">
          {affs.map((a) => {
            const hot = hotSynergyIds?.has(a.synergyId) ?? false
            return (
              <span
                key={a.synergyId}
                data-synergy={a.synergyId}
                data-hot={hot ? '' : undefined}
                className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                style={
                  hot
                    ? { color: '#f3e6c4', borderColor: '#b08d57', background: 'rgba(176,141,87,0.28)', boxShadow: '0 0 8px rgba(176,141,87,0.4)' }
                    : { color: '#d9c79a', borderColor: 'rgba(168,140,90,0.5)', background: 'rgba(124,58,237,0.12)' }
                }
              >
                {a.label}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
