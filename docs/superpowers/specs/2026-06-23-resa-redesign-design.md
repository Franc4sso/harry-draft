# Redesign "La Resa" — Identità visiva, Draft leggibile, Battaglia animata

**Data:** 2026-06-23
**Tipo:** Redesign UI/UX + arte + correzioni di game design mirate.
**Riferimento:** estende `2026-06-22-harry-draft-design.md`. Sostituisce di fatto lo stile visivo attuale.
**Stato:** in revisione (brainstorm validato con mockup nel companion visivo).

---

## 1. Problema

Il gioco è completo e testato ma la *resa* è "banale" e poco leggibile. In particolare:

- **Draft**: si vedono le statistiche ma non a quali **categorie/sinergie** è affiliato un mago; non si vede **chi è già stato preso**; non si vede **cosa fanno** le sinergie.
- **Card**: la rarità è solo un tag testuale; un leggendario non *sembra* valere di più.
- **Battaglia**: è un log che scorre — non si capisce **cosa succede**, chi colpisce chi, perché uno agisce prima.
- **Personaggi**: rappresentati da quadratini con una lettera.
- **Boss**: nell'ultimo stage Voldemort **non compare mai** (bug, vedi §7).
- **Bilanciamento**: i tier alti sono esponenzialmente forti → si pescano sempre leggendari/epici, le sinergie non hanno valore percepito.

La priorità esplicita dell'utente è la **resa** (look + leggibilità), non il tuning di difficoltà.

## 2. Obiettivo

Una direzione visiva e di interazione coerente che attraversa **draft → battaglia**, dove ogni informazione importante **si vede e si capisce**, con arte vera per i personaggi. Le correzioni di gameplay sono incluse come *minimo necessario* a supporto della resa (boss reale, sinergie impattanti e visibili), non come focus.

Tutto resta: **mobile-first**, deterministico (replay/seed), TypeScript strict, e non deve rompere la suite esistente (335 test).

---

## 3. Identità visiva — "Notturno di Hogwarts"

Direzione scelta tra tre proposte (Grimorio / Neon / Notturno).

- **Palette**: mezzanotte (`#0a0813`/`#0c0a16`) e blu notte (`#161d33`/`#1b2440`); accenti **oro candela** (`#b08d57`/`#caa24a`/`#f3e6a0`) e **viola arcano** (`#7c3aed`/`#a855f7`); colori delle case come accento contestuale (Grifondoro rosso/oro, Serpeverde verde, Corvonero blu, Tassorosso giallo).
- **Tipografia**: serif da display (stile Palatino/Book Antiqua) per nomi e titoli; sans per dati densi se serve leggibilità.
- **Texture/profondità**: gradienti radiali "vetrata", leggera trama diagonale, ombre interne, glow morbidi, frame gotici.
- **Implementazione**: token CSS/Tailwind v4 `@theme` centralizzati (un solo punto di verità per colori/raggi/ombre). Le schermate consumano i token, niente colori hardcoded sparsi.

## 4. Sistema rarità — il valore si *vede*

Quattro livelli con escalation visiva crescente (oltre al tag):

| Rarità | Cornice | Aura/Glow | Sfondo | Gemma | Extra |
|---|---|---|---|---|---|
| Comune | grigia sottile | nessuno | piatto/spento | grigia | — |
| Raro | accento blu | glow leggero | leggermente ricco | blu lucida | — |
| Epico | viola | glow medio, nome che brilla | ricco viola | viola luminosa | — |
| Leggendario | **oro animato (shimmer)** | aura **pulsante** | più ricco | oro luminosa | **corona** + nome con bagliore |

- Un componente `RarityFrame` (o estensione di `WizardCard`) mappa la rarità → trattamento, riusato da card del draft e busti di battaglia.
- Le rarità derivano dal **tier** esistente (T1=Leggendario … T4=Comune). Etichette capitalizzate coerenti col Compendio.

## 5. Personaggi — arte vera (Formato A: ritratto-bust)

- **Un ritratto originale per mago**, riusato:
  - **Card draft**: ritratto intero in alto con sfumatura verso il basso per nome/stat.
  - **Battaglia**: stesso ritratto **ritagliato sul volto** dentro la cornice di rarità (aura verde quando il mago agisce, rosso quando è bersaglio).
- **Stile**: semi-pittorico "carta da gioco", coerente col Notturno (mantello casa, bacchetta, sfondo gotico/candele). Validato con un ritratto di prova generato.
- **Arte originale**, niente somiglianze di persone reali. Generazione via il generatore immagini (un asset per personaggio); pipeline: prompt per casa/ruolo → genera 4:5/3:4 → salva in `public/portraits/<id>.webp`.
- **Stemmi delle case**: icone **SVG** (non emoji) per Grifondoro/Serpeverde/Corvonero/Tassorosso, riusate ovunque (chip, ritratto, busto).
- **Fallback**: se manca un ritratto, silhouette stilizzata nei colori della casa (nessun crash, degradazione elegante).
- **L'arte non blocca la feature**: la generazione dei ritratti per l'intero roster è un **batch incrementale** (un asset per mago, salvati in `public/portraits/`). Tutta la UI funziona col fallback fin da subito; i ritratti si aggiungono mano a mano senza modifiche al codice (lookup per `id`).
- **Performance**: immagini ottimizzate (webp, dimensioni contenute), lazy-load fuori viewport.

