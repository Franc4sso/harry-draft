# Design — Joker espansi + reliquie ridisegnate

Data: 2026-07-06 · Autore: sessione Claude+utente · Stato: **approvato in bozza, in attesa review**

## Problema

I 3 "joker scaling" (Fame Vorace / Collezionista / Marchio Vorace) esistono e **si applicano
correttamente in combattimento** (catena verificata: `simulate.ts:285/331` conta i kill →
`combat.ts:114` incrementa il counter → `applyRelicBonuses`/`scalingStatBonus` legge il bonus a
inizio battaglia). Il "non li vedo mai" è **probabilità di offerta**, non un bug:

- Il pool player è ristretto agli `STARTER_RELICS` (`useRunB.ts:128`).
- In quel pool le uniche 3 epiche sono i joker; peso `epica` = 6 su 486 totali.
- P(almeno un joker su un nodo reliquia da 3 slot) ≈ **10.7%** → praticamente mai.

L'utente vuole: (1) **tanti joker nuovi** (~12–15) con forme più strane, (2) **reliquie
ridisegnate** più interessanti (a potenza costante per non muovere il balance), (3) i joker
devono **comparire spesso** nelle run.

## Obiettivi

1. **Vocabolario joker esteso** — nuove forme: trigger di scaling oltre `kill`, effetti
   condizionali "when X then Y", joker con drawback (rischio/ricompensa).
2. **~12–15 joker nuovi** data-driven in `data/relics.ts`.
3. **Reliquie base ridisegnate** più interessanti **a power-budget costante** + qualche
   reliquia nuova "strana".
4. **Canale di offerta**: il nodo reliquia diventa "reliquia **O** joker" — con una probabilità
   offre 3 joker invece di 3 reliquie. Alta visibilità, nessun nodo nuovo.

## Non-obiettivi (YAGNI)

- Nessun tipo `Joker` separato: i joker restano `Relic` (così draft/negozio/eventi/save/UI
  funzionano gratis).
- Nessun nuovo tipo di nodo sulla mappa.
- Nessun mini-interprete/DSL di effetti (over-engineering per 12–15 joker).
- Nessuna nuova statistica "esotica" oltre a quelle già nel motore (hp/atk/def/spd + velenoMult).

## Vincoli di progetto (dalle regole + memory)

- **Copy in italiano.**
- **Il bot di bilanciamento NON pesca i joker** → i joker sono balance-safe per costruzione;
  non muovono `campaignBalanceB`/`Restricted`.
- **Le reliquie base SÌ influenzano l'harness** → ridisegno a **power budget costante** e
  **ri-misuro `campaignBalanceB` + `campaignBalanceRestricted`** dopo (memory: re-measure su
  QUALSIASI cambio di potenza).
- MAX 5 nemici, mai fuoco amico, niente camera shake: non toccati da questo lavoro.
- `npm run test` NON fa typecheck → `npm run typecheck` a parte.

---

## Sezione 1 — Modello del motore (tipi)

Un solo tipo (`Relic`). Estensioni in `types/relic.ts`:

```ts
export interface RelicScaling {
  // esteso: 'kill' esistente + 3 nuovi trigger
  trigger: 'kill' | 'battleWin' | 'turn' | 'allyDead'
  // esteso: aggiunge 'defense' | 'speed' agli esistenti
  stat: 'attack' | 'maxHp' | 'velenoMult' | 'defense' | 'speed'
  per: number
  cap: number
}

// NUOVO — gate STATICO (team fisso durante la battaglia), valutato a applyRelicBonuses-time.
export interface RelicConditional {
  when: { kind: 'teamSizeBelow'; value: number }   // squadra viva < value
  then: SynergyBonus                                // riusa bonus esistente
}

export interface Relic {
  // ...campi esistenti invariati...
  conditional?: RelicConditional   // NUOVO
  drawback?: SynergyBonus          // NUOVO: malus sempre attivo (valori negativi)
}
```

**RelicTrigger** guadagna un solo campo opzionale:

```ts
export interface RelicTrigger {
  // ...esistenti...
  onlyTurn?: number   // NUOVO: il trigger reattivo fira solo quando ctx.turn === onlyTurn
}
```

### Perché queste forme, e dove vivono (verificato sul codice)

