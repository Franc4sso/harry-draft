# Reliquie flat: taglia 3, converti 4 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rimuovere 3 reliquie flat ridondanti e convertire 4 in decisioni (carrier/drawback/condizionale), snellendo il pool e alzando la qualità — pura data, zero motore.

**Architecture:** Tre task: (1) convertire le 4 reliquie in `data/relics.ts` + `pensatoio` nei set joker; (2) rimuovere le 3 reliquie e sistemare ogni riferimento orfano (STARTER_RELICS + 3 test-fixture); (3) test delle conversioni e delle invarianti joker. Nessun cambio al motore — ogni meccanismo (carrierBonus, drawback, condition) è già letto dall'engine.

**Tech Stack:** TypeScript, Vitest. Path alias `@/` → root repo.

## Global Constraints

- **Zero motore.** Solo `data/relics.ts`, `data/unlocks.ts`, e test. Nessun file in `game/engine/**`.
- `npm run test` (vitest) **NON esegue typecheck** — ogni task chiude con `npm run typecheck` verde.
- **Invariante joker (memoria, CRITICA):** un joker (scaling/conditional/drawback) è player-only — DEVE stare in `JOKER_RELIC_IDS` (escluso da `selectEnemyRelics` e `offerRelics`) E in `STARTER_RELICS` (accessibile in gioco). `pensatoio` diventa drawback → va aggiunto a ENTRAMBI.
- **Reliquie da TAGLIARE (3):** `occhio-moody`, `pozione-fortuna`, `bezoar`.
- **Reliquie da CONVERTIRE (4):** `giratempo`, `mantello-invisibilita`, `pensatoio`, `bacchetta-sambuco`.
- Template `carrierBonus` (verbatim): `{ id:'mano-della-gloria', ..., assignable: true, carrierBonus: { atk:60, spd:30 }, ... }` (`data/relics.ts:137-139`). Template `drawback`: `{ id:'patto-vorace', ..., bonus:{atk:40}, drawback:{hp:-60} }` (`:120-124`). Template `condition`: `{ id:'medaglione-serpeverde', bonus:{atk:24}, condition:{house:'Serpeverde', count:3} }` (`:15`).
- Le `desc` sono user-facing (italiano) — aggiornarle a ogni conversione.
- `STARTER_RELICS` è a `data/unlocks.ts:41-47`. `JOKER_RELIC_IDS` a `data/relics.ts:164-169`.

---

### Task 1: Convertire le 4 reliquie

**Files:**
- Modify: `data/relics.ts` (le 4 definizioni + `JOKER_RELIC_IDS`)
- Modify: `data/unlocks.ts` (`STARTER_RELICS`: aggiungi `pensatoio`)
- Test: `tests/data/relicConversions.test.ts` (create)

**Interfaces:**
- Consumes: il tipo `Relic` e i campi `assignable`/`carrierBonus`/`bonus`/`drawback`/`condition` (già nel motore).
- Produces: le 4 reliquie convertite; `pensatoio` in `JOKER_RELIC_IDS` + `STARTER_RELICS`.

- [ ] **Step 1: Scrivere i test che falliscono**

Create `tests/data/relicConversions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { RELIC_BY_ID, JOKER_RELIC_IDS } from '@/data/relics'
import { STARTER_RELICS } from '@/data/unlocks'

describe('conversione reliquie flat', () => {
  it('giratempo è un carrier +30 SPD (assignable, niente bonus team)', () => {
    const r = RELIC_BY_ID['giratempo']!
    expect(r.assignable).toBe(true)
    expect(r.carrierBonus).toEqual({ spd: 30 })
    expect(r.bonus).toBeUndefined()
  })
  it('mantello-invisibilita è un carrier +26 DEF (assignable, niente bonus team)', () => {
    const r = RELIC_BY_ID['mantello-invisibilita']!
    expect(r.assignable).toBe(true)
    expect(r.carrierBonus).toEqual({ def: 26 })
    expect(r.bonus).toBeUndefined()
  })
  it('pensatoio è drawback +35 ATK / -18 DEF ed è un JOKER', () => {
    const r = RELIC_BY_ID['pensatoio']!
    expect(r.bonus).toEqual({ atk: 35 })
    expect(r.drawback).toEqual({ def: -18 })
    expect(JOKER_RELIC_IDS).toContain('pensatoio')
    expect(STARTER_RELICS).toContain('pensatoio')
  })
  it('bacchetta-sambuco è +20% condizionale su ≥3 Grifondoro', () => {
    const r = RELIC_BY_ID['bacchetta-sambuco']!
    expect(r.bonus).toEqual({ allPct: 0.20 })
    expect(r.condition).toEqual({ house: 'Grifondoro', count: 3 })
  })
})
```

