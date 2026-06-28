# Onda 1 — Fetta verticale "Veleno" (tracer bullet) — Design Spec

> Spec implementabile di una **fetta verticale**: un solo archetipo (Veleno) attraversato end-to-end dalle tre fondamenta P0+P1+P8.
> Obiettivo: validare in pratica — con simulazione *e* playtest — il pattern che poi replicheremo agli altri 3 archetipi-faro.
> Deriva da: `2026-06-28-game-design-direction.md` (Onda 1). Data: 2026-06-28.
> **Vincolo architetturale**: tracer = il proiettile passa per l'**architettura vera** (keyword reali, campo firma reale), ma popolata con **solo contenuto Veleno**. Niente impalcature finte da buttare.
> Rev. 2 (decisioni utente): **niente detonatore** — solo stack di veleno che salgono senza limite; **base di sorgenti allargata** per rendere la build draftabile.

---

## 1. Obiettivo e criteri di successo

Costruire la build **Veleno/Sanguinamento** come **attrito inarrestabile**: avvicinando maghi, magie, reliquie e una sinergia a tema, il danno-per-turno da veleno *sale e non smette di salire* finché i nemici si sciolgono. Niente burst: la fantasia è "non potete fermarlo, peggiora e basta".

A fine fetta si deve poter rispondere "sì" a:
- **Build (P1)**: il danno da veleno *scala* in modo visibile man mano che aggiungi sorgenti — il giocatore costruisce una macchina, non somma statistiche.
- **Identità (P0)**: almeno 3 maghi hanno un'**abilità-firma** a tema veleno che li rende riconoscibili ("recluto Bellatrix *per* la build Veleno"), e abbastanza altri maghi possono *contribuire* da rendere la build **draftabile**.
- **Dramma (P8)**: la battaglia *mostra* il veleno crescere (callout sui picchi di stack/danno) e il giocatore ha **una leva pre-battaglia** reale (il loadout della magia attiva).

**Criteri di successo misurabili:**
1. *Viability* (simulazione): una run che favorisce Veleno raggiunge un win rate ≥ baseline attuale (~0.20) sull'harness seeded.
2. *Distinzione* (simulazione): in quelle run, una quota dominante del danno inflitto proviene dal canale `dot` (non dagli attacchi base) — prova che è *un'altra* strategia, non la stessa ridipinta.
3. *Draftabilità* (simulazione): nelle run "favor-Veleno", la sinergia "Tossicità" (≥3 sorgenti) si attiva in una quota significativa dei casi — prova che la build si può *inseguire*, non solo trovare per caso.
4. *Feel* (playtest umano, insostituibile): il giocatore (tu) gioca un seed Veleno e giudica se la rampa crescente è soddisfacente e leggibile.

**Fuori scope (esplicito):** gli altri 11 archetipi; eventi narrativi (P3); roster completo di boss (P4); meta-progressione (P7); UI di loadout ricca (qui minimale). Una sola eccezione di contenuto fuori-Veleno: **un** boss-counter (Umbridge, vedi §7) per provare che i counter funzionano — opzionale, "fase 2 della fetta".

---

## 2. Architettura: cosa si aggiunge (grounded sui tipi reali)

Tutte le modifiche sono **estensioni** dell'esistente; nessuna riscrittura del loop di combattimento.

### 2.1 Keyword (substrato P1, minimo ma reale)
- Nuovo tipo `Keyword` (string-union) in `types/keyword.ts`. Dichiariamo l'intero set previsto dal direction doc (~11) per non doverlo ritoccare, ma in questa fetta **solo `'veleno'` è popolato**.
- Campo opzionale `keywords?: Keyword[]` aggiunto a: `Spell` (`types/spell.ts`), `StatusDef` (`types/status.ts`), `Trait` (`types/trait.ts`), `Relic` (`types/relic.ts`).
- Helper puro `teamKeywords(team): Map<Keyword, number>` (conteggio sorgenti per keyword) in `game/engine/keywords.ts`. Una **sorgente veleno** = mago con firma veleno **oppure** mago con una magia veleno equipaggiata **oppure** reliquia veleno attiva. Usato dalla sinergia di archetipo (§6) e, in futuro, dalla "Stanza delle Necessità" keyword-aware.

