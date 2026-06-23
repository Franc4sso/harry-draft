# Compendio — Guida visibile per Magie, Reliquie e Sinergie

**Status:** Approved (brainstorm) — pending implementation plan
**Date:** 2026-06-23

## Problema

Il gioco definisce 48 magie, 24 reliquie, 21 sinergie con dati ricchi (descrizioni,
potenza, effetti, bonus). Ma quasi nulla raggiunge il giocatore:

- **Magie**: `WizardCard` mostra solo `spell.type` + `spell.name`. `desc`, `power`,
  `heal`, `hitChance`, `cooldown`, `effects[]`/`spec[]` sono nei dati ma mai resi.
- **Sinergie**: `TeamScreen` mostra solo il nome. I bonus (calcolati in
  `applyBonuses`) e i membri coinvolti non si vedono mai. Nessun campo `desc`.
- **Reliquie**: già mostrate bene (`RelicCard` desc completa, `RelicBar` tooltip).
  Miglioria minima: chip rarità coerente.
- **Guida `/rules`**: 5 paragrafi hardcoded. Niente glossario dei termini, niente
  liste consultabili.

Obiettivo: rendere tutto **chiaro** al giocatore, con un look moderno e accattivante.

## Direzione visiva — "Il Compendio"

Estende il sistema esistente (NON lo sostituisce): sfondo `#070a10`, panel `#0e1320`,
classe `.glass`, glow per casa, Cinzel (display) + Inter (body/utility), colori tier
già definiti.

**Elemento firma**: il **Chip** — pillola con icona + label + colore-categoria, che
appare nelle superfici di questo scope (WizardCard, TeamScreen, Compendio, e rarità
reliquie). Stesso termine = stesso colore/icona ovunque. È il vocabolario coerente
dell'interfaccia: il giocatore impara una volta, riconosce sempre. Il battle log resta
fuori scope (vedi Non-goals).

**La boldness è concentrata nella pagina Compendio** (`/rules`). In-game resta pulito
e leggibile.

## Componenti

### 1. `lib/glossary.ts` — single source of truth (logica pura, no React)

Tutto derivato dai dati esistenti, niente nuovi campi da mantenere a mano.

```ts
// metadati per categoria
export const SPELL_TYPE_META: Record<SpellType, { color: string; icon: IconName; blurb: string }>
export const STATUS_META: Record<string, { label: string; color: string; icon: IconName; blurb: string }>
//   chiavi: kind di SpellEffect ('buff'|'debuff'|'dot'|'stun') + StatusKind
//   ('freeze'|'silence'|'disarm'|'regen'|'shield')

// formatter puri
export function formatSpellStats(spell: Spell): Array<{ label: string; value: string }>
//   es. [{label:'Pot', value:'25'}, {label:'Prec', value:'90%'}, {label:'CD', value:'1'}]
//   omette campi assenti (heal solo se presente, ecc.)

export function spellEffectChips(spell: Spell): Array<{ label: string; color: string; icon: IconName }>
//   legge spell.effects[] (legacy) E spell.spec[] (nuovo), de-duplica, mappa via STATUS_META

export function synergyBonusText(bonus: SynergyBonus): string[]
//   atk:10 -> '+10 ATK'; allPct:0.1 -> '+10% a tutte le stat'; regen:5 -> 'Rigenera 5/turno'
//   solo i campi presenti, > 0
```

`IconName` = sottoinsieme di nomi icone lucide-react (già dipendenza del progetto).

**Mappatura effetti → label IT (in STATUS_META):**
`buff`→"Potenzia", `debuff`→"Indebolisce", `dot`→"Danno nel tempo",
`stun`→"Stordimento", `freeze`→"Congela", `silence`→"Silenzio",
`disarm`→"Disarma", `regen`→"Rigenera", `shield`→"Scudo".
(blurb una riga ciascuno per il glossario)

### 2. `components/ui/Chip.tsx` — elemento firma

```tsx
function Chip({ label, color, icon, size = 'sm' }: {
  label: string; color: string; icon?: IconName; size?: 'sm' | 'md'
}): JSX.Element
```

Pillola: icona lucide opzionale + label, bordo/testo nel colore-categoria, glow tenue
(`box-shadow: 0 0 12px ${color}33`). Stile coerente con `RelicBar` esistente.

### 3. In-game (pulito, leggibile)

