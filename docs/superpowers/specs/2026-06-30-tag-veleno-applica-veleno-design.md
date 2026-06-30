# Veleno: dagli attacchi, garantito ai maghi-veleno, Tossicità lo genera e potenzia — design

> Data: 2026-06-30 (modello finale, dopo più giri di raffinamento). Il veleno NON è un trait né uno shiny:
> è una proprietà degli ATTACCHI. Chi ha il tag veleno è garantito avere una spell-veleno. La sinergia
> Tossicità genera veleno da sé (chance sui colpi) E lo potenzia (danno) — così vale anche quando il draft
> non equipaggia una spell-veleno. Il pool di mosse-veleno va ampliato (serpensortia da sola non basta).

## Modello (deciso con l'utente)

UNA via concettuale: **il veleno è degli attacchi**. Su questa base:
1. **Trait `veleno` ELIMINATO** + tolto dagli shiny (era una via ridondante).
2. **Maghi col tag `veleno` → garantiti ≥1 spell-veleno nel loro spellPool**; il draft, per un mago-veleno,
   equipaggia SEMPRE una spell-veleno (deterministico).
3. **Sinergia Tossicità** (3+ tag veleno): (a) dà a TUTTI i membri una **chance di applicare veleno coi
   colpi normali** (genera veleno da sé → vale sempre, anche senza spell-veleno equipaggiata), e (b)
   **potenzia il danno del veleno** (moltiplicatore tick) + mantiene `velenoUncapped`. Rimosso il `bonus{atk:5}`.
4. **Pool spell-veleno ampliato**: nuove spell che applicano lo status `veleno`, distribuite così che ogni
   mago-veleno ne abbia ≥1 nel pool.

### Nota di design (feedback registrato, scelta consapevole)
La spell-veleno garantita E la chance-veleno da Tossicità sono DUE fonti di applicazione. È voluto e
NON ridondante in modo dannoso: la spell-veleno copre l'**early game** (meno di 3 maghi-veleno → Tossicità
non attiva → il veleno deve venire dalla spell); Tossicità copre il **mid/late** e i casi in cui il mago non
ha equipaggiato la spell-veleno. Il veleno resta "stacca-e-aspetti" (DOT accumulante): accettato per questo
slice; profondità tattica (detonazione/condizionali) è esplicitamente un possibile slice FUTURO, non qui.

## Contesto verificato

- **Status `veleno`** (`data/statuses.ts:9`): DOT accumulante, `tickDamage 4 + tickPctMaxHp 0.005`,
  `stack:'accumulate', maxStacks:8`, `keywords:['veleno']`.
- **Fonti-veleno oggi**: SOLO `serpensortia` (`data/spells.ts:45`). Dei 10 maghi-veleno, solo Dolohov ha
  serpensortia nel pool → impossibile "garantire" senza ampliare il pool (precisazione utente confermata).
- **Trait `veleno`** (`data/traits.ts:113-121`): applica `burn`, arriva via shiny. `SHINY_TRAIT_IDS =
  TRAITS.map(t=>t.id)` lo include. → DA RIMUOVERE (sparisce dagli shiny automaticamente).
- **`pickSpell(rng, wizard)`** (`statRoll.ts:21-26`): `rng.pick(wizard.spellPool)`. Chiamato da
  `draftWizard`, usato sia per player SIA per nemici (`themedEnemyTeam` → `draftWizard`).
- **Sinergia Tossicità** (`data/synergies.ts:35`): `requires{tag:'veleno',count:3}`, `bonus{atk:5}`, e in
  combat `velenoUncapped` (`simulate.ts:25`, `effects.ts:103`).
- **`keywordDamageMult(team, relics, keyword)`** (`relics.ts:20-28`): somma solo `relic.keywordMult`. Usato
  per il tick veleno (`simulate.ts:106-107`, `status.ts:76-77`).
- **Hook attacco**: i Trait/signature usano `bus.onReactive('onHit', ...)` per applicare status sui colpi
  (`game/engine/traits.ts`, `signatures` via lo stesso bus). La chance-veleno di Tossicità userà lo stesso
  meccanismo, ma registrata da una SINERGIA, non da un trait.

