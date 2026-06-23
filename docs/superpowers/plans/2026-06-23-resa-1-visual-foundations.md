# Resa — Piano 1: Fondamenta visive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire le primitive visive "Notturno di Hogwarts" — token palette, sistema rarità con escalation, stemmi delle case (SVG), ritratto-bust con fallback — e montarle nella `WizardCard`.

**Architecture:** Una funzione pura `rarityStyle(tier)` è l'unica sorgente del trattamento per rarità; componenti presentazionali (`RarityFrame`, `HouseCrest`, `PortraitImage`) la consumano. Nessuna logica di gioco: solo presentazione, derivata dai dati esistenti (`Tier`, `House`, `Wizard.id`). I ritratti vivono in `public/portraits/<id>.webp`; se mancano, fallback silhouette → l'arte non blocca nulla.

**Tech Stack:** Next.js (questa fork), React 19, TypeScript strict, Tailwind v4 (`@theme`), framer-motion, lucide-react, Vitest + React Testing Library.

## Global Constraints

- **Prima di scrivere codice Next**, leggere la guida pertinente in `node_modules/next/dist/docs/` (regola di `AGENTS.md`). In particolare per `next/image` / asset statici.
- **TypeScript strict**: nessun `any`, nessun import inutilizzato. `tsc --noEmit` deve restare pulito.
- **Mobile-first**: ogni componente deve reggere a 320px di larghezza.
- **Determinismo invariato**: nessuna modifica al motore/engine in questo piano.
- **Suite verde**: `npm test` (335 test) non deve regredire; aggiornare gli snapshot/test esistenti toccati.
- **Import alias**: usare `@/...` (mai percorsi relativi lunghi).
- **Palette Notturno** (valori esatti): inchiostro `#0a0813` / `#0c0a16`; blu notte `#161d33` / `#1b2440`; oro `#b08d57` / `#caa24a` / `#f3e6a0`; viola `#7c3aed` / `#a855f7`.
- **Etichette rarità** (da `Tier`, già in `lib/theme.ts`): 1→Leggendario, 2→Epico, 3→Raro, 4→Comune.
- **Colori rarità** (già in `lib/theme.ts` `tierColor`): 1 `#ffd34d`, 2 `#b06bff`, 3 `#4da6ff`, 4 `#9aa3ad` — riusarli, non duplicarli.

---

### Task 1: `rarityStyle(tier)` — motore del trattamento rarità

**Files:**
- Create: `lib/rarity.ts`
- Test: `tests/lib/rarity.test.ts`

**Interfaces:**
- Consumes: `Tier` da `@/types`; `tierLabel`, `tierColor` da `@/lib/theme`.
- Produces:
  ```ts
  export interface RarityStyle {
    tier: Tier
    label: string          // Leggendario | Epico | Raro | Comune
    color: string          // accento rarità (#ffd34d ...)
    borderColor: string    // colore bordo cornice
    glow: number           // intensità aura 0..1 (0 comune → 1 leggendario)
    hasGem: boolean
    hasCrown: boolean      // solo leggendario
    animated: boolean      // shimmer/pulse solo leggendario
    bgGradient: string     // sfondo card della rarità
  }
  export function rarityStyle(tier: Tier): RarityStyle
  ```

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/rarity.test.ts
import { describe, it, expect } from 'vitest'
import { rarityStyle } from '@/lib/rarity'

