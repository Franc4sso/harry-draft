# Muro Vivente — Riflesso Scudo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Il Duo "Muro Vivente" passa da un retarget morto (i nemici già colpiscono il Tank per iron taunt) a un **riflesso scudo**: quando lo scudo del Tank col muro assorbe danno, l'attaccante subisce il 40% dell'assorbito (non letale).

**Architecture:** Il flag `livingWall` (già stampato solo sui Tank player in `stampDuoFields`) diventa un oggetto `{ reflect }`. Il damage handler (`effects.ts`) calcola il riflesso quando lo scudo assorbe e lo espone su `ctx.reflect`; `resolveAction` lo travasa in un campo transiente `_reflect` della `LogEntry`; `simulate.ts` lo legge, emette una **riga di log dedicata** puntata sull'attaccante (così il replay resta sincronizzato senza toccare `replay.ts`), accredita il Tank nel punteggio MVP, e scarta il campo transiente. Il vecchio retarget in `targeting.ts` viene rimosso.

**Tech Stack:** TypeScript, motore di combattimento deterministico (nessun React/DOM), Vitest.

## Global Constraints

- **Copy in italiano** (nomi Duo, desc, righe di log).
- **MAI fuoco amico** — garanzia strutturale: `livingWall` è player-only (`stamp.ts` lo mette solo sui Tank `left`), quindi in un colpo con `livingWall` il target è sempre `left` e l'attaccante sempre `right`.
- **NON reintrodurre `ignoresTaunt`** (pin utente 2026-07-08). Questo redesign è indipendente dal taunt.
- **Determinismo = anti-cheat**: nessuna nuova pescata rng; `endlessReplayParity` deve restare 0-mismatch (il replay ricostruisce gli HP da `entry.value` keyed su `entry.targetId` — la riga dedicata copre il riflesso).
- **`npm run test` NON esegue il typecheck** → `npm run typecheck` a parte dopo ogni task che tocca `.ts`.
- **Non letale**: il riflesso lascia l'attaccante ad almeno 1 HP.
- **Parametro di tuning**: la frazione riflessa è `0.4`, definita in un solo posto (lo stamp), non hardcoded nel handler.

---

### Task 1: `livingWall` diventa `{ reflect }` + tipo `EffectCtx.reflect`

Trasforma il flag booleano in un oggetto parametrico (coerente con `poisonAmp`/`coldExecute`) e aggiungi il canale d'uscita `reflect` a `EffectCtx`. Nessun comportamento nuovo ancora — solo tipi + stamp, con i consumatori esistenti aggiornati per compilare.

**Files:**
- Modify: `types/combat.ts:74` (campo `livingWall`)
- Modify: `game/engine/combat/effects.ts:9` (`EffectCtx`)
- Modify: `game/engine/duoEffects/stamp.ts:10` (stamp object)
- Modify: `game/engine/combat/targeting.ts:121` (il find legge `e.livingWall` come truthy — resta valido con un oggetto; verrà rimosso nel Task 4)
- Test: `tests/engine/duoEffects/muroVivente.test.ts` (nuovo — solo lo stamp per ora)

**Interfaces:**
- Produces:
  - `BattleUnit.livingWall?: { reflect: number }`
  - `EffectCtx.reflect?: { unitId: string; side: 'left' | 'right'; amount: number }`
  - `stampDuoFields` mette `u.livingWall = { reflect: 0.4 }` sui Tank `left` quando `muro-vivente` è attivo.

- [ ] **Step 1: Write the failing test**

