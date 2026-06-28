# Onda 1 — Fetta verticale "Veleno" (tracer bullet) — Design Spec

> Spec implementabile di una **fetta verticale**: un solo archetipo (Veleno) attraversato end-to-end dalle tre fondamenta P0+P1+P8.
> Obiettivo: validare in pratica — con simulazione *e* playtest — il pattern che poi replicheremo agli altri 3 archetipi-faro.
> Deriva da: `2026-06-28-game-design-direction.md` (Onda 1). Data: 2026-06-28.
> **Vincolo architetturale**: tracer = il proiettile passa per l'**architettura vera** (keyword reali, campo firma reale), ma popolata con **solo contenuto Veleno**. Niente impalcature finte da buttare.

---

## 1. Obiettivo e criteri di successo

Costruire la build **Veleno/Sanguinamento** in modo che, a fine fetta, si possano rispondere "sì" a:

- **Build (P1)**: avvicinando maghi, magie, reliquie e una sinergia a tema, il danno da veleno *scala e detona* — il giocatore costruisce una macchina, non somma statistiche.
- **Identità (P0)**: almeno 3 maghi hanno un'**abilità-firma** a tema veleno che li rende riconoscibili ("recluto Bellatrix *per* la build Veleno").
- **Dramma (P8)**: la battoria *mostra* il veleno accumularsi e detonare (callout a schermo), e il giocatore ha **una leva pre-battaglia** reale (il loadout della magia attiva).

**Criteri di successo misurabili:**
1. *Viability* (simulazione): una run che favorisce Veleno raggiunge un win rate ≥ baseline attuale (~0.20) sull'harness seeded.
2. *Distinzione* (simulazione): in quelle run, una quota dominante del danno inflitto proviene dal canale `dot`/detonazione (non dagli attacchi base) — prova che è *un'altra* strategia, non la stessa ridipinta.
3. *Feel* (playtest umano, insostituibile): il giocatore (tu) gioca un seed Veleno e giudica se la rampa-e-detonazione è soddisfacente e leggibile.

**Fuori scope (esplicito):** gli altri 11 archetipi; eventi narrativi (P3); roster completo di boss (P4); meta-progressione (P7); UI di loadout ricca (qui è minimale). Una sola eccezione di contenuto fuori-Veleno: **un** boss-counter (Umbridge, vedi §7) per provare che i counter funzionano — opzionale, "fase 2 della fetta".

---

## 2. Architettura: cosa si aggiunge (grounded sui tipi reali)

Tutte le modifiche sono **estensioni** dell'esistente; nessuna riscrittura del loop di combattimento.

### 2.1 Keyword (substrato P1, minimo ma reale)
- Nuovo tipo `Keyword` (string-union) in `types/keyword.ts`. Dichiariamo l'intero set previsto dal direction doc (~11) per non doverlo ritoccare, ma in questa fetta **solo `'veleno'` è popolato**.
- Campo opzionale `keywords?: Keyword[]` aggiunto a: `Spell` (`types/spell.ts`), `StatusDef` (`types/status.ts`), `Trait` (`types/trait.ts`), `Relic` (`types/relic.ts`).
- Helper puro `teamKeywords(team): Map<Keyword, number>` (conteggio sorgenti per keyword) in `game/engine/keywords.ts` — usato dalla sinergia di archetipo (§6) e, in futuro, dalla "Stanza delle Necessità" keyword-aware.

### 2.2 Lo status VELENO (più profondo di `burn`)
Oggi `burn` = `{ kind:'dot', tickDamage:8, stack:'stack', maxStacks:3 }`: cap basso, tre entry indipendenti. Per un *build* serve **rampa**.
- Nuovo `veleno` status: `kind:'dot', family:'dot', keywords:['veleno']`, modello **a stack singolo che cresce** (non N entry): l'entry porta `stacks`, e il tick infligge `stacks × perStack`.
- Cambio engine minimo, isolato: estendere `applyStatus` con una policy `'accumulate'` (incrementa `stacks` invece di pushare nuove entry; rispetta `maxStacks`) e far sì che `tickStatuses` usi `tickDamage × stacks` quando presente. `burn` resta invariato (compat).
- Default: `perStack` modesto (≈4), `maxStacks` alto (≈8) e `defaultDuration` che si **rinfresca** a ogni nuova applicazione (la build vuole tenere vivo lo stato fino alla detonazione).

