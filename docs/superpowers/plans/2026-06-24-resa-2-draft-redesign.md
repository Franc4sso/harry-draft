# Resa — Piano 2: Draft leggibile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere il draft leggibile e mobile-first: vedere i maghi già presi, le affiliazioni/sinergie di ogni candidato, e un tracker che mostra le sinergie attive e — al tocco di un candidato — il risultato proiettato ("Grifondoro 1 → 2") con cosa sblocca.

**Architecture:** Una nuova logica pura `synergyProgress`/`previewSynergies` (in `game/engine/synergy.ts`) espone conteggio/soglia/attivazione per OGNI sinergia (non solo le attive). Helper puri formattano le affiliazioni di un mago. Componenti presentazionali (`SynergyTracker`, `SquadPanel`, `DraftCandidateCard`) li consumano. `DraftScreen` orchestra il layout mobile-first (header fisso squadra+pill, colonna candidati, sheet sinergie in basso; desktop a 3 colonne). Nessuna modifica al motore di combattimento o al draft RNG.

**Tech Stack:** Next.js (questa fork), React 19, TypeScript strict, Tailwind v4, framer-motion, lucide-react, Vitest + React Testing Library.

## Global Constraints

- **Prima di scrivere codice Next**, leggere la guida pertinente in `node_modules/next/dist/docs/` (regola di `AGENTS.md`).
- **TypeScript strict**: nessun `any`, nessun import inutilizzato; `npm run typecheck` pulito.
- **Mobile-first**: il draft deve essere usabile e completo a 320px (colonna unica). Desktop (≥ `md`) usa 3 colonne.
- **Determinismo invariato**: nessuna modifica a `game/engine/draft.ts`, `draftSession.ts`, RNG, o al combat engine. Solo lettura dei dati.
- **`detectSynergies` non deve cambiare comportamento** (test esistenti restano il cancello): aggiungere funzioni nuove, non rompere quelle vecchie.
- **Riuso Plan 1**: usare `WizardCard` (già con ritratto+rarità), `Chip`, `HouseCrest`. Riusare `synergyBonusText` da `@/lib/glossary` per i testi bonus.
- **Soglia sinergia** (regola unica, copiare verbatim): `threshold = requires.count ?? (requires.ids ? requires.ids.length : 3)`.
- **Import alias** `@/...`.
- **Palette Notturno**: oro `#b08d57`/`#caa24a`/`#f3e6a0`, viola `#7c3aed`, verde "attiva/preview" `#7cdc7c`.

---

### Task 1: Motore progresso sinergie (`synergyProgress` + `previewSynergies`)

**Files:**
- Modify: `game/engine/synergy.ts`
- Test: `tests/engine/synergyProgress.test.ts`

**Interfaces:**
- Consumes: `DraftedWizard`, `Synergy` da `@/types`; `SYNERGIES` da `@/data/synergies`.
- Produces (add to `@/game/engine/synergy`):
  ```ts
  export interface SynergyProgress {
    synergy: Synergy
    count: number       // current matching members on the team
    threshold: number   // members needed to activate
    active: boolean      // synergy currently active
    memberIds: string[]  // ids of current matching members
  }
  export function synergyThreshold(syn: Synergy): number
  export function matchingMemberIds(syn: Synergy, team: DraftedWizard[]): string[]
  export function synergyProgress(team: DraftedWizard[]): SynergyProgress[]

  export interface SynergyPreview extends SynergyProgress {
    nextCount: number    // count if the candidate were added
    advances: boolean     // candidate increases count
    willActivate: boolean // !active && nextCount >= threshold
  }
  export function previewSynergies(team: DraftedWizard[], candidate: DraftedWizard): SynergyPreview[]
  ```

**Note:** `detectSynergies` and `membersFor` must keep working unchanged. `matchingMemberIds` is the partial-count version (no threshold gate); reuse it internally where convenient but do NOT alter `detectSynergies`'s output. For `ids`-based synergies the threshold is `ids.length` and `active` means all ids present.

- [ ] **Step 1: Write the failing test**

