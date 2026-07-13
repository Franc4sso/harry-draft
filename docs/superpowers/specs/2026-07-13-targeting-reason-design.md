# Motivo del targeting (perché quel bersaglio)

Data: 2026-07-13
Tipo: fondamento motore (osservativo, replay-safe) per la leggibilità del combattimento

## Problema

Il motore sceglie il bersaglio di ogni azione con una logica ricca (provocazione, affondo,
bersaglio più debole, scavalca-al-backline), ma **il motivo non arriva mai al giocatore**: la
LogEntry porta chi→chi ma non *perché quel chi*. La Slice C (lift & focus) vuole mostrare una
riga-causa ("bersaglio più debole", "provocato") — che oggi non esiste nei dati.

Questa slice è il **fondamento**: fa emettere al motore, in ogni azione offensiva, il motivo del
targeting come dato osservativo. Non cambia il comportamento del combattimento.

## Vincoli (dalla mappa del codice)

- **NON cambiare la firma di `selectTarget`** — ha 1 chiamante di produzione ma **27 chiamate nei
  test** (5 file) che trattano il ritorno come `BattleUnit`. Cambiarlo li romperebbe tutti.
- **Anti-cheat SAFE**: il combat `LogEntry[]` NON è mai serializzato per la validazione. Il RunLog
  Endless serializza solo `{ v, engine, seed, draftPicks, actions }`; il server ri-simula da seed.
  Un campo `reason` sulla LogEntry **non può raggiungere alcun percorso anti-cheat**. Persistito o
  transiente è una scelta di stile, non di sicurezza.
- **Replay-safe**: `buildReplay` legge solo `value`/`targetId`/`targetSide`/`flags`/`duoId`. Un
  campo `reason` extra è inerte.
- **Divergenza `realTarget` ≠ `target`**: per cura/revive/difesa il target emesso è un alleato
  (`realTarget` sovrascritto in `simulate.ts:273-277`), NON il bersaglio scelto da `selectTarget`.
  Il motivo ha senso SOLO per le azioni **offensive** (Attacco/Controllo verso un nemico). Per
  cura/difesa/revive: nessun `reason`.

## Design

### 1. Il tipo `TargetReason`

Nuovo tipo (in `types/combat.ts`, accanto a LogEntry). Enum di stringhe, una per famiglia di
motivo — mappato 1:1 sui rami di `selectTarget`:

```ts
export type TargetReason =
  | 'taunt'      // un Tank nemico provoca → obbligati a colpirlo (rami taunt)
  | 'dive'       // Affondo dell'Attaccante sul backline/preda (diveTarget)
  | 'backline'   // Controllo/Supporto scavalca verso le retrovie (backlineTarget)
  | 'weakest'    // il più debole (lowestHp, Tank senza taunt)
  | 'threat'     // la minaccia maggiore (highestThreat, Supporto offensivo senza taunt)
```

Copy italiana (per la Slice C, definita accanto al tipo o in una map UI — QUESTA slice definisce
solo la map dei testi, non la usa):

```ts
export const TARGET_REASON_LABEL: Record<TargetReason, string> = {
  taunt: 'provocato',
  dive: 'affondo sul backline',
  backline: 'scavalca alle retrovie',
  weakest: 'il più debole',
  threat: 'la minaccia maggiore',
}
```

### 2. `explainTarget` — funzione sorella pura

In `game/engine/combat/targeting.ts`, accanto a `selectTarget`, una funzione che ricalcola SOLO il
motivo con la STESSA logica di rami (nessun cambio a selectTarget):

```ts
export function explainTarget(
  actor: BattleUnit, allies: BattleUnit[], enemies: BattleUnit[], spell?: Spell,
): TargetReason | null {
  // ricalcola taunt/pool come selectTarget; ritorna il motivo del ramo scelto, o null se
  // l'azione NON è offensiva (Supporto in cura/difesa → il target è un alleato, niente motivo).
}
```

