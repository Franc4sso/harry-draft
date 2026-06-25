# Battle Premium Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the clipped initiative rail, replace the status legend with a dual-team damage recap, give the cards/stats room, anchor synergies to their team, shrink portraits, turn the action box into a narrative centerpiece, and apply a restrained "grimorio premium" (gold-on-violet, glass) look — all presentational.

**Architecture:** Every change is in `components/battle/**` + `components/screens/BattleScreen.tsx`. No engine/data changes. `BattleRecap` gains `title`/`tone`; `ActionPanel` becomes the narrative signature; `StatusLegend` usage is removed.

**Tech Stack:** Next.js (custom fork — read `node_modules/next/dist/docs/` before any Next-specific code), React, TypeScript, framer-motion, lucide-react, Tailwind, Vitest + Testing Library.

## Global Constraints

- Test runner: `npm run test` (Vitest). **Vitest does NOT typecheck** — after any `.ts`/`.tsx` edit, run `npx tsc --noEmit` and confirm 0 errors.
- All user-facing copy is **Italian** (match existing strings).
- **No engine/data changes.** Only `components/**`. Deterministic: no `Math.random`/`Date.now`.
- Every animation degrades to a static final state under `useReducedMotion()`. Visible keyboard focus preserved.
- Premium palette: ink `#0B0814`, ink-2 `#141021`, gold `#C9A24B`, gold-bright `#F0D98A`, ally `#5BD6A0`, enemy `#E5616B`, glass `rgba(20,16,33,0.55)` + `backdrop-blur`. One signature element (the action box); everything else quiet.
- Known flaky tests: `tests/ui/playFlow.test.tsx` and `tests/ui/campaignRunner.test.tsx` are parallel-timeout flakes that PASS in isolation (`npx vitest run <file>`). If one is the only red, confirm isolated, then it's fine. Any OTHER red is real.
- Commit after every task. Work on `master`; a concurrent writer may commit to master mid-session — verify `git rev-parse HEAD` before each commit and never `--amend` a commit no longer at HEAD. Push only at the final task.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `components/battle/BattleRecap.tsx` | `title` + `tone` props; premium styling | Modify |
| `components/battle/InitiativeBar.tsx` | fit wider column, no clip; smaller face | Modify |
| `components/battle/StatBar.tsx` | taller/clearer premium bar (API unchanged) | Modify |
| `components/battle/UnitBust.tsx` | roomy stats; smaller portrait; premium card | Modify |
| `components/battle/ActionPanel.tsx` | narrative box + outcome token + Italian sentence | Modify |
| `components/battle/ArenaBackdrop.tsx` | retune to gold/violet | Modify |
| `components/screens/BattleScreen.tsx` | grid fix; anchored synergies; dual recap side col; remove legend + bottom recap; premium shell | Modify |

---

## Task 1: BattleRecap gains `title` + `tone`

**Files:**
- Modify: `components/battle/BattleRecap.tsx`
- Test: `tests/ui/battleRecap.test.tsx` (extend)

**Interfaces:**
- Produces: `BattleRecap` gains `title?: string` (default `'Resoconto squadra'`) and `tone?: 'ally' | 'enemy'` (default `'ally'`). The panel renders `title` as its header and a tone accent (ally = emerald/gold, enemy = ruby). Container keeps `data-testid="battle-recap"` and gains `data-tone`.

- [ ] **Step 1: Write the failing test**

In `tests/ui/battleRecap.test.tsx`, add:

```tsx
it('renders a custom title and enemy tone', () => {
  render(<BattleRecap frames={[{ index: 0, entry: null, hp: {}, cooldowns: {}, statusEffects: {} } as any]} units={[]} side="right" title="Danni nemici" tone="enemy" />)
  const panel = screen.getByTestId('battle-recap')
  expect(panel.getAttribute('data-tone')).toBe('enemy')
  expect(screen.getByText('Danni nemici')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- "tests/ui/battleRecap"`
Expected: FAIL — no title/tone.

- [ ] **Step 3: Implement title + tone**

Replace `components/battle/BattleRecap.tsx` with:

