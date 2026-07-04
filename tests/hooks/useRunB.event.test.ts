import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRunB } from '@/hooks/useRunB'
import { startDraft, pickFrom } from '@/game/engine/draftSession'
import { clearRun, saveRun } from '@/lib/runStore'
import { loadProfile, saveProfile } from '@/lib/metaStore'
import { eventResolver } from '@/game/engine/resolvers/event'
import { createRng } from '@/game/engine/rng'
import { setDraftPoolRestriction } from '@/game/engine/draft'
import type { RunNode, RunState } from '@/types'

/** Two deterministic starter picks from the draft session for a given seed. */
function twoPicks(seed: string) {
  let s = startDraft(seed)
  s = pickFrom(s, 0)
  s = pickFrom(s, 0)
  return s.picks
}

beforeEach(() => { try { clearRun() } catch {} ; localStorage.clear() })
afterEach(() => setDraftPoolRestriction(null))

/** Same splice technique as tests/hooks/useRunB.test.ts: add a direct edge from the
 *  current node to the target so chooseNode can reach it without a full playthrough. */
function withDirectEdgeTo(run: RunState, targetId: string): RunState {
  return {
    ...run,
    map: run.map!.map(n => (n.id === run.currentNodeId ? { ...n, next: [...n.next, targetId] } : n)),
  }
}

function withNodeAsEvent(run: RunState, nodeId: string): RunState {
  return { ...run, map: run.map!.map(n => (n.id === nodeId ? { ...n, type: 'event' } : n)) }
}

/** Find a node whose deterministic event pick (keyed off the node's own id, per
 *  eventForNode's node-salted fork) matches `predicate`. Probes via the real
 *  `eventResolver.enter` rather than duplicating the private salt formula. */
function findEventNode(run: RunState, predicate: (eventId: string) => boolean): RunNode {
  const candidates = run.map!.filter(n => n.type !== 'boss' && n.id !== run.currentNodeId)
  for (const node of candidates) {
    const entry = eventResolver.enter(run, node, createRng(run.seed))
    if (entry.event && predicate(entry.event.id)) return node
  }
  throw new Error('no node in this generated map resolves to a matching event')
}

describe('useRunB event wiring', () => {
  it('exposes the current event with per-choice enabled flags (gated by profile Cioccorane)', () => {
    const first = renderHook(() => useRunB('seed-c'))
    act(() => first.result.current.completeDraft(twoPicks('seed-c')))
    const run = first.result.current.run
    const node = findEventNode(run, id => id === 'fonte') // the only minCioccorane-gated event

    saveRun(withNodeAsEvent(withDirectEdgeTo(run, node.id), node.id))
    const second = renderHook(() => useRunB('seed-c'))
    act(() => second.result.current.chooseNode(node.id))

    expect(second.result.current.view).toBe('event')
    expect(second.result.current.currentEvent).not.toBeNull()
    expect(second.result.current.currentEvent!.id).toBe('fonte')

    expect(loadProfile().cioccorane).toBeLessThan(30)
    const offer = second.result.current.currentEvent!.choices.find(c => c.id === 'offer')!
    expect(offer.enabled).toBe(false)
    expect(offer.reason).toBeTruthy()
    const leave = second.result.current.currentEvent!.choices.find(c => c.id === 'leave')!
    expect(leave.enabled).toBe(true)
  })

  it('chooseEventOption applies run-resource effects and returns to the map', () => {
    const first = renderHook(() => useRunB('seed-c'))
    act(() => first.result.current.completeDraft(twoPicks('seed-c')))
    const run = first.result.current.run
    // Damage the team so the fonte 'offer' full heal is observable.
    const damaged: RunState = { ...run, team: run.team.map(d => ({ ...d, currentHp: 1 })) }
    const node = findEventNode(damaged, id => id === 'fonte')
    saveProfile({ ...loadProfile(), cioccorane: 50 })

    saveRun(withNodeAsEvent(withDirectEdgeTo(damaged, node.id), node.id))
    const second = renderHook(() => useRunB('seed-c'))
    act(() => second.result.current.chooseNode(node.id))
    expect(second.result.current.view).toBe('event')
    expect(second.result.current.currentEvent!.choices.find(c => c.id === 'offer')!.enabled).toBe(true)

    act(() => second.result.current.chooseEventOption('offer'))

    expect(second.result.current.view).toBe('map')
    for (const dw of second.result.current.run.team) expect(dw.currentHp).toBe(dw.maxHp)
  })

  it('a Cioccorane-cost choice deducts from the profile', () => {
    const first = renderHook(() => useRunB('seed-c'))
    act(() => first.result.current.completeDraft(twoPicks('seed-c')))
    const run = first.result.current.run
    const node = findEventNode(run, id => id === 'fonte')
    saveProfile({ ...loadProfile(), cioccorane: 50 })

    saveRun(withNodeAsEvent(withDirectEdgeTo(run, node.id), node.id))
    const second = renderHook(() => useRunB('seed-c'))
    act(() => second.result.current.chooseNode(node.id))
    act(() => second.result.current.chooseEventOption('offer'))

    expect(loadProfile().cioccorane).toBe(20)
  })

  it('is deterministic: same seed -> same event + same option outcome', () => {
    const probe = renderHook(() => useRunB('seed-det'))
    act(() => probe.result.current.completeDraft(twoPicks('seed-det')))
    const baseRun = probe.result.current.run
    const node = findEventNode(baseRun, () => true)

    function driveOnce() {
      clearRun(); localStorage.clear()
      const first = renderHook(() => useRunB('seed-det'))
      act(() => first.result.current.completeDraft(twoPicks('seed-det')))
      const run = first.result.current.run
      saveRun(withNodeAsEvent(withDirectEdgeTo(run, node.id), node.id))
      const second = renderHook(() => useRunB('seed-det'))
      act(() => second.result.current.chooseNode(node.id))
      const eventId = second.result.current.currentEvent!.id
      const firstChoice = second.result.current.currentEvent!.choices[0]!.id
      act(() => second.result.current.chooseEventOption(firstChoice))
      return { eventId, choice: firstChoice, team: second.result.current.run.team, cioccorane: loadProfile().cioccorane }
    }

    const r1 = driveOnce()
    const r2 = driveOnce()
    expect(r2.eventId).toBe(r1.eventId)
    expect(r2.choice).toBe(r1.choice)
    expect(r2.team).toEqual(r1.team)
    expect(r2.cioccorane).toBe(r1.cioccorane)
  })
})
