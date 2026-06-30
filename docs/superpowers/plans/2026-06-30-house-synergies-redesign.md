# House Synergies Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four flat-stat house synergies with characterful per-unit mechanics — Grifondoro extra dodge, Corvonero boosted crits, Tassorosso shared/reduced damage, Serpeverde +damage to wounded (replacing flat +atk) — fixing the Serpeverde imbalance at its root and giving each house an identity.

**Architecture:** A pure `houseEffects(team, synergies)` returns a per-wizard map of the four effects; `toBattleUnits` stamps each unit with its house's effect (like execute/darkMagic/shieldConvert). The combat hooks read those stamped fields at the existing dodge/crit/damage sites in `effects.ts`. The house synergies in `data/synergies.ts` keep a `family` for tiering but their mechanic lives in `houseEffects` keyed on house (like spietatezza/oscurita/bastione are keyed on id).

**Tech Stack:** TypeScript, Vitest, the combat engine (`game/engine/combat/`), `@/`-aliased imports.

## Global Constraints

- **Four distinct mechanics, one per house** (no overlap): Grifondoro=dodge, Corvonero=crit, Tassorosso=damage-reduction, Serpeverde=cunning(+dmg to wounded). These REPLACE the flat stat bonuses (slytherin's +atk is removed — that's the imbalance root).
- **Per-unit, off-by-default:** every effect is a stamped optional field on `BattleUnit`; when absent the combat path is bit-identical to today. A unit gets its effect only if its house's synergy is active (count met).
- **Tiered 2/3/4:** each house synergy scales across the three member-count tiers, like today.
- **Tassorosso keeps regen:** the loyalty house stays the support house — regen (existing) PLUS damage-reduction.
- **Determinism caveat (accepted):** dodge/crit modify the chance at the EXISTING rng draw (no new draw → rng sequence unchanged, only the chance outcome shifts); cunning/damage-reduction modify damage (no rng). So seeded BATTLES change outcomes (more dodges/crits/etc.) — this is an intended balance change. Seed-pinned balance-outcome tests get updated; never mask a real bug.
- **Balance goal:** the four houses' competent-starter win rates land in a tight spread; campaignBalanceB (Grifondoro) STAYS in [0.15, 0.45]. Serpeverde drops from ~0.775 (loses unconditional +atk). Tune empirically.
- **Do NOT** nerf Voldemort/wizard stats, touch role/tag synergies, or add persistent statuses.
- Tests: `npx vitest run <path>`. Typecheck: `npx tsc --noEmit`.

---

### Task 1: Types — the four per-unit house-effect fields

**Files:**
- Modify: `types/combat.ts` (BattleUnit: add the four optional fields)

**Interfaces:**
- Produces: `BattleUnit.dodgeBonus?: number`; `BattleUnit.critBonus?: { chance: number; mult: number }`; `BattleUnit.damageReduction?: number`; `BattleUnit.cunning?: { threshold: number; bonus: number }`.

- [ ] **Step 1: Add the fields**

In `types/combat.ts`, after the existing `darkMagic?: ...` field on `BattleUnit`, add:
```ts
  /** Grifondoro house (courage): extra dodge chance added in `dodged()` when this unit is attacked. */
  dodgeBonus?: number
  /** Corvonero house (intelligence): added crit chance + added crit multiplier in `computeDamage`. */
  critBonus?: { chance: number; mult: number }
  /** Tassorosso house (loyalty): fraction of incoming damage reduced when this unit is the target. */
  damageReduction?: number
  /** Serpeverde house (cunning): +`bonus` damage dealt to a target below `threshold` HP fraction. */
  cunning?: { threshold: number; bonus: number }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (optional fields, no consumer yet).

- [ ] **Step 3: Commit**

```bash
git add types/combat.ts
git commit -m "feat(houses): per-unit house-effect fields (dodgeBonus/critBonus/damageReduction/cunning)"
```

---

### Task 2: `houseEffects` pure helper

**Files:**
- Create: `game/engine/houseEffects.ts`
- Test: `tests/engine/houseEffects.test.ts`

**Interfaces:**
- Consumes: `ActiveSynergy[]`, `DraftedWizard[]`, the four field shapes (Task 1).
- Produces: `houseEffects(team, synergies): Record<string, { dodgeBonus?: number; critBonus?: {chance,mult}; damageReduction?: number; cunning?: {threshold,bonus} }>` — keyed by wizardId, each wizard gets its OWN house's effect (if that house's synergy is active).

- [ ] **Step 1: Write the failing test**

Create `tests/engine/houseEffects.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { houseEffects } from '@/game/engine/houseEffects'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { ActiveSynergy, DraftedWizard, Stats } from '@/types'

