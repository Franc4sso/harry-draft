# Run Progression Redesign — Fase 1: il nuovo cuore del loop

**Data:** 2026-06-26
**Stato:** design approvato, pronto per il piano d'implementazione
**Autore:** brainstorming Francesco + Claude

---

## 0. Principio guida

> **Il combattimento non è il gioco. Il combattimento è una conseguenza delle decisioni del giocatore.**

Ogni run deve essere una successione continua di scelte interessanti: dove andare, chi reclutare, quale reliquia prendere, se rischiare un Elite. Il combattimento è *uno degli strumenti* per far evolvere la squadra — in Fase 1, lo strumento che dà esperienza.

L'obiettivo finale è un roguelite moderno, estremamente rigiocabile, in cui la **progressione della run** e le **decisioni del giocatore** sono il cuore dell'esperienza, ambientato a Hogwarts ma con identità originale.

---

## 1. Scopo dichiarato di questa Fase (e cosa NON è)

Questo documento copre **solo la Fase 1**: le fondamenta del nuovo loop.

**La Fase 1 È:** la trasformazione strutturale da "draft di 5 → campagna lineare" a "Casa + 2 maghi → atlante a nodi a 3 aree con progressione per livelli e reclutamento in run", con un'architettura estensibile che regge le fasi successive senza riscritture.

**La Fase 1 NON È il gioco finito.** Con i soli nodi Combattimento / Elite / Reliquia / Reclutamento (+ Boss), il loop è *solido ma scheletrico*. La magia vera — Eventi, Negozio, Sala Comune, Biblioteca, Aula di Pozioni, Foresta Proibita — arriva nelle Fasi 2-3. **Questo è dichiarato di proposito:** la Fase 1 giocata sembrerà "promettente", non "completa". Va giudicata per quello che è — le fondamenta — non per quello che non vuole ancora essere.

Questo paragrafo esiste come **mitigazione strutturale** della terza preoccupazione di design (vedi §13): non è una paura da risolvere con l'attenzione, è un'aspettativa da fissare nero su bianco.

### Roadmap delle fasi (contesto, non in scopo qui)

- **Fase 1 (questo doc):** modello a nodi + generatore + resolver registry + Casa & 2 maghi + Reclutamento + Reliquia-nodo + livelli/EXP + persistenza.
- **Fase 2 — Economia & respiro:** Negozio, Sala Comune (cura), Evento. Introduce Galleoni + pozioni.
- **Fase 3 — Progressione magica:** Biblioteca (upgrade magie), Aula di Pozioni, Foresta Proibita.
- **Fase 4 — Atmosfera:** tema mappa-Hogwarts + schermata-storia di fine run.

Ogni fase ha il suo ciclo spec → piano → implementazione.

---

## 2. Decisioni di design bloccate

| Tema | Decisione |
|---|---|
| Modello mappa | **Atlante per-area** (stile Slay the Spire): grafo ramificato pre-generato, il giocatore vede l'area intera e pianifica il percorso |
| Macro-struttura | **3 aree tematiche**, ognuna chiusa da un Boss d'area; l'ultima sfocia nel **Boss Finale**. Adattività allo stato **solo ai confini d'area** (la mappa di un'area è fissa) |
| Avvio run | Scelta **Casa** → scelta di **2 maghi iniziali** dalla Casa scelta. La squadra cresce fino a 5 durante la run |
| Ruolo Casa | **Identità + bias morbido:** ogni terna di Reclutamento garantisce ≥1 mago della tua Casa; puoi sempre reclutare da altre Case. Sfrutta le sinergie di Casa già esistenti |
| Reliquie | **Solo da nodo Reliquia dedicato** (e in futuro Negozio/Elite). Mai premio automatico dopo un combattimento |
| Combattimenti normali | Danno **EXP → livelli** dei maghi |
| Level-up | Crescita stat **automatica** a ogni livello + **scelta significativa ai livelli-soglia 3/6/9** |

---

## 3. Architettura: i 3 strati e l'invariante del confine di combattimento