Rami → motivo (rispecchia `selectTarget` `targeting.ts:132-155`):
- Supporto + magia offensiva + taunt → `'taunt'`
- Supporto + Controllo, no taunt → `'backline'`
- Supporto + Attacco, no taunt → `'threat'`
- Supporto difensivo/cura → `null` (target = alleato)
- Controllo + taunt → `'taunt'` ; no taunt → `'backline'`
- Tank + taunt → `'taunt'` ; no taunt → `'weakest'`
- Attaccante + taunt → `'taunt'` ; no taunt (Affondo) → `'dive'`

**DRY**: per evitare che `explainTarget` e `selectTarget` divergano nel tempo, la logica di
derivazione taunt/pool va condivisa (un helper interno che entrambe usano), oppure `explainTarget`
è tenuta strettamente adiacente con un test che verifica la corrispondenza ramo-per-ramo. Scelta
implementativa nel piano; il vincolo è: **se selectTarget cambia un ramo, un test deve fallire se
explainTarget non lo rispecchia.**

### 3. Emissione nella LogEntry

- Aggiungi `reason?: TargetReason` a `LogEntry` (`types/combat.ts`) — campo **persistito
  opzionale**, precedente `duoId` (osservativo, non serializzato per anti-cheat).
- In `simulate.ts`, dove si costruisce l'azione (attorno a `:271-279`): SOLO per le azioni
  offensive verso un nemico (`realTarget.side !== actor.side` e non è un heal/revive/difesa),
  chiama `explainTarget(actor, allies, enemies, spell)` e, se non-null, attacca `reason` alla
  entry ritornata da `resolveAction`.
- Precisazione: `explainTarget` va chiamato con gli STESSI argomenti di `selectTarget` (allies,
  enemies pre-filtro) così ricalcola lo stesso ramo. Il motivo descrive il `target` scelto; poiché
  lo emettiamo solo quando `realTarget` È un nemico (offensivo), non c'è la divergenza cura/difesa.

### 4. Nessun cambio di comportamento

`selectTarget` invariato → il combattimento è byte-identico. `reason` è puro annotamento.
`campaignBalanceB`/replay/anti-cheat non toccati (verificare comunque che restino verdi).

## Test

- **`explainTarget` corrispondenza rami**: per ogni ruolo × (taunt / no-taunt) × (magia offensiva /
  difensiva), `explainTarget` ritorna il motivo atteso; per il Supporto in cura ritorna `null`.
  Riusa le fixture dei test `targeting.test.ts` esistenti (stessi scenari, aggiungi l'assert sul
  motivo).
- **Corrispondenza con selectTarget**: un test che, per un set di scenari, verifica che il motivo
  di `explainTarget` sia coerente col bersaglio di `selectTarget` (es. se selectTarget ritorna il
  Tank provocante, explainTarget ritorna `'taunt'`). Questo è la guardia anti-divergenza.
- **LogEntry.reason emessa nel sim**: in una battaglia simulata, le entry di attacco verso un
  nemico portano `reason` valorizzato quando applicabile; le entry di cura/difesa NON hanno reason.
- **Replay-safe**: `buildReplay` di una battaglia con reason → nessun mismatch (il campo è inerte).
- **Nessun cambio balance**: `campaignBalanceB` invariato (il target scelto non cambia).
- **Firma invariata**: i 27 test esistenti di selectTarget restano verdi (la firma non cambia).

## Fuori scope

- **La UI che mostra il motivo** (riga-causa nel lift & focus) è la Slice C. Questa slice definisce
  solo il tipo + la map di testi + l'emissione; NON renderizza niente.
- Sotto-motivi fini (es. "affondo sul Supporto" vs "affondo sul Controllo" dentro diveTarget) —
  in questa slice il motivo è a livello di ramo (`dive`); il dettaglio è un possibile fast-follow.
