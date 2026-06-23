import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeamScreen } from '@/components/screens/TeamScreen'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { synergyBonusText } from '@/lib/glossary'
import { detectSynergies } from '@/game/engine/synergy'

function team(ids: string[]) {
  const r = createRng(1)
  return ids.map((id) => draftWizard(r, WIZARD_BY_ID[id]!))
}

describe('TeamScreen', () => {
  it('renders all team members', () => {
    const t = team(['harry', 'ron', 'hermione', 'luna', 'neville'])
    render(<TeamScreen team={t} />)
    for (const m of t) expect(screen.getByText(m.wizard.name)).toBeInTheDocument()
  })
  it('shows the golden trio synergy when present', () => {
    const t = team(['harry', 'ron', 'hermione', 'luna', 'neville'])
    render(<TeamScreen team={t} />)
    expect(screen.getByText(/Golden Trio/i)).toBeInTheDocument()
  })
  it('shows synergy bonus text and member names', () => {
    const t = team(['harry', 'ron', 'hermione', 'luna', 'neville'])
    render(<TeamScreen team={t} />)
    const active = detectSynergies(t)
    expect(active.length).toBeGreaterThan(0)
    const first = active[0]!
    for (const txt of synergyBonusText(first.synergy.bonus)) {
      expect(screen.getByText(txt)).toBeInTheDocument()
    }
    const memberName = t.find((d) => first.memberIds.includes(d.wizard.id))!.wizard.name
    expect(screen.getAllByText(new RegExp(memberName)).length).toBeGreaterThan(0)
  })
  it('fires onRestart', async () => {
    const onRestart = vi.fn()
    const t = team(['harry', 'ron', 'hermione', 'luna', 'neville'])
    render(<TeamScreen team={t} onRestart={onRestart} />)
    await userEvent.click(screen.getByRole('button', { name: /nuova run/i }))
    expect(onRestart).toHaveBeenCalledOnce()
  })
})
