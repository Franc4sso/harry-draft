# Rimozione dei bonus sinergia — solo Duo + Trio

Data: 2026-07-20
Tipo: rimozione di meccanica motore + ri-bilanciamento

## Visione

Le sinergie (Golden Trio, Mangiamorte, ecc.) non devono più esistere come sistema di
potenza. L'unico sistema di team-building è **Combo Duo**, amplificato dai **Trio di
casata** (già esistenti in `game/engine/trios.ts`, fase 2 del 2026-07-14: ≥1 Duo attivo +
3 maghi stessa casa → boost). La UI delle sinergie è già stata rimossa (2026-07-20,
commit 32d05f3); questo spec rimuove il **motore** dietro.

Chiarimenti dell'utente:
- "Voglio SOLO le Combo Duo, aumentate come già sta dai bonus di casata (quanti
  Grifondoro/Tassorosso presenti)" → i **Trio** sono quel sistema, restano intatti.
- "Le restanti sinergie, quindi Trio [Golden Trio] etc, TOGLI TUTTO."
- "Tossicità non è una sinergia, è uno stile di attacco" → si sgancia dal sistema
  sinergie e diventa una meccanica veleno autonoma.

## Cosa si rimuove

Il **sistema di bonus di squadra da sinergia**: `applyBonuses`, `totalRegen`, e i bonus
stat di tutte le 9 sinergie di gruppo/origine (Golden Trio +15%, Weasley +8regen/+10def,
Ordine +10%, Mangiamorte +25atk, Malandrini +18spd/+10atk, Esercito +8%/+8def, Spietatezza
+5atk, Bastione +8def, Oscurità +5atk).

Questi bonus si applicavano a **player E nemici** (`resolvers/combat.ts:76,88`
`detectSynergies(enemy)`), quindi la rimozione tocca entrambi i lati.

## Cosa si TIENE (spostato fuori dal concetto "sinergia")

1. **Tossicità → meccanica veleno autonoma.** Oggi è una sinergia origin con:
   - trigger on-hit veleno (`synergyTriggers.ts`, `TOSSICITA_HIT_CHANCE = 0.35`),
   - `keywordMult: { veleno: 0.5 }` (amplifica il danno veleno del 50%).
   Va preservata come "stile d'attacco veleno" — il gate d'attivazione (3 maghi tag
   `veleno`) resta, ma smette di essere modellata come `Synergy` nel sistema bonus. NON
   deve passare per `applyBonuses` (già non lo fa: il suo bonus è solo keywordMult/trigger).

2. **Boss `exclusiveSynergy` ("L'Oscuro Signore" = +20% allPct, `data/bosses.ts:63`).**
   È potenza-boss, non una sinergia di squadra. Va preservata: Voldemort resta forte
   com'è ora. Il +20% continua ad applicarsi al team boss via il canale bonus.

3. **Duo + Trio di casata** — intatti. Verificato che NON leggono le sinergie:
   - `duos.ts` conta i tag dei maghi (`wizard.tags`), non `activeSynergies`.
   - `trios.ts` conta casa + Duo attivi, non le sinergie.

## Strategia di implementazione

Il vincolo delicato: `detectSynergies`/`activeSynergies` è cablato in molti resolver e nel
combat (`applyBonuses` a `simulate.ts:41`, `totalRegen` a :95-96, `registerSynergyTriggers`
a :143-144, `keywordDamageMult` a :148-149, più il boss `exclusiveSynergy`). Toccare tutto
è rischioso. Approccio a **minima superficie**:

- **`data/synergies.ts`**: azzerare i `bonus` delle 9 sinergie di gruppo/origine (tranne
  il `keywordMult` di Tossicità che resta). `applyBonuses` continua a girare ma somma zero;
  `totalRegen` somma zero. Questo neutralizza i bonus stat SENZA toccare i 20+ call-site.
  - Alternativa più pulita (da valutare in fase di piano): rimuovere del tutto le 9
    sinergie non-Tossicità da `SYNERGIES`, lasciando solo `tossicita`. Ma questo cambia
    `detectSynergies`/i test di conteggio; la strada "bonus vuoto" è meno invasiva. Il
    piano sceglierà in base a quanto codice/test dipende dalla presenza dei 9 id.
