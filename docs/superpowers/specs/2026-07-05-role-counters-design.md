# Role Counters — Design Spec (2026-07-05)

## Goal

Turn the four wizard roles (Attaccante, Tank, Supporto, Controllo) into a legible
rock-paper-scissors counter system so team composition and drafting carry real
tactical weight. Today only **Tank** feels like a role (taunt is a visible *rule*);
the other three are thin or invisible. This makes each role a rule you can see —
like taunt — and makes "what did the enemy bring?" a core drafting question.

## The counter cycle (approved)

A clean 4-cycle: **each role has exactly one prey and one predator.**

```
🛡️ Tank → ⚔️ Attaccante → ✨ Supporto → 🌀 Controllo → 🛡️ Tank
```

- **Tank beats Attaccante** — the wall soaks the bruiser; taunt forces him to waste hits on it.
- **Attaccante beats Supporto** — the assassin dives and deletes the healer.
- **Supporto beats Controllo** — the healer cleanses the disabler's locks and out-sustains its chip.
- **Controllo beats Tank** — a taunt with no teeth: the controller neutralises the wall's provocazione.

### Why it interlocks (the emergent depth)
- The **Tank shields your Supporto** from the enemy Attaccante (taunt redirects the diver).
- The enemy **Controllo cracks your Tank's taunt** — freeing *their* Attaccante to dive your Supporto.
- Your **Supporto cleanses their Controllo** — so the taunt-break never lands.

A full 4-role team is a chain of nested protections. Reading the enemy roster
(already shown on the map hover card) becomes tactically meaningful.

## Two layers (approved: hybrid)

### Layer 1 — Damage matrix (the legible number)
One-directional matchup multiplier: an attacker deals **×1.25 to the role it preys
on**, ×1.0 to everything else. This is the "fire beats grass" number, shown on the hit.

- `BALANCE.roles.matchupBonus = 0.25`
- `ROLE_PREY: { Tank: 'Attaccante', Attaccante: 'Supporto', Supporto: 'Controllo', Controllo: 'Tank' }`
- `roleMult(atk, def) = 1 + (ROLE_PREY[atk] === def ? matchupBonus : 0)`

Hooks into `computeDamage` (`effects.ts:17-20`) exactly where the current
`controlVsTank` / `controlVsBackline` mults live — those two are **removed** and
replaced by the matrix (Controllo's real anti-Tank power moves to its passive below).
The Attaccante `attackerArmorPen` (0.2) is **kept** as extra bruiser flavor.

### Layer 2 — Signature role passives (the identity)
All passives are **role-based**, never dependent on the equipped spell (which is a
random pool draw), mirroring how taunt works today.

| Role | Signature | Behaviour |
|---|---|---|
| 🛡️ Tank | **Provocazione** *(unchanged)* | `threatScore` +`tauntBonus` (1000) → enemies focus the Tank. |
| ⚔️ Attaccante | **Affondo** | Targeting: if a live enemy Tank is taunting (and not bypassed) → hit the Tank (taunt wins). Otherwise dive **enemy Supporto → Controllo → highestThreat**. |
| ✨ Supporto | **Tenacia + Purificazione** | While ≥1 Supporto is alive on a side: (a) incoming **hard-control** durations — the `control` family only: `stun`/`freeze`/`silence` (NOT graded slows/debuffs) — on that side are **halved** (min 1); (b) at the start of each Supporto's turn, **remove one control-family effect** from the most-disabled ally (free, doesn't consume its action). |
| 🌀 Controllo | **Spezza-Provocazione** | While ≥1 Controllo is alive on a side, that side's attackers **ignore the enemy Tank's taunt** (reuses the `ignoresTaunt` path). Plus Controllo's control effects land at **full duration on Tanks** (flip the current halving) and it keeps backline access. |

## Spell ↔ Role bias (approved: strong bias)

