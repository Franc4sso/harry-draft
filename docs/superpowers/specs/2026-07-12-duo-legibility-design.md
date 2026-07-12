# Duo leggibili — spec di design

Data: 2026-07-12
Stato: approvata (design), pronta per il piano di implementazione

## Il problema

Le 6 Combo Duo sono spedite e funzionanti, ma il giocatore non le capisce. Tre buchi distinti,
tutti confermati nel codice:

1. **In battaglia un Duo è invisibile.** Il motore non emette nulla quando un Duo scatta.
   `LogEntry` (`types/combat.ts:81`) non ha nessun campo per rappresentarlo e `LogFlag`
   (`types/combat.ts:79`) non ha una variante Duo. L'esecuzione istantanea di ESECUZIONE A FREDDO
   viene ripiegata dentro il `value` del colpo normale (`game/engine/combat/effects.ts:91-103`):
   a schermo è indistinguibile da un colpo forte. MIASMA e UNTORE non producono nemmeno una riga
   di log — il veleno compare dal nulla.
2. **Il pannello non insegna a costruire.** `components/run/DuoBar.tsx` mostra solo gli attivi e
   quelli "a un passo"; i Duo a due segnali di distanza **non vengono renderizzati affatto**
   (`DuoBar.tsx:26` → `return null`). Per i "a un passo" dice `— manca: Scudo/Rigen` senza mai
   spiegare *come* si accende quel segnale.
3. **Il pannello sparisce in combattimento.** Vive solo nella sidebar `withTeamSidebar`
   (`components/screens/RunBRunner.tsx:106-111`), quindi in mappa/reclutamento/reliquia. Durante
   la battaglia il giocatore non sa nemmeno quali Duo ha attivi.

Il Codex (`components/screens/CollectionScreen.tsx:577-584`) ha già un ricettario dei Duo scoperti:
il "cosa fanno" esiste. Manca il "come si accendono" e il "quando scattano".

## Obiettivi

- Un Duo che scatta è **visibile e nominato** in battaglia.
- Il pannello nel run **insegna la ricetta**: cosa manca e come accenderlo, nel momento in cui
  la scelta conta (draft, reclutamento).
- I Duo attivi restano **presenti in arena** durante il combattimento.

## Non-obiettivi

- Nessun ribilanciamento dei Duo o dei loro effetti.
- Nessuna schermata nuova. Nessun nuovo sistema di VFX o di annunci: si riusa quello che c'è.
- Il redesign degli emblemi dei ruoli/archetipi (`archetipi-mockup.html`) è **fuori scope** e
  viene abbandonato.

---

## 1. Motore — la traccia di un Duo

`LogEntry` guadagna un campo opzionale `duoId?: string` e `LogFlag` la variante `'duo'`. La UI
non ha bisogno d'altro: legge già ogni frame come una `LogEntry`.

**Player-only.** I Duo sono già solo del giocatore (`game/engine/resolvers/combat.ts:89` calcola
`leftDuos` e non esiste un equivalente per il lato destro). La traccia eredita questo vincolo.

| Duo | Come si manifesta oggi | Traccia |
|---|---|---|
| ESECUZIONE A FREDDO | somma HP dentro il `value` del colpo (`effects.ts:91-103`) | `duoId` + flag `duo` sulla riga **del colpo**, solo quando `coldExtra > 0` |
| CANCRENA | raddoppia il tick di veleno sul nemico sotto soglia | `duoId` sulla riga **del tick** (`dot`), solo quando l'amplificazione si applica davvero |
| MIETITORE | +6 attacco al carnefice dopo un'esecuzione | `duoId` sulla riga **dell'uccisione** |
| MIASMA | il veleno si propaga alla morte — **nessuna riga oggi** | **riga nuova** |
| UNTORE | sputa veleno quando curi — **nessuna riga oggi** | **riga nuova** |
| MURO VIVENTE | impedisce colpi alle retrovie | **nessuna traccia** — vedi Debito noto |

Le righe nuove di MIASMA e UNTORE non sono un extra per la UI: oggi quel veleno appare senza
causa visibile, e questo è un difetto di leggibilità indipendente dai Duo.

**Vincolo duro — parità del replay.** `buildReplay` mappa il log 1:1 sui frame
(`game/engine/combat/replay.ts:144-157`) e `result.snapshots` è 1:1 col log
(`game/engine/combat/simulate.ts:117`). Ogni riga nuova deve passare da `pushLog`, che cattura
anche lo snapshot. La parità è protetta da `tests/engine/endlessReplayParity.test.ts`, che è
l'anti-cheat della classifica Endless: va ri-verificata, non aggirata.

**Determinismo.** Nessun effetto Duo cambia comportamento: la traccia è puramente osservativa.
Le righe nuove non consumano RNG.

## 2. Il pannello nel run

`DuoBar` diventa il pannello a ricetta del mockup, nella stessa sidebar da 288px.

- **Tutti e 6 i Duo**, ordinati: attivi → a un passo → lontani.
- **Attivi e a un passo: espansi.** Nome, ricetta a 2 gemme (accesa = piena e luminosa;
  mancante = tratteggiata e spenta), effetto.
