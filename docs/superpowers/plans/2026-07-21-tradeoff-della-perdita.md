# Tradeoff della Perdita — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al nodo recruit a squadra piena, mostrare live (senza dialog) quali Duo/Trio la sostituzione SPEGNE, con la perdita che domina visivamente il guadagno.

**Architecture:** Due helper puri di diff nel motore (`previewDuoLoss` in duos.ts, `trioGateLoss` in trios.ts) che specchiano `previewDuos`, consumati da una prop opzionale `prevTeam` in `DuoTracker`, passata da `RecruitScreen` solo quando la squadra è piena. Zero cambiamenti a RunState, resolver, o motore di combat. Pura leggibilità UI.

**Tech Stack:** TypeScript, React, framer-motion, Vitest + @testing-library/react. Path alias `@/` → root repo.

## Global Constraints

- `npm run test` (vitest) **NON esegue typecheck** — ogni task che tocca TS deve chiudere con `npm run typecheck` (`tsc --noEmit`) verde, oltre ai test.
- Gli helper del motore sono **puri**: no RNG, no side-effect. Usano `livingOf` come `previewDuos` (un morto non deve gonfiare il diff).
- Retrocompatibilità: `DuoTracker` senza `prevTeam` (starter draft) deve comportarsi **esattamente** come oggi.
- Linguaggio cromatico esistente in DuoTracker: verde `#3ecb6a` = attiva/avanza, oro `#d9b65f` = attiva. Aggiungere rosso perdita `#f07272` (già usato nella replace-list di RecruitScreen).
- Nessun ritocco di bilanciamento; NON ri-misurare `campaignBalanceB`/`campaignBalanceRestricted`.
- Test factory pattern esistente (copiare verbatim): engine `const dw = (id, role, tags=[]) => ({ wizard:{id,role,house:'Grifondoro',tags}, level:1 } as unknown as DraftedWizard)`; UI `const mage = (id, role, tags=[]) => ({ wizard:{id,name:id,house:'Grifondoro',role,tags}, level:1, stats:{}, maxHp:100 }) as any`.

---

### Task 1: `previewDuoLoss` — diff delle perdite Duo (motore)

**Files:**
- Modify: `game/engine/duos.ts` (aggiungere in fondo, dopo `previewDuos` a riga 109)
- Test: `tests/engine/duoLoss.test.ts` (create)

**Interfaces:**
- Consumes: `duoProgress(team, relics): DuoProgress[]`, `livingOf(team)`, tipi `Duo`, `DraftedWizard`, `ActiveRelic` (già in duos.ts).
- Produces: `type DuoLoss = { breaks: Duo[]; regresses: Duo[] }` e `previewDuoLoss(current: DraftedWizard[], next: DraftedWizard[], relics: ActiveRelic[]): DuoLoss`. Semantica: `breaks` = Duo attivo in `current` e inattivo in `next`; `regresses` = Duo a one-away in `current` e two-away+ in `next`.

- [ ] **Step 1: Scrivere il test che fallisce**

