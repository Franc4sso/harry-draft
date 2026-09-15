# Carta unica e schermate — Design

Data: 2026-09-15
Stato: approvato dall'utente (scelte finali in fondo), pronto per il piano.

## Il problema

L'utente ha segnalato che «da portatile la grafica non è perfetta, non entra tutto a schermo».
Misurando l'app a 1366×768 (la risoluzione da portatile più diffusa, e la più stretta in
altezza) sono emersi tre difetti distinti.

### 1. Lo stesso mago è disegnato da tre componenti diversi

| Componente | Righe | Dove compare |
|---|---|---|
| `components/cards/WizardCardColumn.tsx` | 373 | pesca, reclutamento |
| `components/cards/WizardCardRow.tsx` | 212 | squadra, lista sostituzioni |
| `components/battle/UnitBust.tsx` | 437 | battaglia |

Tre file, tre disegni, tre modi di scrivere gli stessi effetti. È il motivo per cui la
carta «cambia faccia» a seconda di dove la si incontra. **Requisito esplicito
dell'utente:** una sola carta, identica ovunque compaia.

### 2. La carta è alta 592px su uno schermo da 768

Anatomia misurata sul gioco (carta 248×592):

| Fascia | Altezza | Quota |
|---|---|---|
| Ritratto | 248px | 42% |
| Nome | 49px | |
| Ruolo | 26px | |
| Magia + precisione | 110px | |
| Abilità personale | 88px | |
| Statistiche | 58px | |

Tre carte affiancate riempiono quasi tutto lo schermo e non resta spazio per nient'altro.

### 3. La battaglia sfora di 369px

`document.scrollHeight` 1137 contro un viewport di 768: **la squadra nemica è quasi tutta
fuori dalla vista**, se ne intravedono solo le teste. Si combatte senza vedere metà del
campo, mentre ai lati restano due fasce vuote da ~200px.

(Un quarto difetto — la mappa che tagliava l'ultima fila di nodi selezionabili — è già
stato corretto oggi nel commit `cd26b8b`.)

## Le decisioni prese

Tutte validate dall'utente su mockup successivi.

### D1 — Il ritratto resta grande

Richiesta esplicita: «voglio dare spazio al ritratto». Lo spazio si recupera altrove.

### D2 — Gli effetti si riscrivono

Il testo attuale di Hermione è `Rallenta (VEL -15) (permanente, cumulativo)`: due parentesi
annidate nella stessa riga, e «permanente, cumulativo» è gergo che descrive il motore, non
il colpo. Regola nuova, in tre punti:

1. **Il numero apre la riga.** È la quantità che si confronta fra due maghi.
2. **Niente gergo di sistema.** «permanente, cumulativo» → «resta».
3. **«Può» è una percentuale.** Ogni «i suoi colpi possono…» nasconde un numero che il
   gioco già conosce: mostrarlo.

Tabella completa delle riscritture in fondo a questo documento.

### D3 — La carta perde le scatole

La cornice per rarità promette un cimelio; il corpo consegnava tre rettangoli grigi
impilati. Gli elementi non sono più «contenuti» ma **incisi sulla lastra**, separati da
fili di luce invece che da bordi:

- il **ruolo** diventa un'epigrafe sopra il nome, non una pillola sotto il ritratto;
- la **magia** perde cornice e fascia scura: la separa un filo;
- la **precisione** diventa anche una barra (il 60% di Avada si *vede* corto);
- la **ricarica** diventa un battito di pallini;
- le **statistiche** diventano una fascia coniata a filo del bordo.

### D4 — L'abilità personale va in un sigillo a comparsa

Solo **15 maghi su 60** hanno una firma, e le firme **non sono decorative**: sono
registrate nel motore (`game/engine/combat/simulate.ts:148` chiama `registerSignatures`).
Voldemort fa davvero +50% sui bersagli sotto il 40% di vita.

Toglierle del tutto avrebbe nascosto l'unica cosa che distingue quel mago. La soluzione
approvata: un **sigillo dorato sul ritratto**, con il testo in tooltip. Misurato: la carta
col sigillo e la carta senza abilità sono **identiche in altezza** (422px entrambe), perché
il sigillo vive sopra il ritratto. Si ottiene tutto lo spazio senza perdere l'informazione.

Il componente `components/ui/Tooltip.tsx` esiste già e funziona anche al tocco: niente da
costruire.

### D5 — Le cornici diventano sobrie

Le cornici attuali (`lib/theme.ts`, `tierFrame`) imitano il metallo: gradienti a sei stop,
bordi smussati da 9px, e la leggendaria porta **sette ombre sovrapposte** con aloni da 46 e
110px. Tre aloni affiancati creano una nebbia luminosa fra le carte, e la cornice vince
sull'attenzione contro il ritratto.

Principio indicato dall'utente: *«come per i numeri degli HP»* — quelli funzionano perché
sono **solo colorati**. Nuova regola: **un colore per rarità, un filo da 1px**.

| Rarità | Colore | Alone |
|---|---|---|
| Comune (t4) | `rgba(154,163,173,.34)` | nessuno |
| Raro (t3) | `rgba(127,178,232,.44)` | nessuno |
| Epico (t2) | `rgba(185,140,255,.5)` | 18px |
| Leggendario (t1) | `rgba(232,180,74,.58)` | 18px |

Corona, filigrane e shimmer vengono **rimossi** e sostituiti da un contatore di quattro
tacche in alto, che funziona per tutti e quattro i livelli invece che solo per il più alto.

