# Design — Boss finale forte (raise finalBossMenace)

> Data: 2026-07-01 · Slice: backlog item #1 seguito (final-boss climax, sbloccato dal pass snowball)
> Stato: DESIGN — in attesa review utente prima del piano.
> Baseline: master `6a3df8d`, suite 860/860 verde, tsc pulito.

## Problema

Il boss finale (Voldemort) ha statMult **0.616** (`BALANCE.campaignB.finalBossMenace = -0.384`),
sotto la parità coi boss d'area (**1.08**, abbassata dal pass snowball 2026-07-01 che ha eased
`menaceOffset -0.75→-1.00`, portando `menaceForLevel(levelMax=10)` da 0.33 a 0.08). Il climax manca:
lo scontro finale è più debole di un boss d'area intermedio.

Il pass snowball ha liberato **~0.05 di headroom** su `campaignBalanceB` (winRate 0.1583→0.2000),
esplicitamente earmarked per questo raise. La nota storica "la parità collassa il completamento a
~2.5%" è **pre-snowball** — misurata con la vecchia curva ripida e i vecchi nemici; va ri-misurata,
è probabilmente obsoleta.

## Obiettivo

Alzare `finalBossMenace` al **massimo valore che mantiene `campaignBalanceB` strettamente > 0.15**,
sfruttando l'headroom liberato per il boss finale più forte possibile senza rompere la campagna.
Solo numeri (nessuno scripting). Blocca su tutti i 5 gate + gestione coerente del tripwire.

## Fatto architetturale chiave (verificato)

`finalBossMenace` è una menace **dedicata** al boss finale, separata da `menaceForLevel`:
in `game/engine/resolvers/combat.ts` il `rightMenace` usa `cb.finalBossMenace` SE `isFinalBoss`,
altrimenti `menaceForLevel(pkg.enemyLevel)`. ⟹ alzare `finalBossMenace` tocca **solo** lo scontro
finale, non gli altri nemici. Leva pulita, singola. (Contrasto col pass snowball, dove `menaceOffset`
toccava tutti i nemici.)

## Sezione 1 — Misura & applica (measure-driven)

Leva unica: `BALANCE.campaignB.finalBossMenace` (−0.384 → verso 0.08 = parità statMult 1.08).

Processo:
1. Alzo `finalBossMenace` a piccoli passi (~+0.05-0.08 di menace per step), ri-misurando
   `campaignBalanceB` (`-t "winnable"`, 120 seed) ad ogni passo.
2. Trovo il **valore massimo** con winRate ancora strettamente > 0.15 (e < 0.45 — non è un rischio
   qui, alzare il boss abbassa il winRate).
3. Riporto la progressione (menace → winRate) e il valore finale + headroom residuo.

Nota rumore: winRate si muove a passi di ~1/120 ≈ 0.008 — passi piccoli, ri-misurare.

## Sezione 2 — Tripwire & gate (blocca su tutti)

`tests/engine/finalBossClimax.test.ts` ha 2 assert:
- (a) `finalStatMult > oldPushoverStatMult (0.60)` — resta verde (stiamo alzando, non abbassando).
- (b) `finalStatMult < areaBossStatMult` (= 1.08) — "ancora sotto la parità". Se il raise raggiunge
  la parità piena (finalBossMenace = 0.08, statMult 1.08), questo **scatta per design**. Il commento
  del test lo prevede esplicitamente: "when a future player-power pass closes it, this test will flip
  and signal that the deferred goal is reached". In quel caso: aggiorno l'assert (b) da `<` a `>=`
  (o `toBeCloseTo` alla parità), aggiorno il commento header + i docs (`remaining-work.md`) per
  segnare il climax raggiunto. Se invece il max che tiene il floor resta SOTTO 1.08, l'assert (b)
  resta `<` invariato e si annota quanto vicino si è arrivati.

Gli altri gate:
- I 4 sweep archetipo (`veleno/esecuzione/scudiRigen/magieOscure`): alzare solo il boss finale
  colpisce solo l'ultimo fight di ogni run, impatto atteso piccolo, ma li ri-verifico tutti sopra
  floor. Se uno scivola sotto floor, ricalibro (documentato) prima di dichiarare fatto.
- `campaignBalanceB` deve restare in (0.15, 0.45).

## Sezione 3 — Fuori scope (YAGNI)

- **Boss scriptato** (meccanica counter-archetipo: banna keyword / drena / fasi HP — pillar P4):
  slice separato futuro, costruito sopra questo.
- **Forbice-case** (Serpeverde 0.725 vs Grifondoro): slice separato.
- Nessun altro nemico o costante toccato (`menaceOffset`, `growthBudgetPerLevel`, i level-base
  restano come dopo il pass snowball).

## Criteri di completamento

1. `finalBossMenace` alzato al valore massimo che tiene `campaignBalanceB` > 0.15 (valore misurato,
   non aspirazionale).
2. Tutti e 5 i gate in banda — o, se il tripwire (b) scatta per parità raggiunta, assert + docs
   aggiornati coerentemente.
3. Progressione menace→winRate registrata; valore finale + headroom residuo annotato in
   `finalBossClimax.test.ts` + `remaining-work.md`.
4. tsc pulito. Suite verde.