Il motore ha **tre mondi separati**; ogni forma va nel suo:

| Forma joker | Mondo | Dove |
|---|---|---|
| scaling `kill` / `battleWin` | contatore run (fine battaglia) | `combat.ts` resolver |
| scaling `turn` / `allyDead` | contatore run (fine battaglia) | serve nuovo campo su `BattleResult` |
| condizionale `teamSizeBelow` | **statico** (team non cambia in battaglia) | `applyRelicBonuses` |
| `hpBelow` / `alone` / `firstTurn` | **reattivo** (durante la battaglia) | `triggers` sul bus **già esistente** |
| drawback | statico | `applyRelicBonuses` |

Nota critica verificata: **`onTurnStart` fira per-attore, non per-turno** (`simulate.ts:210`,
`fireReactive('onTurnStart', actor, turn)`). Quindi lo scaling `turn` **non** può appoggiarsi al
bus (conterebbe 1× per mago che agisce = ~3× troppo). Legge `result.turns` a fine battaglia.

`hpBelow` → `onHpThreshold` (già interpretato, fira una volta per attraversamento in discesa
per unità, `simulate.ts:157`). `alone` → `onAllyDeath` (già firato, `simulate.ts:289/302/335`).
`firstTurn` → `onTurnStart` **+ `onlyTurn: 1`** (nuovo filtro, 1 riga in `registerRelicTriggers`).

---

## Sezione 2 — Flusso di applicazione in combattimento

**Contatori (fine battaglia).** `combat.ts:114` oggi:
`relics: applyRelicScaling(state.relics, out.result.kills.left)`.
`applyRelicScaling` diventa consapevole del *trigger di ogni joker* e usa il delta giusto:

- `kill` → `result.kills.left`
- `battleWin` → `winner === 'left' ? 1 : 0`
- `turn` → `result.turns`
- `allyDead` → `result.alliesLost` (**nuovo campo** su `BattleResult`)

Firma nuova: `applyRelicScaling(relics, deltas)` dove `deltas` è
`{ kill: number; battleWin: number; turn: number; allyDead: number }`. Ogni joker legge
`deltas[relic.scaling.trigger]`. Puro, come oggi. Run-cumulative (accumula tra battaglie), come i
kill oggi.

**`BattleResult.alliesLost`** (nuovo): conteggio delle unità **del lato `left` (player)** morte
nella battaglia. Contato in `simulate.ts` negli stessi punti dove oggi si firano gli hook di morte
(`simulate.ts:286/299/332`): quando un `realTarget`/`actor`/`u` di `side === 'left'` muore,
`alliesLost++`. `turns` già esiste (`BattleResult.turns`).

**Lettura bonus (inizio battaglia).** `applyRelicBonuses(stats, team, relics)` somma, in ordine:

1. bonus base (invariato)
2. `scalingStatBonus` per atk / maxHp / **def / spd** (nuovi due) — clampati a `cap`
3. `conditional.then` se `teamSizeBelow` è vero (team vivo < value) — statico
4. `drawback` (SynergyBonus con valori negativi) — sempre

`velenoMult` scaling resta letto a `keywordDamageMult` (`relics.ts:60`), invariato.

**Trigger reattivi (durante la battaglia).** `firstTurn`/`hpBelow`/`alone` passano dal bus
esistente via `registerRelicTriggers`. Unico ritocco: `if (trig.onlyTurn != null && ctx.turn
!== trig.onlyTurn) return []` nel listener reattivo. Il gate `side` esistente impedisce già
effetti sul team sbagliato / fuoco amico.

---

## Sezione 3 — Roster joker (~14) + reliquie ridisegnate

Tutti i joker sono `Relic` con rarità `epica` (restano fuori dal pool bot per costruzione — vedi
Sez.4). Numeri = **prime stime da playtestare**, non pin di balance.

### Joker — scaling (nuovi trigger/stat)

