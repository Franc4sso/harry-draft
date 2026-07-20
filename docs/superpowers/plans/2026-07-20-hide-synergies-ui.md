# Nascondere le sinergie dalla UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rimuovere ogni superficie UI delle sinergie (draft, reclutamento, sidebar run, battaglia, compendio) lasciando le Combo Duo come unico sistema visibile, senza toccare il motore.

**Architecture:** Puro taglio di UI. Il motore continua a calcolare e applicare le sinergie (bonus, trigger, regen, replay). Si rimuovono i componenti che le disegnano e si elimina la prop `synergies` dai componenti UI (ma NON da `BattleScreen`/`simulate`, dove alimenta il replay). File di componenti sinergie rimasti orfani vengono cancellati.

**Tech Stack:** Next.js (React, TypeScript), Vitest + Testing Library, Tailwind.

## Global Constraints

- **Motore intatto:** NON modificare `data/synergies.ts`, `game/engine/synergy.ts`, `synergyTriggers.ts`, `houseEffects.ts`, `simulate.ts`, né alcun test balance/motore (`campaignBalanceB`, `campaignBalanceRestricted`, sweep). Devono restare verdi invariati.
- **Prova di non-regressione motore:** `campaignBalanceRestricted` winRate deve restare **0.0583**.
- **Verifica finale:** `npx tsc --noEmit` exit 0 + suite intera verde (`npm run test -- --run --disable-console-intercept`).
- Ogni task committa da solo. Messaggi commit in italiano, Conventional Commits, con footer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Draft — via contatore sinergie e SynergyTracker

Rimuove dal draft il badge "⚡ N sinergie attive", il `<SynergyTracker>`, e il plumbing `hotSynergyIds` (prop morta mai renderizzata dalla card). Resta il `<DuoTracker>`.

**Files:**
- Modify: `components/screens/DraftScreen.tsx`
- Modify: `components/draft/DraftCandidateCard.tsx`
- Modify: `components/cards/WizardCardColumn.tsx`
- Delete: `components/draft/SynergyTracker.tsx` (orfano dopo il taglio)
- Delete: `tests/ui/synergyTracker.test.tsx`
- Test: `tests/screens/` (DraftScreen non ha test dedicato al badge; verificare la suite draft resta verde)

