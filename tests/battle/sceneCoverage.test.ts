import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { sceneEventOf } from '@/lib/battleScene'
import { eventRendersSomething } from '@/components/battle/SceneFx'
import type { ReplayFrame } from '@/game/engine/combat/replay'
import type { LogEntry } from '@/types'

/** Resolved relative to THIS test file, not to vitest's cwd — a cwd-relative
 *  path (`readFileSync('game/engine/combat/simulate.ts', ...)`) would silently
 *  read nothing if vitest is ever invoked from a different directory, and an
 *  empty scrape makes every assertion below pass vacuously. */
const __dirname = dirname(fileURLToPath(import.meta.url))
const SIMULATE_TS_PATH = resolve(__dirname, '../../game/engine/combat/simulate.ts')

/** The engine actions this scrape is known to find today, kept here so the
 *  scrape can be asserted against a real expectation instead of "some
 *  non-empty list" (a truncated regex match, a moved file, or a wrong path
 *  could all return a short-but-non-empty list and still slip through a
 *  weaker check). If the engine legitimately grows a new system action,
 *  update this list AND give the action a scene in lib/battleScene.ts. */
const EXPECTED_ENGINE_ACTIONS = [
  'Stordito', 'Rigenera', 'Miasma', 'MuroVivente', 'Riflesso', 'Untore',
  'Purificazione', 'Fatica', 'Ricarica', 'Reliquia', 'KO',
]

/** Le azioni di sistema che il motore emette davvero, lette dal sorgente:
 *  se qualcuno ne aggiunge una senza darle una scena, questo test diventa rosso. */
