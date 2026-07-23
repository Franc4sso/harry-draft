# Fix card: Muro / tooltip / shiny foil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sistemare 3 problemi UI sulle wizard card — collisione della parola "Muro", tooltip mancanti, e il trattamento shiny brutto — senza toccare motore o bilanciamento.

**Architecture:** Pure UI/dati. Un helper puro `archetypeTooltip(tag)` in `lib/archetypes.ts`; rinomina di label/testi; riuso del componente `Tooltip` esistente; un token foil condiviso in `lib/theme.ts`. TDD con Vitest + Testing Library.

**Tech Stack:** Next.js (versione custom — vedi AGENTS.md), TypeScript, React, Tailwind, Vitest, @testing-library/react.

## Global Constraints

- La parola "Muro" deve riferirsi SOLO all'archetipo scudirigen. Ogni altra fonte ("Bersaglio" per taunt; "Scudo/Ancora" per il ruolo Tank) va rinominata.
- Nessun cambiamento al motore di combattimento né ai numeri di bilanciamento.
- Il componente `components/ui/Tooltip.tsx` è un `<button>` che ferma la propagazione: sicuro dentro card cliccabili. NON annidare un Tooltip dentro un altro button.
- `npm run test` NON esegue il typecheck: dopo ogni task con nuovo TS/TSX, lanciare anche `npx tsc --noEmit`.
- Comando test singolo file: `npx vitest run <path> --disable-console-intercept`.

---

### Task 1: Rinomina pill taunt "Muro" → "Bersaglio" e rimuovi la special-case M1

**Files:**
- Modify: `components/cards/DuoSignalMarks.tsx:12-40`
- Modify: `components/cards/WizardCardColumn.tsx:284-291` (solo commento)
- Test: `tests/ui/duoSignalMarks.test.tsx:25-38`

**Interfaces:**
- Consumes: `wizardDuoSignals(wizard)`, `SIGNAL_LABEL`, `SIGNAL_ICON`, `SIGNAL_COLOR` (invariati).
- Produces: `DuoSignalMarks` con label taunt = "Bersaglio"; nessuna soppressione speciale per scudirigen.

- [ ] **Step 1: Aggiorna i test esistenti (red)**

In `tests/ui/duoSignalMarks.test.tsx` SOSTITUISCI i due test M1 (righe 25-38, quelli "suppresses the taunt Muro pill…" e "keeps the taunt Muro pill…") con:

```tsx
  it('labels the taunt signal "Bersaglio" (not "Muro") so it never collides with the archetype', () => {
    render(<DuoSignalMarks wizard={wiz('Tank', [])} />)
    expect(screen.getByText('Bersaglio')).toBeInTheDocument()
    expect(screen.queryByText('Muro')).not.toBeInTheDocument()
  })

  it('excludeArchetypeSignals drops the 4 tag-signals but keeps the taunt "Bersaglio" pill', () => {
    render(<DuoSignalMarks wizard={wiz('Tank', ['scudirigen'])} excludeArchetypeSignals />)
    // scudirigen tag-signal escluso (il nastro lo mostra); il taunt "Bersaglio" resta (nessuna collisione)
    expect(screen.getByText('Bersaglio')).toBeInTheDocument()
    expect(screen.queryByText('Muro')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Lancia i test → devono fallire**

Run: `npx vitest run tests/ui/duoSignalMarks.test.tsx --disable-console-intercept`
Expected: FAIL — attualmente il label è "Muro" e la pill è soppressa per scudirigen.

- [ ] **Step 3: Rinomina il label**

In `components/cards/DuoSignalMarks.tsx`, riga 15-17, cambia:

```tsx
const CARD_SIGNAL_LABEL: Partial<Record<DuoSignal, string>> = {
  taunt: 'Bersaglio',
}
```

E aggiorna il JSDoc di `cardLabel` (righe 12-14) rimuovendo il riferimento a "Muro":

```tsx
/** Card label for a signal. Role-named signals (taunt='Tank'…) would just echo the card's
 *  own RoleBadge/crown, so on the card we name what the signal FEEDS instead of the role:
 *  taunt reads "Bersaglio" (draws enemy fire), not "Tank". Tag signals keep their own name. */
