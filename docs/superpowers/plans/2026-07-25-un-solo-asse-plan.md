# Piano — Un solo asse (Onda 1.b + 1.c)

**Ripara:** D3 — cinque sistemi di team-building sullo stesso asse.
**Direzione:** `docs/superpowers/specs/2026-07-25-core-fun-direction.md`

Oggi il veleno ha **due soglie diverse in due sistemi diversi**: il segnale Duo a 2 maghi, la
Sinergia a 3. E i Trii sono un terzo sistema *gated dietro* il secondo (`≥3 di casa E ≥1 Duo`).
Il giocatore deve tenere a mente tre regole per un solo concetto.

---

## 1. La forma finale

**Un segnale, due gradi.** Una barra sola per ogni parola chiave:

| Grado | Requisito | Effetto |
|---|---|---|
| **Acceso** | 2 maghi col tag **oppure** 1 reliquia | Abilita i Duo (invariato) |
| **Potenziato** | 3 maghi col tag | **+50% alla parola chiave** (l'attuale Sinergia) |

È il modello a scaglioni di TFT: *veleno 2/3*. Una sola barra, un solo linguaggio, una sola
domanda in testa al giocatore — **"quanto vado a fondo su questo segnale?"** — invece di due
sistemi che chiedono la stessa cosa con nomi diversi.

**I Trii di Casata spariscono.** Le Case restano **colore e fantasia**: casa, ritratto, sapore.
Non più una meccanica. Motivo di design: *"Trio di Grifondoro: -1 cooldown"* non è una frase
che un giocatore direbbe a un amico — fallisce il test della tesi. Ed è un quarto sistema
*gated dietro* il terzo, quindi opaco: perdi il Duo e ti si spegne un potere di casata, che col
Duo non c'entra niente.

## 2. Struttura in tre fasi, con gate diversi

La separazione è il punto del piano: **la Fase 1 non deve cambiare un solo numero**, la Fase 3
sì e va misurata. Tenerle insieme renderebbe impossibile capire quale delle due ha mosso cosa.

### Fase 1 — La fusione (refactor a numeri identici)
Le 4 `SYNERGIES` diventano il **grado 2** del segnale corrispondente
(tossicita→veleno, spietatezza→esecuzione, bastione→scudirigen, oscurita→magieOscure).

- La soglia resta **3 maghi col tag** e il bonus resta **+50%**: stessa condizione, stesso
  effetto, un sistema in meno. Le reliquie accendono il grado 1 come oggi; **non** portano al
  grado 2 (oggi `membersFor` conta solo maghi — comportamento invariato, ma va **documentato**
  perché diventa una regola visibile al giocatore).
- Tutto ciò che oggi consuma `ActiveSynergy[]` (`keywordDamageMult`, `teamDarkMagic`,
  `shieldConvert`, `execute`, `synergyTriggers`, `simulate`) deve continuare a ricevere gli
  stessi valori. Se conviene tenere `ActiveSynergy` come tipo di trasporto interno, **va bene**:
  ciò che sparisce è il *sistema* come concetto separato per il giocatore, non necessariamente
  ogni riga di codice.
- **GATE FASE 1: zero cambiamenti di bilanciamento.** Suite verde identica e harness con gli
  **stessi identici numeri** di adesso. Se un numero si muove, la fusione è sbagliata: fermarsi.

### Fase 2 — Un solo pannello
`DuoTracker` e `ArchetypeTracker` diventano **una lista sola**: i segnali con il loro grado
(`veleno 2/3`), e le combo che accendono. Oggi sono due pannelli che raccontano lo stesso asse.

Il `DuoTracker` è **già ottimo** (ricetta, riordino, "si attiva / avanza / si spegne"
sull'hover del candidato): si estende, **non si riscrive**. Il grado 2 deve avere un suo stato
visivo leggibile e comparire nell'anteprima del candidato come tutto il resto.

### Fase 3 — Via i Trii — **ANNULLATA (decisione utente, 2026-07-25)**
La rimozione dei Trii di Casata era pianificata ed è stata **respinta dall'utente** prima
dell'esecuzione. **I Trii restano nel gioco così come sono.**

Conseguenze da rispettare d'ora in poi:
- `game/engine/trios.ts` e tutti i suoi consumatori **non si toccano**.
- L'avviso "⚠ Trio di X si spegne" **resta** nel pannello del draft e va preservato dalla Fase 2.
- Le Case **restano una meccanica di squadra**, non solo colore. Il doc di direzione va letto
  con questa correzione: la voce "1.c togliere i Trii" dell'Onda 1 è **fuori dal piano**.

Onda 1.b si chiude quindi con la Fase 1 (fatta) + la Fase 2.

## 3. Vincoli ferrei

1. **NON toccare nessuna costante di bilanciamento** (`data/constants.ts`, budget, livelli,
   hpMult). Se qualcosa va tarato, si decide con l'utente **dopo** aver misurato.
2. **NON allentare né svuotare le asserzioni dei gate.** Il progetto ha già una storia di gate
   svuotati (`winRate > 0` → `>= 0`). Se un gate fallisce: fermarsi e riportare.
3. **Non ammorbidire i nemici** — direttiva utente registrata, il gioco deve restare duro.
4. Le Case restano nei dati, nei ritratti e nei nomi. Spariscono **solo** come meccanica di
   squadra. Le reliquie condizionate per casa (`condition: { house }`) **restano come sono**:
   sono un'altra cosa e non fanno parte di questa fetta.

## 4. Fuori scope (YAGNI)

- Nuovi Duo o nuovi segnali (è Onda 2).
- Potare le firme (1.d), togliere i nodi-menù (1.e), potare le reliquie piatte (1.f).
- Ritarare la difficoltà.
- Toccare l'endless al di là di ciò che serve perché continui a compilare e passare.
