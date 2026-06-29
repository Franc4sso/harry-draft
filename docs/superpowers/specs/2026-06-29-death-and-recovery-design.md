# Sistema Morte & Recupero — design

> Data: 2026-06-29. Slice 2 di 6 (vedi ledger). Nasce dalle richieste utente durante lo Slice 1
> (scaling): la morte di un mago non deve eliminarlo; serve un recupero pre-boss; questo a sua volta
> sblocca un boss finale forte (il `finalBossMenace=-0.50` temporaneo dello Slice 1 torna a climax).
> Sistema coeso a 5 parti. Il consumabile di resurrezione è SCORPORATO in uno slice successivo.

## Problema

Oggi un mago morto in battaglia viene **eliminato dalla squadra**: `applyBattleToRoster`
(`game/engine/run.ts:17`) fa `.filter(dw => byId.get(dw.wizard.id)?.alive !== false)` — i morti
spariscono. La condizione di sconfitta è `wiped = team.length === 0` (`runEngine.ts:105`), quindi la
squadra si svuota fino al game-over. È punitivo e opaco, e non lascia spazio al recupero.

In più, lo Slice 1 ha lasciato `finalBossMenace=-0.50` (boss finale più DEBOLE dei boss d'area) come
cerotto temporaneo: con tutte le battaglie più dure il giocatore arrivava al boss logorato, e un boss
forte schiacciava il win-rate. Disaccoppiare "difficoltà del boss" da "logoramento del giocatore" è il
vero fix, e lo fa il recupero pre-boss.

## Sezione 1 — Morte = 0 HP in panchina, non eliminazione

- **`game/engine/run.ts:17`**: RIMUOVERE il `.filter(alive !== false)`. Un mago morto resta nel roster
  con `currentHp = 0` (panchina). Tutti i maghi (snapshot trovato o no) restano; solo l'HP si aggiorna.
- **Defeat (`runEngine.ts:105`)**: `wiped = team.length === 0` → `wiped = team.length > 0 && team.every(dw => (dw.currentHp ?? dw.maxHp) <= 0)`.
  Game-over solo quando OGNI mago è a 0 HP. (Squadra vuota non accade più, ma il `length>0` evita un
  falso-positivo su stati transitori.)
- **Schieramento (combattimento)**: solo i VIVI scendono in campo. In `resolveCombat`
  (`game/engine/resolvers/combat.ts`) il team passato a `battleReadyTeam`/`simulateBattle` va filtrato a
  `currentHp > 0` (o `undefined` = pieno). Un morto in panchina NON è un `BattleUnit`.
- **Sinergie (REGOLA NETTA)**: le sinergie attive in battaglia contano SOLO i vivi schierati. Un morto
  in panchina NON contribuisce. `detectSynergies` riceve i vivi, non l'intero roster. (Evita l'exploit
  "tengo il morto in panchina per il buff".) Lo stato `activeSynergies` mostrato fuori battaglia può
  restare sul roster intero per la UI, ma il calcolo di COMBATTIMENTO usa i vivi.
- **EXP/livelli**: solo i maghi che hanno combattuto (i vivi) guadagnano livelli dalla vittoria. I morti
  in panchina NON livellano (`gainLevels` applicato ai vivi). Quando resuscitano, mantengono il livello
  che avevano.

## Sezione 2 — L'Infermeria (nuovo tipo nodo)

- Nuovo `RunNodeType` **`infirmary`** in `types` + `nodeCatalog.ts`: label "Infermeria", emoji 🏥,
  `isCombat: false`, `resolverId: 'infirmary'`, tema "Ala dell'Infermeria".
- Nuovo `infirmaryResolver` (`game/engine/resolvers/`): alla risoluzione, per OGNI mago del roster
  imposta `currentHp = maxHp` — **cura piena i vivi E resuscita i morti a HP pieno**. Nessuna scelta
  (recupero totale), un solo ack come gli altri nodi non-combat.
- Registrato in `registerCoreResolvers`.

## Sezione 3 — Floor-Infermeria garantito pre-boss (generatore mappa)

- In `game/engine/map.ts`, il generatore forza il floor IMMEDIATAMENTE prima del nodo boss di ogni area
  a essere composto di sole Infermerie. Qualunque percorso scelga il giocatore, l'ultimo nodo prima del
  boss è un'Infermeria → arriva sempre recuperato.
- Le Infermerie possono comparire anche altrove (nodo normale nella generazione phase-2), ma il floor
  pre-boss è la garanzia.

