# Duo Combos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 6 Hades-style "Duo" combos that auto-ignite at the intersection of two archetype signals, announced by a banner and recorded in the Codex — player-only, campaign + Endless.

**Architecture:** A Duo = two archetype *signals* (lit from team comp OR relics) + a named effect. `detectDuos(team, relics)` (pure, mirrors `detectSynergies`) is computed at combat-resolve time and passed to `simulateBattle` as `leftDuos`. Effects reach combat two ways, exactly mirroring existing systems: **per-unit stamped flags** (like `execute`/`shieldConvert` in `toBattleUnits`) for CANCRENA/MURO/ESECUZIONE-A-FREDDO/MIETITORE, and **inline sim hooks** at the existing dispatch sites for MIASMA (onDeath) and UNTORE (onHeal). All randomness draws from the sim's threaded `rng` so Endless replay parity holds.

**Tech Stack:** TypeScript, Next.js (custom build — read `node_modules/next/dist/docs/` before touching Next APIs), Vitest, React. RNG: `game/engine/rng.ts` (`Rng` interface). No new dependencies.

## Global Constraints

- **Copy in Italian** (all player-facing names/desc/labels).
- **Player-only.** Duos are computed for the LEFT side only (player). Enemies never get them → the balance bot stays a valid proxy.
- **MAX 5 enemies** — untouched by this feature; never add units.
- **NO friendly fire** — every Duo that targets does so only against the opposing side; assert this in tests.
- **NO camera shake** in any VFX/toast.
- **Determinism (anti-cheat, hard req):** every random draw in a Duo primitive pulls from the sim's threaded `rng` (`rng.pick`/`rng.int`), from a **deterministically sorted** candidate pool, and is **skipped entirely when there are zero candidates** (no phantom draw). Never call `createRng`/`Math.random`/an out-of-band `fork` inside a primitive. `tests/engine/endlessReplayParity.test.ts` must stay 20/20.
- **`npm run test` does NOT typecheck** → run `npm run typecheck` (tsc --noEmit) separately after each task.
- Commit after every task (frequent commits). Do not push until the whole slice is reviewed.

---

## File Structure

**New files:**
- `types/duo.ts` — `DuoSignal`, `Duo`, `ActiveDuo`, `DuoProgress`.
- `data/duos.ts` — `DUOS: Duo[]`, `DUO_BY_ID`, `SIGNAL_LABEL`.
- `game/engine/duos.ts` — `signalActive`, `litSignals`, `detectDuos`, `duoProgress`.
- `game/engine/duoEffects/stamp.ts` — `stampDuoFields(units, side, duos, kind)` (per-unit flags).
- `game/engine/duoEffects/spreadOnDeath.ts` — `maybeSpreadPoison(...)` (MIASMA, inline).
- `game/engine/duoEffects/spitOnHeal.ts` — `maybeSpitPoison(...)` (UNTORE, inline).
- `game/engine/duoEffects/reap.ts` — `maybeReap(...)` (MIETITORE, inline).
- `components/run/DuoBar.tsx` — active/near Duo panel section.
- `components/run/DuoToast.tsx` — discovery banner.
- Tests under `tests/engine/duos*`, `tests/engine/duoEffects/*`, `tests/data/duos.test.ts`, `tests/lib/duosSeen.test.ts`, `tests/ui/duoBar.test.tsx`, `tests/engine/duoStress.test.ts`.

**Modified files:**
- `types/combat.ts` — add optional Duo stamp fields to `BattleUnit`.
- `types/status.ts` (or `data/statuses.ts`) — add the `raccolto` stat-buff status for MIETITORE.
- `game/engine/combat/simulate.ts` — `leftDuos` opt, `stampDuoFields` call, inline hooks at death/heal sites.
- `game/engine/combat/effects.ts` — CANCRENA tick amp + ESECUZIONE A FREDDO in the damage handler.
- `game/engine/combat/targeting.ts` — MURO VIVENTE retarget in `selectTarget`.
- `game/engine/status.ts` — CANCRENA veleno-tick amplification in the DoT tick.
- `game/engine/resolvers/combat.ts` — compute `detectDuos(playerTeam, playerRelics)`, pass `leftDuos`.
- `hooks/useEndless.ts` / endless resolve path — same `leftDuos` wiring.
- `lib/metaStore.ts` — `MetaCodex.duosSeen`, `markSeen('duo', …)`, `defaultProfile`.
- `hooks/useRunShared.ts` — mark discovered Duos seen in the node-choose path.
- `components/screens/CollectionScreen.tsx` — Duo Codex section.
- `components/run/TeamSynergyBar.tsx` — mount `DuoBar`.

---

## Verified interfaces (from recon — quote these, don't guess)

