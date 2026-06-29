# Archetipo Magie Oscure — design (glass-cannon Serpeverde)

> Data: 2026-06-29. Archetipo #4 della roadmap (`docs/superpowers/remaining-work.md` #1 "next up").
> Replica il pattern tracer-bullet provato tre volte (Veleno, Esecuzione, Scudi-Rigen) MA introduce
> due elementi nuovi: una **reliquia per-unit assegnabile** e un **recoil letale loggato**.
> Pattern di riferimento più fresco: lo slice Scudi-Rigen
> (`docs/superpowers/specs/2026-06-29-scudi-rigen-archetype-design.md` + relativo plan).

## Concept

Serpeverde/Mangiamorte, glass-cannon ad alto rischio. Le Magie Oscure (Avada, Ardemonio,
Sectumsempra) colpiscono fortissimo ma **si pagano in sangue**: il portatore del Marchio Nero
amplifica il danno dei propri incantesimi oscuri e subisce un **contraccolpo (recoil)** pari a una
frazione del danno **effettivamente inflitto**. Il recoil **può uccidere** il caster.

Due livelli di rischio, che si compongono:
- **Synergy `Oscurità`** (3+ maghi tag `magieOscure`): amplifica il danno oscuro di TUTTI i dark
  caster, **senza recoil**. Accessibile, draftabile presto.
- **Reliquia `Marchio Nero`** (assegnata a UN mago): amplifica **e** infligge recoil al portatore.
  Il vero glass-cannon — rischio concentrato su uno.

## Matrice counter (regola utente: dichiarata + testata)

| | Beats | Loses to |
|---|---|---|
| **Magie Oscure** | Squishy (il nuke amplificato one-shotta i fragili) | **Scudi** (assorbe il nuke → 0 inflitto → 0 payoff, neutralizzato) · **Chip/Controllo** (ti tiene a HP basso → il recoil sul colpo pieno uccide il portatore) |

Ironia di design: **Scudi-Rigen** (archetipo #3) respinge Magie Oscure — lo scudo nega payoff E
rischio. Il counter-web si allarga e si auto-conferma.

## Sezione 1 — Engine: amplify + recoil, su un singolo portatore

### Tipo `ActiveRelic` esteso

```ts
export interface ActiveRelic {
  relic: Relic
  stageObtained: number
  assignedTo?: string   // wizardId del portatore (per reliquie `assignable`); undefined = non assegnata
}
```
E sul `Relic`: `assignable?: boolean` (true per `marchio-nero`) + `grantsDarkMagic?: { bonus: number; recoil: number }`.

### Funzione pura — `game/engine/darkMagic.ts`

A differenza di `teamExecute`/`teamShieldConvert` (che ritornano un valore team-wide), questa ritorna
una **mappa per-wizard**, perché l'effetto è eterogeneo (synergy a tutti, reliquia a uno):

```ts
/** Mappa wizardId → effetto Magie Oscure. La synergy 'oscurita' dà `bonus` a OGNI dark caster
 *  (recoil 0); il Marchio Nero assegnato aggiunge bonus + recoil al SOLO portatore. Il bonus è
 *  scalato da keywordMult.magieOscure; il recoil NON è scalato. Pura, no RNG. */
export function teamDarkMagic(
  team: DraftedWizard[], relics: ActiveRelic[], synergies: ActiveSynergy[],
): Record<string, { bonus: number; recoil: number }>
```

Logica:
1. `synBonus = synergies.some(s => s.id === 'oscurita') ? 0.3 : 0`.
2. Per ogni mago `magieOscure`-tagged nel team: base entry `{ bonus: synBonus, recoil: 0 }`.
3. Per ogni reliquia `grantsDarkMagic` con `assignedTo` settato e `relicMatchesCondition`: al portatore,
   `bonus += relic.grantsDarkMagic.bonus`, `recoil = max(recoil, relic.grantsDarkMagic.recoil)`.
4. Scala SOLO il bonus di ogni entry per `keywordDamageMult(team, relics, 'magieOscure')` (il recoil resta).
5. Rimuove le entry con `bonus <= 0 && recoil <= 0` (mappa vuota possibile → nessun dark effect).

Nota: un mago può ricevere il Marchio anche se NON è `magieOscure`-tagged (la reliquia è assegnabile a
chiunque). In quel caso ha una entry solo-reliquia. La keyword sulla SPELL (non sul mago) è ciò che
gata l'amplify nell'handler — vedi sotto.

⚠️ **Fatto del codebase (verificato):** il tipo `Spell` NON ha oggi un campo `keywords` (le keyword
vivono su `Relic` e sui `tags` del wizard, non sulle spell). Quindi questo slice aggiunge
`keywords?: Keyword[]` al tipo `Spell` e tagga `avada`/`fiendfyre`/`sectumsempra` con `['magieOscure']`.
È così che l'handler sa che una spell è dark.

### Stamp per-unità

In `toBattleUnits`: `unit.darkMagic = darkMap[dw.wizard.id]` (o `undefined`). Tipo `BattleUnit` esteso
con `darkMagic?: { bonus: number; recoil: number }`.

### Attack handler — `game/engine/combat/effects.ts`

L'amplify e il recoil si agganciano SOLO quando la spell lanciata ha keyword `magieOscure`.
**Threading (deciso, verificato sul codice):** in `game/engine/combat/resolve.ts` (riga ~28) l'`EffectCtx`
è costruito dove la `spell` intera è nota. Lì si calcola `const dark = spell.keywords?.includes('magieOscure') ?? false`
e si aggiunge `dark` all'`EffectCtx` (un campo opzionale `dark?: boolean` su `EffectCtx` in
`effects.ts`). L'attack handler legge `ctx.dark`. UNA riga in resolve + un campo opzionale nel ctx —
niente threading profondo, `normalizeSpell` resta invariato. Comportamento richiesto:

```ts
// dentro l'attack handler, dopo computeDamage e dopo execute/shatter, PRIMA di absorbDamage:
const dm = ctx.actor.darkMagic
const isDark = ctx.dark   // settato in resolve.ts da spell.keywords?.includes('magieOscure')
if (dm && isDark) dmg = Math.round(dmg * (1 + dm.bonus))
// ... modifyOutgoingDamage / modifyIncomingDamage come ora ...
const residual = absorbDamage(ctx.target, dmg)
ctx.target.hp -= residual
// RECOIL: su danno INFLITTO (residual), non su dmg calcolato. Letale.
if (dm && isDark && dm.recoil > 0 && residual > 0) {
  const kick = Math.round(residual * dm.recoil)
  ctx.actor.hp -= kick                       // può scendere ≤ 0 → il caster muore
  ctx.flags.push('recoil')
}
return { value: dmg }
```

**Caso scudo-parziale (esplicito, da testare):** se uno scudo assorbe parte del nuke, `residual` è il
solo danno passato, quindi il recoil è proporzionale al **residuo**, non al danno calcolato. Scudo che
assorbe tutto → `residual = 0` → **nessun recoil** (lo scudo nega payoff E rischio). Questo è il cuore
del counter "perde vs scudi".

**Morte del caster da recoil:** dopo che `ctx.actor.hp` scende ≤ 0, il flusso di morte esistente (il
check `alive`/cleanup nel loop di `simulate`) deve gestirlo come qualunque altra morte. Da verificare:
che un attore che si autouccide a metà azione non rompa il resto del turno (la morte va rilevata dopo
l'azione, come per il danno normale). Zero RNG introdotto.

## Sezione 2 — Contenuto

| Pezzo | id | Forma | Note |
|---|---|---|---|
| Spell tag | — | aggiungi `keywords: ['magieOscure']` a `avada`, `fiendfyre`, `sectumsempra` | il bacino che amplify+recoil colpisce; nessuna spell nuova |
| Reliquia **grant** | `marchio-nero` | `keywords:['magieOscure']`, `assignable:true`, `grantsDarkMagic:{ bonus:0.5, recoil:0.2 }`, rarità `rara` | mirror `spada-grifondoro` ma per-unit |
| Reliquia **scale** | `diadema-corrotto` | `keywords:['magieOscure']`, `keywordMult:{ magieOscure:0.5 }`, rarità `non-comune` | scala SOLO il bonus, non il recoil |
| **Synergy** | `oscurita` | `kind:'origin'`, `requires:{ tag:'magieOscure', count:3 }`, dà bonus dark a tutti + piccolo `atk` (`bonus:{ atk:5 }`) | il +0.3 amplify è hard-coded in teamDarkMagic keyed su `oscurita` |
| **Tag** wizard | `'magieOscure'` | su voldemort, bellatrix, snape, lucius, draco, narcissa | mirror dei tag esecuzione; lista finale tarata in impl |

## Sezione 3 — UI di assegnazione (meccanismo nuovo)

Estensione di `components/screens/RelicNodeScreen.tsx`. Oggi: il giocatore seleziona un pedestal →
`onPick(relicId)`. Nuovo flusso per reliquie `assignable`:
- Dopo aver selezionato un Marchio (`relic.assignable`), invece di abilitare subito "Prendi", si apre un
  **secondo step**: una riga dei maghi della squadra (riuso dei portrait/bust esistenti — `UnitBust` o
  l'equivalente già in uso). Il giocatore clicca il portatore designato, poi conferma.
- Callback esteso: `onPick(relicId, assignedTo?)`. Reliquie normali → `assignedTo` undefined (flusso
  attuale invariato). Il resolver `relic-pick` (`game/engine/resolvers/recruit.ts` + il tipo Choice in
  `resolvers/types.ts`) accetta `assignedTo?: string` e lo salva su `ActiveRelic`.
- Default difensivo: se per qualunque motivo `assignedTo` manca su un Marchio (es. squadra vuota), la
  reliquia resta non assegnata → nessun effetto dark (no crash). La UI non deve permettere di
  confermare un Marchio senza un portatore quando la squadra è non vuota.

## Sezione 4 — Validazione

### `tests/engine/magieOscureCounters.test.ts`
- **BATTE squishy**: un portatore con Marchio one-shotta un nemico fragile che senza Marchio
  sopravvivrebbe → flip (plain non chiude, withMarchio sì). Tuning empirico del flip (metodo
  esecuzione/scudi-rigen: throwaway `tune.mjs` con import `@/`, `npx tsx`).
- **PERDE vs Scudi**: nemico con scudo alto assorbe il nuke → 0 inflitto → 0 payoff; il portatore non
  chiude e perde.
- **PERDE vs Chip/Controllo**: nemico che tiene il portatore a HP basso → il recoil sul colpo pieno lo
  uccide (verifica che il portatore muoia con flag `recoil` nel log).
- **Caso scudo-parziale** (esplicito): uno scudo che assorbe metà → il recoil è proporzionale al
  residuo passato, NON al danno calcolato. Asserzione diretta sul valore di recoil/HP del caster.

### `tests/engine/magieOscureSweep.test.ts`
Clone di scudiRigenSweep. Starter house **Serpeverde**, recruit biased a tag `magieOscure`, relic pick
biased a `marchio-nero`/`diadema-corrotto` (e il Marchio auto-assegnato al dark caster con più HP nel
sweep, dato che il sweep non passa per la UI).
- Metrica: **winRate + darkUptake + recoilDeaths + turn-budget**. NO total-damage (l'amplify è un
  moltiplicatore; recoil non è un canale di danno offensivo). `darkUptake` = team ha almeno una entry
  `teamDarkMagic` non vuota. `recoilDeaths` = numero di morti del portatore con flag `recoil` (la firma
  del rischio — metrica UNICA di questo archetipo).
- Asserzioni: `winRate > 0.05` (non rotto), `darkUptake > 0.10` (draftable), `maxTurns < turnCap`,
  determinismo (stessi seed → stessi esiti). `recoilDeaths` è **diagnostico** (loggato, non assertito a
  una soglia rigida) PERCHÉ è il segnale da tarare: se troppo alto, l'archetipo è ingiocabile.

## Rischi noti & leve

- **Recoil troppo punitivo** (recoilDeaths alto, winRate basso): leva = abbassare `recoil` di
  `marchio-nero` (0.2 → 0.15/0.1), NON toccare l'engine. Se troppo debole (nuke non chiude i fragili):
  alzare `bonus`. Tarato sui numeri dello sweep/counter, non a priori.
- **Skew casa Serpeverde** atteso (come Veleno/Esecuzione): un alto winRate sarebbe house-power, non
  difetto del kit — rebalance casa è backlog #4, separato. (Nota: Scudi-Rigen ha mostrato che Tassorosso
  NON ha lo skew; Serpeverde sì.)
- **Threading della keyword dark**: deciso — `EffectCtx.dark` calcolato in `resolve.ts` da
  `spell.keywords`. Richiede di aggiungere `keywords?: Keyword[]` al tipo `Spell` (oggi assente).
- ⚠️ Determinismo: l'amplify+recoil deve essere bit-identico quando `unit.darkMagic` è assente O la
  spell non è `magieOscure`. Gate: full suite invariata dopo l'engine, prima del contenuto.

## Non in scope (YAGNI)

- Nessun nuovo stato Corruption persistente / recoil-over-time. Il recoil istantaneo su danno-inflitto
  basta.
- Drama/feedback a schermo oltre il flag `recoil` nel log (callout, animazioni) — deferito, user-gated.
- Riassegnazione del Marchio dopo il draft (cambiarlo a un altro mago più tardi) — fuori scope; si
  assegna alla presa.
- Rebalance casa Serpeverde — task separato (backlog #4).

## Ordine di implementazione (per il plan)

1. Tipi: `ActiveRelic.assignedTo`, `Relic.assignable` + `grantsDarkMagic`, `BattleUnit.darkMagic`,
   `Spell.keywords?: Keyword[]`, `EffectCtx.dark?: boolean`.
2. Engine puro: `darkMagic.ts` (`teamDarkMagic`).
3. Stamp `unit.darkMagic` in `toBattleUnits`.
4. Attack handler: amplify + recoil (su residual, letale, flag `recoil`) gated su spell dark + il
   threading del flag `dark`. **Gate: full suite invariata** (nessuna reliquia assegnata → inerte).
5. Contenuto: spell tag, reliquie `marchio-nero`/`diadema-corrotto`, synergy `oscurita`, tag wizard.
6. Resolver `relic-pick` accetta `assignedTo`; salva su `ActiveRelic`.
7. UI: secondo step di assegnazione in `RelicNodeScreen` (+ test UI).
8. Validazione: `magieOscureCounters.test.ts` (incl. scudo-parziale) + `magieOscureSweep.test.ts`
   (con recoilDeaths). Tarare bonus/recoil sui numeri.
9. Aggiornare `remaining-work.md` (#4 → done, counter-web table, NEXT UP).