Crea `tests/engine/duoEffects/muroVivente.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { ActiveDuo, BattleUnit, Wizard } from '@/types'
import { stampDuoFields } from '@/game/engine/duoEffects/stamp'
import { DUO_BY_ID } from '@/data/duos'

function wiz(id: string, role: Wizard['role']): Wizard {
  return { id, name: id, role, house: 'Grifondoro', tier: 'C', signatureId: 'sig' } as Wizard
}
function unit(id: string, role: Wizard['role'], side: 'left' | 'right'): BattleUnit {
  const w = wiz(id, role)
  return {
    wizard: w, spell: { id: 'base_attack', name: 'Attacco', type: 'Attacco' } as any,
    stats: { hp: 100, atk: 50, def: 10, spd: 10 }, maxHp: 100,
    buffedStats: { hp: 100, atk: 50, def: 10, spd: 10 }, hp: 100,
    cooldowns: {}, statusEffects: [], alive: true, side,
  } as BattleUnit
}
const muroDuo: ActiveDuo = { duo: DUO_BY_ID['muro-vivente']!, signals: ['scudirigen', 'taunt'] } as ActiveDuo

describe('Muro Vivente — stamp', () => {
  it('stampa livingWall = { reflect } sui Tank del player', () => {
    const tank = unit('tank', 'Tank', 'left')
    const carry = unit('carry', 'Attaccante', 'left')
    stampDuoFields([tank, carry], [], [muroDuo], 'normal')
    expect(tank.livingWall).toEqual({ reflect: 0.4 })
    expect(carry.livingWall).toBeUndefined()   // solo i Tank
  })

  it('non stampa nulla sui nemici', () => {
    const enemyTank = unit('etank', 'Tank', 'right')
    stampDuoFields([], [enemyTank], [muroDuo], 'normal')
    expect(enemyTank.livingWall).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/duoEffects/muroVivente.test.ts`
Expected: FAIL — `livingWall` è `true` (boolean), non `{ reflect: 0.4 }` → `toEqual` fallisce. (Se il tipo `ActiveDuo`/campi differiscono, aggiusta l'helper leggendo la vera forma da `types/` — NON cambiare l'asserzione sul valore.)

- [ ] **Step 3: Aggiorna il tipo, lo stamp e `EffectCtx`**

In `types/combat.ts:74`, cambia:

```ts
livingWall?: { reflect: number }                   // MURO VIVENTE (player Tanks): riflette una frazione del danno assorbito dallo scudo
```

In `game/engine/duoEffects/stamp.ts:10`, cambia la riga:

```ts
if (has('muro-vivente')) for (const u of left) if (u.wizard.role === 'Tank') u.livingWall = { reflect: 0.4 }
```

In `game/engine/combat/effects.ts:9`, estendi `EffectCtx`:

```ts
export interface EffectCtx { rng: Rng; turn: number; actor: BattleUnit; target: BattleUnit; flags: LogFlag[]; bus?: EventBus; allies?: BattleUnit[]; dark?: boolean; duoIds?: string[]; reflect?: { unitId: string; side: 'left' | 'right'; amount: number } }
```

In `game/engine/combat/targeting.ts:121`, il `find` usa `e.livingWall` come booleano — con un oggetto resta truthy, quindi **nessuna modifica necessaria qui in questo task** (la riga viene eliminata al Task 4).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/duoEffects/muroVivente.test.ts`
Expected: PASS (entrambi i test).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: nessun errore. (Se qualcosa legge `livingWall` come boolean altrove — cerca `grep -rn "livingWall" game/ components/` — il solo altro uso è `targeting.ts:121`, che resta truthy. Non toccare la UI.)

- [ ] **Step 6: Commit**

```bash
git add types/combat.ts game/engine/duoEffects/stamp.ts game/engine/combat/effects.ts tests/engine/duoEffects/muroVivente.test.ts
git commit -m "feat(duos): livingWall diventa { reflect } + canale ctx.reflect

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Il damage handler calcola il riflesso su `ctx.reflect`

Nel branch `damage`, dopo l'assorbimento, se il target è un Tank col muro e lo scudo ha mangiato danno, sottrai il riflesso all'attaccante (non letale) e stampa il dato su `ctx.reflect`. Nessuna riga di log ancora — solo la mutazione HP + il canale d'uscita.

**Files:**
- Modify: `game/engine/combat/effects.ts` (branch `damage`, subito dopo `const residual = absorbDamage(...)` — attualmente `effects.ts:81`)
- Test: `tests/engine/duoEffects/muroVivente.test.ts` (estendi)

**Interfaces:**
- Consumes: `BattleUnit.livingWall?: { reflect }`, `EffectCtx.reflect` (Task 1); `absorbDamage(unit, dmg): number` (residual post-scudo, `game/engine/status.ts:170`).
- Produces: dopo un `EFFECT_HANDLERS.damage(ctx, eff)` su un Tank col muro con scudo che assorbe, `ctx.actor.hp` è ridotto del riflesso (min 1) e `ctx.reflect = { unitId, side, amount }`.

- [ ] **Step 1: Write the failing test**

Aggiungi a `tests/engine/duoEffects/muroVivente.test.ts` (in cima importa gli handler + status):