```ts
// game/engine/rng.ts:1-8
interface Rng { next():number; int(min:number,max:number):number; chance(p:number):boolean;
  pick<T>(arr:readonly T[]):T; shuffle<T>(arr:readonly T[]):T[]; fork(salt:number):Rng }

// types/combat.ts:42-72  (BattleUnit) — extends DraftedWizard; role = unit.wizard.role;
//   maxHp from DraftedWizard; NO scalar shield (shields are ActiveEffect statusId:'shield' + absorbLeft);
//   optional stamped fields already present: execute?, shieldConvert?, darkMagic?, alwaysHit?, controlResist?…
// types/combat.ts:29-38  (ActiveEffect) { kind, stat?, amount?, remaining, statusId?, stacks?, sourceId?, absorbLeft? }

// game/engine/status.ts:48  applyStatus(unit, statusId, { duration?, sourceId?, maxStacks? }): void
// data/statuses.ts:19  veleno: stack 'accumulate', maxStacks 8, permanent true, tickDamage 4, tickPctMaxHp .005
// game/engine/combat/roleCounter.ts  exports isUnderHardControl(unit), HARD_CONTROL_KINDS (stun/freeze/silence)

// game/engine/synergy.ts:33  detectSynergies(team: DraftedWizard[]): ActiveSynergy[]
// game/engine/relics.ts:80  registerRelicTriggers(bus, team, relics, side)  — trigger→listener template
// game/engine/synergyTriggers.ts:24  registerSynergyTriggers(bus, units, synergies, side) — closest listener template
// game/engine/combat/targeting.ts:111  selectTarget(actor, allies, enemies, spell?): BattleUnit|undefined
//   (for a RIGHT actor, `enemies` = the player's LEFT team)
// game/engine/combat/simulate.ts:66  simulateBattle(left, right, rng, opts) — opts has leftSyn/leftRelics/rightMenace/…
//   toBattleUnits at :26-58 (stamp site); onHeal dispatch :266; direct-hit kill+onDeath :272-293;
//   DoT-tick kill :328-341; fatigue kill :376-384; onBattleStart :167-196.
// game/engine/resolvers/combat.ts:47  const battleRng = rng.fork(depth+100); :88 simulateBattle(ready, enemy, battleRng, {…})
// lib/metaStore.ts:10 MetaCodex{ wizardsSeen, relicsSeen, synergiesSeen, bossesSeen }; :40 defaultProfile.codex;
//   :97 markSeen(p, kind, id); :61 loadProfile merges codex (adding a field is back-compat-safe)
// hooks/useRunShared.ts:139-142  markSeen(p,'synergy',a.synergy.id) loop in chooseNode — mark Duos here too
// components/screens/CollectionScreen.tsx:338-355 SynergyTile (grey→lit template); :527-541 section mount
```

---

### Task 1: Foundation — types, `detectDuos`, signals, Codex field

**Files:**
- Create: `types/duo.ts`, `data/duos.ts`, `game/engine/duos.ts`
- Modify: `types/index.ts` (re-export, if the repo barrels types — check first), `lib/metaStore.ts:10,40,97`
- Test: `tests/engine/duos.test.ts`, `tests/data/duos.test.ts`, `tests/lib/duosSeen.test.ts`

**Interfaces:**
- Produces:
  - `type DuoSignal = 'veleno'|'esecuzione'|'scudirigen'|'magieOscure'|'taunt'|'attaccante'|'supporto'|'controllo'`
  - `interface Duo { id:string; name:string; desc:string; signals:[DuoSignal,DuoSignal] }`
  - `interface ActiveDuo { duo:Duo }`
  - `interface DuoProgress { duo:Duo; lit:[boolean,boolean]; active:boolean; missing:DuoSignal[] }`
  - `signalActive(sig:DuoSignal, team:DraftedWizard[], relics:ActiveRelic[]):boolean`
  - `litSignals(team, relics):Set<DuoSignal>`
  - `detectDuos(team:DraftedWizard[], relics:ActiveRelic[]):ActiveDuo[]`
  - `duoProgress(team, relics):DuoProgress[]`
  - `DUOS:Duo[]`, `DUO_BY_ID:Record<string,Duo>`, `SIGNAL_LABEL:Record<DuoSignal,string>`
  - `markSeen(p, 'duo', id)` support; `MetaCodex.duosSeen:string[]`

- [ ] **Step 1: Write `types/duo.ts`**

```ts
import type { DraftedWizard } from './combat'
import type { ActiveRelic } from './relic'

export type DuoSignal =
  | 'veleno' | 'esecuzione' | 'scudirigen' | 'magieOscure'
  | 'taunt' | 'attaccante' | 'supporto' | 'controllo'

export interface Duo {
  id: string
  name: string
  /** Effect text — HIDDEN in the Codex until first discovery. */
  desc: string
  signals: [DuoSignal, DuoSignal]
}

export interface ActiveDuo { duo: Duo }

export interface DuoProgress {
  duo: Duo
  lit: [boolean, boolean]
  active: boolean
  missing: DuoSignal[]
}
```

Re-export from the types barrel if one exists (grep `export .* from './relic'` in `types/index.ts`; add the analogous `export * from './duo'`).

- [ ] **Step 2: Write the failing detection test** — `tests/engine/duos.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { signalActive, detectDuos, duoProgress } from '@/game/engine/duos'
import type { DraftedWizard, ActiveRelic } from '@/types'

// minimal drafted-wizard factory
const dw = (id: string, role: string, tags: string[] = []): DraftedWizard =>
  ({ wizard: { id, role, house: 'Grifondoro', tags } , level: 1 } as unknown as DraftedWizard)
const relic = (r: Partial<ActiveRelic['relic']>): ActiveRelic =>
  ({ relic: { id: r.id ?? 'x', name: '', desc: '', rarity: 'comune', ...r } } as ActiveRelic)

describe('signalActive', () => {
  it('tag signal lights on >=2 tagged mages', () => {
    const team = [dw('a','Attaccante',['veleno']), dw('b','Tank',['veleno'])]
    expect(signalActive('veleno', team, [])).toBe(true)
  })
  it('tag signal does NOT light on 1 tagged mage and no relic', () => {
    expect(signalActive('veleno', [dw('a','Attaccante',['veleno'])], [])).toBe(false)
  })
  it('tag signal lights from a keyword relic alone', () => {
    expect(signalActive('veleno', [dw('a','Attaccante')], [relic({ keywords: ['veleno'] })])).toBe(true)
  })
  it('esecuzione lights from grantsExecute relic', () => {
    expect(signalActive('esecuzione', [dw('a','Tank')], [relic({ grantsExecute: { threshold: .3, bonus: .4 } })])).toBe(true)
  })
  it('taunt lights on a single Tank', () => {
    expect(signalActive('taunt', [dw('a','Tank')], [])).toBe(true)
  })
  it('attaccante needs >=2 of the role', () => {
    expect(signalActive('attaccante', [dw('a','Attaccante')], [])).toBe(false)
    expect(signalActive('attaccante', [dw('a','Attaccante'), dw('b','Attaccante')], [])).toBe(true)
  })
})

describe('detectDuos', () => {
  it('fires CANCRENA when veleno + esecuzione both lit', () => {
    const team = [dw('a','Attaccante',['veleno','esecuzione']), dw('b','Tank',['veleno','esecuzione'])]
    const ids = detectDuos(team, []).map(d => d.duo.id)
    expect(ids).toContain('cancrena')
  })
  it('does not fire a Duo with only one signal lit', () => {
    const team = [dw('a','Attaccante',['veleno']), dw('b','Tank',['veleno'])]
    expect(detectDuos(team, []).map(d => d.duo.id)).not.toContain('cancrena')
  })
})

describe('duoProgress', () => {
  it('reports the missing signal for a near Duo', () => {
    const team = [dw('a','Tank'), dw('b','Attaccante',['scudirigen']), dw('c','Sup',['scudirigen'])]
    const muro = duoProgress(team, []).find(p => p.duo.id === 'muro-vivente')!
    expect(muro.active).toBe(true) // taunt (1 Tank) + scudirigen (2 mages)
  })
})
```

