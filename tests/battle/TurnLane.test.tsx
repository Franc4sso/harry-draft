import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TurnLane } from '@/components/battle/TurnLane'
import { buildReplay } from '@/game/engine/combat/replay'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { detectSynergies } from '@/game/engine/synergy'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

const team = (ids: string[]) =>
  ids.map(id => draftWizard(createRng(`lane-${id}`), WIZARDS.find(w => w.id === id)!, false))

function fixture() {
  const l = team(['hermione', 'ron', 'harry'])
  const r = team(['draco', 'goyle', 'crabbe'])
  const res = simulateBattle(l, r, createRng(7), { leftSyn: detectSynergies(l), rightSyn: detectSynergies(r) })
  return buildReplay(res, l, r, { leftSyn: detectSynergies(l), rightSyn: detectSynergies(r), leftRelics: [], rightRelics: [] })
}

describe('TurnLane', () => {
  it('mostra i prossimi turni', () => {
    const replay = fixture()
    render(<TurnLane replay={replay} index={0} />)
    expect(screen.getAllByTestId('lane-slot').length).toBeGreaterThanOrEqual(4)
  })

  it('ogni posto dice CHI agisce e CON COSA', () => {
    const replay = fixture()
    render(<TurnLane replay={replay} index={0} />)
    const first = screen.getAllByTestId('lane-slot')[0]!
    expect(first).toHaveAttribute('data-unit')
    expect(first.textContent).toMatch(/\S/)
  })

  it('marca il posto di chi agisce adesso', () => {
    const replay = fixture()
    render(<TurnLane replay={replay} index={3} />)
    expect(screen.getAllByTestId('lane-slot').filter(s => s.dataset.now === 'true')).toHaveLength(1)
  })

  it('chi è stordito porta il bollino: si sa PRIMA che salterà', () => {
    const replay = fixture()
    const key = replay.units[0]!.key
    const patched = {
      ...replay,
      frames: replay.frames.map(f => ({
        ...f,
        statusEffects: { ...f.statusEffects, [key]: [{ kind: 'stun', statusId: 'stun', remaining: 2, stacks: 1 }] },
      })),
    }
    render(<TurnLane replay={patched as never} index={0} />)
    expect(screen.getAllByTestId('lane-skip').length).toBeGreaterThanOrEqual(1)
  })

  it('un silenziato mostra "colpo base" invece della sua magia', () => {
    const replay = fixture()
    const key = replay.units[0]!.key
    const patched = {
      ...replay,
      frames: replay.frames.map(f => ({
        ...f,
        statusEffects: { ...f.statusEffects, [key]: [{ kind: 'silence', statusId: 'silence', remaining: 2, stacks: 1 }] },
      })),
    }
    render(<TurnLane replay={patched as never} index={0} />)
    expect(screen.getByText(/colpo base/i)).toBeInTheDocument()
  })
})