1. **Fame Vorace** (esiste) — +3 atk per kill, cap +60. `scaling{kill,attack,3,60}`
2. **Collezionista di Anime** (esiste) — +10 maxHp per kill, cap +200.
3. **Marchio Vorace** (esiste) — +4% veleno per kill, cap +100%.
4. **Marcia di Guerra** — +6 atk per **turno** trascorso, cap +90. `scaling{turn,attack,6,90}`
5. **Fortezza Vivente** — +5 def per **battaglia vinta**, cap +50. `scaling{battleWin,defense,5,50}`
6. **Vento Crescente** — +8 spd per battaglia vinta, cap +64. `scaling{battleWin,speed,8,64}`
7. **Eredità dei Caduti** — +18 atk per **alleato caduto** (in tutta la run), cap +90.
   `scaling{allyDead,attack,18,90}` (tema: la squadra rinforza chi resta).

### Joker — condizionali (when X then Y)

8. **Ultimo Baluardo** — se squadra viva < 2, +50% a tutte le stat.
   `conditional{teamSizeBelow:2, then:{allPct:0.5}}`
9. **Branco Ristretto** — se squadra viva < 3, +25 atk e +25 def.
   `conditional{teamSizeBelow:3, then:{atk:25,def:25}}`
10. **Furia Morente** — quando un mago scende sotto il 40% HP, +30% atk (self).
    `triggers[{onHpThreshold, threshold:0.4, modifier o effect buff}]`
11. **Canto del Cigno** — quando un alleato muore, la squadra viva guadagna +20 atk.
    `triggers[{onAllyDeath, effects:[buff atk team]}]`
12. **Assalto d'Apertura** — al **primo turno**, tutta la squadra +40 atk.
    `triggers[{onTurnStart, onlyTurn:1, effects:[buff atk team]}]`

### Joker — drawback (rischio/ricompensa)

13. **Patto Vorace** — +40 atk, ma −40% maxHp (glass cannon).
    `bonus{atk:40} + drawback{hp:-…}` — il drawback è una **frazione** di maxHp, quindi va
    espresso come `allPct`-negativo NON è corretto (colpirebbe tutto). Impl: drawback su maxHp
    va gestito come riduzione percentuale dedicata dell'HP a `applyRelicBonuses` (moltiplica
    `hp` per 0.6) — è l'unico drawback che tocca hp in %; se lo `SynergyBonus.hp` assoluto basta
    (es. `hp:-60`), usalo e evita la % per non aggiungere codice.
14. **Sete di Sangue** — +50 atk, ma −6 rigen (subisci logorio).
    `bonus{atk:50} + drawback{regen:-6}`

