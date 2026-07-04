# Event Nodes (`?`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add choice-and-consequence **event nodes** (`?`) that make runs varied and replayable, delivering run-altering choices (swap a spell, trade a wizard for one +2 levels, painful sacrifices, gambles) and a seed of rule-bending relics.

**Architecture:** Data-driven events (`data/events.ts`) applied by a **pure** effect engine (`game/engine/events.ts`, RunState→RunState) through a new `eventResolver` following the existing node→resolver→phase→screen pattern. The `event` node type already exists in `NODE_CATALOG` (declared, unimplemented); this plan wires it up: resolver, placement in `nodeGen`, `event-node` phase, controller method, and `EventScreen`. Cioccorane (meta currency, lives on the profile not RunState) is handled at the **controller** layer to keep the engine pure/deterministic.

**Tech Stack:** TypeScript, Next.js, Vitest, React. Pure deterministic engine under `game/engine/`; UI under `components/screens/`.

## Global Constraints

- **Pure/deterministic engine:** no `Date.now()`/`Math.random()`. Event pick + gambles fork the run RNG deterministically (same seed → same run).
- **Run tests with** `npx vitest run <path> --disableConsoleIntercept` (flag REQUIRED or console lines are swallowed). Windows: use the Bash tool with forward-slash paths.
- **Cioccorane lives on the profile** (`lib/metaStore.ts`: `grantCioccorane(p,n)`, `spendCioccorane(p,n): MetaProfile|null`), NOT on RunState. The pure effect engine handles ONLY run resources; Cioccorane grant/cost + Cioccorane-gating are applied in the controller (`useRunB`).
- **Do not break existing node guarantees:** `nodeGen` still guarantees one infirmary (pre-boss floor), one elite, ≥1 relic, ≤1 recruit/area. Events are an additional filler category and must not displace those.
- **Commit per task to master** (project convention). Do NOT push.
- **The `event` node type, `NODE_CATALOG.event`, emoji `📖`, and `resolverId: 'event'` already exist** — do not re-add them.

---

### Task 1: Event data types + starter pool

**Files:**
- Create: `data/events.ts`
- Test: `tests/data/events.test.ts`

**Interfaces:**
- Consumes: `Role` from `@/types`.
- Produces:
  - `EventEffect` union: `{ kind:'healTeam'; pct:number } | { kind:'damageTeam'; pct:number } | { kind:'levelWizard'; which:'weakest'|'strongest'|'random'; levels:number } | { kind:'swapSpell'; which:'weakest'|'strongest'|'random' } | { kind:'addWizard'; levelsAboveWeakest:number } | { kind:'removeWizard'; which:'weakest'|'random' } | { kind:'grantRelic'; pool:'ruleBreaking' } | { kind:'cioccorane'; amount:number } | { kind:'gamble'; chance:number; win:EventEffect[]; lose:EventEffect[] }`
  - `EventRequirement = { minCioccorane:number } | { role:Role; count:number } | { minTeam:number }`
  - `EventChoice = { id:string; label:string; requires?:EventRequirement; effects:EventEffect[]; resultText:string }`
  - `GameEvent = { id:string; title:string; text:string; choices:EventChoice[] }`
  - `export const EVENTS: GameEvent[]` (the 6 starter events)
  - `export const EVENT_BY_ID: Record<string, GameEvent>`

- [ ] **Step 1: Write the failing test**

`tests/data/events.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { EVENTS, EVENT_BY_ID } from '@/data/events'

describe('event pool', () => {
  it('has a well-formed starter pool', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(6)
    for (const e of EVENTS) {
      expect(e.id).toBeTruthy()
      expect(e.title).toBeTruthy()
      expect(e.text).toBeTruthy()
      expect(e.choices.length).toBeGreaterThanOrEqual(1)
      for (const c of e.choices) {
        expect(c.id).toBeTruthy()
        expect(c.label).toBeTruthy()
        expect(Array.isArray(c.effects)).toBe(true)
      }
    }
  })
  it('has unique event ids and unique choice ids within an event', () => {
    expect(new Set(EVENTS.map(e => e.id)).size).toBe(EVENTS.length)
    for (const e of EVENTS) {
      expect(new Set(e.choices.map(c => c.id)).size).toBe(e.choices.length)
    }
  })
  it('EVENT_BY_ID indexes every event', () => {
    for (const e of EVENTS) expect(EVENT_BY_ID[e.id]).toBe(e)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/data/events.test.ts --disableConsoleIntercept`