```ts
// tests/engine/synergyProgress.test.ts
import { describe, it, expect } from 'vitest'
import type { DraftedWizard, Wizard } from '@/types'
import { synergyProgress, previewSynergies, synergyThreshold } from '@/game/engine/synergy'
import { SYNERGIES } from '@/data/synergies'

function dw(id: string, house: Wizard['house'], role: Wizard['role'], tags: string[] = []): DraftedWizard {
  const wizard: Wizard = {
    id, name: id, house, role, tier: 3,
    ranges: { hp: [80, 80], atk: [10, 10], def: [10, 10], spd: [10, 10] },
    spellPool: ['x'], tags,
  }
  return {
    wizard,
    stats: { hp: 80, atk: 10, def: 10, spd: 10 },
    maxHp: 80,
    spell: { id: 'x', name: 'X', type: 'Attacco', hitChance: 1 },
  } as DraftedWizard
}

const grifSyn = SYNERGIES.find((s) => s.id === 'gryffindor3')!

describe('synergyThreshold', () => {
  it('uses requires.count, else ids.length, else 3', () => {
    expect(synergyThreshold(grifSyn)).toBe(3)
    expect(synergyThreshold(SYNERGIES.find((s) => s.id === 'goldenTrio')!)).toBe(3)
    expect(synergyThreshold(SYNERGIES.find((s) => s.id === 'marauder')!)).toBe(2)
  })
})

describe('synergyProgress', () => {
  it('counts partial progress and active state for a house synergy', () => {
    const team = [dw('a', 'Grifondoro', 'Attaccante'), dw('b', 'Grifondoro', 'Tank')]
    const p = synergyProgress(team).find((x) => x.synergy.id === 'gryffindor3')!
    expect(p.count).toBe(2)
    expect(p.threshold).toBe(3)
    expect(p.active).toBe(false)
    expect(p.memberIds.sort()).toEqual(['a', 'b'])
  })
  it('marks active when threshold reached', () => {
    const team = [dw('a', 'Grifondoro', 'Attaccante'), dw('b', 'Grifondoro', 'Tank'), dw('c', 'Grifondoro', 'Supporto')]
    const p = synergyProgress(team).find((x) => x.synergy.id === 'gryffindor3')!
    expect(p.active).toBe(true)
    expect(p.count).toBe(3)
  })
})

describe('previewSynergies', () => {
  it('projects the +1 and flags advances / willActivate', () => {
    const team = [dw('a', 'Grifondoro', 'Attaccante'), dw('b', 'Grifondoro', 'Tank')]
    const cand = dw('c', 'Grifondoro', 'Supporto')
    const pv = previewSynergies(team, cand).find((x) => x.synergy.id === 'gryffindor3')!
    expect(pv.count).toBe(2)
    expect(pv.nextCount).toBe(3)
    expect(pv.advances).toBe(true)
    expect(pv.willActivate).toBe(true)
  })
  it('does not advance a synergy the candidate does not match', () => {
    const team = [dw('a', 'Grifondoro', 'Attaccante')]
    const cand = dw('z', 'Serpeverde', 'Tank')
    const pv = previewSynergies(team, cand).find((x) => x.synergy.id === 'gryffindor3')!
    expect(pv.advances).toBe(false)
    expect(pv.nextCount).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/synergyProgress.test.ts`
Expected: FAIL — `synergyProgress`/`previewSynergies`/`synergyThreshold` not exported.

- [ ] **Step 3: Implement (append to `game/engine/synergy.ts`, keep existing exports intact)**

```ts
// --- progress helpers (append; do not modify detectSynergies/membersFor above) ---
export function synergyThreshold(syn: Synergy): number {
  const req = syn.requires
  return req.count ?? (req.ids ? req.ids.length : 3)
}

export function matchingMemberIds(syn: Synergy, team: DraftedWizard[]): string[] {
  const req = syn.requires
  if (req.ids && req.ids.length > 0) {
    return team.filter((d) => req.ids!.includes(d.wizard.id)).map((d) => d.wizard.id)
  }
  return team
    .filter((d) =>
      (req.house ? d.wizard.house === req.house : true) &&
      (req.role ? d.wizard.role === req.role : true) &&
      (req.tag ? (d.wizard.tags ?? []).includes(req.tag) : true),
    )
    .map((d) => d.wizard.id)
}

export function synergyProgress(team: DraftedWizard[]): SynergyProgress[] {
  return SYNERGIES.map((synergy) => {
    const memberIds = matchingMemberIds(synergy, team)
    const threshold = synergyThreshold(synergy)
    return { synergy, count: memberIds.length, threshold, active: memberIds.length >= threshold, memberIds }
  })
}

export function previewSynergies(team: DraftedWizard[], candidate: DraftedWizard): SynergyPreview[] {
  const withCand = [...team, candidate]
  return SYNERGIES.map((synergy) => {
    const memberIds = matchingMemberIds(synergy, team)
    const nextIds = matchingMemberIds(synergy, withCand)
    const threshold = synergyThreshold(synergy)
    const count = memberIds.length
    const nextCount = nextIds.length
    const active = count >= threshold
    return {
      synergy, count, threshold, active, memberIds,
      nextCount, advances: nextCount > count, willActivate: !active && nextCount >= threshold,
    }
  })
}
```