### 2.3 Il DETONATORE (il payoff WOW)
- Nuova `EffectSpec`: `{ kind:'detonate'; mult:number; target:EffectTarget }`, con handler in `EFFECT_HANDLERS` (`game/engine/combat/effects.ts`): legge gli stack di `veleno` sul bersaglio, infligge burst `= stacks × perStack × mult`, poi **azzera** lo stato. Emette un log con flag nuovo `'detonate'`.
- Due vie di consegna (entrambe = espressione di build):
  - **Attiva (loadout)**: una magia detonatore equipaggiabile (§5) — più agency.
  - **Passiva (reliquia)**: Boccino rework che detona oltre soglia (§6) — "guardalo succedere".

### 2.4 Scaling del veleno via reliquie (P1/P2)
- Le reliquie che potenziano il veleno applicano un **moltiplicatore di keyword** al tick. Introduciamo un piccolo gancio: al momento del tick, il danno veleno passa per `emitModifier('modifyOutgoingDamage', …)` con un ctx marcato keyword, **oppure** (più semplice e isolato) un campo team-level `keywordDamageMult: Partial<Record<Keyword, number>>` calcolato dalle reliquie attive e letto da `tickStatuses`. → **Decisione**: la seconda (team-level mult), perché evita di intrecciare i modifier di danno diretto col DoT e resta testabile in isolamento.

### 2.5 Abilità-firma (P0) — sblocco del campo
**Scoperta chiave dal codice**: `registerTraitTriggers` applica tratti **solo** ai maghi `shiny` (`u.shiny ? [u.shiny.traitId] : []`). Non esiste identità per-mago.
- Aggiungere `signatureTraitId?: string` a `Wizard` (`types/wizard.ts`).
- Estendere il loop in `game/engine/traits.ts` a includere `u.wizard.signatureTraitId` oltre allo shiny: `[...(u.shiny?[u.shiny.traitId]:[]), ...(u.wizard.signatureTraitId?[u.wizard.signatureTraitId]:[])]`.
- Le firme sono normali `Trait` nel catalogo (riusano tutto il plumbing reactive/modifier già esistente).

---

## 3. Contenuto Veleno — Status & numeri di partenza

| Elemento | Valore iniziale (da tarare) | Note |
|---|---|---|
| `veleno` perStack | 4 dmg/turno | scala con relic mult |
| `veleno` maxStacks | 8 (→ ∞ con sinergia §6) | la rampa |
| `veleno` durata | 2 turni, refresh ad ogni stack | tenuto vivo dalla pressione |
| detonatore `mult` | 2.0× (burst = stacks×perStack×2) | la dial più sensibile per il feel |

Questi numeri sono **dial di playtest**, non vincoli. Sono i primi candidati da spazzolare in simulazione.

---

## 4. Contenuto Veleno — Abilità-firma (P0, 3 maghi)

I tratti-firma seguono lo schema reactive/modifier già usato (es. `sifone`/`esecuzione`). ID-mago verificati su `data/wizards.ts` — tutti e tre presenti e a tema (Serpeverde):

- **Bellatrix Lestrange (`bellatrix`) — "Crudeltà"** *(reactive `onHit`, owner actor)*: se il bersaglio è già danneggiato (`hp/maxHp < 1`), applica **+1 stack** di veleno extra. → il *motore* di rampa.
- **Horace Lumacorno (`slughorn`) — "Tocco Velenoso"** *(reactive `onHit`)*: ogni colpo applica 1 stack di veleno. Il prof. di Pozioni è l'**applicatore** affidabile (non legato al caso come il Boccino).
- **Antonin Dolohov (`dolohov`) — "Catalisi"** *(reactive `onHit`)*: se il bersaglio ha ≥ N stack, **detona** (consegna passiva del detonatore via firma). La sua maledizione a danno persistente è il **finisher** incarnato in un personaggio.

