# Reliquie (Relics) — Design Spec

**Data:** 2026-06-23
**Tipo:** Feature roguelite — oggetti passivi scelti durante la run che potenziano la squadra.
**Contesto:** Si innesta sul gioco esistente (M1-M6 + motore Status&Effect). Riusa synergy-path, `EFFECT_HANDLERS`, RNG-fork e i pattern card. **Nessun sistema parallelo.**

---

## 1. Obiettivo

Dopo ogni battaglia vinta (le 5 normali, non il boss), il giocatore sceglie **1 reliquia tra 3** offerte. Le reliquie danno bonus passivi a tutta la squadra (alcune condizionali su casa/ruolo) e, per poche epiche, trigger di combattimento. Aggiungono profondità roguelite e scelte di build, mantenendo la promessa "stesso seed = stessa run".

**Scope v1 (confermato):** la maggior parte sono passive/condizionali (basso rischio); i trigger di combattimento (`startOfBattle`/`onHit`) sono limitati a **2-3 reliquie epiche**. I tipi restano pronti per aggiungerne altre in futuro.

---

## 2. Decisioni confermate

- **Quando:** 1-di-3 dopo OGNI vittoria normale (stage 0-4 → ~5 reliquie a fine run). Mai dopo il boss.
- **Bersaglio bonus:** tutta la squadra (come le sinergie). Alcune con condizione (es. ≥3 Grifondoro).
- **Offerta:** pesata per rarità (comuni frequenti … epiche rare), **no duplicati** nella terna, **mai una reliquia già posseduta**.
- **Determinismo:** deterministico dal seed via nuovo canale `relicOfferRngChannel = 3`. Stesso seed+stage → stesse 3 offerte. La scelta resta del giocatore.
- **Potere:** mix bilanciato — passive + condizionali + 2-3 trigger epici.

---

## 3. Tipi (`types/relic.ts`)

Riusa `SynergyBonus` e `EffectSpec` esistenti.

```ts
import type { House, Role } from './wizard'
import type { SynergyBonus } from './synergy'
import type { EffectSpec } from './status'

export type RelicRarity = 'comune' | 'non-comune' | 'rara' | 'epica'

export interface RelicCondition {
  house?: House
  role?: Role
  count?: number   // default 3 quando house/role presente
}

export interface Relic {
  id: string
  name: string
  desc: string                 // testo italiano per la UI
  rarity: RelicRarity
  bonus?: SynergyBonus         // {hp?,atk?,def?,spd?,allPct?,regen?} — riuso del tipo sinergie
  condition?: RelicCondition   // se presente, bonus applicato solo se la squadra la soddisfa
  startOfBattle?: EffectSpec[] // trigger combat opzionale (solo epiche v1)
  onHit?: EffectSpec[]         // trigger on-hit opzionale (solo epiche v1)
}

export interface ActiveRelic { relic: Relic; stageObtained: number }
```

`EffectSpec` esistente (per i trigger): `{kind:'damage'|'heal'|'shield'|'applyStatus', …}`.

---

## 4. Dati (`data/relics.ts`)

Pattern identico a `data/synergies.ts`/`spells.ts`: `export const RELICS: Relic[]` + `export const RELIC_BY_ID = Object.fromEntries(RELICS.map(r => [r.id, r]))`.

**~18 reliquie**, distribuite per rarità (almeno 1 per casa nelle condizionali). Esempi (i valori finali in revisione di bilanciamento, ma concreti):
- **Comuni** (passive piatte): `giratempo` +12 spd a tutti; `mantello-invisibilita` +14 def; `mappa-malandrino` +10 atk; `pozione-fortuna` allPct +0.05; `bezoar` regen +8.
- **Non-comuni / rare** (condizionali): `spada-grifondoro` +28 atk se ≥3 Grifondoro; `medaglione-serpeverde` +24 atk se ≥3 Serpeverde; `diadema-corvonero` +20 spd se ≥3 Corvonero; `coppa-tassorosso` regen +14 se ≥3 Tassorosso; `stemma-attaccanti` +18 atk se ≥3 Attaccante; `egida-tank` +22 def se ≥3 Tank.
- **Epiche** (2-3 con trigger): `pietra-resurrezione` — startOfBattle: scudo a tutta la squadra (`{kind:'shield', amount:…}`); `boccino-doro` — onHit: `{kind:'applyStatus', target:'enemy', chance:0.15, …}` (dot); `bacchetta-sambuco` — allPct +0.12 (epica passiva forte, senza trigger).