### 2.2 Lo status VELENO (rampa senza burst)
Oggi `burn` = `{ kind:'dot', tickDamage:8, stack:'stack', maxStacks:3 }`: cap basso, tre entry indipendenti. Per un *build* serve **rampa illimitata**.
- Nuovo `veleno` status: `kind:'dot', family:'dot', keywords:['veleno']`, modello **a stack singolo che cresce** (non N entry): l'entry porta `stacks`, e il tick infligge `stacks × perStack`.
- Cambio engine minimo, isolato: estendere `applyStatus` con una policy `'accumulate'` (incrementa `stacks` invece di pushare nuove entry; rispetta `maxStacks` *finché* esiste) e far sì che `tickStatuses` usi `tickDamage × stacks` quando presente. `burn` resta invariato (compat).
- Default: `perStack` modesto (≈4), `maxStacks` ≈8 **di base** (→ rimosso dalla sinergia §6, da cui il "senza limite"), `defaultDuration` che si **rinfresca** a ogni nuova applicazione (la pressione tiene vivo lo stato).

### 2.3 Scaling del veleno (P1) — la fonte di potenza, al posto del burst
Senza detonatore, tutta la potenza viene da **quanto velocemente accumuli** e **quanto picchia ogni stack**. Due leve:
- **Per-stack tick** scalato da un moltiplicatore di keyword **team-level**: campo `keywordDamageMult: Partial<Record<Keyword, number>>` calcolato dalle reliquie/sinergie attive e letto da `tickStatuses` al momento del tick veleno. (Scelta isolata: non intreccia i modifier di danno diretto col DoT; testabile da solo.)
- **Velocità di accumulo**: quante sorgenti applicano stack per turno (firme + magie + reliquie). Più sorgenti → la rampa parte prima e sale più ripida.

*(Nessuna `EffectSpec` `detonate`: rimossa per decisione di design. La build non "esplode", inonda.)*

### 2.4 Abilità-firma (P0) — sblocco del campo
**Scoperta chiave dal codice**: `registerTraitTriggers` applica tratti **solo** ai maghi `shiny` (`u.shiny ? [u.shiny.traitId] : []`). Non esiste identità per-mago.
- Aggiungere `signatureTraitId?: string` a `Wizard` (`types/wizard.ts`).
- Estendere il loop in `game/engine/traits.ts` a includere `u.wizard.signatureTraitId` oltre allo shiny: `[...(u.shiny?[u.shiny.traitId]:[]), ...(u.wizard.signatureTraitId?[u.wizard.signatureTraitId]:[])]`.
- Le firme sono normali `Trait` nel catalogo (riusano tutto il plumbing reactive/modifier già esistente).

---

## 3. Contenuto Veleno — Status & numeri di partenza

| Elemento | Valore iniziale (da tarare) | Note |
|---|---|---|
| `veleno` perStack | 4 dmg/turno | scala con `keywordDamageMult.veleno` |
| `veleno` maxStacks (base) | 8 | rimosso dalla sinergia "Tossicità" (§6) → rampa illimitata |
| `veleno` durata | 2 turni, refresh ad ogni stack | tenuto vivo dalla pressione |
| `keywordDamageMult.veleno` (Ampolla) | +0.5 (=+50% tick) | la dial più sensibile per la potenza |

Questi numeri sono **dial di playtest**, non vincoli. Sono i primi candidati da spazzolare in simulazione. La sensazione-bersaglio è **attrito crescente** (curva, non picco): se al playtest "sale troppo lenta", si alza `perStack` o la velocità di accumulo; se "trivializza", si abbassano.

