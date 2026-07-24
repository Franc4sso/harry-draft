# Patto Oscuro (archetipo Oscurità) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accendere la sinergia `oscurita` (dormiente) così il 4° archetipo Patto Oscuro si attiva a 3 maghi magieOscure, e cablarlo nella Costellazione + card come i tre archetipi sorelle.

**Architecture:** Pura attivazione. Il motore combat (`game/engine/darkMagic.ts`) reagisce GIÀ a `synergy.id === 'oscurita'` (+0.3 bonus a ogni dark caster, scalato via keywordDamageMult). Manca solo la voce `oscurita` in `data/synergies.ts` che fa scattare `detectSynergies`. Aggiungerla + 3 righe di wiring UI/meta accende tutto il sistema già testato. Nessun cambiamento al codice di combat.

**Tech Stack:** Next.js (versione custom — vedi AGENTS.md), TypeScript, React, Vitest.

## Global Constraints

- La sinergia si chiama `oscurita` (id), nome UI `Oscurità`, soglia `count: 3`, tag `magieOscure` — coerente con le sorelle (tossicita/spietatezza/bastione, count 3).
- Il `bonus` è `{ keywordMult: { magieOscure: 0.5 } }` (stessa forma delle sorelle; `magieOscure` è un Keyword valido, verificato in types/keyword.ts:12).
- Nessun cambiamento al codice di combat né ai numeri di bilanciamento delle reliquie/spell. L'unica leva nuova è il keywordMult 0.5 (già provato sicuro sulla reliquia Diadema Corrotto).
- L'archetipo vale anche per i NEMICI, come le sorelle (memoria: "archetipi valgono anche per i nemici"). Questo è voluto, non una regressione.
- `npm run test` NON esegue il typecheck: dopo ogni task con TS lancia `npx tsc --noEmit`.
- Comando test singolo: `npx vitest run <path> --disable-console-intercept`.
- Il gate di bilanciamento stretto è `tests/engine/campaignBalanceB` (NON tests/campaign). Il sweep archetipo è `tests/engine/magieOscureSweep.test.ts`.

---

### Task 1: Aggiungi la sinergia `oscurita` (l'interruttore)

**Files:**
- Modify: `data/synergies.ts:8-12`
- Test: `tests/engine/pattoOscuro.test.ts` (nuovo)

**Interfaces:**
- Consumes: `detectSynergies(team)` da `@/game/engine/synergy`, `teamDarkMagic(team, relics, synergies)` da `@/game/engine/darkMagic`.
- Produces: la sinergia con `id: 'oscurita'` in `SYNERGIES`; `detectSynergies` la rileva a 3 maghi magieOscure.

- [ ] **Step 1: Scrivi il test (red)**

Crea `tests/engine/pattoOscuro.test.ts` (imita il pattern di `tests/engine/carnefice.test.ts`):

```ts
import { describe, it, expect } from 'vitest'
import { detectSynergies } from '@/game/engine/synergy'
import { teamDarkMagic } from '@/game/engine/darkMagic'
import type { DraftedWizard } from '@/types'

const dw = (id: string, tags: string[] = []): DraftedWizard =>
  ({ wizard: { id, role: 'Attaccante', house: 'Serpeverde', tags }, level: 1 } as unknown as DraftedWizard)

describe('sinergia oscurita (archetipo Patto Oscuro)', () => {
  it('si accende con 3 maghi magieOscure, non con 2', () => {
    const three = [dw('a', ['magieOscure']), dw('b', ['magieOscure']), dw('c', ['magieOscure'])]
    const two = [dw('a', ['magieOscure']), dw('b', ['magieOscure'])]
    expect(detectSynergies(three).map(s => s.synergy.id)).toContain('oscurita')
    expect(detectSynergies(two).map(s => s.synergy.id)).not.toContain('oscurita')
  })

  it('con la sinergia attiva, ogni dark caster riceve un bonus > 0 (branch darkMagic acceso)', () => {
    const team = [dw('a', ['magieOscure']), dw('b', ['magieOscure']), dw('c', ['magieOscure'])]
    const syn = detectSynergies(team)
    const map = teamDarkMagic(team, [], syn)
    // synBonus 0.3, scalato da keywordMult magieOscure 0.5 → 0.3 * (1 + 0.5) = 0.45
    expect(map['a']!.bonus).toBeGreaterThan(0)
    expect(map['b']!.bonus).toBeGreaterThan(0)
    expect(map['c']!.bonus).toBeGreaterThan(0)
    expect(map['a']!.recoil).toBe(0) // la sinergia NON dà recoil (solo il Marchio lo fa)
  })

  it('senza la sinergia (2 maghi), teamDarkMagic non dà bonus di sinergia', () => {
    const two = [dw('a', ['magieOscure']), dw('b', ['magieOscure'])]
    const syn = detectSynergies(two)
    const map = teamDarkMagic(two, [], syn)
    expect(map['a']).toBeUndefined()
  })
})
```

