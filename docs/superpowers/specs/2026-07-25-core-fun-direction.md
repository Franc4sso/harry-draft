# Il Core Fun — direzione rev. 3 (la combo che ha un nome)

**Data:** 2026-07-25
**Stato:** direzione approvata dall'utente ("sì, procedi").
**Supera su tre punti** `2026-06-28-game-design-direction.md` (vedi §5).

---

## 1. La tesi

> **Il core fun è: "ho costruito una macchina, e si è accesa da sola."**
> **L'unità di divertimento è la combo che scatta e ha un nome.**

Il Duo è l'unico sistema del progetto che passa tutte e cinque le domande: è una scoperta,
è una ricetta leggibile, è visibile a schermo, è causato dal giocatore, e **ha un nome che
puoi dire a un amico** ("ho fatto Cancrena con Snape e Bellatrix").

Regola di design conseguente, da applicare a ogni sistema esistente e futuro:

> *Ogni sistema deve (a) creare una combo con un nome, (b) aiutare il giocatore a vederla o
> a puntarla, oppure (c) sparire.*

## 2. La catena causale (le 6 cose che terrei)

tag + ruolo → **accendono un Duo** → il Duo ha un nome e scatta a schermo → il crescendo lo fa
*sentire* → il boss chiede se la macchina regge → la reliquia offre di **cambiare macchina**.

1. **Maghi con RUOLO + un TAG** — i due soli input che generano combo.
2. **I DUO** — promossi da feature a cuore del gioco (oggi 6, obiettivo ~22).
3. **Reliquie che rompono le regole** — jolly, patti, sacrifici. Non i bastoni di statistiche.
4. **La mappa con scelta di percorso.**
5. **Il combattimento drammatizzato** — crescendo, callout, annuncio del Duo.
6. **Boss come esami di una build** — Il Muro è già il modello giusto.

Un sistema che non entra in questa catena non è contenuto in più: **è attrito che si mangia
lo slot di uno che ci sarebbe entrato.**

## 3. Diagnosi: cosa non funziona oggi (misurato sul codice)

| # | Difetto | Prova nel codice |
|---|---|---|
| **D1** | **Dopo ogni vittoria non succede niente.** `VictoryScreen` è la schermata più vista della run (~8-10 volte) e non contiene **nessuna decisione**: trofeo, MVP, turni, "Prosegui". | `components/screens/VictoryScreen.tsx` |
| **D2** | **La build non cambia mai durante la run.** `STARTER_PICKS=3`, reclute cappate a 1/area e spesso zero; il tracciato nei commenti misura **76% di run con zero reclute**. La squadra è decisa al minuto zero. | `runEngine.ts:52`, `nodeGen.ts:25-30`, `constants.ts` |
| **D3** | **Cinque sistemi di team-building sullo stesso asse.** Veleno ha **due soglie diverse** (Sinergia a 3, segnale Duo a 2) con due payoff diversi; i Trii sono un terzo sistema *gated dietro* i Duo. | `synergies.ts`, `duos.ts`, `trios.ts:37-39` |
| **D4** | **60 firme ≅ 12 meccaniche.** Goyle "Stazza" -10% e Crabbe "Stazza" -10% sono **identiche, stesso nome**. Il Tier 4 sono effetti ±10%: in un gioco che *guardi*, invisibili. | `signatures.ts:185-186` |
| **D5** | **10 tipi di nodo su 9 slot visitati, 26 schermate.** Vedi ogni cosa una volta e non impari niente. `spellForge+spellSwap+shop` = 27% del peso filler: tre menù nati per rimpiazzare il loadout rimosso. | `nodeGen.ts`, `constants.ts` categoryWeights |
| **D6** | **L'agency pre-battaglia è stata rimossa.** `spellPool: ['expelliarmus']` — una magia per mago. Il doc di giugno chiamava il loadout *"la leva di agency più potente compatibile con l'auto-battle"*. | `data/wizards.ts` |

### Il referto che nessuno aveva letto

Le note dicono che il bot è diventato *"un proxy molto più fedele"* del giocatore, con
`winRate 0.0000`. **Quando il bot diventa un proxy accurato dell'umano, non è una buona
notizia sul bot: è un referto che l'agency del giocatore è andata verso zero.** E le ~200
righe di sweep in `constants.ts` che ripetono **PLATEAUED** confermano: non è un problema di
numeri, è il loop. Tarare un loop rotto non lo aggiusta.

## 4. Cosa NON è il problema (verificato, non toccare)

- **Il telegrafo dei Duo nel draft esiste ed è ottimo.** `DuoTracker` mostra ricetta, riordina
  le combo, e sull'hover del candidato marca "si attiva / avanza / si spegne / arretra".
  Non va rifatto: **va onorato**. Oggi dice "sei a 1 segnale" e il gioco non offre modo di
  arrivarci — ecco perché D1/D2 sono la priorità.
- **L'engine a eventi.** Regge già hook, trigger, keyword. Non serve riscriverlo.
- **Il crescendo.** È il palcoscenico giusto — ma è un **amplificatore**: vale quanto i momenti
  che ha da drammatizzare. Con 6 Duo illumina poco.

## 5. Cosa supera il documento di giugno

