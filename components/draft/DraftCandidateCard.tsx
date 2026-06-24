'use client'
import type { DraftedWizard } from '@/types'
import { WizardCard } from '@/components/cards/WizardCard'

export function DraftCandidateCard({
  drafted, hotSynergyIds, onPick, onConsider,
}: {
  drafted: DraftedWizard
  hotSynergyIds?: ReadonlySet<string>
  onPick?: () => void
  onConsider?: () => void
}) {
  return (
    <div className="relative w-56 max-w-full" onPointerEnter={onConsider} onFocus={onConsider} tabIndex={0}>
      <WizardCard drafted={drafted} onClick={onPick} hotSynergyIds={hotSynergyIds} />
    </div>
  )
}
