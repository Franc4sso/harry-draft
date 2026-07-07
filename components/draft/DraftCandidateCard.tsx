'use client'
import type { DraftedWizard } from '@/types'
import { WizardCardColumn } from '@/components/cards/WizardCardColumn'

export function DraftCandidateCard({
  drafted, hotSynergyIds, onPick, onConsider, testId,
}: {
  drafted: DraftedWizard
  hotSynergyIds?: ReadonlySet<string>
  onPick?: () => void
  onConsider?: () => void
  testId?: string
}) {
  return (
    <div className="relative h-full w-full" onPointerEnter={onConsider} onFocus={onConsider} tabIndex={0}>
      <WizardCardColumn drafted={drafted} onClick={onPick} hotSynergyIds={hotSynergyIds} testId={testId} />
    </div>
  )
}