- [ ] **Step 2: Lancia il test → deve fallire**

Run: `npx vitest run tests/engine/pattoOscuro.test.ts --disable-console-intercept`
Expected: FAIL — `detectSynergies` non contiene 'oscurita'; `map['a']` è undefined anche con 3 maghi.

- [ ] **Step 3: Aggiungi la voce sinergia**

In `data/synergies.ts`, dentro l'array `SYNERGIES` (dopo la riga `bastione`, riga 11), aggiungi:

```ts
  { id: 'oscurita', name: 'Oscurità', kind: 'origin', requires: { tag: 'magieOscure', count: 3 }, bonus: { keywordMult: { magieOscure: 0.5 } } },
```

- [ ] **Step 4: Lancia il test → deve passare**

Run: `npx vitest run tests/engine/pattoOscuro.test.ts --disable-console-intercept`
Expected: PASS (3/3).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add data/synergies.ts tests/engine/pattoOscuro.test.ts
git commit -m "feat(archetipo): accendi la sinergia Oscurità (Patto Oscuro) a 3 magieOscure"
```

---

### Task 2: Fai sopravvivere `oscurita` al filtro meta-progress

**Files:**
- Modify: `lib/metaProgress.ts:8-12`
- Test: `tests/engine/pattoOscuro.test.ts` (aggiungi un caso)

**Interfaces:**
- Consumes: `NAMED_SYNERGY_IDS` (Set interno di metaProgress).
- Produces: `oscurita` incluso nel Set, così il riepilogo meta lo conta come le sorelle.

- [ ] **Step 1: Verifica cosa esporta metaProgress per il test**

Run: `grep -n "export" lib/metaProgress.ts`
Il `NAMED_SYNERGY_IDS` è un const interno (non esportato). Il modo pulito di testare è via la funzione che lo usa. Cerca il consumatore:

Run: `grep -n "NAMED_SYNERGY_IDS" lib/metaProgress.ts`
Expected: definizione (riga 12) + uso in un `.filter(id => NAMED_SYNERGY_IDS.has(id))` (riga ~36).

NOTA implementatore: leggi la funzione che contiene il `.filter` (riga ~36) e capisci la sua firma pubblica (es. una funzione che prende sinergie attive e ritorna un summary). Scrivi il test contro QUELLA funzione pubblica passando una sinergia `oscurita` attiva e verificando che compaia nel risultato. Se la funzione è difficile da invocare in isolamento (richiede molto stato), allora esporta `NAMED_SYNERGY_IDS` da metaProgress e testa direttamente `NAMED_SYNERGY_IDS.has('oscurita')` — è accettabile perché il Set È il contratto.

- [ ] **Step 2: Scrivi il test (red)**

Approccio semplice e robusto (esporta il Set se non lo è già). In `tests/engine/pattoOscuro.test.ts` aggiungi:

```ts
import { NAMED_SYNERGY_IDS } from '@/lib/metaProgress'

