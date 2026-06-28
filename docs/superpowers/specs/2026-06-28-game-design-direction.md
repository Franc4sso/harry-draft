# Game Design Direction — Harry Potter Team-Building Roguelite

> Documento di direzione creativa. **Nessuna implementazione** in questa fase.
> Prospettiva: Game Director di un indie che vuole diventare il riferimento dei roguelite di team-building nel mondo di Harry Potter.
> Data: 2026-06-28 · Stato codice: M6/M7 (Fase 1 roguelite mergiata, polish in corso).

---

## 0. La tesi di design (il Nord)

Abbiamo preso una decisione che vincola tutto il resto: **il combattimento resta auto-risolto** (deterministico, niente controllo turno-per-turno), potenziato da **leve pre-battaglia** e dalla **costruzione della build**.

Questa scelta non è una limitazione: è l'identità del gioco. Ma cambia *dove* nasce il divertimento. In un tattico manuale la WOW nasce dalla giocata; qui la WOW nasce **dal vedere la propria build esplodere da sola, come una macchina che hai costruito tu**. È il piacere di un Auto-battler / di un deck "che si gioca da solo" (pensa a *Slay the Spire* viste dal lato costruzione, o a *Backpack Battles* / *The Bazaar*): il giocatore è un **ingegnere di combo**, non un pilota.

Da qui tre conseguenze di design non negoziabili:

1. **Tutto il divertimento si sposta a monte e a valle della battaglia.** La battaglia è il *payoff*. Le decisioni interessanti stanno nella build (cosa porto) e nella run (cosa scelgo, cosa sacrifico). → I capitoli più ricchi di questo documento sono **Build**, **Reliquie**, **Eventi**, **Boss**.

2. **La battaglia deve essere DRAMMATIZZATA.** Se il giocatore guarda e basta, deve guardare qualcosa di spettacolare e leggibile: la catena di veleno che parte, il revive all'ultimo, il colpo che esegue il boss sotto il 30%. Auto-battle non vuol dire passivo. → Capitolo **Presentazione & Momenti WOW**.

3. **La leva pre-battaglia esiste già a metà ed è sprecata.** Ogni mago ha un `spellPool` di 5 magie ma l'engine ne sceglie alcune da solo. **Far scegliere al giocatore il loadout di magie è la singola leva di agency più potente compatibile con l'auto-battle**, ed è quasi gratis architetturalmente. È il primo moltiplicatore di build.

Domanda guida per ogni sistema, d'ora in poi:

> *"Questo fa nascere una build diversa, un momento da raccontare, o una decisione dolorosa? Se no, perché esiste?"*

---

## 1. Diagnosi onesta dello stato attuale

Cosa c'è di buono (da non rompere):

- **Engine di combattimento solido e a eventi.** EventBus con hook `onHit`, `onTurnStart`, `onAllyDeath`, `onHpThreshold`, `modifyOutgoingDamage`, ecc. È **già pronto a ospitare reliquie che cambiano le regole** — non lo sappiamo sfruttare.
- **I Tratti sono il pilastro più ricco** (17 tratti: Veleno, Esecuzione, Vendetta, Pietrificazione…). Sono già **keyword-shaped**: la spina dorsale del sistema di build è già qui, mascherata.
- **Roster ampio** (60 maghi) e **35 magie / 20 status** con buona varietà meccanica (hard CC, soft CC, DOT, scudi, buff a gradini).
- **Framework roguelite funzionante**: mappa a 3 aree × 5 piani, ramificazione, leveling win-based, persistenza.

Cosa tradisce la promessa "roguelite memorabile":

| Sintomo | Diagnosi |
|---|---|
| **Le sinergie sono solo numeri piatti** (+10 DEF, +22 ATK). | Le Case sono *l'unico* asse di build, e per giunta noioso. Non nasce nessuna "build Veleno". |
| **16 reliquie su 19 sono bastoni di statistiche.** | Nessuna reliquia "rompe il gioco". Trovarne una non è un momento. |
| **Eventi, Shop, Sala Comune, Foresta: catalogati ma VUOTI.** | Manca completamente il livello narrativo e delle decisioni dolorose. È il buco più grande. |
| **Un solo boss scriptato (Voldemort).** I boss d'area sono squadre random. | Nessun boss "cambia le regole", nessun "esame finale" per una build. |
| **Le scelte sono quasi tutte in upside** (prendi reliquia / recluta / skip). | Nessuna rinuncia. Nessun dolore. Nessuna storia di sacrificio. |
| **Zero meta-progressione.** Ogni run riparte da zero, senza sblocchi. | Manca il motore della retention ("ancora una partita"). |
| **La build emerge debolmente** da sinergie+tratti, ma non c'è un linguaggio comune che le faccia *impilare*. | Il giocatore pensa "sto usando Harry", non "sto giocando una build Sacrificio". |

**Conclusione**: l'ossatura tecnica è buona. Quello che manca è quasi tutto **contenuto e linguaggio di sistema** — ed è esattamente la parte che decide se un roguelite è memorabile. Buona notizia: gran parte è *data e testo* su un'architettura che già regge.

---

## 2. Roadmap prioritizzata — i Pilastri WOW

Ordinati per **(impatto sul divertimento) / (rischio)**. La logica della sequenza: prima il **linguaggio delle build** (P1), perché tutto il resto — reliquie, tratti, boss, eventi — vi si aggancia; poi i **contenuti che rompono il gioco e raccontano storie** (P2–P4); poi le **decisioni dolorose e le sorprese** che danno spessore (P5–P6); infine il **motore di retention** (P7) che ha senso solo quando c'è abbastanza contenuto da sbloccare. P8 (drammatizzazione) corre in parallelo perché è ciò che fa *sentire* tutto il resto.

