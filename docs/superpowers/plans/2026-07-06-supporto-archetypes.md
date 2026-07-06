# Supporto Archetypes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the 14 Supporto wizards distinct identities via four archetypes (Guaritore / Scudiero / Stratega / Purificatore) using only existing engine effects, enforce per-role spell whitelists (removing `serpensortia` from Supporto), and tune per-spell VFX.

**Architecture:** Data + structural-guard change, no new engine mechanics. A new `lib/roleSpellPools.ts` declares the allowed spell IDs per role; a test asserts every wizard's `spellPool` ⊆ its role's whitelist. Supporto pools are rewritten by archetype. Existing per-spell VFX map (`lib/vfx/spellVfx.ts`) is verified/tuned. Dead `selectTarget` branch for offensive-Supporto is removed once no Supporto carries an attack.

**Tech Stack:** TypeScript, Next.js, Vitest. Data in `data/wizards.ts` / `data/spells.ts`; engine in `game/engine/combat/`; VFX in `lib/vfx/`.

## Global Constraints

- Copy in italiano. Commit + push to master without asking when work is done (established flow).
- MAX 5 enemies in any fight (absolute rule). Recruit rari (≤1/area).
- ONLY data/pools + whitelist + VFX. NO new engine effect (heal/shield/buff/cleanse/debuff/revive/regen/ward already exist).
- `npm run test` does NOT run typecheck → run `npm run typecheck` separately.
- The balance bot doesn't understand counters → treat winRates as smoke checks. Re-measure `campaignBalanceB` + `campaignBalanceRestricted` after the change; assert lives are `winRate > 0`.
- Supporto = ZERO direct attacks: no `type: 'Attacco'` or `type: 'Controllo'` spell in any Supporto pool.
- Every Supporto archetype pool MUST contain ≥1 proactive spell (effect even at full team HP: buff/shield/ward/regen) — no guaranteed dead turns.
- Jokers stay player-only; enemy pools draw from the same roles → enemy Supporto must stay coherent with the new kit.

## Archetype → spell mapping (all spells already exist in `data/spells.ts`)

Base (shared, every Supporto may draw): `episkey`, `protego`.

| Archetipo | Extra spells (beyond base) |
|---|---|
| **Guaritore** | `vulnera`, `rennervate`, `anapneo`, `ferula` |
| **Scudiero** | `protego_maxima`, `fianto`, `colletivo_scudo`, `aegis`, `expecto` |
| **Stratega** | `incitamento`, `riddikulus`, `salvio` |
| **Purificatore** | `ferula`, `anapneo`, `salvio` |

Proactive-spell guarantee (no dead turn): Guaritore→`ferula` (regen); Scudiero→protego/fianto/aegis; Stratega→incitamento/riddikulus/salvio; Purificatore→salvio/ferula.

## The 14 Supporto → archetype assignment (by house/lore)

| id | name | house | archetipo | new pool |
|---|---|---|---|---|
| lupin | Remus Lupin | Grifondoro | Guaritore | episkey, protego, vulnera, ferula, anapneo |
| molly | Molly Weasley | Grifondoro | Guaritore | episkey, protego, vulnera, ferula, rennervate |
| lavender | Lavender Brown | Grifondoro | Guaritore | episkey, protego, anapneo, ferula |
| sprout | Pomona Sprite | Tassorosso | Guaritore | episkey, protego, ferula, rennervate, anapneo |
| hannah | Hannah Abbott | Tassorosso | Scudiero | episkey, protego, protego_maxima, fianto, colletivo_scudo |
| susan | Susan Bones | Tassorosso | Scudiero | episkey, protego, fianto, aegis, rennervate |
| pettigrew | Peter Minus | Serpeverde | Scudiero | episkey, protego, fianto, colletivo_scudo |
| narcissa | Narcissa Malfoy | Serpeverde | Scudiero | episkey, protego, protego_maxima, fianto, aegis |
| luna | Luna Lovegood | Corvonero | Stratega | episkey, protego, incitamento, riddikulus, salvio |
| arthur | Arthur Weasley | Grifondoro | Stratega | episkey, protego, incitamento, riddikulus, salvio |
| marietta | Marietta Edgecombe | Corvonero | Purificatore | episkey, protego, salvio, anapneo, ferula |
| penelope | Penelope Clearwater | Corvonero | Purificatore | episkey, protego, salvio, anapneo, rennervate |
| slughorn | Horace Lumacorno | Serpeverde | Guaritore | episkey, protego, vulnera, anapneo, ferula |
| astoria | Astoria Greengrass | Serpeverde | Purificatore | episkey, protego, salvio, anapneo, ferula |