**Interfaces:**
- Consumes: `DuoTracker` (invariato), `synergyProgress`/`previewSynergies` da `@/game/engine/synergy` (restano per altri task? No — solo il draft li usa qui; l'import va rimosso da DraftScreen).
- Produces: niente per i task successivi.

- [ ] **Step 1: Verificare l'orfano prima di cancellare**

Run: `grep -rln "SynergyTracker" components/ tests/ app/ | grep -v "components/draft/SynergyTracker.tsx\|tests/ui/synergyTracker.test.tsx"`
Expected: solo `components/screens/DraftScreen.tsx` (più eventuali commenti in DuoTracker/DuoPanel che NON sono import — ignorarli). Se compare altro import reale, fermarsi e rivalutare.

- [ ] **Step 2: DraftScreen — rimuovere calcolo e import sinergie**

In `components/screens/DraftScreen.tsx`:

Rimuovere gli import:
```tsx
import { SynergyTracker } from '@/components/draft/SynergyTracker'
```
e da `import { synergyProgress, previewSynergies } from '@/game/engine/synergy'` — rimuovere l'intera riga (nessun altro uso resta dopo questo task).

Rimuovere il blocco di calcolo (righe ~35-48):
```tsx
  // tracker rows: preview when a candidate is considered, else current state
  const current_rows = synergyProgress(picks)
  const activeSynergies = current_rows.filter((s) => s.active).length
  const rows = considered ? previewSynergies(picks, considered) : current_rows
  // Memoize the per-candidate "hot synergy" sets ...
  const hotByCandidate = useMemo(() => {
    const m = new Map<string, ReadonlySet<string>>()
    for (const c of current) {
      m.set(c.wizard.id, new Set(previewSynergies(picks, c).filter((p) => p.advances).map((p) => p.synergy.id)))
    }
    return m
  }, [current, picks])
```
Se `useMemo` non è più usato altrove nel file, rimuoverlo dall'import di `react`.

- [ ] **Step 3: DraftScreen — rimuovere il badge dal header**

Rimuovere il blocco `<span>` del badge (righe ~60-69), lasciando la riga "Pesca":
```tsx
        <div className="mb-2 mt-1 flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest">
          <span className="text-[#b08d57]">Pesca {picks.length}/{target}</span>
        </div>
```

- [ ] **Step 4: DraftScreen — rimuovere SynergyTracker e hotSynergyIds**

Nel rail (righe ~104-107) togliere `<SynergyTracker>` e togliere `mt-4` dal DuoTracker (ora è il primo):
```tsx
            <div className="relative">
              <DuoTracker picks={picks} considered={considered} />
            </div>
```

Nella map delle card, togliere `hotSynergyIds={hotByCandidate.get(c.wizard.id)}` dalla `<DraftCandidateCard>`.

- [ ] **Step 5: DraftCandidateCard e WizardCardColumn — togliere prop morta `hotSynergyIds`**

In `components/draft/DraftCandidateCard.tsx`: rimuovere `hotSynergyIds` dalla destrutturazione, dal tipo props (`hotSynergyIds?: ReadonlySet<string>`), e da `<WizardCardColumn ... hotSynergyIds={hotSynergyIds} ...>`.

In `components/cards/WizardCardColumn.tsx`: rimuovere `hotSynergyIds` dalla destrutturazione e dal tipo props (`hotSynergyIds?: ReadonlySet<string>`). È già inutilizzato nel body → nessun altro cambiamento.

- [ ] **Step 6: Cancellare i file orfani**

```bash
git rm components/draft/SynergyTracker.tsx tests/ui/synergyTracker.test.tsx
```

- [ ] **Step 7: Typecheck + test draft**

Run: `npx tsc --noEmit && npm run test -- --run --disable-console-intercept tests/screens tests/ui`
Expected: exit 0, nessun test rosso. (Se un test asseriva il badge o SynergyTracker, aggiornarlo/rimuoverlo in questo task.)

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "$(cat <<'EOF'
feat(draft): via badge sinergie e SynergyTracker — resta solo DuoTracker

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Reclutamento — via ActivationRail

Rimuove il rail "Sinergie attivate" (`ActivationRail`) e il calcolo `activating`/`previewSynergies`. Il `<DuoTracker>` diventa l'unico contenuto del rail destro.

**Files:**
- Modify: `components/screens/RecruitScreen.tsx`
- Test: `tests/screens/` (verificare i test recruit restano verdi)

**Interfaces:**
- Consumes: `DuoTracker`, `baseTeam` (resta — lo usa DuoTracker), `focus` (resta).
- Produces: niente.

- [ ] **Step 1: Rimuovere ActivationRail e import sinergie**

In `components/screens/RecruitScreen.tsx`:

Rimuovere gli import ora orfani:
```tsx
import { previewSynergies, type SynergyPreview } from '@/game/engine/synergy'
import { synergyBonusText } from '@/lib/glossary'
```
Rimuovere l'intero componente `ActivationRail` (righe ~19-... fino alla sua chiusura — la funzione che apre a riga 22 `function ActivationRail(...)` e il commento sopra a riga 19).

- [ ] **Step 2: Rimuovere il calcolo `activating`**

Rimuovere la riga:
```tsx
  const activating = focus ? previewSynergies(baseTeam, focus).filter(p => p.willActivate) : []
```
Lasciare invariati `baseTeam`, `focus`, `replacedName` (usati altrove/da DuoTracker). Verificare che `replacedName` sia ancora usato; se dopo il taglio è orfano, rimuoverlo pure.

- [ ] **Step 3: Il rail destro contiene solo DuoTracker**

Nel blocco `<aside>` (righe ~220-230) rimuovere `<ActivationRail candidate={focus} activating={activating} />`, lasciando:
```tsx
        <aside>
          <div className="sticky top-28 flex max-h-[calc(100dvh-8rem)] flex-col gap-4 overflow-y-auto [scrollbar-gutter:stable]">
            <Frame variant="panel" innerClassName="relative p-3">
              <Parchment className="absolute inset-0" />
              <div className="relative">
                <DuoTracker picks={baseTeam} considered={focus} relics={relics} />
              </div>
            </Frame>
          </div>
        </aside>
```

- [ ] **Step 4: Typecheck + test recruit**

Run: `npx tsc --noEmit && npm run test -- --run --disable-console-intercept tests/screens`
Expected: exit 0, verde. Aggiornare eventuali test che asserivano `ActivationRail`/"Sinergie attivate".

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "$(cat <<'EOF'
feat(recluta): via ActivationRail sinergie — rail solo Combo Duo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Sidebar run — collasso dei tab, resta solo DuoPanel

Il cuore dell'alternanza. `TeamSynergyBar` vertical perde la struttura a tab (Sinergie/Combo): il `<DuoPanel frameless>` diventa l'unico contenuto sotto il roster. La orientation horizontal perde i chip sinergie. La prop `synergies` esce dalla firma; `RunBRunner` smette di passarla al bar.

**Files:**
- Modify: `components/run/TeamSynergyBar.tsx`
- Modify: `components/screens/RunBRunner.tsx`
- Test: `tests/screens/TeamSynergyBar.test.tsx`, `tests/screens/RunBRunner.test.tsx`

**Interfaces:**
- Consumes: `DuoPanel`, `detectDuos`, `livingOf` (restano).
- Produces: `TeamSynergyBar` con firma **senza** `synergies`:
  ```tsx
  export function TeamSynergyBar({ team, relics = [], orientation = 'horizontal' }: {
    team: DraftedWizard[]
    relics?: ActiveRelic[]
    orientation?: 'horizontal' | 'vertical'
  })
  ```

- [ ] **Step 1: Aggiornare i test del bar (rosso prima)**

In `tests/screens/TeamSynergyBar.test.tsx`: rimuovere i test che asseriscono `sidebar-tab-sinergie`, `sidebar-tab-combo`, il default sul tab combo, e i `SynergyRow`/`SynergyChip`. Aggiungere/mantenere un test che verifica:
- vertical: `team-synergy-bar` presente, DuoPanel renderizzato (es. `getByTestId('team-synergy-bar')` + un marcatore del DuoPanel), NESSUN `role="tab"`.
- horizontal: roster presente, nessun chip sinergia (`queryByText(/×\d/)` legato a sinergie assente — usare un asserto sul non-render dei chip).

Adeguare le chiamate `render(<TeamSynergyBar ... />)` togliendo la prop `synergies`.

Run: `npm run test -- --run --disable-console-intercept tests/screens/TeamSynergyBar.test.tsx`
Expected: FAIL (la firma ancora richiede/renderizza sinergie).

- [ ] **Step 2: Rimuovere codice sinergie da TeamSynergyBar**

In `components/run/TeamSynergyBar.tsx`:
- Rimuovere `SynergyRow`, `SynergyChip`, `synergyVisual`, `ROLE_COLOR`/`GOLD` se orfani dopo (verificare: `ROLE_COLOR` è usato anche in `MemberRow` → **resta**; `GOLD` solo in `synergyVisual` → via).
- Rimuovere il tipo `SidebarTab` e lo stato `tab`, `tabBtn`, il `role="tablist"`.
- Rimuovere gli import ora orfani: `ActiveSynergy`, `Synergy`, `House` (se solo synergyVisual li usava), `synergyBonusText` (resta? lo usa SynergyRow/Chip → via se nessun altro), `useState` (se non più usato).

`VerticalBar` diventa:
```tsx
function VerticalBar({ team, relics }: {
  team: DraftedWizard[]
  relics: ActiveRelic[]
}) {
  return (
    <div
      data-testid="team-synergy-bar"
      className="flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
    >
      <div className="flex flex-col gap-2">
        {team.map((m) => <MemberRow key={m.wizard.id} m={m} />)}
      </div>
      <div className="border-t border-white/10 pt-2.5">
        <DuoPanel team={team} relics={relics} frameless />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Aggiornare la firma pubblica e la orientation horizontal**

`TeamSynergyBar` senza `synergies`:
```tsx
export function TeamSynergyBar({
  team, relics = [], orientation = 'horizontal',
}: {
  team: DraftedWizard[]
  relics?: ActiveRelic[]
  orientation?: 'horizontal' | 'vertical'
}) {
  if (orientation === 'vertical') {
    return <VerticalBar team={team} relics={relics} />
  }

  return (
    <div
      data-testid="team-synergy-bar"
      className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        {team.map((m) => {
          const theme = houseTheme(m.wizard.house)
          return (
            <div
              key={m.wizard.id}
              data-house={m.wizard.house}
              className="flex items-center gap-2 rounded-xl border bg-black/30 py-1 pl-1 pr-2"
              style={{ borderColor: `${theme.color}55` }}
            >
              <span className="h-7 w-7 shrink-0 overflow-hidden rounded-lg">
                <PortraitImage id={m.wizard.id} house={m.wizard.house} alt={m.wizard.name} variant="bust" />
              </span>
              <span className="truncate text-xs font-semibold text-white/90">{displayName(m)}</span>
              <Chip label={`Lv. ${m.level ?? 1}`} color="#F0D98A" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
```
Aggiornare la doc-comment del componente per togliere il riferimento alle sinergie.

- [ ] **Step 4: RunBRunner — smettere di passare `synergies` al bar**

In `components/screens/RunBRunner.tsx`, nel `<TeamSynergyBar>` (riga ~113) rimuovere `synergies={c.run.activeSynergies}`. NON toccare `c.run.activeSynergies` altrove (BattleScreen/replay lo usano ancora).

- [ ] **Step 5: Typecheck + test**

Run: `npx tsc --noEmit && npm run test -- --run --disable-console-intercept tests/screens/TeamSynergyBar.test.tsx tests/screens/RunBRunner.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "$(cat <<'EOF'
feat(run): sidebar senza tab — resta solo il pannello Combo Duo

TeamSynergyBar perde la prop synergies e la struttura a tab. Il DuoPanel
è l'unico contenuto sotto il roster. Le sinergie restano attive nel motore.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Battaglia — via SynergyRibbon

Rimuove i due ribbon ("Le tue sinergie" / "Sinergie nemiche") da `BattleScreen`. Le prop `playerSyn`/`enemySyn` **restano** (alimentano il replay via `simulate`). Il file `SynergyRibbon.tsx` diventa orfano → cancellato.

**Files:**
- Modify: `components/screens/BattleScreen.tsx`
- Delete: `components/battle/SynergyRibbon.tsx`
- Delete: `tests/ui/synergyRibbon.test.tsx`

**Interfaces:**
- Consumes: props `playerSyn`/`enemySyn` (restano nella firma di BattleScreen — servono al replay builder `leftSyn`/`rightSyn`).
- Produces: niente.

- [ ] **Step 1: Verificare l'orfano**

Run: `grep -rln "SynergyRibbon" components/ tests/ app/ | grep -v "components/battle/SynergyRibbon.tsx\|tests/ui/synergyRibbon.test.tsx"`
Expected: solo `components/screens/BattleScreen.tsx`.

- [ ] **Step 2: Rimuovere i ribbon da BattleScreen**

In `components/screens/BattleScreen.tsx`:
- Rimuovere l'import `import { SynergyRibbon } from '@/components/battle/SynergyRibbon'`.
- Rimuovere le due righe `<SynergyRibbon ... />` (righe ~169 e ~175).
- **NON** toccare le prop `playerSyn`/`enemySyn` nella firma né il loro uso in `leftSyn`/`rightSyn` (riga ~47). NON toccare `import type { ActiveSynergy }` (ancora usato dalle prop).

- [ ] **Step 3: Cancellare i file orfani**

```bash
git rm components/battle/SynergyRibbon.tsx tests/ui/synergyRibbon.test.tsx
```

- [ ] **Step 4: Typecheck + test**

Run: `npx tsc --noEmit && npm run test -- --run --disable-console-intercept tests/screens tests/ui`
Expected: exit 0, verde.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "$(cat <<'EOF'
feat(battaglia): via i ribbon sinergie — le prop restano per il replay

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Compendio — via tab Sinergie (Regole) e tile Sinergie (Collezione)

Rimuove la tab "Sinergie" e la card "Tipi sinergia" da `RulesScreen`, e la sezione Sinergie (`SynergyTile`) da `CollectionScreen`, aggiustando il conteggio totale della collezione. `SynergyGraph.tsx` diventa orfano → cancellato.

**Files:**
- Modify: `components/screens/RulesScreen.tsx`
- Modify: `components/screens/CollectionScreen.tsx`
- Delete: `components/screens/compendium/SynergyGraph.tsx`
- Delete: `tests/ui/synergyGraph.test.tsx`
- Test: eventuali `tests/screens` per Rules/Collection.

**Interfaces:**
- Consumes: niente di nuovo.
- Produces: niente.

- [ ] **Step 1: RulesScreen — rimuovere la tab Sinergie**

In `components/screens/RulesScreen.tsx`:
- `type Tab`: togliere `| 'sinergie'` → `type Tab = 'gioco' | 'magie' | 'reliquie'`.
- `TABS`: rimuovere `{ id: 'sinergie', label: 'Sinergie' }`.
- Rimuovere il blocco `{tab === 'sinergie' && ( ... buildSynGroups(['group','origin']).map(...) ... )}` (righe ~329-...).
- Rimuovere la `<GlossaryCard title="Tipi sinergia">` (righe ~246-250) dalla tab "gioco".
- Rimuovere le funzioni/tipi ora orfani: `SynGroup`, `SYNERGY_BONUS_FALLBACK`, `buildSynGroups`, `SynergyCard`, e i meta `SYNERGY_KIND_META` se solo la card "Tipi sinergia" li usava.
- Rimuovere gli import ora orfani: `KIND_COLOR` da SynergyGraph, `SYNERGIES` da `@/data/synergies`, `Synergy` da `@/types`, `synergyBonusText` da glossary (se non più usato).

Run: `grep -n "KIND_COLOR\|SYNERGIES\|synergyBonusText\|Synergy\b" components/screens/RulesScreen.tsx` per confermare zero usi residui prima di togliere ciascun import.

- [ ] **Step 2: CollectionScreen — rimuovere la sezione Sinergie**

In `components/screens/CollectionScreen.tsx`:
- Rimuovere la sezione `{/* Sinergie */}` con `<SectionHeader ... title="Sinergie" ...>` e la map `NAMED_SYNERGIES.map(... <SynergyTile/> ...)` (righe ~560-...).
- Rimuovere `SynergyTile`, `synergyHint`, `NAMED_SYNERGIES`, `NAMED_SYNERGY_ID_SET`, `synFound`, e — se orfani — l'import `SYNERGIES` e il tipo `Synergy`, e l'icona `Sparkles` se solo qui usata.
- **Aggiustare il totale:** in `grandTotal` togliere `+ NAMED_SYNERGIES.length` →
  ```tsx
  const grandTotal = WIZARDS.length + RELICS.length + ALL_BOSSES.length + DUOS.length
  ```
  Verificare che `seenSynergies` non serva più altrove; se orfano, rimuoverlo.

- [ ] **Step 3: Cancellare i file orfani**

Run prima: `grep -rln "SynergyGraph\|KIND_COLOR" components/ tests/ app/ | grep -v "components/screens/compendium/SynergyGraph.tsx\|tests/ui/synergyGraph.test.tsx"`
Expected: vuoto. Poi:
```bash
git rm components/screens/compendium/SynergyGraph.tsx tests/ui/synergyGraph.test.tsx
```

- [ ] **Step 4: Typecheck + test compendio**

Run: `npx tsc --noEmit && npm run test -- --run --disable-console-intercept tests/screens tests/ui`
Expected: exit 0, verde. Aggiornare eventuali test che contavano le sinergie nella collezione o asserivano la tab Sinergie.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "$(cat <<'EOF'
feat(compendio): via tab e codex Sinergie — solo Combo Duo nell'enciclopedia

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Verifica finale end-to-end

Conferma che nessuna superficie UI mostri più sinergie, che il motore sia intatto, e che la suite intera sia verde.

**Files:** nessuna modifica (solo verifica; eventuali fix orfani residui).

- [ ] **Step 1: Grep di residui UI sinergie**

Run:
```bash
grep -rln "SynergyTracker\|SynergyRibbon\|SynergyGraph\|sidebar-tab-sinergie\|ActivationRail\|sinergie attive" components/ app/ tests/
```
Expected: vuoto. Se compare qualcosa, rimuoverlo e ricommittare nel task appropriato.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Suite intera (motore incluso)**

Run: `npm run test -- --run --disable-console-intercept`
Expected: tutti verdi. In particolare cercare nell'output:
- `[campaignBalanceRestricted] winRate=0.0583` — INVARIATO (prova che il motore non è cambiato).
- Nessun fallimento nelle sweep (scudi-rigen, veleno, magie-oscure, esecuzione).

- [ ] **Step 4: Verifica visiva (opzionale ma raccomandata)**

Usare la skill `run` per avviare l'app e controllare a occhio: draft (nessun badge/rail sinergie), reclutamento (rail solo Combo), una battaglia (nessun ribbon), sidebar mappa (nessun tab), Regole/Collezione (nessuna sezione Sinergie).

- [ ] **Step 5: Push**

```bash
git push origin master
```

---

## Self-Review

**Spec coverage:**
- Draft → Task 1 ✅
- Reclutamento → Task 2 ✅
- Sidebar run (collasso tab) → Task 3 ✅
- Battaglia (ribbon) → Task 4 ✅
- Compendio (Regole + Collezione) → Task 5 ✅
- File orfani (SynergyTracker/SynergyRibbon/SynergyGraph) → cancellati nei rispettivi task ✅
- Prop `synergies` rimossa da TeamSynergyBar/SynergyRibbon ma **tenuta** in BattleScreen → Task 3 + Task 4 ✅
- Motore intatto + winRate 0.0583 invariato → Global Constraints + Task 6 ✅

**Placeholder scan:** nessun TBD/TODO; ogni step mostra il codice o il comando esatto. ✅

**Type consistency:** `TeamSynergyBar` nuova firma `{ team, relics, orientation }` usata coerentemente in Task 3 (definizione) e Task 3 Step 4 (call-site RunBRunner). `hotSynergyIds` rimosso a catena DraftScreen→DraftCandidateCard→WizardCardColumn in Task 1. ✅
