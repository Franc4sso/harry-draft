# Tratti "Shiny" nel Draft — Design

**Data:** 2026-06-26
**Stato:** Approvato (impianto), in revisione utente
**Scope:** Trasformare i tratti generici da attributi FISSI dei maghi a una rara "natura shiny" tirata nel draft del giocatore (~1.5% per carta), con epiteto nel nome e marcatura visiva. Segue e dipende da `2026-06-26-unique-wizard-signatures-design.md` (le signature sono ora l'identità permanente di ogni mago).

---

## 1. Obiettivo e concetto

- I **tratti fissi vengono rimossi** dal combattimento: di norma un mago non ha tratti. La sua identità permanente è la **signature** (già implementata).
- Ogni **carta mostrata nel draft del giocatore** ha **~1.5%** di uscire **shiny**: riceve **un tratto casuale** tra i 17 del catalogo, un **epiteto nel nome** e un **trattamento visivo** speciale.
- Stile "shiny Pokémon": raro, fortunato, esteticamente distinto — senza nuovi asset.
- Solo il draft del **giocatore**. I nemici (generati separatamente) non hanno shiny.
- **Deterministico dal seed**: lo stesso seed produce gli stessi shiny (replay/persistenza safe).

## 2. Modello dati

### `DraftedWizard` (in `types/combat.ts`)
Nuovo campo opzionale:
```ts
shiny?: { traitId: string }
```
Persiste automaticamente in `DraftSession.picks` → `RunState.team` → `BattleUnit` (che estende `DraftedWizard`). Nessuna modifica alla serializzazione.

### `Wizard` (in `types/wizard.ts`)
- **Rimosso** `traits?: string[]` (diventa dato morto: la nuova fonte di tratti è `dw.shiny`).
- **Aggiunto** `gender: 'm' | 'f'` (serve a concordare l'epiteto). Tutti i 60 maghi ricevono il valore corretto dal canone.

### Catalogo tratti (in `data/traits.ts`)
Ogni `Trait` guadagna un epiteto concordato per genere:
```ts
epithet: { m: string; f: string }
```

| Trait | Epiteto (m) | Epiteto (f) |
|-------|-------------|-------------|
| esecuzione | il Carnefice | la Carnefice |
| furia | il Furioso | la Furiosa |
| roccia | l'Incrollabile | l'Incrollabile |
| sifone | il Sanguisuga | la Sanguisuga |
| benedizione | il Benedetto | la Benedetta |
| pietrificazione | il Pietrificante | la Pietrificante |
| bavaglio | il Silenziatore | la Silenziatrice |
| disarmo | il Disarmante | la Disarmante |
| veleno | il Velenoso | la Velenosa |
| logoramento | lo Sfiancante | la Sfiancante |
| ferocia | il Feroce | la Feroce |
| rigenerazione | il Rigenerante | la Rigenerante |
| anticipo | il Fulmineo | la Fulminea |
| crescendo | l'Inarrestabile | l'Inarrestabile |
| vendetta | il Vendicatore | la Vendicatrice |
| frantumazione | il Devastatore | la Devastatrice |
| gelo | il Glaciale | la Glaciale |

## 3. Roll dello shiny (deterministico)

In `game/engine/statRoll.ts`, `draftWizard(rng, wizard)`:
1. pick spell (come ora, `rng.pick(wizard.spellPool)`),
2. **poi** `rng.chance(BALANCE.draft.shinyChance)` (nuova costante `= 0.015`),
3. se vero, pick di un trait id casuale dal catalogo: `rng.pick(SHINY_TRAIT_IDS)` (i 17 id) → `shiny = { traitId }`.

L'ordine (spell prima, shiny poi) è esplicito. Aggiungere il roll consuma rng per carta → lo **stream del draft cambia** rispetto a oggi (i candidati possono mostrare spell diverse). È atteso e deterministico; le eventuali fixture di draft vanno rigenerate.

> Nota: `SHINY_TRAIT_IDS` è la lista dei 17 id, esportata da `data/traits.ts` (`TRAITS.map(t => t.id)`), così non si duplica.

## 4. Nome ed epiteto

Helper `displayName(dw: DraftedWizard): string` (nuovo, es. in `lib/displayName.ts`):
```ts
if (!dw.shiny) return dw.wizard.name
const t = TRAIT_BY_ID[dw.shiny.traitId]
const ep = t.epithet[dw.wizard.gender]
return `${dw.wizard.name}, ${ep}`   // es. "Harry Potter, il Velenoso"
```
Formato con **virgola** (scelta utente). Applicato a **tutti** i punti che mostrano il nome completo:
`WizardCard.tsx`, `WizardCardRow.tsx`, `SquadPanel.tsx`, `TeamScreen.tsx`, e il log di battaglia (la `name` dello `ReplayUnit` va valorizzata con `displayName` alla costruzione del replay/units, così "…, il Velenoso" compare nei log).

> Iniziale avatar in `SquadPanel` (`name.charAt(0)`) resta sul nome base (non sull'epiteto).

## 5. UI — marcatura shiny

- **Carta draft (`WizardCardRow`, e `WizardCard`)**: se `dw.shiny`,
  - aura/bordo dorato-iridescente + glyph ✨ vicino al nome,
  - trattamento CSS sul ritratto esistente (overlay gradiente dorato / leggero shift cromatico), **nessun nuovo asset**,
  - la **chip del tratto** (riuso lo stile blu "Tratti" già presente, ora alimentato da `dw.shiny` invece che da `wizard.traits`) mostra nome tratto + tooltip descrizione.
- Coerenza: la signature (chip oro ★) resta sempre presente; lo shiny aggiunge la chip tratto (blu ✦) **solo quando shiny**. I due si distinguono per colore/icona.

## 6. Punti di consumo da aggiornare (rimozione tratti fissi)

`wizard.traits` non viene più letto da nessuna parte. Da cambiare:
- `game/engine/traits.ts` `registerTraitTriggers`: legge `u.shiny?.traitId` (0 o 1 tratto) invece di `u.wizard.traits`. Funziona già su tutte le unità; i nemici non avranno mai `shiny`, quindi 0 tratti per loro.
- `components/cards/WizardCardRow.tsx` e `components/cards/WizardCard.tsx`: trait chip da `dw.shiny`.
- Test esistenti che pretendono tratti fissi (`tests/data/traitAssignment.test.ts`, parti di `tests/engine/traitsPhase3.test.ts`): aggiornati o rimossi.
- Dati: rimosso il campo `traits` dalle 60 voci di `data/wizards.ts`.

## 7. Bilanciamento

Rimuovere i tratti fissi (oggi attivi su **entrambe** le squadre) cambia il combattimento. La banda di difficoltà è calibrata coi tratti attivi, quindi:
1. Dopo l'implementazione, eseguire `tests/engine/campaignBalance.test.ts` e `balance.test.ts`.
2. Se fuori banda (clearRate 0.08–0.18, firstStage >0.65, bossWin 0–0.30, capped <0.05), ricalibrare con il **minor raggio d'azione**: prima le costanti menace/relic in `data/constants.ts`; eventualmente i budget delle signature in `data/signatures.ts`.
3. Lo shiny in sé NON entra nel test di banda: il greedy player sceglie per `powerOf` (che non considera lo shiny) e a 1.5% è statisticamente irrilevante su 200 campagne.
4. Rigenerare le fixture seed-dipendenti impattate (combattimento senza tratti fissi + stream draft spostato).

## 8. Testing

- **Roll**: con seed fisso, `draftWizard` produce shiny deterministico; su grande campione la frequenza ≈ 1.5%; quando shiny, `traitId` è uno dei 17.
- **Combattimento**: un `DraftedWizard` con `shiny.traitId` attiva quel trigger di tratto; senza shiny, nessun trigger di tratto (i nemici non ne hanno mai).
- **displayName**: con/ senza shiny, e concordanza di genere (un mago `f` → forma femminile).
- **Integrità dati**: ogni mago ha `gender`; ogni trait ha `epithet.m` e `epithet.f`; `SHINY_TRAIT_IDS` ha 17 elementi.
- **Regressione**: aggiornare i test sui tratti fissi; rigenerare fixture; banda campagna verde dopo ricalibrazione.

## 9. Fuori scope

- Shiny per i nemici.
- Immagini/artwork shiny dedicati (si usa solo CSS).
- Più di un tratto shiny per mago (sempre 0 o 1).
- Modifiche alle probabilità per tier (lo shiny è uniforme: 1.5% per carta, tratto uniforme tra i 17).