```ts
import { EFFECT_HANDLERS } from '@/game/engine/combat/effects'
import { applyStatus } from '@/game/engine/status'
import { createRng } from '@/game/engine/rng'

function shielded(u: BattleUnit, amount: number) {
  // aggiunge uno scudo con `absorbLeft = amount` allo unit
  applyStatus(u, { kind: 'shield', statusId: 'shield', amount } as any, `${u.side}:seed`)
}

describe('Muro Vivente — riflesso (handler)', () => {
  function setup(reflect = 0.4, actorHp = 300) {
    const tank = unit('tank', 'Tank', 'left'); tank.livingWall = { reflect }
    const enemy = unit('enemy', 'Attaccante', 'right'); enemy.hp = actorHp; enemy.maxHp = 300
    return { tank, enemy }
  }

  it('riflette il 40% del danno ASSORBITO sull\'attaccante', () => {
    const { tank, enemy } = setup()
    shielded(tank, 500)   // scudo capiente: assorbe tutto
    const ctx: any = { rng: createRng('mv'), turn: 1, actor: enemy, target: tank, flags: [] }
    // atk 50 * power 1 - def... : usiamo un power alto per un colpo netto; l'importante è che lo scudo assorba
    EFFECT_HANDLERS.damage(ctx, { kind: 'damage', power: 1, canDodge: false } as any)
    const absorbed = 300 - tank.hp === 0 ? /* tutto assorbito */ null : null
    // Lo scudo capiente assorbe l'intero colpo → tank.hp resta 100
    expect(tank.hp).toBe(100)
    // ctx.reflect valorizzato, amount = round(dmg * 0.4), enemy.hp calato di quell'importo
    expect(ctx.reflect).toBeTruthy()
    expect(ctx.reflect.unitId).toBe('enemy')
    expect(ctx.reflect.side).toBe('right')
    expect(ctx.reflect.amount).toBeGreaterThan(0)
    expect(enemy.hp).toBe(300 - ctx.reflect.amount)
  })

  it('NON riflette se lo scudo è a 0 (nessun assorbimento)', () => {
    const { tank, enemy } = setup()
    // niente scudo
    const ctx: any = { rng: createRng('mv'), turn: 1, actor: enemy, target: tank, flags: [] }
    EFFECT_HANDLERS.damage(ctx, { kind: 'damage', power: 1, canDodge: false } as any)
    expect(ctx.reflect).toBeUndefined()
    expect(enemy.hp).toBe(300)
  })

  it('riflette solo sulla parte ASSORBITA quando lo scudo è più piccolo del colpo', () => {
    const { tank, enemy } = setup()
    shielded(tank, 10)   // scudo piccolo: assorbe 10, il resto passa al Tank
    const ctx: any = { rng: createRng('mv'), turn: 1, actor: enemy, target: tank, flags: [] }
    EFFECT_HANDLERS.damage(ctx, { kind: 'damage', power: 1, canDodge: false } as any)
    expect(ctx.reflect.amount).toBe(Math.round(10 * 0.4))   // = 4, solo l'assorbito
    expect(tank.hp).toBeLessThan(100)   // l'eccesso ha ferito il Tank
  })

  it('è NON letale: lascia l\'attaccante ad almeno 1 HP', () => {
    const { tank, enemy } = setup(0.4, 3)   // enemy a 3 HP
    shielded(tank, 500)
    const ctx: any = { rng: createRng('mv'), turn: 1, actor: enemy, target: tank, flags: [] }
    EFFECT_HANDLERS.damage(ctx, { kind: 'damage', power: 1, canDodge: false } as any)
    expect(enemy.hp).toBe(1)   // il riflesso non può uccidere
  })

  it('un Tank SENZA muro non riflette', () => {
    const tank = unit('tank', 'Tank', 'left')   // niente livingWall
    const enemy = unit('enemy', 'Attaccante', 'right')
    shielded(tank, 500)
    const ctx: any = { rng: createRng('mv'), turn: 1, actor: enemy, target: tank, flags: [] }
    EFFECT_HANDLERS.damage(ctx, { kind: 'damage', power: 1, canDodge: false } as any)
    expect(ctx.reflect).toBeUndefined()
    expect(enemy.hp).toBe(100)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/duoEffects/muroVivente.test.ts`
