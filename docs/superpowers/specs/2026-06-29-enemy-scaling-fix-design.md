# Slice 1 — Enemy scaling fix (difficoltà + livello→stat) · design

> Data: 2026-06-29. Risolve due richieste utente: #2 (le stat nemiche sembrano di livello 1 nonostante
> il livello mostrato sia alto) e #5 (gioco troppo facile). Primo di 5 slice sequenziali (vedi ledger).
> È un task di BILANCIAMENTO data-driven, non un archetipo.

## Diagnosi (investigata + verificata con sweep)

I nemici combattono a una **frazione delle loro stat base**. La formula
`menaceForLevel(level) = (level-1) * menacePerLevel + menaceOffset` con `menaceOffset = -1.05`
(`data/constants.ts` blocco `campaignB`) produce moltiplicatori `1 + menace` deeply negativi:

| Combattimento | Livello mostrato | statMult attuale | statMult con fix |
|---|---|---|---|
| area-0 normale | 2 | **0.070** (7%!) | 0.420 |
| area-0 elite | 4 | 0.310 | 0.660 |
| area-0 boss | 6 | 0.550 | 0.900 |
| area-1 boss | 8 | 0.790 | 1.140 |
| area-2 boss | 10 | 1.030 | **1.380** |

Il livello È collegato alle stat (via menace), quindi il #2 non è "livello decorativo" — è che il
moltiplicatore è tarato così basso che un nemico "Lv.2" combatte al 7%. Il giocatore invece riceve
`leveledStats` (+~10%/livello). Rapporto giocatore/nemico: da **14×** (apertura) a 1.75× (boss finale).
Questa è la causa di ENTRAMBI #2 e #5, e ha falsato ogni sweep di balance (misurati contro nemici rotti).

## Fix (data-driven, dallo sweep)

Target utente: **"molto più difficile"** → un giocatore competente vince ~25-35% delle run. Lo sweep
(N=120, harness Grifondoro near-optimal di `campaignBalanceB`) su `menaceOffset × menacePerLevel` ha
dato due sole celle in banda; la scelta:

**`campaignB.menaceOffset`: -1.05 → -0.70** (`menacePerLevel` resta 0.12).

- Grifondoro competente: 0.308 → **0.250** (fondo della banda "aggressive harder").
- Tutti gli statMult diventano sensati (tabella sopra): apertura 6× più dura, boss finale-area a 1.38.
- maxTurns 41 < turnCap 100 — nessuno stallo.
- I 3 archetype-sweep (veleno/esecuzione/magieOscure) + scudiRigen restano ben sopra il loro floor 0.05.

### Aggiustamento accoppiato (scoperto dallo sweep): `finalBossMenace`
A `-0.70` di offset, la curva mette un nemico Lv10 a statMult **1.38**, ma il boss finale scriptato
(Voldemort, `BOSSES[0]`) usa il flat `finalBossMenace = -0.35` → statMult **0.65**, cioè PIÙ DEBOLE del
boss area-2. Incoerente: il climax sarebbe più facile dei boss che lo precedono.

**`campaignB.finalBossMenace`: -0.35 → +0.30** — allinea il boss finale alla curva Lv10 (statMult ~1.30),
così resta il muro più duro della run. (Valore da confermare: il piano lo tara così che il boss finale
sia ≥ del boss area-2 ma la run resti vincibile; range atteso +0.25..+0.40.)

## Validazione

### A. `campaignBalanceB` ricalibrato alla nuova banda — `tests/engine/campaignBalanceB.test.ts`
Oggi asserisce Grifondoro in `[0.15, 0.55]` (calibrato a 0.275 contro nemici rotti). Dopo il fix il
giocatore competente è a ~0.25. Il test va **ricalibrato**: la banda diventa quella della nuova
difficoltà voluta. Decisione: stringere la banda a `[0.15, 0.45]` (target "molto difficile" centrato
~0.25-0.30) e aggiornare i commenti di calibrazione con i nuovi numeri. NON allargarla per farla passare
a caso — il punto è che 0.25 è il target scelto.

### B. Gli archetype-sweep restano > 0.05 — commenti aggiornati
veleno/esecuzione/magieOscure/scudiRigen: le asserzioni `> 0.05` reggono (scendono ma restano alte).
Aggiornare SOLO i commenti diagnostici coi nuovi numeri osservati (post-scaling).

### C. Il diagnostico Serpeverde rimisura — `tests/engine/serpeverdeBalance.test.ts`
Dopo il fix, Serpeverde scende 0.792 → ~0.717 (e il bump `finalBossMenace` lo colpisce ancora, perché
Voldemort è chiave). Resta sopra banda → lo Slice 2 lo affronterà. In questo slice: aggiornare il numero
nel commento del diagnostico; la band-assertion resta DISABILITATA (riattivata nello Slice 2).

### D. Nessuno stallo + suite verde
`maxTurns < turnCap` (già nei test esistenti). Full suite verde + tsc.

## Rischi noti & leve

- **Troppo difficile** (Grifondoro < 0.15 dopo il fix): alzare `menaceOffset` verso -0.85/-0.90 e
  ritarare campaignBalanceB. La leva è un solo numero (+ il boss flat).
- **finalBossMenace mal tarato**: se +0.30 rende il boss finale impossibile (run win-rate crolla
  rispetto al solo offset), abbassarlo verso +0.20. Va tarato che il boss finale sia il punto più duro
  ma non un muro invalicabile.
- **Un test seed-pinned di battaglia esatta** potrebbe spostarsi (un nemico ora colpisce molto più
  forte). Atteso: aggiornarne l'expectation (è una conseguenza del balance), MAI un test che indica un
  bug logico reale.
- **NON toccare** `leveledStats`/crescita giocatore, gli stat dei maghi, le synergie — questo slice è
  SOLO le costanti di menace nemico. Il rebalance casa è lo Slice 2.

## Non in scope (YAGNI)

- Rebalance Serpeverde / Voldemort (Slice 2).
- Generazione casuale dei nemici / telegrafo albero (Slice 4).
- Toccare la curva di leveling del giocatore o gli stat dei maghi.
- Aggiungere un clamp a `menaceForLevel` (non serve: il livello è già clampato a monte).

## Ordine di implementazione (per il plan)

1. Cambiare `campaignB.menaceOffset` -1.05 → -0.70 in `data/constants.ts` + aggiornare il commento di
   calibrazione coi nuovi statMult/winRate.
2. Tarare + cambiare `campaignB.finalBossMenace` -0.35 → ~+0.30 così il boss finale ≥ boss area-2 ma la
   run resti vincibile (verifica via un micro-sweep o il campaignBalanceB ricalibrato).
3. Ricalibrare `campaignBalanceB.test.ts`: banda `[0.15, 0.45]`, commenti coi nuovi numeri.
4. Aggiornare i commenti diagnostici dei 4 archetype-sweep + del serpeverdeBalance coi nuovi winRate.
5. Full suite verde + tsc. Gestire eventuali test seed-pinned che si spostano (aggiornare expectation,
   noted). Aggiornare `remaining-work.md`.
