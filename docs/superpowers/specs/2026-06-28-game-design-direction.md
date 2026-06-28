# Game Design Direction — Harry Potter Team-Building Roguelite

> Documento di direzione creativa. **Nessuna implementazione** in questa fase.
> Prospettiva: Game Director di un indie che vuole diventare il riferimento dei roguelite di team-building nel mondo di Harry Potter.
> Data: 2026-06-28 · Stato codice: M6/M7 (Fase 1 roguelite mergiata, polish in corso).
> Rev. 2: promosso P8 a fondante, aggiunto P0 (identità maghi), aggiunto capitolo pacing, ristretta l'Onda 1 a 4 archetipi-faro.

---

## 0. La tesi di design (il Nord)

Abbiamo preso una decisione che vincola tutto il resto: **il combattimento resta auto-risolto** (deterministico, niente controllo turno-per-turno), potenziato da **leve pre-battaglia** e dalla **costruzione della build**.

Questa scelta non è una limitazione: è l'identità del gioco. Ma cambia *dove* nasce il divertimento. In un tattico manuale la WOW nasce dalla giocata; qui la WOW nasce **dal vedere la propria build esplodere da sola, come una macchina che hai costruito tu**. È il piacere di un Auto-battler / di un deck "che si gioca da solo" (pensa a *Slay the Spire* dal lato costruzione, o a *Backpack Battles* / *The Bazaar*): il giocatore è un **ingegnere di combo**, non un pilota.