Expected: FAIL — `Cannot find module '@/data/events'`.

- [ ] **Step 3: Create `data/events.ts`**

```ts
import type { Role } from '@/types'

export type EventEffect =
  | { kind: 'healTeam'; pct: number }
  | { kind: 'damageTeam'; pct: number }
  | { kind: 'levelWizard'; which: 'weakest' | 'strongest' | 'random'; levels: number }
  | { kind: 'swapSpell'; which: 'weakest' | 'strongest' | 'random' }
  | { kind: 'addWizard'; levelsAboveWeakest: number }
  | { kind: 'removeWizard'; which: 'weakest' | 'random' }
  | { kind: 'grantRelic'; pool: 'ruleBreaking' }
  | { kind: 'cioccorane'; amount: number }
  | { kind: 'gamble'; chance: number; win: EventEffect[]; lose: EventEffect[] }

export type EventRequirement =
  | { minCioccorane: number }
  | { role: Role; count: number }
  | { minTeam: number }

export interface EventChoice {
  id: string
  label: string
  requires?: EventRequirement
  effects: EventEffect[]
  resultText: string
}

export interface GameEvent {
  id: string
  title: string
  text: string
  choices: EventChoice[]
}

export const EVENTS: GameEvent[] = [
  {
    id: 'cappello_parlante',
    title: 'Il Cappello Parlante',
    text: 'Il vecchio Cappello si desta e ti offre la sua saggezza — a modo suo.',
    choices: [
      { id: 'level', label: 'Fatti consigliare (mago più debole +2 livelli)', effects: [{ kind: 'levelWizard', which: 'weakest', levels: 2 }], resultText: 'Il Cappello sussurra segreti: il tuo mago più debole cresce.' },
      { id: 'reroll', label: 'Cambia idea (rimescola la magia del più debole)', effects: [{ kind: 'swapSpell', which: 'weakest' }], resultText: 'Una nuova vocazione: la sua magia cambia.' },
      { id: 'leave', label: 'Ringrazia e vai (cura squadra 15%)', effects: [{ kind: 'healTeam', pct: 0.15 }], resultText: 'Il Cappello ti augura buona fortuna.' },
    ],
  },
  {
    id: 'scambista',
    title: 'Lo Scambista',
    text: 'Un mago incappucciato propone uno scambio: il tuo più debole, per uno più forte.',
    choices: [
      { id: 'trade', label: 'Accetta (scambia il più debole per uno nuovo +2 livelli)', requires: { minTeam: 2 }, effects: [{ kind: 'removeWizard', which: 'weakest' }, { kind: 'addWizard', levelsAboveWeakest: 2 }], resultText: 'Lo scambio è fatto.' },
      { id: 'refuse', label: 'Rifiuta', effects: [], resultText: 'Lo scambista svanisce nell’ombra.' },
    ],
  },
  {
    id: 'coppa_maledetta',
    title: 'La Coppa Maledetta',
    text: 'Una coppa pulsa di magia oscura. Berne potrebbe darti un potere proibito… o costarti caro.',
    choices: [
      { id: 'drink', label: 'Bevi (60%: reliquia rompi-regole · 40%: -25% vita a tutti)', effects: [{ kind: 'gamble', chance: 0.6, win: [{ kind: 'grantRelic', pool: 'ruleBreaking' }], lose: [{ kind: 'damageTeam', pct: 0.25 }] }], resultText: 'Il liquido brucia in gola…' },
      { id: 'leave', label: 'Lasciala stare', effects: [], resultText: 'Meglio non tentare la sorte.' },
    ],
  },
  {
    id: 'patto',
    title: 'Il Patto',
    text: 'Una voce senza volto offre potere in cambio di un sacrificio.',
    choices: [
      { id: 'sacrifice', label: 'Sacrifica il mago più debole (reliquia rompi-regole + 20 🍫)', requires: { minTeam: 2 }, effects: [{ kind: 'removeWizard', which: 'weakest' }, { kind: 'grantRelic', pool: 'ruleBreaking' }, { kind: 'cioccorane', amount: 20 }], resultText: 'Il patto è suggellato.' },
      { id: 'refuse', label: 'Rifiuta il patto', effects: [], resultText: 'La voce tace, delusa.' },
    ],
  },
  {
    id: 'fonte',
    title: 'La Fonte Incantata',
    text: 'Una fonte scintillante chiede un’offerta in Cioccorane per benedire la squadra.',
    choices: [
      { id: 'offer', label: 'Offri 30 🍫 (cura completa della squadra)', requires: { minCioccorane: 30 }, effects: [{ kind: 'cioccorane', amount: -30 }, { kind: 'healTeam', pct: 1 }], resultText: 'Le acque ti rinvigoriscono.' },
      { id: 'leave', label: 'Prosegui', effects: [], resultText: 'Lasci la fonte alle spalle.' },
    ],
  },
  {
    id: 'ombra',
    title: 'L’Ombra Danzante',
    text: 'Un’ombra ti sfida a un gioco d’azzardo puro. Testa o croce del destino.',
    choices: [
      { id: 'risk', label: 'Rischia (50%: reliquia rompi-regole · 50%: un mago perde la sua magia)', effects: [{ kind: 'gamble', chance: 0.5, win: [{ kind: 'grantRelic', pool: 'ruleBreaking' }], lose: [{ kind: 'swapSpell', which: 'random' }] }], resultText: 'L’ombra ride mentre la moneta cade…' },
      { id: 'walk', label: 'Allontanati', effects: [], resultText: 'Non tutti i giochi vanno giocati.' },
    ],
  },
]

export const EVENT_BY_ID: Record<string, GameEvent> = Object.fromEntries(EVENTS.map(e => [e.id, e]))
```