```

- [ ] **Step 4: Rimuovi la special-case M1**

In `components/cards/DuoSignalMarks.tsx` sostituisci righe 36-40 con:

```tsx
  const allSignals = wizardDuoSignals(wizard)
  const signals = excludeArchetypeSignals
    ? allSignals.filter((s) => !ARCHETYPE_SIGNAL_IDS.has(s))
    : allSignals
```

E aggiorna il JSDoc del componente (righe 22-30) rimuovendo il paragrafo sulla collisione scudirigen/Muro:

```tsx
/** Per-signal marks on a wizard card: the Duo signals this wizard feeds (honest — only signals
 *  used by a shipped Duo). `compact` shows icon-only; otherwise the signal is named so a player
 *  reads WHY the wizard matters for Combos. `excludeArchetypeSignals` drops the 4 tag-signals
 *  (veleno/esecuzione/scudirigen/magieOscure) that a sibling archetype ribbon already shows,
 *  leaving only role-signals like taunt ("Bersaglio"). */
```

- [ ] **Step 5: Aggiorna il commento nella Column**

In `components/cards/WizardCardColumn.tsx` righe 284-291, sostituisci il commento con:

```tsx
        {/* Named signals so the Combo value is explicit. taunt reads "Bersaglio" (not "Tank")
            to avoid echoing the crown/RoleBadge — see DuoSignalMarks.cardLabel. The 4 tag-signals
            (veleno/esecuzione/scudirigen/magieOscure) are excluded here since the archetype
            ribbon above already shows the wizard's primary one — no redundant pill. */}
```

- [ ] **Step 6: Lancia i test → devono passare**

Run: `npx vitest run tests/ui/duoSignalMarks.test.tsx --disable-console-intercept`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/cards/DuoSignalMarks.tsx components/cards/WizardCardColumn.tsx tests/ui/duoSignalMarks.test.tsx
git commit -m "fix(cards): rinomina pill taunt Muro->Bersaglio, rimuovi special-case M1"
```

---

### Task 2: Allinea la card Row (niente pill archetipo ridondanti)

**Files:**
- Modify: `components/cards/WizardCardRow.tsx:113`
- Test: `tests/ui/wizardCardRow.test.tsx` (nuovo test)

**Interfaces:**
- Consumes: `DuoSignalMarks` (con `excludeArchetypeSignals` da Task 1).
- Produces: la Row non mostra più la pill del tag-signal quando c'è già il concetto altrove; mantiene "Bersaglio".

- [ ] **Step 1: Scrivi il test (red)**

Aggiungi a `tests/ui/wizardCardRow.test.tsx` (crea il describe se manca — controlla prima il file):

```tsx
import { DuoSignalMarks } from '@/components/cards/DuoSignalMarks'
// dentro un describe esistente o nuovo:
  it('esclude i tag-signal archetipo sulla Row (come la Column)', () => {
    // Un Tank scudirigen non deve mostrare la pill "scudirigen"; il taunt "Bersaglio" resta.
    render(<WizardCardRow drafted={dwWithTags('goyle', ['scudirigen'])} />)
    expect(screen.getByText('Bersaglio')).toBeInTheDocument()
    expect(screen.queryByText('Scudo/Rigen')).not.toBeInTheDocument()
  })
```

NOTA per l'implementatore: `dwWithTags` è un helper locale — se il file non ce l'ha, costruisci il drafted come negli altri test del file (`WIZARD_BY_ID`, `fixedStats`, `SPELL_BY_ID`) forzando `wizard.tags`. Se `goyle` non ha tag scudirigen nei dati, clona l'oggetto wizard con `tags: ['scudirigen']` per il test. Verifica il pattern già usato nel file prima di scrivere.

- [ ] **Step 2: Lancia il test → deve fallire**

Run: `npx vitest run tests/ui/wizardCardRow.test.tsx --disable-console-intercept`
Expected: FAIL — la Row oggi mostra la pill "Scudo/Rigen".

- [ ] **Step 3: Passa `excludeArchetypeSignals` nella Row**

