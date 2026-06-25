# Combat & UI Overhaul — Design

Date: 2026-06-25
Status: Approved (brainstorming)

## Goal

Make combat **readable and engaging**: the player should understand exactly what is
happening to enemies and allies each turn, see all combat-relevant info (traits, roles,
stats, statuses), feel debuffs and control actually matter, and choose relics with the
squad in view. Graduated synergies (2/3/4) give clear power progression.

Scope is targeted: **battle screen + relic-choice screen** restyle. No global redesign.

---

## Part 1 — Graduated synergies (2/3/4)

Engine already supports arbitrary `count` via `synergyThreshold()`. House and role
synergies gain **three thresholds** each (2, 3, 4) with bonuses that scale ~×2 from
2→4, so a 4-synergy is clearly stronger than a 2.

Per house (def/atk/spd/regen flavour preserved) and per role, e.g. Gryffindor (def):

| Threshold | Bonus |
|---|---|
| 2 Grifondoro | +10 def |
| 3 Grifondoro | +22 def |
| 4 Grifondoro | +40 def |

All 4 houses + 4 roles get the 2/3/4 ladder (8 families × 3 = 24 house/role entries).
Same flavour stat as today (Gryffindor def, Slytherin atk, Ravenclaw spd, Hufflepuff
regen; Attackers atk, Tanks def, Supports regen, Controllers spd).

**Group synergies unchanged** (Golden Trio, Weasley, Order, Death Eaters, Marauders, DA).

### Engine change (minimal)
`detectSynergies` must suppress lower tiers when a higher tier of the **same family** is
active — otherwise 4 Gryffindor would also fire the 3 and 2 entries (triple-apply).
Add a `family` discriminator (e.g. `house:Grifondoro`, `role:Attaccante`) and keep only
the highest active tier per family. Group synergies have no family → never suppressed.

### Suggested numbers
Houses: def family 10/22/40; atk family 10/22/40; spd family 10/22/40; regen family 6/12/22.
Roles: atk 8/15/28; def 9/18/34; regen 5/10/18; spd 8/15/28.
(Final numbers tuned against campaignBalance during implementation.)

---

## Part 2 — Debilitating statuses: percentage + graded variants

### Problem
- "Indebolimento" today is only `slow` (−15 flat spd) + traits touching spd only →
  imperceptible. No atk/def weaken exists.
- Control (stun/silence/disarm) fires at 18% → almost never seen.
- `freeze` is defined but **no trait/source applies it** → never appears.