Create `tests/engine/duoLoss.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { previewDuoLoss } from '@/game/engine/duos'
import type { DraftedWizard } from '@/types'

const dw = (id: string, role: string, tags: string[] = []): DraftedWizard =>
  ({ wizard: { id, role, house: 'Grifondoro', tags }, level: 1 } as unknown as DraftedWizard)

describe('previewDuoLoss', () => {
  it('segnala BREAKS quando lo swap spegne un Duo attivo (Cancrena)', () => {
    // current: 2 maghi veleno+esecuzione → Cancrena attivo. next: uno rimpiazzato da un mago inerte.
    const current = [dw('a', 'Attaccante', ['veleno', 'esecuzione']), dw('b', 'Tank', ['veleno', 'esecuzione'])]
    const next = [dw('a', 'Attaccante', ['veleno', 'esecuzione']), dw('c', 'Controllo')]
    const loss = previewDuoLoss(current, next, [])
    expect(loss.breaks.map(d => d.id)).toContain('cancrena')
  })

  it('segnala REGRESSES quando un Duo one-away torna two-away', () => {
    // current one-away Cancrena: 2 veleno (segnale veleno acceso), esecuzione mancante.
    // next: tolgo un veleno → segnale veleno si spegne → Cancrena torna a 2 segnali mancanti.
    const current = [dw('a', 'Attaccante', ['veleno']), dw('b', 'Tank', ['veleno'])]
    const next = [dw('a', 'Attaccante', ['veleno']), dw('c', 'Controllo')]
    const loss = previewDuoLoss(current, next, [])
    expect(loss.regresses.map(d => d.id)).toContain('cancrena')
    expect(loss.breaks).toHaveLength(0)
  })

  it('nessuna perdita rimuovendo un mago irrilevante', () => {
    const current = [dw('a', 'Attaccante', ['veleno', 'esecuzione']), dw('b', 'Tank', ['veleno', 'esecuzione']), dw('x', 'Controllo')]
    const next = [dw('a', 'Attaccante', ['veleno', 'esecuzione']), dw('b', 'Tank', ['veleno', 'esecuzione'])]
    const loss = previewDuoLoss(current, next, [])
    expect(loss.breaks).toHaveLength(0)
    expect(loss.regresses).toHaveLength(0)
  })

  it('rimuovere e ri-aggiungere lo stesso mago = nessuna perdita netta', () => {
    const current = [dw('a', 'Attaccante', ['veleno', 'esecuzione']), dw('b', 'Tank', ['veleno', 'esecuzione'])]
    const next = [dw('a', 'Attaccante', ['veleno', 'esecuzione']), dw('b', 'Tank', ['veleno', 'esecuzione'])]
    const loss = previewDuoLoss(current, next, [])
    expect(loss.breaks).toHaveLength(0)
    expect(loss.regresses).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Eseguire il test per verificare che fallisca**

Run: `npm run test -- tests/engine/duoLoss.test.ts`
Expected: FAIL — `previewDuoLoss is not a function` / import error.

- [ ] **Step 3: Implementare l'helper**

In `game/engine/duos.ts`, aggiungere in fondo (dopo riga 109):

```ts
export type DuoLoss = { breaks: Duo[]; regresses: Duo[] }

/** Diff INVERSO di previewDuos: quando una sostituzione (recruit a squadra piena) rimuove un
 *  teammate. `current` = squadra COMPLETA attuale, `next` = squadra risultante (current − uscito
 *  + candidato). breaks = Duo attivo ora che si spegne; regresses = Duo a un passo ora che
 *  arretra a due+. Pure, usa livingOf come previewDuos così un morto non gonfia il diff. */
export function previewDuoLoss(current: DraftedWizard[], next: DraftedWizard[], relics: ActiveRelic[]): DuoLoss {
  const before = new Map(duoProgress(livingOf(current), relics).map(p => [p.duo.id, p]))
  const after = new Map(duoProgress(livingOf(next), relics).map(p => [p.duo.id, p]))
  const breaks: Duo[] = []
  const regresses: Duo[] = []
  for (const b of before.values()) {
    const a = after.get(b.duo.id)!
    if (b.active && !a.active) breaks.push(b.duo)
    else if (b.missing.length === 1 && a.missing.length >= 2) regresses.push(b.duo)
  }
  return { breaks, regresses }
}
```

- [ ] **Step 4: Eseguire i test — devono passare**

Run: `npm run test -- tests/engine/duoLoss.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add game/engine/duos.ts tests/engine/duoLoss.test.ts
git commit -m "feat(duo): previewDuoLoss — diff delle perdite Duo allo swap"
```

---

### Task 2: `trioGateLoss` — diff dei Trio persi (motore)

**Files:**
- Modify: `game/engine/trios.ts` (aggiungere dopo `trioGates` a riga 49; importare `detectDuos`, `ActiveRelic`)
- Test: `tests/engine/trioLoss.test.ts` (create)

**Interfaces:**
- Consumes: `trioGates(team, duos): {house,grade}[]` (trios.ts:38), `detectDuos(team, relics): ActiveDuo[]` (da duos.ts), tipi `House`, `DraftedWizard`, `ActiveRelic`.
- Produces: `trioGateLoss(current: DraftedWizard[], next: DraftedWizard[], relics: ActiveRelic[]): House[]` — le case il cui Trio è attivo in `current` e non più in `next`.

- [ ] **Step 1: Scrivere il test che fallisce**

Create `tests/engine/trioLoss.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { trioGateLoss } from '@/game/engine/trios'
import type { DraftedWizard } from '@/types'

// Casata esplicita: il gate Trio richiede >=3 maghi STESSA casa + >=1 Duo attivo.
const dw = (id: string, role: string, house: string, tags: string[] = []): DraftedWizard =>
  ({ wizard: { id, role, house, tags }, level: 1 } as unknown as DraftedWizard)