In `components/cards/WizardCardRow.tsx` riga 113:

```tsx
          <DuoSignalMarks wizard={wizard} excludeArchetypeSignals />
```

- [ ] **Step 4: Lancia il test → deve passare**

Run: `npx vitest run tests/ui/wizardCardRow.test.tsx --disable-console-intercept`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/cards/WizardCardRow.tsx tests/ui/wizardCardRow.test.tsx
git commit -m "fix(cards): Row esclude i tag-signal archetipo come la Column"
```

---

### Task 3: Helper `archetypeTooltip(tag)` + fix "Muro" nel roleTooltip Tank

**Files:**
- Modify: `lib/archetypes.ts` (aggiungi export `archetypeTooltip`)
- Modify: `lib/roleInfo.ts:10` (testo Tank)
- Test: `tests/lib/archetypeTooltip.test.ts` (nuovo)

**Interfaces:**
- Consumes: `ARCHETYPE_BY_TAG`, `ARCHETYPE_EFFECT` (esistenti in `lib/archetypes.ts`).
- Produces: `archetypeTooltip(tag: keyof typeof ARCHETYPE_BY_TAG): string` — effetto della sinergia se il tag ha `synergyId`, altrimenti fallback `Archetipo: ${name}`.

- [ ] **Step 1: Scrivi il test (red)**

Crea `tests/lib/archetypeTooltip.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { archetypeTooltip } from '@/lib/archetypes'

describe('archetypeTooltip', () => {
  it('ritorna il testo effetto per un tag con synergyId', () => {
    // scudirigen -> bastione
    expect(archetypeTooltip('scudirigen')).toBe(
      'Muro riflettente: chi ha uno scudo rimanda il danno assorbito.',
    )
  })

  it('usa un fallback generico per un tag senza synergyId', () => {
    // magieOscure non ha synergyId finché Patto Oscuro non è merged
    expect(archetypeTooltip('magieOscure')).toBe('Archetipo: Magie Oscure')
  })
})
```

- [ ] **Step 2: Lancia il test → deve fallire**

Run: `npx vitest run tests/lib/archetypeTooltip.test.ts --disable-console-intercept`
Expected: FAIL — `archetypeTooltip` non esiste.

- [ ] **Step 3: Implementa l'helper**

In `lib/archetypes.ts`, in fondo al file, aggiungi:

```ts
/** Testo tooltip per il nastro/archetipo di un tag. Se il tag ha una sinergia (synergyId),
 *  mostra l'effetto della Costellazione; altrimenti un fallback generico col nome fantasia. */
export function archetypeTooltip(tag: keyof typeof ARCHETYPE_BY_TAG): string {
  const meta = ARCHETYPE_BY_TAG[tag]
  const effect = meta.synergyId ? ARCHETYPE_EFFECT[meta.synergyId] : undefined
  return effect ?? `Archetipo: ${meta.name}`
}
```

- [ ] **Step 4: Fix del "Muro" nel roleTooltip Tank**

In `lib/roleInfo.ts` riga 10, cambia il testo Tank (rimuovi "Muro della squadra"):

```ts
  Tank: 'Scudo della squadra: i nemici lo attaccano per primo. Tanta vita e difesa, poco danno.',