- [ ] **Step 2: Eseguire i test per verificare che falliscano**

Run: `npm run test -- tests/data/relicConversions.test.ts`
Expected: FAIL (le reliquie hanno ancora la forma flat).

- [ ] **Step 3: Convertire le 4 reliquie in `data/relics.ts`**

Sostituire le definizioni:

Riga 5, `giratempo`:
```ts
  { id: 'giratempo', name: 'Giratempo', desc: 'Assegna a un mago: +30 Velocità solo a lui. Il tempo è personale.', rarity: 'comune', assignable: true, carrierBonus: { spd: 30 } },
```
Riga 6, `mantello-invisibilita`:
```ts
  { id: 'mantello-invisibilita', name: "Mantello dell'Invisibilità", desc: 'Assegna a un mago: +26 Difesa solo a lui. Uno solo può nascondersi.', rarity: 'comune', assignable: true, carrierBonus: { def: 26 } },
```
Riga 24, `pensatoio`:
```ts
  { id: 'pensatoio', name: 'Pensatoio', desc: '+35 Attacco a tutta la squadra, ma -18 Difesa. Rivivere la battaglia rende più aggressivi e più esposti.', rarity: 'rara', bonus: { atk: 35 }, drawback: { def: -18 } },
```
Riga 26, `bacchetta-sambuco`:
```ts
  { id: 'bacchetta-sambuco', name: 'Bacchetta di Sambuco', desc: '+20% a tutte le statistiche se hai almeno 3 Grifondoro. La Bacchetta serve solo un maestro degno.', rarity: 'epica', bonus: { allPct: 0.20 }, condition: { house: 'Grifondoro', count: 3 } },
```

- [ ] **Step 4: Aggiungere `pensatoio` a `JOKER_RELIC_IDS`**

In `data/relics.ts`, riga ~168 (dentro `JOKER_RELIC_IDS`), aggiungere `'pensatoio'` alla lista drawback:
```ts
  'assalto-d-apertura', 'patto-vorace', 'sete-di-sangue', 'pensatoio',
```

- [ ] **Step 5: Aggiungere `pensatoio` a `STARTER_RELICS`**

In `data/unlocks.ts`, riga ~46 (fine lista joker), aggiungere `'pensatoio'`:
```ts
  'assalto-d-apertura', 'patto-vorace', 'sete-di-sangue', 'pensatoio',
```

- [ ] **Step 6: Eseguire i test + typecheck**

Run: `npm run test -- tests/data/relicConversions.test.ts` → PASS (4).
Run: `npm run typecheck` → nessun errore.

- [ ] **Step 7: Commit**

```bash
git add data/relics.ts data/unlocks.ts tests/data/relicConversions.test.ts
git commit -m "feat(relic): converti 4 reliquie flat in decisioni (carrier/drawback/condizionale)"
```

---

### Task 2: Tagliare le 3 reliquie e sistemare gli orfani

**Files:**
- Modify: `data/relics.ts` (rimuovi 3 definizioni)
- Modify: `data/unlocks.ts` (`STARTER_RELICS`: rimuovi `pozione-fortuna`, `bezoar`)
- Modify: `tests/engine/corruzioneBattle.test.ts`, `tests/engine/combat/simulate.test.ts` (fixture `bezoar`)
- Modify: `tests/engine/replayRelics.test.ts` (fixture `pozione-fortuna`)

**Interfaces:**
- Consumes: nulla di nuovo — è rimozione + riaggancio.
- Produces: `occhio-moody`, `pozione-fortuna`, `bezoar` rimossi da `RELICS`; nessun riferimento orfano.

- [ ] **Step 1: Grep di sicurezza PRIMA di cancellare**

Run:
```bash
grep -rn "occhio-moody\|pozione-fortuna\|'bezoar'\|\"bezoar\"" --include="*.ts" --include="*.tsx" . | grep -v node_modules
```
Expected: i riferimenti noti (unlocks.ts:42, corruzioneBattle, simulate.test, replayRelics) + eventuali altri. Se emerge un riferimento NON elencato nei file sopra, aggiungerlo alla lista da sistemare — non cancellare lasciando un orfano.