Vincolo di design: le tre firme coprono **applica → accumula → detona**, così la build *vive nei personaggi*, non solo nelle reliquie. Reclutarli in sequenza è la storia ("avevo l'avvelenatore, poi è arrivata Bellatrix, poi il detonatore: a quel punto la run è cambiata").

---

## 5. Contenuto Veleno — Magie (loadout, P8)

Aggiunte/retag in `data/spells.ts` (taggate `keywords:['veleno']`):
- **Veleno Virulento** *(detonatore attivo)*: `type:'Controllo'`, `spec:[{kind:'detonate', mult:2.0, target:'enemy'}]`, cooldown 2. La magia che il giocatore **equipaggia** sul detonatore per controllarne il timing.
- **Serpensortia** *(applicatore)*: colpo che applica 2 stack veleno (esiste già di nome — formalizzarla a tema).
- Retag di magie DOT esistenti (Incendio/Confringo/Fiendfyre) con `keywords:['veleno']` dove sensato, così la build pesca anche dal pool esistente.

**Loadout minimale (la leva di agency P8):** poiché `DraftedWizard.spell` è già **una** magia attiva, il loadout = *scegliere quale magia dal `spellPool` equipaggiare*. Implementazione thin: un pannello (accessibile dalla sidebar team / pre-battaglia) che per ogni mago mostra le magie del suo `spellPool` e setta `dw.spell`. Persistito nello stato run. **Nessuna riscrittura di `selectSpell`** (continua a gating su cooldown/silence). È la decisione che il giocatore prende — poi guarda il risultato.

---

## 6. Contenuto Veleno — Reliquie & Sinergia (P1/P2)

**Reliquie** (in `data/relics.ts`, taggate `keywords:['veleno']`):
- **Ampolla di Veleno** *(non-comune)* — team-level `keywordDamageMult.veleno += 0.5` (il veleno tickka +50%). Lo **scaling**.
- **Pugnale di Bellatrix** *(rara)* — `onHit → applyStatus veleno (+1 stack)`. Diffonde la keyword a *tutta* la squadra, non solo agli avvelenatori.
- **Boccino d'Oro (rework)** *(epica)* — `onHit → se veleno ≥ soglia, detonate(mult 1.5)`. Detonatore **passivo**: la build "esplode da sola".

**Sinergia di archetipo** (in `data/synergies.ts`, `kind:'origin'`, conta sorgenti keyword via §2.1):
- **"Tossicità"** — team con **≥3 sorgenti `veleno`** → il `veleno` perde il cap di stack (`maxStacks → ∞`) e +1 perStack. È il momento "completamento sinergia": la build sblocca la sua forma finale. Conta *anche senza* allineamento di Casa (il punto del brief: la build esiste su un asse diverso dalle Case).

---

## 7. Dramma & counter (P8 + assaggio P4)

**Callout a schermo (P8):** nuovo overlay in `BattleScreen.tsx` (sopra `BattleLog`) che reagisce a nuovi `LogFlag`:
- `'detonate'` → testo grande "DETONAZIONE! −N" con scossa/flash.
- nuovo flag `'combo'` quando gli stack veleno superano soglie (×4, ×8) → "VELENO ×N!".
`describeEntry` già narra 'Veleno' nel log; aggiungiamo la *enfasi visiva* per i picchi. Priorità visiva: mostrare **solo** i picchi (detonazione, soglie), non ogni tick, per non intasare.

**Recap MVP (P8):** estendere la schermata vittoria per evidenziare il danno da veleno/detonazione e l'MVP ("X: 3 detonazioni, 280 danni da veleno"). Alimenta il "racconta la tua run".

