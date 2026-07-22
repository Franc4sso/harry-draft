# Archetipo Carnefice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Creare l'archetipo Carnefice (esecuzione) come gemello del veleno: sinergia `spietatezza` (3 maghi taggati) che accende una valanga di uccisioni per-battaglia (kill → +ATK e +soglia esecuzione di squadra).

**Architecture:** Sinergia-dati che riaccende il branch execute morto + un flag `carnefice` su BattleUnit stampato da synergyTriggers + una valanga al kill-site di simulate.ts (entrambi i lati) + il Duo Mietitore differenziato come amplificatore. Motore minimo, replay determinismo preservato (nessun rng nuovo).

**Tech Stack:** TypeScript, Vitest. Path alias `@/` → root repo.

## Global Constraints

- **Determinismo replay (VINCOLO #1):** la valanga NON deve aggiungere rng né cambiare l'ordine dei draw. La kill è già deterministica. `tests/engine/endlessReplayParity.test.ts` DEVE restare verde; se rosso, STOP e riportare BLOCKED.
- `npm run test` (vitest) **NON esegue typecheck** — ogni task chiude con `npm run typecheck` verde.
- L'archetipo vale per ENTRAMBI i lati (player E nemici) — coerente col veleno. Il flag va stampato su left e right.
- `raccolto` usa `stack: 'stack'` (VERIFICATO, statuses.ts:64): ogni `applyStatus(unit,'raccolto')` pusha UNA entry fino a `maxStacks` (MAX_STAT_STACKS=3). "2 stack" = chiamare applyStatus DUE volte, NON un parametro count. `applyStatus` non ha param count.
- `BattleUnit` è in `types/combat.ts:47`; `reaper?: boolean` a riga 90 è il template del flag.
- Template sinergia (VERBATIM, synergies.ts:9): `{ id: 'tossicita', name: 'Tossicità', kind: 'origin', requires: { tag: 'veleno', count: 3 }, bonus: { keywordMult: { veleno: 0.5 } } }`.
- Numeri valanga = STIME tarabili: soglia step +0.05/kill, cap 0.6. Non ritarare al primo colpo; il tuning è al playtest (Task 4).
- Bilanciamento: il gate bot è archetype-blind (non costruisce 3-esecuzione team) → la valanga PLAYER non muove il gate. MA i nemici carnefice appaiono → il winRate può scendere (effetto reale, non artefatto).

---

### Task 1: Sinergia `spietatezza` + flag `carnefice`

**Files:**
- Modify: `data/synergies.ts` (voce spietatezza)
- Modify: `types/combat.ts` (campo `carnefice?` su BattleUnit)
- Modify: `game/engine/synergyTriggers.ts` (stampa flag)
- Test: `tests/engine/carnefice.test.ts` (create)

**Interfaces:**
- Consumes: `detectSynergies` (synergy.ts:19, generico tag+count), `teamExecute` (execute.ts:6, branch spietatezza già presente riga 17).
- Produces: la sinergia `spietatezza` (id per detectSynergies/execute.ts:17); il flag `BattleUnit.carnefice`.

- [ ] **Step 1: Scrivere i test che falliscono**

Create `tests/engine/carnefice.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { detectSynergies } from '@/game/engine/synergy'
import { teamExecute } from '@/game/engine/execute'
import type { DraftedWizard } from '@/types'

const dw = (id: string, tags: string[] = []): DraftedWizard =>
  ({ wizard: { id, role: 'Attaccante', house: 'Serpeverde', tags }, level: 1 } as unknown as DraftedWizard)

describe('sinergia spietatezza (archetipo Carnefice)', () => {
  it('si accende con 3 maghi esecuzione, non con 2', () => {
    const three = [dw('a', ['esecuzione']), dw('b', ['esecuzione']), dw('c', ['esecuzione'])]
    const two = [dw('a', ['esecuzione']), dw('b', ['esecuzione'])]
    expect(detectSynergies(three).map(s => s.synergy.id)).toContain('spietatezza')
    expect(detectSynergies(two).map(s => s.synergy.id)).not.toContain('spietatezza')
  })

  it('riaccende il branch execute morto: threshold>=0.35 con la sinergia', () => {
    const team = [dw('a', ['esecuzione']), dw('b', ['esecuzione']), dw('c', ['esecuzione'])]
    const syn = detectSynergies(team)
    const ex = teamExecute(team, [], syn)
    expect(ex).toBeDefined()
    expect(ex!.threshold).toBeGreaterThanOrEqual(0.35)
    expect(ex!.bonus).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Eseguire i test per verificare che falliscano**

Run: `npm run test -- tests/engine/carnefice.test.ts`
Expected: FAIL (spietatezza non esiste ancora).

- [ ] **Step 3: Aggiungere la sinergia**

In `data/synergies.ts`, aggiungere dentro l'array `SYNERGIES` (dopo tossicita, riga 9):
```ts
  { id: 'spietatezza', name: 'Spietatezza', kind: 'origin', requires: { tag: 'esecuzione', count: 3 }, bonus: { keywordMult: { esecuzione: 0.5 } } },
```

- [ ] **Step 4: Aggiungere il campo `carnefice` a BattleUnit**

In `types/combat.ts`, dopo `reaper?: boolean` (riga 90):
```ts
  carnefice?: boolean                                // SPIETATEZZA archetype (kill-snowball, both sides)
```

- [ ] **Step 5: Stampare il flag in synergyTriggers**

In `game/engine/synergyTriggers.ts`, dentro `registerSynergyTriggers`, dopo il blocco tossicita (riga 34-35), prima della chiusura funzione:
```ts
  const spietatezza = synergies.some(s => s.synergy.id === 'spietatezza')
  if (spietatezza) for (const u of units) u.carnefice = true
```
NB: la funzione ritorna presto se `!tossicita` (riga 28) — spostare quel return o ristrutturare così anche spietatezza-senza-tossicita stampa il flag. Verificare: il return anticipato `if (!tossicita) return` a riga 28 impedirebbe la stampa carnefice se non c'è tossicita. RISTRUTTURARE: rimuovere il return anticipato, gestire i due branch indipendentemente:
```ts
export function registerSynergyTriggers(bus, units, synergies, side) {
  const tossicita = synergies.some(s => s.synergy.id === 'tossicita')
  const spietatezza = synergies.some(s => s.synergy.id === 'spietatezza')
  if (spietatezza) for (const u of units) u.carnefice = true
  if (!tossicita) return
  for (const u of units) {
    bus.onReactive('onHit', (ctx) => ...)  // blocco tossicita invariato
  }
}
```

- [ ] **Step 6: Eseguire test + typecheck**

Run: `npm run test -- tests/engine/carnefice.test.ts` → PASS.
Run: `npm run typecheck` → nessun errore.

- [ ] **Step 7: Commit**

```bash
git add data/synergies.ts types/combat.ts game/engine/synergyTriggers.ts tests/engine/carnefice.test.ts
git commit -m "feat(archetype): sinergia Spietatezza + flag carnefice — riaccende execute, base del Carnefice"
```

---

### Task 2: La valanga al kill-site (+ATK e +soglia)

**Files:**
- Modify: `game/engine/duoEffects/reap.ts` (o nuovo helper) — `bumpExecuteThreshold`
- Modify: `game/engine/combat/simulate.ts` (branch valanga al kill-site ~377)
- Test: estendere `tests/engine/carnefice.test.ts`

**Interfaces:**
- Consumes: `maybeReap` (reap.ts:10), `u.carnefice` (Task 1), `u.execute.threshold` (mutabile, effects.ts lo rilegge).
- Produces: `bumpExecuteThreshold(team: BattleUnit[]): void`; la valanga attiva al kill-site per entrambi i lati.

- [ ] **Step 1: Scrivere il test che fallisce (battaglia end-to-end)**

Estendere `tests/engine/carnefice.test.ts` con un test che simula una battaglia dove un carnefice uccide e verifica che la soglia execute della squadra sia salita. NB: serve costruire una battaglia — guardare come `tests/engine/duoStress.test.ts` o `esecuzioneSweep.test.ts` costruiscono `simulateBattle` con team e sinergie, e replicare il pattern minimale. Il test asserisce: dopo una battaglia con `spietatezza` attiva e ≥1 kill del player, `execute.threshold` finale > threshold iniziale (0.35). Se costruire una battaglia completa è troppo fragile, testare `bumpExecuteThreshold` in isolamento (unità con execute → chiamata → threshold salito, capato) come test primario, e lasciare l'integrazione al sweep (Task 4).

```ts
import { bumpExecuteThreshold } from '@/game/engine/duoEffects/reap' // o dove vive
import type { BattleUnit } from '@/types'

describe('bumpExecuteThreshold (valanga soglia)', () => {
  it('alza la soglia execute della squadra, capata', () => {
    const u = (): BattleUnit => ({ execute: { threshold: 0.35, bonus: 0.25 } } as unknown as BattleUnit)
    const team = [u(), u()]
    bumpExecuteThreshold(team)
    expect(team[0]!.execute!.threshold).toBeCloseTo(0.40) // +0.05
    expect(team[1]!.execute!.threshold).toBeCloseTo(0.40) // squadra intera
    for (let i = 0; i < 20; i++) bumpExecuteThreshold(team)
    expect(team[0]!.execute!.threshold).toBeLessThanOrEqual(0.6) // cap
  })
  it('è un no-op sicuro su unità senza execute', () => {
    const team = [{} as BattleUnit]
    expect(() => bumpExecuteThreshold(team)).not.toThrow()
  })
})
```

- [ ] **Step 2: Eseguire il test per verificare che fallisca**

Run: `npm run test -- tests/engine/carnefice.test.ts`
Expected: FAIL (`bumpExecuteThreshold` non esiste).

- [ ] **Step 3: Implementare `bumpExecuteThreshold`**

In `game/engine/duoEffects/reap.ts` (accanto a maybeReap), aggiungere:
```ts
import type { BattleUnit } from '@/types'

const CARNEFICE_THRESHOLD_STEP = 0.05  // +5% soglia per kill (STIMA tarabile — playtest)
const CARNEFICE_THRESHOLD_CAP = 0.6    // tetto soglia (STIMA)

/** SPIETATEZZA (archetipo Carnefice): ogni kill di un carnefice alza la soglia di esecuzione
 *  della sua SQUADRA (l'oggetto execute è condiviso). Pura mutazione, no rng — non tocca il
 *  replay determinismo. No-op sicuro su unità senza execute. */
export function bumpExecuteThreshold(team: BattleUnit[]): void {
  for (const u of team) {
    if (u.execute) {
      u.execute.threshold = Math.min(CARNEFICE_THRESHOLD_CAP, u.execute.threshold + CARNEFICE_THRESHOLD_STEP)
    }
  }
}
```

- [ ] **Step 4: Agganciare la valanga al kill-site**

In `game/engine/combat/simulate.ts`, alla riga ~377 dove oggi c'è `if (actor.side === 'left' && actor.reaper) maybeReap(actor)`, aggiungere DOPO (o integrare) la valanga carnefice per ENTRAMBI i lati:
```ts
if (actor.carnefice) {
  maybeReap(actor)                              // +ATK: raccolto (scoped al killer, già così)
  bumpExecuteThreshold(actor.side === 'left' ? L : R)  // +soglia: la squadra del killer
}
```
Importare `bumpExecuteThreshold` in cima (accanto a `maybeReap, willReap`, riga 28).

**ATTENZIONE determinismo:** `maybeReap` oggi è scoped `actor.side === 'left'` (riga 377). Il branch carnefice invece vale per entrambi i lati (i nemici mietono). NON toccare la riga Mietitore esistente (`if (actor.side === 'left' && actor.reaper) maybeReap(actor)`) — aggiungere il branch carnefice come blocco SEPARATO, così un player unit con SIA reaper SIA carnefice riceverebbe raccolto due volte. GESTIRE: se `actor.reaper && actor.carnefice`, non chiamare maybeReap due volte per lo stesso stack base — vedi Task 3 per la logica Mietitore-raddoppia. Per Task 2, il branch carnefice chiama `maybeReap(actor)` UNA volta; il Mietitore (Task 3) aggiunge lo stack extra. Ristrutturare il kill-site così:
```ts
// Valanga Carnefice (archetipo, entrambi i lati) + Mietitore (Duo, raddoppia)
if (actor.carnefice) {
  maybeReap(actor)
  if (actor.reaper) maybeReap(actor)            // MIETITORE: 2° stack (Task 3)
  bumpExecuteThreshold(actor.side === 'left' ? L : R)
} else if (actor.side === 'left' && actor.reaper) {
  maybeReap(actor)                              // Mietitore senza archetipo (retrocompat)
}
```
NB: verificare l'interazione col marchio `reaped` a riga 348 (che marca `duoId:'mietitore'`) — il marchio resta per il caso reaper; la valanga carnefice-pura non marca mietitore. Questo è delicato: leggere il blocco 342-353 e assicurarsi che il marchio KO resti coerente (non marcare mietitore quando è solo carnefice senza reaper). Se il marchio diverge, aggiornarlo con cura mantenendo il replay parity.

- [ ] **Step 5: Test + typecheck + PARITÀ**

Run: `npm run test -- tests/engine/carnefice.test.ts` → PASS.
Run: `npm run test -- tests/engine/endlessReplayParity.test.ts --disable-console-intercept` → PASS (mismatches=0). **Se rosso → STOP, riportare BLOCKED.**
Run: `npm run typecheck` → nessun errore.

- [ ] **Step 6: Commit**

```bash
git add game/engine/duoEffects/reap.ts game/engine/combat/simulate.ts tests/engine/carnefice.test.ts
git commit -m "feat(archetype): valanga Carnefice al kill-site — +ATK e +soglia squadra, entrambi i lati"
```

---

### Task 3: Differenziare il Mietitore (amplificatore, non doppione)

**Files:**
- Modify: `game/engine/combat/simulate.ts` (già fatto in Task 2 Step 4 — verificare)
- Modify: eventuale testo/desc del Duo Mietitore (data/duos.ts desc)
- Test: estendere `tests/engine/carnefice.test.ts`

**Interfaces:**
- Consumes: la logica kill-site di Task 2.
- Produces: Mietitore = 2 stack raccolto per kill (raddoppia la valanga +ATK), distinto dalla valanga base (1 stack).

**NB:** la logica del doppio stack è già stata scritta in Task 2 Step 4 (`if (actor.reaper) maybeReap(actor)` per il 2° stack). Questo task VERIFICA e testa quella differenziazione, e aggiorna la desc del Duo. Se Task 2 l'ha già coperta correttamente, questo task è solo test + desc.

- [ ] **Step 1: Test della differenziazione**

Estendere `carnefice.test.ts` — un carnefice CON Mietitore attivo prende 2 stack raccolto per kill, uno SENZA ne prende 1. Testare via `maybeReap`/conteggio stack su un'unità simulata, o via battaglia. Pattern minimale:
```ts
import { maybeReap } from '@/game/engine/duoEffects/reap'
describe('Mietitore raddoppia la mietitura', () => {
  it('carnefice+reaper → 2 stack per kill; solo carnefice → 1', () => {
    const mk = () => ({ side: 'left', wizard: { id: 'x' }, statusEffects: [] } as any)
    const both = mk()
    // simula il kill-site: carnefice sempre 1 maybeReap, +1 se reaper
    maybeReap(both); maybeReap(both)  // carnefice + reaper = 2 chiamate
    expect(both.statusEffects.filter((e: any) => e.statusId === 'raccolto').length).toBe(2)
    const only = mk()
    maybeReap(only)                   // solo carnefice = 1
    expect(only.statusEffects.filter((e: any) => e.statusId === 'raccolto').length).toBe(1)
  })
})
```

- [ ] **Step 2: Eseguire il test**

Run: `npm run test -- tests/engine/carnefice.test.ts`
Expected: PASS se Task 2 ha implementato il doppio stack correttamente; altrimenti aggiustare il kill-site.

- [ ] **Step 3: Aggiornare la desc del Duo Mietitore**

In `data/duos.ts` (voce mietitore, ~riga 19), aggiornare `desc` per riflettere il nuovo ruolo di amplificatore: da "ogni esecuzione dà +6 ATK" a qualcosa come "RADDOPPIA la mietitura del Carnefice: ogni uccisione dà il doppio del Raccolto". Mantenere il tono italiano esistente.

- [ ] **Step 4: Test + typecheck**

Run: `npm run test -- tests/engine/carnefice.test.ts` → PASS.
Run: `npm run typecheck` → nessun errore.

- [ ] **Step 5: Commit**

```bash
git add game/engine/combat/simulate.ts data/duos.ts tests/engine/carnefice.test.ts
git commit -m "feat(archetype): Mietitore differenziato — raddoppia la mietitura (amplificatore, non doppione)"
```

---

### Task 4: Bilanciamento — nemico-valanga + sweep

**Files:**
- Modify: `tests/engine/esecuzioneSweep.test.ts` (misurare la valanga)
- Verify: `tests/engine/campaignBalanceRestricted.test.ts`, `campaignBalanceB.test.ts`
- Modify (se serve): `game/engine/duoEffects/reap.ts` (tarare step/cap se il nemico-valanga rompe il floor)

**Interfaces:**
- Consumes: tutto il Carnefice (Task 1-3).
- Produces: conferma che il gate regge; sweep che misura l'uptake/snowball; eventuale taratura step/cap.

- [ ] **Step 1: Misurare i gate di bilanciamento**

Run: `npm run test -- tests/engine/campaignBalanceRestricted.test.ts tests/engine/campaignBalanceB.test.ts --disable-console-intercept`
Leggere i winRate. Il gate bot è archetype-blind per il PLAYER, ma i nemici carnefice (tema esecuzione auto-derivato) ora appaiono → il winRate potrebbe SCENDERE (nemici più forti). Registrare i numeri.

- [ ] **Step 2: Decidere se il movimento è accettabile**

- Se i gate restano verdi (asseriscono winRate∈[0,1] o >floor) → OK, nessuna taratura. Documentare il nuovo winRate con un commento datato.
- Se un gate SCENDE sotto il suo floor → è un effetto REALE (nemico-valanga forte), NON un artefatto. Tarare `CARNEFICE_THRESHOLD_STEP`/`CAP` (reap.ts) verso il basso finché il nemico-valanga è minaccioso ma non ingiusto, ri-misurando. NON escludere i nemici (li vogliamo). NON abbassare l'assert alla cieca — se scende, è potere nemico reale da bilanciare.
- Se `endlessReplayParity` è rosso → STOP (determinismo, va risolto prima di tutto).

- [ ] **Step 3: Estendere esecuzioneSweep per misurare la valanga**

In `tests/engine/esecuzioneSweep.test.ts`, aggiungere una misura del nuovo sistema: con una policy che bias-a esecuzione (isExec), misurare se `spietatezza` si accende (spietatezzaRate ora VIVA, prima era 0/dead) e il livello di snowball raggiunto. Aggiornare i commenti datati 2026-07-22 per riflettere che spietatezza è di nuovo viva. Se il vecchio floor `execUptake` si muove per l'interazione, ri-ancorare al valore misurato reale con nota.

- [ ] **Step 4: Suite completa + typecheck**

Run: `npm run test` → tutto verde (skip pre-esistente noto ok).
Run: `npm run typecheck` → nessun errore.

- [ ] **Step 5: Commit**

```bash
git add tests/engine/esecuzioneSweep.test.ts game/engine/duoEffects/reap.ts tests/engine/campaignBalanceRestricted.test.ts
git commit -m "test(archetype): Carnefice — misura valanga + verifica gate (nemico-valanga tarato)"
```

---

## Self-Review (autore)

- **Spec coverage:** §5a sinergia→Task1; §5b flag→Task1; §5c-5d valanga+soglia→Task2; §5e Mietitore→Task3; §7 testing+§9 bilanciamento→Task4. Determinismo (§9 #1) verificato in Task2 Step5 e Task4. ✅
- **Type consistency:** `bumpExecuteThreshold(team: BattleUnit[]): void`, `carnefice?: boolean`, `spietatezza` id — coerenti tra tutti i task. `maybeReap` chiamato più volte per lo stack (NON param count — VERIFICATO stack:'stack'). ✅
- **Placeholder scan:** nessun TBD; ogni step mostra codice. Le note (kill-site delicato, marchio KO, sweep fragile) danno criterio all'implementer, non buchi. ✅
- **Rischio noto documentato:** determinismo (Task2/4), kill-site marchio Mietitore (Task2 Step4), nemico-valanga bilanciamento (Task4), fragilità test-battaglia (Task2 Step1 fallback). ✅
- **Numeri verificati:** raccolto stack:'stack' cap MAX_STAT_STACKS=3 (statuses.ts:64); BattleUnit types/combat.ts:47/reaper:90; sinergia template synergies.ts:9; kill-site simulate.ts:377; detectSynergies generico synergy.ts:19. ✅
