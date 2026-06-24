# Role Identity & Threat-Based Combat — Design

**Date:** 2026-06-24
**Status:** Approved (staged rollout: Phase 1 core now, Phase 2 traits later)

## Problem

The four roles (`Attaccante`, `Tank`, `Supporto`, `Controllo`) exist in the data
model but feel almost identical in play:

- A Tank (McGonagall: HP 105-130) has nearly the same HP as an Attacker
  (Voldemort: HP 100-125). The "tank" never feels like a wall.
- Targeting is a fixed per-role heuristic in `selectTarget()` with no real
  aggro/threat: nothing *forces* enemies to focus the Tank, the user's key
  requirement ("il Tank dev'essere SEMPRE il primo da targettare").
- Roles have no signature mechanic beyond a stat lean.

## Goal

Give each role a distinct, legible identity built on a **rock-paper-scissors**
loop, so team composition matters. Ship the core loop first (low risk), validate
it is fun and balanced in practice, then layer optional per-wizard **traits**.

This is an **auto-battler**: combat resolves with no mid-fight player input.
That has two consequences the design must respect:
1. Balance is fragile — one overtuned mechanic snowballs invisibly. Keep the
   core small and tunable via constants.
2. Legibility is load-bearing — if a mechanic fires invisibly in the replay, the
   player can't learn from it. Every new mechanic must surface in the replay log.

---

## Phase 1 — Core role identity (this spec implements this)

### 1. Threat / Taunt targeting

Replace the fixed heuristics in `game/engine/combat/targeting.ts` with a
**threat score**. Attack-type actors pick the enemy with the highest threat.

```
threat(u) = effectiveStats(u).atk + effectiveStats(u).spd
          + (u.wizard.role === 'Tank' ? ROLES.tauntBonus : 0)
```

`ROLES.tauntBonus` is large enough to dominate any realistic `atk + spd` sum
(reference: atk+spd peaks ~70, so `tauntBonus = 1000`). Effect: while a Tank is
alive, **every basic attacker targets it first**. When the Tank dies, threat
falls back to `atk + spd`, so attackers then focus the most dangerous backliner.

Per-role target selection:

| Role | Targets |
|------|---------|
| **Attaccante** | Highest threat enemy → the Tank (taunt), else most dangerous backliner |
| **Tank** | Lowest-HP enemy (opportunistic finisher; its damage is low by design) |
| **Controllo** | **Bypasses taunt**: highest-value non-Tank enemy — prefers enemy `Supporto`, else highest threat among non-Tanks. If only Tanks remain, hits a Tank. |
| **Supporto** | Most wounded ally (unchanged); fallback weakest enemy if no ally is hurt |

This is the "priorità forte, non assoluta" the user chose: attackers are
effectively glued to the Tank, but **Controllo reaches past the wall** — the
tactical escape valve that gives Control a reason to exist.

`highestThreat`, `lowestHp`, and `mostWounded` helpers stay; add a
`backlineTarget` helper for Controllo and a shared `threatScore` function.

### 2. Attacker armor penetration (baseline)

Because attackers are forced onto the Tank, they must be able to grind it down,
or the fight stalls. Give the `Attaccante` role a **baseline** armor-pen: it
ignores a fraction of the target's defense in the damage formula.

In `game/engine/combat/effects.ts`, `computeDamage`:

```
const penalty = actor.wizard.role === 'Attaccante' ? ROLES.attackerArmorPen : 0
const def = effectiveStats(target).def * (1 - penalty)
let dmg = atk * power - def * c.defenseK
```

`ROLES.attackerArmorPen` reference: `0.4` (ignores 40% of DEF). Tunable.