| # | Pilastro | Cosa sblocca | Impatto | Complessità | Priorità |
|---|---|---|---|---|---|
| **P1** | **Sistema di Keyword & Archetipi di Build** | "build, non squadre"; fa impilare tutto | 🔥🔥🔥🔥🔥 | Media | **P0 — fondante** |
| **P2** | **Reliquie che rompono le regole** | momenti "questa reliquia cambia la run" | 🔥🔥🔥🔥🔥 | Media | **P0** |
| **P3** | **Eventi narrativi & nodi vivi** | storie, sorprese, reclute rare, dolore | 🔥🔥🔥🔥🔥 | Media (è dato/testo) | **P1** |
| **P4** | **Boss che cambiano le regole** | "esame finale" per ogni build | 🔥🔥🔥🔥 | Media | **P1** |
| **P5** | **Economia del Sacrificio & decisioni dolorose** | rinuncia, identità della run | 🔥🔥🔥🔥 | Media-bassa | **P1** |
| **P6** | **Livello Sorpresa & contenuti segreti** | "sorprendimi", ancora una partita | 🔥🔥🔥🔥 | Media | **P2** |
| **P7** | **Meta-progressione & sblocchi** | retention, "ancora una partita" | 🔥🔥🔥 | Alta | **P2** |
| **P8** | **Drammatizzazione della battaglia** | far *sentire* le WOW dell'auto-battle | 🔥🔥🔥🔥 | Media | **P1 (parallelo)** |

I capitoli 3–10 sviluppano ciascun pilastro. I capitoli 11+ coprono i sistemi rimanenti del brief, più leggeri, ordinati per priorità. L'Appendice A–D contiene contenuti concreti pronti a seminare l'implementazione.

---

## 3. P1 — Sistema di Keyword & Archetipi di Build *(fondante)*

### Il problema
Oggi una "build" è solo: 5 maghi + sinergie di Casa/Ruolo (bonus piatti) + qualche tratto + reliquie-statistica. Non esiste un **linguaggio comune** che faccia sì che un tratto, una magia, una reliquia e una sinergia parlino della *stessa cosa* e si **impilino** in un motore. Risultato: il giocatore ottimizza statistiche, non costruisce una macchina. Le Case sono l'unico asse identitario — esattamente ciò che il brief vuole evitare ("Le Case dovranno rappresentare solo *uno* dei tanti elementi").

### La soluzione: le Keyword come valuta di design
Introdurre un insieme di **Keyword meccaniche** (tag) che attraversano *tutti* i sistemi. Ogni magia, tratto, reliquia, status, sinergia ed evento è "taggato" con una o più keyword. Le reliquie e le sinergie smettono di dare "+X statistica" e iniziano a dire **"+X% a tutto ciò che è VELENO"** o **"quando applichi SANGUINAMENTO, fai anche…"**. È così che nasce la "build Veleno": perché veleno-tratto + veleno-relic + veleno-sinergia + veleno-detonatore si moltiplicano.

Keyword proposte (estensione diretta di ciò che già esiste in `traits.ts` / `statuses.ts`):

- **VELENO / SANGUINAMENTO** (DOT) — già: tratto Veleno, status burn/dot, reliquia Boccino d'Oro
- **CRITICO** — già nell'engine (`critBase`, `critMult`, scaling SPD)
- **VELOCITÀ / CATENA** (agire prima, agire due volte) — già: Corvonero, Giratempo
- **SCUDO / BARRIERA** — già: Aegis, status shield, tratto Benedizione, Pietra della Resurrezione
- **CONTROLLO** (stun/freeze/silence/disarm) — già: 5 tratti CC, 4 status hard-CC
- **RIGENERAZIONE / VAMPIRISMO** — già: Tassorosso, Bezoar, tratto Rigenerazione
- **ESECUZIONE** (danno extra sotto soglia HP) — già: tratto Esecuzione
- **SACRIFICIO** (payoff quando un alleato muore) — già: tratto Vendetta, hook `onAllyDeath`
- **MAGIE OSCURE** (alto rischio/alto danno: Avada, Fiendfyre, Crucio) — già: spell e gruppo Mangiamorte
- **EVOCAZIONE** (nuovo — vedi sotto) — seme: la spell "Serpensortia"
- **MOMENTUM / CRESCENDO** (buff che si accumulano ogni turno) — già: tratti Crescendo, Ferocia, Anticipo

### Tre meccaniche che trasformano keyword in *build*
1. **Scaling**: reliquie/sinergie che amplificano una keyword (es. *"il danno da VELENO è +60%"*, *"gli SCUDI durano +1 turno e assorbono +50%"*).
2. **Detonatori**: effetti che *consumano* uno stato per un payoff esplosivo (es. *"infliggi danno pari al doppio del VELENO residuo e azzeralo"*). I detonatori sono il cuore dei momenti WOW di una build a status: vedere 8 stack di sanguinamento detonare per 200 danni è la "macchina che esplode".
3. **Conversioni**: reliquie che convertono una keyword in un'altra (es. *"il 50% della RIGENERAZIONE diventa SCUDO"*, *"ogni VELOCITÀ in eccesso si converte in CRITICO"*) — abilitano build ibride e momenti "ho rotto il gioco".