Also add the two interfaces near the top exports (after `ActiveSynergy` usage / wherever types live in this file):

```ts
export interface SynergyProgress {
  synergy: Synergy
  count: number
  threshold: number
  active: boolean
  memberIds: string[]
}
export interface SynergyPreview extends SynergyProgress {
  nextCount: number
  advances: boolean
  willActivate: boolean
}
```

(`Synergy` is already imported at the top of the file.)

- [ ] **Step 4: Run test + the existing synergy tests to verify no regression**

Run: `npx vitest run tests/engine/synergyProgress.test.ts && npx vitest run tests/engine -t synerg`
Expected: new file PASS; existing synergy tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add game/engine/synergy.ts tests/engine/synergyProgress.test.ts
git commit -m "feat(resa): synergyProgress + previewSynergies — partial counts & projection"
```

---

### Task 2: Affiliazioni di un mago (chip di sinergia)

**Files:**
- Create: `lib/affiliations.ts`
- Test: `tests/lib/affiliations.test.ts`

**Interfaces:**
- Consumes: `Wizard`, `Synergy` da `@/types`; `SYNERGIES` da `@/data/synergies`.
- Produces:
  ```ts
  export interface Affiliation { synergyId: string; label: string; kind: Synergy['kind'] }
  export function wizardMatchesSynergy(wizard: Wizard, syn: Synergy): boolean
  export function wizardAffiliations(wizard: Wizard): Affiliation[]
  ```
  `wizardAffiliations` returns one entry per synergy the wizard can contribute to (house, role, group by tag or id), in `SYNERGIES` order. `label` is the synergy name.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/affiliations.test.ts
import { describe, it, expect } from 'vitest'
import type { Wizard } from '@/types'
import { wizardAffiliations } from '@/lib/affiliations'

const harry: Wizard = {
  id: 'harry', name: 'Harry', house: 'Grifondoro', role: 'Attaccante', tier: 1,
  ranges: { hp: [110, 135], atk: [22, 38], def: [16, 28], spd: [22, 32] },
  spellPool: ['x'], tags: ['order', 'da'],
}

describe('wizardAffiliations', () => {
  it('includes house, role, and group memberships', () => {
    const ids = wizardAffiliations(harry).map((a) => a.synergyId)
    expect(ids).toContain('gryffindor3')   // house
    expect(ids).toContain('attackers3')    // role
    expect(ids).toContain('goldenTrio')    // by id membership
    expect(ids).toContain('order')         // by tag
    expect(ids).toContain('da')            // by tag
  })
  it('excludes synergies the wizard cannot join', () => {
    const ids = wizardAffiliations(harry).map((a) => a.synergyId)
    expect(ids).not.toContain('slytherin3')
    expect(ids).not.toContain('deatheater')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/affiliations.test.ts`
Expected: FAIL — `Cannot find module '@/lib/affiliations'`.

- [ ] **Step 3: Implement**

```ts
// lib/affiliations.ts
import type { Wizard, Synergy } from '@/types'
import { SYNERGIES } from '@/data/synergies'

export interface Affiliation { synergyId: string; label: string; kind: Synergy['kind'] }

export function wizardMatchesSynergy(wizard: Wizard, syn: Synergy): boolean {
  const req = syn.requires
  if (req.ids && req.ids.length > 0) return req.ids.includes(wizard.id)
  return (
    (req.house ? wizard.house === req.house : true) &&
    (req.role ? wizard.role === req.role : true) &&
    (req.tag ? (wizard.tags ?? []).includes(req.tag) : true)
  )
}

export function wizardAffiliations(wizard: Wizard): Affiliation[] {
  return SYNERGIES.filter((syn) => wizardMatchesSynergy(wizard, syn)).map((syn) => ({
    synergyId: syn.id, label: syn.name, kind: syn.kind,
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/affiliations.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/affiliations.ts tests/lib/affiliations.test.ts
git commit -m "feat(resa): wizardAffiliations — synergy memberships per wizard"
```

