# UN MAGO, UNA MAGIA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ogni mago entra e resta in battaglia con UNA sola magia — la sua firma autorata — invece di pescarne una a caso da un pool.

**Architecture:** Non si rinomina il campo. `Wizard.spellPool: string[]` resta, ma diventa un **array di un solo elemento** (la firma), con un invariante di dato che lo blocca. `rng.pick([firma])` è già deterministico e consuma esattamente una `gen()`, quindi il draw-count RNG resta identico e il gate di parità anti-cheat non va toccato. Si rimuove poi tutta la macchina che il pool multi-spell giustificava: lo swap magia (UI + evento + primitiva + replay) e il bias offensivo per-unità (`preferOffense`/`guaranteeOffense`/`guaranteeOffensiveSpell`), sostituito da una garanzia a livello di squadra (≥1 attaccante) per non rendere i nemici innocui.

**Tech Stack:** TypeScript, Vitest, React (Next.js custom — vedi AGENTS.md), RNG deterministico `mulberry32` in `game/engine/rng.ts`.

## Global Constraints

- **Determinismo RNG intoccabile:** ogni `draftWizard` deve consumare lo STESSO numero di `gen()` di oggi (1 spell + 1 shiny-chance + 0/1 shiny-trait). `rng.pick` consuma una `gen()` per qualsiasi lunghezza d'array (`rng.ts:36-40`), quindi un pool di 1 elemento preserva il conteggio. NON introdurre né rimuovere pescate nel percorso di draft.
- **Nessun rename di `spellPool`** in questa iterazione (il nome `signature` è occupato da `types/signature.ts` / `SIGNATURE_BY_ID`). Il campo resta `spellPool: string[]`, lunghezza forzata a 1.
- **Regola utente — i supporti NON attaccano:** un Supporto non deve mai equipaggiare un attacco. La minaccia nemica si garantisce a livello di SQUADRA, non forzando il singolo.
- **Regola utente — MAI fuoco amico** (invariante preesistente, non toccata qui).
- **Firme dalle magie canoniche** già presenti nei pool attuali; duplicati fra maghi ammessi.
- **Gate finale:** `npx tsc --noEmit` pulito E `npx vitest run` completamente verde.

---

## File Structure

- `data/wizards.ts` — ogni `spellPool` diventa `[firma]` (Task 2).
- `types/wizard.ts` — invariato (campo resta `spellPool: string[]`).
- `game/engine/statRoll.ts` — `pickSpell` semplificato; `draftWizard` perde i parametri offensivi; `guaranteeOffensiveSpell` eliminato; `spellIsOffensive`/`ROLE_SPELL_TYPES` conservati (usati dalla garanzia di squadra) (Task 3).
- `game/engine/combat/teamGen.ts` — rimossi i parametri `preferOffense`/`guaranteeOffense` dal threading; aggiunta `ensureOffense` (garanzia ≥1 attaccante per squadra); `capSupporto` conservato per la varietà di ruolo (Task 3).
- `game/engine/runEngine.ts` — rimossa `setWizardSpell` (Task 1).
- `game/engine/events.ts` — rimosso il case `swapSpell` (Task 1).
- `game/engine/endlessReplay.ts` — rimosso l'handling dell'azione `set-spell` (Task 1).
- `hooks/useRunB.ts`, `hooks/useEndless.ts` — rimossa la callback `setWizardSpell` (Task 1).
- `components/screens/RunBRunner.tsx` — rimosso il wiring `onSetSpell` (Task 1).
- `components/run/TeamSynergyBar.tsx` — rimosso il selettore magie (Task 1).
- Test — aggiornati/rimossi nei rispettivi task.

---

## Task 1: Rimuovere lo swap magia (UI + evento + primitiva + replay)

Motivo di farlo per PRIMO: con pool ancora multi-spell, i test di swap sono ancora verdi/rossi in modo prevedibile; rimuovere lo swap ora evita che il collasso a pool-di-1 (Task 2) rompa test di swap in modo confuso. Chiude anche l'exploit dello swap.

