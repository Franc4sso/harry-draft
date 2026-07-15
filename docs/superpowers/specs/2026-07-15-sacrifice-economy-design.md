# Economia del Sacrificio (P5, Fase 3) — Design

> Data: 2026-07-15 · Pilastro: P5 (design direction §9, Onda 3)
> Scope approvato: Corruzione + Altare Oscuro (Reliquie del Sacrificio) + Patti & maledizioni.
> Fuori scope: élite opzionali ad alto rischio, dilemma della panchina UI (restano nel backlog P5).

## Tesi

Quasi ogni scelta del gioco è in upside. P5 introduce il **costo come meccanica**: potere vero in
cambio di rinunce permanenti e sempre dichiarate prima della scelta. Tre superfici, una sola
spina dorsale: `SacrificeCost` + `applySacrificeCost()` — un unico posto dove "pagare" è
implementato (pattern trioGates: mai due implementazioni dello stesso gate).

Principio non negoziabile (dal design doc): **i costi sono sempre chiari prima della scelta.**
Nessun costo nascosto, nessuna sorpresa retroattiva.

## 1. Corruzione

### Regola
Quando il giocatore **assegna** una reliquia `grantsDarkMagic` (marchio-nero, patto-di-sangue,
patto-vorace) a un mago, quel mago diventa **Corrotto**: subito, permanentemente, anche se la
reliquia viene persa in seguito.

- Il bonus dark magic da synergy `oscurita` **non** corrompe: nessuna scelta esplicita di
  equipaggiamento = nessun costo. Corrompe solo l'atto di assegnare la reliquia.
- Nessun percorso di cura della Corruzione in v1 (un eventuale "redenzione" è materiale P6).

### Malus: non curabile
Il Corrotto non riceve cure di alcun tipo:
- regen in battaglia — **entrambi** i siti (tick status in `status.ts` E team regen in
  `simulate.ts`; nota memoria "two regen paths": gate speculare obbligatorio in tutti e due);
- magie di cura (il targeting delle cure salta i Corrotti: non sprecare heal su bersagli immuni);
- nodi cura fuori battaglia;
- effetto evento `healTeam` (il Corrotto è escluso dal heal, gli altri curano normalmente).

I danni da recoil diventano quindi definitivi sul carrier: chiude la scappatoia
"Marchio sul carrier con tanti HP" (memoria: la leva era il recoil, ora il costo è strutturale).

### Dati
- `DraftedWizard.corrotto?: true` — opzionale, additivo, serializzato nel run save.
- `BattleUnit` riceve il flag in `toBattleUnits` per i gate in combattimento.

### UI
- Avviso esplicito **prima** dell'assegnazione: "⚠ diventerà Corrotto — permanente, non curabile".
- Badge Corrotto su card mago (roster/draft) e in battaglia.
- Testo del malus visibile nel dettaglio mago.

## 2. Altare Oscuro

### Nodo
- Nuovo node kind `altare` nel generatore mappa.
- **~30% di probabilità per area**, posizione casuale su un ramo (sempre evitabile, mai
  obbligato). Mai garantito: la rarità è voluta (sapore sorpresa, P6).
- La chance deriva dal **seed della run** (replay-safe, niente RNG non deterministico).

### Screen
- Screen dedicata a standard premium UI (GameShell/classi condivise, memoria "Premium UI system").
- Offre 2–3 Reliquie del Sacrificio, ognuna con **costo esplicito** accanto al potere.
- Opzione "vai via" sempre presente e gratuita.

### Reliquie del Sacrificio
- Nuovo pool `SACRIFICE_RELIC_IDS` in `data/relics.ts`, potenza livello epico.
- **Player-only e solo all'Altare**: escluse da `selectEnemyRelics`, dal bot draft
  (come `JOKER_RELIC_IDS`), da `offerRelics`/`offerJokers` e dallo shop.
- V1: **5 reliquie**. Ogni reliquia dichiara il suo `SacrificeCost`. Esempi direzionali
  (numeri finali in fase piano/balance):
  - *Diario di Tom Riddle* — potere enorme; costo: sacrifica un mago (a tua scelta).
  - *Mano della Gloria* — costo: perdi una reliquia che possiedi (a tua scelta).
  - *Calice Avvelenato* — costo: −X HP max permanenti su un mago a tua scelta.
  - Altre due con costo `runModifier` o mix.

### Costi (`SacrificeCost`)
Union type, un applicatore:
- `{ kind: 'wizard', wizardId }` — rimuove il mago dal team (scelto dal giocatore).
- `{ kind: 'relic', relicId }` — rimuove una reliquia posseduta (scelta dal giocatore).
- `{ kind: 'maxHp', wizardId, amount }` — riduzione permanente HP max (floor di sicurezza ≥1).
- `{ kind: 'runModifier', modifier }` — imposta un flag in `RunState.runModifiers`.

