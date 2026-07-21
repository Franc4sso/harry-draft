# Rimozione bonus sinergia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rimuovere le 9 sinergie di gruppo/origine e tutti i loro bonus stat dal motore, tenendo solo Tossicità (stile veleno), Duo e Trio; poi ri-tarare la difficoltà via pressione nemica.

**Architecture:** `SYNERGIES` si riduce alla sola `tossicita`. Gli helper morti (`applyBonuses`, `totalRegen`, `synergyProgress`, `previewSynergies`, `matchingMemberIds`, `statBreakdown`) e i loro test vengono rimossi. `detectSynergies` resta (rileva Tossicità per combat). Il boss `exclusiveSynergy` (+20%) è indipendente da `SYNERGIES` e resta. Poi si abbassa la pressione nemica (`normalEnemyCount` → `enemyCountByArea`) finché `campaignBalanceRestricted` rientra in [0.05, 0.13].

**Tech Stack:** TypeScript, Vitest, engine di gioco puro (no RNG nei bonus).

## Global Constraints

- **Tenere INTATTI:** Tossicità (trigger `synergyTriggers.ts` + `keywordMult: { veleno: 0.5 }`), Duo (`duos.ts`), Trio (`trios.ts`), boss `exclusiveSynergy` (`data/bosses.ts`, +20% via `battlePackage.ts`).
- **`detectSynergies` RESTA:** in `simulate.ts` la lista `synergies` alimenta anche `teamExecute`/`teamShieldConvert`/`teamDarkMagic` e `velenoUncapped` (`id === 'tossicita'`). Solo `applyBonuses`/`totalRegen` (bonus stat) escono dal combat.
- **Gate reale:** `campaignBalanceRestricted` (NON campaignBalanceB, che è 0.0000 reference-only). Misurare SEMPRE con `--disable-console-intercept` (winRate altrimenti illeggibili). Comando: `npx vitest run tests/engine/campaignBalanceRestricted --disable-console-intercept`.
- **Baseline A/B misurato:** sinergie attive = 0.0583; bonus azzerati = 0.0083. Target ri-taratura: **[0.05, 0.13]**, comunque `> 0` (assert vivo del gate).
- **Pin difficoltà (memoria progetto):** STARTER_PICKS=3, elites≥2, Voldemort unitCount=3, MAI reintrodurre `menace`. NON toccare `BALANCE.draft.screenSize` né `categoryWeights`.
- **`npm run test` NON typechecka:** girare `npx tsc --noEmit` a parte, ogni task.
- Verificare `git rev-parse HEAD` prima di ogni commit (possibile writer git concorrente). Master diretto. Commit: Conventional Commits IT + footer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Ridurre SYNERGIES a solo Tossicità + rimuovere helper morti

Rimuove le 9 sinergie di gruppo/origine da `data/synergies.ts` (resta solo `tossicita`), e cancella gli helper motore ormai morti e i loro test.

**Files:**
- Modify: `data/synergies.ts`
- Modify: `game/engine/synergy.ts` (rimuovere `applyBonuses`, `totalRegen`, `synergyProgress`, `previewSynergies`, `matchingMemberIds`, `synergyThreshold`, interfacce `SynergyProgress`/`SynergyPreview`; TENERE `detectSynergies` + `membersFor`)
- Modify: `game/engine/combat/simulate.ts` (rimuovere uso `applyBonuses`/`totalRegen`)
- Delete: `lib/statBreakdown.ts` + `tests/lib/statBreakdown.test.ts` (morti, zero consumer non-test)
- Modify/Delete test: `tests/data/synergies.test.ts`, `tests/engine/synergy.test.ts`, `tests/engine/synergyProgress.test.ts`, `tests/engine/synergyRemoval.test.ts`, `tests/lib/synergyText.test.ts`, `tests/lib/glossary.test.ts`
- Test guida: `tests/engine/tossicitaTrigger.test.ts`, `tests/engine/velenoSynergy.test.ts`, `tests/engine/keywordMultSynergy.test.ts` (Tossicità — devono restare verdi INVARIATI)