## Sezione 4 — Swap morto→vivo al nodo recluta

- Il `recruit-pick` supporta già `replaceId`. Con la panchina, il giocatore può scartare un mago MORTO e
  prendere il reclutato vivo al suo posto.
- Verificare che la UI del nodo recluta permetta di selezionare un mago morto come bersaglio di
  rimpiazzo (mostrarlo come morto/0HP ma selezionabile) e che lo swap funzioni col benchato. Nessun
  cambio di logica resolver se `replaceId` accetta già qualunque id in squadra.

## Sezione 5 — Boss finale forte (sbloccato dal recupero)

- Con l'Infermeria garantita pre-boss, il giocatore arriva recuperato. Rialzare
  `campaignB.finalBossMenace` da -0.50 a un valore tarato empiricamente nel range **+0.30..+0.40**
  (statMult ~1.30-1.40), così il boss finale è ≥ del boss area-2 (statMult 1.38) e resta il climax.
- ⚠️ **Tarare INSIEME a 2+3**: il boss forte è sopravvivibile SOLO perché il floor-Infermeria pre-boss
  esiste. Il valore esatto si misura col `campaignBalanceB` aggiornato (che ora include il floor
  pre-boss), non in isolamento. Target: la run resta in banda `[0.15, 0.45]` col boss forte.

## Sezione 6 — Validazione

- **Morte≠eliminazione** (`tests/engine/`): dopo una battaglia con un caduto, il roster lo contiene
  ancora a `currentHp=0`; `defeat` scatta solo a roster tutto-morto; un morto in panchina NON è
  schierato in `simulateBattle`; le sinergie di combattimento NON lo contano; non guadagna livelli.
- **Infermeria**: il resolver porta vivi feriti e morti tutti a `currentHp = maxHp`.
- **Floor pre-boss** (`tests/engine/` map gen): per ogni area, ogni percorso che raggiunge il boss passa
  per un'Infermeria al floor precedente.
- **Swap**: `recruit-pick` con `replaceId` di un mago morto produce il roster atteso (morto fuori, vivo
  dentro).
- **Boss + balance**: `campaignBalanceB` (col floor pre-boss + boss forte) resta in `[0.15, 0.45]`.
  Aggiornare il diagnostico Serpeverde col nuovo numero.
- Full suite verde + tsc. Determinismo: nessun RNG nuovo nei path morte/cura/Infermeria.

## Rischi noti & leve

- **Un punto che assume "team = combattenti" non aggiornato** → un morto fantasma combatte o conta per
  le sinergie. Mitigazione: i test della Sezione 6 inchiodano OGNI assunzione (schieramento, sinergie,
  livelli, defeat). Il punto critico è il filtro vivi in `resolveCombat`.
- **Boss troppo forte anche col recupero** (winRate < 0.15): abbassare `finalBossMenace` verso +0.20. Va
  tarato che il boss sia il muro più duro ma non invalicabile, DATO il recupero pre-boss.
- **Infermeria troppo generosa rende il gioco facile**: improbabile (è garantita solo pre-boss; altrove
  è una scelta di percorso che costa un nodo non-combattimento = niente EXP). Se i numeri lo mostrano,
  si limita la frequenza delle Infermerie non-pre-boss.

## Non in scope (YAGNI / slice successivi)

- **Consumabile di resurrezione** (reliquia one-shot usabile prima di un nodo, poi si distrugge) —
  SLICE SEPARATO: richiede inventario rimovibile + azione "usa" attiva + UI bersaglio, meccanismi nuovi.
- Altri nodi non-combat (shop/event/commonRoom) — backlog P3.
- Resurrezione IN battaglia (alla morte) — non richiesta; il recupero è tra i nodi.
- Cura parziale / scelte all'Infermeria — l'utente ha scelto recupero totale.

## Ordine di implementazione (per il plan)

1. Engine morte≠eliminazione: rimuovere il filtro in run.ts, cambiare il defeat, filtrare i vivi nello
   schieramento + sinergie di combattimento, escludere i morti dai livelli. Test.
2. Tipo nodo `infirmary` + `infirmaryResolver` (cura+resurrezione piena) + registrazione. Test.
3. Generatore mappa: floor-Infermeria garantito pre-boss. Test.
4. Swap morto→vivo al recluta (verifica logica + UI selezione morto). Test.
5. Rialzare `finalBossMenace` a +0.30..+0.40, tarare col `campaignBalanceB` aggiornato in banda. Test.
6. Full suite + tsc. Aggiornare `remaining-work.md`.