Vincoli di validità: non puoi sacrificare l'ultimo mago del team; il costo non selezionabile
(es. nessuna reliquia da perdere) rende l'offerta non acquistabile, mai un costo alternativo
silenzioso.

## 3. Patti & maledizioni (eventi)

### Meccanica
Nuovi `EventEffect`:
- `{ kind: 'sacrificeCost', cost: SacrificeCost }` — riusa il backbone (stesso applicatore).
- `{ kind: 'setRunModifier', modifier }` — scorciatoia diretta per i patti puri.

`RunState.runModifiers?: { noRecruits?: boolean; teamStatPct?: number }` — campi discreti
(YAGNI: niente bag generico finché non servono più di questi due).

### Contenuto v1: 2–3 patti
- **Voto Infrangibile** — "+20% a tutte le stat della squadra attuale; non potrai mai più
  reclutare." (`teamStatPct: 0.20` + `noRecruits: true`).
  - Gate `noRecruits`: early-return in `recruitResolver.resolve`, caso `addWizard` in
    `applyEventEffects`, e i nodi recruit sulla mappa mostrano lo stato disattivato.
  - `teamStatPct` applicato in composizione battle units (vale anche per reclute-mai:
    la squadra è congelata per definizione).
- 1–2 patti aggiuntivi definiti in fase piano (stesso schema: potere chiaro, costo chiaro).

Gli eventi patto esistenti (`patto`, `coppa_maledetta`, `ombra`) migrano sul backbone
`sacrificeCost` dove il loro effetto coincide (rimozione mago per reliquia); nessun cambio
di comportamento percepito.

## 4. Architettura

- `game/engine/sacrifice.ts` (nuovo): `SacrificeCost` + `applySacrificeCost(state, cost): RunState`
  puro + validatori (`canPay(state, cost)`). **Unica fonte del pagamento**, consumata da
  `altareResolver` e da `applyEventEffects`.
- `altareResolver` (nuovo, in `game/engine/resolvers/`): offerta deterministica dal seed+nodo,
  scelte `buy(relicId, costSelection)` / `leave`.
- Generatore mappa (`runEngine.ts`): chance `altare` per area dal seed.
- Corruzione: set del flag al momento del `relic-pick` con `assignedTo` su reliquia
  `grantsDarkMagic`; gate cure nei due siti regen + targeting + nodi cura + `healTeam`.
- Save: tutti campi opzionali additivi → **nessun bump di VERSION** in `lib/runStore.ts`
  (i vecchi save caricano con default assenti).

## 5. Balance

- Attesa: **gate invariato**. Il bot near-optimal non compra all'Altare e non firma patti
  (stessa ragione dei Trio: contenuto player-only invisibile al bot power-greedy).
- Obbligatorio comunque **A/B `campaignBalanceRestricted` pre/post** (il generatore mappa
  cambia: un nodo `altare` può sostituire/spostare nodi esistenti — questo SÌ tocca il bot).
  Path corretto: `tests/engine/campaignBalanceB` (NON `tests/campaign`).
- Pin invariati: STARTER_PICKS=3, elites≥2, normalCount=1, Voldemort unitCount=3, mai menace.
- Assert live: winRate>0; banda di riferimento commentata 0.15.
- Se il piazzamento altare sposta il gate fuori banda → tarare la **frequenza/posizione del
  nodo**, mai i pin. Se serve >1 ritocco leva → STOP e riportare i numeri.

## 6. Test

- TDD per ogni meccanica; `npm run test` non typechecka → `npx tsc --noEmit` sempre a parte.
- Unit: `applySacrificeCost`/`canPay` per ogni kind (incluse invalidità: ultimo mago,
  nessuna reliquia); Corruzione: set flag, persistenza post-perdita reliquia, gate su
  ENTRAMBI i siti regen, targeting cure, `healTeam` parziale.
- Integrazione: altare node → buy → stato coerente; Voto Infrangibile → recruit bloccato
  (resolver + evento addWizard) + stat applicate in battaglia.
- Deterministic-only (seed fisso), nessun RNG nei test.
- Attenzione memoria: NON toccare `BALANCE.draft.screenSize` (5 count-test sparsi).

## Rischi & mitigazioni

- **Frustrazione da costi opachi** → costi sempre dichiarati prima, UI avviso Corruzione.
- **Two-paths drift** (regen, gate pagamento) → un solo applicatore costi; gate cura
  centralizzato dove possibile, altrimenti test speculari sui due siti regen.
- **Altare invisibile al playtest** (30%) → accettato consapevolmente dall'utente
  (2026-07-15): la non-garanzia è parte del sapore.
- **DoT + non curabile spirale** → il Corrotto resta vulnerabile a veleno permanente;
  è inteso (alto rischio per design), da osservare nel playtest.
