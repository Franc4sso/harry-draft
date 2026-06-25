# Battle Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the framer-motion spring/keyframe crash and apply five battle-screen refinements: controls above the arena, an end-of-battle modal, a name-free initiative rail, the role badge over the portrait, and removal of the buff/debuff number pills.

**Architecture:** All presentational, in `components/battle/**` + `components/screens/BattleScreen.tsx`. No engine/data changes. One new component `BattleEndModal`.

**Tech Stack:** Next.js (custom fork — read `node_modules/next/dist/docs/` before any Next-specific code), React, TypeScript, framer-motion, lucide-react, Tailwind, Vitest + Testing Library.

## Global Constraints

- Test runner: `npm run test` (Vitest). **Vitest does NOT typecheck** — after any `.ts`/`.tsx` edit, run `npx tsc --noEmit` and confirm 0 errors.
- All user-facing copy is **Italian** (match existing strings).
- **No engine/data changes.** Only `components/**`. Deterministic: no `Math.random`/`Date.now`.
- Every animation degrades to a static final state under `useReducedMotion()`; visible keyboard focus preserved.
- Premium palette already in use: gold `#C9A24B` / `#F0D98A`, ink-2 `rgba(20,16,33,…)`, glass + `backdrop-blur`, ally `#5BD6A0`, enemy `#E5616B`.
- Known flaky tests: `tests/ui/playFlow.test.tsx` and `tests/ui/campaignRunner.test.tsx` are parallel-timeout flakes that PASS in isolation (`npx vitest run <file>`). If one is the only red, confirm isolated, then it's fine. Any OTHER red is real.
- Commit after every task. Work on `master`; a concurrent writer may commit to master mid-session — verify `git rev-parse HEAD` before each commit and never `--amend` a commit no longer at HEAD. Push only at the final task.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `components/battle/UnitBust.tsx` | fix spring/keyframe; role badge over portrait; drop buff/debuff pills | Modify |
| `components/battle/InitiativeBar.tsx` | remove the unit name | Modify |
| `components/battle/BattleEndModal.tsx` | NEW — outcome modal | Create |
| `components/screens/BattleScreen.tsx` | controls above arena; render BattleEndModal | Modify |

---

## Task 1: Fix the spring/keyframe crash + drop buff/debuff pills + role badge over portrait

**Files:**
- Modify: `components/battle/UnitBust.tsx`
- Test: `tests/ui/unitBustImpact.test.tsx` (extend), `tests/ui/unitBustControl.test.tsx` (extend), or a new `tests/ui/unitBustPolish.test.tsx`

**Interfaces:** none new. The impact `x` shake animates as a `tween` (keyframe-array-safe); buff/debuff effects are excluded from the status-pill row; the role badge renders over the portrait area.

- [ ] **Step 1: Write the failing tests**

Create `tests/ui/unitBustPolish.test.tsx`:

```tsx
import { it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { UnitBust } from '@/components/battle/UnitBust'
import type { ReplayUnit, ActiveEffect } from '@/types'

const unit = {
  key: 'left:x', id: 'x', name: 'X', side: 'left', house: 'Grifondoro', role: 'Attaccante', tier: 3,
  maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10,
  spell: { id: 's', name: 'S', cooldown: 0 },
} as unknown as ReplayUnit

it('does not throw on an impact shake (spring + multi-keyframe guard)', () => {
  // A crit impact uses a multi-keyframe x array; the transition must not be a spring for x.
  expect(() =>
    render(<UnitBust unit={unit} hp={70} targeted float={{ text: '48', tone: 'crit' }} floatKey={1} />),
  ).not.toThrow()
})

it('does NOT render a pill for a buff or debuff effect', () => {
  const buff = { kind: 'buff', statusId: 'atkUp', remaining: 2, stat: 'atk', amount: 10 } as unknown as ActiveEffect
  const { container } = render(<UnitBust unit={unit} hp={100} effects={[buff]} />)
  expect(container.querySelector('[data-status-kind="buff"]')).toBeNull()
})

it('DOES render a pill for a control/dot effect', () => {
  const dot = { kind: 'dot', statusId: 'burn', remaining: 2, amount: 8 } as unknown as ActiveEffect
  const { container } = render(<UnitBust unit={unit} hp={100} effects={[dot]} />)
  expect(container.querySelector('[data-status-kind="dot"]')).toBeTruthy()
})

it('renders the role badge over the portrait (top area, with data-role-badge)', () => {
  const { container } = render(<UnitBust unit={unit} hp={100} />)
  const badge = container.querySelector('[data-role-badge]') as HTMLElement
  expect(badge).toBeTruthy()
  expect(badge.className).toMatch(/top-/) // positioned at the top over the portrait, not bottom-14
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- unitBustPolish`
Expected: FAIL — buff currently renders a pill; role badge has no `data-role-badge` and is `bottom-14`. (The throw test may already pass or fail depending on environment; the pill/badge tests fail for sure.)

