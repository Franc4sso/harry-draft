# Leggibilità archetipi: card + Costellazioni — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Far vedere gli archetipi — sulla card (nastro archetipo + bordo-rarità + wash-casata) e sul rail (le Costellazioni: 2/3, attivo, cosa fa), con una nuova funzione motore pura `synergyProgress`.

**Architecture:** 5 task in dipendenza crescente: (1) `synergyProgress` (motore puro) + (2) `ARCHETYPE_BY_TAG` (helper dati) → (3) le Costellazioni (rail) → (4) il redesign card (bordo-rarità + wash + nastro) → (5) wiring nei draft/recruit screen. Zero impatto sul combat/bilanciamento — tutto UI + 1 funzione pura.

**Tech Stack:** TypeScript, React, framer-motion (già nel progetto), Vitest + @testing-library/react. Path alias `@/`.

## Global Constraints

- **Zero motore di combat.** `synergyProgress` è puro, solo per UI; NON tocca simulate.ts, il bilanciamento, la parità. `campaignBalanceB`/`endlessReplayParity` non vanno ri-misurati.
- `npm run test` NON esegue typecheck — ogni task chiude con `npm run typecheck`.
- **Naming = fantasia:** Veleno / Carnefice / Muro (non Tossicità/Spietatezza/Bastione). Mappatura in `ARCHETYPE_BY_TAG`.
- **Magie Oscure:** nastro `☾ Magie Oscure` sulla card, ma NON nelle Costellazioni (nessuna sinergia Oscurità — `synergyId` assente).
- **Sorgente CSS bordi-rarità:** `.superpowers/design/rarity-borders.html` (il design approvato) — portare quel CSS in produzione, non reinventarlo. 4 tier: t4 peltro, t3 argento+alone blu, t2 ametista+filigrana, t1 oro+corona+shimmer. Shimmer solo t1, spento da `prefers-reduced-motion`.
- **Colori:** casate (Grifondoro `#ae0001`, Serpeverde `#1a472a`, Corvonero `#222f5b`, Tassorosso `#ecb939` — da `houseTheme`); rarità (`tierColor` T1 `#ffd34d`, T2 `#b06bff`, T3 `#4da6ff`, T4 `#9aa3ad` — già in theme.ts); archetipo (veleno `#7ddc7d`, esecuzione `#ff8a7a`, scudirigen `#7db7ff`, magieOscure `#b98cff`).
- **Punti codice verificati:** `synergy.ts:4` membersFor (conta ma ritorna null sotto soglia), `synergy.ts:19` detectSynergies; DuoTracker montato `DraftScreen.tsx:76` + `RecruitScreen.tsx:164`; card `WizardCardColumn.tsx:45,71-74` (bordo = houseTheme oggi), `:149` DuoSignalMarks.

---

### Task 1: `synergyProgress` — la funzione motore (pura)

**Files:**
- Modify: `game/engine/synergy.ts` (aggiungere `synergyProgress` + tipo)
- Test: `tests/engine/synergyProgress.test.ts` (create)

**Interfaces:**
- Consumes: `SYNERGIES` (data/synergies.ts), `DraftedWizard`, `Synergy`.
- Produces: `interface SynergyProgress { synergy: Synergy; have: number; need: number; active: boolean; memberIds: string[] }` + `synergyProgress(team): SynergyProgress[]`.

- [ ] **Step 1: Scrivere i test che falliscono**

Create `tests/engine/synergyProgress.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { synergyProgress } from '@/game/engine/synergy'
import type { DraftedWizard } from '@/types'

const dw = (id: string, tags: string[] = []): DraftedWizard =>
  ({ wizard: { id, role: 'Attaccante', house: 'Serpeverde', tags }, level: 1 } as unknown as DraftedWizard)

describe('synergyProgress', () => {
  it('espone have/need/active per ogni sinergia, ANCHE sotto soglia', () => {
    const two = [dw('a', ['veleno']), dw('b', ['veleno'])]
    const tox = synergyProgress(two).find(p => p.synergy.id === 'tossicita')!
    expect(tox.have).toBe(2); expect(tox.need).toBe(3); expect(tox.active).toBe(false)
  })
  it('active=true a soglia', () => {
    const three = [dw('a', ['veleno']), dw('b', ['veleno']), dw('c', ['veleno'])]
    const tox = synergyProgress(three).find(p => p.synergy.id === 'tossicita')!
    expect(tox.have).toBe(3); expect(tox.active).toBe(true)
    expect(tox.memberIds).toHaveLength(3)
  })
  it('have=0 quando nessun mago ha il tag', () => {
    const none = [dw('a'), dw('b')]
    const bas = synergyProgress(none).find(p => p.synergy.id === 'bastione')!
    expect(bas.have).toBe(0); expect(bas.active).toBe(false)
  })
})
```