- **Boss `exclusiveSynergy`**: NON toccare `data/bosses.ts`. Il +20% viaggia già su un
  oggetto `Synergy` sintetico creato in `battlePackage.ts`, indipendente da `SYNERGIES`.
  Resta funzionante.
- **Tossicità**: resta in `SYNERGIES` con solo `keywordMult: { veleno: 0.5 }`. Il trigger
  in `synergyTriggers.ts` resta invariato.

## Ri-bilanciamento (obbligatorio)

**Misura A/B già fatta** (2026-07-20, patch temporanea + campaignBalanceRestricted):
- baseline (sinergie attive): winRate **0.0583**
- bonus 9 sinergie azzerati (Tossicità tenuta): winRate **0.0083**

Il gate asserisce `winRate > 0`, quindi 0.0083 passerebbe — ma è troppo duro (~1 vittoria
su 120 per il near-optimal). Target sano storico: **0.05–0.13**.

**Leva scelta (per direttiva utente + nota `trios.ts`): pressione nemica, NON reintrodurre
poteri.** In ordine di preferenza (da `data/constants.ts`, dominante prima):
1. `normalEnemyCount` (oggi 3) — ogni fight normale; leva dominante. Abbassare 3→2 o 3→1.
2. `enemyCountByArea` (oggi `[3,4,5]`) — elite/boss non-scriptati per area.
3. `statMult` / boss `unitCount` — solo se le prime due non bastano.

**Pin da rispettare** (memoria progetto): STARTER_PICKS=3, elites≥2, Voldemort unitCount=3,
mai reintrodurre `menace`. NON toccare `BALANCE.draft.screenSize` né
`categoryWeights`.

Il piano DEVE: rimuovere i bonus → misurare campaignBalanceRestricted → abbassare la
pressione un passo alla volta ri-misurando finché winRate rientra in [0.05, 0.13] con
margine dal floor `> 0`. Ogni step di leva è documentato con il numero misurato (come i log
esistenti in constants.ts). Misurare SEMPRE con `--disable-console-intercept` (i winRate
sono altrimenti illeggibili).

## Cosa NON si rompe (da verificare nel piano)
- Duo: i test `duoStress`/`duoEffects` restano verdi (non dipendono dai bonus sinergia).
- Trio: `trios.test` resta verde.
- Veleno: la sweep veleno cambia (Tossicità tenuta ma niente più bonus atk da altre
  sinergie che gonfiavano i team) — rimisurare, ri-tarare se sotto floor.
- Boss finale: `exclusiveSynergy` +20% preservata → balance boss invariato dal lato bonus.
- `campaignBalanceB` è reference-only (0.0000 da "UN MAGO UNA MAGIA"), NON è il gate.

## Note di implementazione (post-esecuzione, 2026-07-21)

- **`applyBonuses` NON rimossa** (correzione al piano): è l'unica funzione che applica il
  +20% del boss (`exclusiveSynergy` → `battlePackage.ts` → `rightSyn` → `simulate.ts:41`).
  Il piano assumeva erroneamente il boss "indipendente da SYNERGIES". Tenuta e documentata
  come boss-only; `SYNERGIES` non contribuisce più bonus stat (Tossicità è keywordMult-only),
  quindi è no-op per i team normali. `synergyThreshold` tenuta (consumer vivo `themes.ts`).
- **Ri-taratura BLOCCATA e accettata**: le leve enemy-count sono sature. L'invariante pinnato
  "elite packs field an active synergy" (`teamGen.test.ts`), con la sola Tossicità (count:3)
  rimasta, impone di fatto `elites>=3` → strozza `enemyCountByArea`. Nessuna combinazione
  dentro i pin riporta il winRate in [0.05,0.13]: resta **0.0083**. **Decisione utente: accettare
  il gioco più duro** (il gate passa, assert `> 0`). Valori di pressione invariati; soglia
  `scudiRigenSweep shieldUptakeRate` ritirata `>0.05`→`>0` (pressione, non regressione kit).

## Criteri di successo
1. Nessun bonus stat di squadra da sinergia nel motore (player né nemici).
2. Tossicità funziona come stile veleno (trigger + keywordMult); Duo + Trio intatti.
3. Boss finale +20% preservato.
4. `campaignBalanceRestricted` winRate ri-tarato in [0.05, 0.13], comunque `> 0`.
5. `tsc --noEmit` exit 0, suite intera verde.
