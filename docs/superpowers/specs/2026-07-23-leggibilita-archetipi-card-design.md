# Spec — Leggibilità archetipi: card redesign + Costellazioni

_Data: 2026-07-23 · Dinamismo build / leggibilità · Tipo: UI (card + rail) + 1 funzione motore pura_

Obiettivo: far **vedere** al giocatore quale archetipo un mago alimenta (sulla card) e lo **stato di squadra**
dell'archetipo (rail): quanto vicino sei ad accenderlo (2/3), quando è attivo, cosa fa. Oggi è tutto invisibile.

---

## 1. Problema (verificato sul codice)

- L'attivazione archetipo (sinergia a 3 tag) è **invisibile nel gioco vivo**: nessun UI mostra "Veleno 2/3" o
  "Muro attivo". La funzione che conterebbe "2/3" **non esiste** — `membersFor` (synergy.ts:4) ritorna `null`
  sotto soglia, butta via il conteggio parziale. `detectSynergies` dà solo gli attivi.
- La card mostra già una pill per tag (`DuoSignalMarks`), ma col nome del *segnale* ("Scudo/Rigen"), non
  dell'*archetipo* ("Muro"). E la rarità (TierBadge) non è mostrata graficamente (bordo = casata).

## 2. Design (deciso — vedi mockup `.superpowers/design/rarity-borders.html`)