1. **P0 "identità dei maghi" è stato implementato come volume, non come distintività** (D4).
   60 righe non sono 60 identità. La direzione corretta è **potare a ~15 firme percepibili**,
   non aggiungerne.
2. **P8 "loadout" è stato rimosso, non costruito** (D6). Il doc lo chiamava fondante. La sua
   assenza è la causa dei tre nodi-menù (D5).
3. **Il pilastro mancante che il doc non nomina: l'arco della build** (D2). Nessuna quantità
   di keyword o di eventi ripara una squadra che non cambia mai.

## 6. Roadmap — quattro onde a complessità decrescente

Principio: **non aggiungo un sistema finché non ne ho tolto uno.**

### Onda 1 — La sottrazione + il primo verbo
- **1.a (IN CORSO) — Le Spoglie della Vittoria.** Ripara D1+D2: dopo ogni vittoria, una scelta
  che muove i segnali Duo. È il primo verbo restituito al giocatore.
  → piano: `2026-07-25-spoglie-vittoria-plan.md`
- **1.b (FATTA, Fase 1)** — Sinergie fuse nel segnale Duo come **grado 2** (2 maghi = acceso,
  3 = potenziato). Un asse, una barra, due gradi. Resta la Fase 2: un solo pannello nel draft.
- ~~1.c — Rimuovere i Trii di Casata~~ — **ANNULLATA dall'utente (2026-07-25).** I Trii restano,
  e le Case restano una **meccanica di squadra**, non solo colore. Questa voce non è più un todo.
- **1.d (FATTA, 2026-07-27)** — Firme potate da **60 a 15** (D4). Forma scelta dall'utente:
  *~15 maghi con firma, gli altri puliti* (niente keyword condivise, niente ritaratura verso
  l'alto dei Tier 4), con criterio di **distintività sparsa su tutti i tier** — non allineata
  al tier, così che la targa oro voglia dire *"questo fa una cosa strana"* e non *"questo è
  raro"*. Tier 1 3/3 · Tier 2 6/10 · Tier 3 6/20 · **Tier 4 0/27**. Tutti e 60 i maghi restano
  nel gioco: Duo/Trii/Sinergie leggono tag+ruolo e non sono toccati.
  Misura A/B: il bot va **un filo meglio** (`normalBattlesWon` 98→116) ma l'archetipo
  **Scudi-Rigen perde il 24-34% di profondità** — si appoggiava alle firme `-10%` dei
  Tassorosso di Tier 4. Nessuna ritaratura; decide il playtest.
  → spec: `2026-07-27-onda-1d-potare-le-firme.md`
- **1.e (FATTA, 2026-07-25)** — Rimuovere spellForge / spellSwap / shop come tipi di nodo (D5).
  Commit `c3cde39`..`9a0e12d` (Task 1-5) + referto di misura (Task 6, questo commit): i numeri
  grezzi salgono (94/12/14 → 87/8/25 sull'area0/1/2 di `campaignBalanceRestricted`), ma il
  baseline PRIMA risale a un'harness senza handler shop/spellForge (stessa lacuna dell'altare)
  quindi NON è misurabile con questo strumento — vedi la lettura onesta nell'harness; nessuna
  ritaratura fatta.
  → piano: `.superpowers/sdd/2026-07-25-onda-1e-togliere-i-nodi-menu/`
- **1.f (FATTA, 2026-07-28)** — Potate le reliquie che sono solo un numero. Pool 47→42: via il
  quartetto condizionato per RUOLO (`stemma-attaccanti`/`egida-tank`/`fiala-supporto`/
  `sfera-controllo` — la stessa frase quattro volte, zero riferimenti nel codice, fuori dal pool
  starter) più `furia-iniziale` (+18 atk piatto che stava nel pool "rompi-regole" con una desc che
  prometteva un trigger mai implementato). Le 3 condizionate per CASA **restano**: le premia il Trio.
  Gate `RULE_BREAKING_RELIC_IDS >= 3` abbassato onestamente a 2 invece di gonfiare il pool.
  Misura A/B: winRate 0.0500→0.0583 su 120 semi, con battaglie vinte 116→111 — segnali discordi a
  bassa risoluzione, cioè **ri-distribuzione dei semi, non difficoltà**; nessuna ritaratura.
  Ri-registrate le 2 fixture di replay (parità replay tenuta, punteggio 1875 invariato).
  → spec: `2026-07-28-onda-1f-reliquie-numero.md`

**Gate onesto:** dopo l'Onda 1 il gioco deve essere **più divertente con meno roba dentro**.
Se non lo è, il core non è il Duo e questa direzione va rimessa in discussione.

### Onda 2 — I Duo diventano il gioco
Da 6 a ~22 Duo (la matrice segnale×segnale usa 6 caselle su 28). Codex dei Duo scoperti.

### Onda 3 — Le reliquie come pezzi di combo
*"Conta come un mago Veleno per i Duo."* Una reliquia che **completa una combo** è il momento
WOW che oggi non esiste.

### Onda 4 — Gli esami e la memoria
Boss come counter d'archetipo telegrafati. Racconto di fine run che **scrive la frase** che il
giocatore ripeterà. Solo qui, meta-progressione.