**Files:**
- Modify: `components/run/TeamSynergyBar.tsx` (rimuovi selettore `spellPool`, prop `onSetSpell`)
- Modify: `components/screens/RunBRunner.tsx:62,110-116` (rimuovi tipo + prop `setWizardSpell`/`onSetSpell`)
- Modify: `hooks/useRunB.ts:47,123-124,152` (rimuovi callback + export)
- Modify: `hooks/useEndless.ts:38,135-137,169` (idem)
- Modify: `game/engine/runEngine.ts:190-203` (elimina `setWizardSpell`)
- Modify: `game/engine/events.ts:5,80-89` (elimina case `swapSpell` + import inutile)
- Modify: `game/engine/endlessReplay.ts:5,116-117` (rimuovi handling `set-spell`)
- Delete: `tests/engine/loadout.test.ts` (testa solo `setWizardSpell`)
- Modify: `tests/engine/eventEffects.test.ts:62-70` (rimuovi il blocco `swapSpell`)
- Modify: `tests/engine/spellForge.test.ts:98-104` (rimuovi il test `setWizardSpell applies wizard spellLevel`)
- Modify: `tests/engine/campaignBalanceRestricted.test.ts`, `tests/engine/campaignBalanceB.test.ts`, `tests/engine/endlessScaling.test.ts` (rimuovi l'ottimizzazione bot via `setWizardSpell` — vedi Step sotto)

**Interfaces:**
- Produces: nessuna `setWizardSpell` esportata da `runEngine`; nessun case `swapSpell` in `events.ts`; nessuna prop `onSetSpell` in `TeamSynergyBar`/`RunBRunner`; controller `useRunB`/`useEndless` senza `setWizardSpell`.

- [ ] **Step 1: Localizza il RunLog action `set-spell` e la sua registrazione.**

Run: `grep -rn "set-spell\|setWizardSpell\|swapSpell" game/ hooks/ components/ types/ | grep -v test`
Expected: elenco dei siti sopra. Verifica se esiste un tipo di azione `{ t: 'set-spell' }` nel RunLog (`types/` o `game/engine/endlessReplay.ts`); se sì, rimuovi anche la sua definizione e ogni punto che la *registra* (probabilmente in `hooks/useEndless.ts` dove le azioni vengono loggate).

- [ ] **Step 2: Scrivi/aggiorna i test PRIMA (RED).**

In `tests/engine/eventEffects.test.ts` rimuovi l'intero blocco `it('swapSpell ...')` (righe ~62-70). In `tests/engine/spellForge.test.ts` rimuovi `it('setWizardSpell applies the wizard spellLevel ...')` (righe ~98-104). Elimina il file `tests/engine/loadout.test.ts`.

Nei tre test di bilancio (`campaignBalanceRestricted.test.ts`, `campaignBalanceB.test.ts`, `endlessScaling.test.ts`) c'è un helper che simula il bot che sceglie la magia d'attacco più forte iterando `dw.wizard.spellPool` e chiamando `setWizardSpell`. Sostituiscilo: il bot non ottimizza più le magie (non esistono più alternative). Rimuovi il loop `for (const id of dw.wizard.spellPool) { ... }` e la chiamata `setWizardSpell(...)`; la squadra gioca la magia di default (la firma). Mantieni il resto dell'asserzione di bilancio invariato.

Esempio di trasformazione (campaignBalanceRestricted.test.ts ~53-84):
```ts
// PRIMA: bot equips its strongest attack spell from the pool
// for (const id of dw.wizard.spellPool) { ... pick strongest ... }
// s = setWizardSpell(s, dw.wizard.id, id)
// DOPO: no spell optimization — team fights with its signature (default) spell.
// (rimuovi entrambe: il blocco di scelta e la chiamata setWizardSpell)
```

- [ ] **Step 3: Esegui i test per confermare RED.**

Run: `npx vitest run tests/engine/eventEffects.test.ts tests/engine/spellForge.test.ts tests/engine/campaignBalanceRestricted.test.ts`
Expected: FAIL (i simboli `setWizardSpell` ancora esistono / import rotti) — conferma che stiamo per rimuovere codice reale.

- [ ] **Step 4: Rimuovi `setWizardSpell` da `runEngine.ts`.**

Elimina l'intera funzione (righe 190-203) e ogni `export` collegato. Se `scaledSpell`/`SPELL_BY_ID` restano usati altrove nel file, lascia gli import; altrimenti rimuovili.

- [ ] **Step 5: Rimuovi il case `swapSpell` da `events.ts`.**

Elimina il blocco `case 'swapSpell': { ... }` (80-89) e l'import `setWizardSpell` (riga 5). Se il tipo di effetto evento ha una variante `swapSpell` nella union (cerca in `types/` o `data/events*`), rimuovila e rimuovi ogni definizione di evento che la usa (così il pool eventi non offre più uno swap morto). Run: `grep -rn "swapSpell" data/ types/ game/` per trovarle.

- [ ] **Step 6: Rimuovi l'handling replay `set-spell` in `endlessReplay.ts`.**

Elimina il ramo `else if (a.t === 'set-spell') { s = setWizardSpell(...) }` (116-117) e l'import (riga 5). Rimuovi la variante `set-spell` dal tipo di azione del RunLog se presente.

- [ ] **Step 7: Rimuovi le callback `setWizardSpell` da hooks + wiring.**

In `hooks/useRunB.ts` rimuovi il tipo (riga 47), la `useCallback` (123-124) e l'export (152). Idem `hooks/useEndless.ts` (38, 135-137, 169). In `components/screens/RunBRunner.tsx` rimuovi il campo `setWizardSpell` dal tipo controller (62) e la prop `onSetSpell={...}` passata a `TeamSynergyBar` (110-116).

- [ ] **Step 8: Rimuovi il selettore magie da `TeamSynergyBar.tsx`.**

Rimuovi: la prop `onSetSpell` (righe 124,127,219-229,238), le variabili `spellPool`/`canSelect`/`RowTag` (133-134,140) e il blocco JSX del selettore (180-203). La riga resta un semplice `div` non-cliccabile che mostra il mago e la sua magia. Se `SPELL_BY_ID` non serve più nel file, rimuovi l'import.

- [ ] **Step 9: Aggiorna i test dello swap UI.**

`tests/screens/TeamSynergyBar.test.tsx:18` costruisce un mago con `spellPool: ['expelliarmus', 'stupeficium']` e verifica 2 bottoni-magia. Riscrivilo per verificare che NON esista più il selettore (nessun `role="group"` `aria-label="Incantesimi di ..."`, nessun bottone-magia). Mantieni le altre asserzioni del componente.

- [ ] **Step 10: Typecheck + suite verde.**

Run: `npx tsc --noEmit`
Expected: nessun errore (nessun riferimento residuo a `setWizardSpell`/`onSetSpell`/`swapSpell`).
Run: `npx vitest run`
Expected: PASS completo.

- [ ] **Step 11: Commit.**

```bash
git add -A
git commit -m "feat(duos): rimuovi lo swap magia (UI + evento + primitiva + replay)"
```

---

## Task 2: Collassare ogni mago a una firma singola

**Files:**
- Modify: `data/wizards.ts` (ogni `spellPool: [...]` → `spellPool: ['<firma>']`, tabella sotto)
- Modify: `tests/data/wizards.test.ts:12-14` (lunghezza pool: da 4-6 a esattamente 1)
- Modify: `tests/data/velenoSpells.test.ts` (vedi Step 3 — decisione veleno)
- Modify: `tests/data/supportoArchetypes.test.ts`, `tests/data/roleSpellPools.test.ts`, `tests/data/rolePoolInvariant.test.ts` (iterano il pool: restano validi su pool di 1, ma verifica che le firme scelte li rispettino)

**Interfaces:**
- Produces: ogni `WIZARDS[i].spellPool` ha esattamente 1 elemento. `pickSpell` (invariato in questo task) ora ritorna deterministicamente quella firma.

**Tabella firme (dati — rivedibili dall'utente, sono edit di una riga ciascuna):**

Regola: in-ruolo, canonica, iconica. `veleno` è un TAG (segnale Duo) e resta sui tag; la firma è venom solo dove è anche l'identità del mago.

| id | ruolo | firma |
|---|---|---|
| dumbledore | Controllo | petrificus |
| voldemort | Attaccante | avada |
| harry | Attaccante | expelliarmus |
| snape | Attaccante | sectumsempra |
| bellatrix | Controllo | crucio |
| mcgonagall | Tank | protego_maxima |
| sirius | Attaccante | stupeficium |
| lupin | Supporto | expecto |
| moody | Tank | fianto |
| lucius | Attaccante | serpensortia |
| kingsley | Tank | protego_maxima |
| fleur | Attaccante | incendio |
| viktor | Attaccante | confringo |
| hermione | Controllo | confundo |
| ron | Tank | protego |
| draco | Attaccante | serpensortia |
| ginny | Attaccante | reducto |
| neville | Tank | protego |
| luna | Supporto | episkey |
| fred | Controllo | tarantallegra |
| george | Attaccante | diffindo |
| molly | Supporto | episkey |
| arthur | Supporto | incitamento |
| tonks | Controllo | confundo |
| narcissa | Supporto | vulnera |
| dolohov | Attaccante | sectumsempra |
| greyback | Tank | fianto |
| cho | Controllo | levicorpus |
| cedric | Attaccante | stupeficium |
| slughorn | Supporto | anapneo |
| hagrid | Tank | protego |
| flitwick | Controllo | petrificus |
| sprout | Supporto | ferula |
| seamus | Attaccante | incendio |
| dean | Attaccante | reducto |
| parvati | Controllo | tarantallegra |
| lavender | Supporto | episkey |
| pansy | Controllo | langlock |
| goyle | Tank | protego |
| crabbe | Tank | fianto |
| marcus | Attaccante | oppugno |
| pettigrew | Supporto | ferula |
| padma | Controllo | levicorpus |
| terry | Controllo | petrificus |
| michael | Attaccante | reducto |
| roger | Tank | protego |
| marietta | Supporto | anapneo |
| anthony | Tank | salvio |
| hannah | Supporto | episkey |
| susan | Supporto | rennervate |
| ernie | Tank | protego |
| justin | Attaccante | reducto |
| zacharias | Controllo | confundo |
| leanne | Controllo | tarantallegra |
| eloise | Tank | salvio |
| theodore | Controllo | langlock |
| blaise | Attaccante | sectumsempra |
| astoria | Supporto | anapneo |
| penelope | Supporto | rennervate |
| megan | Controllo | tarantallegra |

Ogni firma è già nel pool attuale del mago (verificalo nello Step 2). Se un mago non è nella tabella (roster > 60), usa la sua magia di ruolo più iconica dal pool.

- [ ] **Step 1: Aggiorna il test dell'invariante (RED).**

In `tests/data/wizards.test.ts` sostituisci le righe 12-13:
```ts
    // UN MAGO, UNA MAGIA: ogni mago ha esattamente una firma.
    expect(w.spellPool.length, `${w.id} deve avere 1 firma`).toBe(1)
    expect(SPELL_BY_ID[w.spellPool[0]!], `${w.id} -> ${w.spellPool[0]}`).toBeTruthy()
```

- [ ] **Step 2: Esegui il test per confermare RED.**

Run: `npx vitest run tests/data/wizards.test.ts`
Expected: FAIL — i pool attuali hanno 4-6 magie.

- [ ] **Step 3: Decisione veleno (verifica come si attivano i Duo veleno).**

Run: `grep -rn "veleno\|SPELL_IS_VENOM\|tags" game/engine/duoEffects/ game/engine/duos.ts game/engine/combat/effects.ts`
Determina se i Duo/status veleno si attivano dal TAG del mago o dal fatto che lanci una magia venom.
- Se dal TAG → i maghi veleno tengono il tag e la firma può NON essere venom. Aggiorna `tests/data/velenoSpells.test.ts` per NON richiedere una firma venom (o eliminalo se ridondante).
- Se dal lancio di una magia venom → assegna a bellatrix/pansy/theodore una firma venom (`serpensortia`) invece di quella in tabella, così il loro Duo resta funzionale, e mantieni il test velenoSpells verificando `spellPool[0]` è venom per i maghi veleno.
Applica la scelta coerente prima di scrivere i dati.

- [ ] **Step 4: Applica le firme in `data/wizards.ts`.**

Per ogni mago, sostituisci `spellPool: [ ...molte... ]` con `spellPool: ['<firma>']` secondo la tabella (o l'aggiustamento veleno dello Step 3). Mantieni intatti `role`, `tags`, `ranges`.

- [ ] **Step 5: Esegui i test dei dati.**

Run: `npx vitest run tests/data`
Expected: PASS. Se `supportoArchetypes`/`roleSpellPools`/`rolePoolInvariant` falliscono, significa che una firma scelta è fuori ruolo (es. un Supporto con un attacco) — correggi la firma, non il test.

- [ ] **Step 6: Verifica identità in combattimento.**

Run: `npx vitest run tests/engine/pickSpellVeleno.test.ts tests/engine/statRoll.test.ts`
Expected: potrebbero fallire (assumono pool multi-spell) — se sì, è previsto e verranno sistemati nel Task 3. Se passano, meglio. Annota quali falliscono.

- [ ] **Step 7: Typecheck.**

Run: `npx tsc --noEmit`
Expected: pulito (nessun cambio di tipo).

- [ ] **Step 8: Commit.**

```bash
git add data/wizards.ts tests/data/
git commit -m "feat(duos): UN MAGO UNA MAGIA — pool collassato a firma singola"
```

---

## Task 3: Rimuovere il bias offensivo per-unità; garanzia ≥1 attaccante per squadra

Con pool di 1, `preferOffense`/`guaranteeOffense`/`guaranteeOffensiveSpell` o sono no-op o violano la regola "i supporti non attaccano" (un Supporto nemico verrebbe rimpiazzato con `base_attack`). Si rimuovono, e la minaccia nemica si garantisce a livello di squadra.

**Files:**
- Modify: `game/engine/statRoll.ts` (semplifica `pickSpell`; `draftWizard` perde `preferOffense`/`guaranteeOffense`; elimina `guaranteeOffensiveSpell`)
- Modify: `game/engine/combat/teamGen.ts` (togli il threading offensivo; aggiungi `ensureOffense`; conserva `capSupporto`)
- Modify: `tests/engine/statRoll.test.ts`, `tests/engine/pickSpellVeleno.test.ts`, `tests/engine/spellRoleBias.test.ts`, `tests/engine/supportoNoAttack.test.ts`, `tests/engine/combat/teamGen.test.ts`, `tests/engine/combat/attackMoveGuarantee.test.ts`

**Interfaces:**
- Consumes: `spellIsOffensive(spell)` (resta in `statRoll.ts`), `SPELL_BY_ID`, `powerOf`, `expectedPower` (in `teamGen.ts`).
- Produces:
  - `pickSpell(rng: Rng, wizard: Wizard): Spell` — firma senza `preferOffense`.
  - `draftWizard(rng: Rng, wizard: Wizard, allowShiny = false): DraftedWizard` — senza parametri offensivi.
  - `ensureOffense(rng: Rng, team: DraftedWizard[], window: Wizard[]): DraftedWizard[]` (interna a `teamGen.ts`).

- [ ] **Step 1: Scrivi il test della garanzia di squadra (RED).**

In `tests/engine/combat/teamGen.test.ts` aggiungi:
```ts
import { spellIsOffensive } from '@/game/engine/statRoll'
import { SPELL_BY_ID } from '@/data/spells'

it('ogni squadra nemica generata schiera almeno un attaccante', () => {
  for (let seed = 0; seed < 40; seed++) {
    const team = generateEnemyTeam(createRng(seed), 600)
    const hasOffense = team.some(d => spellIsOffensive(d.spell))
    expect(hasOffense, `seed ${seed} team senza attaccante`).toBe(true)
  }
})
```
(Import `createRng` e `generateEnemyTeam` come già fa il file.)

- [ ] **Step 2: Aggiungi un test "i supporti non attaccano mai" per i nemici (RED).**

Nello stesso file:
```ts
it('un Supporto nemico non equipaggia mai un attacco', () => {
  for (let seed = 0; seed < 40; seed++) {
    for (const d of generateEnemyTeam(createRng(seed), 600)) {
      if (d.wizard.role === 'Supporto') {
        expect(spellIsOffensive(d.spell), `${d.wizard.id} Supporto attacca`).toBe(false)
      }
    }
  }
})
```

- [ ] **Step 3: Esegui per confermare RED.**

Run: `npx vitest run tests/engine/combat/teamGen.test.ts`
Expected: il test "supporti non attaccano" FALLISCE oggi (guaranteeOffensiveSpell mette base_attack sui supporti elite/boss).

- [ ] **Step 4: Semplifica `pickSpell` in `statRoll.ts`.**

Sostituisci l'intera `pickSpell` (59-103) con:
```ts
export function pickSpell(rng: Rng, wizard: Wizard): Spell {
  // UN MAGO, UNA MAGIA: il pool contiene esattamente una firma. Si pesca comunque via
  // rng.pick per BRUCIARE esattamente una gen() — identico al vecchio pool multi-spell —
  // così il draw-count del draft resta byte-per-byte uguale e la parità replay endless
  // non si tocca. L'esito è deterministico: la firma del mago.
  const id = rng.pick(wizard.spellPool)
  const spell = SPELL_BY_ID[id]
  if (!spell) throw new Error(`unknown spell ${id} for ${wizard.id}`)
  return spell
}
```
Elimina `guaranteeOffensiveSpell` (46-57) e la sua export. Mantieni `spellIsOffensive`, `ROLE_SPELL_TYPES`, `fixedStats`, `mid`.

- [ ] **Step 5: Semplifica `draftWizard` in `statRoll.ts`.**

Sostituisci la firma e il corpo (105-120) con:
```ts
export function draftWizard(rng: Rng, wizard: Wizard, allowShiny = false): DraftedWizard {
  const stats = fixedStats(wizard)
  const spell = pickSpell(rng, wizard)
  // Bruciamo sempre il roll shiny (mantiene lo stream identico per ogni caller), ma lo
  // ATTACCHIAMO solo se il caller lo richiede (draft del giocatore). Nemici → mai shiny.
  const rolled = rng.chance(BALANCE.draft.shinyChance) ? { traitId: rng.pick(SHINY_TRAIT_IDS) } : undefined
  const shiny = allowShiny ? rolled : undefined
  return { wizard, stats, maxHp: stats.hp, spell, ...(shiny ? { shiny } : {}) }
}
```

- [ ] **Step 6: Togli il threading offensivo da `teamGen.ts` e aggiungi `ensureOffense`.**

Import: cambia `import { draftWizard, guaranteeOffensiveSpell, spellIsOffensive } from '../statRoll'` in `import { draftWizard, spellIsOffensive } from '../statRoll'`.

In `capSupporto` e `pickTowardBudget` rimuovi i parametri `preferOffense`/`guaranteeOffense` e passali via nelle chiamate a `draftWizard` (ora `draftWizard(rng, w, false)`). Mantieni la logica di `capSupporto` (varietà di ruolo ≤1 Supporto) ma **applicala a TUTTE le squadre nemiche**, non solo elite/boss: in `pickTowardBudget` sostituisci
```ts
  return guaranteeOffense ? capSupporto(rng, team, window, ...) : team
```
con
```ts
  return ensureOffense(rng, capSupporto(rng, team, window), window)
```

Aggiungi la funzione (vicino a `capSupporto`):
```ts
/** Garanzia a livello di SQUADRA (sostituisce il vecchio bias offensivo per-unità):
 *  una squadra nemica deve schierare ≥1 unità la cui firma fa danno, altrimenti è una
 *  vittoria gratis. Se nessuna lo fa, rimpiazza l'unità più debole con il miglior
 *  candidato dalla `window` la cui firma è offensiva. I Supporti restano Supporti:
 *  non si forza mai un attacco su un ruolo non-offensivo. */
function ensureOffense(rng: Rng, team: DraftedWizard[], window: Wizard[]): DraftedWizard[] {
  if (team.some(d => spellIsOffensive(d.spell))) return team
  const usedIds = new Set(team.map(d => d.wizard.id))
  const candidate = window
    .filter(w => !usedIds.has(w.id) && spellIsOffensive(SPELL_BY_ID[w.spellPool[0]!]))
    .sort((a, b) => expectedPower(b) - expectedPower(a))[0]
  if (!candidate) return team
  const weakestIdx = team.reduce((wi, d, i) => (powerOf(d) < powerOf(team[wi]!) ? i : wi), 0)
  const out = [...team]
  out[weakestIdx] = draftWizard(rng, candidate as Wizard, false)
  return out
}
```

Aggiorna `capSupporto` per la nuova firma senza i due booleani:
```ts
function capSupporto(rng: Rng, team: DraftedWizard[], window: Wizard[]): DraftedWizard[] {
  // ...corpo invariato, tranne la riga di rimpiazzo:
  //   out[idx] = draftWizard(rng, replacement, false)
}
```

- [ ] **Step 7: Aggiorna `generateBossTeam` e `themedEnemyTeam`.**

In `generateBossTeam`: le chiamate `pickTowardBudget(rng, perUnit, size, true, true)` diventano `pickTowardBudget(rng, perUnit, size)`. `draftWizard(rng, named, false, true, true)` → `draftWizard(rng, named as Wizard, false)`. Rimuovi il blocco `if (!spellIsOffensive(leader.spell)) leader.spell = guaranteeOffensiveSpell(...)` (131-135): il `forcedSpellIds` del boss resta (leader), ma non c'è più garanzia per-unità; la garanzia di squadra è in `pickTowardBudget`. Se `forcedSpellIds[0]` è non-offensivo per scelta di design, va bene — la squadra ha comunque ≥1 attaccante.

In `themedEnemyTeam`: rimuovi la variabile `guaranteeOffense` e i booleani passati; `chosen.map(w => draftWizard(drawRng, w, false))`; poi `const team = ensureOffense(drawRng, capSupporto(drawRng, draftedTeam, window), window)`.

- [ ] **Step 8: Aggiorna i test dell'engine che assumono il bias/pool multi-spell.**

- `tests/engine/pickSpellVeleno.test.ts`: `pickSpell` ora ignora ruolo/veleno (pool di 1). Riscrivi per verificare solo che `pickSpell(rng, w)` ritorni `SPELL_BY_ID[w.spellPool[0]]`. Rimuovi le asserzioni sul bias di ruolo/veleno.
- `tests/engine/spellRoleBias.test.ts`: costruisce maghi con pool multi-spell per testare il bias — il bias non esiste più. Elimina il file (o riscrivilo per verificare che `pickSpell` ritorni l'unica firma).
- `tests/engine/statRoll.test.ts`: `guaranteeOffensiveSpell` non esiste più (righe ~70). Rimuovi quel `describe`/`it`. Mantieni i test su `fixedStats`/`spellIsOffensive`.
- `tests/engine/supportoNoAttack.test.ts`: iterano `spellPool`; su pool di 1 verificano che la firma del Supporto non sia offensiva — mantieni, adegua a `spellPool[0]`.
- `tests/engine/combat/attackMoveGuarantee.test.ts`: verificava che `pettigrew` (pure support) restasse innocuo o che il guarantee agisse. Adegua alla nuova garanzia di squadra (pettigrew Supporto → firma non offensiva; la squadra ha comunque un attaccante).
- `tests/engine/combat/teamGen.test.ts:95-97`: usava il pool di mcgonagall — adegua a `spellPool[0]`.

- [ ] **Step 9: Esegui i test mirati (GREEN).**

Run: `npx vitest run tests/engine/combat/teamGen.test.ts tests/engine/statRoll.test.ts tests/engine/supportoNoAttack.test.ts`
Expected: PASS, incluse le due nuove garanzie di squadra.

- [ ] **Step 10: Typecheck + suite completa.**

Run: `npx tsc --noEmit`
Expected: pulito (nessun riferimento residuo a `guaranteeOffensiveSpell`/`preferOffense`/`guaranteeOffense`).
Run: `npx vitest run`
Expected: PASS completo. Verifica in particolare `tests/engine/endlessReplayParity.test.ts` → 0-mismatch (la parità RNG regge).

- [ ] **Step 11: Commit.**

```bash
git add -A
git commit -m "feat(duos): supporti non attaccano; garanzia offensiva a livello di squadra"
```

---

## Self-Review (compilata durante la stesura)

- **Copertura spec:** §1 modello dato → Task 2 (via pool-di-1, non rename — deviazione motivata, vedi Global Constraints). §2 selezione → Task 3. §3 swap → Task 1; rete sicurezza nemici → Task 3 (`ensureOffense`); `forcedSpellIds` → Task 3 Step 7 (conservato). §4 test/parità → gate in ogni task, parità in Task 3 Step 10. ✓
- **Placeholder:** nessun TBD/TODO; ogni step ha comando + esito atteso e, dove cambia codice, il codice. ✓
- **Type-consistency:** `draftWizard(rng, wizard, allowShiny)` a 3 argomenti usato coerentemente in Task 3 Step 6-7; `ensureOffense`/`capSupporto` firme allineate; `pickSpell(rng, wizard)` a 2 argomenti. ✓
- **Deviazione dichiarata dalla spec:** niente rename a `signature` (nome occupato) → si usa pool-di-1 con invariante. La spec verrà aggiornata di conseguenza.
- **Da rivedere con l'utente (dati, non architettura):** la tabella delle 60 firme (Task 2) e la decisione veleno (Task 2 Step 3).
