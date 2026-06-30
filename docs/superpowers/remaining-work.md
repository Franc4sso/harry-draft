# Remaining Work — Harry Potter Roguelite (handoff)

> Living backlog for "continue tomorrow". Last updated: 2026-06-28.
> Status snapshot: `master` = `origin/master` = `8e9dd1d` (pushed, clean). Suite **703/703**, tsc clean.
> Full design north-star: `docs/superpowers/specs/2026-06-28-game-design-direction.md` (the WOW-pillar roadmap + the Pokémon-style **counter-web** principle).
> Per-task execution history: `.superpowers/sdd/progress.md` (the SDD ledger).

---

## ✅ Done so far (all merged + pushed)

- **Veleno archetype — COMPLETE slice (A+B+C+D):** keyword engine + "che divora" ramp; draftability + Tossicità cap-lift; validation (counter matchups + viability sweep); loadout UI. Mechanically complete, draftable, validated, human-playable.
- **Esecuzione archetype — Plan A (engine + content) DONE:** team-wide execute (bonus dmg to low-HP targets) via `game/engine/execute.ts` `teamExecute`; `Spada di Grifondoro` (grants execute) + `Sigillo del Carnefice` (scales it) relics; `Spietatezza` synergy; 9 finisher wizards tagged.
- **Esecuzione archetype — Plan B (validation) DONE:** counter-web tests (`tests/engine/esecuzioneCounters.test.ts`: BEATS a fragile glass-cannon the execute flips; LOSES to a durable Regen wall that never drops under threshold) + favor-Esecuzione viability sweep (`tests/engine/esecuzioneSweep.test.ts`: winRate=0.850 execUptake=0.325 medianTurns=2 — the 0.850 is the same Serpeverde house-power skew Veleno surfaced, not a kit defect). Used winRate + turn-budget + execute-uptake, NOT total damage (execute is a multiplier with no discrete log flag). Mechanically complete + validated.
- **Scudi-Rigen archetype — COMPLETE slice:** regen-overflow→shield (refresh, no accumulation) via `game/engine/shieldConvert.ts` `teamShieldConvert` + the overflow branch in BOTH regen paths (`status.ts` status-tick AND `simulate.ts` team-regen — they are separate, the counter test caught the missing one); `Egida del Tasso` (grants conversion) + `Cuore del Tasso` (scales it) relics; `Bastione` synergy; `scudirigen` tags on 6 Tassorosso wizards. Counter-web validated (beats attrition via the flip, loses to esecuzione + burst) + viability sweep (`winRate=0.250 shieldUptake=0.142 maxTurns=47` — draftable-not-dominant wall; the low winRate is the Tassorosso house-power gap, not a kit defect; `maxTurns<cap` proves refresh holds, no stall). Mechanically complete + validated.

- **Magie Oscure archetype — COMPLETE slice:** dark-spell amplify + lethal recoil-on-damage-dealt via `game/engine/darkMagic.ts` `teamDarkMagic` + the attack handler (`effects.ts`, gated on `ctx.dark` from `resolve.ts`, recoil on `residual` so a shield negates payoff AND risk); a per-unit ASSIGNABLE relic `Marchio Nero` (amplify+recoil to one carrier) + `Diadema Corrotto` (scales bonus only) + `Oscurità` synergy (amplifies all dark casters, no recoil) + `magieOscure` tags on 6 wizards + the 3 dark spells (avada/fiendfyre/sectumsempra). NEW MECHANISM: per-unit relic assignment (resolver `assignedTo` + `RelicNodeScreen` carrier step, full UI→hook→resolver chain). Counter-web validated (beats squishy via the flip, loses to shields + chip/control via lethal recoil; partial-shield → proportional recoil) + viability sweep (`winRate=0.950 darkUptake=0.208 recoilDeaths=2 maxTurns=37`). Design note: recoilDeaths is low because optimal play assigns the Marchio to a high-HP carrier, dodging the recoil — rebalance lever is raising `recoil`, not lowering `bonus` (see memory). Mechanically complete + validated.

