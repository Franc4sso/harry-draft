# Carta unica e schermate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire i tre componenti-carta con uno solo in tre densità, riscrivere il testo degli effetti, rendere sobrie le cornici di rarità, e rifare le quattro schermate di gioco perché entrino a 1366×768.

**Architecture:** Si costruisce dal basso: prima i testi (funzioni pure in `lib/`), poi i colori delle cornici (`lib/theme.ts`), poi le parti della carta come componenti minuscoli riusabili, poi la carta unica che li compone in tre densità, infine le quattro schermate che la consumano. Ogni strato è testabile da solo e i tre componenti vecchi vengono rimossi solo quando nessuno li importa più.

**Tech Stack:** TypeScript, React 19, Next 16, Tailwind 4, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-15-carta-unica-e-schermate-design.md`

## Global Constraints

- **Il ritratto non si rimpicciolisce mai** sotto i valori indicati per la sua densità: è una richiesta esplicita dell'utente, non una preferenza estetica.
- **La carta è identica in ogni schermata**: stessa struttura, stesso ordine delle informazioni, stessa scrittura degli effetti. Cambia solo la densità (`piena` / `media` / `riga`).
- **Le quattro schermate devono entrare a 1366×768** senza scorrimento verticale della pagina. Lo scorrimento interno di un pannello è ammesso; quello del documento no.
- **`components/ui/Tooltip.tsx` si riusa, non si riscrive.**
- **Nessun test va silenziato.** Dove un test asserisce testo o struttura che questo lavoro cambia, l'asserzione si aggiorna alla nuova realtà, con un commento che dice perché.
- **`npm run test` NON esegue il typecheck**: lanciare sempre `npm run typecheck` a parte.
- Non toccare il motore di combattimento, il bilanciamento, né `data/` (tranne dove esplicitamente indicato: nessun task lo prevede).
- Il progetto usa l'alias `@/` per la radice. Lanciare un singolo file: `npx vitest run <path>`.

---

## File Structure

| File | Responsabilità |
|---|---|
| `lib/spellText.ts` | **Creare.** Testo degli effetti, precisione e ricarica secondo la regola nuova. Funzioni pure. |
| `lib/abilityText.ts` | **Creare.** Testo dell'abilità personale come righe `{ valore, cosa }`. |
| `lib/theme.ts` | **Modificare.** `tierFrame` → cornici sobrie (un colore, un filo). |
| `components/cards/parts/SpellLine.tsx` | **Creare.** La riga magia: valore in colonna, nome, verbo, barra precisione, battito ricarica. |
| `components/cards/parts/StatBand.tsx` | **Creare.** La fascia coniata delle quattro statistiche. |
| `components/cards/parts/AbilitySeal.tsx` | **Creare.** Il sigillo dorato con tooltip. |
| `components/cards/parts/RarityPips.tsx` | **Creare.** Le quattro tacche di rarità. |
| `components/cards/WizardCard.tsx` | **Creare.** La carta unica, `density: 'full' | 'combat' | 'row'`. |
| `components/screens/DraftScreen.tsx` | **Modificare.** Layout «pesca A». |
| `components/screens/RecruitScreen.tsx` | **Modificare.** Layout «reclutamento A». |
| `components/screens/MapScreen.tsx` | **Modificare.** Layout «mappa C». |
| `components/screens/BattleScreen.tsx` | **Modificare.** Layout «battaglia A». |
| `components/cards/WizardCardColumn.tsx`, `WizardCardRow.tsx`, `components/battle/UnitBust.tsx` | **Rimuovere** (Task 11, solo quando nessuno li importa). |

---

## Task 1: Il testo degli effetti

**Files:**
- Create: `lib/spellText.ts`
- Test: `tests/lib/spellText.test.ts`

**Interfaces:**
- Consumes: `STATUS_BY_ID` da `@/data/statuses`; i tipi `Spell`, `SpellEffect`, `Stat` da `@/types/spell`.
- Produces:
  ```ts
  export interface SpellHeadline { value: string; unit: string }
  export function spellHeadline(spell: Spell): SpellHeadline
  export function spellVerb(spell: Spell): string
  export function spellAccuracy(spell: Spell): { pct: number; label: string }
  export function spellCadence(spell: Spell): { turns: number; label: string }
  ```

La regola, dallo spec: il numero apre la riga, niente gergo di sistema, «può» è una percentuale.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/spellText.test.ts
import { describe, it, expect } from 'vitest'
import { spellHeadline, spellVerb, spellAccuracy, spellCadence } from '@/lib/spellText'
import { SPELL_BY_ID } from '@/data/spells'

const spell = (id: string) => SPELL_BY_ID[id]!

describe('spellHeadline — il numero che apre la riga', () => {
  it('un attacco mostra il moltiplicatore di danno', () => {
    expect(spellHeadline(spell('bombarda'))).toEqual({ value: '×2', unit: 'danni' })
  })
  it('una cura mostra i punti vita', () => {
    expect(spellHeadline(spell('vulnera'))).toEqual({ value: '+48', unit: 'vita' })
  })
  it('un debuff di statistica mostra la statistica toccata', () => {
    expect(spellHeadline(spell('confundo'))).toEqual({ value: '−15', unit: 'vel' })
  })
  it('un controllo puro mostra la durata', () => {
    expect(spellHeadline(spell('petrificus'))).toEqual({ value: '1', unit: 'turno' })
  })
})

describe('spellVerb — cosa fa, senza gergo', () => {
  it('non dice mai "permanente, cumulativo"', () => {
    for (const s of Object.values(SPELL_BY_ID)) {
      expect(spellVerb(s)).not.toMatch(/permanente|cumulativo/i)
    }
  })
  it('non contiene mai parentesi annidate', () => {
    for (const s of Object.values(SPELL_BY_ID)) {
      expect(spellVerb(s)).not.toMatch(/\(.*\(/)
    }
  })
  it('usa "resta" per gli effetti permanenti', () => {
    expect(spellVerb(spell('confundo'))).toContain('resta')
  })
  it('concorda il singolare: mai "1 turni"', () => {
    for (const s of Object.values(SPELL_BY_ID)) {
      expect(spellVerb(s)).not.toMatch(/\b1 turni\b/)
    }
  })
})

describe('spellAccuracy e spellCadence', () => {
  it('la precisione è una percentuale intera', () => {
    expect(spellAccuracy(spell('confundo'))).toEqual({ pct: 90, label: '90%' })
  })
  it('una cura che non può mancare dice "sempre"', () => {
    expect(spellAccuracy(spell('vulnera')).label).toBe('sempre')
  })
  it('ricarica 1 significa "ogni 2 turni"', () => {
    expect(spellCadence(spell('confundo'))).toEqual({ turns: 2, label: 'ogni 2 turni' })
  })
  it('ricarica 0 significa "ogni turno"', () => {
    expect(spellCadence(spell('expelliarmus'))).toEqual({ turns: 1, label: 'ogni turno' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/spellText.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/spellText"`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/spellText.ts
import { STATUS_BY_ID } from '@/data/statuses'
import type { Spell, SpellEffect, Stat } from '@/types/spell'

/** Etichette brevi delle statistiche, minuscole: stanno SOTTO il numero, dove
 *  l'occhio le legge come unità di misura, non come intestazione. */
const STAT_UNIT: Record<Stat, string> = { hp: 'vita', atk: 'att', def: 'dif', spd: 'vel' }

/** Verbo per un debuff di statistica. Il numero lo precede già, quindi il verbo
 *  dice solo COSA succede, non quanto. */