- **Sotto ogni segnale mancante: la riga "come accendere"** con la condizione reale.
- **Lontani: collassati** a una riga (nome + 2 gemme spente), espandibili al clic.
- Oro = attivo, verde = a un passo: è il linguaggio cromatico già in uso (`DuoBar.tsx:10-11`).

**Le condizioni di accensione sono asimmetriche** e la mappa statica deve dire il vero
(fonte: `signalActive`, `game/engine/duos.ts:23-30`):

| Segnale | Condizione reale |
|---|---|
| Tank | **1** Tank in squadra |
| Supporto | **2** Supporti |
| Controllo | **2** Controllori |
| Veleno | **2** maghi col tag veleno **oppure** 1 reliquia veleno |
| Esecuzione | **2** maghi esecuzione **oppure** 1 reliquia che concede esecuzione |
| Scudo/Rigen | **2** maghi scudo/rigen **oppure** 1 reliquia scudo |
| Magie Oscure | **2** maghi magie oscure **oppure** 1 reliquia magia oscura |

**Il segnale "Attaccante" non va mostrato.** Esiste nel tipo `DuoSignal` ma **nessuno dei 6 Duo
spediti lo usa**. Mostrarlo insegnerebbe una cosa falsa (metti due Attaccanti → non si accende
niente). Il pannello e la legenda mostrano i **7 segnali realmente in uso** — il filtro esiste già:
`DUO_SIGNALS_IN_USE` (`game/engine/duos.ts:57`).

I Duo si accendono solo con i maghi **vivi** (`livingOf`, già rispettato a `DuoBar.tsx:22`):
il comportamento resta.

## 3. La battaglia

**Pill persistenti.** In un angolo dell'arena, la lista dei Duo attivi (icona + nome), sempre
visibile durante il combattimento. Gli stessi ingredienti della sidebar (`detectDuos` su squadra
e reliquie) sono disponibili in `BattleScreen`.

**Primo scatto: forte.** La prima volta che un Duo scatta *in quella battaglia*, annuncio grosso
al centro col suo nome. Si riusa il `Callout` (`components/battle/Callout.tsx`), che è già una
pura funzione flag → parola.

**Scatti successivi: sottili.** Solo la pill del Duo lampeggia. Nessun annuncio centrale.

**Il "prima volta" vive nella UI, non nel motore.** È stato di riproduzione (si azzera a inizio
battaglia), non stato di simulazione: il motore resta puro e deterministico.

**Priorità degli annunci — regola esplicita.** Il frame in cui scatta ESECUZIONE A FREDDO è
*anche* un frame di esecuzione: `calloutFor` (`Callout.tsx:30`) restituirebbe già `ESECUZIONE`.
**Il Duo vince su tutto il resto** (crit+kill, controlli, crit, block, dodge, heal, dot), perché è
l'informazione rara.

`calloutFor` resta **pura**: non può sapere da sola se è il primo scatto, quindi la decisione
"primo scatto sì/no" la prende il chiamante e gliela passa come argomento. Il ramo Duo sta in cima
alla catena di priorità e si attiva **solo** quando il chiamante dichiara che è il primo scatto di
quel Duo in quella battaglia; altrimenti `calloutFor` si comporta esattamente come oggi (e il
frame produce solo il lampeggio della pill).

## 4. Debito noto — MURO VIVENTE

MURO VIVENTE non "scatta": *impedisce*. Un colpo che non arriva alle retrovie non è un istante,
è un non-evento — quindi non avrà né annuncio né lampeggio, solo la pill persistente. Sarà l'unico
Duo che il giocatore non vedrà mai fare nulla.

Questo lavoro **espone** il problema, non lo crea: MURO VIVENTE era già segnalato come ridondante
rispetto alla Provocazione Ferrea che il Tank ha comunque. Il rimedio è un ridisegno dell'effetto
(bilanciamento), che è **fuori dallo scope di questa spec** e va affrontato a parte.

## 5. Verifica

**Motore**
- Ogni Duo tracciabile emette la sua traccia esattamente quando il suo effetto si applica davvero
  (non quando è semplicemente attivo).
- MIASMA e UNTORE producono una riga di log.
- MURO VIVENTE non emette nulla (asserzione esplicita: è una scelta, non una dimenticanza).
- La simulazione resta deterministica a parità di seed.
- `endlessReplayParity` verde: log, frame e snapshot restano 1:1.
- Suite completa verde (oggi 1367 test).

**UI**
- Il pannello mostra tutti e 6 i Duo con lo stato corretto; i lontani sono collassati ed espandibili.
- La riga "come accendere" riporta la condizione reale per ognuno dei 7 segnali in uso.
- Il segnale "Attaccante" non compare da nessuna parte.
- In battaglia: le pill elencano i Duo attivi; l'annuncio centrale compare **una sola volta per
  Duo per battaglia**; dal secondo scatto lampeggia solo la pill.
- Su un frame di cold-execute l'annuncio è il nome del Duo, **non** `ESECUZIONE`.