- **Enemy scaling fix (Slice 1) — DONE:** enemies fought at 7–30% of base stats (`menaceOffset=-1.05`), making the game far too easy and the displayed level meaningless. Fixed `campaignB.menaceOffset` -1.05→-0.70 (data-driven from a sweep) so 'Lv.N' enemies fight at level-coherent stats (lv2 0.42 vs 0.07, lv10-boss 1.38); competent-Grifondoro winRate 0.167, band tightened to [0.15,0.45] ("much harder"). `scudiRigen` shieldUptake floor 0.10→0.05 (justified consequence).
- **Death & Recovery system (Slice 2) — DONE:** death no longer eliminates — a dead wizard benches at `currentHp=0` (`game/engine/roster.ts` `isDead`/`livingOf`; only the living are fielded, count for synergies, and gain levels; defeat = ALL dead). New **Infermeria** node (🏥, full heal + full revive), forced as a guaranteed Infermeria-only floor immediately before every boss (`map.ts`/`nodeGen.ts` — the LIVE `generateArea` path; the node is fully phase/view/UI-integrated via `InfirmaryScreen`). Dead wizards are swappable at recruit (greyed + "Morto" badge). ⚠️ the death system made the game HARDER (benched 0-HP wizards weaken the team mid-area) — a strong final boss is unreachable above the win floor: `finalBossMenace` capped at the band ceiling, final boss stays weaker than area bosses (documented trade-off). To make the final boss a real climax, add a MID-AREA recovery lever first (see memory `harry-draft-death-system-harder`).
- **Map: first choice among 3 (Slice 6) — DONE:** the run's first decision offers 3 paths (floor 1 forced to width 3 in `generateArea`); every later branch keeps the 2-nearest cap. `finalBossMenace` retuned for the shifted encounter mix.
- **Battle pacing — DONE:** battles dragged to ~24 turns (fat tail at the fatigue convergence); `fatigueStart` 30→18 brings the median to ~15 (better feel) and clears most timeout-flakes in heavy tests.
- **House synergies redesign — DONE:** the four house synergies dropped flat +atk/+def/+spd for characterful per-unit mechanics (`game/engine/houseEffects.ts`, hooked in `effects.ts`): **Grifondoro** extra dodge (courage), **Corvonero** boosted crits (intelligence), **Tassorosso** damage-reduction + regen (loyalty), **Serpeverde** +damage to wounded targets (cunning — replaces the flat +atk, the imbalance root). 3 non-Serpeverde houses tuned to a tight spread (~0.08–0.19); campaignBalanceB in band. ⚠️ Serpeverde still ~0.73 — diagnosed NOT a synergy issue: it's **Voldemort + Sectumsempra** (atk≈40 × power 2.4 one-shots early enemies before cunning's wounded-threshold fires). The Serpeverde/Voldemort balance is a separate wizard-data concern, not the house synergy.

**Counter web so far (emergent from mechanics):**
| | Beats | Loses to |
|---|---|---|
| Veleno | Tank / Scudi (bypasses DEF + shields) | Regen / Burst |
| Esecuzione | Fragile / low-HP (finisher) | Durable walls (Tank/Scudi/Regen) |
| Scudi-Rigen | Attrito / danno-sostenuto (overflow→scudo out-sustaina) | Esecuzione (finisce sotto soglia) / Burst (sfonda lo scudo) |
| Magie Oscure | Squishy (nuke amplificato one-shotta) | Scudi (assorbe → niente payoff né recoil) / Chip-Controllo (recoil letale sul nuke pieno) |

---

## 1. NEXT UP — remaining user-requested slices (2026-06-29/30 session)