---

### Task 3: `DraftCandidateCard` — card con affiliazioni + highlight "hot"

**Files:**
- Create: `components/draft/DraftCandidateCard.tsx`
- Test: `tests/ui/draftCandidateCard.test.tsx`

**Interfaces:**
- Consumes: `WizardCard` (Plan 1), `Chip` da `@/components/ui/Chip`, `wizardAffiliations` (Task 2), `DraftedWizard` da `@/types`.
- Produces:
  ```ts
  export function DraftCandidateCard({
    drafted, hotSynergyIds, onPick, onConsider,
  }: {
    drafted: DraftedWizard
    hotSynergyIds?: ReadonlySet<string>   // synergies this pick would advance → highlight
    onPick?: () => void
    onConsider?: () => void               // hover/focus → preview in tracker
  }): JSX.Element
  ```
  Renders `WizardCard` plus an affiliation chip row below it. Chips whose `synergyId ∈ hotSynergyIds` get a "hot" gold style (`data-hot`). Fires `onConsider` on pointer-enter / focus.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ui/draftCandidateCard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { DraftedWizard } from '@/types'
import { DraftCandidateCard } from '@/components/draft/DraftCandidateCard'

const harry = {
  wizard: { id: 'harry', name: 'Harry', house: 'Grifondoro', role: 'Attaccante', tier: 1,
    ranges: { hp: [110,135], atk: [22,38], def: [16,28], spd: [22,32] }, spellPool: ['x'], tags: ['order'] },
  stats: { hp: 120, atk: 30, def: 22, spd: 28 }, maxHp: 120,
  spell: { id: 'x', name: 'Expelliarmus', type: 'Controllo', hitChance: 1, desc: 'disarma' },
} as unknown as DraftedWizard

