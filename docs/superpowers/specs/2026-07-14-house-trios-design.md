# Trio di casata (fase 2 di 2)

Data: 2026-07-14
Tipo: nuova meccanica (le casate acquistano valore dentro il sistema Duo)

## Visione

Chiude il lavoro iniziato dalla fase 1 (`2026-07-14-remove-house-role-synergies-design.md`).
La fase 1 ha spento i poteri di casata (dodge/crit/DR/cunning) e reso `houseEffects` inerte,
lasciando le casate temporaneamente solo estetiche. La fase 2 dà loro un ruolo **dentro i Duo**:

> Quando la squadra ha **almeno un Duo attivo** E **3+ maghi della stessa casa**, si accende il
> **Trio** di quella casa: un buff di combattimento, a tema casa, applicato a quei maghi. Il Duo è
> il **gate** che sblocca il Trio; la casa ne è il **sapore**. Costruire un Duo dà valore alla
> coerenza di casata, senza un sistema parallelo.

I Trio NON sono i vecchi poteri di casata col gate: 2 dei 4 buff sono ridisegnati apposta perché
il Trio sia genuinamente nuovo, non il fantasma delle case morte.

## I quattro Trio

Ogni Trio è una **fantasia di casa applicata ai Duo**, non un +stat generico. Tutti **player-only**
(come i Duo e gli effetti Duo — coerente con la regola "Duo/joker sono solo del player", che tiene
il bilanciamento sicuro; i nemici non ricevono mai Trio).

| Casa | Trio | Meccanica | Campo `BattleUnit` |
|------|------|-----------|--------------------|
| **Serpeverde** (ambizione) | **Opportunista** | Il primo colpo su un nemico a vita piena infligge +X% danno. Apri tu lo scambio. | `firstStrike?: { bonus }` — nuovo |
| **Corvonero** (ingegno) | **Analisi** | Ogni volta che colpisci un nemico, gli applichi 1 stack di Vulnerabilità (−def). Premia il focus-fire. | riusa lo status `expose1` già esistente via `applyStatus` — nessun campo nuovo, serve solo un flag `analysis?: true` per attivare l'hook on-hit |
| **Tassorosso** (lealtà) | **Tenacia** | Gli status che infliggi durano +1 turno (veleno/stun/rigen/debuff). Amplifica i Duo di controllo e DoT. | `statusDurationBonus?: number` — nuovo |
| **Grifondoro** (coraggio) | **Slancio** | Il cooldown delle tue spell è ridotto di 1 (min 1). Agisci più spesso → più proc di Duo. | `cooldownReduction?: number` — nuovo |

I 4 buff evitano di riciclare `cunning`/`critBonus` (i campi che la fase 1 ha spento): reliquie che
usano quei campi restano indipendenti dal Trio. Serpeverde e Corvonero sono ridisegnati (Opportunista
apre invece di rifinire; Analisi è controllo scalante invece di crit fortunato); Tassorosso e
Grifondoro sono meccaniche del tutto nuove.

### Tiering (recupera la progressione persa)

Il gate è booleano su ≥3 maghi. Per non perdere del tutto la vecchia scala 2/3/4, il Trio ha
**due gradi**: base a **3** maghi, potenziato a **4+**. Un solo scalino (non tre), facile da
spiegare: "3 stessa casa = Trio, 4 = Trio potenziato". Numeri per grado (valori iniziali,
soggetti a taratura — vedi Bilanciamento):

- Serpeverde Opportunista: +30% / +45% al primo colpo su bersaglio pieno.
- Corvonero Analisi: applica `expose1` (−15% def) a 3 maghi; a 4 applica `expose2` (−25% def).
  Riusa gli status graduati esistenti (`data/statuses.ts` expose1/2/3), zero nuovo status.
- Tassorosso Tenacia: +1 / +1 turno. Entrambi i gradi = +1 (nessun secondo effetto — YAGNI).
- Grifondoro Slancio: cooldown −1 / −1, min 1. Entrambi i gradi = −1.

Solo Serpeverde e Corvonero divergono tra i due gradi; Tassorosso e Grifondoro sono booleani
(3 = attivo, 4 = uguale) perché +1/−1 non ha un secondo scalino sensato. Se in taratura anche
Serpeverde/Corvonero non hanno bisogno di due gradi, si collassa a un livello unico e si documenta.