describe('trioGateLoss', () => {
  it('segnala la casa il cui Trio cade quando si rimuove un mago della casa', () => {
    // 3 Serpeverde + Duo Cancrena attivo (veleno+esecuzione su 2 di loro) → Trio Serpeverde attivo.
    const s1 = dw('s1', 'Attaccante', 'Serpeverde', ['veleno', 'esecuzione'])
    const s2 = dw('s2', 'Tank', 'Serpeverde', ['veleno', 'esecuzione'])
    const s3 = dw('s3', 'Controllo', 'Serpeverde')
    const current = [s1, s2, s3]
    // Rimpiazzo s3 (Serpeverde) con un Grifondoro → scendo a 2 Serpeverde → Trio cade.
    const next = [s1, s2, dw('g', 'Controllo', 'Grifondoro')]
    expect(trioGateLoss(current, next, [])).toContain('Serpeverde')
  })

  it('nessun Trio perso se la casa resta a >=3 e il Duo regge', () => {
    const s1 = dw('s1', 'Attaccante', 'Serpeverde', ['veleno', 'esecuzione'])
    const s2 = dw('s2', 'Tank', 'Serpeverde', ['veleno', 'esecuzione'])
    const s3 = dw('s3', 'Controllo', 'Serpeverde')
    const s4 = dw('s4', 'Supporto', 'Serpeverde')
    const current = [s1, s2, s3, s4]
    const next = [s1, s2, s3] // ancora 3 Serpeverde + Duo → Trio regge
    expect(trioGateLoss(current, next, [])).toHaveLength(0)
  })

  it('il Trio cade anche se a rompersi è il Duo (gate richiede >=1 Duo attivo)', () => {
    const s1 = dw('s1', 'Attaccante', 'Serpeverde', ['veleno', 'esecuzione'])
    const s2 = dw('s2', 'Tank', 'Serpeverde', ['veleno', 'esecuzione'])
    const s3 = dw('s3', 'Controllo', 'Serpeverde', ['veleno', 'esecuzione'])
    const current = [s1, s2, s3] // 3 Serpeverde + Cancrena → Trio attivo
    // Rimpiazzo s2 con un Serpeverde SENZA tag → resto 3 Serpeverde ma il Duo Cancrena si spegne.
    const next = [s1, dw('s5', 'Tank', 'Serpeverde'), s3]
    expect(trioGateLoss(current, next, [])).toContain('Serpeverde')
  })
})
```

- [ ] **Step 2: Eseguire il test per verificare che fallisca**

Run: `npm run test -- tests/engine/trioLoss.test.ts`
Expected: FAIL — `trioGateLoss is not a function`.

- [ ] **Step 3: Implementare l'helper**

In `game/engine/trios.ts`: aggiornare l'import in cima e aggiungere l'helper dopo `trioGates` (riga 49).

Import (riga 1-2) — aggiungere `ActiveRelic` e `detectDuos`:

```ts
import type { ActiveDuo, ActiveRelic, DraftedWizard, House } from '@/types'
import { livingOf } from '@/game/engine/roster'
import { detectDuos } from '@/game/engine/duos'
```

Helper (dopo riga 49):

```ts
/** Le case il cui Trio è attivo ORA e cade dopo lo swap. Il gate Trio (trioGates) richiede
 *  >=1 Duo attivo E >=3 maghi vivi della casa: entrambe le rotture (perdere il Duo o scendere
 *  sotto i 3 di casata) fanno cadere il Trio. Pure. */
export function trioGateLoss(current: DraftedWizard[], next: DraftedWizard[], relics: ActiveRelic[]): House[] {
  const before = trioGates(current, detectDuos(current, relics)).map(g => g.house)
  const after = new Set(trioGates(next, detectDuos(next, relics)).map(g => g.house))
  return before.filter(h => !after.has(h))
}
```

- [ ] **Step 4: Eseguire i test — devono passare**

Run: `npm run test -- tests/engine/trioLoss.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Typecheck (attenzione a import ciclici)**

Run: `npm run typecheck`
Expected: nessun errore. Nota: `duos.ts` non importa da `trios.ts`, quindi importare `detectDuos` in `trios.ts` NON crea ciclo. Se `tsc` segnalasse un ciclo inatteso, fermarsi e riportare — non forzare.

- [ ] **Step 6: Commit**

