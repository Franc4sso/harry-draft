# Nodo "Patto della Magia" (spell-swap) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un nuovo nodo raro che cambia la magia di un mago (qualsiasi spell, 2 offerte casuali) — GRATIS, nessun costo. Libertà di build totale; il bilanciamento si gestisce sui nemici, non pedaggiando il giocatore.

**Architecture:** Nuovo node-type `spellSwap` con resolver modellato su altare/spellForge, che assegna il nuovo spell preservando spellLevel (NESSUN costo), e casta via il `selectSpell` esistente (zero modifiche combat). Cablatura del node-type in 7 punti. Bot handler + gate di MISURA worst-case obbligatorio (se l'exploit riemerge → ri-alzare i nemici, mai limitare lo swap).

**Tech Stack:** TypeScript, Vitest. Path alias `@/` → root repo.

## Global Constraints

- **Bilanciamento (VINCOLO #1):** lo spell-swap fu RIMOSSO perché exploit misurato (winRate 0.15→0.475). Lo swap è GRATIS (decisione utente 2026-07-23: nessun costo al giocatore) → l'exploit può riemergere. Il worst-case VA MISURATO (Task 5). Se sfonda → si RI-ALZANO I NEMICI (conteggi/potere), NON si limita lo swap né si aggiunge un costo. NON abbassare un assert per far passare.
- **NESSUN COSTO allo swap.** Non toccare `sacrifice.ts` da questo resolver. Lo swap non toglie vita/reliquie/altro.
- **Determinismo:** il resolver `enter` usa rng → deve preservare la parità. Pattern OBBLIGATORIO (da altare.ts): fork deterministico `rng.fork(SALT + area*100 + floor*10 + idx)`, e `enter`+`resolve` chiamano la STESSA offer-function così l'offerta è identica tra le due fasi. `endlessReplayParity` DEVE restare verde.
- `npm run test` NON esegue typecheck — ogni task chiude con `npm run typecheck`.
- **Riuso VERIFICATO:** `SacrificeCost` ha già `{kind:'maxHp'; wizardId:string; amount:number}` (sacrifice.ts:24); `applySacrificeCost(state,cost)` colpisce quel mago con floor maxHp≥1 (sacrifice.ts:53-62); `canPay` verifica `maxHp-amount>=1` (sacrifice.ts:35). NESSUNA estensione di sacrifice.ts.
- **Combat NON si tocca:** `selectSpell` ritorna `unit.spell` verbatim; il nuovo spell è castato senza modifiche.
- **Signature decoupled:** keyed by wizard.id, non tocca `spell` — swap pulito.
- `SWAP_MAXHP_COST` = 20 (STIMA tarabile — vive in data/constants.ts).
- Endless: nodo ESCLUSO (come spellForge/shop).
- Template resolver: `altare.ts` (usa rng in enter+resolve, offer deterministica) e `spellForge.ts` (muta un mago via team.map + RunEvent).

---

### Task 1: Il resolver `spellSwap` + anti-cheat (GRATIS, nessun costo)

**Files:**
- Create: `game/engine/resolvers/spellSwap.ts`
- Modify: `game/engine/resolvers/types.ts` (ResolverChoice kind)
- Test: `tests/engine/spellSwapResolver.test.ts` (create)

**Interfaces:**
- Consumes: `SPELL_BY_ID`/`SPELLS` (data/spells.ts), `NodeResolver` (resolvers/types.ts), `Rng.fork`. (NON sacrifice.ts — nessun costo.)
- Produces: `spellSwapResolver` (id `spellSwap`); `ResolverChoice` kind `{ kind:'spell-swap'; wizardId:string; spellId:string }`; `swapOffer(state,node,rng): Spell[]` (deterministica, 2 spell Attacco).

- [ ] **Step 1: Scrivere i test che falliscono**

Create `tests/engine/spellSwapResolver.test.ts`. Modellare su `tests/engine/altareResolver.test.ts` (leggerlo per il pattern di costruzione state/node). Test:

```ts
import { describe, it, expect } from 'vitest'
import { spellSwapResolver } from '@/game/engine/resolvers/spellSwap'
import { createRng } from '@/game/engine/rng'
import type { RunState, RunNode } from '@/types'

// helper: state minimale con 1 mago (maxHp 100, spell = expelliarmus), + un node spellSwap
const mkState = (): RunState => ({
  team: [{ wizard: { id: 'w', name: 'Mago', role: 'Attaccante', house: 'Grifondoro', tags: [] },
           level: 1, maxHp: 100, stats: { hp: 100, atk: 20, def: 10, spd: 10 },
           spell: { id: 'expelliarmus', name: 'Expelliarmus', type: 'Attacco', power: 1.4, hitChance: 0.95, cooldown: 0 },
           spellLevel: 1 }],
  relics: [], area: 0, /* ...altri campi minimi come in altareResolver.test.ts */
} as unknown as RunState)
const node = { id: 'a0f1n0', type: 'spellSwap' } as unknown as RunNode

describe('spellSwapResolver', () => {
  it('enter offre 2 spell Attacco distinti, deterministici dal seed', () => {
    const offer1 = spellSwapResolver.enter(mkState(), node, createRng('seed-x')).offers
    const offer2 = spellSwapResolver.enter(mkState(), node, createRng('seed-x')).offers
    expect(offer1).toEqual(offer2) // stesso seed → stessa offerta (parità)
  })

  it('resolve assegna il nuovo spell SENZA toccare la vita', () => {
    const state = mkState()
    const offered = (spellSwapResolver.enter(state, node, createRng('seed-x')).offers as any).swapSpells as string[]
    const chosen = offered[0]!
    const out = spellSwapResolver.resolve(state, node, { kind: 'spell-swap', wizardId: 'w', spellId: chosen } as any, createRng('seed-x'))
    expect(out.team[0]!.spell.id).toBe(chosen)     // spell cambiato
    expect(out.team[0]!.maxHp).toBe(100)            // VITA INVARIATA — nessun costo
    expect(out.team[0]!.stats.hp).toBe(100)         // stat hp invariata
    expect(out.team[0]!.spellLevel).toBe(1)         // spellLevel preservato
  })

  it('ANTI-CHEAT: uno spellId NON tra i 2 offerti → no-op (state invariato)', () => {
    const state = mkState()
    const out = spellSwapResolver.resolve(state, node, { kind: 'spell-swap', wizardId: 'w', spellId: 'avada' } as any, createRng('seed-x'))
    // se avada non è tra i 2 offerti per seed-x → no-op. (Se lo fosse, cambiare seed nel test.)
    expect(out).toBe(state) // ref-equal = no-op
  })
})
```

- [ ] **Step 2: Eseguire i test per verificare che falliscano**

Run: `npm run test -- tests/engine/spellSwapResolver.test.ts`
Expected: FAIL (spellSwapResolver non esiste).

- [ ] **Step 3: Aggiungere il ResolverChoice kind**

In `game/engine/resolvers/types.ts`, nel type `ResolverChoice`, aggiungere:
```ts
  | { kind: 'spell-swap'; wizardId: string; spellId: string }
```

- [ ] **Step 4: Implementare il resolver (GRATIS — nessun costo)**

Create `game/engine/resolvers/spellSwap.ts`. Pattern di `altare.ts` (offer deterministica riusata in enter+resolve) e `spellForge.ts` (mutazione team + RunEvent). **NON importare sacrifice.ts — lo swap è gratis.**

```ts
import type { RunState, RunNode, RunEvent, Spell } from '@/types'
import type { Rng } from '../rng'
import type { NodeResolver } from './types'
import { SPELLS, SPELL_BY_ID } from '@/data/spells'

const ATTACK_SPELLS = SPELLS.filter(s => s.type === 'Attacco' && s.id !== 'base_attack')

/** 2 spell d'attacco casuali, deterministici dal nodo (stesso pattern di altareOffer). */
export function swapOffer(state: RunState, node: RunNode, rng: Rng): Spell[] {
  const [area, floor, idx] = parseNodeId(node.id) // riusare l'helper che altare usa, o node fields
  const r = rng.fork(6000 + area * 100 + floor * 10 + idx)
  const pool = [...ATTACK_SPELLS]
  const a = r.int(0, pool.length - 1); const first = pool.splice(a, 1)[0]!
  const b = r.int(0, pool.length - 1); const second = pool[b]!
  return [first, second]
}

export const spellSwapResolver: NodeResolver = {
  id: 'spellSwap',
  enter: (state, node, rng) => ({ offers: { swapSpells: swapOffer(state, node, rng).map(s => s.id) }, isCombat: false }),
  resolve: (state, node, choice, rng) => {
    if (choice.kind !== 'spell-swap') return state
    const target = state.team.find(d => d.wizard.id === choice.wizardId)
    if (!target) return state
    const offered = swapOffer(state, node, rng).map(s => s.id)
    if (!offered.includes(choice.spellId)) return state          // ANTI-CHEAT: solo tra i 2 offerti
    const base = SPELL_BY_ID[choice.spellId]
    if (!base) return state
    const spell = scaledSpell(base, target.spellLevel ?? 1)       // preserva spellLevel (vedi NB). NESSUN COSTO.
    const team = state.team.map(d => (d.wizard.id === choice.wizardId ? { ...d, spell } : d))
    const ev: RunEvent = { area: state.area ?? 0, nodeId: node.id, kind: 'spellSwap',
      summary: `${target.wizard.name}: nuova magia «${spell.name}»` }
    return { ...state, team, log: [...(state.log ?? []), ev] }
  },
}
```

**NB per l'implementer:**
- **NESSUN costo** — non importare/chiamare `sacrifice.ts`. Lo swap non tocca vita, reliquie, altro.
- `parseNodeId`/come altare ricava area/floor/idx: leggere `altare.ts:9-11` e riusare lo stesso meccanismo. Usa BASE 6000 (vs altare 5000) per non collidere.
- `scaledSpell`: cercare se esiste (vecchio primitivo `790478b^` o `upgradeWizardSpell` di spellForge). Con `spellLevel` 1 ≈ base — verificare che non crashi.
- `RunEvent.kind: 'spellSwap'` — verificare che il tipo RunEvent accetti la nuova kind (union da estendere?).

- [ ] **Step 6: Eseguire test + typecheck**

Run: `npm run test -- tests/engine/spellSwapResolver.test.ts` → PASS.
Run: `npm run typecheck` → nessun errore.

- [ ] **Step 7: Commit**

```bash
git add game/engine/resolvers/spellSwap.ts game/engine/resolvers/types.ts tests/engine/spellSwapResolver.test.ts
git commit -m "feat(spell-swap): resolver Cambia Magia — swap gratis + anti-cheat (nessun costo)"
```

---

### Task 2: Cablatura del node-type (i 7 punti)

**Files:**
- Modify: `game/engine/runEngine.ts` (register + phase-string map)
- Modify: `data/constants.ts` (categoryWeights)
- Modify: `game/engine/nodeGen.ts` (Filler type + entries + endless exclusion)
- Modify: `types/run.ts` (phase + RunNodeType)
- Modify: `game/engine/endlessReplay.ts` (esclusione, se serve un case)
- Test: `tests/engine/spellSwapNode.test.ts` (create) — il nodo appare in campagna, NON in endless

**Interfaces:**
- Consumes: `spellSwapResolver` (Task 1).
- Produces: il node-type `spellSwap` registrato e generabile in campagna, escluso da endless.

- [ ] **Step 1: Scrivere il test che fallisce**

Create `tests/engine/spellSwapNode.test.ts`: generare N aree campagna con seed fissi e verificare che il tipo `spellSwap` possa apparire (weight > 0 → su abbastanza seed appare almeno una volta); generare aree endless e verificare che `spellSwap` NON appaia mai (0). Modellare su come `tests/engine/endlessNodeGen.test.ts` verifica l'esclusione di spellForge/shop.

- [ ] **Step 2: Eseguire il test — deve fallire**

Run: `npm run test -- tests/engine/spellSwapNode.test.ts`
Expected: FAIL (spellSwap non è ancora un node-type).

- [ ] **Step 3: I 7 punti di cablatura**

1. `game/engine/runEngine.ts` — dopo `registerResolver(spellForgeResolver)` (~riga 43):
```ts
  registerResolver(spellSwapResolver)              // id 'spellSwap'
```
(+ import `spellSwapResolver` in cima.)
2. `data/constants.ts:611` `categoryWeights` — aggiungere `spellSwap: 12` e aggiornare il Record type inline (aggiungere `'spellSwap'` all'union).
3. `game/engine/nodeGen.ts:10` `Filler` type — aggiungere `| 'spellSwap'`.
4. `game/engine/nodeGen.ts:150` `entries` — aggiungere `['spellSwap', cw.spellSwap]`; riga 154 (endless) — includere `spellSwap` tra i zerati: `(cat === 'shop' || cat === 'spellForge' || cat === 'spellSwap') ? 0 : w`.
5. `types/run.ts:8` phase union — aggiungere `'spellSwap-node'`; riga 12 RunNodeType — aggiungere `'spellSwap'`.
6. `game/engine/runEngine.ts:123` phase-string map — aggiungere `t === 'spellSwap' ? 'spellSwap-node' :`.
7. `game/engine/endlessReplay.ts` — se c'è una validazione che elenca le phase valide in endless, escludere `spellSwap-node` (come `spellForge-node`). Verificare se serve.

- [ ] **Step 4: Test + typecheck**

Run: `npm run test -- tests/engine/spellSwapNode.test.ts` → PASS.
Run: `npm run typecheck` → nessun errore (l'union RunNodeType/phase potrebbe rompere switch esaustivi altrove — sistemare ogni `switch` non esaustivo che il compiler segnala).

- [ ] **Step 5: Commit**

```bash
git add game/engine/runEngine.ts data/constants.ts game/engine/nodeGen.ts types/run.ts game/engine/endlessReplay.ts tests/engine/spellSwapNode.test.ts
git commit -m "feat(spell-swap): cabla il node-type spellSwap (7 punti) — campagna sì, endless no"
```

---

### Task 3: UI screen del nodo

**Files:**
- Create: `components/screens/SpellSwapScreen.tsx` (o nome coerente)
- Modify: il router/dispatcher degli screen (dove SpellForge/Altare screen sono montati per phase)
- Test: `tests/ui/spellSwapScreen.test.tsx` (create)

**Interfaces:**
- Consumes: le offerte del resolver (`swapSpells`), lo state team.
- Produces: uno screen che mostra i maghi, le 2 opzioni spell, e IL COSTO (-N maxHP) chiaro prima della conferma.

- [ ] **Step 1: Trovare il pattern screen**

Leggere `components/screens/` per lo screen di SpellForge o Altare (il più simile: sceglie un mago, mostra un costo, conferma). Identificare come lo screen riceve le offerte e invia il `ResolverChoice`.

- [ ] **Step 2: Scrivere il test del componente**

Create `tests/ui/spellSwapScreen.test.tsx`: render con 2 spell offerti + un team; verificare che mostri le 2 opzioni, il costo `-20` visibile, e che la conferma invii un `{ kind:'spell-swap', wizardId, spellId }`. Modellare sul test screen esistente più vicino.

- [ ] **Step 3: Implementare lo screen**

Modellare su SpellForge/Altare screen. Requisito di design: **il costo -maxHP DEVE essere visibile prima della conferma** (è un patto — il giocatore sa cosa paga). Riusare i pattern premium-ui-system.

- [ ] **Step 4: Montare nello screen router**

Registrare lo screen per la phase `spellSwap-node` dove gli altri screen sono dispatchati.

- [ ] **Step 5: Test + typecheck**

Run: `npm run test -- tests/ui/spellSwapScreen.test.tsx` → PASS.
Run: `npm run typecheck` → nessun errore.

- [ ] **Step 6: Commit**

```bash
git add components/screens/SpellSwapScreen.tsx tests/ui/spellSwapScreen.test.tsx <router>
git commit -m "feat(spell-swap): SpellSwapScreen — 2 opzioni + costo maxHP visibile"
```

---

### Task 4: Bot handler + parità replay

**Files:**
- Modify: `tests/engine/campaignBalanceRestricted.test.ts` + `campaignBalanceB.test.ts` (handler per la phase spellSwap-node)
- Verify: `tests/engine/endlessReplayParity.test.ts` (deve restare verde)

**Interfaces:**
- Consumes: la phase `spellSwap-node`.
- Produces: un bot handler `skip` per il gate (evita l'instant-defeat artefatto).

- [ ] **Step 1: Aggiungere l'handler `skip` al bot delle balance-gate**

In `campaignBalanceRestricted.test.ts` e `campaignBalanceB.test.ts`, dove il bot gestisce le phase (cercare `altare-node`/`event-node` handler), aggiungere il caso `spellSwap-node` → `{ kind: 'skip' }` (il bot declina, come per l'altare). Senza questo, il fall-through causa un instant-defeat artefatto.

- [ ] **Step 2: Verificare che i gate restino verdi (handler skip)**

Run: `npm run test -- tests/engine/campaignBalanceRestricted.test.ts tests/engine/campaignBalanceB.test.ts --disable-console-intercept`
Expected: verdi, winRate ~ invariato (il bot declina lo swap → nessun effetto). Registrare i numeri.

- [ ] **Step 3: Verificare la parità replay**

Run: `npm run test -- tests/engine/endlessReplayParity.test.ts --disable-console-intercept`
Expected: mismatches=0. Il nodo è escluso da endless, ma il resolver usa rng in campagna — se esiste un parity campagna, verificare. Se rosso → STOP, riportare BLOCKED.

- [ ] **Step 4: Suite completa + typecheck**

Run: `npm run test` → tutto verde (skip noto ok).
Run: `npm run typecheck` → nessun errore.

- [ ] **Step 5: Commit**

```bash
git add tests/engine/campaignBalanceRestricted.test.ts tests/engine/campaignBalanceB.test.ts
git commit -m "test(spell-swap): bot handler skip per il gate + parità verificata"
```

---

### Task 5: GATE DI MISURA — worst-case, e (se serve) ri-alzare i nemici

**Files:**
- Create: `tests/engine/spellSwapExploit.test.ts` — la misura del worst-case
- Modify (SE serve): `data/constants.ts` (alzare i conteggi/potere NEMICI se l'exploit sfonda)

**Interfaces:**
- Consumes: tutto lo spell-swap (Task 1-4).
- Produces: il winRate worst-case misurato, e (se sfonda) la taratura NEMICI che lo riporta in banda.

**Questo è IL gate che decide se serve ri-bilanciare i nemici. Lo swap è gratis → l'exploit può riemergere pieno.**

- [ ] **Step 1: Scrivere una misura worst-case**

Create `tests/engine/spellSwapExploit.test.ts`. Modellare sul pattern di `campaignBalanceRestricted.test.ts` MA con un bot handler che ABUSA lo swap: incontrando un `spellSwap-node`, sceglie il migliore-di-2 (per `power`) e lo assegna al mago che massimizza il danno — il worst-case. Misurare il winRate su ~120 seed. Confrontare col baseline (senza swap-abuse).

Riferimento storico (dal removal): il vecchio swap portò il winRate a 0.475 (57/120), sfondando il tetto 0.45. Lo swap è GRATIS ora → può risfondarlo. **La taratura è sui NEMICI, non sullo swap (decisione utente).**

- [ ] **Step 2: Eseguire la misura**

Run: `npm run test -- tests/engine/spellSwapExploit.test.ts --disable-console-intercept`
Leggere il winRate worst-case. Registrare il numero (è il dato che l'utente vuole vedere).

- [ ] **Step 3: Decidere (il giudizio di bilanciamento)**

- **Se il winRate worst-case resta in banda** (dentro il tetto/floor documentato) → sicuro anche gratis, i nemici NON si toccano. Documentare il numero con commento datato.
- **Se SFONDA il tetto** → **ri-alzare i NEMICI**: i conteggi `enemyCountByArea` (memoria: erano `[3,5,8]` tarati per un bot-swap, poi abbassati) e/o il potere nemico, in `data/constants.ts`. Ri-misurare finché il worst-case rientra. **NON aggiungere un costo allo swap, NON abbassare l'assert.** Documentare la taratura con commento datato che spiega: swap gratis → nemici alzati per assorbire (trade-off accettato: gioco più duro per tutti).
- **NB:** alzare i nemici muove ANCHE gli altri gate (campaignBalanceRestricted/B senza swap) → ri-misurarli e assicurarsi che restino in banda (non troppo duri per chi non swappa). Questo è il rischio del trade-off — misurarlo.

- [ ] **Step 4: Suite completa finale + typecheck**

Run: `npm run test` poi `npm run typecheck` → entrambi verdi. Se aver alzato i nemici ha rotto altri test di conteggio/bilanciamento, aggiornarli al nuovo valore (NON indebolire gli assert).

- [ ] **Step 5: Commit**

```bash
git add tests/engine/spellSwapExploit.test.ts data/constants.ts
git commit -m "test(spell-swap): gate worst-case — winRate <X>; nemici <alzati/invariati> per assorbire"
```

---

## Self-Review (autore)

- **Spec coverage:** §4a resolver→Task1; §4b ResolverChoice→Task1; §4c swapOffer→Task1; §4d 7 punti→Task2; §4e UI→Task3; §4f bot handler→Task4; §6 gate worst-case→Task5. Determinismo→Task1(fork)+Task4(parità). ✅
- **Type consistency:** `{kind:'spell-swap';wizardId;spellId}`, `swapOffer(state,node,rng):Spell[]` — coerenti tra task. NESSUN costo → nessun uso di sacrifice.ts/SWAP_MAXHP_COST (rimossi per decisione utente). ✅
- **Placeholder scan:** nessun TBD; ogni step mostra codice. Le NB (parseNodeId/scaledSpell/RunEvent kind) danno criterio all'implementer con riferimenti reali, non buchi. ✅
- **Rischio noto documentato:** bilanciamento worst-case + ri-alzare nemici (Task5, il gate), determinismo fork (Task1/4), cablatura 7 punti (Task2), scaledSpell recupero (Task1 NB), switch esaustivi da sistemare (Task2 Step4). ✅
- **Numeri verificati:** altare rng fork pattern altare.ts:9-11; ResolverChoice union types.ts; categoryWeights constants.ts:611; nodeGen Filler:10/entries:150; RunNodeType run.ts:8,12; phase-map runEngine.ts:123. Swap GRATIS: nessun sacrifice.ts. ✅