---

## 4. Contenuto Veleno — Maghi (P0 + draftabilità)

### 4.1 Le 3 firme profonde (i pull-premio) — ID verificati su `data/wizards.ts`, tutti Serpeverde a tema
Schema reactive/modifier già usato (es. `sifone`/`esecuzione`). Coprono **applica → accelera → persiste**, così la build *vive nei personaggi*:

- **Horace Lumacorno (`slughorn`) — "Tocco Velenoso"** *(reactive `onHit`)*: ogni colpo applica **+1 stack** di veleno. Il prof. di Pozioni è l'**applicatore** affidabile.
- **Bellatrix Lestrange (`bellatrix`) — "Crudeltà"** *(reactive `onHit`)*: se il bersaglio è già danneggiato (`hp/maxHp < 1`), applica **+1 stack extra**. L'**acceleratore**: con un applicatore presente, la rampa raddoppia ritmo.
- **Antonin Dolohov (`dolohov`) — "Maledizione Persistente"** *(reactive `onHit`)*: i suoi stack di veleno sono **non rimovibili** e ne **rinfrescano la durata** ad ogni colpo — il veleno non cade più. La sua maledizione a danno persistente rende la rampa **inarrestabile** (incarna il "senza limite" del brief). *(Usa i campi `removable`/refresh già esistenti negli status; nessuna nuova meccanica.)*

Reclutarli in sequenza È la storia: "avevo l'applicatore, è arrivata Bellatrix, poi Dolohov: a quel punto non si fermava più."

### 4.2 I contributori (rendono la build draftabile)
Per i motivi del §1 (un archetipo dev'essere *inseguibile*, non solo trovabile), **~6-8 maghi tematici** ricevono una **magia veleno nel `spellPool`** (non una firma — solo l'opzione di contribuire via loadout). Costo: solo taggare i pool. Candidati a tema dal roster (da confermare in implementazione): Fenrir Greyback (`greyback`, morso/infezione), Pansy Parkinson (`pansy`), Theodore Nott (`theodore`), Narcissa Malfoy (`narcissa`), Astoria Greengrass (`astoria`), Pomona Sprite (`sprout`, erbologia/piante velenose), Blaise Zabini (`blaise`).

Effetto netto: un draft *deciso* riesce a mettere insieme ≥3-4 sorgenti veleno (firme + contributori + reliquie) e attivare "Tossicità"; un draft casuale quasi mai. **Draftabile, non garantita.**

---

## 5. Contenuto Veleno — Magie (loadout, P8)

Aggiunte/retag in `data/spells.ts` (taggate `keywords:['veleno']`):
- **Serpensortia** *(applicatore)*: colpo che applica 2 stack veleno (esiste già di nome — formalizzarla a tema). È la magia veleno che i **contributori** (§4.2) portano nel pool.
- Retag di magie DOT esistenti (Incendio/Confringo/Fiendfyre) con `keywords:['veleno']` dove sensato, così la build pesca anche dal pool esistente.

**Loadout minimale (la leva di agency P8):** poiché `DraftedWizard.spell` è già **una** magia attiva, il loadout = *scegliere quale magia dal `spellPool` equipaggiare*. Implementazione thin: un pannello (accessibile dalla sidebar team / pre-battaglia) che per ogni mago mostra le magie del suo `spellPool` e setta `dw.spell`. Persistito nello stato run. **Nessuna riscrittura di `selectSpell`** (continua a gating su cooldown/silence). È la decisione che il giocatore prende — poi guarda il risultato (es. equipaggiare Serpensortia su un contributore per trasformarlo in sorgente veleno).

---

## 6. Contenuto Veleno — Reliquie & Sinergia (P1/P2)

