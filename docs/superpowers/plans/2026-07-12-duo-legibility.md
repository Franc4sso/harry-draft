# Duo leggibili — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere i Duo comprensibili: il motore lascia una traccia quando un Duo scatta, la battaglia lo annuncia e lo nomina, e il pannello nel run insegna come accendere ogni ricetta.

**Architecture:** `LogEntry` guadagna `duoId?: string` e `LogFlag` la variante `'duo'`. Tre Duo marchiano una riga di log che già esiste (ESECUZIONE A FREDDO sul colpo, CANCRENA sul tick di veleno, MIETITORE sull'uccisione); due Duo che oggi agiscono in silenzio (MIASMA, UNTORE) ottengono una riga propria. La UI legge solo `entry.duoId`: nessun nuovo canale dati, nessun nuovo sistema di annunci — si riusano `Callout` e il pattern del boss-telegraph.

**Tech Stack:** TypeScript, Next.js, React, Vitest + Testing Library.

Spec: `docs/superpowers/specs/2026-07-12-duo-legibility-design.md`
Mockup di riferimento: `docs/superpowers/mockups/2026-07-12-duo-legibility.html`

## Global Constraints

- **Parità del replay — il vincolo che può rompere l'anti-cheat.** `buildReplay` mappa il log 1:1 sui frame e `result.snapshots` è 1:1 col log (`game/engine/combat/simulate.ts:117`, `pushLog`). **Ogni riga nuova deve passare da `pushLog`**, mai da `log.push`.
- **Le righe di log nuove NON devono avere `value`.** `buildReplay` ricostruisce gli HP dai `value` del log (vedi il commento a `simulate.ts:392-394`). MIASMA e UNTORE muovono *stack di veleno*, non HP: un `value` valorizzato farebbe divergere gli HP del replay da quelli della simulazione. Lasciare `value` assente.
- **Nessun cambio di comportamento.** La traccia è puramente osservativa: nessun effetto Duo cambia, nessun pescaggio di RNG viene aggiunto o spostato. Ogni battaglia a parità di seed deve produrre lo stesso esito di oggi.
- **Player-only.** I Duo esistono solo per il lato `left` (`opts.leftDuos`). Nessuna traccia va mai emessa per il lato `right`.
- **MURO VIVENTE non emette nulla.** Non ha un istante da annunciare (impedisce, non scatta). È una scelta di design registrata nella spec, non una dimenticanza: c'è un test che lo asserisce.
- **Il segnale `attaccante` non va mai mostrato in UI.** Nessuno dei 6 Duo spediti lo usa; il filtro è `DUO_SIGNALS_IN_USE` (`game/engine/duos.ts:57`).
- **Lingua:** ogni testo visibile all'utente è in **italiano** (il gioco lo è).

**Comandi.**
- Test mirato: `npx vitest run <path>`
- Suite completa: `npm run test` (~70s, NON include il typecheck)
- Typecheck: `npm run typecheck`
- Baseline attuale da non far regredire: **1367 test verdi**, typecheck pulito.

## File Structure

**Motore**
- `types/combat.ts` — `LogFlag` += `'duo'`; `LogEntry` += `duoId?: string`. (Task 1)
- `game/engine/combat/effects.ts` — `EffectCtx` += `duoIds?: string[]`; il ramo cold-execute marchia `esecuzione-a-freddo`. (Task 1)
- `game/engine/combat/resolve.ts` — crea l'array `duoIds`, lo passa nel ctx, lo riversa in `entry.duoId`. (Task 1)
- `game/engine/status.ts` — il tick di veleno amplificato marchia `cancrena`. (Task 2)
- `game/engine/combat/simulate.ts` — la riga KO marchia `mietitore`; nuove righe per MIASMA e UNTORE. (Task 3, Task 4)
- `game/engine/duoEffects/spreadOnDeath.ts`, `spitOnHeal.ts` — ritornano *cosa hanno fatto* invece di `void`, così il chiamante può loggarlo. (Task 4)

**UI**
- `data/duos.ts` — `SIGNAL_HOWTO`: come si accende ogni segnale. (Task 5)
- `components/run/DuoPanel.tsx` — nuovo pannello a ricetta (sostituisce `DuoBar.tsx`, che viene eliminato). (Task 5)
- `components/run/TeamSynergyBar.tsx:210` — monta `DuoPanel` al posto di `DuoBar`. (Task 5)
- `components/battle/DuoPills.tsx` — pill dei Duo attivi in arena. (Task 6)
- `components/battle/Callout.tsx` — priorità: il Duo vince su tutto. (Task 6)
- `components/battle/BattleArena.tsx` — pill + primo scatto. (Task 6)
- `components/screens/BattleScreen.tsx` — calcola i Duo attivi e li passa all'arena. (Task 6)
- `hooks/useBattleReplay.ts:16-24` — un frame Duo dura di più (l'annuncio deve essere leggibile). (Task 6)

---

## Task 1: La traccia del Duo — tipi + ESECUZIONE A FREDDO

Il colpo che giustizia un nemico controllato oggi è indistinguibile da un colpo normale: il danno extra è ripiegato dentro `value` (`effects.ts:91-103`). Questo task apre il canale (`duoId` sulla `LogEntry`) e lo usa per il primo Duo.

**Files:**
- Modify: `types/combat.ts:79-93`
- Modify: `game/engine/combat/effects.ts:9` (EffectCtx), `:88-103` (ramo cold-execute)
- Modify: `game/engine/combat/resolve.ts:14-45`
- Test: `tests/engine/duoTrace.test.ts` (create)

**Interfaces:**
- Produces: `LogEntry.duoId?: string` — l'id del Duo che ha causato/modificato quella riga (`'esecuzione-a-freddo' | 'cancrena' | 'mietitore' | 'miasma' | 'untore'`). `LogFlag` include `'duo'`. Ogni task successivo scrive su questo stesso campo.
- Produces: `EffectCtx.duoIds?: string[]` — canale mutabile handler → `resolveAction`, gemello di `flags`.

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `tests/engine/duoTrace.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { makeRng } from '@/game/engine/rng'
import type { ActiveDuo, DraftedWizard } from '@/types'
import { DUO_BY_ID } from '@/data/duos'

/** Un mago pronto al combattimento, con la magia passata come firma. */
function dw(id: string, role: string, spellId: string, stats: Partial<Record<string, number>> = {}): DraftedWizard {
  return {
    wizard: { id, name: id, house: 'Grifondoro', role, tags: [], spellPool: [spellId], rarity: 'comune' },
    level: 1,
    stats: { hp: stats.hp ?? 100, atk: stats.atk ?? 20, def: stats.def ?? 0, spd: stats.spd ?? 10 },
  } as unknown as DraftedWizard
}

const duo = (id: string): ActiveDuo[] => [{ duo: DUO_BY_ID[id]! }]

describe('traccia dei Duo nel log', () => {
  it('ESECUZIONE A FREDDO marchia la riga del colpo che giustizia', () => {
    // Un Controllo che stordisce + un Attaccante che finisce: contro un nemico fragile
    // il colpo sotto soglia deve giustiziare, e quella riga deve portare il duoId.
    const left = [dw('ctrl', 'Controllo', 'petrificus'), dw('att', 'Attaccante', 'base_attack', { atk: 40 })]
    const right = [dw('foe', 'Attaccante', 'base_attack', { hp: 40, atk: 5, spd: 1 })]

    const res = simulateBattle(left, right, makeRng('duo-cold'), { leftDuos: duo('esecuzione-a-freddo') })

    const marked = res.log.filter(e => e.duoId === 'esecuzione-a-freddo')
    expect(marked.length).toBeGreaterThan(0)
    expect(marked[0]!.flags).toContain('duo')
    expect(marked[0]!.actorSide).toBe('left')
  })

  it('senza il Duo attivo nessuna riga porta un duoId', () => {
    const left = [dw('ctrl', 'Controllo', 'petrificus'), dw('att', 'Attaccante', 'base_attack', { atk: 40 })]
    const right = [dw('foe', 'Attaccante', 'base_attack', { hp: 40, atk: 5, spd: 1 })]

    const res = simulateBattle(left, right, makeRng('duo-cold'), {}) // nessun leftDuos

    expect(res.log.some(e => e.duoId != null)).toBe(false)
    expect(res.log.some(e => e.flags.includes('duo'))).toBe(false)
  })
})
```

Nota: se `makeRng` o la forma di `DraftedWizard` differiscono, allinea l'helper `dw` a quello già usato in `tests/engine/combat/simulate.test.ts` — **non inventare una firma**: copia quella esistente.

- [ ] **Step 2: Esegui il test per confermare il RED**

Run: `npx vitest run tests/engine/duoTrace.test.ts`
Expected: FAIL — `duoId` non esiste sul tipo `LogEntry` (errore di tipo) e nessuna riga lo porta.

- [ ] **Step 3: Aggiungi il campo ai tipi**

In `types/combat.ts`, sostituisci la riga `export type LogFlag = …` e l'interfaccia `LogEntry`:

```ts
export type LogFlag = 'crit' | 'dodge' | 'kill' | 'heal' | 'block' | 'stun' | 'dot' | 'pen' | 'shatter' | 'wait' | 'recoil' | 'revive' | 'duo'

export interface LogEntry {
  turn: number
  actorId: string
  /** Side of the acting unit. Optional for backwards-compat; populated by the engine. */
  actorSide?: Side
  action: string
  targetId?: string
  /** Side of the targeted unit. Optional for backwards-compat; populated by the engine. */
  targetSide?: Side
  type: SpellType | 'system'
  value?: number
  flags: LogFlag[]
  /** Il Duo (player-only) che ha causato o modificato questa riga. La UI lo usa per
   *  nominare la combo nell'annuncio e per far lampeggiare la pill giusta. Puramente
   *  osservativo: non cambia nessun comportamento della simulazione. */
  duoId?: string
}
```

- [ ] **Step 4: Apri il canale handler → entry**

In `game/engine/combat/effects.ts`, estendi `EffectCtx` (riga 9):

```ts
export interface EffectCtx { rng: Rng; turn: number; actor: BattleUnit; target: BattleUnit; flags: LogFlag[]; bus?: EventBus; allies?: BattleUnit[]; dark?: boolean; duoIds?: string[] }
```

Nello stesso file, nel ramo cold-execute dell'handler `damage` (righe 88-103), sostituisci il blocco con:

```ts
    // ESECUZIONE A FREDDO: a hard-controlled (stun/freeze/silence) enemy under the HP
    // threshold is finished outright — or, in boss battles, takes a chunk of bonus damage
    // instead (the boss climax must stay hard). Fixed at stamp time via coldExecute.instakill.
    let coldExtra = 0
    if (ce && ctx.target.side !== ctx.actor.side && ctx.target.alive && ctx.target.maxHp > 0) {
      if (coldExecuteControlled && ctx.target.hp / ctx.target.maxHp < ce.threshold) {
        const hpBefore = ctx.target.hp
        if (ce.instakill) ctx.target.hp = 0
        else ctx.target.hp = Math.max(0, ctx.target.hp - Math.round(ctx.target.maxHp * 0.25))
        coldExtra = hpBefore - ctx.target.hp
        // Traccia: il colpo ha giustiziato grazie al Duo. Marchia la riga (osservativo).
        if (coldExtra > 0) {
          ctx.flags.push('duo')
          ctx.duoIds?.push('esecuzione-a-freddo')
        }
      }
    }
```

- [ ] **Step 5: Riversa il duoId nella entry**

In `game/engine/combat/resolve.ts`, in `resolveAction`: crea l'array, passalo nel ctx, e mettilo nella entry finale.

```ts
  const flags: LogFlag[] = []
  const duoIds: string[] = []
  let value: number | undefined
```

(il blocco Protego a riga 18-24 resta invariato: nessun Duo può marchiare un colpo negato)

```ts
  const ctx = { rng, turn, actor, target, flags, bus, allies, dark, duoIds }
```

```ts
  return {
    turn, actorId: actor.wizard.id, actorSide: actor.side, action: spell.name,
    targetId: entryTarget.wizard.id, targetSide: entryTarget.side, type: spell.type, value, flags,
    ...(duoIds[0] ? { duoId: duoIds[0] } : {}),
  }
```

- [ ] **Step 6: Esegui i test per il GREEN**

Run: `npx vitest run tests/engine/duoTrace.test.ts`
Expected: PASS (2 test).

- [ ] **Step 7: Verifica che nulla sia regredito**

Run: `npm run typecheck && npx vitest run tests/engine`
Expected: typecheck pulito; tutti i test dell'engine verdi.

- [ ] **Step 8: Commit**

```bash
git add types/combat.ts game/engine/combat/effects.ts game/engine/combat/resolve.ts tests/engine/duoTrace.test.ts
git commit -m "feat(duos): LogEntry.duoId + flag 'duo'; traccia di ESECUZIONE A FREDDO"
```

---

## Task 2: CANCRENA marchia il tick di veleno amplificato

Il raddoppio del veleno oggi è invisibile: il tick esce con un numero più grosso e nient'altro. La riga del tick esiste già (`status.ts:116-117`): va solo marchiata, e **solo quando l'amplificazione si applica davvero**.

**Files:**
- Modify: `game/engine/status.ts:93-118`
- Test: `tests/engine/duoTrace.test.ts` (append)

**Interfaces:**
- Consumes: `LogEntry.duoId`, `LogFlag` `'duo'` (Task 1).

- [ ] **Step 1: Scrivi il test che fallisce**

Aggiungi a `tests/engine/duoTrace.test.ts`, dentro il `describe` esistente:

```ts
  it('CANCRENA marchia il tick di veleno SOLO quando amplifica davvero', () => {
    // Un nemico avvelenato: finché sta sopra il 40% di vita il tick è normale (nessun
    // marchio); appena scende sotto soglia il tick raddoppia e la riga porta il duoId.
    const left = [dw('vel', 'Attaccante', 'serpensortia', { atk: 12 })]
    const right = [dw('foe', 'Attaccante', 'base_attack', { hp: 200, atk: 3, spd: 1 })]

    const res = simulateBattle(left, right, makeRng('duo-cancrena'), { leftDuos: duo('cancrena') })

    const dots = res.log.filter(e => e.flags.includes('dot') && e.targetSide === 'right')
    expect(dots.length).toBeGreaterThan(0)

    const marked = dots.filter(e => e.duoId === 'cancrena')
    expect(marked.length).toBeGreaterThan(0)      // sotto soglia: amplificato e marchiato
    expect(marked.every(e => e.flags.includes('duo'))).toBe(true)
    expect(dots.some(e => e.duoId == null)).toBe(true) // sopra soglia: tick normale, non marchiato
  })
```

Se `serpensortia` non è l'id della magia veleno usata dai test dell'engine, usa quella già usata in `tests/engine/pickSpellVeleno.test.ts` — **non inventare id di magie**.

- [ ] **Step 2: Esegui il test per confermare il RED**

Run: `npx vitest run tests/engine/duoTrace.test.ts -t CANCRENA`
Expected: FAIL — nessun tick porta `duoId`.

- [ ] **Step 3: Marchia il tick**

In `game/engine/status.ts`, dentro `tickStatuses`, sostituisci il `logs.push({...})` (righe 116-117) con:

```ts
      logs.push({ turn, actorId: srcId, actorSide: srcSide, action: def?.name ?? 'Veleno',
        targetId: unit.wizard.id, targetSide: unit.side, type: 'Controllo', value: total,
        flags: cancrena ? ['dot', 'duo'] : ['dot'],
        // Traccia: solo quando l'amplificazione si è applicata sul serio (non basta che il
        // Duo sia attivo — il nemico deve essere sotto soglia).
        ...(cancrena ? { duoId: 'cancrena' } : {}) })
```

- [ ] **Step 4: Esegui il test per il GREEN**

Run: `npx vitest run tests/engine/duoTrace.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Verifica che nulla sia regredito**

Run: `npm run typecheck && npx vitest run tests/engine`
Expected: typecheck pulito; engine verde.

- [ ] **Step 6: Commit**

```bash
git add game/engine/status.ts tests/engine/duoTrace.test.ts
git commit -m "feat(duos): CANCRENA marchia il tick di veleno amplificato"
```

---

## Task 3: MIETITORE marchia l'uccisione

Il +6 attacco al carnefice è invisibile. L'uccisione ha già la sua riga (`simulate.ts:296-299`, `action: 'KO'`): va marchiata esattamente quando `maybeReap` viene chiamato — stessa condizione, stesso istante.

**Files:**
- Modify: `game/engine/combat/simulate.ts:294-300`
- Test: `tests/engine/duoTrace.test.ts` (append)

**Interfaces:**
- Consumes: `LogEntry.duoId` (Task 1).

- [ ] **Step 1: Scrivi il test che fallisce**

Aggiungi a `tests/engine/duoTrace.test.ts`:

```ts
  it('MIETITORE marchia la riga KO dell uccisione fatta da un mago del giocatore', () => {
    const left = [dw('att', 'Attaccante', 'base_attack', { atk: 60 })]
    const right = [dw('foe', 'Attaccante', 'base_attack', { hp: 30, atk: 2, spd: 1 })]

    const res = simulateBattle(left, right, makeRng('duo-reap'), { leftDuos: duo('mietitore') })

    const ko = res.log.filter(e => e.action === 'KO' && e.targetSide === 'right')
    expect(ko.length).toBeGreaterThan(0)
    expect(ko[0]!.duoId).toBe('mietitore')
    expect(ko[0]!.flags).toContain('duo')
    expect(ko[0]!.flags).toContain('kill') // il flag esistente non va perso
  })
```

- [ ] **Step 2: Esegui il test per confermare il RED**

Run: `npx vitest run tests/engine/duoTrace.test.ts -t MIETITORE`
Expected: FAIL — la riga KO non porta `duoId`.

- [ ] **Step 3: Marchia la riga KO**

In `game/engine/combat/simulate.ts`, sostituisci il blocco a righe 294-300 con:

```ts
      sync(realTarget)
      if (!realTarget.alive && entry.flags.includes('heal') === false) {
        // MIETITORE: la stessa condizione che più sotto chiama maybeReap (actor a sinistra,
        // flag reaper, vittima nemica). Marchiata QUI perché la riga KO è l'istante in cui
        // il carnefice incassa il raccolto.
        const reaped = actor.side === 'left' && !!actor.reaper && realTarget.side === 'right'
        pushLog({
          turn, actorId: actor.wizard.id, actorSide: actor.side, action: 'KO',
          targetId: realTarget.wizard.id, targetSide: realTarget.side, type: 'system',
          flags: reaped ? ['kill', 'duo'] : ['kill'],
          ...(reaped ? { duoId: 'mietitore' } : {}),
        })
      }
```

- [ ] **Step 4: Esegui il test per il GREEN**

Run: `npx vitest run tests/engine/duoTrace.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Verifica che nulla sia regredito**

Run: `npm run typecheck && npx vitest run tests/engine`
Expected: typecheck pulito; engine verde.

- [ ] **Step 6: Commit**

```bash
git add game/engine/combat/simulate.ts tests/engine/duoTrace.test.ts
git commit -m "feat(duos): MIETITORE marchia la riga KO del carnefice"
```

---

## Task 4: MIASMA e UNTORE ottengono una riga di log (+ MURO VIVENTE non ne ha)

Oggi il veleno che si propaga alla morte e quello sputato sulla cura **compaiono dal nulla**: nessuna riga, nessun feedback. Non è solo un problema di Duo, è un difetto di leggibilità del combattimento. Le due primitive smettono di ritornare `void` e dicono al chiamante cosa hanno fatto; `simulate.ts` lo logga.

**Attenzione (vincolo globale):** le righe nuove passano da `pushLog` e **non portano `value`** — `buildReplay` ricostruisce gli HP dai `value`, e qui non si muovono HP ma stack di veleno.

**Files:**
- Modify: `game/engine/duoEffects/spreadOnDeath.ts`
- Modify: `game/engine/duoEffects/spitOnHeal.ts`
- Modify: `game/engine/combat/simulate.ts` (4 call-site di `maybeSpreadPoison`: `:317`, `:338`, `:375`, `:420`; 1 di `maybeSpitPoison`: `:287`)
- Test: `tests/engine/duoTrace.test.ts` (append)

**Interfaces:**
- Produces: `maybeSpreadPoison(dead, enemiesOfDead, rng): { recipient: BattleUnit; stacks: number } | null` — `null` quando non ha fatto nulla.
- Produces: `maybeSpitPoison(enemies, rng, sourceId): BattleUnit | null` — il nemico colpito, o `null`.

- [ ] **Step 1: Scrivi i test che falliscono**

Aggiungi a `tests/engine/duoTrace.test.ts`:

```ts
  it('MIASMA emette una riga quando il veleno salta a un altro nemico', () => {
    // Due nemici: uno avvelenato che muore, uno vivo che eredita il veleno.
    const left = [dw('vel', 'Attaccante', 'serpensortia', { atk: 30 })]
    const right = [
      dw('dying', 'Attaccante', 'base_attack', { hp: 30, atk: 2, spd: 1 }),
      dw('heir', 'Attaccante', 'base_attack', { hp: 300, atk: 2, spd: 1 }),
    ]

    const res = simulateBattle(left, right, makeRng('duo-miasma'), { leftDuos: duo('miasma') })

    const spread = res.log.filter(e => e.duoId === 'miasma')
    expect(spread.length).toBeGreaterThan(0)
    expect(spread[0]!.flags).toContain('duo')
    expect(spread[0]!.type).toBe('system')
    expect(spread[0]!.value).toBeUndefined() // niente value: non si muovono HP (parità replay)
  })

  it('UNTORE emette una riga quando una cura sputa veleno su un nemico', () => {
    const left = [
      dw('sup', 'Supporto', 'episkey'),
      dw('tank', 'Tank', 'base_attack', { hp: 200 }),
    ]
    const right = [dw('foe', 'Attaccante', 'base_attack', { hp: 300, atk: 25 })]

    const res = simulateBattle(left, right, makeRng('duo-untore'), { leftDuos: duo('untore') })

    const spits = res.log.filter(e => e.duoId === 'untore')
    expect(spits.length).toBeGreaterThan(0)
    expect(spits[0]!.flags).toContain('duo')
    expect(spits[0]!.targetSide).toBe('right')
    expect(spits[0]!.value).toBeUndefined()
  })

  it('MURO VIVENTE non emette NESSUNA traccia — scelta di design, non dimenticanza', () => {
    // Muro Vivente impedisce (le retrovie non sono bersagliabili): non esiste un istante
    // da annunciare. Vive solo come pill persistente in arena. Vedi la spec, §4.
    const left = [dw('tank', 'Tank', 'base_attack', { hp: 200 }), dw('att', 'Attaccante', 'base_attack')]
    const right = [dw('foe', 'Attaccante', 'base_attack', { hp: 120 })]

    const res = simulateBattle(left, right, makeRng('duo-muro'), { leftDuos: duo('muro-vivente') })

    expect(res.log.some(e => e.duoId === 'muro-vivente')).toBe(false)
  })
```

Se `episkey` non è l'id della magia di cura usata nei test, usa quello già presente in `data/spells.ts` — **non inventarlo**.

- [ ] **Step 2: Esegui i test per confermare il RED**

Run: `npx vitest run tests/engine/duoTrace.test.ts`
Expected: FAIL su MIASMA e UNTORE (nessuna riga). Il test di MURO VIVENTE passa già — è un lucchetto, non un bug da risolvere.

- [ ] **Step 3: `maybeSpreadPoison` riporta cosa ha fatto**

Sostituisci il corpo di `game/engine/duoEffects/spreadOnDeath.ts` (la logica resta IDENTICA — cambia solo il valore di ritorno; nessun pescaggio RNG in più, nessun ordine cambiato):

```ts
import type { BattleUnit } from '@/types'
import type { Rng } from '@/game/engine/rng'
import { applyStatus } from '@/game/engine/status'

const VELENO_CAP = 8

/** MIASMA (Duo Combos, player-only): when a poisoned ENEMY dies, its veleno stacks jump to
 *  ONE random living enemy. Deterministic by construction: the candidate pool is sorted by
 *  wizard.id before the single `rng.pick` draw, and NO draw happens when the pool is empty
 *  (a phantom draw would shift the whole downstream rng stream and desync replay). Operates
 *  only on the already-resolved death — never recurses into further deaths.
 *
 *  Returns WHAT it did (recipient + stacks moved) so the caller can log it — the spread used
 *  to be silent and the poison appeared out of nowhere. `null` = nothing happened. */
export function maybeSpreadPoison(
  dead: BattleUnit, enemiesOfDead: BattleUnit[], rng: Rng,
): { recipient: BattleUnit; stacks: number } | null {
  if (dead.side !== 'right') return null // player-only owner ⇒ only enemy deaths spread poison
  const velenoEffect = dead.statusEffects.find(e => e.statusId === 'veleno')
  const stacks = velenoEffect?.stacks ?? 0
  if (stacks <= 0) return null
  const pool = enemiesOfDead
    .filter(u => u.alive && u !== dead)
    .sort((a, b) => a.wizard.id.localeCompare(b.wizard.id))
  if (pool.length === 0) return null // no rng draw when there's no candidate (parity)
  const recipient = rng.pick(pool)
  const have = recipient.statusEffects.find(e => e.statusId === 'veleno')?.stacks ?? 0
  const toAdd = Math.min(stacks, VELENO_CAP - have)
  // Carry forward the ORIGINAL poisoner's credit string (ActiveEffect.sourceId, "side:id"),
  // not the dead unit's own identity — BattleUnit has no `sourceId` field, and crediting the
  // dead enemy itself would misattribute the DoT-tick score (see status.ts tickStatuses).
  for (let i = 0; i < toAdd; i++) applyStatus(recipient, 'veleno', { sourceId: velenoEffect?.sourceId })
  if (toAdd <= 0) return null // il bersaglio era già al cap: nulla si è mosso, niente da loggare
  return { recipient, stacks: toAdd }
}
```

- [ ] **Step 4: `maybeSpitPoison` riporta chi ha colpito**

Sostituisci il corpo di `game/engine/duoEffects/spitOnHeal.ts` (logica identica, cambia solo il ritorno):

```ts
import type { BattleUnit } from '@/types'
import type { Rng } from '@/game/engine/rng'
import { applyStatus } from '@/game/engine/status'

/** UNTORE (Duo Combos, player-only): every time the player team HEALS, jab ONE random living
 *  enemy with a dose of veleno. Deterministic by construction: the candidate pool is sorted by
 *  wizard.id before the single `rng.pick` draw, and NO draw happens when the pool is empty (a
 *  phantom draw would shift the whole downstream rng stream and desync replay). Mirrors
 *  `spreadOnDeath.ts`'s pick shape 1:1.
 *
 *  Returns the enemy it hit (or `null`) so the caller can log it — the spit used to be silent. */
export function maybeSpitPoison(enemies: BattleUnit[], rng: Rng, sourceId: string): BattleUnit | null {
  const pool = enemies
    .filter(u => u.alive)
    .sort((a, b) => a.wizard.id.localeCompare(b.wizard.id))
  if (pool.length === 0) return null // no rng draw when there's no candidate (parity)
  const recipient = rng.pick(pool)
  applyStatus(recipient, 'veleno', { sourceId })
  return recipient
}
```

- [ ] **Step 5: Logga MIASMA nei suoi 4 call-site**

In `game/engine/combat/simulate.ts` ci sono **quattro** morti che possono propagare (colpo diretto `:317`, rinculo `:338`, tick DoT `:375`, fatica `:420`). Per non ripetere il `pushLog` quattro volte, definisci **un solo helper** subito dopo `const pushLog = …` (riga 117):

```ts
  // MIASMA/UNTORE: le righe di log delle propagazioni. NESSUN `value`: qui si muovono stack
  // di veleno, non HP — e buildReplay ricostruisce gli HP proprio dai `value` del log, quindi
  // un value valorizzato farebbe divergere il replay dalla simulazione.
  const logSpread = (dead: BattleUnit, t: number, spread: { recipient: BattleUnit; stacks: number } | null) => {
    if (!spread) return
    pushLog({
      turn: t, actorId: dead.wizard.id, actorSide: dead.side, action: 'Miasma',
      targetId: spread.recipient.wizard.id, targetSide: spread.recipient.side,
      type: 'system', flags: ['duo'], duoId: 'miasma',
    })
  }
```

Poi sostituisci le quattro chiamate:

```ts
        // :317 — morte per colpo diretto
        if (miasma && realTarget.side === 'right') logSpread(realTarget, turn, maybeSpreadPoison(realTarget, R, rng))
```
```ts
        // :338 — il rinculo può uccidere l'attore nemico
        if (miasma && actor.side === 'right') logSpread(actor, turn, maybeSpreadPoison(actor, R, rng))
```
```ts
        // :375 — morte per tick di veleno/burn
        if (miasma && u.side === 'right') logSpread(u, turn, maybeSpreadPoison(u, R, rng))
```
```ts
        // :420 — morte per fatica (anti-stallo)
        if (miasma && u.side === 'right') logSpread(u, turn, maybeSpreadPoison(u, R, rng))
```

- [ ] **Step 6: Logga UNTORE nel suo call-site**

Sempre in `simulate.ts`, sostituisci il blocco a righe 283-288:

```ts
        // UNTORE: any heal landing on a player ally spits 1 veleno dose onto a random living
        // enemy (deterministic single rng.pick; no-op if none left). Credited to the healer
        // (the acting caster), not the healed unit — mirrors how score credits `actor`.
        if (untore && realTarget.side === 'left') {
          const bitten = maybeSpitPoison(R, rng, `${actor.side}:${actor.wizard.id}`)
          if (bitten) {
            pushLog({
              turn, actorId: actor.wizard.id, actorSide: actor.side, action: 'Untore',
              targetId: bitten.wizard.id, targetSide: bitten.side,
              type: 'system', flags: ['duo'], duoId: 'untore',
            })
          }
        }
```

- [ ] **Step 7: Esegui i test per il GREEN**

Run: `npx vitest run tests/engine/duoTrace.test.ts`
Expected: PASS (7 test).

- [ ] **Step 8: Verifica la PARITÀ DEL REPLAY — il passo che protegge l'anti-cheat**

Run: `npx vitest run tests/engine/endlessReplayParity.test.ts`
Expected: PASS.

Se fallisce: **non toccare il test**. Significa che una riga nuova ha spostato gli HP ricostruiti o l'RNG. Controlla, in quest'ordine: (1) le righe nuove hanno `value` valorizzato? devono averlo assente; (2) sono passate da `pushLog` e non da `log.push`? (3) le due primitive pescano dall'RNG lo stesso numero di volte di prima? La logica di pesca non deve essere cambiata da questo task.

- [ ] **Step 9: Suite completa + typecheck**

Run: `npm run test && npm run typecheck`
Expected: 1367+ test verdi (i 7 nuovi in più), typecheck pulito. Nessun test preesistente rosso.

- [ ] **Step 10: Commit**

```bash
git add game/engine/duoEffects/spreadOnDeath.ts game/engine/duoEffects/spitOnHeal.ts game/engine/combat/simulate.ts tests/engine/duoTrace.test.ts
git commit -m "feat(duos): MIASMA e UNTORE emettono una riga di log (il veleno non compare piu dal nulla)"
```

---

## Task 5: Il pannello a ricetta nel run

`DuoBar` oggi nasconde i Duo lontani e non spiega mai come accendere un segnale. Diventa `DuoPanel`: tutti e 6, ordinati, con la ricetta a gemme e il "come accendere".

**Files:**
- Modify: `data/duos.ts` (aggiungi `SIGNAL_HOWTO`)
- Create: `components/run/DuoPanel.tsx`
- Delete: `components/run/DuoBar.tsx`
- Modify: `components/run/TeamSynergyBar.tsx:210` (import + mount)
- Delete: `tests/ui/duoBar.test.tsx`
- Test: `tests/ui/duoPanel.test.tsx` (create)

**Interfaces:**
- Produces: `SIGNAL_HOWTO: Record<DuoSignal, string>` in `data/duos.ts`.
- Produces: `DuoPanel({ team, relics }: { team: DraftedWizard[]; relics: ActiveRelic[] })` — stessa firma del vecchio `DuoBar`, così il punto di montaggio non cambia.
- Consumes: `duoProgress(team, relics): DuoProgress[]` (`game/engine/duos.ts:43`), `DUO_SIGNALS_IN_USE` (`:57`), `SIGNAL_ICON`/`SIGNAL_COLOR`/`SIGNAL_LABEL` (`data/duos.ts:3,26,30`).

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `tests/ui/duoPanel.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DuoPanel } from '@/components/run/DuoPanel'
import { DUOS } from '@/data/duos'

// Squadra: accende MURO VIVENTE (scudirigen via 2 maghi taggati + taunt via 1 Tank) ed è a un
// passo da CANCRENA (veleno acceso dagli stessi 2 maghi, esecuzione mancante).
const team = [
  { wizard: { id: 'a', name: 'Tank', house: 'Grifondoro', role: 'Tank', tags: [] }, level: 1, stats: {}, maxHp: 100 },
  { wizard: { id: 'b', name: 'Att', house: 'Grifondoro', role: 'Attaccante', tags: ['scudirigen', 'veleno'] }, level: 1, stats: {}, maxHp: 100 },
  { wizard: { id: 'c', name: 'Sup', house: 'Grifondoro', role: 'Supporto', tags: ['scudirigen', 'veleno'] }, level: 1, stats: {}, maxHp: 100 },
] as any

describe('DuoPanel', () => {
  it('mostra TUTTI e 6 i Duo, anche quelli lontani', () => {
    const { container } = render(<DuoPanel team={team} relics={[]} />)
    for (const d of DUOS) {
      expect(container.querySelector(`[data-duo="${d.id}"]`)).not.toBeNull()
    }
  })

  it('marca lo stato: attivo / a un passo / lontano', () => {
    const { container } = render(<DuoPanel team={team} relics={[]} />)
    expect(container.querySelector('[data-duo="muro-vivente"][data-state="active"]')).not.toBeNull()
    expect(container.querySelector('[data-duo="cancrena"][data-state="near"]')).not.toBeNull()
    // esecuzione+controllo: nessuno dei due acceso → lontano
    expect(container.querySelector('[data-duo="esecuzione-a-freddo"][data-state="locked"]')).not.toBeNull()
  })

  it('spiega COME accendere il segnale mancante di un Duo a un passo', () => {
    render(<DuoPanel team={team} relics={[]} />)
    // A Cancrena manca Esecuzione: la soglia reale è "2 maghi ... oppure 1 reliquia".
    expect(screen.getByTestId('howto-cancrena')).toHaveTextContent(/2 maghi/i)
    expect(screen.getByTestId('howto-cancrena')).toHaveTextContent(/reliquia/i)
  })

  it('il Tank si accende con UN SOLO Tank (soglia asimmetrica, non 2)', () => {
    // Squadra senza Tank: Muro Vivente diventa "a un passo" e il suo howto deve dire 1 Tank.
    const noTank = [
      { wizard: { id: 'b', name: 'Att', house: 'Grifondoro', role: 'Attaccante', tags: ['scudirigen'] }, level: 1, stats: {}, maxHp: 100 },
      { wizard: { id: 'c', name: 'Sup', house: 'Grifondoro', role: 'Supporto', tags: ['scudirigen'] }, level: 1, stats: {}, maxHp: 100 },
    ] as any
    render(<DuoPanel team={noTank} relics={[]} />)
    const howto = screen.getByTestId('howto-muro-vivente')
    expect(howto).toHaveTextContent(/1 Tank/i)
    expect(howto).not.toHaveTextContent(/2 Tank/i)
  })

  it('non nomina MAI il segnale Attaccante: nessun Duo spedito lo usa', () => {
    const { container } = render(<DuoPanel team={team} relics={[]} />)
    expect(container.textContent).not.toContain('Attaccante')
  })
})
```

- [ ] **Step 2: Esegui il test per confermare il RED**

Run: `npx vitest run tests/ui/duoPanel.test.tsx`
Expected: FAIL — `@/components/run/DuoPanel` non esiste.

- [ ] **Step 3: Aggiungi la mappa "come accendere"**

In `data/duos.ts`, in fondo al file:

```ts
/** Come si accende ogni segnale. Le soglie sono ASIMMETRICHE e queste stringhe devono dire
 *  il vero: la fonte è `signalActive` (game/engine/duos.ts:23-30) — Tank basta 1, gli altri
 *  ruoli ne vogliono 2, i tag vogliono 2 maghi OPPURE una reliquia. `attaccante` è nella
 *  mappa per completezza del tipo, ma nessun Duo spedito lo usa e la UI non lo mostra mai
 *  (filtro: DUO_SIGNALS_IN_USE). */
export const SIGNAL_HOWTO: Record<DuoSignal, string> = {
  taunt: '1 Tank in squadra',
  supporto: '2 Supporti in squadra',
  controllo: '2 Controllori in squadra',
  attaccante: '2 Attaccanti in squadra',
  veleno: '2 maghi Veleno, oppure 1 reliquia veleno',
  esecuzione: '2 maghi Esecuzione, oppure 1 reliquia esecuzione',
  scudirigen: '2 maghi Scudo/Rigen, oppure 1 reliquia scudo',
  magieOscure: '2 maghi Magie Oscure, oppure 1 reliquia magia oscura',
}
```

- [ ] **Step 4: Scrivi il pannello**

Crea `components/run/DuoPanel.tsx`:

```tsx
'use client'
import { useState } from 'react'
import type { ActiveRelic, DraftedWizard, DuoProgress, DuoSignal } from '@/types'
import { duoProgress } from '@/game/engine/duos'
import { livingOf } from '@/game/engine/roster'
import { SIGNAL_COLOR, SIGNAL_HOWTO, SIGNAL_ICON, SIGNAL_LABEL } from '@/data/duos'

// Stesso linguaggio cromatico di SynergyTracker e del vecchio DuoBar: oro = attivo,
// verde = a un passo. I lontani restano spenti.
const GOLD = '#d9b65f'
const GREEN = '#3ecb6a'

type State = 'active' | 'near' | 'locked'
const stateOf = (p: DuoProgress): State => (p.active ? 'active' : p.missing.length === 1 ? 'near' : 'locked')
const ORDER: Record<State, number> = { active: 0, near: 1, locked: 2 }

/** Una gemma della ricetta: accesa = piena e luminosa, mancante = tratteggiata e spenta. */
function Gem({ signal, lit }: { signal: DuoSignal; lit: boolean }) {
  const c = SIGNAL_COLOR[signal]
  return (
    <span
      data-signal={signal}
      data-lit={lit ? '' : undefined}
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
      style={lit
        ? { color: c, background: `${c}1c`, boxShadow: `inset 0 0 0 1px ${c}, 0 0 10px -3px ${c}` }
        : { color: '#6f6b86', boxShadow: 'inset 0 0 0 1px currentColor' }}
    >
      <span aria-hidden>{SIGNAL_ICON[signal]}</span>
      {SIGNAL_LABEL[signal]}
    </span>
  )
}

/**
 * Pannello Duo nel run: la RICETTA di ognuna delle 6 combo. Attive e "a un passo" espanse
 * (ricetta + effetto + come accendere il segnale mancante); le lontane collassate a una riga,
 * espandibili al clic — la sidebar è larga 288px e 6 ricette intere non ci starebbero.
 * Puramente presentazionale sopra `duoProgress`.
 */
export function DuoPanel({ team, relics }: { team: DraftedWizard[]; relics: ActiveRelic[] }) {
  // Solo i maghi VIVI scendono in campo, quindi un Duo si accende qui esattamente quando si
  // accenderà in battaglia (resolvers/combat.ts calcola leftDuos da livingOf(team)).
  const progress = duoProgress(livingOf(team), relics)
  const [opened, setOpened] = useState<string | null>(null)

  const sorted = [...progress].sort((a, b) => ORDER[stateOf(a)] - ORDER[stateOf(b)])
  const activeCount = progress.filter(p => p.active).length

  return (
    <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2.5" data-testid="duo-panel">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Combo Duo</span>
        {activeCount > 0 && (
          <span className="rounded-full bg-[#caa24a]/20 px-1.5 text-[10px] font-semibold text-[#e8dcb6]">
            {activeCount} attiva{activeCount > 1 ? 'e' : ''}
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-1.5">
        {sorted.map((p) => {
          const st = stateOf(p)
          const expanded = st !== 'locked' || opened === p.duo.id
          const missing = p.missing[0]
          return (
            <li
              key={p.duo.id}
              data-duo={p.duo.id}
              data-state={st}
              className="rounded-lg border px-2 py-1.5"
              style={{
                borderColor: st === 'active' ? `${GOLD}66` : st === 'near' ? `${GREEN}55` : 'rgba(255,255,255,0.10)',
                background: st === 'active' ? `${GOLD}1f` : undefined,
                borderStyle: st === 'active' ? 'solid' : 'dashed',
                opacity: st === 'locked' ? 0.72 : 1,
              }}
            >
              {/* I lontani sono un bottone: il clic espande la ricetta. Gli altri sono già aperti. */}
              {st === 'locked' ? (
                <button
                  type="button"
                  onClick={() => setOpened(opened === p.duo.id ? null : p.duo.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-1 text-left"
                >
                  <span className="text-[11px] font-semibold text-white/55">{p.duo.name}</span>
                  <span className="flex items-center gap-1">
                    {p.duo.signals.map((s, i) => (
                      <Gem key={`${s}-${i}`} signal={s} lit={p.lit[i]!} />
                    ))}
                  </span>
                </button>
              ) : (
                <p
                  className="text-[13px] font-semibold leading-tight"
                  style={{ color: st === 'active' ? '#f3e6c4' : GREEN }}
                >
                  {p.duo.name}
                </p>
              )}

              {expanded && (
                <>
                  {st !== 'locked' && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {p.duo.signals.map((s, i) => (
                        <Gem key={`${s}-${i}`} signal={s} lit={p.lit[i]!} />
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-[11px] leading-snug text-[#c9bfa0]">{p.duo.desc}</p>
                  {missing && (
                    <p
                      data-testid={`howto-${p.duo.id}`}
                      className="mt-1 border-t border-white/10 pt-1 text-[10px] leading-snug text-white/50"
                    >
                      <span style={{ color: GREEN }}>accendi {SIGNAL_LABEL[missing]}:</span>{' '}
                      {SIGNAL_HOWTO[missing]}
                    </p>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 5: Monta il pannello al posto della barra**

In `components/run/TeamSynergyBar.tsx`: sostituisci l'import di `DuoBar` con

```tsx
import { DuoPanel } from '@/components/run/DuoPanel'
```

e il montaggio (riga ~210) con

```tsx
<DuoPanel team={team} relics={relics} />
```

Poi elimina i file superati:

```bash
git rm components/run/DuoBar.tsx tests/ui/duoBar.test.tsx
```

- [ ] **Step 6: Esegui i test per il GREEN**

Run: `npx vitest run tests/ui/duoPanel.test.tsx`
Expected: PASS (5 test).

- [ ] **Step 7: Verifica che nulla sia regredito**

Run: `npm run typecheck && npx vitest run tests/screens tests/ui`
Expected: typecheck pulito (nessun riferimento residuo a `DuoBar`); test verdi.

- [ ] **Step 8: Commit**

```bash
git add data/duos.ts components/run/DuoPanel.tsx components/run/TeamSynergyBar.tsx tests/ui/duoPanel.test.tsx
git commit -m "feat(duos): pannello a ricetta nel run — tutti e 6 i Duo, gemme e come accendere"
```

---

## Task 6: La battaglia — pill persistenti e annuncio del primo scatto

Adesso il log porta il `duoId`: l'arena può nominare la combo. Primo scatto di ogni Duo = annuncio grosso al centro; scatti successivi = solo la pill che lampeggia.

**Files:**
- Create: `components/battle/DuoPills.tsx`
- Modify: `components/battle/Callout.tsx:27-38` (priorità) e `:49` (firma)
- Modify: `components/battle/BattleArena.tsx`
- Modify: `components/screens/BattleScreen.tsx`
- Modify: `hooks/useBattleReplay.ts:16-24`
- Test: `tests/ui/duoBattle.test.tsx` (create)

**Interfaces:**
- Consumes: `LogEntry.duoId` (Task 1-4), `DUO_BY_ID` (`data/duos.ts:23`), `detectDuos(team, relics): ActiveDuo[]` (`game/engine/duos.ts:38`).
- Produces: `calloutFor(entry, appliedControl?, duoName?): { text, tone } | null` — **resta pura**: il "primo scatto sì/no" lo decide il chiamante e passa il nome solo in quel caso.
- Produces: `DuoPills({ duos, firingId }: { duos: ActiveDuo[]; firingId: string | null })`.
- Produces: `BattleArena` accetta la prop `duos?: ActiveDuo[]`.

- [ ] **Step 1: Scrivi i test che falliscono**

Crea `tests/ui/duoBattle.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { calloutFor } from '@/components/battle/Callout'
import { DuoPills } from '@/components/battle/DuoPills'
import { DUO_BY_ID } from '@/data/duos'
import type { LogEntry } from '@/types'

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({
  turn: 1, actorId: 'a', actorSide: 'left', action: 'Colpo', targetId: 'z', targetSide: 'right',
  type: 'Attacco', value: 10, flags: [], ...over,
})

describe('annuncio del Duo in battaglia', () => {
  it('al primo scatto il Duo VINCE su ESECUZIONE', () => {
    // Il frame del cold-execute è ANCHE un frame di esecuzione (crit+kill): senza la regola
    // di priorità il giocatore leggerebbe "ESECUZIONE" invece del nome della combo.
    const e = entry({ flags: ['crit', 'kill', 'duo'], duoId: 'esecuzione-a-freddo' })
    const co = calloutFor(e, null, DUO_BY_ID['esecuzione-a-freddo']!.name)
    expect(co?.text).toBe('ESECUZIONE A FREDDO')
  })

  it('senza nome (= non è il primo scatto) si comporta come prima', () => {
    const e = entry({ flags: ['crit', 'kill', 'duo'], duoId: 'esecuzione-a-freddo' })
    const co = calloutFor(e, null, null)
    expect(co?.text).toBe('ESECUZIONE')
  })

  it('le pill elencano i Duo attivi e solo quella che scatta lampeggia', () => {
    const duos = [{ duo: DUO_BY_ID['mietitore']! }, { duo: DUO_BY_ID['muro-vivente']! }]
    const { container } = render(<DuoPills duos={duos} firingId="mietitore" />)
    expect(screen.getByText('Mietitore')).toBeInTheDocument()
    expect(screen.getByText('Muro Vivente')).toBeInTheDocument()
    expect(container.querySelector('[data-duo-pill="mietitore"][data-firing]')).not.toBeNull()
    expect(container.querySelector('[data-duo-pill="muro-vivente"][data-firing]')).toBeNull()
  })

  it('senza Duo attivi non disegna nulla', () => {
    const { container } = render(<DuoPills duos={[]} firingId={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Esegui i test per confermare il RED**

Run: `npx vitest run tests/ui/duoBattle.test.tsx`
Expected: FAIL — `DuoPills` non esiste; `calloutFor` accetta solo 2 argomenti.

- [ ] **Step 3: La priorità nel Callout**

In `components/battle/Callout.tsx`, sostituisci `calloutFor` e la firma del componente:

```tsx
/**
 * Il grande annuncio centrale del frame. Priorità: il DUO vince su tutto — è l'informazione
 * rara, e il frame in cui scatta ESECUZIONE A FREDDO è anche un frame di esecuzione (crit+kill),
 * quindi senza questa regola il giocatore leggerebbe "ESECUZIONE" e non saprebbe mai che è
 * stata la combo. Poi: colpo mortale, controllo appena applicato, e infine i flag sulla entry.
 *
 * Resta PURA: non può sapere se è il primo scatto del Duo in questa battaglia. Il chiamante
 * (BattleArena) lo decide e passa `duoName` SOLO al primo scatto; dal secondo in poi passa
 * null e qui non cambia nulla rispetto a prima.
 */
export function calloutFor(
  entry: LogEntry | null, appliedControl?: string | null, duoName?: string | null,
): { text: string; tone: string } | null {
  if (!entry) return null
  const flags = entry.flags ?? []
  if (duoName && entry.duoId) return { text: duoName.toUpperCase(), tone: '#d9b65f' }
  if (flags.includes('crit') && flags.includes('kill')) return { text: 'ESECUZIONE', tone: '#e05a4a' }
  if (appliedControl && CONTROL_CALLOUT[appliedControl]) return CONTROL_CALLOUT[appliedControl]!
  if (flags.includes('crit')) return { text: 'CRITICO', tone: '#f6e6a8' }
  if (flags.includes('block')) return { text: 'PARATO', tone: '#8ec9ff' }
  if (flags.includes('dodge')) return { text: 'SCHIVA', tone: '#8ec9ff' }
  if (flags.includes('heal')) return { text: 'CURA', tone: '#79e6a0' }
  if (flags.includes('dot')) return { text: 'VELENO', tone: '#a9de5c' }
  return null
}
```

e nel componente `Callout`, aggiungi la prop e passala:

```tsx
export function Callout({ entry, frameKey, appliedControl = null, duoName = null }: { entry: LogEntry | null; frameKey: number; appliedControl?: string | null; duoName?: string | null }) {
```

```tsx
    const co = calloutFor(entry, appliedControl, duoName)
```

e aggiungi `duoName` all'array di dipendenze dello `useEffect` che ascolta `[frameKey, entry, appliedControl]`.

- [ ] **Step 4: Le pill**

Crea `components/battle/DuoPills.tsx`:

```tsx
'use client'
import type { ActiveDuo } from '@/types'
import { SIGNAL_ICON } from '@/data/duos'

/**
 * I Duo attivi, sempre visibili in un angolo dell'arena: durante il combattimento la sidebar
 * non c'è, quindi senza queste il giocatore non sa nemmeno quali combo ha in campo. La pill del
 * Duo che sta scattando in questo frame si illumina — è il feedback "sottile" dal secondo
 * scatto in poi (il primo ha già avuto l'annuncio grande al centro).
 */
export function DuoPills({ duos, firingId }: { duos: ActiveDuo[]; firingId: string | null }) {
  if (duos.length === 0) return null
  return (
    <div className="pointer-events-none absolute left-3 top-2 z-20 flex flex-col items-start gap-1">
      {duos.map(({ duo }) => {
        const firing = duo.id === firingId
        return (
          <span
            key={duo.id}
            data-duo-pill={duo.id}
            data-firing={firing ? '' : undefined}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-all duration-200 sm:text-xs"
            style={{
              color: firing ? '#1a1305' : '#f3e6c4',
              background: firing ? '#d9b65f' : 'rgba(24,16,8,0.7)',
              boxShadow: firing ? '0 0 22px rgba(217,182,95,0.75)' : 'inset 0 0 0 1px rgba(217,182,95,0.45)',
            }}
          >
            <span aria-hidden>{SIGNAL_ICON[duo.signals[0]]}</span>
            {duo.name}
          </span>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: L'arena: pill + primo scatto**

In `components/battle/BattleArena.tsx`:

aggiungi gli import

```tsx
import type { ActiveDuo } from '@/types'
import { DUO_BY_ID } from '@/data/duos'
import { DuoPills } from './DuoPills'
```

aggiungi la prop `duos` (default: nessun Duo)

```tsx
export function BattleArena({
  replay, hp, entry, frameKey = 0, leftTitle = 'La tua squadra', rightTitle = 'Avversari', center, enemyLevel = 1, speed = 1, duos = [],
}: {
  replay: Replay
  hp: Record<string, number>
  entry: LogEntry | null
  frameKey?: number
  leftTitle?: string
  rightTitle?: string
  center?: React.ReactNode
  enemyLevel?: number
  speed?: number
  /** Duo attivi del giocatore in questa battaglia (player-only). */
  duos?: ActiveDuo[]
}) {
```

dopo la memo del boss-telegraph, aggiungi il calcolo del primo scatto — **puro**, derivato dai frame, così un riavvolgimento del replay non lo confonde e non serve nessun ref mutabile:

```tsx
  // Primo scatto di ogni Duo in QUESTA battaglia: l'indice del primo frame che lo marchia.
  // Derivato dai frame (non da un ref): riavvolgere o rigiocare il replay dà lo stesso esito.
  const firstFireAt = useMemo(() => {
    const m = new Map<string, number>()
    replay.frames.forEach((f, i) => {
      const id = f.entry?.duoId
      if (id && !m.has(id)) m.set(id, i)
    })
    return m
  }, [replay.frames])

  const firingId = entry?.duoId ?? null
  // L'annuncio grosso col nome SOLO al primo scatto; dopo, la pill lampeggia e basta.
  const duoName = firingId && firstFireAt.get(firingId) === frameKey
    ? (DUO_BY_ID[firingId]?.name ?? null)
    : null
```

monta le pill dentro il contenitore dell'arena (subito dopo `<ArenaBackdrop />`) e passa `duoName` al Callout:

```tsx
      <ArenaBackdrop />
      <DuoPills duos={duos} firingId={firingId} />
```

```tsx
      <Callout entry={entry} frameKey={frameKey} appliedControl={appliedControl} duoName={duoName} />
```

- [ ] **Step 6: Passa i Duo attivi dall'alto**

In `components/screens/BattleScreen.tsx`, aggiungi gli import

```tsx
import { detectDuos } from '@/game/engine/duos'
import { livingOf } from '@/game/engine/roster'
```

e calcola i Duo attivi con gli STESSI ingressi del motore (`resolvers/combat.ts:89` fa `detectDuos(livingOf(ready), state.relics)`), così la lista in arena non può divergere da quella che ha davvero agito:

```tsx
  const activeDuos = useMemo(
    () => detectDuos(livingOf(playerTeam), playerRelics ?? []),
    [playerTeam, playerRelics],
  )
```

poi passala all'arena (cerca `<BattleArena` nel file e aggiungi la prop):

```tsx
        duos={activeDuos}
```

- [ ] **Step 7: Dai all'annuncio il tempo di essere letto**

In `hooks/useBattleReplay.ts`, in `frameDelay` (righe 16-24): un frame Duo è di tipo `system` e oggi durerebbe **metà** del normale — l'annuncio sparirebbe prima che tu lo legga. Aggiungi il ramo **prima** di quello di sistema:

```ts
  // Un frame che porta un Duo è il momento raro della battaglia: dura di più (come un kill),
  // altrimenti l'annuncio centrale sfarfalla via. Va PRIMA del ramo 'system', che dimezza.
  if (entry.duoId) return base * 1.7
```

- [ ] **Step 8: Esegui i test per il GREEN**

Run: `npx vitest run tests/ui/duoBattle.test.tsx`
Expected: PASS (4 test).

- [ ] **Step 9: Suite completa + typecheck**

Run: `npm run test && npm run typecheck`
Expected: tutti verdi. Attenzione ai test esistenti di `Callout`/`BattleArena`: la firma di `calloutFor` ha un terzo parametro **opzionale**, quindi le chiamate a 2 argomenti restano valide — se un test rompe, è un segnale vero, non da silenziare.

- [ ] **Step 10: Commit**

```bash
git add components/battle/DuoPills.tsx components/battle/Callout.tsx components/battle/BattleArena.tsx components/screens/BattleScreen.tsx hooks/useBattleReplay.ts tests/ui/duoBattle.test.tsx
git commit -m "feat(duos): pill dei Duo attivi in arena + annuncio del primo scatto (il Duo vince su ESECUZIONE)"
```

---

## Task 7: Verifica finale a schermo

I test verdi non dimostrano che si veda. Questo task guarda il gioco vero.

**Files:** nessuno (verifica).

- [ ] **Step 1: Suite + typecheck**

Run: `npm run test && npm run typecheck`
Expected: verdi, nessuna regressione sulla baseline di 1367 test (più i ~16 nuovi).

- [ ] **Step 2: Parità del replay (l'anti-cheat)**

Run: `npx vitest run tests/engine/endlessReplayParity.test.ts`
Expected: PASS. È il gate che protegge la classifica Endless: se è rosso, non si va oltre.

- [ ] **Step 3: Guarda il pannello e la battaglia**

Usa la skill `verify` (o l'harness Playwright già presente) per: avviare il gioco, arrivare alla mappa con una squadra, **guardare la sidebar** (tutti e 6 i Duo? i lontani collassati? il "come accendere" sul segnale mancante?), entrare in un combattimento e **guardare l'arena** (le pill ci sono? quando un Duo scatta compare l'annuncio col suo nome?).

Expected: il pannello mostra 6 Duo e nessuna occorrenza della parola "Attaccante" fra i segnali; in battaglia le pill dei Duo attivi sono visibili.

- [ ] **Step 4: Riporta all'utente**

Riassumi cosa hai visto **davvero** (con screenshot se disponibili), incluso ciò che non funziona. Non dichiarare completo ciò che non hai osservato.

---

## Self-Review

**Copertura della spec**
- §1 Motore (traccia) → Task 1 (tipi + ESECUZIONE A FREDDO), Task 2 (CANCRENA), Task 3 (MIETITORE), Task 4 (MIASMA, UNTORE + il lucchetto su MURO VIVENTE). ✓
- §1 vincolo parità replay → Global Constraints + Task 4 Step 8 + Task 7 Step 2. ✓
- §2 Pannello (6 Duo, gemme, come accendere, soglie reali, niente `attaccante`) → Task 5, con un test per ciascuna di queste quattro affermazioni. ✓
- §3 Battaglia (pill persistenti, primo scatto forte, scatti successivi sottili, priorità Duo > ESECUZIONE, purezza di `calloutFor`) → Task 6. ✓
- §4 Debito noto MURO VIVENTE → non "risolto" (è fuori scope), ma inchiodato da un test in Task 4 così nessuno lo "aggiusta" per sbaglio. ✓
- §5 Verifica → i gate sono in ogni task; la verifica a schermo è il Task 7. ✓

**Placeholder:** nessun TBD. Ogni step che cambia codice mostra il codice; ogni step che verifica mostra il comando e l'esito atteso. Dove un id di magia potrebbe non esistere (`serpensortia`, `episkey`) il piano dice esplicitamente di copiarlo dai test esistenti invece di inventarlo.

**Coerenza dei tipi:** `LogEntry.duoId?: string` (Task 1) è letto identico in Task 2/3/4 (motore) e Task 6 (UI). `EffectCtx.duoIds?: string[]` è scritto solo in `effects.ts` e letto solo in `resolve.ts`. `maybeSpreadPoison` → `{ recipient, stacks } | null` e `maybeSpitPoison` → `BattleUnit | null` (Task 4) sono usati con quella forma esatta nei call-site dello stesso task. `calloutFor(entry, appliedControl?, duoName?)` (Task 6) mantiene i due parametri esistenti in testa, quindi ogni chiamata attuale continua a compilare. `DuoPanel({ team, relics })` ha la stessa firma del `DuoBar` che sostituisce, quindi il punto di montaggio non cambia.

**Rischio residuo dichiarato:** il Task 4 è l'unico che può rompere l'anti-cheat della classifica. È isolato in un task suo, con il gate di parità come step esplicito e le tre cause da controllare in caso di rosso.
