# Veleno Loadout (P8 agency) — Implementation Plan (Plan C of the Veleno slice)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give the player the pre-battle agency lever: choose which spell each wizard equips (from its `spellPool`), persisted across the run and used by the next battle — and make `serpensortia` apply `veleno`, so equipping it is a real veleno-build choice.

**Architecture:** A pure `setWizardSpell(state, wizardId, spellId)` engine function (team is `DraftedWizard[]`; `dw.spell` is the active spell, already persisted; `toBattleUnits` spreads `dw` so the next battle picks up the change with no caching). A controller action surfaces it; a functional `LoadoutPanel` in the existing team sidebar drives it. The drama callouts (on-screen "VELENO ×N", MVP recap) are intentionally OUT of scope — deferred for the user's visual direction.

**Tech Stack:** TypeScript, Next.js (App Router; interactive components need `'use client'`), Vitest. Builds on Plans A/B/D (merged).

## Global Constraints

- **Determinism:** `setWizardSpell` is pure, consumes no RNG; existing seeded tests unaffected (no run auto-changes a spell).
- **Backward compatibility:** existing tests stay green (current baseline 688). Persistence schema already stores the full `Spell` object per team member (`lib/runStore.ts` VERSION 2) — no version bump.
- **Pool guard:** a wizard's active spell may only be set to a spell in its own `spellPool`; unknown or out-of-pool ids are a no-op.
- **Next.js (repo AGENTS.md "this is NOT the Next.js you know"):** interactive client components MUST start with `'use client'` (as `components/screens/RunBRunner.tsx:1`, `hooks/useRunB.ts:1` do). App Router; no server actions; state via the `useRunB` controller. Before writing the component, skim `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` and follow the existing component idioms in `components/run/TeamSynergyBar.tsx` (PortraitImage, Chip, houseTheme, displayName).
- **serpensortia stays a damage spell** that ALSO applies veleno — do not remove its damage.

---

## File Structure

- **Modify** `game/engine/runEngine.ts` — add `setWizardSpell(state, wizardId, spellId): RunState`.
- **Modify** `hooks/useRunB.ts` — add `setWizardSpell` to `RunBController` + a `useCallback`.
- **Modify** `data/spells.ts` — `serpensortia` applies `veleno` on hit (keep its damage).
- **Create** `components/run/LoadoutPanel.tsx` — the per-wizard spell picker (functional UI).
- **Modify** `components/screens/RunBRunner.tsx` — render `LoadoutPanel` in `withTeamSidebar`, wired to the controller.
- **Test** `tests/engine/loadout.test.ts` — `setWizardSpell` + serpensortia-applies-veleno.

---

### Task 1: `setWizardSpell` engine action + controller wiring

**Files:**
- Modify: `game/engine/runEngine.ts`
- Modify: `hooks/useRunB.ts`
- Test: `tests/engine/loadout.test.ts` (create)