describe('rarityStyle', () => {
  it('labels and colors derive from tier', () => {
    expect(rarityStyle(1).label).toBe('Leggendario')
    expect(rarityStyle(4).label).toBe('Comune')
    expect(rarityStyle(1).color).toBe('#ffd34d')
  })
  it('escalates glow with rarity (comune lowest, leggendario highest)', () => {
    expect(rarityStyle(4).glow).toBeLessThan(rarityStyle(2).glow)
    expect(rarityStyle(2).glow).toBeLessThan(rarityStyle(1).glow)
    expect(rarityStyle(4).glow).toBe(0)
    expect(rarityStyle(1).glow).toBe(1)
  })
  it('only leggendario gets crown + animation; raro+ get a gem', () => {
    expect(rarityStyle(1).hasCrown).toBe(true)
    expect(rarityStyle(2).hasCrown).toBe(false)
    expect(rarityStyle(1).animated).toBe(true)
    expect(rarityStyle(2).animated).toBe(false)
    expect(rarityStyle(3).hasGem).toBe(true)
    expect(rarityStyle(4).hasGem).toBe(false)
  })
  it('every tier yields a non-empty bgGradient', () => {
    for (const t of [1, 2, 3, 4] as const) {
      expect(rarityStyle(t).bgGradient).toMatch(/gradient/)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/rarity.test.ts`
Expected: FAIL — `Cannot find module '@/lib/rarity'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/rarity.ts
import type { Tier } from '@/types'
import { tierLabel, tierColor } from '@/lib/theme'

export interface RarityStyle {
  tier: Tier
  label: string
  color: string
  borderColor: string
  glow: number
  hasGem: boolean
  hasCrown: boolean
  animated: boolean
  bgGradient: string
}

const GLOW: Record<Tier, number> = { 4: 0, 3: 0.4, 2: 0.7, 1: 1 }

const BG: Record<Tier, string> = {
  4: 'linear-gradient(160deg, #15131d 0%, #0e0c16 100%)',
  3: 'radial-gradient(120% 70% at 50% -10%, #16223a 0%, #0c0f1c 80%)',
  2: 'radial-gradient(120% 70% at 50% -10%, #241640 0%, #0e0a1c 80%)',
  1: 'radial-gradient(120% 75% at 50% -10%, #2a2212 0%, #100b06 78%)',
}

export function rarityStyle(tier: Tier): RarityStyle {
  const color = tierColor(tier)
  return {
    tier,
    label: tierLabel(tier),
    color,
    borderColor: tier === 1 ? '#caa24a' : color,
    glow: GLOW[tier],
    hasGem: tier <= 3,
    hasCrown: tier === 1,
    animated: tier === 1,
    bgGradient: BG[tier],
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/rarity.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/rarity.ts tests/lib/rarity.test.ts
git commit -m "feat(resa): rarityStyle — per-tier visual treatment engine"
```

---

### Task 2: Token Notturno + costanti accento

**Files:**
- Modify: `app/globals.css` (`:root`, `@theme inline`, body background)
- Create: `lib/notturno.ts`
- Test: `tests/lib/notturno.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const NOTTURNO = {
    ink: '#0a0813', inkSoft: '#0c0a16',
    night: '#161d33', nightSoft: '#1b2440',
    gold: '#b08d57', goldBright: '#caa24a', goldPale: '#f3e6a0',
    violet: '#7c3aed', violetBright: '#a855f7',
  } as const
  ```

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/notturno.test.ts
import { describe, it, expect } from 'vitest'
import { NOTTURNO } from '@/lib/notturno'

describe('NOTTURNO palette', () => {
  it('exposes the agreed Notturno values', () => {
    expect(NOTTURNO.ink).toBe('#0a0813')
    expect(NOTTURNO.gold).toBe('#b08d57')
    expect(NOTTURNO.violet).toBe('#7c3aed')
  })
  it('every value is a hex color', () => {
    for (const v of Object.values(NOTTURNO)) expect(v).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/notturno.test.ts`
Expected: FAIL — `Cannot find module '@/lib/notturno'`.

- [ ] **Step 3: Write the constants module**

```ts
// lib/notturno.ts
export const NOTTURNO = {
  ink: '#0a0813', inkSoft: '#0c0a16',
  night: '#161d33', nightSoft: '#1b2440',
  gold: '#b08d57', goldBright: '#caa24a', goldPale: '#f3e6a0',
  violet: '#7c3aed', violetBright: '#a855f7',
} as const

export type NotturnoColor = keyof typeof NOTTURNO
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/notturno.test.ts`
Expected: PASS.

- [ ] **Step 5: Apply Notturno tokens to globals.css**

In `app/globals.css`, extend `:root` (keep the existing house tokens) by adding after line 14 (`--house-tassorosso-glow`):

```css
  --ink: #0a0813;
  --ink-soft: #0c0a16;
  --gold: #b08d57;
  --gold-bright: #caa24a;
  --gold-pale: #f3e6a0;
  --violet: #7c3aed;
```

Change `--background` to `#0a0813` and `--panel` to `#11101d`. In `@theme inline`, add after `--color-panel` line:

```css
  --color-gold: var(--gold);
  --color-violet: var(--violet);
```

Replace the `html, body` background block with the Notturno arena gradient:

```css
html, body {
  background:
    radial-gradient(140% 90% at 50% -10%, #161d33 0%, transparent 65%),
    var(--background);
  color: var(--foreground);
  min-height: 100%;
}
```

Add a reusable shimmer keyframe + reduced-motion guard at the end of the file:

```css
@keyframes resaShimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
@keyframes resaPulse { 0%,100% { opacity: .85 } 50% { opacity: 1 } }
@media (prefers-reduced-motion: reduce) {
  .resa-animated { animation: none !important; }
}
```

- [ ] **Step 6: Verify build + suite still green**

Run: `npm run typecheck && npx vitest run tests/lib/notturno.test.ts`
Expected: typecheck clean; PASS. (CSS is build-verified — no runtime test.)

- [ ] **Step 7: Commit**

```bash
git add lib/notturno.ts tests/lib/notturno.test.ts app/globals.css
git commit -m "feat(resa): Notturno palette tokens + arena background + shimmer keyframes"
```

---

### Task 3: `HouseCrest` — stemmi delle case in SVG

**Files:**
- Create: `components/ui/HouseCrest.tsx`
- Test: `tests/ui/houseCrest.test.tsx`

**Interfaces:**
- Consumes: `House` da `@/types`.
- Produces: `export function HouseCrest({ house, size }: { house: House; size?: number }): JSX.Element` — un `<svg>` con `role="img"`, `aria-label={house}`, `data-house={house}`, una sagoma stilizzata e i colori della casa.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ui/houseCrest.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HouseCrest } from '@/components/ui/HouseCrest'

describe('HouseCrest', () => {
  it('renders an accessible crest per house', () => {
    render(<HouseCrest house="Grifondoro" />)
    const el = screen.getByRole('img', { name: 'Grifondoro' })
    expect(el).toHaveAttribute('data-house', 'Grifondoro')
  })
  it('supports all four houses', () => {
    for (const h of ['Grifondoro', 'Serpeverde', 'Corvonero', 'Tassorosso'] as const) {
      const { unmount } = render(<HouseCrest house={h} />)
      expect(screen.getByRole('img', { name: h })).toBeInTheDocument()
      unmount()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/houseCrest.test.tsx`
Expected: FAIL — `Cannot find module '@/components/ui/HouseCrest'`.

- [ ] **Step 3: Write the component**

```tsx
// components/ui/HouseCrest.tsx
import type { House } from '@/types'

const CREST: Record<House, { ring: string; fill: string; glyph: string }> = {
  Grifondoro: { ring: '#ae0001', fill: '#ffc500', glyph: 'M12 3l2.2 4.6L19 8l-3.5 3.4.9 4.9L12 14l-4.4 2.3.9-4.9L5 8l4.8-.4z' },
  Serpeverde: { ring: '#1a472a', fill: '#9fd6a8', glyph: 'M7 5c5 0 5 4 0 4s-5 4 0 4 6 3 6 3M9 5.2h.01' },
  Corvonero: { ring: '#222f5b', fill: '#7db7ff', glyph: 'M12 4l5 5-5 11-5-11z' },
  Tassorosso: { ring: '#ecb939', fill: '#372e29', glyph: 'M6 10c0-3 2.7-5 6-5s6 2 6 5-2.7 6-6 9c-3.3-3-6-6-6-9z' },
}

export function HouseCrest({ house, size = 18 }: { house: House; size?: number }) {
  const c = CREST[house]
  return (
    <svg
      role="img"
      aria-label={house}
      data-house={house}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ filter: `drop-shadow(0 0 4px ${c.ring}88)` }}
    >
      <circle cx="12" cy="12" r="11" fill={c.ring} opacity="0.22" stroke={c.ring} strokeWidth="1.2" />
      <path d={c.glyph} fill={c.fill} stroke={c.fill} strokeWidth="0.6" strokeLinejoin="round" fillRule="evenodd" />
    </svg>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/houseCrest.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/ui/HouseCrest.tsx tests/ui/houseCrest.test.tsx
git commit -m "feat(resa): HouseCrest — SVG house emblems"
```

---

### Task 4: `RarityFrame` — cornice/aura/gemma/corona

**Files:**
- Create: `components/ui/RarityFrame.tsx`
- Test: `tests/ui/rarityFrame.test.tsx`

**Interfaces:**
- Consumes: `rarityStyle`, `RarityStyle` da `@/lib/rarity`; `Tier` da `@/types`; `cn` da `@/lib/cn`.
- Produces: `export function RarityFrame({ tier, className, children }: { tier: Tier; className?: string; children: React.ReactNode }): JSX.Element` — un wrapper con `data-rarity={label}`, bordo/sfondo della rarità, gemma se `hasGem`, corona se `hasCrown`, classe `resa-animated` se `animated`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ui/rarityFrame.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RarityFrame } from '@/components/ui/RarityFrame'

describe('RarityFrame', () => {
  it('marks rarity and shows crown only for leggendario', () => {
    const { container, rerender } = render(<RarityFrame tier={1}>x</RarityFrame>)
    expect(container.querySelector('[data-rarity="Leggendario"]')).toBeTruthy()
    expect(container.querySelector('[data-crown]')).toBeTruthy()
    rerender(<RarityFrame tier={3}>x</RarityFrame>)
    expect(container.querySelector('[data-crown]')).toBeFalsy()
    expect(container.querySelector('[data-gem]')).toBeTruthy()
  })
  it('comune has neither gem nor crown', () => {
    const { container } = render(<RarityFrame tier={4}>x</RarityFrame>)
    expect(container.querySelector('[data-gem]')).toBeFalsy()
    expect(container.querySelector('[data-crown]')).toBeFalsy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/rarityFrame.test.tsx`
Expected: FAIL — `Cannot find module '@/components/ui/RarityFrame'`.

- [ ] **Step 3: Write the component**

```tsx
// components/ui/RarityFrame.tsx
import type { Tier } from '@/types'
import { rarityStyle } from '@/lib/rarity'
import { cn } from '@/lib/cn'

export function RarityFrame({
  tier, className, children,
}: { tier: Tier; className?: string; children: React.ReactNode }) {
  const r = rarityStyle(tier)
  return (
    <div
      data-rarity={r.label}
      className={cn('relative rounded-2xl overflow-hidden', className)}
      style={{
        background: r.bgGradient,
        border: `${tier === 1 ? 2 : 1}px solid ${r.borderColor}`,
        boxShadow: r.glow > 0 ? `0 0 ${10 + r.glow * 26}px ${r.color}${Math.round(r.glow * 90).toString(16).padStart(2, '0')}` : '0 8px 30px rgba(0,0,0,0.5)',
      }}
    >
      {r.hasCrown && (
        <span data-crown className={cn('absolute top-2 left-3 z-10 text-sm', r.animated && 'resa-animated')}
          style={{ filter: 'drop-shadow(0 0 6px #f3e6a0cc)' }}>👑</span>
      )}
      {r.hasGem && (
        <span data-gem className="absolute top-3 right-3 z-10 block h-3 w-3 rotate-45 rounded-[3px]"
          style={{ background: r.color, boxShadow: `0 0 10px ${r.color}` }} />
      )}
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/rarityFrame.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/ui/RarityFrame.tsx tests/ui/rarityFrame.test.tsx
git commit -m "feat(resa): RarityFrame — escalating border/glow/gem/crown"
```

---

### Task 5: `PortraitImage` — ritratto con fallback silhouette

**Files:**
- Create: `components/ui/PortraitImage.tsx`
- Create: `public/portraits/.gitkeep`
- Create: `public/portraits/README.md`
- Test: `tests/ui/portraitImage.test.tsx`

**Interfaces:**
- Consumes: `House` da `@/types`; `houseTheme` da `@/lib/theme`.
- Produces: `export function PortraitImage({ id, house, alt, variant }: { id: string; house: House; alt: string; variant?: 'card' | 'bust' }): JSX.Element`. Renderizza un `<img>` con `src={`/portraits/${id}.webp`}`, `alt={alt}`, `data-variant`. `onError` sostituisce con una silhouette (`data-fallback`) colorata con il tema della casa.

**Note:** è un client component (`'use client'`) perché usa `useState`/`onError`. Prima di scriverlo, consultare `node_modules/next/dist/docs/` su asset statici da `public/` (gli asset in `public/portraits/x.webp` si servono come `/portraits/x.webp`). Si usa un `<img>` nativo (non `next/image`) per gestire il fallback `onError` in modo semplice e deterministico nei test jsdom.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ui/portraitImage.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PortraitImage } from '@/components/ui/PortraitImage'

describe('PortraitImage', () => {
  it('renders the portrait by id', () => {
    render(<PortraitImage id="harry" house="Grifondoro" alt="Harry" />)
    const img = screen.getByAltText('Harry') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/portraits/harry.webp')
  })
  it('falls back to a house silhouette when the image errors', () => {
    const { container } = render(<PortraitImage id="missing" house="Serpeverde" alt="Ignoto" />)
    fireEvent.error(screen.getByAltText('Ignoto'))
    expect(container.querySelector('[data-fallback="Serpeverde"]')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/portraitImage.test.tsx`
Expected: FAIL — `Cannot find module '@/components/ui/PortraitImage'`.

- [ ] **Step 3: Write the component + portraits dir**

```tsx
// components/ui/PortraitImage.tsx
'use client'
import { useState } from 'react'
import type { House } from '@/types'
import { houseTheme } from '@/lib/theme'

export function PortraitImage({
  id, house, alt, variant = 'card',
}: { id: string; house: House; alt: string; variant?: 'card' | 'bust' }) {
  const [failed, setFailed] = useState(false)
  const theme = houseTheme(house)
  const fit = variant === 'bust' ? 'object-[50%_14%]' : 'object-[50%_18%]'

  if (failed) {
    return (
      <div
        data-fallback={house}
        aria-label={alt}
        className="h-full w-full"
        style={{ background: `radial-gradient(ellipse at 50% 25%, ${theme.color} 0%, #0c0a16 70%)` }}
      >
        <svg viewBox="0 0 24 24" className="h-full w-full opacity-40">
          <circle cx="12" cy="8" r="4" fill={theme.glow} />
          <path d="M4 22c0-5 4-8 8-8s8 3 8 8z" fill={theme.glow} />
        </svg>
      </div>
    )
  }
  return (
    <img
      src={`/portraits/${id}.webp`}
      alt={alt}
      data-variant={variant}
      onError={() => setFailed(true)}
      className={`h-full w-full object-cover ${fit}`}
    />
  )
}
```

```text
# public/portraits/.gitkeep  (empty file)
```

```markdown
<!-- public/portraits/README.md -->
# Ritratti dei maghi

Un file per mago: `<wizard.id>.webp` (es. `harry.webp`).
Stile: ritratto-bust semi-pittorico "Notturno" (mantello della casa, bacchetta,
sfondo gotico/candele), arte ORIGINALE, niente somiglianze di persone reali.
Generati col generatore immagini, aspect 3:4/4:5, esportati in webp.
Se un file manca, l'UI mostra una silhouette di fallback — l'arte non blocca nulla.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/portraitImage.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/ui/PortraitImage.tsx public/portraits/.gitkeep public/portraits/README.md tests/ui/portraitImage.test.tsx
git commit -m "feat(resa): PortraitImage — portrait with house silhouette fallback"
```

---

### Task 6: Montare le primitive nella `WizardCard`

**Files:**
- Modify: `components/cards/WizardCard.tsx`
- Test: `tests/ui/wizardCard.test.tsx` (esistente — estendere)

**Interfaces:**
- Consumes: `RarityFrame` (Task 4), `PortraitImage` (Task 5), `HouseCrest` (Task 3).
- Produces: nessuna nuova esportazione; la `WizardCard` ora avvolge il contenuto in `RarityFrame`, mostra il ritratto in alto e lo stemma accanto alla casa. `CARD_STAT_MAX` invariato.

**Note:** Leggere prima `tests/ui/wizardCard.test.tsx` per non rompere le asserzioni esistenti; la `WizardCard` mantiene `wizard.name`, le `StatBar` e il blocco magia. Rimuove il bordo/sfondo proprio del `motion.div` (ora forniti da `RarityFrame`) e sostituisce il solo `TierBadge` testuale con la cornice di rarità (il `TierBadge` resta come etichetta dentro la cornice).

- [ ] **Step 1: Add the failing assertions to the existing test**

Append to `tests/ui/wizardCard.test.tsx` a new test (keep existing ones). Use the same `drafted` fixture the file already builds; if it uses a helper, reuse it. Example shape:

```tsx
// add inside the existing describe('WizardCard', ...) block
it('shows the portrait and the house crest', () => {
  render(<WizardCard drafted={drafted} />)
  // portrait alt = wizard name
  expect(screen.getByAltText(drafted.wizard.name)).toBeInTheDocument()
  // house crest present
  expect(screen.getByRole('img', { name: drafted.wizard.house })).toBeInTheDocument()
})
it('wraps content in a rarity frame keyed to the wizard tier', () => {
  const { container } = render(<WizardCard drafted={drafted} />)
  expect(container.querySelector(`[data-rarity]`)).toBeTruthy()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/wizardCard.test.tsx`
Expected: FAIL — no element with `alt = name` / no `[data-rarity]`.

- [ ] **Step 3: Rewrite WizardCard to use the primitives**

```tsx
// components/cards/WizardCard.tsx
'use client'
import { motion } from 'framer-motion'
import type { DraftedWizard } from '@/types'
import { cn } from '@/lib/theme'
import { TierBadge } from './TierBadge'
import { RoleIcon } from './RoleIcon'
import { StatBar } from '@/components/ui/StatBar'
import { Chip } from '@/components/ui/Chip'
import { RarityFrame } from '@/components/ui/RarityFrame'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { HouseCrest } from '@/components/ui/HouseCrest'
import { spellTypeChip, spellEffectChips } from '@/lib/glossary'

export const CARD_STAT_MAX = { hp: 150, atk: 120, def: 120, spd: 120 } as const

export function WizardCard({
  drafted, selected, onClick, className,
}: {
  drafted: DraftedWizard
  selected?: boolean
  onClick?: () => void
  className?: string
}) {
  const { wizard, stats, spell } = drafted
  const clickable = Boolean(onClick)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={clickable ? { y: -8, scale: 1.03 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() } : undefined}
      className={cn('w-60 select-none text-white', clickable && 'cursor-pointer', className)}
    >
      <RarityFrame tier={wizard.tier} className={cn(selected && 'ring-2 ring-white/80')}>
        <div className="relative h-40 overflow-hidden">
          <PortraitImage id={wizard.id} house={wizard.house} alt={wizard.name} variant="card" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 55%, rgba(12,10,22,0.92))' }} />
          <div className="absolute right-3 top-3"><TierBadge tier={wizard.tier} /></div>
        </div>

        <div className="p-4 pt-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-lg leading-tight">{wizard.name}</h3>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/70">
                <HouseCrest house={wizard.house} size={14} />{wizard.house}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-white/80">
              <RoleIcon role={wizard.role} /><span>{wizard.role}</span>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <StatBar label="HP" value={stats.hp} max={CARD_STAT_MAX.hp} color="#7CFC9B" />
            <StatBar label="ATK" value={stats.atk} max={CARD_STAT_MAX.atk} color="#FF8A7A" />
            <StatBar label="DEF" value={stats.def} max={CARD_STAT_MAX.def} color="#7DB7FF" />
            <StatBar label="VEL" value={stats.spd} max={CARD_STAT_MAX.spd} color="#FFD37D" />
          </div>

          <div className="mt-3 rounded-xl bg-black/30 px-3 py-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{spell.name}</p>
              {(() => { const c = spellTypeChip(spell.type); return <Chip label={c.label} color={c.color} icon={c.icon} /> })()}
            </div>
            <p className="text-xs text-white/70 leading-snug">{spell.desc}</p>
            {(() => {
              const chips = spellEffectChips(spell)
              return chips.length ? (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {chips.map((c) => <Chip key={c.label} label={c.label} color={c.color} icon={c.icon} />)}
                </div>
              ) : null
            })()}
          </div>
        </div>
      </RarityFrame>
    </motion.div>
  )
}
```

- [ ] **Step 4: Run the full UI suite + typecheck**

Run: `npx vitest run tests/ui/wizardCard.test.tsx && npm run typecheck`
Expected: PASS; typecheck clean. If other tests snapshot `WizardCard` markup, update them: `npx vitest run -u tests/ui` then re-run.

- [ ] **Step 5: Run the whole suite to confirm no regression**

Run: `npm test`
Expected: all green (≥ prior 335 + new tests).

- [ ] **Step 6: Commit**

```bash
git add components/cards/WizardCard.tsx tests/ui/wizardCard.test.tsx
git commit -m "feat(resa): WizardCard uses RarityFrame + portrait + house crest"
```

---

## Self-Review

**Spec coverage (Piano 1 scope = spec §3, §4, §5):**
- §3 Identità Notturno (token, sfondo, shimmer) → Task 2. ✓
- §4 Rarità con escalation (cornice/aura/gemma/corona, da tier) → Task 1 (motore) + Task 4 (frame). ✓
- §5 Ritratto formato A + fallback + stemmi SVG → Task 5 (ritratto) + Task 3 (crest) + Task 6 (montaggio su card). ✓
- §5 pipeline `public/portraits/<id>.webp` + non-blocking → Task 5 (dir + README + fallback). ✓
- (§6 draft, §7 battaglia, §8 gameplay → Piani 2/3/4, fuori da questo piano.)

**Placeholder scan:** nessun TODO/TBD; ogni step ha codice o comando reale. ✓

**Type consistency:** `rarityStyle`/`RarityStyle` (Task 1) usati identici in Task 4; `PortraitImage` props (`id, house, alt, variant`) usate identiche in Task 6; `HouseCrest` props (`house, size`) usate in Task 6; `tierColor`/`tierLabel` riusati, non ridefiniti. ✓

**Note di esecuzione:** Task 6 può richiedere `-u` per snapshot esistenti che catturano il markup della `WizardCard` (es. eventuali screens.test). Verificare con `npm test` allo Step 5.
