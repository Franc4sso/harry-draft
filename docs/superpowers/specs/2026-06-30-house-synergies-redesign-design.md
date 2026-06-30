# Ridisegno synergie di casa — design (effetti caratterizzanti)

> Data: 2026-06-30. Nasce dallo Slice 3 (rebalance Serpeverde): invece di nerfare Voldemort o gonfiare
> stat banali (+atk/+def/+spd), l'utente vuole synergie di casa CARATTERIZZANTI con meccanismi unici per
> casa. Questo risolve il balance ALLA RADICE (Serpeverde perde il +atk incondizionato) e dà identità
> alle 4 case. Pattern: effetti per-unità stampati in `toBattleUnits` + agganciati nel combat, come
> `execute`/`darkMagic`/`shieldConvert`.

## Problema

Le synergie di casa oggi danno solo stat piatte: Serpeverde +atk, Grifondoro +def, Corvonero +spd,
Tassorosso +regen (`data/synergies.ts:5-16`). Due difetti:
1. **Squilibrio:** l'atk è la stat più forte (danno = atk × power; powerOf pesa atk ×2), quindi la
   synergia Serpeverde vale più delle altre → Serpeverde vince ~0.775 vs Grifondoro ~0.167.
2. **Banalità:** "+atk/+def/+spd" non esprime l'identità delle case.

## Le 4 synergie ridisegnate

Ogni casa ottiene un MECCANISMO distintivo (non solo stat), scalato su 3 tier (2/3/4 membri). Tutti e 4
sono distinti — nessuna sovrapposizione tematica.

| Casa | Tema | Meccanismo | Aggancio engine |
|---|---|---|---|
| **Grifondoro** | Coraggio | **Schivata aumentata** (evita più colpi; valore moderato, NON troppo forte) | `dodged()` in effects.ts — bonus per-unità |
| **Corvonero** | Intelligenza | **Critici potenziati** (più crit chance + più crit damage) | crit calc in effects.ts:19-20 |
| **Tassorosso** | Lealtà | **Danno condiviso** (un colpo su un Tassorosso è ridotto — la squadra assorbe) | damage-taken reduction in the attack handler |
| **Serpeverde** | Astuzia | **+danno a bersagli feriti** (opportunista; RIMPIAZZA il +atk piatto) | damage calc in effects.ts, gated on target HP% |

### Dettaglio per casa

