# Control Effects + Fixed Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the freeze control a distinct "shatter on first hit (+50%)" identity, make wizard stats fixed (range midpoint) instead of rolled, and update the glossary so each control reads distinctly.

**Architecture:** Three independent changes in the combat/data layer. (1) The damage handler in `effects.ts` gains a shatter branch that ends `freeze` and amplifies the breaking hit. (2) `statRoll.ts` replaces the RNG-based `rollStats` with a deterministic midpoint `fixedStats`. (3) `EFFECT_META` blurbs in `glossary.ts` are reworded. UI legibility (distinct icons/overlays/narration) already exists via `BattleScreen.controlAt` + `UnitBust` + `BattleLog.describeEntry`, so the only UI touch is a new `shatter` log tone.

**Tech Stack:** TypeScript, Vitest, Next.js. Pure-function game engine under `game/engine/`, data under `data/`, UI under `components/`.

## Global Constraints

- `freezeShatterMult = 1.5` (the breaking hit deals ×1.5 damage). Exact value, copied verbatim.
- Fixed stat formula: `Math.round((lo + hi) / 2)` per stat from `wizard.ranges`.
- Spell selection stays RNG-based (`pickSpell` unchanged) — do NOT make spells deterministic.
- Only DIRECT damage (the `damage` EFFECT_HANDLER) shatters freeze; DoT ticks (`tickStatuses`) must NOT.
- Silence and disarm stay pure counters — NO new mechanics, NO new `LogFlag` for them.
- Do not change the `action: 'Stordito'` skip log in `simulate.ts`; `controlAt` already distinguishes stun vs freeze in the UI.
- Run the full suite with `npm test`; typecheck with `npm run typecheck`.

---

## File Structure

- `data/constants.ts` — add `combat.freezeShatterMult`; remove now-unused `draft.tierRollBias`.
- `game/engine/statRoll.ts` — replace `rollStats(rng, …)` with `fixedStats(wizard)`; `draftWizard` uses it.
- `game/engine/combat/effects.ts` — shatter branch in the `damage` handler.
- `types/combat.ts` — add `'shatter'` to `LogFlag`.
- `components/battle/BattleLog.tsx` — `shatter` tone + narration suffix.
- `lib/glossary.ts` — reword `EFFECT_META` blurbs for stun/freeze/silence/disarm.
- Tests: `tests/engine/statRoll.test.ts` (new or extend), `tests/engine/combat/effects.test.ts`, `tests/ui/battleLog.test.tsx` (or existing log test), `tests/lib/glossary.test.ts`.

**Task order:** Task 1 (fixed stats) and Task 2 (shatter) are independent. Task 1 first because it shifts the RNG stream and will force a one-time refresh of seed-dependent fixtures (Task 1b) — get that churn out of the way before touching combat further.

---

### Task 1: Fixed stats (range midpoint)

**Files:**
- Modify: `game/engine/statRoll.ts`
- Modify: `data/constants.ts` (remove `draft.tierRollBias`)
- Test: `tests/engine/statRoll.test.ts`

**Interfaces:**
- Produces: `fixedStats(wizard: Wizard): Stats` — deterministic, no RNG. `draftWizard(rng, wizard)` keeps its signature (still draws RNG for `pickSpell`).
- Consumes: `Wizard.ranges` (`{ hp:[lo,hi], atk:[…], def:[…], spd:[…] }`), `Stats` type.

- [ ] **Step 1: Write the failing test**

Add to `tests/engine/statRoll.test.ts` (create the file if absent, with the imports shown):

```ts
import { describe, it, expect } from 'vitest'
import { fixedStats, draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'

describe('fixedStats', () => {
  it('returns the rounded midpoint of each range', () => {
    const harry = WIZARD_BY_ID['harry']!
    // ranges: hp [86,107] atk [31,40] def [12,19] spd [26,35]
    expect(fixedStats(harry)).toEqual({ hp: 97, atk: 36, def: 16, spd: 31 })
  })

  it('is deterministic and independent of RNG', () => {
    const w = WIZARD_BY_ID['harry']!
    expect(fixedStats(w)).toEqual(fixedStats(w))
  })

  it('draftWizard uses fixed stats but still varies the spell by RNG', () => {
    const w = WIZARD_BY_ID['harry']!
    const a = draftWizard(createRng(1), w)
    const b = draftWizard(createRng(2), w)
    expect(a.stats).toEqual(b.stats)          // stats fixed
    expect(a.maxHp).toBe(a.stats.hp)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/statRoll.test.ts`
