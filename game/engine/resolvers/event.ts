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

/**
 * SHARED, single source of truth for resolving an event choice: picks the event via the
 * SAME `eventForNode` used by `enter` (so the choice always matches what was displayed),
 * applies its effects exactly ONCE, and returns both the resulting RunState and the
 * Cioccorane delta from that single application. Callers (the resolver below, and the
 * controller) must NOT re-derive the node's event via their own salt formula — that risks
 * a silent desync between the committed RunState and the currency delta applied to the
 * profile. If `optionId` doesn't match any choice on the picked event (should not happen
 * given a UI built from `enter`'s offer), this is a no-op: state unchanged, delta 0.
 */
export function resolveEventChoice(
  state: RunState, node: RunNode, optionId: string, rng: Rng,
): { state: RunState; cioccoraneDelta: number } {
  const { event, rng: forked } = eventForNode(node, rng)
  const picked = event.choices.find(c => c.id === optionId)
  if (!picked) return { state, cioccoraneDelta: 0 }
  const { state: nextState, cioccoraneDelta } = applyEventEffects(state, picked.effects, forked)
  const ev: RunEvent = { area: state.area ?? 0, nodeId: node.id, kind: 'event',
    summary: picked.resultText }
  return { state: { ...nextState, log: [...(nextState.log ?? []), ev] }, cioccoraneDelta }
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
    return resolveEventChoice(state, node, choice.optionId, rng).state
  },
}