## Architettura

Nuovo file `game/engine/trios.ts`, parallelo a `duos.ts` / `houseEffects.ts`:

```ts
export interface TrioEffect {
  firstStrike?: { bonus: number }      // Serpeverde
  analysis?: { exposeId: 'expose1' | 'expose2' }  // Corvonero — quale expose applicare on-hit
  statusDurationBonus?: number         // Tassorosso
  cooldownReduction?: number           // Grifondoro
}

/** Player-only. Ritorna, per ogni mago, l'effetto Trio della sua casa SE:
 *  (a) la squadra ha ≥1 Duo attivo, e (b) ≥3 maghi (vivi) condividono quella casa.
 *  Mappa vuota se nessun Duo è attivo. */
export function trioEffects(team: DraftedWizard[], duos: ActiveDuo[]): Record<string, TrioEffect>
```

- **Gate**: `duos.length >= 1`. Un booleano. `duos` arriva già a `simulate` via `opts.leftDuos`
  (usato oggi a `simulate.ts:89` per `stampDuoFields`).
- **Membri per casa**: conta i maghi (vivi) per `wizard.house`; casa con ≥3 → grado 0 (3) o 1 (4+).
- **Stamping**: in `toBattleUnits` (`simulate.ts:40-61`), accanto a `houseMap` oggi, un
  `trioMap = trioEffects(team, leftDuos)`; i campi si spandono su `base` come già fa
  `...houseMap[dw.wizard.id]`. Solo lato player: `toBattleUnits` riceve il flag/duos solo per `left`.

### Campi nuovi su `BattleUnit` (types/combat.ts)

- `firstStrike?: { bonus: number }` — letto in `computeDamage`/`effects.ts`: se il bersaglio è a
  `hp === maxHp` e non ancora colpito da questo attore, +`bonus` frazione al danno. Serve un modo di
  sapere "primo colpo": bersaglio a vita piena è sufficiente e semplice (nessuno stato extra).
- `statusDurationBonus?: number` — letto dove l'attore infligge uno status a un nemico
  (`applyStatus`, `resolve.ts`): `remaining += actor.statusDurationBonus ?? 0`. Solo status
  OSTILI inflitti dall'attore Trio; non tocca gli status ricevuti.
- `cooldownReduction?: number` — letto in `resolveAction` (`resolve.ts:27`):
  `cooldowns[id] = Math.max(1, spell.cooldown - (actor.cooldownReduction ?? 0))`.
