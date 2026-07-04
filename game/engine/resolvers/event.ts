import type { RunEvent, RunNode, RunState } from '@/types'
import type { Rng } from '../rng'
import { EVENTS, type GameEvent } from '@/data/events'
import { applyEventEffects } from '../events'
import { parseAreaNodeId } from '../map'
import type { NodeResolver, ResolverEntry } from './types'

/** Uniform pick over the event catalog. */
export function pickEvent(rng: Rng): GameEvent {
  return rng.pick(EVENTS)
}

/** Deterministic per (seed, node id): the same event every time the node is entered,
 *  and the SAME forked rng stream is returned so effect resolution continues from the
 *  post-pick state (mirrors recruitOffer's node-salted fork). */
function eventForNode(node: RunNode, rng: Rng): { event: GameEvent; rng: Rng } {
  const { area, floor, idx } = parseAreaNodeId(node.id)
  const forked = rng.fork(3000 + area * 100 + floor * 10 + idx)
  return { event: pickEvent(forked), rng: forked }
}

function summarize(event: GameEvent): NonNullable<ResolverEntry['event']> {
  return {
    id: event.id,
    title: event.title,
    text: event.text,
    choices: event.choices.map(c => ({ id: c.id, label: c.label })),
  }
}

export const eventResolver: NodeResolver = {
  id: 'event',
  enter: (_state, node, rng) => ({
    offers: {},
    isCombat: false,
    event: summarize(eventForNode(node, rng).event),
  }),
  resolve: (state, node, choice, rng) => {
    if (choice.kind !== 'event-choice') return state
    const { event, rng: forked } = eventForNode(node, rng)
    const picked = event.choices.find(c => c.id === choice.optionId)
    if (!picked) return state
    const { state: nextState } = applyEventEffects(state, picked.effects, forked)
    const ev: RunEvent = { area: state.area ?? 0, nodeId: node.id, kind: 'event',
      summary: picked.resultText }
    return { ...nextState, log: [...(nextState.log ?? []), ev] }
  },
}