- [ ] **Step 4: Run test to verify it passes** — `npx vitest run tests/data/events.test.ts --disableConsoleIntercept` → PASS (3 tests).

- [ ] **Step 5: Commit** — `git add data/events.ts tests/data/events.test.ts && git commit -m "feat(events): event data types + 6-event starter pool"`

---

### Task 2: The rule-breaking relic pool

**Files:**
- Modify: `data/relics.ts`
- Test: `tests/data/ruleBreakingRelics.test.ts`

**Interfaces:**
- Consumes: existing `Relic` type + relic infra (`triggers` onHit/onBattleStart, `grantsDarkMagic`).
- Produces: 3 new relics + `export const RULE_BREAKING_RELIC_IDS: string[]` (the pool events grant from).

**Note on mechanics:** reuse ONLY existing, proven hooks so no combat rewrite is needed. Read `data/relics.ts` (`boccino-doro` = onHit applyStatus veleno; `pietra-resurrezione` = onBattleStart shield; `marchio-nero` = `grantsDarkMagic` recoil) and `data/statuses.ts` (veleno is now PERMANENT) before writing. If a relic you draft needs a hook that does not exist, pick a different effect that uses onHit/onBattleStart/grantsDarkMagic — do NOT add engine hooks in this task.

- [ ] **Step 1: Write the failing test**

`tests/data/ruleBreakingRelics.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { RELIC_BY_ID, RULE_BREAKING_RELIC_IDS } from '@/data/relics'

describe('rule-breaking relic pool', () => {
  it('every id in the pool resolves to a real relic', () => {
    expect(RULE_BREAKING_RELIC_IDS.length).toBeGreaterThanOrEqual(3)
    for (const id of RULE_BREAKING_RELIC_IDS) expect(RELIC_BY_ID[id]).toBeDefined()
  })
  it('the pool relics use only existing hook shapes (no unknown mechanic fields)', () => {
    for (const id of RULE_BREAKING_RELIC_IDS) {
      const r = RELIC_BY_ID[id]!
      const usesKnown = !!(r.triggers || r.grantsDarkMagic || r.bonus || r.keywordMult)
      expect(usesKnown).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run** — `npx vitest run tests/data/ruleBreakingRelics.test.ts --disableConsoleIntercept` → FAIL (`RULE_BREAKING_RELIC_IDS` undefined).

- [ ] **Step 3: Add 3 relics + the pool to `data/relics.ts`** (append to the `RELICS` array, before the closing `]`; then add the export). Use these exact entries:
```ts
  // Rule-breaking pool (event rewards) — reuse existing hooks only.
  { id: 'zanna-vorace', name: 'Zanna Vorace', desc: 'Ogni colpo della squadra avvelena il nemico con 2 dosi invece di 1.', rarity: 'epica', keywords: ['veleno'], triggers: [{ hook: 'onHit', effects: [{ kind: 'applyStatus', target: 'enemy', statusId: 'veleno' }, { kind: 'applyStatus', target: 'enemy', statusId: 'veleno' }] }] },
  { id: 'furia-iniziale', name: 'Furia Iniziale', desc: 'A inizio battaglia, tutta la squadra guadagna +18 Attacco.', rarity: 'epica', triggers: [{ hook: 'onBattleStart', effects: [{ kind: 'buff', stat: 'atk', amount: 18 }] }] },
  { id: 'patto-di-sangue', name: 'Patto di Sangue', desc: 'Assegna a un mago: i suoi colpi infliggono +60% danni, ma subisce un contraccolpo pari al 25% del danno inflitto.', rarity: 'epica', assignable: true, grantsDarkMagic: { bonus: 0.6, recoil: 0.25 } },
