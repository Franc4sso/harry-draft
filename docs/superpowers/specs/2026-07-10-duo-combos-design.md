# Duo Combos — design spec

**Date:** 2026-07-10
**Status:** Design approved (brainstorming), ready for writing-plans.
**One-liner:** Hades-style "Duo" powers that auto-ignite at the intersection of two archetype
signals, announced by a banner and recorded in the Codex. Player-only, campaign + Endless.

---

## 1. Why

Endless (full-roster draft) is the proving ground for build variety, and a leaderboard is only
interesting if there are DISTINCT viable builds. Archetypes are the content that gives the
leaderboard meaning. This is an **extension of the existing synergy system**, not a new system.

**The tension this design must respect:** the user likes the game HARD. A combo must be a reason
to go DEEPER (further in Endless, differentiated leaderboard), NOT a win button. The structural
answer: a Duo requires SPREADING across two archetypes, so you max neither — the spread is the
built-in cost.

---

## 2. Core model (decisions from brainstorming)

- **Spine = Duo Combos (Hades):** a named power that exists only where two archetypes overlap.
- **Activation = auto-ignite + Codex:** the instant a battle's team+relics satisfy both of a Duo's
  signals, the Duo fires automatically; first-ever discovery shows a banner and flips it in the Codex.
- **Ingredient = light comp-OR-relic signal:** a signal lights from a light team threshold OR a
  matching relic (§4). Easy to discover; the spread across two archetypes is the cost.
- **Ambition = reuse + a bounded set of NEW primitives** (§5): ~6 new reusable effect primitives,
  each powering 1–3 Duos, each its own module + unit tests. Permanent tooling for future content.
- **First slice = 6 Duos** (§6), player-only, live in campaign AND Endless.

---

## 3. Architecture (mirrors existing systems)

| Concern | New/changed | Mirrors |
|---|---|---|
| Detection | `game/engine/duos.ts` → `detectDuos(team, relics): ActiveDuo[]` | `game/engine/synergy.ts` `detectSynergies` |
| Data | `data/duos.ts` → `DUOS: Duo[]`, `DUO_BY_ID` | `data/relics.ts`, `data/synergies.ts` |
| Types | `types/duo.ts` → `Duo`, `DuoSignal`, `ActiveDuo`, `DuoEffect` | `types/relic.ts`, `types/synergy.ts` |
| Primitives | one module each under `game/engine/` (e.g. `duoEffects/spreadOnDeath.ts`) | `execute.ts`, `alwaysHit.ts`, `shieldConvert.ts` |
| Battle wiring | `game/engine/combat/battlePackage.ts` applies active-Duo effects alongside relic grants | existing `grants*` wiring |
| Codex | `MetaCodex.duosSeen: string[]` + `markSeen('duo', id)` | `wizardsSeen/relicsSeen/synergiesSeen/bossesSeen` |
| UI | Duo section in the synergy/team panel + discovery toast + Codex tab | `SynergyTracker`, `TeamSynergyBar`, Collection screen |

`detectDuos` is pure and unit-testable in isolation. It is called wherever the active-Duo set is
needed: at `buildBattlePackage` (to apply effects) and in the pre-battle UI panel (to preview).

---

## 4. Signals (the 8 ingredients)

A signal is computed once per battle from team comp + owned relics.

**Tag signals** — light if `≥2 mages carry the tag` **OR** an owning relic is present:

| Signal | Tag | Relic that lights it |
|---|---|---|
| `veleno` | `veleno` | any relic with keyword `veleno` |
| `esecuzione` | `esecuzione` | keyword `esecuzione` OR `grantsExecute` |
| `scudirigen` | `scudirigen` | keyword `scudo` OR `grantsShieldConvert` |
| `magieOscure` | `magieOscure` | keyword `magieOscure` OR `grantsDarkMagic` |

**Role signals** — comp-only (relics have no role):

| Signal | Condition | Rationale |
|---|---|---|
| `taunt` | `≥1 Tank` on the team | taunt is a single-tank mechanic; one tank is the wall |
| `attaccante` | `≥2 Attaccante` | a real role commitment |
| `supporto` | `≥2 Supporto` | a real role commitment |
| `controllo` | `≥2 Controllo` | a real role commitment |

