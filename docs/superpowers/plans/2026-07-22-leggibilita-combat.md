# Leggibilità del combattimento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un meter centrale a due modalità (Economia dei corpi / corsa Veleno) che rende il replay del combattimento leggibile come una storia — PURA UI, motore intatto.

**Architecture:** Derivazioni pure in `lib/combatReadout.ts` (dal `ReplayFrame` + `ReplayUnit[]` esistenti), consumate da un componente presentazionale `components/battle/CenterMeter.tsx`, montato SOPRA `ActionPanel` nello slot `center` da `BattleScreen`. Nessuna modifica al sim, al RunLog, alla parità anti-cheat, ai test di bilanciamento.

**Tech Stack:** TypeScript, React, Vitest + @testing-library/react. Path alias `@/` → root repo.

## Global Constraints

- **Rischio motore ZERO.** Nessuna modifica a `game/engine/**`, al `RunLog`, alla parità, al bilanciamento. Solo `lib/` + `components/` + test.
- `npm run test` (vitest) **NON esegue typecheck** — ogni task che tocca TS chiude con `npm run typecheck` (`tsc --noEmit`) verde, oltre ai test.
- Le derivazioni in `combatReadout.ts` sono **pure**: nessuno stato, nessun side-effect, funzioni `(frame, units, ...) → dato`.
- **Player side = `'left'`** (costante nel codice, vedi BattleScreen). Nemici = `'right'`.
- Il veleno negli status: un `ActiveEffect` con `statusId === 'veleno'`, campo `stacks` (1..8). Costanti veleno (da `data/statuses.ts:24`): `tickDamage: 4`, `tickPctMaxHp: 0.005`, `tickStackCapForPct: 8`.
- **Glanceable:** il meter è una striscia sottile, niente paragrafi (frame veloci ~600ms). Dato a colpo d'occhio.
- **ActionPanel e UnitBust NON si toccano.** Il meter va SOPRA ActionPanel, non lo sostituisce.
- `ReplayFrame` (da `@/game/engine/combat/replay`): `{ index, entry, hp: Record<string,number>, cooldowns, statusEffects: Record<string, ActiveEffect[]>, spd? }`. `ReplayUnit`: `{ key, side, id, name, maxHp, corrotto?, ... }`. `unitKey(side, id)` = `` `${side}:${id}` ``.
- `alive` NON è nel frame → derivato come `hp > 0` (unità con `frame.hp[key] > 0`).

---

### Task 1: `combatReadout.ts` — derivazioni pure

**Files:**
- Create: `lib/combatReadout.ts`
- Test: `tests/lib/combatReadout.test.ts`

**Interfaces:**
- Consumes: `ReplayFrame`, `ReplayUnit`, `unitKey` da `@/game/engine/combat/replay`; `ActiveEffect`, `Side` da `@/types`.
- Produces:
  - `livingCount(frame: ReplayFrame, units: ReplayUnit[], side: Side): number` — nemici/alleati vivi (hp>0) su quel side.
  - `venomOf(frame: ReplayFrame, unit: ReplayUnit): number` — stack veleno su un'unità (0 se assente).
  - `venomPerTurn(stacks: number, maxHp: number): number` — stima danno/turno veleno: `4*stacks + min(stacks,8)*0.005*maxHp`, arrotondato. 0 se stacks 0.
  - `focusEnemy(frame, units, playerSide): ReplayUnit | null` — regola ibrida: fra i nemici VIVI, quello con più stack veleno (a parità, HP più basso); se nessun nemico vivo ha veleno, il bersaglio dell'`entry` corrente se è un nemico vivo; senò `null`.
  - `turnsToDie(hp: number, perTurn: number): number | null` — `ceil(hp/perTurn)`; `null` se `perTurn<=0`.

- [ ] **Step 1: Scrivere il test che fallisce**