L'architettura esistente è già divisa in 3 strati puliti. La Fase 1 **li mantiene** e riempie lo strato di run con i moduli mancanti.

```
┌─ UI / FSM ────────────────────────────────────────────────┐
│  HouseSelect → StarterPick → MapScreen ⇄ [resolver screen] │
│  useRun: dispatch per categoria di nodo                    │
└───────────────────────────────────────────────────────────┘
              ▼ chiama            ▲ muta RunState (immutabile)
┌─ Motore di RUN (puro) ────────────────────────────────────┐
│  run.ts · map.ts · nodeGen.ts · nodeCatalog.ts            │
│  resolvers/* · recruit.ts · leveling.ts                   │
└───────────────────────────────────────────────────────────┘
              ▼ chiama SOLO per i nodi-combattimento
┌─ Motore di COMBATTIMENTO (puro, INVARIATO) ───────────────┐
│  simulateBattle(left, right, rng, opts) → BattleResult     │
└───────────────────────────────────────────────────────────┘
```

### Invariante del confine di combattimento (NON negoziabile)

`game/engine/combat/*` **non viene modificato** dalla Fase 1 e non acquisisce alcuna conoscenza di mappa, nodi, EXP, livelli, Casa o UI. I resolver dei nodi-combattimento gli passano `DraftedWizard[]` + reliquie + sinergie, esattamente come fa `nextBattle` oggi.

- **Livelli:** un livello è un moltiplicatore di stat applicato al `DraftedWizard` **prima** di entrare in `simulateBattle`. Il motore riceve stat finali e ignora l'esistenza dell'EXP.
- **Upgrade magie (Fase 3):** saranno espressi come *dati che il motore già consuma* (modificatori sugli spell-data), mai come logica nuova dentro `simulate.ts`. Citato qui solo per fissare il principio.

Qualsiasi PR di Fase 1 che tocchi `game/engine/combat/*` è un campanello d'allarme e va giustificata esplicitamente.

---

## 4. Modello dati

### 4.1 Tipi nodo e mappa

```ts
// types/run.ts
export type RunNodeType =
  // Fase 1 — generati e risolti
  | 'battle' | 'elite' | 'boss' | 'recruit' | 'relic'
  // Fasi 2-3 — CATALOGATI ora (per estensibilità), generati dopo
  | 'shop' | 'event' | 'commonRoom'
  | 'library' | 'potions' | 'forest'

export interface RunNode {
  id: string          // `a{area}f{floor}n{idx}` — area e profondità leggibili dall'id
  type: RunNodeType
  next: string[]      // archi verso il piano successivo (grafo ramificato)
  resolved?: boolean  // true dopo il completamento (per save/render)
}
```

L'id codifica `area`, `floor`, `idx`. Funzioni `nodeArea(id)`, `nodeDepth(id)` lo parsano (estensione dell'attuale `nodeDepth`).

### 4.2 Stato della run

```ts
export type RunPhase =
  | 'house' | 'starter'        // NEW: avvio
  | 'map' | 'battle' | 'victory' | 'levelup' | 'recruit' | 'relic'
  | 'win' | 'defeat'

export interface RunState {
  seed: string
  house: House                 // NEW
  area: number                 // NEW: 0..2 (area corrente)
  phase: RunPhase
  team: DraftedWizard[]        // parte da 2, cresce fino a TEAM_MAX (5)
  relics: ActiveRelic[]
  activeSynergies: ActiveSynergy[]
  map: RunNode[]               // SOLO l'area corrente (atlante)
  currentNodeId: string
  log: RunEvent[]              // NEW: la "storia" della run
  pendingLevelUps?: PendingLevelUp[]  // code di scelte-soglia da risolvere
  lastBattle?: BattleResult
}
```

> Nota: `map` contiene **solo l'area corrente**. Alla sconfitta di un Boss d'area, si rigenera la mappa dell'area successiva (con bias di stato) e si sostituisce. Lo storico delle aree passate non serve allo stato di gioco (è già nel `log`).

### 4.3 Mago e progressione