A mage can light multiple signals (it has a role AND tags) — intended; stacking a coherent build is
the reward (balance risk handled in §8, decision #6).

---

## 5. New primitives (bounded, reusable)

Each lives in its own module with unit tests; each is a permanent tool.

1. **`bonusVsStatus`** — a damage/tick multiplier applied only when the target has a given status
   (and optionally is below an HP fraction). Powers CANCRENA, PREDA FACILE (fast-follow).
2. **`spreadStatusOnDeath`** — on a unit's death, transfer its stacks of a given status to one random
   living enemy (additive, capped at the normal stack cap). **Non-recursive within one death
   resolution.** Powers MIASMA.
3. **`untargetableWhile`** — while a condition holds (taunting Tank alive with shield>0), enemy
   attacks that would hit a non-Tank ally are force-retargeted to the Tank. Never yields an empty
   target set. Powers MURO VIVENTE.
4. **`executeOnStatus`** — a target that has a given status (stun/freeze) AND is below an HP fraction
   is finished outright. **Boss-leader guard:** on boss leaders it converts to large bonus damage
   instead of instant death. Powers ESECUZIONE A FREDDO.
5. **`onHealApplyStatus`** — reuses the existing `onHeal` hook: when a team heal resolves, apply a
   status to a target. Powers UNTORE.
6. **`onKillStackBuff`** — on a qualifying kill (execute kill), grant the killer a stacking stat buff
   **for the rest of the battle** (per-battle, NOT run-persistent in v1 — decision #7). Powers MIETITORE.

**Determinism (decision #1, hard requirement):** every random draw in a primitive (spread target in
#2, heal target in #5, any tiebreak) draws from the SAME forked `combatRng` stream used by combat,
in the exact order the live sim consumes it. `tests/engine/endlessReplayParity.test.ts` is extended
to cover Duo-active runs and MUST stay 20/20.

---

## 6. The 6 Duos (first slice)

| Duo | Signals | Effect | Primitive | Anti-trivialize gate |
|---|---|---|---|---|
| **CANCRENA** | veleno + esecuzione | poisoned enemies **under 40% HP take double poison ticks** | `bonusVsStatus` | only in the finishing window; target dies fast anyway |
| **MIASMA** | veleno + magieOscure | when a poisoned enemy **dies, its poison stacks jump** to a random living enemy | `spreadStatusOnDeath` | needs a kill to propagate; one jump per death; enemy HP scales in Endless |
| **UNTORE** | veleno + supporto | each team heal **spits 1 poison dose** onto a random enemy | `onHealApplyStatus` | only as fast as your heals |
| **MURO VIVENTE** | scudirigen + taunt | while the taunting Tank has a shield, **enemies can't hit your backline** | `untargetableWhile` | collapses when the shield breaks or the Tank is stunned (existing Global Rule) |
| **ESECUZIONE A FREDDO** | esecuzione + controllo | a **stunned/frozen** enemy under 50% HP is **finished outright** (boss → bonus dmg) | `executeOnStatus` | two-key lock (hard-control land + low HP); boss guard |
| **MIETITORE** | esecuzione + magieOscure | each **execute kill grants the killer +atk for the rest of the battle** | `onKillStackBuff` | per-battle only; needs execute kills |

Fast-follow (not in this slice): GUSCIO TOSSICO (scudirigen+veleno, thorns), PREDA FACILE
(controllo+attaccante), ARA/SACRIFICIO (magieOscure+taunt, recoil redirect), CATENE
(taunt+controllo, enemy speed down); enemy Duos; 3-ingredient Duos.

---

## 7. Discovery, Codex & UI

- **Codex (recipe book, Hades model, decision #9):** every Duo always shows **name + its two
  ingredient signals** (so you can chase it). The **effect text is hidden until first discovery**,
  then revealed and the entry flips grey → lit. `MetaCodex.duosSeen` records discoveries.
- **Discovery is NOT a power gate:** a Duo fires whether or not it's in `duosSeen`. `duosSeen` is
  cosmetic Codex state only → **no Endless fairness issue** (Endless intentionally has no meta power).
- **Banner (decision #10):** the active-Duo set is recomputed at `buildBattlePackage`. A Duo newly
  active in the run emits a toast ("CANCRENA scoperta!") in the battle intro. **No camera shake** (project rule).
- **In-run panel:** the synergy/team panel gains a Duo section showing **active** Duos and **near**
  Duos (one signal short: "MURO VIVENTE — manca: scudo"), reusing the synergy-preview pattern.

---

## 8. Balance & verification (decision #3 — the real anti-trivialize gate)

The balance bot never builds for Duos (player-only, like jokers), so `campaignBalanceB` will barely
move. Therefore:

- **Existing gates are SMOKE CHECKS only:** `campaignBalanceB` (~0.2833) and `endlessScaling`
  (median death-floor ~19) must not regress from accidental engine changes. Re-run both — they will
  be ~flat, and that flatness is expected, not proof of safety.
- **Duo stress-harness (NEW, the real gate):** per Duo, script the Duo-OPTIMAL player team and
  measure (a) campaign clear speed / win margin and (b) Endless depth reached. Target: **stronger,
  not auto-win.** Priority #1 stress build: CANCRENA + MIASMA + Tossicità + veleno relics (the
  poison-cascade case, decision #6/#11).
- **Pre-identified lever if a Duo breaks the stress-harness:** tune that Duo's number first;
  cap active Duos at 2/battle only if stacking itself is the problem (decision #6). Never delete a Duo.

Each Duo also gets: a unit test of its primitive in isolation, and a full-battle e2e proving the Duo
fires and does the thing.

---

## 9. Scope & decomposition (decision #8)

TDD tasks, executable subagent-driven (implementer → task review → final whole-branch review):

1. **Foundation** — `types/duo.ts`, `detectDuos` + 8 signals, `data/duos.ts` skeleton,
   `battlePackage` wiring hook, `MetaCodex.duosSeen` + `markSeen('duo')`. No Duo effects yet.
2–7. **One task per Duo** — its primitive module + unit test + data entry + battle e2e + stress-harness slice.
8. **UI** — Duo panel section (active + near), discovery toast, Codex tab. Minimal reuse of existing
   components, not a redesign. `frontend-design` skill may inform the toast/Codex visuals.

**Pre-defined cut line:** if the slice runs long, ship Foundation + 3 Duos (one per fantasy:
CANCRENA / MURO VIVENTE / ESECUZIONE A FREDDO) + UI first, then the other 3 — no re-design needed.

---

## 10. Out of scope (explicit)

Enemy Duos; 3-ingredient Duos; run-persistent MIETITORE ("rest of run"); the 4 fast-follow Duos;
Duo-specific spell content; house/group Duos. All are natural extensions once the first slice proves
the auto-ignite + Codex feel is fun.

---

## 11. Project rules honored

- Copy in Italian. Player-only Duos (matches the joker player-only rule → balance bot stays a valid proxy).
- MAX 5 enemies (untouched). No friendly fire (Duo targeting only ever affects the correct side). No camera shake.
- `npm run test` does NOT typecheck → run `npm run typecheck` separately.
- Any endless engine/map change re-runs the endlessScaling sweep (decision #1 extends the parity gate too).