**Interfaces:**
- Consumes: niente dai task successivi.
- Produces: `SYNERGIES` = `[tossicita]`; `detectSynergies(team)` ritorna al più `[{synergy: tossicita, ...}]`. `applyBonuses`/`totalRegen`/`synergyProgress`/`previewSynergies` NON esistono più.

- [ ] **Step 1: Aggiornare i test-valore (rosso prima)**

Prima di toccare il codice, aggiornare i test che asseriscono la presenza/valori delle 9 sinergie, così il rosso è chiaro:

In `tests/data/synergies.test.ts`: sostituire le asserzioni di conteggio con la nuova realtà. Nuovo contenuto della describe:
```ts
it('contiene solo Tossicità (stile veleno), nessuna sinergia di squadra', () => {
  expect(SYNERGIES.length).toBe(1)
  expect(SYNERGIES[0]!.id).toBe('tossicita')
  expect(SYNERGIES[0]!.bonus).toEqual({ keywordMult: { veleno: 0.5 } })
})
```
Rimuovere i test che referenziano `goldenTrio.bonus.allPct`, i conteggi `group >= 5`/`origin >= 4`, e `SYNERGIES.length === 10`. Tenere il test boss (`BOSSES[0].hpMult > 1`) se presente e indipendente.

In `tests/engine/synergyRemoval.test.ts`: il test "group/origin RESTANO" ora vale solo per origin (Tossicità). Aggiornare l'asserzione a:
```ts
it('resta solo Tossicità (origin), nessuna sinergia group', () => {
  const t = team(['bellatrix', 'pansy', 'blaise']) // 3 tag veleno
  const active = detectSynergies(t)
  expect(active.some(a => a.synergy.id === 'tossicita')).toBe(true)
  expect(active.some(a => a.synergy.kind === 'group')).toBe(false)
})
```
I due test role/house (già passavano) restano invariati.

In `tests/engine/synergy.test.ts`: il test `applyBonuses adds flat then percent` (righe ~21-29) usa sinergie **fake inline** — ma `applyBonuses` sta per sparire. Rimuovere quel test e il test `totalRegen(active) > 0` (righe ~33). Tenere i test su `detectSynergies` che usano `tossicita` (aggiornare gli id se referenziano `goldenTrio`: sostituire con un team veleno che attiva `tossicita`, o rimuovere il singolo assert su goldenTrio).

In `tests/engine/synergyProgress.test.ts`: l'intero file testa `synergyThreshold`/`synergyProgress`/`previewSynergies` che spariscono. **Cancellare il file** (`git rm`).

In `tests/lib/synergyText.test.ts` e la parte synergy di `tests/lib/glossary.test.ts`: `synergyBonusText` resta in `lib/glossary.ts` (lo usa ancora il glossario per Tossicità?). Verificare: se `synergyBonusText` non ha più consumer, rimuoverlo con i suoi test; se serve ancora per Tossicità, tenere solo i test relativi a Tossicità e rimuovere quelli sulle 9 sinergie.

Run: `npx vitest run tests/data/synergies tests/engine/synergyRemoval tests/engine/synergy tests/engine/synergyProgress --disable-console-intercept`
Expected: FAIL (i valori/gli helper non corrispondono ancora al codice).

- [ ] **Step 2: Ridurre `data/synergies.ts`**

Sostituire l'intero array con la sola Tossicità:
```ts
import type { Synergy } from '@/types'

// Tossicità NON è una sinergia di squadra: è uno "stile d'attacco veleno". Resta l'unico
// elemento di SYNERGIES perché il motore (simulate/tossicitaTrigger) la rileva via
// detectSynergies per applicare il keywordMult veleno e il trigger on-hit. Tutte le altre
// sinergie di squadra (Golden Trio, Mangiamorte, ecc.) sono state rimosse (2026-07-21):
// l'unico sistema di team-building è Combo Duo + Trio di casata (game/engine/trios.ts).
export const SYNERGIES: Synergy[] = [
  { id: 'tossicita', name: 'Tossicità', kind: 'origin', requires: { tag: 'veleno', count: 3 }, bonus: { keywordMult: { veleno: 0.5 } } },
]
```

- [ ] **Step 3: Rimuovere gli helper morti da `game/engine/synergy.ts`**