Expected: FAIL — `fixedStats` is not exported.

- [ ] **Step 3: Implement `fixedStats` and rewire `draftWizard`**

Rewrite `game/engine/statRoll.ts` so the stat block is deterministic. Replace the `rollStat`/`rollStats` functions and the `draftWizard` body:

```ts
import type { DraftedWizard, Spell, Stats, Wizard } from '@/types'
import type { Rng } from './rng'
import { SPELL_BY_ID } from '@/data/spells'

function mid(range: readonly [number, number]): number {
  return Math.round((range[0] + range[1]) / 2)
}

/** Fixed, deterministic stat block: the rounded midpoint of each range. */
export function fixedStats(wizard: Wizard): Stats {
  return {
    hp: mid(wizard.ranges.hp),
    atk: mid(wizard.ranges.atk),
    def: mid(wizard.ranges.def),
    spd: mid(wizard.ranges.spd),
  }
}

export function pickSpell(rng: Rng, wizard: Wizard): Spell {
  const id = rng.pick(wizard.spellPool)
  const spell = SPELL_BY_ID[id]
  if (!spell) throw new Error(`unknown spell ${id} for ${wizard.id}`)
  return spell
}

export function draftWizard(rng: Rng, wizard: Wizard): DraftedWizard {
  const stats = fixedStats(wizard)
  const spell = pickSpell(rng, wizard)
  return { wizard, stats, maxHp: stats.hp, spell }
}
```

Note: the `BALANCE` and `rollStats` imports are now gone. Remove `tierRollBias` from `data/constants.ts` (delete the line `tierRollBias: { 1: 0.85, 2: 0.65, 3: 0.5, 4: 0.4 } as Record<Tier, number>,` inside `draft:`).

- [ ] **Step 4: Run the new test to verify it passes**

Run: `npx vitest run tests/engine/statRoll.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If `Tier` becomes an unused import in `data/constants.ts`, leave it only if still used by `tierWeights` (it is) — no change needed.

- [ ] **Step 6: Commit**

```bash
git add game/engine/statRoll.ts data/constants.ts tests/engine/statRoll.test.ts
git commit -m "feat(draft): fixed midpoint stats, RNG only for spell pick"
```

---

### Task 1b: Refresh seed-dependent fixtures

**Files:**
- Modify: whichever test files now fail (likely under `tests/engine/`, `tests/ui/` — battle outcomes, MVP, snapshots).

**Why:** Removing one RNG draw per stat shifts the seeded stream, so any test asserting a specific battle result / drafted stat / snapshot for a fixed seed will change. This is expected — refresh the expectations; do NOT add RNG back.

- [ ] **Step 1: Find the fallout**

Run: `npm test`
Expected: the new statRoll test passes; some seed/snapshot tests FAIL. Note each failing file.

- [ ] **Step 2: Triage each failure**

For each failure, confirm it is a *value-shift* (different stat/damage/winner for the same seed), NOT a logic break (crash, NaN, undefined). If it is a logic break, STOP and investigate — that is a real bug, not a fixture refresh.

- [ ] **Step 3: Update expected values**

For genuine value-shifts, update the asserted numbers/snapshots to the new deterministic output. For Vitest inline/file snapshots run:

```bash
npx vitest run -u
```

Then eyeball the diff: stat assertions should now match `fixedStats` midpoints; battle winners may flip — that is acceptable as long as the battle still resolves.

- [ ] **Step 4: Full suite green**

Run: `npm test`
Expected: PASS (all files).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: refresh seed-dependent fixtures after fixed-stats change"
```

---

### Task 2: Freeze shatters on first direct hit (+50%)

**Files:**
- Modify: `data/constants.ts` (add `combat.freezeShatterMult`)
- Modify: `types/combat.ts` (add `'shatter'` to `LogFlag`)
- Modify: `game/engine/combat/effects.ts` (shatter branch in `damage` handler)
- Test: `tests/engine/combat/effects.test.ts`