- [ ] **Step 3: Fix the shake transition (Part 1)**

In `components/battle/UnitBust.tsx`, change the root `motion.div` `transition` (currently `transition={{ type: 'spring', stiffness: 360, damping: 22 }}`) so the `x` property uses a tween when impacting (keyframe arrays are invalid on springs):

```tsx
      transition={{
        type: 'spring', stiffness: 360, damping: 22,
        x: impact
          ? { type: 'tween', duration: isCrit ? 0.4 : 0.28, ease: 'easeOut' }
          : { type: 'spring', stiffness: 360, damping: 22 },
      }}
```

(`impact` and `isCrit` are already computed in the component.)

- [ ] **Step 4: Drop buff/debuff pills (Part 6)**

In the status-pill row, exclude `buff`/`debuff` kinds. Change the effects iteration so it filters first. Replace the row's `{effects.map((e, i) => {` opening with a filtered list — change the guard and the map:

```tsx
      {effects.some(e => e.kind !== 'buff' && e.kind !== 'debuff') && (
        <div className={cn('absolute top-1 flex flex-wrap gap-0.5', mirrored ? 'left-1' : 'right-1')}>
          {effects.filter(e => e.kind !== 'buff' && e.kind !== 'debuff').map((e, i) => {
            const Icon = STATUS_ICON[e.kind] ?? Flame
            return (
              <span
                key={`${e.kind}-${e.statusId ?? i}`}
                data-status-kind={e.kind}
                title={describeEffect(e)}
                className={cn('inline-flex items-center gap-0.5 rounded bg-black/55 px-0.5 text-[9px] font-semibold tabular-nums', STATUS_CLASS[e.kind])}
              >
                <Icon size={11} aria-hidden />
                {effectCount(e)}
              </span>
            )
          })}
        </div>
      )}
```