```tsx
'use client'
import type { ReplayFrame, ReplayUnit } from '@/game/engine/combat/replay'
import { recapTotals } from '@/lib/battleRecap'
import { cn } from '@/lib/theme'

/**
 * Live damage/heal recap for one team. Bars scale to the team's current max
 * combined total. Pass a sliced `frames` for running totals during replay.
 * `tone` accents the panel for the player (ally) or the enemy team.
 */
export function BattleRecap({
  frames, units, side = 'left', title = 'Resoconto squadra', tone = 'ally',
}: {
  frames: ReplayFrame[]
  units: ReplayUnit[]
  side?: 'left' | 'right'
  title?: string
  tone?: 'ally' | 'enemy'
}) {
  const rows = recapTotals(frames, units, side)
  const max = Math.max(1, ...rows.map(r => r.dealt + r.healed))
  const accent = tone === 'enemy' ? 'border-rose-400/30' : 'border-emerald-400/30'
  const dot = tone === 'enemy' ? 'text-rose-300/80' : 'text-emerald-300/80'

  return (
    <div
      data-testid="battle-recap"
      data-tone={tone}
      className={cn('rounded-2xl border bg-[rgba(20,16,33,0.55)] p-3 w-full max-w-md backdrop-blur-sm', accent)}
    >
      <p className={cn('mb-2 flex items-center gap-1 text-[10px] uppercase tracking-[0.16em]', dot)}>
        <span aria-hidden>◆</span>{title}
      </p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.key} data-testid="battle-recap-row" className="flex items-center gap-2 text-[11px]">
            <span className="w-20 truncate text-white/80">{r.name}</span>
            <span className="flex-1 flex h-2 overflow-hidden rounded-full bg-white/10">
              <span className="h-full bg-rose-400/80" style={{ width: `${(r.dealt / max) * 100}%` }} />
              <span className="h-full bg-emerald-400/80" style={{ width: `${(r.healed / max) * 100}%` }} />
            </span>
            <span className="w-16 text-right tabular-nums text-white/55">
              <span className="text-rose-300">{r.dealt}</span>
              {r.healed > 0 && <span className="text-emerald-300"> +{r.healed}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run, verify pass + suite**

Run: `npm run test -- "tests/ui/battleRecap"` → PASS
Run: `npm run test -- "tests/ui/battle"` → green (the existing single recap below the arena still renders with the default title until Task 8 rewires it).
Run: `npx tsc --noEmit` → 0 errors

- [ ] **Step 5: Commit**

```bash
git add components/battle/BattleRecap.tsx tests/ui/battleRecap.test.tsx
git commit -m "feat(battle-ui): BattleRecap gains title + tone (ally/enemy)"
```

---

## Task 2: Fix the clipped initiative rail + smaller face

**Files:**
- Modify: `components/battle/InitiativeBar.tsx`
- Test: `tests/ui/initiativeBar.test.tsx` (add a no-clip assertion)

**Interfaces:** none new. The rail must use the full width of its column and not clip content horizontally; face size reduced to `h-8 w-8`.

- [ ] **Step 1: Add a failing assertion**

In `tests/ui/initiativeBar.test.tsx`, add:

```tsx
it('uses full width and does not clip horizontally', () => {
  const { container } = render(<InitiativeBar replay={replay} index={0} />)
  const bar = container.querySelector('[data-testid="initiative-bar"]') as HTMLElement
  expect(bar.className).toContain('w-full')
  expect(bar.className).not.toContain('overflow-x')
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- initiativeBar`
Expected: FAIL — current container is `w-20` (fixed) not `w-full`.

- [ ] **Step 3: Fix the container + shrink the face**

In `components/battle/InitiativeBar.tsx`, change the outer container className from the fixed-width `w-20 max-h-[34rem] overflow-y-auto` to a full-width, vertically-scrolling, non-horizontally-clipping rail:

```tsx
      className="flex flex-col items-stretch gap-1.5 w-full max-h-[34rem] overflow-y-auto overflow-x-visible py-2"
```

And reduce the face crop from `h-9 w-9` to `h-8 w-8`:

```tsx
            <div className={cn('relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2', ring, isCurrent && 'ring-4')}>
```

Ensure the name still truncates (`min-w-0` on its flex parent, `truncate` on the name span — already present). Keep everything else.

- [ ] **Step 4: Run, verify pass + suite**

Run: `npm run test -- initiativeBar` → PASS
Run: `npm run test -- "tests/ui/battle"` → green
Run: `npx tsc --noEmit` → 0 errors

- [ ] **Step 5: Commit**

```bash
git add components/battle/InitiativeBar.tsx tests/ui/initiativeBar.test.tsx
git commit -m "fix(battle-ui): initiative rail uses full column width (no clip) + smaller face"
```

---

## Task 3: Premium StatBar (taller, clearer; API unchanged)

**Files:**
- Modify: `components/battle/StatBar.tsx`
- Test: `tests/ui/statBar.test.tsx` (existing tests must still pass; add a track-height hook if needed)

**Interfaces:** unchanged — `StatBar({ label, value, base, color, icon })`. Keeps `data-stat`, `data-buff`, `data-role="fill"`.

- [ ] **Step 1: Confirm existing tests pin the API**

Run: `npm run test -- statBar`
Expected: PASS (baseline). The premium pass must keep these green.

- [ ] **Step 2: Restyle the bar (no API change)**

In `components/battle/StatBar.tsx`, give the row more room and a premium track. Replace the returned JSX with a clearer, taller layout (label above is not needed; keep inline but spaced):

```tsx
  return (
    <div data-stat={label} data-buff={buff} className="flex items-center gap-2 w-full">
      <Icon size={12} aria-hidden className="shrink-0 text-white/45" />
      <span className="w-8 shrink-0 text-[10px] uppercase tracking-wider text-white/45">{label}</span>
      <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-[#C9A24B]/15">
        <span data-role="fill" className={cn('absolute inset-y-0 left-0 rounded-full', color)} style={{ width: `${pct}%` }} />
      </span>
      <span className={cn('w-7 shrink-0 text-right text-xs font-semibold tabular-nums', valueColor)}>{value}</span>
      {buff !== 'none' && <span aria-hidden className={cn('w-2 text-[9px]', valueColor)}>{buff === 'up' ? '▲' : '▼'}</span>}
    </div>
  )
```

(Keep the existing `buff`, `pct`, `valueColor` computations above.)

- [ ] **Step 3: Run, verify pass**

Run: `npm run test -- statBar` → PASS (API/data hooks unchanged)
Run: `npx tsc --noEmit` → 0 errors

- [ ] **Step 4: Commit**

```bash
git add components/battle/StatBar.tsx
git commit -m "feat(battle-ui): premium stat bar — taller track, gold-tinted, clearer value"
```

---

## Task 4: Roomy + premium UnitBust (smaller portrait, spaced stats)

**Files:**
- Modify: `components/battle/UnitBust.tsx`
- Test: `tests/ui/unitBustStats.test.tsx` + `tests/ui/battle.test.tsx` (should stay green; update only if a width class is pinned)

**Interfaces:** none new. Portrait width `w-32 sm:w-36` → `w-28 sm:w-32`; the three StatBars get `gap` spacing; card gets a glass/gold premium treatment.

- [ ] **Step 1: Shrink the bust + space the stats**

In `components/battle/UnitBust.tsx`:
- Change the root width class `w-32 sm:w-36` → `w-28 sm:w-32`.
- Change the stat group wrapper from the tight `flex flex-col gap-0.5` to a roomier `mt-1.5 flex flex-col gap-1`.

- [ ] **Step 2: Premium card framing**

On the root `motion.div`, add a subtle glass card behind the content. The root currently has `className={cn('relative w-28 sm:w-32', mirrored && 'text-right')}` and a `style` with boxShadow/borderRadius. Add premium background + hairline border via className (keep the existing aura boxShadow in `style`):

```tsx
      className={cn('relative w-28 sm:w-32 rounded-2xl border border-[#C9A24B]/15 bg-[rgba(20,16,33,0.45)] p-1.5 backdrop-blur-sm', mirrored && 'text-right')}
```

(Keep the `style={{ boxShadow: aura, borderRadius: 16, filter: dead ? … }}` — the `rounded-2xl` and inline `borderRadius` agree closely enough; if the reviewer flags the double radius, drop the inline `borderRadius`.)

- [ ] **Step 3: Run bust + battle suites**

Run: `npm run test -- unitBust` and `npm run test -- unitBustStats` and `npm run test -- "tests/ui/battle"`
Expected: green. If any test pins `w-32`/`w-36` exactly, update to the new class; otherwise no change.
Run: `npx tsc --noEmit` → 0 errors

- [ ] **Step 4: Commit**

```bash
git add components/battle/UnitBust.tsx tests/
git commit -m "feat(battle-ui): roomier premium bust — smaller portrait, spaced stats, glass card"
```

---

## Task 5: Narrative premium ActionPanel (the signature)

**Files:**
- Modify: `components/battle/ActionPanel.tsx`
- Test: `tests/ui/actionPanel.test.tsx` (extend)

**Interfaces:**
- Consumes: `describeEntry` from `@/components/battle/BattleLog` (already exported) for the plain Italian sentence. `LogEntry`, `ReplayUnit`, `unitKey`.
- Produces: ActionPanel renders, in addition to the existing spell name + result token, a **plain Italian sentence** under the panel via `data-role="narration"` (e.g. "Harry colpisce Draco con Expelliarmus: 30 danni"), and a premium glass/gold shell. The result token text is unchanged in meaning; styling is premium.

- [ ] **Step 1: Write the failing test**

In `tests/ui/actionPanel.test.tsx`, add (reuse the file's fixture for units + a damage entry):

```tsx
it('renders a plain Italian narration sentence for a damage action', () => {
  // reuse the file's existing units fixture + a damaging LogEntry (action 'Expelliarmus', value 30)
  render(<ActionPanel entry={dmgEntry} units={units} />)
  const narration = screen.getByRole('note') // we render the sentence as role="note"
  expect(narration.textContent).toMatch(/Expelliarmus/)
  expect(narration.textContent).toMatch(/30/)
})
```

If the file has no reusable damage-entry fixture, build one matching the existing `LogEntry` shape used elsewhere in the file (actorSide 'left', targetSide 'right', type 'Attacco', value 30, action 'Expelliarmus', flags []).

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- actionPanel`
Expected: FAIL — no narration node / role="note".

- [ ] **Step 3: Add the narration + premium shell**

In `components/battle/ActionPanel.tsx`:
1. Import `describeEntry`: it's already imported at the top (`import { describeEntry } from './BattleLog'`). Confirm; if not, add it.
2. Build a `names` map (the component already builds `names`). Compute the sentence for the full (non-degraded) branch: `const narration = describeEntry(entry, names)`.
3. In the final `return` (the attacker/middle/target layout), wrap the existing flex row plus a narration line in a column, and apply the premium shell. Replace the final `return (...)` with:

```tsx
  const narration = describeEntry(entry, names)

  return (
    <div data-testid="action-panel" className={cn('rounded-2xl border border-[#C9A24B]/25 bg-[rgba(20,16,33,0.6)] px-4 py-3 w-full max-w-xl min-h-[5rem] backdrop-blur-sm flex flex-col items-center gap-1.5')}>
      <div className="flex items-center justify-center gap-3 sm:gap-5 w-full">
        {mirrored ? (
          <>
            {targetCol}
            {middle}
            {attackerCol}
          </>
        ) : (
          <>
            {attackerCol}
            {middle}
            {targetCol}
          </>
        )}
      </div>
      <p role="note" data-role="narration" className="text-center text-[11px] text-white/55 leading-snug">
        {narration}
      </p>
    </div>
  )
```

4. Premium-tune the spell name in `middle`: bump it to `text-base font-display text-[#F0D98A]` (gold) and keep the arrow. Premium-tune the result token (`RESULT_CLASS`): the `crit` already glows gold; leave the others but ensure they read clearly on the darker glass.
5. Keep the `shell`/`centered` placeholder branches (null/degraded) — just swap their `shell` constant to the premium one: change the `shell` definition to `'rounded-2xl border border-[#C9A24B]/20 bg-[rgba(20,16,33,0.55)] px-4 py-3 w-full max-w-xl min-h-[5rem] backdrop-blur-sm'`.

- [ ] **Step 4: Run, verify pass + suite**

Run: `npm run test -- actionPanel` → PASS
Run: `npm run test -- "tests/ui/battle"` → green (the panel still renders as the arena center; update any assertion that pinned the old `glass`/`shell` class string to the new premium class, keeping it meaningful)
Run: `npx tsc --noEmit` → 0 errors

- [ ] **Step 5: Commit**

```bash
git add components/battle/ActionPanel.tsx tests/ui/actionPanel.test.tsx tests/ui/battle.test.tsx
git commit -m "feat(battle-ui): narrative premium action box — spell + outcome + plain sentence"
```

---

## Task 6: Retune ArenaBackdrop to gold/violet

**Files:**
- Modify: `components/battle/ArenaBackdrop.tsx`
- Test: `tests/ui/arenaBackdrop.test.tsx` (still green — aria-hidden + reduced motion)

**Interfaces:** none new.

- [ ] **Step 1: Retune the gradient palette**

In `components/battle/ArenaBackdrop.tsx`, change the gradient `background` to the gold/violet premium palette and keep the reduced-motion guard + aria-hidden + pointer-events-none + `-z-10`:

```tsx
        style={{ background: 'radial-gradient(60% 50% at 50% 25%, rgba(201,162,75,0.10), transparent 70%), radial-gradient(55% 55% at 50% 85%, rgba(124,58,237,0.14), transparent 72%)' }}
```

(Keep the existing `motion.div` animate/transition and reduced-motion handling.)

- [ ] **Step 2: Run, verify still green**

Run: `npm run test -- arenaBackdrop` → PASS (aria-hidden + reduced-motion unchanged)
Run: `npx tsc --noEmit` → 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/battle/ArenaBackdrop.tsx
git commit -m "feat(battle-ui): retune arena backdrop to gold/violet premium palette"
```

---

## Task 7: BattleScreen — grid fix, anchored synergies, dual recap, remove legend

**Files:**
- Modify: `components/screens/BattleScreen.tsx`
- Test: `tests/ui/battle.test.tsx`

**Interfaces:**
- Consumes: `BattleRecap` (title/tone, Task 1), the fixed `InitiativeBar` (Task 2), `SynergyRibbon` (title/tone, existing). Removes `StatusLegend` usage.
- Produces: 3-column grid `lg:grid-cols-[7rem_1fr_13rem]`; player synergies ABOVE the player row, enemy synergies BELOW the enemy row (inside the arena column); the right column holds two stacked `BattleRecap`s ("I tuoi danni" ally / "Danni nemici" enemy); the standalone bottom `BattleRecap` and all `StatusLegend` usage are removed.

- [ ] **Step 1: Write the failing assertions**

In `tests/ui/battle.test.tsx`, add (reuse the file's BattleScreen render helper):

```tsx
it('shows dual damage recaps and no status legend', () => {
  renderBattleScreen() // file's existing helper
  expect(screen.getByText(/I tuoi danni/i)).toBeInTheDocument()
  expect(screen.getByText(/Danni nemici/i)).toBeInTheDocument()
  expect(screen.queryByTestId('status-legend')).toBeNull()
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm run test -- "tests/ui/battle"`
Expected: FAIL — legend still present; no dual recaps.

- [ ] **Step 3: Rewrite the BattleScreen body**

In `components/screens/BattleScreen.tsx`:
1. Remove the `StatusLegend` import (line 12) and the `BattleRecap` stays imported.
2. Replace the grid block (lines 62-87) and the standalone bottom `BattleRecap` (line 116) with this single grid. The arena column now holds: player synergies (top) → arena → enemy synergies (bottom). The right column holds the two recaps. Below `lg`, initiative + recaps stack under the arena.

Replace lines 62-87 with:

```tsx
      <div className="grid w-full max-w-5xl grid-cols-1 lg:grid-cols-[7rem_1fr_13rem] gap-4 items-start">
        <div className="hidden lg:block">
          <InitiativeBar replay={replay} index={r.index} />
        </div>

        <div className="flex flex-col items-center gap-3 min-w-0">
          <SynergyRibbon synergies={playerSyn} relics={playerRelics ?? []} align="left" title="Le tue sinergie" tone="ally" />
          <BattleArena
            replay={replay} hp={r.hp} entry={r.entry} frameKey={r.index} rightTitle={rightTitle}
            center={<ActionPanel entry={stickyEntry} units={replay.units} />}
          />
          <SynergyRibbon synergies={enemySyn} align="left" title="Sinergie nemiche" tone="enemy" />
        </div>

        <div className="hidden lg:flex lg:flex-col gap-3">
          <BattleRecap frames={replay.frames.slice(0, r.index + 1)} units={replay.units} side="left" title="I tuoi danni" tone="ally" />
          <BattleRecap frames={replay.frames.slice(0, r.index + 1)} units={replay.units} side="right" title="Danni nemici" tone="enemy" />
        </div>
      </div>
```

3. Replace the below-lg stack (lines 84-87, the `lg:hidden` block) with initiative + the two recaps (no legend):

```tsx
      <div className="flex flex-col items-center gap-3 lg:hidden w-full">
        <InitiativeBar replay={replay} index={r.index} />
        <BattleRecap frames={replay.frames.slice(0, r.index + 1)} units={replay.units} side="left" title="I tuoi danni" tone="ally" />
        <BattleRecap frames={replay.frames.slice(0, r.index + 1)} units={replay.units} side="right" title="Danni nemici" tone="enemy" />
      </div>
```

4. Delete the standalone bottom `<BattleRecap … side="left" />` line (old line 116) — it's now in the columns. Keep the controls block and the `<BattleLog … />` line at the bottom.

- [ ] **Step 4: Run, verify pass**

Run: `npm run test -- "tests/ui/battle"` → PASS (dual recaps; no legend)
Run: `npm run test -- statusLegend` → this test renders `StatusLegend` directly (component still exists), so it stays green; we only removed BattleScreen's USAGE. Confirm green.
Note: InitiativeBar/BattleRecap render twice (desktop + below-lg). If a test does `getByTestId('battle-recap')` and now finds multiple, switch to `getAllByTestId(...)`. Fix meaningfully.

- [ ] **Step 5: Full suite + typecheck + build**

Run: `npm run test` → all green except known flakes (confirm isolated).
Run: `npx tsc --noEmit` → 0 errors.
Run: `npm run build` → succeeds.

- [ ] **Step 6: Commit**

```bash
git add components/screens/BattleScreen.tsx tests/ui/battle.test.tsx tests/
git commit -m "feat(battle-ui): premium battle layout — anchored synergies, dual-team recap side column, legend removed"
```

---

## Task 8: Premium shell pass + final verification + push

**Files:**
- Modify: `components/screens/BattleScreen.tsx` (header accent + control buttons)
- Verification only otherwise.

**Interfaces:** none new.

- [ ] **Step 1: Premium header + controls**

In `components/screens/BattleScreen.tsx`, give the `<h1>` a hairline gold underline accent and keep the subtitle. Change the title element to:

```tsx
        <h1 className="font-display text-2xl text-[#F0D98A] [text-shadow:0_0_18px_rgba(201,162,75,0.25)]">{title}</h1>
```

(Leave the controls' existing `Button variant="ghost"` — they already read as quiet; no functional change needed. Do not over-decorate.)

- [ ] **Step 2: Full suite**

Run: `npm run test`
Expected: all green (any red is a known flake passing in isolation — confirm with `npx vitest run <file>`).

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` → 0 errors.
Run: `npm run build` → succeeds, all routes prerender.

- [ ] **Step 4: Commit + confirm HEAD + push**

```bash
git add components/screens/BattleScreen.tsx
git commit -m "feat(battle-ui): premium header accent"
git rev-parse HEAD
git log --oneline -9
git push origin master
```

(Verify HEAD is this session's work before pushing — concurrent writer possible.)

---

## Self-Review notes

- **Spec coverage:** Part 1 clipped rail → Task 2; Part 2 legend→dual recap → Tasks 1 (title/tone) + 7 (wiring + remove legend); Part 3 roomy cards → Tasks 3 (StatBar) + 4 (bust); Part 4 anchored synergies → Task 7; Part 5 smaller portraits → Tasks 2 (face) + 4 (bust); Part 6 narrative action box → Task 5; Part 7 premium pass → Tasks 1/3/4/5/6 styling + Task 8 header. All covered.
- **Type consistency:** `BattleRecap` `title`/`tone` (Task 1) consumed identically in Task 7. `describeEntry(entry, names)` (Task 5) is the existing 2-arg export from BattleLog. `StatBar` API unchanged (Task 3) so UnitBust (Task 4) call is untouched. `SynergyRibbon` title/tone already exist (prior plan).
- **Ordering:** leaf components (Tasks 1-6) before the BattleScreen integration (Task 7); header polish + verify last (Task 8). Task 7 depends on Task 1's title/tone.
- **Double-mount note:** Task 7 renders InitiativeBar + two BattleRecaps twice (desktop + below-lg); flagged so `getByTestId`→`getAllByTestId` where needed.
- **StatusLegend:** only its USAGE is removed; the component + its direct test (`statusLegend.test.tsx`) remain valid. The component becomes unused by the app — acceptable (the spec allows leaving it); not deleted to avoid churning its test.
- **No engine/data edits** in any task — components only.