### Le sinergie diventano motori, non bonus piatti
Riconvertire (o affiancare) le 30 sinergie attuali verso payoff *keyword-driven*:
- **Tassorosso** non dà più solo "+REGEN" → *"la RIGENERAZIONE eccedente diventa SCUDO"* (la Casa diventa l'asse della build Scudi-Rigen).
- **Serpeverde** → *"+15% danno da MAGIE OSCURE, ma -5 HP a inizio battaglia"* (rischio/identità).
- **Corvonero** → *"il primo mago agisce due volte nel primo turno"* (build Velocità/Catena).
- Aggiungere **sinergie di archetipo** (non di Casa/Ruolo): *3 maghi con keyword VELENO* → *"il VELENO può accumularsi all'infinito"*. Così la build esiste *anche senza* allineamento di Casa.

### Anti-sinergie & tensione (opzionale ma potente)
Alcune keyword si ostacolano: una build CONTROLLO che stunna nemici impedisce alla build ESECUZIONE di portarli sotto soglia abbastanza in fretta? Tensioni così rendono la costruzione una *decisione*, non un accumulo. Da dosare per non frustrare.

### Pro / Contro
- **Pro**: è il moltiplicatore che fa funzionare *tutto* il resto; trasforma "squadra" in "build"; aumenta enormemente la varietà di run; riusa tratti/status già esistenti.
- **Contro**: richiede un refactor del modello dati (taggare contenuti) e attenzione al bilanciamento (le combo possono esplodere — ma è *desiderabile* in un roguelite). Rischio di "sopra-ingegnerizzare": va tenuto un set di keyword limitato (~10–12).
- **Impatto rigiocabilità**: 🔥🔥🔥🔥🔥. È la differenza tra 5 run uguali e 50 run diverse.
- **Complessità**: Media. Il dato si tagga; l'engine a eventi regge già scaling/detonatori/conversioni via hook.

> **Archetipi obiettivo** (vedi Appendice D per i dettagli): Veleno, Critico, Velocità/Catena, Scudi, Controllo, Rigen/Vampiro, Esecuzione, Sacrificio, Magie Oscure, Evocazione, Momentum, Difensiva. Target di design: **almeno 8 archetipi vincenti e visibilmente diversi**.

---

## 4. P2 — Reliquie che rompono le regole *(P0)*

### Il problema
16/19 reliquie sono "+X statistica". Trovarne una **non è un momento**. Il brief è esplicito: *"Le reliquie devono rompere il gioco"*. La buona notizia: l'EventBus già supporta hook (la Pietra della Resurrezione fa già `onBattleStart → scudo`, il Boccino fa già `onHit → DOT`). L'architettura per reliquie che cambiano le regole **esiste già**: è sottoutilizzata.

### La soluzione: 4 classi di reliquia per rarità crescente
1. **Statistiche condizionali** (Comune/Non-Comune) — restano, ma agganciate alle keyword (vedi P1). *"+25% danno da VELENO."*
2. **Trigger reattivi** (Rara) — fanno qualcosa a un evento. *"Quando un alleato scende sotto il 30%, ottiene uno SCUDO da 40."*
3. **Cambia-regole** (Epica) — modificano le regole del combattimento: ordine dei turni, doppi cast, detonazioni, conversioni.
4. **Reliquie Uniche / Leggendarie** (nuova rarità) — definiscono *da sole* una build e arrivano spesso con un **costo** (le Reliquie del Sacrificio, vedi P5). Una per run, drop-evento o boss.

### Esempi che cambiano la run (estratto — lista completa in Appendice A)
- **Giratempo (rework)** — *Il mago più lento della tua squadra agisce per primo, ogni turno.* (Ribalta l'ordine: abilita build "tank che apre".)
- **Bacchetta di Sambuco (rework da +12% piatto)** — *Le tue magie di Attacco non vanno mai in cooldown, ma ogni volta che lanci, perdi 3 HP.* (Build Magie Oscure spam, con rischio.)
- **Penseatoio** — *All'inizio della battaglia, "ricordi" l'esito: il primo alleato che morirebbe questo turno sopravvive con 1 HP.* (Una resurrezione assicurata, una volta per battaglia.)
- **Mantello dell'Invisibilità** — *Il tuo mago più veloce non può essere bersagliato finché non agisce per la prima volta.* (Protegge la tua carry.)
- **Coppa di Tassorosso** — *Il 50% della RIGENERAZIONE che eccede gli HP massimi diventa SCUDO permanente.* (Reliquia-chiave della build Scudi-Rigen.)
- **Boccino d'Oro (rework)** — *Quando un nemico va sotto il 20% HP, il tuo Cercatore lo "afferra": esecuzione immediata, ma poi il Cercatore salta un turno.* (Detonatore di Esecuzione con costo.)
- **Diadema di Corvonero** — *Ogni punto VELOCITÀ sopra 30 si converte in +1% CRITICO.* (Reliquia di conversione: build Velocità→Critico.)
- **Horcrux** *(Unica)* — *Scegli un mago: alla sua morte, rinasce una volta con il 50% degli HP. Ma se sopravvive fino a fine run, la tua run è "maledetta" (vedi finale alternativo).* (Decisione + segreto narrativo.)

### Perché è divertente
Una reliquia cambia-regole è il momento *"oh, adesso gioco in modo diverso"*. È ciò che fa deviare una run: trovi il Giratempo-rework e improvvisamente i tank lenti diventano la tua wincon. È esattamente lo "story beat" che il brief vuole: *"Ho cambiato completamente build dopo aver trovato la Bacchetta di Sambuco."*

### Pro / Contro
- **Pro**: alto WOW per unità di lavoro (l'engine regge); ogni reliquia rara/epica è un potenziale punto di svolta; sinergia diretta con P1.
- **Contro**: bilanciamento (alcune romperanno le run — *accettabile e voluto*, va solo evitato il "win istantaneo" non interessante); serve UI che spieghi bene effetti complessi.
- **Impatto rigiocabilità**: 🔥🔥🔥🔥🔥.
- **Complessità**: Media. Le cambia-regole più ambiziose (ordine turni) toccano `simulate.ts`, ma in modo localizzato.

---

## 5. P3 — Eventi narrativi & nodi vivi *(P1)*

### Il problema
I nodi `event`, `shop`, `commonRoom`, `library`, `potions`, `forest` sono **catalogati ma vuoti**. Manca tutto il livello che il brief chiama *"uno degli elementi più memorabili della run"*. Senza eventi, la run è solo: combatti → premio → combatti. Niente storie, niente sorprese, niente reclute rare, niente decisioni dolorose.

### La soluzione: un sistema di eventi a storie + conseguenze
Ogni evento ha: **ambientazione**, **testo narrativo**, **scelte (2–4)**, **rischio**, **ricompensa**, e **sviluppi futuri** (flag che possono far ricomparire un NPC, sbloccare un evento successivo, o tingere il finale). Classificati per rarità (comune / non-comune / raro / iconico-unico).

Principi:
- **Ogni scelta ha una rinuncia o un rischio.** Mai "premio gratis". Anche "non fare nulla" è una scelta con un costo-opportunità.
- **Gli eventi sono il canale delle reclute rare e dei segreti.** Luna nella Foresta Proibita. Fawkes come ricompensa di sacrificio. Una magia proibita offerta da uno sconosciuto.
- **Conseguenze ritardate.** Salvi un personaggio in area 1 → ricompare in area 3 per ripagarti (o tradirti). Questo crea le storie da raccontare.
- **Catene di eventi (questline).** Una linea narrativa minore (es. "i frammenti dei Doni della Morte") che si sviluppa lungo la run e culmina in un payoff raro.

### Esempi iconici (estratto — decine in Appendice B)
- **La Foresta Proibita** *(raro)* — *Senti un canto tra gli alberi.* → [Seguilo: 50% recluti **Luna** (rara), 50% imboscata di Acromantule (battaglia élite)] / [Ignora: prosegui sicuro, +1 reliquia comune]. *Sviluppo*: se recluti Luna, sblocca più avanti l'evento "I Thestral".
- **Il Patto col Cappello Parlante** *(non-comune)* — *Il Cappello ti offre di "ri-smistare" un mago.* → cambia la Casa di un membro (ri-rolla le sinergie) — *ad alto rischio per la tua build*.
- **La Stanza delle Necessità** *(raro)* — *La porta appare solo a chi ne ha davvero bisogno.* → la stanza ti offre *esattamente* ciò che manca alla tua build (offerta keyword-aware): una reliquia dell'archetipo che stai costruendo. Momento WOW di "completamento sinergia".
- **Magia Proibita** *(raro)* — *Una voce ti insegna l'Avada Kedavra.* → [Accetta: un mago ottiene una Magia Oscura potentissima ma diventa "Corrotto" (malus permanente, vedi P5)] / [Rifiuta].
- **Il Sacrificio di Fawkes** *(iconico)* — *La fenice ti guarda.* → [Sacrifica una reliquia: ottieni **Fawkes**, che resuscita un alleato la prima volta che muore, ogni battaglia] / [Lascia andare]. Esattamente lo story beat del brief.
- **Il Velo del Dipartimento dei Misteri** *(iconico, raro)* — *Oltre il Velo si sente una voce familiare.* → [Attraversa: perdi un mago **per sempre**, ma ottieni una Reliquia Unica leggendaria] / [Resta]. Decisione dolorosa pura.

### Pro / Contro
- **Pro**: enorme densità di WOW e di storie emergenti per unità di lavoro (è **dato e testo** su un framework di nodi che già esiste); è la fonte numero uno del "racconta la tua run"; scala all'infinito (puoi aggiungerne in eterno).
- **Contro**: serve scrittura di qualità (il testo *è* il prodotto qui); serve un piccolo motore di flag/condizioni per gli sviluppi ritardati; rischio di eventi "puro testo senza peso" se le scelte non mordono.
- **Impatto rigiocabilità**: 🔥🔥🔥🔥🔥.
- **Complessità**: Media. La sfida è il *contenuto* e il sistema di flag, non l'architettura.

---

## 6. P4 — Boss che cambiano le regole *(P1)*

### Il problema
C'è un solo boss scriptato (Voldemort, con `forcedSpells` + `exclusiveSynergy`). I boss d'area sono squadre random scalate a budget. Un boss che è solo "stessi nemici ma più forti" non è un esame: è una parete di HP. Il brief vuole boss che **costringano a cambiare strategia** e siano *"l'esame finale per una particolare tipologia di build"*.

### La soluzione: roster di boss scriptati, ognuno una regola
Generalizzare il meccanismo già usato per Voldemort (`exclusiveSynergy`, `forcedSpellIds`, `hpMult`) in un **roster di boss con una regola unica ciascuna**, più **fasi** (il boss cambia comportamento sotto soglia HP — l'hook `onHpThreshold` esiste già). Ogni boss è progettato come **counter di un archetipo**, così la difficoltà è *educativa*: ti insegna i limiti della tua build.

### Esempi (lista in Appendice C)
- **Dolores Umbridge** — *"Decreti Educativi": ogni 3 turni vieta una keyword a caso della tua squadra per 2 turni* (es. blocca il VELENO). Esame per build mono-keyword. Costringe a diversificare.
- **I Dissennatori** *(incontro)* — *Drenano: ogni turno la tua squadra perde l'1% degli HP max e i buff durano metà.* Esame per build Momentum/Buff lente. Premia il burst e la Felicità (un buff "Patronus" che li respinge → mini-puzzle).
- **Bellatrix Lestrange** — *"Tortura": quando uccide un tuo mago, infligge -20% ATK permanente al resto della squadra per il resto della battaglia.* Esame per build fragili/Sacrificio mal gestite. (Il brief la cita: *"Bellatrix ha eliminato metà della mia squadra."*)
- **Il Basilisco** *(nascosto)* — *Sguardo Pietrificante: il tuo mago più veloce viene stunnato a inizio battaglia ogni 2 turni.* Esame per build Velocità mono-carry. Counter: avere un secondo damage dealer o il Gallo (item segreto).
- **Nagini + Voldemort (fase finale)** — *Finché Nagini (Horcrux) è viva, Voldemort non può morire.* Cambia la condizione di vittoria: devi gestire le priorità di target. Esame per build single-target vs AoE/controllo.
- **Grindelwald** *(boss alternativo, ramo di mappa segreto)* — *"Per il Bene Superiore": copia la sinergia di archetipo più forte della tua squadra e la usa contro di te.* Specchio: la tua build diventa la sua arma.

### Fasi & cambi di ritmo
Usare `onHpThreshold` per **seconde fasi**: a metà HP il boss evoca add, cambia loadout, o attiva una nuova regola. Il cambio di ritmo è ciò che rende un boss un *evento* e non un muro.

### Pro / Contro
- **Pro**: ogni boss è un picco drammatico e un "esame" che dà senso alla costruzione della build; alta memorabilità; riusa meccaniche già esistenti.
- **Contro**: ogni boss va bilanciato singolarmente (no formula unica); rischio di regole "ingiuste" se il giocatore non ha modo di prevederle → serve **telegrafia** (mostrare la regola del boss *prima* della battaglia, così la scelta build è informata).
- **Impatto rigiocabilità**: 🔥🔥🔥🔥. Spinge a costruire build diverse per battere boss diversi.
- **Complessità**: Media.

---

## 7. P5 — Economia del Sacrificio & decisioni dolorose *(P1)*

### Il problema
Quasi ogni scelta è in **upside**: prendi una reliquia, recluta un mago, oppure skippa. Niente fa *male*. Il brief vuole *"decisioni dolorose"*, dove *"ogni scelta dovrebbe comportare una rinuncia"*. Senza costo, non c'è peso, e senza peso non c'è storia.

### La soluzione: introdurre il costo come meccanica trasversale
- **Reliquie del Sacrificio**: le più potenti (Uniche/Leggendarie) costano qualcosa — un mago, una reliquia, HP massimi permanenti, o un **malus permanente di run**. *"Ottieni Fawkes (resurrezione) → sacrifica una reliquia."*
- **Corruzione**: accettare Magie Oscure rende un mago "Corrotto": potentissimo ma con un malus (es. perde HP ogni turno, o non può essere curato). Build Magie Oscure = build ad alto rischio *per design*.
- **Élite opzionali ad alto rischio**: nodi élite che il giocatore *sceglie* di affrontare per una ricompensa sproporzionata (reliquia epica garantita) — ma con nemici che possono devastare la squadra. Rischio reale, ricompensa reale.
- **Il dilemma della panchina**: quando recluti a squadra piena, sostituire un membro *amato e potenziato* (alto livello) con uno nuovo è già una decisione dolorosa — va **enfatizzata** dalla UI (mostra cosa perdi: livello, sinergie, storia).
- **Patti & maledizioni**: eventi che offrono potere in cambio di una condizione che pesa sul resto della run ("d'ora in poi i boss hanno +1 fase, ma ogni reliquia è di una rarità più alta").

### Esempi
- **Il Voto Infrangibile** — *Giura di non reclutare più nessuno per il resto della run → la tua squadra attuale ottiene +20% a tutto.* (Build "i pochi, i fieri".)
- **Il Diario di Tom Riddle** — *Reliquia: potentissima, ma ogni battaglia "scrive" e a fine run un tuo mago a caso "scompare".* (Costo ritardato e angosciante.)
- **La Pietra della Resurrezione (rework)** — *Riporta in vita un mago caduto in una run precedente (meta!) per una battaglia, poi svanisce.* (Vedi P7, ponte col meta.)

### Pro / Contro
- **Pro**: dà peso e identità alla run; genera storie ("ho sacrificato X per Y"); crea tensione decisionale, il cuore del genere.
- **Contro**: rischio di frustrazione se i costi sono opachi o ingiusti → i costi devono essere **sempre chiari prima della scelta**; va calibrato per non punire troppo il giocatore casual.
- **Impatto rigiocabilità**: 🔥🔥🔥🔥. Le decisioni dolorose sono ciò che si ricorda.
- **Complessità**: Media-bassa (molto è dato/flag), tranne la "Corruzione" che tocca lo stato del mago.

---

## 8. P6 — Livello Sorpresa & contenuti segreti *(P2)*

### Il problema
Una run è prevedibile: 3 aree, stessa struttura, stesso pool. Manca il *"sorprendimi"*: l'incontro improbabile, il boss nascosto, la mappa alternativa, l'evento che cambia tutto.

### La soluzione: stratificare rarità e segreti
- **Reclute leggendarie rarissime** (Dumbledore, Merlino?) via eventi a bassissima probabilità o condizioni segrete ("hai 4 Corvonero a fine area 2 → appare un evento unico").
- **Boss nascosti & rami di mappa alternativi**: una biforcazione che porta a un'area opzionale (la Camera dei Segreti, il Ministero) con regole proprie e un boss segreto (Basilisco, Grindelwald).
- **I Doni della Morte (questline-collezione)**: tre frammenti sparsi in eventi rari lungo la run. Collezionarli tutti → trasformazione (la build diventa "Padrone della Morte": l'Horcrux, la Bacchetta e il Mantello uniti = finale alternativo). Lo story beat definitivo.
- **Eventi che ribaltano la run**: rarissimi, cambiano le regole *per il resto della partita* ("Time-Turner catastrofico: riavvii l'area corrente, ma tieni i livelli").
- **Mappe a tema** (in futuro): run con seed "speciali" che cambiano l'ambientazione e il pool (run "Era dei Malandrini", run "Prima Guerra dei Maghi").

### Pro / Contro
- **Pro**: è il motore del *"ancora una partita"*; ogni segreto scoperto è una storia e una ragione per rigiocare; crea passaparola ("sapevi che esiste un boss nascosto?").
- **Contro**: contenuto a bassa frequenza di utilizzo (costoso per ora-giocata vista); rischio di sembrare "vuoto" se mal segnalato — meglio pochi segreti *ben fatti* che molti diluiti.
- **Impatto rigiocabilità**: 🔥🔥🔥🔥.
- **Complessità**: Media (rami di mappa toccano il generatore; il resto è dato/flag).

---

## 9. P7 — Meta-progressione & sblocchi *(P2)*

### Il problema
**Zero persistenza tra run.** Ogni partita riparte identica. Manca il motore psicologico della retention: la sensazione di *progredire anche quando perdi*, e di *sbloccare* contenuto che alimenta la curiosità.

### La soluzione: una meta-progressione "a scoperta", non "a potere"
Attenzione: in un roguelite la meta-progressione **a potere** (diventi permanentemente più forte) erode la sfida. Preferire una meta-progressione **a varietà/scoperta**:
- **Codex / Cioccorane**: sblocchi maghi, reliquie, eventi che entrano nel *pool* delle run future (più varietà, non più potere). Vedere "3/60 maghi sbloccati" è un gancio fortissimo.
- **Ascensione / Livelli di Oscurità** (alla *Slay the Spire*): dopo la prima vittoria, sblocchi modificatori di difficoltà crescente. Il vero endgame.
- **Sfide / Imprese**: "vinci con una build Veleno", "completa una run senza reclutare" → sbloccano contenuto e danno obiettivi auto-imposti.
- **Reliquie meta-narrative**: la Pietra della Resurrezione che richiama un mago caduto in una *run precedente* (ponte emotivo tra partite).
- **Daily Run** (seed condiviso): tutti giocano lo stesso seed → competizione e confronto. Bassa-media complessità, alta retention.

### Pro / Contro
- **Pro**: è ciò che trasforma "un bel gioco" in "non riesco a smettere"; dà senso alle sconfitte; struttura l'endgame.
- **Contro**: è il pilastro **più costoso** (richiede persistenza, UI di sblocco, e — soprattutto — *abbastanza contenuto da sbloccare*, motivo per cui viene dopo P1–P6); la meta a potere va evitata per non rompere il bilanciamento.
- **Impatto rigiocabilità**: 🔥🔥🔥 sul singolo, 🔥🔥🔥🔥🔥 sulla retention a lungo termine.
- **Complessità**: Alta.

---

## 10. P8 — Drammatizzazione della battaglia *(P1, parallelo)*

### Il problema
In auto-battle il giocatore **guarda**. Se guarda una barra che scende, è noia. Se guarda la propria macchina-build esplodere, è estasi. Oggi la battaglia comunica poco *perché* sta succedendo qualcosa.

### La soluzione: rendere leggibile e spettacolare il payoff della build
- **Callout di combo**: quando una keyword/sinergia/tratto si attiva, mostralo a schermo ("VELENO ×8!", "ESECUZIONE!", "Fawkes risorge Harry!"). Il giocatore deve *vedere* la sua build funzionare.
- **Kill-cam / beat drammatici**: pausa breve + enfasi sul colpo che uccide il boss, sul revive all'ultimo, sulla detonazione.
- **Loadout pre-battaglia** (la leva di agency scelta): schermata dove il giocatore cura le magie di ogni mago dal `spellPool` (5→loadout), imposta una tattica/formazione, e decide eventuali innesco pre-battaglia. **Questa è la decisione che il giocatore prende — e poi guarda il risultato.** È il cuore dell'agency in auto-battle.
- **MVP & recap memorabile**: a fine battaglia, evidenzia il momento chiave ("Hermione: 3 esecuzioni, 240 danni"). Alimenta il "racconta la tua run".
- **Velocità & controllo di replay**: poter accelerare/rivedere; rende l'osservazione attiva.

### Pro / Contro
- **Pro**: trasforma il punto debole dell'auto-battle (passività) nel suo punto di forza (spettacolo); è ciò che fa *sentire* tutto il lavoro di P1–P6; il loadout dà agency reale senza riscrivere il combattimento.
- **Contro**: lavoro di UI/UX e di feedback visivo, non triviale; rischio di rallentare il ritmo se gli effetti sono troppi → servono priorità visive.
- **Impatto rigiocabilità**: 🔥🔥🔥🔥 (indiretto ma cruciale: senza, le build non emozionano).
- **Complessità**: Media.

---

## 11. Analisi dei sistemi rimanenti (per priorità)

Copertura sintetica dei punti del brief non già assorbiti dai pilastri. Per ognuno: problema → direzione → priorità.

**Core Gameplay Loop** — *Buono ma piatto a metà.* La spina (mappa → nodo → battaglia → premio) regge. Manca il *ritmo emotivo*: alternare tensione (élite/boss) e respiro (eventi/sala comune). Direzione: orchestrare la curva emotiva, non solo quella di difficoltà. **P1.**

**Progressione della Run** — Il leveling win-based (+1/+2/+3) è elegante. Aggiungere **scelte di crescita** ai milestone (già previsto in spec, non implementato): a livello 3/6/9 il giocatore sceglie un potenziamento *keyword-aware* (mini-decisione di build per mago). **P1.**

**Sistema della Mappa** — Buono (ramificazione nearest-2, stile StS). Aggiungere **leggibilità delle ricompense** (vedere cosa offre un nodo) e **rami alternativi/segreti** (P6). Le scelte di percorso devono essere informate e dolorose (élite ricca vs sicurezza). **P2.**

**Sistema dei Nodi** — Metà dei tipi è vuota (P3). Priorità: riempire `event`, poi `commonRoom` (riposo/cura = respiro + mini-scelta), poi `shop` (economia). **P1.**

**Sistema del Reclutamento** — Funziona, ma è un menù. Renderlo narrativo (reclute via evento, reclute rare, reclute a costo — P3/P5) e **keyword-aware** (a volte offre un mago che *completa la tua build*, momento WOW). **P1.**

**Sistema delle Magie** — Buona varietà (35). Sotto-sfruttato: il `spellPool` di 5 dovrebbe essere **scelto dal giocatore** (loadout, P8) — è il più grande moltiplicatore di build già presente. Aggiungere **upgrade di magie** (nodo `library`): potenziare una magia è una decisione di build. **P1.**

**Sistema delle Sinergie** — Da convertire in motori keyword (P1). Aggiungere sinergie di archetipo e anti-sinergie. **P0 (parte di P1).**

**Sistema degli Status** — Buono (20). Sotto-sfruttato: mancano **detonatori** e **interazioni tra status** (P1). Uno status oggi è un timer; deve diventare *carburante* per un payoff. **P1.**

**Battle Engine** — Solido. Estensioni richieste dai pilastri: hook per detonatori/conversioni (P1), regole-boss e fasi (P4), reliquie cambia-regole (P2). Niente riscrittura: estensioni mirate via EventBus. **P1.**

**Bilanciamento della Difficoltà** — Win rate ~21.7% calibrata su gioco quasi-ottimo. Con build-diversity (P1) il bilanciamento va ripensato **per archetipo** (ogni build deve avere una curva giocabile) e reso **build-aware** (i boss-counter di P4 sono il regolatore naturale). L'Ascensione (P7) è la valvola per i veterani. **P2.**

**Progressione Permanente** — Vedi P7. **P2.**

**Sistema di Sblocco dei Contenuti** — Vedi P7 (Codex/Imprese). **P2.**

**Endgame** — Oggi inesistente (vinci → "Nuova run"). L'endgame è l'**Ascensione** (P7) + le **build da padroneggiare** (P1) + i **segreti da scoprire** (P6) + le **Imprese** (P7). **P2.**

**Modalità Alternative** — Daily Run (P7, alto ROI), poi run a tema/seed speciali (P6), poi sfide. Niente PvP per ora (YAGNI). **P3.**

**Replayability** — È la *somma* di P1 (build diverse) + P3/P6 (contenuto e segreti) + P7 (sblocchi/ascensione). Non è un sistema a sé: è l'effetto. **—**

**Psicologia del giocatore** — Sfruttare: scoperta (Codex), padronanza (Ascensione), narrazione (eventi), near-miss (sconfitte che insegnano), variabilità (drop). Evitare: la meta a potere che banalizza, i costi opachi che frustrano. **Trasversale.**

**Retention** — Ganci: "una build che non ho ancora provato", "un segreto che non ho trovato", "la prossima Ascensione", "la Daily di oggi". Vedi P7. **Trasversale.**

**Cosa rende una run memorabile** — Una **build identitaria** (P1) + una **decisione dolorosa** (P5) + un **momento WOW visibile** (P8) + una **sorpresa** (P6). I quattro pilastri convergono qui. **—**

**Cosa rende "ancora una partita"** — Curiosità non risolta + progresso percepito + varietà che non si esaurisce. P1 + P6 + P7. **—**

---

## 12. Sequenza consigliata di lavorazione

Non è un piano di implementazione (quello verrà dopo, con `writing-plans`), ma l'ordine logico:

1. **Onda 1 — Il linguaggio (P1) + il payoff visibile (P8 loadout & callout).** Senza keyword, niente build; senza drammatizzazione, le build non emozionano. Questi due insieme cambiano *immediatamente* la sensazione del gioco.
2. **Onda 2 — Contenuto che rompe e racconta (P2 reliquie + P3 eventi + P4 boss).** Si agganciano tutti a P1. È l'onda che riempie il gioco di momenti.
3. **Onda 3 — Peso & sorpresa (P5 sacrificio + P6 segreti).** Danno spessore e profondità di scoperta.
4. **Onda 4 — Retention (P7 meta/ascensione/daily).** Ha senso solo ora che c'è contenuto da sbloccare e padroneggiare.

Ogni onda è già *giocabile e migliore* della precedente: si può rilasciare e testare in modo incrementale.

---

## Appendice A — Reliquie (campionario per rarità)

*Formato: Nome — Effetto (keyword/build abilitata).*

**Comuni (statistiche, ma keyword-aware)**
- Bezoar — +RIGEN squadra (Rigen).
- Stilla di Felix Felicis — +5% CRITICO squadra (Critico).
- Boccia dei Ricordi — +SCUDO iniziale (Scudi).

**Non-Comuni (condizionali)**
- Spada di Grifondoro — *Il tuo mago con più ATK infligge +30% danno se sotto il 50% HP* (Esecuzione/Furia).
- Medaglione di Serpeverde — *+20% danno da MAGIE OSCURE; -3 HP/turno al portatore* (Magie Oscure, rischio).
- Distintivo del Caposcuola — *Le tue sinergie di Casa contano come +1 membro* (qualsiasi build di Casa).

**Rare (trigger reattivi)**
- Mappa del Malandrino — *Vedi l'azione dei nemici: il tuo mago più veloce schiva il primo colpo ogni turno* (Velocità).
- Pugnale di Bellatrix — *Ogni colpo applica 1 stack di SANGUINAMENTO* (Veleno).
- Calderone di Slughorn — *Inizio battaglia: applica un buff casuale al mago più adatto* (varietà).

**Epiche (cambia-regole)**
- Giratempo — *Il mago più lento agisce per primo.*
- Bacchetta di Sambuco — *Le magie d'Attacco non vanno in cooldown; -3 HP per lancio.*
- Diadema di Corvonero — *VELOCITÀ oltre 30 → CRITICO.*
- Coppa di Tassorosso — *RIGEN in eccesso → SCUDO permanente.*
- Penseatoio — *Una resurrezione a 1 HP per battaglia.*

**Uniche / Leggendarie (definiscono una build, spesso con costo — vedi P5)**
- Horcrux — *Un mago rinasce una volta; ma "maledice" la run.*
- Fawkes — *Resuscita un alleato la prima volta che muore, ogni battaglia* (costo: sacrifica una reliquia all'ottenimento).
- Mantello dell'Invisibilità — *La tua carry è intargettabile finché non agisce.*
- Diario di Tom Riddle — *Potere enorme; a fine run un mago "scompare".*

## Appendice B — Eventi (campionario, da espandere a decine)

*Comuni*: Bottega di Hogsmeade (shop narrativo), Allenamento nella Stanza delle Necessità (potenzia un mago, ne stanca un altro), Lettera di Hogwarts (recluta comune).
*Non-Comuni*: Il Cappello Parlante (ri-smista un mago), Duello nei corridoi (élite opzionale, ricompensa alta), Pozione dubbia (buff o malus casuale).
*Rari*: La Foresta Proibita (Luna o imboscata), Magia Proibita (corruzione), La Stanza delle Necessità (offerta keyword-aware), Gringotts (rischia una reliquia per raddoppiarla).
*Iconici/Unici*: Il Sacrificio di Fawkes, Il Velo dei Misteri, I Frammenti dei Doni della Morte (questline), Il Patto col Dissennatore.

## Appendice C — Boss (roster proposto)

| Boss | Regola unica | Esame per |
|---|---|---|
| Dolores Umbridge | Vieta una keyword ogni 3 turni | build mono-keyword |
| I Dissennatori | Drenano HP/turno; buff dimezzati | build Momentum/lente |
| Bellatrix | Uccide un mago → -20% ATK al resto | build fragili |
| Il Basilisco *(nascosto)* | Stunna la carry più veloce | build mono-carry |
| Nagini + Voldemort | Voldemort immortale finché Nagini vive | build single-target |
| Grindelwald *(segreto)* | Copia la tua sinergia più forte | qualsiasi build "specializzata" |

## Appendice D — Archetipi di Build (target ≥8 vincenti)

| Archetipo | Keyword core | Pezzi-chiave esistenti | Fantasia |
|---|---|---|---|
| Veleno/Sanguinamento | VELENO | tratto Veleno, Boccino, Pugnale di Bellatrix | "li avveleno e guardo il timer" |
| Critico | CRITICO | crit engine, Felix, Diadema | "un colpo, un'esecuzione" |
| Velocità/Catena | VELOCITÀ | Corvonero, Giratempo, Mappa | "agisco prima che tu respiri" |
| Scudi/Barriera | SCUDO | Aegis, Benedizione, Coppa, Pietra | "non potete scalfirmi" |
| Controllo | CONTROLLO | 5 tratti CC, hard-CC status | "non giocate mai il vostro turno" |
| Rigen/Vampiro | RIGEN | Tassorosso, Bezoar, Rigenerazione | "logoramento infinito" |
| Esecuzione | ESECUZIONE | tratto Esecuzione, Spada | "sotto il 30% siete morti" |
| Sacrificio | SACRIFICIO | Vendetta, onAllyDeath, Horcrux | "le loro morti vi distruggeranno" |
| Magie Oscure | MAGIE OSCURE | Avada, Fiendfyre, Mangiamorte, Sambuco | "potere a ogni costo" |
| Evocazione *(nuovo)* | EVOCAZIONE | seme: Serpensortia, Patronus | "non combatto da solo" |
| Momentum | MOMENTUM | Crescendo, Ferocia, Anticipo | "più dura, più vinco" |
| Difensiva | SCUDO/DEF | Grifondoro, Protego, Fianto Duri | "il muro che non cade" |

---

## Note di metodo per la fase successiva

Questo è un documento di **direzione**, volutamente ampio. Non è ancora un piano implementabile. Il passo naturale successivo è scegliere **l'Onda 1 (P1 + P8-loadout)** e portarla nel flusso `brainstorming → spec dettagliata → writing-plans`, perché è la fondazione su cui tutto il resto si aggancia e perché cambia subito la sensazione del gioco.

Tutto il resto (P2–P7) diventa un backlog prioritizzato di spec successive, ciascuna piccola e auto-contenuta.
