# Motivo del targeting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Far emettere al motore, in ogni azione offensiva, il MOTIVO per cui è stato scelto quel bersaglio (provocato / affondo / più-debole / backline / minaccia) come dato osservativo sulla LogEntry — senza cambiare il comportamento del combattimento.

**Architecture:** Un tipo `TargetReason` + una map di testi in `types/combat.ts`; una funzione pura sorella `explainTarget` in `targeting.ts` che ricalcola il motivo con la STESSA logica di rami di `selectTarget` (senza toccarne la firma); l'emissione di `reason` sull'entry in `simulate.ts` solo per le azioni offensive. Nessun cambio al targeting stesso → combattimento byte-identico. `reason` è fuori dalla superficie anti-cheat (il combat log non è mai serializzato per la validazione).

**Tech Stack:** TypeScript, motore di combattimento deterministico, Vitest.

## Global Constraints

- **NON cambiare la firma di `selectTarget`** (27 chiamate nei test la trattano come `BattleUnit`). Aggiungere `explainTarget` a parte.
- **Nessun cambio di comportamento**: `selectTarget` invariato → combattimento identico. `reason` è puro annotamento.
- **Anti-cheat/replay SAFE**: il combat `LogEntry[]` non è serializzato per la validazione (RunLog = seed+draftPicks+actions; il server ri-simula da seed). `buildReplay` legge solo value/targetId/targetSide/flags/duoId. `reason` è inerte.
- **Anti-divergenza**: se `selectTarget` cambia un ramo, un test DEVE fallire se `explainTarget` non lo rispecchia. La logica di derivazione taunt/pool va condivisa o coperta da un test di corrispondenza.
- **Solo azioni offensive**: `reason` va emesso SOLO quando l'azione colpisce un nemico. Cura/revive/difesa (target = alleato, `realTarget` sovrascritto in simulate.ts:273-277) → nessun reason.
- Copy in italiano nella map dei testi.
- `npm run test` NON esegue typecheck → `npm run typecheck` a parte.

---

### Task 1: Tipo `TargetReason` + map testi + `explainTarget`

Definisci il tipo e la funzione pura che deriva il motivo. Nessuna emissione ancora — solo la funzione + i suoi test.

**Files:**
- Modify: `types/combat.ts` (aggiungi `TargetReason` + `TARGET_REASON_LABEL`; NON ancora `reason` su LogEntry — quello al Task 2)
- Modify: `game/engine/combat/targeting.ts` (aggiungi `explainTarget`)
- Test: `tests/engine/combat/explainTarget.test.ts` (nuovo)

**Interfaces:**
- Produces:
  - `type TargetReason = 'taunt' | 'dive' | 'backline' | 'weakest' | 'threat'`
  - `TARGET_REASON_LABEL: Record<TargetReason, string>` (copy italiana)
  - `explainTarget(actor, allies, enemies, spell?): TargetReason | null` — null per azioni non-offensive (Supporto cura/difesa).

- [ ] **Step 1: Write the failing test**

Crea `tests/engine/combat/explainTarget.test.ts`. Riusa il factory di unit dei test targeting esistenti (`grep -n "function\|const.*BattleUnit\|dw\|u(" tests/engine/combat/targeting.test.ts` per il pattern — riusa quel builder, NON inventarne uno). Copri i rami:

```ts
import { describe, it, expect } from 'vitest'
import { explainTarget } from '@/game/engine/combat/targeting'
// riusa il factory unit + spell dei test targeting esistenti

describe('explainTarget — il motivo del bersaglio', () => {
  it('Tank senza taunt nemico → il più debole', () => {
    // actor Tank, nemici senza Tank che provoca → 'weakest'
    expect(explainTarget(tank, allies, enemiesNoTank, attackSpell)).toBe('weakest')
  })
  it('un Tank nemico che provoca → provocato (per ogni ruolo attaccante)', () => {
    // con un Tank nemico vivo non-hard-controllato → 'taunt'
    expect(explainTarget(attaccante, allies, enemiesWithTank, attackSpell)).toBe('taunt')
  })
  it('Attaccante senza taunt → affondo (dive)', () => {
    expect(explainTarget(attaccante, allies, enemiesNoTank, attackSpell)).toBe('dive')
  })
  it('Controllo senza taunt → backline', () => {
    expect(explainTarget(controllo, allies, enemiesNoTank, controlSpell)).toBe('backline')
  })
  it('Supporto con magia d\'attacco, no taunt → minaccia (threat)', () => {
    expect(explainTarget(supporto, allies, enemiesNoTank, attackSpell)).toBe('threat')
  })
  it('Supporto in cura → null (nessun motivo di bersaglio nemico)', () => {
    expect(explainTarget(supporto, alliesWounded, enemies, healSpell)).toBeNull()
  })
})
```