function engineActions(): string[] {
  const src = readFileSync(SIMULATE_TS_PATH, 'utf8')
  return [...new Set([...src.matchAll(/action: '([^']+)'/g)].map(m => m[1]!))]
}

const frame = (entry: LogEntry): ReplayFrame =>
  ({ index: 1, entry, hp: {}, cooldowns: {}, statusEffects: {} } as ReplayFrame)

/** Log entries built here carry `value: 10` because that is how the engine
 *  actually emits them: every `dot`-flagged entry (tickStatuses' DoT ticks,
 *  Fatica) and `Rigenera` (`type: 'Cura', flags: ['heal']`) always ship with
 *  a numeric `value` in game/engine/combat/simulate.ts — never a bare
 *  log entry. A synthetic frame with no `value` would make `numberFor`
 *  return undefined and `dot`/`regen`/`heal` specs would then have nothing
 *  to show, failing for a reason that can never happen on a real replay.
 *  Testing with a realistic shape is what keeps this a guard against real
 *  gaps instead of an artifact of how the test builds its fixtures. */
const withValue = (entry: LogEntry): LogEntry => ({ ...entry, value: 10 } as LogEntry)

/** The three deliberate exceptions — never a silent pass, always this
 *  reviewable list, keyed by the ACTION/FLAG itself (not by the resulting
 *  SceneKind — keying by kind would let a genuinely-broken action slip
 *  through the guard undetected if it happened to be mapped, by accident,
 *  to 'cooldown' or 'relic' instead of getting its own visual):
 *  - `Ricarica` (engine action) → `cooldown`: a spell recharging is
 *    bookkeeping, not a visible beat. Flashing something for every cooldown
 *    tick would bury the events that matter.
 *  - `Reliquia` (engine action) → `relic`: a passive relic proc is likewise
 *    bookkeeping — it fires constantly in the background and isn't the kind
 *    of "something happened" moment the user asked to see.
 *  - (no log entry at all) → `none`: nothing happened, so there is nothing
 *    to render. Not reachable through `engineActions()` or the flag list
 *    below — listed here only so the invariant test above documents it too.
 *  Any OTHER engine action or log flag — including one that happens to
 *  produce kind 'cooldown'/'relic' by mistake — MUST render. */
const EXEMPT_ACTIONS: ReadonlySet<string> = new Set(['Ricarica', 'Reliquia'])

describe('copertura: niente resta invisibile', () => {
  it('lo scrape del sorgente trova davvero le azioni del motore (non è vuoto per un path sbagliato)', () => {
    const found = engineActions()
    // Fails loudly rather than passing vacuously if the path ever resolves
    // wrong, the file moves, or the regex stops matching.
    expect(found.length).toBeGreaterThanOrEqual(EXPECTED_ENGINE_ACTIONS.length)
    for (const action of EXPECTED_ENGINE_ACTIONS) {
      expect(found, `azione motore attesa ma non trovata dallo scrape: ${action}`).toContain(action)
    }
  })

  it('ogni azione di sistema del motore produce una scena che RENDE davvero qualcosa', () => {
    const missing = engineActions().filter(action => {
      if (EXEMPT_ACTIONS.has(action)) return false
      const e = sceneEventOf(frame(withValue({
        turn: 1, actorId: 'a', actorSide: 'left', action, type: 'system', flags: [],
      } as LogEntry)))
      // The brief's original check (`kind !== 'none'`) is too weak: `cooldown`
      // and `relic` are valid non-'none' kinds that SceneFx deliberately draws
      // nothing for (see components/battle/SceneFx.tsx `nothingToShow`/
      // `eventRendersSomething`). Driving the assertion through the real
      // `specFor`/render logic (via `eventRendersSomething`, exported from
      // SceneFx.tsx rather than reimplemented here) is what catches an action
      // that maps to 'cooldown'/'relic'/'none' by mistake, or to a kind
      // SceneFx hasn't been given a visual for yet. The exemption above is
      // keyed by ACTION NAME, not by the resulting kind, so an action wired
      // (accidentally or otherwise) to 'cooldown'/'relic' without being
      // Ricarica/Reliquia still fails here instead of being waved through.
      return !eventRendersSomething(e)
    })
    expect(missing, `azioni senza scena visibile: ${missing.join(', ')}`).toEqual([])
  })

  it('ogni flag di log produce una scena che RENDE davvero qualcosa', () => {
    const FLAGS = ['crit', 'dodge', 'kill', 'heal', 'block', 'stun', 'dot', 'pen', 'shatter', 'recoil', 'revive']
    const missing = FLAGS.filter(f => {
      const e = sceneEventOf(frame(withValue({
        turn: 1, actorId: 'a', actorSide: 'left', action: 'Colpo', type: 'Attacco', flags: [f],
      } as unknown as LogEntry)))
      // No flag is exempt — cooldown/relic are action-only bookkeeping kinds
      // that no flag maps to today; if one ever did, it should render or be
      // added to an EXEMPT_FLAGS list with the same reviewable justification
      // as EXEMPT_ACTIONS above, never silently filtered by kind.
      return !eventRendersSomething(e)
    })
    expect(missing, `flag senza scena visibile: ${missing.join(', ')}`).toEqual([])
  })

  it('cooldown, relic e none sono le uniche eccezioni deliberate — e restano davvero invisibili', () => {
    // Guards the exception list itself: if `eventRendersSomething` ever starts
    // returning true for one of these (e.g. someone adds a decor layer to
    // 'cooldown'), this documents that the exception is now stale rather than
    // letting it go unnoticed.
    const cooldown = sceneEventOf(frame({
      turn: 1, actorId: 'a', actorSide: 'left', action: 'Ricarica', type: 'system', flags: [],
    } as LogEntry))
    const relic = sceneEventOf(frame({
      turn: 1, actorId: 'a', actorSide: 'left', action: 'Reliquia', type: 'system', flags: [],
    } as LogEntry))
    const none = sceneEventOf(frame(null as unknown as LogEntry))

    expect(cooldown.kind).toBe('cooldown')
    expect(relic.kind).toBe('relic')
    expect(none.kind).toBe('none')
    expect(eventRendersSomething(cooldown)).toBe(false)
    expect(eventRendersSomething(relic)).toBe(false)
    expect(eventRendersSomething(none)).toBe(false)
  })
})
