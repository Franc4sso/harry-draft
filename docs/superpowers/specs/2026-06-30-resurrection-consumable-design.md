# Reliquia consumabile di resurrezione — "Lacrime di Fenice" — design

> Data: 2026-06-30. Backlog `docs/superpowers/remaining-work.md` §1 (richiesta utente): reliquia
> one-shot **attivabile prima di qualsiasi nodo**, che **resuscita** i maghi morti e si **consuma**
> all'uso. NUOVO meccanismo: oggi tutte le reliquie sono permanenti/passive — non esiste consumo né
> uso attivo. Funge anche da **leva di recupero mid-area** (sblocca il boss finale forte, backlog #5).

## Concept

Oggi un mago morto (`currentHp <= 0`, `game/engine/roster.ts`) resta in panchina a 0 HP fino
all'Infermeria (heal+revive completo, forzata solo prima di ogni boss). Tra un boss e l'altro, una
squadra decimata resta debole — il sistema morte ha reso il gioco più duro (memory
`harry-draft-death-system-harder`). **Le Lacrime di Fenice** sono la leva di recupero a scelta del
giocatore: un consumabile che riporta in vita i caduti quando serve, al prezzo di bruciarlo.

Distinta dall'Infermeria di proposito: l'Infermeria **cura + resuscita** (full); le Lacrime
**solo resuscitano** (i caduti tornano a `maxHp`, i vivi feriti NON vengono curati — la cura resta
il mestiere dell'Infermeria). Sono due leve diverse, non ridondanti.

## Non è un archetipo — niente matrice counter

È un oggetto di utility/economia, non un kit di combattimento: nessuna matrice counter. La validazione
è **unit-test sull'engine** (resuscita + consuma + ricomputa synergie + guardie no-op) + un **UI test**
sul bottone "Usa" (mirror `loadoutPanel.test.tsx`).

## Sezione 1 — Type: il discriminatore "active"

`Relic` (`types/relic.ts`) acquisisce UN campo opzionale:
```ts
/** Reliquia consumabile ad uso attivo (non passiva in combattimento). 'revive' = Lacrime di Fenice. */
active?: 'revive'
```
- Una reliquia con solo `active` e nessun campo passivo è **già inerte in combattimento** (il combat
  legge solo `bonus`/`grantsExecute`/… — non `active`): zero modifiche al motore di battaglia.
- `ActiveRelic` NON acquisisce campi: "consumato" = **rimosso** dall'array `relics` (non un boolean
  `used`). Più pulito, e persiste gratis via `saveRun` (serializza l'intero `RunState`).

## Sezione 2 — Engine: la mutazione pura `useConsumableRelic`

Nuova funzione pura in `game/engine/runEngine.ts`, **accanto a `setWizardSpell`** (stesso pattern di
mutazione fuori-nodo) — **nessun `Rng`** (resurrezione deterministica; pescare dallo stream
desincronizzerebbe la generazione nodi forkata per area/floor):
```ts
/** Usa una reliquia consumabile: resuscita i caduti (currentHp→maxHp) e la rimuove dall'inventario.
 *  Pura, no RNG. No-op (stato invariato, reliquia NON consumata) se: id non posseduto, reliquia non
 *  active:'revive', o nessun mago morto (niente da fare → non si spreca). */
export function useConsumableRelic(state: RunState, relicId: string): RunState
```
Logica:
1. Trova `ActiveRelic` con `relic.id === relicId`. Se assente o `relic.active !== 'revive'` → ritorna
   `state` invariato (guardia no-op, come i 4 guard di `setWizardSpell`).
2. Se `state.team` non ha nessun `isDead` → ritorna `state` invariato (non si consuma a vuoto).
3. Altrimenti: `team = state.team.map(dw => isDead(dw) ? { ...dw, currentHp: dw.maxHp } : dw)`
   (riusa esattamente il revive dell'Infermeria, `resolvers/infirmary.ts:9`, gated su `isDead`).
4. **Ricomputa le synergie** del nuovo set di vivi se `RunState` le porta — confermare il campo e
   rispecchiare `resolvers/recruit.ts:37` (`detectSynergies(livingOf(team))`). ⚠️ l'Infermeria OMETTE
   questo step (bug latente: il suo full-heal cambia anch'esso il set di vivi) — NON copiare l'omissione.
5. `relics = state.relics.filter(a => a.relic.id !== relicId)` (la rimozione: prima volta che
   `state.relics` si restringe in tutto il codebase).
6. Ritorna `{ ...state, team, relics, <synergie se presenti> }`.

## Sezione 3 — Contenuto: la reliquia

In `data/relics.ts`, una entry (id `lacrime-fenice` — `pietra-resurrezione` è già preso da una
reliquia passiva): `{ id: 'lacrime-fenice', name: 'Lacrime di Fenice', desc: '<IT>', rarity: 'epica',
active: 'revive' }`. Desc IT: le lacrime di una fenice riportano in vita i caduti — una sola volta.
Entra nel pool reliquie normale (offerta ai nodi `relic` come le altre).

`tests/data/relics.test.ts`: allargare onestamente l'invariante "la reliquia fa qualcosa" per accettare
`active` (come fu fatto per `grantsExecute`/`grantsAlwaysHit`) — deve ancora rifiutare una reliquia vuota.

## Sezione 4 — Controller + UI

- **Controller** `useRunB.ts`: nuovo callback `useConsumableRelic(relicId)` modellato 1:1 su
  `setWizardSpell` (`useRunB.ts:119-121`): chiama la fn pura, poi `commit(next)` (→ `saveRun` persiste).
  Nessun cambio di view (resti sulla mappa).
- **UI**: nella sidebar sinistra del `RunBRunner` (visibile sulla `map` view), per ogni reliquia
  `active` posseduta mostra un bottone **"Usa"**. Riusa/affianca `RelicBar`
  (`components/relics/RelicBar.tsx`). Il bottone è **abilitato solo se c'è ≥1 mago morto**
  (`team.some(isDead)`) — altrimenti disabilitato (niente da resuscitare, evita lo spreco); on-click →
  `onUse(relicId)`. Accessibile (`aria-disabled`/`disabled`, label chiara).
- **UI test** (mirror `tests/ui/loadoutPanel.test.tsx`): con una `lacrime-fenice` posseduta e un mago
  morto → bottone "Usa" presente e abilitato → click chiama `onUse('lacrime-fenice')`. Con nessun morto
  → bottone disabilitato.

## Gotchas (dal report di investigazione)
- **Determinismo**: la fn NON prende `Rng` (come `setWizardSpell`). La suite seeddata resta verde.
- **Save/load**: "consumato = rimosso" persiste gratis; nessun bump di `runStore` VERSION (aggiungere
  un campo OPZIONALE al catalogo statico `Relic` è retro-compatibile; i save vecchi semplicemente non
  contengono la nuova reliquia inline — atteso, non un blocco).
- **Due loop**: ignorare il legacy `game/engine/run.ts` (test-only). Costruire solo su RunB.
- **Synergie**: ricomputare dopo il revive (non copiare l'omissione dell'Infermeria).

## Non in scope (YAGNI)
- Altri tipi di consumabile oltre `'revive'` (il tag stringa è già estendibile quando servirà).
- Cura dei vivi feriti (è dell'Infermeria; le Lacrime sono solo-revive di proposito).
- Uso durante la battaglia (solo fuori-nodo, sulla mappa).
- Fix dell'omissione-synergie dell'Infermeria (task separato; qui NON la riproduciamo, ma non la fixiamo lì).

## Ordine di implementazione (per il piano)
1. **Engine + dati**: `Relic.active?: 'revive'` + `useConsumableRelic` (runEngine) + reliquia
   `lacrime-fenice` + unit test (TDD: revive+consume+synergie+no-op guards) + invariante relics allargata.
2. **Controller + UI**: callback `useConsumableRelic` in `useRunB` + bottone "Usa" nella sidebar +
   UI test.
3. **Docs**: `remaining-work.md` item #3 → done.
