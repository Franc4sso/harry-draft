# Battaglia — il duello in primo piano — Design

**Data:** 2026-09-16
**Stato:** approvato dall'utente
**Mockup vincolante:** https://claude.ai/artifact/4CshXus1RM1hDnX8eFTfHN — v11, «La corsia del tempo»
**Corregge:** `2026-09-15-battaglia-corsia-del-tempo-design.md`

## Perché questo documento esiste

Il piano precedente è stato implementato per intero — pillole di stato, corsia dei
turni, livello effetti, guardia di copertura — e il risultato a schermo è **peggiore**
di quello che sostituiva. L'utente, guardandolo: «fa totalmente schifo».

La causa non è un difetto di esecuzione: i sette task sono stati costruiti, verificati
e rivisti. La causa è che **il pezzo centrale del mockup non è mai entrato nei brief**.
Il piano diceva «dove piano e mockup divergono, vince il mockup», poi ha descritto ai
subagent le pillole, la corsia e gli effetti — e ha dato per scontata la disposizione
della scena, che era proprio ciò che il mockup cambiava. Nessuno ha riaperto il disegno
durante l'implementazione. Le verifiche passavano perché misuravano le cose chieste,
non quella approvata.

Da qui una regola per questo piano: **il mockup si riapre e si guarda**, e ogni task
che tocca la disposizione cita la misura presa da lì.

## Cosa c'è oggi, e perché non funziona

Sei `WizardCard` a densità `combat` in due file orizzontali — nemici sopra, i tuoi
sotto. Ogni carta porta nome, riga incantesimo e banda statistiche, alta ~250px.

1. **La fila del giocatore è tagliata.** Due file da 250 fanno 500px; con corsia (100),
   registro (92), intestazione (~40) e margini si sfora, e l'eccesso sparisce sotto la
   piega — `overflow-hidden` lo nasconde senza scrollbar. Si vedono i nomi, non la vita.
2. **Gli effetti scrivono sopra le carte.** Senza spazio libero al centro, «ARMATURA
   FORATA» e i numeri si stampano sulle unità.
3. **Nessun primo piano.** Sei carte identiche: niente dice chi sta colpendo chi.

## La forma approvata

Il mockup mette **il duello al centro e i comprimari ai lati**:

```
┌──────────────────────────────────────────────────────────┐
│ TURNO 3 · AGISCE CHO CHANG                    ⏸ ▸ ▸▸ ⏭ 38│
├────┬────────────────────────────────────────────────┬────┤
│NEM.│                                                │TUOI│
│┌──┐│  ┌──────────┐   Levicorpus    ┌──────────┐    │┌──┐│
││84││  │          │  espone la dif. │          │    ││84││
│└──┘│  │  ATTORE  │                 │ BERSAGLIO│    │└──┘│
│┌──┐│  │ 420×376  │   ← effetti →   │ 420×376  │    │┌──┐│
││  ││  │          │                 │          │    ││  ││
│└──┘│  └──────────┘                 └──────────┘    │└──┘│
│┌──┐│                                                │┌──┐│
││  ││              stage 1142×452                    ││  ││
│└──┘│                                                │└──┘│
├────┴────────────────────────────────────────────────┴────┤
│ CORSIA DEI TURNI — chi agisce, con cosa, chi salta    128│
├──────────────────────────────────────────────────────────┤
│ REGISTRO                                               92│
└──────────────────────────────────────────────────────────┘
```

Misure dal mockup, da rispettare:

| elemento | posizione | dimensione |
|---|---|---|
| barra in cima | 0,0 | 1366×38 |
| miniature nemiche | x 18, y 62/174/286 | 84×104 |
| miniature alleate | x 1264, y 62/174/286 | 84×104 |
| palco | 112,46 | 1142×452 |
| ritratto attore | 168,84 | 420×376 |
| ritratto bersaglio | 778,84 | 420×376 |
| incantesimo al centro | 600,236 | 166 di larghezza |
| corsia | 112,520 | 1142×128 |
| registro | 112,660 | 1142×92 |

**Il duellante grande** porta ritratto, nome, sottotitolo («AGISCE» / «SUBISCE»), le
pillole di stato in alto a sinistra e — sul bersaglio — la barra vita in basso.
**La miniatura** porta ritratto, barra vita da 4px, nome troncato e le pillole. Nient'altro:
niente statistiche, niente riga incantesimo.

**Gli effetti** vivono nello spazio libero fra i due ritratti, non sopra le unità.

## Chi va grande, chi va in miniatura

L'attore è chi agisce nel frame (`entry.actorSide`/`actorId`), il bersaglio è
`entry.targetSide`/`targetId`. Le altre quattro unità stanno ai lati, ciascuna dalla
propria parte. Un'unità grande **non compare anche in miniatura**: il suo posto laterale
resta, ma smorzato (`dim`), così le file non ballano.

Sui frame senza attore o senza bersaglio — azioni di sistema, veleno che ticchetta, un
Duo che scatta — i due ritratti **restano quelli dell'ultima azione vera**
(`lastRealEntryAt`, già in `lib/initiative.ts`). La scena non deve svuotarsi durante i
frame di sistema: è lo stesso principio già applicato alla corsia.

## Cosa si riusa senza modifiche

`StatusPips`, `TurnLane`, `SceneFx`, `lib/battleScene.ts`, `battleAnim.css` e la guardia
`sceneCoverage` sono corretti: erano solo montati nel posto sbagliato. Cambia **dove**
si disegnano le unità, non cosa il motore produce né come lo si legge.

## Confini

**Dentro:** `components/battle/BattleArena.tsx` e l'altezza in `BattleScreen.tsx`.

**Fuori:** il motore, i dati, il bilanciamento, e la `WizardCard` — che resta la carta
di pesca e reclutamento. La densità `combat` non serve più in battaglia: il duellante e
la miniatura sono due presentazioni nuove, non varianti della carta.

## Vincoli

- **1366×768, tutto visibile, niente tagli.** Il budget torna: 38 + 452 + 128 + 92 +
  margini ≈ 738. Da verificare in browser su più squadre e oltre il turno 10, non sul
  primo fotogramma — `scrollHeight` a 768 non è una prova, perché `main` è
  `overflow-hidden` e nasconde l'eccesso.
- **Il ritratto non si rimpicciolisce** (D1): 420×376 per i duellanti è molto più del
  vincolo precedente.
- `prefers-reduced-motion`: restano gli stati finali, sparisce il movimento.
- Nessun test silenziato: quelli che asserivano sulle sei carte-combat vanno riscritti
  sulla nuova scena, con un commento che spiega perché.

## Piano

`docs/superpowers/plans/2026-09-16-battaglia-il-duello-in-primo-piano.md`