- [ ] **Step 3: Run it — expect FAIL** (`npx vitest run tests/engine/duos.test.ts`) with "Cannot find module '@/game/engine/duos'".

- [ ] **Step 4: Write `data/duos.ts`**

```ts
import type { Duo, DuoSignal } from '@/types'

export const SIGNAL_LABEL: Record<DuoSignal, string> = {
  veleno: 'Veleno', esecuzione: 'Esecuzione', scudirigen: 'Scudo/Rigen', magieOscure: 'Magie Oscure',
  taunt: 'Tank', attaccante: 'Attaccante', supporto: 'Supporto', controllo: 'Controllo',
}

export const DUOS: Duo[] = [
  { id: 'cancrena', name: 'Cancrena', signals: ['veleno', 'esecuzione'],
    desc: 'I nemici avvelenati sotto il 40% di vita subiscono il doppio dei danni da veleno.' },
  { id: 'miasma', name: 'Miasma', signals: ['veleno', 'magieOscure'],
    desc: 'Quando un nemico avvelenato muore, il suo veleno si propaga a un nemico vivo a caso.' },
  { id: 'untore', name: 'Untore', signals: ['veleno', 'supporto'],
    desc: 'Ogni volta che curi, sputi 1 dose di veleno su un nemico a caso.' },
  { id: 'muro-vivente', name: 'Muro Vivente', signals: ['scudirigen', 'taunt'],
    desc: 'Finché il Tank che provoca ha uno scudo, le tue retrovie non possono essere colpite.' },
  { id: 'esecuzione-a-freddo', name: 'Esecuzione a Freddo', signals: ['esecuzione', 'controllo'],
    desc: 'Un nemico stordito o congelato sotto il 50% di vita viene giustiziato all’istante.' },
  { id: 'mietitore', name: 'Mietitore', signals: ['esecuzione', 'magieOscure'],
    desc: 'Ogni nemico giustiziato dà al suo carnefice +6 attacco per il resto della battaglia.' },
]

export const DUO_BY_ID: Record<string, Duo> = Object.fromEntries(DUOS.map(d => [d.id, d]))
```

- [ ] **Step 5: Write `game/engine/duos.ts`**

```ts
import type { ActiveDuo, ActiveRelic, DraftedWizard, DuoProgress, DuoSignal } from '@/types'
import { DUOS } from '@/data/duos'

const ROLE_OF: Partial<Record<DuoSignal, string>> = {
  attaccante: 'Attaccante', supporto: 'Supporto', controllo: 'Controllo',
}
const TAG_OF: Partial<Record<DuoSignal, string>> = {
  veleno: 'veleno', esecuzione: 'esecuzione', scudirigen: 'scudirigen', magieOscure: 'magieOscure',
}
// A relic lights a tag signal via keyword OR the matching grant.
const relicLightsTag = (sig: DuoSignal, r: ActiveRelic['relic']): boolean => {
  const kw = r.keywords ?? []
  switch (sig) {
    case 'veleno': return kw.includes('veleno')
    case 'esecuzione': return kw.includes('esecuzione') || !!r.grantsExecute
    case 'scudirigen': return kw.includes('scudo') || !!r.grantsShieldConvert
    case 'magieOscure': return kw.includes('magieOscure') || !!r.grantsDarkMagic
    default: return false
  }
}

export function signalActive(sig: DuoSignal, team: DraftedWizard[], relics: ActiveRelic[]): boolean {
  if (sig === 'taunt') return team.some(d => d.wizard.role === 'Tank')
  const role = ROLE_OF[sig]
  if (role) return team.filter(d => d.wizard.role === role).length >= 2
  const tag = TAG_OF[sig]!
  const comp = team.filter(d => (d.wizard.tags ?? []).includes(tag)).length >= 2
  return comp || relics.some(({ relic }) => relicLightsTag(sig, relic))
}

export function litSignals(team: DraftedWizard[], relics: ActiveRelic[]): Set<DuoSignal> {
  const set = new Set<DuoSignal>()
  for (const d of DUOS) for (const s of d.signals) if (!set.has(s) && signalActive(s, team, relics)) set.add(s)
  return set
}

export function detectDuos(team: DraftedWizard[], relics: ActiveRelic[]): ActiveDuo[] {
  const lit = litSignals(team, relics)
  return DUOS.filter(d => d.signals.every(s => lit.has(s))).map(duo => ({ duo }))
}

export function duoProgress(team: DraftedWizard[], relics: ActiveRelic[]): DuoProgress[] {
  const lit = litSignals(team, relics)
  return DUOS.map(duo => {
    const litPair = duo.signals.map(s => lit.has(s)) as [boolean, boolean]
    return { duo, lit: litPair, active: litPair.every(Boolean), missing: duo.signals.filter(s => !lit.has(s)) }
  })
}
```

- [ ] **Step 6: Run detection tests — expect PASS** (`npx vitest run tests/engine/duos.test.ts`).

- [ ] **Step 7: Write `tests/data/duos.test.ts`** — guard the data set (mirrors `tests/data/relics.test.ts`):