```

- [ ] **Step 5: Lancia i test → devono passare**

Run: `npx vitest run tests/lib/archetypeTooltip.test.ts --disable-console-intercept`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 7: Commit**

```bash
git add lib/archetypes.ts lib/roleInfo.ts tests/lib/archetypeTooltip.test.ts
git commit -m "feat(cards): archetypeTooltip helper + rimuovi 'Muro' dal roleTooltip Tank"
```

---

### Task 4: Tooltip sul nastro archetipo (Column) + Costellazioni (tracker)

**Files:**
- Modify: `components/cards/WizardCardColumn.tsx:15,231-243`
- Modify: `components/draft/ArchetypeTracker.tsx:4,46-95`
- Test: `tests/ui/wizardCard.test.tsx` (nuovo test)

**Interfaces:**
- Consumes: `Tooltip` (`components/ui/Tooltip.tsx`), `archetypeTooltip` (Task 3).
- Produces: nastro archetipo con tooltip; righe tracker con tooltip.

- [ ] **Step 1: Scrivi il test (red)**

In `tests/ui/wizardCard.test.tsx` aggiungi (controlla gli import esistenti del file; usa il pattern di costruzione drafted già presente):

```tsx
import { archetypeTooltip } from '@/lib/archetypes'
  it('il nastro archetipo espone un tooltip con l\'effetto della Costellazione', () => {
    // un mago scudirigen mostra il nastro "Muro" con tooltip bastione.
    render(<WizardCardColumn drafted={dwWithTags('goyle', ['scudirigen'])} />)
    // apri il tooltip (il trigger è un button; il popover appare su click)
    const ribbon = screen.getByTestId('archetype-ribbon')
    fireEvent.click(ribbon)
    expect(screen.getByText(archetypeTooltip('scudirigen'))).toBeInTheDocument()
  })
```

NOTA implementatore: importa `fireEvent` da `@testing-library/react`. `dwWithTags` come in Task 2 (clona il wizard con `tags`). Il `data-testid="archetype-ribbon"` esiste già (WizardCardColumn:233); dopo il wrap in Tooltip, assicurati che il testid resti sul trigger o su un ancestor raggiungibile via `getByTestId` — se il wrap sposta il testid, aggiorna il test per selezionare il button del Tooltip (`role="button"` con l'aria-label che darai).

- [ ] **Step 2: Lancia il test → deve fallire**

Run: `npx vitest run tests/ui/wizardCard.test.tsx --disable-console-intercept`
Expected: FAIL — nessun tooltip sul nastro.

- [ ] **Step 3: Avvolgi il nastro nel Tooltip (Column)**

In `components/cards/WizardCardColumn.tsx`:

Aggiungi gli import (righe 15-16 area):

```tsx
import { ARCHETYPE_BY_TAG, archetypeTooltip } from '@/lib/archetypes'
import { Tooltip } from '@/components/ui/Tooltip'
```

Sostituisci il blocco nastro (righe 231-243) con la versione avvolta in Tooltip. Ricava il tag primario una volta:

```tsx
          {archetype && (() => {
            const tag = wizard.tags?.find((t): t is keyof typeof ARCHETYPE_BY_TAG => t in ARCHETYPE_BY_TAG)!
            return (
              <Tooltip
                label={`Archetipo ${archetype.name}`}
                content={archetypeTooltip(tag)}
                triggerClassName="rounded-bl-xl"
              >
                <span
                  data-testid="archetype-ribbon"
                  data-archetype={tag}
                  className="inline-flex items-center gap-1 rounded-bl-xl px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-white"
                  style={{
                    background: `linear-gradient(180deg, ${archetype.color}, ${archetype.color}99)`,
                    boxShadow: '0 3px 10px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.22)',
                  }}
                >
                  <span aria-hidden>{archetype.glyph}</span> {archetype.name}
                </span>
              </Tooltip>
            )
          })()}
```

- [ ] **Step 4: Tooltip sulle righe del tracker**

In `components/draft/ArchetypeTracker.tsx` aggiungi import (riga 4-5 area):

```tsx
import { ARCHETYPE_EFFECT } from '@/lib/archetypes'
import { Tooltip } from '@/components/ui/Tooltip'
```

Il tracker mostra l'effetto SOLO quando `active` (riga 89-91). Per rendere l'effetto leggibile anche da sopito/vicino, avvolgi il nome dell'archetipo (riga 66-71) in un Tooltip che mostra `ARCHETYPE_EFFECT[p.synergy.id]`. Sostituisci lo `<span>` del nome (righe 66-71) con:

```tsx
                <Tooltip
                  label={`Costellazione ${meta.name}`}
                  content={ARCHETYPE_EFFECT[p.synergy.id] ?? `Archetipo: ${meta.name}`}
                >
                  <span
                    className="text-[12px] font-semibold leading-tight"
                    style={{ color: state === 'active' ? '#f3e6c4' : state === 'near' ? GREEN : 'rgba(255,255,255,0.6)' }}
                  >
                    <span aria-hidden style={{ color: meta.color }}>{meta.glyph}</span> {meta.name}
                  </span>
                </Tooltip>
