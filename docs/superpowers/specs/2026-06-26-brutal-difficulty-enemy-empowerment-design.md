# Design — Difficoltà brutale via potenziamento nemici

Data: 2026-06-26
Stato: approvato in brainstorming, in attesa di review utente

## Obiettivo

Rendere la campagna **brutale** (stile roguelike ad alta ascensione): clear rate
*reale* (giocatore che raccoglie reliquie) ~10-15%, boss spietato, errori puniti.
Curva **"a frusta"**: stage 1 resta gentile (onboarding, ~70%+ vinto), poi salita
ripida fino a un boss spietato.

La difficoltà NON viene dal nerf del giocatore: le sue reliquie restano forti. La
difficoltà viene dal **potenziamento dei nemici** — che oggi sono strutturalmente
deboli rispetto al giocatore.

## Diagnosi (perché oggi è facile)

Il test `campaignBalance` misura ~2.3% clear, ma modella un giocatore **senza
reliquie** (cammina sul grafo, non visita mai i nodi reliquia). Nel gioco vero:
- Il giocatore raccoglie reliquie (`offerCount: 3`, fino a +12% a tutte le stat);
  i nemici ne hanno **zero** (`simulate.ts:45` — relics solo a sinistra).
- `relicBalance` mostra che 3 reliquie comuni portano uno scontro pari dal ~75%
  al **99.5%**.
- Vantaggi minori del lato giocatore: vince i pareggi di HP (`simulate.ts:265`
  usa `>=`), pesca il migliore di 5 candidati mentre i nemici sono procedurali.

Conclusione: l'asimmetria delle reliquie è la causa principale. La leva scelta è
**dare potere ai nemici**, non togliere al giocatore.

## Scope — quattro interventi + ricalibrazione misurata

### 1. De-asimmetrizzare il sistema reliquie (engine)

Oggi `simulateBattle` applica reliquie solo a `left` e i trigger gateano su
`ctx.side === 'left'`. Generalizzare in modo che le reliquie possano appartenere
a **entrambi** i lati:
- `simulateBattle(left, right, rng, opts)` accetta anche `opts.rightRelics`.
- `applyRelicBonuses` / `registerRelicTriggers` / `totalRelicRegen` operano sul
  lato proprietario (parametrizzare per `side`/team invece di assumere `left`).
- I trigger reattivi delle reliquie nemiche devono valere per le unità di destra,
  esattamente come quelli del giocatore per sinistra.

Vincolo di compatibilità: con `rightRelics` vuoto (default), lo stream rng e i
log devono restare **identici a oggi** per non rompere battaglie esistenti
(guardare i punti dove un hook a zero listener non deve pescare rng).

### 2. "Minaccia" — buff astratto scalato (TUTTI i nemici)

Ogni squadra nemica riceve un potenziamento percentuale a tutte le stat, applicato
in `toBattleUnits` per il lato destro (dopo sinergie, come ulteriore moltiplicatore):

```
menacePct(stage, nodeType) = menaceBase + menacePerStage * stage
                             (× menaceEliteMult se elite, × menaceBossMult se boss)
```

Nuove costanti in `BALANCE.campaign` (valori iniziali da calibrare):
`menaceBase`, `menacePerStage`, `menaceEliteMult`, `menaceBossMult`.

Curva "a frusta": `menaceBase` basso (stage 1 quasi neutro → primo scontro ~70%+),
`menacePerStage` ripido così gli stage tardivi mordono.

### 3. Reliquie vere su elite e boss

I nodi elite e boss assegnano N reliquie reali dal pool alla squadra nemica:
- elite: ~1 reliquia; boss: ~2-3 (costanti `enemyRelicsElite`, `enemyRelicsBoss`).
- Selezione deterministica per seed dal pool reliquie (riusare la logica di
  rarità esistente; nessuna reliquia duplicata sulla stessa squadra).
