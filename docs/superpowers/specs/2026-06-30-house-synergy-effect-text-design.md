# Tag sinergia-casa: effetto mostrato + colori della casata — design

> Data: 2026-06-30. Richiesta utente: (1) nel draft (e un po' ovunque) il tag della sinergia-CASA non mostra
> l'effetto accanto, mentre le altre sinergie (ruolo/gruppo) sì → mostrarlo ovunque, da una fonte unica.
> (2) Colorare il tag-casa coi colori della casata (oggi tutti i tag sono oro uniforme).
>
> Due parti dello stesso obiettivo: rendere il tag-sinergia-casa informativo (TESTO effetto + COLORE casa).
> Parte A = testo effetto. Parte B = colori-casa. Possono essere due slice/plan separati o uno solo (decisione
> plan-time); condividono i call-site del rendering tag.

## Diagnosi (verificata)

`synergyBonusText(bonus: SynergyBonus)` (`lib/glossary.ts:86-95`) genera il testo-effetto SOLO dal `bonus`
numerico (hp/atk/def/spd/allPct/regen). Le sinergie-casa hanno `bonus: {}` VUOTO (`data/synergies.ts:5-13`)
perché i loro effetti vivono in `game/engine/houseEffects.ts` (dodge/crit/riduzione/cunning), non come bonus
statistico. Quindi `synergyBonusText({})` → `[]` → nessun testo accanto al tag-casa. Le sinergie ruolo/gruppo
hanno `bonus` popolato → testo mostrato. Tassorosso è ibrido: mostra `Rigenera 6/turno` (dal suo `regen`) ma
NON la riduzione-danno (che è in houseEffects).

I 7 call-site passano tutti `synergy.bonus` ma hanno la `Synergy` intera a portata di mano:
`SynergyGraph.tsx:84`, `RecruitScreen.tsx:58`, `TeamSynergyBar.tsx:10`, `SynergyTracker.tsx:50`,
`TeamScreen.tsx:49`, `SynergyRibbon.tsx:40` (+ `compendium/SynergyGraph` usa `active.bonus`).

## Decisioni (chiuse con l'utente)

1. **Fonte unica**: il fix vive in `synergyBonusText`; tutti i posti che mostrano il tag lo leggono → coerenza.
2. **Descrizione DERIVATA dai valori reali** di `houseEffects.ts` per casa+tier (non testo statico) → se si
   ritara il balance, il testo si aggiorna da solo; mostra il numero esatto per tier.
3. **Fraseggio approvato**: `Schivata +8%` / `Critico 26% (×2.0)` / `Riduzione danno 16%` /
   `+18% danno a feriti`.

## Architettura

### 1. Esporre i valori-casa da `houseEffects.ts`
Le costanti `GRYFF_DODGE`/`RAVEN_CRIT`/`HUFF_REDUCE`/`SLYTH_CUNNING` (righe 20-23) sono private. Aggiungere
un helper PURO esportato che formatta l'effetto per casa+tier, così `glossary.ts` non duplica i numeri:
```ts
// houseEffects.ts — nuovo export
export function houseEffectText(house: House, tier: 0 | 1 | 2): string | null {
  switch (house) {
    case 'Grifondoro':  return `Schivata +${Math.round(GRYFF_DODGE[tier]! * 100)}%`
    case 'Corvonero': {
      const c = RAVEN_CRIT[tier]!
      // mult è il danno EXTRA del crit; il moltiplicatore mostrato è 1+mult (×2.0 per mult 1.0).
      return `Critico ${Math.round(c.chance * 100)}% (×${(1 + c.mult).toFixed(1)})`
    }
    case 'Tassorosso':  return `Riduzione danno ${Math.round(HUFF_REDUCE[tier]! * 100)}%`
    case 'Serpeverde':  return `+${Math.round(SLYTH_CUNNING[tier]!.bonus * 100)}% danno a feriti`
  }
}
```
- Vive in houseEffects.ts (fonte dei numeri) → niente duplicazione; il testo segue il balance.
- Tier: indice 0/1/2 per 2/3/4 membri (stesso schema del `TIER` helper già presente, riga 6).

### 2. `synergyBonusText` riceve la `Synergy` intera
Cambiare la firma: `synergyBonusText(synergy: Synergy): string[]`.
```ts
export function synergyBonusText(synergy: Synergy): string[] {
  const out: string[] = []
  const bonus = synergy.bonus
  for (const stat of ['hp', 'atk', 'def', 'spd'] as Stat[]) {
    const v = bonus[stat]; if (v) out.push(`+${v} ${STAT_LABEL[stat]}`)
  }
  if (bonus.allPct) out.push(`+${Math.round(bonus.allPct * 100)}% a tutte le statistiche`)
  if (bonus.regen) out.push(`Rigenera ${bonus.regen}/turno`)
  // Effetto-casa derivato (le sinergie-casa hanno bonus vuoto ma effetto in houseEffects).
  if (synergy.kind === 'house' && synergy.requires.house) {
    const tier = (synergy.requires.count ?? 2) - 2  // 2/3/4 → 0/1/2
    if (tier >= 0 && tier <= 2) {
      const t = houseEffectText(synergy.requires.house, tier as 0 | 1 | 2)
      if (t) out.push(t)
    }
  }
  return out
}
```
- Importa `houseEffectText` da `@/game/engine/houseEffects` e i tipi `Synergy`/`House`.
- Tassorosso ora mostra DUE righe (`Rigenera 6/turno` dal bonus + `Riduzione danno X%` dall'effetto-casa) —
  corretto, sono due effetti reali distinti.
- ⚠️ Direzione import: `lib/glossary.ts` importerà da `game/engine/houseEffects.ts`. Verificare nel plan che
  questo non crei un ciclo (glossary è UI-helper, houseEffects è engine puro che NON importa glossary →
  nessun ciclo atteso). `houseEffectText` è puro, nessuna dipendenza UI.

### 3. Aggiornare i 7 call-site
Cambiare l'argomento da `…bonus` a la Synergy intera:
- `SynergyGraph.tsx:84` `synergyBonusText(active.bonus)` → `synergyBonusText(active)` (verificare che `active`
  sia la Synergy; se è `{bonus}` parziale, passare l'oggetto Synergy disponibile lì).
- `RecruitScreen.tsx:58` `p.synergy.bonus` → `p.synergy`.
- `TeamSynergyBar.tsx:10` `s.synergy.bonus` → `s.synergy` (rimuovere il guard `s.synergy.bonus ?` che ora è
  sempre vero — la funzione gestisce bonus vuoto).
- `SynergyTracker.tsx:50` `r.synergy.bonus` → `r.synergy`.
- `TeamScreen.tsx:49` `s.synergy.bonus` → `s.synergy`.
- `SynergyRibbon.tsx:40` `s.synergy.bonus` → `s.synergy`.
- tsc conferma che ogni call-site è aggiornato (la firma cambia tipo).

## Testing

- **`houseEffectText`** (unit, `tests/engine/houseEffectText.test.ts`): per ogni casa, tier 0/1/2 → stringa
  attesa coi valori reali (es. Grifondoro t1 → `Schivata +8%`; Corvonero t1 → `Critico 26% (×2.0)`;
  Tassorosso t1 → `Riduzione danno 16%`; Serpeverde t1 → `+18% danno a feriti`). Aggancia il testo ai numeri
  reali: se un valore cambia, il test va aggiornato (intenzionale — lega testo↔balance).
- **`synergyBonusText`** (`tests/lib/synergyText.test.ts` o esistente): una sinergia-casa (es. gryffindor3)
  → l'array include la riga schivata; una sinergia-ruolo (es. attackers3) → invariata (`+15 Attacco`);
  Tassorosso3 → include SIA `Rigenera 12/turno` SIA `Riduzione danno 16%`.
- **Determinismo/coerenza**: nessuna RNG. tsc pulito (firma cambiata → ogni call-site aggiornato).
- **Regressione UI**: i test schermo esistenti (RecruitScreen/TeamScreen/SynergyTracker) restano verdi; ora
  mostrano testo dove prima era vuoto (aggiornare eventuali asserzioni che verificavano l'ASSENZA di testo).
- Suite piena verde.

## Rischi / note

- **Nessun impatto balance**: è puramente presentazione (testo). I valori-effetto non cambiano.
- **Import engine→UI**: glossary (lib) importa houseEffects (engine). Engine non importa lib → niente ciclo;
  confermare in implementazione.
- **Crit mult fraseggio**: `RAVEN_CRIT.mult` è il danno EXTRA (0.70/1.00/1.30). Mostrato come `×(1+mult)`
  (×1.7/×2.0/×2.3) — il moltiplicatore totale del colpo critico, leggibile dal giocatore.

---

# Parte B — Colori della casata sul tag

## Decisioni (chiuse con l'utente)

- **Solo i tag-CASA** prendono il colore della casata (bordo + sfondo-tenue); ruolo/gruppo restano oro.
- **Testo chiaro** (leggibilità preservata) — NON pillola piena.
- **Palette = quella canonica già esistente** in `components/ui/HouseCrest.tsx` (`CREST`: ring+fill per casa).
  Riuso, non reinvento.

## Architettura

### B1. Estrarre la palette-casa in una fonte condivisa
Oggi `CREST` è privato dentro `HouseCrest.tsx`. Spostare la mappa in un modulo condivisibile (es.
`lib/houseTheme.ts`) ed esportarla; `HouseCrest.tsx` la importa (resa invariata). Una sola fonte per i
colori-casa.
```ts
// lib/houseTheme.ts
import type { House } from '@/types'
export const HOUSE_COLORS: Record<House, { ring: string; fill: string }> = {
  Grifondoro: { ring: '#ae0001', fill: '#ffc500' },
  Serpeverde: { ring: '#1a472a', fill: '#9fd6a8' },
  Corvonero:  { ring: '#222f5b', fill: '#7db7ff' },
  Tassorosso: { ring: '#ecb939', fill: '#372e29' },
}
```
(HouseCrest mantiene i `glyph` SVG localmente; solo ring/fill si condividono.)

### B2. Helper colore-tag per una sinergia
```ts
// lib/houseTheme.ts
import type { Synergy } from '@/types'
const GOLD = { border: 'rgba(202,162,74,0.6)', bg: 'rgba(176,141,87,0.16)', ink: '#f3e6c4', mark: '#caa24a' }
export function synergyTagColors(synergy: Synergy): { border: string; bg: string; ink: string; mark: string } {
  if (synergy.kind === 'house' && synergy.requires.house) {
    const c = HOUSE_COLORS[synergy.requires.house]
    // bordo = ring casa; sfondo = ring a bassa opacità; testo CHIARO (non il fill, che su Tassorosso è scuro).
    return { border: c.ring, bg: `${c.ring}28`, ink: '#f3e6c4', mark: c.fill }
  }
  return GOLD
}
```
- Testo (`ink`) resta chiaro per TUTTE le case (anche Tassorosso, il cui fill #372e29 è scuro → non usato per
  il testo). Il `mark` (la stella ✦) usa il fill-casa come accento colorato.
- `bg` = ring-casa a ~16% opacità (`28` hex) — tinta tenue, leggibile.

### B3. Applicare ai call-site del tag
I render-tag oggi hanno i colori oro hardcoded inline. Sostituire con `synergyTagColors(synergy)`:
- `SynergyRibbon.tsx:36-40` (la pillola: `style` border/bg/color + la `✦`).
- `TeamSynergyBar.tsx:16-18` (stessa pillola oro hardcoded).
- `SynergyTracker.tsx:60-61` (border/bg condizionali — applicare il colore-casa quando attiva/casa).
- `RecruitScreen.tsx`, `TeamScreen.tsx`, `compendium/SynergyGraph.tsx`: dove rendono il tag, usare l'helper.
- Le pillole NON-casa ottengono lo stesso identico oro di prima (l'helper ritorna GOLD) → zero regressione
  visiva per ruolo/gruppo.

## Testing (Parte B)

- **`synergyTagColors`** (unit): sinergia-casa → border = ring della casa giusta (Serpeverde → `#1a472a`),
  ink chiaro; sinergia ruolo/gruppo → GOLD invariato. Una asserzione per casa + una per non-casa.
- **`HOUSE_COLORS` = palette canonica**: i valori combaciano con quelli storici di HouseCrest (test di
  non-regressione: HouseCrest rende ancora gli stessi colori dopo l'estrazione).
- **Regressione UI**: i test schermo (SynergyRibbon/Tracker/Recruit/Team) restano verdi; i tag non-casa
  invariati; data-attr/testid esistenti intatti.

## Rischi / note (Parte B)

- Puramente presentazione: nessun impatto balance/engine.
- Contrasto: testo chiaro su tutte le tinte-casa a bassa opacità → leggibile; verificato che Tassorosso (fill
  scuro) NON usi il fill per il testo.
- Accessibilità: il colore è ADDITIVO al nome+testo del tag (che restano), non l'unico veicolo d'informazione.

## Non in scope (YAGNI)

- Ridisegnare la UI del tag/ribbon (Parte A: riempire il testo; Parte B: solo border/bg/accento colore).
- Pillola piena colorata / gestione contrasto per-casa (l'utente ha scelto bordo+tinta, testo chiaro).
- Nomi tematici per gli effetti-casa ("Audacia" ecc.) — forma derivata-numerica scelta.
- Colorare i tag NON-casa (restano oro).
- Spostare gli effetti-casa dentro `bonus` — la derivazione è la via giusta.

## Ordine di implementazione (per il plan)

**Parte A (testo effetto):**
1. `houseEffects.ts`: esporta `houseEffectText(house, tier)` + test unit sui valori reali.
2. `lib/glossary.ts`: `synergyBonusText(synergy)` (firma cambiata, aggiunge la riga-casa) + test.
3. Aggiorna i 7 call-site a passare la Synergy intera; tsc pulito; test schermo verdi (aggiorna asserzioni
   "no effetto" → ora c'è).

**Parte B (colori casa):**
4. `lib/houseTheme.ts`: estrai `HOUSE_COLORS` (da HouseCrest) + `synergyTagColors(synergy)` + test; ri-punta
   HouseCrest sull'export condiviso (test non-regressione colori crest).
5. Applica `synergyTagColors` ai render-tag (SynergyRibbon/TeamSynergyBar/SynergyTracker/Recruit/Team/
   SynergyGraph); tag non-casa invariati; test schermo verdi.

6. Suite piena + tsc. Backlog doc.
