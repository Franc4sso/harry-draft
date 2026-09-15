# Battaglia — «la corsia del tempo» — Design

**Data:** 2026-09-15
**Stato:** approvato dall'utente (mockup v11, direzione B del set animato)
**Mockup:** https://claude.ai/artifact/4CshXus1RM1hDnX8eFTfHN — versione 11

## Il problema

La battaglia è la schermata dove il gioco decide, ed è quella che mostra di meno.
Il motore produce a ogni turno un fotogramma ricco — chi ha colpito, con quanta
forza, se ha mancato, quali stati sono comparsi, chi salterà il prossimo turno —
e la schermata ne mostra tre cose: il colpo, la barra della vita, una riga di
registro.

Conseguenze che l'utente ha visto da solo:

- **I turni saltati sono buchi.** Un mago stordito produce `action: 'Stordito'`
  (`simulate.ts:247`) e a schermo non succede nulla: sembra che il gioco abbia
  saltato un fotogramma.
- **Gli stati alterati sono invisibili.** Dei dieci tipi di stato (veleno,
  bruciatura, congela, silenzia, disarma, scudo, protego, rigenera, lentezza,
  vulnerabilità) nessuno si vede sull'unità. Dal fotogramma dopo l'applicazione,
  il giocatore non ha modo di sapere che il suo attaccante è avvelenato.
- **I Duo scattano in silenzio.** Miasma, Muro Vivente e Untore sono il momento
  in cui la build costruita dal giocatore lavora: passano come una riga di testo.
- **Non si sa cosa sta per succedere.** Non c'è modo di vedere chi agirà dopo,
  con quale magia, o che salterà il turno.

Parole dell'utente: «la battaglia, cosi com'è, è brutta da vedere» e, sulla
direzione scelta, «MI DEVI FAR VEDERE TUTTO QUELLO CHE SUCCEDE, SOPRATTUTTO GLI
EFFETTI SPECIALI, tipo il veleno etc, vorrei che sia una cosa premium ben
strutturata».

## Il principio

**Ogni evento che il motore produce deve avere una scena.**

Non «i colpi si vedono meglio»: *ogni* evento. Un fotogramma che non produce
nulla a schermo è un difetto. È un requisito verificabile, e il piano lo fa
rispettare con un test di copertura che legge le azioni direttamente dal
sorgente del motore.

## La forma

Quattro fasce, nel budget fisso di 768px di un portatile:

```
┌──────────────────────────────────────────────┐
│ intestazione — chi contro chi, turno       38│
├──────────────────────────────────────────────┤
│                                              │
│  ARENA — sei unità, tre contro tre        452│
│  · pillole di stato sul ritratto             │
│  · effetti sopra: numeri, parole, onde       │
│                                              │
├──────────────────────────────────────────────┤
│  CORSIA DEL TEMPO — i prossimi turni      128│
│  chi agisce, con che magia, chi salterà      │
├──────────────────────────────────────────────┤
│  REGISTRO — le ultime righe                92│
└──────────────────────────────────────────────┘
```

**La corsia del tempo** è l'elemento nuovo, ed è ciò che dà il nome alla
direzione: una fila orizzontale dei prossimi turni che scorre a ogni azione. Ogni
posto porta ritratto, nome e **la magia che quel mago lancerà**. Chi è stordito o
congelato porta un bollino: si sa *prima* che salterà, e quando il turno arriva
la parola SALTA conferma quello che la corsia aveva annunciato. È l'informazione
che trasforma la battaglia da filmato a partita leggibile.

**Le pillole di stato** stanno sul ritratto dell'unità, non in una legenda a
parte. Il numero sulla pillola dice quanto manca — salvo per il veleno, dove dice
le **dosi**: il veleno è permanente, `remaining` resta fermo a 2 e mostrarlo
sarebbe una bugia, mentre il numero che cresce a ogni dose è `stacks`.

**Gli effetti** sono un livello sopra l'arena, e ogni evento ha il suo: il
critico ha un lampo e un numero dorato più grande, la schivata una scia lunga e
nessun numero, lo scudo una cupola e il numero barrato, l'armatura forata una
scia viola, il Duo il proprio nome esploso in oro.

## Il modello

Fra il motore e la scena c'è una funzione pura: `sceneEventOf(frame, prev)`
traduce un `ReplayFrame` in un evento di scena tipizzato. Nulla di React, niente
stato di riproduzione: stesso fotogramma, stessa scena, quindi riavvolgere o
saltare avanti dà sempre lo stesso risultato.

L'evento porta anche il **confronto degli stati** fra due fotogrammi — quali sono
comparsi, quali spariti. È ciò che permette di animare la comparsa del veleno o
la fine di un congelamento senza che il motore debba emettere un evento nuovo: la
differenza fra due fotogrammi basta, e il motore non si tocca.

## Confini

**Dentro:** la schermata di battaglia e i suoi componenti.

**Fuori:** il motore (`game/engine/`), i dati, il bilanciamento, `buildReplay`, e
le altre schermate. Tutti i dati necessari sono già nei fotogrammi: `hp`,
`statusEffects`, `cooldowns`, `effSpd`. La riproduzione automatica esiste già
come `useBattleReplay` e non va riscritta.

## Vincoli

- La battaglia resta dentro **1366×768** senza scorrimento del documento, con
  tutte e sei le unità visibili. È il vincolo che il lavoro precedente ha appena
  conquistato (1137px → 768px): non va perso. Il rischio concreto è il registro,
  che si allunga a ogni turno — va verificato su almeno dieci turni, non sul
  primo fotogramma.
- **`prefers-reduced-motion`**: restano gli stati finali (barra scesa, pillole
  aggiornate, caduto grigio, registro scritto), sparisce solo il movimento.
  Nessuna informazione può vivere solo dentro un'animazione.
- Nessuna libreria nuova: animazioni CSS.

## Piano

`docs/superpowers/plans/2026-09-15-battaglia-corsia-del-tempo.md`
