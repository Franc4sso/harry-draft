# Duo discoverability on wizard cards — design spec

**Date:** 2026-07-11
**Status:** Design approved (brainstorming), ready for writing-plans.
**One-liner:** Make a wizard card explain which Duos it feeds — light per-signal icons + a hover
tooltip that names the Duos ("Veleno → alimenta: Cancrena · Miasma · Untore"), plus a contextual
"completes/advances a Duo" cue on draft and recruit candidates.

---

## 1. Why

Duos auto-ignite when a team+relics light two archetype signals, but the player has no way, looking at
a wizard, to understand which Duos that wizard contributes to and with what. The in-run `DuoBar`
(sidebar) shows active/near Duos for the whole team, but not the per-wizard "why". Wizard **tags**
(veleno/esecuzione/…) — half of a Duo's ingredients — are not shown on cards at all today.

**Design decision (from brainstorming):** favor a LIGHT static layer (small signal icons + a naming
tooltip) over a dense labeled chip row, so the card doesn't become "chip noise" (it already has spell
effect chips). The **contextual** completion cue is the star — it answers "which Duo does this pick
unlock" at the moment of decision. The static layer + tooltip answer the same question while exploring.

---

## 2. Scope

- **Surfaces:** the draft poster card (`components/cards/WizardCardColumn.tsx`) and the horizontal
  team/recruit row card (`components/cards/WizardCardRow.tsx`). Combat busts (`UnitBust`) unchanged.
- **Static layer (everywhere a card appears):** light per-signal icons + naming tooltip.
- **Contextual layer (draft candidates + recruit offers only):** a completion/advance cue.
- **Out of scope:** the `DuoBar` sidebar (unchanged — it's the team-level summary), Duo mechanics,
  combat busts, the unused `hotSynergyIds` prop.

---

## 3. Data layer — pure helpers in `game/engine/duos.ts`

Mirror the existing `synergyProgress`/`previewSynergies` style. `DUO_SIGNALS_IN_USE` = the set of
`DuoSignal`s that appear in at least one shipped `DUOS` entry (computed once from `DUOS`).

- `wizardDuoSignals(wizard: Wizard): DuoSignal[]` — the wizard's Duo signals that feed a shipped Duo:
  its role-signal (`Tank→'taunt'`, `Attaccante→'attaccante'`, `Supporto→'supporto'`, `Controllo→'controllo'`)
  if in `DUO_SIGNALS_IN_USE`, plus each of its tags in `{veleno,esecuzione,scudirigen,magieOscure}` that
  is in `DUO_SIGNALS_IN_USE`. **Honesty rule:** a signal that feeds no shipped Duo is never returned
  (e.g. a plain Attaccante with no relevant tag → `[]`). Deterministic order (signal declaration order).
- `duosForSignal(signal: DuoSignal): Duo[]` — the shipped Duos whose `signals` include `signal` (for the
  tooltip "→ alimenta: …").
- `previewDuos(team, relics, candidate): { completes: Duo[]; advances: Duo[] }` — compute
  `duoProgress(livingOf(team), relics)` and `duoProgress(livingOf([...team, candidate]), relics)`; a Duo
  is **completes** if it goes inactive→active, **advances** if its `missing.length` goes from 2 to 1
  (was two-away, now one-away / "near"). Reuses the existing signal math; `livingOf` so a fallen ally
  never inflates the preview (same rule the battle uses).

No new engine mechanics — these are read-only derivations over existing `DUOS`/`duoProgress`.

---

## 4. UI — static layer (light signals + tooltip)

A small reusable `DuoSignalMarks` component (`components/cards/DuoSignalMarks.tsx`), props
`{ wizard: Wizard }`:
- Renders one small mark per `wizardDuoSignals(wizard)` entry — an icon + short label (or icon-only on
  the compact row card), using `SIGNAL_LABEL` for text and a new tiny `SIGNAL_ICON`/`SIGNAL_COLOR` map
  in `data/duos.ts` (one glyph + accent per signal). Renders nothing when the wizard feeds no Duo.
- **Tooltip on hover/focus** of a mark: "‹Segnale› → alimenta: ‹Duo names joined by ·›", built from
  `duosForSignal`. Reuse the card's existing tooltip approach (the card root is deliberately
  un-clipped so tooltips can escape — see `WizardCardColumn` header comment); if no shared tooltip
  primitive exists, a minimal accessible hover/focus popover (title-style) is acceptable — keep it
  keyboard-focusable for accessibility.

