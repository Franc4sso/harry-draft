import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WizardCard } from '@/components/cards/WizardCard'
import type { DraftedWizard } from '@/types'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'

// UnitBust è stato sostituito da WizardCard density="combat" (Task 11). Il livello ora
// vive su `drafted.level` (non più su due prop separate `level`/`unit.level` con fallback):
// BattleArena.toDrafted già lo passa da ReplayUnit.level, quindi un solo campo basta.
const drafted = (level?: number): DraftedWizard => ({
  ...draftWizard(createRng(1), WIZARD_BY_ID['harry']!),
  level,
})

describe('WizardCard level badge (density combat)', () => {
  it('shows the level carried on the drafted wizard', () => {
    render(<WizardCard drafted={drafted(4)} density="combat" currentHp={80} />)
    expect(screen.getByText(/Lv\.?\s*4/i)).toBeInTheDocument()
  })

  it('shows no level badge when the drafted wizard carries none (e.g. an enemy with no level assigned yet)', () => {
    render(<WizardCard drafted={drafted(undefined)} density="combat" currentHp={80} />)
    expect(screen.queryByTestId('card-level-badge')).toBeNull()
  })
})
