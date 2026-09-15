import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TurnLane } from '@/components/battle/TurnLane'
import { buildReplay } from '@/game/engine/combat/replay'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { detectSynergies } from '@/game/engine/synergy'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'
import { lastRealActorAt } from '@/lib/initiative'

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

  it('su un frame di sistema a metà battaglia, "adesso" resta chi ha agito per ultimo (non il primo della battaglia)', () => {
    const replay = fixture()
    // Find a genuine mid-battle system frame: one that comes strictly after
    // at least one real action (so it's not the pre-battle case) and is
    // itself system/actorless. A skipped turn, a KO narration, a "Ricarica" —
    // all land here, and making exactly this case legible is the point of
    // the lane: it must not jump to a stranger when one fires.
    const firstReal = replay.frames.findIndex(f => f.entry && f.entry.type !== 'system' && f.entry.actorSide)
    const systemIndex = replay.frames.findIndex(
      (f, i) => i > firstReal && (!f.entry || f.entry.type === 'system' || !f.entry.actorSide),
    )
    expect(systemIndex).toBeGreaterThan(firstReal) // fixture actually has one to test against

    const expected = lastRealActorAt(replay, systemIndex)
    expect(expected).not.toBeNull()

    render(<TurnLane replay={replay} index={systemIndex} />)
    const nowSlots = screen.getAllByTestId('lane-slot').filter(s => s.dataset.now === 'true')
    expect(nowSlots).toHaveLength(1)
    expect(nowSlots[0]).toHaveAttribute('data-unit', expected)
    // The regression this guards against: falling back to the battle's very
    // first actor instead of the one who last really acted.
    const firstEntry = replay.frames[firstReal]!.entry!
    const battleFirstActor = `${firstEntry.actorSide}:${firstEntry.actorId}`
    if (battleFirstActor !== expected) {
      expect(nowSlots[0]).not.toHaveAttribute('data-unit', battleFirstActor)
    }
  })
})