```bash
git add game/engine/trios.ts tests/engine/trioLoss.test.ts
git commit -m "feat(trio): trioGateLoss — diff dei Trio di casata persi allo swap"
```

---

### Task 3: `DuoTracker` — righe di perdita con la perdita che domina (UX)

**Files:**
- Modify: `components/draft/DuoTracker.tsx`
- Test: `tests/ui/duoTracker.test.tsx` (aggiungere casi; NON rompere gli esistenti)

**Interfaces:**
- Consumes: `previewDuoLoss(current, next, relics): DuoLoss` (Task 1), `trioGateLoss(current, next, relics): House[]` (Task 2), `previewDuos` e `duoProgress` (esistenti).
- Produces: `DuoTracker` accetta una nuova prop opzionale `prevTeam?: DraftedWizard[]`. Quando presente + `considered`, calcola `current=prevTeam`, `next=[...picks, considered]`, e renderizza righe con `data-breaks` / `data-regresses` e (se Trio perso) un banner con `data-testid="trio-loss-<house>"`. Senza `prevTeam` il comportamento è invariato.

- [ ] **Step 1: Scrivere i test che falliscono**

Aggiungere a `tests/ui/duoTracker.test.tsx` (in fondo, dentro il file, nuovo `describe`). Importare gli helper in cima al file se serve; il `mage` factory esiste già:

```ts
describe('DuoTracker — perdite (recruit a squadra piena)', () => {
  it('marca "si spegne" (data-breaks) il Duo che lo swap disattiva', () => {
    // prevTeam: Cancrena attivo (2 maghi veleno+esecuzione). Considero un candidato inerte
    // al posto di uno dei due → picks = team meno il rimpiazzato = solo 'a'.
    const prevTeam = [mage('a', 'Attaccante', ['veleno', 'esecuzione']), mage('b', 'Tank', ['veleno', 'esecuzione'])]
    const picks = [mage('a', 'Attaccante', ['veleno', 'esecuzione'])]
    const candidate = mage('c', 'Controllo')
    const { container } = render(<DuoTracker picks={picks} considered={candidate} prevTeam={prevTeam} />)
    const row = container.querySelector('[data-duo="cancrena"]')!
    expect(row).toHaveAttribute('data-breaks')
    expect(row).toHaveTextContent(/si spegne/i)
  })

  it('senza prevTeam il comportamento è invariato (nessuna riga breaks)', () => {
    const picks = [mage('a', 'Attaccante', ['veleno', 'esecuzione'])]
    const candidate = mage('c', 'Controllo')
    const { container } = render(<DuoTracker picks={picks} considered={candidate} />)
    expect(container.querySelector('[data-breaks]')).toBeNull()
  })
})
```

- [ ] **Step 2: Eseguire i test per verificare che falliscano**

Run: `npm run test -- tests/ui/duoTracker.test.tsx`
Expected: il nuovo test "si spegne" FALLISCE (nessun `data-breaks`); gli esistenti passano ancora.

- [ ] **Step 3: Implementare le perdite in DuoTracker**

In `components/draft/DuoTracker.tsx`:

3a. Import (riga 3-5) — aggiungere gli helper e il colore:

```ts
import type { ActiveRelic, DraftedWizard, DuoProgress, House } from '@/types'
import { duoProgress, previewDuos, previewDuoLoss } from '@/game/engine/duos'
import { trioGateLoss } from '@/game/engine/trios'
import { DuoRecipe } from '@/components/run/DuoPanel'
import { cn } from '@/lib/cn'
```

Costante colore (dopo `GREEN`, riga 10):

```ts
const ROSE = '#f07272'
```

3b. Prop (firma, riga 20-26) — aggiungere `prevTeam`:

```ts
export function DuoTracker({ picks, considered, relics = [], prevTeam, className }: {
  picks: DraftedWizard[]
  considered?: DraftedWizard | null
  relics?: ActiveRelic[]
  /** Squadra COMPLETA attuale prima dello swap (solo recruit a squadra piena). Se presente,
   *  il tracker mostra anche cosa lo swap SPEGNE. Assente al draft iniziale → invariato. */
  prevTeam?: DraftedWizard[]
  className?: string
}) {
```

3c. Calcolo perdite (dopo la riga `const advances = ...`, ~riga 32):

