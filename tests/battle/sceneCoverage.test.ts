import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { sceneEventOf, type SceneKind } from '@/lib/battleScene'
import { eventRendersSomething } from '@/components/battle/SceneFx'
import type { ReplayFrame } from '@/game/engine/combat/replay'
import type { LogEntry, LogFlag } from '@/types'

/** Resolved relative to THIS test file, not to vitest's cwd — a cwd-relative
 *  path (`readFileSync('game/engine/combat/simulate.ts', ...)`) would throw
 *  ENOENT loudly if vitest is ever invoked from a different directory, so a
 *  wrong path here fails loudly, not silently. What DOES fail silently is a
 *  correct path whose regex stops matching — the source gets reformatted, a
 *  call site changes shape, the pattern quietly stops finding some or all of
 *  what it used to — and a narrowed match still returns a non-empty,
 *  plausible-looking list. That is what `EXPECTED_ENGINE_ACTIONS` below
 *  guards against: a fixed, reviewed expectation the scrape's output must
 *  still contain, so a regex that silently drifted narrower is caught even
 *  though it never threw and never returned empty. */
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

/** One `(action, flags)` pairing as it really occurs in a `pushLog`/`logs.push`
 *  call in the engine. `dynamic: true` means the flags for that call are not a
 *  bracket literal in source (a bare variable, e.g. Reliquia's `flags,`
 *  shorthand) — for those, `flags` is `null` and no synthetic literal can be
 *  scraped honestly, so the flags-aware test below leaves them to the
 *  action-only coverage test instead of guessing a value. */
interface ScrapedCall { action: string; flags: LogFlag[] | null; dynamic: boolean }

/** Finds every `pushLog(...)` / `logs.push(...)` call by balancing parens from
 *  the call's own opening `(`, then every brace-balanced `{...}` object
 *  literal inside it, then reads `action:` and `flags:` off THAT SAME object —
 *  so a call whose top level is a ternary between two object literals
 *  (MuroVivente vs Riflesso, simulate.ts:303-314) yields one pairing per
 *  branch instead of the two branches' fields getting cross-matched by a
 *  single flat regex over the whole call text. A ternary INSIDE `flags:`
 *  itself (KO's `reaped ? ['kill','duo'] : ['kill']`, simulate.ts:361-365) is
 *  not a single literal — both branches are still real source text, so both
 *  are captured as separate pairings for the same action rather than picked
 *  one arbitrarily or dropped as merely "dynamic". */
function engineActionFlagPairs(): ScrapedCall[] {
  const src = readFileSync(SIMULATE_TS_PATH, 'utf8')

  const callTexts: string[] = []
  const callRe = /(pushLog|logs\.push)\(/g
  let cm: RegExpExecArray | null
  while ((cm = callRe.exec(src))) {
    let i = cm.index + cm[0].length
    let depth = 1
    while (i < src.length && depth > 0) {
      if (src[i] === '(') depth++
      else if (src[i] === ')') depth--
      i++
    }
    callTexts.push(src.slice(cm.index, i))
  }

  const objectLiterals = (text: string): string[] => {
    const out: string[] = []
    const braceRe = /\{/g
    let bm: RegExpExecArray | null
    while ((bm = braceRe.exec(text))) {
      let j = bm.index
      let depth = 0
      while (j < text.length) {
        if (text[j] === '{') depth++
        else if (text[j] === '}') { depth--; if (depth === 0) break }
        j++
      }
      out.push(text.slice(bm.index, j + 1))
      braceRe.lastIndex = j + 1
    }
    return out
  }

  const parseFlags = (bracketLiteral: string): LogFlag[] => {
    const inner = bracketLiteral.trim().replace(/^\[/, '').replace(/\]$/, '')
    if (!inner.trim()) return []
    return [...inner.matchAll(/'([^']+)'/g)].map(m => m[1]! as LogFlag)
  }

  const results: ScrapedCall[] = []
  for (const callText of callTexts) {
    for (const obj of objectLiterals(callText)) {
      const actionM = obj.match(/action:\s*'([^']+)'/)
      if (!actionM) continue
      const action = actionM[1]!
      // `flags: <cond> ? [...] : [...]` — both ternary branches are literals.
      const ternaryM = obj.match(/flags:\s*[^,}]*?\?\s*(\[[^\]]*\])\s*:\s*(\[[^\]]*\])/)
      // `flags: [...]` — a plain bracket literal.
      const literalM = obj.match(/flags:\s*(\[[^\]]*\])/)
      if (ternaryM) {
        results.push({ action, flags: parseFlags(ternaryM[1]!), dynamic: true })
        results.push({ action, flags: parseFlags(ternaryM[2]!), dynamic: true })
      } else if (literalM) {
        results.push({ action, flags: parseFlags(literalM[1]!), dynamic: false })
      } else {
        // `flags:` present as a bare identifier/expression (e.g. Reliquia's
        // `flags,` shorthand) — genuinely not a static literal.
        results.push({ action, flags: null, dynamic: true })
      }
    }
  }
  return results
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