describe('oscurita è un archetipo nominato (meta-progress)', () => {
  it('oscurita sopravvive al filtro NAMED_SYNERGY_IDS come le sorelle', () => {
    expect(NAMED_SYNERGY_IDS.has('oscurita')).toBe(true)
    // sanity: le sorelle ci sono già
    expect(NAMED_SYNERGY_IDS.has('tossicita')).toBe(true)
  })
})
```

- [ ] **Step 3: Lancia il test → deve fallire**

Run: `npx vitest run tests/engine/pattoOscuro.test.ts --disable-console-intercept`
Expected: FAIL — o `NAMED_SYNERGY_IDS` non è esportato (errore import), o non contiene 'oscurita'.

- [ ] **Step 4: Esporta il Set e aggiungi oscurita**

In `lib/metaProgress.ts` riga 12, cambia da const interno a export E aggiungi 'oscurita':

```ts
export const NAMED_SYNERGY_IDS = new Set(['tossicita', 'spietatezza', 'bastione', 'oscurita'])
```

Aggiorna anche il commento sopra (righe 8-11) per includere oscurita tra gli archetipi sopravvissuti:

```ts
// The ARCHETYPE synergies survive: tossicita (veleno), spietatezza (esecuzione,
// revived 2026-07-22 as the Carnefice archetype base), bastione (scudirigen,
// revived 2026-07-23 as the Muro Riflettente archetype base) and oscurita
// (magieOscure, activated 2026-07-24 as the Patto Oscuro archetype base).
```

- [ ] **Step 5: Lancia il test → deve passare**

Run: `npx vitest run tests/engine/pattoOscuro.test.ts --disable-console-intercept`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 7: Commit**

```bash
git add lib/metaProgress.ts tests/engine/pattoOscuro.test.ts
git commit -m "feat(archetipo): oscurita sopravvive al filtro meta-progress"
```

---

### Task 3: Accendi la Costellazione (archetypes.ts + tracker)

**Files:**
- Modify: `lib/archetypes.ts:1-15`
- Modify: `components/draft/ArchetypeTracker.tsx:11-21`
- Test: `tests/engine/pattoOscuro.test.ts` (archetypeTooltip) + `tests/ui/archetypeTracker.test.tsx` (nuovo caso)

**Interfaces:**
- Consumes: `ARCHETYPE_BY_TAG`, `ARCHETYPE_EFFECT`, `archetypeTooltip` da `@/lib/archetypes`; `ARCH_META` locale del tracker.
- Produces: `magieOscure` con `synergyId: 'oscurita'`; effetto in `ARCHETYPE_EFFECT`; `oscurita` in `ARCH_META` del tracker → la Costellazione Oscurità compare con have/need/active.

- [ ] **Step 1: Scrivi il test archetypeTooltip (red)**

In `tests/engine/pattoOscuro.test.ts` aggiungi (nota: archetypeTooltip già esiste da un lavoro precedente):

```ts
import { ARCHETYPE_BY_TAG, ARCHETYPE_EFFECT, archetypeTooltip } from '@/lib/archetypes'

describe('Costellazione Oscurità (archetypes.ts)', () => {
  it('magieOscure ora ha synergyId oscurita', () => {
    expect(ARCHETYPE_BY_TAG.magieOscure.synergyId).toBe('oscurita')
  })
  it('esiste il testo effetto per oscurita', () => {
    expect(ARCHETYPE_EFFECT['oscurita']).toBeTruthy()
  })
  it('archetypeTooltip(magieOscure) ora mostra l\'effetto, non il fallback', () => {
    expect(archetypeTooltip('magieOscure')).toBe(ARCHETYPE_EFFECT['oscurita'])
  })
})
```

- [ ] **Step 2: Lancia il test → deve fallire**

Run: `npx vitest run tests/engine/pattoOscuro.test.ts --disable-console-intercept`
Expected: FAIL — synergyId undefined; ARCHETYPE_EFFECT['oscurita'] undefined; archetypeTooltip ritorna il fallback "Archetipo: Magie Oscure".

- [ ] **Step 3: Aggiorna archetypes.ts**

In `lib/archetypes.ts`:

Riga 7, aggiungi il `synergyId` a magieOscure:

```ts
  magieOscure: { name: 'Magie Oscure', glyph: '☾', color: '#b98cff', synergyId: 'oscurita' },
```

Aggiorna il commento in testa (righe 1-2), rimuovendo "la sinergia Oscurità non esiste ancora":

```ts
/** Mappa un tag archetipo al nome FANTASIA (Veleno/Carnefice/Muro/Magie Oscure), glifo e colore per la UI.
 *  Ogni tag ha ora un synergyId (la sua Costellazione): veleno→tossicita, esecuzione→spietatezza,
 *  scudirigen→bastione, magieOscure→oscurita (Patto Oscuro). */