const mk = (id: string, stats: Stats): DraftedWizard => ({ wizard: WIZARDS.find(w => w.id === id)!, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! })
const S: Stats = { hp: 100, atk: 10, def: 10, spd: 10 }
const syn = (id: string, family: string): ActiveSynergy => ({ synergy: { id, name: id, kind: 'house', family, requires: {}, bonus: {} }, memberIds: [] })

// Find real wizards per house to build house-active teams.
const gryff = WIZARDS.find(w => w.house === 'Grifondoro')!.id
const raven = WIZARDS.find(w => w.house === 'Corvonero')!.id
const huff = WIZARDS.find(w => w.house === 'Tassorosso')!.id
const slyth = WIZARDS.find(w => w.house === 'Serpeverde')!.id

describe('houseEffects', () => {
  it('no house synergy → empty', () => {
    expect(houseEffects([mk(gryff, S)], [])).toEqual({})
  })
  it('Grifondoro active → its members get dodgeBonus', () => {
    const m = houseEffects([mk(gryff, S)], [syn('gryffindor2', 'house:Grifondoro')])
    expect(m[gryff]?.dodgeBonus).toBeGreaterThan(0)
  })
  it('Corvonero active → critBonus', () => {
    const m = houseEffects([mk(raven, S)], [syn('ravenclaw2', 'house:Corvonero')])
    expect(m[raven]?.critBonus?.chance).toBeGreaterThan(0)
    expect(m[raven]?.critBonus?.mult).toBeGreaterThan(0)
  })
  it('Tassorosso active → damageReduction', () => {
    const m = houseEffects([mk(huff, S)], [syn('hufflepuff2', 'house:Tassorosso')])
    expect(m[huff]?.damageReduction).toBeGreaterThan(0)
  })
  it('Serpeverde active → cunning', () => {
    const m = houseEffects([mk(slyth, S)], [syn('slytherin2', 'house:Serpeverde')])
    expect(m[slyth]?.cunning?.bonus).toBeGreaterThan(0)
    expect(m[slyth]?.cunning?.threshold).toBeGreaterThan(0)
  })
  it('tiers scale: 4-member synergy gives a bigger dodge than 2-member', () => {
    const lo = houseEffects([mk(gryff, S)], [syn('gryffindor2', 'house:Grifondoro')])
    const hi = houseEffects([mk(gryff, S)], [syn('gryffindor4', 'house:Grifondoro')])
    expect(hi[gryff]!.dodgeBonus!).toBeGreaterThan(lo[gryff]!.dodgeBonus!)
  })
  it('each wizard gets ONLY its own house effect (mixed team)', () => {
    const m = houseEffects(
      [mk(gryff, S), mk(slyth, S)],
      [syn('gryffindor2', 'house:Grifondoro'), syn('slytherin2', 'house:Serpeverde')],
    )
    expect(m[gryff]?.dodgeBonus).toBeGreaterThan(0)
    expect(m[gryff]?.cunning).toBeUndefined()
    expect(m[slyth]?.cunning?.bonus).toBeGreaterThan(0)
    expect(m[slyth]?.dodgeBonus).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/houseEffects.test.ts`
Expected: FAIL — `houseEffects` not exported.

- [ ] **Step 3: Write the implementation**

Create `game/engine/houseEffects.ts`. Map each house's active-synergy TIER (by family) to its effect, then assign each wizard its own house's effect. The tier is read from the active synergy's id suffix (2/3/4).
```ts
import type { ActiveSynergy, DraftedWizard, House } from '@/types'

type Effect = { dodgeBonus?: number; critBonus?: { chance: number; mult: number }; damageReduction?: number; cunning?: { threshold: number; bonus: number } }

// Tier index 0/1/2 for 2/3/4 members. Values tuned in Task 6 (balance) — these are starting points.
const TIER = (familyId: string): 0 | 1 | 2 | -1 =>
  familyId.endsWith('2') ? 0 : familyId.endsWith('3') ? 1 : familyId.endsWith('4') ? 2 : -1

const GRYFF_DODGE = [0.04, 0.08, 0.14]
const RAVEN_CRIT = [{ chance: 0.06, mult: 0.2 }, { chance: 0.10, mult: 0.35 }, { chance: 0.16, mult: 0.5 }]
const HUFF_REDUCE = [0.08, 0.15, 0.22]
const SLYTH_CUNNING = [{ threshold: 0.5, bonus: 0.15 }, { threshold: 0.5, bonus: 0.25 }, { threshold: 0.5, bonus: 0.4 }]

/** Per-wizard house mechanic. Each wizard receives its OWN house's effect iff that house's
 *  synergy is active, at the active tier (2/3/4 members). Pure; no RNG. */
export function houseEffects(team: DraftedWizard[], synergies: ActiveSynergy[]): Record<string, Effect> {
  // Active tier per house (from the house-family synergy present, if any).
  const tierOf: Partial<Record<House, 0 | 1 | 2>> = {}
  for (const a of synergies) {
    if (a.synergy.kind !== 'house') continue
    const t = TIER(a.synergy.id)
    if (t < 0) continue
    const house = a.synergy.requires.house ?? houseFromFamily(a.synergy.family)
    if (house) tierOf[house] = t as 0 | 1 | 2
  }
  const map: Record<string, Effect> = {}
  for (const dw of team) {
    const t = tierOf[dw.wizard.house]
    if (t === undefined) continue
    map[dw.wizard.id] = effectFor(dw.wizard.house, t)
  }
  return map
}

function houseFromFamily(family?: string): House | undefined {
  if (!family?.startsWith('house:')) return undefined
  return family.slice('house:'.length) as House
}

function effectFor(house: House, t: 0 | 1 | 2): Effect {
  switch (house) {
    case 'Grifondoro': return { dodgeBonus: GRYFF_DODGE[t] }
    case 'Corvonero': return { critBonus: RAVEN_CRIT[t] }
    case 'Tassorosso': return { damageReduction: HUFF_REDUCE[t] }
    case 'Serpeverde': return { cunning: SLYTH_CUNNING[t] }
  }
}
```
(Confirm `requires.house` is set on the house synergies in `data/synergies.ts` — it is, e.g. `requires: { house: 'Grifondoro', count: 2 }`. The `houseFromFamily` fallback is belt-and-suspenders.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/houseEffects.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add game/engine/houseEffects.ts tests/engine/houseEffects.test.ts
git commit -m "feat(houses): houseEffects per-wizard helper (dodge/crit/reduce/cunning by house+tier)"
```

---

### Task 3: Stamp the house effects in `toBattleUnits`

**Files:**
- Modify: `game/engine/combat/simulate.ts:18-42` (`toBattleUnits`)
- Test: `tests/engine/houseEffectsStamp.test.ts`

**Interfaces:**
- Consumes: `houseEffects` (Task 2).
- Produces: each `BattleUnit` carries its house effect fields (or none).

- [ ] **Step 1: Write the failing test**

Create `tests/engine/houseEffectsStamp.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { toBattleUnits } from '@/game/engine/combat/simulate'
import { detectSynergies } from '@/game/engine/synergy'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { DraftedWizard, Stats } from '@/types'

const mk = (id: string, stats: Stats): DraftedWizard => ({ wizard: WIZARDS.find(w => w.id === id)!, stats, maxHp: stats.hp, spell: SPELL_BY_ID['base_attack']! })
const S: Stats = { hp: 100, atk: 10, def: 10, spd: 10 }
// Three Grifondoro to trigger gryffindor3.
const gryffs = WIZARDS.filter(w => w.house === 'Grifondoro').slice(0, 3).map(w => w.id)

describe('toBattleUnits stamps house effects', () => {
  it('no synergy → no house fields', () => {
    const units = toBattleUnits([mk(gryffs[0]!, S)], 'left', [], [])
    expect(units[0]!.dodgeBonus).toBeUndefined()
  })
  it('Grifondoro trio → each unit has dodgeBonus', () => {
    const team = gryffs.map(id => mk(id, S))
    const units = toBattleUnits(team, 'left', detectSynergies(team), [])
    expect(units.every(u => (u.dodgeBonus ?? 0) > 0)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/houseEffectsStamp.test.ts`
Expected: FAIL — `dodgeBonus` undefined even with the trio.

- [ ] **Step 3: Implement the stamp**

In `game/engine/combat/simulate.ts`, add the import near `teamDarkMagic`:
```ts
import { houseEffects } from '../houseEffects'
```
Inside `toBattleUnits`, after `const darkMap = teamDarkMagic(team, relics, synergies)`:
```ts
  const houseMap = houseEffects(team, synergies)
```
In the returned object literal's trailing property line (where execute/shieldConvert/darkMagic are added), spread the unit's house effect:
```ts
      cooldowns: {}, statusEffects: [], alive: true, velenoUncapped, execute, shieldConvert, darkMagic: darkMap[dw.wizard.id], ...houseMap[dw.wizard.id],
```
(The spread adds dodgeBonus/critBonus/damageReduction/cunning when present, nothing when the wizard's house isn't active.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/houseEffectsStamp.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Determinism gate — full suite**

Run: `npx vitest run`
Expected: NO existing test regressed YET (the stamp adds fields but no combat hook reads them until Task 4; existing battles are unchanged). `npx tsc --noEmit` PASS. relicBalance.test.ts ~7-30s expected.

- [ ] **Step 6: Commit**

```bash
git add game/engine/combat/simulate.ts tests/engine/houseEffectsStamp.test.ts
git commit -m "feat(houses): stamp house effects on battle units in toBattleUnits"
```

---

### Task 4: Combat hooks — dodge, crit, damage-reduction, cunning

**Files:**
- Modify: `game/engine/combat/effects.ts` (`dodged`, `computeDamage`, the attack handler)
- Test: `tests/engine/houseCombat.test.ts`

**Interfaces:**
- Consumes: the four stamped fields (Task 3).
- Produces: the four mechanics fire in combat when the fields are present.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/houseCombat.test.ts`. Drive `resolveAction` (or `computeDamage`/`dodged` directly) with units carrying the fields; assert each mechanic.
```ts
import { describe, it, expect } from 'vitest'
import { dodged, computeDamage } from '@/game/engine/combat/effects'
import { resolveAction } from '@/game/engine/combat/resolve'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { BattleUnit, Spell } from '@/types'

function unit(id: string, hp: number, opts: Partial<BattleUnit> = {}): BattleUnit {
  const wizard = WIZARDS.find(w => w.id === id)!
  return { wizard, spell: SPELL_BY_ID['base_attack']!, stats: { hp, atk: 40, def: 10, spd: 10 },
    maxHp: hp, side: 'left', buffedStats: { hp, atk: 40, def: 10, spd: 10 }, hp,
    cooldowns: {}, statusEffects: [], alive: true, ...opts } as unknown as BattleUnit
}
const atkSpell: Spell = { id: 'a', name: 'A', desc: '', type: 'Attacco', power: 2, hitChance: 1 }

describe('house combat mechanics', () => {
  it('Grifondoro dodgeBonus raises dodge frequency', () => {
    // Over many seeds, a target with dodgeBonus dodges more often than one without.
    let withBonus = 0, without = 0
    for (let i = 0; i < 300; i++) {
      const rng1 = createRng('d' + i), rng2 = createRng('d' + i)
      const attacker = unit('harry', 200, { side: 'left' })
      const tgtA = unit('hermione', 200, { side: 'right', dodgeBonus: 0.5 })
      const tgtB = unit('hermione', 200, { side: 'right' })
      if (dodged(rng1, attacker, tgtA)) withBonus++
      if (dodged(rng2, attacker, tgtB)) without++
    }
    expect(withBonus).toBeGreaterThan(without)
  })
  it('Corvonero critBonus raises crit damage (more first-hit damage over seeds)', () => {
    // A caster with critBonus deals >= damage on average; assert at least one seed crits bigger.
    const target = () => unit('harry', 1000, { side: 'right' })
    let bonusMax = 0, plainMax = 0
    for (let i = 0; i < 200; i++) {
      const flagsA: any[] = [], flagsB: any[] = []
      const caster = unit('luna', 200, { side: 'left', critBonus: { chance: 1, mult: 1 } }) // always crit, +1 mult
      const plain = unit('luna', 200, { side: 'left' })
      bonusMax = Math.max(bonusMax, computeDamage(createRng('c' + i), caster, target(), 2, flagsA))
      plainMax = Math.max(plainMax, computeDamage(createRng('c' + i), plain, target(), 2, flagsB))
    }
    expect(bonusMax).toBeGreaterThan(plainMax)
  })
  it('Tassorosso damageReduction lowers damage taken', () => {
    const caster = unit('harry', 200, { side: 'left' })
    const tough = unit('cedric', 1000, { side: 'right', damageReduction: 0.5 })
    const soft = unit('cedric', 1000, { side: 'right' })
    const dTough = (resolveAction(createRng('r'), 1, caster, tough, atkSpell).value ?? 0)
    const dSoft = (resolveAction(createRng('r'), 1, caster, soft, atkSpell).value ?? 0)
    expect(dTough).toBeLessThan(dSoft)
  })
  it('Serpeverde cunning adds damage only to a WOUNDED target', () => {
    const caster = unit('voldemort', 200, { side: 'left', cunning: { threshold: 0.5, bonus: 0.5 } })
    const wounded = { ...unit('harry', 1000, { side: 'right' }), hp: 100 }   // 10% HP → below 0.5
    const healthy = unit('harry', 1000, { side: 'right' })                    // 100% HP → above 0.5
    const dW = (resolveAction(createRng('s'), 1, caster, wounded as any, atkSpell).value ?? 0)
    const dH = (resolveAction(createRng('s'), 1, caster, healthy, atkSpell).value ?? 0)
    expect(dW).toBeGreaterThan(dH)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/houseCombat.test.ts`
Expected: FAIL — the mechanics aren't wired.

- [ ] **Step 3: Wire dodge (Grifondoro) in `dodged`**

In `game/engine/combat/effects.ts`, the `dodged` function — add the target's dodgeBonus:
```ts
export function dodged(rng: Rng, actor: BattleUnit, target: BattleUnit): boolean {
  const c = BALANCE.combat
  const gap = effectiveStats(target).spd - effectiveStats(actor).spd
  const chance = Math.max(0, c.dodgeBase + gap * c.dodgeScale + (target.dodgeBonus ?? 0))
  return rng.chance(chance)
}
```

- [ ] **Step 4: Wire crit (Corvonero) in `computeDamage`**

In `computeDamage`, fold the actor's critBonus into chance and mult:
```ts
  const cb = actor.critBonus
  const critChance = c.critBase + effectiveStats(actor).spd * c.critSpdScale + (cb?.chance ?? 0)
  if (rng.chance(critChance)) { dmg *= c.critMult + (cb?.mult ?? 0); flags.push('crit') }
```
(Keep the same single `rng.chance` draw — only the chance value changes, so the rng sequence is unchanged.)

- [ ] **Step 5: Wire cunning (Serpeverde) in the attack handler**

In the `damage` handler, right after the `darkMagic` block (the `const dm = ctx.actor.darkMagic; if (dm && ctx.dark) ...` lines), add:
```ts
    const cun = ctx.actor.cunning
    if (cun && ctx.target.maxHp > 0 && ctx.target.hp / ctx.target.maxHp < cun.threshold) {
      dmg = Math.round(dmg * (1 + cun.bonus))
    }
```

- [ ] **Step 6: Wire damage-reduction (Tassorosso) in the attack handler**

In the same `damage` handler, the target's damageReduction applies to incoming damage. Add it right BEFORE `const residual = absorbDamage(ctx.target, dmg)` (after the bus modifiers, so it reduces the final pre-absorb damage):
```ts
    const dr = ctx.target.damageReduction
    if (dr && dr > 0) dmg = Math.round(dmg * (1 - dr))
    const residual = absorbDamage(ctx.target, dmg)
```

- [ ] **Step 7: Run the house-combat test**

Run: `npx vitest run tests/engine/houseCombat.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Determinism gate — full suite**

Run: `npx vitest run`
Expected: existing battles WITHOUT active house synergies are unchanged (all four hooks are gated on the stamped fields, which are absent without a house synergy). BUT some existing tests build house-homogeneous teams and may now see dodge/crit/reduce/cunning — those are intended changes. For each failure: if it's a seed-pinned balance/outcome test whose numbers shifted because a house effect now fires, update its expectation (note it). If it's a real logic break, STOP. campaignBalanceB/serpeverde/sweeps will shift — Task 6 recalibrates; for now just confirm nothing is a logic break. Then `npx tsc --noEmit` PASS.

- [ ] **Step 9: Commit**

```bash
git add game/engine/combat/effects.ts tests/engine/houseCombat.test.ts
git commit -m "feat(houses): wire dodge/crit/damage-reduction/cunning into combat"
```

---

### Task 5: Content — switch the house synergies to the new model

**Files:**
- Modify: `data/synergies.ts` (the 12 house synergy lines)
- Test: `tests/engine/houseSynergyContent.test.ts`

**Interfaces:**
- Consumes: `houseEffects` reads house+tier (Task 2), not the `bonus` stat (except Tassorosso's regen).

- [ ] **Step 1: Write the failing test**

Create `tests/engine/houseSynergyContent.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { SYNERGIES } from '@/data/synergies'

describe('house synergies use the new model', () => {
  it('slytherin no longer grants flat atk (the imbalance root is gone)', () => {
    for (const id of ['slytherin2', 'slytherin3', 'slytherin4']) {
      const s = SYNERGIES.find(x => x.id === id)!
      expect(s.bonus.atk ?? 0).toBe(0)   // mechanic moved to houseEffects (cunning)
    }
  })
  it('hufflepuff keeps regen (loyalty support stays)', () => {
    expect((SYNERGIES.find(x => x.id === 'hufflepuff4')!.bonus.regen ?? 0)).toBeGreaterThan(0)
  })
  it('all four houses still have 3 tiers with the house requirement', () => {
    for (const fam of ['Grifondoro', 'Serpeverde', 'Corvonero', 'Tassorosso']) {
      const tiers = SYNERGIES.filter(s => s.kind === 'house' && s.requires.house === fam)
      expect(tiers.length).toBe(3)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/houseSynergyContent.test.ts`
Expected: FAIL — slytherin still has `atk`.

- [ ] **Step 3: Update the house synergies**

In `data/synergies.ts`, the mechanic now lives in `houseEffects`, so the house synergies' `bonus` becomes minimal. Keep the `id`/`name`/`kind`/`family`/`requires` intact (houseEffects + tiering depend on them). Set `bonus`:
- **slytherin2/3/4:** remove `atk` → `bonus: {}` (cunning lives in houseEffects).
- **gryffindor2/3/4:** remove `def` → `bonus: {}` (dodge lives in houseEffects).
- **ravenclaw2/3/4:** remove `spd` → `bonus: {}` (crit lives in houseEffects).
- **hufflepuff2/3/4:** KEEP `regen` (the support identity) → `bonus: { regen: 6/12/22 }` as today (damage-reduction is the new houseEffects layer ON TOP).

Example for the slytherin line:
```ts
  { id: 'slytherin2', name: '2 Serpeverde', kind: 'house', family: 'house:Serpeverde', requires: { house: 'Serpeverde', count: 2 }, bonus: {} },
```
Apply the same `bonus: {}` to all gryffindor/ravenclaw/slytherin tiers; leave hufflepuff's `regen` values unchanged.

⚠️ Update the descriptions/names ONLY if the codebase shows house-synergy descriptions in the UI (check for a `desc` field on Synergy — the type has none, so names like "2 Serpeverde" stay; the mechanic is conveyed elsewhere). Do not invent a `desc` field.

- [ ] **Step 4: Run test + typecheck + full suite**

Run: `npx vitest run tests/engine/houseSynergyContent.test.ts` → PASS.
Run: `npx tsc --noEmit` → PASS.
Run: `npx vitest run` → the house effects now fully replace the stats. Existing tests that asserted a house synergy's stat bonus (e.g. "slytherin gives +atk") must be updated to the new model — find them (`grep -rn "slytherin\|gryffindor\|ravenclaw\|hufflepuff" tests/`) and update or remove the stat-specific assertions, noting each. Balance shifts go to Task 6.

- [ ] **Step 5: Commit**

```bash
git add data/synergies.ts tests/engine/houseSynergyContent.test.ts
# add any updated house-stat test
git commit -m "feat(houses): house synergies drop flat stats (mechanic moved to houseEffects); hufflepuff keeps regen"
```

---

### Task 6: Validation + balance tuning (4 houses in a tight spread)

**Files:**
- Modify: `game/engine/houseEffects.ts` (tune the value tables)
- Modify (comments + maybe band): the balance/sweep tests
- Possibly: `data/constants.ts` (menaceOffset — last-resort lever)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Measure the 4 houses**

The harness pattern is in `tests/engine/serpeverdeBalance.test.ts`/`campaignBalanceB.test.ts` (a competent-starter `runOne`, N=120). Measure all four houses' competent-starter win rate with a throwaway root-level `tune.mjs` (`@/` imports, `npx tsx tune.mjs`, DELETE when done): clone `runOne` with `starterOffer(seed, HOUSE)` for each of Grifondoro/Serpeverde/Corvonero/Tassorosso. Record the baseline spread (Serpeverde should now be LOWER than 0.775 — it lost +atk).

- [ ] **Step 2: Tune the houseEffects value tables to a tight spread**

Adjust `GRYFF_DODGE` / `RAVEN_CRIT` / `HUFF_REDUCE` / `SLYTH_CUNNING` in `game/engine/houseEffects.ts` so the four houses' win rates are within a reasonable spread of each other, AND campaignBalanceB (Grifondoro) stays in [0.15, 0.45]. Guidance:
- If a house is too weak, raise its table; too strong, lower it.
- Grifondoro dodge: keep MODERATE (the user's note — dodge nullifies a whole hit, so small values matter). If Grifondoro overshoots via dodge, lower GRYFF_DODGE first.
- Re-measure all four + campaignBalanceB after each change. Iterate until tight + in-band.
- If buffing the houses pushes campaignBalanceB above 0.45 (game too easy now that player houses are stronger), lower it back with `data/constants.ts menaceOffset` (a touch more negative) — the LAST lever, and note it.

- [ ] **Step 3: Refresh balance/sweep comments + re-enable serpeverde band if it holds**

Update the diagnostic comments in campaignBalanceB + the 4 archetype sweeps + serpeverdeBalance with the new numbers. If serpeverdeBalance now sits in a sane band (it lost +atk), RE-ENABLE a band assertion (e.g. `winRate < 0.60`) IF it genuinely holds; else leave disabled with a note.

- [ ] **Step 4: Full suite + typecheck**

Run: `npx tsc --noEmit` → PASS.
Run: `npx vitest run` → all green. Delete tune.mjs.

- [ ] **Step 5: Commit**

```bash
git add game/engine/houseEffects.ts tests/engine/*.test.ts
# add data/constants.ts if menace was touched
git commit -m "balance(houses): tune the four house mechanics to a tight win-rate spread (campaignBalanceB in band)"
```

---

### Task 7: Update the backlog handoff doc

- [ ] **Step 1:** In `docs/superpowers/remaining-work.md`, add a "✅ Done" bullet for the characterful house-synergy redesign (Grifondoro dodge / Corvonero crit / Tassorosso damage-reduction+regen / Serpeverde cunning replacing flat atk; balance spread tightened; Serpeverde imbalance fixed at root). Note the still-pending slices: random battle generation + telegraph (#3), map already at 3-options, resurrection consumable relic, strong-final-boss (needs mid-area recovery).

- [ ] **Step 2:** Commit:
```bash
git add docs/superpowers/remaining-work.md
git commit -m "docs(houses): mark house-synergy redesign done"
```

---

## Final verification (after all tasks)

- [ ] `npx tsc --noEmit` → PASS.
- [ ] `npx vitest run` → all green. New: houseEffects, houseEffectsStamp, houseCombat, houseSynergyContent.
- [ ] The 4 houses in a tight win-rate spread; campaignBalanceB ∈ [0.15, 0.45]; Serpeverde no longer dominant.
- [ ] `git push origin master`.

## Self-Review notes (author)

- **Spec coverage:** §"4 synergie ridisegnate" → Tasks 1-5 (one mechanic each, all in Task 4's hooks); validation+balance → Task 6; backlog → Task 7. ✓
- **Determinism:** dodge/crit reuse the existing single rng draw (chance value changes, sequence doesn't); cunning/reduction are no-rng. Determinism gate at Task 3 (inert stamp) and Task 4 (hooks fire only with fields). Balance shifts recalibrated in Task 6, never masked. ✓
- **Type consistency:** the four field shapes (`dodgeBonus`/`critBonus{chance,mult}`/`damageReduction`/`cunning{threshold,bonus}`) defined Task 1, produced by houseEffects Task 2, stamped Task 3, consumed Task 4. ✓
- **Imbalance root fix:** slytherin loses flat +atk (Task 5), cunning is conditional (Task 4) — Serpeverde drops without nerfing Voldemort. ✓