```

NOTA implementatore: il `Tooltip` rende un `<button>`. Verifica con `npx vitest run tests/ui/archetypeTracker.test.tsx` che i test esistenti (che cercano `data-arch`, `data-state`, `getByText(meta.name)`) ancora passino — il testo del nome resta selezionabile via `getByText`. Se un test seleziona per struttura DOM esatta, aggiornalo.

- [ ] **Step 5: Lancia i test → devono passare**

Run: `npx vitest run tests/ui/wizardCard.test.tsx tests/ui/archetypeTracker.test.tsx tests/ui/archetypeTrackerWiring.test.tsx --disable-console-intercept`
Expected: PASS (aggiorna eventuali test rotti dalla struttura).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 7: Commit**

```bash
git add components/cards/WizardCardColumn.tsx components/draft/ArchetypeTracker.tsx tests/ui/wizardCard.test.tsx
git commit -m "feat(cards): tooltip su nastro archetipo (Column) e righe Costellazioni"
```

---

### Task 5: Tooltip sui segnali Duo (pill) e sul RoleBadge (Column)

**Files:**
- Modify: `components/cards/DuoSignalMarks.tsx:1-59`
- Modify: `components/cards/WizardCardColumn.tsx:225-227`
- Test: `tests/ui/duoSignalMarks.test.tsx` (nuovo test)

**Interfaces:**
- Consumes: `Tooltip`, `SIGNAL_HOWTO` (`data/duos.ts`), `roleTooltip` (`lib/roleInfo.ts`), `RoleBadge`.
- Produces: pill segnali con tooltip esplicativo; role badge Column con tooltip.

- [ ] **Step 1: Definisci il blurb per-segnale (dati)**

I segnali hanno già `SIGNAL_HOWTO` (come ottenerli) ma per il tooltip serve COSA fanno. Aggiungi in `data/duos.ts` (dopo `SIGNAL_HOWTO`, riga ~49):

```ts
/** Cosa FA il segnale in battaglia (tooltip sulla pill della card). */
export const SIGNAL_BLURB: Record<DuoSignal, string> = {
  taunt: 'Bersaglio: i nemici lo attaccano per primo, proteggendo la squadra.',
  attaccante: 'Attaccante: alto danno, ignora parte della difesa nemica.',
  supporto: 'Supporto: cura, scuda e pulisce i controlli dalla squadra.',
  controllo: 'Controllo: stordisce, silenzia e rallenta i nemici.',
  veleno: 'Veleno: infligge danno nel tempo che si accumula.',
  esecuzione: 'Esecuzione: colpisce più forte i bersagli quasi morti.',
  scudirigen: 'Scudo/Rigen: genera scudi e rigenerazione per resistere.',
  magieOscure: 'Magie Oscure: incantesimi potenti con un contraccolpo.',
}
```

- [ ] **Step 2: Scrivi il test (red)**

In `tests/ui/duoSignalMarks.test.tsx` aggiungi:

```tsx
import { SIGNAL_BLURB } from '@/data/duos'
  it('ogni pill segnale espone un tooltip con il suo effetto', () => {
    render(<DuoSignalMarks wizard={wiz('Tank', [])} />)
    fireEvent.click(screen.getByText('Bersaglio'))
    expect(screen.getByText(SIGNAL_BLURB.taunt)).toBeInTheDocument()
  })
```

NOTA: importa `fireEvent`. `wiz(...)` è l'helper già nel file.

- [ ] **Step 3: Lancia il test → deve fallire**

Run: `npx vitest run tests/ui/duoSignalMarks.test.tsx --disable-console-intercept`
Expected: FAIL — nessun tooltip sulle pill.

- [ ] **Step 4: Avvolgi le pill nel Tooltip**

In `components/cards/DuoSignalMarks.tsx` aggiungi import:

```tsx
import { Tooltip } from '@/components/ui/Tooltip'
import { SIGNAL_LABEL, SIGNAL_ICON, SIGNAL_COLOR, SIGNAL_BLURB } from '@/data/duos'
```

Sostituisci il `.map` (righe 44-56) avvolgendo ogni pill:

```tsx
      {signals.map((s) => {
        const color = SIGNAL_COLOR[s]
        return (
          <Tooltip key={s} label={cardLabel(s)} content={SIGNAL_BLURB[s]}>
            <span
              data-signal={s}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
              style={{ color, borderColor: `${color}80`, background: `${color}22` }}
            >
              <span aria-hidden>{SIGNAL_ICON[s]}</span>
              {!compact && <span>{cardLabel(s)}</span>}
            </span>
          </Tooltip>
        )
      })}
