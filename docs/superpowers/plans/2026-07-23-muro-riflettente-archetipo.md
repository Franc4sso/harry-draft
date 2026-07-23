# Archetipo Muro Riflettente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** L'archetipo Muro Riflettente (scudo) — gemello del Carnefice: sinergia `bastione` (3 maghi scudirigen) accende la riflessione diffusa (chi ha scudo rimanda % del danno assorbito, non-letale); il Duo Muro Vivente la rende letale sul Tank.

**Architecture:** Sinergia-dati che riaccende il branch shieldConvert morto + un flag `wallReflect` su BattleUnit stampato da synergyTriggers (entrambi i lati) + estensione del blocco reflect esistente in effects.ts (archetipo non-letale + Duo letale + nemici). Motore minimo, determinismo preservato (nessun rng nuovo — il reflect è già rng-free). Segue il pattern del Carnefice (spietatezza) verbatim.

**Tech Stack:** TypeScript, Vitest. Path alias `@/` → root repo.

## Global Constraints

- **Determinismo (VINCOLO #1):** il reflect è nel damage handler ma è RNG-FREE (attaccante + assorbito già in scope, `Math.round`, nessun `ctx.rng`). `tests/engine/endlessReplayParity.test.ts` DEVE restare verde; se rosso, STOP e riportare BLOCKED.
- `npm run test` NON esegue typecheck — ogni task chiude con `npm run typecheck`.
- L'archetipo vale per ENTRAMBI i lati (player E nemici) — coerente col veleno/Carnefice. Il flag `wallReflect` va stampato su left e right; il ramo reflect archetipo NON deve essere gated `side==='left'` (i nemici riflettono). Il `livingWall` (Duo) resta player-only.
- **Pattern da specchiare (Carnefice, VERIFICATO):** flag stampato a `synergyTriggers.ts:29` (`if (spietatezza) for (const u of units) u.carnefice = true`); `livingWall?: {reflect}` a `types/combat.ts:88`, `carnefice?` a :91.
- Template sinergia (VERBATIM, synergies.ts): `{ id: 'spietatezza', name: 'Spietatezza', kind: 'origin', requires: { tag: 'esecuzione', count: 3 }, bonus: { keywordMult: { esecuzione: 0.5 } } }`.
- Il branch `bastione` in `shieldConvert.ts:16-18` (`+0.35` generazione) è VIVO ma morto (sinergia mancante) — riaccende gratis aggiungendo la voce.
- Il reflect log usa `entry._reflect` (transiente) → `action:'MuroVivente'`, `duoId:'muro-vivente'` a `simulate.ts:296-308`. Verificare come `ctx.reflect` (effects.ts) → `entry._reflect` (sim).
- Numeri STIMA tarabili: archetipo riflessione **0.25** (non-letale); Duo Muro Vivente **0.5 + letale** (oggi 0.4 non-letale, stamp.ts:10).

---

### Task 1: Sinergia `bastione` + flag `wallReflect`

**Files:**
- Modify: `data/synergies.ts` (voce bastione)
- Modify: `lib/metaProgress.ts` (NAMED_SYNERGY_IDS + bastione)
- Modify: `types/combat.ts` (campo `wallReflect?` su BattleUnit)
- Modify: `game/engine/synergyTriggers.ts` (stampa flag)
- Test: `tests/engine/muroRiflettente.test.ts` (create)

**Interfaces:**
- Consumes: `detectSynergies` (generico tag+count), `teamShieldConvert` (shieldConvert.ts:7, branch bastione già presente riga 16).
- Produces: la sinergia `bastione`; il flag `BattleUnit.wallReflect?: number`.

- [ ] **Step 1: Scrivere i test che falliscono**

Create `tests/engine/muroRiflettente.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { detectSynergies } from '@/game/engine/synergy'
import { teamShieldConvert } from '@/game/engine/shieldConvert'
import type { DraftedWizard } from '@/types'

const dw = (id: string, tags: string[] = []): DraftedWizard =>
  ({ wizard: { id, role: 'Tank', house: 'Tassorosso', tags }, level: 1 } as unknown as DraftedWizard)

describe('sinergia bastione (archetipo Muro Riflettente)', () => {
  it('si accende con 3 maghi scudirigen, non con 2', () => {
    const three = [dw('a', ['scudirigen']), dw('b', ['scudirigen']), dw('c', ['scudirigen'])]
    const two = [dw('a', ['scudirigen']), dw('b', ['scudirigen'])]
    expect(detectSynergies(three).map(s => s.synergy.id)).toContain('bastione')
    expect(detectSynergies(two).map(s => s.synergy.id)).not.toContain('bastione')
  })

  it('riaccende il branch shieldConvert morto: rate più alto con bastione', () => {
    const team = [dw('a', ['scudirigen']), dw('b', ['scudirigen']), dw('c', ['scudirigen'])]
    const syn = detectSynergies(team)
    // con una reliquia grantsShieldConvert base + bastione, il rate include il +0.35
    const relic = { relic: { id: 'egida-tassorosso', name: '', desc: '', rarity: 'rara', keywords: ['scudo'], grantsShieldConvert: { rate: 0.5 } } } as any
    const withBastione = teamShieldConvert(team, [relic], syn)
    const withoutBastione = teamShieldConvert(team, [relic], [])
    expect(withBastione!.rate).toBeGreaterThan(withoutBastione!.rate)
  })
})
```

- [ ] **Step 2: Eseguire i test — devono fallire**

Run: `npm run test -- tests/engine/muroRiflettente.test.ts`
Expected: FAIL (bastione non esiste).

- [ ] **Step 3: Aggiungere la sinergia**

In `data/synergies.ts`, dentro l'array `SYNERGIES` (dopo spietatezza), aggiungere:
```ts
  { id: 'bastione', name: 'Bastione', kind: 'origin', requires: { tag: 'scudirigen', count: 3 }, bonus: { keywordMult: { scudo: 0.5 } } },
```

- [ ] **Step 4: Aggiungere `bastione` a NAMED_SYNERGY_IDS**

In `lib/metaProgress.ts`, aggiornare `NAMED_SYNERGY_IDS = new Set(['tossicita', 'spietatezza', 'bastione'])` e il commento (bastione è un archetipo vivo, come tossicita/spietatezza).

- [ ] **Step 5: Aggiungere `wallReflect` a BattleUnit**

In `types/combat.ts`, dopo `carnefice?: boolean` (riga ~91):
```ts
  wallReflect?: number                               // BASTIONE archetype (diffuse non-lethal reflect, both sides)
```

- [ ] **Step 6: Stampare il flag in synergyTriggers**

In `game/engine/synergyTriggers.ts`, accanto al blocco carnefice (riga 28-29), aggiungere:
```ts
  const bastione = synergies.some(s => s.synergy.id === 'bastione')
  if (bastione) for (const u of units) u.wallReflect = 0.25
```
NB: `registerSynergyTriggers` è chiamato per entrambi i lati → il flag si stampa anche sui nemici (voluto).

- [ ] **Step 7: Eseguire test + typecheck**

Run: `npm run test -- tests/engine/muroRiflettente.test.ts` → PASS.
Run: `npm run typecheck` → nessun errore.

- [ ] **Step 8: Commit**

```bash
git add data/synergies.ts lib/metaProgress.ts types/combat.ts game/engine/synergyTriggers.ts tests/engine/muroRiflettente.test.ts
git commit -m "feat(archetype): sinergia Bastione + flag wallReflect — riaccende shieldConvert, base del Muro"
```

---

### Task 2: La riflessione archetipo (effects.ts) + nemici

**Files:**
- Modify: `game/engine/combat/effects.ts` (estendere il blocco reflect ~88-98)
- Modify: `game/engine/combat/simulate.ts` (log/score per il reflect archetipo, se distinto)
- Test: estendere `tests/engine/muroRiflettente.test.ts`

**Interfaces:**
- Consumes: `wallReflect` (Task 1), `livingWall` (esistente), `ctx.actor`/`ctx.target`/`absorbed` (già in scope a effects.ts:82).
- Produces: la riflessione diffusa non-letale (archetipo) su chiunque abbia scudo, entrambi i lati; il Duo `livingWall` resta prioritario (Task 3 lo rende letale).

- [ ] **Step 1: Scrivere il test (battaglia end-to-end o unità)**

Estendere `muroRiflettente.test.ts`: costruire una battaglia (pattern da `duoStress.test.ts`/`scudiRigenSweep.test.ts`) dove un'unità scudata con `wallReflect=0.25` assorbe danno e verifica che l'attaccante prenda ~25% dell'assorbito, NON-letale (resta ≥1 HP). E un nemico con `wallReflect` riflette il danno del player. Se la battaglia completa è fragile, testare la logica del reflect in isolamento su un `ctx` sintetico (attaccante, target scudato, absorbed noto) — vedi come altri test di effects.ts costruiscono il ctx.

- [ ] **Step 2: Eseguire il test — deve fallire**

Run: `npm run test -- tests/engine/muroRiflettente.test.ts`
Expected: FAIL (wallReflect non ancora consumato nel damage handler).

- [ ] **Step 3: Estendere il blocco reflect in effects.ts**

In `game/engine/combat/effects.ts`, il blocco attuale (righe 88-98) gestisce solo `livingWall` gated `side==='left'`. Sostituirlo con la versione che gestisce archetipo + Duo + nemici:
```ts
    const absorbed = dmg - residual
    if (absorbed > 0 && ctx.actor.alive) {
      const lw = ctx.target.livingWall          // Duo Muro Vivente (Tank player): letale (Task 3)
      const arch = ctx.target.wallReflect        // Archetipo bastione (chiunque scudato, ENTRAMBI i lati): non-letale
      if (lw && ctx.target.side === 'left') {
        // Duo: player-only, resta come oggi finché Task 3 non lo rende letale.
        if (ctx.actor.hp > 1) {
          const reflect = Math.min(ctx.actor.hp - 1, Math.round(absorbed * lw.reflect))
          if (reflect > 0) { ctx.actor.hp -= reflect; ctx.reflect = { unitId: ctx.actor.wizard.id, side: ctx.actor.side, amount: reflect } }
        }
      } else if (arch && ctx.actor.hp > 1) {
        // Archetipo: NON-letale (cap hp-1), ENTRAMBI i lati (nemici riflettono il danno del player).
        const reflect = Math.min(ctx.actor.hp - 1, Math.round(absorbed * arch))
        if (reflect > 0) { ctx.actor.hp -= reflect; ctx.reflect = { unitId: ctx.actor.wizard.id, side: ctx.actor.side, amount: reflect } }
      }
    }
```
**NB determinismo:** nessun rng. `ctx.reflect` invariato. Verificare come `ctx.reflect` → `entry._reflect` → log a `simulate.ts:296-308`: oggi il log marca `duoId:'muro-vivente'` e `action:'MuroVivente'` e credita solo il lato left. Per il reflect archetipo (che può essere su right e senza Duo), il log va reso coerente — o generalizzato (l'attore riflettente è `ctx.target`, non sempre un Tank left). Leggere il blocco 296-308 e adattarlo così il reflect archetipo emette un log valido su entrambi i lati (magari `action:'Riflesso'` senza duoId quando è archetipo-puro). Attenzione a NON cambiare lo stream deterministico (il log non usa rng).

- [ ] **Step 4: Test + typecheck + PARITÀ**

Run: `npm run test -- tests/engine/muroRiflettente.test.ts` → PASS.
Run: `npm run test -- tests/engine/endlessReplayParity.test.ts --disable-console-intercept` → mismatches=0. **Se rosso → STOP, BLOCKED.**
Run: `npm run typecheck` → nessun errore.

- [ ] **Step 5: Commit**

```bash
git add game/engine/combat/effects.ts game/engine/combat/simulate.ts tests/engine/muroRiflettente.test.ts
git commit -m "feat(archetype): riflessione Muro archetipo — diffusa non-letale, entrambi i lati"
```

---

### Task 3: Differenziare il Duo Muro Vivente (letale)

**Files:**
- Modify: `game/engine/combat/effects.ts` (il ramo `livingWall` diventa letale)
- Modify: `game/engine/duoEffects/stamp.ts` (bump reflect Duo 0.4→0.5, se si vuole più % oltre al letale)
- Modify: `data/duos.ts` (desc del Duo Muro Vivente)
- Test: estendere `muroRiflettente.test.ts`

**Interfaces:**
- Consumes: il blocco reflect di Task 2.
- Produces: il Duo Muro Vivente = letale (toglie il cap hp-1) + % più alta, distinto dall'archetipo non-letale.

- [ ] **Step 1: Test della differenziazione**

Estendere `muroRiflettente.test.ts`: un Tank con `livingWall` (Duo) che riflette abbastanza da portare l'attaccante sotto 1 HP → l'attaccante MUORE (hp ≤ 0). Un'unità con solo `wallReflect` (archetipo) → l'attaccante resta ≥1 HP (non-letale). Verificare la priorità: Tank con SIA livingWall SIA wallReflect → vince il Duo (letale).

- [ ] **Step 2: Eseguire il test — deve fallire**

Run: `npm run test -- tests/engine/muroRiflettente.test.ts`
Expected: FAIL (il Duo è ancora non-letale — cap hp-1 dal Task 2).

- [ ] **Step 3: Rendere il Duo letale in effects.ts**

Nel ramo `lw && ctx.target.side === 'left'` (Task 2), togliere il cap `Math.min(ctx.actor.hp - 1, ...)` → riflette pieno, può uccidere:
```ts
      if (lw && ctx.target.side === 'left') {
        const reflect = Math.round(absorbed * lw.reflect)   // NIENTE cap → letale
        if (reflect > 0) { ctx.actor.hp -= reflect; ctx.reflect = { unitId: ctx.actor.wizard.id, side: ctx.actor.side, amount: reflect } }
      }
```
(Il controllo `ctx.actor.hp > 1` per il Duo va rimosso/allentato — il Duo PUÒ uccidere. Attenzione: se l'attaccante muore per reflect, il resto del suo turno va gestito come una morte normale — verificare che il sim gestisca `ctx.actor.hp <= 0` dopo il reflect, come per il recoil letale delle Magie Oscure a effects.ts:100-104.)

- [ ] **Step 4: Bump % Duo (opzionale) + desc**

In `game/engine/duoEffects/stamp.ts:10`, se si vuole il Duo più forte oltre al letale: `reflect: 0.5` (era 0.4).
In `data/duos.ts` (voce muro-vivente), aggiornare la `desc` per dire che ora il muro può UCCIDERE (letale), distinto dall'archetipo non-letale.

- [ ] **Step 5: Test + typecheck + PARITÀ**

Run: `npm run test -- tests/engine/muroRiflettente.test.ts` → PASS.
Run: `npm run test -- tests/engine/endlessReplayParity.test.ts --disable-console-intercept` → mismatches=0.
Run: `npm run typecheck` → nessun errore.

- [ ] **Step 6: Commit**

```bash
git add game/engine/combat/effects.ts game/engine/duoEffects/stamp.ts data/duos.ts tests/engine/muroRiflettente.test.ts
git commit -m "feat(archetype): Muro Vivente differenziato — riflessione LETALE sul Tank (amplificatore)"
```

---

### Task 4: Bilanciamento + sweep + test stale

**Files:**
- Modify: `tests/engine/scudiRigenSweep.test.ts` (misurare bastione, ora viva)
- Modify: i test stale che assumono bastione morta (grep li trova)
- Verify: `campaignBalanceRestricted.test.ts`, `campaignBalanceB.test.ts`
- Modify (se serve): `game/engine/synergyTriggers.ts` (tarare la % nemica se il nemico-muro rompe il floor)

**Interfaces:**
- Consumes: tutto il Muro (Task 1-3).
- Produces: conferma che il gate regge; sweep che misura bastione; eventuale taratura % riflessione nemica.

- [ ] **Step 1: Grep dei test stale bastione**

Run: `grep -rn "bastione\|Bastione" tests/ lib/`
Sistemare ogni test che asseriva bastione morta/assente (come per spietatezza col Carnefice): conteggio SYNERGIES (ora 3), eventuali test di temi (ora c'è tema scudirigen), affiliation chips. Aggiornare allo stato nuovo (bastione VIVA), NON indebolire.

- [ ] **Step 2: Misurare i gate di bilanciamento**

Run: `npm run test -- tests/engine/campaignBalanceRestricted.test.ts tests/engine/campaignBalanceB.test.ts --disable-console-intercept`
Il gate bot è archetype-blind per il PLAYER, ma i nemici-muro (tema scudirigen) riflettono il danno del bot → il winRate potrebbe SCENDERE. Registrare i numeri.

- [ ] **Step 3: Decidere (giudizio bilanciamento)**

- Se i gate restano verdi → OK, documentare il nuovo winRate con commento datato.
- Se un gate SCENDE sotto il floor → è effetto REALE (nemico-muro riflette troppo). Tarare la % riflessione NEMICA (potrebbe stampare `wallReflect` più basso su right che su left, in synergyTriggers), ri-misurando. NON escludere i nemici, NON abbassare l'assert alla cieca.
- Se `endlessReplayParity` è rosso → STOP.

- [ ] **Step 4: Estendere scudiRigenSweep**

In `tests/engine/scudiRigenSweep.test.ts`, misurare bastione (bastioneRate ora VIVA, prima era 0/dead) e il reflect. Aggiornare i commenti datati che dicevano bastione morta. Ri-ancorare eventuali floor mossi al valore reale misurato.

- [ ] **Step 5: Suite completa + typecheck**

Run: `npm run test` → tutto verde (skip noto ok).
Run: `npm run typecheck` → nessun errore.

- [ ] **Step 6: Commit**

```bash
git add tests/engine/scudiRigenSweep.test.ts tests/data/synergies.test.ts game/engine/synergyTriggers.ts
git commit -m "test(archetype): Muro — misura bastione + verifica gate (nemico-muro tarato)"
```

---

## Self-Review (autore)

- **Spec coverage:** §4a sinergia→Task1; §4b flag→Task1; §4c reflect archetipo→Task2; differenziazione Duo letale→Task3; §4d nemici→Task2; §6 testing+bilanciamento→Task4. Determinismo (§8)→Task2/3 (parità). ✅
- **Type consistency:** `wallReflect?: number` su BattleUnit, `bastione` id, `livingWall` esistente — coerenti tra task. Flag stampato mirror del Carnefice (`carnefice`). ✅
- **Placeholder scan:** nessun TBD; ogni step mostra codice. Le NB (ctx.reflect→entry._reflect log, morte da reflect letale, % nemica) danno criterio con riferimenti reali. ✅
- **Rischio noto documentato:** determinismo (Task2/3 parità), log reflect archetipo su entrambi i lati (Task2 Step3), morte da reflect letale (Task3 Step3), nemico-muro bilanciamento (Task4), test stale bastione (Task4 Step1). ✅
- **Numeri verificati:** flag pattern synergyTriggers.ts:29; livingWall types/combat.ts:88; reflect block effects.ts:88-98; shieldConvert bastione branch:16; reflect log simulate.ts:296-308; stamp.ts:10 reflect 0.4. ✅