Tenere SOLO: `detectSynergies`, `membersFor`, e l'import necessario (`ActiveSynergy`, `DraftedWizard`, `Synergy`, `SYNERGIES`). Rimuovere: `applyBonuses`, `totalRegen`, `synergyProgress`, `previewSynergies`, `matchingMemberIds`, `synergyThreshold`, le interfacce `SynergyProgress`/`SynergyPreview`, e l'import di `Stats` se orfano. `detectSynergies` mantiene la logica family (anche se con 1 elemento è un no-op, non nuoce).

- [ ] **Step 4: Rimuovere `applyBonuses`/`totalRegen` dal combat**

In `game/engine/combat/simulate.ts`:
- Import: da `import { applyBonuses, totalRegen } from '../synergy'` rimuovere `applyBonuses` e `totalRegen`. Se non resta nulla da `../synergy`, rimuovere l'intera riga.
- Riga ~41: sostituire `const synBuffed = applyBonuses(dw.stats, synergies)` — il buff sinergia sparisce, quindi partire da `dw.stats`:
  ```ts
  const relicBuffed = applyRelicBonuses(dw.stats, team, relics, dw.wizard.id)
  ```
  (rimuovere la variabile `synBuffed`, passare `dw.stats` direttamente a `applyRelicBonuses`).
- Righe ~95-96: `totalRegen(leftSyn) + totalRelicRegen(...)` → `totalRelicRegen(...)` (rimuovere il termine `totalRegen(...)` da entrambi i lati left/right).
- **NON toccare:** la lista `synergies`/`leftSyn`/`rightSyn` nella firma e negli altri usi (`teamExecute`, `teamShieldConvert`, `teamDarkMagic`, `velenoUncapped`, `registerSynergyTriggers`, `keywordDamageMult` veleno) — servono a Tossicità.

- [ ] **Step 5: Cancellare `statBreakdown` (morto)**

```bash
git rm lib/statBreakdown.ts tests/lib/statBreakdown.test.ts
```
Verificare prima con `grep -rln "statBreakdown\|StatBreakdown" components/ game/ lib/ app/ hooks/ | grep -v statBreakdown.ts` → deve essere vuoto.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. Se emergono import orfani residui (es. `ActiveSynergy` non più usato in simulate — controllare, potrebbe restare per le firme), correggerli.

- [ ] **Step 7: Suite mirata verde**

Run: `npx vitest run tests/data/synergies tests/engine/synergy tests/engine/synergyRemoval tests/engine/tossicitaTrigger tests/engine/velenoSynergy tests/engine/keywordMultSynergy tests/engine/duoStress tests/engine/trios --disable-console-intercept`
Expected: PASS. In particolare i test Tossicità/Duo/Trio devono passare INVARIATI (prova che li abbiamo tenuti). Se `synergyProgress.test.ts` non è stato cancellato dà "no test file" — cancellarlo.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "$(cat <<'EOF'
feat(sinergie): rimosse le 9 sinergie di squadra — resta solo Tossicità (stile veleno)

SYNERGIES = solo tossicita. Via applyBonuses/totalRegen/synergyProgress/
previewSynergies/statBreakdown (dead code). detectSynergies resta per Tossicità.
Duo, Trio di casata e il +20% del boss NON toccati. Ri-taratura in un task a parte.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Misurare l'impatto e verificare le sweep