Da qui, **tre fondamenta** che vanno costruite insieme (sono l'Onda 1) e che reggono tutto il resto:

- **P0 — Identità dei Maghi.** I personaggi devono *essere qualcuno*, non telai-statistica. È ciò che fa dire "ho trovato Luna", "Hermione ha vinto la battaglia".
- **P1 — Keyword & Build.** Il linguaggio comune che fa *impilare* tratti, magie, reliquie e sinergie in una build. È ciò che fa dire "sto giocando una build Veleno".
- **P8 — Drammatizzazione & Loadout.** Poiché la battaglia è auto-risolta, deve essere **spettacolare e leggibile**, e la sua unica leva di agency (il loadout pre-battaglia) deve esistere. È ciò che fa *sentire* gli altri due.

Queste tre non sono in sequenza: **una senza le altre due non funziona.** Una build profonda (P1) su personaggi anonimi (no P0) guardata su una barra che scende (no P8) è noia tecnica. Sono un treppiede.

Domanda guida per ogni sistema, d'ora in poi:

> *"Questo fa nascere una build diversa, un personaggio memorabile, un momento da raccontare, o una decisione dolorosa? Se no, perché esiste?"*

---

## 1. Diagnosi onesta dello stato attuale

Cosa c'è di buono (da non rompere):

- **Engine di combattimento solido e a eventi.** EventBus con hook `onHit`, `onTurnStart`, `onAllyDeath`, `onHpThreshold`, `modifyOutgoingDamage`, ecc. È **già pronto a ospitare reliquie e abilità che cambiano le regole** — non lo sappiamo sfruttare.
- **I Tratti sono il pilastro più ricco** (17 tratti: Veleno, Esecuzione, Vendetta, Pietrificazione…). Sono già **keyword-shaped** *e* sono i mattoni delle abilità-firma: la spina dorsale di P0 e P1 è già qui, mascherata.
- **Roster ampio** (60 maghi) e **35 magie / 20 status** con buona varietà meccanica (hard CC, soft CC, DOT, scudi, buff a gradini).
- **Framework roguelite funzionante**: mappa a 3 aree × 5 piani, ramificazione, leveling win-based, persistenza.

Cosa tradisce la promessa "roguelite memorabile":

| Sintomo | Diagnosi |
|---|---|
| **I maghi sono telai-statistica.** I tratti NON sono ancora assegnati ai personaggi nominati (pool condiviso, distribuzione "TBD"). | "Gioco Harry" non ha significato meccanico. Senza identità, niente "ho trovato Luna". **Buco fondante.** |
| **Le sinergie sono solo numeri piatti** (+10 DEF, +22 ATK). Le Case sono l'*unico* asse di build, e noioso. | Non nasce nessuna "build Veleno". Il brief vuole le Case come *uno* dei tanti assi, non l'unico. |
| **16 reliquie su 19 sono bastoni di statistiche.** | Nessuna reliquia "rompe il gioco". Trovarne una non è un momento. |
| **Eventi, Shop, Sala Comune, Foresta: catalogati ma VUOTI.** | Manca tutto il livello narrativo e delle decisioni dolorose. È il buco di *contenuto* più grande. |
| **Un solo boss scriptato (Voldemort).** I boss d'area sono squadre random. | Nessun boss "cambia le regole", nessun "esame finale" per una build. |
| **Le scelte sono quasi tutte in upside** (prendi reliquia / recluta / skip). | Nessuna rinuncia. Nessun dolore. Nessuna storia di sacrificio. |
| **~8 battaglie auto-risolte simili per run.** | Rischio noia: in auto-battle, guardare combattimenti che si assomigliano stanca in fretta. **Problema di pacing.** |
| **La battaglia comunica poco *perché* succede qualcosa.** | In auto-battle, se non vedi la build funzionare, guardi una barra che scende. |
| **Zero meta-progressione.** Ogni run riparte da zero. | Manca il motore della retention ("ancora una partita"). |

**Conclusione**: l'ossatura tecnica è buona. Mancano **identità, linguaggio di sistema, contenuto e drammatizzazione** — la parte che decide se un roguelite è memorabile. Gran parte è *dato e testo* su un'architettura che già regge.

---

## 2. Roadmap prioritizzata — i Pilastri

Ordinati per **(impatto sul divertimento) / (rischio)**. I tre pilastri **fondanti** (P0, P1, P8) sono l'Onda 1 e vanno insieme; poi i **contenuti che rompono e raccontano** (P2–P5); poi **sorprese e retention** (P6–P7). Il **pacing** (cap. 12) è una preoccupazione trasversale che attraversa tutto.

| ID | Pilastro | Cosa sblocca | Impatto | Complessità | Priorità |
|---|---|---|---|---|---|
| **P0** | **Identità dei Maghi & Abilità-Firma** | "ho trovato Luna", "Hermione ha vinto" | 🔥🔥🔥🔥🔥 | Media | **Fondante (Onda 1)** |
| **P1** | **Keyword & Archetipi di Build** | "gioco una build", fa impilare tutto | 🔥🔥🔥🔥🔥 | Media | **Fondante (Onda 1)** |
| **P8** | **Drammatizzazione & Loadout** | far *sentire* l'auto-battle; l'unica agency | 🔥🔥🔥🔥🔥 | Media | **Fondante (Onda 1)** |
| **P2** | **Reliquie che rompono le regole** | "questa reliquia cambia la run" | 🔥🔥🔥🔥🔥 | Media | **Onda 2** |
| **P3** | **Eventi narrativi & nodi vivi** | storie, sorprese, reclute rare, dolore | 🔥🔥🔥🔥🔥 | Media (dato/testo) | **Onda 2** |
| **P4** | **Boss che cambiano le regole** | "esame finale" per ogni build | 🔥🔥🔥🔥 | Media | **Onda 2** |
| **P5** | **Economia del Sacrificio** | rinuncia, identità della run | 🔥🔥🔥🔥 | Media-bassa | **Onda 3** |
| **P6** | **Sorprese & contenuti segreti** | "sorprendimi", ancora una partita | 🔥🔥🔥🔥 | Media | **Onda 3** |
| **P7** | **Meta-progressione & sblocchi** | retention a lungo termine | 🔥🔥🔥 | Alta | **Onda 4** |

I capitoli 3–11 sviluppano ciascun pilastro. Il cap. 12 affronta il pacing. Il cap. 13 copre i sistemi rimanenti del brief, ordinati per priorità. Il cap. 14 dà la sequenza in onde. Le Appendici A–E contengono contenuti concreti pronti a seminare l'implementazione.

---

## 3. P0 — Identità dei Maghi & Abilità-Firma *(fondante)*

### Il problema
Gli agent hanno trovato il buco più sottovalutato: **i 17 tratti non sono ancora assegnati ai maghi nominati** — tutti i 60 pescano dallo stesso pool, distribuzione "TBD". Conseguenza: "sto giocando Harry" non significa niente di meccanico. Ma il brief vuole **due cose insieme**: *"sto giocando una build"* **e** *"ho trovato Luna nella Foresta Proibita"*, *"Hermione ha sconfitto il Boss"*. La seconda metà — l'attaccamento ai personaggi — richiede che i maghi iconici siano **qualcuno**, non telai intercambiabili su cui appoggiare keyword.

C'è una tensione vera tra **build** (sistemi astratti che si impilano) e **personaggio** (identità concreta e insostituibile). Un buon roguelite di team-building le tiene entrambe: la build è *come* giochi, il personaggio è *con chi*. Risolvere solo P1 e ignorare P0 produce un ottimo motore senza anima HP.

### La soluzione: ogni mago iconico ha un'Abilità-Firma
Assegnare ai maghi nominati (almeno i ~20 più iconici) un'**Abilità-Firma**: un tratto unico, tematico, che *è* quel personaggio e che spesso **abilita o potenzia un archetipo** (ponte diretto con P1). I maghi minori restano sul pool di tratti generici (va benissimo: crea contrasto e fa risaltare gli iconici).

Principi:
- **Tematica prima di tutto.** L'abilità deve *raccontare* il personaggio. Hermione non fa "+10% danno": Hermione *pensa*.
- **Aggancio alle build.** Ogni firma punta a una keyword (P1), così reclutare quel mago è "trovare il pezzo della mia build" — momento WOW.
- **I leggendari rompono le regole, ma sono rarissimi.** Dumbledore, Voldemort: la loro firma è cambia-regole (come una reliquia epica), per questo sono Tier 1.
- **Le firme rendono le reclute dei *momenti*.** Reclutare Luna non è "+1 unità": è sbloccare l'evento dei Thestral e una firma che vede l'invisibile (anti-stealth/anti-evasione).

### Esempi (lista completa in Appendice E)
- **Harry — "Tocco della Madre"**: la prima volta che morirebbe in una battaglia, sopravvive con 1 HP e infligge ESECUZIONE potenziata per 2 turni. *(Il ragazzo che è sopravvissuto.)*
- **Hermione — "La Strega più Brillante"**: le sue magie non vanno mai in cooldown se ha colpito il bersaglio giusto; conosce *una magia in più* nel loadout. *(Preparazione, intelligenza → build Controllo/Tecnica.)*
- **Ron — "Strategia a Scacchi"**: buffa l'intera squadra in base a quanti alleati sono vivi (più siete, più li coordina). *(Il re degli scacchi → build di squadra piena.)*
- **Snape — "Principe Mezzosangue"**: può lanciare Sectumsempra/Levicorpus potenziati; cura sé stesso quando infligge MAGIE OSCURE. *(Ambiguo → build Magie Oscure con sustain.)*
- **Bellatrix — "Crudeltà"**: i suoi colpi su bersagli già danneggiati raddoppiano il SANGUINAMENTO. *(Sadica → build Veleno offensiva… ed è anche un boss, vedi P4.)*
- **Neville — "Coraggio Tardivo"**: inerme all'inizio, ma ogni turno guadagna ATK/DEF permanenti; sblocca tutto sotto il 50% HP della squadra. *(L'arco narrativo → build Momentum.)*
- **Luna — "Vede l'Invisibile"**: ignora schivata e invisibilità nemiche; rivela i nemici nascosti (anti-Mantello, anti-Basilisco). *(La veggente → counter situazionale.)*
- **Dumbledore *(leggendario)* — "Ordine Superiore"**: una volta per battaglia, annulla completamente il turno del boss. *(Cambia-regole.)*