### Percentage debuffs (engine already supports `statMod.pct`)
`effectiveStats` already reads `def.statMod.pct` and applies `stat × (1 + delta/100)`.
So percentage weaken is **pure data, no engine change**. Flat −25 (≈ wiping out a whole
wizard's atk, range ~20–45) is rejected as too swingy; percentage scales with the target.

### Graded variants (like stat tiers)
Three intensities per debilitating family, each its own status id, same icon, badge shows
the magnitude:

| Status family | Lieve | Medio | Grave |
|---|---|---|---|
| `weaken` (−atk%) | `weaken1` −15% | `weaken2` −25% | `weaken3` −40% |
| `expose` (−def%) | `expose1` −15% | `expose2` −25% | `expose3` −40% |
| `slow` (−spd%) | `slow1` −15% | `slow2` −25% | `slow3` −40% |

Base feel = −25% (medio) at high uptime is already strong; grave (−40%) reserved for
rare/powerful sources.

### Trait / source assignment
- `Logoramento` → `weaken2` (−25% atk) at 50% — the real felt "indebolimento".
- `Sifone` → `slow1` (−15% spd) on hit, frequent → kept light.
- New trait `Frantumazione` → `expose2` (−25% def) — opens vulnerability, pairs with
  attackers.
- Relic/boss-tier sources → `weaken3`/`expose3` (grave) as rare strong effects.

### Control / freeze
- `CONTROL_CHANCE` 18% → **30%** (stun/silence/disarm now appear regularly).
- `freeze` duration 1→2; new trait `Gelo` (freeze ~25%) assigned to 1–2 Ravenclaw
  wizards so freeze finally shows up.

### Balance
Higher control + real debuffs lower clear-rate. Re-measure campaignBalance
deterministically and re-base the floor with documented margin if needed (precedent
exists: floor moved 0.02→0.008 in a prior session).

---

## Part 3 — Battle layout 5↑ / 5↓ + info hierarchy + action focus

### Layout
`BattleArena` switches from left/right columns to **two full-width horizontal rows**:
- Top row = enemies (5 in a line)
- Center divider = current turn / VS / compact log
- Bottom row = player squad (5 in a line)

Full-width rows give each `UnitBust` more room. Projectile coords are already measured
from the DOM (getClientRect → arena %), so `SpellFx` works unchanged — bolts now fly
up/down instead of left/right. **No projectile math changes.**

### Info hierarchy (avoids 10-busts-overload)
- **At rest**: portrait, HP bar + numeric "78/105", role (icon + label), compact status
  dots.
- **Active actor / current target**: highlighted; reveals detailed stats (base vs
  buffed/debuffed, colour-coded) and statuses with values + turns.
- **Everyone else**: slightly dimmed during an action → **action focus**: it is obvious
  who is hitting whom each turn.

### Detail on hover/tap
Hovering (or tapping on mobile) a wizard opens a panel with **everything**: current stats
vs base, all traits with descriptions, all active statuses with value + turns remaining,
spell + cooldown. "Tutte le info inerenti al combattimento" on demand.

### Damage feedback (one strong gesture, no redundant noise)
Floating damage number, large + colour-coded (crit gold / dot orange / normal white) on
the struck unit, plus animated HP-bar drop. No additional red flash + shake on top.

### Mobile
Rows kept; busts reduce to essentials (portrait + HP + status dots), detail via tap.
Desktop breathes. Initiative bar becomes horizontal, consistent with the layout.

---

## Part 4 — Status UI + relic-choice with squad

### Readable statuses
- Each pill shows the **explicit value**: "INDEB. −25% · 2t", "STORDITO 1t",
  "VELENO 8 · 2t" — not just an icon.
- Icon + colour per family (debuff red, control yellow, dot orange, buff green, …).
  The three weaken/expose/slow intensities share an icon; the value differs.
- **Explicit battle log**: status events are written out
  ("Logoramento: −25% ATT a Draco", "Congelamento: Goyle salta il turno").
- Full tooltip on hover.

### Relic-choice shows the squad
`RelicChoiceScreen` now renders the **squad** alongside/below the 3 relic cards, so the
player sees composition (houses, roles, **active synergies**, carry-over HP) while
choosing. Reuse `SquadPanel` (or a compact variant). Surface active synergies + roles as
chips so the player can reason "I have 3 Attackers → take the +atk role relic". Layout:
relics as protagonists on top, squad as context below, current synergies as chips.

### Targeted aesthetics (battle + relics only)
Coherent with the existing theme (GlowPanel, house frames, palette). Polish: action
focus, HP transitions, damage typographic hierarchy, curated hover panel. No global
redesign.

---

## Engine-change summary (kept minimal)
1. `detectSynergies`: highest-tier-per-family suppression (Part 1). Only real logic add.
2. Everything else is **data** (statuses, traits, synergy entries) or **UI/React**
   (layout, hierarchy, hover panel, status pills, relic-choice squad). `statMod.pct` and
   DOM-based projectiles already exist.

## Testing
- Unit: synergy tier suppression (2/3/4, highest-only), percentage statMod math already
  covered — add cases for new ids.
- Data guards: new status ids valid; traits reference existing status ids; new synergy
  entries well-formed.
- Balance: campaignBalance re-measured, floor re-based deterministically with margin.
- UI: battle layout (5↑/5↓), status pill value rendering, relic-choice squad presence,
  action-focus dim state. Update existing fixtures (battle, relicChoiceScreen,
  synergyRibbon) for new layout/data.