Prima di ri-tarare, misurare lo stato reale del gate e delle sweep dopo la rimozione, così il Task 3 parte da numeri veri (non dal 0.0083 dell'A/B, che azzerava i bonus in modo diverso dalla rimozione completa).

**Files:** nessuna modifica di produzione (solo misura; eventuali fix di test-sweep rotti).

**Interfaces:**
- Consumes: lo stato di codice del Task 1.
- Produces: i numeri di baseline post-rimozione, annotati nel report, che il Task 3 usa come punto di partenza.

- [ ] **Step 1: Misurare il gate restricted**

Run: `npx vitest run tests/engine/campaignBalanceRestricted --disable-console-intercept`
Annotare il `winRate` stampato. Se il gate (`> 0`) fallisce, è un problema serio → segnalare BLOCKED (non dovrebbe: l'A/B dava 0.0083 > 0).

- [ ] **Step 2: Misurare le sweep tematiche**

Run: `npx vitest run tests/engine/velenoSweep tests/engine/esecuzioneSweep tests/engine/scudiRigenSweep tests/engine/magieOscureSweep --disable-console-intercept`
Annotare i winRate/rate di ciascuna. Verificare che nessuna sweep abbia un `expect` che ora fallisce (alcune asseriscono soglie di rate). Se una sweep rompe un `expect` per via del nuovo balance, NON tararla qui: annotarla per il Task 3.

- [ ] **Step 3: Girare la suite intera per la lista rotti**

Run: `npm run test -- --run --disable-console-intercept 2>&1 | tail -40`
Annotare OGNI test rosso residuo (oltre a quelli già gestiti nel Task 1). Categorizzare: (a) test che asserivano bonus sinergia rimossi → aggiornare/rimuovere qui; (b) test balance che dipendono dalla pressione → lasciare al Task 3.

- [ ] **Step 4: Aggiornare i test rotti di categoria (a)**

Per ogni test rosso che asseriva un bonus sinergia ora inesistente (es. un team che si aspettava +25 atk da Mangiamorte, o un breakdown stat con step synergy): aggiornarlo alla nuova realtà o rimuoverlo se non ha più senso. NON svuotare test — se un test perde il suo oggetto, cancellarlo con motivazione nel report.

Run (ripetere finché verde, escludendo i balance del Task 3): `npm run test -- --run --disable-console-intercept`

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` → exit 0.
```bash
git add -A && git commit -m "$(cat <<'EOF'
test(sinergie): aggiorna i test dipendenti dai bonus rimossi

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```
Nel report: elencare i numeri misurati (restricted + 4 sweep) e la lista dei test aggiornati/rimossi, così il Task 3 parte informato.

---

### Task 3: Ri-tarare la difficoltà via pressione nemica

Abbassare la pressione nemica finché `campaignBalanceRestricted` rientra in [0.05, 0.13]. Leva dominante prima (`normalEnemyCount`), poi `enemyCountByArea`.

**Files:**
- Modify: `data/constants.ts` (`normalEnemyCount`, `enemyCountByArea`)
- Modify: `tests/engine/campaignBalanceRestricted.test.ts` SOLO se serve aggiornare un commento/soglia (l'assert è `> 0`, non cambiarlo salvo indicazione)

**Interfaces:**
- Consumes: il winRate baseline post-rimozione dal Task 2.
- Produces: `normalEnemyCount`/`enemyCountByArea` ri-tarati con log del sweep.

- [ ] **Step 1: Sweep leva dominante `normalEnemyCount`**

Baseline attuale: `normalEnemyCount = 3`, `enemyCountByArea = [3,4,5]` (dal commento in constants.ts). Il winRate post-rimozione (dal Task 2) sarà basso (~0.008-0.05). Alzare il winRate = ABBASSARE la pressione.

Provare `normalEnemyCount: 2` (lasciando `[3,4,5]`):
- Modificare `data/constants.ts` riga `normalEnemyCount: 3,` → `2,`.
- Run: `npx vitest run tests/engine/campaignBalanceRestricted --disable-console-intercept`
- Annotare il winRate. Se in [0.05, 0.13] → fatto, vai a Step 3. Se ancora troppo basso (< 0.05) → Step 2. Se troppo alto (> 0.13) → provare `normalEnemyCount: 2` con `enemyCountByArea: [2,3,5]` o intermedio.

- [ ] **Step 2: Aggiungere la seconda leva `enemyCountByArea` se serve**

Se `normalEnemyCount: 2` non basta (winRate ancora < 0.05), abbassare `enemyCountByArea` un gradino, rispettando il pin `elites >= 2` (nessun valore < 2):
- Provare `[3,4,5]` → `[2,3,4]` (con normalEnemyCount 2), poi misurare.
- Se serve ancora, `[2,3,3]` (mai sotto 2).
- Ogni combinazione: run del gate, annotare il winRate. Fermarsi alla PRIMA combinazione che entra in [0.05, 0.13].
- Se anche `normalEnemyCount: 1` + `[2,3,3]` non arriva a 0.05, NON forzare oltre i pin: segnalare al controller (potrebbe servire una leva diversa — statMult — fuori dallo scope pin, decisione umana).

- [ ] **Step 3: Aggiornare il log di calibrazione in `constants.ts`**

Aggiungere sopra le costanti toccate un commento con la tabella del sweep appena misurato (nello stile dei log esistenti), datato 2026-07-21, con la motivazione "post-rimozione bonus sinergia" e i winRate per ogni combinazione provata. Questo è OBBLIGATORIO — i log di constants.ts sono la memoria di taratura del progetto.

- [ ] **Step 4: Verifica gate + sweep**

Run: `npx vitest run tests/engine/campaignBalanceRestricted tests/engine/velenoSweep tests/engine/esecuzioneSweep tests/engine/scudiRigenSweep tests/engine/magieOscureSweep --disable-console-intercept`
Expected: gate in banda, sweep tutte verdi (nessun `expect` di rate rotto). Se una sweep è ancora rotta dal nuovo balance, tararla qui con la sua leva documentata (vedi i commenti di ciascuna sweep) e loggare.

- [ ] **Step 5: Suite intera + typecheck**

Run: `npx tsc --noEmit && npm run test -- --run --disable-console-intercept 2>&1 | tail -15`
Expected: exit 0, suite intera verde.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "$(cat <<'EOF'
balance(sinergie): ri-tarata la pressione nemica dopo la rimozione dei bonus

winRate campaignBalanceRestricted riportato in banda [0.05,0.13] via
normalEnemyCount/enemyCountByArea (log del sweep in constants.ts). Nessun
potere casata reintrodotto, nessun menace.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Verifica finale end-to-end + push

**Files:** nessuna modifica (solo verifica).

- [ ] **Step 1: Grep residui bonus sinergia**

Run: `grep -rln "applyBonuses\|totalRegen\|synergyProgress\|previewSynergies\|statBreakdown" components/ game/ lib/ app/ hooks/ tests/`
Expected: vuoto (o solo riferimenti in commenti/doc intenzionali). Se compare codice vivo, rimuoverlo nel task appropriato.

- [ ] **Step 2: Verificare gli invarianti tenuti**

Run: `npx vitest run tests/engine/tossicitaTrigger tests/engine/velenoSynergy tests/engine/keywordMultSynergy tests/engine/duoStress tests/engine/trios tests/engine/battlePackage --disable-console-intercept`
Expected: verde. Tossicità, Duo, Trio, e il boss exclusiveSynergy funzionano.

- [ ] **Step 3: Suite intera + typecheck finale**

Run: `npx tsc --noEmit && npm run test -- --run --disable-console-intercept 2>&1 | grep -iE "Test Files|Tests |campaignBalanceRestricted|failed"`
Expected: exit 0, tutti verdi, winRate in banda.

- [ ] **Step 4: Push**

```bash
git rev-parse --short HEAD  # verificare HEAD stabile
git push origin master
```

---

## Self-Review

**Spec coverage:**
- Rimozione 9 sinergie + bonus → Task 1 ✅
- Tossicità tenuta (trigger + keywordMult) → Global Constraints + Task 1 Step 4/7 ✅
- Duo + Trio intatti → Global Constraints + Task 4 Step 2 ✅
- Boss +20% preservato → Global Constraints (indipendente da SYNERGIES) + Task 4 Step 2 ✅
- Dead code rimosso (applyBonuses/totalRegen/synergyProgress/previewSynergies/statBreakdown) → Task 1 ✅
- Ri-taratura via pressione nemica in [0.05,0.13] → Task 3 ✅
- Misura prima di tarare → Task 2 ✅
- tsc 0 + suite verde → ogni task + Task 4 ✅

**Placeholder scan:** nessun TBD; ogni step ha codice o comando esatto. Le combinazioni di leva del Task 3 sono un albero decisionale esplicito con soglie, non un "TODO tara". ✅

**Type consistency:** `detectSynergies` mantiene la firma; `applyBonuses`/`totalRegen` rimossi coerentemente da synergy.ts (def) e simulate.ts (call-site) nello stesso Task 1. `SYNERGIES = [tossicita]` usato coerentemente nei test aggiornati. ✅