```
Then after the `RELIC_BY_ID` export add:
```ts
export const RULE_BREAKING_RELIC_IDS: string[] = ['zanna-vorace', 'furia-iniziale', 'patto-di-sangue']
```
**Verify the effect shapes** against the existing relics: `applyStatus`/`buff` effect kinds and `onHit`/`onBattleStart` hooks must already be handled by the relic trigger system (grep `game/engine/relics.ts` + the eventBus for the hook names). If `onBattleStart` + a `buff` effect isn't already supported by a relic trigger, switch `furia-iniziale` to a plain `bonus: { atk: 18 }` passive instead (still a strong relic) — do not add engine support here.

- [ ] **Step 4: Run** — `npx vitest run tests/data/ruleBreakingRelics.test.ts tests/engine/relicAssign.test.ts --disableConsoleIntercept` → PASS (no regression in relic handling).

- [ ] **Step 5: Commit** — `git add data/relics.ts tests/data/ruleBreakingRelics.test.ts && git commit -m "feat(events): rule-breaking relic pool (event rewards)"`

---

### Task 3: Pure effect engine `applyEventEffects`

**Files:**
- Create: `game/engine/events.ts`
- Test: `tests/engine/eventEffects.test.ts`

**Interfaces:**
- Consumes: `RunState`, `DraftedWizard` (`@/types`); `Rng` (`../rng`); `gainLevels` (`./leveling`); `setWizardSpell` (`./runEngine`); `recruitVia`, `replaceMember` (`./recruit`); `createDraftPool` (`./draft`); `draftWizard` (`./statRoll`); `RELIC_BY_ID`, `RULE_BREAKING_RELIC_IDS` (`@/data/relics`); `SPELL_BY_ID` (`@/data/spells`); `powerOf` (`./combat/teamGen`).
- Produces: `applyEventEffects(state: RunState, effects: EventEffect[], rng: Rng): { state: RunState; cioccoraneDelta: number; log: string[] }`. Pure. `cioccorane` effects do NOT touch state (they accumulate into `cioccoraneDelta`, applied by the controller). Deterministic given rng.

**Selection helpers (define in this file):** `weakest`/`strongest` = by `powerOf(dw)`; `random` = `rng.pick`. Damage/heal act on `currentHp` (`dw.currentHp ?? dw.maxHp`), clamped `[1, maxHp]` for heal and `[1, …]` (min 1, never kills) for damage. `swapSpell` picks a different spell id from `dw.wizard.spellPool` via rng and calls `setWizardSpell`. `addWizard` drafts a random wizard from `createDraftPool()` (exclude current team ids) and applies `gainLevels(dw, removedWeakestLevel + levelsAboveWeakest)` — capture the weakest level BEFORE any removeWizard in the same effect list (thread it, or compute from the pre-effect team). `grantRelic` appends `{ relic: RELIC_BY_ID[pick], stageObtained: state.stage }` where `pick = rng.pick(RULE_BREAKING_RELIC_IDS)` (avoid duplicates the team already owns if possible). `gamble` forks rng and recurses into `win`/`lose`.

- [ ] **Step 1: Write the failing test**

`tests/engine/eventEffects.test.ts` — read `tests/hooks/useRunB.test.ts`'s `twoPicks`/team-building helpers and `tests/engine/campaignBalanceRestricted.test.ts` to build a realistic `RunState` with a team. Then:
```ts
import { describe, it, expect } from 'vitest'
import { applyEventEffects } from '@/game/engine/events'
import { createRng } from '@/game/engine/rng'
// build a RunState `s` with a >=2-wizard team via the existing helpers (startRunB + chooseStarters)

