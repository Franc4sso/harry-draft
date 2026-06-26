# Abilità Uniche per Mago (Signatures) — Design

**Data:** 2026-06-26
**Stato:** Approvato (impianto), catalogo in revisione utente
**Scope:** SOLO le 60 abilità uniche passive + display sulla card del draft. Le "nature shiny" rare (rework dei tratti nel draft) sono uno spec separato successivo.

---

## 1. Obiettivo

Ogni mago ha un'**abilità unica fissa** ("signature"), sempre presente, tematica sul personaggio, con potenza scalata sulla rarità (tier). Sostituisce concettualmente il ruolo dei tratti come "firma" del personaggio; i tratti generici restano assegnati come ora (diventeranno shiny in uno spec futuro).

## 2. Modello dati

Una signature è tecnicamente un insieme di trigger identici a quelli dei tratti (`TraitTrigger`: hook modifier o reactive), ma:
- assegnata **1:1 a un mago** via la sua `id` (mai condivisa),
- con **uno o più trigger** (i Tier 1 portano kit multi-effetto).

### Nuovo tipo — `types/signature.ts`

```ts
import type { TraitTrigger } from './trait'

export interface Signature {
  id: string        // === wizard.id
  name: string
  desc: string
  triggers: TraitTrigger[]
}
```

`Signature` riusa `TraitTrigger` esistente (nessun nuovo hook, nessuna nuova primitiva di effetto). `types/index.ts` esporta `Signature`.

### Nuovo dato — `data/signatures.ts`

```ts
export const SIGNATURES: Signature[] = [ /* 60 voci, vedi catalogo */ ]
export const SIGNATURE_BY_ID: Record<string, Signature> =
  Object.fromEntries(SIGNATURES.map(s => [s.id, s]))
```

Costanti di budget per tier in cima al file (es. `T1_DMG`, `T2_CTRL_CHANCE`, …) così i numeri sono leggibili e ritoccabili in un punto solo.

### Engine — `game/engine/signatures.ts`

`registerSignatures(bus, units, catalog = SIGNATURE_BY_ID)` — stessa forma di `registerTraitTriggers`, ma itera i `triggers` della signature trovata per `u.wizard.id`:

```ts
export function registerSignatures(
  bus: EventBus, units: BattleUnit[], catalog = SIGNATURE_BY_ID,
): void {
  for (const u of units) {
    const sig = catalog[u.wizard.id]
    if (!sig) continue
    for (const t of sig.triggers) {
      const ownerOf = (ctx) => (t.owner === 'actor' ? ctx.actor : ctx.target)
      if (t.kind === 'modifier') bus.onModifier(t.hook, (v, ctx) => (ownerOf(ctx) === u ? t.apply(v, ctx) : v))
      else bus.onReactive(t.hook, (ctx) => (ownerOf(ctx) === u ? t.effects(ctx) : []))
    }
  }
}
```

### Wiring — `game/engine/combat/simulate.ts`

Una riga, **subito dopo** `registerTraitTriggers(bus, [...L, ...R])`:

```ts
registerSignatures(bus, [...L, ...R])
```

Poiché si applica a tutte le unità (left+right), **i nemici ricevono le loro signature automaticamente** → la base resta simmetrica. Nessun cambio al loop, alla selezione mosse o all'rng stream finché la signature non aggiunge listener (vedi `fireReactive` guard: hook a zero listener non pesca rng).

## 3. Budget di potenza per tier

Riferimenti di scala dai tratti attuali (es. `esecuzione` +50% sotto 30%, `roccia` -20%, `pietrificazione` 30% stun). Le signature stanno **dentro o appena sopra** questa scala secondo il tier:

| Tier | N. maghi | N. trigger | Mod danno/dif | Proc/controllo | Buff piatti |
|------|----------|-----------|---------------|----------------|-------------|
| **1** | 3  | 2 trigger (kit) | ±30–50% | 35–40% | atk/def +25–30 |
| **2** | 10 | 1 trigger (può emettere 2 effetti) | ±25–35% | 30–40% | +18–25 |
| **3** | ~30 | 1 trigger | ±15–20% | 25–30% | +8–14 |
| **4** | ~17 | 1 trigger | ±8–12% | 15–20% | +4–6 |

**Principi:**
- I Tier 4 sono piccoli ma a tema (devono "sentirsi" giusti, non rivoluzionare la battaglia).
- I controlli forti (stun/freeze) costano: chance più basse dei debuff statistici.
- Niente effetti che rompono il determinismo o richiedono nuovi hook.

## 4. Primitive usate (nessuna nuova)

