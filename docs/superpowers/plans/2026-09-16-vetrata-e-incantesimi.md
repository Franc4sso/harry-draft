# La vetrata e gli incantesimi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare a schermo la battaglia che l'utente ha approvato: dieci carte complete, il nastro dei sigilli al centro, il colpo sulla carta di chi lo subisce, gli stati sommati, e i VFX Pixi che il progetto ha già ma che nessuno collega alla scena.

**Architecture:** Si sostituisce la disposizione e si **collega** ciò che esiste. `CartaCombat` è la carta 212×254 della battaglia (non `WizardCard`, che resta la carta di pesca). `NastroSigilli` è la sequenza centrale. `BattleArena` li compone e ancora i VFX. La libreria `lib/vfx/` si usa così com'è.

**Spec:** `docs/superpowers/specs/2026-09-16-vetrata-e-incantesimi-design.md`

**Mockup vincolanti:** struttura https://claude.ai/artifact/PNqfY2yLXxHiY4ziu6QsUq (variante **Vetrata**) · effetti https://claude.ai/artifact/Dk93L833VQCrhqUvzHwgo3

## Global Constraints

- **I mockup si aprono e si guardano.** Un piano precedente è fallito perché i brief descrivevano a parole ciò che il disegno mostrava, e nessuno ha riaperto il disegno: ogni task che tocca la resa cita la misura presa da lì.
- **Misure vincolanti** (cornice 1366×768): barra in cima `1366×32` · carte `212×254`, fila da `x=135`, passo `221`, nemici `y=46`, alleati `y=510` · nastro `y=316` alto `180`, binario a `y=390` · focus `380×116` a `x=206,y=332` · nodi futuri da `x=648`, passo `104`.
- **Dieci carte, niente tagli.** `main` è `overflow-hidden`: **`scrollHeight` a 768 NON è una prova** — va verificato che ogni carta abbia `top >= 0` e `bottom <= 768`.
- **FPS sopra 45** con effetti in corso. Sul mockup: 52 a raffica, 44 durante un Duo a cinque. Se scende sotto, è un difetto.
- **Gli stati si sommano**: una pillola per stato col totale (`☠ 3`), mai tre icone uguali. Lo scudo mostra i punti `absorb` residui, non le dosi.
- **L'aura è intensità, non presenza**: gelo e stordimento sempre, danni nel tempo da **2 dosi** in su. Motivo misurato: cinque aure insieme sono illeggibili e costano 19 fps contro 52.
- `prefers-reduced-motion`: restano numeri, barre, pillole, aure; spariscono i movimenti.
- **Nessuna dipendenza nuova**: `pixi.js@8`, `pixi-filters`, `gsap`, `framer-motion` sono già nel `package.json`.
- Non si tocca `game/engine/`, `data/`, il bilanciamento, né `components/cards/WizardCard.tsx`.
- **Nessun test silenziato**: quelli sul vecchio palco si riscrivono con un commento che spiega perché.
- `npm run test` NON esegue il typecheck: `npm run typecheck 2>&1 | grep -v '.next/dev'` a parte.

## File Structure

| File | Responsabilità |
|---|---|
| `components/battle/CartaCombat.tsx` | **Creare.** La carta 212×254: ritratto, ruolo, nome, incantesimo col sigillo, vita col numero, tre statistiche, pillole sommate, aura. |
| `components/battle/NastroSigilli.tsx` | **Creare.** La sequenza centrale: passati, focus, futuri, tacche di chi salterà. |
| `components/battle/ColpoSullaCarta.tsx` | **Creare.** Il numero centrato sul ritratto, con targhetta dell'effetto. |
| `lib/battleStacks.ts` | **Creare.** Somma gli `ActiveEffect` in pillole; decide l'aura. Puro, testabile. |
| `components/battle/BattleArena.tsx` | **Riscrivere la resa.** Compone la scena, ancora i VFX. |
| `components/battle/PixiArena.tsx` | **Modificare.** Aggancia gli effetti alle nuove carte. |
| `components/screens/BattleScreen.tsx` | **Modificare.** Altezze, vetrata, registro fuori dal combattimento. |
| `components/battle/vetrata.css` | **Creare.** Trame della vetrata, filo di luce, vignettatura. |

---

## Task 1: La somma degli stati