### Pro / Contro
- **Pro**: dà anima HP al gioco; trasforma ogni recluta in un evento; è il **ponte tra build e personaggi** che il brief chiede esplicitamente; riusa il sistema di tratti già esistente.
- **Contro**: bilanciamento per-personaggio (no formula unica); rischio "must-pick" se alcune firme sono troppo forti → vanno legate ad archetipi diversi così che la scelta dipenda dalla build; richiede scrittura tematica di qualità.
- **Impatto rigiocabilità**: 🔥🔥🔥🔥🔥. Reclute memorabili = run memorabili.
- **Complessità**: Media. Le firme semplici sono nuovi tratti (dato); le leggendarie cambia-regole toccano l'engine come le reliquie epiche.

---

## 4. P1 — Keyword & Archetipi di Build *(fondante)*

### Il problema
Oggi una "build" è solo: 5 maghi + sinergie di Casa/Ruolo (bonus piatti) + qualche tratto + reliquie-statistica. Non esiste un **linguaggio comune** che faccia sì che tratto, magia, reliquia e sinergia parlino della *stessa cosa* e si **impilino**. Il giocatore ottimizza statistiche, non costruisce una macchina. Le Case sono l'unico asse identitario — esattamente ciò che il brief vuole evitare.

### La soluzione: le Keyword come valuta di design
Un insieme **limitato (~10–12)** di **Keyword meccaniche** (tag) che attraversano *tutti* i sistemi. Ogni magia, tratto, abilità-firma, reliquia, status, sinergia ed evento è taggato. Le reliquie e sinergie smettono di dare "+X statistica" e iniziano a dire **"+X% a tutto ciò che è VELENO"** o **"quando applichi SANGUINAMENTO, fai anche…"**. È così che nasce la build: perché veleno-tratto + veleno-firma + veleno-relic + veleno-sinergia + veleno-detonatore si moltiplicano.

**Le keyword devono restare *Harry Potter*, non RPG generico.** Il nome e la fantasia contano quanto la matematica: preferire "Magie Oscure", "Felicità/Patronus", "Doni della Morte", "Sangue/Maledizione" a termini anonimi. Dove una keyword è inevitabilmente generica (es. il critico), vestirla a tema: il critico è **"Colpo Fortunato"** (fantasia Felix Felicis), il momentum è **"Crescendo"** (già un tratto esistente).

Keyword proposte (estensione diretta di `traits.ts` / `statuses.ts`):

- **VELENO / SANGUINAMENTO** (DOT) — tratto Veleno, status burn/dot, Boccino
- **COLPO FORTUNATO** (critico) — `critBase`/`critMult`, scaling SPD, Felix Felicis
- **VELOCITÀ / CATENA** (agire prima, agire due volte) — Corvonero, Giratempo
- **SCUDO / BARRIERA** — Aegis, status shield, Benedizione, Pietra della Resurrezione
- **CONTROLLO** (stun/freeze/silence/disarm) — 5 tratti CC, 4 status hard-CC
- **RIGENERAZIONE / VAMPIRISMO** — Tassorosso, Bezoar, Rigenerazione
- **ESECUZIONE** (danno extra sotto soglia HP) — tratto Esecuzione
- **SACRIFICIO** (payoff quando un alleato muore) — tratto Vendetta, hook `onAllyDeath`
- **MAGIE OSCURE** (Avada, Fiendfyre, Crucio: alto rischio/danno) — gruppo Mangiamorte
- **EVOCAZIONE** (nuovo) — seme: Serpensortia, Patronus
- **CRESCENDO** (buff che si accumulano) — Crescendo, Ferocia, Anticipo

### Tre meccaniche che trasformano keyword in *build*
1. **Scaling**: reliquie/sinergie/firme che amplificano una keyword.
2. **Detonatori**: effetti che *consumano* uno stato per un payoff esplosivo (*"infliggi il doppio del VELENO residuo e azzeralo"*). Sono il cuore dei momenti WOW di una build a status.
3. **Conversioni**: reliquie che convertono una keyword in un'altra (*"RIGEN in eccesso → SCUDO"*) — abilitano build ibride e momenti "ho rotto il gioco".

### Le sinergie diventano motori, non bonus piatti
- **Tassorosso** non più "+REGEN" → *"la RIGEN eccedente diventa SCUDO"*.
- **Serpeverde** → *"+15% MAGIE OSCURE, -5 HP a inizio battaglia"*.
- **Corvonero** → *"il primo mago agisce due volte nel primo turno"*.
- Aggiungere **sinergie di archetipo** (non di Casa): *3 maghi VELENO* → *"il VELENO si accumula all'infinito"*. La build esiste *anche senza* allineamento di Casa.

### Focus: l'Onda 1 spedisce **4 archetipi-faro**, non 12
Elencare 12 build è ambizione, non un piano: il rischio è averne 12 mediocri. La mossa giusta è **3–4 archetipi costruiti benissimo**, ognuno con il kit completo (firma + reliquia-chiave + detonatore + sinergia + boss-counter dedicato), mutuamente distinti per *sensazione*. Set proposto per l'Onda 1:

| Archetipo-faro | Fantasia | Sensazione | Pezzi-chiave |
|---|---|---|---|
| **Veleno/Sanguinamento** | "li avveleno e guardo il timer" | DOT paziente che detona | tratto Veleno, firma Bellatrix, Boccino, Pugnale, detonatore |
| **Scudi & Rigenerazione** (Tassorosso) | "non potete scalfirmi" | muro che logora | Aegis, Benedizione, Coppa, Pietra, conversione Rigen→Scudo |
| **Esecuzione** (Grifondoro) | "sotto il 30% siete morti" | burst aggressivo a soglia | tratto Esecuzione, firma Harry, Spada di Grifondoro |
| **Magie Oscure** (Serpeverde/Mangiamorte) | "potere a ogni costo" | glass cannon ad alto rischio | Avada, Fiendfyre, firma Snape, Sambuco, Corruzione |