- **Modifier**: `modifyOutgoingDamage`, `modifyIncomingDamage`, `modifyHealing` con `apply` inline (costanti di budget).
- **Reactive**: `onHit`, `onTurnStart`, `onHeal`, `onAllyDeath`, `onDeath`, `onTurnEnd` → ritornano `EffectSpec[]`.
  - ⚠️ **`onHpThreshold` NON è usabile dalle signature**: l'engine fa fire solo per soglie registrate dai *relic* (`registeredThresholds` in `simulate.ts`), e il trigger reattivo non porta un valore-soglia. Gli effetti "quando ferito" si fanno su **`onTurnStart`** con un gate interno sulla percentuale HP del proprietario (`ctx.actor.hp / ctx.actor.maxHp < soglia`): se non ferito, `effects()` ritorna `[]` → nessun rng, nessun log.
- **EffectSpec** disponibili: `damage`, `heal`, `shield {amount,duration}`, `applyStatus {statusId|effect, chance, duration, target}`.
- **Status esistenti riusati**: `stun, freeze, silence, disarm, burn, regen, shield, atkUp, defUp, slow, weaken1/2/3, expose1/2/3, slow1/2/3`.
- **Buff/debuff custom** con `effect: { kind:'buff'|'debuff', stat, amount, duration }` inline quando serve un valore non coperto dai preset.

> Se in fase di authoring un effetto a tema ricorre più volte con un valore non presente (es. una rigenerazione più forte di `regen`=12/t), si aggiunge **uno** status preset in `data/statuses.ts` (es. `regenBig`) anziché duplicare logica. Da valutare in implementazione; default: riusare ciò che esiste.

## 5. Catalogo delle 60 abilità

Legenda hook: OD=modifyOutgoingDamage, ID=modifyIncomingDamage, H=onHit, TS=onTurnStart, HP=onHpThreshold, AD=onAllyDeath, HL=onHeal.

### Tier 1 (kit a 2 trigger)