- **`WizardCard.tsx`**: il blocco magia (righe 65-68) cresce a:
  - eyebrow `spell.type` colorato (via SPELL_TYPE_META)
  - nome magia
  - `spell.desc` (testo piccolo, 1-2 righe)
  - riga stats compatta da `formatSpellStats`
  - riga chip effetti da `spellEffectChips` (se presenti)
  - La card cresce ~40-60px in altezza; il layout flex regge.

- **`TeamScreen.tsx`**: ogni sinergia attiva diventa una riga in `GlowPanel`:
  - nome sinergia (Cinzel)
  - chip dei bonus da `synergyBonusText`
  - nomi dei membri (da `memberIds` risolti contro `team`)
  - Empty state invariato ("Nessuna sinergia attiva.").

- **`RelicCard.tsx` / `RelicBar.tsx`**: aggiungono `Chip` per la rarità (colore già
  in `RELIC_RARITY_COLOR`). Cambiamento minimo, desc resta.

### 4. Compendio — `/rules` riscritto (il wow-moment)

`RulesScreen.tsx` diventa un grimorio navigabile:

- **Hero**: titolo Cinzel "Compendio" + intro breve (1-2 frasi).
- **Glossario**: griglia di `Chip` per categoria con blurb — la legenda dei termini:
  tipi magia (4), status/effetti (9), rarità reliquie (4), tipi sinergia (4 kind).
- **Sezioni navigabili** (tab o ancore a scelta in fase di plan):
  - **Magie**: 48 magie raggruppate per `type`, ognuna con desc, stats, chip effetti.
  - **Reliquie**: 24 raggruppate per rarità, con desc.
  - **Sinergie**: 21 raggruppate per `kind`, con requisito (es. "3+ Grifondoro")
    e bonus auto-generati da `synergyBonusText`.
- Carte `glass`, micro-hover discreti, `prefers-reduced-motion` rispettato.
- Mantiene le 5 sezioni-regole esistenti (Draft/Tier/Stats/Sinergie/Combattimento) in
  cima come "Come si gioca".

- **`MenuScreen.tsx`**: il link esistente a `/rules` viene rinominato/confermato come
  "Compendio" (o resta "Regole" — decisione di copy in plan).

## Data flow

```
data/{spells,relics,synergies}.ts  (invariati)
        │
        ▼
lib/glossary.ts  (formatter puri: stats, chip effetti, testo bonus, metadati)
        │
   ┌────┴───────────────┬──────────────────┐
   ▼                    ▼                   ▼
WizardCard          TeamScreen          RulesScreen (Compendio)
(+ Chip)            (+ Chip)            (+ Chip, liste complete)
```

Nessun cambiamento a engine, tipi di dominio, o file `data/`. Solo presentazione +
un modulo di formattazione puro.

## Error handling / edge cases

- Magia senza effetti → nessuna riga chip (non riga vuota).
- Magia senza `power`/`heal`/`cooldown` → quei campi omessi da `formatSpellStats`.
- Sinergia con bonus vuoto → improbabile dai dati, ma `synergyBonusText` ritorna `[]`
  e la riga mostra solo nome+membri.
- `memberIds` che non risolve un wizard nel team → skip silenzioso (difensivo).
- Effetto con `kind` non in `STATUS_META` → fallback label = kind grezzo, colore neutro.

## Testing

- **`lib/glossary.ts`** (unit, TDD): `formatSpellStats` (campi presenti/assenti, %),
  `spellEffectChips` (legacy effects, nuovo spec, dedup, kind sconosciuto),
  `synergyBonusText` (stat singole, allPct, regen, combinazioni, bonus vuoto).
- **`Chip`** (smoke): render con/senza icona.
- **`RulesScreen`/Compendio** (smoke): render senza crash; tutte le categorie del
  glossario presenti; conta voci magie/reliquie/sinergie = lunghezza dati.
- **`WizardCard`/`TeamScreen`** (smoke): render con magia con effetti e sinergie attive.

## Non-goals (YAGNI)

- Niente tooltip/hover/modal in-game (scelta: inline sempre visibile).
- Niente campo `desc` manuale per le sinergie (auto-generato dai bonus).
- Niente ricerca/filtri nel Compendio (liste statiche raggruppate bastano).
- Niente icone di stato animate in battaglia (fuori scope; il battle log resta com'è,
  eventualmente solo chip coerenti se banale).
- Nessun sistema di costo/mana (non esiste nel gioco).
```