```

Aggiungi la voce effetto in `ARCHETYPE_EFFECT` (dopo la riga bastione, riga 14):

```ts
  oscurita:    'Patto oscuro: le tue magie oscure colpiscono più forte, al prezzo del contraccolpo.',
```

- [ ] **Step 4: Scrivi il test tracker (red)**

Prima leggi il pattern di `tests/ui/archetypeTracker.test.tsx` (come costruisce i picks e cosa asserisce). Poi aggiungi un test che renderizza il tracker con 3 maghi magieOscure e verifica che la riga Oscurità compaia attiva.

NOTA implementatore: il tracker usa `synergyProgress(team)` e mappa via `ARCH_META` (locale). Serve una fixture di 3 DraftedWizard con tag magieOscure. Usa lo stesso helper/pattern già presente nel file test (probabilmente costruisce drafted inline o via WIZARD_BY_ID). Il test deve asserire che esiste una riga `[data-arch="oscurita"]` con `data-state="active"` (o che compare il nome "Magie Oscure" con l'effetto). Esempio della forma dell'assert (adatta al pattern del file):

```tsx
it('mostra la Costellazione Oscurità attiva con 3 maghi magieOscure', () => {
  const picks = [dwOscuro('a'), dwOscuro('b'), dwOscuro('c')] // 3 magieOscure
  render(<ArchetypeTracker picks={picks} />)
  const row = screen.getByTestId('draft-archetype-tracker').querySelector('[data-arch="oscurita"]')
  expect(row).not.toBeNull()
  expect(row).toHaveAttribute('data-state', 'active')
})
```

Dove `dwOscuro` costruisce un DraftedWizard con `wizard.tags = ['magieOscure']` seguendo il pattern del file (se il file usa WIZARD_BY_ID con maghi reali, usa maghi magieOscure reali: es. cerca con `grep "magieOscure" data/wizards.ts` → narcissa, bellatrix, ecc.).

- [ ] **Step 5: Lancia il test tracker → deve fallire**

Run: `npx vitest run tests/ui/archetypeTracker.test.tsx --disable-console-intercept`
Expected: FAIL — nessuna riga oscurita (ARCH_META non la contiene).

- [ ] **Step 6: Aggiungi oscurita a ARCH_META del tracker**

In `components/draft/ArchetypeTracker.tsx`:

Aggiungi la voce a `ARCH_META` (dopo bastione, riga 14):

```ts
  oscurita:    { name: 'Magie Oscure', glyph: '☾', color: '#b98cff' },
```

Aggiorna il JSDoc del componente (righe 17-22) rimuovendo "Magie Oscure non ha ancora una sinergia (Patto Oscuro)" e includendo i 4 archetipi:

```ts
/**
 * Tracker COMPATTO delle Costellazioni (archetipi tag): una riga per archetipo — pip×need,
 * have/need, stato (sopito/vicino/attivo) ed effetto quando attivo. Sorella del DuoTracker:
 * stesso header, stesso stile riga, stessa gestione di `considered`. Mostra i 4 archetipi
 * con sistema (Veleno/Carnefice/Muro/Magie Oscure — Patto Oscuro attivato 2026-07-24).
 */