/** The kind each system action MUST resolve to — independent of
 *  lib/battleScene.ts's own BY_ACTION table, so this doesn't just re-assert
 *  whatever the production mapping currently says (that would make the test
 *  pass even if BY_ACTION itself were wrong, or if a flag-precedence bug
 *  routed the event through BY_FLAG instead of BY_ACTION entirely — "renders
 *  SOMETHING" was already true for that case, which is exactly how the old,
 *  weaker version of this test missed Fatica resolving to a bare 'dot' tick
 *  with no SFINIMENTO word). Checked only for actions with a real, reviewed
 *  expectation; actions not listed here still get the "renders something"
 *  check above but not a kind assertion. */
const EXPECTED_KIND: Partial<Record<string, SceneKind>> = {
  Stordito: 'skip',
  Fatica: 'fatigue',
  Purificazione: 'purify',
  Rigenera: 'regen',
  Miasma: 'duo-miasma',
  MuroVivente: 'duo-muro',
  Riflesso: 'duo-muro',
  Untore: 'duo-untore',
  KO: 'kill',
  // Rigenerazione is NOT here: it's emitted by game/engine/status.ts (the
  // per-turn `regen` status tick), not by simulate.ts, so engineActionFlagPairs
  // (which only scrapes simulate.ts) never finds it — asserted directly below
  // instead of through the scrape this table is checked against.
}

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

  it('ogni azione di sistema del motore produce una scena che RENDE davvero qualcosa, CON I FLAG CHE PORTA DAVVERO', () => {
    // Drives sceneEventOf with the REAL flags the engine attaches to each
    // action (scraped from simulate.ts, not hand-written `flags: []`) —
    // catching a mapping bug where a known action loses to a generic flag
    // match (BY_FLAG resolving before BY_ACTION let Fatica's own ['dot'] flag
    // swallow it into a plain dot tick, dropping SFINIMENTO entirely; a
    // synthetic `flags: []` frame can never see that, because the engine
    // never emits Fatica/Rigenera with no flags at all).
    const pairs = engineActionFlagPairs().filter(p => p.flags !== null) as Array<{ action: string; flags: LogFlag[] }>
    // Self-check on the flags scrape itself, mirroring the action-scrape guard
    // above: known (action, flags) pairings that must still be found today.
    const mustContain: Array<{ action: string; flags: LogFlag[] }> = [
      { action: 'Fatica', flags: ['dot'] },
      { action: 'Rigenera', flags: ['heal'] },
      { action: 'Stordito', flags: ['stun'] },
      { action: 'KO', flags: ['kill'] },
      { action: 'KO', flags: ['kill', 'duo'] },
    ]
    for (const want of mustContain) {
      const hit = pairs.some(p => p.action === want.action && JSON.stringify(p.flags) === JSON.stringify(want.flags))
      expect(hit, `coppia azione/flag attesa ma non trovata dallo scrape: ${want.action} ${JSON.stringify(want.flags)}`).toBe(true)
    }

    const missing = pairs
      .filter(p => !EXEMPT_ACTIONS.has(p.action))
      .filter(p => {
        const e = sceneEventOf(frame(withValue({
          turn: 1, actorId: 'a', actorSide: 'left', action: p.action, type: 'system', flags: p.flags,
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
      .map(p => `${p.action} ${JSON.stringify(p.flags)}`)
    expect(missing, `azioni senza scena visibile: ${missing.join(', ')}`).toEqual([])
  })

  it('ogni azione con un kind atteso lo raggiunge DAVVERO, con i flag reali del motore (non un kind qualsiasi)', () => {
    // "Renders something" (the test above) is not enough on its own: `dot` and
    // `fatigue` both render a visible number, so a Fatica entry mis-routed
    // through BY_FLAG's generic `dot` match instead of BY_ACTION's dedicated
    // `fatigue` scene would still pass a mere non-emptiness check — which is
    // exactly how the ORIGINAL version of this coverage test (built on a
    // synthetic `flags: []` frame the engine never actually emits for Fatica)
    // failed to catch the real bug: it never drove the case where the flag
    // and the action disagree. Asserting the exact expected `kind`, fed with
    // the real scraped flags, is what closes that gap.
    const pairs = engineActionFlagPairs().filter(p => p.flags !== null) as Array<{ action: string; flags: LogFlag[] }>
    for (const [action, expectedKind] of Object.entries(EXPECTED_KIND)) {
      const variants = pairs.filter(p => p.action === action)
      expect(variants.length, `nessuna occorrenza scrapata per ${action}`).toBeGreaterThan(0)
      for (const p of variants) {
        const e = sceneEventOf(frame(withValue({
          turn: 1, actorId: 'a', actorSide: 'left', action: p.action, type: 'system', flags: p.flags,
        } as LogEntry)))
        expect(e.kind, `${action} con flag ${JSON.stringify(p.flags)} doveva risolvere a '${expectedKind}', ha risolto a '${e.kind}'`).toBe(expectedKind)
      }
    }
  })

  it("Rigenerazione (game/engine/status.ts, il tick di regen — non scrapata da simulate.ts) risolve a 'regen'", () => {
    // status.ts:184 logs the per-turn `regen` status tick as
    // `action: def?.name ?? 'Rigenerazione'`; `regen` is the only status with
    // `tickHeal` (data/statuses.ts), so this action name is always reachable
    // in practice, always carrying `flags: ['heal']`. It lives outside
    // simulate.ts so engineActionFlagPairs() never scrapes it — asserted here
    // directly instead, same real flags as the engine emits.
    const e = sceneEventOf(frame(withValue({
      turn: 1, actorId: 'a', actorSide: 'left', action: 'Rigenerazione', type: 'Cura', flags: ['heal'],
    } as LogEntry)))
    expect(e.kind).toBe('regen')
  })

  it('ogni azione di sistema del motore produce una scena che RENDE anche a flag vuoti (caso degenere)', () => {
    // Keeps the original action-only, flags-less check alive alongside the
    // flags-aware one above: an action whose real flags always trigger a
    // scene could still, in principle, map to nothing when no flag applies —
    // this is the same shape the old (weaker) test asserted, kept so an
    // action that regresses on the DEGENERATE `flags: []` case (not just its
    // real one) is still caught.
    const missing = engineActions().filter(action => {
      if (EXEMPT_ACTIONS.has(action)) return false
      const e = sceneEventOf(frame(withValue({
        turn: 1, actorId: 'a', actorSide: 'left', action, type: 'system', flags: [],
      } as LogEntry)))
      return !eventRendersSomething(e)
    })
    expect(missing, `azioni senza scena visibile (flag vuoti): ${missing.join(', ')}`).toEqual([])
  })

  it('ogni flag di log produce una scena che RENDE davvero qualcosa', () => {
    // Derived from the LogFlag union (types/combat.ts) instead of hand-copied,
    // so a flag the engine gains (or that this list simply forgot — `wait`
    // and `duo` were both missing from the old hand-written array even though
    // the engine really emits them, e.g. Ricarica's ['wait'], Miasma's
    // ['duo']) can't silently drift out of coverage.
    const FLAGS: LogFlag[] = ['crit', 'dodge', 'kill', 'heal', 'block', 'stun', 'dot', 'pen', 'shatter', 'wait', 'recoil', 'revive', 'duo']
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
