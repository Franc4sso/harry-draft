# Tratti (Phase 3) — 10 nuovi tratti generici · Design

> Estende il catalogo tratti da 5 a 15. **Zero modifiche al motore**: ogni
> tratto usa solo hook già lanciati ed effetti già supportati. Solo dati nuovi
> in `data/traits.ts` + test + (opzionale) assegnazione a wizard.

## Contesto

Phase 2 (merge `ad69711`) ha consegnato il motore tratti completo:

- `types/trait.ts` — `Trait` con `trigger` `modifier` | `reactive`.
- `game/engine/traits.ts` — `registerTraitTriggers`, owner-gated, fired per
  entrambe le squadre (reactive symmetry).
- `data/traits.ts` — 5 tratti: Esecuzione, Furia, Roccia (modifier);
  Sifone, Benedizione (reactive).
- `components/cards/WizardCard.tsx` — chip tratto con Tooltip.
- 481 test verdi.

Solo 4/60 wizard hanno tratti assegnati (di fatto fixture di test).

## Vincoli del motore (verificati nel codice)

Questi vincoli delimitano cosa è esprimibile **senza toccare il motore**. Sono
stati letti direttamente da `simulate.ts` ed `effects.ts`, non assunti.

**Hook reattivi usabili da un tratto** (target dell'effetto fra parentesi):

| Hook | ctx | Target effetti `heal`/`shield`/`damage` | `applyStatus self` | `applyStatus enemy` |
|------|-----|------|------|------|
| `onHit` | actor + target(nemico) | **nemico** (`ctx.target`) | actor | nemico ✅ |
| `onHeal` | self | self | self | self |
| `onTurnStart` | self | self | self | self |
| `onTurnEnd` | self | self | self | self |
| `onAllyDeath` | il superstite (self) | self | self | self |

**NON usabili da un tratto:**

- `onBattleStart` — applicato solo alla squadra LEFT, guidato dalle reliquie.
- `onHpThreshold` — scatta solo per soglie registrate dalle reliquie LEFT; un
  tratto non può registrare la propria soglia.
- `onDeath` — scatta sull'unità che muore; l'effetto colpisce se stessa → inutile.

**Modifier hook:** `modifyOutgoingDamage`, `modifyIncomingDamage`, `modifyHealing`.

**Limite chiave scoperto:** gli handler `heal` / `shield` / `damage` agiscono
sempre su `ctx.target` — **non hanno selettore di bersaglio**. Quindi su `onHit`
(dove `target` = nemico) un `heal` curerebbe il nemico. Lifesteal e thorns
**non sono esprimibili** senza modifiche al motore → scartati. `applyStatus`
invece ha `target: 'self' | 'enemy'` e onora `chance` (rng-gated).

**Status predefiniti disponibili** (`data/statuses.ts`): `stun`, `freeze`,
`silence`, `disarm`, `burn`(dot, 8/turno), `regen`(12/turno), `shield`,
`atkUp`(+20 atk), `defUp`(+25 def), `slow`(-15 spd). `applyStatus` accetta anche
un `effect` inline `{kind, stat, amount, duration}` per buff/debuff ad-hoc
(come fa Sifone).

## I 10 tratti

Tutti `kind: 'reactive'` con `owner: 'actor'` salvo dove indicato. Le costanti
(chance, durata) vivono come `const` in cima a `data/traits.ts`, come per i 5
esistenti.

| # | id | Nome | Hook | Effetto | Note bilanciamento |
|---|-----|------|------|---------|--------------------|
| 1 | `pietrificazione` | Pietrificazione | `onHit` | `applyStatus enemy stun`, chance **0.18**, dur 1 | controllo duro raro |
| 2 | `bavaglio` | Bavaglio | `onHit` | `applyStatus enemy silence`, chance **0.18**, dur 2 | blocca incantesimi |
| 3 | `disarmo` | Disarmo | `onHit` | `applyStatus enemy disarm`, chance **0.18**, dur 2 | blocca attacchi |
| 4 | `veleno` | Veleno | `onHit` | `applyStatus enemy burn` (dot), chance **0.5**, dur 2 | danno nel tempo, stack≤3 |
| 5 | `rigenerazione` | Rigenerazione | `onTurnStart` | `applyStatus self regen`, dur 3 | cura passiva |
| 6 | `crescendo` | Crescendo | `onTurnStart` | `applyStatus self effect{buff, atk, +6}` dur 99 | scaling: +atk ogni turno |
| 7 | `vendetta` | Vendetta | `onAllyDeath` | `applyStatus self effect{buff, atk, +30}` dur 3 | spike quando un alleato cade |
| 8 | `ferocia` | Ferocia | `onHit` | `applyStatus self atkUp`, dur 2 | sale di colpo a ogni colpo |
| 9 | `anticipo` | Anticipo | `onTurnStart` | `applyStatus self effect{buff, spd, +10}` dur 1 | sempre più veloce all'inizio |
| 10 | `logoramento` | Logoramento | `onHit` | `applyStatus enemy slow`, chance **0.4**, dur 2 | erode la velocità nemica |

**Distinzione da tratti/relic esistenti:**

- `logoramento` (debuff spd al nemico) ≠ `roccia` (riduzione danni subìti su di sé)
  e ≠ `sifone` (anch'esso -spd): scelta accettata dall'utente; Sifone è una
  versione più debole/breve, Logoramento una più forte/probabile. Convivono.
- `ferocia` (atkUp su hit, self) ≠ `furia` (modifier scaling su HP mancanti):
  Ferocia è a stack temporizzati, Furia è continua e cresce coi danni subiti.

### Crescendo — nota su durata "permanente"

Non esiste uno status a durata infinita nel motore. Si usa `duration: 99` con
`effect` inline `{kind:'buff', stat:'atk', amount:6}` e policy di stack del def
inline. Va **verificato in implementazione** che lo stacking di un buff inline
ripetuto si comporti come "cresce ogni turno" (refresh vs stack). Se la policy
inline non somma, Crescendo va riscritto o tagliato — l'implementatore lo
testa esplicitamente con un test multi-turno e regola di conseguenza.

## File toccati

- `data/traits.ts` — +10 voci in `TRAITS` (e quindi in `TRAIT_BY_ID`).
- `tests/engine/traitEffects.test.ts` (o nuovo `traitsPhase3.test.ts`) — un test
  per tratto che verifica l'effetto applicato dopo l'hook, + chance gated (rng
  deterministico forzato a hit e a miss per i tratti con `chance`).
- **Nessuna** modifica a motore, tipi, UI. La chip su WizardCard già mostra
  qualunque tratto via `TRAIT_BY_ID` + `desc`.

**Assegnazione ai wizard:** fuori scope per questa fase (l'utente ha chiesto
"aggiungere nuovi tratti", non distribuirli). I 10 restano nel catalogo,
assegnabili in un giro successivo.

## Test plan

Per ogni tratto, in un mondo a 1v1 deterministico:

1. **Effetto applicato** — dopo l'hook, l'unità bersaglio corretta porta lo
   status atteso (id/kind, durata).
2. **Owner gating** — un wizard senza il tratto non produce l'effetto.
3. **Chance gating** (tratti 1-4,10) — rng forzato a successo applica, rng
   forzato a fallimento no.
4. **Simmetria** — il tratto su un'unità RIGHT funziona come su LEFT (il motore
   Phase 2 già fa fire bilaterale; un test lo conferma per un tratto campione).
5. Suite intera + `tsc` verdi, nessuna regressione sui 5 tratti esistenti né
   sugli stream rng delle battaglie esistenti.

## Fuori scope (YAGNI)

- Lifesteal / thorns / contrattacco (richiedono modifiche al motore).
- Nuovi hook o nuovi `EffectSpec`.
- Assegnazione di tratti ai 60 wizard.
- Tratti tematici di casa o firma di personaggio.