```

NOTA implementatore: il Tooltip rende un `<button>` attorno alla pill. Verifica che `getByText(cardLabel(s))` e `[data-signal]` restino raggiungibili (lo sono: sono dentro il children del button). In `compact` mode la pill è icon-only ma il tooltip resta utile (label via `label`).

- [ ] **Step 5: Tooltip sul RoleBadge (Column)**

In `components/cards/WizardCardColumn.tsx` aggiungi import `roleTooltip`:

```tsx
import { ROLE_ACCENT, roleTooltip } from '@/lib/roleInfo'
```

Sostituisci il blocco RoleBadge (righe 225-227):

```tsx
        <div className="absolute left-3 top-3">
          <Tooltip label={`Ruolo ${wizard.role}`} content={roleTooltip(wizard.role)}>
            <RoleBadge role={wizard.role} />
          </Tooltip>
        </div>
```

(`Tooltip` è già importato dal Task 4.)

- [ ] **Step 6: Lancia i test → devono passare**

Run: `npx vitest run tests/ui/duoSignalMarks.test.tsx tests/ui/wizardCard.test.tsx --disable-console-intercept`
Expected: PASS.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 8: Commit**

```bash
git add components/cards/DuoSignalMarks.tsx components/cards/WizardCardColumn.tsx data/duos.ts tests/ui/duoSignalMarks.test.tsx
git commit -m "feat(cards): tooltip su pill segnali Duo e RoleBadge (Column)"
```

---

### Task 6: Shiny foil coeso — token condiviso + pulizia glow

**Files:**
- Modify: `lib/theme.ts` (nuovo export `SHINY_FOIL`)
- Modify: `components/cards/WizardCardColumn.tsx:60-61,266-268`
- Modify: `components/cards/WizardCardRow.tsx:44`
- Test: (coperto dai test shiny nei task successivi; qui solo typecheck + visual)

**Interfaces:**
- Produces: `SHINY_FOIL: string` — la stringa box-shadow oro condivisa (un solo glow coeso).

- [ ] **Step 1: Aggiungi il token in theme**

In `lib/theme.ts`, aggiungi un export (posizionalo vicino agli altri token di stile):

```ts
/** Glow "foil" oro condiviso per i maghi shiny. UN solo layer coeso (niente doppioni).
 *  Concatenato al boxShadow del frame card in Row e Column. */
export const SHINY_FOIL = ', 0 0 20px rgba(255,200,80,0.5), inset 0 0 0 2px rgba(255,210,90,0.75)'
```

- [ ] **Step 2: Usa il token nella Column e rimuovi l'overlay doppio**

In `components/cards/WizardCardColumn.tsx`:

Import: aggiungi `SHINY_FOIL` all'import esistente da `@/lib/theme` (riga 4):

```tsx
import { cn, houseTheme, tierFrame, SHINY_FOIL } from '@/lib/theme'
```

Riga 61, sostituisci con il token:

```tsx
  const shinyGlow = drafted.shiny ? SHINY_FOIL : ''
```

Rimuovi l'overlay inset DOPPIO (righe 266-268 — il `{drafted.shiny && (<div ... boxShadow: 'inset 0 0 0 2px ...' />)}`). Cancella completamente quel blocco: il glow ora vive solo nel `boxShadow` del frame (via `shinyGlow`).

- [ ] **Step 3: Usa il token nella Row**

In `components/cards/WizardCardRow.tsx`:

Import (riga 4): aggiungi `SHINY_FOIL`:

```tsx
import { cn, houseTheme, SHINY_FOIL } from '@/lib/theme'
```

Riga 44:

```tsx
  const shinyGlow = drafted.shiny ? SHINY_FOIL : ''
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 5: Verifica i test shiny non regrediscano**