Create `tests/lib/combatReadout.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { livingCount, venomOf, venomPerTurn, focusEnemy, turnsToDie } from '@/lib/combatReadout'
import type { ReplayFrame, ReplayUnit } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'
import type { ActiveEffect } from '@/types'

// minimal ReplayUnit factory
const ru = (side: 'left' | 'right', id: string, maxHp = 100): ReplayUnit =>
  ({ key: unitKey(side, id), side, id, name: id, maxHp } as ReplayUnit)

const venom = (stacks: number): ActiveEffect =>
  ({ kind: 'dot', statusId: 'veleno', remaining: 2, stacks } as ActiveEffect)

// frame factory: hp map + optional statusEffects + optional entry
const frame = (
  hp: Record<string, number>,
  statusEffects: Record<string, ActiveEffect[]> = {},
  entry: ReplayFrame['entry'] = null,
): ReplayFrame => ({ index: 1, entry, hp, cooldowns: {}, statusEffects })

describe('livingCount', () => {
  it('conta le unità con hp>0 sul side', () => {
    const units = [ru('right', 'a'), ru('right', 'b'), ru('left', 'p')]
    const f = frame({ 'right:a': 50, 'right:b': 0, 'left:p': 80 })
    expect(livingCount(f, units, 'right')).toBe(1) // b è morto
    expect(livingCount(f, units, 'left')).toBe(1)
  })
})

describe('venomOf', () => {
  it('ritorna gli stack veleno, 0 se assente', () => {
    const u = ru('right', 'a')
    const f = frame({ 'right:a': 50 }, { 'right:a': [venom(6)] })
    expect(venomOf(f, u)).toBe(6)
    const f0 = frame({ 'right:a': 50 }, {})
    expect(venomOf(f0, u)).toBe(0)
  })
})

describe('venomPerTurn', () => {
  it('applica 4*stacks + min(stacks,8)*0.005*maxHp arrotondato', () => {
    // 6 stack, maxHp 800: 4*6=24 + 6*0.005*800=24 → 48
    expect(venomPerTurn(6, 800)).toBe(48)
    // cap del termine pct a 8 stack: 10 stack, maxHp 800: 40 + 8*0.005*800=32 → 72
    expect(venomPerTurn(10, 800)).toBe(72)
    expect(venomPerTurn(0, 800)).toBe(0)
  })
})

describe('focusEnemy', () => {
  it('sceglie il nemico vivo più avvelenato (a parità, HP più basso)', () => {
    const units = [ru('right', 'a'), ru('right', 'b'), ru('left', 'p')]
    const f = frame(
      { 'right:a': 50, 'right:b': 30, 'left:p': 80 },
      { 'right:a': [venom(3)], 'right:b': [venom(3)] }, // parità stack → HP più basso = b
    )
    expect(focusEnemy(f, units, 'left')?.id).toBe('b')
  })
  it('ignora un nemico morto anche se avvelenato', () => {
    const units = [ru('right', 'a'), ru('right', 'b')]
    const f = frame({ 'right:a': 0, 'right:b': 40 }, { 'right:a': [venom(8)], 'right:b': [venom(1)] })
    expect(focusEnemy(f, units, 'left')?.id).toBe('b') // a è morto
  })
  it('senza veleno, segue il bersaglio nemico vivo dell’azione', () => {
    const units = [ru('right', 'a'), ru('right', 'b')]
    const entry = { targetSide: 'right', targetId: 'b' } as ReplayFrame['entry']
    const f = frame({ 'right:a': 50, 'right:b': 40 }, {}, entry)
    expect(focusEnemy(f, units, 'left')?.id).toBe('b')
  })
  it('senza veleno e senza bersaglio nemico valido → null', () => {
    const units = [ru('right', 'a')]
    const f = frame({ 'right:a': 50 }, {}, null)
    expect(focusEnemy(f, units, 'left')).toBeNull()
  })
})

describe('turnsToDie', () => {
  it('ceil(hp/perTurn), null se perTurn<=0', () => {
    expect(turnsToDie(50, 20)).toBe(3)
    expect(turnsToDie(50, 0)).toBeNull()
  })
})
```

- [ ] **Step 2: Eseguire il test per verificare che fallisca**

Run: `npm run test -- tests/lib/combatReadout.test.ts`
Expected: FAIL — import error / funzioni non definite.

- [ ] **Step 3: Implementare le derivazioni**

