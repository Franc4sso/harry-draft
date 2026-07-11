# Design: una magia firma per mago (UN MAGO, UNA MAGIA)

**Data:** 2026-07-11
**Branch di partenza:** feat/duo-card-discoverability
**Stato:** design approvato, in attesa di review della spec

## Obiettivo

Dare a ogni mago **identità in combattimento**: ogni mago lancia sempre e solo **una**
magia — la sua *firma* — invece di pescarne una a caso da un pool al momento del
reclutamento. Reclutare un mago significa sapere esattamente cosa farà in battaglia.

Motivazione primaria (decisa dall'utente): **leggibilità/identità in combattimento**.
Non è per rendere oneste le card dei Duo — quelle derivano già da ruolo+tag e sono
deterministiche. Non è primariamente bilanciamento — l'exploit dello swap è già
neutralizzato dal bot che ottimizza le magie.

### Fuori scope (YAGNI)

- Nessun ribilanciamento globale dei numeri (stat, budget, difficoltà).
- Nessun nuovo sistema di magie sbloccabili/multiple da un'altra porta.
- Nessuna nuova magia: le firme vengono dalle magie **canoniche** già esistenti.

## Decisioni chiave (dall'utente)

1. **Vale per tutti** — maghi del giocatore E nemici. Pool eliminato ovunque.
2. **Firme canoniche, duplicati ammessi** — le firme escono dal set di magie canoniche
   di Harry Potter già presenti nei pool. Due maghi POSSONO condividere la stessa firma
   (le magie canoniche non bastano per 60 firme uniche, ed è accettabile).
3. **I supporti restano supporti** — la firma di un Supporto è una cura/utility, MAI un
   attacco. La vecchia logica che infilava attacchi ai supporti (`preferOffense`/
   `guaranteeOffense`) era un difetto estetico e viene rimossa, non sostituita.
4. **La minaccia nemica si garantisce a livello di SQUADRA, non di unità** — non si forza
   un supporto ad attaccare; si garantisce in `teamGen` che una squadra nemica abbia
   sempre almeno un attaccante (rinforzo di `capSupporto`, che già impone varietà di ruolo).

## Architettura

### 1. Modello dati — `types/wizard.ts` + `data/wizards.ts`

`Wizard.spellPool: string[]` → `Wizard.signature: string`.

Ogni mago (60) riceve una firma autorata a mano:
- **In-ruolo**: Attaccante→attacco, Supporto→cura/utility, Tank→scudo/taunt, Controllo→controllo.
- **Coerente coi tag**: un mago `veleno` ha una firma velenosa; un `esecuzione` una firma
  a tema, ecc.
- **Canonica**: scelta tra le magie già presenti nel pool attuale del mago (che sono già
  canoniche). Duplicati fra maghi ammessi.

Autoraggio: proposta generata per tutti i 60, rivista dall'utente prima del merge.

### 2. Selezione — `game/engine/statRoll.ts`

`pickSpell` collassa. Comportamento nuovo:
- Brucia **una** `rng.next()` per mantenere il draw-count RNG **identico** a prima
  (`rng.pick` consumava esattamente una `gen()`), così tutto lo stream a valle — mappa,
  eventi, composizione nemici — resta invariato e il diff degli snapshot è minimo.
- Ritorna `SPELL_BY_ID[wizard.signature]`.

Vengono **rimossi**: bias-ruolo, bias-veleno, `preferOffense`, `guaranteeOffense`,
`guaranteeOffensiveSpell`, `spellIsOffensive` (se non più usati altrove). `draftWizard`
perde i parametri `preferOffense`/`guaranteeOffense`.

`selectSpell` in combattimento **non cambia** (già a una magia via `unit.spell`).

### 3. Ricadute da riconciliare

- **Swap magia** — `runEngine.applySpellSwap` e l'evento in `events.ts` (~riga 83) che offre
  magie alternative dal pool: con una firma sola non esistono alternative → **rimossi**
  (funzione, evento, e relativa UI). È intenzionale: è la leva dello swap.
- **Rete di sicurezza nemici** — `teamGen`/`capSupporto`: garantire che ogni squadra
  nemica abbia ≥1 attaccante così che, senza più il bias offensivo, una squadra non risulti
  mai innocua. (Il cap ≤1 Supporto e la varietà di ruolo esistono già; qui si rinforza.)
- **`forceAllUnitsSpellId`** (`generateBossTeam`, boss sponge-wall) — override squad-wide di
  una magia: resta possibile come override esplicito del boss, ma va verificato che non
  dipenda dal pool. Riconciliare o rimuovere se ridondante.
- **Card helpers Duo** (`duos.ts`: `wizardDuoSignals`, `duosForSignal`, `previewDuos`) —
  **non toccano `spellPool`**, derivano da ruolo+tag. Nessuna modifica necessaria; anzi
  restano coerenti.

### 4. Test / determinismo

- Le firme cambiano le magie equipaggiate → **rigenerare** gli snapshot di combattimento e
  le fixture che codificano magie equipaggiate.
- **Parity gate endless** (`endlessReplay`, `DraftSession`): NON si tocca la logica. Il
  draw-count RNG resta identico (una pescata bruciata per mago), quindi record e replay
  restano allineati. Verificare 0-mismatch come cancello.
- **Full suite verde** (test + typecheck) come cancello finale.

## Rischi

- **Varianza tra run più bassa** (stessa squadra = stesse magie). Accettata come conseguenza
  voluta: la varietà vive nel comporre la squadra (60 maghi) + reliquie/duo/eventi/shiny.
  Da tenere d'occhio in playtest, non un blocco.
- **Autoraggio 60 firme**: molte ovvie, ma 60 decisioni di design da rivedere.

## Cancelli di completamento

1. `Wizard.signature` sostituisce `spellPool` ovunque; nessun riferimento residuo a `spellPool`.
2. Ogni mago lancia deterministicamente la propria firma in combattimento.
3. Swap magia rimosso (funzione + evento + UI).
4. `teamGen` garantisce ≥1 attaccante per squadra nemica; supporti mai con attacchi.
5. Snapshot rigenerati; parity gate endless a 0-mismatch; full suite + typecheck verdi.