Run: `npx vitest run tests/ui/shinyCard.test.tsx tests/ui/wizardCard.test.tsx --disable-console-intercept`
Expected: PASS (il nome-epiteto e la chip non sono ancora toccati — cambia solo il glow).

- [ ] **Step 6: Commit**

```bash
git add lib/theme.ts components/cards/WizardCardColumn.tsx components/cards/WizardCardRow.tsx
git commit -m "refactor(cards): token SHINY_FOIL condiviso, rimuovi glow oro doppio"
```

---

### Task 7: Shiny — rimuovi la pill blu, aggiungi marcatore foil + tooltip

**Files:**
- Modify: `components/cards/WizardCardColumn.tsx:261-263,272-282`
- Modify: `components/cards/WizardCardRow.tsx:111,152-167`
- Test: `tests/ui/shinyCard.test.tsx` (aggiorna), `tests/ui/wizardCard.test.tsx` (aggiorna)

**Interfaces:**
- Consumes: `Tooltip`, `shinyTrait` (`TRAIT_BY_ID[drafted.shiny.traitId]`), `displayName`.
- Produces: nessuna pill tratto blu; un marcatore foil dorato accanto al nome con tooltip che mostra `${shinyTrait.name} — ${shinyTrait.desc}`.

- [ ] **Step 1: Aggiorna i test shiny (red)**

In `tests/ui/shinyCard.test.tsx`, il test "shows the epithet name and the trait chip" cerca `getByText(TRAIT_BY_ID['furia'].name)` sulla chip. Poiché la chip sparisce, il nome del tratto vive ora nel TOOLTIP. Sostituisci il primo test con:

```tsx
  it('shows the epithet name and exposes the trait via the shiny foil tooltip', () => {
    render(<WizardCardRow drafted={dw('harry', { traitId: 'furia' })} />)
    expect(screen.getByText('Harry Potter, il Furioso')).toBeInTheDocument()
    // nessuna pill tratto blu
    expect(screen.queryByTestId('trait-chip')).not.toBeInTheDocument()
    // il tratto è nel tooltip del marcatore foil
    fireEvent.click(screen.getByTestId('shiny-foil'))
    expect(screen.getByText(new RegExp(TRAIT_BY_ID['furia']!.name))).toBeInTheDocument()
  })
```

Import `fireEvent` da `@testing-library/react`.

Controlla anche `tests/ui/wizardCard.test.tsx`: se un test asserisce la presenza della pill tratto (`trait-chip` o `shinyTrait.name` come testo statico) sulla Column, aggiornalo allo stesso pattern (marcatore `data-testid="shiny-foil"` + tooltip). Cerca nel file `shiny`/`trait` prima di modificare.

- [ ] **Step 2: Lancia i test → devono fallire**

Run: `npx vitest run tests/ui/shinyCard.test.tsx --disable-console-intercept`
Expected: FAIL — `trait-chip` esiste ancora, `shiny-foil` non esiste.

- [ ] **Step 3: Column — sostituisci emoji ✨ con marcatore foil + rimuovi pill blu**

In `components/cards/WizardCardColumn.tsx`:

Righe 261-263 (nome + emoji), sostituisci il `<span>✨` con un marcatore foil avvolto in Tooltip:

```tsx
            {displayName(drafted)}
            {drafted.shiny && shinyTrait && (
              <Tooltip
                label="Cimelio raro"
                content={`${shinyTrait.name} — ${shinyTrait.desc}`}
                triggerClassName="ml-1.5 inline-flex align-middle"
              >
                <span
                  data-testid="shiny-foil"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    color: '#3a2a08',
                    background: 'linear-gradient(135deg, #ffe9a8, #d9a94a)',
                    boxShadow: '0 0 8px rgba(255,205,90,0.7), inset 0 1px 0 rgba(255,255,255,0.6)',
                  }}
                  aria-hidden
                >
                  ✦
                </span>
              </Tooltip>
            )}
```

