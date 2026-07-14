import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SynergyTracker } from '@/components/draft/SynergyTracker'
import type { SynergyProgress, SynergyPreview } from '@/game/engine/synergy'
import type { Synergy } from '@/types'

// SynergyTracker groups rows by synergy.family and supersedes lower active tiers within a
// family — real, still-live UI logic (Synergy.family is still on the type), even though no
// SYNERGIES entry currently uses tiered families after the house/role removal. Build synthetic
// group-family rows directly instead of relying on team fixtures, so this exercises the
// component's grouping/supersession logic without depending on removed house/role synergies.
const fam = 'group:test'
const tier = (n: number, threshold: number): Synergy => ({
  id: `test${threshold}`, name: `Test ${threshold}`, kind: 'group', family: fam,
  requires: { tag: 'test', count: threshold }, bonus: { atk: n },
})

function row(threshold: number, count: number, active: boolean): SynergyProgress {
  return { synergy: tier(threshold, threshold), count, threshold, active, memberIds: [] }
}
function previewRow(threshold: number, count: number, active: boolean, nextCount: number, willActivate: boolean): SynergyPreview {
  return { ...row(threshold, count, active), nextCount, advances: nextCount > count, willActivate }
}

describe('SynergyTracker', () => {
  it('groups a family into one track and marks reached tier nodes', () => {
    // count=2 → tier-2 node reached (active), tier-3 and tier-4 nodes not reached.
    const rows = [row(2, 2, true), row(3, 2, false), row(4, 2, false)]
    const { container } = render(<SynergyTracker rows={rows} />)
    // One family header (name-only, count stripped)
    expect(screen.getByText('Test 2')).toBeInTheDocument()
    // tier-2 node is active; tier-3 node exists but is not active
    expect(container.querySelector('[data-synergy="test2"][data-active]')).toBeTruthy()
    expect(container.querySelector('[data-synergy="test3"]:not([data-active])')).toBeTruthy()
  })

  it('marks lower active tiers superseded when a higher tier of the same family is active', () => {
    const rows = [row(2, 4, true), row(3, 4, true), row(4, 4, true)]
    const { container } = render(<SynergyTracker rows={rows} />)
    expect(container.querySelector('[data-synergy="test4"][data-active]:not([data-superseded])')).toBeTruthy()
    expect(container.querySelector('[data-synergy="test2"][data-superseded]')).toBeTruthy()
    expect(container.querySelector('[data-synergy="test3"][data-superseded]')).toBeTruthy()
  })

  it('in preview mode marks the node that would activate', () => {
    // count 2 → nextCount 3, threshold 3: tier-3 is the node that willActivate.
    const rows = [
      previewRow(2, 2, true, 3, false),
      previewRow(3, 2, false, 3, true),
      previewRow(4, 2, false, 3, false),
    ]
    const { container } = render(<SynergyTracker rows={rows} candidateName="c" />)
    expect(screen.getByText(/Se peschi/)).toBeInTheDocument()
    expect(container.querySelector('[data-synergy="test3"][data-activates]')).toBeTruthy()
  })
})
