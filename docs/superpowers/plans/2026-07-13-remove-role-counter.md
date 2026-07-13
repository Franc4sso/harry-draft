# Rimozione del counter di ruolo (RPS ×1.25) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rimuovere il moltiplicatore di counter di ruolo (`matchupBonus = 0.25`, applicato via `roleMult`) dal motore e dalla UI, perché è metà-morto (il Supporto non attacca) e mai mostrato.

**Architecture:** Il moltiplicatore vive in 3 punti motore (`constants.matchupBonus`, `roleCounter.roleMult`/`ROLE_PREY`, `effects.ts` che lo applica) + 1 label UI (`rolePreyOf` → "forte vs" in MapScreen). Si rimuovono tutti; il targeting di ruolo (affondo/backline/taunt) e il resto di `roleCounter.ts` (hard-control, tenacia) NON dipendono dal moltiplicatore e restano intatti.

**Tech Stack:** TypeScript, motore di combattimento deterministico, Vitest, React (Next.js).

## Global Constraints

- **Copy in italiano** (dove si tocca UI/testo).
- Il **targeting di ruolo** (`targeting.ts`: affondo, backline, taunt) NON usa `roleMult`/`ROLE_PREY` → non va toccato.
- Il resto di `roleCounter.ts` (`HARD_CONTROL_KINDS`, `isUnderHardControl`, `countHardControl`, `cleanseOneControl`, `applyTenaciaAura`) NON c'entra → resta.
- **`npm run test` NON esegue il typecheck** → `npm run typecheck` a parte dopo ogni task che tocca `.ts`.
- **Il bot di bilanciamento non capisce i counter** → rimuovere il ×1.25 muove la winRate al margine; il gate `campaignBalanceB` va **rimisurato**, non ritarato (a meno che sfori la banda).
- Commit su master + push a fine slice (flusso utente), via feature branch + merge.

---

### Task 1: Rimuovi il moltiplicatore dal motore (`roleMult`, `ROLE_PREY`, applicazione)

Elimina `matchupBonus`, `roleMult`, `ROLE_PREY` e la riga in `effects.ts` che li applica. Aggiorna i test diretti del moltiplicatore.

**Files:**
- Modify: `data/constants.ts:575` (rimuovi `matchupBonus`)
- Modify: `game/engine/combat/roleCounter.ts:6,10-13` (rimuovi `ROLE_PREY` + `roleMult`)
- Modify: `game/engine/combat/effects.ts:7,19-21` (rimuovi import + applicazione + commento)
- Modify: `tests/engine/combat/roleCounter.test.ts:6-12` (rimuovi il primo `it`)
- Delete: `tests/engine/combat/roleDamageMatrix.test.ts` (intero file, testa solo il ×1.25)
- Test: la suite `roleCounter.test.ts` residua (hard control) + `effects.test.ts` restano verdi

**Interfaces:**
- Consumes: niente da task precedenti.
- Produces: `roleCounter.ts` non esporta più `roleMult`/`ROLE_PREY`; `effects.computeDamage` non applica alcun moltiplicatore di matchup. Questo rompe `lib/roleInfo.ts` (importa `ROLE_PREY`) → riparato nel Task 2.

- [ ] **Step 1: Rimuovi i test diretti del moltiplicatore (red-first per rimozione)**

Elimina l'intero file `tests/engine/combat/roleDamageMatrix.test.ts`:

```bash
git rm tests/engine/combat/roleDamageMatrix.test.ts
```

In `tests/engine/combat/roleCounter.test.ts`, rimuovi SOLO il primo `it` (quello che asserisce `roleMult` ≈ 1.25 / 1.0). Individua il blocco:

```ts
it('roleMult is 1.25 vs prey and 1 otherwise', () => {
  // ... asserzioni toBeCloseTo(1.25) sul ciclo + roleMult(...)===1
})
```

e cancellalo. Se il file importa `roleMult` solo per quel test, rimuovi anche l'import `roleMult` dalla riga di import in cima (tieni gli altri import — `isUnderHardControl`, ecc. — usati dai test hard-control che restano).

- [ ] **Step 2: Verifica che i test rimossi non ci siano più**