(Note: with buff/debuff filtered out, the pill body no longer needs the `magnitudeLabel` branch — it's now always `effectCount(e)`. If `magnitudeLabel` becomes unreferenced after this, remove it AND `isPct` if also unreferenced; run tsc to confirm. `describeEffect` still uses them — check: `describeEffect` calls `magnitudeLabel` in its buff/debuff cases, so `magnitudeLabel`/`isPct` stay referenced via `describeEffect`. Leave them. Only remove if tsc reports them unused.)

- [ ] **Step 5: Move the role badge over the portrait (Part 5)**

Replace the role-badge block (currently `<div className={cn('absolute bottom-14 …`) so it sits at the TOP over the portrait, on the OPPOSITE corner from the status pills. Status pills are at `top-1` on `mirrored ? left-1 : right-1`; so the role badge goes `top-1` on `mirrored ? right-1 : left-1`, and carries `data-role-badge`:

```tsx
      <div data-role-badge className={cn('absolute top-1 z-10 pointer-events-none', mirrored ? 'right-1' : 'left-1')}>
        {(() => {
          const RoleIcon = ROLE_ICON[unit.role] ?? Shield
          return (
            <span
              title={unit.role === 'Tank' ? 'Provocazione: i nemici attaccano questo bersaglio per primi' : unit.role}
              className={cn('inline-flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[9px] font-semibold backdrop-blur-sm',
                unit.role === 'Tank' ? 'text-sky-300' : 'text-white/80')}
            >
              <RoleIcon size={9} aria-hidden />
              {ROLE_LABEL[unit.role] ?? unit.role}
            </span>
          )
        })()}
      </div>
```

- [ ] **Step 6: Run, verify pass**

Run: `npm run test -- unitBustPolish` → PASS (4/4)
Run: `npm run test -- unitBust` and `npm run test -- unitBustStats` and `npm run test -- unitBustControl` and `npm run test -- unitBustImpact` → green. If a prior test asserted a buff pill's magnitude text or the old `bottom-14` badge, update it to the new behavior (no buff pill / badge over portrait), keeping it meaningful.

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add components/battle/UnitBust.tsx tests/ui/unitBustPolish.test.tsx tests/
git commit -m "fix(battle-ui): tween impact shake (spring 2-frame crash), drop buff/debuff pills, role badge over portrait"
```

---

## Task 2: Initiative rail without the unit name

**Files:**
- Modify: `components/battle/InitiativeBar.tsx`
- Test: `tests/ui/initiativeBar.test.tsx` (extend)

**Interfaces:** none new. The slot no longer renders the unit name; face + spd + side glyph remain.

- [ ] **Step 1: Write the failing test**

In `tests/ui/initiativeBar.test.tsx`, add:

```tsx
it('does not render the unit name in the rail', () => {
  render(<InitiativeBar replay={replay} index={0} />)
  // The fixture units are named 'Aaa' / 'Bbb' — they must NOT appear as text now.
  expect(screen.queryByText('Aaa')).toBeNull()
  expect(screen.queryByText('Bbb')).toBeNull()
})
```

(The face `<img alt={name}>` keeps the name only as `alt`, which `queryByText` does not match — so this asserts the visible name text is gone while the face remains.)

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- initiativeBar`
Expected: FAIL — the name span still renders "Aaa"/"Bbb".

- [ ] **Step 3: Remove the name span**

In `components/battle/InitiativeBar.tsx`, in each slot remove the unit-name span (the `<span className="truncate text-[10px] text-white/85">{u.name}</span>` and its wrapper if the wrapper only held the name + side glyph). Keep the side glyph (▲/▼) and the spd row. Concretely, the per-slot content should become: the face `div`, then a small column with the ▲/▼ side glyph and the spd row — no name. Update the slot's inner JSX so the name line is gone but the ⚡spd line and the ▲/▼ glyph remain. If the side glyph was inline with the name, keep the glyph on its own.

After the edit, the slot renders: face (with side ring) + a compact `⚡ {spd}` line + the ▲/▼ glyph; the "Ora" label on the current unit stays.

- [ ] **Step 4: Run, verify pass**

Run: `npm run test -- initiativeBar` → PASS
Run: `npm run test -- "tests/ui/battle"` → green (update any battle test that asserted a unit name inside the initiative rail; the name elsewhere — busts, action panel — is unaffected)
Run: `npx tsc --noEmit` → 0 errors

- [ ] **Step 5: Commit**

```bash
git add components/battle/InitiativeBar.tsx tests/ui/initiativeBar.test.tsx tests/
git commit -m "feat(battle-ui): remove the unit name from the initiative rail"
```

---

## Task 3: BattleEndModal component

**Files:**
- Create: `components/battle/BattleEndModal.tsx`
- Test: `tests/ui/battleEndModal.test.tsx` (create)

**Interfaces:**
- Produces: `BattleEndModal({ outcome, onConfirm })` where `outcome: 'win' | 'loss'`, `onConfirm: () => void`. Renders a `role="dialog"` `aria-modal` overlay with the outcome title ("Vittoria" / "Sconfitta"), a single button ("Continua" for win, "Vedi esito" for loss) calling `onConfirm`, and a dimmed premium backdrop. Container `data-testid="battle-end-modal"`. Esc and the button both call `onConfirm`; the button is focused on mount.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/battleEndModal.test.tsx`:

```tsx
import { it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BattleEndModal } from '@/components/battle/BattleEndModal'

it('renders the win outcome and confirms', () => {
  const onConfirm = vi.fn()
  render(<BattleEndModal outcome="win" onConfirm={onConfirm} />)
  expect(screen.getByTestId('battle-end-modal').getAttribute('role')).toBe('dialog')
  expect(screen.getByText('Vittoria')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Continua/i }))
  expect(onConfirm).toHaveBeenCalledOnce()
})