```ts
// types/wizard.ts — DraftedWizard guadagna:
export interface DraftedWizard {
  // ...campi esistenti (wizard, stat rollate, currentHp, maxHp, ...)
  level: number            // NEW: parte da 1
  exp: number              // NEW: EXP accumulata verso il prossimo livello
  recruitedVia: string     // NEW: "iniziale" | "Reclutamento" | "Elite" | (Fase 3: "Foresta Proibita"...)
  growthChoices: GrowthChoice[]  // NEW: potenziamenti scelti alle soglie 3/6/9
}

export interface GrowthChoice {
  atLevel: number
  kind: 'atk' | 'def' | 'spd' | 'hp' | 'perk'
  // perk: id di un piccolo modificatore (Fase 1 può limitarsi alle 4 stat)
}
```

### 4.4 Log narrativo (semina per la schermata finale di Fase 4)

```ts
export interface RunEvent {
  area: number
  nodeId: string
  kind: 'recruit' | 'relic' | 'elite' | 'boss' | 'levelMilestone'
  summary: string  // "Recluti Luna Lovegood (Corvonero) — nodo Reclutamento, Area 2"
}
```

Il `log` viene popolato in Fase 1 anche se nessuna UI lo mostra ancora: è il seme delle storie ("Ho trovato Luna nella Foresta", "Ho sostituito Neville prima del Boss") che la Fase 4 renderà.

---

## 5. Catalogo nodi e ricompense (Fase 1)

