'use client'
import type { DraftedWizard } from '@/types'
import { WizardCardRow } from '@/components/cards/WizardCardRow'

export function DraftCandidateCard({
  drafted, hotSynergyIds, onPick, onConsider,
}: {
  drafted: DraftedWizard
  hotSynergyIds?: ReadonlySet<string>
  onPick?: () => void
  onConsider?: () => void
}) {
  return (
    <div className="relative w-full" onPointerEnter={onConsider} onFocus={onConsider} tabIndex={0}>
      <WizardCardRow drafted={drafted} onClick={onPick} hotSynergyIds={hotSynergyIds} />
    </div>
  )
}