**Reliquie** (in `data/relics.ts`, taggate `keywords:['veleno']`) — tutte *applicano* o *scalano*, nessuna detona:
- **Ampolla di Veleno** *(non-comune)* — team-level `keywordDamageMult.veleno += 0.5` (il veleno tickka +50%). Lo **scaling** puro.
- **Pugnale di Bellatrix** *(rara)* — `onHit → applyStatus veleno (+1 stack)`. Diffonde la keyword a *tutta* la squadra, non solo agli avvelenatori (e conta come sorgente).
- **Boccino d'Oro (rework)** *(epica)* — `onHit → 15% di applicare +2 stack veleno`. Mantiene il flavor originale ("ogni colpo può avvelenare"), ma a servizio della rampa.

**Sinergia di archetipo** (in `data/synergies.ts`, `kind:'origin'`, conta sorgenti keyword via §2.1):
- **"Tossicità"** — team con **≥3 sorgenti `veleno`** → il `veleno` perde il cap di stack (`maxStacks → ∞`) e +1 perStack. È il momento "completamento sinergia": la build sblocca la rampa illimitata. Si attiva *anche senza* allineamento di Casa (il punto del brief: la build esiste su un asse diverso dalle Case).

---

## 7. Dramma & counter (P8 + assaggio P4)

**Callout a schermo (P8):** nuovo overlay in `BattleScreen.tsx` (sopra `BattleLog`) che reagisce a un nuovo `LogFlag` `'combo'`, emesso quando gli stack veleno su un nemico superano soglie (×4, ×8, ×16) o quando il danno-veleno-per-turno supera soglie → testo grande **"VELENO ×N! −M/turno"** con enfasi. Priorità visiva: mostrare **solo** i salti di soglia, non ogni tick, per non intasare. Il dramma è la *curva che sale*, leggibile a colpo d'occhio.
`describeEntry` già narra 'Veleno' nel log; aggiungiamo solo l'enfasi visiva sui picchi.

**Recap MVP (P8):** estendere la schermata vittoria per evidenziare il danno da veleno e l'MVP ("Lumacorno: 480 danni da veleno, picco ×22"). Alimenta il "racconta la tua run".