Pesi rarità e valori numerici in `data/constants.ts` (`BALANCE.relics`), ribilanciabili senza toccare codice.

---

## 5. Engine

### 5.1 Offerta — `game/engine/relics.ts` (puro)
```ts
relicOfferRngChannel = 3   // aggiunto in run.ts, isolato da draft(1)/combat(2)

offerRelics(rng: Rng, owned: ActiveRelic[], stage: number): Relic[]
```
- Esclude reliquie già possedute (per id).
- Pesca 3 pesate per rarità (`BALANCE.relics.rarityWeights`), **senza duplicati** nella terna.
- Funzione pura. RNG da `createRng(seed).fork(relicOfferRngChannel).fork(stage)` (chiamato dal controller con il seed della run).
- Se il pool disponibile < 3 (raro), ritorna quanti disponibili senza duplicati.

### 5.2 Bonus passivi — `game/engine/relics.ts`
```ts
applyRelicBonuses(stats: Stats, team: DraftedWizard[], relics: ActiveRelic[]): Stats
totalRelicRegen(team: DraftedWizard[], relics: ActiveRelic[]): number
```
- Per ogni reliquia con `bonus`: se ha `condition`, applica solo se `team` la soddisfa (conta i maghi che matchano house/role; soglia = `condition.count ?? 3`). Riusa la stessa semantica di `SynergyRequirement`.
- Matematica identica a `applyBonuses`: somma flat (hp/atk/def/spd), poi moltiplicatore `(1 + Σ allPct)`, arrotonda. `regen` separato (sommato in `totalRelicRegen`, attivo solo se condizione soddisfatta).

### 5.3 Innesto in combattimento — `game/engine/combat/simulate.ts`
- `toBattleUnits(team, side, synergies, relics?)`: dopo `applyBonuses(stats, synergies)`, applica `applyRelicBonuses(…, team, relics)` (solo per il lato giocatore; nemico passa `[]`). I `buffedStats` riflettono sinergie **e** reliquie. `maxHp`/`hp` derivano dai buffedStats finali.
- `simulateBattle(left, right, rng, opts)`: `opts` esteso con `leftRelics?: ActiveRelic[]` (default `[]`). Il regen del lato sinistro include `totalRelicRegen`.
- **Trigger `startOfBattle`**: dopo aver costruito le unità del lato giocatore, per ogni reliquia con `startOfBattle`, esegui ogni `EffectSpec` via `EFFECT_HANDLERS` su ciascuna unità alleata; logga nel battle log. Determinismo: usa il `battleRng` esistente.
- **Trigger `onHit`** — `game/engine/combat/resolve.ts`: dopo gli effetti della magia dell'attore, se l'attore è del lato con reliquie, per ogni reliquia con `onHit` esegui i suoi `EffectSpec` (rispettando `chance`) usando il context effetti esistente. Le reliquie del lato giocatore sono accessibili nel loop combat (passate insieme alle unità).

### 5.4 Run engine — `game/engine/run.ts`, `types/run.ts`
- `RunState` += `relics: ActiveRelic[]` (init `[]` in `startRun`).
- `nextBattle` passa `state.relics` a `simulateBattle` come `leftRelics`.
- Nuova funzione pura `addRelic(state: RunState, relic: Relic): RunState` → ritorna stato con `{relic, stageObtained: state.stage}` aggiunto (immutabile).

---

## 6. Flusso run + UI

