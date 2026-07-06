# Handoff — dove riprendere

Aggiornato: **2026-07-06**. Ultimo commit su `origin/master`: `8739a3e`.
Da un altro PC: `git pull origin master`, `npm install`, poi leggi questo file.

## Stato in una riga

Il gioco è un roguelite auto-battler (Harry Potter, Next.js/TypeScript). Il loop di run
è ricco: mappa a nodi, combattimento, progressione. **Tutto il lavoro recente è su
`origin/master` (0 commit avanti).** Prossimo: **playtest** (ora anche i joker!) + nuovi
nodi run (campfire, modificatori di battaglia). 1183 test verdi, typecheck pulito, build ok.

## Fix 2026-07-06 (dopo i joker): veleno visibile + combattimento fluido

- **Veleno: gli stack ora si vedono crescere**. Bug: il pill/tooltip mostrava `remaining`
  (durata, fissa a 2 perché il veleno è `permanent`) invece di `stacks` (le dosi, 1→8). Ora
  mostrano le dosi (`effectCount`/`describeEffect` in `UnitBust.tsx`). La meccanica era già
  corretta — solo il display sbagliava. Commit `47f2158`.
- **Combattimento più fluido (pass di memoization, ZERO cambio visivo)**. Causa: nessun
  `React.memo` nell'albero battaglia → ogni frame di replay ri-renderizzava tutto, e
  `recapTotals` ri-scansionava tutta la storia dal frame 0 a ogni tick (O(n²), 2-4× — ecco il
  "diventa più pesante col procedere"). Fix: memoizzati recap/log slices + derivazioni di
  BattleArena; `React.memo` su UnitBust/BattleRecap/BattleLog/InitiativeBar/ArenaBackdrop.
  Punto chiave: `floatKey` ora va solo al bust bersagliato (era `frameKey` su tutti → rendeva
  il memo un no-op). Spec/piano: `docs/superpowers/plans/2026-07-06-battle-perf.md`. NON toccato
  Pixi/GSAP (già a posto). Commit `6627586`..`8739a3e`.

## Ultima slice (2026-07-06): JOKER espansi + reliquie ridisegnate

Diagnosi iniziale: i "joker" (reliquie che scalano dentro la run) c'erano ma **non si vedevano
mai** — non un bug di applicazione (verificata la catena kill→counter→stat), ma di offerta:
erano epica peso 6 in un pool ristretto → ~10% di comparsa. Fix + espansione (spec+piano in
`docs/superpowers/{specs,plans}/2026-07-06-jokers-and-relics*`):
- **Motore joker esteso**: nuovi trigger di scaling `turn`/`battleWin`/`allyDead` (oltre `kill`);
  stat scalabili `defense`/`speed` (oltre atk/maxHp/velenoMult); `conditional` statico
  `teamSizeBelow`; `drawback` (malus sempre attivo); `onlyTurn` (trigger reattivo solo al turno N).
