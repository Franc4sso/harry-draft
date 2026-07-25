# Onda 1.e — Togliere i tre nodi-menù (spellForge / spellSwap / shop)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rimuovere dal gioco i tre nodi-menù `spellForge`, `spellSwap` e `shop` — il 27% del peso filler della mappa — e con essi tutto il codice che esiste solo per servirli.

**Architecture:** Sottrazione in due movimenti. Primo, la mappa smette di generarli (`nodeGen` + `categoryWeights`): da qui il gioco è già cambiato ed è misurabile. Poi si eliminano i tre sottosistemi (resolver, schermata, test) e infine si ripuliscono i tipi condivisi, il router di fase e la `MapScreen`. Il sistema dei livelli-magia (`game/engine/spellForge.ts`, `spellLevel`) esce insieme a loro: **`spellForgeResolver` è l'unico scrittore di `spellLevel` in tutto il codice** (verificato: nessun evento, nessuna reliquia, nessun altare lo alza), quindi senza il nodo resta un moltiplicatore bloccato a ×1 — codice morto, non potenza tolta.

**Tech Stack:** Next.js (vedi `AGENTS.md`: **è una versione con breaking change, leggi `node_modules/next/dist/docs/` prima di scrivere codice**), TypeScript, Vitest, React Testing Library.

## Global Constraints