### 6.1 `useRun` — vista `relic-choice`
- `RunView` += `'relic-choice'`.
- Oggi: `victory → advance() → battle/boss`. Nuovo: dopo una **victory** (non `win`/`defeat`), `advance()` (o un nuovo `toRelicChoice`) porta a `relic-choice` **prima** della battaglia successiva.
- Controller espone: `relicChoices: Relic[]` = `offerRelics(relicRng, run.relics, run.stage)` (relicRng = `createRng(seed).fork(relicOfferRngChannel).fork(stage)`), e `chooseRelic(relic)` → aggiorna lo stato con `addRelic` poi procede alla battaglia successiva (`battle`/`boss`).
- Determinismo: terna ricalcolata dallo stesso seed+stage → replay/seed condiviso mostrano le stesse offerte.

### 6.2 Componenti
- `components/relics/RelicCard.tsx`: card premium coerente col gioco — bordo/glow per rarità (pattern colore tipo `TierBadge`), nome, descrizione, icona Lucide per categoria (passiva/condizionale/trigger), hover Framer. Props `{relic, onClick?, owned?}`.
- `components/relics/RelicBar.tsx`: riga compatta delle reliquie possedute (icone+nome), mostrata in `RelicChoiceScreen` e in `BattleScreen`/`TeamScreen` (HUD piccolo).
- `components/screens/RelicChoiceScreen.tsx`: titolo "Scegli una reliquia", 3 `RelicCard` cliccabili (entrance/hover Framer come DraftBoard), `RelicBar` delle possedute, al click `chooseRelic` + crossfade (coerente con `CampaignRunner`).
- `components/screens/CampaignRunner.tsx`: aggiungo il case `'relic-choice'` → `RelicChoiceScreen`.

---

## 7. Determinismo & RNG

- Canale dedicato `relicOfferRngChannel = 3`, isolato da draft (1) e combat (2): aggiungere/cambiare reliquie non altera draft o combattimento.
- `offerRelics` e `applyRelicBonuses` sono funzioni pure (RNG iniettato). Stesso seed → stesse offerte ad ogni stage; la scelta del giocatore è l'unica variabile.
- I trigger di combattimento usano il `battleRng` esistente, quindi una battaglia con reliquie resta deterministica e replay-abile.

---

## 8. Test

**Engine puro:**
- `offerRelics`: ritorna 3; nessun duplicato nella terna; nessuna reliquia già posseduta; pesata (epiche più rare delle comuni su molti seed); deterministica per (seed, stage); gestisce pool < 3.
- `applyRelicBonuses`: flat+pct corretti; `condition` rispettata (applica) e ignorata (non applica) secondo composizione; `totalRelicRegen` somma solo condizioni soddisfatte.
- Trigger: una `simulateBattle` con `leftRelics` che ha `startOfBattle` shield → le unità alleate iniziano con scudo; una con `onHit` → l'effetto on-hit compare nel log.
- `addRelic`: immutabile, aggiunge con `stageObtained` corretto.
- `data/relics.ts`: id unici; ogni `condition`/`bonus` ben formato; epiche con trigger ≤ 3.

**UI:**
- `RelicCard`: mostra nome/desc/rarità, fires onClick.
- `RelicChoiceScreen`: mostra 3 carte + reliquie possedute, click chiama `chooseRelic`.
- `CampaignRunner`/`useRun`: entra in `relic-choice` dopo una vittoria; scegliere una reliquia procede alla battaglia successiva.

**Bilanciamento (sanity):** simula N run con reliquie e verifica che il boss resti vincibile ma non banale (win-rate in una banda sana), come il test balance esistente. Numeri in `constants.ts` tunabili senza toccare logica.

---

## 9. Confini (no sistemi paralleli)

| Cosa | Riuso |
|---|---|
| Bonus reliquia | `SynergyBonus` (stesso tipo, stessa matematica di `applyBonuses`) |
| Condizioni | semantica di `SynergyRequirement` (house/role/count) |
| Trigger combat | `EffectSpec` + `EFFECT_HANDLERS` esistenti |
| RNG | `createRng().fork()` + nuovo canale 3 |
| UI card | pattern `WizardCard`/`TierBadge`/`houseTheme` |
| Flusso | `useRun`/`CampaignRunner` esistenti + 1 vista |

Le reliquie sono "dati + un innesto nel synergy-path + 1 vista", non un nuovo motore.
