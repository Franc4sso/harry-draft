# Trait Assignment to All 60 Wizards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every one of the 60 wizards in `data/wizards.ts` at least one trait, drawn from its role's pool, matching the approved assignment spec.

**Architecture:** Pure data change to `data/wizards.ts` (add/keep a `traits: string[]` field per wizard), guarded by a new data-level coverage test. No engine, type, trait-catalog, or UI changes — the engine already registers `wizard.traits` and the WizardCard already renders trait chips.

**Tech Stack:** TypeScript, Vitest. Files: `data/wizards.ts`, `data/traits.ts` (read-only here), `types/wizard.ts` (read-only), `tests/data/`.

## Global Constraints

- ZERO engine / type / trait-catalog / UI changes. Only `data/wizards.ts` and one new test file are touched.
- The 4 already-assigned wizards keep their EXACT existing traits, unchanged: `voldemort: ['esecuzione', 'furia']`, `bellatrix: ['sifone']`, `mcgonagall: ['roccia']`, `lupin: ['benedizione']`.
- Every wizard ends with a non-empty `traits` array.
- Every assigned trait id MUST exist in `TRAIT_BY_ID` (from `data/traits.ts`).
- Each assigned trait MUST belong to its wizard's role pool:
  - Attaccante: esecuzione, furia, ferocia, crescendo, veleno
  - Controllo: pietrificazione, bavaglio, disarmo, logoramento, sifone, anticipo
  - Supporto: benedizione, rigenerazione
  - Tank: roccia, vendetta
- The authoritative per-wizard assignment is the table in Task 2. Use it verbatim.

---

## File Structure

- **Modify:** `data/wizards.ts` — add `traits: [...]` to the 56 wizards lacking it; leave the 4 existing untouched.
- **Create:** `tests/data/traitAssignment.test.ts` — coverage + validity + role-pool + regression guard.

The test is written FIRST (Task 1) and will be RED until the data edit (Task 2) makes it GREEN.

---

## Task 1: Coverage + validity test (TDD red)

Write the guard test before the data exists. It must fail initially because 56 wizards have no `traits`.

**Files:**
- Create: `tests/data/traitAssignment.test.ts`

**Interfaces:**
- Consumes: `WIZARDS` (array of `Wizard`) from `@/data/wizards`; `TRAIT_BY_ID` (Record<string, Trait>) from `@/data/traits`. `Wizard` has fields `id: string`, `role: 'Attaccante'|'Controllo'|'Supporto'|'Tank'`, `traits?: string[]`.
- Produces: the test file other tasks rely on for the green gate.

- [ ] **Step 1: Write the failing test**