| Mago | Abilità | Effetto |
|------|---------|---------|
| **dumbledore** | Bacchetta di Sambuco | OD +30% danni; H 40% → `stun` 1t |
| **voldemort** | Terrore Immortale | OD +50% vs bersagli sotto 40% HP; H 35% → `weaken3` 2t (terrore) |
| **harry** | Coraggio del Grifondoro | OD scala con HP mancante fino a +70%; TS, se HP<50% → self `regen` 3t (l'amore lo protegge) |

### Tier 2 (1 trigger, può emettere 2 effetti)

| Mago | Abilità | Effetto |
|------|---------|---------|
| **snape** | Pozioni Letali | H 55% → `burn` 2t **e** `expose2` 2t |
| **bellatrix** | Crudeltà Cruciatus | H 35% → `stun` 1t **e** `heal` self 12 (sifone crudele) |
| **mcgonagall** | Trasfigurazione Marziale | ID −30% danni subiti |
| **sirius** | Lealtà Feroce | H 45% → self `effect:buff atk +22` 2t |
| **lupin** | Furia Lupesca | TS, se HP<50% → self `effect:buff atk +25` 2t |
| **moody** | Vigilanza Costante | ID −25%; TS 100% → `defUp` 1t (mantiene la guardia) |
| **lucius** | Esecutore Spietato | OD +45% vs bersagli sotto 35% HP |
| **kingsley** | Pugno dell'Auror | ID −20%; H 40% → `slow2` 2t |
| **fleur** | Fascino Veela | H 40% → `disarm` 2t (incantati) |
| **viktor** | Tuffo del Cercatore | OD +30% se l'attaccante è più veloce del bersaglio |

### Tier 3 (1 trigger, moderato)

| Mago | Abilità | Effetto |
|------|---------|---------|
| **hermione** | Mente Brillante | H 30% → `silence` 2t |
| **ron** | Mossa del Cavaliere | ID −15%; TS 100% → self `effect:buff def +10` 2t |
| **draco** | Tocco Velenoso | H 40% → `burn` 2t |
| **ginny** | Maleficio Pipistrello | H 30% → `weaken2` 2t |
| **neville** | Coraggio Tardivo | AD → self `effect:buff atk +18` 3t |
| **luna** | Serenità | TS → `regen` 3t (rigenerazione costante) |
| **fred** | Caos Gemello | H 30% → `stun` 1t |
| **george** | Sorpresa Esplosiva | OD +18% (crescendo netto) |
| **molly** | Istinto Materno | HL → self `shield` 30 (2t) |
| **arthur** | Tenacia Babbana | ID −15% |
| **tonks** | Riflessi Mutanti | TS → self `effect:buff spd +10` 1t |
| **narcissa** | Patto Materno | TS, se HP<40% → self `regen` 3t |
| **dolohov** | Maledizione Viola | H 35% → `burn` 2t **e** `slow1` 2t |
| **greyback** | Morso Selvaggio | OD +20% vs bersagli sotto 50% HP |
| **cho** | Lacrime Gelide | H 25% → `freeze` 2t |
| **cedric** | Gioco Leale | H 30% → self `atkUp` 2t |
| **slughorn** | Favori Utili | HL → cura aggiuntiva +8 (modifyHealing +20%) |
| **hagrid** | Forza del Gigante | OD +20% (colpi pesanti) |
| **flitwick** | Maestro di Incantesimi | H 30% → `silence` 2t |
| **sprout** | Mandragole | TS → `regen` 3t |

### Tier 4 (1 trigger, piccolo tocco a tema)

| Mago | Abilità | Effetto |
|------|---------|---------|
| **seamus** | Tendenza Esplosiva | H 18% → `burn` 2t |
| **dean** | Mano Ferma | OD +10% |
| **parvati** | Divinazione | H 18% → `weaken1` 2t |
| **lavender** | Devozione | HL → self `shield` 18 (2t) |
| **pansy** | Lingua Tagliente | H 18% → `silence` 2t |
| **goyle** | Stazza | ID −10% |
| **crabbe** | Stazza | ID −10% |
| **marcus** | Gioco Duro | OD scala con HP mancante fino a +20% |
| **pettigrew** | Codardia Vigile | TS, se HP<35% → self `effect:buff spd +6` 2t |
| **padma** | Studio Attento | H 18% → `disarm` 2t |
| **terry** | Concentrazione | H 18% → `stun` 1t |
| **michael** | Slancio | OD +10% |
| **roger** | Resistenza | ID −10% |
| **marietta** | Cautela | TS → self `effect:buff def +5` 1t |
| **anthony** | Disciplina | ID −10% |
| **hannah** | Gentilezza | HL → self `shield` 18 (2t) |
| **susan** | Memoria di Famiglia | TS → `regen` 3t |
| **ernie** | Orgoglio Tassorosso | ID −10% |
| **justin** | Determinazione | OD +10% |
| **zacharias** | Spavalderia | H 18% → `weaken1` 2t |
| **leanne** | Lealtà | HL → self `shield` 18 (2t) |
| **eloise** | Caparbietà | AD → self `effect:buff atk +6` 2t |
| **theodore** | Calcolo Freddo | H 18% → `stun` 1t |
| **blaise** | Eleganza Tagliente | H 18% → `burn` 2t |
| **astoria** | Grazia | HL → self `shield` 18 (2t) |
| **penelope** | Prefetto Diligente | TS → self `effect:buff def +5` 1t |
| **megan** | Discrezione | H 18% → `slow1` 2t |

> Nota: alcuni Tier 4 di supporto/controllo condividono lo **stesso schema** (es. scudo-su-cura, regen-su-turno) ma con valori al minimo del budget: è voluto, sono i "comuni". I personaggi memorabili (Tier 1–2) sono tutti meccanicamente distinti.

## 6. UI — card del draft

In `components/cards/WizardCardRow.tsx`, sotto la riga "Tratti" (o al suo posto come riga prioritaria), una riga **"Abilità"** con lo stesso pattern visivo dei trait chip ma colore distinto (es. ambra/oro per marcare l'unicità), nome dell'abilità + `Tooltip` con la `desc`. La signature si recupera da `SIGNATURE_BY_ID[wizard.id]`. Sempre presente (ogni mago ne ha una), quindi niente guard sul vuoto.

## 7. Bilanciamento

1. Aggiunta simmetrica (player+nemici) → la base resta vicina, ma il **floor di potenza sale**.
2. Dopo l'implementazione: eseguire `tests/engine/campaignBalance.test.ts` e `balance.test.ts`.
3. Se la banda esce dai target (clearRate 0.08–0.18, firstStage >0.65, bossWin <0.30), **ricalibrare** i numeri di budget in `data/signatures.ts` e/o le costanti in `data/constants.ts` (menace/relic) finché la banda rientra. Le signature danno una nuova leva di tuning.
4. Aggiornare le fixture seed-dipendenti (i nuovi listener spostano lo stream rng nelle battaglie dove si attivano).

## 8. Testing

- **Unit `tests/engine/signatures.test.ts`**: per ogni famiglia di trigger (modifier OD/ID, reactive onHit/onTurnStart/onHpThreshold/onHeal/onAllyDeath), verifica che (a) si registri, (b) l'effetto si applichi **solo al proprietario**, (c) i valori rispettino il budget del tier.
- **Test di integrità dati**: ogni `wizard.id` ha esattamente 1 signature; ogni signature ha `id` che corrisponde a un mago; nessun `statusId` referenziato inesistente; ogni signature ha ≥1 trigger; i Tier 1 hanno 2 trigger.
- **Snapshot/fixture**: rigenerare le fixture deterministiche impattate.
- **Campagna**: la suite di banda resta verde dopo la ricalibrazione.

## 9. Fuori scope (follow-up)

- Trasformare i tratti generici in "nature shiny" rare nel draft (spec separato).
- Signature attive (mosse-firma) — qui sono tutte passive.
- Display in Team/Roster e nel log di battaglia (qui solo card del draft).