### 2a. La card — tre identità cromatiche, mai in conflitto
- **Bordo = RARITÀ** (nuovo): cornice costruita per grado, la ricchezza vive nella cornice (niente gemme d'angolo).
  - Comune: peltro sobrio + doppia hairline. Raro: argento spazzolato + edge-luce + alone blu.
  - Epico: ametista + filigrana (top/bottom center) + alone viola. Leggendario: oro stratificato + corona + shimmer lento (unica animazione, `prefers-reduced-motion` la spegne).
- **Dentro = CASATA**: bg wash sfumato dal top nel colore casata (Grifondoro rosso `#ae0001`, Serpeverde
  verde `#1a472a`, Corvonero blu `#222f5b`, Tassorosso giallo `#ecb939`). NB: oggi il *bordo* è la casata
  (`houseTheme`) — questo redesign SPOSTA la casata dentro (wash) e dà il bordo alla rarità. Verificare che
  la lettura casata resti chiara col wash.
- **Nastro = ARCHETIPO**: banner in alto-destra, glifo + nome FANTASIA: `☠ Veleno`, `⛨ Muro`, `✖ Carnefice`,
  `☾ Magie Oscure`. Colore del segno (verde/blu/rosso/viola). Convive col wash + bordo (angoli distinti).

### 2b. Le Costellazioni — il tracker di squadra (rail draft/recruit)
- Gemello del DuoTracker, montato accanto ad esso (`DraftScreen.tsx:76`, `RecruitScreen.tsx:164`).
- Mostra i **3 archetipi con un sistema vero**: Veleno, Carnefice, Muro (NON Oscurità — vedi §2c).
- Per ognuno: 3 "stelle" (pip), il conteggio `have/3`, lo stato:
  - **Attivo (3/3):** sigillo brilla, badge "Attivo", + cosa fa (l'effetto).
  - **Vicino (2/3):** "↳ recluta 1 mago [tag] per accenderlo".
  - **Sopito (0-1):** spento, discreto.
- Aggiorna in tempo reale quando consideri un candidato (come il DuoTracker usa `considered`).

### 2c. Naming e Magie Oscure (decisi)
- **Nome = fantasia** (Veleno/Muro/Carnefice), non il nome sinergia (Tossicità/Bastione/Spietatezza).
- **Mappatura tag → nome fantasia:** `veleno`→Veleno, `esecuzione`→Carnefice, `scudirigen`→Muro, `magieOscure`→Magie Oscure.
- **Magie Oscure:** il nastro `☾ Magie Oscure` c'è sulla card (il tag esiste), MA NON appare nelle Costellazioni
  (non esiste una sinergia Oscurità — il 3° archetipo Patto Oscuro non è fatto). Onesto: tag sì, sistema non ancora.

## 3. Architettura

### 3a. Il motore — `synergyProgress` (nuova funzione pura, `game/engine/synergy.ts`)
Oggi manca "2/3". Aggiungere accanto a `detectSynergies`:
```ts
export interface SynergyProgress { synergy: Synergy; have: number; need: number; active: boolean; memberIds: string[] }
export function synergyProgress(team: DraftedWizard[]): SynergyProgress[] {
  return SYNERGIES.map(syn => {
    const req = syn.requires
    const need = req.count ?? 3
    const matched = team.filter(d =>
      (req.house ? d.wizard.house === req.house : true) &&
      (req.role ? d.wizard.role === req.role : true) &&
      (req.tag ? (d.wizard.tags ?? []).includes(req.tag) : true),
    )
    return { synergy: syn, have: matched.length, need, active: matched.length >= need, memberIds: matched.map(d => d.wizard.id) }
  })
}
```
Pura, no RNG. Replica la logica di conteggio di `membersFor` (synergy.ts:8-15) ma espone `have` sotto soglia.
NB: usa `livingOf` come i tracker esistenti se il team può avere morti (verificare il pattern del DuoTracker).

### 3b. La mappatura tag→archetipo-fantasia (nuovo helper, `lib/`)
```ts
// tag → { name (fantasia), glyph, color }. magieOscure incluso (nastro) ma senza sinergia.
export const ARCHETYPE_BY_TAG: Record<string, { name: string; glyph: string; color: string; synergyId?: string }> = {
  veleno:      { name: 'Veleno',      glyph: '☠', color: '#7ddc7d', synergyId: 'tossicita' },
  esecuzione:  { name: 'Carnefice',   glyph: '✖', color: '#ff8a7a', synergyId: 'spietatezza' },
  scudirigen:  { name: 'Muro',        glyph: '⛨', color: '#7db7ff', synergyId: 'bastione' },
  magieOscure: { name: 'Magie Oscure',glyph: '☾', color: '#b98cff' },  // no synergyId → no Costellazione
}
```

### 3c. La card — `WizardCardColumn.tsx`
- **Bordo rarità:** applicare la cornice per `wizard.tier` (già `tierColor`/`tierLabel` in theme.ts). I 4 stili dal mockup, come CSS. NB: oggi il bordo è `houseTheme` (`WizardCardColumn.tsx:45,71-74`) — sostituirlo col bordo-rarità e spostare la casata a wash interno.
- **Wash casata:** bg wash sfumato interno dal `houseTheme(wizard.house).color`.
- **Nastro archetipo:** dai tag del mago, per ogni tag in `ARCHETYPE_BY_TAG` un nastro (glifo+nome). Se più tag, impilare o mostrare il primario (decidere in impl; i mockup mostrano 1 nastro primario). Sostituisce/affianca `DuoSignalMarks`.
- L'animazione shimmer del leggendario: con `framer-motion` (già nel progetto) o CSS keyframe, spenta da `prefers-reduced-motion`.

### 3d. Le Costellazioni — nuovo componente (`components/draft/ArchetypeTracker.tsx` o simile)
- Consuma `synergyProgress(team)` + `ARCHETYPE_BY_TAG` (per nome/glifo/colore/effetto).
- Filtra ai 3 archetipi con `synergyId` (Veleno/Carnefice/Muro) — Magie Oscure escluso.
- Riceve `considered` (candidato in hover) come il DuoTracker → ricalcola con `[...team, considered]`.
- L'effetto mostrato ("riflette il danno", "valanga di uccisioni", "il veleno vince la corsa") — testo per archetipo, in un piccolo dizionario.
- Montato accanto al DuoTracker in `DraftScreen`/`RecruitScreen`.

## 4. Cosa NON facciamo (YAGNI)

- Nessuna sinergia Oscurità (Patto Oscuro è un progetto futuro).
- Nessuna modifica al motore di combat (synergyProgress è puro, solo per UI).
- Nessun tracker archetipo in combat (solo draft/recruit rail — il combat è separato).
- Nessun asset immagine (bordi/gemme sono CSS/SVG puro, self-contained).

## 5. Testing

- **synergyProgress (puro):** 3 tag → have=3 active; 2 tag → have=2 active=false; 0 → have=0. Per ogni sinergia.
- **ARCHETYPE_BY_TAG:** mappatura corretta, magieOscure senza synergyId.
- **Card (componente):** un mago `scudirigen` mostra nastro `⛨ Muro`; un `veleno` mostra `☠ Veleno`; il bordo riflette `tier` (T1 leggendario ≠ T4 comune); il wash riflette la casata. `magieOscure` mostra nastro ma è comunque un tag valido.
- **Costellazioni:** con 2 maghi veleno → riga Veleno "2/3, recluta 1"; con 3 → "Attivo" + effetto. Magie Oscure NON appare. Aggiorna con `considered`.
- **Retrocompat:** le card esistenti (senza tag archetipo) non si rompono; il redesign bordo non rompe i test card esistenti (potrebbero asserire il vecchio bordo casata — aggiornarli).
- **Reduced-motion:** lo shimmer leggendario si spegne.
- Suite completa verde; nessun impatto motore di combat/bilanciamento (synergyProgress è UI-only).

## 6. File toccati (previsti)

- `game/engine/synergy.ts` — `synergyProgress` + tipo `SynergyProgress`.
- `lib/archetypes.ts` (nuovo) — `ARCHETYPE_BY_TAG` + dizionario effetti.
- `components/cards/WizardCardColumn.tsx` — bordo-rarità, wash-casata, nastro-archetipo (sostituisce DuoSignalMarks o lo affianca).
- `components/draft/ArchetypeTracker.tsx` (nuovo) — le Costellazioni.
- `components/screens/DraftScreen.tsx` + `RecruitScreen.tsx` — montare ArchetypeTracker accanto al DuoTracker.
- Test: `synergyProgress`, `archetypes`, card, ArchetypeTracker; aggiornare i test card che asseriscono il vecchio bordo.

## 7. Rischi

- **Redesign bordo casata→rarità:** il bordo era la casata; spostarla a wash potrebbe indebolire la lettura casata. Mitigare col wash abbastanza saturo (testato nei mockup). Aggiornare i test card che asseriscono `data-house`/bordo casata.
- **DuoSignalMarks:** il nastro archetipo sostituisce/duplica le pill esistenti — decidere se rimuovere DuoSignalMarks (il nastro copre gli archetipi; i segnali Duo role-based come 'taunt' restano scoperti). Valutare in impl: forse nastro archetipo + DuoSignalMarks solo per i segnali non-archetipo.
- **Bilanciamento:** ZERO (tutto UI, synergyProgress non tocca il combat).
- **Feel:** da validare al playtest — le Costellazioni chiariscono davvero "come/quando si attiva"? Il redesign card è più bello o solo diverso?