Create `lib/combatReadout.ts`:

```ts
import type { ReplayFrame, ReplayUnit } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'
import type { Side } from '@/types'

/** Costanti veleno (mirror di data/statuses.ts:24 — NON importate dal motore per tenere
 *  questo modulo puro-UI; se cambiano lì, aggiornare qui). */
const VENOM_TICK = 4
const VENOM_PCT_MAXHP = 0.005
const VENOM_PCT_STACK_CAP = 8

/** Unità vive (hp>0) su un side, dal frame. `alive` non è nel frame → derivato. */
export function livingCount(frame: ReplayFrame, units: ReplayUnit[], side: Side): number {
  return units.filter(u => u.side === side && (frame.hp[u.key] ?? 0) > 0).length
}

/** Stack di veleno su un'unità in questo frame (0 se non avvelenata). */
export function venomOf(frame: ReplayFrame, unit: ReplayUnit): number {
  const effs = frame.statusEffects[unit.key] ?? []
  const v = effs.find(e => e.statusId === 'veleno')
  return v?.stacks ?? 0
}

/** Stima del danno-veleno per turno: flat + termine percentuale (capato a 8 stack). Arrotondato.
 *  È una STIMA UI: velenoMult (reliquie) e l'amplificazione Cancrena sono engine-side e non
 *  entrano qui — il meter la marca come stima, non come verità del motore. */
export function venomPerTurn(stacks: number, maxHp: number): number {
  if (stacks <= 0) return 0
  const flat = VENOM_TICK * stacks
  const pct = Math.min(stacks, VENOM_PCT_STACK_CAP) * VENOM_PCT_MAXHP * maxHp
  return Math.round(flat + pct)
}

/** Regola ibrida di aggancio del meter: fra i nemici VIVI, il più avvelenato (a parità, HP più
 *  basso). Se nessun nemico vivo ha veleno, il bersaglio nemico vivo dell'azione corrente. Senò null. */
export function focusEnemy(frame: ReplayFrame, units: ReplayUnit[], playerSide: Side): ReplayUnit | null {
  const enemySide: Side = playerSide === 'left' ? 'right' : 'left'
  const livingEnemies = units.filter(u => u.side === enemySide && (frame.hp[u.key] ?? 0) > 0)
  const poisoned = livingEnemies
    .map(u => ({ u, v: venomOf(frame, u), hp: frame.hp[u.key] ?? 0 }))
    .filter(x => x.v > 0)
  if (poisoned.length) {
    poisoned.sort((a, b) => (b.v - a.v) || (a.hp - b.hp))
    return poisoned[0].u
  }
  // nessun veleno → bersaglio nemico vivo dell'azione
  const e = frame.entry
  if (e?.targetSide === enemySide && e.targetId) {
    const key = unitKey(enemySide, e.targetId)
    const target = livingEnemies.find(u => u.key === key)
    if (target) return target
  }
  return null
}

/** Turni stimati alla morte per veleno; null se non c'è danno/turno. */
export function turnsToDie(hp: number, perTurn: number): number | null {
  if (perTurn <= 0) return null
  return Math.ceil(hp / perTurn)
}
```

- [ ] **Step 4: Eseguire i test — devono passare**

Run: `npm run test -- tests/lib/combatReadout.test.ts`
Expected: PASS (tutti).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add lib/combatReadout.ts tests/lib/combatReadout.test.ts
git commit -m "feat(combat-ux): combatReadout — derivazioni pure per il meter centrale"
```

---

### Task 2: `CenterMeter.tsx` — componente a due modalità

**Files:**
- Create: `components/battle/CenterMeter.tsx`
- Test: `tests/ui/centerMeter.test.tsx`

**Interfaces:**
- Consumes: `livingCount`, `focusEnemy`, `venomOf`, `venomPerTurn`, `turnsToDie` (Task 1); `ReplayFrame`, `ReplayUnit` da `@/game/engine/combat/replay`; `Side` da `@/types`.
- Produces: `CenterMeter({ frame, units, playerSide }: { frame: ReplayFrame; units: ReplayUnit[]; playerSide: Side })`. Modalità:
  - **Veleno** se `focusEnemy` ritorna un nemico con `venomOf > 0`: mostra nome nemico, barra HP (hp/maxHp), stack veleno, danno/turno, "muore ~N turni" (nascosto se `turnsToDie` null). Contenitore con `data-mode="venom"`.
  - **Economia** altrimenti: bilancia corpi `livingCount(player)` vs `livingCount(enemy)`, con `data-mode="economy"`. Evidenzia il vantaggio del side con più corpi (`data-advantage="player"|"enemy"|"even"`).

- [ ] **Step 1: Scrivere il test che fallisce**

Create `tests/ui/centerMeter.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { CenterMeter } from '@/components/battle/CenterMeter'
import type { ReplayFrame, ReplayUnit } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'
import type { ActiveEffect } from '@/types'

