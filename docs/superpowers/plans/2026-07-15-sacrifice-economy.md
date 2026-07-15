# Economia del Sacrificio (P5, Fase 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costo come meccanica: Corruzione (reliquia oscura → non curabile), Altare Oscuro (nodo raro con Reliquie del Sacrificio a costo esplicito), Patti (eventi con potere + rinuncia permanente).

**Architecture:** Un solo backbone `SacrificeCost` + `applySacrificeCost()` in `game/engine/sacrifice.ts`, consumato da altareResolver e dagli eventi (pattern trioGates — mai due implementazioni del "pagare"). `corrotto` vive su `DraftedWizard` e fluisce in `BattleUnit` gratis (extends); i gate stanno SOLO nei siti di cura. `runModifiers` su `RunState`, campi discreti.

**Tech Stack:** TypeScript, Vitest, Next.js (ATTENZIONE: Next.js NON standard — leggere `node_modules/next/dist/docs/` prima di codice UI). Engine puro senza React.

**Spec:** `docs/superpowers/specs/2026-07-15-sacrifice-economy-design.md`

## Global Constraints

- Branch: `sacrifice-economy`, merge --no-ff su master a fine piano (preferenza utente). Verificare HEAD prima di OGNI commit (repo con writer concorrente).
- `npm run test` NON typechecka → `npx tsc --noEmit` a parte, in ogni task.
- Suite completa: `npm run test` (vitest). Gate balance: `npx vitest run tests/engine/campaignBalanceB` (NON `tests/campaign` — path sbagliato = "no test files" exit 1).
- Pin balance intoccabili: STARTER_PICKS=3, elites≥2, normalCount=1, Voldemort unitCount=3, mai menace. NON toccare `BALANCE.draft.screenSize` (5 count-test sparsi). NON toccare `BALANCE.map.categoryWeights`.
- Player-only: reliquie sacrificio MAI ai nemici (selectEnemyRelics), MAI nei pool normali (offerRelics → anche shop), MAI in endless (altare escluso come shop/spellForge).
- No RNG non-deterministico: ogni offerta/chance deriva dal seed via `rng.fork(salt)`. Salt altare: 5000 (recruit 1000, relic 2000, event 3000, shop 4000).
- Costi SEMPRE dichiarati prima della scelta (principio P5). Convenzione resolver: scelta illegale → ritorna lo STESSO oggetto state (no-op reference-equal).
- Save: solo campi opzionali additivi — NESSUN bump VERSION in `lib/runStore.ts`.
- Commit message: conventional commits, footer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Decisioni chiuse (dal codice, vincolanti)

1. **Perimetro non-curabile del Corrotto**: niente tickHeal/regen (status.ts:142 + simulate.ts:426), niente magie Cura (effects.ts heal handler), targeting cura lo salta (simulate.ts:276 `mostWounded`), niente Infermeria, niente shop-heal, niente `healTeam` evento. ECCEZIONI DELIBERATE: `clearAreaAndAdvance` ripristina TUTTI (invariante del death-system: bleed HP cappato a una area — NON toccarlo) e `useConsumableRelic` 'revive' (resurrezione ≠ cura).
2. **HP max = `stats.hp`**: `toBattleUnits` deriva maxHp da `buffed.hp` (stats). Il costo maxHp taglia `stats.hp` E `maxHp` E clampa `currentHp`, floor 1.
3. **Buff dei patti baked**: `buffTeamPct` moltiplica le stats permanentemente alla firma. Nessun moltiplicatore runtime nel combat path. `RunModifiers` v1 = `{ noRecruits?: true }` soltanto.
4. **Niente migrazione eventi esistenti** (patto/coppa_maledetta/ombra): funzionano già via removeWizard/gamble; migrare = churn a comportamento identico (YAGNI). Restano patti "tematici".
5. **Reliquie sacrificio NON assignable** (v1): il costo è nel `sacrificeCost`, non nell'assegnazione. Nessuna interazione con la Corruzione (che scatta solo su grantsDarkMagic assegnate).

---

### Task 1: Backbone `SacrificeCost` + `runModifiers`

**Files:**
- Create: `game/engine/sacrifice.ts`
- Modify: `types/run.ts` (RunState + nuovo tipo RunModifiers)
- Test: `tests/engine/sacrifice.test.ts`

**Interfaces:**
- Produces: `SacrificeCost` (union), `canPay(state, cost): boolean`, `applySacrificeCost(state, cost): RunState` (no-op reference-equal se invalido), `RunState.runModifiers?: RunModifiers`.

- [ ] **Step 1: Tipi su types/run.ts**

Dopo `PendingLevelUp` (types/run.ts:73) aggiungi:

```ts
/** Modificatori permanenti di run firmati con un Patto (P5). Campi discreti, tutti opzionali. */
export interface RunModifiers {
  /** Voto Infrangibile: nessuna recluta per il resto della run (resolver + eventi addWizard no-op). */
  noRecruits?: true
}
```

e in `RunState` (dopo `endless?: boolean`):

```ts
  runModifiers?: RunModifiers
```

- [ ] **Step 2: Test fallenti**

`tests/engine/sacrifice.test.ts` — usa il builder di team dei test esistenti (vedi `tests/engine/trios.test.ts` per il pattern `unit()`/fixture; qui serve un `RunState` minimo):

