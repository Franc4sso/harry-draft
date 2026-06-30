# Veleno From Attacks + Tossicità Generates/Amplifies — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make poison a property of ATTACKS — remove the venom Trait/shiny path, give every venom-tagged mage a guaranteed venom spell, and turn the Tossicità synergy into a generator (chance-to-poison on hit) + amplifier (poison damage multiplier).

**Architecture:** One application path for poison — spells (via `applyStatus 'veleno'`) plus a synergy-driven on-hit chance that mirrors how signatures register on the EventBus. The venom Trait is deleted (it auto-drops from `SHINY_TRAIT_IDS`, derived from `TRAITS`). `pickSpell` deterministically equips a venom spell for venom-tagged mages. `Tossicità` gains `keywordMult.veleno` (amplify, summed alongside relics in `keywordDamageMult`) and a new `registerSynergyTriggers` adds the on-hit chance. New venom attack spells are added so every venom mage's pool contains one.

**Tech Stack:** TypeScript, Vitest, deterministic seeded RNG (`game/engine/rng.ts`), EventBus reactive-hook combat (`game/engine/combat/eventBus.ts`).

## Global Constraints

- **One application path:** poison is applied by attacks only — spells (`applyStatus 'veleno'`) and the Tossicità on-hit chance (registered on the bus like signatures). No Trait, no shiny. (Spec §Modello)
- **Determinism:** only `Rng` from `game/engine/rng.ts`; no `Date.now`/`Math.random`. The `pickSpell` change is SEED-SHIFTING (restricts an existing `rng.pick` result for venom mages) but must keep the SAME number of rng draws (one `rng.pick` per mage) — only the outcome changes. Tests with seed-dependent expectations must be regenerated, not weakened. (Spec §3)
- **Symmetry:** every change applies to player AND enemies (`pickSpell`/`draftWizard` and the synergy trigger run for both sides). (Spec §Modello)
- **Status `veleno` is the accumulating DOT** (`data/statuses.ts:9`): `tickDamage 4 + tickPctMaxHp 0.005`, `stack:'accumulate', maxStacks:8`, `keywords:['veleno']`. `velenoUncapped` (Tossicità) removes the cap — unchanged. (Spec §Contesto)
- **`keywordMult` shape** = `Partial<Record<Keyword, number>>` where the value is an additive bonus (`{veleno:0.5}` = +50%); `keywordDamageMult` returns `1 + Σbonus`. (Spec §2, relics.ts:20-28)
- **Vitest does NOT typecheck.** Run `npx tsc --noEmit` separately after any `.ts` change. (memory: harry-draft-vitest-no-typecheck)
- **Balance band:** `tests/engine/campaignBalanceB.test.ts` Grifondoro winRate must stay in `[0.15, 0.45]`. Margin is already thin (0.1583). (Spec §Rischio #1, memory: harry-draft-themed-battles-margin)
- **One vitest invocation at a time** — repo saturates CPU under overlapping runs → phantom timeouts; re-run a timeout in isolation before concluding. (memory)

## File Structure

- `data/traits.ts` — **modify.** Remove the `veleno` trait object from `TRAITS` (+ orphan `POISON_CHANCE`/`POISON_DURATION`). `SHINY_TRAIT_IDS` (derived) loses it automatically.
- `data/spells.ts` — **modify.** Add 3 new venom attack spells + export a `SPELL_IS_VENOM: Set<string>` derived from spell specs.
- `data/wizards.ts` — **modify.** Ensure each of the 10 venom-tagged mages has ≥1 venom spell in its `spellPool`.
- `game/engine/statRoll.ts` — **modify.** `pickSpell` restricts to venom spells for venom-tagged mages (one `rng.pick`, restricted candidate set, defensive fallback).
- `types/synergy.ts` — **modify.** Add `keywordMult?: Partial<Record<Keyword, number>>` to `SynergyBonus`.
- `data/synergies.ts` — **modify.** Tossicità: `bonus` → `{ keywordMult: { veleno: X } }` (drop `atk:5`).
- `game/engine/relics.ts` — **modify.** `keywordDamageMult` gains a `synergies` param; sums synergy `keywordMult` alongside relic ones.
- `game/engine/synergyTriggers.ts` — **new.** `registerSynergyTriggers(bus, units, synergies, side)` — Tossicità on-hit chance-to-poison, mirroring `registerSignatures`.
- `game/engine/combat/simulate.ts` — **modify.** Call `registerSynergyTriggers`; pass synergies into the two `keywordDamageMult` calls.
- Tests: `tests/data/velenoSpells.test.ts`, `tests/engine/traitVelenoRemoved.test.ts`, `tests/engine/pickSpellVeleno.test.ts`, `tests/engine/tossicitaTrigger.test.ts`, `tests/engine/keywordMultSynergy.test.ts`.

---

## Task 1: Remove the venom Trait (and from shiny)

**Files:**
- Modify: `data/traits.ts` (remove the `veleno` trait + orphan constants)
- Test: `tests/engine/traitVelenoRemoved.test.ts` (new)

**Interfaces:**
- Consumes: existing `TRAITS`, `TRAIT_BY_ID`, `SHINY_TRAIT_IDS` exports.
- Produces: `TRAIT_BY_ID['veleno']` is `undefined`; `SHINY_TRAIT_IDS` excludes `'veleno'`. No new exports.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/traitVelenoRemoved.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { TRAIT_BY_ID, SHINY_TRAIT_IDS } from '@/data/traits'

describe('venom trait removed', () => {
  it('is no longer a trait', () => {
    expect(TRAIT_BY_ID['veleno']).toBeUndefined()
  })
  it('is no longer draftable as a shiny', () => {
    expect(SHINY_TRAIT_IDS).not.toContain('veleno')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/traitVelenoRemoved.test.ts`
Expected: FAIL — `TRAIT_BY_ID['veleno']` is currently defined, `SHINY_TRAIT_IDS` contains `'veleno'`.

- [ ] **Step 3: Remove the trait**

In `data/traits.ts`, delete the `veleno` trait object (the block `{ id: 'veleno', name: 'Veleno', ... trigger: { ... statusId: 'burn' ... } }`, around lines 113-121). Then check whether `POISON_CHANCE` and `POISON_DURATION` (defined ~lines 16-17) are referenced anywhere else in the file (`grep -n "POISON_CHANCE\|POISON_DURATION" data/traits.ts`); if they are now unused, delete those two `const` lines too. Leave `SHINY_TRAIT_IDS = TRAITS.map(t => t.id)` as-is — it now excludes `'veleno'` automatically.

- [ ] **Step 4: Run test + typecheck**

Run: `npx tsc --noEmit && npx vitest run tests/engine/traitVelenoRemoved.test.ts`
Expected: tsc clean (no unused-const error), both tests PASS.

- [ ] **Step 5: Verify shiny-legacy is inert (no crash)**

`game/engine/traits.ts:11` already has `if (!trait) continue`. Confirm by reading lines 8-12 that a `shiny.traitId` not in the catalog is skipped (a legacy save with `shiny.traitId==='veleno'` becomes inert, no crash). No code change — just confirm and note it in the report.

- [ ] **Step 6: Commit**

```bash
git add data/traits.ts tests/engine/traitVelenoRemoved.test.ts
git commit -m "feat(veleno): remove venom trait (drops from shiny pool)"
```

---

## Task 2: New venom spells + `SPELL_IS_VENOM` + pool coverage

**Files:**
- Modify: `data/spells.ts` (3 new spells + `SPELL_IS_VENOM`)
- Modify: `data/wizards.ts` (ensure each venom mage has a venom spell)
- Test: `tests/data/velenoSpells.test.ts` (new)

**Interfaces:**
- Consumes: `Spell` type (`types/spell.ts`), `SPELLS`/`SPELL_BY_ID` (`data/spells.ts`), `WIZARDS` (`data/wizards.ts`).
- Produces:
  ```ts
  export const SPELL_IS_VENOM: ReadonlySet<string>  // ids of spells whose spec applies status 'veleno'
  ```
  New spell ids: `'morsobasilisco'`, `'nubetossica'`, `'maledizioneputrida'`.

**Design notes (read before coding):**
- The existing venom spell `serpensortia` (`data/spells.ts:45`) is the template: `type:'Attacco'`, a `damage` spec + an `applyStatus 'veleno'` spec. Power calibration against existing attack spells: `diffindo` 1.3 (cd 0), `reducto` 1.8 (cd 1), `confringo` 1.9 (cd 1), `serpensortia` 1.4 (cd 1). The 3 new spells span roles/tiers so every venom mage gets a fitting one:
  - `morsobasilisco` ("Morso del Basilisco") — attacker-grade, `power 1.6`, `hitChance 0.85`, `cooldown 1`.
  - `nubetossica` ("Nube Tossica") — control/support-grade, lower direct damage `power 0.9`, `hitChance 0.9`, `cooldown 1` (the poison is the point).
  - `maledizioneputrida` ("Maledizione Putrefacente") — low-tier filler, `power 1.1`, `hitChance 0.9`, `cooldown 0`.
- All apply `{ kind: 'applyStatus', target: 'enemy', statusId: 'veleno', duration: 2 }` (same as serpensortia — no `chance` key means it always applies on a landed hit, matching serpensortia).
- Pool coverage: of the 10 venom mages, only `dolohov` currently has `serpensortia`. Add a venom spell to the other 9's `spellPool` (replace the LEAST-thematic existing spell to keep pool size constant, OR append — see Step 4; append is simpler and lower-risk, chosen here). Map by role: attackers→`morsobasilisco`, control/support→`nubetossica`, tank→`maledizioneputrida`.

- [ ] **Step 1: Write the failing test**

Create `tests/data/velenoSpells.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { SPELLS, SPELL_BY_ID, SPELL_IS_VENOM } from '@/data/spells'
import { WIZARDS } from '@/data/wizards'

describe('venom spells', () => {
  it('the new venom spells exist and apply status veleno', () => {
    for (const id of ['morsobasilisco', 'nubetossica', 'maledizioneputrida']) {
      const s = SPELL_BY_ID[id]
      expect(s, id).toBeDefined()
      const applies = (s!.spec ?? []).some(e => e.kind === 'applyStatus' && e.statusId === 'veleno')
      expect(applies, `${id} applies veleno`).toBe(true)
    }
  })
  it('SPELL_IS_VENOM contains exactly the spells whose spec applies veleno', () => {
    const expected = SPELLS.filter(s => (s.spec ?? []).some(e => e.kind === 'applyStatus' && e.statusId === 'veleno')).map(s => s.id)
    expect([...SPELL_IS_VENOM].sort()).toEqual(expected.sort())
    expect(SPELL_IS_VENOM.has('serpensortia')).toBe(true)
  })
  it('every venom-tagged wizard has >=1 venom spell in its pool', () => {
    const venomMages = WIZARDS.filter(w => (w.tags ?? []).includes('veleno'))
    expect(venomMages.length).toBeGreaterThan(0)
    for (const w of venomMages) {
      const has = w.spellPool.some(id => SPELL_IS_VENOM.has(id))
      expect(has, `${w.id} has a venom spell`).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/data/velenoSpells.test.ts`
Expected: FAIL — new spells/`SPELL_IS_VENOM` don't exist; most venom mages lack a venom spell.

- [ ] **Step 3: Add the spells + `SPELL_IS_VENOM`**

In `data/spells.ts`, add to the `SPELLS` array (near the other attack spells):

```ts
  { id: 'morsobasilisco', name: 'Morso del Basilisco', desc: 'Zanne che iniettano un veleno corrosivo.', type: 'Attacco', hitChance: 0.85, cooldown: 1, spec: [{ kind: 'damage', power: 1.6, canCrit: true, canDodge: true }, { kind: 'applyStatus', target: 'enemy', statusId: 'veleno', duration: 2 }] },
  { id: 'nubetossica', name: 'Nube Tossica', desc: 'Una nebbia velenosa che avvolge il bersaglio.', type: 'Attacco', hitChance: 0.9, cooldown: 1, spec: [{ kind: 'damage', power: 0.9, canCrit: true, canDodge: true }, { kind: 'applyStatus', target: 'enemy', statusId: 'veleno', duration: 2 }] },
  { id: 'maledizioneputrida', name: 'Maledizione Putrefacente', desc: 'Una maledizione che marcisce la carne.', type: 'Attacco', hitChance: 0.9, cooldown: 0, spec: [{ kind: 'damage', power: 1.1, canCrit: true, canDodge: true }, { kind: 'applyStatus', target: 'enemy', statusId: 'veleno', duration: 2 }] },
```

After the `SPELL_BY_ID` definition, add (derive from specs so it can never drift from the data):

```ts
export const SPELL_IS_VENOM: ReadonlySet<string> = new Set(
  SPELLS.filter(s => (s.spec ?? []).some(e => e.kind === 'applyStatus' && e.statusId === 'veleno')).map(s => s.id),
)
```

- [ ] **Step 4: Add a venom spell to each venom mage's pool**

In `data/wizards.ts`, APPEND the role-matched venom spell id to the `spellPool` of each venom mage that lacks one (dolohov already has `serpensortia` — skip). Append (don't replace) to avoid disturbing existing pool contents:

- `bellatrix` (Controllo) → add `'nubetossica'`
- `narcissa` (Supporto) → add `'nubetossica'`
- `greyback` (Tank) → add `'maledizioneputrida'`
- `slughorn` (Supporto) → add `'nubetossica'`
- `pomona`/Sprite (Tassorosso, Supporto) → add `'nubetossica'`
- `pansy` (Controllo) → add `'nubetossica'`
- `nott` (Controllo) → add `'nubetossica'`
- `blaise` (Attaccante) → add `'morsobasilisco'`
- `astoria` (Supporto) → add `'nubetossica'`

(Find each by `grep -n "id: 'bellatrix'" data/wizards.ts` etc.; the `spellPool` array is a few lines below each id. Verify the exact wizard id for "Pomona Sprite" via `grep -n "Sprite\|Pomona" data/wizards.ts` — use whatever the `id:` field actually is.)

- [ ] **Step 5: Run test + typecheck**

Run: `npx tsc --noEmit && npx vitest run tests/data/velenoSpells.test.ts`
Expected: tsc clean, all 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add data/spells.ts data/wizards.ts tests/data/velenoSpells.test.ts
git commit -m "feat(veleno): 3 new venom spells + SPELL_IS_VENOM + pool coverage for venom mages"
```

---

## Task 3: `pickSpell` guarantees a venom spell for venom mages

**Files:**
- Modify: `game/engine/statRoll.ts` (`pickSpell`)
- Test: `tests/engine/pickSpellVeleno.test.ts` (new)

**Interfaces:**
- Consumes: `SPELL_IS_VENOM` (Task 2), `Wizard`/`Spell` types, `SPELL_BY_ID`, `Rng`.
- Produces: `pickSpell(rng, wizard)` — unchanged signature; for a venom-tagged wizard returns a venom spell (deterministic), else unchanged behavior.

**Determinism (critical):** `pickSpell` calls `rng.pick(...)` exactly once today. Keep it exactly once — restrict the CANDIDATE array for venom mages, but still make a single `rng.pick`. This shifts the OUTCOME (a venom mage now picks from a smaller set) → seed drift on any test that asserts a venom mage's drafted spell or a team composition containing one. Regenerate those expectations; do NOT add/remove a draw.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/pickSpellVeleno.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { pickSpell } from '@/game/engine/statRoll'
import { SPELL_IS_VENOM } from '@/data/spells'
import { WIZARDS } from '@/data/wizards'
import { createRng } from '@/game/engine/rng'

const venomMage = WIZARDS.find(w => (w.tags ?? []).includes('veleno'))!
const plainMage = WIZARDS.find(w => !(w.tags ?? []).includes('veleno'))!

describe('pickSpell venom guarantee', () => {
  it('a venom mage always gets a venom spell, across many seeds', () => {
    for (let i = 0; i < 50; i++) {
      const spell = pickSpell(createRng(`s${i}`), venomMage)
      expect(SPELL_IS_VENOM.has(spell.id), `seed ${i} → ${spell.id}`).toBe(true)
    }
  })
  it('a non-venom mage picks from its normal pool', () => {
    const spell = pickSpell(createRng('x'), plainMage)
    expect(plainMage.spellPool).toContain(spell.id)
  })
  it('is deterministic for a given seed', () => {
    expect(pickSpell(createRng('k'), venomMage).id).toBe(pickSpell(createRng('k'), venomMage).id)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/pickSpellVeleno.test.ts`
Expected: FAIL — a venom mage currently picks from the full pool, so some seeds yield a non-venom spell.

- [ ] **Step 3: Restrict the candidate set in `pickSpell`**

In `game/engine/statRoll.ts`, add the import and update `pickSpell` (lines 21-26):

```ts
import { SPELL_BY_ID, SPELL_IS_VENOM } from '@/data/spells'  // extend the existing SPELL_BY_ID import
```

```ts
export function pickSpell(rng: Rng, wizard: Wizard): Spell {
  // Venom-tagged mages always enter battle with a venom spell equipped. Restrict the
  // candidate set BEFORE the single rng.pick — one draw, restricted outcome (keeps the
  // rng-draw count identical for every caller). Defensive fallback to the full pool if a
  // venom mage's pool somehow has no venom spell (a data test guards against this).
  const venom = (wizard.tags ?? []).includes('veleno')
    ? wizard.spellPool.filter(id => SPELL_IS_VENOM.has(id))
    : null
  const candidates = venom && venom.length > 0 ? venom : wizard.spellPool
  const id = rng.pick(candidates)
  const spell = SPELL_BY_ID[id]
  if (!spell) throw new Error(`unknown spell ${id} for ${wizard.id}`)
  return spell
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx tsc --noEmit && npx vitest run tests/engine/pickSpellVeleno.test.ts`
Expected: tsc clean, all 3 tests PASS.

- [ ] **Step 5: Absorb seed drift in dependent suites**

The restricted pick changes drafted spells for venom mages → seed-dependent expectations shift. Run the suites most likely affected (ONE invocation):

Run: `npx vitest run tests/engine/combatResolver.test.ts tests/engine/campaignBalanceB.test.ts tests/engine/serpeverdeBalance.test.ts tests/engine/velenoSweep.test.ts tests/engine/velenoSynergy.test.ts`

For each failure, inspect whether it's a legitimate expectation shift (a venom mage now equips a venom spell) — if so, regenerate the expected value from the new actual (do NOT weaken an assertion to hide a real regression). campaignBalanceB band changes are handled in Task 6, not here — if ONLY campaignBalanceB's winRate assertion fails (band), note it and leave it for Task 6; fix any non-balance assertion failures here.

- [ ] **Step 6: Commit**

```bash
git add game/engine/statRoll.ts tests/engine/pickSpellVeleno.test.ts tests/  # include any regenerated expectations
git commit -m "feat(veleno): pickSpell guarantees a venom spell for venom-tagged mages"
```

---

## Task 4: `SynergyBonus.keywordMult` + Tossicità amplifies (keywordDamageMult sums synergies)

**Files:**
- Modify: `types/synergy.ts` (`SynergyBonus.keywordMult`)
- Modify: `data/synergies.ts` (Tossicità bonus)
- Modify: `game/engine/relics.ts` (`keywordDamageMult` signature)
- Modify: `game/engine/combat/simulate.ts` (pass synergies to the two calls)
- Test: `tests/engine/keywordMultSynergy.test.ts` (new)

**Interfaces:**
- Consumes: `Keyword` type, `ActiveSynergy`, existing `keywordDamageMult`.
- Produces:
  ```ts
  // types/synergy.ts — SynergyBonus gains:
  keywordMult?: Partial<Record<Keyword, number>>
  // game/engine/relics.ts — new signature (synergies added before keyword):
  keywordDamageMult(team: DraftedWizard[], relics: ActiveRelic[], synergies: ActiveSynergy[], keyword: Keyword): number
  ```

- [ ] **Step 1: Write the failing test**

Create `tests/engine/keywordMultSynergy.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { keywordDamageMult } from '@/game/engine/relics'
import { SYNERGIES } from '@/data/synergies'

const tossicita = SYNERGIES.find(s => s.id === 'tossicita')!

describe('keywordDamageMult sums synergy keywordMult', () => {
  it('Tossicità contributes a veleno multiplier', () => {
    const active = [{ synergy: tossicita, memberIds: [] }]
    const mult = keywordDamageMult([], [], active, 'veleno')
    expect(mult).toBeGreaterThan(1) // 1 + tossicita.bonus.keywordMult.veleno
  })
  it('no synergy → mult 1', () => {
    expect(keywordDamageMult([], [], [], 'veleno')).toBe(1)
  })
  it('Tossicità exposes keywordMult.veleno and no longer grants atk', () => {
    expect(tossicita.bonus.keywordMult?.veleno).toBeGreaterThan(0)
    expect(tossicita.bonus.atk ?? 0).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/keywordMultSynergy.test.ts`
Expected: FAIL — `keywordDamageMult` has no `synergies` param (arity/type error); Tossicità still has `atk:5` and no `keywordMult`.

- [ ] **Step 3: Add the type + update Tossicità data**

In `types/synergy.ts`, add `Keyword` import and extend `SynergyBonus`:

```ts
import type { Keyword } from './keyword'
```
```ts
export type SynergyBonus = Partial<Record<Stat, number>> & {
  allPct?: number
  regen?: number
  keywordMult?: Partial<Record<Keyword, number>>
}
```

In `data/synergies.ts`, change the Tossicità entry (line 35) from `bonus: { atk: 5 }` to:

```ts
  { id: 'tossicita', name: 'Tossicità', kind: 'origin', requires: { tag: 'veleno', count: 3 }, bonus: { keywordMult: { veleno: 0.5 } } },
```

- [ ] **Step 4: Extend `keywordDamageMult`**

In `game/engine/relics.ts`, update the function (lines 20-28) and its imports (`ActiveSynergy` from `@/types`):

```ts
export function keywordDamageMult(
  team: DraftedWizard[], relics: ActiveRelic[], synergies: ActiveSynergy[], keyword: Keyword,
): number {
  let mult = 1
  for (const { relic } of relics) {
    if (!relic.keywordMult) continue
    if (!relicMatchesCondition(team, relic.condition)) continue
    mult += relic.keywordMult[keyword] ?? 0
  }
  for (const { synergy } of synergies) {
    mult += synergy.bonus.keywordMult?.[keyword] ?? 0
  }
  return mult
}
```

- [ ] **Step 5: Update the call sites in simulate.ts**

In `game/engine/combat/simulate.ts` lines 106-107, pass the side's active synergies (`leftSyn`/`rightSyn`, already in scope — lines 61-62):

```ts
  const leftVelenoMult = keywordDamageMult(left, leftRelics, leftSyn, 'veleno')
  const rightVelenoMult = keywordDamageMult(right, rightRelics, rightSyn, 'veleno')
```

- [ ] **Step 6: Run test + typecheck**

Run: `npx tsc --noEmit && npx vitest run tests/engine/keywordMultSynergy.test.ts`
Expected: tsc clean (every `keywordDamageMult` caller updated), 3 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add types/synergy.ts data/synergies.ts game/engine/relics.ts game/engine/combat/simulate.ts tests/engine/keywordMultSynergy.test.ts
git commit -m "feat(veleno): Tossicità amplifies poison via keywordMult (summed in keywordDamageMult)"
```

---

## Task 5: Tossicità generates poison — `registerSynergyTriggers`

**Files:**
- Create: `game/engine/synergyTriggers.ts`
- Modify: `game/engine/combat/simulate.ts` (call it)
- Modify: `data/constants.ts` (`TOSSICITA_HIT_CHANCE` — or inline const in synergyTriggers)
- Test: `tests/engine/tossicitaTrigger.test.ts` (new)

**Interfaces:**
- Consumes: `EventBus`, `BattleUnit`, `ActiveSynergy`, `Side`.
- Produces:
  ```ts
  export function registerSynergyTriggers(
    bus: EventBus, units: BattleUnit[], synergies: ActiveSynergy[], side: Side,
  ): void
  ```

**Design (mirror `registerSignatures`):** `registerSignatures` (`game/engine/signatures.ts:5-21`) registers, per unit, a `bus.onReactive(t.hook, ctx => ownerOf(ctx)===u ? effects : [])`. The engine's reactive path applies the returned `EffectSpec[]` (including the `applyStatus` `chance` roll) with its own rng — so adding effects through this path introduces NO new rng pathway of our own; it uses the same machinery as signatures/relics. `registerSynergyTriggers` does the same: if Tossicità is active for `side`, each unit on that side registers an `onHit` reactive returning the poison `applyStatus` spec gated to `ctx.actor === u`.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/tossicitaTrigger.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { registerSynergyTriggers, TOSSICITA_HIT_CHANCE } from '@/game/engine/synergyTriggers'
import { createEventBus } from '@/game/engine/combat/eventBus'
import { SYNERGIES } from '@/data/synergies'
import type { BattleUnit } from '@/types'

const tossicita = SYNERGIES.find(s => s.id === 'tossicita')!
const unit = (id: string): BattleUnit => ({
  // minimal BattleUnit: only fields the trigger reads (wizard.id, side, alive)
  wizard: { id, name: id, house: 'Serpeverde', role: 'Attaccante', tier: 4, gender: 'm', ranges: { hp: [1,1], atk: [1,1], def: [1,1], spd: [1,1] }, spellPool: [] },
  stats: { hp: 10, atk: 1, def: 1, spd: 1 }, maxHp: 10, spell: { id: 'x', name: 'x', desc: '', type: 'Attacco', hitChance: 1 },
  side: 'left', cooldowns: {}, statusEffects: [], alive: true,
} as unknown as BattleUnit)

describe('registerSynergyTriggers — Tossicità on-hit poison', () => {
  it('registers an onHit reactive that poisons the enemy when Tossicità is active', () => {
    const bus = createEventBus()
    const u = unit('blaise')
    registerSynergyTriggers(bus, [u], [{ synergy: tossicita, memberIds: ['blaise'] }], 'left')
    const specs = bus.collectReactive('onHit', { turn: 1, actor: u, side: 'left', flags: [] } as any)
    const poison = specs.find(s => s.kind === 'applyStatus' && s.statusId === 'veleno')
    expect(poison).toBeDefined()
    expect((poison as any).chance).toBe(TOSSICITA_HIT_CHANCE)
    expect((poison as any).target).toBe('enemy')
  })
  it('registers nothing when Tossicità is not active', () => {
    const bus = createEventBus()
    const u = unit('blaise')
    registerSynergyTriggers(bus, [u], [], 'left')
    const specs = bus.collectReactive('onHit', { turn: 1, actor: u, side: 'left', flags: [] } as any)
    expect(specs.find(s => s.kind === 'applyStatus' && s.statusId === 'veleno')).toBeUndefined()
  })
  it('only fires for the actor that owns the trigger, on its own side', () => {
    const bus = createEventBus()
    const u = unit('blaise'); const other = unit('nott')
    registerSynergyTriggers(bus, [u], [{ synergy: tossicita, memberIds: ['blaise'] }], 'left')
    // a hit whose actor is a DIFFERENT unit → no poison from u's listener
    const specs = bus.collectReactive('onHit', { turn: 1, actor: other, side: 'left', flags: [] } as any)
    expect(specs.find(s => s.kind === 'applyStatus' && s.statusId === 'veleno')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/tossicitaTrigger.test.ts`
Expected: FAIL — `@/game/engine/synergyTriggers` does not exist.

- [ ] **Step 3: Write `registerSynergyTriggers`**

Create `game/engine/synergyTriggers.ts`:

```ts
import type { ActiveSynergy, BattleUnit, EffectSpec, Side } from '@/types'
import type { EventBus } from './combat/eventBus'

/** Per-hit chance for a Tossicità member to apply poison with a normal strike.
 *  Balance lever (Task 6 / spec Rischio #1). */
export const TOSSICITA_HIT_CHANCE = 0.35

/** Synergy-driven combat triggers, mirroring registerSignatures/registerRelicTriggers.
 *  Currently: Tossicità gives every member of its side an on-hit chance to poison the
 *  target (generates poison so the synergy pays off even without a venom spell equipped).
 *  Gated to the actor that owns the listener AND to `side`. */
export function registerSynergyTriggers(
  bus: EventBus, units: BattleUnit[], synergies: ActiveSynergy[], side: Side,
): void {
  const tossicita = synergies.some(s => s.synergy.id === 'tossicita')
  if (!tossicita) return
  for (const u of units) {
    bus.onReactive('onHit', (ctx): EffectSpec[] =>
      ctx.side === side && ctx.actor === u
        ? [{ kind: 'applyStatus', target: 'enemy', statusId: 'veleno', chance: TOSSICITA_HIT_CHANCE, duration: 2 }]
        : [],
    )
  }
}
```

- [ ] **Step 4: Wire it into simulate.ts**

In `game/engine/combat/simulate.ts`, add the import and register both sides next to the existing trigger registrations (after line 102 `registerSignatures(...)`):

```ts
import { registerSynergyTriggers } from '../synergyTriggers'
```
```ts
  registerSynergyTriggers(bus, L, leftSyn, 'left')
  registerSynergyTriggers(bus, R, rightSyn, 'right')
```

- [ ] **Step 5: Run test + typecheck**

Run: `npx tsc --noEmit && npx vitest run tests/engine/tossicitaTrigger.test.ts`
Expected: tsc clean, 3 tests PASS.

- [ ] **Step 6: Integration check — poison actually lands in a real battle**

Run the existing venom integration suites (ONE invocation) to confirm the synergy path composes with the engine and nothing regressed structurally (balance is Task 6):

Run: `npx vitest run tests/engine/velenoSynergy.test.ts tests/engine/velenoSweep.test.ts tests/engine/combat/simulate.test.ts`
Expected: PASS, or only seed-shift/balance differences (regenerate non-balance expectations; leave winRate-band assertions for Task 6).

- [ ] **Step 7: Commit**

```bash
git add game/engine/synergyTriggers.ts game/engine/combat/simulate.ts tests/engine/tossicitaTrigger.test.ts
git commit -m "feat(veleno): Tossicità generates poison via on-hit chance (registerSynergyTriggers)"
```

---

## Task 6: Balance — re-tune to keep winRate in band (PRIMARY RISK)

**Files:**
- Modify: `game/engine/synergyTriggers.ts` (`TOSSICITA_HIT_CHANCE`), `data/synergies.ts` (`keywordMult.veleno`), and/or `data/statuses.ts` (veleno `tickDamage`/`tickPctMaxHp`), and/or `data/constants.ts` (`themes.nodeMult` for the veleno theme) — as measurement dictates.
- Test: `tests/engine/campaignBalanceB.test.ts` (gate; do not weaken).

**Spec §Rischio #1:** poison power is added on several axes (guaranteed venom spells, on-hit chance, damage multiplier) atop a thin margin (0.1583) and themed-venom enemies that now ALSO activate Tossicità. Expect a meaningful winRate drop. Removing `atk:5` from Tossicità pushes the other way (slightly easier) and partially compensates.

- [ ] **Step 1: Absorb any remaining seed drift, then measure**

Run: `npx vitest run tests/engine/campaignBalanceB.test.ts`
Record the reported Grifondoro winRate. If the test fails on a NON-band assertion (a structural expectation shifted by the draft change), fix that first (regenerate). Then read the winRate.

- [ ] **Step 2: If winRate < 0.15 (too hard), lower the levers in order**

Re-measure after EACH change (one vitest invocation each):
1. `TOSSICITA_HIT_CHANCE` (synergyTriggers.ts): 0.35 → 0.25 → 0.15. Fewer procs.
2. `keywordMult.veleno` of Tossicità (synergies.ts): 0.5 → 0.3. Less amplification.
3. veleno `tickDamage`/`tickPctMaxHp` (statuses.ts): only if 1-2 insufficient — affects ALL poison (player too), so move last.
4. `themes.nodeMult` for venom-heavy themes (constants.ts): the enemy-side driver. (If a per-theme nodeMult doesn't exist, lowering the global `themes.nodeMult.normal` reduces enemy theme cohesion broadly — note the trade-off.)

- [ ] **Step 3: If winRate > 0.45 (too easy), raise lever 1 or 2**

Unlikely (poison adds enemy power), but if the `atk:5` removal over-compensated, raise `TOSSICITA_HIT_CHANCE` or `keywordMult.veleno`.

- [ ] **Step 4: Document the calibration**

Add a comment above `TOSSICITA_HIT_CHANCE` (synergyTriggers.ts) and/or the Tossicità entry (synergies.ts) recording the final values + measured winRate, mirroring the `campaignB`/`themes` calibration-log style in `data/constants.ts`.

- [ ] **Step 5: Full suite + typecheck**

Run: `npx tsc --noEmit` then `npx vitest run` (ONE invocation, let it finish — ~2-5 min, ~820+ tests).
Expected: tsc clean; full suite green. Re-run any timeout failure in ISOLATION to confirm it's a load flake, not logic. Report the real pass count.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "balance(veleno): tune poison levers to keep winRate in [0.15,0.45]"
```

---

## Task 7: Backlog doc

**Files:**
- Modify: `docs/superpowers/specs/2026-06-30-tag-veleno-applica-veleno-design.md` (closing note).

- [ ] **Step 1: Record the shipped state**

Append a "## Stato finale (implementato)" section: trait removed (+ shiny-legacy inert), the 3 new venom spells + which mages got them, the draft guarantee, Tossicità's new behavior (generate `TOSSICITA_HIT_CHANCE` + amplify `keywordMult.veleno`), the final balance levers + measured winRate, and that poison remains "stacca-e-aspetti" (tactical depth = future slice, per the design's YAGNI note).

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-30-tag-veleno-applica-veleno-design.md
git commit -m "docs(veleno): close slice — record shipped poison model + balance"
```

---

## Self-Review Notes (spec coverage)

- §1 Remove trait + shiny → Task 1. ✅
- §2 Ampliare pool + garanzia distribuzione → Task 2 (3 spells, SPELL_IS_VENOM, pool coverage). ✅
- §3 Draft garantisce spell-veleno (1 draw, esito ristretto, seed-shift) → Task 3. ✅
- §4 Tossicità keywordMult amplify (keywordDamageMult sums synergies) → Task 4. ✅
- §4 Tossicità on-hit generate via registerSynergyTriggers (new, mirrors registerSignatures, gated side+actor) → Task 5. ✅
- §Rischio #1 balance (lever order, seed-drift absorbed first) → Task 6. ✅
- §Contesto velenoUncapped unchanged → untouched (verified, no task needed). ✅
- §Non in scope: signatures stay burn, no new relics, no tactical depth, no save migration → respected. ✅
- Type consistency: `SPELL_IS_VENOM` (Task 2) used in Task 3; `keywordMult` field (Task 4) read by `keywordDamageMult` (Task 4) and set in synergies (Task 4); `registerSynergyTriggers(bus, units, synergies, side)` (Task 5) matches its simulate.ts call; `TOSSICITA_HIT_CHANCE` exported (Task 5) and tuned (Task 6). ✅
