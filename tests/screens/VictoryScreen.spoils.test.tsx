import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VictoryScreen } from '@/components/screens/VictoryScreen'
import { rollSpoils } from '@/game/engine/spoils'
import { createRng } from '@/game/engine/rng'
import { SPELL_BY_ID } from '@/data/spells'
import type { BattleResult, DraftedWizard, Role, RunState, Wizard } from '@/types'

/** DraftedWizard minimale ma REALE (stessa forma di tests/engine/spoils.test.ts). */
function dw(id: string, role: Role, tags: string[], opts: { currentHp?: number } = {}): DraftedWizard {
  const s = { hp: 100, atk: 20, def: 0, spd: 10 }
  const wizard = {
    id, name: id, house: 'Grifondoro', role, tier: 1, gender: 'm' as const,
    ranges: { hp: [100, 100], atk: [20, 20], def: [0, 0], spd: [10, 10] },
    spellPool: ['base_attack'], tags,
  } as unknown as Wizard
  return {
    wizard, stats: s, maxHp: 100, spell: SPELL_BY_ID['base_attack']!,
    ...(opts.currentHp !== undefined ? { currentHp: opts.currentHp } : {}),
  } as unknown as DraftedWizard
}

/** Squadra a UN segnale-tag da CANCRENA: 'esecuzione' è acceso, il veleno ha un solo portatore. */
const team = () => [dw('avvelenatore', 'Attaccante', ['esecuzione', 'veleno']), dw('bruto', 'Tank', ['esecuzione'])]

function mkState(t: DraftedWizard[]): RunState {
  return { seed: 'spoglie-ui', phase: 'victory', team: t, activeSynergies: [], stage: 0, relics: [], area: 0, log: [] }
}

const result: BattleResult = {
  winner: 'left', turns: 4, log: [], mvpId: 'avvelenatore', timedOut: false,
  finalSnapshot: [{ id: 'avvelenatore', side: 'left', hp: 60, maxHp: 100, alive: true }],
  snapshots: [], kills: { left: 0, right: 0 }, alliesLost: 0,
}

function renderVictory(t: DraftedWizard[], onChooseSpoil = vi.fn()) {
  const spoils = rollSpoils(mkState(t), createRng('nodo-vittoria'))
  render(
    <VictoryScreen
      result={result} mvpName="avvelenatore" battleNumber={2} enemyCount={5} bossNext={false}
      onNext={vi.fn()} spoils={spoils} team={t} onChooseSpoil={onChooseSpoil}
    />,
  )
  return { spoils, onChooseSpoil }
}

describe('VictoryScreen — le Spoglie della Vittoria', () => {
  it('mostra tre carte scegliibili, e non il vecchio "Prosegui"', () => {
    const { spoils } = renderVictory(team())
    expect(spoils).toHaveLength(3)
    const section = screen.getByTestId('spoils-choice')
    for (const s of spoils) expect(within(section).getByTestId(`spoil-card-${s.id}`)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /prossima sfida/i })).not.toBeInTheDocument()
  })

  it('il Marchio che completa un Duo dice PERCHÉ, col nome del Duo', () => {
    renderVictory(team())
    const banner = screen.getByTestId('spoil-completes')
    expect(banner).toHaveAttribute('data-duo', 'cancrena')
    expect(banner.textContent).toMatch(/completa\s+cancrena/i)
  })

  it('una Spoglia con bersaglio chiede su QUALE mago, e la scelta porta id carta + id mago', async () => {
    const { spoils, onChooseSpoil } = renderVictory(team())
    const marchio = spoils.find(s => s.kind === 'marchio' && s.completes)!

    await userEvent.click(screen.getByTestId(`spoil-card-${marchio.id}`))
    expect(onChooseSpoil).not.toHaveBeenCalled() // prima serve il bersaglio
    expect(screen.getByTestId('spoil-targets')).toBeInTheDocument()
    // 'avvelenatore' ha già il veleno: un Marchio su di lui sarebbe un no-op → non è offerto.
    expect(screen.queryByTestId('spoil-target-avvelenatore')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('spoil-target-bruto'))
    expect(onChooseSpoil).toHaveBeenCalledWith({ spoilId: marchio.id, wizardId: 'bruto' })
  })

  it('una Spoglia senza bersaglio (Ristoro) si applica subito, senza chiedere nulla', async () => {
    const ferita = [dw('a', 'Attaccante', ['veleno'], { currentHp: 30 }), dw('b', 'Tank', [])]
    const { spoils, onChooseSpoil } = renderVictory(ferita)
    const ristoro = spoils.find(s => s.kind === 'ristoro')!

    await userEvent.click(screen.getByTestId(`spoil-card-${ristoro.id}`))
    expect(onChooseSpoil).toHaveBeenCalledWith({ spoilId: 'ristoro' })
    expect(screen.queryByTestId('spoil-targets')).not.toBeInTheDocument()
  })

  it("l'Allenamento chiede il bersaglio fra tutti i vivi", async () => {
    const { spoils, onChooseSpoil } = renderVictory(team())
    const allenamento = spoils.find(s => s.kind === 'allenamento')!

    await userEvent.click(screen.getByTestId(`spoil-card-${allenamento.id}`))
    expect(screen.getByTestId('spoil-target-avvelenatore')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('spoil-target-bruto'))
    expect(onChooseSpoil).toHaveBeenCalledWith({ spoilId: 'allenamento', wizardId: 'bruto' })
  })

  it('senza Spoglie la schermata resta il vecchio "Prosegui" (élite/boss, modalità infinita)', () => {
    const onNext = vi.fn()
    render(
      <VictoryScreen
        result={result} mvpName="avvelenatore" battleNumber={2} enemyCount={5} bossNext={false} onNext={onNext}
      />,
    )
    expect(screen.queryByTestId('spoils-choice')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /prossima sfida/i })).toBeInTheDocument()
  })

  it('il referto (MVP, turni, caduti) resta sulla schermata anche con la scelta', () => {
    renderVictory(team())
    expect(screen.getByText(/MVP/)).toBeInTheDocument()
    expect(screen.getByText('Turni')).toBeInTheDocument()
  })
})