```ts
import { describe, it, expect } from 'vitest'
import { canPay, applySacrificeCost, type SacrificeCost } from '@/game/engine/sacrifice'
import { createDraftPool } from '@/game/engine/draft'
import { createRng } from '@/game/engine/rng'
import { draftWizard } from '@/game/engine/statRoll'
import { RELIC_BY_ID } from '@/data/relics'
import type { RunState } from '@/types'

function stateWith(teamSize: number, relicIds: string[] = []): RunState {
  const rng = createRng('sac-test')
  const pool = createDraftPool()
  const team = pool.slice(0, teamSize).map(w => draftWizard(rng, w, true))
  return {
    seed: 'sac-test', phase: 'map', team, activeSynergies: [], stage: 0,
    relics: relicIds.map(id => ({ relic: RELIC_BY_ID[id]!, stageObtained: 0 })),
  }
}

describe('canPay', () => {
  it('wizard: richiede team >= 2 (mai sotto 1)', () => {
    const s2 = stateWith(2)
    expect(canPay(s2, { kind: 'wizard', wizardId: s2.team[0]!.wizard.id })).toBe(true)
    const s1 = stateWith(1)
    expect(canPay(s1, { kind: 'wizard', wizardId: s1.team[0]!.wizard.id })).toBe(false)
  })
  it('relic: richiede la reliquia posseduta', () => {
    expect(canPay(stateWith(2, ['giratempo']), { kind: 'relic', relicId: 'giratempo' })).toBe(true)
    expect(canPay(stateWith(2), { kind: 'relic', relicId: 'giratempo' })).toBe(false)
  })
  it('maxHp: floor 1 — rifiuta se scenderebbe a 0', () => {
    const s = stateWith(2)
    const id = s.team[0]!.wizard.id
    expect(canPay(s, { kind: 'maxHp', wizardId: id, amount: 30 })).toBe(true)
    expect(canPay(s, { kind: 'maxHp', wizardId: id, amount: 99999 })).toBe(false)
  })
  it('runModifier: sempre pagabile se non già attivo', () => {
    const s = stateWith(2)
    expect(canPay(s, { kind: 'runModifier', modifier: 'noRecruits' })).toBe(true)
    const signed = { ...s, runModifiers: { noRecruits: true as const } }
    expect(canPay(signed, { kind: 'runModifier', modifier: 'noRecruits' })).toBe(false)
  })
})

describe('applySacrificeCost', () => {
  it('wizard: rimuove il mago e ricalcola le sinergie', () => {
    const s = stateWith(3)
    const gone = s.team[0]!.wizard.id
    const out = applySacrificeCost(s, { kind: 'wizard', wizardId: gone })
    expect(out.team.map(d => d.wizard.id)).not.toContain(gone)
    expect(out.team).toHaveLength(2)
    expect(out.activeSynergies).toBeDefined()
  })
  it('relic: rimuove la reliquia', () => {
    const s = stateWith(2, ['giratempo'])
    const out = applySacrificeCost(s, { kind: 'relic', relicId: 'giratempo' })
    expect(out.relics).toHaveLength(0)
  })
  it('maxHp: taglia stats.hp E maxHp e clampa currentHp', () => {
    const s = stateWith(2)
    const dw = s.team[0]!
    const out = applySacrificeCost(s, { kind: 'maxHp', wizardId: dw.wizard.id, amount: 20 })
    const cut = out.team.find(d => d.wizard.id === dw.wizard.id)!
    expect(cut.maxHp).toBe(dw.maxHp - 20)
    expect(cut.stats.hp).toBe(dw.stats.hp - 20)
    expect(cut.currentHp ?? cut.maxHp).toBeLessThanOrEqual(cut.maxHp)
  })
  it('runModifier: setta il flag', () => {
    const out = applySacrificeCost(stateWith(2), { kind: 'runModifier', modifier: 'noRecruits' })
    expect(out.runModifiers?.noRecruits).toBe(true)
  })
  it('costo invalido: no-op reference-equal (convenzione resolver)', () => {
    const s = stateWith(1)
    expect(applySacrificeCost(s, { kind: 'wizard', wizardId: s.team[0]!.wizard.id })).toBe(s)
    expect(applySacrificeCost(s, { kind: 'relic', relicId: 'giratempo' })).toBe(s)
  })
})
```

- [ ] **Step 3: Run → RED**

Run: `npx vitest run tests/engine/sacrifice.test.ts`
Expected: FAIL (`Cannot find module '@/game/engine/sacrifice'`)

- [ ] **Step 4: Implementazione `game/engine/sacrifice.ts`**

```ts
import type { RunModifiers, RunState } from '@/types'
import { detectSynergies } from './synergy'
import { livingOf } from './roster'

/**
 * P5 — Economia del Sacrificio. UNICA fonte del "pagare un costo" (spec 2026-07-15):
 * consumata sia dall'altareResolver sia dagli EventEffect dei Patti. Mai duplicare
 * questa logica altrove (stesso principio di trioGates).
 */
export type SacrificeCost =
  | { kind: 'wizard'; wizardId: string }
  | { kind: 'relic'; relicId: string }
  | { kind: 'maxHp'; wizardId: string; amount: number }
  | { kind: 'runModifier'; modifier: keyof RunModifiers }

export function canPay(state: RunState, cost: SacrificeCost): boolean {
  switch (cost.kind) {
    case 'wizard':
      return state.team.length >= 2 && state.team.some(d => d.wizard.id === cost.wizardId)
    case 'relic':
      return state.relics.some(a => a.relic.id === cost.relicId)
    case 'maxHp': {
      const dw = state.team.find(d => d.wizard.id === cost.wizardId)
      return !!dw && dw.maxHp - cost.amount >= 1
    }
    case 'runModifier':
      return !state.runModifiers?.[cost.modifier]
  }
}

/** Applica il costo. Pure. Scelta invalida → ritorna LO STESSO oggetto state
 *  (convenzione resolver per il no-op, vedi runEngine.resolveCurrentChecked). */
export function applySacrificeCost(state: RunState, cost: SacrificeCost): RunState {
  if (!canPay(state, cost)) return state
  switch (cost.kind) {
    case 'wizard': {
      const team = state.team.filter(d => d.wizard.id !== cost.wizardId)
      return { ...state, team, activeSynergies: detectSynergies(livingOf(team)) }
    }
    case 'relic':
      return { ...state, relics: state.relics.filter(a => a.relic.id !== cost.relicId) }
    case 'maxHp': {
      const team = state.team.map(d => {
        if (d.wizard.id !== cost.wizardId) return d
        const maxHp = d.maxHp - cost.amount
        const stats = { ...d.stats, hp: d.stats.hp - cost.amount }
        const cur = d.currentHp ?? d.maxHp
        return { ...d, stats, maxHp, currentHp: Math.max(1, Math.min(cur, maxHp)) }
      })
      return { ...state, team }
    }
    case 'runModifier':
      return { ...state, runModifiers: { ...state.runModifiers, [cost.modifier]: true } }
  }
}
```

- [ ] **Step 5: Run → GREEN + tsc + suite piena**

Run: `npx vitest run tests/engine/sacrifice.test.ts` → PASS (tutti)
Run: `npx tsc --noEmit` → exit 0
Run: `npm run test` → tutte verdi

- [ ] **Step 6: Commit**

```bash
git add types/run.ts game/engine/sacrifice.ts tests/engine/sacrifice.test.ts
git commit -m "feat(sacrifice): SacrificeCost backbone + RunState.runModifiers"
```

---

### Task 2: Corruzione — stato + stamp all'equipaggiamento

**Files:**
- Modify: `types/combat.ts` (DraftedWizard, riga ~26)
- Modify: `game/engine/sacrifice.ts` (helper `corruptOnAssign`)
- Modify: `game/engine/resolvers/recruit.ts` (relicResolver.resolve, righe 48-57)
- Modify: `game/engine/resolvers/shop.ts` (shopResolver.resolve, ramo relic righe 51-54)
- Test: `tests/engine/corruzione.test.ts`