```

- [ ] **Step 7: Lancia i test → devono passare**

Run: `npx vitest run tests/engine/pattoOscuro.test.ts tests/ui/archetypeTracker.test.tsx --disable-console-intercept`
Expected: PASS.

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 9: Commit**

```bash
git add lib/archetypes.ts components/draft/ArchetypeTracker.tsx tests/engine/pattoOscuro.test.ts tests/ui/archetypeTracker.test.tsx
git commit -m "feat(archetipo): accendi la Costellazione Oscurità (card + tracker)"
```

---

### Task 4: Verifica bilanciamento — sweep archetipo + gate stretto

**Files:** nessuna modifica prevista (solo misura). Se un gate rompe, questo task include il ri-ancoraggio (con nota onesta).

**Interfaces:** nessuna.

- [ ] **Step 1: Esegui il sweep magieOscure**

Run: `npx vitest run tests/engine/magieOscureSweep.test.ts --disable-console-intercept`
Expected: PASS. Gli assert sono soft (`winRate ∈ [0,1]`, `darkUptakeRate > 0.01`, no stalli). Registra il nuovo `oscuritaRate` stampato: PRIMA della feature la sinergia non si attivava mai, quindi ora `oscuritaRate` misura attivazioni reali per la prima volta. Questo è atteso e NON è un fallimento.

NOTA: se il sweep stampa metriche via console, servono i log — se non le vedi, aggiungi temporaneamente un `console.log` o leggi come il test le espone. NON cambiare gli assert soft a meno che non rompano davvero.

- [ ] **Step 2: Esegui il gate stretto campaignBalanceB**

Run: `npx vitest run tests/engine/campaignBalanceB.test.ts --disable-console-intercept`
Expected: idealmente PASS. Il keywordMult 0.5 tocca solo squadre (player E nemico) che già schierano 3+ dark caster. Il movimento atteso è minimo.

- [ ] **Step 3: Se campaignBalanceB rompe — diagnosi PRIMA di toccare le leve**

Se il gate scende sotto la sua soglia:
1. Isola: la rottura è DIREZIONALE (Oscurità rende i nemici più forti in modo sistematico) o è RESHUFFLE (un seed si ribalta per re-deal RNG a valle, senza reale perdita di potere)? Confronta i seed che cambiano esito prima/dopo.
2. Se reshuffle: ri-ancora lo snapshot/assert al valore REALE misurato, con una nota `// 2026-07-24: Oscurità attivata — <vecchio> → <nuovo>, reshuffle non perdita (seed X si ribalta, tiene 0 dark in entrambe le config)`.
3. Se direzionale: la leva è il keywordMult `magieOscure` in `data/synergies.ts` (0.5 → 0.3), NON il bonus base 0.3 hardcoded in darkMagic.ts (non toccare il motore). Riduci e rimisura.
4. NON rilassare un assert senza aver confermato che non è un bug reale (lezione dalle sorelle: reshuffle noise può nascondere un calo direzionale — A/B-misura).

- [ ] **Step 4: Suite piena ristretta ai file toccati + sweep**

Run: `npx vitest run tests/engine/ tests/ui/archetypeTracker.test.tsx --disable-console-intercept`
Expected: verde. Se `previewCoherence.test.ts` o altri test-conteggio-sinergie rompono per la sinergia in più, aggiornali al nuovo conteggio (4 archetipi).

- [ ] **Step 5: Commit (solo se sono serviti ri-ancoraggi/aggiornamenti test)**

```bash
git add -A
git commit -m "test(archetipo): ri-ancora i gate dopo attivazione Oscurità (misurato)"
```

Se nessun gate è rotto e nessun test aggiornato, salta il commit e registra nel report che tutti i gate sono passati invariati.

---

## Self-Review (compilata dall'autore del piano)

**Spec coverage:**
- Modifica 1 (synergies.ts entry) → Task 1. ✅
- Modifica 2 (NAMED_SYNERGY_IDS) → Task 2. ✅
- Modifica 3 (archetypes.ts synergyId + ARCHETYPE_EFFECT) → Task 3. ✅ (extra vs spec: anche `ARCH_META` del tracker va toccato, altrimenti la Costellazione non compare — incluso in Task 3).
- Modifica 4 (enemy safety) → coperto dai Global Constraints + verificato in Task 4 (il sweep e il gate includono i nemici; se Oscurità nemica fosse un problema, il gate lo cattura). ✅
- Testing (sweep + gate) → Task 4. ✅

**Placeholder scan:** i passi di codice mostrano codice reale. Le NOTE in Task 2 (esporta il Set se serve) e Task 3 (adatta la fixture al pattern del file test) rimandano al pattern esistente e vanno ispezionate dall'implementer — non sono placeholder di produzione. Task 4 è intrinsecamente condizionale (misura → eventuale fix), con procedura esplicita per ogni ramo. ✅

**Type consistency:** `oscurita` usato coerentemente come id in tutti i task; `magieOscure` come tag/keyword; `synergyId: 'oscurita'`; `ARCH_META.oscurita` e `ARCHETYPE_EFFECT.oscurita` con la stessa chiave. `NAMED_SYNERGY_IDS` esportato in Task 2 e importato nel test. ✅