const DEBUFF_VERB: Partial<Record<Stat, string>> = {
  spd: 'rallenta', atk: 'indebolisce', def: 'espone', hp: 'logora',
}

const CONTROL_VERB: Record<string, string> = {
  stun: 'stordisce', freeze: 'congela', silence: 'silenzia', disarm: 'disarma',
}

/** Il segno meno tipografico (U+2212), non il trattino: si allinea alle cifre
 *  ed è largo quanto un `+`, quindi le colonne di numeri restano dritte. */
const MINUS = '−'

function firstEffect(spell: Spell): SpellEffect | undefined {
  return spell.effects?.[0]
}

/** Il dato che il giocatore confronta fra due maghi, con la sua unità.
 *  Ordine di precedenza: danno → cura → modifica di statistica → durata del controllo. */
export function spellHeadline(spell: Spell): SpellHeadline {
  if (spell.power !== undefined) return { value: `×${spell.power}`, unit: 'danni' }
  if (spell.heal !== undefined) return { value: `+${spell.heal}`, unit: 'vita' }

  const e = firstEffect(spell)
  if (e && (e.kind === 'debuff' || e.kind === 'buff') && e.stat && e.amount !== undefined) {
    const sign = e.kind === 'buff' ? '+' : MINUS
    return { value: `${sign}${e.amount}`, unit: STAT_UNIT[e.stat] }
  }
  if (e && e.kind === 'dot' && e.amount !== undefined) {
    return { value: `${e.amount}`, unit: 'a turno' }
  }
  if (e && CONTROL_VERB[e.kind] && e.duration !== undefined) {
    return { value: `${e.duration}`, unit: e.duration === 1 ? 'turno' : 'turni' }
  }
  // Magie che agiscono solo via `spec` (scudi, status applicati): niente numero
  // da mettere in colonna, la riga si regge sul nome e sul verbo.
  return { value: '—', unit: '' }
}

export interface SpellHeadline { value: string; unit: string }

/** Cosa fa la magia, in parole. Mai gergo di sistema, mai parentesi annidate,
 *  e il singolare concorda (il vecchio testo diceva "per 1 turni"). */
export function spellVerb(spell: Spell): string {
  const parts: string[] = []

  for (const e of spell.effects ?? []) {
    if (e.kind === 'debuff' || e.kind === 'buff') {
      const verb = (e.stat && DEBUFF_VERB[e.stat]) ?? 'altera'
      // Gli effetti di statistica sono permanenti e cumulativi (data/statuses.ts):
      // al giocatore basta sapere che l'effetto RESTA.
      parts.push(`${verb}, e resta`)
    } else if (e.kind === 'dot') {
      const d = e.duration ?? 1
      parts.push(`brucia ${e.amount ?? 0} per ${d} ${d === 1 ? 'turno' : 'turni'}`)
    } else if (CONTROL_VERB[e.kind]) {
      const d = e.duration ?? 1
      parts.push(`${CONTROL_VERB[e.kind]} ${d} ${d === 1 ? 'turno' : 'turni'}`)
    }
  }

  for (const s of spell.spec ?? []) {
    if (s.kind === 'shield') { parts.push('assorbe danno'); continue }
    if (s.kind !== 'applyStatus' || !s.statusId) continue
    const def = STATUS_BY_ID[s.statusId]
    if (!def) continue
    if (def.kind === 'buff' || def.kind === 'debuff') {
      const verb = (def.statMod?.stat && DEBUFF_VERB[def.statMod.stat]) ?? 'altera'
      parts.push(`${verb}, e resta`)
    } else {
      const d = s.duration ?? def.defaultDuration ?? 1
      const verb = CONTROL_VERB[def.kind] ?? def.name.toLowerCase()
      parts.push(`${verb} ${d} ${d === 1 ? 'turno' : 'turni'}`)
    }
  }

  if (spell.revive !== undefined) {
    parts.push(`rianima al ${Math.round(spell.revive * 100)}% di vita`)
  }

  // Nessun effetto meccanico: resta la descrizione d'autore, che per le magie
  // di solo danno è già breve ("Esplosione concussiva").
  if (parts.length === 0) return spell.desc ?? ''
  return parts.join(', ')
}

/** La precisione. Una magia che non può mancare dice «sempre»: un «100%»
 *  inviterebbe a confrontarlo con un 95%, ma non è la stessa cosa. */
export function spellAccuracy(spell: Spell): { pct: number; label: string } {
  const pct = Math.round(spell.hitChance * 100)
  return { pct, label: pct >= 100 ? 'sempre' : `${pct}%` }
}

/** Il ritmo reale. `cooldown: 1` significa un turno di attesa, quindi la magia
 *  si lancia OGNI DUE turni: dirlo com'è evita l'ambiguità di «Ricarica: 1». */
