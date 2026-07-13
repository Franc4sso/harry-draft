# Leggibilità stati in battaglia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere leggibile ogni stato di un'unità in battaglia (congelo/stordimento/silenzio/disarmo/veleno + turno saltato) senza coprire il volto, solo con presentazione — nessun cambio al motore.

**Architecture:** Tre pezzi indipendenti su `components/battle/`: (1) il trattamento di stato sulla carta (ritratto ghiacciato + glyph + fascia, al posto del pannello a tutta carta); (2) il lampo "SALTA" sul turno saltato + fix dell'aura-acting fuorviante; (3) il tono verde per il tick veleno (flash + numero). I dati (entry `Stordito`, tick `dot`, `statusEffects` per-frame) esistono già nel replay; nulla in `game/engine/*` viene toccato.

**Tech Stack:** React (Next.js), TypeScript, Tailwind, framer-motion (già in uso), Vitest + Testing Library.

## Global Constraints

- **Solo presentazione**: NESSUN cambio a `game/engine/*`. Replay/anti-cheat intatti.
- **PERF (regola dura)**: l'unico loop CSS continuo su UnitBust è il reticolo target (`animate-pulse`), collo di bottiglia FPS noto. **NIENTE nuovi `animate-pulse`/`animate-*` infiniti.** Solo transizioni event-driven (mount/opacity one-shot, come `impact`/float). Ogni task che aggiunge CSS deve essere verificato con `grep -n "animate-" components/battle/UnitBust.tsx` → nessun nuovo loop.
- **Copy in italiano.**
- **Colori-stato esistenti** (riusare): stun=yellow-300, freeze=cyan-300, silence=violet-400, disarm=fuchsia-400, dot=green-400. Definiti in `UnitBust.tsx:40-51` (`STATUS_CLASS`) e `:54-59` (`CONTROL_OVERLAY`).
- `npm run test` NON esegue typecheck → `npm run typecheck` a parte.
- `React.memo(UnitBust)` è attivo: NON destabilizzare le prop (es. non passare oggetti nuovi ad ogni render a tutti i bust — seguire il pattern `EMPTY_EFFECTS`/`floatKey` stabile esistente).

---

### Task 1: Trattamento di stato sulla carta (sostituisce il pannello a tutta carta)

Sostituisci `CONTROL_OVERLAY` (pannello `aspect-[3/4]` che copre il volto) con: ritratto trattato (freeze ghiaccia) + glyph tondo in alto + fascia sottile in basso. Il volto resta visibile.

**Files:**
- Modify: `components/battle/UnitBust.tsx` (rimuovi il render CONTROL_OVERLAY `:265-280`; aggiungi trattamento ritratto + glyph + fascia)
- Test: `tests/ui/unitBustStates.test.tsx` (nuovo)

**Interfaces:**
- Consumes: `effects: ActiveEffect[]` (prop già esistente su UnitBust); `CONTROL_OVERLAY` map (label per kind, già in file).
- Produces: per un effect di controllo, il bust rende `[data-control-glyph="{kind}"]` + `[data-control-strip]` col label; il ritratto ha `[data-frost]` quando `freeze`. NESSUN elemento che copre l'intero `aspect-[3/4]` per gli stati di controllo.

- [ ] **Step 1: Write the failing test**

Crea `tests/ui/unitBustStates.test.tsx`. Guarda un test UnitBust esistente (`grep -rln "UnitBust" tests/`) per il pattern di costruzione della prop `unit`/`effects` (riusa quel factory, NON inventarne uno). Struttura:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { UnitBust } from '@/components/battle/UnitBust'
// riusa il factory unit/effect del test UnitBust esistente

function bustWith(effectKind: string) {
  // costruisci un `unit` minimo + effects=[{ kind: effectKind, statusId: effectKind, remaining: 2 }]
  // (adatta alla vera forma di ActiveEffect vista nei test esistenti)
}