Create `tests/data/traitAssignment.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { WIZARDS } from '@/data/wizards'
import { TRAIT_BY_ID } from '@/data/traits'

/** The trait pool each role may draw from (must match the design spec). */
const ROLE_POOLS: Record<string, string[]> = {
  Attaccante: ['esecuzione', 'furia', 'ferocia', 'crescendo', 'veleno'],
  Controllo: ['pietrificazione', 'bavaglio', 'disarmo', 'logoramento', 'sifone', 'anticipo'],
  Supporto: ['benedizione', 'rigenerazione'],
  Tank: ['roccia', 'vendetta'],
}

describe('trait assignment', () => {
  it('gives every wizard at least one trait', () => {
    const missing = WIZARDS.filter(w => !w.traits || w.traits.length === 0).map(w => w.id)
    expect(missing).toEqual([])
  })

  it('only references traits that exist in the catalog', () => {
    const unknown: string[] = []
    for (const w of WIZARDS) for (const t of w.traits ?? []) {
      if (!TRAIT_BY_ID[t]) unknown.push(`${w.id}:${t}`)
    }
    expect(unknown).toEqual([])
  })

  it('only assigns traits from the wizard role pool', () => {
    const offenders: string[] = []
    for (const w of WIZARDS) {
      const pool = ROLE_POOLS[w.role] ?? []
      for (const t of w.traits ?? []) {
        if (!pool.includes(t)) offenders.push(`${w.id}(${w.role}):${t}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('preserves the four pre-existing assignments exactly', () => {
    const byId = Object.fromEntries(WIZARDS.map(w => [w.id, w.traits]))
    expect(byId['voldemort']).toEqual(['esecuzione', 'furia'])
    expect(byId['bellatrix']).toEqual(['sifone'])
    expect(byId['mcgonagall']).toEqual(['roccia'])
    expect(byId['lupin']).toEqual(['benedizione'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- traitAssignment`
Expected: FAIL. The first test ("at least one trait") fails — `missing` lists the 56 unassigned wizard ids (e.g. `dumbledore`, `harry`, `snape`, …), not `[]`. (The "pre-existing assignments" test should already PASS — those 4 are set.)

- [ ] **Step 3: Commit the red test**

```bash
git add tests/data/traitAssignment.test.ts
git commit -m "test(traits): coverage + role-pool guard for wizard trait assignment (red)"
```

---

## Task 2: Assign traits to all 60 wizards (TDD green)

Add the `traits` field to every wizard per the table below. This turns Task 1's test green.

**Files:**
- Modify: `data/wizards.ts`
- Test (gate, already exists): `tests/data/traitAssignment.test.ts`

**Interfaces:**
- Consumes: Task 1's test as the green gate. `Wizard.traits?: string[]` field (`types/wizard.ts`).
- Produces: a fully-assigned `WIZARDS` array.

**Authoritative assignment (verbatim — id → traits):**

```
dumbledore: ['pietrificazione']
voldemort: ['esecuzione', 'furia']        # already set — DO NOT EDIT
harry: ['esecuzione', 'furia']
snape: ['veleno']
bellatrix: ['sifone']                     # already set — DO NOT EDIT
mcgonagall: ['roccia']                    # already set — DO NOT EDIT
sirius: ['furia', 'ferocia']
lupin: ['benedizione']                    # already set — DO NOT EDIT
moody: ['roccia', 'vendetta']
lucius: ['esecuzione']
kingsley: ['roccia']
fleur: ['ferocia']
viktor: ['crescendo']
hermione: ['bavaglio']
ron: ['roccia']
draco: ['veleno']
ginny: ['ferocia']
neville: ['vendetta']
luna: ['rigenerazione']
fred: ['logoramento']
george: ['crescendo']
molly: ['benedizione']
arthur: ['rigenerazione']
tonks: ['anticipo']
narcissa: ['benedizione']
dolohov: ['veleno']
greyback: ['vendetta']
cho: ['pietrificazione']
cedric: ['ferocia']
slughorn: ['rigenerazione']
hagrid: ['roccia']
flitwick: ['anticipo']
sprout: ['rigenerazione']
seamus: ['ferocia']
dean: ['crescendo']
parvati: ['logoramento']
lavender: ['benedizione']
pansy: ['bavaglio']
goyle: ['roccia']
crabbe: ['roccia']
marcus: ['furia']
pettigrew: ['rigenerazione']
padma: ['disarmo']
terry: ['pietrificazione']
michael: ['crescendo']
roger: ['vendetta']
marietta: ['rigenerazione']
anthony: ['roccia']
hannah: ['benedizione']
susan: ['rigenerazione']
ernie: ['roccia']
justin: ['ferocia']
zacharias: ['logoramento']
leanne: ['bavaglio']
eloise: ['vendetta']
theodore: ['pietrificazione']
blaise: ['veleno']
astoria: ['benedizione']
penelope: ['rigenerazione']
megan: ['logoramento']
```

- [ ] **Step 1: Confirm the test is RED before editing**

Run: `npm run test -- traitAssignment`
Expected: FAIL (the "at least one trait" test still lists 56 missing ids). This confirms you're about to make a meaningful change.

- [ ] **Step 2: Add the `traits` field to each wizard**

For every wizard object in `data/wizards.ts`, add a `traits: [...]` line matching the table above. Follow the existing style: the 4 pre-set wizards already have `traits:` on its own line after `spellPool`/`tags` — mirror that placement (a `traits:` line as the last field of the object, after `tags` when present, else after `spellPool`).

Example of the exact shape to add (for `harry`, which currently has no `traits`):

```typescript
  {
    id: 'harry', name: 'Harry Potter', house: 'Grifondoro', role: 'Attaccante', tier: 1,
    ranges: { hp: [86, 107], atk: [31, 40], def: [12, 19], spd: [26, 35] },
    spellPool: ['expelliarmus', 'stupeficium', 'reducto', 'sectumsempra', 'confundo'],
    tags: ['trio', 'da'],
    traits: ['esecuzione', 'furia'],
  },
```

And for a wizard with no `tags` (e.g. `snape`), the `traits` line goes right after `spellPool`:

```typescript
  {
    id: 'snape', name: 'Severus Piton', house: 'Serpeverde', role: 'Attaccante', tier: 2,
    ranges: { hp: [70, 86], atk: [28, 37], def: [11, 16], spd: [19, 27] },
    spellPool: ['sectumsempra', 'levicorpus', 'confringo', 'reducto', 'stupeficium'],
    traits: ['veleno'],
  },
```

**Do NOT modify** the `traits` lines already present on `voldemort`, `bellatrix`, `mcgonagall`, `lupin` — they already match the table.

- [ ] **Step 3: Run the test to verify GREEN**

Run: `npm run test -- traitAssignment`
Expected: PASS (4 tests). If "at least one trait" still fails, the `missing` array names the wizards you skipped — add their `traits`. If "role pool" fails, you assigned a trait outside the role pool — fix to match the table. If "pre-existing" fails, you accidentally changed one of the 4 — restore it.

- [ ] **Step 4: Full suite + typecheck + build**

Run: `npm run test`
Expected: full suite passes (Phase 3 + all prior + the 4 new assignment tests), no regressions. Note: `roleBalance.test.ts` only checks stats, unaffected by traits.

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit + push**

Before pushing, verify HEAD still matches origin (a concurrent process may have moved it):

```bash
git fetch origin
git merge-base --is-ancestor origin/master HEAD && echo SAFE || echo STOP
```

If SAFE:

```bash
git add data/wizards.ts
git commit -m "feat(traits): assign a role-coherent trait to all 60 wizards"
git push origin master
```

If STOP (not an ancestor): do not push. Report BLOCKED with the divergence so the controller can rebase.

---

## Self-Review

**Spec coverage:**
- Every wizard ≥1 trait — Task 1 test 1 + Task 2 data. ✅
- Trait ids valid — Task 1 test 2. ✅
- Role-pool coherence — Task 1 test 3. ✅
- 4 pre-existing preserved — Task 1 test 4 + Task 2 "DO NOT EDIT" notes. ✅
- All 60 assignments — Task 2 verbatim table (verified 60 unique ids, pool-coherent). ✅
- Zero engine/type/UI changes — only `data/wizards.ts` + test. ✅
- anticipo on Tonks+Flitwick, disarmo on Padma — present in table. ✅

**Placeholder scan:** No TBD/TODO. The data edit (Task 2 Step 2) is mechanical with two worked examples (with-tags and without-tags placement) plus the full verbatim table; not a "fill in the details" gap.

**Type consistency:** `Wizard.traits?: string[]` used consistently; `WIZARDS`, `TRAIT_BY_ID` import paths match the codebase (`@/data/wizards`, `@/data/traits`). Role-pool keys match `Wizard.role` literal union. ✅