### D6 — La riga della magia mette il valore in colonna

La forma `nome · valore · verbo` su una riga sola va a capo in un punto diverso per ogni
magia (i nomi vanno da 6 a 18 caratteri su 37 magie), quindi il valore — il dato da
confrontare — finisce ogni volta in un posto diverso e l'altezza cambia da carta a carta.

Forma approvata: il valore esce dalla frase e prende **una colonna fissa a sinistra**,
numero grande con l'unità sotto — la stessa forma della fascia coniata delle statistiche.
Verificato sul mockup: con `Ferula`, `Crucio` e `Avada Kedavra` (lunghezze molto diverse) i
tre valori restano a `x: 14` e alla stessa altezza.

### D7 — Una carta, tre densità

| Densità | Dove | Cosa mostra |
|---|---|---|
| **piena** | pesca, reclutamento | ritratto grande, magia con descrizione, statistiche |
| **media** | battaglia | + barra vita e «pronto», − descrizione della magia |
| **riga** | squadra, mappa, nemici in anteprima | ritratto a lato, nome, vita, statistiche |

Stesso disegno, stesso ordine delle informazioni, stessa scrittura degli effetti in tutte e
tre. Cambia solo quanto ne mostra.

## Le quattro schermate scelte

L'utente ha scelto: **pesca A, reclutamento A, mappa C, battaglia A**.

### Pesca — «Carte grandi, combo di fianco»

Intestazione su una riga (50px invece di 147). Tre carte da 290×447 con ritratto da 280px,
e il pannello combo come quarta colonna larga 402px, **allineata in cima e in fondo alle
carte**. Sotto restano 180px per una fascia di confronto diretto e il dettaglio del
candidato sotto il mouse.

Guadagni: ritratto +80px, 180px liberati, fascia destra morta recuperata.

### Reclutamento — «Entra ↔ Esce»

Reclute a sinistra come carte piene (216×367), squadra a destra come carte-riga (550×66),
con la freccia dello scambio in mezzo. Sotto, 258px per «cosa cambia scambiandoli».

Il confronto è la decisione, quindi diventa il layout: **nessuno scorrimento**.

### Mappa — «Solo il bivio, con i nemici»

Il cammino resta in alto come mappa ridotta (120px) per orientarsi. Le tre scelte diventano
riquadri da 420×436 con dentro **chi troverai**, mostrato con la stessa carta-riga degli
alleati. In fondo, la barra squadra.

Guadagno: si sa cosa si sta scegliendo prima di sceglierlo, e nessun nodo è più minuscolo.

### Battaglia — «Campo contro campo»

Due file di tre carte in densità media (432×250), affacciate. Ordine dei turni come striscia
in alto (46px), riga dell'azione in corso al centro, danni in una barra in fondo.

Guadagno: **da 1137px a 768** — entrambe le squadre visibili, e le fasce laterali vuote
spariscono.

## Vincoli

- **Il ritratto non si rimpicciolisce** (D1): è una richiesta esplicita, non una preferenza.
- **La carta è identica in tutte le schermate** (D7): requisito esplicito dell'utente.
- Il gioco deve restare giocabile a **1366×768** senza scorrimento nelle quattro schermate.
- `components/ui/Tooltip.tsx` va riusato, non riscritto.
- I 19 file di test sotto `tests/screens/` e `tests/ui/` devono restare verdi: dove
  asseriscono testo o struttura che cambia, l'asserzione va aggiornata alla nuova realtà —
  mai silenziata.
- `npm run test` **non** esegue il typecheck: `npm run typecheck` va lanciato a parte.

## Fuori scope

- Bilanciamento e motore di combattimento: questo lavoro tocca solo la presentazione.
- Le schermate non citate (menu, collezione, regole, risultato, altare, evento, infermeria)
  restano come sono; erediteranno la carta nuova dove già la usano.
- Il ciclo counter fra archetipi, che ha uno spec proprio
  (`2026-09-15-bot-competente-e-ciclo-counter-design.md`).

## Appendice — le riscritture

| Oggi | Nuovo | Perché |
|---|---|---|
| `Rallenta (VEL -15) (permanente, cumulativo)` | `−15 VEL rallenta · resta` | due parentesi annidate; «resta» dice lo stesso in una parola |
| `Indebolisce (ATT -8) (permanente, cumulativo)` | `−8 ATT indebolisce · resta` | stessa forma per ogni effetto di stato |
| `Espone (DIF -20) (permanente, cumulativo)` | `−20 DIF espone · resta` | il numero va per primo |
| `Stordisce per 1 turni` | `stordisce 1 turno` | errore di concordanza visibile a schermo oggi |
| `Avvelena per 2 turni` | `8 danni · 2 turni` | il veleno ha una potenza che la carta non mostra |
| `Precisione: 90% Ricarica: 1` | `colpisce 90% · ogni 2 turni` | «Ricarica: 1» è ambiguo: un turno d'attesa = si lancia ogni due |
| `Potenza: ×1.5` | `×1.5 danni` | il moltiplicatore da solo non dice di cosa |
| `I suoi colpi possono silenziare il bersaglio.` | `30% silenzia chi colpisce` | «possono» nasconde una probabilità nota |
| `Infligge +30% danni e i suoi colpi possono stordire.` | `+30% danni · 40% stordisce` | due effetti, due numeri, una riga |
| `Subisce il 30% di danni in meno.` | `−30% danni subiti` | sei parole per un numero |