**Boss-counter (assaggio P4, opzionale/fase-2 della fetta):** **Dolores Umbridge** come boss scriptato che ogni 3 turni *vieta una keyword* (qui: blocca l'applicazione di `veleno` per 2 turni). Telegrafata **prima** della battaglia. Prova che il sistema keyword abilita counter educativi. Se la fetta si allunga, questo è il primo taglio.

---

## 8. Checkpoint di validazione (i due cicli)

**Ciclo simulazione — nuovo sweep** (`tests/engine/archetypeVeleno_sweep.test.ts`), modellato su `campaignBalanceB.test.ts`:
- Variante di `runOne` che **favorisce Veleno** nelle scelte: agli offer di recluta preferisce maghi con firma veleno; agli offer di reliquia preferisce `keywords:['veleno']`; equipaggia il detonatore.
- Assert 1 (viability): win rate ≥ 0.20 su N=120 seed.
- Assert 2 (distinzione): somma del danno con flag `dot`/`detonate` ≥ X% del danno totale inflitto nelle vittorie (strumentare `BattleResult` per sommare danno per-canale, o derivarlo dal log).
- Assert 3 (determinismo): invariato, stessi seed → stessi esiti.

**Ciclo feel — playtest umano (tu):** giocare 1–2 seed lungo il percorso Veleno e giudicare: la rampa è leggibile? la detonazione è soddisfacente? il loadout dà senso di controllo? I numeri di §3 e il `mult` del detonatore sono le manopole da girare insieme.

---

## 9. Fasatura suggerita (per writing-plans)

La fetta è ampia: il piano la spezzerà in fasi piccole, ciascuna verde-ai-test (664 test attuali + TDD sui nuovi). Ordine consigliato:

1. **Substrato P1**: tipo `Keyword`, campi `keywords?`, helper `teamKeywords`, status `veleno` + policy `accumulate` + tick scalato. *(TDD puro engine; nessuna UI.)*
2. **Detonatore**: `EffectSpec` `detonate` + handler + flag log. *(TDD engine.)*
3. **Scaling reliquie**: `keywordDamageMult` team-level + le 3 reliquie. *(TDD engine.)*
4. **Identità P0**: campo `signatureTraitId`, estensione `registerTraitTriggers`, le 3 firme (con ID-mago verificati su `wizards.ts`). *(TDD engine.)*
5. **Sinergia "Tossicità"**. *(TDD engine.)*
6. **Loadout P8**: pannello scelta magia da `spellPool` + persistenza. *(UI + stato.)*
7. **Dramma P8**: overlay callout + recap MVP. *(UI.)*
8. **Checkpoint simulazione**: sweep viability+distinzione. → **gate**: se fallisce, si tarano i dial di §3 prima di proseguire.
9. *(opzionale)* **Boss Umbridge** + telegrafia.
10. **Checkpoint playtest** (tu).

Fasi 1–5 sono pura logica testabile (il grosso del valore e del rischio). 6–7 rendono il tutto *giocabile e sentito*. 8 e 10 sono i due cancelli di qualità.

---

## 10. Rischi & manopole (dominio del Direttore Creativo)

- **Swing vs attrito** (feel): rampa-e-detona è *swingy* (picchi). Se troppo, sposta valore da `detonate.mult` verso `perStack` (più attrito costante, meno picco). **Manopola tua al playtest.**
- **Attiva vs passiva** (agency): se il Boccino passivo rende il loadout-detonatore inutile, depotenziare il passivo. Vogliamo che la **scelta** conti.
- **Combo che esplode**: in un roguelite è *desiderabile*; il guardrail è solo evitare il "win istantaneo" non interessante (es. detonazione che one-shotta i boss al turno 1). Lo sweep di distinzione lo intercetta.
- **Telegrafia counter**: Umbridge senza preavviso = frustrazione. La regola va mostrata prima.
- **Bilanciamento globale**: introdurre uno scaling forte può alzare il win rate generale oltre il range 0.15–0.55 dell'harness esistente. Va ricontrollato `campaignBalanceB` a fine fetta.

---

## 11. Decisioni prese (per non riaprirle)

- Tracer = architettura vera, contenuto solo-Veleno.
- Scaling via `keywordDamageMult` team-level (non intrecciato coi modifier di danno diretto).
- Veleno modellato a **stack singolo crescente** (policy `accumulate`), non N entry.
- Loadout = scelta della singola `spell` attiva dal `spellPool` (coerente col modello dati esistente), UI minimale.
- Firme P0 coprono applica→accumula→detona su 3 maghi.
- Umbridge è opzionale (primo taglio se la fetta si allunga).