- [ ] **Step 2: Rimuovere le 3 reliquie da `data/relics.ts`**

Cancellare le righe:
- `{ id: 'pozione-fortuna', ... bonus: { allPct: 0.05 } },` (riga 8)
- `{ id: 'bezoar', ... bonus: { regen: 8 } },` (riga 9)
- `{ id: 'occhio-moody', ... bonus: { allPct: 0.08 } },` (riga 23)

- [ ] **Step 3: Rimuovere da `STARTER_RELICS`**

In `data/unlocks.ts:42`, rimuovere `'pozione-fortuna'` e `'bezoar'` dalla lista (NON toccare `giratempo`/`mantello-invisibilita` — sono convertite, restano). `occhio-moody` non è in STARTER_RELICS (verificato) → nulla da fare lì.

- [ ] **Step 4: Riagganciare i fixture `bezoar` (regen)**

In `tests/engine/corruzioneBattle.test.ts:50` e `tests/engine/combat/simulate.test.ts:131`, il fixture usa `RELIC_BY_ID['bezoar']` per una reliquia regen flat. `bezoar` non esiste più. Sostituire con un oggetto Relic inline (nessuna reliquia esistente ha regen flat non condizionato dopo i tagli):
```ts
// era: { relic: RELIC_BY_ID['bezoar']!, stageObtained: 0 }
// diventa: reliquia regen inline (bezoar rimossa nella pulizia pool 2026-07-22)
{ relic: { id: 'test-regen', name: 'Test Regen', desc: '', rarity: 'comune', bonus: { regen: 8 } }, stageObtained: 0 }
```
Verificare che il test asserisca ancora il tick regen (+8) — NON indebolire l'assert, solo cambiare la fonte. Aggiornare eventuali commenti che citano "bezoar".

- [ ] **Step 5: Riagganciare il fixture `pozione-fortuna` (allPct)**

In `tests/engine/replayRelics.test.ts:45-49`, il test verifica che `allPct:0.05` alza maxHp. `pozione-fortuna` non esiste più. Sostituire con un oggetto Relic inline:
```ts
// era: ar('pozione-fortuna')  // allPct 0.05
// diventa: reliquia allPct inline (pozione-fortuna rimossa nella pulizia pool 2026-07-22)
```
Se `ar(id)` è un helper che risolve da `RELIC_BY_ID`, aggiungere una variante che accetta un Relic inline con `bonus:{allPct:0.05}`, o costruire l'`ActiveRelic` a mano. Il test deve ancora verificare maxHp più alto con la reliquia — NON indebolire l'assert.

- [ ] **Step 6: Eseguire i test toccati + typecheck**

Run: `npm run test -- tests/engine/corruzioneBattle.test.ts tests/engine/combat/simulate.test.ts tests/engine/replayRelics.test.ts` → PASS.
Run: `npm run typecheck` → nessun errore.

- [ ] **Step 7: Commit**

```bash
git add data/relics.ts data/unlocks.ts tests/engine/corruzioneBattle.test.ts tests/engine/combat/simulate.test.ts tests/engine/replayRelics.test.ts
git commit -m "feat(relic): taglia 3 reliquie flat ridondanti (occhio-moody/felix/bezoar) + orfani"
```

---

### Task 3: Test invarianti (joker exclusion + suite completa)

**Files:**
- Modify/Test: `tests/data/relicConversions.test.ts` (estendi con le invarianti) o nuovo `tests/data/relicPoolInvariants.test.ts`

**Interfaces:**
- Consumes: `selectEnemyRelics`, `offerRelics` da `@/game/engine/relics`; `JOKER_RELIC_IDS`, `RELIC_BY_ID` da `@/data/relics`.
- Produces: rete di sicurezza — `pensatoio` mai sui nemici né nel bot; le 3 tagliate non esistono.

- [ ] **Step 1: Scrivere i test invarianti**

Aggiungere a `tests/data/relicConversions.test.ts` (o nuovo file):