Run: `npx vitest run tests/engine/combat/roleCounter.test.ts tests/engine/combat/roleDamageMatrix.test.ts`
Expected: `roleDamageMatrix` → "no test files found" per quel path (cancellato); `roleCounter.test.ts` gira e passa i test hard-control residui. (A questo punto la suite completa NON compilerebbe ancora perché `roleMult` è ancora esportato/usato — lo togliamo ora.)

- [ ] **Step 3: Rimuovi `ROLE_PREY` e `roleMult` da `roleCounter.ts`**

In `game/engine/combat/roleCounter.ts`, elimina il blocco (righe ~5-13):

```ts
/** The counter cycle: each role deals bonus damage to the role it preys on. */
export const ROLE_PREY: Record<Role, Role> = {
  Tank: 'Attaccante', Attaccante: 'Supporto', Supporto: 'Controllo', Controllo: 'Tank',
}

/** Damage multiplier for a role matchup: ×(1+matchupBonus) vs your prey, ×1 otherwise. */
export function roleMult(attacker: Role, defender: Role): number {
  return 1 + (ROLE_PREY[attacker] === defender ? BALANCE.roles.matchupBonus : 0)
}
```

Se dopo la rimozione `Role`, `BALANCE`, o `effectiveStats` non sono più usati nell'import in cima al file, rimuovi gli import orfani (verifica con `grep -n "Role\b\|BALANCE\|effectiveStats" game/engine/combat/roleCounter.ts`; `effectiveStats` è usato da `cleanseOneControl` → probabilmente resta; `BALANCE` era usato solo da `roleMult` → probabilmente va via; `Role` è usato dai tipi rimasti → verifica).

- [ ] **Step 4: Rimuovi l'applicazione da `effects.ts`**

In `game/engine/combat/effects.ts`:
- Riga 7: rimuovi `roleMult` dall'import, tenendo gli altri:
  ```ts
  import { HARD_CONTROL_KINDS, isUnderHardControl } from './roleCounter'
  ```
- Righe 19-21: rimuovi il commento del matchup e la riga di applicazione. Prima:
  ```ts
    let dmg = atk * power - def * c.defenseK
    // Role matchup: +25% vs the role you prey on (Tank→Att→Sup→Ctrl→Tank). Replaces the old
    // Controllo-specific multiplier — Controllo's real anti-Tank power is now its passive.
    dmg *= roleMult(actor.wizard.role, target.wizard.role)
    dmg = Math.max(c.minDamage, dmg)
  ```
  Dopo:
  ```ts
    let dmg = atk * power - def * c.defenseK
    dmg = Math.max(c.minDamage, dmg)
  ```

- [ ] **Step 5: Rimuovi `matchupBonus` da constants**

In `data/constants.ts:575`, elimina la riga:

```ts
    matchupBonus: 0.25,                // ×1.25 damage vs the role you prey on
```

Lascia intatte `tauntBonus`, `attackerArmorPen`, `tenaciaControlDurationMult` nello stesso blocco `roles`.

- [ ] **Step 6: Typecheck (atteso: rompe solo roleInfo.ts)**

Run: `npm run typecheck`
Expected: UN errore atteso in `lib/roleInfo.ts` (`ROLE_PREY` non più esportato). Questo è previsto — lo ripara il Task 2. Se ci sono ALTRI errori (import orfani in roleCounter.ts/effects.ts), correggili qui (sono parte di questo task).

- [ ] **Step 7: Aggiorna i commenti obsoleti in effects.test.ts**

In `tests/engine/combat/effects.test.ts`, aggiorna SOLO i commenti che descrivono il matchup (attorno a `:67-68,92-93,112-120`) — spiegano perché le fixture usano `Controllo` come target. Ora che il moltiplicatore non esiste, quei commenti sono obsoleti: riscrivili in modo neutro (es. "target di ruolo Controllo — nessun moltiplicatore di matchup coinvolto") o rimuovili. **Nessuna asserzione numerica cambia** (erano già ×1.0).

- [ ] **Step 8: Commit**