const ru = (side: 'left' | 'right', id: string, maxHp = 100): ReplayUnit =>
  ({ key: unitKey(side, id), side, id, name: id, maxHp } as ReplayUnit)
const venom = (stacks: number): ActiveEffect =>
  ({ kind: 'dot', statusId: 'veleno', remaining: 2, stacks } as ActiveEffect)
const frame = (hp: Record<string, number>, se: Record<string, ActiveEffect[]> = {}): ReplayFrame =>
  ({ index: 1, entry: null, hp, cooldowns: {}, statusEffects: se })

describe('CenterMeter', () => {
  it('modalità economia quando nessun nemico è avvelenato', () => {
    const units = [ru('left', 'p1'), ru('left', 'p2'), ru('right', 'e1')]
    const f = frame({ 'left:p1': 80, 'left:p2': 60, 'right:e1': 40 })
    const { getByTestId } = render(<CenterMeter frame={f} units={units} playerSide="left" />)
    const el = getByTestId('center-meter')
    expect(el).toHaveAttribute('data-mode', 'economy')
    expect(el).toHaveAttribute('data-advantage', 'player') // 2 vivi vs 1
  })

  it('modalità veleno quando un nemico vivo è avvelenato', () => {
    const units = [ru('left', 'p1'), ru('right', 'e1', 800)]
    const f = frame({ 'left:p1': 80, 'right:e1': 400 }, { 'right:e1': [venom(6)] })
    const { getByTestId } = render(<CenterMeter frame={f} units={units} playerSide="left" />)
    const el = getByTestId('center-meter')
    expect(el).toHaveAttribute('data-mode', 'venom')
    expect(el).toHaveTextContent(/e1/)          // nome nemico agganciato
    expect(el).toHaveTextContent(/48/)          // danno/turno: 4*6 + 6*0.005*800 = 48
  })

  it('non mostra "muore" se il danno veleno per turno è 0 (nessun veleno → economia)', () => {
    const units = [ru('left', 'p1'), ru('right', 'e1')]
    const f = frame({ 'left:p1': 80, 'right:e1': 40 })
    const { getByTestId } = render(<CenterMeter frame={f} units={units} playerSide="left" />)
    expect(getByTestId('center-meter')).toHaveAttribute('data-mode', 'economy')
  })
})
```

- [ ] **Step 2: Eseguire il test per verificare che fallisca**

Run: `npm run test -- tests/ui/centerMeter.test.tsx`
Expected: FAIL — `CenterMeter` non esiste.

- [ ] **Step 3: Implementare il componente**

Create `components/battle/CenterMeter.tsx`. Striscia sottile, glanceable, riusa la palette esistente (rose/emerald già usati altrove). Tailwind inline come nel resto di `components/battle`.

```tsx
'use client'
import type { Side } from '@/types'
import type { ReplayFrame, ReplayUnit } from '@/game/engine/combat/replay'
import { livingCount, focusEnemy, venomOf, venomPerTurn, turnsToDie } from '@/lib/combatReadout'

/**
 * Striscia di sintesi sopra ActionPanel: racconta "chi vince la corsa".
 * - Economia (default): bilancia dei corpi vivi player vs nemici.
 * - Veleno: quando un nemico vivo è avvelenato, si aggancia al più avvelenato e
 *   mostra HP-che-scende vs veleno + stima "muore ~N turni".
 * Puro presentazionale: tutte le derivazioni vengono da lib/combatReadout.
 */
