'use client'
import type { DraftedWizard } from '@/types'
import { WizardCardColumn } from '@/components/cards/WizardCardColumn'
import type { DuoPreview } from '@/game/engine/duos'

export function DraftCandidateCard({
  drafted, hotSynergyIds, onPick, onConsider, testId, duoPreview,
}: {
  drafted: DraftedWizard
  hotSynergyIds?: ReadonlySet<string>
  onPick?: () => void
  onConsider?: () => void
  testId?: string
  duoPreview?: DuoPreview
}) {
  return (
    <div className="relative h-full w-full" onPointerEnter={onConsider} onFocus={onConsider} tabIndex={0}>
      <WizardCardColumn drafted={drafted} onClick={onPick} hotSynergyIds={hotSynergyIds} testId={testId} duoPreview={duoPreview} />
    </div>
  )
}
