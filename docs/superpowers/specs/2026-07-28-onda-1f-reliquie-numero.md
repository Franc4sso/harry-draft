# Onda 1.f — Le reliquie che sono solo un numero

_Data: 2026-07-28 · Ultima voce dell'Onda 1 (la sottrazione) della roadmap Core Fun · Tipo: PURA data
(`data/relics.ts`) + due fixture di replay ri-registrate · Zero motore._

Frase-cuore servita: **ogni reliquia una decisione, non un numero.**

---

## 1. Il difetto misurato

Il pool era di 47 reliquie. Quattro di queste erano **la stessa frase scritta quattro volte**, con
quattro numeri diversi:

| id | testo |
|---|---|
| `stemma-attaccanti` | +18 Attacco se hai almeno 3 Attaccanti |
| `egida-tank` | +24 Difesa se hai almeno 3 Tank |
| `fiala-supporto` | Rigenerazione +16 se hai almeno 2 Supporti |
| `sfera-controllo` | +16 Velocità se hai almeno 2 Controllo |

Nessuna aveva un riferimento nel codice fuori da `data/relics.ts` (verificato con `grep` su tutto il
repo: 0 occorrenze ciascuna), nessuna era in `STARTER_RELICS`. Il giocatore le incontrava solo
comprandole nella Collezione o **addosso ai nemici** (`selectEnemyRelics` legge `RELICS` diretto).

Quinta reliquia tagliata, per un difetto diverso: `furia-iniziale`, epica dentro
`RULE_BREAKING_RELIC_IDS` — il pool premio degli eventi `?`, quello che deve dare **cose che rompono
una regola**. Era `bonus:{atk:18}` piatto, e la sua `desc` prometteva *"a inizio battaglia, tutta la
squadra guadagna +18 Attacco"*: un trigger che il dato non implementava. Promessa tradita due volte —
e l'effetto promesso esiste già identico in `assalto-d-apertura`.

## 2. Decisioni prese (utente, 2026-07-28)

- **Taglio minimo, non medio.** Via le 4 di ruolo; **le 3 condizionate per CASA restano**
  (`medaglione-serpeverde`, `diadema-corvonero`, `coppa-tassorosso`): hanno la stessa forma, ma
  quelle il Trio di Casata le premia — le Case sono meccanica di squadra, decisione già presa
  annullando l'Onda 1.c.
- **`furia-iniziale` tagliata**, non riparata: un +18 piatto non rompe nessuna regola, e renderla
  "vera" avrebbe prodotto un clone di `assalto-d-apertura` — cioè duplicazione, l'opposto dell'Onda 1.
- **Gate `RULE_BREAKING_RELIC_IDS.length >= 3` abbassato a 2**, non aggirato. L'alternativa
  considerata e **scartata** era promuovere `lacrime-fenice` nel pool rompi-regole: è già pescabile
  dall'offerta normale, quindi non l'avrei spostata da un pool all'altro ma messa in due — e gli
  eventi devono dare cose che *non trovi altrove*. Il 3 era una soglia arbitraria di grandezza, non
  una legge di design. Sotto 2 invece la varietà morirebbe davvero: quello resta un gate vero.

## 3. Cosa cambia nel codice

**Tagliato** (`data/relics.ts`): pool 47 → 42.
`stemma-attaccanti`, `egida-tank`, `fiala-supporto`, `sfera-controllo`, `furia-iniziale`.
`RULE_BREAKING_RELIC_IDS` scende a 2 (`zanna-vorace`, `patto-di-sangue`).

**Guard anti-ricrescita** (`tests/data/relics.test.ts`, 3 asserzioni nuove):
1. i 5 id tagliati non risolvono più a nessuna reliquia;
2. nessuna reliquia sopravvissuta è un **puro `+stat` condizionato dal ruolo** — il guard NON vieta
   `condition.role` in assoluto: una reliquia di ruolo che *fa qualcosa* (keyword, trigger, grant,
   scaling, carrier, sacrificio) resta legittima. Vieta la forma vuota: condizione + soli numeri;
3. nessun id nel pool rompi-regole è un `bonus` piatto travestito.

**Fixture di replay ri-registrate** (`tests/engine/endlessReplay.test.ts`,
`tests/functions/submitScore.test.ts`). Tagliare 5 reliquie **restringe `offerRelics`**, quindi
ri-distribuisce ogni pescata a valle sui semi fissi e i tre `relic-pick` registrati non erano più
nell'offerta reale del loro nodo → replay `valid:false` → anti-cheat che rifiuta una run onesta.
Ri-misurato guidando il motore vero (replay del prefisso esatto, poi `relicOffer` con il fork rng
reale del nodo):

| nodo | offerta prima | offerta dopo |
|---|---|---|
| `a1f3n1` | `boccino-doro / sigillo-carnefice / giratempo` | `sigillo-carnefice / pugnale-bellatrix / giratempo` |
| `a2f2n0` | `coppa-tassorosso / spada-grifondoro / ricordatutto` | `medaglione-serpeverde / ricordatutto / mappa-malandrino` |
| `a2f3n1` | `fame-vorace / pensatoio / sete-di-sangue` | invariata (nodo joker: `JOKER_RELIC_IDS` non è stato toccato) |

Preso l'indice 0 a ciascuno, stessa convenzione della registrazione originale. **Punteggio finale
ri-misurato a 1875, invariato.** La regola d'oro della parità replay tiene.

## 4. Misura A/B (nessuna ritaratura)

`campaignBalanceRestricted`, stessi 120 semi, prima e dopo il taglio:

| | winRate | battaglie normali vinte | nodi risolti | profondità area0/1/2 |
|---|---|---|---|---|
| prima | 0.0500 (6/120) | 116 | 594 | 83/11/26 |
| dopo | **0.0583 (7/120)** | 111 | 579 | 85/11/24 |

**Lettura onesta: è rumore da ri-distribuzione, non un cambio di difficoltà.** Tre ragioni.
(a) A un baseline di 6/120 un seme in più o in meno non ha risoluzione — la stessa classe di
reshuffle già documentata in quel file per l'altare e per la conversione delle reliquie flat: togliere
membri dal pool d'offerta consuma pescate diverse e ri-distribuisce l'intera run a valle sui semi fissi.
(b) I segnali sono **discordi** (winRate +1 seme, ma battaglie vinte −5 e profondità in area 2 −2):
un vero cambio di potenza li muoverebbe nello stesso verso. (c) Il bot sceglie le reliquie per potenza
grezza e non sa soddisfare una condizione di ruolo (gli servirebbero ≥3 dello stesso ruolo in squadra):
le 4 tagliate erano per lui quasi sempre **zero**, sia in mano sua sia in mano ai nemici.

Nessuna costante di bilanciamento toccata. **Il gauge vero resta il playtest umano.**

## 5. Debito lasciato aperto, di proposito

Le 3 reliquie di casa restano nella forma "+X stat se hai ≥3 di Y" — identica a quella appena tagliata,
tenuta in vita dal legame col Trio. Se l'Onda 3 (*"reliquie come pezzi di combo"*) va in porto, quelle
tre sono le prime candidate alla conversione: da numero condizionato a **pezzo che completa una combo**.
