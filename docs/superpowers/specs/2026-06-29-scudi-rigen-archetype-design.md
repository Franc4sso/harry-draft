# Archetipo Scudi-Rigen — design (il "muro" Tassorosso)

> Data: 2026-06-29. Archetipo #3 della roadmap (`docs/superpowers/remaining-work.md` #3 →
> ora #1 "next up"). Replica il pattern tracer-bullet provato due volte (Veleno, Esecuzione):
> keyword engine → grant/scale relic pair → tag-synergy → draftability → validazione (counter + sweep).
> Drama/feedback visivo DEFERITO (user-gated, item #2 del backlog).

## Concept

Tassorosso, "non potete scalfirmi". L'archetipo è **il muro**: converte il **regen in eccesso** in
**scudo**. Oggi un tick di regen cura fino a `maxHp` e l'overflow oltre il cap è **sprecato**
(`game/engine/status.ts`, ramo `tickHeal`, `Math.min(maxHp, hp + tickHeal)`). Il meccanismo core
recupera quell'overflow: a HP pieno + alto regen, il surplus diventa assorbimento.

Premia esplicitamente lo stato "HP alto + tanto regen" — chi gioca il muro vuole *restare* pieno,
non curarsi da sotto. È il contrario emotivo di Esecuzione (che vuole il nemico sotto soglia).

## Matrice counter (regola utente: dichiarata + testata)

| | Beats | Loses to |
|---|---|---|
| **Scudi-Rigen** | Attrito / danno-sostenuto / chip (scudo+regen out-sustainano il logoramento) | **Esecuzione** (ti finisce sotto soglia prima che lo scudo conti) · **Burst** (sfonda lo scudo in un colpo, l'absorb finisce) |

Ironia di design voluta: l'Esecuzione (già validata) **batte** il muro, e il muro **perde** vs
Esecuzione — il counter-web si chiude su sé stesso e si auto-conferma da entrambi i lati.

## Sezione 1 — Meccanismo engine: overflow-to-shield

**Decisione chiave: refresh, NO accumulo illimitato.** Il regen ticka ogni turno; se ogni tick
*sommasse* scudo, un muro a HP-pieno diventerebbe immortale (le fight stallerebbero fino al turn-cap).
Lo `shield` status è già `stack: 'refresh'` (`data/statuses.ts`): il nuovo scudo da overflow
**sostituisce** il precedente, non si accumula. Niente nuovo cap necessario; il refresh è il limite.

### Nuova funzione pura — `game/engine/shieldConvert.ts`

Clone strutturale di `game/engine/execute.ts` `teamExecute`:

```ts
/** Conversione team-wide overflow-regen → scudo, da relics + synergy 'bastione',
 *  scalata da keywordMult.scudo. Pura; no RNG. undefined se nessuna sorgente. */
export function teamShieldConvert(
  team: DraftedWizard[], relics: ActiveRelic[], synergies: ActiveSynergy[],
): { rate: number } | undefined
```

- Somma i `grantsShieldConvert.rate` delle reliquie (con `relicMatchesCondition`), + il grant della
  synergy `bastione`, poi scala per `keywordDamageMult(team, relics, 'scudo')`. **Identico** al flusso
  di `teamExecute` (threshold/bonus → qui `rate`). `rate` clampato a `<= 1` (non si può convertire
  più del 100% dell'overflow).
- Ritorna `undefined` quando `rate <= 0` → off-by-default.

### Stamp per-unità

In `toBattleUnits` (dove `unit.execute` viene stampato), aggiungere `unit.shieldConvert?: { rate }`
dal `teamShieldConvert` della squadra del lato. Tipo `BattleUnit` esteso con il campo opzionale.

### Punto di modifica engine — `game/engine/status.ts` (ramo `tickHeal`)

Unico punto toccato. Oggi:
```ts
if (tickHeal && unit.alive) {
  unit.hp = Math.min(unit.maxHp, unit.hp + tickHeal)
  logs.push({ ... type: 'Cura', value: tickHeal, flags: ['heal'] })
}
```
Nuovo:
```ts
if (tickHeal && unit.alive) {
  const before = unit.hp
  unit.hp = Math.min(unit.maxHp, unit.hp + tickHeal)
  const healed = unit.hp - before
  const overflow = (before + tickHeal) - unit.maxHp   // > 0 solo se il tick supera il cap
  if (overflow > 0 && unit.shieldConvert) {
    const amount = Math.round(overflow * unit.shieldConvert.rate)
    if (amount > 0) applyShield(unit, amount)          // refresh: sostituisce lo shield esistente
  }
  logs.push({ ... type: 'Cura', value: healed, flags: ['heal'] })
}
```
`applyShield` riusa il meccanismo dello `shield` status (`absorbLeft`, `stack: 'refresh'`) già usato
dall'effect handler `shield` in `effects.ts`. **Zero RNG**: quando `shieldConvert` è assente il ramo
è inalterato → tutte le battaglie seeddate restano bit-identiche. (Verifica: la suite esistente passa
senza modifiche prima di aggiungere contenuto.)

## Sezione 2 — Contenuto: reliquie + synergy + tag (pattern Esecuzione)

| Pezzo | id | Forma | Note |
|---|---|---|---|
| Reliquia **grant** | `egida-tassorosso` | `keywords: ['scudo']`, `grantsShieldConvert: { rate: 0.5 }`, rarità `rara` | mirror `spada-grifondoro` |
| Reliquia **scale** | `cuore-del-tasso` | `keywords: ['scudo']`, `keywordMult: { scudo: 0.5 }`, rarità `non-comune` | mirror `sigillo-carnefice` |
| Tag-**synergy** | `bastione` | `kind: 'origin'`, `requires: { tag: 'scudirigen', count: 3 }`, alza `rate` base (+0.35) + piccolo bonus difensivo | mirror `spietatezza` |
| **Tag** wizard | `'scudirigen'` | su ~6-8 maghi Tassorosso/Supporto/Tank ad alto regen-fit (es. sprout, hannah, susan, ernie, cedric, + altri Tassorosso) | mirror dei 9 `esecuzione`; lista finale tarata in implementazione sui regen-fit reali |

`teamShieldConvert` somma grant reliquie + grant synergy, poi `* keywordDamageMult(team, relics, 'scudo')`
— flusso identico a `teamExecute`. Nuovo tipo relic field `grantsShieldConvert?: { rate: number }`
(accanto a `grantsExecute`). La keyword `scudo` è già nel type `Keyword`.

## Sezione 3 — Validazione (due file test, mirror Esecuzione)

### `tests/engine/scudiRigenCounters.test.ts`
- **BATTE attrito**: vs nemico chip/danno-sostenuto, `plain.winner === 'right'` (senza conversione il
  muro subisce e perde), `withConvert.winner === 'left'` (lo scudo-da-overflow out-sustaina). Tuning
  empirico del flip come per i counter Esecuzione (cerca lo scenario dove la conversione ribalta).
- **PERDE vs Esecuzione**: nemico con `execute` (spada+sigillo) → ti finisce sotto soglia, vince `right`.
- **PERDE vs Burst**: nemico one-shot ad alto atk → sfonda lo scudo in un colpo, vince `right`.

### `tests/engine/scudiRigenSweep.test.ts`
Clone di `esecuzioneSweep`. Starter house **Tassorosso**, recruit biased a tag `scudirigen`, relic pick
biased a `egida-tassorosso`/`cuore-del-tasso`.
- Metrica: **winRate + shieldUptake** (`teamShieldConvert(...) !== undefined`) **+ turn-budget**.
  **NO total-damage** — lo scudo non è un canale di danno e non ha flag dedicato da attribuire (stessa
  ragione di execute). Stesso lesson hard-won di velenoSweep.
- Asserzioni: `winRate > 0.05` (non rotto), `shieldUptake > 0.10` (draftable),
  **`maxTurns < turnCap`** ← guard anti-stallo: è qui che il refresh ripaga. Con accumulo illimitato le
  fight stallerebbero; questo test *è* la verifica che "refresh, no accumulo" regge.
- Atteso lo stesso skew-casa di Veleno/Esecuzione (qui Tassorosso) — è il rebalance casa (backlog #4),
  non un difetto dello slice.

## Rischi noti & leve

- **Rischio reale = muro TROPPO DEBOLE**, non immortale (il refresh chiude l'immortalità). Refresh + un
  nemico burst potrebbe rendere lo scudo irrilevante e l'archetipo non-draftable (winRate sotto 0.05).
  **Leva di fix: alzare `rate` base della reliquia `egida-tassorosso` — NON toccare l'engine.** Se anche
  così non basta, alzare il grant della synergy `bastione`. Decisione rimandata alla validazione: si tara
  sui numeri dello sweep, non a priori.
- ⚠️ Determinismo: il ramo `tickHeal` modificato deve restare bit-identico quando `shieldConvert` è
  assente. Gate di sicurezza: far girare l'intera suite *prima* di aggiungere qualsiasi contenuto
  (solo la modifica engine + funzione pura inattiva) e confermare 710/710 invariati.

## Non in scope (YAGNI)

- Drama/feedback a schermo (callout scudo, recap) — DEFERITO, user-gated (backlog #2).
- Meccanismo anti-cura come terzo counter — non necessario per la matrice scelta, e non esiste ancora.
- Rebalance casa Tassorosso — task separato (backlog #4).
- Cap esplicito sullo scudo — non necessario: il refresh è il limite.

## Ordine di implementazione (per il piano)

1. Engine: `shieldConvert.ts` (`teamShieldConvert`) + `grantsShieldConvert` relic field + stamp
   `unit.shieldConvert` in `toBattleUnits` + ramo `tickHeal` in `status.ts`. **Gate: suite 710/710
   invariata** (conversione ancora inattiva, nessuna reliquia la concede).
2. Contenuto: reliquie `egida-tassorosso`/`cuore-del-tasso`, synergy `bastione`, tag `scudirigen` sui
   wizard.
3. Validazione: `scudiRigenCounters.test.ts` + `scudiRigenSweep.test.ts`. Tarare il `rate` sui numeri.
4. Aggiornare `remaining-work.md` (#3 → done, counter-web table).
