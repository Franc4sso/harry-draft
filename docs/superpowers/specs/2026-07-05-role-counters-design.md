# Role Counters — Design Spec (2026-07-05)

> **SUPERATA 2026-07-13**: il moltiplicatore di counter di ruolo (×1.25) è stato RIMOSSO —
> vedi `docs/superpowers/specs/2026-07-13-remove-role-counter-design.md`. Il ciclo era metà-morto
> (il Supporto non attacca). Il targeting di ruolo (affondo/backline/taunt) e l'hard-control
> descritti qui restano validi; solo il moltiplicatore di danno è stato tolto.

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
- The enemy **Controllo stuns your Tank** → its taunt switches off → *their* Attaccante dives your Supporto that window.
- Your **Supporto cleanses/halves that stun** → the Tank's taunt comes back → the window closes.

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
| 🛡️ Tank | **Provocazione** | `threatScore` +`tauntBonus` (1000) → enemies focus the Tank. **Suppressed while the Tank is under a hard-control effect** (see Global Rule below). |
| ⚔️ Attaccante | **Affondo** | Targeting: if the enemy Tank's taunt is active → hit the Tank (taunt wins). If the enemy Tank is **disabled** (taunt suppressed) or absent → dive **enemy Supporto → Controllo → highestThreat**. |
| ✨ Supporto | **Tenacia + Purificazione** | While ≥1 Supporto is alive on a side: (a) incoming **hard-control** durations — the `control` family only: `stun`/`freeze`/`silence` (NOT graded slows/debuffs) — on that side are **halved** (min 1); (b) at the start of each Supporto's turn, **remove one control-family effect** from the most-disabled ally (free, doesn't consume its action). |
| 🌀 Controllo | **Sabotaggio** | Its control effects land at **full duration on Tanks** (flip the current halving) + it keeps backline access. Its counter to Tank comes from the Global Rule: landing a hard-control on the enemy Tank **switches off that Tank's Provocazione** for the duration — opening the wall for the whole team. |

### Global Rule — a stunned wall can't provoke
**A Tank under a hard-control effect (`stun` / `freeze` / `silence`) loses its Provocazione for as long as the effect lasts.** This is the pivot of the cycle:
- It is how **Controllo beats Tank** — but *conditionally*: the Controllo must actually land control on the Tank (target it + not be resisted), it's temporary (lasts as long as the stun), and it requires the Controllo to hold a control spell (guaranteed by the spell↔role bias).
- It is what opens **Attaccante's Affondo** — the diver can slip past the wall only during that window (a coordinated combo: Controllo disables the Tank, Attaccante dives that turn).
- It is countered by **Supporto's Tenacia** — halving/cleansing the control restores the Tank's taunt, closing the window. A genuine tug-of-war, not an on/off switch.
- Against a team with no Controllo, the Tank is at full strength; it is never *permanently* neutralised.

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

### Pool guarantee per role (approved — NOT a hard lock)
The bias only helps if the pool actually contains a role-matching spell. So we add a
**data invariant**, not a runtime lock:

- **Every wizard's `spellPool` must contain ≥1 spell of its role's preferred type.**
  Audit `data/wizards.ts` and add a role-appropriate spell to any pool that lacks one.
  Off-role spells stay in the pool as flavour/variety (the bias just deprioritises them),
  so a Tank can still surprise with an attack and Hermione keeps her wide kit.
- This is the ONLY hard requirement the counter system places on data: three of the four
  identities are role passives (Provocazione, Affondo, Tenacia) that fire regardless of
  the equipped spell; only **Controllo** depends on holding a control spell to trigger the
  Global Rule — the guarantee ensures every Controllo always can.
- A unit test enforces the invariant across the whole roster (so future wizards can't
  silently violate it).

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
- Affondo: an Attaccante dives the enemy Supporto when the enemy Tank is absent/disabled;
  obeys taunt when the enemy Tank's taunt is active.
- Tenacia: a control status applied to a side with a live Supporto has halved duration;
  cleanse removes one control effect on the Supporto's turn.
- Global Rule: a Tank under stun/freeze/silence loses its taunt (attackers are no longer
  forced onto it); the taunt is restored when the control expires or is cleansed. Controllo
  control lands full-duration on Tanks.
- Spell bias: a Controllo equips a Controllo-type spell when its pool has one; falls
  back gracefully; enemy offensive guarantee still overrides.
- Pool invariant: every wizard in `data/wizards.ts` has ≥1 spell of its role's preferred
  type in its `spellPool` (roster-wide assertion).

## Files to touch (grounded)

- `data/constants.ts` — `BALANCE.roles`: add `matchupBonus`, `ROLE_PREY`; remove
  `controlVsTank`/`controlVsBackline`; add Tenacia/Affondo tuning params.
- `game/engine/combat/effects.ts` — matrix in `computeDamage`; flip Controllo-vs-Tank
  status duration; Tenacia duration halving on control apply.
- `game/engine/combat/targeting.ts` — Affondo (Attaccante dive); Global Rule in
  `threatScore` (zero the taunt term when the Tank is under stun/freeze/silence).
- `game/engine/combat/simulate.ts` — Supporto cleanse passive in the turn loop.
- `game/engine/status.ts` — control-duration hook + cleanse helper.
- `game/engine/statRoll.ts` — role→spell-type bias in `pickSpell`.
- `data/wizards.ts` — audit + fill pools so every wizard has ≥1 role-type spell.
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
