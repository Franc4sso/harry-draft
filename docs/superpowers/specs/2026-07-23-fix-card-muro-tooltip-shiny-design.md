# Fix card: collisione "Muro", tooltip, shiny foil — Design

**Data:** 2026-07-23
**Scope:** 3 fix UI sulle wizard card. Nessun impatto motore/bilanciamento. Feature separata da Patto Oscuro (spec `2026-07-23-patto-oscuro-archetipo-design.md`, in pausa).

## Problema 1 — collisione "Muro"

Due fonti VIVE della parola "Muro" sulle card:

- **Nastro archetipo** — `ARCHETYPE_BY_TAG.scudirigen.name = 'Muro'` (`lib/archetypes.ts:6`), reso in `WizardCardColumn.tsx:241`. **Resta**: è l'archetipo che merita il nome.
- **Pill segnale taunt** — `CARD_SIGNAL_LABEL.taunt = 'Muro'` (`components/cards/DuoSignalMarks.tsx:16`). Concetto diverso ("chi viene attaccato per primo"), mostrato su Goyle e ogni Tank. **Rinominato "Bersaglio".**

Nota: `lib/wizardEpithet.ts` (`Tank: 'Muro della squadra'`) NON è reso su nessuna card (dead path) — ignorato.

### Modifiche
1. `DuoSignalMarks.tsx:16` — `CARD_SIGNAL_LABEL.taunt: 'Muro'` → `'Bersaglio'`.
2. `DuoSignalMarks.tsx:37-40` — rimuovere la special-case anti-doppione della fix M1 (`hasScudirigenRibbon` + drop `taunt`): con "Bersaglio" non c'è più collisione di parola, quindi torna al semplice filtro `!ARCHETYPE_SIGNAL_IDS.has(s)`. Aggiornare il JSDoc (rimuovere la spiegazione della collisione "Muro").
3. `WizardCardColumn.tsx:284-291` — aggiornare il commento (rimuovere il riferimento alla collisione/soppressione taunt).
4. `WizardCardRow.tsx:113` — passare `excludeArchetypeSignals` a `DuoSignalMarks` come fa la Column, così un Tank scudirigen sulla Row non mostra pill ridondanti (tag `scudirigen` + `taunt`). Coerenza tra i due layout.
5. Test da aggiornare: `tests/ui/duoSignalMarks.test.tsx` (i 2 test M1 sulla soppressione taunt vanno riscritti: ora la pill "Bersaglio" sopravvive sempre per un Tank; il filtro tag resta), `tests/ui/wizardCard.test.tsx`.

## Problema 2 — tooltip mancanti

`components/ui/Tooltip.tsx` esiste (hover + tap, mobile-safe). Usato solo nella card Row. La Column/poster non lo importa. `ArchetypeTracker` nessun tooltip.

### Modifiche
Avvolgere con `Tooltip` (o aggiungere trigger tooltip a) questi elementi:

1. **Nastro archetipo (Column)** `WizardCardColumn.tsx:231-243` — contenuto tooltip:
   - se il tag ha `synergyId` → `ARCHETYPE_EFFECT[synergyId]` (es. scudirigen → bastione → "Muro riflettente: chi ha uno scudo rimanda il danno assorbito.").
   - se il tag NON ha `synergyId` (oggi `magieOscure`) → fallback generico `Archetipo: ${name}`.
   - helper condiviso, es. `archetypeTooltip(tag)` in `lib/archetypes.ts`, così tracker e card usano lo stesso testo.
2. **Pill segnali / Bersaglio** `DuoSignalMarks.tsx:47-56` — tooltip per-segnale che spiega cosa fa (es. taunt/Bersaglio → "I nemici lo attaccano per primo."). Serve una mappa `SIGNAL_BLURB` (o riuso di descrizioni Duo esistenti).
3. **Role badge (Column)** `WizardCardColumn.tsx:225-227` — tooltip col significato del ruolo (riuso `roleTooltip` già usato nella Row `WizardCardRow.tsx:96-102`).
4. **Righe ArchetypeTracker** `ArchetypeTracker.tsx:64-94` — tooltip su ogni riga con l'effetto della Costellazione (stesso `ARCHETYPE_EFFECT`/helper).

Vincolo: il `Tooltip` è un `<button>` che ferma la propagazione — sicuro dentro una card cliccabile (draft pick). Non annidare tooltip dentro altri button.

## Problema 3 — shiny "brutto" → foil coeso

Stato attuale (4 effetti sovrapposti che stonano):
- Emoji ✨ grezza accanto al nome (`WizardCardColumn.tsx:262`, `WizardCardRow.tsx:111`).
- **Due** layer di glow oro: `shinyGlow` box-shadow sul frame (`WizardCardColumn.tsx:60-61,89-91`) + un secondo overlay inset (`WizardCardColumn.tsx:266-268`). Oro-su-oro sopra un frame tier-1 già dorato.
- Pill tratto **blu** che stona col contorno oro e duplica l'epiteto già nel nome (`WizardCardColumn.tsx:273-282`, `WizardCardRow.tsx:153-167`).
- Valori glow hardcoded in ogni componente (non tematizzati).

### Modifiche (direzione: foil polish coeso)
1. **Rimuovere la pill tratto blu** in entrambi i layout (`WizardCardColumn.tsx:273-282`, `WizardCardRow.tsx:153-167`). L'epiteto è già nel nome via `displayName`. Il nome del tratto può restare nel tooltip shiny (vedi sotto), non come pill che stona.
2. **Un solo glow oro coeso**: rimuovere l'overlay inset doppio (`WizardCardColumn.tsx:266-268`); tenere un unico trattamento foil. Estrarre i valori in `lib/theme.ts` come token condiviso (es. `SHINY_FOIL`), usato da Column e Row.
3. **Marcatore foil pulito** al posto dell'emoji ✨ grezza: un piccolo badge/glifo dorato coerente col design (non emoji Unicode). Applicato accanto al nome in entrambi i layout.
4. **Tooltip shiny** sul marcatore: mostra `shinyTrait.name` + `shinyTrait.desc` (recuperando l'info tolta dalla pill). Riusa `Tooltip`.

## Test

- `tests/ui/duoSignalMarks.test.tsx` — "Bersaglio" invece di "Muro"; filtro tag ancora attivo; niente più special-case scudirigen.
- `tests/ui/wizardCard.test.tsx` — nastro con tooltip; niente doppio "Muro"; shiny senza pill blu, con marcatore + tooltip.
- Nuovo/aggiornato test tooltip archetipo: `archetypeTooltip(tag)` ritorna effetto per tag con synergyId, fallback per tag senza.
- `ArchetypeTracker` test — righe con tooltip.
- Suite piena + typecheck (nuovi file TS/TSX): nessuna regressione.

## Rischio

Basso. Tutto UI + un helper puro (`archetypeTooltip`). Zero motore, zero bilanciamento. Watch-item: i test UI M1 esistenti vanno riscritti (non semplicemente cancellati) perché il comportamento della pill cambia da "soppressa" a "rinominata".