## 6. Draft — mobile-first, leggibile

**Layout**
- **Mobile**: colonna unica scrollabile. **Header fisso** con (a) avatar dei **maghi già presi** + slot vuoti, (b) **pill delle sinergie** (colpo d'occhio). **Pannello sinergie** ancorato in basso, espandibile per i dettagli.
- **Desktop**: stesso contenuto in **3 colonne** — Squadra | Candidati | Sinergie.

**Card candidato — statistiche piene**
- HP / ATK / DIF / VEL con **numero + barra**, la magia (nome + effetto breve), e i **chip di affiliazione** (casa/ruolo/gruppo).
- I chip che corrispondono a una sinergia **che questo pick farebbe avanzare** sono evidenziati ("hot", oro acceso).

**Tracker sinergie — stato vs anteprima** (chiarito con l'utente)
- Di default mostra le sinergie della **squadra ATTUALE**: nome, **conteggio/soglia** (es. 1/3), barra di avanzamento, e **cosa fanno** (es. "+20 DIF a tutta la squadra").
- **Al tocco/hover su un candidato** entra in **anteprima**: mostra il risultato **proiettato** con la freccia (es. *Grifondoro 1 → 2*), evidenziando il +1; niente si conferma finché non si preme "Pesca".
- Quando un pick **raggiunge la soglia**, la riga diventa verde/oro **"SI ATTIVA"** e il bonus si applica davvero.
- I testi dei bonus riusano `lib/glossary.ts` (già formatta i bonus sinergia). Il conteggio in anteprima riusa `detectSynergies` su `[...squadra, candidato]`.

## 7. Battaglia — far capire cosa succede

Obiettivo: dramma + chiarezza. Costruita con animazioni sequenziate (Framer Motion), **senza toccare il motore deterministico**: la UI legge il `replay`/log esistente e lo *mette in scena*.

**Ordine d'iniziativa (per velocità)**
- Fila in alto con gli avatar **ordinati per VEL**: chi agisce **ORA** + la coda; avanza man mano che i turni passano. Rende esplicito *perché* il più veloce colpisce primo.
- **Sorgente dati**: l'ordine si **deriva dalla sequenza di azioni già ordinata dal motore** (il log/replay esistente), non da un nuovo concetto di "turn queue" nel combat engine. La UI mappa le prossime azioni del replay → coda. (Se il dato di velocità per-unità non è già esposto, lo si legge dagli `stats` delle unità del replay, sola lettura.)

**Messa in scena di una mossa (coreografia in 5 fasi)**
1. **Carica** — l'attaccante si illumina/arretra, un bagliore si forma.
2. **Lancio** — rilascio.
3. **Volo** — proiettile/raggio viaggia caster → bersaglio con scia.
4. **Impatto** — flash luminoso + **numero danno/cura che vola** (rosso danno, oro critico, verde cura).
5. **Rinculo** — il bersaglio subisce un knockback/shake; HP bar cala.

**Vocabolario di animazioni per tipo di magia** (motion + colore archetipici, non bespoke per ogni incantesimo):
- raggio/disarmo (verde, dritto), maledizione (rosso), fuoco/AoE (arancio, ad area), oscura (viola), **scudo/Protego**, cura (verde, dal basso), stordimento (lampo). La mappatura magia→archetipo è **dati** (riusa la normalizzazione `EffectSpec`).

**Protego (insegna la meccanica per contrasto)**
- Lo scudo è una **cupola/sfera azzurra** attorno al difensore; quando un colpo arriva, il proiettile **si dissolve/rimbalza**, parte un'**onda d'urto** e l'etichetta **"PARATO"**, **0 danni**. Il contrasto con un colpo che va a segno (rinculo + HP che cala) rende chiara la meccanica.

**Stato e leggibilità**
- **Icone di stato** sui maghi (🔥 dot, 💫 stun, 🛡️ scudo/buff) — lo stato è visibile, non sepolto nel log.
- **HP bar** rosse (nemici) / verdi (alleati); i **caduti** restano grigi al loro posto.
- **Cartello d'azione** sintetico (CHI · COSA · su CHI · risultato) come ancora testuale sotto l'arena, sincronizzato con l'animazione.
- **Controlli ritmo**: play/pausa, **passo-passo** (una azione alla volta), velocità regolabile, skip.

**Vincoli**
- Le animazioni sono **puramente presentazionali**: stesso log/seed → stessa battaglia. Nessun cambiamento al risultato.
- Performante su mobile (transform/opacity, niente layout thrash); rispetta `prefers-reduced-motion` con un fallback statico.

## 8. Gameplay — minimo necessario (non focus)

**8.1 Fix boss (bug)**
- `BossDef` ottiene un `identityId` che punta a un mago reale del roster (Voldemort).
- `generateBossTeam`: genera la squadra di contorno verso budget, poi **forza il boss come leader reale** (draft del mago `identityId`, HP ×`hpMult`, magia forzata), garantendone la presenza visibile nello slot leader.
- **Applica la `exclusiveSynergy`** (`darkLord`, +20% all) al team del boss — oggi definita ma mai usata.
- Risultato: l'ultimo stage contiene **sempre Lord Voldemort**, visibile e potenziato. (Climax = anche resa.)

**8.2 Valore di potenza E sinergia**
- **Comprimere il divario tra tier**: appiattire `tierRollBias` (oggi 0.85→0.4) e avvicinare i range, così un leggendario è migliore ma **non doppia** un comune.
- **Rinforzare le sinergie**: aumentare la magnitudo dei bonus e/o renderli **scalanti col numero di membri** (3 < 4 < 5), così una squadra di comuni **ben sinergica** eguaglia/supera 5 leggendari scoordinati.
- La rarità nel draft resta (leggendari rari), ma completare una sinergia diventa a volte la scelta giusta.
- **Validazione**: estendere/aggiornare `tests/engine/campaignBalance.test.ts` con una misura "build sinergica vs build solo-potenza"; tarare i numeri empiricamente (TDD).
- **Difficoltà**: i numeri di curva si lasciano sostanzialmente come sono (non è una priorità); ci si limita a non regredire le bande esistenti, beneficiando del boss ora reale.

## 9. Architettura & isolamento

- **Token visivi** centralizzati (un modulo theme) — niente colori sparsi.
- **`RarityFrame`** — un'unità che mappa rarità → trattamento, consumata da card e busti.
- **`PortraitImage`** — wrapping immagine+fallback+crest, riusata su card/busto.
- **Draft**: `SynergyTracker` (stato + anteprima) come componente puro che riceve `squadra` e `candidatoInAnteprima`; logica di conteggio dal motore esistente (`detectSynergies`, `glossary`).
- **Battaglia**: separare `useBattlePlayback` (stato del replay: frame corrente, play/pause, velocità, coda iniziativa) dalla **presentazione** (`BattleArena`, `SpellFx`, `ShieldFx`, `UnitBust`, `InitiativeBar`). `SpellFx` mappa tipo-magia → archetipo d'animazione via dati.
- Ogni unità deve essere comprensibile e testabile da sola; i file che crescono troppo (es. `BattleScreen`) vanno spezzati lungo questi confini.
- **Nessuna modifica al combat engine** salvo §8 (boss + costanti di bilancio + eventuali scalature sinergia, tutte coperte da test).

## 10. Testing

- **Puro/engine**: boss contiene l'identità (test su `generateBossTeam`); `exclusiveSynergy` applicata; bilancio sinergia vs potenza e bande campagna (`campaignBalance`).
- **Logica UI pura**: conteggio/anteprima sinergie (stato → proiezione con +1); mappatura rarità → trattamento; mappatura magia → archetipo FX; ordine iniziativa per velocità.
- **Componenti** (React Testing Library): la card mostra stat+chip+rarità; il tracker mostra conteggio e, in anteprima, la freccia; l'arena renderizza busti/HP/stato dal replay; i controlli ritmo funzionano.
- **Determinismo**: i test esistenti di replay/seed restano il cancello di regressione — le animazioni non devono alterarli.
- **Accessibilità**: fallback `prefers-reduced-motion`.

## 11. Fuori scope (YAGNI)

- Sprite a figura intera animati (Formato B) — scartato per mobile-first 5v5.
- Tuning fine della difficoltà come obiettivo a sé.
- Soul/personaggi addestrati riutilizzabili per l'arte (one-off è sufficiente).
- Nuove sinergie/relic/magie: si lavora sui dati esistenti.

## 12. Decomposizione in piani

Lo spec è ampio: in fase di `writing-plans` si scompone in piani sequenziali, ciascuno verde a fine corsa:

1. **Fondamenta visive** — token Notturno, `RarityFrame`, stemmi SVG, `PortraitImage` + pipeline ritratti + fallback.
2. **Draft redesign** — layout mobile-first, card a stat piene + chip, `SynergyTracker` (stato + anteprima).
3. **Battaglia redesign** — `useBattlePlayback`, `InitiativeBar`, `BattleArena`/`UnitBust`, `SpellFx`/`ShieldFx`, icone stato, controlli, reduced-motion.
4. **Gameplay** — fix boss + `exclusiveSynergy`; compressione tier + scalatura/visibilità sinergie; ribilanciamento via test.

(L'ordine 1→2→3 è anche l'ordine di valore "resa"; il 4 può procedere in parallelo perché tocca soprattutto il motore.)