Today the equipped spell is `rng.pick(spellPool)` with role never consulted, so a
"Controllo" often holds an attack spell and its identity never fires. Add a **strong
bias** in `statRoll.pickSpell`:

- Preferred SpellType per role: Attaccante→`Attacco`, Controllo→`Controllo`,
  Supporto→`Cura`/`Difesa`, Tank→`Difesa` (fallback `Attacco`).
- Pick from role-matching spells in the pool if any exist; otherwise fall back to the
  whole pool (no hard lockout — a Tank with only attack spells still equips one).
- **Enemy offensive guarantee still wins:** `preferOffense`/`guaranteeOffense`
  (elite/boss) is applied on top, so a biased Supporto enemy can still be forced to a
  damaging spell — no zero-damage elites.

## Legibility (non-negotiable — the reason taunt works)

Counters must be **visible** or they'll feel like Controllo does today.
- **Wizard cards + map EnemyPreview:** a small "forte vs {prey icon}" line per role.
- **Battle:** a "Forte!" cue on a hit that gets the ×1.25; role-passive tags
  (Provocazione / Affondo / Tenacia / Spezza-Provocazione) visible on unit cards.
- Verify visually with the Playwright screenshot harness ([[screenshot-harness]]).

## Balance & testing

- The AI balance bot does **not** understand counters → **user playtest is the real
  gauge** (same caveat as jokers/scaling). Treat `campaignBalance*` winRates as smoke
  checks during this work; re-anchor after playtest.
- Enemy teams are themed with mixed roles, so counters mostly help the *player* who
  drafts intentionally — good for roguelite depth.
- Max-5-enemies cap and all prior invariants unchanged.

### Tests to add
- `roleMult` matrix values + that it fires only on the prey edge (unit).
- Affondo: an Attaccante dives the enemy Supporto when no taunt; obeys taunt when a
  Tank is alive; ignores taunt when its side has a live Controllo.
- Tenacia: a control status applied to a side with a live Supporto has halved duration;
  cleanse removes one control effect on the Supporto's turn.
- Spezza-Provocazione: an attacker whose side has a live Controllo bypasses the enemy
  Tank's taunt; Controllo control lands full-duration on Tanks.
- Spell bias: a Controllo equips a Controllo-type spell when its pool has one; falls
  back gracefully; enemy offensive guarantee still overrides.

## Files to touch (grounded)

- `data/constants.ts` — `BALANCE.roles`: add `matchupBonus`, `ROLE_PREY`; remove
  `controlVsTank`/`controlVsBackline`; add Tenacia/Affondo tuning params.
- `game/engine/combat/effects.ts` — matrix in `computeDamage`; flip Controllo-vs-Tank
  status duration; Tenacia duration halving on control apply.
- `game/engine/combat/targeting.ts` — Affondo (Attaccante dive); Spezza-Provocazione
  (taunt bypass when side has a live Controllo).
- `game/engine/combat/simulate.ts` — Supporto cleanse passive in the turn loop.
- `game/engine/status.ts` — control-duration hook + cleanse helper.
- `game/engine/statRoll.ts` — role→spell-type bias in `pickSpell`.
- `lib/roleInfo.ts`, wizard cards, `components/screens/MapScreen.tsx` (EnemyPreview),
  battle unit cards — legibility.
- `tests/…` — the suite above.

## Tuning knobs (single block in `BALANCE.roles`)
`matchupBonus 0.25`, `tauntBonus 1000` (unchanged), `tenaciaControlDurationMult 0.5`,
`tenaciaCleansePerTurn 1`, `controlVsTankDurationMult 1.0` (was 0.5, flipped),
`affondoPreyOrder ['Supporto','Controllo']`.

## Out of scope (YAGNI)
- No new spells or statuses (reuse the existing palette).
- No turn-order/initiative counters (M5) — deferred; the matrix + passives cover it.
- Role synergies stay flat-stat for now (not repurposed as matchup boosters).