describe('UnitBust — stati di controllo leggibili', () => {
  it('congelato: ghiaccia il ritratto, mostra glyph + fascia, NON copre il volto', () => {
    const { container } = render(bustWith('freeze'))
    expect(container.querySelector('[data-control-glyph="freeze"]')).not.toBeNull()
    expect(container.querySelector('[data-control-strip]')).toHaveTextContent(/congelato/i)
    expect(container.querySelector('[data-frost]')).not.toBeNull()
    // il vecchio pannello a tutta carta NON esiste più
    expect(container.querySelector('[data-control]')).toBeNull()
    // il ritratto (img) è presente e non coperto da un overlay grid a tutta carta
    expect(container.querySelector('img')).not.toBeNull()
  })
  it('stordito: glyph giallo + fascia, senza pannello', () => {
    const { container } = render(bustWith('stun'))
    expect(container.querySelector('[data-control-glyph="stun"]')).not.toBeNull()
    expect(container.querySelector('[data-control-strip]')).toHaveTextContent(/stordito/i)
    expect(container.querySelector('[data-control]')).toBeNull()
  })
  it('silenziato/disarmato: glyph + fascia, NESSUN frost (non ghiacciano)', () => {
    const { container } = render(bustWith('silence'))
    expect(container.querySelector('[data-control-glyph="silence"]')).not.toBeNull()
    expect(container.querySelector('[data-frost]')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/unitBustStates.test.tsx`
Expected: FAIL — `data-control-glyph`/`data-control-strip`/`data-frost` non esistono; `[data-control]` (il vecchio pannello) esiste ancora.

- [ ] **Step 3: Rimuovi il pannello CONTROL_OVERLAY e aggiungi il nuovo trattamento**

In `components/battle/UnitBust.tsx`:

3a. RIMUOVI l'IIFE del pannello di controllo (`:265-280`, il blocco che rende `<div data-control={ctrl.kind} className="... aspect-[3/4]">`).

3b. Nel ritratto (`:234`, il `<div className="relative aspect-[3/4] ...">`), aggiungi il trattamento freeze. Deriva il control corrente:
```tsx
const control = effects.find(e => CONTROL_OVERLAY[e.kind])
const frost = control?.kind === 'freeze'
```
Applica al wrapper del ritratto `data-frost` (quando frost) e, quando frost, un overlay statico di brina (NON animato) + un filtro tinta ciano sull'img:
```tsx
{frost && (
  <div aria-hidden data-frost className="pointer-events-none absolute inset-0 rounded-xl"
    style={{ background: 'linear-gradient(120deg,rgba(165,243,252,.16),transparent 38%),linear-gradient(-120deg,rgba(165,243,252,.12),transparent 40%),radial-gradient(80% 60% at 50% 100%,rgba(103,232,249,.14),transparent)' }} />
)}
```
(Sul `<PortraitImage>` o sul suo wrapper, applica `style={{ filter: frost ? 'brightness(.82) saturate(.7) hue-rotate(-6deg)' : undefined }}` — verifica dove PortraitImage accetta style; se no, avvolgilo.)

3c. Aggiungi il **glyph tondo** in alto-centro (fuori dal clip del ritratto, come il role-badge sta a `:322`) quando c'è un control:
```tsx
{control && (() => {
  const Icon = STATUS_ICON[control.kind] ?? Flame
  const cls = STATUS_CLASS[control.kind] ?? 'text-white'
  return (
    <span data-control-glyph={control.kind}
      className={cn('pointer-events-none absolute left-1/2 top-[-8px] z-10 grid h-[22px] w-[22px] -translate-x-1/2 place-items-center rounded-full border-[1.5px] bg-black/80', cls)}>
      <Icon size={11} aria-hidden />
    </span>
  )})()}
```

3d. Aggiungi la **fascia** in fondo al ritratto (dentro il wrapper del ritratto, `bottom-0`, non copre il volto):
```tsx
{control && (
  <div data-control-strip
    className={cn('pointer-events-none absolute inset-x-0 bottom-0 z-10 py-0.5 text-center text-[8.5px] font-extrabold uppercase tracking-wider', STATUS_CLASS[control.kind])}
    style={{ background: 'linear-gradient(180deg,transparent,rgba(0,0,0,.82))' }}>
    {CONTROL_OVERLAY[control.kind]!.label} ·{control.remaining}t
  </div>
)}
```

Nota: `STATUS_ICON`/`STATUS_CLASS`/`CONTROL_OVERLAY`/`Flame`/`cn` sono già importati/definiti nel file. La pill in alto per gli stati di CONTROLLO va evitata (ora il glyph la sostituisce): nel filtro delle pill (`:341-343`) escludi anche i kind di controllo che ora hanno il glyph, OPPURE lascia le pill solo per non-controllo (dot/shield/regen/ward). Scegli l'opzione che non duplica il segnale — verifica a schermo nel Task 4.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/unitBustStates.test.tsx`
Expected: PASS.

- [ ] **Step 5: PERF + typecheck + non-regressione**

Run: `grep -n "animate-" components/battle/UnitBust.tsx`
Expected: solo il reticolo (`motion-safe:animate-pulse` sul target-reticle) — NESSUN nuovo `animate-*`.

Run: `npm run typecheck`
Expected: pulito.

Run: `npx vitest run tests/ui/` (i test battle UI esistenti)
Expected: verdi (se un test asseriva il vecchio `[data-control]` a tutta carta, aggiornalo al nuovo `[data-control-glyph]`/`[data-control-strip]` — cerca con `grep -rln "data-control" tests/`).

- [ ] **Step 6: Commit**

```bash
git add components/battle/UnitBust.tsx tests/ui/unitBustStates.test.tsx tests/
git commit -m "feat(battle): stato di controllo sulla carta senza coprire il volto (glyph+fascia+frost)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Il lampo "SALTA" sul turno saltato + fix aura-acting

Sul frame in cui un'unità salta (entry `Stordito`), mostra un lampo "SALTA" e NON accendere l'aura "sta agendo" (bug: oggi lo stordito sembra agire).

**Files:**
- Modify: `components/battle/BattleArena.tsx` (sopprimi `actingKey` sul frame Stordito; passa `skipping` al bust)
- Modify: `components/battle/UnitBust.tsx` (rendi il lampo "SALTA" quando `skipping`)
- Test: `tests/ui/skipTurn.test.tsx` (nuovo) — su BattleArena/UnitBust

**Interfaces:**
- Consumes: il frame corrente in BattleArena (`entry`), `statusEffects` per-frame, `actingKey`/`targetKey` (già derivati).
- Produces: UnitBust accetta una prop nuova `skipping?: 'stun' | 'freeze' | null`; quando valorizzata rende `[data-skipping="{kind}"]` col testo "SALTA". Su un frame Stordito, `acting` è false per il bust che salta.

- [ ] **Step 1: Write the failing test**

Crea `tests/ui/skipTurn.test.tsx`. Guarda `tests/ui/duoBattle.test.tsx` o un test BattleArena esistente (`grep -rln "BattleArena\|buildReplay" tests/`) per come costruire un `replay` con un frame che ha una specifica `entry`. Costruisci un replay in cui un frame ha `entry = { action:'Stordito', type:'system', actorId:'x', actorSide:'left', flags:['stun'] }` e l'unità `left:x` ha un `statusEffect` `stun` in quel frame.

```tsx
it('un frame Stordito mostra SALTA sull\'unità e NON la fa sembrare in azione', () => {
  // render BattleArena a quel frameKey (o UnitBust con skipping='stun' se il test è unit-level)
  // assert: il bust di left:x ha [data-skipping] con testo /salta/i
  // assert: il bust di left:x NON ha l'aura acting (data-acting false / assenza del marker acting)
})
it('un frame di attacco NORMALE non mostra SALTA', () => {
  // frame con entry di attacco → nessun [data-skipping]
})
```

Nota per l'implementer: se testare BattleArena end-to-end è pesante, spezza — (a) unit test su UnitBust: `skipping='freeze'` → `[data-skipping="freeze"]` con "SALTA"; (b) un test più mirato sulla derivazione in BattleArena (che il frame Stordito produce `acting=false` per quel bust). Scegli il taglio che copre entrambi i comportamenti senza fixture fragili.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/skipTurn.test.tsx`
Expected: FAIL — `skipping`/`data-skipping` non esiste; l'aura acting è ancora attiva sul frame Stordito.

- [ ] **Step 3: Sopprimi actingKey sul frame Stordito (BattleArena)**

In `components/battle/BattleArena.tsx`, dove si deriva `actingKey` (`:51`):
```tsx
// Oggi: const actingKey = entry?.actorSide && !duoSystemFrame ? unitKey(...) : null
// Un frame Stordito (type system, action 'Stordito') è un SALTO, non un'azione: l'aura "sta
// agendo" non deve accendersi (era fuorviante — l'unità sembrava agire mentre salta).
const skipFrame = entry?.type === 'system' && entry.action === 'Stordito'
const actingKey = entry?.actorSide && !duoSystemFrame && !skipFrame ? unitKey(entry.actorSide, entry.actorId) : null
```

Deriva `skipping` per il bust che salta:
```tsx
const skipKey = skipFrame && entry?.actorSide ? unitKey(entry.actorSide, entry.actorId) : null
// il kind (stun vs freeze) dal suo statusEffect di controllo nel frame corrente:
const skipKind = skipKey
  ? (statusEffects[skipKey]?.find(e => e.kind === 'freeze' || e.kind === 'stun')?.kind ?? 'stun')
  : null
```
E passa al bust: `skipping={u.key === skipKey ? skipKind : null}`.

- [ ] **Step 4: Rendi il lampo "SALTA" in UnitBust**

In `components/battle/UnitBust.tsx`, aggiungi la prop `skipping?: 'stun' | 'freeze' | null` alla firma. Rendi (event-driven, framer-motion one-shot, NO loop):
```tsx
{skipping && (
  <motion.div
    key={`skip-${floatKey ?? 'x'}`}
    data-skipping={skipping}
    aria-hidden
    className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
    initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 1.4 }}
    animate={{ opacity: [0, 1, 1, 0], scale: 1 }}
    transition={{ duration: 0.5, times: [0, .2, .7, 1] }}
  >
    <span className={cn('font-[Cinzel] text-[13px] font-extrabold uppercase tracking-wide -rotate-3 rounded px-2 py-1 text-black',
      skipping === 'freeze' ? 'bg-cyan-300' : 'bg-yellow-300')}>SALTA</span>
  </motion.div>
)}
```
(`reduce` = reduced-motion flag già presente nel file; `cn` già importato. Se il font Cinzel non è disponibile via classe, usa lo stile inline coerente col resto del progetto — verifica come i display font sono applicati altrove.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/ui/skipTurn.test.tsx`
Expected: PASS.

- [ ] **Step 6: PERF + typecheck + non-regressione**

Run: `grep -n "animate-" components/battle/UnitBust.tsx` → nessun nuovo loop CSS (il lampo usa framer-motion `animate`, non `animate-*` Tailwind).
Run: `npm run typecheck` → pulito.
Run: `npx vitest run tests/ui/` → verdi.

- [ ] **Step 7: Commit**

```bash
git add components/battle/BattleArena.tsx components/battle/UnitBust.tsx tests/ui/skipTurn.test.tsx
git commit -m "feat(battle): lampo SALTA sul turno perso + stordito non sembra più agire

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Tono verde per il tick veleno (flash + numero)

Il tick veleno oggi usa il flash rosa d'attacco. Distinguilo: flash verde (veleno) / ambra (bruciatura) + numero flottante verde.

**Files:**
- Modify: `components/battle/damageFloat.ts` (aggiungi tono `dot`)
- Modify: `components/battle/UnitBust.tsx` (flash verde quando il float è un tick `dot`; numero col tono dot)
- Test: `tests/ui/poisonTick.test.tsx` (nuovo) + estendi `damageFloat` test se esiste

**Interfaces:**
- Consumes: `floatFor(entry)` (già mappa l'entry al float); il float è passato al bust bersaglio.
- Produces: `FloatTone` include `'dot'`; `floatFor` ritorna `tone:'dot'` per un'entry `flags:['dot']`; UnitBust rende il flash verde/ambra e il numero col colore-veleno quando il tono è `dot`.

- [ ] **Step 1: Write the failing test**

Estendi/crea il test di `damageFloat`:
```ts
import { floatFor } from '@/components/battle/damageFloat'
it('un tick veleno ha tono dot (non damage)', () => {
  const f = floatFor({ turn: 1, action: 'Veleno', type: 'Controllo', value: 9, flags: ['dot'], actorId: 'a', targetId: 'b' } as any)
  expect(f).toEqual({ text: '-9', tone: 'dot' })
})
it('un colpo normale resta tono damage', () => {
  const f = floatFor({ turn: 1, action: 'Colpo', type: 'Attacco', value: 12, flags: [] } as any)
  expect(f?.tone).toBe('damage')
})
```
E un test UnitBust: dato `float={{ text:'-9', tone:'dot' }}` + `targeted`, il flash ha `[data-impact="dot"]` (verde), non `hit`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/poisonTick.test.tsx`
Expected: FAIL — `tone:'dot'` non esiste (oggi il tick dà `tone:'damage'`).

- [ ] **Step 3: Aggiungi il tono dot a floatFor**

In `components/battle/damageFloat.ts`:
```ts
export type FloatTone = 'damage' | 'crit' | 'heal' | 'dodge' | 'dot'
```
In `floatFor`, PRIMA del ramo damage generico, gestisci il dot (il tick veleno/bruciatura ha `type:'Controllo'`, quindi NON è escluso dal guard `type==='system'`):
```ts
  if (entry.flags.includes('dot') && typeof entry.value === 'number' && entry.value > 0) {
    return { text: `-${entry.value}`, tone: 'dot' }
  }
```
(Mettilo dopo il guard system e dopo dodge/heal, prima del ramo `value>0` generico.)

- [ ] **Step 4: Flash verde + numero verde in UnitBust**

In `UnitBust.tsx`:
- Nel blocco `impact` (`:282-292`), il colore del flash dipende dal tono del float. Deriva:
  ```tsx
  const impactTone = float?.tone // 'dot' | 'crit' | 'damage' | ...
  ```
  e nel className del flash:
  ```tsx
  data-impact={impactTone === 'dot' ? 'dot' : isCrit ? 'crit' : 'hit'}
  className={cn('... aspect-[3/4]',
    impactTone === 'dot' ? 'bg-green-400/30' : isCrit ? 'bg-amber-300/40' : 'bg-rose-400/30')}
  ```
  (Per la bruciatura si potrebbe distinguere l'ambra, ma il motore logga entrambi con `flags:['dot']`; distinguere veleno vs bruciatura richiede leggere `entry.action` — se il float non porta l'action, tenere un solo verde per tutti i dot in questa slice, e annotare la bruciatura-ambra come possibile fast-follow. NON inventare un canale nuovo qui.)
- Il numero flottante (`:360-377`, il render del `float`): quando `tone==='dot'`, coloralo verde. Cerca dove il tono mappa al colore del testo (probabile una map tone→classe) e aggiungi `dot: 'text-green-300'` (o simile, coerente con gli altri toni).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/ui/poisonTick.test.tsx`
Expected: PASS.

- [ ] **Step 6: PERF + typecheck + non-regressione**

Run: `grep -n "animate-" components/battle/UnitBust.tsx` → nessun nuovo loop.
Run: `npm run typecheck` → pulito.
Run: `npx vitest run tests/ui/` → verdi (se un test asseriva il tono/colore del tick veleno come 'damage'/rosa, aggiornalo a 'dot'/verde).

- [ ] **Step 7: Commit**

```bash
git add components/battle/damageFloat.ts components/battle/UnitBust.tsx tests/ui/poisonTick.test.tsx
git commit -m "feat(battle): il tick veleno è verde (flash + numero), non rosa da attacco

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Verifica a schermo + suite piena

Guida il gioco fino a una battaglia con controlli e veleno, cattura screenshot, verifica che gli stati siano leggibili e non si duplichino (glyph vs pill). Poi suite piena.

**Files:**
- Nessuna modifica di produzione attesa (solo eventuali ritocchi se lo screenshot rivela duplicazioni/regressioni visive).

- [ ] **Step 1: Suite piena + typecheck**

Run: `npm run typecheck && npm run test`
Expected: tutto verde. Se un test di battaglia esistente asseriva il vecchio pannello `[data-control]` o il tono veleno rosa, dev'essere già stato aggiornato nei Task 1/3 — verifica che non ne resti nessuno rosso.

- [ ] **Step 2: Screenshot degli stati**

Con il dev server attivo (`npm run dev`), guida Playwright fino a una battaglia (draft ×3 → primo nodo battaglia → avvia). Cattura l'arena durante un frame con un'unità controllata e uno con un tick veleno. (Riusa il pattern dello screenshot harness: apri `/play`, svuota localStorage, draft-pick ×3, raggiungi la battaglia, avanza il replay.) Salva in scratchpad e ispeziona:
- Congelato: il volto è ghiacciato, glyph ❄ + fascia "CONGELATO", volto VISIBILE.
- Stordito su un frame di salto: appare "SALTA", l'aura verde NON è accesa su di lui.
- Tick veleno: flash/numero verde, non rosa.
- **Nessuna duplicazione**: il glyph di controllo e la pill in alto non mostrano lo stesso stato due volte.

- [ ] **Step 3: Fix eventuali problemi visivi**

Se lo screenshot rivela duplicazione (glyph + pill dello stesso control) o un overlay che copre il volto o un colore sbagliato, correggi in UnitBust.tsx e ripeti lo screenshot. Commit del fix se necessario.

- [ ] **Step 4: Commit finale (se ci sono stati ritocchi)**

```bash
git add -A
git commit -m "polish(battle): rifiniture leggibilità stati dopo verifica a schermo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (spec: `docs/superpowers/specs/2026-07-13-battle-states-readability-design.md`):
- Parte 1 (trattamento carta: freeze ghiaccia, glyph, fascia, no pannello) → Task 1. ✅
- Parte 2 (lampo SALTA + fix aura-acting) → Task 2. ✅
- Parte 3 (tick veleno verde) → Task 3. ✅
- Verifica a schermo + no-duplicazione → Task 4. ✅
- Vincolo PERF (no nuovi loop) → grep in ogni task (1 Step5, 2 Step6, 3 Step6). ✅
- Solo presentazione (no engine) → nessun task tocca game/engine. ✅

**Placeholder scan:** i punti "adatta al factory esistente" (Task 1/2 Step1) e "verifica dove il tono mappa al colore" (Task 3 Step4) riguardano l'allineamento a codice reale che l'implementer deve leggere — il codice di produzione da scrivere è mostrato per intero. La distinzione bruciatura-ambra è esplicitamente marcata come fuori-scope-di-questa-slice (un solo verde per i dot), non un TODO vago.

**Type consistency:** `skipping?: 'stun'|'freeze'|null` (Task 2) coerente tra BattleArena (passa) e UnitBust (riceve). `FloatTone` esteso con `'dot'` (Task 3) coerente tra damageFloat e UnitBust. `data-control-glyph`/`data-control-strip`/`data-frost`/`data-skipping`/`data-impact="dot"` sono le ancore di test, coerenti tra task e test.

**Ordine:** Task 1 (stato persistente) → Task 2 (momento del salto, usa gli stessi kind) → Task 3 (veleno, canale float indipendente) → Task 4 (verifica). Ogni task è verde a sé (nessuna cascata di tipi tra task, a differenza di slice precedenti).