- `analysis?: { exposeId }` — flag: a ogni colpo dell'attore Trio Corvonero, `applyStatus(target,
  analysis.exposeId, { sourceId })`. Riusa gli status `expose1/2` esistenti; nessun nuovo status,
  solo il flag che attiva l'hook on-hit.

### Cosa si cancella

`game/engine/houseEffects.ts` è **codice morto**: non esistono più sinergie `kind:'house'`
(`grep -c "kind: 'house'" data/synergies.ts` = 0), quindi `houseEffects()` itera, non matcha nulla,
ritorna `{}`. È overhead a `simulate.ts:39`.

- Cancellare `game/engine/houseEffects.ts` e la sua chiamata/import in `simulate.ts`.
- Cancellare i suoi test morti (`houseEffects`/`houseEffectText`, `serpeverdeBalance` se ancora là,
  qualunque test di `houseEffectText`).
- I campi `dodgeBonus`/`critBonus`/`damageReduction`/`cunning` su `BattleUnit` **restano** (li usano
  reliquie e altri sistemi) — si toglie solo il produttore morto.

## Cosa NON si rompe (verificato)

- `stampDuoFields` continua a leggere `leftDuos` per gli effetti Duo — invariato; il Trio legge lo
  stesso `leftDuos` per il gate.
- I campi combat esistenti restano; i Trio usano campi NUOVI (tranne l'eventuale riuso di `expose`
  per Analisi), quindi nessuna collisione con reliquie.
- Enemy sims (enemy-vs-enemy, `toBattleUnits` per `right`) non ricevono `leftDuos` → `trioMap` vuota
  → nessun Trio sui nemici. Mantiene player-only.
- Replay: se il replay ricostruisce le battaglie via `simulate`, i Trio si applicano
  deterministicamente (nessun RNG in nessuno dei 4 buff). Verificare che i replay-score test non
  cambino silenziosamente — se cambiano, aggiornare i fixture (come fatto in fase 1: 1610→1875).

## Bilanciamento (il vero lavoro)

La fase 1 ha spento i poteri di casata e la winRate baseline di `campaignBalanceB` è salita a ~0.375
(banda documentata `[0.15, 0.45]`; l'assert live è `winRate > 0`). Il Trio **riaggiunge potenza al
solo player** → la winRate risalirà, probabile sforo sopra 0.45.

Procedura:
1. Implementare i 4 Trio con i valori iniziali sopra.
2. Rimisurare `campaignBalanceB` (`tests/engine/campaignBalanceB` — NON `tests/campaign`, path
   sbagliato = "no test files" exit 1 leggibile come pass).
3. Se sfora sopra banda: **tarare i numeri dei Trio stessi** (leva più mirata: potenza player-only),
   non i nemici. Abbassare i bonus per grado finché rientra.
4. **Regola**: se rientrare richiede più di un ritocco leva, fermarsi e riportare i numeri
   all'utente (decisione di difficoltà, non automatica). Vale anche il tuning inter-Trio: se un Trio
   domina gli altri, riportare lo spread come in fase 1 (le case erano entro ~0.15 l'una dall'altra).
5. Documentare il nuovo valore di `campaignBalanceB` e i numeri finali dei Trio nel codice.

Pin utente da rispettare (memoria): `STARTER_PICKS=3`, `elites≥2`, `normalCount=1`,
Voldemort `unitCount=3`. Non reintrodurre `menace`.

## Impatto UI

- Il pannello Duo/sinergie deve mostrare i Trio attivi (casa + effetto + grado). Riusare lo stile
  del pannello Duo (gemme/righe) — non un sistema visivo nuovo. Verificare che una lista Trio vuota
  non crashi.
- Serve una stringa d'effetto per Trio × grado (come `houseEffectText` faceva per le case), derivata
  dai numeri reali così la UI segue il bilanciamento. Metterla accanto ai dati dei Trio.
- Preview in draft: pescare un mago di una casa di cui hai già 2 (con un Duo attivo) accende il Trio
  → mostrarlo nella preview sinergie/Duo se il costo è basso. Se complica, fuori scope.

## Test

- **`trioEffects` gate**: team con 3 Serpeverde ma NESSUN Duo attivo → mappa vuota. Con ≥1 Duo attivo
  → i 3 Serpeverde ricevono `firstStrike`.
- **Player-only**: enemy team con 3 stessa casa → nessun Trio (nessun `leftDuos` passato al lato
  destro).
- **Grado**: 3 stessa casa = grado base; 4 = grado potenziato (valori distinti se i gradi divergono).
- **Ogni buff nel motore**:
  - Grifondoro: una spell con cooldown 3 castata da un mago Trio Grifondoro → cooldown registrato 2
    (min 1).
  - Tassorosso: uno status inflitto da un mago Trio Tassorosso ha `remaining` = default +1.
  - Serpeverde: primo colpo su nemico a vita piena da un mago Trio → danno maggiorato; secondo colpo
    (non più pieno) → normale.
  - Corvonero: colpo di un mago Trio → il bersaglio guadagna 1 stack di Vulnerabilità/`analysis`.
- **`houseEffects` cancellato**: nessun import residuo; il file non esiste; test morti rimossi;
  typecheck verde.
- **Balance**: `campaignBalanceB` rimisurato e documentato; in banda o tarato con ≤1 ritocco.
- **Replay/score**: fixture di score aggiornati se il nuovo potere li sposta (deterministico).

## Fuori scope

- Trio legati a UNO specifico Duo (il gate è globale: ≥1 Duo qualsiasi). Un solo Trio per casa.
- Trio sui nemici. Restano player-only.
- Chance di azione extra / RNG (Grifondoro è cooldown−1 deterministico, per scelta esplicita
  dell'utente — niente RNG né riscrittura del turn-loop).
- Reintrodurre i poteri di casata 2/3/4 sotto altra forma. I Trio li sostituiscono.
