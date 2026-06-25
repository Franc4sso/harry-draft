# Draft pick redesign — roster orizzontale, cinematografico per casata

**Data:** 2026-06-25
**Stato:** approvato (design), pronto per piano di implementazione

## Problema

La schermata di scelta dei pick (`DraftScreen`) ha tre problemi:

1. **Card brutte e verticali.** Le `WizardCard` sono colonne strette (`w-56`, `min-h-27rem`) con
   ritratto in alto e stat/incantesimo sotto, disposte in griglia 1/2/3 colonne. Scansione lenta e
   look poco curato.
2. **Flicker fastidioso in hover.** Passando il mouse sulle card, l'interfaccia "balla":
   - `whileHover={{ y: -6, scale: 1.03 }}` (framer-motion) **alza** la card; se il puntatore è vicino
     al bordo inferiore, la card si sposta da sotto il cursore → `onPointerLeave` sulla sezione →
     `setConsidered(null)` → la card ritorna giù → `onPointerEnter` → loop = flicker.
   - `hotByCandidate(c)` ricrea un `Set` nuovo per **ogni** card a **ogni** render → ri-render a catena.
   - `SynergyTracker` **riordina** le righe tra stato corrente e preview (`.sort` su `active` e ratio)
     → le righe saltano di posizione (reflow).
3. **Estetica anonima.** Nessun carattere forte; le case di Hogwarts non si "sentono".

> Nota: la classe `resa-animated` referenziata in `WizardCard` **non ha animazione base** in
> `globals.css` (solo l'override `prefers-reduced-motion`), quindi oggi non pulsa: non è una causa del
> flicker e non va trattata come tale.

## Obiettivo

Redesign della sola scelta dei pick: card **orizzontali** in **lista roster a colonna unica**, estetica
**cinematografica dominata dalla casata**, e **flicker eliminato**. Mantenere la `WizardCard` verticale
intatta per gli altri schermi.

## Decisioni di design (confermate)

- **Layout card:** lista roster a tutta larghezza (card orizzontali impilate in colonna unica).
- **Sinergie:** rail destra mantenuta ma resa **stabile** (no flicker, no reflow).
- **Estetica:** cinematografica per casata (ogni card dominata dai colori/atmosfera della casa).

## Vincoli / non-obiettivi

- **Non** modificare `WizardCard` (verticale): è usata da `TeamScreen`, `MenuScreen`, `DraftSlot` e dai
  test. Si crea un componente orizzontale **separato e dedicato** al draft.
- **Non** cambiare la logica di gioco (`useDraft`, `synergyProgress`, `previewSynergies`,
  `detectSynergies`). Solo presentazione e gestione stato UI.
- **Nessuna regressione** sugli altri schermi né sugli snapshot di battaglia.
- Rispettare `prefers-reduced-motion`.

## Architettura

### 1. `components/cards/WizardCardRow.tsx` (nuovo)

Card orizzontale a 3 zone, altezza fissa, full-width della colonna candidati.

- **Zona sinistra — ritratto** (~128px largh., altezza piena della card):
  - `PortraitImage` (variant esistente) con overlay `houseTheme(house).gradient` che sfuma dal colore
    casa (sinistra) verso il dark (destra) per leggibilità del testo a destra.
  - `TierBadge` in alto a sinistra; `RoleIcon` dentro `Tooltip` (`roleTooltip`) in basso a sinistra
    (come oggi, comportamento tap/hover su mobile preservato).
- **Zona centro — identità + stat:**
  - Nome (`font-display`, dimensione maggiore della verticale), con chip speciali (`affiliationChips`
    kind `special`) e chip trait (`TRAIT_BY_ID`) inline.
  - 4 stat come barre orizzontali compatte in griglia 2×2 (riuso logica di `StatCell`).
- **Zona destra — incantesimo** (separata da divider):
  - Nome spell + `Chip` tipo (`spellTypeChip`).
  - Numeri chiave da `formatSpellStats` (danno/cooldown ecc.).
  - Effetti da `spellEffectLines` resi come chip-icona compatte (non righe lunghe), per stare
    nell'altezza fissa.

**Frame/estetica casata:** bordo 2px `houseTheme.color` + glow (`boxShadow` con `houseTheme.glow`),
sfondo gradiente dominato dalla casa che sfuma nel dark a destra. Rarità comunicata da `TierBadge`
(coerente con la convenzione esistente: la rarità non colora il frame).

**Altezza:** target ~150px desktop; se l'incantesimo risulta schiacciato in implementazione, salire a
~160px è accettabile (preferire respiro a cifre compresse).

**Responsive:** `flex`; ritratto a larghezza fissa, contenuto in `flex-col`. La zona incantesimo sta a
destra da `sm` in su e **scende sotto le stat** (wrap) su mobile.

**Hover/consider (NIENTE lift):**
- **Nessun `transform` che sposta il bordo** sotto il cursore (causa del flicker). L'hover cambia solo
  `box-shadow`/bordo (glow casata intensificato) ed eventuale sheen via classe CSS.
- Click = pick (riuso `role="button"`, `tabIndex`, gestione tastiera Enter/Spazio come oggi).

**Cella stat:** il nome `StatBar` è già occupato da `components/battle/StatBar.tsx` (API diversa), quindi
la cella stat resta **inline** nella row (piccola, ~12 righe) invece di essere estratta in un componente
condiviso — così `WizardCard` non va toccata. Tutta la formattazione resta nei helper esistenti
(`lib/glossary`, `lib/affiliationChips`, `data/traits`).

### 2. `components/draft/DraftCandidateCard.tsx` (modifica)

- Rimuovere `w-56`; il wrapper diventa full-width (`w-full`).
- Renderizzare `WizardCardRow` invece di `WizardCard`.
- Mantenere `onPointerEnter`/`onFocus` → `onConsider`, `tabIndex`, e `onClick` → `onPick`.

### 3. `components/screens/DraftScreen.tsx` (modifica)

- **Candidati in colonna unica** full-width: `grid-cols-1` (niente `sm:grid-cols-2 lg:grid-cols-3`),
  contenitore max ~640px, card-row impilate con gap.
- **Memoizzare** la mappa `candidateId → hotSynergyIds` con `useMemo` su `[current, picks]`, così i `Set`
  non vengono ricreati a ogni render e le card non hoverate non si ri-renderizzano.
- Mantenere `[1fr_280px]` per la rail su desktop e lo stack su mobile; header sticky invariato.
- `onPointerLeave` sulla sezione resta per azzerare `considered` all'uscita; con il lift rimosso, lo
  spostamento tra card adiacenti non genera più leave spuri.

### 4. `components/draft/SynergyTracker.tsx` (modifica — stabilità)

- **Ordine stabile:** calcolare l'ordine delle righe **una sola volta** (sullo stato corrente, non in
  preview) e **non riordinare** quando arriva il preview. In preview cambiano solo valori/evidenza, non
  la posizione delle righe.
