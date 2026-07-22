# Core Fun & Roadmap — visione di design

_Data: 2026-07-21 · Ruolo: Lead Game Designer · Stato: documento vivo_

Questo documento tiene insieme la visione. Non è una spec di implementazione — le spec dei
singoli progetti vivono in `docs/superpowers/specs/`. Qui c'è il **perché** e la **priorità**.

---

## La frase-cuore (il Core Fun)

> **"Costruisco un patto velenoso, pago un prezzo che fa male,
> e guardo il mio veleno vincere la corsa contro la mia stessa mortalità."**

Ogni sistema del gioco va giudicato contro questa frase. Se non la serve, è rumore.

---

## Diagnosi in una riga

Motore di **team-building da 8/10** attaccato a un **combattimento da 3/10** (spettatore
deterministico) e nascosto dietro una **UX che non mostra la sua profondità**.
Non manca contenuto — ne avanza. Manca il momento in cui il giocatore **sente** che il piano
ha funzionato.

---

## Cosa TENIAMO (i 6 sistemi che passano il test delle storie)

Ognuno genera una storia raccontabile a un amico. Questo è il criterio.

1. **Draft 3+2 maghi (firme fisse + tag)** — "chi sono io questa run". Fonte primaria di identità.
2. **Duo/Trio (segnali asimmetrici)** — "il piano che ho costruito". La profondità vera.
   _Oggi nascosta: il bot non la usa, la UI non la mostra._
3. **Veleno come archetipo-bandiera** (Tossicità + Cancrena + Miasma) — "il mio DoT vince la corsa".
   L'unico status con una fantasia di potere leggibile.
4. **Corruzione + Sacrificio + Altare** — "il patto che ho fatto e il prezzo che ho pagato".
   Emozione irreversibile. La firma emotiva del gioco. **Da ampliare, non tenere raro.**
5. **Morte / bench (0HP = fuori fino a fine area)** — "chi ho perso". Dà peso reale a ogni battaglia.
6. **Reliquie Joker (snowball)** — "quanto sono diventato forte". Il momento power-fantasy.

---

## Cosa TAGLIAMO / RIDUCIAMO (il rumore che diluisce il segnale)

| Sistema | Azione | Perché |
|---|---|---|
| Reliquie flat +stat (Giratempo, Mantello, Felix) | **Tagliare o convertire** in effetti condizionali con una decisione | +numeri noiosi, nessuna storia, diluiscono epiche/joker |
| SpellForge | **Rimuovere o fondere** in nodo esistente | Micro-incremento invisibile, nessuno lo racconta |
| Endless mode | **Congelare** | Stai bilanciando 2 giochi. Prima trova il fun del campaign |
| ~55 reliquie / ~60 firme | **Ridurre** verso ~20-25 reliquie che *fanno qualcosa* | Sovraccarico su un core non ancora provato divertente |
| Ramificazione mappa (riconverge al boss) | **Rivalutare** | Scelta di percorso più cosmetica che reale |
| Filler weight `relic:45` | **Ribilanciare** | Il beat più comune è quello noioso; l'Altare (alto) è raro. Frequenze invertite |

---

## Roadmap — ordine di priorità (emozione / complessità)

Non aggiunge feature a caso: **concentra** ciò che c'è già.

### ✅ FASE 1 — Leggibilità della build _(FATTA — "tradeoff della perdita", master)_
**Fulcro scelto: DRAFT-TIME.** Se il giocatore non vede la build, niente conta.
- Al recruit a squadra piena, il DuoTracker mostra live cosa lo swap **spegne** (Duo/Trio), perdita che domina.
- **Motore già esistente** (`duos.ts`, `trios.ts`) → è UX. Rischio basso. Bug preso al review: `livingOf`.

### ❌ FASE 2 — Leggibilità del combattimento _(TENTATA, BOCCIATA al playtest 2026-07-22)_
- Costruito il **CenterMeter**: striscia a metà campo, modalità Economia (bilancia dei corpi) + Veleno
  (corsa HP-vs-veleno). Pura UI, rischio motore zero. Spedito (master 086f5ba), poi **rimosso** (revert 46b3164).
- **Verdetto del giocatore in mano:** non aggiunge valore. I cuori dell'Economia sono ridondanti col campo
  (li vedi già dalle unità); la corsa-veleno non convince. Tagliato tutto.
- **Lezione:** la leggibilità del combat *come sovraimpressione informativa* non è il buco. Il combat resta
  spettatore; forse manca l'**agency** (decidere), non l'**informazione** (leggere). O il problema del combat
  è più a monte (è troppo corto/deterministico per essere interessante da guardare, punto).

### FASE 2.5 — Agency in combattimento _(il cambiamento più impattante, ma più rischioso — DA VALUTARE)_
- 1 decisione ad alta posta per battaglia (target focus / attiva firma / spendi Lacrime al momento).
- **Vincolo:** tocca `simulate.ts`, il cuore deterministico; la decisione DEVE entrare nel RunLog come
  PlayerAction o rompe la parità anti-cheat (`endlessReplayParity`). O split del sim (resumable) o pre-commit.
- **Aperto dopo il flop della Fase 2:** se il combat-spettatore non si salva con l'informazione, forse si salva
  con la decisione — ma il rischio è alto. Alternativa da considerare PRIMA: il combat va reso più interessante
  a monte (durata, varianza) invece che più leggibile/interattivo?

### ▶ FASE 3 — Ritmo emotivo _(IN CORSO)_
- ✅ **Ampliare il patto faustiano** — FATTO (2026-07-22): Altare Oscuro **garantito ≥1/area** in
  campaign (era 30%). Edit chirurgico in `nodeGen.ts` (rimosso `ALTARE_CHANCE`). Endless invariato
  (parità byte-identica, mismatches=0). Bilanciamento invariato (bot cieco). **Costo di design accettato:**
  l'Altare consuma uno slot che a volte era reliquia → accesso archetipi-reliquia -~19% (esecuzione
  0.083→0.067, ancora giocabile). Da validare al playtest: 3 Altari/run sono routine? il calo reliquie
  si sente su veleno/scudo? Se sì: togliere area 1 (1 riga) / alzare `relic` weight.
- Abbassare `relic` filler weight, alzare eventi/altare _(prossimo sotto-progetto Fase 3)_.
- Tagliare/convertire reliquie flat verso ~20-25 significative _(prossimo)_.

### FASE 4 — Tagliare il rumore
- Rimuovere/fondere SpellForge.
- Congelare Endless. Un gioco alla volta.

### FASE 5 — Cambiare come misuriamo "divertimento"
- Il bot vince ~20% ma **non usa Duo/Trio** → misura il floor, non il gioco vero.
- Insegnare al bot a costruire team di casa, oppure accettare che i win-rate misurano il minimo.
- Metrica vera: **"la sconfitta è educativa?"** Se il giocatore che perde sa cosa cambiare,
  hai un roguelite. Se no, un generatore di seed.

---

## Principio guida per ogni decisione futura

Prima di aggiungere QUALSIASI sistema, chiedersi:
- È realmente divertente?
- Crea decisioni interessanti?
- Genera emozioni?
- Genera storie?
- Il giocatore avrebbe voglia di raccontarlo a un amico?

Se la risposta è no → non entra. Ogni sistema in più è un sistema da imparare **prima** di divertirsi.