```ts
  const next = considered ? [...picks, considered] : picks
  const loss = prevTeam && considered ? previewDuoLoss(prevTeam, next, relics) : null
  const trioLost = prevTeam && considered ? trioGateLoss(prevTeam, next, relics) : []
  const breaks = new Set(loss?.breaks.map(d => d.id))
  const regresses = new Set(loss?.regresses.map(d => d.id))
```

3d. Rank — la perdita domina (sostituire la funzione `rank`, righe 35-36):

```ts
  const rank = (p: DuoProgress) =>
    breaks.has(p.duo.id) ? 0
    : completes.has(p.duo.id) ? 1
    : p.active ? 2
    : regresses.has(p.duo.id) ? 3
    : advances.has(p.duo.id) ? 4
    : p.missing.length === 1 ? 5
    : 6
```

3e. Nel `.map` delle righe (dentro `sorted.map`, ~riga 51), calcolare gli stati di perdita e aggiungere gli attributi/badge. Sostituire il blocco `const badge = ...` e aggiungere `broke`/`regressed`:

```ts
          const broke = breaks.has(p.duo.id)
          const regressed = regresses.has(p.duo.id)
          const badge = broke ? 'si spegne'
            : lights ? 'si attiva'
            : st === 'active' ? 'attiva'
            : regressed ? 'arretra'
            : steps ? 'avanza'
            : null
```

Nel `<motion.li>`: aggiungere gli attributi dati e far vincere il rosso su bordo/fondo/opacità.
Aggiungere accanto a `data-advances`:

```tsx
              data-breaks={broke ? '' : undefined}
              data-regresses={regressed ? '' : undefined}
```

Nello `style` del `<motion.li>`, il rosso della rottura prevale — sostituire `borderColor`, `background`, `opacity`:

```tsx
                borderColor: broke ? `${ROSE}aa` : lights || steps ? `${GREEN}66` : st === 'active' ? `${GOLD}66` : regressed ? `${GOLD}55` : 'rgba(255,255,255,0.10)',
                background: broke
                  ? `linear-gradient(135deg, ${ROSE}22, transparent 70%)`
                  : lights
                    ? `linear-gradient(135deg, ${GREEN}14, transparent 70%)`
                    : st === 'active'
                      ? `linear-gradient(135deg, ${GOLD}1a, transparent 70%)`
                      : undefined,
                borderStyle: broke || (st === 'active' && !lights) ? 'solid' : 'dashed',
                opacity: st === 'locked' && !steps && !regressed ? 0.75 : 1,
```

Nel badge span (colore), far usare il rosso quando `broke`:

```tsx
                {badge && (
                  <span className="shrink-0 text-[10px] font-bold" style={{ color: broke ? ROSE : lights || steps ? GREEN : GOLD }}>
                    · {badge}
                  </span>
                )}
```

Nel nome del Duo (colore), il rosso quando `broke` (riga `style={{ color: ... }}` dello span nome):

```tsx
                  style={{ color: broke ? ROSE : st === 'active' ? '#f3e6c4' : steps ? GREEN : 'rgba(255,255,255,0.6)' }}
```

**Importante:** NON aggiungere `synergy-node-pulse` alle righe `broke` (il pulse è gratificazione, la perdita è allarme statico). Lasciare `lights && 'synergy-node-pulse'` com'è.

3f. Banner Trio perso — subito sopra il `<ul>` (dopo il `<p>` "due segnali accesi…", ~riga 48):

```tsx
      {trioLost.length > 0 && (
        <div className="mb-2 space-y-1">
          {trioLost.map(h => (
            <p
              key={h}
              data-testid={`trio-loss-${h}`}
              className="rounded-md border px-2 py-1 text-[10px] font-semibold"
              style={{ borderColor: `${ROSE}aa`, background: `${ROSE}1a`, color: ROSE }}
            >
              ⚠ Trio di {h} si spegne
            </p>
          ))}
        </div>
      )}
```

- [ ] **Step 4: Eseguire i test — tutti verdi**