export function spellCadence(spell: Spell): { turns: number; label: string } {
  const turns = (spell.cooldown ?? 0) + 1
  return { turns, label: turns === 1 ? 'ogni turno' : `ogni ${turns} turni` }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/spellText.test.ts`
Expected: PASS. Se un caso fallisce perché una magia reale ha una forma non prevista, **non cambiare il test**: aggiungere il ramo mancante in `spellVerb`/`spellHeadline` e annotarlo.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add lib/spellText.ts tests/lib/spellText.test.ts
git commit -m "feat(carta): testo degli effetti — il numero apre, niente gergo"
```

---

## Task 2: Il testo dell'abilità personale

**Files:**
- Create: `lib/abilityText.ts`
- Test: `tests/lib/abilityText.test.ts`

**Interfaces:**
- Consumes: `abilityFor(id: string): { name: string; blurb: string } | undefined` da `@/lib/wizardAbilities`.
- Produces:
  ```ts
  export interface AbilityLine { value: string; what: string }
  export interface AbilityText { name: string; lines: AbilityLine[] }
  export function abilityText(wizardId: string): AbilityText | undefined
  ```

Le 15 firme hanno descrizioni in prosa (`data/signatures.ts`). Qui diventano righe `numero + cosa`, come da spec. Poiché sono solo 15 e i testi sono scritti a mano, la mappa è esplicita: un parser di prosa sarebbe fragile e imprevedibile.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/abilityText.test.ts
import { describe, it, expect } from 'vitest'
import { abilityText } from '@/lib/abilityText'
import { SIGNATURES } from '@/data/signatures'

describe('abilityText', () => {
  it('un mago senza firma non ha testo', () => {
    expect(abilityText('goyle')).toBeUndefined()
  })

  it('ogni firma del catalogo ha un testo riscritto', () => {
    for (const sig of SIGNATURES) {
      const t = abilityText(sig.id)
      expect(t, `manca il testo per la firma "${sig.id}"`).toBeDefined()
      expect(t!.name).toBe(sig.name)
      expect(t!.lines.length).toBeGreaterThan(0)
    }
  })

  it('ogni riga apre con un numero', () => {
    for (const sig of SIGNATURES) {
      for (const line of abilityText(sig.id)!.lines) {
        expect(line.value, `firma "${sig.id}"`).toMatch(/[0-9]/)
      }
    }
  })

  it('nessuna riga usa "possono" — le probabilità sono numeri', () => {
    for (const sig of SIGNATURES) {
      for (const line of abilityText(sig.id)!.lines) {
        expect(line.what).not.toMatch(/possono|può/i)
      }
    }
  })

  it('Voldemort ha due righe: esecuzione e terrore', () => {
    const t = abilityText('voldemort')!
    expect(t.lines).toEqual([
      { value: '+50%', what: 'danni sotto il 40% di vita' },
      { value: '35%', what: 'semina terrore (−ATT)' },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/abilityText.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/abilityText"`.

- [ ] **Step 3: Write the implementation**

Prima leggere le 15 firme: `grep -n "sig('" data/signatures.ts`. Poi scrivere la mappa, una voce per firma, traducendo la prosa in righe `valore + cosa`.

```ts
// lib/abilityText.ts
import { abilityFor } from '@/lib/wizardAbilities'

export interface AbilityLine { value: string; what: string }
export interface AbilityText { name: string; lines: AbilityLine[] }

/**
 * Le firme riscritte come righe «numero + cosa», una voce per ognuna delle 15
 * firme del catalogo (data/signatures.ts).
 *
 * È una mappa esplicita e non un parser della prosa: i testi delle firme sono
 * scritti a mano, ognuno con una forma diversa, e un parser produrrebbe risultati
 * imprevedibili proprio sulle carte più importanti del gioco. Il test
 * `tests/lib/abilityText.test.ts` verifica che ogni firma del catalogo abbia la
 * sua voce, quindi aggiungerne una nuova senza testo rompe la suite.
 *
 * Chiave = id del mago (lo stesso di `SIGNATURE_BY_ID`).
 */
const LINES: Record<string, AbilityLine[]> = {
  dumbledore: [
    { value: '+30%', what: 'danni' },
    { value: '40%', what: 'stordisce chi colpisce' },
  ],
  voldemort: [
    { value: '+50%', what: 'danni sotto il 40% di vita' },
    { value: '35%', what: 'semina terrore (−ATT)' },
  ],
  harry: [
    { value: '+70%', what: 'danni al massimo, più è ferito' },
    { value: '50%', what: 'sotto metà vita si rigenera' },
  ],
  snape: [
    { value: '55%', what: 'avvelena chi colpisce' },
    { value: '35%', what: 'espone la difesa' },
  ],
  bellatrix: [
    { value: '40%', what: 'stordisce chi colpisce' },
  ],
  mcgonagall: [
    { value: '−30%', what: 'danni subiti' },
  ],
}

/** L'abilità personale come righe pronte da mostrare, o `undefined` per i 45
 *  maghi senza firma. Chi la consuma salta il blocco: mai un segnaposto. */
export function abilityText(wizardId: string): AbilityText | undefined {
  const sig = abilityFor(wizardId)
  if (!sig) return undefined
  const lines = LINES[wizardId]
  if (!lines) return undefined
  return { name: sig.name, lines }
}
```

**Nota per l'implementatore:** la mappa qui sopra copre 6 delle 15 firme. Le altre 9 vanno lette da `data/signatures.ts` (`grep -n "sig('" data/signatures.ts` le elenca tutte) e tradotte con la stessa regola: un numero per riga, il verbo dopo, mai «può». Il test del passo 1 fallisce finché non ci sono tutte.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/abilityText.test.ts`
Expected: PASS — 5 test.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add lib/abilityText.ts tests/lib/abilityText.test.ts
git commit -m "feat(carta): abilita personali come righe numero+cosa"
```

---

## Task 3: Cornici sobrie

**Files:**
- Modify: `lib/theme.ts:45-110` (la funzione `tierFrame`)
- Test: `tests/lib/tierFrame.test.ts`

**Interfaces:**
- Consumes: il tipo `Tier` da `@/types`.
- Produces: stessa firma di oggi, con un campo in più —
  ```ts
  export function tierFrame(tier: Tier): {
    background: string; boxShadow: string; keyline: string; pips: number
  }
  ```
  `pips` è il numero di tacche accese (1 per comune … 4 per leggendario), consumato da `RarityPips` nel Task 7.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/tierFrame.test.ts
import { describe, it, expect } from 'vitest'
import { tierFrame } from '@/lib/theme'
import type { Tier } from '@/types'

const TIERS: Tier[] = [1, 2, 3, 4]

describe('tierFrame — cornici sobrie', () => {
  it('nessuna cornice usa un gradiente metallico a più di due stop', () => {
    for (const t of TIERS) {
      const stops = (tierFrame(t).background.match(/#[0-9a-f]{3,8}/gi) ?? []).length
      expect(stops, `tier ${t} ha ${stops} colori nel background`).toBeLessThanOrEqual(2)
    }
  })

  it('nessun alone supera i 20px', () => {
    for (const t of TIERS) {
      const blurs = [...tierFrame(t).boxShadow.matchAll(/(\d+)px\s+rgba/g)].map(m => Number(m[1]))
      for (const b of blurs) expect(b, `tier ${t}`).toBeLessThanOrEqual(20)
    }
  })

  it('le rarità basse non hanno alcun alone colorato', () => {
    for (const t of [3, 4] as Tier[]) {
      expect(tierFrame(t).boxShadow).not.toMatch(/rgba\((?!0,\s*0,\s*0)/)
    }
  })

  it('ogni rarità ha un numero di tacche crescente', () => {
    expect(tierFrame(4).pips).toBe(1)
    expect(tierFrame(3).pips).toBe(2)
    expect(tierFrame(2).pips).toBe(3)
    expect(tierFrame(1).pips).toBe(4)
  })

  it('ogni rarità ha una keyline diversa dalle altre', () => {
    const keys = TIERS.map(t => tierFrame(t).keyline)
    expect(new Set(keys).size).toBe(4)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/tierFrame.test.ts`
Expected: FAIL — il gradiente attuale ha 5-6 stop e `pips` non esiste.

- [ ] **Step 3: Rewrite `tierFrame`**

Sostituire l'intero corpo della funzione (da `case 4:` al `default`) con:

```ts
  // CORNICI SOBRIE (2026-09-15). Le precedenti imitavano il metallo: gradienti a
  // sei stop, bordi smussati da 9px e, sulla leggendaria, SETTE ombre sovrapposte
  // con aloni da 46 e 110px. Tre carte affiancate producevano una nebbia luminosa
  // e la cornice vinceva sull'attenzione contro il ritratto.
  //
  // Regola nuova, indicata dall'utente («come per i numeri degli HP»): un colore
  // per rarità e un filo da 1px. Quello che cambia fra comune e leggendaria è la
  // TINTA, non la quantità di effetti. L'alone resta solo sulle due rarità alte,
  // e a 18px: basta a far staccare una leggendaria in mezzo alle altre.
  const DEEP = '0 10px 26px rgba(0,0,0,.5)'
  switch (tier) {
    case 4: // COMUNE — peltro spento, nessun alone.
      return {
        background: 'rgba(154,163,173,.34)',
        boxShadow: DEEP,
        keyline: 'rgba(154,163,173,.26)',
        pips: 1,
      }
    case 3: // RARO — azzurro freddo, nessun alone.
      return {
        background: 'rgba(127,178,232,.44)',
        boxShadow: DEEP,
        keyline: 'rgba(127,178,232,.3)',
        pips: 2,
      }
    case 2: // EPICO — ametista, alone appena percepibile.
      return {
        background: 'rgba(185,140,255,.5)',
        boxShadow: `0 0 18px rgba(185,140,255,.16), ${DEEP}`,
        keyline: 'rgba(185,140,255,.34)',
        pips: 3,
      }
    case 1: // LEGGENDARIO — oro, stesso alone dell'epico.
      return {
        background: 'rgba(232,180,74,.58)',
        boxShadow: `0 0 18px rgba(232,180,74,.18), ${DEEP}`,
        keyline: 'rgba(232,180,74,.4)',
        pips: 4,
      }
    default: // Fixture di test senza tier: legge come comune.
      return {
        background: 'rgba(154,163,173,.34)',
        boxShadow: DEEP,
        keyline: 'rgba(154,163,173,.26)',
        pips: 1,
      }
  }
```

Aggiornare anche il tipo di ritorno nella firma, aggiungendo `pips: number`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/tierFrame.test.ts`
Expected: PASS — 5 test.

- [ ] **Step 5: Verificare chi altro usa `tierFrame`**

Run: `grep -rn "tierFrame" --include=*.ts --include=*.tsx . | grep -v node_modules`
La cornice era applicata con `padding: 9px` in `WizardCardColumn`. Quel file viene sostituito nel Task 8; qui basta che il typecheck passi.

Run: `npm run typecheck` — Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add lib/theme.ts tests/lib/tierFrame.test.ts
git commit -m "feat(carta): cornici sobrie — un colore per rarita, un filo"
```

---

## Task 4: La riga magia

**Files:**
- Create: `components/cards/parts/SpellLine.tsx`
- Test: `tests/cards/SpellLine.test.tsx`

**Interfaces:**
- Consumes: `spellHeadline`, `spellVerb`, `spellAccuracy`, `spellCadence` da `@/lib/spellText` (Task 1); `SPELL_TYPE_META` da `@/lib/glossary`.
- Produces:
  ```tsx
  export function SpellLine({ spell, compact }: { spell: Spell; compact?: boolean }): JSX.Element
  ```
  `compact` omette il verbo (densità «media», in battaglia).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/cards/SpellLine.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SpellLine } from '@/components/cards/parts/SpellLine'
import { SPELL_BY_ID } from '@/data/spells'

describe('SpellLine', () => {
  it('mostra il valore, il nome e il ritmo', () => {
    render(<SpellLine spell={SPELL_BY_ID['confundo']!} />)
    expect(screen.getByTestId('spell-headline')).toHaveTextContent('−15')
    expect(screen.getByTestId('spell-headline')).toHaveTextContent('vel')
    expect(screen.getByText('Confundo')).toBeInTheDocument()
    expect(screen.getByTestId('spell-cadence')).toHaveTextContent('2')
  })

  it('la barra di precisione è larga quanto la percentuale', () => {
    render(<SpellLine spell={SPELL_BY_ID['avada']!} />)
    const bar = screen.getByTestId('spell-accuracy-bar')
    expect(bar.style.width).toBe('60%')
  })

  it('in forma compatta il verbo sparisce ma il valore resta', () => {
    render(<SpellLine spell={SPELL_BY_ID['confundo']!} compact />)
    expect(screen.getByTestId('spell-headline')).toHaveTextContent('−15')
    expect(screen.queryByTestId('spell-verb')).not.toBeInTheDocument()
  })

  it('non mostra mai il gergo di sistema', () => {
    const { container } = render(<SpellLine spell={SPELL_BY_ID['confundo']!} />)
    expect(container.textContent).not.toMatch(/permanente|cumulativo/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cards/SpellLine.test.tsx`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Write the implementation**

```tsx
// components/cards/parts/SpellLine.tsx
import type { Spell } from '@/types'
import { SPELL_TYPE_META } from '@/lib/glossary'
import { spellHeadline, spellVerb, spellAccuracy, spellCadence } from '@/lib/spellText'

/**
 * La riga della magia. Il valore che il giocatore confronta esce dalla frase e
 * prende una COLONNA FISSA a sinistra, numero grande con l'unità sotto — la
 * stessa forma della fascia delle statistiche in fondo alla carta.
 *
 * Perché: con `nome · valore · verbo` su una riga sola, i nomi da 6 a 18 caratteri
 * mandavano la riga a capo in un punto diverso per ogni magia, e il valore finiva
 * ogni volta altrove. In colonna resta allineato fra carte affiancate.
 */
export function SpellLine({ spell, compact }: { spell: Spell; compact?: boolean }) {
  const head = spellHeadline(spell)
  const verb = spellVerb(spell)
  const acc = spellAccuracy(spell)
  const cad = spellCadence(spell)
  const accent = SPELL_TYPE_META[spell.type].color
  // Sotto il 70% la precisione è un rischio, non un dettaglio: si tinge di rosso
  // così «rischiosa» si legge prima del numero.
  const risky = acc.pct < 70

  return (
    <div className="relative flex items-start gap-2.5 px-3 pb-2.5 pt-3">
      <span
        aria-hidden
        className="absolute inset-x-3 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.14) 22%, rgba(255,255,255,.14) 78%, transparent)' }}
      />
      <span data-testid="spell-headline" className="min-w-[46px] shrink-0 text-center">
        <span className="block text-[17px] font-black tabular-nums leading-none" style={{ color: accent }}>
          {head.value}
        </span>
        {head.unit && (
          <span className="mt-1 block text-[7.5px] font-bold uppercase tracking-[.11em] text-white/35">
            {head.unit}
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block break-words font-display text-[13px] font-extrabold leading-tight text-white">
          {spell.name}
        </span>
        {!compact && verb && (
          <span data-testid="spell-verb" className="mt-1 block text-[10px] leading-snug text-white/60">
            {verb}
          </span>
        )}
        <span className="mt-1.5 flex items-center gap-1.5 text-[9px] font-bold tabular-nums text-white/35">
          <span className={risky ? 'text-[#ffb4b4]' : 'text-white/80'}>{acc.label}</span>
          <span className="h-[2.5px] min-w-[18px] flex-1 overflow-hidden rounded-sm bg-white/10">
            <i
              data-testid="spell-accuracy-bar"
              className="block h-full rounded-sm"
              style={{ width: `${acc.pct}%`, background: risky ? '#f07272' : accent }}
            />
          </span>
          <span data-testid="spell-cadence" className="flex items-center gap-[2.5px]" title={cad.label}>
            {Array.from({ length: cad.turns }, (_, i) => (
              <s
                key={i}
                aria-hidden
                className="h-[3.5px] w-[3.5px] rounded-full no-underline"
                style={{ background: i === 0 ? accent : 'currentColor', opacity: i === 0 ? 1 : .3 }}
              />
            ))}
            <span className="sr-only">{cad.label}</span>
          </span>
        </span>
      </span>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cards/SpellLine.test.tsx`
Expected: PASS — 4 test.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck` — Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add components/cards/parts/SpellLine.tsx tests/cards/SpellLine.test.tsx
git commit -m "feat(carta): SpellLine — il valore in colonna fissa"
```

---

## Task 5: La fascia coniata delle statistiche

**Files:**
- Create: `components/cards/parts/StatBand.tsx`
- Test: `tests/cards/StatBand.test.tsx`

**Interfaces:**
- Consumes: il tipo `Stats` da `@/types`.
- Produces:
  ```tsx
  export function StatBand({ stats, currentHp }: { stats: Stats; currentHp?: number }): JSX.Element
  ```
  Con `currentHp` la cella HP mostra `49/68` invece del solo massimo (densità «media», in battaglia).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/cards/StatBand.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatBand } from '@/components/cards/parts/StatBand'

const stats = { hp: 78, atk: 19, def: 14, spd: 28 }

describe('StatBand', () => {
  it('mostra le quattro statistiche', () => {
    render(<StatBand stats={stats} />)
    for (const v of ['78', '19', '14', '28']) expect(screen.getByText(v)).toBeInTheDocument()
    for (const k of ['HP', 'ATT', 'DIF', 'VEL']) expect(screen.getByText(k)).toBeInTheDocument()
  })

  it('con currentHp mostra vita attuale e massima', () => {
    render(<StatBand stats={stats} currentHp={49} />)
    expect(screen.getByText('49/78')).toBeInTheDocument()
  })

  it('le quattro celle sono sempre nello stesso ordine', () => {
    render(<StatBand stats={stats} />)
    const keys = [...screen.getByTestId('stat-band').querySelectorAll('[data-stat]')]
      .map(e => e.getAttribute('data-stat'))
    expect(keys).toEqual(['hp', 'atk', 'def', 'spd'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cards/StatBand.test.tsx`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Write the implementation**

```tsx
// components/cards/parts/StatBand.tsx
import type { Stats } from '@/types'

/** I quattro colori delle statistiche, invariati rispetto a oggi: sono il
 *  riferimento che l'utente ha indicato per la sobrietà di tutto il resto. */
const CELLS = [
  { key: 'hp', label: 'HP', color: '#7cdc7d' },
  { key: 'atk', label: 'ATT', color: '#f08a8a' },
  { key: 'def', label: 'DIF', color: '#8ab6f0' },
  { key: 'spd', label: 'VEL', color: '#f0d48a' },
] as const

/**
 * Le statistiche come fascia coniata al piede della carta: quattro celle divise
 * da tacche sottili, numeri in cifre tabulari.
 *
 * `mt-auto` la incolla al fondo, così tre carte affiancate hanno la fascia alla
 * stessa altezza anche se la magia di una occupa una riga in più.
 */
export function StatBand({ stats, currentHp }: { stats: Stats; currentHp?: number }) {
  return (
    <div
      data-testid="stat-band"
      className="mt-auto grid grid-cols-4 border-t border-white/10 bg-black/30"
    >
      {CELLS.map((c, i) => (
        <div key={c.key} data-stat={c.key} className="relative px-0.5 pb-2.5 pt-2 text-center">
          {i > 0 && <span aria-hidden className="absolute inset-y-[26%] left-0 w-px bg-white/10" />}
          <span className="block text-[7.5px] font-extrabold uppercase tracking-[.12em] text-white/40">
            {c.label}
          </span>
          <span className="mt-1 block text-[15px] font-black tabular-nums" style={{ color: c.color }}>
            {c.key === 'hp' && currentHp !== undefined ? `${currentHp}/${stats.hp}` : stats[c.key]}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cards/StatBand.test.tsx`
Expected: PASS — 3 test.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck` — Expected: nessun errore.

```bash
git add components/cards/parts/StatBand.tsx tests/cards/StatBand.test.tsx
git commit -m "feat(carta): StatBand — le statistiche coniate al piede"
```

---

## Task 6: Il sigillo dell'abilità

**Files:**
- Create: `components/cards/parts/AbilitySeal.tsx`
- Test: `tests/cards/AbilitySeal.test.tsx`

**Interfaces:**
- Consumes: `abilityText(wizardId)` da `@/lib/abilityText` (Task 2); `Tooltip` da `@/components/ui/Tooltip`.
- Produces:
  ```tsx
  export function AbilitySeal({ wizardId }: { wizardId: string }): JSX.Element | null
  ```
  Ritorna `null` per i 45 maghi senza firma: nessun segnaposto.

**Firma reale di `Tooltip`** (da `components/ui/Tooltip.tsx`, verificata):
```tsx
Tooltip({ content, label, className, triggerClassName, children }: {
  content: ReactNode; label?: string; className?: string
  triggerClassName?: string; children: ReactNode
})
```

- [ ] **Step 1: Write the failing test**

```tsx
// tests/cards/AbilitySeal.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AbilitySeal } from '@/components/cards/parts/AbilitySeal'

describe('AbilitySeal', () => {
  it('un mago senza firma non mostra nulla', () => {
    const { container } = render(<AbilitySeal wizardId="goyle" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('un mago con firma mostra il sigillo', () => {
    render(<AbilitySeal wizardId="voldemort" />)
    expect(screen.getByTestId('ability-seal')).toBeInTheDocument()
  })

  it('il testo compare solo dopo interazione', async () => {
    render(<AbilitySeal wizardId="voldemort" />)
    expect(screen.queryByText('Terrore Immortale')).not.toBeInTheDocument()
    await userEvent.click(screen.getByTestId('ability-seal'))
    expect(screen.getByText('Terrore Immortale')).toBeInTheDocument()
    expect(screen.getByText('+50%')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cards/AbilitySeal.test.tsx`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Write the implementation**

```tsx
// components/cards/parts/AbilitySeal.tsx
import { Tooltip } from '@/components/ui/Tooltip'
import { abilityText } from '@/lib/abilityText'

/**
 * L'abilità personale come sigillo di ceralacca sul ritratto, col testo in tooltip.
 *
 * Perché non una riga di testo sulla carta: l'abilità occupava 62px sulla carta di
 * un mago su quattro (solo 15 maghi su 60 hanno una firma), e su una leggendaria
 * con due effetti diventava la riga più alta della metà bassa. Il sigillo vive
 * SOPRA il ritratto, in un angolo già scuro: la carta col sigillo è alta quanto
 * una carta senza abilità.
 *
 * Resta comunque VISIBILE che quel mago ha qualcosa di speciale — le firme sono
 * attive in combattimento (registerSignatures in simulate.ts), non decorative —
 * ma il testo arriva solo a richiesta. Un sigillo che compare di rado viene notato.
 */
export function AbilitySeal({ wizardId }: { wizardId: string }) {
  const ability = abilityText(wizardId)
  if (!ability) return null

  return (
    <Tooltip
      label={`Abilità personale: ${ability.name}`}
      className="absolute bottom-[70px] left-2.5 z-20"
      triggerClassName="flex h-7 w-7 items-center justify-center rounded-full text-[12px] text-[#2a1d05] transition-transform hover:scale-110 focus-visible:scale-110"
      content={
        <span className="block w-52">
          <span className="text-[8.5px] font-extrabold uppercase tracking-[.14em] text-[#caa24a]">
            Abilità personale
          </span>
          <span className="mt-1.5 block font-display text-[13.5px] font-bold text-[#f3e6a0]">
            {ability.name}
          </span>
          {ability.lines.map(l => (
            <span key={l.value + l.what} className="mt-1.5 flex items-baseline gap-1.5 text-[11.5px]">
              <b className="text-[12px] font-black tabular-nums text-[#ffe9a8]">{l.value}</b>
              <span className="text-white/60">{l.what}</span>
            </span>
          ))}
        </span>
      }
    >
      <span
        data-testid="ability-seal"
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-full"
        style={{
          background: 'linear-gradient(160deg, #f0d9a0, #c9a24a)',
          boxShadow: '0 2px 8px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.45)',
        }}
      >
        ✦
      </span>
    </Tooltip>
  )
}
```

**Nota:** se il test «il testo compare solo dopo interazione» fallisce perché `Tooltip` rende il contenuto sempre nel DOM, leggere `components/ui/Tooltip.tsx` e adattare l'asserzione al comportamento reale (per esempio `toBeVisible` invece di `toBeInTheDocument`) — **senza** modificare `Tooltip`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cards/AbilitySeal.test.tsx`
Expected: PASS — 3 test.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck` — Expected: nessun errore.

```bash
git add components/cards/parts/AbilitySeal.tsx tests/cards/AbilitySeal.test.tsx
git commit -m "feat(carta): AbilitySeal — sigillo sul ritratto, testo a richiesta"
```

---

## Task 7: Le tacche di rarità

**Files:**
- Create: `components/cards/parts/RarityPips.tsx`
- Test: `tests/cards/RarityPips.test.tsx`

**Interfaces:**
- Consumes: `tierFrame(tier).pips` e `.keyline` da `@/lib/theme` (Task 3).
- Produces:
  ```tsx
  export function RarityPips({ tier }: { tier: Tier }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// tests/cards/RarityPips.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RarityPips } from '@/components/cards/parts/RarityPips'
import type { Tier } from '@/types'

describe('RarityPips', () => {
  it('disegna sempre quattro tacche', () => {
    for (const t of [1, 2, 3, 4] as Tier[]) {
      const { unmount } = render(<RarityPips tier={t} />)
      expect(screen.getByTestId('rarity-pips').children).toHaveLength(4)
      unmount()
    }
  })

  it('accende una tacca per il comune e quattro per il leggendario', () => {
    const lit = (t: Tier) => {
      const { container, unmount } = render(<RarityPips tier={t} />)
      const n = container.querySelectorAll('[data-lit="true"]').length
      unmount()
      return n
    }
    expect(lit(4)).toBe(1)
    expect(lit(1)).toBe(4)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cards/RarityPips.test.tsx`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Write the implementation**

```tsx
// components/cards/parts/RarityPips.tsx
import type { Tier } from '@/types'
import { tierFrame } from '@/lib/theme'

/**
 * Le tacche di rarità in cima al ritratto: quattro pallini, accesi quanti ne vale
 * la rarità. Sostituiscono la corona, che segnava solo le leggendarie e lasciava
 * indistinte le altre tre — qui il livello si conta a colpo d'occhio per tutte.
 */
export function RarityPips({ tier }: { tier: Tier }) {
  const { pips, keyline } = tierFrame(tier)
  return (
    <span
      data-testid="rarity-pips"
      aria-label={`Rarità ${pips} su 4`}
      className="absolute left-1/2 top-0 z-10 flex -translate-x-1/2 gap-[3px] rounded-b-md bg-[rgba(8,6,15,.72)] px-2 pb-1 pt-1.5"
    >
      {[0, 1, 2, 3].map(i => (
        <span
          key={i}
          data-lit={i < pips}
          className="block h-[3.5px] w-[3.5px] rounded-full"
          style={{ background: i < pips ? keyline : 'rgba(255,255,255,.16)' }}
        />
      ))}
    </span>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cards/RarityPips.test.tsx`
Expected: PASS — 2 test.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck` — Expected: nessun errore.

```bash
git add components/cards/parts/RarityPips.tsx tests/cards/RarityPips.test.tsx
git commit -m "feat(carta): RarityPips — quattro tacche invece della corona"
```

---

## Task 8: La carta unica

**Files:**
- Create: `components/cards/WizardCard.tsx`
- Test: `tests/cards/WizardCard.test.tsx`

**Interfaces:**
- Consumes: `SpellLine` (Task 4), `StatBand` (Task 5), `AbilitySeal` (Task 6), `RarityPips` (Task 7), `tierFrame` (Task 3); `displayName` da `@/lib/displayName`; `ROLE_ACCENT` da `@/lib/roleInfo`; `PortraitImage` da `@/components/ui/PortraitImage`.
- Produces:
  ```tsx
  export type CardDensity = 'full' | 'combat' | 'row'
  export function WizardCard(props: {
    drafted: DraftedWizard
    density?: CardDensity       // default 'full'
    currentHp?: number          // mostra la barra vita (density 'combat' e 'row')
    selected?: boolean
    onClick?: () => void
    className?: string
    testId?: string
    portraitHeight?: number     // default per densità: full 240, combat 118, row —
  }): JSX.Element
  ```

Altezze del ritratto per densità (dallo spec): `full` 240px (le schermate possono alzarlo fino a 330), `combat` 118px, `row` ritratto a lato largo 54px.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/cards/WizardCard.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WizardCard } from '@/components/cards/WizardCard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS } from '@/data/wizards'

const drafted = (id: string) =>
  draftWizard(createRng(`wc-${id}`), WIZARDS.find(w => w.id === id)!, false)

describe('WizardCard', () => {
  it('mostra nome, magia e statistiche in densità piena', () => {
    const d = drafted('hermione')
    render(<WizardCard drafted={d} />)
    expect(screen.getByText(/Hermione/)).toBeInTheDocument()
    expect(screen.getByTestId('spell-headline')).toBeInTheDocument()
    expect(screen.getByTestId('stat-band')).toBeInTheDocument()
  })

  it('le tre densità mostrano tutte nome e statistiche', () => {
    for (const density of ['full', 'combat', 'row'] as const) {
      const { unmount } = render(<WizardCard drafted={drafted('hermione')} density={density} />)
      expect(screen.getByTestId('stat-band'), density).toBeInTheDocument()
      expect(screen.getByText(/Hermione/), density).toBeInTheDocument()
      unmount()
    }
  })

  it('la barra della vita compare solo con currentHp', () => {
    const d = drafted('hermione')
    const { unmount } = render(<WizardCard drafted={d} density="combat" />)
    expect(screen.queryByTestId('card-hp-bar')).not.toBeInTheDocument()
    unmount()
    render(<WizardCard drafted={d} density="combat" currentHp={40} />)
    expect(screen.getByTestId('card-hp-bar')).toBeInTheDocument()
  })

  it('in densità combat la descrizione della magia sparisce', () => {
    render(<WizardCard drafted={drafted('hermione')} density="combat" />)
    expect(screen.queryByTestId('spell-verb')).not.toBeInTheDocument()
  })

  it('il sigillo compare solo per i maghi con firma', () => {
    const { unmount } = render(<WizardCard drafted={drafted('goyle')} />)
    expect(screen.queryByTestId('ability-seal')).not.toBeInTheDocument()
    unmount()
    render(<WizardCard drafted={drafted('voldemort')} />)
    expect(screen.getByTestId('ability-seal')).toBeInTheDocument()
  })

  it('è cliccabile solo quando ha un onClick', () => {
    const { unmount } = render(<WizardCard drafted={drafted('hermione')} testId="c1" />)
    expect(screen.getByTestId('c1')).not.toHaveAttribute('role', 'button')
    unmount()
    render(<WizardCard drafted={drafted('hermione')} testId="c2" onClick={() => {}} />)
    expect(screen.getByTestId('c2')).toHaveAttribute('role', 'button')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cards/WizardCard.test.tsx`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Write the implementation**

Struttura, dall'esterno all'interno:
1. **cornice** — `padding: 1px`, `background: tierFrame(tier).background`, `boxShadow`, `borderRadius: 15px`;
2. **lastra** — `borderRadius: 14px`, `overflow: hidden`, `flex flex-col`, sfondo `linear-gradient(180deg,#141223,#0c0a17)`;
3. **ritratto** — altezza per densità, con `RarityPips` in alto, l'archetipo in alto a destra, `AbilitySeal`, e la targa del nome in basso (ruolo come epigrafe sopra il nome);
4. **barra vita** — solo con `currentHp`;
5. **`SpellLine`** — `compact` quando `density !== 'full'`;
6. **`StatBand`** — con `currentHp` quando presente.

Per `density === 'row'` la lastra è `flex-row`: ritratto largo 54px a sinistra, e a destra nome, barra vita e una riga di statistiche compatta (non `StatBand`, che è una griglia a quattro colonne: in riga si usa `StatBand` con `className` orizzontale — vedi sotto).

```tsx
// components/cards/WizardCard.tsx
'use client'
import type { DraftedWizard, Tier } from '@/types'
import { tierFrame } from '@/lib/theme'
import { displayName } from '@/lib/displayName'
import { ROLE_ACCENT } from '@/lib/roleInfo'
import { primaryArchetype } from '@/lib/archetypes'
import { tagsOf } from '@/game/engine/roster'
import { SpellLine } from './parts/SpellLine'
import { StatBand } from './parts/StatBand'
import { AbilitySeal } from './parts/AbilitySeal'
import { RarityPips } from './parts/RarityPips'

export type CardDensity = 'full' | 'combat' | 'row'

const PORTRAIT: Record<CardDensity, number> = { full: 240, combat: 118, row: 0 }

/**
 * LA carta del mago — una sola, identica in ogni schermata (requisito esplicito
 * dell'utente). Prima erano tre componenti distinti (WizardCardColumn,
 * WizardCardRow, UnitBust) che disegnavano lo stesso mago in tre modi diversi.
 *
 * Cambia solo la DENSITÀ, cioè quanto mostra:
 *   full   — pesca e reclutamento: ritratto grande, magia con descrizione
 *   combat — battaglia: + barra vita, − descrizione della magia
 *   row    — squadra, mappa, anteprima nemici: ritratto a lato, dati in riga
 * Struttura, ordine delle informazioni e scrittura degli effetti restano gli stessi.
 */
export function WizardCard({
  drafted, density = 'full', currentHp, selected, onClick, className, testId, portraitHeight,
}: {
  drafted: DraftedWizard
  density?: CardDensity
  currentHp?: number
  selected?: boolean
  onClick?: () => void
  className?: string
  testId?: string
  portraitHeight?: number
}) {
  const { wizard, stats, spell } = drafted
  const frame = tierFrame(wizard.tier as Tier)
  const clickable = Boolean(onClick)
  const accent = ROLE_ACCENT[wizard.role]
  const archetype = primaryArchetype(tagsOf(drafted))
  const isRow = density === 'row'
  const portH = portraitHeight ?? PORTRAIT[density]
  const hpPct = currentHp !== undefined ? Math.max(0, Math.min(100, (currentHp / stats.hp) * 100)) : 100

  return (
    <div
      data-testid={testId}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } } : undefined}
      className={`relative flex flex-col rounded-[15px] p-px ${clickable ? 'cursor-pointer' : ''} ${className ?? ''}`}
      style={{
        background: frame.background,
        boxShadow: selected ? `0 0 0 2px #f6ecc4, ${frame.boxShadow}` : frame.boxShadow,
      }}
    >
      <div className={`relative flex flex-1 overflow-hidden rounded-[14px] ${isRow ? 'flex-row' : 'flex-col'}`}
           style={{ background: 'linear-gradient(180deg,#141223,#0c0a17)' }}>

        {/* RITRATTO */}
        <div
          className={`relative shrink-0 ${isRow ? 'w-[54px]' : ''}`}
          style={{ height: isRow ? undefined : portH, background: 'linear-gradient(160deg,#2f3557,#1a1f36)' }}
        >
          <span aria-hidden className="absolute inset-0"
            style={{ background: 'radial-gradient(118% 84% at 50% 34%, transparent 48%, rgba(6,4,12,.7) 100%)' }} />
          {!isRow && (
            <>
              <RarityPips tier={wizard.tier as Tier} />
              {archetype && (
                <span className="absolute right-2 top-2 z-10 rounded border border-white/20 bg-[rgba(10,8,18,.6)] px-1.5 py-1 text-[8px] font-extrabold uppercase tracking-[.1em] text-[#dbe9ff]">
                  {archetype.glyph} {archetype.name}
                </span>
              )}
              <AbilitySeal wizardId={wizard.id} />
              <div className="absolute inset-x-0 bottom-0 z-[3] px-3 pb-2.5 pt-6"
                style={{ background: 'linear-gradient(0deg, rgba(8,6,15,.96) 34%, rgba(8,6,15,.5) 68%, transparent)' }}>
                <div className="mb-1.5 flex items-center gap-1.5 text-[8.5px] font-extrabold uppercase tracking-[.2em]"
                  style={{ color: accent }}>
                  {wizard.role}
                  <span aria-hidden className="h-px flex-1 opacity-40"
                    style={{ background: 'linear-gradient(90deg, currentColor, transparent)' }} />
                </div>
                <h3 className="font-display text-[20px] font-black leading-[.98] text-white"
                  style={{ textShadow: '0 3px 16px rgba(0,0,0,.9)' }}>
                  {displayName(drafted)}
                </h3>
              </div>
            </>
          )}
        </div>

        {/* CORPO */}
        {isRow ? (
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-2.5 py-2">
            <span className="font-display text-[11.5px] font-extrabold leading-none text-white">
              {displayName(drafted)}
            </span>
            {currentHp !== undefined && (
              <span className="h-[5px] overflow-hidden rounded-full bg-[rgba(124,220,125,.2)]">
                <i data-testid="card-hp-bar" className="block h-full rounded-full bg-[#7cdc7d]" style={{ width: `${hpPct}%` }} />
              </span>
            )}
            <StatBand stats={stats} currentHp={currentHp} />
          </div>
        ) : (
          <>
            {currentHp !== undefined && (
              <div className="px-2.5 pt-2">
                <span className="block h-1.5 overflow-hidden rounded-full bg-[rgba(124,220,125,.2)]">
                  <i data-testid="card-hp-bar" className="block h-full rounded-full bg-[#7cdc7d]" style={{ width: `${hpPct}%` }} />
                </span>
              </div>
            )}
            <SpellLine spell={spell} compact={density !== 'full'} />
            <StatBand stats={stats} currentHp={currentHp} />
          </>
        )}
      </div>
    </div>
  )
}
```

**Nota:** `primaryArchetype` e `tagsOf` vanno verificati con `grep -n "export function primaryArchetype" lib/archetypes.ts` e `grep -n "export function tagsOf" game/engine/roster.ts`. Se una firma non corrisponde, adattare la chiamata al codice reale e segnalarlo nel report.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cards/WizardCard.test.tsx`
Expected: PASS — 6 test.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck` — Expected: nessun errore.

```bash
git add components/cards/WizardCard.tsx tests/cards/WizardCard.test.tsx
git commit -m "feat(carta): WizardCard — una carta, tre densita"
```

---

## Task 9: Pesca e Reclutamento (layout A)

**Files:**
- Modify: `components/screens/DraftScreen.tsx`
- Modify: `components/screens/RecruitScreen.tsx`
- Test: `tests/screens/DraftScreen.test.tsx`, `tests/screens/RecruitScreen.test.tsx` (aggiornare le asserzioni che cambiano)

**Interfaces:**
- Consumes: `WizardCard` con `density="full"` e `density="row"` (Task 8).
- Produces: niente di nuovo.

**Pesca A:** intestazione su una riga (~50px, non 147); tre carte in colonna con ritratto da 280px; pannello combo come quarta colonna allineata in cima e in fondo alle carte; sotto, una fascia per il confronto.

**Reclutamento A:** reclute a sinistra come carte piene; squadra a destra come carte-riga; sotto, la fascia «cosa cambia».

- [ ] **Step 1: Misurare il prima**

Avviare il gioco (`npm run dev`) e misurare a 1366×768 l'altezza del documento nelle due schermate. Annotare i valori: servono per dimostrare il guadagno.

- [ ] **Step 2: Riscrivere DraftScreen**

Sostituire `DraftCandidateCard` con `WizardCard density="full" portraitHeight={280}`. La griglia diventa:

```tsx
<div className="mx-auto grid max-w-[1340px] grid-cols-1 items-start gap-4 px-4 md:grid-cols-[repeat(3,1fr)_402px]">
```

L'intestazione perde le due righe ridondanti («Pesca 1/3» compare già nel titolo) e la `SquadPanel` resta, compressa su una riga.

- [ ] **Step 3: Riscrivere RecruitScreen**

Due colonne: a sinistra le tre reclute (`WizardCard density="full"`), a destra la squadra (`WizardCard density="row" currentHp={...}`). Il membro che esce prende un bordo rosso via `className`.

- [ ] **Step 4: Aggiornare i test di schermata**

Lanciare `npx vitest run tests/screens/DraftScreen.test.tsx tests/screens/RecruitScreen.test.tsx tests/screens/DraftScreenFixedOffer.test.tsx tests/screens/RecruitScreen.noRecruits.test.tsx` e aggiornare **solo** le asserzioni che dipendono da testo o struttura cambiati, con un commento che spiega il perché. Mai rimuovere un test.

- [ ] **Step 5: Verificare che entri a 1366×768**

Con `npm run dev` attivo, misurare di nuovo: `document.documentElement.scrollHeight` deve essere ≤ 768 in entrambe le schermate.

- [ ] **Step 6: Typecheck + suite + commit**

```bash
npm run typecheck && npx vitest run tests/screens tests/ui
git add components/screens/DraftScreen.tsx components/screens/RecruitScreen.tsx tests/screens/
git commit -m "feat(schermate): pesca e reclutamento sul layout A"
```

---

## Task 10: Mappa (layout C) e Battaglia (layout A)

**Files:**
- Modify: `components/screens/MapScreen.tsx`
- Modify: `components/screens/BattleScreen.tsx`
- Test: i quattro file `tests/screens/MapScreen*.test.tsx`, più `tests/battle/` dove tocca

**Interfaces:**
- Consumes: `WizardCard` con `density="row"` e `density="combat"` (Task 8).

**Mappa C:** il cammino resta in alto come mappa ridotta (~120px); le tre scelte raggiungibili diventano riquadri grandi con dentro i nemici mostrati come `WizardCard density="row"`; in fondo la barra squadra.

**Battaglia A:** due file di tre `WizardCard density="combat" currentHp={...}`, affacciate; ordine turni come striscia in alto; riga dell'azione al centro; danni in fondo.

- [ ] **Step 1: Misurare il prima**

A 1366×768, in battaglia: `document.documentElement.scrollHeight` — atteso ~1137. Annotarlo.

- [ ] **Step 2: Riscrivere MapScreen**

La mappa ridotta in alto mantiene i `data-testid="node-*"` esistenti (i test li usano). I tre riquadri di scelta usano `enemyPreview` dove disponibile.

- [ ] **Step 3: Riscrivere BattleScreen**

Sostituire `UnitBust` con `WizardCard density="combat"`. Mantenere `data-testid="battle-unit"` sulla carta, perché i test lo cercano.

- [ ] **Step 4: Aggiornare i test**

```bash
npx vitest run tests/screens/MapScreen.test.tsx tests/screens/MapScreen.area.test.tsx \
  tests/screens/MapScreen.noRecruits.test.tsx tests/screens/MapScreen.telegraph.test.tsx \
  tests/screens/mapTrail.test.tsx tests/battle
```
Aggiornare solo ciò che è cambiato davvero.

- [ ] **Step 5: Verificare l'altezza**

In battaglia `scrollHeight` deve scendere da ~1137 a ≤ 768, e **tutte e sei le unità devono essere visibili** (nessuna con `getBoundingClientRect().bottom > 768`).

- [ ] **Step 6: Typecheck + suite + commit**

```bash
npm run typecheck && npx vitest run
git add components/screens/MapScreen.tsx components/screens/BattleScreen.tsx tests/
git commit -m "feat(schermate): mappa C e battaglia A — tutto entra a 768"
```

---

## Task 11: Rimuovere i tre componenti vecchi

**Files:**
- Delete: `components/cards/WizardCardColumn.tsx`, `components/cards/WizardCardRow.tsx`, `components/battle/UnitBust.tsx`
- Delete: i loro test dedicati, se esistono e testano solo quei componenti
- Modify: ogni file che li importa ancora

**Interfaces:**
- Consumes: `WizardCard` (Task 8).
- Produces: niente.

- [ ] **Step 1: Trovare chi li importa ancora**

```bash
grep -rn "WizardCardColumn\|WizardCardRow\|UnitBust" --include=*.ts --include=*.tsx . | grep -v node_modules
```

- [ ] **Step 2: Sostituire ogni uso residuo**

`WizardCardColumn` → `WizardCard density="full"`; `WizardCardRow` → `WizardCard density="row"`; `UnitBust` → `WizardCard density="combat"`.

- [ ] **Step 3: Cancellare i tre file e i test dedicati**

```bash
git rm components/cards/WizardCardColumn.tsx components/cards/WizardCardRow.tsx components/battle/UnitBust.tsx
```

- [ ] **Step 4: Aggiungere la guardia contro il ritorno di una seconda carta**

```ts
// in tests/cards/WizardCard.test.tsx
it('esiste un solo componente-carta', () => {
  const files = readdirSync('components/cards').filter(f => /^WizardCard.*\.tsx$/.test(f))
  expect(files, 'la carta deve restare una sola, in tutte le schermate').toEqual(['WizardCard.tsx'])
})
```
(importare `readdirSync` da `node:fs` in cima al file).

- [ ] **Step 5: Suite completa + typecheck**

```bash
npx vitest run && npm run typecheck
```
Expected: tutto verde. Un test rosso qui significa un uso residuo non sostituito.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(carta): via i tre componenti vecchi — ne resta uno"
```

---

## Self-Review

**Copertura dello spec:**

| Requisito | Task |
|---|---|
| D1 — ritratto grande | 8 (`PORTRAIT`), 9 (280px in pesca) |
| D2 — riscrittura effetti | 1, 2 |
| D3 — carta senza scatole | 4, 5, 8 |
| D4 — sigillo con tooltip | 2, 6 |
| D5 — cornici sobrie | 3, 7 |
| D6 — valore in colonna | 4 |
| D7 — una carta, tre densità | 8, guardia in 11 |
| Pesca A | 9 |
| Reclutamento A | 9 |
| Mappa C | 10 |
| Battaglia A | 10 |
| Tre componenti → uno | 11 |
| Test aggiornati, mai silenziati | 9 Step 4, 10 Step 4 |

**Scan placeholder:** nessun TBD. Il Task 2 dichiara apertamente che la mappa copre 6 firme su 15 e dice come ricavare le altre 9 — è un'istruzione, non un segnaposto.

**Coerenza dei tipi:** `CardDensity` è definita in Task 8 e usata in 9, 10, 11. `tierFrame` guadagna `pips` in Task 3 e lo consuma `RarityPips` in Task 7. `SpellHeadline` è definita in Task 1 e consumata in Task 4. `AbilityText`/`AbilityLine` in Task 2, consumate in Task 6.

**Rischio noto:** le firme di `primaryArchetype`, `tagsOf` e `ROLE_ACCENT` sono citate in Task 8 ma non verificate riga per riga; il task dice esplicitamente di controllarle e adattare. È l'unico punto che può richiedere un aggiustamento locale.