> Le forme "self vs team" dei trigger reattivi (10 vs 11) e i valori esatti dei drawback (13/14)
> si finalizzano in impl scegliendo tra `effects` (buff sull'unità che ha triggato) o buff
> team-wide, riusando gli `EffectSpec` esistenti. Nessun effetto nuovo richiesto.

### Reliquie ridisegnate (power-budget costante)

Le reliquie "piatte e noiose" diventano condizionali/interessanti **mantenendo circa lo stesso
power budget** (così l'harness non si muove; ri-misura obbligatoria comunque):

- **Giratempo** (+12 spd) → +8 spd, e +8 spd extra finché la squadra è a HP pieno
  (netto ~stesso budget a inizio battaglia).
- **Mappa del Malandrino** (+10 atk) → +6 atk, +12 atk contro nemici sotto il 50% HP
  (esecuzione-lite via `grantsExecute` esistente).
- **Ricordella** (+8 def +8 spd) → +8 def +8 spd, ma il primo colpo subìto è dimezzato
  (`onHpThreshold`/scudo a inizio battaglia via trigger esistente).

+ **2 reliquie nuove "strane"** (rara/epica, nel pool bot solo se balance-safe — default fuori):

- **Specchio delle Brame** — copia il bonus della reliquia più forte posseduta (impl: sceglie a
  init il max atk-equivalente). *Da valutare in impl: se troppo complessa, taglio (YAGNI).*
- **Clessidra Rotta** — +20 spd ma −10% maxHp (drawback, tema tempo).

> Il ridisegno reliquie base è **il pezzo balance-sensibile**. Se una forma non si esprime a
> budget costante in modo pulito, si **lascia invariata** la reliquia originale piuttosto che
> rischiare l'harness. Meglio poche reliquie ridisegnate e verdi che tante e rotte.

---

## Sezione 4 — Canale di offerta (nodo reliquia → reliquia O joker)

Oggi `relicOffer` (`recruit.ts:17`) → `offerRelics` pesca dal pool ristretto (che **include** i
joker, da cui la bassa probabilità). Cambio:

1. **Separare i pool.** `offerRelics` esclude i joker (`SCALING_RELIC_IDS` ∪ i nuovi joker id →
   una lista `JOKER_RELIC_IDS`). Nuovo `offerJokers(rng, owned)` pesca solo dai joker (uniforme
   o leggermente pesato, non per rarità-epica-6).
2. **Scelta nel resolver.** `relicOffer` fa un tiro rng-deterministico (stesso `fork`): con
   prob. `BALANCE.relics.jokerNodeChance` (es. **0.35**) il nodo offre 3 **joker**, altrimenti 3
   **reliquie base**. Deterministico per (seed, node id), come già oggi.
3. **UI.** `ShopScreen`/`ResultScreen` già rendono reliquie per id; i joker sono `Relic` → si
   renderizzano uguali. Nessuna UI nuova (eventuale badge "Joker" = nice-to-have, non blocca).

Il negozio (`shop.ts:28`, `offerRelics(r, [], 0)`) erediterà l'esclusione joker automaticamente
(pesca reliquie base). *Decisione:* i joker **non** compaiono in negozio per ora (restano premio
dei nodi) — evita il prezzo epica-120 e tiene il negozio "reliquie". Rivedibile.

---

## Sezione 5 — Testing

Ogni pezzo motore ha test in isolamento (memory: nuovi TS test → `npm run typecheck` a parte):

- `scalingStatBonus` per def/spd (clamp a cap).
- `applyRelicScaling` con `deltas` misti (kill/turn/battleWin/allyDead); ogni joker legge il suo.
- `BattleResult.alliesLost` contato correttamente (dir. hit, recoil self-kill NON conta come
  ally-loss se è nemico, dot); test dedicato in `simulate`.
- `applyRelicBonuses` con `conditional.teamSizeBelow` (vero/falso) e `drawback` (netti negativi).
- `registerRelicTriggers` con `onlyTurn:1` (fira turno 1, non turno 2).
- `offerJokers` / split pool: `offerRelics` non offre mai joker; `offerJokers` solo joker.
- `relicOffer` deterministico e la prob. joker-node rispettata (test statistico leggero).
- **Balance:** `campaignBalanceB` + `campaignBalanceRestricted` ri-misurati; devono restare
  sopra i floor documentati (memory). Se il ridisegno reliquie li muove, si torna a potenza
  costante o si ripristina la reliquia originale.
- Regressione: full suite (1152 test) verde + typecheck pulito.

## Rischi e mitigazioni

- **Reliquie base muovono l'harness** → power-budget costante; se dubbio, lascia invariata.
- **`alliesLost` mis-count** (recoil, dot, fuoco amico) → test dedicato coi tre percorsi di morte.
- **Scaling `turn` conta troppo** (bug per-attore) → usa `result.turns`, NON il bus (verificato).
- **Specchio delle Brame troppo complesso** → taglio esplicito se non pulito (YAGNI).

## Checklist file toccati (traccia impl)

- `types/relic.ts` — RelicScaling esteso, RelicConditional, `conditional`/`drawback`, `onlyTurn`.
- `types/combat.ts` — `BattleResult.alliesLost`.
- `game/engine/relics.ts` — `scalingStatBonus` def/spd; `applyRelicScaling(deltas)`;
  `applyRelicBonuses` conditional+drawback; `registerRelicTriggers` onlyTurn; `offerJokers` +
  split pool in `offerRelics`.
- `game/engine/combat/simulate.ts` — conta `alliesLost`, ritornalo nel result.
- `game/engine/resolvers/combat.ts` — passa `deltas` a `applyRelicScaling`.
- `game/engine/resolvers/recruit.ts` — `relicOffer` sceglie joker-node vs relic-node.
- `data/relics.ts` — ~11 joker nuovi + reliquie ridisegnate/nuove; `JOKER_RELIC_IDS`.
- `data/unlocks.ts` — nuovi joker id in `STARTER_RELICS` (o pool sblocco).
- `data/constants.ts` — `relics.jokerNodeChance`.
- Test: nuovi file per ogni pezzo + ri-misura balance.