Quattro *sensazioni* diverse: DOT / sustain-difesa / burst / rischio-nuke. Gli altri 8 archetipi (Appendice D) sono backlog post-Onda-1.

### Pro / Contro
- **Pro**: è il moltiplicatore che fa funzionare *tutto*; trasforma "squadra" in "build"; riusa tratti/status esistenti; con 4 archetipi-faro resta focalizzato.
- **Contro**: refactor del modello dati (taggare i contenuti) e bilanciamento delle combo (esplosioni *desiderabili* in un roguelite, ma niente "win istantaneo" noioso); tenere il set di keyword piccolo.
- **Impatto rigiocabilità**: 🔥🔥🔥🔥🔥.
- **Complessità**: Media.

---

## 5. P8 — Drammatizzazione & Loadout *(fondante)*

### Il problema
In auto-battle il giocatore **guarda**. Se guarda una barra che scende, è noia. Se guarda la propria macchina-build esplodere, è estasi. Questo è il **rischio numero uno** dell'intera direzione: gli esempi-bandiera del brief (*"Hermione ha sconfitto il Boss con un ultimo incantesimo"*, *"Bellatrix ha eliminato metà della squadra"*) sono momenti di **dramma percepito**. Se il giocatore non *sente*, nessuna profondità di build lo salva. Per questo P8 è fondante, non polish: senza, P0 e P1 restano astratti.

