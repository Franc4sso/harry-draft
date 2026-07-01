# Design — Pass #1: Appiattire lo snowball del leveling (player-power pass)

> Data: 2026-07-01 · Slice: backlog item #1 (`docs/superpowers/remaining-work.md`)
> Stato: DESIGN — in attesa review utente prima del piano.
> Baseline: master `bd75e89`, suite 857/857 verde, tsc pulito.

## Problema

`BALANCE.leveling.growthBudgetPerLevel = 0.40`. In `leveledStats`, ogni stat cresce
`1 + 0.40 * weight * (level-1)`, con `weight` per-mago normalizzato (somma 1, media 0.25).

- Profilo medio (weight 0.25) a lv10: `1 + 0.40*0.25*9 = 1.90×`.
- Carrier atk specializzato (weight ~0.5): `1 + 0.40*0.5*9 = 2.80×`.

Questo **snowball ~2.5×** fa sí che una squadra vincente one-shotti tutto: la spell-power
diventa irrilevante, e il *near-optimal player* modellato in `campaignBalanceB` diventa
cosí forte da tenere il gate incollato al floor **0.15** (winRate 0.1583, headroom 0.0083).
Ciò BLOCCA due obiettivi desiderati (backlog #1):
- boss finale forte (parità coi boss d'area richiede statMult ~1.33 → oggi crolla il completamento a ~2.5%);
- forbice tra case piú stretta (Serpeverde 0.658 vs Grifondoro 0.183, retta solo dal gate rilassato).

## Tesi

Appiattendo la curva (growthBudget piú basso) il gap tra stat specializzata e media si
stringe → meno one-shot → la spell-power torna rilevante → **e** il gap tra un giocatore
near-optimal e uno medio si riduce → **si apre headroom sopra 0.15**. Per tenere il floor
si riallenta l'enemy budget (`menaceOffset` / `menacePerLevel`).

## Fatto architetturale chiave (verificato)

Le curve player ed enemy sono **DECOUPLED**:
- Player: `battlePrep.battleReadyTeam` → `leveling.leveledStats` (usa `growthBudgetPerLevel`).
- Enemy: `combat/threat.menaceForLevel(level) = (level-1)*menacePerLevel + menaceOffset`,
  un `statMult` piatto derivato dal *livello d'area* (NON da `leveledStats`).

⟹ Abbassare `growthBudgetPerLevel` indebolisce **solo** i player; i nemici restano fermi.
La leva è pulita, senza auto-cancellazione lato nemico (concern iniziale scartato).

## Rischio primario (e come lo neutralizziamo)

`campaignBalanceB` misura **una sola policy** (`pickNode`, fight-greedy near-optimal).
Con una sola policy, "appiattire lo snowball" è **invisibile al gate**: abbasso la curva,
la policy diventa piú debole, riabbasso l'enemy budget per ritenere 0.15, e ho ri-centrato
tutto attorno allo stesso giocatore — headroom zero, numeri diversi, guadagno nullo.

Per rendere l'appiattimento **misurabile** serve un secondo punto di riferimento piú debole.
La diagnostica (Sez. 1) introduce una policy "media" e misura il **delta near-optimal↔medio**:
è QUEL delta che vogliamo stringere. Se la baseline mostra che il delta è già piccolo, la
tesi è falsa e cambiamo strategia (reward/baseline invece della curva) — lo scopriamo PRIMA
di toccare le leve, non dopo 4 ricalibrazioni.

---

## Sezione 1 — Diagnostica (nuova sweep)

Nuovo `tests/engine/levelingSnowball.test.ts`. Non asserisce band strette all'inizio —
CATTURA numeri e stampa (baseline prima, verifica dopo). Misura:

1. **Moltiplicatore atk a lv10**: medio (weight 0.25) vs carrier specializzato (weight max
   osservato nel roster reale). Quantifica lo snowball corrente (~2.5× atteso).
2. **Gap near-optimal↔medio**: `campaignBalanceB` esegue la policy fight-greedy; qui si
   aggiunge una **policy "media"** (meno ottimale: fight meno aggressivo / meno relic /
   qualche pick sub-ottimale) e si misura il delta di winRate su N seed.
3. **Turni-per-kill**: distribuzione dei turni del primo kill (proxy dell'one-shot: se
   quasi tutti i kill avvengono al turno 1, lo snowball domina).

Asserzioni iniziali: solo sanity (i numeri esistono, deterministici). Le band diagnostiche
si stringeranno DOPO la taratura, per guardia di regressione (Sez. 3).

## Sezione 2 — Leve e taratura (measure-driven, utente decide)

Leve, in ordine di preferenza:
1. `leveling.growthBudgetPerLevel` (0.40 → piú basso) — la leva primaria dell'appiattimento.
2. `campaignB.menaceOffset` / `campaignB.menacePerLevel` — riallenta l'enemy budget per
   tenere il floor 0.15 dopo l'appiattimento.

**Processo**: eseguo la sweep (Sez. 1) → riporto i numeri reali → **propongo valori concreti**
con l'effetto atteso su ciascun gate → **l'utente approva prima di applicare**. Nessun numero
inventato; nessun commit di leve senza ok esplicito.

Target qualitativo (da confermare coi numeri): snowball ~2.5× → ~1.8×; gap near-optimal↔medio
ridotto; headroom `campaignBalanceB` ≥ ~0.03 sopra 0.15 (oggi 0.0083).

## Sezione 3 — Guard su TUTTI i 5 gate (blocca se cade)

Il pass NON è completo finché ogni sweep resta dentro la sua band:
- `campaignBalanceB` [0.15, 0.45]
- `velenoSweep`, `esecuzioneSweep`, `scudiRigenSweep`, `magieOscureSweep` (ognuno sopra il suo floor)

Abbassare `growthBudgetPerLevel` tocca OGNI archetipo (tutti usano `leveledStats`). Se un
archetipo cade sotto il floor, si ricalibra (enemy budget, o — documentato — il floor stesso
dell'archetipo se il calo è coerente col nuovo bilanciamento) PRIMA di dichiarare fatto.
Nota rischio (memory): scudi-rigen è già marginale (0.100); da sorvegliare stretto.

## Sezione 4 — Boss finale: solo ANNOTARE l'headroom

Questo slice NON alza il boss finale alla parità. Se la taratura apre headroom sopra 0.15,
si **annota** in `finalBossClimax.test.ts` e nel backlog quanto margine è disponibile per un
futuro raise. La parità boss resta uno slice separato (evita di accoppiare due tarature fragili).
Il tripwire deferito (`finalBossClimax` "is still below area-boss parity") resta com'è: NON
deve scattare in questo slice.

---

## Fuori scope (YAGNI)

- Reward/baseline pass (reliquie migliori, spike pre-finale) — leva alternativa se la tesi
  cade; non in questo slice.
- Raise del boss finale alla parità — slice separato.
- Ri-taratura della forbice tra case — slice separato (beneficia dell'headroom liberato qui).

## Criteri di completamento

1. Sweep diagnostica esiste, deterministica, con baseline registrata.
2. `growthBudgetPerLevel` abbassato + enemy budget ricalibrato, valori **approvati dall'utente**.
3. Snowball misurato ridotto vs baseline (numero concreto, non aspirazionale).
4. Tutti e 5 i gate dentro band. tsc pulito. Suite verde.
5. Headroom `campaignBalanceB` annotato in `finalBossClimax`/backlog per lo slice boss.
