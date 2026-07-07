# Draft Screen Reshape — Design

Date: 2026-07-07
Status: approved (pending spec review)

## Problem

The starter draft screen (`DraftScreen`) has the weakest UX in the app:
- Cards are **horizontal roster rows** (`WizardCardRow`) — portrait wasted in a narrow left column, spell panel cramped.
- **5 candidates** per pick create a visual wall; choices don't feel weighted.
- The **synergy box** (`SynergyTracker`) is a flat list of bordered rows with a thin progress bar — functional but not the centerpiece it should be.

## Goals

1. Fewer, bigger, **vertical** candidate cards (portrait on top, card-collectible feel).
2. **3 candidates** per pick instead of 5.
3. Make the **synergy box the star** via a hybrid tier-track design (per-family mini-cards with tier nodes + gold activation glow).

Total picks stay at 3 (`STARTER_PICKS`). Enemy power is untouched → campaign balance unaffected (verified via `campaignBalanceB`).

## Non-goals

- No change to `WizardCardRow` — team recap, recruit swap, and level-up screens keep the horizontal row. The new vertical card is additive.
- No change to draft engine logic beyond the single `screenSize` constant.
- No combat/VFX work.

## Changes

### 1. Candidate count 5 → 3

`data/constants.ts`: `BALANCE.draft.screenSize: 5 → 3`.

Pure lever. `generateScreen` already reads `screenSize` and enforces `maxTier1PerScreen`; with a 3-wide screen the tier-1 cap still holds. `campaignBalanceB` measures enemy win-rate and does not depend on player draft width — re-run it after the change to confirm no drift.

### 2. Vertical candidate card — new `WizardCardColumn`

New component `components/cards/WizardCardColumn.tsx`, sibling to `WizardCardRow`, **same `DraftedWizard` props shape** (`drafted`, `onClick`, `hotSynergyIds`, `testId`, `selected`). Reuses the same sub-parts: `PortraitImage`, `TierBadge`, `RoleIcon`, `Chip`, `Tooltip`, affiliation/spell glossary helpers, `houseTheme`, `displayName`.

Vertical stack (top → bottom):
1. **Portrait** — full card width, ~16:11, clipped to top rounded corners, house-gradient fade into the body. Tier badge top-left; role icon (tooltip) bottom-left over the portrait so tooltips can escape the clip (same escape pattern as the row card: badges sit outside the clipped layer).
2. **Name** + `✨` shiny + affiliation/synergy chips (gold; `hotSynergyIds` glow preserved via `data-synergy`/`data-hot`).
3. **Signature** (★ Abilità) and **shiny trait** (✦ Tratto) chips when present.
4. **Stats** — the 4 compact `StatCell` bars (HP/ATK/DIF/VEL). Extract `StatCell` + `STAT_CELLS` into a shared module `components/cards/statCells.tsx` so both card variants import one copy (removes duplication rather than copy-paste).
5. **Spell panel** — the feature; full width at the bottom, same content as the row card (name, type chip, spell stats, effect chips / Controllo detail lines).

Card root keeps the row card's conventions: `motion.div` spring mount, `data-house`, `data-testid`, `role="button"` + Enter/Space keydown when clickable, border/glow from `houseTheme`, shiny glow. **Not** `overflow-hidden` at root (only the background + portrait layers are clipped) so tooltips escape.

### 3. `DraftScreen` layout

- Grid: `md:grid-cols-[1fr_300px]` (rail slightly wider for the new tracker). Rail stays on the **right** (mobile: stacks below).
- Left column: candidates in `grid grid-cols-1 sm:grid-cols-3 gap-4`, rendering `WizardCardColumn` instead of `DraftCandidateCard`→`WizardCardRow`.
- `DraftCandidateCard` is updated to wrap `WizardCardColumn` (keeps the `onConsider`/hover + focus wrapper; single-line swap of the inner card).
- Header (`SquadPanel` row, progress pill, active-synergy pill) unchanged.
- Hover/consider preview wiring (`considered`, `hotByCandidate`, `previewSynergies`) unchanged.

### 4. Synergy box — hybrid tier-track `SynergyTracker`

Rebuild the tracker body (same props: `rows`, `candidateName`; same `data-synergy`/`data-active`/`data-activates`/`data-superseded` hooks so existing tests keep passing).

**Group by family.** Build `Map<family, rows[]>`; rows without a `family` are their own single-node group keyed by synergy id. Per group render **one mini-card**:

- **Header:** family/synergy display name (strip leading `N ` as today) + the top reached (or, in preview, about-to-activate) tier's bonus text.
- **Tier track:** a horizontal row of **nodes**, one per tier threshold in the family (e.g. 2 / 4 / 6), left→right by threshold. A progress line runs behind the nodes and fills to `min(count, maxThreshold)`.
  - Node reached (`count >= threshold`): solid gold (`#b08d57`), threshold number inside.
  - Highest active tier: gold **glow** ring.
  - Superseded lower active tiers: dimmed (opacity ~0.5) — reuse the existing `topActiveByFamily` supersession logic, lifted to family grouping.
  - Not reached: hollow `#241f38` node.
  - **Preview** (candidate hovered, `advances`/`willActivate`): the node that the pick would reach pulses **green** (`#7cdc7c`) with a "SI ATTIVA" tag when `willActivate`; the fill line animates forward one step.
- **Count** `count → nextCount` (preview) or `count / nextThreshold` (current) on the right of the header.

Empty state kept: "Nessuna sinergia ancora. Pesca per costruirne una." Header line kept: "Se peschi **X**:" in preview, else "Sinergie · cosa sbloccano".

Progress-bar fill keeps the existing `synergy-bar-fill` class / gradient for the connecting line so reduced-motion + styling stay consistent.

## Isolation / risk

- **Row card untouched** → zero regression to team/recruit/level-up. Vertical card is a new file; shared `StatCell` extraction is a mechanical move covered by those screens' existing render tests.
- **Tracker props + data-attributes unchanged** → existing draft/synergy tests keep anchoring. Internal render is rewritten but the contract holds.
- **One-line constant** for candidate count; balance re-verified, not assumed.

## Testing

- `campaignBalanceB` re-run after the `screenSize` change — confirm win-rate assertion still passes (memory: live assert is `winRate > 0`; documented floor 0.15, baseline ~0.375).
- Existing draft/synergy tests (data-attribute anchored) stay green.
- New: a lightweight render test for `WizardCardColumn` (renders name, portrait, spell, stats; click fires `onClick`) and for the tracker's tier-node grouping (a family with 2 reached of 3 tiers marks 2 nodes reached, top glowing). Typecheck the new TS test files (memory: vitest skips tsc).
- Manual: drive the draft screen in the app, hover a candidate, confirm the track previews forward and "SI ATTIVA" fires.