**Interfaces produced:** `setWizardSpell(state: RunState, wizardId: string, spellId: string): RunState` (pure; sets that team member's `spell` to `SPELL_BY_ID[spellId]` iff `spellId ∈ wizard.spellPool`, else returns state unchanged). `RunBController.setWizardSpell(wizardId: string, spellId: string): void`.

- [ ] **Step 1: Write the failing engine test**

Create `tests/engine/loadout.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { startRunB, chooseStarters, setWizardSpell } from '@/game/engine/runEngine'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

function startedRun() {
  // Pick two starters whose spellPools we can read; Serpeverde has dolohov (has serpensortia).
  let s = startRunB('loadout-1')
  const ids = ['dolohov', 'bellatrix']
  s = chooseStarters(s, 'Serpeverde', ids, createRng('loadout-1'))
  return s
}

describe('setWizardSpell', () => {
  it('sets a team member spell to another spell from its pool', () => {
    const s = startedRun()
    const dolohov = s.team.find(d => d.wizard.id === 'dolohov')!
    const target = dolohov.wizard.spellPool.find(id => id !== dolohov.spell.id)!
    const next = setWizardSpell(s, 'dolohov', target)
    expect(next.team.find(d => d.wizard.id === 'dolohov')!.spell.id).toBe(target)
    // other members untouched, original state not mutated
    expect(s.team.find(d => d.wizard.id === 'dolohov')!.spell.id).not.toBe(target)
  })
  it('is a no-op for a spell not in the wizard pool', () => {
    const s = startedRun()
    const next = setWizardSpell(s, 'dolohov', 'avada') // not in dolohov.spellPool
    expect(next).toBe(s)
  })
  it('is a no-op for an unknown wizard', () => {
    const s = startedRun()
    expect(setWizardSpell(s, 'nobody', 'crucio')).toBe(s)
  })
})
```

> Note: the test assumes `chooseStarters(state, house, ids, rng)` exists (it does — used in `tests/engine/campaignBalanceB.test.ts`). If the starter ids aren't accepted directly, mirror that file's `starterOffer`→`chooseStarters` flow. `'avada'` is assumed NOT in dolohov's pool (his pool is `['confringo','sectumsempra','reducto','serpensortia']`); if it is, pick any id not in the pool.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine/loadout.test.ts`
Expected: FAIL — `setWizardSpell` not exported.

- [ ] **Step 3: Implement `setWizardSpell`**

In `game/engine/runEngine.ts`: ensure `SPELL_BY_ID` is imported (`import { SPELL_BY_ID } from '@/data/spells'` — add if absent), then add:

```typescript
/** Equip `spellId` as the active spell for team member `wizardId`, iff it is in that
 *  wizard's spellPool. Pure; no RNG. Returns the same state object on a no-op. */
export function setWizardSpell(state: RunState, wizardId: string, spellId: string): RunState {
  const spell = SPELL_BY_ID[spellId]
  const member = state.team.find(d => d.wizard.id === wizardId)
  if (!spell || !member || !member.wizard.spellPool.includes(spellId) || member.spell.id === spellId) {
    return state
  }
  const team = state.team.map(d => (d.wizard.id === wizardId ? { ...d, spell } : d))
  return { ...state, team }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/engine/loadout.test.ts`
Expected: PASS (all 3).

- [ ] **Step 5: Wire the controller action**

In `hooks/useRunB.ts`: add to the `RunBController` interface (next to `chooseRelic`):

```typescript
  setWizardSpell: (wizardId: string, spellId: string) => void
```

Import `setWizardSpell` from `'@/game/engine/runEngine'` (extend the existing import). Add the callback (mirroring the `commit` pattern, e.g. near `chooseRelic`):

```typescript
  const setWizardSpellCb = useCallback((wizardId: string, spellId: string) => {
    commit(setWizardSpell(runRef.current, wizardId, spellId))
  }, [commit])
```

and expose it in the returned controller object: `setWizardSpell: setWizardSpellCb,`.

> Verify the exact local names (`runRef`, `commit`) against the file — they are confirmed present (`hooks/useRunB.ts:62-65`). `commit(next)` persists via `saveRun` and refreshes the view.

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: PASS (688 + 3 new = 691). No run logic auto-calls `setWizardSpell`, so seeded runs are unchanged.

- [ ] **Step 7: Commit**

```bash
git add game/engine/runEngine.ts hooks/useRunB.ts tests/engine/loadout.test.ts
git commit -m "feat(loadout): setWizardSpell engine action + controller wiring"
```

---

### Task 2: `serpensortia` applies veleno (the spell worth equipping)

**Files:**
- Modify: `data/spells.ts` (serpensortia)
- Test: `tests/engine/loadout.test.ts` (append)

**Interfaces:** Consumes the `veleno` status (Plan A) and the `applyStatus` effect spec. Produces: casting `serpensortia` deals its damage AND applies a `veleno` stack to the enemy.

- [ ] **Step 1: Determine the correct on-cast spec shape (grounding)**

Before editing, read `game/engine/combat/resolve.ts` (the `resolveAction` path) to confirm how a spell's damage + status are resolved — specifically whether a spell uses top-level `power` for damage with `effects`/`spec` for extra status, or whether `spec` fully describes the action (as `glacius` does: `spec: [{ kind:'applyStatus', target:'enemy', statusId:'freeze', duration:1 }]`, no `power`). Match whichever the engine actually executes so serpensortia keeps dealing damage AND applies veleno. Note your finding in the report.

- [ ] **Step 2: Write the failing test**

Append to `tests/engine/loadout.test.ts`:

```typescript
import { simulateBattle } from '@/game/engine/combat/simulate'
import { SPELL_BY_ID } from '@/data/spells'
import type { DraftedWizard } from '@/types'

function caster(id: string, spellId: string): DraftedWizard {
  const wizard = WIZARDS.find(w => w.id === id)!
  return { wizard, stats: { hp: 300, atk: 40, def: 15, spd: 40 }, maxHp: 300, spell: SPELL_BY_ID[spellId]! }
}

describe('serpensortia applies veleno', () => {
  it('a serpensortia caster poisons the enemy (dot flag appears against right)', () => {
    const left = [caster('dolohov', 'serpensortia')]
    const right = [{ ...caster('greyback', 'serpensortia'), stats: { hp: 800, atk: 1, def: 10, spd: 1 }, maxHp: 800 }]
    const r = simulateBattle(left, right, createRng('serp-1'))
    const poisoned = r.log.some(e => e.targetSide === 'right' && e.flags.includes('dot'))
    expect(poisoned).toBe(true)
  })
})
```

- [ ] **Step 3: Run the test (fails or passes depending on current serpensortia)**

Run: `npx vitest run tests/engine/loadout.test.ts`
Expected: FAIL — serpensortia currently applies a generic inline `dot` (`effects: [{ kind:'dot', amount:6, duration:2 }]`), which logs the `dot` flag from a different status; we want the `veleno` accumulate status specifically. (If it already passes via the inline dot's flag, strengthen the assertion in Step 4 to check a `veleno` status entry exists in a snapshot rather than just the flag.)

- [ ] **Step 4: Edit serpensortia to apply `veleno`**

In `data/spells.ts`, change the `serpensortia` entry so it deals damage AND applies the `veleno` status (using the shape confirmed in Step 1). The intended effect, expressed against the existing `applyStatus` spec:

```typescript
{ id: 'serpensortia', name: 'Serpensortia', desc: 'Evoca un serpente velenoso che morde.', type: 'Attacco', power: 1.4, hitChance: 0.85, cooldown: 1, spec: [{ kind: 'applyStatus', target: 'enemy', statusId: 'veleno', duration: 2 }] },
```

> If Step 1 showed that a top-level `power` is NOT applied when `spec` is present (i.e. `spec` replaces the base action), then include the damage in `spec` instead: `spec: [{ kind: 'damage', power: 1.4, canCrit: true, canDodge: true }, { kind: 'applyStatus', target: 'enemy', statusId: 'veleno', duration: 2 }]` and drop top-level `power`. Use the form that keeps BOTH damage and veleno. Tag it `keywords: ['veleno']` if the Spell type supports it (Plan A added `keywords?` to Spell).

- [ ] **Step 5: Run the test (passes)**

Run: `npx vitest run tests/engine/loadout.test.ts`
Expected: PASS — a `veleno` stack is applied (dot flag on right).

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: PASS. If a seeded snapshot/balance test shifts because serpensortia changed behavior (some enemy/draft team may cast it), investigate: a snapshot for a battle that includes a serpensortia caster legitimately changes — update that ONE snapshot only after confirming the change is exactly the veleno-vs-old-dot difference, and note it. Do not mass-update.

- [ ] **Step 7: Commit**

```bash
git add data/spells.ts tests/engine/loadout.test.ts
git commit -m "feat(loadout): serpensortia applies the veleno status (worth equipping)"
```

---

### Task 3: LoadoutPanel UI in the team sidebar

**Files:**
- Create: `components/run/LoadoutPanel.tsx`
- Modify: `components/screens/RunBRunner.tsx` (render it in `withTeamSidebar`)

**Interfaces:** Consumes `RunBController.setWizardSpell` (Task 1), `state.team`, `SPELL_BY_ID`. Produces a functional per-wizard spell picker.

- [ ] **Step 1: Build the LoadoutPanel component**

Create `components/run/LoadoutPanel.tsx`. Follow the idioms in `components/run/TeamSynergyBar.tsx` (same folder) — reuse its imports for `PortraitImage`, `Chip`, `displayName`, `houseTheme` (verify their exact import paths and prop signatures in that file). Functional, accessible, lightly styled (the user will refine visuals later):

```tsx
'use client'

import { useState } from 'react'
import { SPELL_BY_ID } from '@/data/spells'
import type { DraftedWizard } from '@/types'
// Reuse the same imports TeamSynergyBar uses (verify paths against that file):
import { PortraitImage } from '@/components/run/PortraitImage'
import { displayName } from '@/components/run/TeamSynergyBar' // or wherever displayName lives — match the real export

export function LoadoutPanel({
  team, onSetSpell,
}: {
  team: DraftedWizard[]
  onSetSpell: (wizardId: string, spellId: string) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Loadout</span>
      <ul className="mt-2 flex flex-col gap-1.5">
        {team.map((m) => {
          const expanded = open === m.wizard.id
          return (
            <li key={m.wizard.id} className="rounded-xl bg-black/30">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : m.wizard.id)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-2 p-1.5 text-left"
              >
                <span className="h-8 w-8 shrink-0 overflow-hidden rounded-md">
                  <PortraitImage id={m.wizard.id} house={m.wizard.house} alt={m.wizard.name} variant="bust" />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/85">{m.wizard.name}</span>
                <span className="truncate text-[11px] text-white/55">{m.spell.name}</span>
              </button>
              {expanded && (
                <div className="flex flex-wrap gap-1 px-1.5 pb-1.5" role="group" aria-label={`Incantesimi di ${m.wizard.name}`}>
                  {m.wizard.spellPool.map((sid) => {
                    const spell = SPELL_BY_ID[sid]
                    if (!spell) return null
                    const active = m.spell.id === sid
                    return (
                      <button
                        key={sid}
                        type="button"
                        onClick={() => onSetSpell(m.wizard.id, sid)}
                        aria-pressed={active}
                        title={spell.desc}
                        className={
                          'rounded-md border px-2 py-0.5 text-[11px] transition ' +
                          (active
                            ? 'border-amber-300/70 bg-amber-300/15 text-amber-100'
                            : 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10')
                        }
                      >
                        {spell.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

> Adjust the imports for `PortraitImage`/`displayName` to their real locations (open `TeamSynergyBar.tsx` and copy its import lines). If `displayName` isn't needed, drop it (the panel uses `m.wizard.name` directly). Keep it `'use client'`.

- [ ] **Step 2: Render it in the sidebar**

In `components/screens/RunBRunner.tsx`, import the panel (`import { LoadoutPanel } from '@/components/run/LoadoutPanel'`) and add it inside the `withTeamSidebar` `<aside>` (after the relics block, `RunBRunner.tsx:31-42`):

```tsx
      <LoadoutPanel team={c.run.team} onSetSpell={c.setWizardSpell} />
```

> `c` is the `RunBController` in scope in that wrapper (it reads `c.run.team`, `c.run.relics` already). `c.setWizardSpell` comes from Task 1.

- [ ] **Step 3: Type-check and run the suite**

Run: `npx tsc --noEmit` (expect clean) then `npx vitest run` (expect 691 green — no test renders the sidebar, but tsc proves the wiring types).

- [ ] **Step 4: Verify it renders (manual/visual smoke)**

If a component test harness exists for sidebar components (see `tests/ui/` for patterns, e.g. a RunBRunner or TeamSynergyBar test), add a minimal render test asserting the LoadoutPanel shows each team member's current spell name and that clicking a pool spell calls `onSetSpell(wizardId, spellId)`. If no such harness pattern exists, state that in the report and rely on the tsc + the engine tests; do not invent a heavy test setup.

- [ ] **Step 5: Commit**

```bash
git add components/run/LoadoutPanel.tsx components/screens/RunBRunner.tsx
git commit -m "feat(loadout): per-wizard spell picker in the team sidebar"
```

---

## Self-Review

**1. Spec coverage (slice spec §5 loadout = P8 agency lever):**
- Choose each wizard's active spell from its pool, persisted, used next battle → Tasks 1+3. ✓
- A spell worth equipping for veleno (`serpensortia` applies veleno) → Task 2. ✓
- Drama callouts + MVP recap (slice spec §7) → DEFERRED (user's visual direction), explicitly out of scope.

**2. Placeholder scan:** none in the engine tasks. Task 2 Step 1 and Task 3 Step 1 contain bounded, instructed verifications (the exact on-cast spec shape; the real `PortraitImage`/`displayName` import paths) — these are "confirm against the neighbouring file" steps with concrete fallbacks, not TBDs.

**3. Type consistency:** `setWizardSpell(state, wizardId, spellId)` signature identical across engine (Task 1 Step 3), controller (Task 1 Step 5), and UI prop `onSetSpell` (Task 3). `RunBController.setWizardSpell` matches the callback. `SPELL_BY_ID` used consistently. `serpensortia` keeps `id: 'serpensortia'`.

---

## What this leaves (the remaining slice piece)
**Drama & feedback (slice spec §7), gated on the user's visual direction:** on-screen "VELENO ×N" / threshold callouts in `BattleScreen`, and an MVP/recap that surfaces poison damage. The stack data already flows through battle snapshots, so this is presentation-only. Plus the separately-flagged **Serpeverde house rebalance** (out of slice scope).