it('renders the loss outcome with the right button', () => {
  render(<BattleEndModal outcome="loss" onConfirm={() => {}} />)
  expect(screen.getByText('Sconfitta')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Vedi esito/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- battleEndModal`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement BattleEndModal**

Create `components/battle/BattleEndModal.tsx`:

```tsx
'use client'
import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/Button'

/**
 * End-of-battle modal: a dimmed premium overlay with the outcome and a single
 * action, so the player never hunts for a "continue" button. Shown after the
 * replay finishes. Esc or the button confirm.
 */
export function BattleEndModal({
  outcome, onConfirm,
}: {
  outcome: 'win' | 'loss'
  onConfirm: () => void
}) {
  const reduce = useReducedMotion()
  const btnRef = useRef<HTMLButtonElement>(null)
  const win = outcome === 'win'

  useEffect(() => {
    btnRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onConfirm() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onConfirm])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-6">
      <motion.div
        data-testid="battle-end-modal"
        role="dialog"
        aria-modal="true"
        aria-label={win ? 'Vittoria' : 'Sconfitta'}
        initial={reduce ? false : { opacity: 0, scale: 0.92, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="w-full max-w-sm rounded-2xl border border-[#C9A24B]/40 bg-[rgba(20,16,33,0.92)] px-6 py-7 text-center shadow-[0_0_40px_rgba(201,162,75,0.18)]"
      >
        <h2 className={win ? 'font-display text-3xl text-[#F0D98A]' : 'font-display text-3xl text-rose-300'}>
          {win ? 'Vittoria' : 'Sconfitta'}
        </h2>
        <p className="mt-2 text-sm text-white/55">
          {win ? 'La squadra avversaria è stata sconfitta.' : 'La tua squadra è caduta.'}
        </p>
        <div className="mt-6">
          <Button ref={btnRef} onClick={onConfirm}>
            {win ? 'Continua' : 'Vedi esito'}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
```

CONFIRMED: `components/ui/Button.tsx` is a plain function component that does NOT forward a ref. So do NOT use `ref={btnRef}` on `<Button>`. Instead focus via a wrapping element. Use this exact pattern: put a ref on the wrapper div and focus the button inside it.

Replace the button block + the ref/effect with:

```tsx
  const wrapRef = useRef<HTMLDivElement>(null)
  const win = outcome === 'win'

  useEffect(() => {
    wrapRef.current?.querySelector('button')?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onConfirm() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onConfirm])
```

and the button block:

```tsx
        <div ref={wrapRef} className="mt-6">
          <Button onClick={onConfirm}>
            {win ? 'Continua' : 'Vedi esito'}
          </Button>
        </div>
```

(Remove `btnRef`/`useRef<HTMLButtonElement>` entirely.)

- [ ] **Step 4: Run, verify pass**

Run: `npm run test -- battleEndModal` → PASS (2/2)
Run: `npx tsc --noEmit` → 0 errors

- [ ] **Step 5: Commit**

```bash
git add components/battle/BattleEndModal.tsx tests/ui/battleEndModal.test.tsx
git commit -m "feat(battle-ui): BattleEndModal — outcome overlay with a single action"
```

---

## Task 4: BattleScreen — controls above the arena + end modal

**Files:**
- Modify: `components/screens/BattleScreen.tsx`
- Test: `tests/ui/battle.test.tsx`

**Interfaces:**
- Consumes: `BattleEndModal` (Task 3). Uses the existing `r.done`, `result.winner`, `onFinish`.
- Produces: the playback controls row moves to directly under the header (above the grid); while `!r.done` it shows only the playback buttons; when `r.done` the inline Continua/Vedi-esito button is replaced by `<BattleEndModal outcome={result.winner === 'left' ? 'win' : 'loss'} onConfirm={onFinish} />` rendered at the end of `main`.

- [ ] **Step 1: Write the failing assertions**

In `tests/ui/battle.test.tsx`, add (reuse the file's BattleScreen render helper; if the helper drives a finished replay, assert the modal — otherwise assert control order on a mid-replay render):

```tsx
it('renders the playback controls above the battle grid', () => {
  renderBattleScreen() // file's existing helper (mid-replay)
  // The controls row contains the speed button "1×"/"2×"… or the "Passo" button.
  const passo = screen.getByRole('button', { name: /Passo/i })
  const arena = screen.getByTestId('battle-arena')
  // Controls appear before the arena in the DOM.
  expect(passo.compareDocumentPosition(arena) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
```

If the file's helper renders a FINISHED replay (no Passo button), instead assert the modal:

```tsx
it('shows the end modal when the battle is done', () => {
  renderFinishedBattle() // if such a helper exists; else simulate r.done
  expect(screen.queryByTestId('battle-end-modal')).toBeInTheDocument()
})
```

Pick the assertion matching the file's existing helper. If only a mid-replay helper exists, use the control-order test; the modal is covered by Task 3's own test.

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- "tests/ui/battle"`
Expected: FAIL — controls are currently below the arena.

- [ ] **Step 3: Move the controls above the grid**

In `components/screens/BattleScreen.tsx`:
1. Import `BattleEndModal`: `import { BattleEndModal } from '@/components/battle/BattleEndModal'`.
2. Cut the controls `<div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3"> … </div>` block and move it to directly AFTER the header `<div>` (the one with `<h1>` + the turn subtitle), BEFORE the battle grid `<div className="grid …">`.
3. In that controls block, REMOVE the `r.done` branch that rendered the inline `<Button onClick={onFinish}>{result.winner === 'left' ? 'Continua' : 'Vedi esito'}</Button>`. The controls now render ONLY the `!r.done` playback buttons; when `r.done`, render nothing there (or a thin disabled state). The cleanest: wrap the whole controls block in `{!r.done && ( … )}` so it disappears when done.
4. At the END of `main` (after `BattleLog`), render the modal when done:

```tsx
      {r.done && (
        <BattleEndModal outcome={result.winner === 'left' ? 'win' : 'loss'} onConfirm={onFinish} />
      )}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm run test -- "tests/ui/battle"` → PASS
Run: `npm run test -- campaignRunner` → this exercises the full run flow. The known flow (verified): the test clicks "salta" (a playback control, unaffected), then `findByRole('button', { name: /continua|vedi esito/i })` and clicks it, then `findByText(/Vittoria|Sconfitta/i)`.

With the modal, that Continua/Vedi-esito button now lives INSIDE the `role="dialog"` modal with the SAME accessible name, so `findByRole('button', {name:/continua|vedi esito/i})` STILL finds it — the query is role+name, not scoped outside dialogs. Clicking it calls `onFinish`, which unmounts the modal and advances to the result screen; the subsequent `findByText(/Vittoria|Sconfitta/i)` then resolves on the result screen.

CAVEAT: the modal ALSO renders the word "Vittoria"/"Sconfitta" as its `<h2>`. The test's `findByText(/Vittoria|Sconfitta/i)` runs AFTER the click (modal already unmounting), so it should match the result screen, not the modal. BUT if `findByText` races the modal's still-present text, it could match the modal's h2 instead — harmless (same word) but make sure the assertion still passes. Run campaignRunner isolated (`npx vitest run tests/ui/campaignRunner.test.tsx`) and confirm green. If it flakes on the double "Vittoria" text, scope the final assertion to the result screen (e.g. `findAllByText` or a result-screen-specific testid) — keep it meaningful, do not weaken. Distinguish a real break from the known parallel-timeout flake by the isolated run.

- [ ] **Step 5: Full suite + typecheck + build**

Run: `npm run test` → all green except known flakes (confirm isolated).
Run: `npx tsc --noEmit` → 0 errors.
Run: `npm run build` → succeeds.

- [ ] **Step 6: Commit**

```bash
git add components/screens/BattleScreen.tsx tests/ui/battle.test.tsx tests/
git commit -m "feat(battle-ui): controls above the arena + end-of-battle modal"
```

---

## Task 5: Final verification + build + push

**Files:** none (verification only).

- [ ] **Step 1: Full suite** — `npm run test` → all green (any red is a known flake passing in isolation).
- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → 0 errors.
- [ ] **Step 3: Build** — `npm run build` → succeeds.
- [ ] **Step 4: Confirm HEAD then push**

```bash
git rev-parse HEAD
git log --oneline -6
git push origin master
```

(Verify HEAD is this session's work before pushing — concurrent writer possible.)

---

## Self-Review notes

- **Spec coverage:** Part 1 spring fix → Task 1; Part 2 controls above → Task 4; Part 3 end modal → Tasks 3 (component) + 4 (wiring); Part 4 no name → Task 2; Part 5 role badge over portrait → Task 1; Part 6 drop buff pills → Task 1; Part 7 damage doc → no code (in spec only). All covered.
- **Type consistency:** `BattleEndModal({ outcome: 'win'|'loss', onConfirm })` defined in Task 3 consumed identically in Task 4 (`outcome={result.winner === 'left' ? 'win' : 'loss'}`). `data-role-badge`, `data-status-kind` test hooks introduced + asserted in Task 1. No cross-task signature drift.
- **Task 1 grouping:** the three UnitBust changes (spring, pills, badge) all touch the same file/render and are reviewed together — splitting would churn the same file three times.
- **Ref caveat (Task 3):** flagged inline — confirm `Button` forwards a ref before using `ref={btnRef}`; fallback provided.
- **Modal-vs-inline (Task 4):** the inline done-button is REMOVED so the action isn't duplicated; the modal carries the same accessible names ("Continua"/"Vedi esito") so existing role/name queries keep working.
- **No engine/data edits** in any task — components only.
