# Spell audit — 2026-07-01

Every spell in `data/spells.ts`, its real in-combat effect (traced through
`normalizeSpell.ts` → `EFFECT_HANDLERS` in `game/engine/combat/effects.ts`),
and a verdict. Verdicts: **ok** (does what it implies), **weak** (does
something but underwhelming for its cost/cooldown), **inert** (does nothing
or is silently dropped).

## Attacco

| id | effect | verdict |
|---|---|---|
| base_attack | power 1.0 dmg | ok (fallback attack) |
| expelliarmus | power 1.4 dmg | ok |
| stupeficium | power 1.6 dmg + stun 1 | ok |
| sectumsempra | power 2.4 dmg (dark) | ok |
| bombarda | power 2.0 dmg | ok |
| incendio | power 1.2 dmg + dot 8x2 | ok |
| avada | power 3.2 dmg (dark) | ok |
| reducto | power 1.8 dmg | ok |
| diffindo | power 1.3 dmg | ok |
| confringo | power 1.9 dmg + dot 6x2 | ok |
| flipendo | power 1.1 dmg | ok |
| oppugno | power 1.5 dmg | ok |
| fiendfyre | power 2.8 dmg + dot 12x2 (dark) | ok |
| serpensortia | power 1.4 dmg + applies veleno 2 | ok |

## Controllo

| id | effect | verdict |
|---|---|---|
| crucio | dot 10x2 + atk debuff 10x2 | ok |
| imperio | stun 2, cooldown 2 | ok |
| petrificus | stun 1 | ok |
| levicorpus | def debuff 20x2 | ok |
| confundo | spd debuff 15x2 | ok |
| langlock | atk debuff 18x2 | ok |
| **tarantallegra** | spd debuff 20x2 **only**, 0 damage, no control payload | **weak** — the only pure-debuff Controllo spell with no stun/dot; strictly worse than confundo/langlock for the same cooldown. **Fix (this task):** add a 1-turn stun alongside a stronger slow. |
| glacius | applies freeze 1 (via spec) | ok |
| silencio | applies silence 2 (via spec) | ok — **but see Silence gate below** |

## Cura

| id | effect | verdict |
|---|---|---|
| episkey / vulnera / rennervate / anapneo | flat heal | ok |
| ferula | heal 14 + def buff 10x2 | ok |

## Difesa

| id | effect | verdict |
|---|---|---|
| protego / protego_maxima | ward (spec, blocks next 1/2 enemy spells) | ok |
| **fianto** | self def buff +30 for 2 turns (inline `effects`, no `spec`) | **weak** — mechanically fires (Difesa self-cast path is correct), but it's just a flat stat mod like every other Difesa buff spell (salvio/riddikulus/expecto) with none of the "barrier" identity its name/desc implies, and against burst damage a def buff does much less work turn-1 than an absorb shield of the same "budget". **Fix (this task):** convert to a `shield` spec (matches `aegis`'s existing schema) with a smaller def buff kept alongside. |
| salvio | self spd buff 20x2 | ok |
| riddikulus | self atk buff 20x2 | ok |
| expecto | self def buff 25x3 + spd buff 15x3 | ok |
| aegis | shield 60 for 3 turns (spec) | ok — reference implementation for the fianto fix |

## Silence gate (status system, not a spell def)

Explorer notes for this task claimed `canCastSpell` (`status.ts:121`) is
never consulted by the sim loop, making `silence` inert. **This is stale** —
verified against the current tree:

- `game/engine/combat/selectSpell.ts` already calls `canCastSpell(unit)` and
  falls back to `SPELL_BY_ID['base_attack']` when it returns false (see
  commit `cf1d8dd feat(engine): silence falls back to base attack; stun/freeze
  via canAct`, already on `master` before this task).
- `tests/engine/combat/statusIntegration.test.ts` already has a passing
  assertion: *"silencio silences: target falls back to base attack"*
  (`canCastSpell(b)` is `false`, `selectSpell(b)?.id` is `'base_attack'`).
- Ran `npx vitest run tests/engine/combat/statusIntegration.test.ts` — 3/3
  pass on the pre-task tree.

**Verdict: silence is already fixed and covered — no code change needed for
Step 4.** This task adds `tests/combat/silence.test.ts` as an additional,
independent regression test at the requested path/location (full-battle
harness rather than single-`resolveAction` unit test), per the brief's Step
2, but it is confirmatory rather than a fix.

## Unreferenced status defs (not spells, flagged for completeness)

`data/statuses.ts` defines graded percentage variants — `weaken1/2/3`,
`expose1/2/3`, `slow1/2/3` — that no spell in `data/spells.ts` applies via
`statusId` (grep confirms zero references outside `statuses.ts` itself).
These are pure dead data, presumably reserved for boss/trait use. **Deferred**
— out of scope for a spell sweep (no spell regresses because of them), and
inventing a consumer would be scope creep per the brief's Step 9 guidance
("do not scope-creep into new mechanics").

## Summary of fixes applied in this task

1. `tarantallegra`: added `{ kind: 'stun', duration: 1 }` alongside a
   stronger slow (spd −30 instead of −20) so the spell has an actual
   control payload instead of being a strictly-worse confundo/langlock.
2. `fianto`: replaced the flat `effects: [{ kind: 'buff', stat: 'def',
   amount: 30, duration: 2 }]` with a `spec` combining a `shield` (absorb)
   and a smaller self def buff, matching `aegis`'s shield schema exactly.
3. Silence: no code fix required (already correct); added
   `tests/combat/silence.test.ts` as a full-battle-level regression test.
4. All other spells reviewed above and left as-is (verdict: ok).