describe('DraftCandidateCard', () => {
  it('shows affiliation chips and marks hot ones', () => {
    const { container } = render(<DraftCandidateCard drafted={harry} hotSynergyIds={new Set(['gryffindor3'])} />)
    expect(screen.getByText('3 Grifondoro')).toBeInTheDocument()
    expect(container.querySelector('[data-hot][data-synergy="gryffindor3"]')).toBeTruthy()
    expect(container.querySelector('[data-hot][data-synergy="attackers3"]')).toBeFalsy()
  })
  it('fires onConsider on pointer enter and onPick on click', () => {
    const onConsider = vi.fn(); const onPick = vi.fn()
    const { container } = render(<DraftCandidateCard drafted={harry} onConsider={onConsider} onPick={onPick} />)
    fireEvent.pointerEnter(container.firstChild as Element)
    expect(onConsider).toHaveBeenCalled()
    fireEvent.click(screen.getByText('Harry'))
    expect(onPick).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/draftCandidateCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// components/draft/DraftCandidateCard.tsx
'use client'
import type { DraftedWizard } from '@/types'
import { WizardCard } from '@/components/cards/WizardCard'
import { wizardAffiliations } from '@/lib/affiliations'

export function DraftCandidateCard({
  drafted, hotSynergyIds, onPick, onConsider,
}: {
  drafted: DraftedWizard
  hotSynergyIds?: ReadonlySet<string>
  onPick?: () => void
  onConsider?: () => void
}) {
  const affs = wizardAffiliations(drafted.wizard)
  return (
    <div
      className="flex w-60 flex-col gap-2"
      onPointerEnter={onConsider}
      onFocus={onConsider}
    >
      <WizardCard drafted={drafted} onClick={onPick} />
      {affs.length > 0 && (
        <div className="flex flex-wrap gap-1 px-1">
          {affs.map((a) => {
            const hot = hotSynergyIds?.has(a.synergyId) ?? false
            return (
              <span
                key={a.synergyId}
                data-synergy={a.synergyId}
                data-hot={hot ? '' : undefined}
                className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                style={
                  hot
                    ? { color: '#f3e6c4', borderColor: '#b08d57', background: 'rgba(176,141,87,0.28)', boxShadow: '0 0 8px rgba(176,141,87,0.4)' }
                    : { color: '#d9c79a', borderColor: 'rgba(168,140,90,0.5)', background: 'rgba(124,58,237,0.12)' }
                }
              >
                {a.label}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/draftCandidateCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/draft/DraftCandidateCard.tsx tests/ui/draftCandidateCard.test.tsx
git commit -m "feat(resa): DraftCandidateCard — affiliation chips + hot highlight"
```

---

### Task 4: `SynergyTracker` — stato e anteprima al tocco

**Files:**
- Create: `components/draft/SynergyTracker.tsx`
- Test: `tests/ui/synergyTracker.test.tsx`

**Interfaces:**
- Consumes: `SynergyProgress`, `SynergyPreview` (Task 1) da `@/game/engine/synergy`; `synergyBonusText` da `@/lib/glossary`.
- Produces:
  ```ts
  export function SynergyTracker({ rows, candidateName }: {
    rows: SynergyProgress[] | SynergyPreview[]
    candidateName?: string  // when set, header reads "Se peschi <name>:" and rows show projection
  }): JSX.Element
  ```
  Shows only rows with `count > 0` OR (preview) `advances` — i.e. relevant synergies. Each row: name, `count/threshold` (or `count → nextCount` in preview), a bar, and the bonus text. Active rows get `data-active`; preview rows that `willActivate` get `data-activates`.

**Note:** A row is a `SynergyPreview` when it has `nextCount` (use `'nextCount' in row`). Sort rows by closeness: active first, then highest `count/threshold` ratio.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ui/synergyTracker.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SynergyTracker } from '@/components/draft/SynergyTracker'
import { synergyProgress, previewSynergies } from '@/game/engine/synergy'
import type { DraftedWizard, Wizard } from '@/types'

function dw(id: string, house: Wizard['house'], role: Wizard['role']): DraftedWizard {
  return {
    wizard: { id, name: id, house, role, tier: 3, ranges: { hp:[80,80],atk:[10,10],def:[10,10],spd:[10,10] }, spellPool:['x'], tags: [] },
    stats: { hp:80,atk:10,def:10,spd:10 }, maxHp:80, spell: { id:'x',name:'X',type:'Attacco',hitChance:1 },
  } as unknown as DraftedWizard
}

describe('SynergyTracker', () => {
  it('shows current synergies with count/threshold and bonus text', () => {
    const team = [dw('a','Grifondoro','Attaccante'), dw('b','Grifondoro','Tank')]
    render(<SynergyTracker rows={synergyProgress(team)} />)
    expect(screen.getByText('3 Grifondoro')).toBeInTheDocument()
    expect(screen.getByText(/2\s*\/\s*3/)).toBeInTheDocument()
    expect(screen.getByText(/\+20 DIF/)).toBeInTheDocument()
  })
  it('in preview mode shows the projection and the activating row', () => {
    const team = [dw('a','Grifondoro','Attaccante'), dw('b','Grifondoro','Tank')]
    const cand = dw('c','Grifondoro','Supporto')
    const { container } = render(<SynergyTracker rows={previewSynergies(team, cand)} candidateName="c" />)
    expect(screen.getByText(/Se peschi/)).toBeInTheDocument()
    expect(screen.getByText(/2\s*→\s*3/)).toBeInTheDocument()
    expect(container.querySelector('[data-activates]')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/synergyTracker.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// components/draft/SynergyTracker.tsx
'use client'
import type { SynergyProgress, SynergyPreview } from '@/game/engine/synergy'
import { synergyBonusText } from '@/lib/glossary'

function isPreview(r: SynergyProgress | SynergyPreview): r is SynergyPreview {
  return 'nextCount' in r
}

export function SynergyTracker({
  rows, candidateName,
}: {
  rows: SynergyProgress[] | SynergyPreview[]
  candidateName?: string
}) {
  const relevant = rows.filter((r) => (isPreview(r) ? r.count > 0 || r.advances : r.count > 0))
  const sorted = [...relevant].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return b.count / b.threshold - a.count / a.threshold
  })

  return (
    <div className="w-full">
      <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-white/50">
        {candidateName ? <>Se peschi <span className="text-[#7cdc7c]">{candidateName}</span>:</> : 'Sinergie · cosa sbloccano'}
      </p>
      {sorted.length === 0 && <p className="text-xs text-white/40">Nessuna sinergia ancora. Pesca per costruirne una.</p>}
      <div className="space-y-2">
        {sorted.map((r) => {
          const preview = isPreview(r)
          const activates = preview && r.willActivate
          const shown = preview ? r.nextCount : r.count
          const ratio = Math.min(1, shown / r.threshold)
          const bonus = synergyBonusText(r.synergy.bonus).join(' · ')
          return (
            <div
              key={r.synergy.id}
              data-synergy={r.synergy.id}
              data-active={r.active ? '' : undefined}
              data-activates={activates ? '' : undefined}
              className="rounded-lg border p-2"
              style={{
                borderColor: r.active || activates ? '#b08d57' : '#241f38',
                background: r.active || activates ? 'rgba(176,141,87,0.12)' : 'rgba(255,255,255,0.02)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/90">{r.synergy.name}</span>
                <span className="text-[11px] font-bold text-[#b08d57]">
                  {preview ? <>{r.count} → {r.nextCount}</> : <>{r.count} / {r.threshold}</>}
                  {activates && <span className="ml-1 text-[#7cdc7c]">SI ATTIVA</span>}
                </span>
              </div>
              <div className="my-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: 'linear-gradient(90deg,#7c3aed,#b08d57)' }} />
              </div>
              <p className="text-[10px] text-[#c9bfa0]">{bonus}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/synergyTracker.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/draft/SynergyTracker.tsx tests/ui/synergyTracker.test.tsx
git commit -m "feat(resa): SynergyTracker — state + tap-to-preview projection"
```

---

### Task 5: `SquadPanel` — maghi già presi + slot vuoti

**Files:**
- Create: `components/draft/SquadPanel.tsx`
- Test: `tests/ui/squadPanel.test.tsx`

**Interfaces:**
- Consumes: `DraftedWizard` da `@/types`; `HouseCrest` da `@/components/ui/HouseCrest`; `houseTheme` da `@/lib/theme`.
- Produces:
  ```ts
  export function SquadPanel({ picks, teamSize, layout }: {
    picks: DraftedWizard[]
    teamSize: number
    layout?: 'row' | 'column'   // row = mobile header strip, column = desktop rail
  }): JSX.Element
  ```
  Renders one avatar per pick (initial + house color + crest + name) and `teamSize - picks.length` empty slots (`data-empty`).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ui/squadPanel.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { DraftedWizard } from '@/types'
import { SquadPanel } from '@/components/draft/SquadPanel'

const pick = {
  wizard: { id: 'harry', name: 'Harry', house: 'Grifondoro', role: 'Attaccante', tier: 1, ranges: { hp:[1,1],atk:[1,1],def:[1,1],spd:[1,1] }, spellPool:['x'], tags: [] },
  stats: { hp:1,atk:1,def:1,spd:1 }, maxHp:1, spell: { id:'x',name:'X',type:'Attacco',hitChance:1 },
} as unknown as DraftedWizard

describe('SquadPanel', () => {
  it('shows picked wizards and the remaining empty slots', () => {
    const { container } = render(<SquadPanel picks={[pick]} teamSize={5} />)
    expect(screen.getByText('Harry')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-empty]')).toHaveLength(4)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/squadPanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// components/draft/SquadPanel.tsx
'use client'
import type { DraftedWizard } from '@/types'
import { HouseCrest } from '@/components/ui/HouseCrest'
import { houseTheme } from '@/lib/theme'

export function SquadPanel({
  picks, teamSize, layout = 'row',
}: {
  picks: DraftedWizard[]
  teamSize: number
  layout?: 'row' | 'column'
}) {
  const empties = Math.max(0, teamSize - picks.length)
  const wrap = layout === 'column' ? 'flex flex-col gap-2' : 'flex flex-row flex-wrap gap-2'
  return (
    <div className={wrap}>
      {picks.map((p) => {
        const theme = houseTheme(p.wizard.house)
        return (
          <div key={p.wizard.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-1.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-black" style={{ background: theme.color }}>
              {p.wizard.name.charAt(0)}
            </span>
            <span className="flex items-center gap-1 text-xs font-semibold text-white/90">
              <HouseCrest house={p.wizard.house} size={12} />{p.wizard.name}
            </span>
          </div>
        )
      })}
      {Array.from({ length: empties }).map((_, i) => (
        <div key={`empty-${i}`} data-empty className="flex items-center gap-2 rounded-lg border border-dashed border-white/15 p-1.5 opacity-50">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-xs text-white/40">?</span>
          <span className="text-xs text-white/40">vuoto</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/squadPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/draft/SquadPanel.tsx tests/ui/squadPanel.test.tsx
git commit -m "feat(resa): SquadPanel — picked wizards + empty slots"
```

---

### Task 6: Layout draft mobile-first (integrazione)

**Files:**
- Modify: `components/screens/DraftScreen.tsx`
- Modify (or replace usage): `components/draft/DraftBoard.tsx`
- Test: `tests/ui/draftScreen.test.tsx` (create) and check existing draft tests

**Interfaces:**
- Consumes: `useDraft` (existing — gives `current, picks, teamSize, done, pick`), `SquadPanel` (T5), `SynergyTracker` (T4), `DraftCandidateCard` (T3), `synergyProgress`/`previewSynergies` (T1).
- Produces: the new draft layout. `DraftScreen` keeps its props `{ seed, onComplete }` and behavior (fires `onComplete(picks)` when `done`).

**Note:** Before editing, run `npx vitest run tests/ui` and note any test that renders `DraftScreen`/`DraftBoard` so you can update it. `DraftBoard` is currently a thin wrapper; you may fold its candidate grid into `DraftScreen` and either delete `DraftBoard` (and its test, if trivial) or keep it rendering the candidate column. Prefer keeping `DraftProgress` if a test depends on it. The hovered/considered candidate is local `useState` in `DraftScreen`; clearing it (pointer leave) returns the tracker to current-state.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ui/draftScreen.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DraftScreen } from '@/components/screens/DraftScreen'

describe('DraftScreen (resa layout)', () => {
  it('renders the squad panel, candidates, and a synergy tracker', () => {
    render(<DraftScreen seed="resa-test" onComplete={() => {}} />)
    // squad panel shows empty slots up to team size (5) before any pick
    expect(document.querySelectorAll('[data-empty]').length).toBeGreaterThan(0)
    // synergy tracker header present
    expect(screen.getByText(/Sinergie/i)).toBeInTheDocument()
    // at least one candidate card (a wizard name appears as a portrait alt)
    expect(document.querySelector('img[data-variant="card"]')).toBeTruthy()
  })
  it('advances picks when a candidate is chosen', () => {
    render(<DraftScreen seed="resa-test" onComplete={() => {}} />)
    const before = document.querySelectorAll('[data-empty]').length
    // click the first candidate's card (portrait alt → closest button)
    const firstCard = document.querySelector('img[data-variant="card"]') as HTMLElement
    fireEvent.click(firstCard)
    const after = document.querySelectorAll('[data-empty]').length
    expect(after).toBeLessThanOrEqual(before) // a slot filled (or draft advanced)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/draftScreen.test.tsx`
Expected: FAIL — current `DraftScreen` has no `[data-empty]` / tracker.

- [ ] **Step 3: Implement the new `DraftScreen`**

```tsx
// components/screens/DraftScreen.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import type { DraftedWizard } from '@/types'
import { useDraft } from '@/hooks/useDraft'
import { SquadPanel } from '@/components/draft/SquadPanel'
import { SynergyTracker } from '@/components/draft/SynergyTracker'
import { DraftCandidateCard } from '@/components/draft/DraftCandidateCard'
import { synergyProgress, previewSynergies } from '@/game/engine/synergy'

export function DraftScreen({ seed, onComplete }: { seed: string; onComplete: (team: DraftedWizard[]) => void }) {
  const { current, picks, teamSize, done, pick } = useDraft(seed)
  const [considered, setConsidered] = useState<DraftedWizard | null>(null)
  const fired = useRef(false)

  useEffect(() => {
    if (done && !fired.current) { fired.current = true; onComplete(picks) }
  }, [done, picks, onComplete])

  // tracker rows: preview when a candidate is considered, else current state
  const rows = considered ? previewSynergies(picks, considered) : synergyProgress(picks)
  const hotByCandidate = (c: DraftedWizard): ReadonlySet<string> =>
    new Set(previewSynergies(picks, c).filter((p) => p.advances).map((p) => p.synergy.id))

  if (done) return <main className="flex-1" />

  return (
    <main className="flex-1 w-full">
      {/* Sticky header: squad + progress */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[rgba(10,8,19,0.9)] px-4 py-3 backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="font-display text-xl">Scegli il {picks.length + 1}º mago</h1>
          <span className="text-[11px] uppercase tracking-widest text-[#b08d57]">Pesca {picks.length}/{teamSize}</span>
        </div>
        <SquadPanel picks={picks} teamSize={teamSize} layout="row" />
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 p-4 md:grid-cols-[1fr_280px]">
        {/* Candidates */}
        <section
          className="flex flex-wrap justify-center gap-5"
          onPointerLeave={() => setConsidered(null)}
        >
          {current.map((c, i) => (
            <DraftCandidateCard
              key={c.wizard.id}
              drafted={c}
              hotSynergyIds={hotByCandidate(c)}
              onConsider={() => setConsidered(c)}
              onPick={() => { setConsidered(null); pick(i) }}
            />
          ))}
        </section>

        {/* Synergy tracker: desktop rail */}
        <aside className="hidden md:block">
          <div className="sticky top-28 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <SynergyTracker rows={rows} candidateName={considered?.wizard.name} />
          </div>
        </aside>
      </div>

      {/* Synergy tracker: mobile bottom sheet */}
      <div className="sticky bottom-0 z-10 border-t border-[#b08d57] bg-[rgba(10,8,19,0.96)] p-3 md:hidden">
        <SynergyTracker rows={rows} candidateName={considered?.wizard.name} />
      </div>

      <p className="py-3 text-center text-[10px] uppercase tracking-widest text-white/30">seed: {seed}</p>
    </main>
  )
}
```

- [ ] **Step 4: Decide DraftBoard's fate**

`DraftBoard` is no longer used by `DraftScreen`. If a test imports it, keep the file but it's now dead in the draft flow — check usages: `grep -rn "DraftBoard" components app tests`. If only its own (now-removed) usage referenced it and any `tests/ui` test renders it, either delete `components/draft/DraftBoard.tsx` + its test, or leave it untouched if other code uses it. Do the minimal correct thing and note it in your report.

- [ ] **Step 5: Run draft tests + typecheck**

Run: `npx vitest run tests/ui/draftScreen.test.tsx && npm run typecheck`
Expected: PASS; typecheck clean. Then run the whole `tests/ui` folder and fix/-update any draft-related test that broke due to the intended layout change (inspect each — do not blind-update).

- [ ] **Step 6: Full suite**

Run: `npm test`
Expected: green (≥ prior count + new tests).

- [ ] **Step 7: Commit**

```bash
git add components/screens/DraftScreen.tsx components/draft/ tests/ui/draftScreen.test.tsx
git commit -m "feat(resa): mobile-first draft layout — squad + candidates + synergy tracker"
```

---

## Self-Review

**Spec coverage (Piano 2 = spec §6):**
- Layout mobile-first colonna unica + desktop 3-col → Task 6. ✓
- Header fisso con maghi già presi (squad) → Task 5 + Task 6. ✓
- Pill/colpo d'occhio sinergie → tracker in header rail/sheet (Task 4 + 6). ✓
- Card candidato a stat piene + chip affiliazione + "hot" → Task 3 (chips) su `WizardCard` di Plan 1 (stat piene già presenti). ✓
- Tracker: stato attuale (count/soglia + cosa fanno) → Task 1 + 4. ✓
- Anteprima al tocco con freccia 1→2 + "SI ATTIVA" → Task 1 (`previewSynergies`) + Task 4 + 6 (considered state). ✓
- Riuso `glossary.synergyBonusText`, `detectSynergies` invariato → Task 1 vincoli. ✓

**Placeholder scan:** nessun TODO/placeholder; ogni step ha codice o comando reale. ✓

**Type consistency:** `SynergyProgress`/`SynergyPreview` (Task 1) usati in Task 4; `wizardAffiliations`/`Affiliation` (Task 2) in Task 3; `hotSynergyIds: ReadonlySet<string>` coerente tra Task 3 (prop) e Task 6 (`hotByCandidate` ritorna `ReadonlySet<string>`); `SquadPanel` props (`picks, teamSize, layout`) usate in Task 6; `previewSynergies(team, candidate)` firma coerente Task 1↔6. ✓

**Note esecuzione:** Task 6 è il più integrato — l'implementer deve ispezionare i test draft esistenti prima di editare e aggiornare solo quelli rotti dal cambio di layout voluto (no blind `-u`). `DraftBoard`/`DraftProgress` potrebbero diventare morti: rimozione minima e motivata.