**Interfaces:**
- Consumes: nulla di Task 1 (helper nuovo nello stesso modulo).
- Produces: `DraftedWizard.corrotto?: true`; `corruptOnAssign(team, relic, wizardId): DraftedWizard[]` (identità se la reliquia non è grantsDarkMagic o il mago non c'è).

- [ ] **Step 1: Campo tipo**

In `types/combat.ts`, dentro `DraftedWizard` dopo `growthChoices?: GrowthChoice[]`:

```ts
  /** P5 Corruzione: marchiato per sempre dall'aver equipaggiato una reliquia grantsDarkMagic.
   *  PERMANENTE (resta anche se la reliquia sparisce). Effetto: NON CURABILE — nessun
   *  regen/cura in battaglia, niente Infermeria/shop-heal/healTeam. Eccezioni deliberate:
   *  recovery di fine area (clearAreaAndAdvance) e revive (Lacrime di Fenice). */
  corrotto?: true
```

- [ ] **Step 2: Test fallenti**

`tests/engine/corruzione.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { corruptOnAssign } from '@/game/engine/sacrifice'
import { relicResolver } from '@/game/engine/resolvers/recruit'
import { createDraftPool } from '@/game/engine/draft'
import { createRng } from '@/game/engine/rng'
import { draftWizard } from '@/game/engine/statRoll'
import { RELIC_BY_ID } from '@/data/relics'
import type { RunState } from '@/types'

const rng = createRng('corr-test')
const team = () => createDraftPool().slice(0, 3).map(w => draftWizard(createRng('corr-test'), w, true))

describe('corruptOnAssign', () => {
  it('marchia il carrier su reliquia grantsDarkMagic', () => {
    const t = team()
    const out = corruptOnAssign(t, RELIC_BY_ID['marchio-nero']!, t[0]!.wizard.id)
    expect(out[0]!.corrotto).toBe(true)
    expect(out[1]!.corrotto).toBeUndefined()
  })
  it('identità su reliquia non oscura o carrier assente', () => {
    const t = team()
    expect(corruptOnAssign(t, RELIC_BY_ID['giratempo']!, t[0]!.wizard.id)).toBe(t)
    expect(corruptOnAssign(t, RELIC_BY_ID['marchio-nero']!, 'nessuno')).toBe(t)
  })
})

describe('relicResolver + corruzione', () => {
  it('relic-pick di marchio-nero con assignedTo corrompe il carrier', () => {
    const t = team()
    const state: RunState = {
      seed: 'corr-test', phase: 'relic-node', team: t, activeSynergies: [], stage: 0, relics: [],
      area: 0, map: [{ id: 'a0f1n0', type: 'relic', next: [] }], currentNodeId: 'a0f1n0',
    }
    // Forza l'offerta a contenere marchio-nero non è deterministico dal seed di test:
    // qui testiamo direttamente il ramo resolve con l'offerta reale del nodo.
    // Se l'offerta del seed non contiene marchio-nero, il resolve è no-op → il test
    // usa corruptOnAssign già coperto sopra; QUESTO test integra via un seed che lo offre.
    // Trova un seed che offre marchio-nero (loop deterministico sui seed):
    let found: { state: RunState; relicId: string } | null = null
    for (let i = 0; i < 200 && !found; i++) {
      const s = { ...state, seed: `corr-${i}` }
      const offer = relicResolver.enter(s, s.map![0]!, createRng(s.seed)).offers.relicIds ?? []
      if (offer.includes('marchio-nero')) found = { state: s, relicId: 'marchio-nero' }
    }
    expect(found).not.toBeNull()
    const out = relicResolver.resolve(found!.state, found!.state.map![0]!,
      { kind: 'relic-pick', relicId: found!.relicId, assignedTo: t[0]!.wizard.id }, createRng(found!.state.seed))
    expect(out.team.find(d => d.wizard.id === t[0]!.wizard.id)!.corrotto).toBe(true)
  })
})
```

- [ ] **Step 3: Run → RED**

Run: `npx vitest run tests/engine/corruzione.test.ts`
Expected: FAIL (`corruptOnAssign` non esportato)

- [ ] **Step 4: Implementazione**

In `game/engine/sacrifice.ts` (import `Relic`, `DraftedWizard` da `@/types`):

```ts
/** P5 Corruzione: l'ATTO di assegnare una reliquia grantsDarkMagic marchia il carrier per
 *  sempre. Solo qui — il bonus dark da synergy 'oscurita' NON corrompe (nessuna scelta di
 *  equipaggiamento = nessun costo). Identità (reference-equal) se non applicabile. */
export function corruptOnAssign(team: DraftedWizard[], relic: Relic, wizardId: string): DraftedWizard[] {
  if (!relic.grantsDarkMagic) return team
  const target = team.find(d => d.wizard.id === wizardId)
  if (!target || target.corrotto) return team
  return team.map(d => (d.wizard.id === wizardId ? { ...d, corrotto: true as const } : d))
}
```

In `relicResolver.resolve` (game/engine/resolvers/recruit.ts:55-56), prima del return, dopo aver costruito `active`:

```ts
    const team = choice.assignedTo ? corruptOnAssign(state.team, relic, choice.assignedTo) : state.team
    return { ...state, team, relics: [...state.relics, active], log: [...(state.log ?? []), ev] }
```

(import `corruptOnAssign` da `../sacrifice`; il vecchio return usava `state.relics` senza team — sostituisci integralmente.)

In `shopResolver.resolve` (game/engine/resolvers/shop.ts:51-54), ramo `slot.kind === 'relic'`:

```ts
    if (slot.kind === 'relic') {
      if (!slot.relic) return state
      const active = { relic: slot.relic, stageObtained: state.stage, ...(choice.carrierId ? { assignedTo: choice.carrierId } : {}) }
      const team = choice.carrierId ? corruptOnAssign(next.team, slot.relic, choice.carrierId) : next.team
      next = { ...next, team, relics: [...next.relics, active] }
    }
```

- [ ] **Step 5: Run → GREEN + tsc + suite piena**

Run: `npx vitest run tests/engine/corruzione.test.ts` → PASS
Run: `npx tsc --noEmit` → exit 0
Run: `npm run test` → verdi

- [ ] **Step 6: Commit**

```bash
git add types/combat.ts game/engine/sacrifice.ts game/engine/resolvers/recruit.ts game/engine/resolvers/shop.ts tests/engine/corruzione.test.ts
git commit -m "feat(corruzione): DraftedWizard.corrotto + stamp su assegnazione reliquia oscura"
```

---

### Task 3: Corrotto in battaglia — 4 gate di cura

**Files:**
- Modify: `game/engine/status.ts:142` (tickHeal)
- Modify: `game/engine/combat/simulate.ts:426` (team regen end-of-turn) e `:276` (targeting mostWounded)
- Modify: `game/engine/combat/effects.ts:141-144` (heal handler)
- Test: `tests/engine/corruzioneBattle.test.ts`

**Interfaces:**
- Consumes: `corrotto` (Task 2) — fluisce in BattleUnit automaticamente (`BattleUnit extends DraftedWizard`, spread in toBattleUnits:52).
- Produces: nessuna API nuova, solo gate.

**NOTA MEMORIA "two regen paths":** il regen vive in DUE siti (tickHeal in status.ts + team-regen nel loop di simulate.ts). ENTRAMBI vanno gated, e il test copre ENTRAMBI esplicitamente.

- [ ] **Step 1: Test fallenti**

`tests/engine/corruzioneBattle.test.ts` — pattern fixture: copia il builder di team/battaglia da `tests/engine/trios.test.ts` (unit builder + simulateBattle con seed fisso). Casi:

```ts
import { describe, it, expect } from 'vitest'
import { tickStatuses, applyStatus } from '@/game/engine/status'
import { toBattleUnits, simulateBattle } from '@/game/engine/combat/simulate'
// ... import del builder di DraftedWizard usato in trios.test.ts

describe('Corrotto in battaglia', () => {
  it('tickHeal (status regen) NON cura un corrotto', () => {
    // costruisci un BattleUnit corrotto con hp < maxHp e uno status con tickHeal (es. 'regen'),
    // chiama tickStatuses e asserisci hp invariato; gemello non-corrotto → hp salito
  })
  it('team regen di fine turno NON cura un corrotto (simulate.ts)', () => {
    // simulateBattle con leftSyn/relic che dà regen di squadra (es. relic 'bezoar'),
    // team: un corrotto ferito + un sano ferito; nel log NON deve mai apparire una
    // riga 'Cura'/'Rigenerazione' con targetId = corrotto; deve apparire per il sano
  })
  it('magia Cura su corrotto vale 0 (heal handler)', () => {
    // resolveAction/effects: heal con target corrotto → value 0, hp invariato
  })
  it('il targeting delle cure salta i corrotti (mostWounded)', () => {
    // squadra: corrotto ferito gravissimo + alleato ferito lieve + Supporto con cura;
    // la cura deve andare all'alleato lieve, non al corrotto
  })
})
```

(Scrivi i 4 test COMPLETI seguendo i pattern di trios.test.ts: seed fisso, spd forzate per ordine turni deterministico, asserzioni sul log della battaglia.)

- [ ] **Step 2: Run → RED**

Run: `npx vitest run tests/engine/corruzioneBattle.test.ts`
Expected: FAIL sui 4 casi (i corrotti oggi vengono curati)

- [ ] **Step 3: I 4 gate**

`game/engine/status.ts:142`:

```ts
    if (tickHeal && unit.hp > 0 && !unit.corrotto) {
```

(aggiungi al commento esistente: `// Corrotto (P5): mai curato — gate speculare a simulate.ts team-regen.`)

`game/engine/combat/simulate.ts:426`:

```ts
      if (u.alive && regen[u.side] > 0 && !u.corrotto) {
```

`game/engine/combat/simulate.ts:276`:

```ts
        : healIntent
          ? (mostWounded(allies.filter(a => a.alive && !a.corrotto)) ?? actor)
```

`game/engine/combat/effects.ts` heal handler, dopo il gate `!ctx.target.alive` (riga 144):

```ts
    if (ctx.target.corrotto) return { value: 0 } // Corrotto (P5): non curabile
```

- [ ] **Step 4: Run → GREEN + tsc + suite piena**

Run: `npx vitest run tests/engine/corruzioneBattle.test.ts` → PASS
Run: `npx tsc --noEmit` → exit 0
Run: `npm run test` → verdi (attenzione a fixture esistenti che assumono cura universale)

- [ ] **Step 5: Commit**

```bash
git add game/engine/status.ts game/engine/combat/simulate.ts game/engine/combat/effects.ts tests/engine/corruzioneBattle.test.ts
git commit -m "feat(corruzione): il Corrotto non è curabile in battaglia (4 gate)"
```

---

### Task 4: Corrotto fuori battaglia — nodi cura + eccezioni deliberate

**Files:**
- Modify: `game/engine/resolvers/infirmary.ts:9`
- Modify: `game/engine/resolvers/shop.ts:56` (ramo heal)
- Modify: `game/engine/events.ts:50-59` (healTeam)
- Test: `tests/engine/corruzioneRun.test.ts`

**Interfaces:**
- Consumes: `corrotto` (Task 2).
- Produces: nessuna API nuova.

- [ ] **Step 1: Test fallenti**

`tests/engine/corruzioneRun.test.ts` (builder RunState come in sacrifice.test.ts, con un corrotto ferito: `{ ...dw, corrotto: true, currentHp: 10 }`):

```ts
describe('Corrotto fuori battaglia', () => {
  it('Infermeria non cura il corrotto (gli altri sì)', () => { /* infirmaryResolver.resolve → corrotto currentHp 10, sano full */ })
  it('shop heal non cura il corrotto', () => { /* shopResolver resolve slot heal */ })
  it('healTeam evento salta il corrotto, cura gli altri', () => { /* applyEventEffects [{kind:'healTeam',pct:1}] */ })
  it('ECCEZIONE: clearAreaAndAdvance ripristina ANCHE il corrotto (invariante death-system)', () => {
    /* clearAreaAndAdvance → corrotto currentHp === maxHp. NON "aggiustare" questo test:
       il recovery di fine area cappa il bleed HP a una singola area (vedi commento in
       runEngine.ts:212) e il bilanciamento del boss finale ci si appoggia. */
  })
  it('ECCEZIONE: useConsumableRelic revive rialza anche un corrotto morto', () => { /* lacrime-fenice */ })
})
```

(Test completi, non commenti — il worker li scrive per intero.)

- [ ] **Step 2: Run → RED** (le eccezioni passano già: nate verdi, servono da guard-rail)

- [ ] **Step 3: I 3 gate**

`infirmary.ts:9`:

```ts
    const team = state.team.map(dw => (dw.corrotto ? dw : { ...dw, currentHp: dw.maxHp }))
```

`shop.ts:56` (ramo heal):

```ts
      const healed = next.team.map(dw => (dw.corrotto ? dw : { ...dw, currentHp: dw.maxHp }))
```

`events.ts:52` (healTeam):

```ts
        const team = s.team.map(dw => {
          if (dw.corrotto) return dw
          const healed = Math.min(dw.maxHp, currentHp(dw) + Math.round(dw.maxHp * effect.pct))
          return { ...dw, currentHp: healed }
        })
```

- [ ] **Step 4: Run → GREEN + tsc + suite piena** (comandi come Task 3)

- [ ] **Step 5: Commit**

```bash
git add game/engine/resolvers/infirmary.ts game/engine/resolvers/shop.ts game/engine/events.ts tests/engine/corruzioneRun.test.ts
git commit -m "feat(corruzione): gate cure fuori battaglia + guard-rail eccezioni deliberate"
```

---

### Task 5: Reliquie del Sacrificio — data + esclusioni pool

**Files:**
- Modify: `types/relic.ts` (campo `sacrificeCost`)
- Modify: `data/relics.ts` (5 reliquie + pool)
- Modify: `game/engine/relics.ts` (esclusioni + `offerSacrifices`)
- Test: `tests/engine/sacrificeRelics.test.ts`

**Interfaces:**
- Produces: `Relic.sacrificeCost?: { kind: 'wizard' } | { kind: 'relic' } | { kind: 'maxHp'; amount: number }` (template del costo — la SELEZIONE arriva dalla scelta del giocatore); `SACRIFICE_RELIC_IDS: string[]`; `offerSacrifices(rng, owned): Relic[]`.

- [ ] **Step 1: Tipo**

In `types/relic.ts`, dentro `Relic` dopo `drawback?`:

```ts
  /** P5 — Reliquia del Sacrificio (solo Altare Oscuro): template del costo d'acquisizione.
   *  La selezione concreta (quale mago/reliquia) è nella scelta altare-buy. Player-only:
   *  esclusa da offerRelics/selectEnemyRelics (vedi SACRIFICE_SET in game/engine/relics.ts). */
  sacrificeCost?: { kind: 'wizard' } | { kind: 'relic' } | { kind: 'maxHp'; amount: number }
```

- [ ] **Step 2: Test fallenti**

`tests/engine/sacrificeRelics.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { RELICS, RELIC_BY_ID, SACRIFICE_RELIC_IDS, JOKER_RELIC_IDS } from '@/data/relics'
import { offerRelics, offerJokers, offerSacrifices, selectEnemyRelics } from '@/game/engine/relics'
import { createRng } from '@/game/engine/rng'

describe('Reliquie del Sacrificio — pool', () => {
  it('le 5 reliquie esistono, epiche, con sacrificeCost e non assignable', () => {
    expect(SACRIFICE_RELIC_IDS).toHaveLength(5)
    for (const id of SACRIFICE_RELIC_IDS) {
      const r = RELIC_BY_ID[id]!
      expect(r.rarity).toBe('epica')
      expect(r.sacrificeCost).toBeDefined()
      expect(r.assignable).toBeUndefined()
      expect(JOKER_RELIC_IDS).not.toContain(id)
    }
  })
  it('offerRelics non offre MAI una reliquia sacrificio (200 draw)', () => {
    for (let i = 0; i < 200; i++) {
      const ids = offerRelics(createRng(`s-${i}`), [], 0).map(r => r.id)
      for (const id of ids) expect(SACRIFICE_RELIC_IDS).not.toContain(id)
    }
  })
  it('selectEnemyRelics non arma MAI un nemico con una sacrificio (200 draw)', () => {
    for (let i = 0; i < 200; i++) {
      const ids = selectEnemyRelics(createRng(`e-${i}`), 3).map(a => a.relic.id)
      for (const id of ids) expect(SACRIFICE_RELIC_IDS).not.toContain(id)
    }
  })
  it('offerSacrifices offre 2-3 sacrificio distinte non possedute', () => {
    const out = offerSacrifices(createRng('alt-0'), [])
    expect(out.length).toBeGreaterThanOrEqual(2)
    expect(out.length).toBeLessThanOrEqual(3)
    expect(new Set(out.map(r => r.id)).size).toBe(out.length)
    for (const r of out) expect(SACRIFICE_RELIC_IDS).toContain(r.id)
  })
})
```

- [ ] **Step 3: Run → RED**

- [ ] **Step 4: Data — 5 reliquie in `data/relics.ts`** (in coda a RELICS, prima della chiusura array; numeri direzionali epica-level, balance-safe perché player-only e mai nel bot draft — stesso ragionamento dei joker, commento in data/relics.ts:48-52):

```ts
  // --- P5: Reliquie del Sacrificio (SOLO Altare Oscuro; player-only; costo esplicito) ---
  {
    id: 'diario-riddle', name: 'Diario di Tom Riddle', rarity: 'epica',
    desc: "Un'anima in cambio del potere: +15% a tutte le statistiche della squadra. COSTO: sacrifica un mago a tua scelta.",
    bonus: { allPct: 0.15 }, sacrificeCost: { kind: 'wizard' },
  },
  {
    id: 'mano-della-gloria', name: 'Mano della Gloria', rarity: 'epica',
    desc: 'Illumina solo chi la impugna: +30 Attacco e +15 Velocità. COSTO: perdi una reliquia a tua scelta.',
    bonus: { atk: 30, spd: 15 }, sacrificeCost: { kind: 'relic' },
  },
  {
    id: 'specchio-erised', name: 'Specchio delle Emarb', rarity: 'epica',
    desc: 'Mostra ciò che desideri, prende ciò che hai: +10% a tutte le statistiche e Rigenerazione +10. COSTO: perdi una reliquia a tua scelta.',
    bonus: { allPct: 0.10, regen: 10 }, sacrificeCost: { kind: 'relic' },
  },
  {
    id: 'calice-avvelenato', name: 'Calice Avvelenato', rarity: 'epica', keywords: ['veleno'],
    desc: 'Bevi: il danno da Veleno della squadra è raddoppiato. COSTO: un mago a tua scelta perde 40 vita massima per sempre.',
    keywordMult: { veleno: 1.0 }, sacrificeCost: { kind: 'maxHp', amount: 40 },
  },
  {
    id: 'corona-spettrale', name: 'Corona Spettrale', rarity: 'epica', keywords: ['esecuzione'],
    desc: 'Corona chi miete: i colpi infliggono +50% danni ai bersagli sotto il 40% di vita. COSTO: un mago a tua scelta perde 30 vita massima per sempre.',
    grantsExecute: { threshold: 0.4, bonus: 0.5 }, sacrificeCost: { kind: 'maxHp', amount: 30 },
  },
```

e in coda al file:

```ts
export const SACRIFICE_RELIC_IDS: string[] = [
  'diario-riddle', 'mano-della-gloria', 'specchio-erised', 'calice-avvelenato', 'corona-spettrale',
]
```

- [ ] **Step 5: Esclusioni + offerta in `game/engine/relics.ts`**

Import: `import { RELICS, JOKER_RELIC_IDS, SACRIFICE_RELIC_IDS } from '@/data/relics'`. Sotto `JOKER_SET`:

```ts
const SACRIFICE_SET = new Set(SACRIFICE_RELIC_IDS)
```

`selectEnemyRelics` (:183): `RELICS.filter(r => !JOKER_SET.has(r.id) && !SACRIFICE_SET.has(r.id))`
`offerRelics` (:196): `.filter(r => !ownedIds.has(r.id) && !JOKER_SET.has(r.id) && !SACRIFICE_SET.has(r.id))`
(`offerJokers` è già JOKER-only; `shopOffer` passa da offerRelics → coperto.)

Nuova offerta (stesso stile uniforme di offerJokers):

```ts
/** P5 — Offerta dell'Altare Oscuro: 2-3 Reliquie del Sacrificio non possedute, pick
 *  uniforme (tutte epiche). Sempre disponibili (non gated dagli unlock). Deterministica. */
export function offerSacrifices(rng: Rng, owned: ActiveRelic[]): Relic[] {
  const ownedIds = new Set(owned.map(o => o.relic.id))
  const pool = RELICS.filter(r => SACRIFICE_SET.has(r.id) && !ownedIds.has(r.id))
  const count = Math.min(3, pool.length)
  const remaining = [...pool]
  const chosen: Relic[] = []
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng.next() * remaining.length)
    chosen.push(remaining[idx]!)
    remaining.splice(idx, 1)
  }
  return chosen
}
```

(Nota: con 5 reliquie il minimo naturale è 2 solo quando ne possiedi già 3+ — il test usa owned=[] → 3. Correggi l'asserzione del test se serve: `toBe(3)` con owned vuoto.)

- [ ] **Step 6: Run → GREEN + tsc + suite piena**

- [ ] **Step 7: Commit**

```bash
git add types/relic.ts data/relics.ts game/engine/relics.ts tests/engine/sacrificeRelics.test.ts
git commit -m "feat(sacrifice): 5 Reliquie del Sacrificio, pool player-only + offerSacrifices"
```

---

### Task 6: Nodo Altare — generatore mappa

**Files:**
- Modify: `types/run.ts` (RunNodeType + RunPhase + RunEvent.kind)
- Modify: `game/engine/nodeGen.ts` (piazzamento ~30%/area)
- Modify: `game/engine/runEngine.ts:119-121` (phaseForNode)
- Test: `tests/engine/altareNode.test.ts`

**Interfaces:**
- Produces: RunNodeType `'altare'`, RunPhase `'altare-node'`, RunEvent.kind `'altare'`; nodeGen piazza 0-1 altare per area (mai in endless).

- [ ] **Step 1: Tipi**

`types/run.ts`: aggiungi `| 'altare'` a RunNodeType (riga ~15, gruppo Fasi 2-3), `| 'altare-node'` a RunPhase (riga 8), `| 'altare'` a RunEvent.kind (riga 65).

- [ ] **Step 2: Test fallenti**

`tests/engine/altareNode.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateArea } from '@/game/engine/map'
import { areaRng } from '@/game/engine/runEngine'

const bias = { teamSize: 3, teamMax: 5 }

describe('Nodo Altare — generazione', () => {
  it('~30% delle aree ha ESATTAMENTE un altare (mai 2+), banda [15%, 45%] su 300 aree', () => {
    let with1 = 0
    for (let i = 0; i < 300; i++) {
      const nodes = generateArea(areaRng(`alt-${i}`, 0), `alt-${i}`, 0, bias)
      const n = nodes.filter(nd => nd.type === 'altare').length
      expect(n).toBeLessThanOrEqual(1)
      if (n === 1) with1++
    }
    expect(with1 / 300).toBeGreaterThan(0.15)
    expect(with1 / 300).toBeLessThan(0.45)
  })
  it("l'altare non ruba MAI i garantiti: infermeria pre-boss, elite, >=1 relic restano", () => {
    for (let i = 0; i < 100; i++) {
      const nodes = generateArea(areaRng(`alt-${i}`, 0), `alt-${i}`, 0, bias)
      expect(nodes.filter(n => n.type === 'infirmary')).toHaveLength(1)
      expect(nodes.filter(n => n.type === 'elite')).toHaveLength(1)
      expect(nodes.filter(n => n.type === 'relic').length).toBeGreaterThanOrEqual(1)
    }
  })
  it('endless: MAI un altare (evita il soft-lock del controller endless)', () => {
    for (let i = 0; i < 100; i++) {
      const nodes = generateArea(areaRng(`alt-${i}`, 0), `alt-${i}`, 0, bias, true)
      expect(nodes.filter(n => n.type === 'altare')).toHaveLength(0)
    }
  })
  it('deterministico: stesso seed → stessa mappa', () => {
    const a = generateArea(areaRng('alt-det', 1), 'alt-det', 1, bias)
    const b = generateArea(areaRng('alt-det', 1), 'alt-det', 1, bias)
    expect(a.map(n => n.type)).toEqual(b.map(n => n.type))
  })
})
```

- [ ] **Step 3: Run → RED**

- [ ] **Step 4: Piazzamento in `nodeGen.ts`**

In `assignAreaCategories`, DOPO il blocco "3. Guarantee >=1 relic" e PRIMA del blocco filler (riga ~80). Costante in cima al file: `const ALTARE_CHANCE = 0.3`.

```ts
  // 3b. P5 — Altare Oscuro: ~30% delle aree ne piazza ESATTAMENTE UNO su uno slot libero
  //     (raro e casuale — scelta utente 2026-07-15: mai garantito, sempre evitabile perché
  //     ogni floor medio è largo 3). Escluso in endless: il controller endless non ha un
  //     handler altare (stesso motivo dell'esclusione shop/spellForge) e il corto-circuito
  //     `!endless` NON consuma il roll → gli stream rng endless restano identici a prima.
  if (!endless && rng.next() < ALTARE_CHANCE) {
    const pool = free()
    if (pool.length > 0) {
      const s = rng.pick(pool)
      setCat(cats, s.floor, s.idx, 'altare')
      used.add(key(s.floor, s.idx))
    }
  }
```

**NOTA DETERMINISMO (il worker DEVE capirla):** inserire un draw rng qui SPOSTA tutti i draw successivi → le mappe campagna generate dopo questo commit differiscono da prima (atteso: è il punto del task; il balance A/B del Task 10 rimisura). Endless salta il roll (`!endless` corto-circuita PRIMA di `rng.next()`) → anche gli stream endless cambiano? NO: `!endless` è `true` in campagna (roll consumato) e `false` in endless (roll NON consumato) — gli stream endless restano identici a prima del task SOLO se il roll non viene consumato, che è ciò che fa il corto-circuito. Verifica con il test endless sopra + suite endless esistente.

- [ ] **Step 5: phaseForNode in `runEngine.ts:119-121`**

```ts
const phaseForNode = (t: RunNode['type']): RunState['phase'] =>
  t === 'recruit' ? 'recruit-node' : t === 'relic' ? 'relic-node' : t === 'infirmary' ? 'infirmary-node' :
  t === 'event' ? 'event-node' : t === 'spellForge' ? 'spellForge-node' : t === 'shop' ? 'shop-node' :
  t === 'altare' ? 'altare-node' : 'battle'
```

- [ ] **Step 6: Run → GREEN + tsc + suite piena.** Test di mappa/nodeGen esistenti possono rompersi se enumerano i tipi ammessi: aggiornali aggiungendo 'altare' all'insieme atteso (MAI cambiando i garantiti).

- [ ] **Step 7: Commit**

```bash
git add types/run.ts game/engine/nodeGen.ts game/engine/runEngine.ts tests/engine/altareNode.test.ts
git commit -m "feat(altare): nodo Altare Oscuro ~30%/area (mai endless), phase altare-node"
```

---

### Task 7: altareResolver

**Files:**
- Modify: `game/engine/resolvers/types.ts:4-11` (ResolverChoice)
- Create: `game/engine/resolvers/altare.ts`
- Modify: `game/engine/runEngine.ts:33-45` (registrazione)
- Test: `tests/engine/altareResolver.test.ts`

**Interfaces:**
- Consumes: `offerSacrifices` (Task 5), `canPay`/`applySacrificeCost`/`SacrificeCost` (Task 1).
- Produces: choice `{ kind: 'altare-buy'; relicId: string; costWizardId?: string; costRelicId?: string }`; `altareOffer(state, node, rng): Relic[]` (salt 5000); resolver id `'altare'`. `'skip'` (già esistente) = vai via.

- [ ] **Step 1: ResolverChoice** — aggiungi in `types.ts`:

```ts
  | { kind: 'altare-buy'; relicId: string; costWizardId?: string; costRelicId?: string }
```

- [ ] **Step 2: Test fallenti**

`tests/engine/altareResolver.test.ts` (builder RunState con nodo `{ id: 'a0f1n0', type: 'altare', next: [] }`):

```ts
describe('altareResolver', () => {
  it('enter offre 2-3 sacrificio deterministiche per (seed, nodo)', () => { /* enter due volte → stessi relicIds; tutti in SACRIFICE_RELIC_IDS */ })
  it('buy con costo wizard: reliquia entra, mago esce, sinergie ricalcolate', () => { /* diario-riddle + costWizardId */ })
  it('buy con costo relic: reliquia scelta rimossa, sacrificio aggiunta', () => { /* mano-della-gloria + costRelicId */ })
  it('buy con costo maxHp: stats.hp e maxHp tagliati sul bersaglio', () => { /* calice-avvelenato + costWizardId */ })
  it('costo non pagabile → no-op reference-equal (team da 1 per costo wizard)', () => {})
  it('relicId fuori offerta → no-op reference-equal', () => {})
  it('skip → no-op reference-equal (il runner marca resolved e torna alla mappa)', () => {})
  it('log RunEvent kind altare con il nome della reliquia', () => {})
})
```

(Test completi. Per selezionare la reliquia giusta nell'offerta: `enter` restituisce i relicIds — trova un seed che offre quella voluta con il loop deterministico come in corruzione.test.ts, o compra la prima offerta e branch sul suo sacrificeCost.kind.)

- [ ] **Step 3: Run → RED**

- [ ] **Step 4: Implementazione `game/engine/resolvers/altare.ts`**

```ts
import type { Relic, RunEvent, RunNode, RunState } from '@/types'
import type { Rng } from '../rng'
import { parseAreaNodeId } from '../map'
import { offerSacrifices } from '../relics'
import { canPay, applySacrificeCost, type SacrificeCost } from '../sacrifice'
import type { NodeResolver } from './types'

/** Deterministica per (seed, node id) — salt 5000 (recruit 1000 / relic 2000 / event 3000 / shop 4000). */
export function altareOffer(state: RunState, node: RunNode, rng: Rng): Relic[] {
  const { area, floor, idx } = parseAreaNodeId(node.id)
  const r = rng.fork(5000 + area * 100 + floor * 10 + idx)
  return offerSacrifices(r, state.relics)
}

/** Concretizza il template di costo della reliquia con la selezione del giocatore.
 *  null = selezione mancante/malformata (→ no-op del resolver, mai un default silenzioso). */
function concreteCost(relic: Relic, choice: { costWizardId?: string; costRelicId?: string }): SacrificeCost | null {
  const t = relic.sacrificeCost
  if (!t) return null
  switch (t.kind) {
    case 'wizard': return choice.costWizardId ? { kind: 'wizard', wizardId: choice.costWizardId } : null
    case 'relic': return choice.costRelicId ? { kind: 'relic', relicId: choice.costRelicId } : null
    case 'maxHp': return choice.costWizardId ? { kind: 'maxHp', wizardId: choice.costWizardId, amount: t.amount } : null
  }
}

export const altareResolver: NodeResolver = {
  id: 'altare',
  enter: (state, node, rng) => ({ offers: { relicIds: altareOffer(state, node, rng).map(r => r.id) }, isCombat: false }),
  resolve: (state, node, choice, rng) => {
    if (choice.kind !== 'altare-buy') return state
    const relic = altareOffer(state, node, rng).find(r => r.id === choice.relicId)
    if (!relic) return state
    const cost = concreteCost(relic, choice)
    if (!cost || !canPay(state, cost)) return state
    const paid = applySacrificeCost(state, cost)
    if (paid === state) return state
    const ev: RunEvent = { area: state.area ?? 0, nodeId: node.id, kind: 'altare',
      summary: `All'Altare Oscuro ottieni ${relic.name}, pagando il suo prezzo` }
    return { ...paid, relics: [...paid.relics, { relic, stageObtained: paid.stage }], log: [...(paid.log ?? []), ev] }
  },
}
```

Registrazione in `runEngine.ts` (import + riga dopo shopResolver):

```ts
  registerResolver(altareResolver)                 // id 'altare'
```

- [ ] **Step 5: Run → GREEN + tsc + suite piena**

- [ ] **Step 6: Commit**

```bash
git add game/engine/resolvers/types.ts game/engine/resolvers/altare.ts game/engine/runEngine.ts tests/engine/altareResolver.test.ts
git commit -m "feat(altare): altareResolver — buy con costo esplicito via backbone sacrifice"
```

---

### Task 8: Patti — EventEffect + noRecruits + 2 eventi nuovi

**Files:**
- Modify: `data/events.ts` (EventEffect union + 2 eventi)
- Modify: `game/engine/events.ts` (3 case nuovi + gate addWizard)
- Modify: `game/engine/resolvers/recruit.ts:29` (gate noRecruits)
- Test: `tests/engine/patti.test.ts`

**Interfaces:**
- Consumes: `applySacrificeCost`/`canPay` (Task 1), `RunModifiers` (Task 1).
- Produces: EventEffect `{ kind: 'sacrificeCost'; cost: SacrificeCost }`, `{ kind: 'setRunModifier'; modifier: keyof RunModifiers }`, `{ kind: 'buffTeamPct'; pct: number }`; eventi `voto_infrangibile`, `patto_della_fame`.

- [ ] **Step 1: Tipi in `data/events.ts`** (import type `SacrificeCost` da `@/game/engine/sacrifice`, `RunModifiers` da `@/types`):

```ts
  | { kind: 'sacrificeCost'; cost: SacrificeCost }
  | { kind: 'setRunModifier'; modifier: keyof RunModifiers }
  | { kind: 'buffTeamPct'; pct: number }
```

- [ ] **Step 2: Test fallenti**

`tests/engine/patti.test.ts`:

```ts
describe('EventEffect nuovi', () => {
  it('sacrificeCost delega al backbone (wizard rimosso)', () => {})
  it('setRunModifier: noRecruits settato', () => {})
  it('buffTeamPct: stats e maxHp scalati (+20% → round), currentHp assoluto invariato', () => {})
})
describe('noRecruits gate', () => {
  it('recruitResolver.resolve è no-op reference-equal con noRecruits', () => {})
  it('addWizard evento è no-op con noRecruits', () => {})
})
describe('Voto Infrangibile (integrazione)', () => {
  it("scegliendo 'giura': +20% stats a tutti, noRecruits attivo, e il recruit successivo fallisce", () => {})
})
```

(Test completi con applyEventEffects + EVENT_BY_ID.)

- [ ] **Step 3: Run → RED**

- [ ] **Step 4: Case in `applyEventEffects`** (game/engine/events.ts, nel switch dopo 'gamble'; import `applySacrificeCost` da `./sacrifice`):

```ts
      case 'sacrificeCost': {
        const paid = applySacrificeCost(s, effect.cost)
        if (paid === s) { log.push(`sacrificeCost UNPAYABLE ${effect.cost.kind}`); break }
        s = paid
        log.push(`sacrificeCost ${effect.cost.kind}`)
        break
      }
      case 'setRunModifier': {
        s = { ...s, runModifiers: { ...s.runModifiers, [effect.modifier]: true } }
        log.push(`setRunModifier ${effect.modifier}`)
        break
      }
      case 'buffTeamPct': {
        const m = 1 + effect.pct
        const team = s.team.map(dw => ({
          ...dw,
          stats: { hp: Math.round(dw.stats.hp * m), atk: Math.round(dw.stats.atk * m),
                   def: Math.round(dw.stats.def * m), spd: Math.round(dw.stats.spd * m) },
          maxHp: Math.round(dw.maxHp * m),
        }))
        s = { ...s, team }
        log.push(`buffTeamPct ${effect.pct}`)
        break
      }
```

e nel case `addWizard` (riga 86), come PRIMA riga:

```ts
        if (s.runModifiers?.noRecruits) { log.push('addWizard blocked (noRecruits)'); break }
```

- [ ] **Step 5: Gate in `recruitResolver.resolve`** (recruit.ts:30, dopo il check del kind):

```ts
    if (state.runModifiers?.noRecruits) return state // Voto Infrangibile (P5): mai più reclute
```

- [ ] **Step 6: I 2 eventi in `EVENTS`** (data/events.ts, in coda all'array):

```ts
  {
    id: 'voto_infrangibile',
    title: 'Il Voto Infrangibile',
    text: 'Una promessa sigillata nella magia più antica: la squadra che hai è la squadra che avrai. Per sempre.',
    choices: [
      { id: 'giura', label: 'Giura (+20% a tutte le statistiche · MAI più reclute, per sempre)',
        effects: [{ kind: 'buffTeamPct', pct: 0.20 }, { kind: 'setRunModifier', modifier: 'noRecruits' }],
        resultText: 'Il filo dorato vi lega i polsi. Siete già completi — o non lo sarete mai.' },
      { id: 'rifiuta', label: 'Rifiuta', effects: [], resultText: 'Il filo si dissolve. La porta resta aperta.' },
    ],
  },
  {
    id: 'patto_della_fame',
    title: 'Il Patto della Fame',
    text: 'La fame divora la carne e nutre il potere. Un morso oggi, la forza per sempre.',
    choices: [
      { id: 'firma', label: 'Firma (+10% a tutte le statistiche · tutti perdono subito il 30% della vita)',
        effects: [{ kind: 'buffTeamPct', pct: 0.10 }, { kind: 'damageTeam', pct: 0.30 }],
        resultText: 'Il morso arriva. Poi, la forza.' },
      { id: 'rifiuta', label: 'Rifiuta', effects: [], resultText: 'La fame resta fuori dalla porta. Per ora.' },
    ],
  },
```

- [ ] **Step 7: Run → GREEN + tsc + suite piena.** ATTENZIONE: test esistenti che enumerano/contano `EVENTS` (pickEvent uniforme) potrebbero rompersi — aggiorna i count, MAI i garantiti.

- [ ] **Step 8: Commit**

```bash
git add data/events.ts game/engine/events.ts game/engine/resolvers/recruit.ts tests/engine/patti.test.ts
git commit -m "feat(patti): sacrificeCost/setRunModifier/buffTeamPct + Voto Infrangibile e Patto della Fame"
```

---

### Task 9: UI — AltareScreen, badge Corrotto, avvisi

**Files:**
- Create: `components/screens/AltareScreen.tsx`
- Modify: `components/screens/RunBRunner.tsx` (case 'altare', vicino a case 'relic' :204 e 'shop' :229)
- Modify: `components/screens/MapScreen.tsx` (icona/label nodo altare)
- Modify: componente card mago (badge Corrotto — individua il componente vivo: `WizardCardColumn`, memoria "Live draft card") + `components/screens/RelicNodeScreen.tsx`/`ShopScreen.tsx` (avviso Corruzione su assegnazione grantsDarkMagic) + `components/screens/RecruitScreen.tsx` (stato bloccato con noRecruits)
- Test: `tests/` — segui il pattern dei test UI esistenti (es. quelli del DuoPanel, `data-testid`)

**Interfaces:**
- Consumes: `altareOffer`/choice `altare-buy` (Task 7), `corrotto` (Task 2), `runModifiers.noRecruits` (Task 8), `SACRIFICE_RELIC_IDS` (Task 5).

**Direttive vincolanti (non c'è codice fisso qui — segui i pattern):**
- PRIMA di scrivere JSX: leggi `node_modules/next/dist/docs/` per le convenzioni di QUESTO Next.js (AGENTS.md) e 2-3 screen esistenti (`RelicNodeScreen.tsx`, `ShopScreen.tsx`, `EventScreen.tsx`).
- Premium UI: riusa classi condivise/GameShell/motion primitives (memoria "Premium UI system") — NIENTE stili ad-hoc.
- AltareScreen: 2-3 carte reliquia con POTERE e COSTO sempre visibili prima della conferma; se il costo richiede una selezione (mago/reliquia) → picker esplicito; bottone "Vai via" sempre presente (→ choice `{ kind: 'skip' }` e ritorno mappa come leaveShop); offerte non pagabili disabilitate con motivo visibile. `data-testid="altare-screen"`.
- Badge Corrotto: marker visivo su card mago (roster + battaglia) quando `corrotto`, con tooltip/testo "Corrotto — non curabile". `data-testid="corrotto-badge"`.
- Avviso Corruzione: nel flusso di assegnazione di una reliquia `grantsDarkMagic` (RelicNodeScreen picker + ShopScreen carrier picker), testo esplicito: "⚠ Diventerà Corrotto — per sempre, non curabile." PRIMA della conferma.
- RecruitScreen + MapScreen: con `noRecruits`, il nodo recruit appare disabilitato/barrato e la screen mostra il motivo ("Il Voto Infrangibile è stato giurato").
- Test UI: render + assert su data-testid (pattern DuoPanel/trio-panel in tests esistenti); niente snapshot fragili.

- [ ] **Step 1: Leggi docs Next.js + 3 screen esistenti + pattern test UI**
- [ ] **Step 2: Test fallenti (AltareScreen render offerte+costi, badge corrotto, recruit bloccato)**
- [ ] **Step 3: Run → RED**
- [ ] **Step 4: Implementa AltareScreen + wiring RunBRunner/MapScreen**
- [ ] **Step 5: Implementa badge + avvisi + recruit bloccato**
- [ ] **Step 6: Run → GREEN + `npx tsc --noEmit` + suite piena**
- [ ] **Step 7: Commit**

```bash
git add components/ tests/
git commit -m "feat(altare): AltareScreen premium + badge Corrotto + avvisi costo"
```

---

### Task 10: Balance A/B + chiusura

**Files:**
- Modify: `game/engine/sacrifice.ts` (nota di bilanciamento in testa al file)
- Nessun altro file salvo esito A/B fuori banda.

- [ ] **Step 1: Misura POST** (branch): `npx vitest run tests/engine/campaignBalanceB` — annota `campaignBalanceRestricted` e l'overall (reference-only, atteso 0.0000).
- [ ] **Step 2: Misura PRE** (base): `git stash -u || true; git checkout master -- . ; ` NO — usa il metodo pulito della fase 2: `git worktree add /tmp/claude-1000/-home-cassano-wa-harry-draft/balance-base <merge-base>` e lancia lì lo stesso comando. Annota il valore. Rimuovi il worktree.
- [ ] **Step 3: Confronto.** Atteso: restricted INVARIATO o quasi (il bot near-optimal non compra all'Altare e non firma patti; ma il nodo altare SPOSTA la composizione mappa → piccole derive possibili). Banda: >0.07 floor, <0.45 ceiling, assert live winRate>0. FUORI BANDA → unica leva ammessa: `ALTARE_CHANCE` (0.3 → 0.25/0.2) o esclusione dell'altare dal conteggio slot. >1 ritocco → STOP, riporta i numeri (BLOCKED).
- [ ] **Step 4: Documenta** l'A/B (valori pre/post, seed count, ragionamento) in testa a `game/engine/sacrifice.ts` (pattern della nota in trios.ts).
- [ ] **Step 5: Commit** `balance(sacrifice): A/B campaignBalanceRestricted pre/post — <numeri>`.
- [ ] **Step 6: Review finale whole-branch** (requesting-code-review, come fase 2), fix Critical/Important, poi merge:

```bash
git checkout master && git merge --no-ff sacrifice-economy -m "Merge: Economia del Sacrificio (fase 3) — Corruzione, Altare Oscuro, Patti"
npx tsc --noEmit && npm run test
git push origin master
git branch -d sacrifice-economy
```

---

## Self-review (fatto in scrittura)

- Spec coverage: Corruzione (T2-T4), Altare (T5-T7, T9), Patti (T8), backbone unico (T1), balance (T10). Eccezioni non-curabile documentate e testate come guard-rail (T4). UI avvisi (T9).
- Tipi coerenti: `SacrificeCost` (T1) consumato in T7/T8; `corruptOnAssign` (T2) in T2 resolver; `offerSacrifices` (T5) in T7; `RunModifiers` (T1) in T8.
- Nessun placeholder: i punti "test completi" di T3/T4/T7/T8/T9 indicano il CONTENUTO caso per caso; il worker li scrive interi seguendo i pattern citati (trios.test.ts, DuoPanel).
