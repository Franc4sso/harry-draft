# Rimozione sinergie casata + ruolo (fase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rimuovere le sinergie di ruolo (bonus flat) e di casata (sinergia + poteri passivi dodge/crit/DR/cunning) per sgomberare il campo verso i Trio di casata (fase 2). Group + origin restano. Ri-bilanciare.

**Architecture:** La rimozione è guidata dai DATI: togliere le entry `kind:'role'` e `kind:'house'` da `SYNERGIES` (`data/synergies.ts`). Questo spegne AUTOMATICAMENTE i poteri di casata, perché `houseEffects()` deriva il tier dalle sinergie house presenti — senza sinergie house, la sua mappa è vuota. `applyBonuses`/`totalRegen`/`detectSynergies` continuano a funzionare (iterano su meno sinergie). I campi combat (dodgeBonus/critBonus/damageReduction/cunning) restano sul tipo (li usano reliquie/DR-battaglia). Poi: pulizia dei test obsoleti, UI, e ri-misura del balance.

**Tech Stack:** TypeScript, motore di combattimento deterministico, React (Next.js), Vitest.

## Global Constraints

- **Rimuovere SOLO role + house** da `SYNERGIES`. **RESTANO**: `kind:'group'` (Golden Trio, Weasley, Mangiamorte, Malandrini, DA, Ordine) e `kind:'origin'` (Tossicità, Spietatezza, Bastione, Oscurità). Le origin alimentano i segnali dei Duo → NON toccarle.
- **Non reintrodurre i poteri di casata** sotto altra forma (li sostituiranno i Trio in fase 2).
- I campi `dodgeBonus`/`critBonus`/`damageReduction`/`cunning` su `BattleUnit` **RESTANO** (reliquie + DR-battaglia li usano). Si smette solo di alimentarli dalle case.
- **Balance**: se il ri-bilanciamento richiede più di UN ritocco leva, FERMARSI e riportare i numeri all'utente (decisione di difficoltà, non automatica). Leva primaria = enemy count; NON reintrodurre i poteri di casata.
- `npm run test` NON esegue typecheck → `npm run typecheck` a parte.
- Copy in italiano.

---

### Task 1: Rimuovi le sinergie role + house dai dati

Togli le 24 entry (12 role + 12 house) da `SYNERGIES`. Verifica che `detectSynergies` non le ritorni più e che `houseEffects` si auto-spenga.

**Files:**
- Modify: `data/synergies.ts` (rimuovi le entry `kind:'role'` e `kind:'house'`)
- Test: `tests/engine/synergy.test.ts` o nuovo `tests/engine/synergyRemoval.test.ts`

**Interfaces:**
- Consumes: `SYNERGIES` (data), `detectSynergies`, `houseEffects`.
- Produces: `SYNERGIES` contiene solo group + origin (10 entry). `detectSynergies` non ritorna mai role/house. `houseEffects` ritorna sempre `{}` (nessun tier house attivabile).

- [ ] **Step 1: Write the failing test**

Crea `tests/engine/synergyRemoval.test.ts`. Riusa il factory di team dei test synergy esistenti (`grep -n "dw\|DraftedWizard\|team" tests/engine/synergy.test.ts`):

```ts
import { describe, it, expect } from 'vitest'
import { detectSynergies } from '@/game/engine/synergy'
import { houseEffects } from '@/game/engine/houseEffects'
// riusa il factory di DraftedWizard dei test esistenti

describe('rimozione sinergie role/house', () => {
  it('detectSynergies NON ritorna più sinergie di ruolo', () => {
    const team = /* 3 Attaccanti */
    expect(detectSynergies(team).some(a => a.synergy.kind === 'role')).toBe(false)
  })
  it('detectSynergies NON ritorna più sinergie di casata', () => {
    const team = /* 4 Grifondoro */
    expect(detectSynergies(team).some(a => a.synergy.kind === 'house')).toBe(false)
  })
  it('houseEffects è vuoto (nessun potere di casata)', () => {
    const team = /* 4 Serpeverde */
    expect(Object.keys(houseEffects(team, detectSynergies(team)))).toHaveLength(0)
  })
  it('le sinergie group/origin RESTANO', () => {
    const team = /* 3 maghi tag veleno → Tossicità (origin) */
    expect(detectSynergies(team).some(a => a.synergy.kind === 'origin')).toBe(true)
  })
})
```