- [ ] **Step 2: Eseguire i test — devono fallire**

Run: `npm run test -- tests/engine/synergyProgress.test.ts`
Expected: FAIL (`synergyProgress` non esiste).

- [ ] **Step 3: Implementare**

In `game/engine/synergy.ts`, aggiungere (dopo `detectSynergies`):

```ts
export interface SynergyProgress {
  synergy: Synergy
  have: number
  need: number
  active: boolean
  memberIds: string[]
}

/** Progresso per-sinergia INCLUSO il conteggio parziale (2/3) — a differenza di membersFor/detectSynergies
 *  che scartano il parziale. Pura, per UI (le Costellazioni). Replica la logica di conteggio di membersFor. */
export function synergyProgress(team: DraftedWizard[]): SynergyProgress[] {
  return SYNERGIES.map(syn => {
    const req = syn.requires
    const need = req.count ?? 3
    const matched = req.ids && req.ids.length > 0
      ? team.filter(d => req.ids!.includes(d.wizard.id))
      : team.filter(d =>
          (req.house ? d.wizard.house === req.house : true) &&
          (req.role ? d.wizard.role === req.role : true) &&
          (req.tag ? (d.wizard.tags ?? []).includes(req.tag) : true),
        )
    const have = matched.length
    const needCount = req.ids ? req.ids.length : need
    return { synergy: syn, have, need: needCount, active: have >= needCount, memberIds: matched.map(d => d.wizard.id) }
  })
}
```

- [ ] **Step 4: Test + typecheck**

Run: `npm run test -- tests/engine/synergyProgress.test.ts` → PASS.
Run: `npm run typecheck` → nessun errore.

- [ ] **Step 5: Commit**

```bash
git add game/engine/synergy.ts tests/engine/synergyProgress.test.ts
git commit -m "feat(archetype-ui): synergyProgress — espone il conteggio parziale 2/3 per le Costellazioni"
```

---

### Task 2: `ARCHETYPE_BY_TAG` — mappatura tag→fantasia + effetti

**Files:**
- Create: `lib/archetypes.ts`
- Test: `tests/lib/archetypes.test.ts` (create)

**Interfaces:**
- Produces: `ARCHETYPE_BY_TAG` (record tag→{name,glyph,color,synergyId?}) + `ARCHETYPE_EFFECT` (synergyId→testo effetto).

- [ ] **Step 1: Scrivere il test che fallisce**

Create `tests/lib/archetypes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ARCHETYPE_BY_TAG } from '@/lib/archetypes'

describe('ARCHETYPE_BY_TAG', () => {
  it('mappa i 4 tag ai nomi fantasia', () => {
    expect(ARCHETYPE_BY_TAG.veleno.name).toBe('Veleno')
    expect(ARCHETYPE_BY_TAG.esecuzione.name).toBe('Carnefice')
    expect(ARCHETYPE_BY_TAG.scudirigen.name).toBe('Muro')
    expect(ARCHETYPE_BY_TAG.magieOscure.name).toBe('Magie Oscure')
  })
  it('magieOscure NON ha synergyId (no sinergia Oscurità); gli altri 3 sì', () => {
    expect(ARCHETYPE_BY_TAG.magieOscure.synergyId).toBeUndefined()
    expect(ARCHETYPE_BY_TAG.veleno.synergyId).toBe('tossicita')
    expect(ARCHETYPE_BY_TAG.esecuzione.synergyId).toBe('spietatezza')
    expect(ARCHETYPE_BY_TAG.scudirigen.synergyId).toBe('bastione')
  })
})
```

- [ ] **Step 2: Eseguire — deve fallire**

Run: `npm run test -- tests/lib/archetypes.test.ts` → FAIL.

- [ ] **Step 3: Implementare**

Create `lib/archetypes.ts`:

```ts
/** Mappa un tag archetipo al nome FANTASIA (Veleno/Carnefice/Muro), glifo e colore per la UI.
 *  magieOscure ha il nastro ma NESSUN synergyId (la sinergia Oscurità non esiste ancora — Patto Oscuro). */
export const ARCHETYPE_BY_TAG: Record<string, { name: string; glyph: string; color: string; synergyId?: string }> = {
  veleno:      { name: 'Veleno',       glyph: '☠', color: '#7ddc7d', synergyId: 'tossicita' },
  esecuzione:  { name: 'Carnefice',    glyph: '✖', color: '#ff8a7a', synergyId: 'spietatezza' },
  scudirigen:  { name: 'Muro',         glyph: '⛨', color: '#7db7ff', synergyId: 'bastione' },
  magieOscure: { name: 'Magie Oscure', glyph: '☾', color: '#b98cff' },
}

/** Cosa fa l'archetipo quando è attivo (mostrato nelle Costellazioni). Per synergyId. */
export const ARCHETYPE_EFFECT: Record<string, string> = {
  tossicita:   'Il veleno vince la corsa: il tuo DoT sale e si propaga.',
  spietatezza: 'Valanga di uccisioni: ogni kill monta forza e soglia di esecuzione.',
  bastione:    'Muro riflettente: chi ha uno scudo rimanda il danno assorbito.',
}
```

- [ ] **Step 4: Test + typecheck**

Run: `npm run test -- tests/lib/archetypes.test.ts` → PASS. `npm run typecheck` → pulito.

- [ ] **Step 5: Commit**

```bash
git add lib/archetypes.ts tests/lib/archetypes.test.ts
git commit -m "feat(archetype-ui): ARCHETYPE_BY_TAG — nomi fantasia + effetti (magieOscure senza sinergia)"
```

---

### Task 3: Le Costellazioni — `ArchetypeTracker.tsx`

**Files:**
- Create: `components/draft/ArchetypeTracker.tsx`
- Test: `tests/ui/archetypeTracker.test.tsx` (create)

**Interfaces:**
- Consumes: `synergyProgress` (Task 1), `ARCHETYPE_BY_TAG`/`ARCHETYPE_EFFECT` (Task 2).
- Produces: `ArchetypeTracker({ picks, considered? }: { picks: DraftedWizard[]; considered?: DraftedWizard | null })`. Mostra SOLO i 3 archetipi con `synergyId` (Veleno/Carnefice/Muro). Per ognuno: pip×3, have/need, stato (attivo/vicino/sopito), effetto se attivo.

- [ ] **Step 1: Scrivere il test che fallisce**

Create `tests/ui/archetypeTracker.test.tsx`. Modellare sul pattern di `tests/ui/duoTracker.test.tsx` (factory `mage`). Test:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ArchetypeTracker } from '@/components/draft/ArchetypeTracker'

const mage = (id: string, tags: string[] = []) =>
  ({ wizard: { id, name: id, house: 'Serpeverde', role: 'Attaccante', tags }, level: 1 }) as any