- **`BattleResult.alliesLost`**: conta i maghi del player caduti (tutti e 4 i percorsi di morte:
  diretto/contraccolpo/veleno/**fatica**) → alimenta il joker "Eredità dei Caduti".
- **11 joker nuovi** (`data/relics.ts`): 4 scaling (Marcia di Guerra, Fortezza Vivente, Vento
  Crescente, Eredità dei Caduti), 2 condizionali (Ultimo Baluardo, Branco Ristretto), 2 con
  drawback (Patto Vorace, Sete di Sangue), 3 reattivi (Furia Morente, Canto del Cigno, Assalto
  d'Apertura — usano lo status `atkUp` +20/2turni). Tutti `epica`, tutti in `JOKER_RELIC_IDS` +
  `STARTER_RELICS`.
- **Pool separati**: `offerRelics` esclude i joker; nuovo `offerJokers` (pesca uniforme).
- **Nodo reliquia → joker o reliquia**: con prob. **`BALANCE.relics.jokerNodeChance` = 0.35** il
  nodo offre 3 joker invece di 3 reliquie base (deterministico per seed+nodo). **Questa è la leva
  di visibilità dei joker** — se al playtest le reliquie tematiche spariscono troppo, abbassala.
- **Joker MAI sui nemici**: `selectEnemyRelics` esclude tutti i `JOKER_RELIC_IDS` (i joker sono
  solo del player, balance-safe per costruzione — il bot non li pesca).
- **2 reliquie base ridisegnate a budget costante**: Mappa del Malandrino (+6 atk + esecuzione),
  Ricordella (+6 def/spd + piccolo scudo a inizio battaglia). Giratempo lasciata invariata (la
  conditional "mentre a HP pieno" non è esprimibile: `RelicConditional` supporta solo il gate
  statico `teamSizeBelow`).
- **Balance**: campaignBalanceB **0.3583**, campaignBalanceRestricted **0.3750** (sopra floor con
  margine largo). NOTA: le assert live di questi test sono `winRate>0`; i numeri 0.15/0.275 nei
  commenti sono storici. Due floor di sweep ri-ancorati (magieOscure, esecuzione) = artefatti di
  *disponibilità* (i joker occupano slot), non regressioni di meccanica — verificati A/B.
- **Nota copy (minore)**: le desc di Ultimo Baluardo / Branco Ristretto ("se restano meno di N
  maghi vivi") suonano dinamiche ma il gate è **statico** (valutato a inizio battaglia). Semantica
  approvata; se dà fastidio al playtest, o si riscrive la copy o si sposta il gate su un trigger
  reattivo `onAllyDeath`.

## Cosa è stato fatto di recente (NON rifarlo) — tutto su master

Ordine ~cronologico, tutto committato+pushato:
- **Meta-layer & retention**: profilo, sblocchi (milestone + Cioccorane), boss pool, codex, schermata Collezione (album Cioccorane).
- **Event nodes** (`?`): nodi data-driven scelta-e-conseguenza + reliquie rompi-regole. Veleno ridisegnato **permanente** (ticca fino a fine combattimento) con danno diretto basso.
- **Scaling jokers**: reliquie che crescono per uccisione, reset a ogni run (Fame Vorace/Collezionista/Marchio Vorace). Cap alzati per farle "snowball" tutta la run.
- **Nodo "Aumento Magia" (spellForge)**: potenzia la magia di un mago (+15%/lvl, cap Lv.6). `game/engine/spellForge.ts`.
- **Mappa/UI**: barre PV nella sidebar; **hover elite** con roster nemico (ritratto·ruolo·magia·PV·"forte vs"); **sigillo boss = ritratto del villain** (non emoji); restyle albero (faro in cima, embers, sentiero); cerchi pieni; z-index hover.
- **MAX 5 nemici** (hard cap strutturale, battaglia/elite/boss). Regola utente assoluta.
- **Fix ordine attacchi**: la barra "Ordine" ora usa il tiebreak del motore (spd → wizard id → side).
- **Sistema COUNTER dei ruoli (RPS)** — 🛡️Tank→⚔️Attaccante→✨Supporto→🌀Controllo→🛡️Tank. Matrice danni ×1.25 vs preda + passive di ruolo (Provocazione; Affondo = l'Attaccante si tuffa sul Supporto; Tenacia+Purificazione = il Supporto dimezza/pulisce i controlli; **Regola Globale: un Tank stordito perde la Provocazione** = così il Controllo lo batte e l'Affondo si apre). Bias magia↔ruolo in `pickSpell` + invariante di pool. `game/engine/combat/roleCounter.ts`. Spec: `docs/superpowers/specs/2026-07-05-role-counters-design.md`.
- **Cap di livello RIMOSSO**: i maghi del giocatore salgono oltre il 10 (`gainLevels`/`levelFromExp`). `levelMax=10` resta solo per i NEMICI + boss finale.
- **Nodo NEGOZIO (shop)**: 3 reliquie a scelta (prezzo per rarità) + Cura completa + Rimuovi-un-mago + Rimescola, pagati in Cioccorane. Multi-acquisto, stock deterministico stabile. `game/engine/resolvers/shop.ts`, `components/screens/ShopScreen.tsx`. Spec+piano: `docs/superpowers/*2026-07-05-shop-node*`.

## PROSSIMO — da fare

1. **PLAYTEST (priorità)** — il bot di bilanciamento NON capisce i counter né sceglie le magie come un umano, quindi il giudizio è tuo:
   - I **counter dei ruoli** (feeling del ciclo Tank/Att/Sup/Ctrl).
   - Il **negozio** (prezzi giusti? in `BALANCE.shop`).
   - ⚠️ **Il Controllo ora fa MENO danno diretto** (il suo +25% è vs Tank, che però evita; ha perso il vecchio bonus). Voluto (la sua forza è disabilitare), ma se è troppo debole va buffato — lever: matrice/targeting in `roleCounter.ts`/`targeting.ts`.
   - `campaignBalanceRestricted` (il vero proxy) ≈ **0.275** — difficoltà reale invariata. Le sweep a 0.0 sono il bot cieco-ai-counter, non un bug.
2. **Nodo Campfire/riposo** (scelta cura-vs-potenziamento).
3. **Nodi modificatore di battaglia**.

### Come aggiungere un nuovo nodo run (checklist collaudata — vedi i commit shop/spellForge)
`types/run.ts` (RunNodeType se manca + RunPhase `X-node` + eventuali campi su RunNode + RunEvent.kind) · `game/engine/nodeCatalog.ts` (riga NODE_CATALOG) · nuovo `game/engine/resolvers/X.ts` + registra in `runEngine.ts` (`registerCoreResolvers` + `phaseForNode`) · `game/engine/nodeGen.ts` (`Filler` union + `pickFiller`) + `data/constants.ts` (`categoryWeights.X`) · `hooks/useRunB.ts` (RunBView + viewForPhase + callback) · `components/screens/XScreen.tsx` + `RunBRunner.tsx` (case) · `MapScreen.tsx` ICON/LABEL/ACCENT.

## Regole del progetto (importanti)

- **Copy in italiano.** Commit su master + push senza chiedere quando il lavoro è finito (flusso stabilito dall'utente).
- **MAI più di 5 nemici** in nessuno scontro (regola assoluta). Enemy count = leva primaria di difficoltà; budget/livello sono leve morte; boss finale = 5 unità (pin).
- **MAI fuoco amico** (guard strutturali in `effects.ts`). NIENTE camera shake nei VFX.
- **Recruit rari** (hard cap ≤1/area). L'utente NON vuole scontri che forzano una build.
- **Difficoltà "più cattiva" è approvata** — non ammorbidire la forza nemica.
- `npm run test` NON esegue il typecheck → `npm run typecheck` a parte.
- Il **bot di bilanciamento non capisce i counter/negozio** → il playtest umano è l'unico vero metro; tratta i winRate come smoke check.

## Vedere il gioco (screenshot harness)
Playwright è installato (devDep, in package.json). Su un PC nuovo: `npx playwright install chromium` una volta. I driver di guida (reach map/battle/shop → screenshot) erano nella scratchpad della sessione (`shoot.js`/`shootBattle.js`/`shootShop.js`) — ricostruibili: apri `/play`, svuota `localStorage['harry:run:v1']`, reload, clicca `[data-testid="draft-pick-0"]` ×3 → mappa; i nodi sono `button[aria-label="..."]` (usa `.click({force:true})` per l'anim breathe).

## Comandi utili
```
git pull origin master
npm install
npx playwright install chromium   # una volta, per gli screenshot
npm run dev            # localhost:3000  (la run è su /play)
npm run test           # vitest (NO typecheck)
npm run typecheck      # tsc --noEmit
npm run build
```

## Processo (subagent-driven)
Le feature grandi si costruiscono: `superpowers:brainstorming` → spec → `writing-plans` → esecuzione subagent (implementer + reviewer per task, review finale whole-branch, poi merge). Spec e piani stanno in `docs/superpowers/{specs,plans}/`. I ledger `.superpowers/sdd/*` sono scratch LOCALE (gitignored, non arrivano su un altro PC — lo stato "vero" è questo file + i commit).