```ts
import { describe, it, expect } from 'vitest'
import { DUOS, DUO_BY_ID, SIGNAL_LABEL } from '@/data/duos'

describe('DUOS data', () => {
  it('has 6 duos with unique ids and exactly 2 distinct signals each', () => {
    expect(DUOS).toHaveLength(6)
    expect(new Set(DUOS.map(d => d.id)).size).toBe(6)
    for (const d of DUOS) {
      expect(d.signals).toHaveLength(2)
      expect(d.signals[0]).not.toBe(d.signals[1])
      expect(d.name).toBeTruthy(); expect(d.desc).toBeTruthy()
    }
  })
  it('every signal has an Italian label', () => {
    for (const d of DUOS) for (const s of d.signals) expect(SIGNAL_LABEL[s]).toBeTruthy()
    expect(DUO_BY_ID['cancrena']?.name).toBe('Cancrena')
  })
})
```

- [ ] **Step 8: Extend `lib/metaStore.ts`** — add `duosSeen` (3 edits):
  - `MetaCodex` (`:10`): add `duosSeen: string[]`.
  - `defaultProfile().codex` (`:40`): add `duosSeen: []`.
  - `markSeen` (`:97`): widen the union to include `'duo'` and add `duo: 'duosSeen'` to the map.

- [ ] **Step 9: Write `tests/lib/duosSeen.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { defaultProfile, markSeen } from '@/lib/metaStore'

describe('duosSeen codex', () => {
  it('defaults to empty and records a discovery once', () => {
    let p = defaultProfile()
    expect(p.codex.duosSeen).toEqual([])
    p = markSeen(p, 'duo', 'cancrena')
    p = markSeen(p, 'duo', 'cancrena')
    expect(p.codex.duosSeen).toEqual(['cancrena'])
  })
})
```

- [ ] **Step 10: Run all Task-1 tests + typecheck**

Run: `npx vitest run tests/engine/duos.test.ts tests/data/duos.test.ts tests/lib/duosSeen.test.ts && npm run typecheck`
Expected: all PASS, tsc clean.

- [ ] **Step 11: Commit**

```bash
git add types/duo.ts data/duos.ts game/engine/duos.ts lib/metaStore.ts tests/engine/duos.test.ts tests/data/duos.test.ts tests/lib/duosSeen.test.ts types/index.ts
git commit -m "feat(duos): foundation — types, detectDuos, signals, Codex duosSeen"
```

---

### Task 2: Combat plumbing — `leftDuos` into the sim + per-unit stamp seam

**Files:**
- Modify: `types/combat.ts` (BattleUnit fields), `game/engine/combat/simulate.ts` (opt + stamp call), `game/engine/resolvers/combat.ts` (compute + pass), endless resolve path (`hooks/useEndless.ts` or its resolver — grep for the `simulateBattle`/`resolveCombat` call in the endless flow)
- Create: `game/engine/duoEffects/stamp.ts`
- Test: `tests/engine/duoEffects/stamp.test.ts`

**Interfaces:**
- Consumes: `detectDuos` (Task 1), `simulateBattle` opts.
- Produces:
  - `simulateBattle(left, right, rng, opts)` gains `opts.leftDuos?: ActiveDuo[]` and `opts.kind?: 'normal'|'elite'|'boss'`.
  - `BattleUnit` gains optional stamp fields (all undefined by default): `poisonAmp?: { threshold:number; mult:number }` (on enemies), `livingWall?: boolean` (on player Tanks), `coldExecute?: { threshold:number; instakill:boolean }`, `reaper?: boolean`, `spreadsPoison?: boolean`, `spitsPoisonOnHeal?: boolean`.
  - `stampDuoFields(left: BattleUnit[], right: BattleUnit[], duos: ActiveDuo[], kind: 'normal'|'elite'|'boss'): void` — mutates units to set the flags above. Each Duo's stamp is filled in by its own task; this task ships the function shell + the wiring + one representative flag (`spreadsPoison`) to prove the seam.

- [ ] **Step 1: Add fields to `BattleUnit`** (`types/combat.ts:42-72`), each optional:

```ts
  // --- Duo stamps (player-only; see game/engine/duoEffects/stamp.ts) ---
  poisonAmp?: { threshold: number; mult: number }   // CANCRENA (stamped on ENEMY units)
  livingWall?: boolean                               // MURO VIVENTE (player Tanks)
  coldExecute?: { threshold: number; instakill: boolean } // ESECUZIONE A FREDDO (player attackers)
  reaper?: boolean                                   // MIETITORE (player units)
  spreadsPoison?: boolean                            // MIASMA (battle owns left)
  spitsPoisonOnHeal?: boolean                        // UNTORE (player units)
```

- [ ] **Step 2: Write the failing stamp test** — `tests/engine/duoEffects/stamp.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { stampDuoFields } from '@/game/engine/duoEffects/stamp'
import type { ActiveDuo, BattleUnit } from '@/types'

const unit = (side: 'left'|'right', role='Attaccante'): BattleUnit =>
  ({ side, alive: true, hp: 100, statusEffects: [], wizard: { role } } as unknown as BattleUnit)
const duo = (id: string): ActiveDuo => ({ duo: { id, name:'', desc:'', signals:['veleno','magieOscure'] } })

describe('stampDuoFields', () => {
  it('MIASMA stamps spreadsPoison on player (left) units only', () => {
    const L = [unit('left')], R = [unit('right')]
    stampDuoFields(L, R, [duo('miasma')], 'normal')
    expect(L[0].spreadsPoison).toBe(true)
    expect(R[0].spreadsPoison).toBeUndefined()
  })
  it('no duos → no stamps', () => {
    const L = [unit('left')], R = [unit('right')]
    stampDuoFields(L, R, [], 'normal')
    expect(L[0].spreadsPoison).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run — expect FAIL** (`npx vitest run tests/engine/duoEffects/stamp.test.ts`).

- [ ] **Step 4: Write `game/engine/duoEffects/stamp.ts`** (shell + MIASMA flag; other Duos append their branch in their own task)

```ts
import type { ActiveDuo, BattleUnit } from '@/types'

/** Stamp player-only Duo flags onto the battle units. Left = player. Called once at battle start.
 *  Each Duo appends its own branch here (kept data-light: flags only, logic lives per-primitive). */