```bash
git add data/constants.ts game/engine/combat/roleCounter.ts game/engine/combat/effects.ts tests/engine/combat/roleCounter.test.ts tests/engine/combat/effects.test.ts
git rm tests/engine/combat/roleDamageMatrix.test.ts
git commit -m "refactor(combat): rimuovi il counter di ruolo ×1.25 dal motore (ciclo mezzo-morto)

Il Supporto non attacca → Att→Sup scatta di rado, Sup→Ctrl mai. Un moltiplicatore
per metà cast è squilibrio nascosto, mai mostrato in UI. Rimosso matchupBonus/roleMult/
ROLE_PREY + applicazione in effects. Targeting di ruolo e hard-control intatti.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Rimuovi la label UI "forte vs" e `rolePreyOf`

`rolePreyOf` (in `roleInfo.ts`) importa `ROLE_PREY`, ora rimosso → il typecheck è rotto. Rimuovi `rolePreyOf`, il suo import, la label "forte vs" nell'hover elite di MapScreen, e il test di `rolePreyOf`.

**Files:**
- Modify: `lib/roleInfo.ts:2,32-36` (rimuovi import `ROLE_PREY` + `rolePreyOf`)
- Modify: `components/screens/MapScreen.tsx:10,77` (rimuovi import `rolePreyOf` + la label "forte vs")
- Modify: `tests/lib/roleInfo.test.ts:3,31-34` (rimuovi import `rolePreyOf` + il suo `it`)
- Test: `tests/lib/roleInfo.test.ts` residuo + eventuali test MapScreen restano verdi

**Interfaces:**
- Consumes: da Task 1 — `ROLE_PREY` non esiste più.
- Produces: nessun consumatore di `rolePreyOf`; l'hover elite mostra ruolo+magia senza "forte vs".

- [ ] **Step 1: Rimuovi il test di `rolePreyOf`**

In `tests/lib/roleInfo.test.ts`:
- Riga 3: rimuovi `rolePreyOf` dall'import (tieni gli altri helper importati).
- Righe 31-34: rimuovi il blocco:
  ```ts
  it('rolePreyOf returns the countered role', () => {
    // ...
  })
  ```

- [ ] **Step 2: Rimuovi `rolePreyOf` e l'import da `roleInfo.ts`**

In `lib/roleInfo.ts`:
- Riga 2: rimuovi `import { ROLE_PREY } from '@/game/engine/combat/roleCounter'`.
- Righe 32-36 (circa): rimuovi il commento e la funzione:
  ```ts
  /** ... re-exported here so UI code has a single place ... */
  export function rolePreyOf(role: Role): Role {
    return ROLE_PREY[role]
  }
  ```
- Se `Role` non è più usato altrove nel file dopo la rimozione, togli l'import di `Role` (verifica: `ROLE_INFO`/`ROLE_VERB` probabilmente lo usano ancora → resta).

- [ ] **Step 3: Rimuovi la label "forte vs" da MapScreen**

In `components/screens/MapScreen.tsx`:
- Riga 10: rimuovi `import { rolePreyOf } from '@/lib/roleInfo'` (se `roleInfo` non è più usato per altro in quel file; se importa anche altri helper, tieni l'import e togli solo `rolePreyOf`).
- Riga 77: rimuovi la riga della label:
  ```tsx
  <span className="block truncate text-[9px] text-white/40">forte vs {rolePreyOf(e.wizard.role)}</span>
  ```
  (È una riga informativa dell'hover roster elite — l'hover resta, perde solo quella riga.)

- [ ] **Step 4: Typecheck (atteso: pulito)**

Run: `npm run typecheck`
Expected: nessun errore (l'errore del Task 1 su `ROLE_PREY` ora è risolto — non c'è più consumatore).

- [ ] **Step 5: Test dei file toccati**

Run: `npx vitest run tests/lib/roleInfo.test.ts`
Expected: PASS (i test residui degli altri helper di roleInfo).

Se esiste un test di MapScreen, gira anche quello: `grep -rln "MapScreen\|forte vs" tests/` → gira i file trovati. Expected: PASS (nessuno dovrebbe asserire "forte vs"; se uno lo fa, aggiornalo a non aspettarsi più la label).

- [ ] **Step 6: Commit**

```bash
git add lib/roleInfo.ts components/screens/MapScreen.tsx tests/lib/roleInfo.test.ts
git commit -m "refactor(ui): rimuovi la label 'forte vs' e rolePreyOf (counter rimosso)

Senza il ×1.25, 'forte vs {ruolo}' prometteva un vantaggio inesistente. Rimossa
dall'hover elite; rolePreyOf/ROLE_PREY non hanno più consumatori.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Verifica bilanciamento + aggiorna docs

