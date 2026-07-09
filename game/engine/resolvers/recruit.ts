import type { DraftedWizard, Relic, RunEvent, RunNode, RunState } from '@/types'
import type { Rng } from '../rng'
import { offerRecruits, recruitVia, replaceMember } from '../recruit'
import { offerRelics, offerJokers } from '../relics'
import { detectSynergies } from '../synergy'
import { livingOf } from '../roster'
import { parseAreaNodeId } from '../map'
import { enemyLevelFor } from '../combat/threat'
import { BALANCE } from '@/data/constants'
import type { NodeResolver, ResolverChoice } from './types'

/** Deterministic per (seed, node id): the same trio every time the node is entered. */
export function recruitOffer(state: RunState, node: RunNode, rng: Rng): DraftedWizard[] {
  const { area, floor, idx } = parseAreaNodeId(node.id)
  const r = rng.fork(1000 + area * 100 + floor * 10 + idx)
  return offerRecruits(r, { exclude: new Set(state.team.map(t => t.wizard.id)) })
}

export function relicOffer(state: RunState, node: RunNode, rng: Rng): Relic[] {
  const { area, floor, idx } = parseAreaNodeId(node.id)
  const r = rng.fork(2000 + area * 100 + floor * 10 + idx)
  const isJoker = r.next() < BALANCE.relics.jokerNodeChance
  return isJoker ? offerJokers(r, state.relics) : offerRelics(r, state.relics, 0)
}

export const recruitResolver: NodeResolver = {
  id: 'recruit',
  enter: (state, node, rng) => ({ offers: { wizardIds: recruitOffer(state, node, rng).map(d => d.wizard.id) }, isCombat: false }),
  resolve: (state, node, choice, rng) => {
    if (choice.kind !== 'recruit-pick') return state
    const offer = recruitOffer(state, node, rng)
    const picked = offer.find(d => d.wizard.id === choice.wizardId)
    if (!picked) return state
    const { area } = parseAreaNodeId(node.id)
    const recruit = recruitVia(picked, 'Reclutamento', enemyLevelFor(area, 'normal', false))
    const team = choice.replaceId
      ? replaceMember(state.team, choice.replaceId, recruit)
      : [...state.team, recruit]
    const ev: RunEvent = { area: state.area ?? 0, nodeId: node.id, kind: 'recruit',
      summary: `Recluti ${recruit.wizard.name} (${recruit.wizard.house})` }
    return { ...state, team, activeSynergies: detectSynergies(livingOf(team)), log: [...(state.log ?? []), ev] }
  },
}

export const relicResolver: NodeResolver = {
  id: 'relic',
  enter: (state, node, rng) => ({ offers: { relicIds: relicOffer(state, node, rng).map(r => r.id) }, isCombat: false }),
  resolve: (state, node, choice, rng) => {
    if (choice.kind !== 'relic-pick') return state
    const offer = relicOffer(state, node, rng)
    const relic = offer.find(r => r.id === choice.relicId)
    if (!relic) return state
    const ev: RunEvent = { area: state.area ?? 0, nodeId: node.id, kind: 'relic',
      summary: `Ottieni la reliquia ${relic.name ?? relic.id}` }
    const active = { relic, stageObtained: state.stage, ...(choice.assignedTo ? { assignedTo: choice.assignedTo } : {}) }
    return { ...state, relics: [...state.relics, active], log: [...(state.log ?? []), ev] }
  },
}
