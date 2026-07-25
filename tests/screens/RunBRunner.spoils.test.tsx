import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
})
import { RunBRunner, type RunnerController } from '@/components/screens/RunBRunner'
import { SPELL_BY_ID } from '@/data/spells'
import type { BattleResult, DraftedWizard, Role, RunNode, RunNodeType, RunState, Wizard } from '@/types'

function dw(id: string, role: Role, tags: string[]): DraftedWizard {
  const s = { hp: 100, atk: 20, def: 0, spd: 10 }
  const wizard = {
    id, name: id, house: 'Grifondoro', role, tier: 1, gender: 'm' as const,
    ranges: { hp: [100, 100], atk: [20, 20], def: [0, 0], spd: [10, 10] },
    spellPool: ['base_attack'], tags,
  } as unknown as Wizard
  return { wizard, stats: s, maxHp: 100, spell: SPELL_BY_ID['base_attack']!, level: 1 } as unknown as DraftedWizard
}

const result: BattleResult = {
  winner: 'left', turns: 3, log: [], mvpId: 'avvelenatore', timedOut: false,
  finalSnapshot: [{ id: 'avvelenatore', side: 'left', hp: 70, maxHp: 100, alive: true }],
  snapshots: [], kills: { left: 0, right: 0 }, alliesLost: 0,
}

/** Controller finto in fase 'victory' su un nodo del tipo dato. Le callback sono no-op: qui si
 *  verifica SOLO il cablaggio (chi riceve le Spoglie e chi no), non gli effetti. */
function controllerAt(nodeType: RunNodeType, opts: { withSpoils: boolean }): RunnerController {
  const node: RunNode = { id: 'a0f1n0', type: nodeType, next: [] }
  const team = [dw('avvelenatore', 'Attaccante', ['esecuzione', 'veleno']), dw('bruto', 'Tank', ['esecuzione'])]
  const run: RunState = {
    seed: 'runner-spoglie', phase: 'victory', team, activeSynergies: [], stage: 0, relics: [],
    area: 0, map: [node], currentNodeId: node.id, log: [],
  }
  const noop = vi.fn()
  return {
    run, view: 'victory', battle: { result, enemy: [] } as unknown as RunnerController['battle'],
    reachable: [], currentNode: node, lastFallen: [],
    chooseNode: noop, commitBattle: noop, acknowledgeVictory: noop,
    chooseRecruit: noop, skipRecruit: noop, chooseRelic: noop, ackInfirmary: noop,
    currentEvent: null, chooseEventOption: noop, chooseSpellUpgrade: noop,
    useConsumableRelic: noop, advanceArea: noop,
    ...(opts.withSpoils ? { chooseSpoil: noop } : {}),
  }
}

describe('RunBRunner — cablaggio delle Spoglie', () => {
  it('dopo una battaglia NORMALE di campagna offre le tre Spoglie', () => {
    render(<RunBRunner seed="runner-spoglie" controller={controllerAt('battle', { withSpoils: true })} />)
    expect(screen.getByTestId('spoils-choice')).toBeInTheDocument()
    expect(screen.getByTestId('spoil-card-allenamento')).toBeInTheDocument()
    // keyword-aware fino alla UI: la squadra è a un segnale da Cancrena.
    expect(screen.getByTestId('spoil-completes')).toHaveAttribute('data-duo', 'cancrena')
  })

  it('dopo un ÉLITE non offre nulla (§5: élite e boss hanno già le loro ricompense)', () => {
    render(<RunBRunner seed="runner-spoglie" controller={controllerAt('elite', { withSpoils: true })} />)
    expect(screen.queryByTestId('spoils-choice')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /prossima sfida|boss/i })).toBeInTheDocument()
  })

  it('senza chooseSpoil (modalità infinita, §6) la vittoria resta il vecchio "Prosegui"', () => {
    render(<RunBRunner seed="runner-spoglie" controller={controllerAt('battle', { withSpoils: false })} />)
    expect(screen.queryByTestId('spoils-choice')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /prossima sfida|boss/i })).toBeInTheDocument()
  })
})