export function stampDuoFields(
  left: BattleUnit[], right: BattleUnit[], duos: ActiveDuo[], _kind: 'normal' | 'elite' | 'boss',
): void {
  const has = (id: string) => duos.some(d => d.duo.id === id)
  if (has('miasma')) for (const u of left) u.spreadsPoison = true
  // CANCRENA / MURO VIVENTE / ESECUZIONE A FREDDO / MIETITORE / UNTORE branches added by their tasks.
}
```

- [ ] **Step 5: Wire into `simulateBattle`** — add `leftDuos?: ActiveDuo[]` and `kind?` to the opts type (`simulate.ts:66-71`), and after `toBattleUnits` builds `L`/`R` (around `:76-77`) call:

```ts
stampDuoFields(L, R, opts.leftDuos ?? [], opts.kind ?? 'normal')
```

Import `stampDuoFields` at the top. (No behavior yet — flags are inert until later tasks read them.)

- [ ] **Step 6: Wire the resolver** — in `game/engine/resolvers/combat.ts`, before the `simulateBattle(ready, enemy, battleRng, {…})` call (`:88`), compute and pass Duos. The player team + relics are the run's living team + active relics (grep the existing `leftRelics`/`leftSyn` args to see their exact source):

```ts
import { detectDuos } from '@/game/engine/duos'
// …
const leftDuos = detectDuos(ready, /* playerRelics as ActiveRelic[] */)
// add to the opts object:  leftDuos, kind: ek,
```

Do the same in the endless resolve path (grep `simulateBattle(` across `hooks/` and `game/engine/`; wire every call that uses the player as `left`). Enemy-only sims (if any) pass no `leftDuos`.

- [ ] **Step 7: Run stamp test + full combat suite + typecheck**

Run: `npx vitest run tests/engine/duoEffects/stamp.test.ts tests/engine/combat && npm run typecheck`
Expected: PASS, no regressions (flags inert), tsc clean.

- [ ] **Step 8: Commit**

```bash
git add types/combat.ts game/engine/combat/simulate.ts game/engine/resolvers/combat.ts game/engine/duoEffects/stamp.ts hooks/useEndless.ts tests/engine/duoEffects/stamp.test.ts
git commit -m "feat(duos): combat plumbing — leftDuos opt + per-unit stamp seam"
```

---

### Task 3: CANCRENA — double poison ticks on low-HP poisoned enemies

**Files:**
- Modify: `game/engine/duoEffects/stamp.ts` (poisonAmp branch), `game/engine/status.ts` (DoT tick amp), `game/engine/combat/simulate.ts` (thread the amp into the tick if needed)
- Test: `tests/engine/duoEffects/cancrena.test.ts`

**Interfaces:**
- Consumes: `BattleUnit.poisonAmp` (Task 2).
- Produces: veleno DoT tick damage is multiplied by `poisonAmp.mult` when the ticking unit has `poisonAmp` and `hp/maxHp < poisonAmp.threshold`.

- [ ] **Step 1: Failing test** — `tests/engine/duoEffects/cancrena.test.ts`. Drive a real `simulateBattle` with a player team that lights veleno+esecuzione vs a low-HP enemy, assert the poisoned enemy loses ~2× the base veleno tick in the turn it's under 40%. (Model on an existing `tests/engine/pickSpellVeleno.test.ts` / `tests/engine/status.test.ts` setup.) Minimum assertion:

```ts
// with poisonAmp {threshold:.4, mult:2}, an enemy at 30% maxHp loses 2× the normal veleno tick;
// an enemy at 60% loses the normal tick.
```

Include a **friendly-fire guard**: the amp only ever applies to `right` (enemy) units — assert a poisoned *player* unit (if any) is unaffected.

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Stamp branch** — in `stampDuoFields`, add:

```ts
if (has('cancrena')) for (const u of right) u.poisonAmp = { threshold: 0.4, mult: 2 }
```

- [ ] **Step 4: Amp the tick** — in `game/engine/status.ts` DoT tick (the veleno branch near `:109-120`, where `tickDamage` is computed for a unit), multiply the computed veleno damage by `unit.poisonAmp.mult` when `unit.poisonAmp && unit.hp / unit.maxHp < unit.poisonAmp.threshold`. Keep it to the `veleno`/`dot` family only. If `tickStatuses` can't see `unit.poisonAmp` (it can — the flag is on the `BattleUnit`), no new param is needed; otherwise thread a `duoAmp` arg from `simulate.ts`.

- [ ] **Step 5: Run test — expect PASS.**

- [ ] **Step 6: Run combat suite + typecheck** (`npx vitest run tests/engine && npm run typecheck`).

- [ ] **Step 7: Commit** — `feat(duos): CANCRENA — 2× veleno tick on low-HP poisoned enemies`.

---

### Task 4: MURO VIVENTE — untargetable backline behind a shielded taunting Tank

**Files:**
- Modify: `game/engine/duoEffects/stamp.ts` (livingWall branch), `game/engine/combat/targeting.ts` (`selectTarget` retarget), reuse `isUnderHardControl` from `roleCounter.ts`
- Test: `tests/engine/duoEffects/muroVivente.test.ts`

**Interfaces:**
- Consumes: `BattleUnit.livingWall` (Task 2).
- Produces: when a RIGHT actor picks a target and the LEFT team has an alive, taunting (`!isUnderHardControl`), shielded (`statusEffects.some(e => e.statusId==='shield' && (e.absorbLeft??0)>0)`) unit flagged `livingWall`, the target is force-set to that wall Tank. Never returns undefined when a wall exists.

- [ ] **Step 1: Failing test** — construct enemies (right) attacking a player (left) team where the left Tank has `livingWall=true` + a shield ActiveEffect and taunts; assert `selectTarget(enemyActor, enemyAllies, leftTeam)` returns the Tank even when a squishy backliner would otherwise be chosen. Then remove the shield (absorbLeft 0) and assert normal targeting resumes. Assert no empty target.

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Stamp branch** — `if (has('muro-vivente')) for (const u of left) if (u.wizard.role === 'Tank') u.livingWall = true`.

- [ ] **Step 4: Retarget in `selectTarget`** (`targeting.ts:111`) — at the top, before role dispatch:

```ts
// MURO VIVENTE: a shielded, taunting player Tank hard-blocks the backline.
const wall = enemies.find(e => e.alive && e.livingWall && !isUnderHardControl(e)
  && e.statusEffects.some(s => s.statusId === 'shield' && (s.absorbLeft ?? 0) > 0))
if (wall) return wall
```

(`enemies` here is the opposing side to `actor` — for an enemy actor it is the player's left team, so this only ever fires for enemy actors, preserving no-friendly-fire.)

- [ ] **Step 5: Run test — expect PASS.**

- [ ] **Step 6: Run targeting + combat suites + typecheck** (`npx vitest run tests/engine/combat/targeting.test.ts tests/engine && npm run typecheck`). Confirm existing taunt tests still pass.

- [ ] **Step 7: Commit** — `feat(duos): MURO VIVENTE — shielded taunting Tank hard-blocks the backline`.

---

### Task 5: ESECUZIONE A FREDDO — finish a stunned/frozen low-HP enemy (boss-guarded)

**Files:**
- Modify: `game/engine/duoEffects/stamp.ts` (coldExecute branch, `instakill = kind !== 'boss'`), `game/engine/combat/effects.ts` (damage handler)
- Test: `tests/engine/duoEffects/esecuzioneAFreddo.test.ts`

**Interfaces:**
- Consumes: `BattleUnit.coldExecute` (Task 2), `HARD_CONTROL_KINDS`/`isUnderHardControl`.
- Produces: in the `damage` handler, when `actor.coldExecute`, the target is an enemy, the target is hard-controlled, and `target.hp/target.maxHp < coldExecute.threshold` (0.5): if `coldExecute.instakill` set target lethal (hp→0); else add a large bonus damage (boss battles).

- [ ] **Step 1: Failing test** — two cases: (a) non-boss: a stunned enemy at 40% is instakilled by a `coldExecute` attacker; (b) boss battle (`instakill:false`): the same hit does bonus damage but does NOT instakill (enemy survives if HP high enough). Guard: a NON-controlled enemy at 40% is untouched (no execute). Friendly-fire guard: never applies to `actor.side` allies.

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Stamp branch**:

```ts
if (has('esecuzione-a-freddo')) {
  const instakill = _kind !== 'boss'
  for (const u of left) u.coldExecute = { threshold: 0.5, instakill }
}
```

(Rename `_kind` → `kind` in the signature since it's now used.)

- [ ] **Step 4: Damage-handler branch** — in `effects.ts` `damage` handler (`:38-84`), after final damage is computed and applied, add (reusing `HARD_CONTROL_KINDS` already imported at `:7`):

```ts
const ce = ctx.actor.coldExecute
if (ce && ctx.target.side !== ctx.actor.side && ctx.target.alive) {
  const controlled = ctx.target.statusEffects.some(e => HARD_CONTROL_KINDS.has(e.kind))
  if (controlled && ctx.target.hp / ctx.target.maxHp < ce.threshold) {
    if (ce.instakill) ctx.target.hp = 0
    else ctx.target.hp = Math.max(0, ctx.target.hp - Math.round(ctx.target.maxHp * 0.25))
  }
}
```

(Confirm the exact `ctx` shape in the handler and that `target.maxHp` is available; adjust to the real field access. The `sync`/KO + `onDeath` dispatch already handles the death that follows.)

- [ ] **Step 5: Run test — expect PASS.**
- [ ] **Step 6: Combat suite + typecheck.**
- [ ] **Step 7: Commit** — `feat(duos): ESECUZIONE A FREDDO — execute a stunned low-HP enemy (boss-guarded)`.

---

### Task 6: MIASMA — poison spreads to a random living enemy on death

**Files:**
- Create: `game/engine/duoEffects/spreadOnDeath.ts`
- Modify: `game/engine/combat/simulate.ts` (call at the 4 death sites), reuse `applyStatus`
- Test: `tests/engine/duoEffects/miasma.test.ts`

**Interfaces:**
- Consumes: `BattleUnit.spreadsPoison` (Task 2), the sim's `rng`.
- Produces: `maybeSpreadPoison(dead: BattleUnit, enemiesOfDead: BattleUnit[], rng: Rng): void` — if the LEFT team owns MIASMA (i.e. `dead.side === 'right'` and the battle stamped `spreadsPoison`), and `dead` carries veleno stacks, transfer those stacks to ONE random **living** right unit (sorted by `wizard.id`, single `rng.pick`), additive to the veleno cap (8). Zero living candidates → no rng draw, no-op. Non-recursive (operates on the already-resolved death).

**Determinism note:** this is the #1 replay-parity risk. Sort candidates by `wizard.id`, draw exactly once, guard the empty case.

- [ ] **Step 1: Failing test** — `tests/engine/duoEffects/miasma.test.ts`: build a right unit with N veleno stacks, mark the battle's left as MIASMA owner (set `spreadsPoison` on a left unit / pass the flag), kill the poisoned right unit, assert one other living right unit gained veleno stacks. Determinism sub-test: same seed → same recipient twice. Empty case: last enemy dies → no throw, no-op.

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Write `spreadOnDeath.ts`**

```ts
import type { BattleUnit } from '@/types'
import type { Rng } from '@/game/engine/rng'
import { applyStatus } from '@/game/engine/status'

const VELENO_CAP = 8

/** MIASMA: on a poisoned enemy's death, jump its veleno stacks to one random living enemy.
 *  Deterministic: sorted pool + single rng draw; no draw when no candidates. Non-recursive. */
export function maybeSpreadPoison(dead: BattleUnit, alliesOfDead: BattleUnit[], rng: Rng): void {
  if (dead.side !== 'right') return               // player-only owner ⇒ only enemy deaths spread
  const stacks = dead.statusEffects.find(e => e.statusId === 'veleno')?.stacks ?? 0
  if (stacks <= 0) return
  const pool = alliesOfDead.filter(u => u.alive && u !== dead).sort((a, b) => a.wizard.id.localeCompare(b.wizard.id))
  if (pool.length === 0) return                   // no draw when empty (parity)
  const recipient = rng.pick(pool)
  const have = recipient.statusEffects.find(e => e.statusId === 'veleno')?.stacks ?? 0
  const toAdd = Math.min(stacks, VELENO_CAP - have)
  for (let i = 0; i < toAdd; i++) applyStatus(recipient, 'veleno', { sourceId: dead.sourceId ?? undefined })
}
```

(Adjust `sourceId` access to the real credit string; `applyStatus` accumulates one stack per call, honoring the cap — the `toAdd` guard avoids over-applying.)

- [ ] **Step 4: Call at the death sites** — in `simulate.ts`, guard with the battle-level MIASMA flag (e.g. `const miasma = (opts.leftDuos ?? []).some(d => d.duo.id === 'miasma')` computed once). At each of the four kill sites (`:288-292`, `:302-306`, `:336-340`, `:378-383`) that dispatch `onDeath`, when the dead unit is `right`, call:

```ts
if (miasma && realTarget.side === 'right') maybeSpreadPoison(realTarget, R, rng)
```

(Use the correct dead-unit variable at each site: `realTarget` at the direct-hit site; the tick/fatigue sites use their own loop variable — match each.) Place the call AFTER `sync` and the `onDeath` dispatch so the death is fully resolved first.

- [ ] **Step 5: Run test — expect PASS.**
- [ ] **Step 6: Combat suite + typecheck** (watch for stray rng consumption breaking other seeded tests).
- [ ] **Step 7: Commit** — `feat(duos): MIASMA — poison jumps to a random living enemy on death`.

---

### Task 7: UNTORE — heals spit poison; and MIETITORE — execute kills grow the killer

**(Two small primitives sharing the inline-hook pattern; one task, two commits.)**

**Files:**
- Create: `game/engine/duoEffects/spitOnHeal.ts`, `game/engine/duoEffects/reap.ts`
- Modify: `game/engine/duoEffects/stamp.ts` (untore + reaper branches), `game/engine/combat/simulate.ts` (onHeal site + direct-hit kill site), `data/statuses.ts` (new `raccolto` stat-buff status)
- Test: `tests/engine/duoEffects/untore.test.ts`, `tests/engine/duoEffects/mietitore.test.ts`

**Interfaces:**
- Produces:
  - `maybeSpitPoison(right: BattleUnit[], rng: Rng, sourceId: string): void` — apply 1 veleno to one random living right unit (sorted pool, single draw, empty→no-op).
  - `maybeReap(killer: BattleUnit): void` — apply one stack of `raccolto` (+6 atk, permanent within battle, accumulate) to `killer`.
  - `raccolto` status in `data/statuses.ts`: `{ id:'raccolto', name:'Raccolto Oscuro', kind:'stat', stat:'atk', amount:6, stack:'accumulate', permanent:true, defaultDuration: <turnCap-safe>, priority:… }` (match the existing stat-buff status shape — model on `atkUp`).

- [ ] **Step 1 (UNTORE): Failing test** — a player heal on a MURO/any left healer, with UNTORE stamped, applies 1 veleno to a living enemy; determinism sub-test; empty-enemy no-op.

- [ ] **Step 2: Stamp + write `spitOnHeal.ts`** — stamp `if (has('untore')) for (const u of left) u.spitsPoisonOnHeal = true`. Primitive mirrors `spreadOnDeath` (sorted pool, one `rng.pick`, apply one veleno).

- [ ] **Step 3: Call at the onHeal site** — `simulate.ts:266` currently `if (entry.flags.includes('heal')) fireReactive('onHeal', realTarget, turn)`. After it, when the healed unit is a left ally and the battle has UNTORE, call `maybeSpitPoison(R, rng, sourceId(healer))`. Guard once with a battle-level `untore` boolean. Ensure the rng draw is skipped when no living enemies.

- [ ] **Step 4: Run UNTORE test — expect PASS. Commit** — `feat(duos): UNTORE — team heals spit poison on a random enemy`.

- [ ] **Step 5 (MIETITORE): Add the `raccolto` status** to `data/statuses.ts` (model on the existing `atkUp` stat-buff; permanent within the battle, accumulate). Add a data test asserting it exists with `stat:'atk'`.

- [ ] **Step 6: Failing test** — a `reaper`-flagged left unit lands a killing blow on an enemy; assert the killer gains a `raccolto` stack (atk buff). Second kill → 2 stacks. A non-reaper killer gains nothing.

- [ ] **Step 7: Stamp + write `reap.ts`** — stamp `if (has('mietitore')) for (const u of left) u.reaper = true`. `maybeReap(killer)` = `applyStatus(killer, 'raccolto', { sourceId: sourceId(killer) })`.

- [ ] **Step 8: Call at the direct-hit kill site** — `simulate.ts:280-293`, inside `if (!realTarget.alive) { … }`, where `actor` is the killer: `if (actor.side === 'left' && actor.reaper) maybeReap(actor)`. (Scope to direct-hit kills — poison/fatigue kills have no attacker actor.)

- [ ] **Step 9: Run MIETITORE test + combat suite + typecheck. Commit** — `feat(duos): MIETITORE — execute kills grant the killer a stacking atk buff`.

---

### Task 8: UI — Duo panel (active/near), discovery toast, Codex section

**Files:**
- Create: `components/run/DuoBar.tsx`, `components/run/DuoToast.tsx`
- Modify: `components/run/TeamSynergyBar.tsx` (mount `DuoBar`), `hooks/useRunShared.ts:139-142` (mark discovered Duos + surface newly-discovered for the toast), `components/screens/CollectionScreen.tsx` (Duo section)
- Test: `tests/ui/duoBar.test.tsx`, extend a Collection render test

**Interfaces:**
- Consumes: `duoProgress(team, relics)` (Task 1), `detectDuos`, `MetaCodex.duosSeen`.
- Produces: `DuoBar` renders active Duos (name + effect) and near Duos ("Muro Vivente — manca: Scudo/Rigen" via `SIGNAL_LABEL`). `DuoToast` shows a first-discovery banner. Codex shows a Duo grid: name + two ingredient signals ALWAYS; effect text only when `duosSeen.includes(id)` (else "???").

- [ ] **Step 1: Failing `DuoBar` render test** — `tests/ui/duoBar.test.tsx` (jsdom, model on `tests/screens/TeamSynergyBar.test.tsx`): given a team lighting one Duo and one-signal-short of another, assert the active Duo name renders and the near Duo shows its missing signal label.

- [ ] **Step 2: Write `DuoBar.tsx`** — props `{ team: DraftedWizard[]; relics: ActiveRelic[] }`; call `duoProgress`; render active (accent lit) + near ("manca: …") mirroring `SynergyTracker`'s active/near styling (`:119-121`). No new colors system — reuse the gold/violet accents already in that file.

- [ ] **Step 3: Mount in `TeamSynergyBar`** under the "Sinergie attive" block (`:237-253`); pass the run's team + active relics.

- [ ] **Step 4: Discovery marking + toast** — in `useRunShared.ts` `chooseNode` (`:139-142`), after marking synergies seen, compute `detectDuos(moved.team, moved.relics)`, diff against `profile.codex.duosSeen`, `markSeen(p,'duo',id)` for each new one, and surface the newly-discovered ids so the battle intro can render `DuoToast`. Write `DuoToast.tsx` (simple banner, NO camera shake). Add a render test that a newly-discovered Duo shows the toast once.

- [ ] **Step 5: Codex section** — in `CollectionScreen.tsx`, add a Duo `<StaggerItem>` (model on the Synergy section `:527-541`). Build a `DuoTile` (diverges from `SynergyTile`: always show `duo.name` + the two `SIGNAL_LABEL` chips; reveal `duo.desc` only if `seenDuos.has(id)`, else a "??? — scoprila in battaglia" line). Read `seenDuos = new Set(profile?.codex.duosSeen ?? [])`. Add the Duo count to the collection totals.

- [ ] **Step 6: Run UI tests + typecheck** (`npx vitest run tests/ui/duoBar.test.tsx tests/screens && npm run typecheck`).

- [ ] **Step 7: Commit** — `feat(duos): UI — active/near panel, discovery toast, Codex section`.

---

### Task 9: Verification — replay parity, balance smoke, Duo stress-harness

**Files:**
- Modify: `tests/engine/endlessReplayParity.test.ts` (cover Duo-active runs)
- Create: `tests/engine/duoStress.test.ts`
- Test/run: `tests/engine/campaignBalanceB.test.ts`, `tests/engine/endlessScaling.test.ts`

**Interfaces:** none new — this task proves the slice is safe.

- [ ] **Step 1: Extend replay parity** — ensure at least some of the 20 parity seeds produce a player team that lights a Duo (or add a dedicated Duo-forced seed set). Assert `replayedScore === playedScore` for Duo-active runs (MIASMA/UNTORE draws must not desync). Run: `npx vitest run tests/engine/endlessReplayParity.test.ts` → 0 mismatches.

- [ ] **Step 2: Balance smoke** — run `npx vitest run tests/engine/campaignBalanceB.test.ts tests/engine/endlessScaling.test.ts`. Expected: ~flat (bot never builds Duos). Record the numbers in the task report. A move here means an *accidental* engine regression — investigate.

- [ ] **Step 3: Write the Duo stress-harness** — `tests/engine/duoStress.test.ts`. For each of the 6 Duos, script the Duo-OPTIMAL player team (hand-picked wizards + relics that light both signals) and simulate a fixed campaign/endless slice; assert the win margin / Endless depth is **stronger than a neutral baseline but below an auto-win ceiling** (e.g. not a 100% flawless-clear across all seeds). Priority build to encode explicitly: **CANCRENA + MIASMA + Tossicità + veleno relics** (the poison-cascade case). Encode the assertion as a band, not a point.

- [ ] **Step 4: Full suite + typecheck** — `npm run test && npm run typecheck`. Expected: all green (target ≥ 1274 prior + new).

- [ ] **Step 5: Commit** — `test(duos): replay parity + balance smoke + Duo stress-harness`.

---

## Self-Review (done at plan-write time)

**Spec coverage:** ✅ Duo model (T1) · signals comp-or-relic (T1) · 6 Duos (T3–T7) · 6 primitives (bonusVsStatus=CANCRENA T3, untargetableWhile=MURO T4, executeOnStatus=ESEC-A-FREDDO T5, spreadStatusOnDeath=MIASMA T6, onHealApplyStatus=UNTORE T7, onKillStackBuff=MIETITORE T7) · auto-ignite + battle-time compute (T2 resolver) · Codex duosSeen + recipe/effect-hidden (T1, T8) · discovery toast (T8) · in-run panel active/near (T8) · player-only both modes (T2 wiring, left-only stamps) · determinism/parity (T6/T7 primitives, T9) · Duo stress-harness as the real gate (T9) · boss-guard on instakill (T5) · per-battle MIETITORE (T7). No spec section without a task.

**Placeholder scan:** No "TBD/handle edge cases"; each combat step names the exact seam (file:line) and provides the new-code body. Two deliberate "confirm the real field access" notes (T3 tick threading, T5 ctx shape) are grounded with the recon's line refs — the implementer verifies against the open file, not a guess.

**Type consistency:** `DuoSignal`/`Duo`/`ActiveDuo`/`DuoProgress` (T1) reused verbatim downstream. Stamp fields (`poisonAmp`/`livingWall`/`coldExecute`/`reaper`/`spreadsPoison`/`spitsPoisonOnHeal`) declared once in T2, consumed by matching tasks. `stampDuoFields`/`detectDuos`/`maybeSpreadPoison`/`maybeSpitPoison`/`maybeReap` signatures match their call sites.

**Cut line (if the slice runs long):** ship T1 + T2 + T3 (CANCRENA) + T4 (MURO) + T5 (ESECUZIONE A FREDDO) + T8 (UI) + T9 — one Duo per fantasy — then T6/T7 as a fast-follow. No redesign needed.