Placement:
- **Poster card (`WizardCardColumn`):** a compact `DuoSignalMarks` near the identity block (under the
  title / top of body), visually lighter than the spell effect chips — small, secondary. Reuse the
  DuoBar gold/green language only for the contextual ribbon (below), not for the static marks (static
  marks use the per-signal accent).
- **Row card (`WizardCardRow`):** `DuoSignalMarks` in icon-compact mode in the card's chip area.

---

## 5. UI — contextual layer (completes/advances a Duo)

Only for **candidate** cards (draft picks + recruit offers), where a team context exists:
- The consuming screen computes `previewDuos(team, relics, candidate)` and passes the result to the
  card via a new optional prop `duoPreview?: { completes: Duo[]; advances: Duo[] }`.
- The card renders a **completion ribbon** at its crown when `duoPreview` is present and non-empty:
  - `completes.length > 0` → GOLD ribbon: "⚡ Completa ‹Duo name›" (`#d9b65f`; if multiple, the first +
    "＋N").
  - else `advances.length > 0` → GREEN cue: "→ verso ‹Duo name›" (`#3ecb6a`).
  - Reuses the DuoBar accents (`#d9b65f` / `#3ecb6a`) for consistency. No camera shake.
- Wiring:
  - Draft: `components/screens/DraftScreen.tsx` (and `DraftCandidateCard` if it wraps the poster card)
    already has the team + the candidate → compute `previewDuos(picks, relics, candidate)` and pass
    `duoPreview`. (Endless draft uses the same `DraftScreen`, so it inherits this for free.)
  - Recruit: the recruit offer screen (`components/screens/RecruitScreen.tsx`) computes
    `previewDuos(team, relics, offeredWizard)` per offered candidate and passes `duoPreview`.
- Team-sidebar cards (wizards already on the team) get NO `duoPreview` (a member is already counted) —
  they show static marks + tooltip only.

---

## 6. Testing

- **Engine (pure):** `wizardDuoSignals` honesty (veleno Attaccante → `['veleno']`, NOT `'attaccante'`;
  plain Attaccante → `[]`; Tank+scudirigen → `['taunt','scudirigen']`). `duosForSignal('veleno')` →
  the three veleno Duos. `previewDuos`: a candidate that lights a second signal → `completes` the Duo;
  a candidate that moves a Duo 2-away→1-away → `advances`; a fallen team member doesn't inflate it.
- **UI (jsdom):** poster/row card renders a Veleno mark for a veleno mage and NO Duo mark for a plain
  attacker; the tooltip text names the fed Duos; a draft candidate with a completing `duoPreview` shows
  the gold "Completa" ribbon, an advancing one shows the green "verso" cue, and a member card (no
  `duoPreview`) shows neither.
- Full suite + `npm run typecheck` green.

---

## 7. Project rules honored

- Copy in Italian ("Segnali", "alimenta", "Completa", "verso"). No camera shake. Reuse existing DuoBar
  accents / `SIGNAL_LABEL`; the only new visual atom is a tiny per-signal icon/color map.
- `livingOf` used in `previewDuos` (fallen allies don't inflate — matches the battle's Duo computation).
- `npm run test` does not typecheck → run `npm run typecheck` separately.
- Player-facing only; no change to Duo activation, balance, or replay/anti-cheat (read-only derivations).