Expected: FAIL — `ctx.reflect` è sempre `undefined` (nessun blocco riflesso ancora). (Se un import — `applyStatus`, forma dello `shield` `EffectSpec`, `createRng` path — non combacia, correggi l'helper leggendo la vera firma da `game/engine/status.ts` / `types/status.ts`, senza toccare le asserzioni sul riflesso.)

- [ ] **Step 3: Implementa il riflesso nel branch `damage`**

In `game/engine/combat/effects.ts`, subito dopo `const residual = absorbDamage(ctx.target, dmg)` (l'assegnazione di `residual`, attualmente riga 81) e prima di `ctx.target.hp -= residual`:

```ts
    // MURO VIVENTE: il Tank col muro riflette una frazione del danno ASSORBITO dal suo scudo
    // sull'attaccante (non del colpo intero → si spegne quando lo scudo finisce). Non letale:
    // lascia l'attaccante ad almeno 1 HP. livingWall è player-only (stamp.ts) → il target è
    // sempre il player e l'attaccante sempre un nemico: mai fuoco amico. Emette il dato su
    // ctx.reflect; la riga di log + score li fa il sim (simulate.ts), come recoil/cold-execute.
    const lw = ctx.target.livingWall
    if (lw && ctx.target.side === 'left') {
      const absorbed = dmg - residual
      if (absorbed > 0 && ctx.actor.alive && ctx.actor.hp > 1) {
        const reflect = Math.min(ctx.actor.hp - 1, Math.round(absorbed * lw.reflect))
        if (reflect > 0) {
          ctx.actor.hp -= reflect
          ctx.reflect = { unitId: ctx.actor.wizard.id, side: ctx.actor.side, amount: reflect }
        }
      }
    }
```

(`dmg` è già la variabile del danno post-mitigazioni in quel punto; `residual` è ciò che è passato oltre lo scudo → `dmg - residual` è l'assorbito. La sottrazione a `ctx.actor.hp` è locale; il sim farà `sync`/log.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/duoEffects/muroVivente.test.ts`
Expected: PASS (tutti i test del blocco riflesso).

- [ ] **Step 5: Typecheck + suite piena**

Run: `npm run typecheck`
Expected: nessun errore.

Run: `npx vitest run tests/engine/darkRecoil.test.ts tests/engine/duos.test.ts tests/engine/duoStress.test.ts`
Expected: PASS — il nuovo blocco non tocca recoil/altri Duo (il gate è sul solo target `livingWall`).

- [ ] **Step 6: Commit**

```bash
git add game/engine/combat/effects.ts tests/engine/duoEffects/muroVivente.test.ts
git commit -m "feat(duos): Muro Vivente riflette il danno assorbito su ctx.reflect

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `resolveAction` travasa `ctx.reflect` → `entry._reflect`; il sim emette la riga + score

`resolveAction` ritorna una `LogEntry` (usata da molti test come singolo valore — NON cambiarne la firma). Aggiungi un campo transiente `_reflect` alla entry, poi in `simulate.ts` leggi/emetti la riga di log dedicata (che tiene sincronizzato il replay), accredita il Tank nel punteggio, e non far persistere il campo transiente.

**Files:**
- Modify: `types/combat.ts` (`LogEntry` + `_reflect?`)
- Modify: `game/engine/combat/resolve.ts:43-47` (travaso nel return)
- Modify: `game/engine/combat/simulate.ts` (dopo `pushLog(entry)` a `simulate.ts:279`)
- Test: `tests/engine/duoEffects/muroVivente.test.ts` (estendi con un mini-scenario di sim)

**Interfaces:**
- Consumes: `ctx.reflect` (Task 2); `resolveAction(rng, turn, actor, target, spell, allies?, bus?): LogEntry` (`resolve.ts:10`); `score` map + `sync(unit)` + `pushLog(entry)` in `simulate.ts`.
- Produces: nel log della battaglia compare una riga `{ action: 'MuroVivente', type: 'system', actorId: <tankId>, actorSide: 'left', targetId: <attaccante>, targetSide: 'right', value: <riflesso>, flags: ['duo'], duoId: 'muro-vivente' }`. `_reflect` non compare mai nelle righe loggate. Il punteggio del Tank cresce del riflesso.

- [ ] **Step 1: Write the failing test**

Aggiungi a `tests/engine/duoEffects/muroVivente.test.ts` un test end-to-end sul sim. Usa lo stesso helper di setup battaglia degli altri test Duo (guarda `tests/engine/duos.test.ts` / `tests/engine/duoStress.test.ts` per il builder `simulateBattle` con i Duo attivi — riusa quel pattern, non inventarne uno nuovo):

```ts
import { simulateBattle } from '@/game/engine/combat/simulate'
// ... costruisci una squadra player con 1 Tank (con scudo/che ottiene scudo) + attaccante,
// una squadra nemica, e attiva il Duo muro-vivente (leftDuos), come fanno gli altri test Duo.

describe('Muro Vivente — riga di log nel sim', () => {
  it('emette una riga MuroVivente puntata sull\'attaccante quando lo scudo assorbe', () => {
    const res = /* simulateBattle(...) con muro-vivente attivo e un Tank scudato colpito */ null as any
    const wall = res.log.find((e: any) => e.action === 'MuroVivente')
    expect(wall).toBeTruthy()
    expect(wall.type).toBe('system')
    expect(wall.duoId).toBe('muro-vivente')
    expect(wall.flags).toContain('duo')
    expect(wall.actorSide).toBe('left')       // il Tank col muro
    expect(wall.targetSide).toBe('right')     // l'attaccante nemico
    expect(wall.value).toBeGreaterThan(0)
    // nessuna riga loggata espone il campo transiente
    expect(res.log.every((e: any) => e._reflect === undefined)).toBe(true)
  })
})
```

Nota per l'implementer: se costruire una battaglia deterministica in cui lo scudo del Tank assorbe è laborioso, dai al Tank uno scudo di partenza via reliquia/status nella fixture (come i test scudo esistenti) e scegli un seed in cui il nemico colpisce il Tank (l'iron taunt lo garantisce quasi sempre). Il gate è "compare la riga MuroVivente col valore giusto", non un valore numerico specifico.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/duoEffects/muroVivente.test.ts -t "riga di log"`
Expected: FAIL — nessuna riga `MuroVivente` nel log (il sim non la emette ancora).

- [ ] **Step 3: Travaso in `resolveAction` + tipo transiente**

In `types/combat.ts`, dentro `interface LogEntry`, aggiungi dopo `duoId?: string`:

```ts
  /** Transiente (NON persistito nel RunLog): il riflesso del Muro Vivente prodotto da questa
   *  azione. `resolveAction` lo travasa da `ctx.reflect`; `simulate.ts` lo consuma per emettere
   *  la riga `MuroVivente` e lo scarta prima di loggare. Mai serializzato. */
  _reflect?: { unitId: string; side: Side; amount: number }
```

In `game/engine/combat/resolve.ts`, nel return finale (`resolve.ts:43-47`), aggiungi l'ultima riga di spread:

```ts
  return {
    turn, actorId: actor.wizard.id, actorSide: actor.side, action: spell.name,
    targetId: entryTarget.wizard.id, targetSide: entryTarget.side, type: spell.type, value, flags,
    ...(duoIds[0] ? { duoId: duoIds[0] } : {}),
    ...(ctx.reflect ? { _reflect: ctx.reflect } : {}),
  }
```

- [ ] **Step 4: Il sim emette la riga + score, poi scarta il transiente**

In `game/engine/combat/simulate.ts`, subito dopo `pushLog(entry)` (`simulate.ts:279`), inserisci:

```ts
      // MURO VIVENTE: se il colpo ha innescato un riflesso (il Tank col muro = realTarget aveva
      // scudo che ha assorbito), emetti una riga dedicata puntata sull'ATTACCANTE così il replay
      // (che ricostruisce gli HP da entry.value su targetId) resta sincronizzato senza modifiche.
      const ref = entry._reflect
      if (ref) {
        delete entry._reflect   // transiente: non deve finire nel RunLog
        pushLog({
          turn, actorId: realTarget.wizard.id, actorSide: 'left', action: 'MuroVivente',
          targetId: ref.unitId, targetSide: ref.side,
          type: 'system', value: ref.amount, flags: ['duo'], duoId: 'muro-vivente',
        })
        // MVP: accredita il Tank col muro (come i tick veleno accreditano il poisoner, simulate.ts:381-383).
        const k = `left:${realTarget.wizard.id}`
        score[k] = (score[k] ?? 0) + ref.amount
        sync(actor)   // `actor` è l'attaccante nemico che ha subito il riflesso
      }
```

(`realTarget` è il bersaglio del colpo — cioè il Tank col muro; `actor` è il nemico attaccante. Verifica che entrambi i nomi siano in scope in quel punto del loop: lo sono, `entry = resolveAction(rng, turn, actor, realTarget, ...)` è la riga sopra.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/engine/duoEffects/muroVivente.test.ts`
Expected: PASS (tutti, incluso il test della riga di log).

- [ ] **Step 6: Typecheck + parity + stress**

Run: `npm run typecheck`
Expected: nessun errore.

Run: `npx vitest run tests/engine/endlessReplayParity.test.ts tests/engine/duoStress.test.ts`
Expected: PASS — `endlessReplayParity` resta 0-mismatch (la riga dedicata copre il riflesso nel replay).

- [ ] **Step 7: Commit**

```bash
git add types/combat.ts game/engine/combat/resolve.ts game/engine/combat/simulate.ts tests/engine/duoEffects/muroVivente.test.ts
git commit -m "feat(duos): Muro Vivente emette la riga di log + accredita il Tank (replay-safe)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Rimuovi il vecchio retarget morto + aggiorna la copy

Elimina il blocco `wall`-retarget in `targeting.ts` (morto: iron taunt già inchioda i nemici sul Tank e nessun nemico ignora il taunt) e aggiorna la `desc` del Duo.

**Files:**
- Modify: `game/engine/combat/targeting.ts:117-123` (rimozione del blocco)
- Modify: `data/duos.ts:16` (desc)
- Test: `tests/engine/duoEffects/muroVivente.test.ts` (già verde) + eventuale test esistente sul retarget da rimuovere/aggiornare

- [ ] **Step 1: Trova i test che coprono il vecchio retarget**

Run: `grep -rln "livingWall\|non possono essere colpite\|retrovie\|Muro Vivente\|muro-vivente" tests/`
Ispeziona i risultati: se un test asserisce il **vecchio** comportamento (le retrovie non vengono colpite / il target viene forzato sul muro), va **rimosso o riscritto** verso il nuovo effetto (riflesso). Se non ne esiste nessuno, salta alla rimozione.

- [ ] **Step 2: Rimuovi il blocco retarget**

In `game/engine/combat/targeting.ts`, elimina le righe 117-123 (il commento `// MURO VIVENTE:` + il `const wall = ...` + `if (wall) return wall`):

```ts
// RIMUOVI questo intero blocco (targeting.ts:117-123):
  // MURO VIVENTE: a shielded, taunting player Tank hard-blocks the backline. ...
  const wall = enemies.find(e => e.alive && e.livingWall && !isUnderHardControl(e)
    && e.statusEffects.some(s => s.statusId === 'shield' && (s.absorbLeft ?? 0) > 0))
  if (wall) return wall
```

Se `isUnderHardControl` restava importato solo per questo blocco, verifica con `grep -n "isUnderHardControl" game/engine/combat/targeting.ts` e rimuovi l'import orfano se non più usato (altrimenti lascialo).

- [ ] **Step 3: Aggiorna la desc del Duo**

In `data/duos.ts:16`:

```ts
  { id: 'muro-vivente', name: 'Muro Vivente', signals: ['scudirigen', 'taunt'],
    desc: 'Finché il tuo Tank col muro ha uno scudo, riflette parte del danno assorbito sull’attaccante.' },
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/engine/duoEffects/muroVivente.test.ts tests/engine/targeting.test.ts tests/data/`
Expected: PASS. (Se `tests/engine/targeting.test.ts` non esiste, cerca il file dei test di targeting con `grep -rln "selectTarget" tests/` e girane quello.)

- [ ] **Step 5: Typecheck + suite piena**

Run: `npm run typecheck && npm run test`
Expected: tsc pulito; suite piena verde (il conteggio sale dei nuovi test muroVivente; nessuna regressione).

- [ ] **Step 6: Commit**

```bash
git add game/engine/combat/targeting.ts data/duos.ts tests/
git commit -m "refactor(duos): rimuovi il retarget morto del Muro Vivente + nuova desc

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Leggibilità — riga di battle-log narrata

Dai alla riga `MuroVivente` una narrazione propria nel renderer del log (come Miasma/Untore), invece del generico "‹Tank› lancia MuroVivente".

**Files:**
- Modify: `components/battle/BattleLog.tsx:60-62` (accanto ai casi `Miasma`/`Untore`)
- Test: `tests/ui/duoBattle.test.tsx` o il test esistente del battle-log (cerca con `grep -rln "Miasma\|Untore\|BattleLog" tests/`)

**Interfaces:**
- Consumes: la riga di log `{ action: 'MuroVivente', value, actorId (tank), targetId (attaccante) }` (Task 3).
- Produces: il renderer restituisce `Il muro di <Tank> riflette <N> su <nemico>`.

- [ ] **Step 1: Write the failing test**

Trova il file test del renderer del log (`grep -rln "si propaga\|sputa veleno\|BattleLog" tests/`) e aggiungi un caso che passa una entry `MuroVivente` alla funzione di descrizione e si aspetta la stringa. Se i test del log passano `LogEntry` a una funzione pura tipo `describeEntry(entry, units)`, riusa quella firma:

```ts
it('narra la riga MuroVivente', () => {
  const entry = { turn: 1, action: 'MuroVivente', actorId: 'tank', actorSide: 'left',
    targetId: 'enemy', targetSide: 'right', type: 'system', value: 12, flags: ['duo'], duoId: 'muro-vivente' }
  // adatta ai veri nomi risolti dal renderer (actor/target lookup)
  expect(describeLine(entry, /* units */)).toBe('Il muro di Tank riflette 12 su Enemy')
})
```

(Adatta ai nomi reali che il renderer risolve — guarda come i test di Miasma/Untore costruiscono `actor`/`target`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run <file-del-test-del-log>`
Expected: FAIL — cade nel ramo generico (nome magia), non nella frase dedicata.

- [ ] **Step 3: Aggiungi il caso nel renderer**

In `components/battle/BattleLog.tsx`, accanto alle righe 60-62 (`if (entry.action === 'Miasma') ...` / `'Untore'`):

```ts
  if (entry.action === 'MuroVivente') return `Il muro di ${actor} riflette ${entry.value ?? 0} su ${target ?? 'un nemico'}`
```

(`actor`/`target` sono le variabili già risolte in quella funzione dai `actorId`/`targetId` — usa le stesse dei casi Miasma/Untore.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run <file-del-test-del-log>`
Expected: PASS.

- [ ] **Step 5: Typecheck + suite piena**

Run: `npm run typecheck && npm run test`
Expected: tsc pulito, suite piena verde.

- [ ] **Step 6: Commit**

```bash
git add components/battle/BattleLog.tsx tests/
git commit -m "feat(duos): MuroVivente ottiene una riga di log narrata

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (spec: `docs/superpowers/specs/2026-07-13-muro-vivente-riflesso-design.md`):
- Redesign riflesso 40% assorbito, non letale → Task 2. ✅
- Solo scudo (anche stordito), player-only → Task 2 (gate su `livingWall` + `side === 'left'`, nessun check taunt/hard-control). ✅
- Parametro di tuning in un solo posto → Task 1 (stamp `{ reflect: 0.4 }`). ✅
- Riga di log dedicata + replay-safe (0-mismatch) → Task 3 (+ verifica `endlessReplayParity`). ✅
- Score MVP al Tank → Task 3. ✅
- Rimozione retarget morto + nuova copy → Task 4. ✅
- Battle-log narrato → Task 5. ✅
- `duoStress` non regredisce → verificato in Task 2 e 3. ✅

**Placeholder scan:** i punti "adatta ai veri nomi/firme" nei Task 3 e 5 riguardano le fixture dei test (il pattern di `simulateBattle`/`describeLine` esistente), non il codice di produzione, che è mostrato per intero. Le asserzioni sul comportamento sono concrete. Accettato: l'implementer legge il vero builder di test dai file Duo/log vicini (indicati con `grep` esatti).

**Type consistency:** `livingWall: { reflect: number }` (Task 1) usato in Task 2 (`lw.reflect`). `EffectCtx.reflect`/`LogEntry._reflect` = `{ unitId: string; side: Side; amount: number }` coerente tra Task 1/2/3. `action: 'MuroVivente'` + `duoId: 'muro-vivente'` coerenti tra Task 3 e 5. `resolveAction` firma invariata (ritorna `LogEntry`) — nessun test rotto.

**Nota decisione (blast radius):** `resolveAction` NON cambia firma (molti test lo chiamano come singolo `LogEntry`); il riflesso viaggia su un campo transiente `_reflect` che il sim scarta prima di loggare → il `RunLog` serializzato è invariato (anti-cheat/parity intatti).