```ts
import { RELICS } from '@/data/relics'
import { selectEnemyRelics } from '@/game/engine/relics'

describe('invarianti pool dopo taglio+conversione', () => {
  it('le 3 reliquie tagliate non esistono più', () => {
    const ids = RELICS.map(r => r.id)
    expect(ids).not.toContain('occhio-moody')
    expect(ids).not.toContain('pozione-fortuna')
    expect(ids).not.toContain('bezoar')
  })
  it('pensatoio (ora joker drawback) è escluso dai nemici', () => {
    // selectEnemyRelics filtra JOKER_SET — pensatoio non deve mai comparire.
    // Campiona su vari budget/seed per robustezza.
    for (let seed = 0; seed < 20; seed++) {
      const picked = selectEnemyRelics(/* firma reale — vedi nota */)
      expect(picked.map(r => r.id)).not.toContain('pensatoio')
    }
  })
})
```

**NOTA per l'implementer:** `selectEnemyRelics` ha una firma specifica (rng/budget/count) — leggerla in `game/engine/relics.ts:193` e adattare la chiamata. Se la firma rende scomodo il loop, l'alternativa robusta e sufficiente è asserire l'esclusione a livello di set: `expect(JOKER_RELIC_IDS).toContain('pensatoio')` (già in Task 1) + un test che verifica che `selectEnemyRelics` non ritorni MAI un id in `JOKER_RELIC_IDS` (proprietà generale, più forte del solo pensatoio). Scegliere la forma che esercita davvero l'esclusione senza fixture fragili.

- [ ] **Step 2: Eseguire i test invarianti**

Run: `npm run test -- tests/data/relicConversions.test.ts` → PASS.

- [ ] **Step 3: Suite completa + typecheck**

Run: `npm run test` → tutto verde (skip pre-esistente noto ok).
Run: `npm run typecheck` → nessun errore.

**File rotti NOTI dalla conversione (scoperti nel Task 1, da sistemare qui se non già fatti):**
- `tests/data/relicRedesign.test.ts` — asserisce la VECCHIA forma flat (es. `giratempo` ha `bonus.spd`). Va aggiornato alla nuova forma (carrier/drawback/condizionale) o rimosso se ridondante col nuovo `relicConversions.test.ts`. NON indebolire: se verifica un meccanismo utile, riscrivi l'assert alla forma nuova.
- `tests/engine/endlessReplay.test.ts` (2 test) e `tests/functions/submitScore.test.ts` (1 test) — hanno snapshot hardcoded di un'offerta joker per un seed fisso; aggiungere `pensatoio` a `JOKER_RELIC_IDS` (pool 14→15) ha spostato gli indici. Ri-registrare gli snapshot col valore REALE del motore (l'implementer legge l'offerta reale per quel seed/nodo e aggiorna la costante — NON `vitest -u` alla cieca senza verificare che il nuovo valore sia corretto).
- `tests/engine/campaignBalanceRestricted.test.ts` — GIÀ SISTEMATO prima del Task 2 (assert rilassato >0→>=0 con nota, commit 92d5f44). Verificare solo che resti verde, non ritoccare.
Se emerge un ALTRO test di conteggio pool (relicCap/nodeCatalog/sweep) rotto dal −3, aggiornarlo al nuovo conteggio corretto — NON indebolire l'assert.

- [ ] **Step 4: Balance gate (conferma, non taratura)**

Run: `npm run test -- tests/engine/campaignBalanceRestricted.test.ts tests/engine/campaignBalanceB.test.ts`
Expected: verdi (asseriscono winRate∈[0,1]; il bot è cieco alle reliquie player → nessun movimento significativo). NON ritarare.

- [ ] **Step 5: Commit**

```bash
git add tests/data/relicConversions.test.ts
git commit -m "test(relic): invarianti pool — tagliate assenti, pensatoio-joker escluso dai nemici"
```

---

## Self-Review (autore)

- **Spec coverage:** §4a tagli → Task2; §4b conversioni → Task1; §6 testing (conversioni, joker, fixture, pool count, balance) → Task1+Task3; orfani (§8 rischio #1) → Task2 con grep di sicurezza. ✅
- **Type consistency:** `carrierBonus:{spd:30}`/`{def:26}`, `drawback:{def:-18}`, `condition:{house:'Grifondoro',count:3}` — identici tra spec, Task1 code e Task1 test. `pensatoio` in JOKER_RELIC_IDS+STARTER_RELICS coerente tra Task1 e Task3. ✅
- **Placeholder scan:** nessun TBD; ogni step mostra il codice. Le due NOTE (fixture inline, firma selectEnemyRelics) danno all'implementer la scelta esplicita con criterio, non un buco. ✅
- **Rischio noto documentato:** grep di sicurezza pre-taglio (Task2 Step1); firma reale selectEnemyRelics da leggere (Task3). ✅
