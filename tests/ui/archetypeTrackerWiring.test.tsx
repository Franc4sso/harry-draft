import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { DraftScreen } from '@/components/screens/DraftScreen'
import { RecruitScreen } from '@/components/screens/RecruitScreen'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import { createRng } from '@/game/engine/rng'

// Wiring-only tests: verify ArchetypeTracker ("Costellazioni") is mounted next to the
// DuoTracker in both the draft and recruit screens. The tracker's own logic (states,
// active/near, effects) is unit-tested in tests/ui/archetypeTracker.test.tsx (Task 3);
// here we only need proof the component is actually rendered in-screen.
describe('ArchetypeTracker wiring', () => {
  it('is mounted in DraftScreen next to the DuoTracker', () => {
    const { container } = render(<DraftScreen seed="arch-wire-1" onComplete={() => {}} />)
    expect(container.querySelector('[data-testid="draft-duo-tracker"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="draft-archetype-tracker"]')).not.toBeNull()
    expect(container.querySelector('[data-arch="tossicita"]')).not.toBeNull()
  })

  it('is mounted in RecruitScreen next to the DuoTracker', () => {
    const team = offerRecruits(createRng(1), { exclude: new Set() })
      .slice(0, 2)
      .map(d => recruitVia(d, 'iniziale', 1))
    const offer = offerRecruits(createRng(2), { exclude: new Set(team.map(t => t.wizard.id)) })
    const onPick = vi.fn()
    const { container } = render(
      <RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} relics={[]} />,
    )
    expect(container.querySelector('[data-testid="draft-duo-tracker"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="draft-archetype-tracker"]')).not.toBeNull()
    expect(container.querySelector('[data-arch="tossicita"]')).not.toBeNull()
  })
})