### La soluzione: agency a monte, spettacolo a valle
**Il Loadout (l'agency).** Ogni mago ha un `spellPool` di 5 magie che oggi l'engine spreca scegliendo da solo. La schermata di **Loadout pre-battaglia** è la decisione che il giocatore prende — e poi guarda il risultato:
- cura le magie di ogni mago (quali porta in battaglia);
- imposta una **tattica/formazione** (es. front/back, priorità di bersaglio);
- decide eventuali **innesco pre-battaglia** (consumabili, attivazioni).
È **la leva di agency più potente compatibile con l'auto-battle, e quasi gratis architetturalmente** (il pool esiste già).

**Lo spettacolo (il payoff).** Rendere leggibile e drammatico ciò che succede:
- **Callout di combo**: quando keyword/sinergia/firma si attivano, mostralo ("VELENO ×8!", "ESECUZIONE!", "Fawkes risorge Harry!").
- **Beat drammatici / kill-cam**: pausa breve + enfasi sul colpo che uccide il boss, sul revive all'ultimo, sulla detonazione.
- **MVP & recap memorabile**: a fine battaglia, evidenzia il momento chiave ("Hermione: 3 esecuzioni, 240 danni"). Alimenta il "racconta la tua run".
- **Controllo del replay**: accelerare/rivedere; osservazione *attiva*.

### Pro / Contro
- **Pro**: trasforma il punto debole dell'auto-battle (passività) nel suo punto di forza (spettacolo); il loadout dà agency reale senza riscrivere il combattimento; è ciò che fa *sentire* P0 e P1.
- **Contro**: lavoro di UI/UX e feedback visivo non triviale; troppi effetti rallentano il ritmo → servono priorità visive (mostrare solo i beat che contano).
- **Impatto rigiocabilità**: 🔥🔥🔥🔥🔥 (indiretto ma decisivo).
- **Complessità**: Media.

---

## 6. P2 — Reliquie che rompono le regole *(Onda 2)*

### Il problema
16/19 reliquie sono "+X statistica". Trovarne una **non è un momento**. La buona notizia: l'EventBus già supporta hook (la Pietra fa già `onBattleStart → scudo`, il Boccino `onHit → DOT`). L'architettura per reliquie cambia-regole **esiste già**: è sottoutilizzata.

### La soluzione: 4 classi di reliquia per rarità crescente
1. **Statistiche condizionali** (Comune/Non-Comune) — restano, ma agganciate alle keyword. *"+25% danno da VELENO."*
2. **Trigger reattivi** (Rara). *"Quando un alleato scende sotto il 30%, ottiene SCUDO 40."*
3. **Cambia-regole** (Epica) — ordine dei turni, doppi cast, detonazioni, conversioni.
4. **Uniche / Leggendarie** (nuova rarità) — definiscono *da sole* una build, spesso con un **costo** (le Reliquie del Sacrificio, P5). Una per run, da evento o boss.

### Esempi che cambiano la run (lista completa in Appendice A)
- **Giratempo (rework)** — *Il mago più lento agisce per primo, ogni turno.*
- **Bacchetta di Sambuco (rework)** — *Le magie d'Attacco non vanno in cooldown; -3 HP per lancio.* (Magie Oscure spam, con rischio.)
- **Penseatoio** — *Una resurrezione a 1 HP per battaglia.*
- **Coppa di Tassorosso** — *RIGEN in eccesso → SCUDO permanente.* (Reliquia-chiave della build Scudi-Rigen.)
- **Diadema di Corvonero** — *VELOCITÀ oltre 30 → COLPO FORTUNATO.* (Conversione.)
- **Horcrux** *(Unica)* — *Un mago rinasce una volta; ma "maledice" la run* (vedi finale alternativo).

### Perché è divertente
È il momento *"adesso gioco in modo diverso"*: trovi il Giratempo-rework e i tank lenti diventano la tua wincon. Esattamente lo story beat del brief: *"Ho cambiato build dopo aver trovato la Bacchetta di Sambuco."*

### Pro / Contro
- **Pro**: alto WOW per unità di lavoro (l'engine regge); ogni reliquia rara/epica è un potenziale punto di svolta; sinergia diretta con P1.
- **Contro**: bilanciamento (alcune romperanno le run — *voluto*, evitare solo il "win istantaneo"); UI che spieghi effetti complessi.
- **Impatto rigiocabilità**: 🔥🔥🔥🔥🔥. · **Complessità**: Media.

---

## 7. P3 — Eventi narrativi & nodi vivi *(Onda 2)*

### Il problema
I nodi `event`, `shop`, `commonRoom`, `library`, `potions`, `forest` sono **catalogati ma vuoti**. Manca il livello che il brief chiama *"uno degli elementi più memorabili della run"*. Senza eventi, la run è solo: combatti → premio → combatti.

### La soluzione: un sistema di eventi a storie + conseguenze
Ogni evento ha: **ambientazione**, **testo narrativo**, **scelte (2–4)**, **rischio**, **ricompensa**, **sviluppi futuri** (flag che fanno ricomparire un NPC, sbloccano un evento successivo, tingono il finale). Classificati per rarità.

Principi:
- **Ogni scelta ha una rinuncia o un rischio.** Mai "premio gratis".
- **Canale delle reclute rare e dei segreti.** Luna nella Foresta. Fawkes col sacrificio. Una magia proibita da uno sconosciuto.
- **Conseguenze ritardate.** Salvi qualcuno in area 1 → ricompare in area 3 per ripagarti o tradirti. Le storie da raccontare nascono qui.
- **Catene di eventi (questline).** Es. i frammenti dei Doni della Morte, che culminano in un payoff raro.

### Esempi iconici (decine in Appendice B)
- **La Foresta Proibita** *(raro)* — [Segui il canto: 50% recluti **Luna**, 50% imboscata di Acromantule] / [Ignora: +1 reliquia comune]. *Sviluppo*: Luna sblocca l'evento "I Thestral".
- **La Stanza delle Necessità** *(raro)* — offerta **keyword-aware**: ti dà *esattamente* il pezzo che manca alla tua build. Momento WOW di "completamento sinergia".
- **Magia Proibita** *(raro)* — [Accetta l'Avada: un mago ottiene una Magia Oscura potentissima ma diventa **Corrotto**, malus permanente] / [Rifiuta].
- **Il Sacrificio di Fawkes** *(iconico)* — [Sacrifica una reliquia → ottieni **Fawkes**, resurrezione ogni battaglia] / [Lascia andare].
- **Il Velo dei Misteri** *(iconico)* — [Attraversa: perdi un mago **per sempre**, ottieni una Reliquia Unica] / [Resta]. Decisione dolorosa pura.

### Pro / Contro
- **Pro**: enorme densità di WOW e storie emergenti per unità di lavoro (**dato e testo** su un framework esistente); fonte numero uno del "racconta la tua run"; scala all'infinito.
- **Contro**: serve scrittura di qualità (il testo *è* il prodotto); serve un motore di flag/condizioni per gli sviluppi ritardati; le scelte devono mordere.
- **Impatto rigiocabilità**: 🔥🔥🔥🔥🔥. · **Complessità**: Media.

---

## 8. P4 — Boss che cambiano le regole *(Onda 2)*

### Il problema
Un solo boss scriptato (Voldemort, con `forcedSpells` + `exclusiveSynergy`). I boss d'area sono squadre random scalate a budget — pareti di HP, non esami.

### La soluzione: roster di boss scriptati, ognuno una regola
Generalizzare il meccanismo di Voldemort (`exclusiveSynergy`, `forcedSpellIds`, `hpMult`) in un **roster di boss con regola unica**, più **fasi** (hook `onHpThreshold` già esiste). Ogni boss è **counter di un archetipo**: la difficoltà è *educativa*. **Telegrafia obbligatoria**: la regola del boss è mostrata *prima* della battaglia, così la scelta build è informata e la sconfitta insegna invece di frustrare.

### Principio fondante: il Web dei Counter (stile Pokémon)
**Regola di design da tenere sempre presente, vale per TUTTI gli archetipi.** Nessuna build è buona in assoluto: **ogni archetipo ha cose che batte e cose da cui è battuto**, come i tipi nei Pokémon. Questo è ciò che tiene il gioco profondo e rigiocabile: non esiste "la build migliore", esiste *la build giusta per questo incontro*. Perché funzioni servono:
- **I nemici esprimono archetipi**, non solo budget. Un nemico Scudi, un nemico Rigen, un nemico Burst — riconoscibili. Così i matchup sono *leggibili* e il giocatore impara a contro-draftare (e ad **adattarsi** col loadout pre-battaglia P8 / le reclute).
- **I counter emergono dalle meccaniche**, non incollati sopra. Es. il VELENO *bypassa gli scudi* (il tick ignora l'absorb) e *divora* gli HP alti → batte Scudi/Tank; ma *è annullato dal Regen* e *non fa in tempo* contro il Burst/Esecuzione → ne è battuto. Queste forze/debolezze vanno **preservate consapevolmente** quando si progetta ogni archetipo.
- **I boss sono gli "esami" del web**: ognuno è il counter-incarnato di un archetipo (Umbridge vieta una keyword; i Dissennatori puniscono le build lente; ecc.), e ti costringe a non essere mono-build o ad adattarti.

Conseguenza pratica: in ogni spec di archetipo si dichiara esplicitamente la sua **matrice di matchup** (cosa batte / da cosa è battuto), e si aggiunge un test che la verifica. La prima è nella fetta Veleno (vedi quella spec, §7.1).

### Esempi (lista in Appendice C)
- **Dolores Umbridge** — *vieta una keyword a caso ogni 3 turni*. Esame per build mono-keyword.
- **I Dissennatori** — *drenano HP/turno; buff dimezzati*. Esame per build Crescendo/lente; counter = burst o "Patronus".
- **Bellatrix** — *uccide un mago → -20% ATK al resto*. Esame per build fragili. (Il brief la cita.)
- **Nagini + Voldemort** — *Voldemort immortale finché Nagini vive*. Cambia la condizione di vittoria: gestione delle priorità.
- **Grindelwald** *(segreto)* — *copia la tua sinergia di archetipo più forte e la usa contro di te*.

### Pro / Contro
- **Pro**: ogni boss è un picco drammatico e dà senso alla build; alta memorabilità; riusa meccaniche esistenti.
- **Contro**: bilanciamento per-boss; rischio "regole ingiuste" senza telegrafia.
- **Impatto rigiocabilità**: 🔥🔥🔥🔥. · **Complessità**: Media.

---

## 9. P5 — Economia del Sacrificio & decisioni dolorose *(Onda 3)*

### Il problema
Quasi ogni scelta è in **upside**. Niente fa *male*. Il brief vuole *"decisioni dolorose"*, dove *"ogni scelta comporta una rinuncia"*. Senza costo, niente peso; senza peso, niente storia.

### La soluzione: il costo come meccanica trasversale
- **Reliquie del Sacrificio**: le più potenti costano un mago, una reliquia, HP max permanenti, o un malus di run.
- **Corruzione**: accettare Magie Oscure rende un mago "Corrotto" — potentissimo ma con un malus (perde HP ogni turno / non curabile). Build Magie Oscure = alto rischio *per design*.
- **Élite opzionali ad alto rischio**: il giocatore *sceglie* di affrontarle per una ricompensa sproporzionata.
- **Il dilemma della panchina**: sostituire un membro *amato e potenziato* (alto livello, sinergie, storia) va **enfatizzato** dalla UI — mostra cosa perdi.
- **Patti & maledizioni**: potere in cambio di una condizione che pesa sul resto della run.

### Esempi
- **Il Voto Infrangibile** — *Giura di non reclutare più → la squadra attuale ottiene +20% a tutto.*
- **Il Diario di Tom Riddle** — *Potentissimo, ma a fine run un mago a caso "scompare".*

### Pro / Contro
- **Pro**: dà peso e identità alla run; genera storie ("ho sacrificato X per Y"); crea tensione, cuore del genere.
- **Contro**: rischio frustrazione se i costi sono opachi → **sempre chiari prima della scelta**; calibrare per non punire il casual.
- **Impatto rigiocabilità**: 🔥🔥🔥🔥. · **Complessità**: Media-bassa (tranne la Corruzione, che tocca lo stato del mago).

---

## 10. P6 — Sorprese & contenuti segreti *(Onda 3)*

### Il problema
Una run è prevedibile: 3 aree, stessa struttura, stesso pool. Manca il *"sorprendimi"*.

### La soluzione: stratificare rarità e segreti
- **Reclute leggendarie rarissime** via eventi a bassissima probabilità o condizioni segrete ("4 Corvonero a fine area 2 → evento unico").
- **Boss nascosti & rami di mappa alternativi**: la Camera dei Segreti, il Ministero, con regole proprie e un boss segreto (Basilisco, Grindelwald).
- **I Doni della Morte (questline-collezione)**: tre frammenti in eventi rari. Collezionarli → trasformazione ("Padrone della Morte": Horcrux + Bacchetta + Mantello = finale alternativo). Lo story beat definitivo.
- **Eventi che ribaltano la run**: rarissimi, cambiano le regole *per il resto della partita*.

### Pro / Contro
- **Pro**: motore del *"ancora una partita"*; ogni segreto è una storia e passaparola.
- **Contro**: contenuto a bassa frequenza (costoso per ora-vista); meglio pochi segreti *ben fatti* che molti diluiti.
- **Impatto rigiocabilità**: 🔥🔥🔥🔥. · **Complessità**: Media (i rami di mappa toccano il generatore).

---

## 11. P7 — Meta-progressione & sblocchi *(Onda 4)*

### Il problema
**Zero persistenza tra run.** Manca il motore della retention: progredire anche perdendo, e *sbloccare* contenuto che alimenta la curiosità.

### La soluzione: meta-progressione "a scoperta", non "a potere"
La meta **a potere** (diventi permanentemente più forte) erode la sfida. Preferire **varietà/scoperta**:
- **Codex / Cioccorane**: sblocchi maghi, reliquie, eventi che entrano nel *pool* futuro (più varietà, non più potere). "3/60 maghi sbloccati" è un gancio fortissimo.
- **Ascensione / Livelli di Oscurità** (stile StS): dopo la prima vittoria, modificatori di difficoltà crescente. Il vero endgame.
- **Sfide / Imprese**: "vinci con una build Veleno", "completa una run senza reclutare".
- **Reliquie meta-narrative**: la Pietra della Resurrezione richiama un mago caduto in una *run precedente*.
- **Daily Run** (seed condiviso): competizione e confronto. Alta retention.

### Pro / Contro
- **Pro**: trasforma "bel gioco" in "non riesco a smettere"; dà senso alle sconfitte; struttura l'endgame.
- **Contro**: pilastro **più costoso**; richiede *abbastanza contenuto da sbloccare* (per questo è Onda 4); la meta a potere va evitata.
- **Impatto rigiocabilità**: 🔥🔥🔥 sul singolo, 🔥🔥🔥🔥🔥 sulla retention. · **Complessità**: Alta.

---

## 12. Pacing & ritmo della run *(trasversale)*

### Il problema che avevo evitato
15 nodi, ~8 battaglie auto-risolte per run. In auto-battle, **guardare 8 combattimenti simili annoia**. Non è scontato che la lunghezza attuale sia giusta. Una run memorabile ha un *ritmo emotivo*, non solo una curva di difficoltà.

### Direzioni
- **Battaglie più rapide e leggibili.** In auto-battle la durata della singola battaglia è un costo: meglio scontri brevi e brutali (il dramma sta nel *picco*, non nella durata). Il controllo di velocità del replay (P8) aiuta.
- **Alternare tensione e respiro.** Orchestrare la sequenza dei nodi come una curva emotiva: scontro → evento (respiro, scelta) → élite (tensione) → reliquia (premio) → boss (picco). Mai due picchi o due respiri di fila.
- **Densità sopra lunghezza.** Valutare run *più corte e più dense* di decisioni (meno battaglie-filler, più eventi e scelte di build). Meglio 5 nodi memorabili che 10 di routine.
- **Varietà forzata.** Il generatore di mappa dovrebbe garantire diversità di *tipo* nei nodi raggiungibili, così due passi consecutivi non siano mai "battaglia, battaglia".
- **Picco emotivo prima del boss.** Un nodo "respiro narrativo" (Sala Comune) appena prima del boss carica la tensione del picco.

### Priorità
Trasversale: le scelte di pacing si calibrano *insieme* a P3 (eventi = respiri) e P8 (battaglie leggibili). Da rivisitare a ogni onda, non un pilastro a sé.

---

## 13. Analisi dei sistemi rimanenti (per priorità)

**Core Gameplay Loop** — Buono ma piatto a metà. La spina regge; manca il *ritmo emotivo* (cap. 12). **Onda 2.**

**Progressione della Run** — Leveling win-based elegante. Aggiungere **scelte di crescita** ai milestone (3/6/9), *keyword-aware* (mini-decisione di build per mago). **Onda 1–2.**

**Sistema della Mappa** — Buono (nearest-2, stile StS). Aggiungere **leggibilità delle ricompense** e **rami segreti** (P6); garantire varietà di tipo (cap. 12). **Onda 3.**

**Sistema dei Nodi** — Metà vuota (P3). Priorità: `event`, poi `commonRoom` (respiro/cura), poi `shop`. **Onda 2.**

**Sistema del Reclutamento** — Funziona ma è un menù. Renderlo narrativo (reclute via evento/rare/a costo) e **keyword-aware** (completa la build = WOW); le firme (P0) lo rendono memorabile. **Onda 1–2.**

**Sistema delle Magie** — Buona varietà (35). Il `spellPool` di 5 va **scelto dal giocatore** (loadout, P8). Aggiungere **upgrade di magie** (nodo `library`). **Onda 1.**

**Sistema delle Sinergie** — Da convertire in motori keyword (P1) + sinergie di archetipo + anti-sinergie. **Onda 1.**

**Sistema degli Status** — Buono (20). Mancano **detonatori** e **interazioni** (P1): uno status oggi è un timer, deve diventare *carburante*. **Onda 1.**

**Battle Engine** — Solido. Estensioni mirate via EventBus: detonatori/conversioni (P1), regole-boss e fasi (P4), reliquie e firme cambia-regole (P0/P2). Niente riscrittura. **Onda 1–2.**

**Bilanciamento Difficoltà** — Win rate ~21.7% su gioco quasi-ottimo. Con la build-diversity va ripensato **per archetipo** (ogni build con una curva giocabile) e reso **build-aware** (i boss-counter di P4 sono il regolatore); l'Ascensione (P7) è la valvola per i veterani. **Onda 2–4.**

**Progressione Permanente / Sblocco Contenuti** — Vedi P7 (Codex/Imprese/Ascensione). **Onda 4.**

**Endgame** — Oggi inesistente. È **Ascensione** (P7) + **build da padroneggiare** (P1) + **segreti** (P6) + **Imprese** (P7). **Onda 4.**

**Modalità Alternative** — Daily Run (P7, alto ROI), poi run a tema/seed speciali (P6). Niente PvP (YAGNI). **Onda 4+.**

**Replayability / Memorabilità / "ancora una partita"** — Non sistemi a sé: sono la *somma* di P0 (personaggi) + P1 (build) + P3/P6 (contenuto e segreti) + P7 (sblocchi) + P8 (dramma). I pilastri convergono qui.

**Psicologia & Retention** — Sfruttare: scoperta (Codex), padronanza (Ascensione), narrazione (eventi), near-miss (sconfitte che insegnano), variabilità (drop), attaccamento (firme/P0). Evitare: meta a potere, costi opachi. **Trasversale.**

---

## 14. Sequenza consigliata di lavorazione (4 onde)

Non è un piano d'implementazione (verrà dopo, con `writing-plans`), ma l'ordine logico. Ogni onda è già *giocabile e migliore* della precedente.

1. **Onda 1 — Le fondamenta (P0 + P1 + P8).** Identità dei maghi (abilità-firma per gli iconici), linguaggio delle keyword con **4 archetipi-faro** completi, e drammatizzazione + loadout. È ciò che cambia *immediatamente* la sensazione del gioco: personaggi veri, build vere, battaglie che si *sentono*. Le tre vanno insieme — un treppiede.
2. **Onda 2 — Contenuto che rompe e racconta (P2 reliquie + P3 eventi + P4 boss).** Si agganciano tutti alle keyword e alle firme. È l'onda che riempie il gioco di momenti.
3. **Onda 3 — Peso & sorpresa (P5 sacrificio + P6 segreti).** Danno spessore e profondità di scoperta.
4. **Onda 4 — Retention (P7 meta/ascensione/daily).** Ha senso solo ora che c'è contenuto da sbloccare e padroneggiare.

Il **pacing** (cap. 12) si rivisita a ogni onda.

---

## Appendice A — Reliquie (campionario per rarità)

**Comuni (statistiche keyword-aware)**: Bezoar (+RIGEN), Stilla di Felix Felicis (+COLPO FORTUNATO), Boccia dei Ricordi (+SCUDO iniziale).
**Non-Comuni (condizionali)**: Spada di Grifondoro (*il mago con più ATK: +30% danno sotto il 50% HP* → Esecuzione), Medaglione di Serpeverde (*+20% MAGIE OSCURE; -3 HP/turno*), Distintivo del Caposcuola (*sinergie di Casa contano +1 membro*).
**Rare (trigger)**: Mappa del Malandrino (*la carry schiva il primo colpo ogni turno*), Pugnale di Bellatrix (*ogni colpo applica 1 SANGUINAMENTO*), Calderone di Slughorn (*buff casuale iniziale al mago più adatto*).
**Epiche (cambia-regole)**: Giratempo (*il più lento agisce per primo*), Bacchetta di Sambuco (*magie d'Attacco senza cooldown; -3 HP/lancio*), Diadema di Corvonero (*VELOCITÀ>30 → COLPO FORTUNATO*), Coppa di Tassorosso (*RIGEN in eccesso → SCUDO permanente*), Penseatoio (*una resurrezione a 1 HP per battaglia*).
**Uniche/Leggendarie (build-defining, con costo)**: Horcrux (*un mago rinasce; maledice la run*), Fawkes (*resurrezione ogni battaglia; costo: sacrifica una reliquia*), Mantello dell'Invisibilità (*la carry intargettabile finché non agisce*), Diario di Tom Riddle (*potere enorme; a fine run un mago scompare*).

## Appendice B — Eventi (campionario, da espandere a decine)

*Comuni*: Bottega di Hogsmeade (shop narrativo), Allenamento nella Stanza delle Necessità (potenzia un mago, ne stanca un altro), Lettera di Hogwarts (recluta comune).
*Non-Comuni*: Il Cappello Parlante (ri-smista un mago → ri-rolla sinergie), Duello nei corridoi (élite opzionale, ricompensa alta), Pozione dubbia (buff o malus casuale).
*Rari*: La Foresta Proibita (Luna o imboscata), Magia Proibita (corruzione), La Stanza delle Necessità (offerta keyword-aware), Gringotts (rischia una reliquia per raddoppiarla).
*Iconici/Unici*: Il Sacrificio di Fawkes, Il Velo dei Misteri, I Frammenti dei Doni della Morte (questline), Il Patto col Dissennatore.

## Appendice C — Boss (roster proposto)

| Boss | Regola unica | Esame per |
|---|---|---|
| Dolores Umbridge | Vieta una keyword ogni 3 turni | build mono-keyword |
| I Dissennatori | Drenano HP/turno; buff dimezzati | build Crescendo/lente |
| Bellatrix | Uccide un mago → -20% ATK al resto | build fragili |
| Il Basilisco *(nascosto)* | Stunna la carry più veloce | build mono-carry |
| Nagini + Voldemort | Voldemort immortale finché Nagini vive | build single-target |
| Grindelwald *(segreto)* | Copia la tua sinergia più forte | build specializzate |

## Appendice D — Archetipi di Build (★ = faro Onda 1)

| Archetipo | Keyword core | Pezzi-chiave esistenti | Fantasia |
|---|---|---|---|
| ★ Veleno/Sanguinamento | VELENO | tratto Veleno, firma Bellatrix, Boccino, Pugnale | "li avveleno e guardo il timer" |
| ★ Scudi & Rigenerazione | SCUDO/RIGEN | Aegis, Benedizione, Coppa, Pietra | "non potete scalfirmi" |
| ★ Esecuzione | ESECUZIONE | tratto Esecuzione, firma Harry, Spada | "sotto il 30% siete morti" |
| ★ Magie Oscure | MAGIE OSCURE | Avada, Fiendfyre, firma Snape, Sambuco | "potere a ogni costo" |
| Colpo Fortunato | COLPO FORTUNATO | crit engine, Felix, Diadema | "un colpo, un'esecuzione" |
| Velocità/Catena | VELOCITÀ | Corvonero, Giratempo, Mappa | "agisco prima che tu respiri" |
| Controllo | CONTROLLO | 5 tratti CC, hard-CC status | "non giocate mai il vostro turno" |
| Rigen/Vampiro | RIGEN | Tassorosso, Bezoar, Rigenerazione | "logoramento infinito" |
| Sacrificio | SACRIFICIO | Vendetta, onAllyDeath, Horcrux | "le loro morti vi distruggeranno" |
| Evocazione *(nuovo)* | EVOCAZIONE | seme: Serpensortia, Patronus | "non combatto da solo" |
| Crescendo | CRESCENDO | Crescendo, Ferocia, Anticipo, firma Neville | "più dura, più vinco" |
| Difensiva | SCUDO/DEF | Grifondoro, Protego, Fianto Duri | "il muro che non cade" |

## Appendice E — Abilità-Firma dei maghi iconici (P0)

*Formato: Mago — "Firma": effetto (archetipo che abilita).*

- Harry — *"Tocco della Madre"*: alla prima morte sopravvive con 1 HP + ESECUZIONE potenziata 2 turni (★Esecuzione).
- Hermione — *"La Strega più Brillante"*: magie senza cooldown sul bersaglio giusto; +1 magia nel loadout (Controllo/Tecnica).
- Ron — *"Strategia a Scacchi"*: buffa la squadra in base agli alleati vivi (squadra piena).
- Snape — *"Principe Mezzosangue"*: Sectumsempra/Levicorpus potenziati; si cura infliggendo Magie Oscure (★Magie Oscure).
- Bellatrix — *"Crudeltà"*: colpi su bersagli danneggiati raddoppiano il SANGUINAMENTO (★Veleno) — *anche boss, P4*.
- Neville — *"Coraggio Tardivo"*: parte debole, accumula ATK/DEF permanenti; esplode sotto il 50% HP squadra (Crescendo).
- Luna — *"Vede l'Invisibile"*: ignora schivata/invisibilità; rivela i nascosti (counter anti-Mantello/Basilisco).
- McGonagall — *"Trasfigurazione"*: una volta per battaglia trasforma un nemico in oggetto inerte 1 turno (Controllo).
- Dumbledore *(leggendario)* — *"Ordine Superiore"*: una volta per battaglia annulla il turno del boss (cambia-regole).
- Voldemort *(boss/leggendario)* — *"L'Oscuro Signore"*: già scriptato (Avada/Fiendfyre forzati, +20% squadra).

---

## Note di metodo per la fase successiva

Documento di **direzione**, volutamente ampio — non ancora un piano implementabile. Il passo naturale successivo è portare **l'Onda 1 (P0 + P1 + P8)** nel flusso `brainstorming → spec dettagliata → writing-plans`: è la fondazione su cui tutto il resto si aggancia e cambia subito la sensazione del gioco. Dentro l'Onda 1, il sotto-ordine consigliato è: **keyword + 4 archetipi-faro** (linguaggio) → **abilità-firma** degli iconici (identità, si agganciano agli archetipi) → **loadout + drammatizzazione** (rendono il tutto giocabile e sentito).

Tutto il resto (P2–P7) diventa un backlog prioritizzato di spec successive, ciascuna piccola e auto-contenuta.