(Adatta i team alle fixture reali — quali maghi hanno quale casata/ruolo/tag. Guarda `tests/engine/synergy.test.ts` per come costruiscono i team.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/synergyRemoval.test.ts`
Expected: FAIL — role/house ancora presenti, houseEffects non vuoto.

- [ ] **Step 3: Rimuovi le entry role + house da SYNERGIES**

In `data/synergies.ts`, elimina TUTTE le entry con `kind: 'role'` (12: attackers2/3/4, tanks2/3/4, supports2/3/4, controls2/3/4 — verifica i nomi esatti) e `kind: 'house'` (12: gryffindor/slytherin/ravenclaw/hufflepuff 2/3/4). Lascia intatte le `kind:'group'` e `kind:'origin'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/synergyRemoval.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: pulito. (`houseEffects.ts` compila ancora — non lo tocchiamo, si auto-spegne. Se qualcosa importava una sinergia role/house per id, rompe qui → correggilo.)

- [ ] **Step 6: Commit**

```bash
git add data/synergies.ts tests/engine/synergyRemoval.test.ts
git commit -m "feat(synergy): rimuovi le sinergie di ruolo e casata (poteri casata auto-spenti)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Pulizia dei test obsoleti (casata/ruolo)

Molti test asseriscono i poteri di casata o le sinergie role/house rimosse. Vanno rimossi o riscritti. Questo task è la bonifica.

**Files (da ispezionare e sistemare — non tutti vanno rimossi, alcuni riscritti):**
- `tests/engine/houseEffects.test.ts`, `tests/engine/houseEffectsStamp.test.ts`, `tests/engine/houseCombat.test.ts`, `tests/engine/houseEffectText.test.ts`, `tests/engine/houseSynergyContent.test.ts` — testano i poteri di casata → RIMUOVERE (la meccanica non esiste più).
- `tests/engine/serpeverdeBalance.test.ts` — gate il cunning Serpeverde → RIMUOVERE.
- `tests/data/synergies.test.ts`, `tests/engine/synergy.test.ts`, `tests/engine/synergyProgress.test.ts`, `tests/lib/synergyText.test.ts`, `tests/lib/glossary.test.ts` — se asseriscono conteggi/contenuti di role/house → AGGIORNARE ai valori nuovi (solo group+origin).
- `tests/ui/synergyGraph.test.tsx`, `tests/ui/synergyRibbon.test.tsx`, `tests/ui/synergyTracker.test.tsx`, `tests/screens/TeamSynergyBar.test.tsx`, `tests/ui/houseCrest.test.tsx` — se renderizzano/asseriscono sinergie role/house → AGGIORNARE.

**Interfaces:**
- Consumes: lo stato post-Task-1 (SYNERGIES ridotto, houseEffects vuoto).
- Produces: suite verde senza test che asseriscono meccaniche rimosse.

- [ ] **Step 1: Individua i test rossi**

Run: `npm run test 2>&1 | grep -iE "fail|❯"` (o gira i file sopra uno a uno).
Elenca ogni test rosso e classifica: (a) testa una meccanica RIMOSSA (poteri casata, sinergia role/house) → rimuovere il test/blocco; (b) asserisce un conteggio/contenuto che è solo CAMBIATO → aggiornare al nuovo valore.

- [ ] **Step 2: Rimuovi i test delle meccaniche rimosse**

`git rm` i file interamente dedicati ai poteri di casata: `houseEffects.test.ts`, `houseEffectsStamp.test.ts`, `houseEffectText.test.ts`, `houseCombat.test.ts`, `houseSynergyContent.test.ts`, `serpeverdeBalance.test.ts`. (Verifica prima che ogni file sia INTERAMENTE su meccaniche rimosse; se un file ha anche test validi, rimuovi solo i blocchi obsoleti.)

- [ ] **Step 3: Aggiorna i test di conteggio/contenuto**

Nei file synergy/UI, aggiorna le asserzioni che contavano role/house (es. "14 sinergie" → il nuovo totale group+origin = 10; una lista che mostrava le case → ora solo group+origin). NON cambiare la logica testata, solo i valori attesi.

- [ ] **Step 4: Typecheck + suite (senza balance)**

Run: `npm run typecheck`
Expected: pulito.

Run: `npx vitest run tests/engine/synergy.test.ts tests/data/synergies.test.ts tests/ui/synergyTracker.test.tsx tests/ui/synergyRibbon.test.tsx tests/ui/synergyGraph.test.tsx tests/screens/TeamSynergyBar.test.tsx tests/lib/synergyText.test.ts`
Expected: verdi.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(synergy): rimuovi/aggiorna i test delle meccaniche casata rimosse

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: UI — le sinergie mostrano solo group+origin, niente poteri casata

Verifica che la UI delle sinergie (draft/battle) non mostri più role/house né i testi dei poteri di casata, e non si rompa su liste ridotte.

**Files:**
- Modify (se necessario): `components/draft/SynergyTracker.tsx`, `components/battle/SynergyRibbon.tsx`, e dove `houseEffectText` è mostrato.
- Test: i test UI del Task 2 coprono il rendering.

**Interfaces:**
- Consumes: `activeSynergies` (ora solo group+origin), `houseEffects` (vuoto).
- Produces: UI che mostra solo group+origin; nessun riferimento ai poteri di casata; nessun crash su liste vuote.

- [ ] **Step 1: Verifica a schermo/test il rendering**

Cerca dove `houseEffectText` è chiamato nella UI (`grep -rn "houseEffectText" components/`). Se è mostrato (es. su una card o hover), rimuovi quella UI (il potere non esiste più). Verifica che SynergyTracker/SynergyRibbon gestiscano una lista di sole group+origin senza assumere che role/house esistano.

- [ ] **Step 2: Sistema eventuali riferimenti + test**

Se qualcosa assume role/house nella UI (es. un raggruppamento per `kind` che si aspetta 'role'), aggiornalo. Aggiungi/aggiorna un test che la UI renderizza correttamente con solo group+origin (o lista vuota → nessun crash).

- [ ] **Step 3: Typecheck + test UI**

Run: `npm run typecheck && npx vitest run tests/ui/ tests/screens/`
Expected: verdi.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): sinergie mostrano solo group+origin; via i testi dei poteri casata

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Ri-misura + ri-taratura del bilanciamento

Rimuovere i poteri di casata sposta la difficoltà. Misura `campaignBalanceB`; se sfora, ritara con UNA leva (enemy count) o fermati.

**Files:**
- Verifica: `tests/engine/campaignBalanceB.test.ts`, `tests/engine/campaignBalanceRestricted.test.ts`.
- Modify (solo se serve ritarare): `data/constants.ts` (`BALANCE.campaignB` — enemy count).

- [ ] **Step 1: Suite piena + misura balance**

Run: `npm run typecheck && npm run test` (suite piena, lenta ~4-8min — in background se serve).
Leggi il valore di `campaignBalanceB` (e `campaignBalanceRestricted`). Confrontalo con la banda dichiarata nel file/header.

- [ ] **Step 2: Decidi**

- Se `campaignBalanceB` è ANCORA in banda → nessun ritocco. Documenta il nuovo valore in un commento/commit e vai allo Step 4.
- Se sfora la banda → ritara con UNA leva: enemy count in `BALANCE.campaignB` (la leva primaria documentata). Rimisura.
- Se un solo ritocco NON basta a rientrare → **FERMATI**. Riporta i numeri (winRate prima/dopo, cosa hai provato) all'utente come BLOCKED. NON reintrodurre i poteri di casata, NON accumulare ritocchi.

- [ ] **Step 3: (se ritarato) rimisura + documenta**

Run: `npx vitest run tests/engine/campaignBalanceB.test.ts tests/engine/campaignBalanceRestricted.test.ts`
Expected: verdi in banda. Documenta la leva toccata e il nuovo valore nel commit.

- [ ] **Step 4: Commit finale**

```bash
git add -A
git commit -m "balance(synergy): ri-misura campaignBalanceB post-rimozione poteri casata [+ ritaratura se applicata]

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (spec: `docs/superpowers/specs/2026-07-14-remove-house-role-synergies-design.md`):
- Rimuovi role + house da SYNERGIES; houseEffects auto-spento → Task 1. ✅
- group/origin intatte → Task 1 (test esplicito) + vincolo globale. ✅
- Campi combat restano → Task 1 (non tocchiamo il tipo né houseEffects.ts). ✅
- Test casata obsoleti rimossi/riscritti → Task 2. ✅
- UI mostra solo group+origin, niente poteri casata → Task 3. ✅
- Ri-bilanciamento con regola di stop → Task 4. ✅

**Placeholder scan:** i punti "adatta alle fixture reali / verifica quali file sono interamente obsoleti" sono ispezioni di codice esistente con grep esatti — necessarie perché la bonifica dei test dipende dal contenuto reale di ognuno. Il codice di produzione da cambiare (rimuovere entry da SYNERGIES, non toccare houseEffects) è netto. La regola di stop del balance è esplicita (un ritocco, poi BLOCKED).

**Type consistency:** `detectSynergies`/`houseEffects`/`applyBonuses` firme invariate (iterano su meno dati). `kind:'group'|'origin'` restano validi. Nessun campo rimosso dai tipi.

**Ordine:** Task 1 (dati, il cuore) → Task 2 (bonifica test resa possibile dal Task 1) → Task 3 (UI) → Task 4 (balance, ha bisogno di tutto il resto stabile per una misura pulita). Il Task 4 è l'unico che può richiedere decisione utente (regola di stop).