Distribution: Guaritore 5, Scudiero 4, Stratega 2, Purificatore 3 — none with 1 only.
`serpensortia` removed from: narcissa, slughorn, sprout, astoria.

## Per-role whitelist (all roles; conservative — from current pools, cleaned)

- **Supporto**: exactly the union of the 4 archetype pools above → `episkey, protego, vulnera, rennervate, anapneo, ferula, protego_maxima, fianto, colletivo_scudo, aegis, expecto, incitamento, riddikulus, salvio`. (All `Cura`/`Difesa`; zero `Attacco`/`Controllo`.)
- **Tank**: `bombarda, diffindo, expelliarmus, fianto, flipendo, oppugno, protego, protego_maxima, reducto, salvio, stupeficium` — remove `serpensortia` (poison doesn't fit a bruiser/taunt).
- **Attaccante**: `avada, bombarda, confringo, crucio, diffindo, expelliarmus, fiendfyre, flipendo, incendio, levicorpus, oppugno, reducto, sectumsempra, serpensortia, stupeficium` — remove `confundo` (a `Controllo` spell is the outlier on a pure attacker). `serpensortia` stays (it IS an `Attacco`).
- **Controllo**: `confringo, confundo, crucio, fiendfyre, flipendo, imperio, langlock, levicorpus, oppugno, petrificus, reducto, tarantallegra` — remove `serpensortia` (a straight attack; the controller kit is control + burst, not poison).

---

### Task 1: Role spell whitelist + structural guard test

**Files:**
- Create: `lib/roleSpellPools.ts`
- Test: `tests/data/roleSpellPools.test.ts`

**Interfaces:**
- Produces: `export const ROLE_SPELL_WHITELIST: Record<Role, ReadonlySet<string>>` and `export function isSpellAllowedForRole(role: Role, spellId: string): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/data/roleSpellPools.test.ts
import { describe, it, expect } from 'vitest'
import { WIZARDS } from '@/data/wizards'
import { ROLE_SPELL_WHITELIST, isSpellAllowedForRole } from '@/lib/roleSpellPools'
import { SPELL_BY_ID } from '@/data/spells'

describe('role spell whitelist', () => {
  it('every wizard spell is allowed for its role', () => {
    const bad: string[] = []
    for (const w of WIZARDS) {
      for (const s of w.spellPool ?? []) {
        if (!isSpellAllowedForRole(w.role, s)) bad.push(`${w.id} (${w.role}) has out-of-role spell ${s}`)
      }
    }
    expect(bad, bad.join('\n')).toEqual([])
  })

  it('Supporto carries ZERO direct-attack spells (no Attacco/Controllo)', () => {
    const offenders: string[] = []
    for (const s of ROLE_SPELL_WHITELIST.Supporto) {
      const type = SPELL_BY_ID[s]?.type
      if (type === 'Attacco' || type === 'Controllo') offenders.push(`${s} is ${type}`)
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('serpensortia is not allowed for Supporto, Tank, or Controllo', () => {
    expect(isSpellAllowedForRole('Supporto', 'serpensortia')).toBe(false)
    expect(isSpellAllowedForRole('Tank', 'serpensortia')).toBe(false)
    expect(isSpellAllowedForRole('Controllo', 'serpensortia')).toBe(false)
    expect(isSpellAllowedForRole('Attaccante', 'serpensortia')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/data/roleSpellPools.test.ts`
Expected: FAIL — `lib/roleSpellPools` not found (and, once created but before Task 2, the first test fails because Supporto pools still contain serpensortia).

- [ ] **Step 3: Write `lib/roleSpellPools.ts`**

```ts
import type { Role } from '@/types'

// Allowed spell IDs per role — a STRUCTURAL guard so a wizard can never carry a spell that
// contradicts its role (e.g. a Supporto casting serpensortia). Conservative: derived from the
// current pools, cleaned of outliers. Supporto = only Cura/Difesa (zero direct attacks).
export const ROLE_SPELL_WHITELIST: Record<Role, ReadonlySet<string>> = {
  Supporto: new Set([
    'episkey', 'protego', 'vulnera', 'rennervate', 'anapneo', 'ferula',
    'protego_maxima', 'fianto', 'colletivo_scudo', 'aegis', 'expecto',
    'incitamento', 'riddikulus', 'salvio',
  ]),
  Tank: new Set([
    'bombarda', 'diffindo', 'expelliarmus', 'fianto', 'flipendo', 'oppugno',
    'protego', 'protego_maxima', 'reducto', 'salvio', 'stupeficium',
  ]),
  Attaccante: new Set([
    'avada', 'bombarda', 'confringo', 'crucio', 'diffindo', 'expelliarmus',
    'fiendfyre', 'flipendo', 'incendio', 'levicorpus', 'oppugno', 'reducto',
    'sectumsempra', 'serpensortia', 'stupeficium', 'base_attack',
  ]),
  Controllo: new Set([
    'confringo', 'confundo', 'crucio', 'fiendfyre', 'flipendo', 'imperio',
    'langlock', 'levicorpus', 'oppugno', 'petrificus', 'reducto', 'tarantallegra',
    'glacius', 'silencio',
  ]),
}

export function isSpellAllowedForRole(role: Role, spellId: string): boolean {
  // base_attack is the universal silence/disarm fallback — always allowed.
  if (spellId === 'base_attack') return true
  return ROLE_SPELL_WHITELIST[role]?.has(spellId) ?? false
}
```

- [ ] **Step 4: Run the whitelist-shape tests (not the wizard-coverage one yet)**

Run: `npx vitest run tests/data/roleSpellPools.test.ts -t "serpensortia"`
Expected: PASS. The "every wizard spell allowed" test still FAILS (Supporto wizards still carry serpensortia — fixed in Task 2). That is expected and intended at this point.

- [ ] **Step 5: Commit**

```bash
git add lib/roleSpellPools.ts tests/data/roleSpellPools.test.ts
git commit -m "feat(combat): per-role spell whitelist + structural guard test"
```

---

### Task 2: Rewrite the 14 Supporto spell pools by archetype

**Files:**
- Modify: `data/wizards.ts` (the 14 Supporto `spellPool` arrays per the assignment table above)
- Test: `tests/data/supportoArchetypes.test.ts`

**Interfaces:**
- Consumes: `ROLE_SPELL_WHITELIST` from Task 1.
- Produces: nothing new; makes the Task 1 coverage test pass.

- [ ] **Step 1: Write the failing archetype test**

```ts
// tests/data/supportoArchetypes.test.ts
import { describe, it, expect } from 'vitest'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'

const SUPPORTO = () => WIZARDS.filter(w => w.role === 'Supporto')

// A proactive spell has effect even at full team HP: Difesa (shield/ward/buff) or a
// regen/buff Cura (ferula = regen-over-time; incitamento = atkUp). Pure instant heals
// (episkey/vulnera/anapneo/rennervate) do NOT count — they need a wounded ally.
const PROACTIVE = new Set(['protego', 'protego_maxima', 'fianto', 'colletivo_scudo', 'aegis', 'expecto', 'incitamento', 'riddikulus', 'salvio', 'ferula'])

describe('Supporto archetypes', () => {
  it('no Supporto carries a direct-attack spell', () => {
    const bad: string[] = []
    for (const w of SUPPORTO()) for (const s of w.spellPool ?? []) {
      const t = SPELL_BY_ID[s]?.type
      if (t === 'Attacco' || t === 'Controllo') bad.push(`${w.id}: ${s} (${t})`)
    }
    expect(bad, bad.join('\n')).toEqual([])
  })

  it('every Supporto has at least one proactive spell (no guaranteed dead turn)', () => {
    const dead: string[] = []
    for (const w of SUPPORTO()) {
      if (!(w.spellPool ?? []).some(s => PROACTIVE.has(s))) dead.push(w.id)
    }
    expect(dead, `no proactive spell: ${dead.join(', ')}`).toEqual([])
  })

  it('serpensortia is gone from all Supporto pools', () => {
    const still = SUPPORTO().filter(w => (w.spellPool ?? []).includes('serpensortia')).map(w => w.id)
    expect(still, still.join(', ')).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/data/supportoArchetypes.test.ts`
Expected: FAIL — serpensortia still present on narcissa/slughorn/sprout/astoria.

- [ ] **Step 3: Edit the 14 Supporto pools in `data/wizards.ts`**

Set each `spellPool` exactly to the "new pool" column of the assignment table. The four that had `serpensortia` (narcissa, slughorn, sprout, astoria) lose it. Exact target pools:

```
lupin:     ['expecto', 'episkey', 'vulnera', 'protego', 'ferula', 'anapneo']   // keep expecto (his signature Patronus VFX)
molly:     ['vulnera', 'episkey', 'ferula', 'protego', 'rennervate']
lavender:  ['episkey', 'anapneo', 'ferula', 'protego']
sprout:    ['ferula', 'episkey', 'rennervate', 'protego', 'anapneo']
hannah:    ['episkey', 'ferula', 'protego', 'protego_maxima', 'colletivo_scudo']
susan:     ['episkey', 'rennervate', 'protego', 'fianto', 'aegis']
pettigrew: ['episkey', 'ferula', 'protego', 'colletivo_scudo']
narcissa:  ['vulnera', 'episkey', 'protego', 'fianto', 'protego_maxima']
luna:      ['episkey', 'protego', 'salvio', 'riddikulus', 'incitamento']
arthur:    ['episkey', 'protego', 'salvio', 'incitamento', 'riddikulus']
marietta:  ['episkey', 'anapneo', 'protego', 'salvio', 'ferula']
penelope:  ['episkey', 'rennervate', 'anapneo', 'protego', 'salvio']
slughorn:  ['vulnera', 'episkey', 'anapneo', 'protego', 'ferula']
astoria:   ['episkey', 'anapneo', 'ferula', 'protego', 'salvio']
```

(Note: `expecto` and `aegis` are in the Supporto whitelist; keep expecto only on lupin where it already was, to preserve his Patronus identity.)

- [ ] **Step 4: Run both Task-1 and Task-2 tests**

Run: `npx vitest run tests/data/roleSpellPools.test.ts tests/data/supportoArchetypes.test.ts`
Expected: PASS (all). The Task-1 wizard-coverage test now passes too.

- [ ] **Step 5: Commit**

```bash
git add data/wizards.ts tests/data/supportoArchetypes.test.ts
git commit -m "feat(wizards): rewrite Supporto pools by archetype; drop serpensortia from Supporto"
```

---

### Task 3: Draft-time enforcement — clamp generated pools to the whitelist

**Files:**
- Modify: whichever module builds/expands a wizard's usable spell list at draft/battle (find via grep below)
- Test: `tests/engine/supportoNoAttack.test.ts`

**Interfaces:**
- Consumes: `isSpellAllowedForRole` from Task 1.
- Produces: guarantee that the spell a Supporto brings into battle is never an attack, even if pool data regressed or an enemy generator injects one.

- [ ] **Step 1: Locate where a wizard's battle spell is chosen from its pool**

Run: `grep -rn "spellPool" game/ data/ hooks/ | grep -v test`
Read the site that picks `unit.spell` from `spellPool` (e.g. `game/engine/combat/teamGen.ts` or `selectSpell` upstream / draft in `hooks/`). Identify the single function that resolves pool → chosen spell.

- [ ] **Step 2: Write the failing test**

```ts
// tests/engine/supportoNoAttack.test.ts
import { describe, it, expect } from 'vitest'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
// import the pool->spell resolver found in Step 1, e.g.:
// import { spellForWizard } from '@/game/engine/combat/teamGen'

describe('a Supporto never enters battle with an attack spell', () => {
  it('every Supporto resolved battle spell is Cura or Difesa', () => {
    for (const w of WIZARDS.filter(x => x.role === 'Supporto')) {
      for (const s of w.spellPool ?? []) {
        const t = SPELL_BY_ID[s]?.type
        expect(['Cura', 'Difesa'], `${w.id}:${s}`).toContain(t)
      }
    }
  })
})
```

(If Step 1 finds a dynamic resolver with RNG, assert over its output for each Supporto across a few seeds instead of over the static pool.)

- [ ] **Step 3: Run to verify current state**

Run: `npx vitest run tests/engine/supportoNoAttack.test.ts`
Expected: PASS already if Task 2 cleaned the pools AND no generator injects attacks. If it FAILS, an injection path exists → add an `isSpellAllowedForRole` clamp at the resolver from Step 1 (drop/replace a disallowed spell with `base_attack` only for non-Supporto; for Supporto fall back to `episkey`).

- [ ] **Step 4: If a clamp was needed, re-run until green**

Run: `npx vitest run tests/engine/supportoNoAttack.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(combat): clamp resolved battle spell to role whitelist (Supporto never attacks)"
```

---

### Task 4: Remove the now-dead offensive-Supporto branch in targeting

**Files:**
- Modify: `game/engine/combat/targeting.ts` (the `case 'Supporto':` block in `selectTarget`)
- Test: `tests/engine/combat/` (add/adjust a targeting test)

**Interfaces:**
- Consumes: guarantee from Tasks 2–3 that no Supporto carries an offensive spell.
- Produces: simpler Supporto targeting (always protect/heal an ally).

- [ ] **Step 1: Write the failing/guard test**

```ts
// tests/engine/supportoTargetsAlly.test.ts
import { describe, it, expect } from 'vitest'
import { selectTarget } from '@/game/engine/combat/targeting'
import { SPELL_BY_ID } from '@/data/spells'
// Build two minimal BattleUnits (a wounded ally + a full-HP Supporto) using the existing
// test helpers/patterns from tests/engine/esecuzione.test.ts (mk + toBattleUnits or the
// lightweight BattleUnit shape used in targeting tests). Assert a Supporto with a Cura spell
// targets the wounded ALLY, never an enemy.
```

Follow the exact BattleUnit construction pattern already used in the nearest existing `targeting` test (grep `selectTarget(` under `tests/`). Assert: Supporto + `episkey` → returns the wounded ally.

- [ ] **Step 2: Run to verify it passes with current code**

Run: `npx vitest run tests/engine/supportoTargetsAlly.test.ts`
Expected: PASS (documents current behavior before refactor).

- [ ] **Step 3: Delete the dead offensive branch**

In `game/engine/combat/targeting.ts`, `case 'Supporto':` — remove:

```ts
      if (spell && (spell.type === 'Attacco' || spell.type === 'Controllo')) {
        return spell.type === 'Controllo' ? backlineTarget(enemyPool) : highestThreat(enemyPool)
      }
```

Leaving `return carryToProtect(liveAllies) ?? mostWounded(liveAllies) ?? lowestHp(enemyPool)`. Update the block comment to note Supporto no longer carries offensive spells (guarded by the role whitelist).

- [ ] **Step 4: Run targeting tests + the guard**

Run: `npx vitest run tests/engine/supportoTargetsAlly.test.ts && npx vitest run tests/engine/combat`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/engine/combat/targeting.ts tests/engine/supportoTargetsAlly.test.ts
git commit -m "refactor(combat): drop dead offensive-Supporto targeting branch"
```

---

### Task 5: Per-spell VFX pass for the Supporto kit

**Files:**
- Modify: `lib/vfx/spellVfx.ts` (verify/tune every Supporto-kit spell entry)
- Modify (only if a new impact is added): `lib/vfx/choreograph.ts`
- Test: `tests/ui/supportoVfx.test.ts` (or extend an existing vfx test)

**Interfaces:**
- Consumes: `spellVfxFor(action)` from `lib/vfx/spellVfx.ts`.
- Produces: a bespoke (non-fallback) VFX config for every Supporto-kit spell.

- [ ] **Step 1: Write the failing coverage test**

```ts
// tests/ui/supportoVfx.test.ts
import { describe, it, expect } from 'vitest'
import { spellVfxFor } from '@/lib/vfx/spellVfx'
import { SPELL_BY_ID } from '@/data/spells'
import { ROLE_SPELL_WHITELIST } from '@/lib/roleSpellPools'

describe('every Supporto-kit spell has a bespoke VFX', () => {
  it('spellVfxFor returns a config for each (by spell NAME)', () => {
    const missing: string[] = []
    for (const id of ROLE_SPELL_WHITELIST.Supporto) {
      const name = SPELL_BY_ID[id]?.name
      if (!name) continue
      if (!spellVfxFor(name)) missing.push(`${id} (${name})`)
    }
    expect(missing, `no VFX entry: ${missing.join(', ')}`).toEqual([])
  })
})
```

- [ ] **Step 2: Run to find gaps**

Run: `npx vitest run tests/ui/supportoVfx.test.ts`
Expected: FAIL listing any Supporto spell whose lowercase NAME has no `SPELL_VFX` entry (candidates: `protego_maxima` → "Protego Maxima" exists; verify `colletivo scudo`, `aegis`, `incitamento`, `riddikulus`, `salvio hexia`, `fianto duri`, `expecto patronum`, `vulnera sanentur`, `anapneo`, `rennervate`, `ferula`, `episkey`). Note keys are the lowercased `name`, not the id.

- [ ] **Step 3: Add/tune entries in `lib/vfx/spellVfx.ts`**

For each missing spell, add an entry keyed by its lowercased name, tuned to its archetype:
- Guaritore (heal): `{ kind: 'heal', color: C.heal, impact: 'heal' | 'revive' | 'bandage' | 'bubbles' }`
- Scudiero (self/shield): `{ kind: 'self', color: C.shield, sigil: true, impact: 'hex' | 'wall' | 'absorb' }`
- Stratega (buff): `{ kind: 'self', color: C.gold, sigil: true, impact: 'rally' }`
- Purificatore: `{ kind: 'self', color: C.silver, sigil: true, impact: 'wind' }` (or a new `cleanse` impact if a distinct look is wanted — see Step 4)

Use only impacts already implemented in `choreograph.ts` unless Step 4 adds one.

- [ ] **Step 4 (optional): add a `cleanse` impact**

Only if the Purificatore needs a distinct visual: add `'cleanse'` to the impact union in `lib/vfx/spellVfx.ts` types and implement it in `lib/vfx/choreograph.ts` following the pattern of an existing self-impact (e.g. `wind`/`rally`) — a white-silver expanding ring. Otherwise skip and reuse `wind`.

- [ ] **Step 5: Run VFX test + typecheck**

Run: `npx vitest run tests/ui/supportoVfx.test.ts && npm run typecheck`
Expected: PASS + clean.

- [ ] **Step 6: Commit**

```bash
git add lib/vfx/spellVfx.ts lib/vfx/choreograph.ts tests/ui/supportoVfx.test.ts
git commit -m "feat(vfx): bespoke per-spell VFX for the Supporto archetype kit"
```

---

### Task 6: Full regression + balance re-measure + handoff

**Files:**
- Modify: `docs/superpowers/HANDOFF.md`

- [ ] **Step 1: Full suite**

Run: `npm run test`
Expected: all green (prior 1188 + new tests). Fix any test that asserted OLD Supporto pools (e.g. a fixture expecting serpensortia on a Supporto) by updating it to the new kit.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Balance re-measure**

Run: `npx vitest run tests/engine/campaignBalanceB.test.ts`
Expected: PASS (`winRate > 0`). Record the winRate numbers. If notably lower than the pre-change baseline (~0.358 B / ~0.375 restricted per HANDOFF), note it — the lever is buff/heal strength, NOT reintroducing serpensortia.

- [ ] **Step 4: Visual smoke (real GPU)**

Drive a battle featuring a Supporto (per HANDOFF playwright recipe, headed with `--use-gl=angle`), confirm the new support spell fires with its tuned VFX and the Supporto never attacks an enemy. Screenshot for the record.

- [ ] **Step 5: Update HANDOFF + commit + push**

Add a section to `docs/superpowers/HANDOFF.md` summarizing: 4 Supporto archetypes, role whitelist guard, serpensortia removed from Supporto/Tank/Controllo, per-spell VFX, balance numbers. Then:

```bash
git add docs/superpowers/HANDOFF.md
git commit -m "docs(handoff): Supporto archetypes + role whitelist + VFX"
git push origin master
```

---

## Self-review notes

- Spec coverage: archetypes (Task 2), whitelist all-roles (Task 1), Supporto=no-attack (Tasks 1–3), no-dead-turn (Task 2 test), dead-branch cleanup (Task 4), per-spell VFX (Task 5), balance re-measure (Task 6). All covered.
- The `Role` type import path (`@/types`) and `SPELL_BY_ID` (`@/data/spells`) match existing usage in `selectSpell.ts` / tests.
- Whitelist keys use spell IDs; VFX map keys use lowercased spell NAMES — Task 5 test bridges id→name via `SPELL_BY_ID`. This id-vs-name distinction is called out so the implementer doesn't key VFX by id.
