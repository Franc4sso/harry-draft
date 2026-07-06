# Design — Fluidità pagine non-combat (rimuovere la tassa di rendering)

Data: 2026-07-06 · Stato: **approvato in bozza** (utente: fluidità mantenendo la qualità)

## Problema

Frame drop / animazioni lente su TUTTE le schermate non-combat (menu, mappa, collezione,
negozio, draft, result, ecc.). Diagnosi (agente, evidenza file:line): non è una schermata lenta,
è una **tassa globale** più ridondanze per-schermata.

Cause ordinate per impatto:
1. **GameShell** (`components/ui/GameShell.tsx`, montato in `app/layout.tsx` → OGNI route):
   3 blob `blur-[100-120px]` grandi 40-70vh animati `infinite` + 14 embers infiniti + un layer
   noise `mix-blend-overlay` a tutto schermo. Il blur a raggio enorme su quell'area è tra le cose
   più costose per il compositor, ed è **sempre attivo anche su schermo statico**. Denominatore
   comune del jank su tutte le pagine.
2. **Blob duplicati per-schermata**: Menu/Result/Boss aggiungono i LORO blob `blur-[120-130px]`
   sopra quelli di GameShell (nessuno sapeva che la shell già li disegna) → MenuScreen ha 5 blur
   giganti insieme; Menu/Boss li animano via framer-motion (costo main-thread JS ogni rAF).
3. **CollectionScreen**: ~60 `<img>` portrait senza `width/height`, senza `loading="lazy"`
   (eager di default → il browser scarica/decodifica tutti i ~60 subito), tutti montati insieme +
   burst di stagger. Layout thrash + MB di immagini non differite.
4. **MapScreen**: pulse su `filter: brightness()` (repaint) + 8 embers propri che si sommano ai
   14 di GameShell = 22 embers concorrenti quando la mappa è aperta.