describe('applyEventEffects', () => {
  it('healTeam raises currentHp toward maxHp, never above', () => {
    // damage the team first, then heal 100% -> currentHp === maxHp for all
  })
  it('damageTeam lowers currentHp but never below 1 (no kills)', () => {
    // damageTeam 100% -> every wizard currentHp === 1, none dead
  })
  it('levelWizard raises the chosen wizard level by N', () => {
    // weakest wizard level increases by 2
  })
  it('swapSpell changes the chosen wizard active spell to another in its pool', () => {
    // spell id differs and is in the wizard.spellPool
  })
  it('removeWizard + addWizard(+2) trades weakest for a new one 2 levels above the removed', () => {})
  it('grantRelic appends a rule-breaking relic', () => {})
  it('cioccorane accumulates into cioccoraneDelta, not state', () => {
    const r = applyEventEffects(s, [{ kind: 'cioccorane', amount: 20 }], createRng('x'))
    expect(r.cioccoraneDelta).toBe(20)
  })
  it('gamble is deterministic per seed (same seed -> same branch)', () => {})
})
```
Fill each test body with concrete assertions using the real state/helpers (mirror the existing engine tests' style). Every test must assert a real state change.

- [ ] **Step 2: Run** — FAIL (`applyEventEffects` not defined).

- [ ] **Step 3: Implement `game/engine/events.ts`.** Pure reducer over the effect list; each effect kind maps to a small pure transform of `RunState` (or accumulates `cioccoraneDelta`). Reuse the imported helpers — do NOT reimplement leveling/spell-swap/recruit. Guard empty-team cases (no-op). Return `{ state, cioccoraneDelta, log }`.

- [ ] **Step 4: Run** — PASS (all effect tests).

- [ ] **Step 5: Commit** — `git add game/engine/events.ts tests/engine/eventEffects.test.ts && git commit -m "feat(events): pure applyEventEffects effect engine"`

---

### Task 4: Event resolver + pick + ResolverChoice

**Files:**
- Create: `game/engine/resolvers/event.ts`
- Modify: `game/engine/resolvers/types.ts` (add `event-choice` to `ResolverChoice`; extend `ResolverEntry`), `game/engine/runEngine.ts` (register resolver, `phaseForNode`), `types/run.ts` (`RunState['phase']` += `'event-node'`)
- Test: `tests/engine/eventResolver.test.ts`

**Interfaces:**
- Consumes: `EVENTS`, `EVENT_BY_ID`, `GameEvent` (`@/data/events`); `applyEventEffects` (Task 3); `NodeResolver`, `ResolverChoice`, `ResolverEntry` (`./types`); `parseAreaNodeId` (`../map`).
- Produces:
  - `ResolverChoice` gains `| { kind: 'event-choice'; optionId: string }`.
  - `ResolverEntry` gains optional `event?: { id: string; title: string; text: string; choices: { id: string; label: string }[] }`.
  - `pickEvent(rng: Rng): GameEvent` (seeded, deterministic).
  - `eventResolver: NodeResolver` (`id: 'event'`). `enter` → `{ offers: {}, isCombat: false, event: <picked event summary> }`. `resolve` on `event-choice` → applies the chosen choice's `effects` via `applyEventEffects` (drops `cioccoraneDelta` here — the controller re-derives and applies it; see Task 6), logs a `RunEvent`, returns state. On unknown option → returns state unchanged.
  - `RunState['phase']` includes `'event-node'`; `phaseForNode('event')` returns `'event-node'`.

- [ ] **Step 1: Write the failing test**

`tests/engine/eventResolver.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { eventResolver, pickEvent } from '@/game/engine/resolvers/event'
import { createRng } from '@/game/engine/rng'
import { EVENT_BY_ID } from '@/data/events'
// build a RunState `s` with a team + a current 'event' node (splice one in, or set phase)