**Files:**
- Create: `lib/battleStacks.ts`
- Test: `tests/lib/battleStacks.test.ts`

**Interfaces:**
- Consumes: `ActiveEffect` da `@/types`; `STATUS_BY_ID`, `STATUS_DEFS` da `@/data/statuses`.
- Produces:
  ```ts
  export interface Pillola {
    /** Famiglia visiva: veleno, burn, stun, freeze, silence, disarm, shield, regen, buff, debuff. */
    kind: string
    glyph: string
    color: string
    /** Il numero da mostrare: dosi per i DoT, punti assorbibili per lo scudo, turni per il resto.
     *  `undefined` quando non c'è nulla di utile da contare. */
    count?: number
    label: string
  }

  /** Le pillole di un'unità: UNA per famiglia, col totale. Mai due icone uguali. */
  export function pilloleDi(effects: ActiveEffect[]): Pillola[]

  /** L'aura della cornice, o null. Intensità, non presenza. */
  export function auraDi(effects: ActiveEffect[]): { kind: string; color: string } | null
  ```

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/battleStacks.test.ts
import { describe, it, expect } from 'vitest'
import { pilloleDi, auraDi } from '@/lib/battleStacks'
import { STATUS_DEFS } from '@/data/statuses'
import type { ActiveEffect } from '@/types'

const fx = (id: string, over: Partial<ActiveEffect> = {}): ActiveEffect =>
  ({ kind: id, statusId: id, remaining: 2, stacks: 1, ...over } as unknown as ActiveEffect)

describe('pilloleDi — una per famiglia, col totale', () => {
  it('tre dosi di veleno sono UNA pillola che dice 3', () => {
    // La correzione dell'utente: «I VELENI, COME LE BRUCIATURE E COME GLI SCUDI,
    // VANNO SOMMATI, NON MI METTERE 3 ICONE PER 3 VELENI».
    const p = pilloleDi([fx('veleno', { stacks: 3 })])
    expect(p).toHaveLength(1)
    expect(p[0]!.count).toBe(3)
  })

  it('anche se il motore manda tre voci separate, la pillola resta una', () => {
    const p = pilloleDi([fx('veleno'), fx('veleno'), fx('veleno')])
    expect(p.filter(x => x.kind === 'veleno')).toHaveLength(1)
    expect(p[0]!.count).toBe(3)
  })

  it('lo scudo mostra i PUNTI assorbibili, non le dosi', () => {
    // shield non accumula (`stack:'refresh'`): ha `absorb`, punti che calano.
    const p = pilloleDi([fx('shield', { absorbLeft: 38 } as never)])
    expect(p[0]!.count).toBe(38)
  })

  it('stati diversi restano pillole diverse', () => {
    const p = pilloleDi([fx('veleno'), fx('burn'), fx('silence')])
    expect(new Set(p.map(x => x.kind)).size).toBe(3)
  })

  it('senza stati, nessuna pillola', () => {
    expect(pilloleDi([])).toEqual([])
  })

  it('ogni stato del catalogo produce una pillola con glifo e nome', () => {
    const muti = STATUS_DEFS.filter(d => {
      const p = pilloleDi([fx(d.id)])
      return p.length === 0 || !p[0]!.glyph || !p[0]!.label
    }).map(d => d.id)
    expect(muti, `stati senza pillola: ${muti.join(', ')}`).toEqual([])
  })
})

