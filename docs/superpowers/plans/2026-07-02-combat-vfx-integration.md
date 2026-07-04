# Piano — Integrazione VFX combattimento nel gioco reale

> Portare lo strato VFX (già costruito e validato in `/combat-lab`) dentro la vera
> `BattleArena`, armonizzato con l'HUD esistente. Esecuzione subagent-driven.

## Contesto

Lo strato VFX vive in `lib/vfx/` (`PixiStage`, `effects`, `choreograph`, `spellVfx`,
`screen`, `audio`, `gsapSetup`, `palette`). La reference d'uso completa è
`app/combat-lab/page.tsx` (monta lo stage, misura le posizioni, chiama `choreograph`).

Pipeline reale (già mappata):
- `components/screens/BattleScreen.tsx` → `useBattleReplay` espone `r.entry`, `r.index`, `r.hp`, `r.speed`, `r.playing`. Passa a `<BattleArena replay hp entry frameKey rightTitle enemyLevel center>`.
- `components/battle/BattleArena.tsx:45-68` misura caster/target (ancore `data-unit-key`) → `fx = {from,to}` in **% dell'arena** (`arenaRef`, div `data-testid="battle-arena"` a :94).
- `BattleArena.tsx:110` renderizza `<SpellFx>` (e `<ShieldFx>` per-bust a :88). Questi vanno **sostituiti** dal layer Pixi (i file restano: i test li testano in isolamento).
- `useBattleReplay` cadenza reveal = `stepMs/speed` (stepMs 1200).
- `UnitBust.tsx:155-158` fa un **jitter x** all'impatto → sostituire con **squash&stretch** (scale).
- `HpBar.tsx` → aggiungere **ghost-drain** (layer cremisi in ritardo). Mantieni `data-fill`.

## Global Constraints (vincolanti per tutti i task)

1. **NIENTE camera shake.** L'impatto = reazione del mondo (già garantito dal layer VFX).
2. **Test verdi.** `npm run typecheck` pulito E `npm run test -- tests/ui tests/screens` verdi. NON toccare `tests/engine`/`data`/`game` (processo concorrente su master).
3. **Commit solo file UI con pathspec esplicito** (`git commit -- <file>`), MAI `git add -A`. I fallimenti dei test engine non sono nostri.
4. **Pixi è client-only**: monta in `useEffect`, distruggi in cleanup. Componenti `'use client'`.
5. **Rispetta `prefers-reduced-motion`** (via `useReducedMotion`): niente VFX Pixi, solo stato istantaneo.
6. **Audio muto in-game** per ora (i toni sono placeholder): passa `audio: null` a `choreograph`.
7. **Armonizza con l'HUD esistente** (InitiativeBar/BattleLog/BattleRecap restano). NON ridisegnare la struttura.
8. Riusa `lib/vfx/*` — non reimplementare effetti.

## Task 1 — Montare il layer VFX Pixi nell'arena reale

**File:** nuovo `components/battle/PixiArena.tsx`; modifica `BattleArena.tsx`, `BattleScreen.tsx`.

- `PixiArena` (`'use client'`) props: `entry: LogEntry | null`, `frameKey: number`, `from?: FxPoint|null`, `to?: FxPoint|null`, `speed: number`.
  - `useEffect` monta `createPixiStage(mountRef)` una volta; cleanup `destroy()`. `useReducedMotion` → se ridotto, non montare (o no-op).
  - Un altro `useEffect` keyed su `frameKey`: se c'è `entry`, chiama `choreograph(stage, { entry, from, to, budgetMs: Math.max(700, 1200/speed), reduced, audio: null, onScreen })`. Ignora `frameKey` 0 iniziale.
  - Renderizza: un div `ref=mountRef` `absolute inset-0 pointer-events-none z-[5]` (il canvas ci si appende), + un div overlay per lo `onScreen` wash (`absolute inset-0 z-[4] mix-blend-screen opacity-0`, animato via WAAPI su callback).
  - `onScreen(color)`: flash radiale colorato dell'overlay (come nel lab).
- `BattleArena.tsx`: aggiungi `speed` alla firma props; monta `<PixiArena entry={entry} frameKey={frameKey} from={fx?.from} to={fx?.to} speed={speed} />` come **ultimo figlio** del div `arenaRef` (:94), accanto/al posto di `<SpellFx>`. **Rimuovi** il render di `<SpellFx>` (:110) e di `<ShieldFx>` (:88). Lascia i file SpellFx.tsx invariati.
- `BattleScreen.tsx`: passa `speed={r.speed}` a `<BattleArena>`.
- **Verifica:** `npm run typecheck`; `npm run test -- tests/ui/battle.test.tsx tests/ui/spellFx.test.tsx` verdi (testano i componenti in isolamento → devono restare verdi). Conferma che `data-unit-key`/`data-fill` esistono ancora.

## Task 2 — Callout leggibili + firma di stato

**File:** `BattleArena.tsx` (o un piccolo `components/battle/Callout.tsx`).

- Su ogni nuovo `frameKey` con `entry`, mostra un callout centrale grande in stile Sala Comune quando l'evento è notevole:
  - `crit`+`kill` → "ESECUZIONE" (cremisi); `crit` → "CRITICO" (oro); `block` → "PARATO" (celeste); `dodge` → "SCHIVA" (celeste); `heal` → "CURA" (verde); flag `dot` → "VELENO" (verde-lime).
  - Animazione: scale/blur-in poi fade (rispetta reduced-motion → statico breve). Posizionato sopra l'arena, `pointer-events-none`.
- NON duplicare i numeri fluttuanti (già in `UnitBust`).
- **Verifica:** typecheck + test UI verdi.

## Task 3 — HP ghost-drain + jitter→squash

**File:** `HpBar.tsx`, `UnitBust.tsx`.

- `HpBar.tsx`: due layer — `fill` (già, `data-fill`, scatta veloce) + nuovo `ghost` cremisi dietro che cala in ritardo (~220ms) rivelando il chunk perso. Mantieni numero HP e `data-fill`.
- `UnitBust.tsx:155-158`: sostituisci il jitter `x:[...]` con **squash&stretch** (`scale`), es. impatto → `scaleX 1.12/scaleY .88` che rientra elastico; crit più marcato. Mantieni il flash d'impatto e i testid.
- **Verifica:** typecheck + `npm run test -- tests/ui` verdi.

## Task 4 (polish, opzionale) — backdrop + boss

- Migliora `ArenaBackdrop` (atmosfera più profonda) e dai al boss finale (Voldemort, side destro dell'ultima area) un trattamento più ominoso (aura). Solo se Task 1-3 verdi e budget lo consente.

## Chiusura

Dopo Task 1-3: review whole-branch, poi `verification-before-completion` (typecheck + suite UI + dev server carica una battaglia), commit per-file, push su master.
