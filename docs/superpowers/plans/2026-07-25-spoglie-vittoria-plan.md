# Piano — Le Spoglie della Vittoria (Onda 1.a)

**Ripara:** D1 (la vittoria non contiene decisioni) + D2 (la build non cambia mai).
**Direzione:** `docs/superpowers/specs/2026-07-25-core-fun-direction.md`
**Tesi servita:** dare al giocatore un modo di **raggiungere** la combo che il `DuoTracker`
gli mostra già. Oggi il tracker dice "sei a 1 segnale da Cancrena" e il gioco risponde
"peccato" per quindici nodi.

---

## 1. Cosa cambia per il giocatore

Dopo **ogni battaglia normale vinta** (non boss, non élite in slice 1 — vedi §6), la
`VictoryScreen` non è più un "Prosegui": offre **tre Spoglie, ne scegli una**.

| Carta | Effetto | Perché esiste |
|---|---|---|
| **Marchio** | Un mago a tua scelta guadagna un **tag** (veleno / esecuzione / scudirigen / magieOscure). | È **la carta della tesi**: muove i segnali Duo. È la risposta al "sei a 1 segnale". |
| **Allenamento** | +1 livello a un mago a tua scelta. | Crescita percepibile, riusa il leveling. |
| **Ristoro** | Cura il 25% a tutta la squadra. | La valvola quando sei ferito; rende la scelta un **trade-off** vero (potere vs sopravvivenza). |

**L'offerta è keyword-aware.** Se un Duo è a un solo segnale di distanza, il Marchio offerto
è **quello che lo completa**, e la carta lo dice per nome: *"Marchio del Veleno — completa
CANCRENA"*. Questo è l'intero punto della fetta: trasformare il Duo da sorpresa fortunata a
**obiettivo perseguibile**.

## 2. Vincoli non negoziabili

1. **Parità replay / anti-cheat.** La scelta del giocatore è input di gioco: deve essere
   registrata nello stato della run e ri-applicata identica in replay. → mitigazione: §6,
   slice 1 è **solo campagna**.
2. **Determinismo.** L'offerta si genera da rng derivato dal seed (stesso pattern del salt
   dei pick evento, `event-nodes-feature`). Nessun `Math.random` nel percorso d'offerta.
3. **Nessun nuovo tipo di nodo, nessuna nuova schermata.** Si estende `VictoryScreen`. Il
   documento di direzione vieta di aggiungere superficie mentre si predica sottrazione.
4. **Il tag concesso deve contare OVUNQUE conta un tag nativo.** Vedi §4 — è il rischio n.1.

## 3. Fasi

### Fase A — Il modello dei tag concessi (motore, puro)
- `DraftedWizard` guadagna `grantedTags?: string[]`.
- Nuovo helper **`tagsOf(d: DraftedWizard): string[]`** = `[...(d.wizard.tags ?? []), ...(d.grantedTags ?? [])]`, deduplicato.
- **Sostituire OGNI lettura di `wizard.tags`** con `tagsOf`. Censirle tutte prima di toccarle.
- Test: un mago con `grantedTags:['veleno']` conta come mago veleno per `signalActive`,
  `signalCount`, `duoProgress`, e per il rilevamento sinergie/`keywordMult`.

### Fase B — Generazione dell'offerta (motore, puro e deterministico)
- `game/engine/spoils.ts`: `rollSpoils(state, rng): SpoilOffer[]` → sempre 3 carte.
- Regola keyword-aware: se esiste un Duo a esattamente 1 segnale (tag) di distanza, **almeno
  una** carta è il Marchio che lo completa, con il nome del Duo nella carta.
- Nessun duplicato inutile nell'offerta; determinismo verificato (stesso stato+seed → stessa offerta).
- `applySpoil(state, choice): RunState` — puro, nessuna mutazione in place.
- Test: determinismo, keyword-awareness, applicazione corretta di ciascun tipo.

### Fase C — Il collegamento e la UI
- `VictoryScreen`: le tre carte, con il perché scritto sopra ("completa CANCRENA").
- Il runner di campagna genera l'offerta alla vittoria e applica la scelta prima di proseguire.
- La scelta finisce nel `log` della run (`RunEvent`) — alimenta il racconto di fine run (Onda 4).
- Reduced-motion safe; test di componente sulla presenza e sull'effetto del click.

### Fase D — Verifica e bilanciamento
- Suite intera verde + typecheck.
- **Misurare l'impatto sull'harness di bilanciamento.** Le Spoglie aumentano il potere del
  giocatore: il win rate salirà. Dare al bot una policy semplice (preferisci il Marchio che
  completa un Duo, altrimenti Allenamento) così l'harness misura qualcosa di reale invece di
  ignorare la feature — è la lezione di `scaling-jokers-feature`, dove il bot non sfruttava
  la feature e l'harness smetteva di essere un gate valido.
- **Non** ritarare la difficoltà in questa fetta: prima si osserva, poi si decide con l'utente
  (la memoria `difficulty-validated-harder-is-good` è un pin esplicito: non ammorbidire).

## 4. Il rischio numero uno

**Un sito di lettura di `wizard.tags` dimenticato.** Se anche uno solo resta, il tag concesso
conta in un posto e non nell'altro: la UI dice "CANCRENA attiva", il motore non la accende, e
il giocatore vede una bugia. È esattamente la classe di bug che la "regola d'oro parità
replay" di `duo-legibility-feature` esiste per prevenire.

→ **Mitigazione obbligatoria:** censire tutti i siti *prima* di scrivere codice, e chiudere la
Fase A con un test che copre il percorso completo dal tag concesso fino all'effetto in
battaglia, non solo fino alla UI.

## 5. Fuori scope (YAGNI, esplicito)

- Rimuovere tag, o Spoglie negative/maledette.
- Spoglie dopo élite e boss (quelli hanno già le loro ricompense).
- Nuove reliquie o nuovi Duo (sono Onda 2 e 3).
- Ribilanciare la difficoltà (Fase D osserva, non tara).

## 6. Decisione di scope: solo campagna

L'endless ri-simula le run per validare i punteggi in classifica. Una scelta del giocatore a
metà run è **nuova superficie anti-cheat**. La modalità infinita esclude già interamente
shop, spellForge e altare per la stessa ragione: **la fetta 1 segue quel precedente.**
Estendere all'endless è una fetta separata, da fare solo dopo che il feel è validato.
