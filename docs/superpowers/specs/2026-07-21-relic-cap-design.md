# Cap reliquie a 5 — con scelta di swap

Data: 2026-07-21
Tipo: fix motore (cap) + nuova infrastruttura scelta pendente + UI swap

## Problema

Il giocatore può accumulare **reliquie all'infinito** — nessun cap. Le reliquie si
aggiungono in 4 punti, tutti con `relics: [...relics, active]` senza controllo:
- `game/engine/resolvers/recruit.ts:59` (nodo Reliquia)
- `game/engine/resolvers/shop.ts:56` (Shop)
- `game/engine/resolvers/altare.ts:44` (Altare Oscuro)
- `game/engine/events.ts:109` (Eventi, `grantRelic` — automatico)

## Visione (decisioni utente)

- **Cap = 5 reliquie.** Vale su **tutte e 4 le fonti**.
- **3 fonti dirette** (nodo Reliquia, Shop, Altare) — hanno una schermata: a 5, il giocatore
  **sceglie quale scambiare** (o rifiuta la nuova), come le reclute.
- **Eventi** (automatici, rari) — a 5, l'effetto `grantRelic` **scarta automaticamente la
  reliquia peggiore** (rarità più bassa; a parità, la più vecchia) e mette quella nuova.
  Decisione 2026-07-21: NIENTE infrastruttura di scelta pendente per gli eventi — il
  rapporto costo/valore non la giustifica (scenario raro: a 5 esatte + evento-reliquia nello
  stesso momento). Se un giorno gli eventi-reliquia diventano frequenti, si aggiunge il popup.

## Architettura

### 1. Costante + funzioni (motore)
- `BALANCE.relics.maxRelics = 5` in `data/constants.ts` (nuovo campo).
- Funzione pura per le 3 fonti dirette (scelta esplicita), in `game/engine/relics.ts`:
  ```ts
  /** Aggiunge una reliquia rispettando il cap con scelta esplicita. Sotto il cap: append.
   *  Al cap con replaceId valido: sostituisce (mantiene ordine). Al cap senza replaceId:
   *  no-op reference-equal (= rifiuto). */
  export function addRelicWithChoice(
    relics: ActiveRelic[], active: ActiveRelic, replaceId?: string,
  ): ActiveRelic[]
  ```
- Funzione pura per gli eventi (scarto automatico), stesso modulo:
  ```ts
  /** Aggiunge una reliquia scartando automaticamente la peggiore se al cap. Sotto il cap:
   *  append. Al cap: rimuove la reliquia di rarità più bassa (a parità, indice minore =
   *  più vecchia) e aggiunge la nuova. */
  export function addRelicAutoDrop(relics: ActiveRelic[], active: ActiveRelic): ActiveRelic[]
  ```
  Ordine rarità (peggiore→migliore) da `RARITY_ORDER`: comune < non-comune < rara < epica.
- Call-site:
  - nodo Reliquia / Shop / Altare → `addRelicWithChoice(state.relics, active, choice.replaceRelicId)`
  - eventi (`events.ts` grantRelic) → `addRelicAutoDrop(s.relics, active)`

### 2. Scelte UI dirette (nodo Reliquia, Shop, Altare)
Questi hanno già una schermata. Aggiungere `replaceRelicId?: string` alle rispettive
`ResolverChoice` (`relic-pick`, `shop-buy`, `altare-buy`) in `resolvers/types.ts`. La UI:
- Se `relics.length < 5`: comportamento attuale (prendi la reliquia).
- Se `relics.length === 5`: la schermata mostra le 5 reliquie possedute; il giocatore
  clicca quale **scambiare** (→ passa `replaceRelicId`) oppure **rifiuta** (non prende).
- Nessuna nuova view: l'UI di swap vive **dentro** la schermata esistente
  (RelicNodeScreen / ShopScreen / AltareScreen) come pannello condizionale "sei al massimo".

### 3. Eventi — scarto automatico (nessuna UI)
In `events.ts` il case `grantRelic` chiama `addRelicAutoDrop(s.relics, active)` invece di
`[...s.relics, active]`. A 5 reliquie scarta la peggiore e mette la nuova; sotto le 5
appende come oggi. Log: se ha scartato, aggiungere al log dell'evento quale reliquia è
uscita (es. `grantRelic <id> (scartata <droppedId>)`) così il giocatore lo vede nel recap.
Nessuna schermata, nessuno stato pendente.

### 4. UI swap condivisa (solo 3 fonti dirette)
Un componente `RelicSwapPanel` (griglia delle 5 reliquie possedute, ognuna cliccabile per
scambiare con la nuova, + bottone "Rifiuta") usato **inline** nelle 3 schermate dirette
(RelicNodeScreen / ShopScreen / AltareScreen) quando `relics.length === 5`. Sotto le 5, le
schermate restano identiche a oggi.

## Cosa NON si rompe (da verificare nel piano)
- I flussi sotto le 5 reliquie: comportamento byte-identico (append come oggi).
- L'assegnazione a un carrier (`assignedTo`/`carrierId` → `corruptOnAssign`) resta: lo swap
  conserva la logica di corruzione della reliquia in arrivo.
- Nessun nuovo campo su RunState (niente scelta pendente) → nessun impatto sul salvataggio.
- Il bot/harness (campaignBalanceRestricted): il near-optimal non raggiunge quasi mai 5
  reliquie (misurare). Se ci arriva: le 3 fonti dirette con `replaceRelicId` non fornito →
  il resolver ritorna no-op (rifiuto), quindi il bot semplicemente non prende la 6ª — nessun
  blocco, nessun handler nuovo richiesto (a differenza di un nuovo node type). Verificare che
  il no-op sia reference-equal così l'harness non lo scambia per un avanzamento.

## Impatto balance
Cap a 5 = **meno potere accumulabile** → il gioco può diventare più duro. Ma il near-optimal
raramente supera 5 reliquie (da misurare). Rimisurare `campaignBalanceRestricted`; se cala
sotto la soglia (già 0.0083, assert `>0`), documentare — non forzare leve senza decisione
utente.

## Criteri di successo
1. Impossibile avere più di 5 reliquie da qualsiasi fonte.
2. A 5, ogni fonte offre swap-o-rifiuta (le 3 dirette inline, gli eventi via schermata pendente).
3. Sotto le 5: comportamento invariato.
4. `tsc --noEmit` 0, suite verde, gate `>0`.