export function CenterMeter({ frame, units, playerSide }: {
  frame: ReplayFrame
  units: ReplayUnit[]
  playerSide: Side
}) {
  const enemySide: Side = playerSide === 'left' ? 'right' : 'left'
  const focus = focusEnemy(frame, units, playerSide)
  const focusVenom = focus ? venomOf(frame, focus) : 0

  const shell = 'w-full max-w-xl rounded-xl border border-[#C9A24B]/20 bg-[rgba(20,16,33,0.5)] px-3 py-1.5 text-xs backdrop-blur-sm'

  // MODALITÀ VELENO
  if (focus && focusVenom > 0) {
    const hp = frame.hp[focus.key] ?? 0
    const perTurn = venomPerTurn(focusVenom, focus.maxHp)
    const dies = turnsToDie(hp, perTurn)
    const hpPct = Math.max(0, Math.min(100, (hp / focus.maxHp) * 100))
    return (
      <div data-testid="center-meter" data-mode="venom" className={shell}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-emerald-300">☠ {focus.name}</span>
          <span className="tabular-nums text-white/70">veleno ×{focusVenom} · {perTurn}/turno</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-rose-400/80" style={{ width: `${hpPct}%` }} />
        </div>
        {dies !== null && (
          <div className="mt-0.5 text-center text-[10px] text-emerald-300/80">muore tra ~{dies} turni</div>
        )}
      </div>
    )
  }

  // MODALITÀ ECONOMIA
  const mine = livingCount(frame, units, playerSide)
  const theirs = livingCount(frame, units, enemySide)
  const advantage = mine > theirs ? 'player' : theirs > mine ? 'enemy' : 'even'
  return (
    <div data-testid="center-meter" data-mode="economy" data-advantage={advantage} className={shell}>
      <div className="flex items-center justify-center gap-3 tabular-nums">
        <span className={advantage === 'player' ? 'font-bold text-emerald-300' : 'text-white/70'}>
          Tu {'♥'.repeat(Math.max(0, mine))} {mine}
        </span>
        <span className="text-white/30">vs</span>
        <span className={advantage === 'enemy' ? 'font-bold text-rose-300' : 'text-white/70'}>
          {theirs} {'♥'.repeat(Math.max(0, theirs))} Nemici
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Eseguire i test — devono passare**

Run: `npm run test -- tests/ui/centerMeter.test.tsx`
Expected: PASS (3 test).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add components/battle/CenterMeter.tsx tests/ui/centerMeter.test.tsx
git commit -m "feat(combat-ux): CenterMeter — meter a due modalità (economia/veleno)"
```

---

### Task 3: Wiring in `BattleScreen` — stack `[CenterMeter, ActionPanel]`

**Files:**
- Modify: `components/screens/BattleScreen.tsx` (import + il prop `center` alla riga ~171)
- Test: `tests/ui/battleScreenCenter.test.tsx` (create) — smoke test che il meter è montato nell'arena

**Interfaces:**
- Consumes: `CenterMeter` (Task 2). Nel componente esistono già: `replay` (`Replay`), `r` (da `useBattleReplay`), `stickyEntry`. Il frame corrente = `replay.frames[r.index]`.
- Produces: nessuna nuova interfaccia — è il collegamento che rende il meter visibile in battaglia.

- [ ] **Step 1: Scrivere il test che fallisce**

Create `tests/ui/battleScreenCenter.test.tsx`. NB: BattleScreen è pesante; se il render fallisce per un'API di ambiente mancante (canvas/Pixi), vedi lo Step 2 fallback.

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BattleArena } from '@/components/battle/BattleArena'
import { CenterMeter } from '@/components/battle/CenterMeter'
import type { Replay } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'

// Replay minimale a 1 frame, 1v1, per verificare che il meter renda dentro lo slot center.
const replay: Replay = {
  units: [
    { key: unitKey('left', 'p'), side: 'left', id: 'p', name: 'p', house: 'Grifondoro', role: 'Attaccante', tier: 3, maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10, spell: { id: 's', name: 's', cooldown: 0 } },
    { key: unitKey('right', 'e'), side: 'right', id: 'e', name: 'e', house: 'Serpeverde', role: 'Attaccante', tier: 3, maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10, spell: { id: 's', name: 's', cooldown: 0 } },
  ] as any,
  frames: [{ index: 0, entry: null, hp: { 'left:p': 100, 'right:e': 100 }, cooldowns: {}, statusEffects: {} }],
  winner: 'left', mvpId: 'p', turns: 1,
}

describe('BattleArena center slot', () => {
  it('rende il CenterMeter passato come center', () => {
    const frame = replay.frames[0]
    const { getByTestId } = render(
      <BattleArena
        replay={replay}
        hp={frame.hp}
        entry={null}
        frameKey={0}
        center={<CenterMeter frame={frame} units={replay.units} playerSide="left" />}
      />,
    )
    expect(getByTestId('center-meter')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Eseguire il test per verificare che fallisca (o che passi già se BattleArena rende)**

Run: `npm run test -- tests/ui/battleScreenCenter.test.tsx`
Expected: idealmente PASS subito (BattleArena accetta già `center` e lo rende; il test verifica il contratto). Se FAIL per un'API di ambiente (es. Pixi/canvas `getContext`), NON combattere: questo test è secondario — la logica è già coperta da centerMeter.test.tsx. In tal caso, riduci il test al minimo che renda l'arena, oppure marcalo `it.skip` con una nota, e procedi allo Step 3 (il wiring reale). Riporta la scelta.

- [ ] **Step 3: Wiring in BattleScreen**

In `components/screens/BattleScreen.tsx`:

3a. Import (in cima, accanto agli altri import di `@/components/battle/...`):

```ts
import { CenterMeter } from '@/components/battle/CenterMeter'
```

3b. Alla riga ~171, sostituire il prop `center`. Da:

```tsx
            center={<ActionPanel entry={stickyEntry} units={replay.units} />}
```

a (stack verticale, meter sopra, ActionPanel invariato sotto):

```tsx
            center={
              <div className="flex w-full flex-col items-center gap-2">
                <CenterMeter frame={replay.frames[r.index]} units={replay.units} playerSide="left" />
                <ActionPanel entry={stickyEntry} units={replay.units} />
              </div>
            }
```

- [ ] **Step 4: Eseguire i test + suite**

Run: `npm run test -- tests/ui/battleScreenCenter.test.tsx` poi `npm run test`
Expected: il test center passa; la suite completa verde (eventuale skip pre-esistente noto ok — vedi nota).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add components/screens/BattleScreen.tsx tests/ui/battleScreenCenter.test.tsx
git commit -m "feat(combat-ux): monta CenterMeter sopra ActionPanel nello slot center"
```

---

## Self-Review (autore)

- **Spec coverage:** §4a dato reale → usato in Task1; §4b derivazioni → Task1 (livingCount/venom/focus/turns); §4c componente+wiring → Task2 (CenterMeter due modalità) + Task3 (stack center, ActionPanel invariato). §5 YAGNI: niente marchio, niente Mietitore-evento, niente UnitBust, niente motore. ✅
- **Type consistency:** `focusEnemy(frame,units,playerSide)→ReplayUnit|null`, `venomOf(frame,unit)→number`, `venomPerTurn(stacks,maxHp)→number`, `livingCount(frame,units,side)→number`, `turnsToDie(hp,perTurn)→number|null` — usati identici in Task2. `CenterMeter({frame,units,playerSide})` identico in Task3. ✅
- **Placeholder scan:** nessun TBD/TODO; ogni step di codice mostra il codice completo. ✅
- **Rischio noto documentato:** possibile canvas/Pixi mock nel test BattleScreen (Task3 Step 2), con fallback esplicito. ✅
- **Numeri verificati dal codice:** veleno tickDamage=4, tickPctMaxHp=0.005, cap=8 (statuses.ts:24); player side 'left' (BattleScreen); `center?: React.ReactNode` già su BattleArena:38; slot oggi = ActionPanel (BattleScreen:171). ✅
