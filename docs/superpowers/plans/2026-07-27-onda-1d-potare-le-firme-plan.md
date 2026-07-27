# Piano — Onda 1.d: potare le firme a ~15 percepibili

**Spec:** `docs/superpowers/specs/2026-07-27-onda-1d-potare-le-firme.md`
**Base:** `master` @ `c81b6ce` (Onda 1.e mergiata e pushata, suite verde)
**Forma:** 4 task, esecuzione subagent-driven (implementer + reviewer per task).

---

## Baseline di bilanciamento — catturato PRIMA di ogni modifica

Misurato su `c81b6ce`, 2026-07-27, con
`npx vitest run tests/engine/campaignBalanceB.test.ts tests/engine/campaignBalanceRestricted.test.ts --reporter=verbose`:

| Harness | winRate | normalBattlesWon | nodesResolved | maxDepth area0/1/2 |
|---|---|---|---|---|
| `campaignBalanceRestricted` | 0.0417 | 98 | 551 | 87/8/25 |
| `campaignBalanceB` (overall) | 0.0000 | 7 | 233 | 116/2/2 |
| `[muro veleno]` | withVeleno=0.000 · noVeleno=0.000 | — | — | — |

> ⚠️ **Avvertenza di metodo, da rispettare nel Task 4.** Con `winRate=0.0000` su B e
> `0.0417` (= 5 run su 120) su Restricted, **il winRate non ha risoluzione** per misurare
> questa onda: un effetto reale può muoversi interamente dentro il rumore di ±1 seed.
> I segnali con risoluzione utile sono **`normalBattlesWon`** e **`maxDepthByArea`**.
> È la stessa trappola dell'Onda 1.e (baseline non comparabile): qui il confronto è pulito
> perché non si tocca nessun nodo, ma **la risoluzione resta bassa e va dichiarata**.

---

## Task 1 — Potare il catalogo a 15 firme

**File:** `data/signatures.ts` · **Test:** `tests/data/signatures.catalog.test.ts` (nuovo)

**TDD — scrivere prima questi test:**
1. `SIGNATURES` ha **esattamente 15** voci.
2. Gli id presenti sono esattamente: `dumbledore, voldemort, harry, snape, bellatrix,
   mcgonagall, lupin, kingsley, fleur, hermione, cho, molly, neville, luna, tonks`.
3. **Nessun clone:** non esistono due firme con lo stesso `name`.
4. **Guard anti-regressione (il cuore di D4):** nessuna firma sopravvissuta ha come **unico**
   trigger un modificatore piatto — cioè un solo trigger `kind:'modifier'` su
   `modifyOutgoingDamage`/`modifyIncomingDamage`/`modifyHealing`. (Eccezione dichiarata e
   commentata: `mcgonagall`, il pilastro Tank, è ammessa esplicitamente per id.)
5. **Tutti e 60 i maghi restano** in `WIZARDS` (`data/wizards.ts` intatto).

**Implementazione:** rimuovere le 45 voci; rimuovere le costanti di budget e i trigger
builder che restano **orfani** (verificare con `tsc --noEmit` + ricerca testuale prima di
cancellare — non rimuovere ciò che è ancora referenziato).

**Vincoli:** NON toccare `data/wizards.ts`. NON aggiungere né potenziare firme (§8 della spec).

---

## Task 2 — La targa oro sparisce sui maghi senza firma

**File:** `lib/wizardAbilities.ts`, `components/cards/WizardCardColumn.tsx`
**Test:** `tests/lib/wizardAbilities.test.ts` (aggiornare), test carta-poster

**TDD:**
1. `abilityFor(id)` torna `undefined` per un mago senza firma (es. `goyle`), e
   `{name, blurb}` per uno dei 15 (es. `cho`).
2. La carta-poster **non rende** la targa (`AbilityPlate`) per un mago senza firma —
   nessun placeholder, nessun testo di ruolo.
3. La carta-poster **rende** la targa per un mago dei 15.

**Implementazione:** cambiare la firma di ritorno di `abilityFor` in
`{name, blurb} | undefined`, eliminare il fallback per-ruolo, e mettere il rendering di
`<AbilityPlate>` dietro una guardia in `WizardCardColumn` (~riga 353).

**Nota:** `WizardCardRow` (riga 159) è **già** dietro `{signature && …}` → non va toccato,
ma serve un test che lo blocchi contro regressioni future.

---

## Task 3 — Ripulire i test che dipendono dalle firme tolte

Passare l'intera suite e sistemare **solo** ciò che rompe a causa della potatura.

**Regola non negoziabile:** se un test rompe perché *misurava una meccanica reale* (es. un
counter di combattimento ancorato al veleno di `draco`), **non si riancora il numero**: si
ri-esprime il test sul mago sopravvissuto che copre quella meccanica (`snape`), oppure lo si
cancella se la meccanica non esiste più. Ogni fixture ri-ancorata va **giustificata per
iscritto** nel commit.

`tests/engine/signatures.test.ts` usa un catalogo iniettato (`catalog` param) → dovrebbe
essere immune; verificarlo, non assumerlo.

**Uscita:** `npm run test` verde, `npm run typecheck` pulito.

---

## Task 4 — Misura A/B e referto onesto

Rieseguire il comando del baseline e produrre un referto che riporta la tabella
**prima → dopo** per tutte e cinque le colonne.

**Obblighi del referto:**
- Dichiarare la **bassa risoluzione del winRate** (vedi avvertenza sopra) e basare la lettura
  su `normalBattlesWon` / `maxDepthByArea`.
- Dichiarare che il confronto **è** pulito (nessun tipo di nodo toccato) — a differenza
  dell'Onda 1.e.
- Ricordare che le firme valgono per **entrambi** gli schieramenti (`simulate.ts:148`):
  un eventuale spostamento non è attribuibile al solo player.
- **Nessuna ritaratura.** Si scrive il numero e si ferma lì. Se il gioco è più difficile,
  vale la regola di progetto *"la difficoltà più cattiva è approvata"* → decide il playtest.
- Se il delta è dentro il rumore, **dirlo**: "non misurabile con questo strumento" è un
  risultato valido, ed è la lezione dell'Onda 1.e.

**Aggiornare:** `docs/superpowers/HANDOFF.md` e `2026-07-25-core-fun-direction.md`
(marcare 1.d come FATTA con il referto).

---

## Fuori scope

Onda 1.f (reliquie di statistiche piatte) — slice successiva, stessa logica di sottrazione.