Run: `npm run test -- tests/ui/duoTracker.test.tsx`
Expected: PASS (esistenti + 2 nuovi).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add components/draft/DuoTracker.tsx tests/ui/duoTracker.test.tsx
git commit -m "feat(duo-ux): DuoTracker mostra le perdite allo swap, la perdita domina"
```

---

### Task 4: `RecruitScreen` — passare `prevTeam` a squadra piena (wiring)

**Files:**
- Modify: `components/screens/RecruitScreen.tsx:164`
- Test: `tests/ui/recruitLoss.test.tsx` (create)

**Interfaces:**
- Consumes: `DuoTracker` con prop `prevTeam` (Task 3). `team` (completo), `baseTeam` (= team − replaceId), `full`, `focus` esistono già nel componente.
- Produces: nessuna nuova interfaccia — è il collegamento finale che rende il feature visibile in gioco.

- [ ] **Step 1: Scrivere il test che fallisce**

Create `tests/ui/recruitLoss.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RecruitScreen } from '@/components/screens/RecruitScreen'

const mage = (id: string, role: string, tags: string[] = []) =>
  ({ wizard: { id, name: id, house: 'Grifondoro', role, tags }, level: 1, stats: {}, maxHp: 100 }) as any

describe('RecruitScreen — warning di perdita a squadra piena', () => {
  it('considerando un candidato che rimpiazza un mago-chiave, il tracker segnala il Duo che si spegne', () => {
    // Squadra piena (teamMax 2 per il test) con Cancrena attivo. Il candidato inerte rimpiazza
    // il mago più debole (weakestId di default) → deve apparire data-breaks su cancrena quando
    // il candidato è considerato. Simuliamo il "consider" impostando pick (focus = pickedWizard).
    const team = [mage('a', 'Attaccante', ['veleno', 'esecuzione']), mage('b', 'Tank', ['veleno', 'esecuzione'])]
    const offer = [mage('c', 'Controllo')]
    const { container, getByTestId } = render(
      <RecruitScreen offer={offer} team={team} teamMax={2} relics={[]} onPick={() => {}} />,
    )
    // Considera il candidato (focus): click sulla card lo seleziona → focus = pickedWizard.
    getByTestId('recruit-c').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    const row = container.querySelector('[data-duo="cancrena"]')
    expect(row).not.toBeNull()
    expect(row).toHaveAttribute('data-breaks')
  })
})
```

- [ ] **Step 2: Eseguire il test per verificare che fallisca**

Run: `npm run test -- tests/ui/recruitLoss.test.tsx`
Expected: FAIL — nessun `data-breaks` (RecruitScreen non passa ancora `prevTeam`).

Se il test fallisce invece per un errore di render non correlato (es. componente figlio che richiede canvas), fermarsi e riportare: potrebbe servire un mock — vedi memoria "Test environment missing HTMLCanvasElement.getContext()". In quel caso ridurre lo scope del test al minimo che renderizza il tracker, o spostare l'asserzione su un test più unitario del tracker (Task 3 copre già la logica).

- [ ] **Step 3: Passare `prevTeam` al tracker**

In `components/screens/RecruitScreen.tsx`, riga 164, modificare la chiamata a `DuoTracker`:

```tsx
                <DuoTracker picks={baseTeam} considered={focus} relics={relics} prevTeam={full ? team : undefined} />
```

- [ ] **Step 4: Eseguire il test — deve passare**

Run: `npm run test -- tests/ui/recruitLoss.test.tsx`
Expected: PASS.

- [ ] **Step 5: Suite completa + typecheck**

Run: `npm run test` poi `npm run typecheck`
Expected: entrambi verdi. Nota (memoria): il test `seedShare` può essere già rosso per motivi pre-esistenti — se l'UNICO fallimento è quello e non è toccato da questo lavoro, annotarlo e proseguire; qualunque altro rosso va risolto.

- [ ] **Step 6: Commit**

```bash
git add components/screens/RecruitScreen.tsx tests/ui/recruitLoss.test.tsx
git commit -m "feat(recruit): warning live di perdita Duo/Trio a squadra piena"
```

---

## Self-Review (autore)

- **Spec coverage:** §4a→Task1, §4b→Task2, §4c→Task3, §4d→Task4, §6 testing→ogni task ha unit+UI, §5 YAGNI rispettato (nessun dialog, nessun draft iniziale, nessuna card). ✅
- **Type consistency:** `previewDuoLoss(current,next,relics)→DuoLoss{breaks,regresses}` e `trioGateLoss(current,next,relics)→House[]` usati identici in Task3. Prop `prevTeam` identica Task3↔Task4. ✅
- **Placeholder scan:** nessun TBD/TODO; ogni step di codice mostra il codice. ✅
- **Rischio noto documentato:** possibile canvas mock nel test RecruitScreen (Task 4 Step 2) e seedShare pre-rosso (Task 4 Step 5). ✅
