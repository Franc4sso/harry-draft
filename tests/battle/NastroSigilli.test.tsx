import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NastroSigilli } from '@/components/battle/NastroSigilli'
import { buildReplay } from '@/game/engine/combat/replay'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { detectSynergies } from '@/game/engine/synergy'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { lastRealActorAt } from '@/lib/initiative'

const team = (ids: string[], s: string) =>
  ids.map(id => draftWizard(createRng(`${s}-${id}`), WIZARD_BY_ID[id]!, false))

function fixture() {
  const l = team(['harry','hermione','ron'], 'L')
  const r = team(['draco','goyle','crabbe'], 'R')
  const res = simulateBattle(l, r, createRng(7), { leftSyn: detectSynergies(l), rightSyn: detectSynergies(r) })
  return buildReplay(res, l, r, { leftSyn: detectSynergies(l), rightSyn: detectSynergies(r), leftRelics: [], rightRelics: [] })
}

describe('NastroSigilli', () => {
  it('mostra la sequenza degli incantesimi in arrivo', () => {
    render(<NastroSigilli replay={fixture()} index={3} />)
    expect(screen.getAllByTestId('sigillo').length).toBeGreaterThanOrEqual(4)
  })

  it('il turno attuale è in fuoco, e dice chi lancia cosa', () => {
    render(<NastroSigilli replay={fixture()} index={3} />)
    const f = screen.getByTestId('nastro-focus')
    expect(f.textContent).toMatch(/\S/)
    expect(f).toHaveAttribute('data-unit')
  })

  it('ogni sigillo porta il TIPO dell incantesimo', () => {
    render(<NastroSigilli replay={fixture()} index={3} />)
    const s = screen.getAllByTestId('sigillo')
    expect(s.some(x => x.getAttribute('data-tipo'))).toBe(true)
  })

  it('chi salterà porta la tacca, prima che accada', () => {
    const replay = fixture()
    const key = replay.units[0]!.key
    const patched = { ...replay, frames: replay.frames.map(f => ({
      ...f, statusEffects: { ...f.statusEffects,
        [key]: [{ kind: 'stun', statusId: 'stun', remaining: 2, stacks: 1 }] } })) }
    render(<NastroSigilli replay={patched as never} index={1} />)
    expect(screen.getAllByTestId('tacca-salta').length).toBeGreaterThanOrEqual(1)
  })

  it('sui frame di sistema il fuoco non si svuota', () => {
    // Un tick di veleno o un Duo non hanno attore proprio: il fuoco resta
    // sull'ultima azione vera, come già fa il resto della scena.
    const replay = fixture()
    const sys = replay.frames.findIndex(f => f.entry?.type === 'system')
    const idx = sys >= 0 ? sys : 2
    // Verità di riferimento: chi ha agito per ultimo PRIMA/AL frame di sistema,
    // calcolato con la stessa funzione che il componente usa per il fallback.
    // Non basta che il fuoco non sia vuoto (frame.entry di un frame di sistema
    // porta comunque un actorId/actorSide popolati per il suo effetto, quindi
    // "non vuoto" passerebbe anche leggendo l'attore sbagliato) — deve essere
    // proprio quest'unità.
    const expectedKey = lastRealActorAt(replay, idx)
    expect(expectedKey).not.toBeNull()
    render(<NastroSigilli replay={replay} index={idx} />)
    const focus = screen.getByTestId('nastro-focus')
    expect(focus.textContent).toMatch(/\S/)
    expect(focus).toHaveAttribute('data-unit', expectedKey)
  })
})