describe('ArchetypeTracker (Costellazioni)', () => {
  it('mostra i 3 archetipi con sistema (Veleno/Carnefice/Muro), non Magie Oscure', () => {
    const { container } = render(<ArchetypeTracker picks={[]} />)
    expect(container.querySelector('[data-arch="tossicita"]')).not.toBeNull()
    expect(container.querySelector('[data-arch="spietatezza"]')).not.toBeNull()
    expect(container.querySelector('[data-arch="bastione"]')).not.toBeNull()
    // magieOscure non ha una riga Costellazione
    expect(screen.queryByText(/Magie Oscure/i)).toBeNull()
  })
  it('mostra 2/3 e "vicino" con 2 maghi veleno', () => {
    const picks = [mage('a', ['veleno']), mage('b', ['veleno'])]
    const { container } = render(<ArchetypeTracker picks={picks} />)
    const row = container.querySelector('[data-arch="tossicita"]')!
    expect(row).toHaveAttribute('data-state', 'near')
    expect(row).toHaveTextContent('2/3')
  })
  it('mostra "attivo" + effetto con 3 maghi scudirigen', () => {
    const picks = [mage('a', ['scudirigen']), mage('b', ['scudirigen']), mage('c', ['scudirigen'])]
    const { container } = render(<ArchetypeTracker picks={picks} />)
    const row = container.querySelector('[data-arch="bastione"]')!
    expect(row).toHaveAttribute('data-state', 'active')
    expect(row).toHaveTextContent(/riflette|riman/i)
  })
})
```

- [ ] **Step 2: Eseguire — deve fallire**

Run: `npm run test -- tests/ui/archetypeTracker.test.tsx` → FAIL.

- [ ] **Step 3: Implementare il componente**

Create `components/draft/ArchetypeTracker.tsx`. Riusare i pattern visivi del DuoTracker (header, righe, stati). Consumare `synergyProgress([...picks, considered?])`, filtrare ai `synergyId` noti via `ARCHETYPE_BY_TAG`, per ogni riga: `data-arch={synergyId}`, `data-state={active?'active':have===need-1?'near':'off'}`, pip×need, `have/need`, glifo+nome fantasia, e (se active) l'effetto da `ARCHETYPE_EFFECT`, (se near) "↳ recluta 1 mago [nome]". Stile "Costellazioni" (stelle/pip) dal mockup. La `considered` si aggiunge a picks come nel DuoTracker.

- [ ] **Step 4: Test + typecheck**

Run: `npm run test -- tests/ui/archetypeTracker.test.tsx` → PASS. `npm run typecheck` → pulito.

- [ ] **Step 5: Commit**

```bash
git add components/draft/ArchetypeTracker.tsx tests/ui/archetypeTracker.test.tsx
git commit -m "feat(archetype-ui): ArchetypeTracker (Costellazioni) — 2/3, attivo, effetto sul rail"
```

---

### Task 4: Il redesign card — bordo-rarità + wash-casata + nastro-archetipo

**Files:**
- Modify: `components/cards/WizardCardColumn.tsx`
- Modify/Create: un CSS/module per i bordi-rarità (portare dal mockup `.superpowers/design/rarity-borders.html`)
- Test: aggiornare `tests/ui/wizardCard.test.tsx` (o dove sono i test card) + nuovi assert

**Interfaces:**
- Consumes: `ARCHETYPE_BY_TAG` (Task 2), `tierColor`/`tierLabel` (theme.ts), `houseTheme` (theme.ts).
- Produces: card con bordo per `tier`, wash per `house`, nastro per i tag archetipo.

- [ ] **Step 1: Studiare la card e i test esistenti**

Leggere `components/cards/WizardCardColumn.tsx` interamente (bordo houseTheme a :45,71-74; DuoSignalMarks a :149) e i suoi test. Capire cosa asseriscono i test (probabilmente `data-house`, il bordo casata, la pill DuoSignalMarks) — vanno aggiornati al nuovo design.

- [ ] **Step 2: Scrivere/aggiornare i test**

Aggiungere assert: un mago `scudirigen` mostra un nastro con "Muro" (`data-archetype="scudirigen"` o testo); il bordo card riflette `tier` (`data-tier` o classe `t1..t4`); il wash riflette `house`. `magieOscure` mostra nastro "Magie Oscure". Aggiornare gli assert vecchi sul bordo-casata → ora è wash interno (`data-house` resta come attributo, ma il bordo è rarità).

- [ ] **Step 3: Applicare il redesign**

In `WizardCardColumn.tsx`:
- **Bordo rarità:** applicare la classe/stile per `wizard.tier` (t1..t4) col CSS portato da `.superpowers/design/rarity-borders.html` (box-shadow stratificati per grado, keyline per accent, shimmer solo t1 via framer-motion o CSS con `prefers-reduced-motion`). Sostituire il bordo `houseTheme` (:71-74) col bordo-rarità.
- **Wash casata:** applicare un bg wash interno dal `houseTheme(wizard.house).color` (radial dal top, come nel mockup `--wash`).
- **Nastro archetipo:** per ogni tag del mago in `ARCHETYPE_BY_TAG`, un nastro in alto-destra (glifo+nome, colore). Se il mago ha più tag archetipo, mostrare il primario (primo che matcha) o impilare — scelta d'impl, i mockup mostrano 1 nastro. Questo sostituisce/affianca `DuoSignalMarks` (:149): valutare se tenere DuoSignalMarks per i segnali NON-archetipo (es. role-signal 'taunt') o rimuoverlo. Decidere e documentare nel report.
- Lo shimmer t1: `prefers-reduced-motion` lo spegne (dal mockup).

- [ ] **Step 4: Verifica visiva (raccomandato)**

Se possibile, renderizzare la card in gioco o via test-render e confrontare col mockup. Almeno: i 4 tier hanno bordi distinti, il nastro appare, il wash è visibile.

- [ ] **Step 5: Test + typecheck + suite**

Run: `npm run test -- tests/ui/wizardCard.test.tsx` (e ogni test card) → PASS.
Run: `npm run test` (suite completa — un redesign card può toccare snapshot/count sparsi) → verde (aggiornare snapshot legittimi).
Run: `npm run typecheck` → pulito.

- [ ] **Step 6: Commit**

```bash
git add components/cards/WizardCardColumn.tsx <css> tests/ui/wizardCard.test.tsx
git commit -m "feat(archetype-ui): card redesign — bordo-rarità + wash-casata + nastro-archetipo"
```

---

### Task 5: Wiring — montare le Costellazioni nei draft/recruit screen

**Files:**
- Modify: `components/screens/DraftScreen.tsx` (:76, accanto al DuoTracker)
- Modify: `components/screens/RecruitScreen.tsx` (:164, accanto al DuoTracker)
- Test: `tests/ui/archetypeTrackerWiring.test.tsx` (create, o estendere i test screen)

**Interfaces:**
- Consumes: `ArchetypeTracker` (Task 3). `picks`/`considered`/`baseTeam`/`focus` esistono già nei componenti (usati dal DuoTracker).

- [ ] **Step 1: Test che fallisce**

Create un test che, renderizzando lo screen (o l'aside), verifica che l'ArchetypeTracker sia montato accanto al DuoTracker (un `[data-arch="tossicita"]` presente). Modellare sul test screen esistente più vicino. Se il render screen è pesante (canvas), testare l'aside in isolamento.

- [ ] **Step 2: Eseguire — deve fallire**

Run: `npm run test -- tests/ui/archetypeTrackerWiring.test.tsx` → FAIL.

- [ ] **Step 3: Montare**

In `DraftScreen.tsx` (~:76) accanto al `<DuoTracker picks={picks} considered={considered} />`:
```tsx
<ArchetypeTracker picks={picks} considered={considered} />
```
In `RecruitScreen.tsx` (~:164) accanto al `<DuoTracker picks={baseTeam} considered={focus} ... />`:
```tsx
<ArchetypeTracker picks={baseTeam} considered={focus} />
```
(+ import in entrambi.)

- [ ] **Step 4: Test + suite + typecheck**

Run: `npm run test -- tests/ui/archetypeTrackerWiring.test.tsx` → PASS.
Run: `npm run test` → verde. `npm run typecheck` → pulito.

- [ ] **Step 5: Commit**

```bash
git add components/screens/DraftScreen.tsx components/screens/RecruitScreen.tsx tests/ui/archetypeTrackerWiring.test.tsx
git commit -m "feat(archetype-ui): monta le Costellazioni accanto al DuoTracker (draft + recruit)"
```

---

## Self-Review (autore)

- **Spec coverage:** §3a synergyProgress→Task1; §3b ARCHETYPE_BY_TAG→Task2; §2b/§3d Costellazioni→Task3; §2a card→Task4; wiring→Task5. §2c naming/magieOscure→Task2+Task3. ✅
- **Type consistency:** `SynergyProgress{synergy,have,need,active,memberIds}`, `synergyProgress(team)`, `ARCHETYPE_BY_TAG` (synergyId opzionale), `ArchetypeTracker({picks,considered})` — coerenti tra task. ✅
- **Placeholder scan:** nessun TBD; codice mostrato dove serve. Le decisioni d'impl aperte (DuoSignalMarks tieni/rimuovi, nastro singolo/multiplo) sono segnalate con criterio, non buchi. ✅
- **Rischio noto documentato:** redesign bordo casata→rarità (Task4, aggiornare test card), DuoSignalMarks vs nastro (Task4 Step3), zero motore combat (Global). ✅
- **Numeri/punti verificati:** synergy.ts:4/19; DuoTracker DraftScreen:76/RecruitScreen:164; card :45,71-74,149; tierColor/houseTheme theme.ts; CSS bordi da .superpowers/design/rarity-borders.html. ✅