This is **baseline**, not a trait — an Attacker with zero traits still penetrates
and is therefore "a real attacker" (the user's "un atk senza tratti è normale").

### 3. Stat rebalance per role

Redistribute each wizard's stats toward its role identity. **Per-role budget
drift is intended and desired**: Tanks end up net bulkier (~+12% budget) and
Attackers net glassier (~−9%), which is exactly the requested identity. The
invariant is at the **team/roster level, not per wizard**: across a balanced
mix of roles these shifts roughly cancel, so total power does not creep. A loose
guard test (per-tier average budget stays in a sane order-of-magnitude band)
catches gross data corruption; it deliberately does not enforce a tight
per-wizard band, because a tight per-wizard band would fight the role identity.

Role stat *profiles* (priority emphasis), applied per wizard preserving its tier
power band:

| Role | HP | ATK | DEF | SPD | Identity |
|------|----|----|----|----|----------|
| **Tank** | very high | low | very high | low | The wall — soaks, barely scratches |
| **Attaccante** | **low** | very high | low | high | Glass cannon — melts, dies fast |
| **Controllo** | medium | medium | medium | **very high** | Disruptor — acts first, bypasses |
| **Supporto** | medium-high | low | medium | medium | Healer — survives to keep the wall up |

Concrete contrast targets the rebalance must achieve (guard with a smoke test):
- Tank HP ≈ **1.4–1.6×** Attaccante HP (today it's ~1.0× — the core problem).
- Tank DEF ≈ **1.7–2.0×** Attaccante DEF.
- Attaccante ATK ≈ **1.6–1.9×** Tank ATK.
- Controllo SPD is the highest band of any role.

Exact per-wizard `ranges` are tuned in the implementation plan; this spec fixes
the direction, the invariant (no power inflation), and the contrast targets.

### 4. New balance constants

Add a `roles` block to `BALANCE` in `data/constants.ts` so nothing is a magic
number and the loop is tunable in one place:

```
roles: {
  tauntBonus: 1000,       // additive threat that makes a live Tank the focus
  attackerArmorPen: 0.4,  // fraction of target DEF an Attaccante ignores
}
```

### 5. Replay legibility

The two new mechanics must be visible in the battle replay so the player can read
the fight:
- When an Attacker's hit benefits from penetration, the log entry carries a
  `pen` flag (rendered, e.g., a small "armatura ignorata" cue).
- Taunt is already implicitly legible (attacks land on the Tank), but the Tank's
  card/unit should show a small taunt indicator so the focus reads as intentional.

Surfacing reuses the existing `LogFlag` + replay rendering pipeline.

### 6. Testing

- `targeting`: a live Tank is the chosen target of every enemy Attacker; a
  Controllo ignores the Tank and hits the enemy Supporto; Tank-dead falls back to
  highest-threat backliner.
- `effects`: an Attaccante's damage against a high-DEF target is higher than a
  non-Attacker's with identical atk/power (pen applies); pen never reduces below
  `minDamage`.
- `balance smoke`: after the stat retune, the per-role contrast targets in §3
  hold across the roster, and per-tier power budget stays within ±5%.
- Existing combat/replay suites stay green.

---

## Phase 2 — Traits (designed now, implemented later)

Traits are an **optional modular layer on top of** the role baseline. A wizard
has `traits?: string[]` (0, 1, 2+). Hand-authored per wizard, thematic. A wizard
with no traits is still a full member of its role (baseline covers identity).

Data: catalog in `data/traits.ts`; each trait = `{ id, name, desc, hook }` where
`hook` plugs into the **existing relic hook infrastructure**
(`onTurnStart` / `onHit` / `onDamaged` / `onDeath` / passive). No core engine
rewrite — traits ride the relic event system.

### Catalog (first pass — trimmed for balance safety)

**🛡️ Tank**
- *Riflesso* — reflects a % of damage taken back to the attacker.
- *Guardiano* — while alive, allies take −10% damage.
- *Roccia* — the first hit received each turn is halved.

**⚔️ Attaccante**
- *Esecuzione* — +50% damage vs targets below 30% HP.
- *Furia* — gains ATK as its own HP drops.
- *Doppio Colpo* — chance to strike twice.

**🌀 Controllo**
- *Catene* — its control effects (stun/debuff) last +1 turn.
- *Sifone* — its hits also reduce the target's SPD.

**✨ Supporto**
- *Benedizione* — its heals also grant a small shield.
- *Purifica* — removes a control/debuff from the healed ally.
- *Egida* — every 2 turns, shields the allied Tank.

**♾️ Cross-role**
- *Vendetta* — when hit, counterattacks for reduced damage.
- *Tenacia* — survives one otherwise-lethal hit at 1 HP.
- *Sangue Freddo* — immune to the first control effect.

### Deliberately cut (don't fit an auto-battler)

- *Anticipo* ("ignore SPD, always act first") — voids the SPD identity that is
  the whole point of Controllo. It fights its own role.
- *Marchio* ("+damage from allies on the marked target") — assumes allies focus
  the marked unit, but targeting is automated by threat; wiring it in fights the
  taunt system.

### Phase 2 legibility requirement

Every trait that fires emits a flagged log entry so the replay shows floating
cues (e.g. `ESECUZIONE!`). In an auto-battler, an invisible trait is a trait the
player can't learn from — legibility is a first-class requirement, not polish.

### Phase 2 UI

Trait chips on the wizard card, styled like the existing synergy chips.

---

## Non-goals

- Random/rolled trait assignment (chosen: hand-authored only).
- Player input during combat (remains an auto-battler).
- New stats beyond hp/atk/def/spd.
- Implementing Phase 2 before Phase 1 is validated in play.