**Grifondoro — Schivata (coraggio).** Per-unità `dodgeBonus` stampato dalla synergy (tier 2/3/4 →
es. +4%/+8%/+14%, da tarare). Nel `dodged()` (effects.ts:24-28): `chance += actor-being-attacked's
dodgeBonus`. ⚠️ Moderato — il dodge azzera un colpo intero, quindi valori bassi (l'utente: "non troppo
forte"). Sostituisce il vecchio +def.

**Corvonero — Critici (intelligenza).** Per-unità `critBonus: { chance, mult }`. Nel crit calc
(effects.ts:19-20): `critChance += critBonus.chance`, e se critta `dmg *= (critMult + critBonus.mult)`.
Tier 2/3/4 scala entrambi. Sostituisce il vecchio +spd (lo spd dava già crit via critSpdScale — coerente).

**Tassorosso — Danno condiviso (lealtà).** Per-unità `damageReduction` (frazione). Nell'attack handler,
quando un Tassorosso è il bersaglio: `dmg = round(dmg * (1 - damageReduction))` PRIMA di absorbDamage.
Tier 2/3/4 → es. 8%/15%/22%. Si somma al `regen` esistente (lo mantengo: Tassorosso resta la casa
sostegno — regen + riduzione danno = il muro leale). Tematicamente "la squadra protegge il compagno".

**Serpeverde — Astuzia (+danno a feriti).** Per-unità `cunning: { threshold, bonus }`. Nel damage calc,
se il BERSAGLIO è sotto `threshold` HP%: `dmg *= (1 + bonus)`. RIMPIAZZA il +atk piatto → il danno extra
è CONDIZIONALE (solo su feriti) invece che sempre attivo → abbassa il winRate alla radice. ⚠️ Distinto da
Esecuzione (che ha soglia + relic): questo è la synergia di CASA, sempre attiva per i Serpeverde, soglia
più alta / bonus più piccolo dell'esecuzione vera. Da tarare per non sovrapporsi.

## Architettura (pattern provato)

Tutti e 4 sono effetti **per-unità** o **per-side**, calcolati da una funzione pura su `activeSynergies`
e stampati in `toBattleUnits` (come `execute`/`darkMagic`/`shieldConvert`):
- `BattleUnit.dodgeBonus?: number` (Grifondoro)
- `BattleUnit.critBonus?: { chance: number; mult: number }` (Corvonero)
- `BattleUnit.damageReduction?: number` (Tassorosso)
- `BattleUnit.cunning?: { threshold: number; bonus: number }` (Serpeverde)

Una funzione `houseEffects(team, synergies)` (nuovo file `game/engine/houseEffects.ts`) legge le synergie
di casa attive e ritorna i 4 effetti, mappati per-unità (ogni mago della casa X riceve l'effetto di X).
Stampati in `toBattleUnits`. Agganci nel combat (effects.ts) gated sui campi.

⚠️ **Le synergie di casa NON sono più solo `bonus: { stat }`** — il loro effetto vive nel codice keyed
per id/family (come spietatezza/oscurita/bastione). Il campo `bonus` può restare per un piccolo stat
residuo (es. Tassorosso tiene `regen`), ma il meccanismo è hard-coded in `houseEffects`.

## Validazione

- **Unit test `houseEffects`:** ogni casa attiva → l'effetto giusto sui suoi membri, ai 3 tier; case
  miste → ogni mago riceve l'effetto della SUA casa; nessuna casa → nessun effetto.
- **Combat integration test:** Grifondoro schiva di più (dodge flag più frequente, seed-pinned);
  Corvonero critta di più; un Tassorosso bersaglio subisce meno; un Serpeverde infligge di più a un
  bersaglio ferito. Ognuno con un test mirato.
- **Balance (il cuore):** i 4 house-sweep (Grifondoro via campaignBalanceB, + Corvonero/Tassorosso/
  Serpeverde via harness) devono CHIUDERE IL GAP — spread stretto tra le case. campaignBalanceB
  (Grifondoro) resta in `[0.15, 0.45]`. Serpeverde scende dal 0.775 (perde il +atk incondizionato).
  ⚠️ Tensione: buffare le case del giocatore alza la difficoltà-percepita-vinta → campaignBalanceB sale;
  c'è headroom (0.167→0.45). Tarato empiricamente. Se serve, ricompensare con menace (ultima leva).
- Full suite verde + tsc. Determinismo: il dodge/crit usano RNG già esistente (stesso punto, solo chance
  modificata) — ⚠️ questo CAMBIA le battaglie seeddate (più dodge/crit). Atteso e accettato: i test
  seed-pinned di outcome vanno aggiornati (è un cambio di balance voluto), MAI un test che indica un bug.

## Rischi noti & leve

- **Dodge troppo forte** (Grifondoro evita troppo → immortale): valori bassi (l'utente l'ha detto). Il
  dodge azzera un colpo intero, quindi +4/8/14% è già impattante. Tarare al ribasso.
- **Serpeverde-astuzia si sovrappone a Esecuzione:** soglia/bonus della casa più conservativi
  dell'esecuzione vera; sono cumulabili ma la casa è il livello base. Verificare che l'archetipo
  Esecuzione resti distinto (sweep esecuzione invariato nel design).
- **Determinismo:** dodge/crit modificano la chance allo STESSO punto RNG (nessun nuovo draw → la
  sequenza RNG non si sposta, solo l'esito della chance cambia). Tassorosso/Serpeverde modificano il
  danno (no RNG). Quindi solo gli outcome cambiano, non la struttura del seed. Gate: full suite, aggiorna
  i seed-pinned di balance.
- **campaignBalanceB sfora in alto:** se buffare le case lo porta >0.45, ricompensare con menaceOffset
  (un soffio) — leva separata, ultima.

## Non in scope (YAGNI)

- Nerfare Voldemort / stat dei maghi (l'utente ha scelto buff-up, non nerf-down).
- Ridisegnare le synergie di RUOLO o di TAG (solo le 4 di casa).
- Nuovi stati persistenti.

## Ordine di implementazione (per il plan)

1. Tipi: `BattleUnit.dodgeBonus/critBonus/damageReduction/cunning` + eventuali campi synergy.
2. `houseEffects.ts` (funzione pura) + unit test.
3. Stamp in `toBattleUnits`.
4. Agganci combat: dodge (Grifondoro), crit (Corvonero), damage-reduction (Tassorosso), cunning
   (Serpeverde) in effects.ts — ognuno gated, off-by-default. Determinism gate dopo ognuno.
5. Aggiornare `data/synergies.ts`: le 4 house synergies passano al nuovo modello (rimuovere il +atk di
   slytherin; tenere regen di hufflepuff se voluto). I valori del meccanismo sono in houseEffects.
6. Validazione + taratura balance (4 case in pari, campaignBalanceB in banda). Aggiornare i commenti.
7. Full suite + tsc. Aggiornare remaining-work.md.