(Adatta gli scenari alle vere fixture: quali spell hanno `type: 'Attacco'/'Controllo'/'Cura'`, come si costruisce un nemico Tank "che provoca". Guarda `targeting.test.ts` per come già costruiscono questi scenari.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/combat/explainTarget.test.ts`
Expected: FAIL — `explainTarget is not a function`.

- [ ] **Step 3: Aggiungi il tipo + la map in types/combat.ts**

In `types/combat.ts`, accanto a LogEntry:

```ts
/** Perché un'azione ha scelto quel bersaglio — osservativo, per la leggibilità del combattimento.
 *  Uno per famiglia di ramo di selectTarget. NON influenza la simulazione. */
export type TargetReason = 'taunt' | 'dive' | 'backline' | 'weakest' | 'threat'

export const TARGET_REASON_LABEL: Record<TargetReason, string> = {
  taunt: 'provocato',
  dive: 'affondo sul backline',
  backline: 'scavalca alle retrovie',
  weakest: 'il più debole',
  threat: 'la minaccia maggiore',
}
```

- [ ] **Step 4: Implementa `explainTarget` in targeting.ts**

In `game/engine/combat/targeting.ts`, dopo `selectTarget`, aggiungi la funzione che rispecchia i rami. Ricalcola `taunt`/`enemyPool` con la STESSA logica (righe 117-130 di selectTarget) — per non divergere, estrai un helper interno condiviso, es. `targetingContext(actor, allies, enemies, spell)` che ritorna `{ enemyPool, taunt, ign }`, e falla usare SIA da selectTarget SIA da explainTarget. (Questo è il modo DRY; in alternativa duplica la derivazione con un commento che rimanda al test di corrispondenza del Task 3-guard. Preferisci l'helper condiviso.)

```ts
export function explainTarget(
  actor: BattleUnit, allies: BattleUnit[], enemies: BattleUnit[], spell?: Spell,
): TargetReason | null {
  const { taunt } = targetingContext(actor, allies, enemies, spell) // helper condiviso con selectTarget
  switch (actor.wizard.role) {
    case 'Supporto':
      if (spell && (spell.type === 'Attacco' || spell.type === 'Controllo')) {
        if (taunt) return 'taunt'
        return spell.type === 'Controllo' ? 'backline' : 'threat'
      }
      return null // cura/difesa: target = alleato, nessun motivo di bersaglio nemico
    case 'Controllo':
      return taunt ? 'taunt' : 'backline'
    case 'Tank':
      return taunt ? 'taunt' : 'weakest'
    case 'Attaccante':
    default:
      return taunt ? 'taunt' : 'dive'
  }
}
```

Se estrai `targetingContext`, RIFATTORIZZA anche `selectTarget` per usarlo (così i due non possono divergere sulla derivazione taunt/pool). Verifica che `selectTarget` resti byte-identico nel comportamento (i suoi 27 test devono restare verdi — è la rete di sicurezza).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/engine/combat/explainTarget.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + non-regressione selectTarget**

Run: `npm run typecheck`
Expected: pulito.

Run: `npx vitest run tests/engine/combat/targeting.test.ts tests/engine/combat/selection.test.ts tests/engine/combat/affondo.test.ts tests/combat/ignores-taunt.test.ts tests/engine/controlTargeting.test.ts`
Expected: TUTTI verdi (la firma di selectTarget non è cambiata; se hai estratto `targetingContext`, il comportamento è identico → i test lo confermano).

- [ ] **Step 7: Commit**

```bash
git add types/combat.ts game/engine/combat/targeting.ts tests/engine/combat/explainTarget.test.ts
git commit -m "feat(combat): explainTarget — il motivo del bersaglio (taunt/dive/backline/weakest/threat)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Emetti `reason` sulla LogEntry (solo azioni offensive)

Aggiungi `reason?` a LogEntry e attaccalo nel sim solo per gli attacchi verso un nemico.

**Files:**
- Modify: `types/combat.ts` (aggiungi `reason?: TargetReason` a LogEntry)
- Modify: `game/engine/combat/simulate.ts` (attacca reason dopo pushLog, per azioni offensive)
- Test: `tests/engine/combat/targetingReason.test.ts` (nuovo) — sul sim end-to-end

**Interfaces:**
- Consumes: `explainTarget` (Task 1); `LogEntry` (types).
- Produces: `LogEntry.reason?: TargetReason`. Nel sim, le entry di attacco verso un nemico portano `reason` valorizzato quando applicabile; le entry di cura/difesa/revive NON hanno reason.

- [ ] **Step 1: Write the failing test**

Crea `tests/engine/combat/targetingReason.test.ts`. Riusa il builder di battaglia di `tests/engine/combat/simulate.test.ts` (`grep -n "simulateBattle\|team\|dw" tests/engine/combat/simulate.test.ts`).

```ts
import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
// riusa il builder di squadre/seed dei test simulate

describe('LogEntry.reason nel sim', () => {
  it('le azioni di attacco verso un nemico portano un reason', () => {
    const res = simulateBattle(/* left, right, seed */)
    const atk = res.log.find(e => e.type === 'Attacco' && e.targetSide !== e.actorSide && (e.value ?? 0) > 0)
    expect(atk?.reason).toBeTruthy()
  })
  it('le cure NON hanno reason', () => {
    const res = simulateBattle(/* una squadra con un guaritore + un ferito */)
    const heal = res.log.find(e => e.flags.includes('heal'))
    if (heal) expect(heal.reason).toBeUndefined()
  })
})
```

(Adatta ai builder reali. Il gate è "un attacco ha reason, una cura no" — scegli seed/squadre che producano entrambi, o spezza in due scenari mirati.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/combat/targetingReason.test.ts`
Expected: FAIL — nessuna entry ha `reason` (non è ancora emesso).

- [ ] **Step 3: Aggiungi reason a LogEntry**

In `types/combat.ts`, dentro `interface LogEntry`, dopo `duoId?`:

```ts
  /** Perché quest'azione ha scelto il suo bersaglio (solo azioni offensive). Osservativo: la UI
   *  lo usa per la riga-causa. NON serializzato per l'anti-cheat (il combat log non lo è). */
  reason?: TargetReason
```

(Importa `TargetReason` se il tipo è in un altro modulo; se è nello stesso file, nessun import.)

- [ ] **Step 4: Emetti reason nel sim**

In `game/engine/combat/simulate.ts`, DOPO `pushLog(entry)` (`:279`), aggiungi (prima o dopo il blocco reflect, indifferente):

```ts
      // MOTIVO DEL TARGETING (osservativo): solo per un'azione offensiva verso un nemico —
      // cura/difesa/revive puntano a un alleato (realTarget sovrascritto) e non hanno un "perché
      // di bersaglio nemico". explainTarget rispecchia i rami di selectTarget.
      if (realTarget.side !== actor.side && !entry.flags.includes('heal')) {
        const reason = explainTarget(actor, allies, enemies, spell)
        if (reason) entry.reason = reason
      }
```

(Importa `explainTarget` da `./targeting` in cima a simulate.ts se non già importato — `selectTarget` è già importato dallo stesso modulo, aggiungi `explainTarget` all'import.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/engine/combat/targetingReason.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + replay-safe + non-regressione**

Run: `npm run typecheck`
Expected: pulito.

Run: `npx vitest run tests/engine/endlessReplayParity.test.ts tests/engine/combat/`
Expected: verdi — `reason` è inerte per il replay (buildReplay non lo legge), `endlessReplayParity` resta 0-mismatch.

- [ ] **Step 7: Commit**

```bash
git add types/combat.ts game/engine/combat/simulate.ts tests/engine/combat/targetingReason.test.ts
git commit -m "feat(combat): emetti LogEntry.reason per le azioni offensive (perché quel bersaglio)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Guardia anti-divergenza + verifica balance

Un test che lega `explainTarget` a `selectTarget` (se il target è il Tank provocante, il motivo è 'taunt', ecc.) + conferma che il balance non è cambiato.

**Files:**
- Test: `tests/engine/combat/explainTarget.test.ts` (estendi con la corrispondenza)
- Verifica (non modifica): `tests/engine/campaignBalanceB.test.ts`

- [ ] **Step 1: Test di corrispondenza selectTarget ↔ explainTarget**

Aggiungi a `explainTarget.test.ts` un test che, per un set di scenari, verifica la COERENZA tra il bersaglio scelto e il motivo:

```ts
it('coerenza: se selectTarget colpisce il Tank provocante, il motivo è taunt', () => {
  const tgt = selectTarget(attaccante, allies, enemiesWithTank, attackSpell)
  expect(tgt?.wizard.role).toBe('Tank')
  expect(explainTarget(attaccante, allies, enemiesWithTank, attackSpell)).toBe('taunt')
})
it('coerenza: Tank senza taunt colpisce il più debole → weakest', () => {
  const weak = enemiesNoTank.reduce((a, b) => (a.hp < b.hp ? a : b))
  const tgt = selectTarget(tank, allies, enemiesNoTank, attackSpell)
  expect(tgt?.wizard.id).toBe(weak.wizard.id)
  expect(explainTarget(tank, allies, enemiesNoTank, attackSpell)).toBe('weakest')
})
```

(Importa anche `selectTarget` nel test. Adatta gli scenari alle fixture reali.)

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/engine/combat/explainTarget.test.ts`
Expected: PASS (i nuovi test di corrispondenza + quelli del Task 1).

- [ ] **Step 3: Verifica balance invariato + suite piena**

Run: `npm run typecheck && npm run test`
Expected: tutto verde. `campaignBalanceB` invariato (il target scelto non è cambiato — `selectTarget` è byte-identico nel comportamento). Se `campaignBalanceB` fosse cambiato, sarebbe un segnale che il refactor `targetingContext` ha alterato la logica → INDAGARE (non deve succedere).

- [ ] **Step 4: Commit**

```bash
git add tests/engine/combat/explainTarget.test.ts
git commit -m "test(combat): guardia anti-divergenza explainTarget↔selectTarget

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (spec: `docs/superpowers/specs/2026-07-13-targeting-reason-design.md`):
- Tipo `TargetReason` + map testi → Task 1. ✅
- `explainTarget` pura, rispecchia i rami, null per non-offensivo → Task 1. ✅
- `reason?` su LogEntry (persistito, osservativo) → Task 2. ✅
- Emissione solo azioni offensive (no cura/difesa) → Task 2 Step 4. ✅
- Anti-divergenza (test di corrispondenza) → Task 3. ✅
- Balance/replay/anti-cheat invariati → Task 2 Step 6 + Task 3 Step 3. ✅
- Firma selectTarget invariata (27 test verdi) → Task 1 Step 6. ✅

**Placeholder scan:** i punti "adatta alle fixture reali" riguardano il riuso dei builder di test esistenti (targeting.test.ts / simulate.test.ts) — il codice di produzione (`explainTarget`, il tipo, l'emissione) è mostrato per intero. La scelta helper-condiviso-vs-duplicazione in Task 1 Step 4 è esplicita con la raccomandazione (helper) e la rete di sicurezza (test di corrispondenza Task 3).

**Type consistency:** `TargetReason` (Task 1) usato in `LogEntry.reason` (Task 2) e in `explainTarget` return (Task 1). `targetingContext` (se estratto) condiviso tra selectTarget/explainTarget. `TARGET_REASON_LABEL` definito in Task 1, usato dalla Slice C (fuori scope qui).

**Ordine:** Task 1 (tipo + funzione pura, testata isolata) → Task 2 (emissione nel sim) → Task 3 (guardia + balance). Ogni task verde a sé. Nessuna cascata di tipi.