- **Non toccare nessuna costante di bilanciamento** oltre a `BALANCE.map.categoryWeights` (che è l'oggetto della task). Vale la memoria `difficulty-validated-harder-is-good`: **il gioco non va ammorbidito**, e nessuna ritaratura compensativa va fatta senza decisione dell'utente.
- **I Trii di Casata non si toccano** (Onda 1.c annullata dall'utente).
- Le harness di bilanciamento (`campaignBalanceRestricted`, `campaignBalanceB`) **non sono gate**: asseriscono solo `0 <= winRate <= 1`. Sono **strumenti di misura**. Baseline attuale: restricted `0.0167` (2/120), B `0.0000`. Il winRate è saturo e non discrimina: **la metrica che conta qui è la profondità raggiunta** e il numero di combattimenti vinti / nodi risolti, che l'harness stampa già in console.
- **Non allentare mai un'asserzione per far passare un test.** Se un test fallisce, o il codice è sbagliato o il test misurava il vecchio comportamento e va cancellato insieme alla feature.
- Ogni task finisce con `npx tsc --noEmit` pulito e la suite verde prima del commit.
- Messaggi di commit in italiano, coerenti con lo stile del repo (`refactor(nodi): …`).

---

## Struttura dei file

**File eliminati interamente (22):**

| Area | File |
|---|---|
| shop | `game/engine/resolvers/shop.ts`, `components/screens/ShopScreen.tsx` |
| shop (test) | `tests/engine/shopEngine.test.ts`, `tests/engine/shopGeneration.test.ts`, `tests/engine/shopOffer.test.ts`, `tests/engine/shopResolver.test.ts`, `tests/screens/shopScreen.test.tsx`, `tests/data/shopConstants.test.ts`, `tests/ui/shopCorruptionWarning.test.tsx` |
| spellSwap | `game/engine/resolvers/spellSwap.ts`, `components/screens/SpellSwapScreen.tsx` |
| spellSwap (test) | `tests/engine/spellSwapExploit.test.ts`, `tests/engine/spellSwapNode.test.ts`, `tests/engine/spellSwapResolver.test.ts`, `tests/ui/spellSwapScreen.test.tsx` |
| spellForge | `game/engine/resolvers/spellForge.ts`, `game/engine/spellForge.ts`, `components/screens/SpellForgeScreen.tsx` |
| spellForge (test) | `tests/engine/spellForge.test.ts`, `tests/engine/spellForgeCoverage.test.ts`, `tests/screens/spellForgeAndHp.test.tsx` |

**File modificati (ripulitura):** `game/engine/nodeGen.ts`, `game/engine/nodeCatalog.ts`, `game/engine/runEngine.ts`, `game/engine/endlessReplay.ts`, `data/constants.ts`, `types/run.ts`, `types/combat.ts`, `hooks/useRunShared.ts`, `hooks/useRunB.ts`, `components/screens/RunBRunner.tsx`, `components/screens/MapScreen.tsx`, `components/screens/EndlessRunner.tsx`, più i test che li nominano di sfuggita (`tests/engine/nodeGen.test.ts`, `tests/engine/nodeCatalog.test.ts`, `tests/engine/endlessNodeGen.test.ts`, `tests/engine/endlessScaling.test.ts`, `tests/engine/endlessReplayParity.test.ts`, `tests/engine/magieOscureSweep.test.ts`, `tests/engine/corruzioneRun.test.ts`, `tests/hooks/useEndless.test.tsx`, `tests/engine/confirmDraftPicksEndless.test.ts`, `tests/engine/campaignBalance*.test.ts`).

---

### Task 1: La mappa smette di generarli

Questo è l'unico task che cambia il gioco. Tutti gli altri tolgono codice diventato irraggiungibile.

**Files:**
- Modify: `game/engine/nodeGen.ts:10` (union `Filler`), `:147-164` (`pickFiller`), `:31` e `:87` (commenti)
- Modify: `data/constants.ts:611` (`categoryWeights`)
- Test: `tests/engine/nodeGen.test.ts`, `tests/engine/endlessNodeGen.test.ts`

**Interfaces:**
- Consumes: `BALANCE.map.categoryWeights` — oggi `{ battle: 25, recruit: 10, relic: 45, event: 15, spellForge: 12, spellSwap: 12, shop: 12 }`
- Produces: `categoryWeights` ridotto a `{ battle: 25, recruit: 10, relic: 45, event: 15 }` e `type Filler = 'battle' | 'recruit' | 'relic' | 'event'`. Nessuna altra firma cambia: `assignAreaCategories(rng, widths, bias, endless)` mantiene la stessa segnatura, **incluso il parametro `endless`** (serve ancora a escludere l'`altare`).

**Decisione di peso (deliberata, da non “migliorare” in corso d'opera):** i 36 punti liberati **non vengono redistribuiti**. Si cancellano e basta. Le proporzioni fra i quattro filler superstiti restano esattamente quelle di oggi; cambia solo che i tre menù non escono più. Questa è la lettura onesta della sottrazione: nessuna compensazione nascosta, così la misura del Task 6 dice davvero cosa costa toglierli. Se la profondità crolla, la redistribuzione è una decisione dell'utente, non di chi esegue.

**Nota sull'endless:** oggi `pickFiller` azzera i pesi dei tre in endless. Dopo la rimozione quel ramo non serve più, e il totale dei pesi in endless è **identico** a prima (25 + recruitW + 45 + 15): gli stream rng dell'endless non si spostano di un bit. È per questo che `endlessReplayParity` deve restare verde senza ri-baseline.

- [ ] **Step 1: Scrivere il test che fallisce**

In `tests/engine/nodeGen.test.ts`, aggiungere:

```ts
it('non genera mai nodi-menù (spellForge/spellSwap/shop) — Onda 1.e', () => {
  const banned = new Set(['spellForge', 'spellSwap', 'shop'])
  for (let seed = 0; seed < 200; seed++) {
    const rng = createRng(`nodegen-menu-${seed}`)
    const cats = assignAreaCategories(rng, [1, 3, 3, 3, 1], { teamSize: 3, teamMax: 5 })
    for (const floor of cats) {
      for (const c of floor) {
        expect(banned.has(c)).toBe(false)
      }
    }
  }
})
```

Se `createRng` / `assignAreaCategories` non sono già importati in quel file, aggiungere gli import: `import { createRng } from '@/game/engine/rng'` e `import { assignAreaCategories } from '@/game/engine/nodeGen'`.

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run tests/engine/nodeGen.test.ts -t "nodi-menù"`
Expected: FAIL — su 200 seed × 9 slot i tre tipi escono di sicuro (36/131 di probabilità per slot).

- [ ] **Step 3: Togliere i tre filler dalla generazione**

In `game/engine/nodeGen.ts`, riga 10:

```ts
type Filler = 'battle' | 'recruit' | 'relic' | 'event'
```

Sostituire `pickFiller` (righe 147-164) con:

```ts
function pickFiller(rng: Rng, bias: AreaBias): Filler {
  const cw = BALANCE.map.categoryWeights
  const recruitW = cw.recruit + (bias.teamSize < bias.teamMax ? BALANCE.map.recruitBiasBoost : 0)
  const entries: [Filler, number][] = [['battle', cw.battle], ['recruit', recruitW], ['relic', cw.relic], ['event', cw.event]]

  const total = entries.reduce((a, [, v]) => a + v, 0)
  let roll = rng.next() * total
  for (const [cat, v] of entries) {
    roll -= v
    if (roll <= 0) return cat
  }
  return 'battle'
}
```

Al chiamante (riga 107) togliere l'argomento ormai inesistente: `const cat = pickFiller(rng, bias)`.

Aggiornare i due commenti: alla riga 31 sostituire *"In endless mode, shop, spellForge, and altare nodes are excluded entirely."* con **"In endless mode, l'altare è escluso (unico tipo ancora escluso: i tre nodi-menù sono stati rimossi dal gioco — Onda 1.e, 2026-07-25)."**; alla riga 87 sostituire il riferimento *"stesso motivo dell'esclusione shop/spellForge"* con **"come già per i nodi-menù, ora rimossi"**, lasciando intatta la nota sul corto-circuito `!endless` che non consuma roll rng.

In `data/constants.ts` riga 611:

```ts
    // Onda 1.e (2026-07-25): spellForge/spellSwap/shop rimossi dal gioco — erano il 27% del
    // peso filler (36 su 131) e tre menù nati per rimpiazzare il loadout tolto. I punti NON
    // sono stati redistribuiti: le proporzioni fra i quattro filler superstiti sono identiche
    // a prima, così la misura dice davvero quanto costa toglierli.
    categoryWeights: { battle: 25, recruit: 10, relic: 45, event: 15 } as Record<'battle' | 'recruit' | 'relic' | 'event', number>,
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npx vitest run tests/engine/nodeGen.test.ts tests/engine/endlessNodeGen.test.ts`
Expected: PASS. `endlessNodeGen` ha 13 riferimenti ai tre tipi: sono asserzioni del tipo *"l'endless non genera shop/spellForge"*. Ora sono vere per costruzione e vanno **cancellate** (non riscritte): il caso è coperto dal nuovo test in `nodeGen.test.ts`, che vale per ogni modalità. Lasciare intatte tutte le asserzioni su altare/infermeria/elite.

- [ ] **Step 5: Verificare che la parità dell'endless non si sia mossa**

Run: `npx vitest run tests/engine/endlessReplayParity.test.ts tests/engine/endlessScaling.test.ts`
Expected: PASS senza ri-baseline. Se falliscono, **fermarsi e riportare**: significherebbe che il totale dei pesi in endless è cambiato, cioè che l'assunto qui sopra è sbagliato — non aggiustare i numeri attesi per far tornare i conti.

- [ ] **Step 6: Commit**

```bash
git add game/engine/nodeGen.ts data/constants.ts tests/engine/nodeGen.test.ts tests/engine/endlessNodeGen.test.ts
git commit -m "refactor(nodi): la mappa non genera piu' i tre nodi-menu (Onda 1.e)"
```

---

### Task 2: Eliminare il sottosistema shop

**Files:**
- Delete: `game/engine/resolvers/shop.ts`, `components/screens/ShopScreen.tsx`, `tests/engine/shopEngine.test.ts`, `tests/engine/shopGeneration.test.ts`, `tests/engine/shopOffer.test.ts`, `tests/engine/shopResolver.test.ts`, `tests/screens/shopScreen.test.tsx`, `tests/data/shopConstants.test.ts`, `tests/ui/shopCorruptionWarning.test.tsx`
- Modify: `game/engine/runEngine.ts` (registrazione del resolver + mappa fase), `hooks/useRunShared.ts`, `hooks/useRunB.ts`, `components/screens/RunBRunner.tsx`, `types/run.ts:56-59`, `data/constants.ts` (blocco costanti negozio)

**Interfaces:**
- Consumes: niente dal Task 1.
- Produces: `RunNode` senza i campi `shopBought?: string[]` e `shopReroll?: number`; nessun `shopResolver` registrato; `RunPhase` senza `'shop-node'`.

**Attenzione — le Cioccorane restano.** Il negozio era un *pozzo in-run* per la valuta, ma non l'unico né il principale: le Cioccorane vivono sul profilo (`lib/metaStore.ts`, `lib/metaProgress.ts`) e si spendono negli sblocchi della `CollectionScreen`. Togliendo il negozio, le Cioccorane guadagnate in run confluiscono tutte lì. **Non toccare `metaStore`, `metaProgress`, `CollectionScreen`, `ResultScreen`, né gli eventi di `data/events.ts` che assegnano Cioccorane.**

- [ ] **Step 1: Cancellare i file del sottosistema**

```bash
git rm game/engine/resolvers/shop.ts components/screens/ShopScreen.tsx \
  tests/engine/shopEngine.test.ts tests/engine/shopGeneration.test.ts \
  tests/engine/shopOffer.test.ts tests/engine/shopResolver.test.ts \
  tests/screens/shopScreen.test.tsx tests/data/shopConstants.test.ts \
  tests/ui/shopCorruptionWarning.test.tsx
```

- [ ] **Step 2: Eseguire il typecheck per farsi elencare i punti di aggancio**

Run: `npx tsc --noEmit`
Expected: FAIL, con un errore per ogni riferimento residuo. **Questa lista è la to-do del passo successivo** — non indovinare i punti, leggerli dall'output.

- [ ] **Step 3: Staccare gli agganci**

Seguendo la lista del passo 2:
- `game/engine/runEngine.ts`: togliere `import { shopResolver }`, la riga `registerResolver(shopResolver)` e il ramo `t === 'shop' ? 'shop-node'` dalla mappa tipo→fase (riga ~125).
- `hooks/useRunShared.ts`: togliere `'shop'` dalla union di fase (riga 22) e il `case 'shop-node': return 'shop'` (riga 39). Rimuovere le callback esposte solo per il negozio e la voce corrispondente nell'oggetto restituito (riga ~279); conservare il commento sul costo alla riga ~210 solo se parla anche di altri nodi, altrimenti toglierlo.
- `hooks/useRunB.ts`: stessi tagli lato Run B.
- `components/screens/RunBRunner.tsx`: togliere l'import di `ShopScreen` e il suo `case` nello switch di rendering.
- `types/run.ts`: togliere `'shop-node'` da `RunPhase` (riga 8), `'shop'` da `RunNodeType` (riga 14), `'shop'` da `RunLogEntry['kind']` (riga 66), e i campi `shopBought` / `shopReroll` (righe 56-59).
- `data/constants.ts`: togliere il blocco di costanti del negozio (quello che copriva `tests/data/shopConstants.test.ts`). **Non toccare `BALANCE.relics`** né altri blocchi.

- [ ] **Step 4: Typecheck e suite verdi**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS. Alcuni test superstiti (`corruzioneRun`, `magieOscureSweep`, `useEndless`) nominano il negozio di sfuggita: se falliscono, togliere il riferimento al negozio **preservando ciò che quel test misura davvero** (corruzione, magie oscure, scaling endless).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(nodi): via il Negozio — resolver, schermata, costanti e test (Onda 1.e)"
```

---

### Task 3: Eliminare il sottosistema spellSwap

**Files:**
- Delete: `game/engine/resolvers/spellSwap.ts`, `components/screens/SpellSwapScreen.tsx`, `tests/engine/spellSwapExploit.test.ts`, `tests/engine/spellSwapNode.test.ts`, `tests/engine/spellSwapResolver.test.ts`, `tests/ui/spellSwapScreen.test.tsx`
- Modify: `game/engine/runEngine.ts`, `hooks/useRunShared.ts:114,267,279`, `hooks/useRunB.ts`, `components/screens/RunBRunner.tsx`, `types/run.ts`

**Interfaces:**
- Consumes: `types/run.ts` già ripulito dal negozio (Task 2).
- Produces: `RunPhase` senza `'spellSwap-node'`, `RunNodeType` senza `'spellSwap'`, e la callback `chooseSpellSwap: (wizardId: string, spellId: string) => void` **eliminata** dall'interfaccia di `useRunShared` (riga 114) e dal suo valore di ritorno.

**Nota:** `spellSwap.ts` importa `scaledSpell` da `../spellForge`. Quell'import sparisce qui; il modulo `spellForge.ts` viene eliminato nel Task 4.

- [ ] **Step 1: Cancellare i file del sottosistema**

```bash
git rm game/engine/resolvers/spellSwap.ts components/screens/SpellSwapScreen.tsx \
  tests/engine/spellSwapExploit.test.ts tests/engine/spellSwapNode.test.ts \
  tests/engine/spellSwapResolver.test.ts tests/ui/spellSwapScreen.test.tsx
```

- [ ] **Step 2: Typecheck per elencare gli agganci**

Run: `npx tsc --noEmit`
Expected: FAIL con la lista dei riferimenti residui.

- [ ] **Step 3: Staccare gli agganci**

Come nel Task 2: registrazione del resolver e mappa tipo→fase in `runEngine.ts`; union di fase e `case 'spellSwap-node'` in `useRunShared.ts`; `chooseSpellSwap` (dichiarazione riga 114, definizione riga ~267, export riga ~279) e la gemella in `useRunB.ts`; import e `case` in `RunBRunner.tsx`; le tre voci in `types/run.ts` (righe 8, 12, 66).

- [ ] **Step 4: Typecheck e suite verdi**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(nodi): via Cambia Magia — resolver, schermata e test (Onda 1.e)"
```

---

### Task 4: Eliminare spellForge e con esso i livelli-magia

**Files:**
- Delete: `game/engine/resolvers/spellForge.ts`, `game/engine/spellForge.ts`, `components/screens/SpellForgeScreen.tsx`, `tests/engine/spellForge.test.ts`, `tests/engine/spellForgeCoverage.test.ts`, `tests/screens/spellForgeAndHp.test.tsx`
- Modify: `types/combat.ts:24` (campo `spellLevel`), `game/engine/runEngine.ts:15,44`, `hooks/useRunShared.ts`, `hooks/useRunB.ts`, `components/screens/RunBRunner.tsx:300`, `types/run.ts`

**Interfaces:**
- Consumes: `types/run.ts` già ripulito da negozio e spellSwap.
- Produces: `DraftedWizard` (in `types/combat.ts`) senza `spellLevel?: number`; nessun export superstite da `game/engine/spellForge.ts` (`spellMultiplier`, `levelStep`, `scaledSpell`, `baseSpellOf`, `upgradeWizardSpell`, `SPELL_LEVEL_MAX` spariscono tutti); callback `chooseSpellUpgrade` eliminata.

**Perché il modulo intero e non solo il nodo:** `spellForgeResolver` è **l'unico scrittore di `spellLevel`** (verificato con grep su tutto il sorgente: nessun evento, reliquia, altare o spoglia lo alza; `spellSwapResolver` lo leggeva soltanto per preservarlo, ed è già sparito nel Task 3). Senza il nodo, `spellMultiplier` restituirebbe per sempre ×1 e `scaledSpell` sarebbe la funzione identità. **Non è potenza tolta al giocatore: è impalcatura che non regge più niente.**

- [ ] **Step 1: Confermare che nessun altro alzi `spellLevel`**

Run: `git grep -n "spellLevel\|upgradeWizardSpell\|scaledSpell" -- ':!tests' ':!docs'`
Expected: solo occorrenze dentro i file elencati qui sopra più la dichiarazione in `types/combat.ts:24`. **Se compare un altro scrittore, fermarsi e riportare** — l'assunto di questo task sarebbe falso e il modulo andrebbe conservato.

- [ ] **Step 2: Cancellare i file del sottosistema**

```bash
git rm game/engine/resolvers/spellForge.ts game/engine/spellForge.ts \
  components/screens/SpellForgeScreen.tsx tests/engine/spellForge.test.ts \
  tests/engine/spellForgeCoverage.test.ts tests/screens/spellForgeAndHp.test.tsx
```

- [ ] **Step 3: Typecheck per elencare gli agganci**

Run: `npx tsc --noEmit`
Expected: FAIL con la lista dei riferimenti residui.

- [ ] **Step 4: Staccare gli agganci e togliere il campo**

Come nei task precedenti per resolver/fase/schermata, più: in `types/combat.ts` eliminare `spellLevel?: number` (riga 24); in `RunBRunner.tsx` il `case 'spellForge'` (riga ~300); in `types/run.ts` le voci alle righe 8, 12, 66.

- [ ] **Step 5: Typecheck e suite verdi**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(nodi): via Aumento Magia e i livelli-magia che nessuno alzava piu' (Onda 1.e)"
```

---

### Task 5: Ripulire catalogo, mappa e commenti superstiti

**Files:**
- Modify: `game/engine/nodeCatalog.ts:20-22`, `components/screens/MapScreen.tsx:19,24,32`, `game/engine/endlessReplay.ts:63,109`, `components/screens/EndlessRunner.tsx:10`, `tests/engine/nodeCatalog.test.ts`

**Interfaces:**
- Consumes: `RunNodeType` già ripulito dai Task 2-4.
- Produces: `NODE_CATALOG` con 12 voci invece di 15; `phase1Types()` restituisce 6 tipi invece di 8 (`battle`, `elite`, `boss`, `recruit`, `relic`, `infirmary`).

- [ ] **Step 1: Aggiornare il test del catalogo**

In `tests/engine/nodeCatalog.test.ts`, se esiste un'asserzione sul numero di voci o sull'elenco di `phase1Types()`, aggiornarla ai valori qui sopra. Se il test si limitava a verificare che ogni `RunNodeType` avesse una voce nel catalogo, **non toccarlo**: continua a valere ed è più forte di un conteggio.

- [ ] **Step 2: Eseguirlo e verificare che fallisca**

Run: `npx vitest run tests/engine/nodeCatalog.test.ts`
Expected: FAIL se al passo 1 c'era un conteggio da aggiornare; PASS (già verde) se il test è quello generico — in quel caso passare oltre.

- [ ] **Step 3: Togliere le tre voci dal catalogo e dalla mappa**

In `game/engine/nodeCatalog.ts` eliminare le righe 20, 21 e 22 (`spellForge`, `spellSwap`, `shop`).

In `components/screens/MapScreen.tsx` togliere le chiavi dei tre tipi dalle tre mappe: emoji (riga 19), etichette (riga 24) e colori (riga 32). Verificare che quelle mappe siano tipizzate `Record<RunNodeType, …>`: se lo sono, il typecheck conferma da solo che non ne restano fuori.

In `game/engine/endlessReplay.ts` (righe 63 e 109) e `components/screens/EndlessRunner.tsx` (riga 10) aggiornare i commenti che spiegavano l'esclusione dei tre nodi in endless: ora non esistono più in nessuna modalità. Non cambiare il codice, solo i commenti.

- [ ] **Step 4: Typecheck e suite completa**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS, suite intera.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(nodi): catalogo, mappa e commenti ripuliti dai nodi-menu (Onda 1.e)"
```

---

### Task 6: Misurare il costo della sottrazione e aggiornare i documenti

Nessun codice di gioco cambia qui. Si misura e si scrive cosa è successo.

**Files:**
- Modify: `tests/engine/campaignBalanceRestricted.test.ts` (commento di intestazione), `tests/engine/campaignBalanceB.test.ts` (idem), `docs/superpowers/HANDOFF.md:267,285`, `docs/superpowers/specs/2026-07-25-core-fun-direction.md` (voce 1.e della roadmap)

**Interfaces:**
- Consumes: il gioco completo dei Task 1-5.
- Produces: nessuna API. Un referto scritto.

- [ ] **Step 1: Misurare**

Run: `npx vitest run tests/engine/campaignBalanceRestricted.test.ts tests/engine/campaignBalanceB.test.ts`

Annotare dall'output di console, per entrambe le harness: `winRate`, combattimenti vinti, nodi risolti e **la profondità massima raggiunta per area** (area0/area1/area2). Baseline da confrontare, dal commento in testa a `campaignBalanceRestricted`: winRate `0.0167` (2/120, seed run-68 e run-101), 143 combattimenti vinti, 354 nodi risolti, profondità 94/12/14.

- [ ] **Step 2: Scrivere il referto nel commento dell'harness**

In testa a `tests/engine/campaignBalanceRestricted.test.ts`, sotto il blocco delle Spoglie, aggiungere un blocco `*** ONDA 1.e — MISURA ***` con i numeri prima/dopo del passo 1 e una lettura onesta in due righe. Attenzione al numero di nodi risolti: **è atteso in calo**, perché tre tipi di nodo sono spariti dalla mappa e i loro slot ora ospitano combattimenti, reclute, reliquie ed eventi. Un calo dei nodi risolti **non è** di per sé un peggioramento; la profondità sì.

**Non modificare le asserzioni** (`winRate >= 0`, `<= 1`, determinismo). **Non ritarare nessuna costante** anche se la profondità cala: la memoria `difficulty-validated-harder-is-good` dice che la decisione è dell'utente. Se il calo è marcato, scriverlo a chiare lettere nel referto e segnalarlo nel report finale.

- [ ] **Step 3: Aggiornare la documentazione**

- `docs/superpowers/HANDOFF.md`: eliminare la voce del nodo "Aumento Magia" (riga 267) e le voci gemelle di Negozio e Cambia Magia se presenti. Alla riga 285 c'è una checklist *"come aggiungere un nuovo nodo run"* che cita i commit shop/spellForge come esempio collaudato: la checklist resta utile, va solo cambiato l'esempio citato (usare `altare` o `event`, che esistono ancora).
- `docs/superpowers/specs/2026-07-25-core-fun-direction.md`: marcare la voce **1.e** della roadmap come `(FATTA, 2026-07-25)` con il numero di commit, come già fatto per 1.a e 1.b.

- [ ] **Step 4: Verifica finale completa**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS. Riportare il conteggio di file/test (la baseline pre-Onda-1.e era 378 file / 1786 test; è atteso in calo di ~14 file).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs(nodi): referto della sottrazione dei nodi-menu (Onda 1.e)"
```

---

## Cosa NON fa questo piano

- **Non tocca i Trii di Casata** (1.c, annullata dall'utente).
- **Non pota le firme** (1.d) né **le reliquie piatte** (1.f): sono sottrazioni che *tolgono potenza al giocatore* su un gioco già durissimo, e vanno misurate e sottoposte all'utente separatamente.
- **Non restituisce agency pre-battaglia** (D6, `spellPool: ['expelliarmus']`). Togliere i tre menù non ripara il loadout: lo rende soltanto visibile come buco, che è il punto — l'Onda 2 (da 6 a ~22 Duo) è la risposta prevista, non un loadout riesumato.
- **Non ridistribuisce i pesi liberati.** È una decisione dell'utente, informata dalla misura del Task 6.