describe('event resolver', () => {
  it('pickEvent is deterministic per seed', () => {
    expect(pickEvent(createRng('a')).id).toBe(pickEvent(createRng('a')).id)
  })
  it('enter offers the picked event summary (title/text/choices)', () => {
    const entry = eventResolver.enter(s, node, createRng('seed'))
    expect(entry.isCombat).toBe(false)
    expect(entry.event?.choices.length).toBeGreaterThanOrEqual(1)
  })
  it('resolve applies the chosen option effects (e.g. a heal choice raises currentHp)', () => {
    // pick an event/choice with a deterministic run-resource effect and assert the state changed
  })
  it('resolve with an unknown optionId returns state unchanged', () => {
    expect(eventResolver.resolve(s, node, { kind: 'event-choice', optionId: 'nope' }, createRng('s'))).toEqual(s)
  })
})
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement.**
  - `types.ts`: add `| { kind: 'event-choice'; optionId: string }` to `ResolverChoice`; add `event?: {...}` to `ResolverEntry`.
  - `types/run.ts`: add `'event-node'` to the `phase` union.
  - `resolvers/event.ts`: `pickEvent` forks/indexes `EVENTS` by an rng int; `eventResolver.enter` returns the event summary; `resolve` looks up the current event (re-pick with the SAME seed derivation used by enter so it's stable — fork rng off the node id like `recruitOffer` does), finds the choice by `optionId`, applies `applyEventEffects`, logs a `RunEvent { kind: 'event' | 'infirmary'... }` (add `'event'` to the RunEvent kind union in `types/run.ts` if needed), returns state.
  - `runEngine.ts`: `registerResolver(eventResolver)` in `registerCoreResolvers`; `phaseForNode`: `t === 'event' ? 'event-node' : …`.

- [ ] **Step 4: Run** — PASS. Also `npx vitest run tests/engine/resolverRegistry.test.ts tests/engine/nodeResolvers.test.ts --disableConsoleIntercept` → PASS.

- [ ] **Step 5: Commit** — `git add game/engine/resolvers/event.ts game/engine/resolvers/types.ts game/engine/runEngine.ts types/run.ts tests/engine/eventResolver.test.ts && git commit -m "feat(events): event resolver + pick + event-node phase"`

---

### Task 5: Place event nodes in `nodeGen` + skip battle package

**Files:**
- Modify: `game/engine/nodeGen.ts` (add `event` as a weighted filler), `data/constants.ts` (`BALANCE.map.categoryWeights` add an `event` weight)
- Test: `tests/engine/eventPlacement.test.ts`

**Interfaces:**
- Consumes: `BALANCE.map`, `assignAreaCategories`.
- Produces: `event` appears as a filler node in generated areas at a modest frequency; the guaranteed infirmary/elite/relic/boss are untouched; `map.ts`'s battle-package loop already skips non-combat nodes (verify: it only builds packages for `battle`/`elite`/`boss`), so no change needed there.

- [ ] **Step 1: Write the failing test**

`tests/engine/eventPlacement.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { generateArea, parseAreaNodeId } from '@/game/engine/map'
import { createRng } from '@/game/engine/rng'
const bias = { teamSize: 3, teamMax: 5 }
describe('event node placement', () => {
  it('events appear across a sample of areas (not never, not always)', () => {
    let withEvent = 0
    for (let i = 0; i < 40; i++) {
      const nodes = generateArea(createRng(`ev-${i}`).fork(1), `ev-${i}`, 1, bias)
      if (nodes.some(n => n.type === 'event')) withEvent++
    }
    expect(withEvent).toBeGreaterThan(0)   // events do generate
    expect(withEvent).toBeLessThan(40)     // not on literally every area
  })
  it('the guaranteed nodes still exist in every area (infirmary, elite, relic, boss)', () => {
    for (let i = 0; i < 20; i++) {
      const nodes = generateArea(createRng(`g-${i}`).fork(1), `g-${i}`, 1, bias)
      expect(nodes.some(n => n.type === 'infirmary')).toBe(true)
      expect(nodes.some(n => n.type === 'elite')).toBe(true)
      expect(nodes.some(n => n.type === 'relic')).toBe(true)
      expect(nodes.some(n => n.type === 'boss')).toBe(true)
    }
  })
  it('event nodes carry no battle package', () => {
    for (let i = 0; i < 20; i++) {
      const nodes = generateArea(createRng(`b-${i}`).fork(1), `b-${i}`, 1, bias)
      for (const n of nodes.filter(x => x.type === 'event')) expect(n.battle).toBeUndefined()
    }
  })
})
```

- [ ] **Step 2: Run** — FAIL (no event nodes generated).

- [ ] **Step 3: Implement.** Read `game/engine/nodeGen.ts` `pickFiller` and the `Filler` type. Add `'event'` to the `Filler` union and to `pickFiller`'s weighted `entries`, with a weight from `BALANCE.map.categoryWeights.event` (add `event: 15` to `categoryWeights` in `data/constants.ts`). Events are ordinary fillers (like relic/battle) — the existing guarantees run BEFORE the filler pass, so they are untouched. Confirm `map.ts`'s package loop condition is `node.type !== 'battle' && node.type !== 'elite' && node.type !== 'boss'` → `continue` (events skipped). If events were accidentally given a recruit-style cap, do not add one.

- [ ] **Step 4: Run** — PASS. Also `npx vitest run tests/map/area.test.ts tests/engine/runNodeTypes.test.ts --disableConsoleIntercept` → PASS.

- [ ] **Step 5: Commit** — `git add game/engine/nodeGen.ts data/constants.ts tests/engine/eventPlacement.test.ts && git commit -m "feat(events): place event nodes as a weighted filler"`

---

### Task 6: Controller wiring (`useRunB`) — phase, choose, Cioccorane, gating

**Files:**
- Modify: `hooks/useRunB.ts`
- Test: `tests/hooks/useRunB.event.test.ts`

**Interfaces:**
- Consumes: `eventResolver`/`resolveCurrent`, `applyEventEffects` (for the cioccorane delta), `EVENT_BY_ID`/`pickEvent`, `grantCioccorane`/`spendCioccorane` (`@/lib/metaStore`), profile ref.
- Produces on the controller: `event` view (via `viewForPhase('event-node') → 'event'`); `currentEvent: { id, title, text, choices: { id, label, enabled, reason?: string }[] } | null` (computed from the resolver's `enter`, with each choice's `enabled` evaluated against `requires` using the LIVE run team + profile Cioccorane); `chooseEventOption(optionId: string): void` — applies the option: `commit(resolveCurrent(run, { kind: 'event-choice', optionId }, rng))` for run-resource effects, THEN applies the Cioccorane delta to the profile (`grantCioccorane`/`spendCioccorane`; if a `spend` would go negative the choice was disabled so this can't happen), saves profile.

- [ ] **Step 1: Write the failing test**

`tests/hooks/useRunB.event.test.ts` — mirror `tests/hooks/useRunB.test.ts` (renderHook/act). Splice an `event` node as current (or drive to one), then:
```ts
it('exposes the current event with per-choice enabled flags', () => {
  // currentEvent is non-null; a choice requiring 30 Cioccorane is disabled when profile has < 30
})
it('chooseEventOption applies run-resource effects and returns to the map', () => {
  // pick a heal choice -> team currentHp rose; view === 'map'
})
it('a Cioccorane-cost choice deducts from the profile', () => {
  // give profile 50; choose the 30-cost heal; profile.cioccorane === 20
})
it('is deterministic (same seed -> same event + same option outcome)', () => {})
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement.** Add `'event-node'` handling to `viewForPhase` (→ `'event'`). Compute `currentEvent` (memo on run) by calling `eventResolver.enter(run, currentNode, rng)` and evaluating each choice's `requires` against the live team (`minTeam`, `role`) and profile (`minCioccorane`). Add `chooseEventOption` mirroring `chooseRecruit`: resolve the choice (run-resource effects via the engine), then compute the Cioccorane delta for that choice (sum its `cioccorane` effects; for a `gamble`, re-derive via the SAME rng the resolver used so state and currency agree) and apply to the profile, save. Expose `currentEvent` + `chooseEventOption` on the controller.

- [ ] **Step 4: Run** — PASS. Also `npx vitest run tests/hooks/useRunB.test.ts --disableConsoleIntercept` → PASS.

- [ ] **Step 5: Commit** — `git add hooks/useRunB.ts tests/hooks/useRunB.event.test.ts && git commit -m "feat(events): controller — event phase, choose, Cioccorane, gating"`

---

### Task 7: `EventScreen` UI

**Files:**
- Create: `components/screens/EventScreen.tsx`
- Modify: `components/screens/RunBRunner.tsx` (render for the `event` view)
- Test: `tests/screens/EventScreen.test.tsx`

**Interfaces:**
- Consumes: the controller's `currentEvent` + `chooseEventOption`.
- Produces: a screen rendering `title`, `text`, and a button per choice (disabled + `reason` tooltip when `!enabled`); clicking an enabled choice calls `chooseEventOption(id)`.

- [ ] **Step 1: Write the failing test** — read `tests/screens/*` (e.g. the recruit/relic node screen tests) and mirror the harness. `EventScreen.test.tsx`:
```tsx
it('renders the event title, text, and a button per choice', () => {
  // render <EventScreen event={sampleEvent} onChoose={fn} />; assert title/text + N buttons
})
it('disables a choice whose enabled=false and shows its reason', () => {})
it('calls onChoose with the choice id when an enabled choice is clicked', () => {})
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement.** `EventScreen` props `{ event: {title,text,choices:{id,label,enabled,reason?}[]}, onChoose:(id:string)=>void }`. Theme it like the existing node screens (read `RecruitScreen`/`RelicNodeScreen` for the `Frame`/`Insegna`/`Parchment` pattern), reduced-motion aware. Wire into `RunBRunner.tsx`: `case 'event': return withTeamSidebar(<EventScreen event={c.currentEvent!} onChoose={c.chooseEventOption} />)` (match how `recruit`/`relic` cases are rendered).

- [ ] **Step 4: Run** — PASS. Also `npx vitest run tests/screens/RunBRunner.test.tsx --disableConsoleIntercept` → PASS.

- [ ] **Step 5: Commit** — `git add components/screens/EventScreen.tsx components/screens/RunBRunner.tsx tests/screens/EventScreen.test.tsx && git commit -m "feat(events): EventScreen UI + RunBRunner wiring"`

---

### Task 8: Balance-harness event policy + full-suite verification

**Files:**
- Modify: `tests/engine/campaignBalanceRestricted.test.ts`, `tests/engine/campaignBalanceB.test.ts` (bot handles `event-node`)
- Test: the two harnesses + full suite.

**Interfaces:**
- Consumes: the event resolver/phase.
- Produces: the balance bots resolve `event-node` phases by choosing a sensible default option (the first ENABLED choice, or a "safe" heuristic) so runs terminate; re-measured winRates recorded; no soft-locks.

- [ ] **Step 1: Add event handling to the bots.** In each harness's `runOne`, add a branch: `if (s.phase === 'event-node') { s = resolveCurrent(s, { kind: 'event-choice', optionId: <first enabled choice id via eventResolver.enter> }, rng); s = { ...s, phase: 'map' }; continue }`. Pick the first choice deterministically.

- [ ] **Step 2: Measure** — `npx vitest run tests/engine/campaignBalanceRestricted.test.ts tests/engine/campaignBalanceB.test.ts --disableConsoleIntercept`. Record both winRates in the test comments. Expected: modest movement (events are mostly neutral/positive); no crash, no soft-lock (the "no stall" and terminal-phase assertions still pass).

- [ ] **Step 3: Full suite + typecheck** — `npx vitest run --disableConsoleIntercept` then `npx tsc --noEmit`. Expected: all green, exit 0.

- [ ] **Step 4: Commit** — `git add tests/engine/campaignBalanceRestricted.test.ts tests/engine/campaignBalanceB.test.ts && git commit -m "test(events): balance bots resolve event nodes; suite green"`

---

## Self-Review

**Spec coverage:**
- §3.1 data/types → Task 1. ✓
- §3.2 pure effect engine → Task 3. ✓
- §3.3 resolver + ResolverChoice/Entry → Task 4. ✓
- §3.4 wiring (node type exists; phase, placement, controller, screen) → Task 4 (phase), Task 5 (placement), Task 6 (controller), Task 7 (screen). ✓
- §3.5 rule-breaking relic seed → Task 2. ✓
- §4 starter event pool → Task 1. ✓
- §5 tests: effect engine (T3), resolver (T4), placement (T5), no-battle-package (T5), UI (T7), campaign resolves (T8). ✓
- §7 risks: bot policy (T8), leveling helper (T3 uses `gainLevels`), ResolverEntry shape (T4), determinism (T3/T4), frequency (T5), Cioccorane coupling (T6, controller-applied, small amounts). ✓

**Placeholder scan:** Tasks 3/6/7 tests say "mirror the existing helper/harness" — intentional: they must reuse the real state-builder / render harness rather than invent a divergent one; the ASSERTIONS are concrete. Data/resolver/placement tasks (1,2,4,5) have complete code.

**Type consistency:** `EventEffect`/`EventChoice`/`GameEvent` (T1) consumed by `applyEventEffects` (T3), `eventResolver` (T4), controller (T6), screen (T7). `ResolverChoice` `event-choice` (T4) used in T6/T8. `applyEventEffects(state,effects,rng) → {state,cioccoraneDelta,log}` (T3) consumed T4/T6. `RULE_BREAKING_RELIC_IDS` (T2) consumed T3. `currentEvent`/`chooseEventOption` (T6) consumed T7. Consistent.

## Execution note

`event` node type + `NODE_CATALOG.event` already exist — Tasks only ADD the resolver/engine/placement/phase/UI. Keep the engine pure; Cioccorane is controller-only. Rule-breaking relics reuse existing hooks only (no combat rewrites in this slice).
