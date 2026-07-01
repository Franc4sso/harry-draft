# Cosa rimane da fare — Harry Potter Roguelite

> Documento di backlog "pulito": solo ciò che RESTA. Aggiornato: 2026-07-01.
> Stato: i 6 item del backlog precedente sono **tutti fatti, mergiati e pushati** (master `c5d3a38`).
> Suite **857/857**, tsc pulito.
> Visione/north-star: `docs/superpowers/specs/2026-06-28-game-design-direction.md` (roadmap WOW-pillar +
> principio del **counter-web** Pokémon-style). Storia di esecuzione: `git log` + `.superpowers/sdd/progress.md`.

---

## 1. PRIORITÀ #1 — Pass di "potere del giocatore" (sblocca il climax + stringe il bilanciamento)

> **Snowball pass DONE** (2026-07-01): growthBudgetPerLevel 0.40→0.28, menaceOffset -0.75→-1.00,
> snowball ratio 1.447→1.365. campaignBalanceB winRate **0.2000** (headroom **0.05** sopra il floor
> 0.15). Tutti e 4 gli archetype-sweep in band (veleno=0.608, esecuzione=0.800,
> scudiRigen=0.142, magieOscure=0.742; floor 0.05 ciascuno). Lo **0.05 di headroom** è disponibile
> per alzare `finalBossMenace` nel prossimo slice (parity slice → backlog item #5).

L'item aperto a leva più alta. **Il campaign era incollato al floor di completamento 0.15**
(`campaignBalanceB` winRate **0.158** pre-pass → **0.200** post-pass), e questo BLOCCA due cose desiderate:
- un **boss finale forte**: la parità con i boss d'area (statMult 1.33) crolla il completamento a ~2.5%
  → oggi c'è solo un buff simbolico (`finalBossMenace -0.40→-0.384`, statMult 0.60→0.616);
- una **forbice tra case più stretta**: Serpeverde 0.658 vs Grifondoro 0.183 (~3.5×), tenuta solo dal
  gate rilassato `<0.71`.

**Causa radice comune**: lo **snowball del leveling win-based** (`game/engine/leveling.ts`
`growthBudgetPerLevel` — l'atk di una squadra vincente cresce ~2.5× fino al cap → one-shotta tutto;
la spell-power diventa irrilevante). I trim di atk base si auto-cancellano (i maghi taggati si
indeboliscono anche come nemici, pool condiviso).

**Il pass**: (a) alzare la **baseline della squadra competente** / i reward (reliquie migliori, reward
di livello, uno spike di potere prima dell'area finale) E (b) **tarare lo snowball in modo
agnostico-per-casa** (abbassare `growthBudgetPerLevel` + ricalibrare l'enemy budget per tenere la band).
POI:
- alzare `finalBossMenace` alla parità coi boss d'area (e far scattare il tripwire deferito in
  `tests/engine/finalBossClimax.test.ts`);
- ri-tarare la forbice tra case **senza** nerf per-mago.

⚠️ È il gate `campaignBalanceB [0.15,0.45]` il vincolo primario, ed è già fragile: ricalibrare
con cura.

---

## 2. WATCH — regressioni da ri-controllare (dopo il pass #1)

- **Scudi-Rigen viability**: `scudiRigenSweep` winRate sceso **0.258 → 0.100** (passa ancora il floor
  `>0.05`) per via del trim atk di Voldemort-nemico nel bilanciamento Serpeverde. Quasi-marginale.
- **`infirmaryResolver`** OMETTE il ricalcolo di `activeSynergies` dopo full-heal/revive (bug latente;
  `useConsumableRelic` lo fa correttamente — rendere l'Infermeria coerente).

---

## 3. Dramma & feedback (P8) — *USER-GATED (serve la tua direzione visiva)*

Solo presentazione; il motore emette già i dati. Callout a schermo in battaglia ("VELENO ×N",
flourish dell'execute-kill, "INFALLIBILE!", flourish del revive) + un recap/MVP di fine battaglia che
mostra il danno da veleno/execute/oscuro. **Per iniziare**: fornisci una direzione visiva / mockup,
poi è un piano UI mirato.

---

## 4. Altri archetipi (replicare il pattern tracer-bullet provato)

Il pattern (engine keyword/flag → reliquia grant+scale → tag-synergy → validazione counter-web →
loadout) è provato **4 volte** (Veleno, Esecuzione, Scudi-Rigen, Magie Oscure) e va veloce. Restano
dalla roadmap (Appendice D del direction doc): **Velocità/Catena, Controllo, Rigen/Vampiro, Sacrificio,
Evocazione, Crescendo, Difensiva**.
**Regola utente**: ogni nuovo archetipo dichiara la sua **matrice counter** (cosa batte / a cosa perde)
+ un test che la verifica. Usare la metrica **first-hit, non total-damage** (il danno totale è
confuso dalla velocità di kill).

---

## 5. Pillar Onda 2+ (dal direction doc) — grandi, futuri

- **P2 — Reliquie cambia-regole** (ordine di turno, doppio-cast, conversioni).
- **P3 — Eventi narrativi** (i nodi vuoti `event`/`shop`/`commonRoom`/`library`/`forest` — il più grande
  gap di *memorabilità*, puro data/testo).
- **P4 — Boss roster scriptato** (ogni boss è una regola che counter-a un archetipo: Umbridge banna una
  keyword, Dissennatori drenano, Bellatrix, ecc.). Sinergico col boss finale forte (#1).
- **P5 — Economia del Sacrificio** (Corruzione, scelte dolorose, reliquie-sacrificio).
- **P6 — Sorprese & segreti** (recruit rari, boss nascosti, questline Doni della Morte).
- **P7 — Meta-progressione** (Codex/unlock "a scoperta non a potere", Ascensione, Daily Run).

---

## 6. Minor accumulati (opportunistici, nessuno bloccante)

- Alcuni test saltano un ramo no-op (`setWizardSpell` guardia stesso-spell non testata).
- Blind spot di un'invariante in `tests/data/spells.test.ts` (uno spell con `power` + uno `spec` senza
  voce damage passerebbe il check "l'attacco fa danno").
- `teamKeywords` helper mai costruito (serve solo se una sweep deve contare sorgenti-keyword non-tag).

---

## Counter web attuale (emergente dalle meccaniche)

| | Batte | Perde vs |
|---|---|---|
| Veleno | Tank / Scudi (bypassa DEF + scudi) | Regen / Burst |
| Esecuzione | Fragile / basso-HP (finisher) | Muri durevoli (Tank/Scudi/Regen) |
| Scudi-Rigen | Attrito / danno-sostenuto | Esecuzione / Burst |
| Magie Oscure | Squishy (nuke amplificato) | Scudi / Chip-Controllo (recoil letale) |
| Mira Infallibile (counter-ability) | Grifondoro / dodge-stacking | — (counter a senso unico) |

---

## Come riprendere

1. Visione: `…/specs/2026-06-28-game-design-direction.md`. Storia: `git log` + `.superpowers/sdd/progress.md`.
2. **Prossimo passo consigliato: il pass #1 (potere del giocatore)** — è il collo di bottiglia che
   sblocca sia il boss finale forte sia la forbice tra case.
3. Loop provato: spec → piano → esecuzione subagent-driven (TDD → review spec+qualità → review opus
   whole-branch) → merge → push. Ogni archetipo dichiara la sua matrice counter; metrica first-hit.