**Boss-counter (assaggio P4, opzionale/fase-2 della fetta):** **Dolores Umbridge** come boss scriptato che ogni 3 turni *vieta una keyword* (qui: blocca l'applicazione di `veleno` per 2 turni). Telegrafata **prima** della battaglia. Prova che il sistema keyword abilita counter educativi. Se la fetta si allunga, questo è il primo taglio.

---

## 8. Checkpoint di validazione (i due cicli)

**Ciclo simulazione — nuovo sweep** (`tests/engine/archetypeVeleno_sweep.test.ts`), modellato su `campaignBalanceB.test.ts`:
- Variante di `runOne` che **favorisce Veleno**: agli offer di recluta preferisce maghi con firma o pool veleno; agli offer di reliquia preferisce `keywords:['veleno']`; equipaggia magie veleno via loadout.
- Assert 1 (viability): win rate ≥ 0.20 su N=120 seed.
- Assert 2 (distinzione): somma del danno con flag `dot` ≥ X% del danno totale inflitto nelle vittorie (strumentare `BattleResult` per sommare danno per-canale, o derivarlo dal log).
- Assert 3 (draftabilità): "Tossicità" attiva in ≥ Y% delle run favor-Veleno.
- Assert 4 (determinismo): invariato, stessi seed → stessi esiti.

**Ciclo feel — playtest umano (tu):** giocare 1–2 seed lungo il percorso Veleno e giudicare: la rampa è leggibile e soddisfacente? il loadout dà senso di controllo? I numeri di §3 sono le manopole da girare insieme.

---

## 9. Fasatura suggerita (per writing-plans)

La fetta è ampia: il piano la spezzerà in fasi piccole, ciascuna verde-ai-test (664 test attuali + TDD sui nuovi). Ordine consigliato:

1. **Substrato P1**: tipo `Keyword`, campi `keywords?`, helper `teamKeywords`, status `veleno` + policy `accumulate` + tick scalato. *(TDD puro engine; nessuna UI.)*
2. **Scaling**: `keywordDamageMult` team-level + le 3 reliquie. *(TDD engine.)*
3. **Identità P0**: campo `signatureTraitId`, estensione `registerTraitTriggers`, le 3 firme (ID-mago verificati). *(TDD engine.)*
4. **Draftabilità**: tag magia veleno nei pool dei ~6-8 contributori; Serpensortia a tema. *(Dato.)*
5. **Sinergia "Tossicità"** (rimozione cap + perStack). *(TDD engine.)*
6. **Loadout P8**: pannello scelta magia da `spellPool` + persistenza. *(UI + stato.)*
7. **Dramma P8**: overlay callout su soglie + recap MVP. *(UI.)*
8. **Checkpoint simulazione**: sweep viability+distinzione+draftabilità. → **gate**: se fallisce, si tarano i dial di §3 prima di proseguire.
9. *(opzionale)* **Boss Umbridge** + telegrafia.
10. **Checkpoint playtest** (tu).

Fasi 1–5 sono pura logica testabile (il grosso del valore e del rischio). 6–7 rendono il tutto *giocabile e sentito*. 8 e 10 sono i due cancelli di qualità.

---

## 10. Rischi & manopole (dominio del Direttore Creativo)

- **Pura attrito = ritmo lento** (feel): senza burst, la build vince *logorando*. Rischio noia se la rampa sale troppo piano → la curva di `perStack` × velocità-accumulo dev'essere abbastanza ripida da *vedersi* salire. **Manopola tua al playtest.**
- **⚠️ Interazione con la stanchezza anti-stallo**: oltre il turno 30 l'engine infligge danno vero crescente a *entrambe* le squadre (`fatigueStart:30`). Una build lenta che *trascina* le battaglie rischia di **morire del proprio veleno-tempo**. Va verificato che la rampa uccida i nemici *prima* che la stanchezza colpisca i tuoi → potrebbe servire una velocità di accumulo più alta, o accettare che Veleno sia un archetipo "a media durata", non infinito. Lo sweep (turni per battaglia) lo intercetta.
- **"Inarrestabile" che trivializza**: stack illimitati + non rimovibili (Dolohov) + cap rimosso (sinergia) possono sfondare. Guardrail: il cap resta finché "Tossicità" non è attiva; lo sweep di viability segnala l'over-performance e si tara.
- **Draftabilità vs rumore**: troppi contributori (es. 15) → la build capita per caso e perde identità; troppo pochi (3) → non si insegue. ~6-8 è il primo tentativo; l'assert di draftabilità (§8) lo misura.
- **Telegrafia counter**: Umbridge senza preavviso = frustrazione. La regola va mostrata prima.
- **Bilanciamento globale**: introdurre uno scaling forte può alzare il win rate generale oltre il range 0.15–0.55 dell'harness esistente. Va ricontrollato `campaignBalanceB` a fine fetta.

---

## 11. Decisioni prese (per non riaprirle)

- Tracer = architettura vera, contenuto solo-Veleno.
- **Niente detonatore**: la build è rampa-attrito illimitata, non burst (risolve l'attrito col vincolo auto-battle).
- Scaling via `keywordDamageMult` team-level (non intrecciato coi modifier di danno diretto).
- Veleno modellato a **stack singolo crescente** (policy `accumulate`); cap base 8, rimosso dalla sinergia "Tossicità".
- Loadout = scelta della singola `spell` attiva dal `spellPool` (coerente col modello dati esistente), UI minimale.
- **Identità a livelli**: 3 firme profonde (Lumacorno/Bellatrix/Dolohov, ruoli applica/accelera/persiste) + ~6-8 contributori via spellPool → build *draftabile*.
- Umbridge è opzionale (primo taglio se la fetta si allunga).
