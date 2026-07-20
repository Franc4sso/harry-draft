# Nascondere le sinergie dalla UI — solo Combo Duo

Data: 2026-07-20
Tipo: rimozione UI (motore intatto, zero rischio balance)

## Visione

L'utente vuole eliminare l'**alternanza** fra due sistemi paralleli mostrati fianco a
fianco: Sinergie e Combo Duo. Restare con **un solo sistema visibile** — le Combo Duo.

Decisione chiave: **il motore non si tocca.** Le sinergie continuano a dare bonus, trigger
di combattimento e regen — le sweep di balance (scudi-rigen, veleno, magie-oscure,
esecuzione) restano valide e il gate `campaignBalanceRestricted` (winRate 0.0583) non va
rimisurato. Cambia SOLO cosa vede il giocatore.

### Contesto: fase precedente

Il 2026-07-14 (`remove-house-role-synergies-design.md`) le sinergie **ruolo** e **casata**
sono già state rimosse dal motore. Oggi restano solo 10 sinergie, tutte `kind: 'group'`
(Golden Trio, Weasley, Ordine, Mangiamorte, Malandrini, Esercito di Silente) o
`kind: 'origin'` (Tossicità, Spietatezza, Bastione, Oscurità).

Le 4 origin usano gli **stessi tag che alimentano i segnali dei Duo** (veleno, esecuzione,
scudirigen, magieOscure). Quindi la UI mostra oggi informazione quasi ridotta: "Tossicità"
(sinergia) e il segnale "veleno" (duo) sono la stessa cosa sotto. Questa ridondanza è
esattamente l'alternanza che dà fastidio.

## Cosa NON si tocca

- `data/synergies.ts`, `game/engine/synergy.ts`, `synergyTriggers.ts`, `houseEffects.ts`,
  `simulate.ts`, tutte le sweep di balance. Il motore calcola e applica le sinergie come oggi.
- I dati `activeSynergies` sul run state restano prodotti (li usa il combat replay).
- In `BattleScreen`/`simulate.ts` le prop `playerSyn`/`enemySyn` → `leftSyn`/`rightSyn`
  restano: **alimentano la simulazione del replay** (regen, trigger, keywordMult veleno),
  non solo la UI. Si rimuove solo il ribbon che le disegna.

## Cosa si rimuove (4 superfici live + compendio)

### 1. Draft — `components/screens/DraftScreen.tsx`
- Via il contatore `⚡ {activeSynergies} sinergie attive` (riga ~68) e il calcolo
  `activeSynergies`.
- Via `<SynergyTracker>` (riga ~105) e il suo import + `synergyProgress`/`previewSynergies`
  se non più usati nello screen. Resta `<DuoTracker>`.

### 2. Reclutamento — `components/screens/RecruitScreen.tsx`
- Via il componente `ActivationRail` (mostra le sinergie che si attiverebbero reclutando) e
  il suo uso, con `previewSynergies`/`SynergyPreview`/`synergyBonusText` import se orfani.
- Resta `<DuoTracker>`. Verificare che il layout a due colonne (candidati / rail) regga senza
  il rail sinergie — se il rail conteneva solo sinergie, il DuoTracker prende il suo posto.

### 3. Sidebar run — `components/run/TeamSynergyBar.tsx` (il cuore dell'alternanza)
- **Collasso dei tab**: via lo stato `tab`, `tabBtn`, `role="tablist"`, il tipo `SidebarTab`.
  Il pannello `<DuoPanel frameless>` diventa l'unico contenuto sotto il roster (niente più
  scelta Sinergie/Combo).
- `SynergyRow`, `SynergyChip`, `synergyVisual` → codice morto, rimossi.
- Orientation `horizontal`: via i chip sinergie (le righe con `SynergyChip` e il divisore).
  Resta solo il roster.
- **Prop `synergies` rimossa** dalla firma di `TeamSynergyBar` (decisione utente: pulizia
  completa). `RunBRunner` smette di passarla al bar (ma continua a passarla a `BattleScreen`
  per il replay).

### 4. Battaglia — `components/screens/BattleScreen.tsx`
- Via i due `<SynergyRibbon>` ("Le tue sinergie" / "Sinergie nemiche", righe ~169/175) e
  l'import di `SynergyRibbon`.
- **Le prop `playerSyn`/`enemySyn` RESTANO** (servono al replay). File `SynergyRibbon.tsx`
  diventa orfano → rimosso.

### 5. Compendio — `RulesScreen.tsx` + `CollectionScreen.tsx`
Decisione utente: togliere anche la reference. Effetto motore invisibile e non spiegato —
accettato.
- `RulesScreen`: via la tab `'sinergie'` (dal tipo `Tab`, dalla lista tab, dalla sezione
  card `buildSynGroups`/`SynergyCard`). Import `SYNERGIES`, `KIND_COLOR`, `Synergy` se orfani.
- `CollectionScreen`: via `SynergyTile`, `NAMED_SYNERGIES`, `synergyHint`, e la sezione che
  li renderizza. Import `SYNERGIES`, `Synergy` se orfani.
- `components/screens/compendium/SynergyGraph.tsx`: se dopo la rimozione nessuno importa più
  `KIND_COLOR`/`SynergyGraph`, il file è orfano → rimosso. Verificare gli importatori prima.

## File probabilmente eliminabili (dopo verifica orfani)
- `components/battle/SynergyRibbon.tsx`
- `components/draft/SynergyTracker.tsx`
- `components/screens/compendium/SynergyGraph.tsx`

Non rimuovere a priori: fare `grep` degli import dopo ogni taglio e cancellare solo i file
senza consumatori residui.

## Test
- Aggiornare/rimuovere i test che asseriscono UI sinergie: contatore draft, `sidebar-tab-*`
  (TeamSynergyBar), ribbon in battaglia, tab Regole, tile Collezione. Cercare
  `sidebar-tab-sinergie`, `sinergie attive`, `SynergyTracker`, `SynergyRibbon`,
  `previewSynergies` nei test.
- I test che verificano `sidebar-tab-combo` come default vanno rilassati: non c'è più un tab,
  il DuoPanel è sempre visibile.
- **NON toccare** i test motore/balance (`campaignBalanceB`, `campaignBalanceRestricted`, le
  sweep). Devono restare verdi invariati — è la prova che il motore non è cambiato.
- Typecheck pulito (import orfani rimossi) + suite intera verde.

## Criteri di successo
1. Nessuna UI sinergie in draft, recluta, sidebar run, battaglia, Regole, Collezione.
2. Le Combo Duo restano l'unico sistema visibile; la sidebar run non ha più tab.
3. `campaignBalanceRestricted` winRate invariato (0.0583) → motore intatto.
4. `tsc --noEmit` exit 0, suite intera verde.
