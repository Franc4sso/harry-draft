'use client'
import type { DraftedWizard } from '@/types'
import { WizardCardColumn } from '@/components/cards/WizardCardColumn'

export function DraftCandidateCard({
  drafted, onPick, onConsider, testId,
}: {
  drafted: DraftedWizard
  onPick?: () => void
  onConsider?: () => void
  testId?: string
}) {
  return (
    <div className="relative h-full w-full" onPointerEnter={onConsider} onFocus={onConsider} tabIndex={0}>
      <WizardCardColumn drafted={drafted} onClick={onPick} testId={testId} />
    </div>
  )
}