Most of the 6-slice user request is DONE (scaling, death&recovery, modal timing, map-3-options, pacing,
house redesign — all above). Remaining:
- **Random battle generation with criteria (user bug #3) — NOT STARTED, biggest open item:** battles are
  repetitive because `pickTowardBudget` draws enemies from a FIXED budget-bound wizard window (~15
  candidates per node type/position) — the seed varies stat-rolls but not character identity. Wanted:
  randomized-with-criteria (fewer synergies in easy, more in elite/boss) + TELEGRAPH the enemy
  synergies/boss in the map tree. Feasible: enemy teams are deterministic & computable at map-build time
  → pre-generate a `RunNode.preview` and render badges. Needs: `RunNode.preview` field, a synergy-aware/
  wider picker in `teamGen.ts`, pre-gen in `generateArea`, `synergyBias` by nodeType, `MapScreen` badges.
  BIG — needs a brainstorm (synergy counts per difficulty + telegraph visual).
- **Guaranteed-hit wizard abilities (user request):** tier-2/3 abilities on some wizards that make their
  hits ALWAYS land (ignore dodge) — a counter to Grifondoro's dodge. A NEW per-wizard ability system
  (wizards have no abilities today). Separate slice, needs design.
- **Resurrection CONSUMABLE relic (split-out):** one-shot relic usable before any node, consumed on use
  (removable inventory + active-use UI — a new mechanism, relics today are permanent/passive).
- **Strong final boss:** needs a MID-AREA recovery lever first (see death-system note above), THEN raise
  `finalBossMenace` to a real climax (statMult ≥ area-2 boss 1.38).
- **Serpeverde/Voldemort balance:** Serpeverde still ~0.73 — it's Voldemort+Sectumsempra, not the house
  synergy. A wizard-data tune (nerf Voldemort's atk or Sectumsempra power) is the lever; user prefers NOT
  to gut Voldemort, so consider lowering Sectumsempra's power or adding a counter instead.
- **Cleanup:** `baseAttackMult` in constants is vestigial (never read by the engine) — remove or wire it.
- **Split-out — Resurrection CONSUMABLE relic:** one-shot relic usable before any node, consumed on use
  (removable inventory + active-use UI — a new mechanism, relics today are permanent/passive).
- **Future — strong final boss:** needs a mid-area recovery lever first (see death-system note above).

Plus the older backlog:
- **Serpeverde house-power skew** also shows in the archetype sweeps (Esecuzione/Veleno/Magie Oscure all
  high) — Slice 3 above addresses the house; re-measure all three after.
- **More archetypes** from the direction doc (Velocità/Catena, Controllo, Rigen/Vampiro, Sacrificio,
  Evocazione, Crescendo, Difensiva). The Magie Oscure slice
  (`docs/superpowers/specs/2026-06-29-magie-oscure-archetype-design.md` +
  `docs/superpowers/plans/2026-06-29-magie-oscure-archetype.md`) is the freshest template — and it now
  proves the per-unit assignable-relic mechanism, reusable for future "equip on one wizard" designs.
- **A non-archetype pillar** — P3 Eventi narrativi (the empty event/shop/library/forest nodes) is the
  biggest *memorability* gap and is pure data/text (#5 below).

---

## 2. Drama & feedback (both archetypes) · *USER-GATED (visual direction needed)*

Presentation-only; the engine already emits what's needed (veleno stacks flow through battle snapshots; `serpensortia` emits a discrete `applyStatus veleno`; execute multiplies a hit). Deferred because the visuals are the user's call.
- On-screen callouts in `components/screens/BattleScreen.tsx`: "VELENO ×N / −M per turno" at stack thresholds; execute-kill flourish.
- MVP / end-of-battle recap surfacing poison & execute damage (`VictoryScreen`).
- **To start:** the user provides a visual direction / mockup, then it's a focused UI plan.

---

## 3. Archetypes #3 and #4 (replicate the proven pattern) · *medium each*

The tracer-bullet pattern (engine → draftability/synergy → validation → loadout-already-built; drama deferred) is proven twice and runs fast. Remaining flagship archetypes from the direction doc (Appendix D):
- **Scudi-Rigen** (Tassorosso): "non potete scalfirmi" — convert excess regen → shield; the wall. Counter target: beats sustained-damage/attrition, loses to burst/execute (irony: Esecuzione should beat it) and to anti-heal.
- **Magie Oscure** (Serpeverde/Mangiamorte): glass-cannon nuke (Avada/Fiendfyre); high risk via Corruption. Counter: beats squishy, loses to control/shields.

Each needs: keyword content (keywords already declared), a granting/scaling relic pair, a tag-synergy, draftability tags, validation. Then the other backlog archetypes (Velocità/Catena, Controllo, Rigen/Vampiro, Sacrificio, Evocazione[new], Crescendo, Difensiva).

**Design rule (from the user):** every new archetype's spec must declare its **counter matrix** (what it beats / loses to) + a test that verifies it.

---

## 4. Serpeverde house rebalance · *SEPARATE balance task, not an archetype*

Diagnostic (committed as a comment in `tests/engine/velenoSweep.test.ts`): a competent **Serpeverde** team wins **~0.76–0.87** vs the calibrated **Grifondoro ~0.275** (band 0.15–0.55). Independent of any archetype. Needs a roster-stat + enemy-scaling recalibration. ⚠️ Coupled to the `campaignBalanceB` Grifondoro test — touching shared enemy scaling can break it; tune Serpeverde's pool, not global scaling.

---

## 5. Bigger pillars from the direction doc (Onda 2+) · *large, future*

Beyond archetypes, the WOW-pillar roadmap (`...game-design-direction.md`):
- **P2 — Reliquie cambia-regole** (rule-breaking relics: turn order, double-cast, conversions).
- **P3 — Eventi narrativi** (the empty `event`/`shop`/`commonRoom`/`library`/`forest` nodes — the biggest *memorability* gap; pure data/text).
- **P4 — Boss roster** (scripted bosses, each a rule that counters an archetype: Umbridge bans a keyword, Dissennatori drain, Bellatrix, etc.).
- **P5 — Economia del Sacrificio** (painful choices, Corruption, sacrifice relics).
- **P6 — Sorprese & segreti** (rare recruits, hidden bosses, Doni della Morte questline).
- **P7 — Meta-progressione** (Codex/unlocks "a scoperta non a potere", Ascensione, Daily Run).
- **P8 — Drama** (item #2 above).

---

## 6. Small cleanups / accumulated FINAL-TRIAGE minors

From the ledger (`.superpowers/sdd/progress.md`) — none blocking, fix opportunistically:
- A few tests skip a "dark" no-op branch (e.g. `setWizardSpell` same-spell guard untested).
- `keywordDamageMult`/`setWizardSpell` controller commits even on no-op state (harmless; React bails on same ref).
- A pre-existing data-invariant blind spot in `tests/data/spells.test.ts` (a spell with top-level `power` + a `spec` lacking a damage entry would pass the "attack deals damage" check).
- `teamKeywords` helper from the Veleno spec was never built (only needed if a sweep must count non-tag keyword sources).

---

## How to resume (quick start tomorrow)

1. Read `.superpowers/sdd/progress.md` (the ledger) — it has every task, commit, and decision.
2. Pick item #1 (Esecuzione Plan B) for a quick autonomous win, or #3 to start archetype #3.
3. The proven loop: write a slice spec/plan → execute subagent-driven (TDD → spec+quality review → fix-loop → opus whole-branch review) → merge → push.
4. Reuse the patterns: keyword tagging + tag-synergy + per-unit flag stamped in `toBattleUnits` + a granting/scaling relic pair; **first-hit metric, not total damage**; every archetype declares its counter matrix.