- **Altezza riga fissa:** struttura a altezza costante per evitare reflow quando compare/sparisce
  "SI ATTIVA" o "incluso in tier sup.".
- **Transizione CSS** sulla width della barra di avanzamento (es. `transition: width 180ms ease`), così
  l'avanzamento è fluido invece che a scatti.
- Logica di dominio invariata (famiglie/superseded, testo bonus): cambia solo la stabilità visiva.

### 5. `app/globals.css` (modifica)

- Definire la classe di **sheen/glow hover** usata dalla row (es. gradiente animato leggero o
  brightening del bordo) — **GPU-friendly**, senza proprietà che causano layout shift.
- Rispettare `prefers-reduced-motion` (disattivare lo sheen, mantenere il solo stato statico).
- Opzionale: rimuovere/neutralizzare `resa-animated` se non più usata dalla card, oppure definire una
  pulse soft senza reflow se la si mantiene.

## Flusso dati (invariato lato gioco)

`useDraft(seed)` → `current` (candidati), `picks`, `pick(i)`.
`synergyProgress(picks)` → righe correnti; `previewSynergies(picks, candidate)` → righe preview.
Il redesign tocca solo **come** questi dati vengono renderizzati e **quando** lo stato `considered`
provoca re-render, non i loro valori.

## Gestione errori / edge case

- **Senza chip speciali / senza trait:** le rispettive sezioni non vengono renderizzate (come oggi).
- **Nome lungo:** truncate con ellissi nella zona identità.
- **Molti effetti spell:** le chip-icona effetto vanno a capo (wrap) entro la zona; i numeri chiave
  restano prioritari e sempre visibili.
- **Mobile stretto:** zona incantesimo sotto le stat; ritratto rimpicciolito ma leggibile.
- **`prefers-reduced-motion`:** niente animazioni d'ingresso aggressive né sheen.

## Testing

- **Unit/render (Vitest + RTL):** un nuovo test per `WizardCardRow` che verifica presenza di nome, 4
  stat, nome incantesimo, chip trait quando presenti, e badge ruolo. Riuso dei pattern di
  `tests/ui/wizardCard.test.tsx`.
- **Regressione:** la suite esistente di `WizardCard` deve restare verde (componente non toccato).
- **Snapshot battaglia:** invariati (nessuna modifica al motore).
- **Verifica manuale:** hover ripetuto sulle card → nessun flicker; passaggio tra card adiacenti
  fluido; tracker senza salti di riga; layout corretto a desktop e mobile.

## File toccati (riepilogo)

| File | Azione |
|------|--------|
| `components/cards/WizardCardRow.tsx` | **nuovo** — card orizzontale cinematografica |
| `components/draft/DraftCandidateCard.tsx` | rende la row, full-width |
| `components/screens/DraftScreen.tsx` | colonna unica + memo `hotByCandidate` |
| `components/draft/SynergyTracker.tsx` | ordine stabile, altezze fisse, transizioni |
| `app/globals.css` | sheen/glow hover no-flicker, reduced-motion |
| `tests/ui/wizardCardRow.test.tsx` | **nuovo** — render test della row |
| `components/cards/WizardCard.tsx` | **invariato** (verticale, altri schermi) |
