# Shop Node ("Negozio") — Design Spec (2026-07-05)

## Goal

A new interactive run node where the player spends **Cioccorane** for run power. It is
given its own identity (approved direction "B") so it does NOT become a paid superset of
the free relic/recruit/spell-forge/infirmary nodes: the shop is the only place to **reroll**
stock and **remove** a wizard, plus a paid **heal on demand** and **relics you choose**.

## Currency

The existing **meta-Cioccorane wallet** (`MetaProfile.cioccorane`), the same one events spend
and collection unlocks use — creating a save-vs-spend tension. It lives on the **profile**,
NOT `RunState`. Spend via `spendCioccorane(p, n)` which returns `null` on insufficient funds.
The purchase is a cross-boundary transaction (item → `RunState`, price → `profileRef` +
`saveProfile`) applied in ONE controller callback, mirroring `useRunB.chooseEventOption`.

## Stock (deterministic per node)

Built once per node from a fresh salt base `4000 + area*100 + floor*10 + idx` (recruit uses
1000+, relic 2000+, event 3000+ — shop claims 4000+), re-forked by a per-node reroll counter.

| Slot | What it does | Price (BALANCE.shop, tunable) | Reuses |
|---|---|---|---|
| **3× Reliquia** | choose from 3 relics; assignable relics prompt a carrier | by rarity: comune 25 / non-comune 45 / rara 75 / epica 120 | `offerRelics` + carrier pick (RelicNodeScreen pattern) |
| **1× Cura completa** | full team heal **+ revive** (infirmary-grade) | `heal` = 35 | full-recovery map over team |
| **1× Rimuovi un mago** | pick a team wizard → remove it (deck-thin / refocus synergies) | `removeWizard` = 20 | `team.filter` + `detectSynergies(livingOf)` |
| **Reroll** | refresh the 3 relic slots with new stock (repeatable) | `reroll` = 15 | new salt fork by reroll count |

Deliberately NOT sold here (kept to their own free nodes so those stay relevant): recruiting,
Aumento Magia. (The user picked "unique identity" over the full supermarket.)

## Flow (multi-purchase, then leave)

Enter → the shop stays in phase `shop-node` while the player buys any affordable slots. Each
purchase: deducts Cioccorane atomically, applies the item to `RunState`, and marks the slot
**sold** (greyed). Buy as many as affordable; **"Esci"** marks the node resolved and returns
to the map. Unaffordable / already-owned slots are disabled with the price shown. Removing a
wizard is guarded so the team can never drop below 1 member.

### Sold / reroll tracking
Two new optional fields on `RunNode` (persisted with the map, like `resolved`):
- `shopBought?: string[]` — slot ids already purchased at this node.
- `shopReroll?: number` — how many times the relic stock has been rerolled (feeds the salt).

The node stays **unresolved** across purchases (unlike one-shot nodes); only "Esci" resolves it.

## Architecture — hook points

Mirrors the spell-forge node's seams plus the shop-specific multi-buy/wallet pieces.

- `types/run.ts`: add `'shop-node'` to `RunPhase`; add `shopBought?: string[]` + `shopReroll?: number`
  to `RunNode`; add `'shop'` to `RunEvent.kind`. (`'shop'` is already in `RunNodeType`.)
- `data/constants.ts`: add `BALANCE.shop` (the price table above) and `shop` to
  `BALANCE.map.categoryWeights` (+ its Record key-union) with a moderate weight (~12).
- `game/engine/resolvers/shop.ts` (new):
  - `shopOffer(state, node, rng): ShopStock` — deterministic stock (3 priced relics via
    `offerRelics`, forked by `node.shopReroll`), plus the fixed service slots + prices.
  - `shopResolver: NodeResolver` — `enter` returns the offer summary; `resolve(state, node, choice)`
    applies ONE `shop-buy` (relic → `state.relics`; heal → full recovery; removeWizard →
    filter + resynergy) and records the slot in `node.shopBought`. Does NOT mark the node resolved.
- `game/engine/resolvers/types.ts`: add `{ kind: 'shop-buy'; slotId: string; carrierId?: string; targetWizardId?: string }`.
- `game/engine/runEngine.ts`: `phaseForNode` → `'shop-node'`; register `shopResolver`; add
  `leaveShop(state)` (mark current node resolved, phase → map) and `rerollShop(state)` (bump
  `node.shopReroll`) helpers.
- `game/engine/nodeGen.ts`: add `'shop'` to the `Filler` union and to `pickFiller`'s entries
  (`['shop', cw.shop]`).
- `hooks/useRunB.ts`: add `'shop'` to `RunBView`; `viewForPhase` `'shop-node' → 'shop'`; add
  `buyShopItem(slotId, opts?)`, `rerollShop()`, `leaveShop()`; expose on `RunBController`.
  `buyShopItem`/`rerollShop` MUST call `shopResolver.resolve` (or the engine helper) directly and
  `commit({...next, phase: 'shop-node'})` — they must NOT go through `resolveCurrent`, which marks
  the node resolved and routes back to map. Only `leaveShop` resolves the node. This mirrors how
  `chooseEventOption` hand-rolls its map/profile writes instead of using `resolveCurrent`. The
  wallet is deducted on `profileRef` + `saveProfile` in the SAME callback (guard the
  `spendCioccorane` null → abort the purchase, no state change).
- `components/screens/ShopScreen.tsx` (new): the storefront — relic stalls (RelicNodeScreen
  `Pedestal` style) + service buttons + a wallet display + reroll + Esci; carrier/target picker
  shown inline when a slot needs one.
- `components/screens/RunBRunner.tsx`: `case 'shop':` → `withTeamSidebar(<ShopScreen .../>)`;
  import it. Map icon/label/accent already exist.

## Data model

```ts
type ShopSlotKind = 'relic' | 'heal' | 'removeWizard'
interface ShopSlot { id: string; kind: ShopSlotKind; price: number; relic?: Relic }
interface ShopStock { slots: ShopSlot[]; rerollPrice: number }
```
Relic slot ids are stable per reroll generation (e.g. `relic-0/1/2`), so `shopBought` greys the
right stall; a reroll bumps `shopReroll` → new relics under the same slot ids, cleared from
`shopBought`.

## Testing

- `shopOffer` determinism per (seed, node, reroll) and that a reroll changes the relic stock.
- Each purchase kind mutates `RunState` correctly and records `shopBought`; relic carrier
  assignment for assignable relics; removeWizard resynergizes and refuses to drop below 1.
- Wallet: `buyShopItem` deducts the price from the profile and is gated when unaffordable
  (spendCioccorane null path never corrupts state).
- `leaveShop` marks the node resolved and returns to the map; `rerollShop` charges the fee.
- `ShopScreen` render test (stalls, prices, sold-out greying, Esci) via jsdom.
- Screenshot-verify the storefront with the harness.

## Balance & caveats

- Prices are tunable constants; the meta-wallet size varies, so treat first prices as a
  starting point — the user's playtest tunes the feel. The AI balance bot doesn't shop, so no
  harness re-anchor is expected; run the suite to confirm nothing else shifts.
- Max-5-enemies, role counters, and all prior invariants are untouched.

## Out of scope (YAGNI)

- No recruiting or Aumento-Magia for sale (left to their own nodes, per the chosen identity).
- No new consumable items or run-local gold currency.
- Shop is a weighted filler; no per-area guarantee yet (tunable later).