| Nodo | Combattimento? | Cosa fa | Ricompensa |
|---|---|---|---|
| ⚔️ **Combattimento** | sì | Squadra nemica standard | **EXP** a tutta la squadra sopravvissuta |
| ⚫ **Elite** | sì | Fight molto duro (budget+menace maggiorati) | EXP maggiore **+ scelta di Reclutamento** |
| 💎 **Reliquia** | no | Nodo dedicato | **Scelta di reliquia** (l'unica fonte in Fase 1) |
| 👥 **Reclutamento** | no | Terna di 3 maghi (bias Casa) | **Scegli 1** (provenienza salvata nel log) |
| 👑 **Boss d'area** | sì | Chiude l'area | Vittoria → rigenera l'area successiva (bias stato) |
| 👑 **Boss Finale** | sì | Ultima area | Vittoria run |

Ogni categoria è una **rinuncia diversa e leggibile**: EXP, reliquia o nuovo mago. È la tensione di routing voluta.

### Catalogo estensibile

```ts
// game/engine/nodeCatalog.ts
export interface NodeKind {
  type: RunNodeType
  label: string       // "Reclutamento"
  emoji: string       // "👥"
  theme: string       // luogo Hogwarts (Fase 4 lo usa per il render)
  isCombat: boolean
  resolverId: string  // chiave nel resolver registry
  generatedInPhase: 1 | 2 | 3   // i nodi di Fase 2-3 sono catalogati ma nodeGen li ignora finché non attivi
}
```

Aggiungere "Negozio" in Fase 2 = una riga qui + un file `resolvers/shop.ts` + una schermata. **Zero modifiche** a `run.ts`, `nodeGen` o al motore di combattimento.

---

## 6. Generazione della mappa (il "generatore intelligente")

### 6.1 Modello

`game/engine/map.ts` espone `generateArea(rng, areaIndex, biasState)` che restituisce i `RunNode[]` di una singola area. Procede in due passi.

**Passo 1 — Topologia** (riuso della logica attuale di `generateMap`):
- Piani `0..F-1`. `F` = `BALANCE.map.floorsPerArea` (proposta iniziale: 5).
- Piano 0 = **singolo** nodo `battle` (ingresso, rampa morbida).
- Piano `F-1` = **singolo** nodo `boss`.
- Piani intermedi: larghezza `rng.int(minWidth, maxWidth)` (proposta: 2-3).
- Archi `f → f+1` a copertura piena in entrambe le direzioni (nessun orfano, nessun vicolo cieco), come oggi. Ramificazione extra deterministica dove la larghezza lo consente.

**Passo 2 — Assegnazione categorie** (`nodeGen.ts`): per ogni nodo dei piani intermedi, scegli la categoria con un **pick pesato** vincolato da **regole dure** e **bias di stato**.

### 6.2 Regole dure (anti-streak / equità) — `nodeGen.ts`

1. Piano 0 sempre `battle`; piano `F-1` sempre `boss`.
2. **Mai due `elite` su piani adiacenti.** Proposta semplice e deterministica: **esattamente 1 Elite per area**, collocato in un piano medio-tardo scelto dall'rng tra quelli consentiti.
3. **Garanzia di progressione per area:** ogni area contiene **≥1 nodo `recruit`** e **≥1 nodo `relic`** raggiungibili da almeno un percorso. Così le fonti di crescita non possono mai mancare del tutto.
4. **Diversità di bivio:** quando da un nodo si raggiungono ≥2 nodi, questi devono offrire **categorie diverse** dove possibile (la scelta dev'essere una vera rinuncia, non "combatti o combatti").
5. **Anti-monotonia:** lungo ogni percorso, niente più di `maxCombatStreak` (proposta: 2) combattimenti consecutivi senza un nodo non-combattimento intermedio disponibile; e niente più di `maxNonCombatStreak` (proposta: 2) nodi non-combattimento consecutivi.

### 6.3 Bias di stato (solo ai confini d'area)

Quando si genera l'**area successiva** dopo un Boss d'area, `biasState` modula i pesi base:

- **Squadra incompleta** (`team.length < TEAM_MAX`) → **+peso `recruit`**. *(In Fase 1 questa è l'unica leva adattiva disponibile: i nodi di cura/evento che reagiscono agli HP non esistono ancora — arriveranno in Fase 2, quando esisteranno i nodi relativi. Documentato di proposito per non promettere adattività che la Fase 1 non può dare.)*

Pesi e soglie vivono **tutti** in `BALANCE.map.categoryWeights` e `BALANCE.map.bias`. Nessun numero magico sparso.

### 6.4 Determinismo e riproducibilità

- RNG forkato per `(seed, mapChannel, area)`. L'assegnazione categorie usa fork ulteriori per `(floor, idx)`.
- Il bias di stato dipende da `biasState`, che è **deterministico dato il percorso scelto** dal giocatore. Quindi: *stesso seed + stesse scelte = stessa run*. L'adattività non rompe il replay.
- Il save persiste la mappa dell'area corrente dentro `RunState`: il reload è **esatto**, non una rigenerazione approssimata.

---

## 7. Resolver registry (estensibilità — punto 6)

```ts
// game/engine/resolvers/index.ts
export interface NodeResolver {
  id: string
  /** Combattimento: prepara e simula. Non-combattimento: descrive l'interazione. */
  enter(state: RunState): ResolverEntry
  /** Applica la scelta/esito del giocatore allo stato (immutabile). */
  resolve(state: RunState, choice: ResolverChoice): RunState
}
```

`run.ts` non conosce le categorie concrete: fa **dispatch** sul `resolverId` del nodo corrente. I nodi-combattimento (`battle`/`elite`/`boss`) delegano alla logica esistente di `nextBattle` (rifattorizzata dietro un resolver). I non-combattimento (`recruit`/`relic`) restituiscono un descrittore di UI + una funzione di mutazione.

Resolver di Fase 1: `battle`, `elite`, `boss`, `recruit`, `relic`.

---

## 8. Reclutamento

`game/engine/recruit.ts` — pura.

- `offerRecruits(rng, state)`: genera una **terna di 3 maghi**.
  - **Bias Casa:** ≥1 candidato della Casa del giocatore garantito; gli altri 2 pescati dal pool con un leggero bias verso la Casa, ma aperti a tutte.
  - Riusa la logica di rarità esistente (`createDraftPool` / `generateScreen` con i `tierWeights` attuali — leggendari/epici già resi rari) e `draftWizard` (statRoll).
  - Esclude maghi già in squadra.
- **Scelta:** il giocatore sceglie 1; gli altri 2 sono scartati.
- **Squadra piena (5):** il nuovo mago **sostituisce** un membro esistente — scelta difficile e voluta. La UI mostra la squadra attuale per il rimpiazzo.
- **Provenienza:** `recruitedVia` impostato (`"Reclutamento"`, `"Elite"`); evento aggiunto al `log`.

La logica "scegli-1-di-N" viene **estratta** dal vecchio `draftSession.ts` e condivisa tra StarterPick e Recruit. Il vecchio loop "costruisci-5-in-anticipo" di `draftSession.ts` viene rimosso.

---

## 9. Sistema di livelli ed EXP

`game/engine/leveling.ts` — pura.

- **Fonte EXP:** i nodi-combattimento assegnano EXP a tutta la squadra **sopravvissuta** (i caduti sono persi permanentemente). Elite/Boss danno EXP maggiore. Valori in `BALANCE.leveling`.
- **Curva:** `expForLevel(n)` (proposta iniziale: soglia crescente, cap a `LEVEL_MAX` ~ 10; calibrata dall'harness).
- **Crescita automatica per livello:** ogni livello applica `autoGrowthPct` a tutte le stat (proposta: piccola, es. +5-6%). Tunabile.
- **Scelte-soglia (3/6/9):** al raggiungimento di una soglia, il mago genera un `PendingLevelUp`. Dopo la vittoria, la FSM entra in fase `levelup` e mostra `LevelUpScreen`: il giocatore sceglie un potenziamento **forte** (es. +25% a una stat, o un perk). La scelta è registrata in `growthChoices` e nel `log`.
- Più maghi possono superare una soglia nella stessa battaglia → coda `pendingLevelUps` risolta in sequenza.

### 9.1 Vincolo di leggibilità — la funzione-stat unica (mitigazione strutturale)

**Problema:** con livelli + sinergie + reliquie + Casa che si moltiplicano, il giocatore deve poter capire *perché* un mago è forte, altrimenti la "decisione significativa" evapora in una zuppa di numeri.

**Mitigazione (non "stare attenti", ma struttura):** una **singola fonte di verità** per la derivazione delle stat, usata sia dal combattimento sia dalla UI.

```ts
// lib/statBreakdown.ts (NEW)
export interface StatBreakdown {
  base: Stats          // stat rollate del mago
  level: Stats         // delta da crescita automatica + scelte-soglia
  // synergy/relics restano applicate dal motore (applyBonuses), ma la
  // breakdown li ESPONE in modo coerente per la UI:
  synergy: Stats
  relics: Stats
  total: Stats
}
export function statBreakdown(dw, synergies, relics): StatBreakdown
```

**Invariante:** combattimento e UI non calcolano mai le stat con formule diverse.
- Il livello è applicato da `leveledStats(dw)` (pura): combat-prep mappa la squadra attraverso `leveledStats` prima di `simulateBattle`; la UI usa la stessa.
- Synergy/relic restano applicate dentro il motore (`applyBonuses`, invariato), ma `statBreakdown` ricostruisce gli stessi layer per il display attingendo alle stesse costanti/funzioni.
- La `LevelUpScreen` e la card del mago mostrano i layer (Base → Livello → Casa → Reliquie), così il "perché" è sempre esplicito.

Questo vincolo è **parte del piano**, non un di più: va costruito in Fase 1, non rimandato.

---

## 10. Avvio run: Casa e maghi iniziali

- `HouseSelectScreen`: scelta tra le 4 Case (dati `HOUSES` esistenti).
- `StarterPickScreen`: offerta dei maghi della Casa scelta; il giocatore ne sceglie **2** (riusa la UI "scegli-1-di-N", ripetuta due volte o selezione multipla).
- `confirmStart(state, house, twoWizards)` → genera l'Area 0 (`generateArea`), imposta `phase: 'map'`, `team` con 2 maghi `level 1`, `recruitedVia: "iniziale"`.

`startRun(seed)` ora imposta `phase: 'house'`. Il vecchio `PlayFlow` (split draft/campaign) viene sostituito da una FSM che attraversa house → starter → map → ….

---

## 11. Persistenza (punto 5)

`lib/runStore.ts` (NEW):
- `saveRun(state)` / `loadRun()` / `clearRun()` su `localStorage` (chiave versionata, es. `harry:run:v1`).
- **Autosave** dopo ogni nodo risolto e dopo ogni scelta (level-up, recruit, relic).
- Il menu mostra **"Continua run"** se esiste un salvataggio valido; "Nuova run" lo sovrascrive (con conferma).
- `RunState` è già un oggetto puro serializzabile (nessuna funzione/classe). Le rigenerazioni d'area sono deterministiche dallo stato salvato → reload esatto.
- Versioning: la chiave include `v1`; un caricamento di versione incompatibile viene scartato in modo pulito (no crash).

---

## 12. Difficoltà e bilanciamento (mitigazione strutturale #1)

**Problema:** il potere del giocatore ora cresce su **due assi simultanei** — Reclutamento (più maghi) **e** Livelli (maghi più forti). Due leve di crescita sono molto più difficili da tarare di una: rischi onnipotenza a metà run o fragilità fino al boss. L'intuizione umana non vede questo su 200 run.

**Mitigazione (rete, non promessa):**

1. **L'harness di simulazione è un deliverable di prima classe della Fase 1.** Si riscrive `tests/engine/campaignBalance.test.ts` per modellare il **nuovo loop**: un giocatore "near-optimal" che parte con 2 maghi, recluta ai nodi Reclutamento/Elite, livella combattendo, prende reliquie ai nodi dedicati, e attraversa le 3 aree fino al Boss Finale.
2. **Bande di difficoltà esplicite** (calibrate, valori iniziali da confermare con l'harness):
   - prima area: i primi fight vinti con buona probabilità (rampa morbida);
   - difficoltà crescente per area;
   - Boss Finale: vincibile ma raro per il giocatore near-optimal;
   - nessuno stallo al turn-cap (già coperto dalla fatigue esistente).
3. **Tutti i numeri di bilanciamento vivono in `BALANCE`** (`map`, `leveling`, `campaign`): budget/menace per **area** (non per-stage piatto), curva EXP, crescita per livello, pesi categorie. Si tara in un posto solo.
4. **Determinismo dei test** preservato: stesso seed + stessa policy del giocatore simulato = stessi risultati (verificato con doppia esecuzione).

Il bilanciamento perfetto non si raggiunge "facendo attenzione": si raggiunge stringendo le bande dell'harness fino a che la curva non è quella voluta.

---

## 13. Le mie preoccupazioni di design e come lo spec le scioglie

| Preoccupazione | Perché l'attenzione non basta | Mitigazione strutturale (nel piano) |
|---|---|---|
| **Bilanciamento a 2 assi** (EXP + reclutamento) | Nessun umano intuisce l'interazione su 200 run | §12: harness di prima classe + bande + tutto in `BALANCE` |
| **Leggibilità delle stat** | "Guardare meglio dopo" non impedisce la zuppa di numeri | §9.1: funzione-stat unica condivisa combat/UI + breakdown a layer in UI |
| **Fase 1 scheletrica** | Non è una paura, è un'aspettativa | §1: scopo dichiarato — la Fase 1 è fondamenta, non gioco finito |

---

## 14. Mappa dei moduli (nuovi / modificati)

**Motore di run (puro)**
- `game/engine/nodeGen.ts` — **nuovo**: assegnazione categorie (regole dure + bias)
- `game/engine/nodeCatalog.ts` — **nuovo**: catalogo tipi nodo + metadati
- `game/engine/resolvers/{battle,elite,boss,recruit,relic}.ts` + `index.ts` — **nuovo**: registry
- `game/engine/recruit.ts` — **nuovo**: terna di reclutamento (bias Casa, provenienza)
- `game/engine/leveling.ts` — **nuovo**: EXP, curva, crescita, soglie
- `game/engine/map.ts` — **refactor**: `generateArea(rng, areaIdx, biasState)` + parsing id area-aware
- `game/engine/run.ts` — **refactor**: `confirmStart`, `resolveNode` con dispatch, transizione d'area
- `game/engine/draftSession.ts` — **rimosso/assorbito** in `recruit.ts`

**Libreria / dati**
- `lib/statBreakdown.ts` — **nuovo**: fonte unica derivazione stat
- `lib/runStore.ts` — **nuovo**: save/load localStorage
- `data/constants.ts` — **esteso**: `BALANCE.map.{floorsPerArea,categoryWeights,bias,areas}`, `BALANCE.leveling`, budget/menace per-area

**Tipi**
- `types/run.ts`, `types/wizard.ts` — estesi (vedi §4)

**UI**
- `components/screens/{HouseSelect,StarterPick,Recruit,Relic,LevelUp}Screen.tsx` — **nuovo**
- `components/screens/MapScreen.tsx` — **esteso**: render nodi categorizzati (emoji/tema), atlante, posizione, raggiungibili
- `hooks/useRun.ts` — **refactor**: FSM con dispatch per categoria
- `components/screens/PlayFlow.tsx` / `CampaignRunner.tsx` — **refactor**: nuovo flusso house→starter→map→…

---

## 15. Strategia di test

- **Unit (puro):** `nodeGen` (regole dure: no 2 elite adiacenti, ≥1 recruit & ≥1 relic per area, diversità bivio); `recruit` (bias Casa, no duplicati, rimpiazzo a squadra piena); `leveling` (curva, soglie, code multiple); `statBreakdown` (i layer sommano al totale; combat e UI coerenti); `generateArea` (determinismo, copertura grafo, reload esatto).
- **Persistenza:** save → load → stato identico; versione incompatibile scartata senza crash.
- **Bilanciamento:** `campaignBalance.test.ts` riscritto (§12) con bande e doppia esecuzione per determinismo.
- **Confine combattimento:** test/asserzione che `simulateBattle` riceve stat già livellate e che nessun modulo combat importa run/map.
- **UI:** smoke test render delle nuove schermate (come gli esistenti `tests/ui/*`).

---

## 16. Risposte ai 7 quesiti originali

1. **Integrare mantenendo la modularità** → §3: i 3 strati restano; lo strato run si riempie, gli altri due non cambiano.
2. **Nuovi moduli** → §14.
3. **Generatore intelligente** → §6: regole dure + bias di stato, pesi in `BALANCE`.
4. **Rappresentare la mappa** → §4.1: grafo `RunNode` con categoria e id area-aware; `map` = area corrente.
5. **Salvare lo stato** → §11: `runStore` su localStorage, stato puro, reload esatto.
6. **Estendibilità nuovi nodi** → §5 + §7: catalogo + resolver registry; nuovo nodo = 1 riga + 1 resolver + 1 schermata, zero modifiche al core.
7. **Battle engine indipendente** → §3: invariante del confine; livelli come moltiplicatori a monte; combat intatto.

---

## 17. Fuori scopo (fasi successive)

- Galleoni / economia / pozioni-inventario → Fase 2.
- Nodi Negozio, Evento, Sala Comune → Fase 2.
- Upgrade magie / apprendimento incantesimi (Biblioteca), Aula Pozioni, Foresta Proibita → Fase 3.
- Schermata-storia di fine run, tema visivo Hogwarts della mappa → Fase 4.

---

## 18. Decisioni con default proposti (da confermare in review)

- `TEAM_MAX = 5`, partenza con **2** maghi `level 1`.
- `floorsPerArea = 5`, `minWidth = 2`, `maxWidth = 3`, **3 aree**, **1 Elite per area**.
- Soglie level-up **3/6/9**, `LEVEL_MAX ≈ 10`, crescita auto piccola per livello, scelta-soglia = potenziamento forte (4 stat in Fase 1; perk dalla Fase 3).
- EXP team-wide ai soli sopravvissuti; Elite/Boss danno EXP maggiore.
- Reliquie **solo** da nodo Reliquia in Fase 1.
- Tutti i valori numerici sono **iniziali** e verranno calibrati dall'harness (§12).