describe('auraDi — intensità, non presenza', () => {
  it('una dose sola di veleno NON accende l aura', () => {
    // Misurato: con il Duo Miasma che propaga a cinque alleati, cinque cornici
    // tratteggiate insieme sono illeggibili e costano 19 fps contro 52.
    expect(auraDi([fx('veleno', { stacks: 1 })])).toBeNull()
  })

  it('due dosi la accendono', () => {
    expect(auraDi([fx('veleno', { stacks: 2 })])?.kind).toBe('veleno')
  })

  it('gli stati che bloccano il turno la accendono sempre', () => {
    expect(auraDi([fx('freeze')])?.kind).toBe('freeze')
    expect(auraDi([fx('stun')])?.kind).toBe('stun')
  })

  it('con più stati vince il più grave, e l aura resta UNA', () => {
    const a = auraDi([fx('veleno', { stacks: 4 }), fx('freeze')])
    expect(a?.kind).toBe('freeze')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/battleStacks.test.ts` — Expected: FAIL, modulo non risolto.

- [ ] **Step 3: Write the implementation**

Leggere `data/statuses.ts` per i 24 `id` reali e le loro famiglie. Il campo dei punti scudo è `absorbLeft` su `ActiveEffect` (`types/combat.ts`) — verificarlo prima di usarlo.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/battleStacks.test.ts` — Expected: PASS, 10 test.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck 2>&1 | grep -v '.next/dev'
git add lib/battleStacks.ts tests/lib/battleStacks.test.ts
git commit -m "feat(battaglia): gli stati si sommano — una pillola per famiglia"
```

---

## Task 2: La carta di battaglia

**Files:**
- Create: `components/battle/CartaCombat.tsx`
- Create: `components/battle/vetrata.css`
- Test: `tests/battle/CartaCombat.test.tsx`

**Interfaces:**
- Consumes: `ReplayUnit`, `ActiveEffect`, `pilloleDi`/`auraDi` (Task 1), `PortraitImage`, `SPELL_TYPE_META` da `@/lib/glossary`.
- Produces:
  ```tsx
  export function CartaCombat({ unit, hp, maxHp, effects, spell, role, level, ruolo, stato, className, style }: {
    unit: ReplayUnit
    hp: number
    maxHp: number
    effects: ActiveEffect[]
    spell?: { name: string; type: SpellType }
    level?: number
    /** 'attore' accende la cornice dorata, 'bersaglio' quella rossa. */
    ruolo?: 'attore' | 'bersaglio' | null
    stato?: 'vivo' | 'caduto'
    className?: string
    style?: React.CSSProperties
  }): JSX.Element
  ```

Dal mockup (variante Vetrata): riquadro **212×254**, bordo 1px del lato, `box-shadow: inset 0 1px 0 rgba(255,255,255,.12)` — il filo di luce. Ritratto che riempie, sfumatura in basso, ruolo 6.5px `letter-spacing:.16em`, nome Cinzel 900 14px, incantesimo 8.5px col sigillo del tipo, barra vita 6px col numero `hp/max`, banda di tre statistiche. Caduto: `grayscale`, `opacity .34`, scritta `CADUTA`. Angoli incisi 15px su attore e bersaglio.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/battle/CartaCombat.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CartaCombat } from '@/components/battle/CartaCombat'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { ActiveEffect } from '@/types'

const u = (o: Partial<ReplayUnit> = {}): ReplayUnit =>
  ({ key: 'left:harry', id: 'harry', name: 'Harry Potter', side: 'left',
     house: 'Grifondoro', maxHp: 120, spd: 23, ...o } as ReplayUnit)
const fx = (id: string, o = {}): ActiveEffect =>
  ({ kind: id, statusId: id, remaining: 2, stacks: 1, ...o } as unknown as ActiveEffect)

describe('CartaCombat', () => {
  it('mostra nome, vita col numero e le tre statistiche', () => {
    render(<CartaCombat unit={u()} hp={84} maxHp={120} effects={[]} />)
    expect(screen.getByText('Harry Potter')).toBeInTheDocument()
    expect(screen.getByTestId('carta-hp-testo')).toHaveTextContent('84/120')
    expect(screen.getByTestId('carta-hp')).toHaveStyle({ width: '70%' })
  })

  it('le tre dosi di veleno sono UNA pillola', () => {
    render(<CartaCombat unit={u()} hp={84} maxHp={120} effects={[fx('veleno', { stacks: 3 })]} />)
    const pip = screen.getAllByTestId('carta-pillola')
    expect(pip).toHaveLength(1)
    expect(pip[0]).toHaveTextContent('3')
  })

  it('accende la cornice giusta per attore e bersaglio', () => {
    const { rerender } = render(<CartaCombat unit={u()} hp={84} maxHp={120} effects={[]} ruolo="attore" />)
    expect(screen.getByTestId('carta-combat')).toHaveAttribute('data-ruolo', 'attore')
    rerender(<CartaCombat unit={u()} hp={84} maxHp={120} effects={[]} ruolo="bersaglio" />)
    expect(screen.getByTestId('carta-combat')).toHaveAttribute('data-ruolo', 'bersaglio')
  })

  it('il caduto resta in campo, marcato', () => {
    render(<CartaCombat unit={u()} hp={0} maxHp={120} effects={[]} stato="caduto" />)
    expect(screen.getByTestId('carta-combat')).toHaveAttribute('data-caduto', 'true')
    expect(screen.getByText(/caduto|caduta/i)).toBeInTheDocument()
  })

  it('porta la chiave dell unità, che i VFX usano per ancorarsi', () => {
    render(<CartaCombat unit={u()} hp={84} maxHp={120} effects={[]} />)
    expect(screen.getByTestId('carta-combat')).toHaveAttribute('data-unit-key', 'left:harry')
  })

  it('disegna davvero il ritratto, non solo lo importa', () => {
    // In questo progetto una carta passò ogni test e più review mentre il ritratto
    // non veniva montato affatto: i test misuravano, non guardavano.
    const { container } = render(<CartaCombat unit={u()} hp={84} maxHp={120} effects={[]} />)
    expect(container.querySelector('img, svg')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/battle/CartaCombat.test.tsx` — Expected: FAIL, modulo non risolto.

- [ ] **Step 3: Write the implementation**

**Riaprire il mockup della Vetrata** e prendere i valori dalla fonte: trame a 60°/−60°, filo di luce, vignettatura. `PortraitImage` non ha variante `poster`: le varianti reali vanno guardate, non indovinate.

- [ ] **Step 4: Run + guardare**

Run: `npx vitest run tests/battle/CartaCombat.test.tsx` — Expected: PASS, 6 test.
Poi **guardare la carta renderizzata**: i test dicono che i dati arrivano, solo l'occhio dice se somiglia al mockup.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck 2>&1 | grep -v '.next/dev'
git add components/battle/CartaCombat.tsx components/battle/vetrata.css tests/battle/CartaCombat.test.tsx
git commit -m "feat(battaglia): la carta di battaglia, vetrata e stati sommati"
```

---

## Task 3: Il nastro dei sigilli

**Files:**
- Create: `components/battle/NastroSigilli.tsx`
- Test: `tests/battle/NastroSigilli.test.tsx`

**Interfaces:**
- Consumes: `Replay`, `initiativeAt`/`lastRealEntryAt` da `@/lib/initiative`, `SPELL_TYPE_META` da `@/lib/glossary`.
- Produces:
  ```tsx
  export function NastroSigilli({ replay, index, className }: {
    replay: Replay
    index: number
    className?: string
  }): JSX.Element
  ```

**Il sigillo viene dal tipo di incantesimo**, e quei tipi esistono già: `SPELL_TYPE_META` in `lib/glossary.ts` dà colore e icona per Attacco / Difesa / Cura / Controllo. Si riusano.

**La fonte dell'ordine** è `initiativeAt` — il futuro vero del replay, non un ordine ricalcolato. Stessa decisione presa per la corsia precedente, per la stessa ragione: un ordine ricalcolato può smentire ciò che il motore ha fatto.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/battle/NastroSigilli.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NastroSigilli } from '@/components/battle/NastroSigilli'
import { buildReplay } from '@/game/engine/combat/replay'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { detectSynergies } from '@/game/engine/synergy'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'

const team = (ids: string[], s: string) =>
  ids.map(id => draftWizard(createRng(`${s}-${id}`), WIZARD_BY_ID[id]!, false))

function fixture() {
  const l = team(['harry','hermione','ron'], 'L')
  const r = team(['draco','goyle','crabbe'], 'R')
  const res = simulateBattle(l, r, createRng(7), { leftSyn: detectSynergies(l), rightSyn: detectSynergies(r) })
  return buildReplay(res, l, r, { leftSyn: detectSynergies(l), rightSyn: detectSynergies(r), leftRelics: [], rightRelics: [] })
}

describe('NastroSigilli', () => {
  it('mostra la sequenza degli incantesimi in arrivo', () => {
    render(<NastroSigilli replay={fixture()} index={3} />)
    expect(screen.getAllByTestId('sigillo').length).toBeGreaterThanOrEqual(4)
  })

  it('il turno attuale è in fuoco, e dice chi lancia cosa', () => {
    render(<NastroSigilli replay={fixture()} index={3} />)
    const f = screen.getByTestId('nastro-focus')
    expect(f.textContent).toMatch(/\S/)
    expect(f).toHaveAttribute('data-unit')
  })

  it('ogni sigillo porta il TIPO dell incantesimo', () => {
    render(<NastroSigilli replay={fixture()} index={3} />)
    const s = screen.getAllByTestId('sigillo')
    expect(s.some(x => x.getAttribute('data-tipo'))).toBe(true)
  })

  it('chi salterà porta la tacca, prima che accada', () => {
    const replay = fixture()
    const key = replay.units[0]!.key
    const patched = { ...replay, frames: replay.frames.map(f => ({
      ...f, statusEffects: { ...f.statusEffects,
        [key]: [{ kind: 'stun', statusId: 'stun', remaining: 2, stacks: 1 }] } })) }
    render(<NastroSigilli replay={patched as never} index={1} />)
    expect(screen.getAllByTestId('tacca-salta').length).toBeGreaterThanOrEqual(1)
  })

  it('sui frame di sistema il fuoco non si svuota', () => {
    // Un tick di veleno o un Duo non hanno attore proprio: il fuoco resta
    // sull'ultima azione vera, come già fa il resto della scena.
    const replay = fixture()
    const sys = replay.frames.findIndex(f => f.entry?.type === 'system')
    render(<NastroSigilli replay={replay} index={sys >= 0 ? sys : 2} />)
    expect(screen.getByTestId('nastro-focus').textContent).toMatch(/\S/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/battle/NastroSigilli.test.tsx` — Expected: FAIL, modulo non risolto.

- [ ] **Step 3: Write the implementation**

Riaprire il mockup: ottagoni `clip-path: polygon(29% 0,71% 0,100% 29%,100% 71%,71% 100%,29% 100%,0 71%,0 29%)`, futuri 36px, passati 28px a opacità .2, focus 380×116 con angoli dorati 16px e ghiera `0 0 0 4px rgba(6,5,11,.9), 0 0 0 5px rgba(184,150,63,.28)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/battle/NastroSigilli.test.tsx` — Expected: PASS, 5 test.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck 2>&1 | grep -v '.next/dev'
git add components/battle/NastroSigilli.tsx tests/battle/NastroSigilli.test.tsx
git commit -m "feat(battaglia): il nastro dei sigilli — la sequenza al centro"
```

---

## Task 4: Il colpo sulla carta

**Files:**
- Create: `components/battle/ColpoSullaCarta.tsx`
- Test: `tests/battle/ColpoSullaCarta.test.tsx`

**Interfaces:**
- Consumes: `SceneEvent` da `@/lib/battleScene` (esiste già).
- Produces:
  ```tsx
  export function ColpoSullaCarta({ event, frameKey, box }: {
    event: SceneEvent
    frameKey: number
    /** Il riquadro della carta colpita, in coordinate della cornice. */
    box?: { x: number; y: number; w: number; h: number } | null
  }): JSX.Element | null
  ```

**Richiesta esplicita dell'utente**, e va rispettata alla lettera: «il danno lo farei leggermente più piccolo e al centro dell'immagine, non così sopra». Quindi **centrato sul ritratto** della carta, non sul bordo superiore. Misure: normale **56px**, critico **72px** (il mockup usava 70/90 sopra il bordo: qui si scende).

| evento | resa |
|---|---|
| colpo | numero bianco 56px |
| critico | numero oro 72px |
| cura / rigenera | numero verde col `+` |
| assorbito | numero azzurro barrato |
| uccisione | `K.O.` |
| schivata / turno saltato | parola, nessun numero |

Sotto, la targhetta dell'effetto quando serve. **Il numero va vincolato dentro la cornice**: su una carta di bordo usciva — misurato sul mockup.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/battle/ColpoSullaCarta.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ColpoSullaCarta } from '@/components/battle/ColpoSullaCarta'
import type { SceneEvent } from '@/lib/battleScene'

const ev = (p: Partial<SceneEvent>): SceneEvent => ({ kind: 'hit', gained: {}, lost: {}, ...p })
const box = { x: 135, y: 510, w: 212, h: 254 }

describe('ColpoSullaCarta', () => {
  it('il numero sta al CENTRO della carta, non sopra il bordo', () => {
    // Richiesta dell'utente: «il danno lo farei leggermente più piccolo e al
    // centro dell'immagine, non così sopra».
    render(<ColpoSullaCarta event={ev({ kind: 'hit', amount: 28 })} frameKey={1} box={box} />)
    const el = screen.getByTestId('colpo')
    const top = parseFloat(el.style.top)
    expect(top).toBeGreaterThan(box.y)
    expect(top).toBeLessThan(box.y + box.h)
  })

  it('mostra il danno', () => {
    render(<ColpoSullaCarta event={ev({ kind: 'hit', amount: 28 })} frameKey={1} box={box} />)
    expect(screen.getByTestId('colpo-numero')).toHaveTextContent('28')
  })

  it('il critico è più grande e dorato', () => {
    render(<ColpoSullaCarta event={ev({ kind: 'crit', amount: 74 })} frameKey={1} box={box} />)
    expect(screen.getByTestId('colpo-numero')).toHaveAttribute('data-taglia', 'crit')
  })

  it('la cura ha il +', () => {
    render(<ColpoSullaCarta event={ev({ kind: 'heal', amount: 34 })} frameKey={1} box={box} />)
    expect(screen.getByTestId('colpo-numero')).toHaveTextContent('+34')
  })

  it('assorbito: numero barrato', () => {
    render(<ColpoSullaCarta event={ev({ kind: 'block', amount: 31 })} frameKey={1} box={box} />)
    expect(screen.getByTestId('colpo-numero')).toHaveAttribute('data-assorbito', 'true')
  })

  it('schivata e turno saltato: parola, nessun numero', () => {
    const { rerender } = render(<ColpoSullaCarta event={ev({ kind: 'dodge', word: 'SCHIVA' })} frameKey={1} box={box} />)
    expect(screen.queryByTestId('colpo-numero')).toBeNull()
    rerender(<ColpoSullaCarta event={ev({ kind: 'skip', word: 'SALTA' })} frameKey={2} box={box} />)
    expect(screen.queryByTestId('colpo-numero')).toBeNull()
    expect(screen.getByTestId('colpo')).toHaveTextContent('SALTA')
  })

  it('su una carta di bordo il numero resta dentro la cornice', () => {
    // Misurato sul mockup: senza vincolo il K.O. usciva a sinistra.
    render(<ColpoSullaCarta event={ev({ kind: 'kill', word: 'K.O.' })} frameKey={1}
      box={{ x: 0, y: 510, w: 212, h: 254 }} />)
    expect(parseFloat(screen.getByTestId('colpo').style.left)).toBeGreaterThanOrEqual(80)
  })

  it('senza box non rende nulla', () => {
    const { container } = render(<ColpoSullaCarta event={ev({ kind: 'hit', amount: 5 })} frameKey={1} box={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/battle/ColpoSullaCarta.test.tsx` — Expected: FAIL.

- [ ] **Step 3: Write the implementation**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/battle/ColpoSullaCarta.test.tsx` — Expected: PASS, 8 test.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck 2>&1 | grep -v '.next/dev'
git add components/battle/ColpoSullaCarta.tsx tests/battle/ColpoSullaCarta.test.tsx
git commit -m "feat(battaglia): il colpo nasce al centro della carta colpita"
```

---

## Task 5: La scena, composta

**Files:**
- Modify: `components/battle/BattleArena.tsx`
- Modify: `components/battle/PixiArena.tsx`
- Test: aggiornare `tests/ui/battle.test.tsx` e i test del palco

**Interfaces:** consuma `CartaCombat` (2), `NastroSigilli` (3), `ColpoSullaCarta` (4), e la logica già presente in `BattleArena` per attore/bersaglio/salto/scena.

**La firma pubblica di `BattleArena` non cambia.**

**Cosa cambia:** dieci `CartaCombat` in due file (misure nei vincoli globali), il nastro al centro, il colpo ancorato al riquadro della carta colpita.

**I VFX si collegano, non si riscrivono.** `lib/vfx/` ha già `PixiStage`, `choreograph`, `spellVfx` e 919 righe di `effects.ts` (proiettili, esplosioni, fiamme, ghiaccio, barriere, Avada). `PixiArena.resolveUnitEl` oggi preferisce `[data-testid="duellante"]`: va aggiornato a `[data-testid="carta-combat"]`, **mantenendo il ripiego** sul selettore generico. Cercare ogni sito che interroga `data-unit-key`.

- [ ] **Step 1: Scrivere i test della scena**

```tsx
// in tests/ui/battle.test.tsx
it('la scena mostra tutte e dieci le carte, mai solo due', () => {
  // 2026-09-16: il teatro (due duellanti + quattro miniature) è stato respinto
  // dall'utente: con cinque per lato si perde il campo. Ora tutte le carte
  // restano complete e della stessa taglia.
  renderBattleScreen()
  expect(screen.getAllByTestId('carta-combat').length).toBeGreaterThanOrEqual(6)
  expect(screen.queryAllByTestId('duellante')).toHaveLength(0)
})

it('il nastro dei sigilli è al centro della scena', () => {
  renderBattleScreen()
  expect(screen.getAllByTestId('sigillo').length).toBeGreaterThanOrEqual(4)
})
```

- [ ] **Step 2: Run per verificare che falliscano**

- [ ] **Step 3: Comporre la scena e agganciare i VFX**

- [ ] **Step 4: Riscrivere i test del vecchio palco**

Cercare quelli che asseriscono su `duellante`/`miniatura` e riscriverli sulla nuova scena **con un commento** che dice perché è cambiata. Non cancellarli.

- [ ] **Step 5: Run + suite**

```bash
npx vitest run tests/ui tests/battle
```

- [ ] **Step 6: Typecheck + commit**

---

## Task 6: L'altezza, la vetrata, e la prova che si vede tutto

**Files:**
- Modify: `components/screens/BattleScreen.tsx`
- Test: `tests/ui/battle.test.tsx`

Ripartire l'altezza: barra 32 · carte 254 · nastro 180 · carte 254 · margini ≈ 48. Applicare il fondo della vetrata e togliere il registro dal combattimento (resta il resoconto di fine scontro).

- [ ] **Step 1: Misurare il prima**

- [ ] **Step 2: Ridistribuire e applicare la vetrata**

- [ ] **Step 3: Verificare a schermo — non sostituibile dai test**

Playwright è installato, `npm run dev` serve su :3000. Su **almeno tre squadre**, oltre il **turno 10**:
- ogni `[data-unit-key]` ha `top >= 0` **e** `bottom <= 768`;
- il nastro è intero;
- **guardare gli screenshot**: in questo progetto una verifica passò ogni misura mentre un ritratto non veniva disegnato, e un'altra volta una fila era tagliata mentre `scrollHeight` diceva 768.

- [ ] **Step 4: Misurare gli FPS**

Con gli effetti in corso, **sopra i 45 fps**. Sotto è un difetto, non un dettaglio: è il vincolo che l'utente ha posto scegliendo Pixi.

- [ ] **Step 5: Suite completa + typecheck + commit**

```bash
npx vitest run && npm run typecheck 2>&1 | grep -v '.next/dev'
```

---

## Self-Review

**Copertura dello spec:**

| Requisito | Task |
|---|---|
| Dieci carte complete, sempre | 2, 5 |
| Ordine dei turni con gli attacchi futuri | 3 |
| Registro fuori dal combattimento | 6 |
| Colpo al centro della carta colpita | 4 |
| Stati sommati, aura per intensità | 1, 2 |
| Vetrata, sigilli, zero bagliori | 2, 3, 6 |
| VFX Pixi collegati, nessuna dipendenza nuova | 5 |
| 1366×768 senza tagli, sopra 45 fps | 6 |

**Scan placeholder:** nessun TBD. I Task 5 e 6 descrivono la composizione a parole perché la fonte visiva è il mockup: ricopiarlo qui creerebbe una seconda verità che divergerebbe — l'errore che ha già fatto fallire un piano in questo progetto.

**Coerenza dei tipi:** `Pillola`/`pilloleDi`/`auraDi` (1) → consumati in 2. `CartaCombat` (2), `NastroSigilli` (3), `ColpoSullaCarta` (4) → composti in 5. `SceneEvent` esiste già in `lib/battleScene.ts`.

**Rischio noto:** `data-unit-key` esiste su ogni carta e i VFX ci si ancorano. Con dieci carte la selezione deve restare univoca; il Task 5 lo affronta, il 6 lo verifica guardando.

**Fuori scope:** motore, dati, bilanciamento, `WizardCard`, e `lib/vfx/` che si usa e non si riscrive.