**Interfaces:**
- Consumes: `BattleUnit.statusEffects` (`ActiveEffect[]`, each with `kind`/`statusId`/`remaining`), `BALANCE.combat.freezeShatterMult`, `absorbDamage`, `computeDamage`.
- Produces: when a damage hit lands on a unit with an active `freeze`, the hit deals ×1.5, the `freeze` effect is removed, and the `'shatter'` flag is pushed.

- [ ] **Step 1: Add the constant**

In `data/constants.ts`, inside `combat: { … }`, add after `fatiguePctStep: 0.05,`:

```ts
    // A direct damage hit on a frozen unit shatters the freeze: it ends and the
    // breaking hit deals this multiplier. DoT ticks do NOT shatter.
    freezeShatterMult: 1.5,
```

- [ ] **Step 2: Extend `LogFlag`**

In `types/combat.ts`, change the `LogFlag` union to include `'shatter'`:

```ts
export type LogFlag = 'crit' | 'dodge' | 'kill' | 'heal' | 'block' | 'stun' | 'dot' | 'pen' | 'shatter'
```

- [ ] **Step 3: Write the failing test**

Add to `tests/engine/combat/effects.test.ts` (follow the file's existing unit-construction helper; the sketch below shows the intent — adapt the unit factory to whatever the file already uses):

```ts
import { describe, it, expect } from 'vitest'
import { EFFECT_HANDLERS } from '@/game/engine/combat/effects'
import { applyStatus, tickStatuses } from '@/game/engine/status'
import { createRng } from '@/game/engine/rng'
import { makeUnit } from './_helpers' // use the file's existing builder; inline one if none

describe('freeze shatter', () => {
  it('a direct hit removes freeze and deals ~1.5x', () => {
    const actor = makeUnit('harry', { atk: 40 })
    const frozen = makeUnit('snape', { def: 10, hp: 999, maxHp: 999 })
    applyStatus(frozen, 'freeze')
    const flags: string[] = []
    const ctx = { rng: createRng(1), turn: 1, actor, target: frozen, flags } as any

    const plainActor = makeUnit('harry', { atk: 40 })
    const plainTarget = makeUnit('snape', { def: 10, hp: 999, maxHp: 999 })
    const baseFlags: string[] = []
    const base = EFFECT_HANDLERS.damage(
      { rng: createRng(1), turn: 1, actor: plainActor, target: plainTarget, flags: baseFlags } as any,
      { kind: 'damage', power: 1 },
    ).value!

    const res = EFFECT_HANDLERS.damage(ctx, { kind: 'damage', power: 1 })

    expect(frozen.statusEffects.some(e => e.kind === 'freeze')).toBe(false) // freeze removed
    expect(flags).toContain('shatter')
    expect(res.value).toBe(Math.round(base * 1.5))
  })

  it('a DoT tick does not shatter freeze', () => {
    const u = makeUnit('snape', { hp: 999, maxHp: 999 })
    applyStatus(u, 'freeze')
    applyStatus(u, 'burn')
    // tickStatuses applies burn damage but must leave freeze intact
    tickStatuses(1, u)
    expect(u.statusEffects.some(e => e.kind === 'freeze')).toBe(true)
  })
})
```

If `tests/engine/combat/effects.test.ts` has no shared unit builder, inline a minimal one:

```ts
function makeUnit(id: string, over: Partial<{ atk: number; def: number; hp: number; maxHp: number }> = {}) {
  const base = { hp: 100, maxHp: 100, atk: 20, def: 20, spd: 20 }
  return {
    wizard: { id, role: 'Controllo' }, side: 'left',
    buffedStats: { ...base, ...over }, maxHp: over.maxHp ?? 100, hp: over.hp ?? 100,
    cooldowns: {}, statusEffects: [], alive: true,
  } as any
}
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run tests/engine/combat/effects.test.ts -t "freeze shatter"`
Expected: FAIL — freeze not removed / no `shatter` flag / value not ×1.5.

- [ ] **Step 5: Implement the shatter branch**

In `game/engine/combat/effects.ts`, import the constant is already there via `BALANCE`. Modify the `damage` handler. After the `canAttack` guard and after `computeDamage`, but BEFORE `absorbDamage`, insert the shatter logic so the multiplier is part of the dealt hit:

```ts
  damage: (ctx, eff) => {
    if (eff.kind !== 'damage') return {}
    if (eff.canDodge && dodged(ctx.rng, ctx.actor, ctx.target)) {
      ctx.flags.push('dodge'); return { value: 0, dodged: true }
    }
    if (!canAttack(ctx.actor)) return { value: 0 } // disarmed: no damage
    let dmg = computeDamage(ctx.rng, ctx.actor, ctx.target, eff.power, ctx.flags)
    // Shatter: a direct hit on a frozen target ends the freeze and amplifies THIS hit.
    const frozen = ctx.target.statusEffects.some(e => e.kind === 'freeze')
    if (frozen) {
      dmg = Math.round(dmg * BALANCE.combat.freezeShatterMult)
      ctx.target.statusEffects = ctx.target.statusEffects.filter(e => e.kind !== 'freeze')
      ctx.flags.push('shatter')
    }
    if (ctx.bus) {
      const hc: HookCtx = { turn: ctx.turn, actor: ctx.actor, target: ctx.target, side: ctx.actor.side, flags: ctx.flags }
      dmg = ctx.bus.emitModifier('modifyOutgoingDamage', dmg, hc)
      dmg = Math.round(ctx.bus.emitModifier('modifyIncomingDamage', dmg, { ...hc, side: ctx.target.side }))
    }
    const residual = absorbDamage(ctx.target, dmg)
    ctx.target.hp -= residual
    return { value: dmg }
  },
```

(`BALANCE` is already imported at the top of `effects.ts`.)

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/engine/combat/effects.test.ts -t "freeze shatter"`
Expected: PASS (2 tests).

- [ ] **Step 7: Full suite + typecheck**

Run: `npm test` then `npm run typecheck`
Expected: PASS. If a few seed-dependent battle fixtures shift again (freeze now amplifies), refresh them with `npx vitest run -u` and eyeball the diff (same triage rule as Task 1b).

- [ ] **Step 8: Commit**

```bash
git add data/constants.ts types/combat.ts game/engine/combat/effects.ts tests/engine/combat/effects.test.ts
git commit -m "feat(combat): freeze shatters on first direct hit for +50% damage"
```

---

### Task 3: Shatter narration in the battle log

**Files:**
- Modify: `components/battle/BattleLog.tsx`
- Test: `tests/ui/battleLog.test.tsx` (extend if present; else add a focused test file)

**Interfaces:**
- Consumes: `LogEntry.flags` (now includes `'shatter'`), `describeEntry(entry, names, controlKind?)`.
- Produces: a `shatter` `LogTone` (amber/cyan styling) and a `… infrange il ghiaccio!` suffix on the damage narration when the flag is set.

- [ ] **Step 1: Write the failing test**

Add to the battle-log test (adapt the existing import of `describeEntry`):

```ts
import { describe, it, expect } from 'vitest'
import { describeEntry } from '@/components/battle/BattleLog'

describe('describeEntry shatter', () => {
  it('appends the ice-break note when the shatter flag is set', () => {
    const entry = {
      turn: 3, actorId: 'harry', actorSide: 'left', action: 'Reducto',
      targetId: 'snape', targetSide: 'right', type: 'Attacco', value: 60,
      flags: ['shatter'],
    } as any
    const out = describeEntry(entry, { 'left:harry': 'Harry', 'right:snape': 'Snape' })
    expect(out).toContain('60 danni')
    expect(out).toContain('infrange il ghiaccio')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/battleLog.test.tsx -t "shatter"`
Expected: FAIL — no ice-break text.

- [ ] **Step 3: Add the tone**

In `components/battle/BattleLog.tsx`, extend `LogTone`, `toneFor`, and `TONE_CLASS`:

```ts
export type LogTone = 'crit' | 'heal' | 'dodge' | 'kill' | 'dot' | 'stun' | 'pen' | 'shatter' | 'normal'
```

In `toneFor`, add before the `crit` check (shatter hits are visually the headline):

```ts
  if (entry.flags.includes('shatter')) return 'shatter'
```

In `TONE_CLASS`, add:

```ts
  shatter: 'text-cyan-200',
```

- [ ] **Step 4: Add the narration suffix**

In `describeEntry`, in the positive-damage branch, append the suffix. Change:

```ts
  const crit = entry.flags.includes('crit') ? ' (critico!)' : ''
  const pen = entry.flags.includes('pen') ? ' [armatura ignorata]' : ''
  if (typeof entry.value === 'number' && entry.value > 0) {
    return `${actor} lancia ${entry.action} su ${target ?? '?'}: ${entry.value} danni${crit}${pen}`
  }
```

to:

```ts
  const crit = entry.flags.includes('crit') ? ' (critico!)' : ''
  const pen = entry.flags.includes('pen') ? ' [armatura ignorata]' : ''
  const shatter = entry.flags.includes('shatter') ? ' — infrange il ghiaccio!' : ''
  if (typeof entry.value === 'number' && entry.value > 0) {
    return `${actor} lancia ${entry.action} su ${target ?? '?'}: ${entry.value} danni${crit}${pen}${shatter}`
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/ui/battleLog.test.tsx -t "shatter"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/battle/BattleLog.tsx tests/ui/battleLog.test.tsx
git commit -m "feat(battle): shatter tone + ice-break narration in the log"
```

---

### Task 4: Glossary blurbs spell out each control's identity

**Files:**
- Modify: `lib/glossary.ts` (`EFFECT_META` entries for stun/freeze/silence/disarm)
- Test: `tests/lib/glossary.test.ts`

**Interfaces:**
- Consumes: `EFFECT_META[kind].blurb` (rendered on cards via `spellEffectLines` and in the compendio).
- Produces: reworded blurbs that describe identity, not the generic "skip turn".

- [ ] **Step 1: Write the failing test**

Add to `tests/lib/glossary.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { EFFECT_META } from '@/lib/glossary'

describe('EFFECT_META control blurbs', () => {
  it('describe each control distinctly', () => {
    expect(EFFECT_META.freeze!.blurb).toContain('infrange')
    expect(EFFECT_META.stun!.blurb.toLowerCase()).toContain('rimuovere')
    expect(EFFECT_META.silence!.blurb).toContain('Anti-magia')
    expect(EFFECT_META.disarm!.blurb).toContain('Anti-attacco')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/glossary.test.ts -t "control blurbs"`
Expected: FAIL — current blurbs are the generic ones.

- [ ] **Step 3: Reword the blurbs**

In `lib/glossary.ts`, replace the four control entries in `EFFECT_META` (keep label/color/icon, change only `blurb`):

```ts
  stun: { label: 'Stordimento', color: '#C98BFF', icon: 'Zap', blurb: 'Salta il turno. Breve ma impossibile da rimuovere.' },
  freeze: { label: 'Congela', color: '#7DD3FF', icon: 'Snowflake', blurb: 'Blocca le azioni più a lungo, ma si infrange (con danno extra) al primo colpo.' },
  silence: { label: 'Silenzio', color: '#B59CFF', icon: 'VolumeX', blurb: 'Anti-magia: niente incantesimi, il bersaglio ripiega su un attacco base debole.' },
  disarm: { label: 'Disarma', color: '#FFD37D', icon: 'Hand', blurb: 'Anti-attacco: azzera i danni del bersaglio, che può ancora curare e difendere.' },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/glossary.test.ts -t "control blurbs"`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npm test` then `npm run typecheck`
Expected: PASS. If a compendio snapshot test asserts old blurb text, refresh it (`npx vitest run -u`).

- [ ] **Step 6: Commit**

```bash
git add lib/glossary.ts tests/lib/glossary.test.ts
git commit -m "feat(glossary): control blurbs spell out distinct identities"
```

---

## Self-Review notes

- **Spec coverage:** shatter mechanic (Task 2) ✓; shatter readability (Task 3) ✓; fixed stats + spell-stays-random (Task 1) ✓; remove tierRollBias (Task 1) ✓; glossary (Task 4) ✓; "leggibilità già esistente, non ri-implementare" honored — no `simulate.ts`/`UnitBust`/`controlAt` changes ✓; LogFlag gets only `shatter` ✓.
- **DoT must not shatter:** guaranteed because the shatter branch lives only in the `damage` EFFECT_HANDLER; `tickStatuses` is untouched (Task 2 Step 5 + its second test).
- **Fixture churn** is isolated to Task 1b (and a small re-check in Task 2/4) so combat-balance shifts are reviewed in one place.