Rimuovi l'intero blocco pill tratto blu (righe 272-282, il `{shinyTrait && (<div ...>...{shinyTrait.name}...</div>)}`). Cancellalo.

- [ ] **Step 4: Row — stesso trattamento**

In `components/cards/WizardCardRow.tsx`:

Riga 111 (nome + emoji), sostituisci il `<span>✨` con lo stesso marcatore foil:

```tsx
            {displayName(drafted)}
            {drafted.shiny && shinyTrait && (
              <Tooltip
                label="Cimelio raro"
                content={`${shinyTrait.name} — ${shinyTrait.desc}`}
                triggerClassName="ml-1.5 inline-flex align-middle"
              >
                <span
                  data-testid="shiny-foil"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    color: '#3a2a08',
                    background: 'linear-gradient(135deg, #ffe9a8, #d9a94a)',
                    boxShadow: '0 0 8px rgba(255,205,90,0.7), inset 0 1px 0 rgba(255,255,255,0.6)',
                  }}
                  aria-hidden
                >
                  ✦
                </span>
              </Tooltip>
            )}
```

Rimuovi il blocco pill tratto blu (righe 152-167, il `{shinyTrait && (<div ...>...Tratto...{shinyTrait.name}...</div>)}`). Cancellalo. (`Tooltip` è già importato nella Row.)

- [ ] **Step 5: Lancia i test → devono passare**

Run: `npx vitest run tests/ui/shinyCard.test.tsx tests/ui/wizardCard.test.tsx --disable-console-intercept`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 7: Commit**

```bash
git add components/cards/WizardCardColumn.tsx components/cards/WizardCardRow.tsx tests/ui/shinyCard.test.tsx tests/ui/wizardCard.test.tsx
git commit -m "feat(cards): shiny foil coeso — marcatore dorato + tooltip, via pill blu"
```

---

### Task 8: Verifica finale — suite piena + typecheck + run visivo

**Files:** nessuno (verifica).

- [ ] **Step 1: Suite completa**

Run: `npm run test`
Expected: verde (a parte lo skip pre-esistente). Se qualche test UI non aggiornato rompe per la nuova struttura Tooltip, sistemalo nel task pertinente.

- [ ] **Step 2: Typecheck globale**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Run visivo (skill `run`)**

Avvia l'app e apri la schermata di draft. Verifica a occhio:
- "Muro" appare SOLO sul nastro archetipo scudirigen e nel tracker Costellazioni. La pill del Tank dice "Bersaglio".
- Hover/tap su nastro, pill, role badge, righe tracker → appare il tooltip giusto.
- Un mago shiny mostra UN glow oro coeso (non doppio), il marcatore ✦ dorato accanto al nome (niente emoji ✨), nessuna pill blu; il tooltip del marcatore mostra nome+desc del tratto.

- [ ] **Step 4: Commit finale (se servono fix visivi)**

```bash
git add -A
git commit -m "fix(cards): rifiniture post-verifica visiva shiny/tooltip"
```

---

## Self-Review (compilata dall'autore del piano)

**Spec coverage:**
- Problema 1 (Muro) → Task 1 (pill), Task 2 (Row), Task 3 (roleTooltip). ✅ (extra: trovato "Muro" anche in `roleInfo.ts:10`, coperto).
- Problema 2 (tooltip) → Task 3 (helper), Task 4 (nastro+tracker), Task 5 (pill+role). ✅
- Problema 3 (shiny) → Task 6 (glow/token), Task 7 (pill blu→marcatore+tooltip). ✅

**Placeholder scan:** ogni step di codice mostra il codice reale. Le NOTE all'implementatore su helper di test (`dwWithTags`) rimandano al pattern esistente del file — non sono placeholder di produzione, ma richiedono al worker di ispezionare il file di test prima. ✅

**Type consistency:** `archetypeTooltip(tag: keyof typeof ARCHETYPE_BY_TAG)` usato coerentemente in Task 3/4; `SHINY_FOIL` (Task 6) usato in Task 6; `data-testid="shiny-foil"` coerente tra Task 7 e i test. ✅