- Passate a `simulateBattle` come `rightRelics` (abilitato dall'intervento 1).

### 4. Nemici più forti in generale (ritaratura knob esistenti)

Ritoccare, guidati dalla misura (intervento 5), i knob già presenti in
`data/constants.ts`:
- `campaign.budgetStep` (scaling per stage) — su.
- `campaign.difficultySpan` — giù (boss/late pescano da percentile più alto).
- `map.eliteFloors` / `map.eliteBudgetMult` — più elite e/o più forti.
- Boss (`data/bosses.ts`): budget / `hpMult` / sinergia esclusiva — su.

Tutti i valori finali sono **risultato della calibrazione**, non numeri magici
scelti a priori.

### 5. Test che modella le reliquie (la chiave per tarare)

Aggiornare `tests/engine/campaignBalance.test.ts` perché misuri il clear rate
**reale**:
- Il giocatore greedy **raccoglie le reliquie** lungo il run (visita i nodi
  reliquia e prende la migliore offerta secondo una euristica semplice, es. la
  reliquia di rarità più alta / maggior bonus aggregato).
- I nemici ricevono buff minaccia + reliquie elite/boss (automatico dagli
  interventi 1-3).
- Le asserzioni diventano una **banda brutale**:
  - `clearRate` in ~[0.08, 0.18] (target 10-15%, margine per la varianza n).
  - `firstStageWinRate > 0.65` (inizio ancora gentile — curva a frusta).
  - `bossWinRate` basso (boss spietato; es. `< 0.30`, `> 0` per restare vincibile).
  - `cappedRate < 0.05` (niente stalli).

Procedura di calibrazione (in implementazione): impostare la struttura, poi
iterare sui knob (interventi 2-4) eseguendo il test finché la banda è centrata.

## Architettura / file toccati

- `game/engine/combat/simulate.ts` — `rightRelics`, applicazione bilaterale,
  menace buff sul lato destro in `toBattleUnits`.
- `game/engine/relics.ts` — funzioni reliquie parametrizzate per lato.
- `game/engine/combat/teamGen.ts` o `game/engine/run.ts` — assegnazione reliquie
  nemiche su elite/boss; passaggio menace/nodeType alla battaglia.
- `data/constants.ts` — nuove costanti `campaign.menace*`, `enemyRelics*`; ritocchi.
- `data/bosses.ts` — boss più cattivo.
- `tests/engine/campaignBalance.test.ts` — modella reliquie su entrambi i lati,
  banda brutale.
- `tests/engine/relicBalance.test.ts` — invariato nel suo intento, ma verificare
  che la de-asimmetrizzazione (rightRelics vuoto di default) non lo smuova.

## Test

- **Nuovi/aggiornati**:
  - `campaignBalance` con reliquie su entrambi i lati → banda brutale (sopra).
  - Engine reliquie bilaterale: una reliquia assegnata a destra applica il suo
    bonus/trigger alle unità di destra e NON a sinistra (test mirato).
  - Compatibilità: `simulateBattle` con `rightRelics` non passato produce lo
    stesso risultato di prima per un seed campione (no regressione rng/log).
  - Menace buff: una squadra nemica a stage alto ha stat effettive maggiori della
    stessa a stage basso; elite/boss > normale.
- **Da rigenerare**: fixture seed-dipendenti che cambiano per via dei nemici più
  forti (refresh dei valori attesi, come da prassi; non allentare le asserzioni
  per nascondere problemi).

## Rischi

- **Calibrazione**: centrare 10-15% reale richiede iterazione; il rischio è
  sovra/sotto-correggere. Mitigazione: il test misura il reale, si itera sui knob.
- **Engine reliquie bilaterale**: la parte più delicata (parità rng/log col
  passato quando il lato destro non ha reliquie). Mitigazione: test di
  compatibilità byte-per-byte su un seed campione prima di procedere.
- **Boss spietato ma vincibile**: se il boss diventa impossibile (`bossWinRate`
  ~0) la run frustra invece di sfidare; la banda asserisce `> 0`.

## Non in scope

- Nerf al giocatore (reliquie, win-tie, margini di combattimento) — esplicitamente
  escluso: la difficoltà viene dai nemici.
- Nuove reliquie o nuovi effetti di combattimento.
- Rifacimento del sistema di draft o della generazione mappa.