Già ottimizzato (NON toccare): `prefers-reduced-motion` rispettato ovunque; l'animazione SMIL
della live-edge della mappa (architettura anti-conflitto già ingegnerizzata); nessun re-render
storm (no onMouseMove/setInterval/RAF nell'UI layer); card-grid Draft/Team bounded.

## Decisione utente

- **Sfondo GameShell → STATICO**: gradiente + blob come alone **statico** (blur ridotto ~60px,
  nessuna animazione), embers rimossi, noise blend rimosso/statico. Elimina la tassa globale alla
  radice.
- Vincolo trasversale: **look il più vicino possibile all'attuale** — è un taglio di costo, non
  un redesign. Il gradiente di base e il tono caldo/arcano dei blob restano; sparisce solo il
  MOVIMENTO (che a quel raggio di blur nessuno percepisce come informazione, solo come costo).

## Obiettivi

1. **GameShell statico**: blob statici blur ridotto, no `warmDrift` animation, embers via, noise
   via o statico. `prefers-reduced-motion` resta gestito (statico = già "reduced" per tutti).
2. **Rimuovere blob duplicati** in MenuScreen / ResultScreen / BossScreen (ridondanti con la
   shell); togliere le loro animazioni framer-motion di opacity sui blob.
3. **CollectionScreen immagini**: aggiungere `width`/`height` (dimensioni intrinseche) +
   `loading="lazy"` + `decoding="async"` ai portrait; così off-screen non vengono scaricati subito
   e non c'è layout shift. (Virtualizzazione = fuori scope, YAGNI per ~60 item — lazy+sizing basta.)
4. **MapScreen**: rimuovere gli 8 embers propri (lo sfondo globale è ora statico → coerente, e
   comunque erano doppi); il pulse `filter: brightness()` del nodo corrente → alternativa economica
   (opacity o box-shadow statico + scale, transform/opacity only) MANTENENDO l'effetto "il nodo
   corrente pulsa". Se un pulse leggero è voluto, tenerlo ma su `opacity`/`transform`, non `filter`.

## Non-obiettivi (YAGNI)

- NON virtualizzare la collezione (lazy + sizing risolvono senza una lib).
- NON ottimizzare i portrait file (114MB dir) in questa slice — è un lavoro asset separato; il
  lazy-load evita il costo di caricarli tutti insieme, che è il sintomo vero.
- NON toccare il combattimento (già ottimizzato in una slice precedente).
- NON toccare l'animazione live-edge SMIL della mappa (già a posto).
- NON rimuovere `prefers-reduced-motion` gating dove esiste.

## Vincoli

- **Look il più invariato possibile.** Ogni cambio è "stesso aspetto, meno costo" o "movimento
  rimosso dove non porta informazione". Nessun redesign.
- Determinismo/engine non toccati (solo UI/CSS/markup).
- `npm run test` NON fa typecheck → typecheck a parte. Build deve passare.
- I test screen esistenti devono restare verdi (nessun `data-testid`/struttura DOM rimossa che un
  test asserisce — verificare prima di togliere elementi).

## Componenti (file toccati)

- `components/ui/GameShell.tsx` — blob statici (no framer-motion/`animation`), embers rimossi,
  noise rimosso/statico. `app/globals.css` keyframes `warmDrift`/`emberRise` → rimuovibili se non
  più referenziati (grep prima).
- `components/screens/MenuScreen.tsx` — rimuovere i blob blur locali + le loro animazioni.
- `components/screens/ResultScreen.tsx` — idem.
- `components/screens/BossScreen.tsx` — rimuovere il blob `blur-[130px]` con
  `repeat: Infinity`.
- `components/screens/CollectionScreen.tsx` + `components/ui/PortraitImage.tsx` — sizing + lazy +
  async decode sui portrait.
- `components/screens/MapScreen.tsx` (+ il suo `<style>` inline) — via gli 8 embers; pulse su
  transform/opacity invece di `filter`.

## Testing

- Screen test esistenti (`tests/screens/`, `tests/ui/`) verdi — verificare che nessun test
  asserisca i `data-testid`/nodi che rimuovo (embers, blob non hanno testid, ma controllare).
- Aggiungere test mirati dove sensato: PortraitImage rende `loading="lazy"` + width/height;
  GameShell non contiene più `repeat`/`animate` framer-motion (o il markup embers).
- `npm run test` + `npm run typecheck` + `npm run build` verdi.
- Verifica visiva manuale suggerita all'utente (screenshot harness) — il vincolo "look invariato"
  è giudizio umano; i test coprono il markup, non l'aspetto.

## Test da aggiornare (verificato)

- **`tests/ui/gameShell.test.tsx:15-19` asserisce `[data-ember]` > 8 e `[data-fog]` ≥ 2.**
  Rendendo lo sfondo statico e rimuovendo gli embers, questo test va AGGIORNATO (non è un bug del
  fix — riflette il vecchio design animato, e "sfondo statico" è la decisione utente). Il piano
  deve riscrivere questa `it(...)` per il nuovo markup: mantiene l'assert `aria-hidden` +
  `pointer-events-none` + `fixed` (quello resta valido), e sostituisce l'assert embers/fog con
  ciò che lo sfondo statico rende davvero (es. i blob statici, o semplicemente che il layer
  ambientale esiste). Decidere in impl SE tenere `[data-fog]` (i blob statici possono mantenere
  quell'attributo) — se sì, solo l'assert embers cade.
- Nessun altro test in `tests/` referenzia direttamente embers/blob/warmDrift della shell (gli
  altri hit del grep sono su parole non correlate come "ember" in nomi o "blur" altrove). Verificare
  comunque in impl con un grep mirato prima di ogni rimozione.

## Rischi

- **Look percepito diverso** → vedi sopra; blur ridotto statico ≈ invariato su schermo fermo.
- **Look percepito diverso** (blob statici vs animati) → blur ridotto + statico dovrebbe essere
  quasi indistinguibile su schermo fermo; se l'utente nota, si può alzare di nuovo il raggio (è
  una costante). Documentare il valore come leva.
- **Keyframes CSS orfani** dopo la rimozione → grep e rimuovere per non lasciare dead CSS.
