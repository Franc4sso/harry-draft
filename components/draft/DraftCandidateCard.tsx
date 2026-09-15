'use client'
import type { DraftedWizard } from '@/types'
import { WizardCard } from '@/components/cards/WizardCard'

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
      <WizardCard drafted={drafted} density="full" portraitHeight="fill" onClick={onPick} testId={testId} />
    </div>
  )
}