## Architettura

### 1. Eliminare il Trait `veleno`
`data/traits.ts`: rimuovere il trait `veleno` dall'array `TRAITS` (+ costanti `POISON_CHANCE`/
`POISON_DURATION` se orfane). Sparisce da `SHINY_TRAIT_IDS` (derivato) → nessuno shiny lo pesca più.
- Save legacy con `shiny.traitId='veleno'`: `registerTraitTriggers` fa già `if (!trait) continue`
  (`traits.ts:11`) → inerte, no crash. Accettato.

### 2. Ampliare il pool spell-veleno + garanzia nel pool
- **Nuove spell** (`data/spells.ts`): aggiungere alcune spell `type:'Attacco'` con
  `spec:[{kind:'damage',...},{kind:'applyStatus',target:'enemy',statusId:'veleno',duration:2}]`, a tema
  (es. "Morso del Basilisco", "Nube Tossica", "Maledizione Putrefacente"). Numero/poteri tarati nel plan;
  bilanciati come le altre spell d'attacco di pari tier.
- **Distribuzione** (`data/wizards.ts`): garantire che ogni mago con tag `veleno` abbia ≥1 spell-veleno nel
  `spellPool`. (Oggi solo Dolohov ce l'ha.)

### 3. Draft garantisce la spell-veleno ai maghi-veleno
`game/engine/statRoll.ts` `pickSpell`: se il wizard ha tag `veleno`, scegliere SEMPRE tra le sole spell-
veleno del suo pool (deterministico: il mago-veleno entra in battaglia con una spell-veleno equipaggiata).
```ts
export function pickSpell(rng: Rng, wizard: Wizard): Spell {
  const pool = (wizard.tags ?? []).includes('veleno')
    ? wizard.spellPool.filter(id => SPELL_IS_VENOM.has(id))   // garanzia
    : wizard.spellPool
  const id = rng.pick(pool.length ? pool : wizard.spellPool)  // fallback difensivo
  ...
}
```
- `SPELL_IS_VENOM` = set degli id-spell che applicano status `veleno` (derivato da `SPELLS` controllando lo
  spec, calcolato una volta).
- ⚠️ **DETERMINISMO (vincolo critico)**: `pickSpell` consuma `rng.pick`. Restringere il pool per i maghi-
  veleno CAMBIA l'esito del `rng.pick` → sposta lo stream e l'identità/composizione di ogni team con un
  mago-veleno → SEED DRIFT su molti test (campaignBalanceB, sweep, ecc.). È atteso e accettabile (rigenerare
  gli expected), ma il plan deve trattarlo come una modifica seed-shifting, non come no-op. Un `rng.pick`
  resta consumato per mago (non aggiungere/togliere draw), così solo l'ESITO cambia, non il numero di draw.
- Vale anche per i nemici (draftWizard condiviso) → un nemico-veleno equipaggia una spell-veleno. Coerente.

### 4. Tossicità: genera + potenzia il veleno
- **Tipi** (`types/synergy.ts`): `SynergyBonus` aggiunge `keywordMult?: Partial<Record<Keyword,number>>`
  (come `Relic.keywordMult`).
- **On-hit chance** — register da sinergia (VERIFICATO: non esiste ancora). Aggiungere
  `registerSynergyTriggers(bus, units, synergies, side)` in `game/engine/synergyTriggers.ts` (nuovo),
  PARALLELO a `registerRelicTriggers`/`registerTraitTriggers` e chiamato accanto a loro in
  `simulate.ts:99-101` (stesso pattern già consolidato — `registerRelicTriggers(bus,left,...,'left')` ecc.).
  Per Tossicità attiva sul lato, registra `bus.onReactive('onHit', owner:'actor')` → `applyStatus 'veleno'`
  con `chance = TOSSICITA_HIT_CHANCE`, per ogni membro di quel lato. Gate sul `side` come fanno le reliquie.
- **Dati** (`data/synergies.ts`): Tossicità → `bonus:{ keywordMult:{ veleno: X } }` (rimosso `atk:5`); la
  parte on-hit-chance è gestita dal register sopra (parametro `TOSSICITA_HIT_CHANCE`).
- **Motore** (`relics.ts` `keywordDamageMult`): estendere la firma a
  `keywordDamageMult(team, relics, synergies, keyword)`, sommando i `keywordMult` delle sinergie attive;
  aggiornare i 2 call site in `simulate.ts:106-107` (le synergie del lato sono già lì).
- `velenoUncapped` resta agganciato a Tossicità (`simulate.ts:25`) — invariato.

## Flusso dati

`draft: mago-veleno → pickSpell forza spell-veleno → entra con spell-veleno`.
`combat: spell-veleno applica status veleno` E `(se Tossicità attiva) ogni colpo del lato ha chance di
applicare veleno` → `status.ts tick = baseTick × stacks × velenoMult` dove `velenoMult` include il
`keywordMult.veleno` di Tossicità → stack uncappati se Tossicità. Il veleno è generato dagli attacchi (spell
o colpo-via-sinergia); la sinergia è insieme generatore-condizionale e amplificatore. Nessuna applicazione
veleno dal trait (rimosso) né dallo shiny.

## Testing

- **Trait rimosso**: `TRAIT_BY_ID['veleno']` undefined; `SHINY_TRAIT_IDS` non contiene `'veleno'`; shiny-
  veleno legacy inerte (no crash).
- **Nuove spell-veleno**: ogni nuova spell applica lo status `veleno` al bersaglio colpito (rng seedato).
- **Garanzia draft**: un mago con tag veleno, su QUALSIASI seed, entra con una spell-veleno equipaggiata; un
  mago senza tag veleno pesca normale. Un mago-veleno il cui pool (per errore dati) non ha spell-veleno →
  fallback al pool intero senza crash (e un test-dati che asserisce: ogni mago-veleno HA ≥1 spell-veleno).
- **Tossicità genera**: team con Tossicità attiva → i colpi normali applicano veleno a chance; team senza →
  no. (rng seedato, conteggio applicazioni atteso.)
- **Tossicità potenzia**: tick veleno maggiore con Tossicità che senza; `keywordDamageMult` somma
  relic+sinergia (relic{veleno:0.3} + Tossicità{veleno:0.5} = 1.8).
- **Nemici**: un nemico-veleno equipaggia spell-veleno e (se 3+) attiva Tossicità lato nemico.
- Determinismo (stesso seed → stesso esito; numero di draw invariato) + suite piena + tsc.

## Rischio #1 — BALANCE (ri-taratura attesa, probabilmente pesante)

⚠️ Si aggiunge potere-veleno su PIÙ assi insieme: spell-veleno garantite, chance-veleno da Tossicità,
moltiplicatore danno, su uno slice themed-battles con margine winRate GIÀ a 0.1583 (memoria
`harry-draft-themed-battles-margin`) e nemici themed-veleno coesi che ora attivano Tossicità → veleno
nemico generato E amplificato. Aspettarsi un calo winRate significativo.
**Strategia:** misurare `campaignBalanceB`; leve in ordine: (a) `TOSSICITA_HIT_CHANCE` (meno proc), (b)
`keywordMult.veleno` di Tossicità (meno amplificazione), (c) `tickDamage`/`tickPctMaxHp` dello status, (d)
`themeStrength.nodeMult` del tema veleno (driver lato nemici). Compensazione: rimuovere `atk:5` da Tossicità
spinge verso il facile. Riportare in `[0.15,0.45]`, documentare la leva (stile calibration-log campaignB).
SEED DRIFT della modifica draft (§3) va assorbito PRIMA di misurare il balance (rigenerare expected, poi tarare).

## Non in scope (YAGNI)

- Profondità tattica del veleno (detonazione stack, danno-condizionale su feriti/rallentati) → slice futuro.
- Convertire le signature-burn a veleno (restano burn).
- Reliquie veleno nuove (il motore keywordMult c'è; il contenuto è un altro slice).
- Migrare i save vecchi con shiny-veleno (inerte, accettato).

## Stato finale (implementato)

**Slice completo** — tutte le 6 task implementate e committate (commit 4ad0128 → e685ca4 su master).

**Trait veleno rimosso**: eliminato da `data/traits.ts`, automaticamente assente da `SHINY_TRAIT_IDS`. Save legacy con `shiny.traitId='veleno'` rimane inerte (`registerTraitTriggers` salta la trait non trovata, nessun crash). Alcuni test che lo referenziavano sono stati migrati al trait 'furia' e i conteggi aggiornati.

**3 nuove spell-veleno**: `morsobasilisco` (Attaccante, power 1.6), `nubetossica` (Controllo/Supporto, power 0.9), `maledizioneputrida` (Tank, power 1.1). Ogni mago-veleno (10 in totale) ha ≥1 spell-veleno nel pool. Set `SPELL_IS_VENOM` derivato dai dati, accertato. Pomona id reale='sprout', Nott='theodore'.

**Draft garantito**: `pickSpell` per un mago-veleno equipaggia sempre una spell-veleno (1 sola `rng.pick`, set ristretto → seed-shifting ma draw-count invariato). Vale anche per i nemici (`draftWizard` condiviso).

**Tossicità ridisegnata**: NON dà più `bonus{atk:5}`. Ora (a) **GENERA veleno** — ogni membro del lato attivo ha chance `TOSSICITA_HIT_CHANCE=0.35` su colpi normali di applicare veleno via nuovo `registerSynergyTriggers` (stessa architettura del bus `onHit` delle signature), gated per lato; (b) **AMPLIFICA** — `bonus{keywordMult:{veleno:0.5}}` (+50% danno veleno, sommato in `keywordDamageMult` che ora legge synergies attive) + mantiene `velenoUncapped` (cap stack rimosso).

**Balance verificato**: curva iniziale tenuta — `campaignBalanceB` winRate Grifondoro 0.2083 (25/120), in banda `[0.15,0.45]` alla PRIMA misura, NESSUNA leva abbassata. Rimuovere `atk:5` ha compensato il potere-veleno aggiunto. Suite piena 828/828 pass + tsc clean.

**Veleno resta "stacca-e-aspetti"** — profondità tattica (detonazione, danno-condizionale) è esplicitamente slice FUTURO, YAGNI accettato in questo design.

## Ordine di implementazione (per il plan)

1. `data/traits.ts`: rimuovere trait `veleno` (+ costanti orfane). Test: assente da TRAIT_BY_ID/SHINY_TRAIT_IDS, shiny legacy inerte.
2. `data/spells.ts`: nuove spell-veleno + `SPELL_IS_VENOM` derivato. `data/wizards.ts`: ogni mago-veleno ha ≥1 spell-veleno nel pool. Test: copertura (ogni mago-veleno coperto), ogni nuova spell applica veleno.
3. `game/engine/statRoll.ts` `pickSpell`: garanzia spell-veleno per i maghi-veleno (1 draw, esito ristretto). ⚠️ SEED-SHIFTING: rigenerare gli expected dei test impattati. Test: garanzia su molti seed, fallback difensivo, determinismo (num draw invariato).
4. `types/synergy.ts` (`SynergyBonus.keywordMult`) + `data/synergies.ts` (Tossicità → keywordMult{veleno:X}, rimosso atk:5) + nuovo `game/engine/synergyTriggers.ts` (`registerSynergyTriggers` per l'on-hit-chance, chiamato in simulate.ts:99-101 col pattern relic/trait) + `relics.ts`/`simulate.ts` (`keywordDamageMult` somma le sinergie). Test: genera (chance on-hit) + potenzia (mult tick).
5. BALANCE (rischio #1): assorbire seed drift, misurare campaignBalanceB, ritarare fino a banda. Suite piena + tsc. Documentare.
6. Backlog doc.