Rimisura il gate winRate (il bot non capisce i counter → atteso: movimento al margine, dentro banda) e aggiorna spec/handoff che descrivono il counter come vivo.

**Files:**
- Modify: `docs/superpowers/specs/2026-07-05-role-counters-design.md` (header di deprecazione)
- Modify: `docs/superpowers/HANDOFF.md` (righe che descrivono il ×1.25)
- Test (verifica, non modifica): `tests/engine/campaignBalanceB.test.ts`

- [ ] **Step 1: Suite piena + typecheck**

Run: `npm run typecheck && npm run test`
Expected: tsc pulito; suite piena verde. In particolare `campaignBalanceB.test.ts` deve restare verde (il suo gate è winRate>0 / banda lassa — vedi header del file). Se fallisce, LEGGI il valore riportato: se la winRate è ancora nella banda dichiarata nel file, ri-àncora il commento; se sfora, FERMATI e segnala (è un segnale di bilanciamento reale, non previsto).

- [ ] **Step 2: Marca la spec del counter come superata**

In cima a `docs/superpowers/specs/2026-07-05-role-counters-design.md`, aggiungi:

```markdown
> **SUPERATA 2026-07-13**: il moltiplicatore di counter di ruolo (×1.25) è stato RIMOSSO —
> vedi `docs/superpowers/specs/2026-07-13-remove-role-counter-design.md`. Il ciclo era metà-morto
> (il Supporto non attacca). Il targeting di ruolo (affondo/backline/taunt) e l'hard-control
> descritti qui restano validi; solo il moltiplicatore di danno è stato tolto.
```

- [ ] **Step 3: Aggiorna HANDOFF.md**

In `docs/superpowers/HANDOFF.md`, trova le righe che descrivono "Matrice danni ×1.25 vs preda" e "Controllo +25% vs Tank" (nel blocco "Sistema COUNTER dei ruoli (RPS)"). Aggiungi una nota inline che il moltiplicatore di danno è stato rimosso il 2026-07-13 (ciclo mezzo-morto), tenendo la descrizione del targeting/hard-control che resta valido.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-07-05-role-counters-design.md docs/superpowers/HANDOFF.md
git commit -m "docs: counter di ruolo ×1.25 rimosso — spec superata + handoff aggiornato

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (spec: `docs/superpowers/specs/2026-07-13-remove-role-counter-design.md`):
- Rimuovi matchupBonus/roleMult/ROLE_PREY/applicazione → Task 1. ✅
- Rimuovi label "forte vs" + rolePreyOf → Task 2. ✅
- Tieni hard-control/tenacia/targeting → non toccati (Task 1 rimuove solo il blocco moltiplicatore). ✅
- Test diretti rimossi (roleDamageMatrix, roleCounter primo it, roleInfo rolePreyOf) → Task 1+2. ✅
- Commenti effects.test.ts aggiornati (asserzioni invariate) → Task 1 Step 7. ✅
- Gate campaignBalanceB rimisurato → Task 3 Step 1. ✅
- Docs (spec superata + handoff) → Task 3. ✅

**Placeholder scan:** i punti "verifica se l'import è orfano" (Task 1 Step 3, Task 2 Step 2) sono controlli concreti con grep esatto, non placeholder. Le righe di codice da rimuovere sono mostrate per intero.

**Type consistency:** la sequenza è corretta — Task 1 rimuove `ROLE_PREY` (rompe roleInfo), Task 2 ripara roleInfo (rimuove il consumatore). Il typecheck è ROSSO tra Task 1 e Task 2 (previsto e dichiarato in Task 1 Step 6), VERDE dopo Task 2. Ogni task committa comunque un'unità coerente di rimozione; il branch è verde solo a fine Task 2 — accettabile in una rimozione a cascata (il reviewer lo sa dal piano).

**Nota ordine:** Task 1 lascia il typecheck rotto di proposito (un solo errore atteso in roleInfo). Se si preferisse ogni commit verde, si potrebbe invertire (prima staccare roleInfo, poi rimuovere il motore), ma roleInfo NON compila senza ROLE_PREY comunque — la cascata è intrinseca. L'implementer del Task 1 NON deve "aggiustare" roleInfo per far passare il tsc: quello è il Task 2.
