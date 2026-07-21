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

### ▶ FASE 1 — Leggibilità della build _(IN CORSO — primo progetto)_
**Fulcro scelto: DRAFT-TIME.** Se il giocatore non vede la build, niente conta.
- Quando peschi/recluti un mago, mostrare in tempo reale: quali Duo/Trio **accende**,
  cosa è **a 1 segnale**, cosa **romperebbe** togliere un teammate.
- Trasforma il draft in un puzzle leggibile. È qui che nasce la decisione interessante.
- **Motore già esistente** (`duos.ts`, `trios.ts`) → è UX, non nuovo motore. Rischio basso.
- _Combat-time readability (barra veleno-vs-HP) = fase successiva, non ora._

### FASE 2 — Agency in combattimento _(il cambiamento più impattante, ma più rischioso)_
- 1 decisione ad alta posta per battaglia (target focus / attiva firma / spendi Lacrime al momento).
- Rendere il replay leggibile come **corsa** (veleno accumulato vs HP nemico).
- Tocca `simulate.ts`, il cuore deterministico → serve cura.

### FASE 3 — Ritmo emotivo
- Abbassare `relic` filler weight, alzare eventi/altare.
- Tagliare/convertire reliquie flat verso ~20-25 significative.
- **Ampliare il patto faustiano**: ≥1 momento faustiano per area (non ~30%).

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
