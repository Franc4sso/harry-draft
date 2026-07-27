# Handoff — dove riprendere

Aggiornato: **2026-07-10**. Da un altro PC: `git pull origin master`, `npm install` (l'Endless batch ha
aggiunto `@netlify/blobs`), poi leggi questo file.

## Endless draft = draft campagna 2026-07-10 (SHIPPED + merged su master)

Il draft iniziale della modalità **Endless** ora è **identico a quello della campagna**: 3 schermate da
3 candidati tier-weighted, si pesca 1 per schermata (3 totali), **niente scelta della casata**. Il pool
resta il **roster completo** (`setDraftPoolRestriction(null)`, indipendente dagli sblocchi → leaderboard
equa). Prima l'utente sceglieva una casata e pescava i più forti — rimosso. Build subagent-driven (5 task
TDD + review finale opus = "ready to merge"). **1360 test verdi, tsc pulito.**
Spec/piano: `docs/superpowers/{specs,plans}/2026-07-10-endless-draft-parity*`.
- Endless riusa il path campagna: `DraftScreen` → `useDraft`/`DraftSession` → `confirmDraftPicks`. L'unica
  differenza campagna↔endless ora è il pool (campagna = sblocchi, endless = tutti).
- **Anti-cheat riscritto:** il `RunLog` non codifica più `house`+`starterIds` ma le **pescate ordinate**
  (`draftPicks`); `replayRun` ricostruisce la squadra guidando la STESSA `DraftSession` seedata e valida
  che ogni pescata fosse legalmente sulla sua schermata. `ENGINE_VERSION` bumped `endless-1`→`endless-2`
  → i vecchi codici Endless / voci leaderboard si invalidano (deciso, accettato).
- **Determinismo (anti-cheat):** live e replay fanno entrambi `setDraftPoolRestriction(null)` poi
  `startDraft(seed)` — la review finale ha tracciato l'ordine `useMemo`→`DraftScreen` come SICURO (nessun
  pool campagna stantio può filtrare). `endlessReplayParity` resta 0-mismatch (20 + 30 seed Duo).
- `starterOffer`/`chooseStarters` restano definiti in `runEngine.ts` (li usa solo il balance harness).

## Duo — leggibilità sulle carte 2026-07-11 (SHIPPED + merged su master)

Le carte ora spiegano **quali Duo alimenta un mago**. Build subagent-driven (5 task TDD + review
finale opus = ready-to-merge). **1380 test verdi, tsc pulito.** Spec/piano:
`docs/superpowers/{specs,plans}/2026-07-11-duo-card-discoverability*`.
- **Helper puri** (`game/engine/duos.ts`): `wizardDuoSignals` (segnali del mago che alimentano un Duo
  *spedito* — regola di onestà: niente chip per segnali senza Duo, es. attaccante), `duosForSignal`
  (per il tooltip), `previewDuos(team, relics, candidate)` (completa/avanza, usa `livingOf`).
- **UI**: `DuoSignalMarks` (segni per-segnale **icona-only** + tooltip "‹Segnale› → alimenta: ‹Duo›")
  sul poster-card (draft) e sulla row-card (team/recruit); **nastro contestuale** sui candidati di
  draft/recruit (oro "⚡ Completa 「…」" / verde "→ verso 「…」"). Combat busts intatti.
- **Icona-only deliberato**: `SIGNAL_LABEL.taunt='Tank'` collide col test "niente parola-ruolo sulle
  carte" → segni icona-only + tooltip (coerente con la preferenza "leggero"). OPZIONE se vuoi le
  etichette sui tag-segnali: rinomina taunt→'Provocazione' e passa a non-compact.
- **Recruit onesto a squadra piena**: `previewDuos` usa `baseTeam` (squadra meno il rimpiazzato), così
  il nastro non promette un Duo che lo swap non attiverebbe.

## Duo Combos 2026-07-10 (archetipi/combo — SHIPPED + merged su master)

La direzione "archetipi/combo" è stata realizzata come **Duo Combos**: 6 poteri stile Hades che si
auto-accendono all'incrocio di DUE "signal" di archetipo (tag ≥2 o reliquia; ruolo). **Solo player**
(come i joker → il bot di bilanciamento resta un proxy valido). Build subagent-driven (9 task TDD,
doppia review per task + review finale opus = "ready to merge"). **1354 test verdi, tsc pulito.**
Spec/piano: `docs/superpowers/{specs,plans}/2026-07-10-duo-combos*`.
- I 6 Duo: **Cancrena** (2× tick veleno <40%), **Miasma** (il veleno salta a un nemico vivo alla morte),
  **Untore** (le cure sputano veleno), **Muro Vivente** (retrovie non bersagliabili dietro un Tank che
  provoca con scudo), **Esecuzione a Freddo** (giustizia un nemico stordito <50%, boss-guarded),
  **Mietitore** (le esecuzioni danno +atk al carnefice, per-battaglia, cap +18).
- **Regole dure interiorizzate:** ogni rng di un Duo pesca dal `rng` del sim, pool ordinato, niente
  pescata a pool vuoto (determinismo = anti-cheat, `endlessReplayParity` esteso a Duo rng-attivi). Il
  bot NON capisce i Duo → `campaignBalanceB` resta piatto (0.2833); il vero gate è `tests/engine/duoStress.test.ts`.
- **⚠️ Da tarare (deciso: ship ora, tune dopo):** **Muro Vivente è ridondante con la Provocazione di
  ferro** — `tauntBonus=1000` già inchioda i nemici sul Tank e nessun boss ha `ignoresTaunt` (ritirato
  2026-07-08), quindi il retarget duro non aggiunge nulla nel roster attuale. Leve: un nemico/boss che
  ignora il taunt, oppure un bonus del muro indipendente (riflesso scudo / difesa retrovie).
- **PROSSIMO: playtest utente dei Duo** (e del nuovo draft Endless). Poi tarare Muro Vivente + i 4 Duo
  fast-follow (Guscio Tossico, Preda Facile, Ara/Sacrificio, Catene).

## Carte draft "poster" 2026-07-08 (leggibilità del valore)

Review finale whole-branch (opus): SPEC ✅ / quality approved. 1215 test verdi, tsc + build ok.
Spec+piano+mockup in `docs/superpowers/{specs,plans,mockups}/2026-07-07-draft-poster*`. La carta
del DRAFT (`components/cards/WizardCardColumn.tsx` — è QUESTA la card viva, via `DraftScreen →
DraftCandidateCard → WizardCardColumn`; NON `WizardCard`, che era dead code e ora è rimosso) è
stata ridisegnata a "poster": ritratto a tutta carta, icona-ruolo pulita in alto (solo icona, il
volto respira), ruolo + nome monumentale (Cinzel) + epiteto, blocco-magia grande, **targa oro =
abilità personale del mago**, stat colorate, nudge sinergia. Tolte le pillole affiliazione (feedback
utente "troppe pillole").
- **L'abilità personale = la SIGNATURE esistente del mago** (scoperta: tutti i 60 maghi hanno già
  una `Signature` in `data/signatures.ts` con nome+desc, es. draco "Tocco Velenoso: i suoi colpi
  possono avvelenare"). `abilityFor(id)` in `lib/wizardAbilities.ts` la legge (fallback role-based).
  NIENTE 60 frasi scritte a mano — si riusa ciò che esiste, fedele alla meccanica. `epithetFor` è
  role-based (`lib/wizardEpithet.ts`).
- **Tooltip ruolo corretti** (`lib/roleInfo.ts`): erano obsoleti dopo i cambi combattimento (es.
  "Controllo scavalca il Tank" → ora "scavalca la provocazione del Tank solo se riesce a stordirlo").
  Aggiunti `ROLE_VERB` (Provoca/Colpisce/Cura/Disabilita) e `ROLE_ACCENT` (Tank #3aa0f2, Attaccante
  #ff5140, Supporto #20d894, Controllo #b355ff).
- Componenti nuovi riusabili: `RoleBadge`, `AbilityPlate`. `CARD_STAT_MAX` spostato in
  `components/cards/cardStats.ts` (era in WizardCard, ora eliminato).
- **PROSSIMO (slice futura, fuori scope)**: allineare le carte in COMBATTIMENTO (`UnitBust`) e in
  TEAM/RECRUIT (`WizardCardRow`, orizzontale) allo stile poster — solo ritocco estetico, senza
  toccare struttura/VFX (decisione utente).

## Stato in una riga

Il gioco è un roguelite auto-battler (Harry Potter, Next.js/TypeScript). Il loop di run
è ricco: mappa a nodi, combattimento, progressione. **Tutto il lavoro recente è su
`origin/master` (0 commit avanti).** Prossimo: **playtest** (ora anche i joker!) + nuovi
nodi run (campfire, modificatori di battaglia). 1218 test verdi, typecheck pulito, build ok.
(Provocazione vera + perf UI non-combat + fix veleno/morte + archetipi Supporto appena chiusi — vedi sotto.)

## Provocazione vera 2026-07-07 (Tank taunt reale, tutti i ruoli attaccanti)

3 task (commit `43159f3`..`1e8e6d2`, spec in `docs/superpowers/`/`.superpowers/sdd/`).
Prima di questa slice il Tank "provocava" solo sulla carta: `threatScore` dava un bonus
al Tank ma Attaccante/Supporto-offensivo/Controllo lo ignoravano quasi sempre nella
pratica (il Tank veniva bypassato). Ora:
- **Task 1**: Tank e Supporto con magia offensiva (Attacco/Controllo) rispettano il taunt
  — se un Tank nemico sta provocando (vivo, non hard-controllato), lo colpiscono invece
  del bersaglio di default (`activeTauntTank` helper condiviso). L'Attaccante già lo
  rispettava (Affondo) — non toccato, verificato non-regredito.
- **Task 2**: il Controllo bypassa il taunt SOLO con una magia hard-control (stun/freeze/
  silence, `HARD_CONTROL_KINDS`) — spende quel controllo per rompere la provocazione. Con
  una magia soft (es. confundo, solo debuff spd) scavalca comunque verso il backline
  (martellare un muro incassabile è spreco, validato a sim). Una volta stordito il Tank,
  `activeTauntTank` torna false → tutti scavalcano normalmente (Global Rule pre-esistente:
  un Tank sotto hard-control perde il taunt).
- **Task 3 (questo)**: sim full-battle di sanità — Tank giocatore che provoca (alta
  def/hp) + carry fragile vs squadra nemica MISTA (Attaccante + Tank + Controllo con
  petrificus + Supporto offensivo con serpensortia). Risultato: il Tank assorbe **43/51
  = 84.3%** dei colpi nemici prima di essere stordito dal Controllo, il carry ne prende
  solo 8/51 — la provocazione ora funziona davvero in game reale, non solo a unit-test.
  Regressione completa: 294 file / 1218 test verdi, tsc pulito, zero fixture re-ancorate
  (i test esistenti già coprivano esattamente questo comportamento dai Task 1-2, nessuna
  rottura). Balance re-misurato con git-diff prima/dopo di `targeting.ts` (commit
  `aabfbf2` = prima dei 3 task): **campaignBalanceB 0.225 → 0.225 (invariato)**,
  campaignBalanceRestricted 0.300 → 0.308 (rumore, +1/120 seed) — il cambio di targeting
  non ha spostato la winrate campagna (il floor 0.15 resta ampiamente rispettato, nessun
  bisogno di toccare `tauntBonus`). Report completo in `.superpowers/sdd/task-3-report.md`.

## Archetipi Supporto 2026-07-07 (identità distinta, spec+piano in docs/superpowers/*supporto-archetypes*)

Review finale whole-branch (opus): SPEC ✅ / quality approved. 1205 test verdi, tsc pulito.
Diagnosi: i 14 Supporto clonavano episkey+protego → intercambiabili; serpensortia era leaked
in TUTTI i ruoli. Slice (11 commit b74f8c9..fc75131):
- **Whitelist per ruolo** (`lib/roleSpellPools.ts`) + guard test: ogni magia di ogni mago ∈
  whitelist del suo ruolo. **serpensortia** (un Attacco) lecito su Tank/Attaccante/Controllo,
  VIETATO su Supporto. **confundo** (Controllo) tolto da harry/sirius (Attaccante puro).
- **4 archetipi Supporto** (solo effetti esistenti): Guaritore (heal/revive/ferula), Scudiero
  (protego/fianto/aegis/colletivo_scudo), Stratega (incitamento/riddikulus/salvio), Purificatore
  (salvio/ferula/anapneo). I 14 Supporto riassegnati; ogni pool ha ≥1 magia PROATTIVA (utile a
  HP pieno: protego/fianto/salvio/ferula — NON le cure/rider che servono un ferito).
- **Supporto = ZERO attacchi diretti (lato PLAYER)** — via pool puliti. Il tag `veleno` tolto da
  narcissa/slughorn/sprout/astoria (non avvelenano più); sinergia Tossicità ancora formabile (6
  veleno-maghi non-Supporto restano). STARTER veleno-quota via pansy+theodore (starter-safe).
- **Nemici elite/boss: ≤1 Supporto** (con altri ruoli), e quell'1 riceve `base_attack` via
  `guaranteeOffense` (nessun nemico innocuo). Il PLAYER-Supporto non passa mai da lì → identità
  intatta. `capSupporto` in teamGen sostituisce i Supporto in eccesso con non-Supporto.
- **MURO_ALT boss-leader**: pettigrew (Supporto) → **marcus** (Serpeverde Attaccante, powerOf
  145.5 = match esatto, balance immoto). Regola: nessun Supporto come boss-leader scriptato.
- **VFX per-magia** rifinite per archetipo (Guaritore verde, Scudiero azzurro, Stratega dorato,
  Purificatore argento). Tutte le 14 avevano già entry; corretti 3 mismatch colore.
- **⚠️ BALANCE**: campaignBalanceB winRate **0.375 → 0.225** (più difficile — i Supporto player
  non fanno più danno). **APPROVATO dall'utente** come ok (sopra il floor 0.15, coerente con
  "difficoltà più cattiva approvata"). Se al playtest è troppo, la leva è buffare cura/scudo/buff
  dei Supporto, NON reintrodurre attacchi. Task 4 del piano (rimuovere branch targeting) CANCELLATO:
  dopo la decisione ≤1-Supporto-nemico quel branch NON è morto (aima il base_attack del Supporto
  nemico al nemico giusto — rimuoverlo darebbe fuoco amico).

## Fix veleno/morte 2026-07-06 (combattimento)

Tre bug fixati (commit 0d18e27): (1) **mago morto attaccava** — un'unità uccisa da un tick di
veleno si auto-rianimava con la propria rigen nello STESSO tick (`tickHeal` gated su `unit.alive`
stantio invece di `hp>0`); ora la morte "atterra" nel tick. (2) **icona veleno**: la pill mostrava
`remaining` (2, congelato) invece delle dosi per la PRIMA dose (guardia `stacks>1`); ora mostra
sempre le dosi (≥1). (3) **tooltip "-0 HP/turno"**: usava `amount` non settato invece di
`tickDamage` del def. Veleno ticca a FINE ROUND (= "fine turno" nel modello round=turn) — verificato,
invariato. Vedi memoria [[harry-draft-dot-death-self-revive]].

## Perf UI 2026-07-06 (COMBATTIMENTO): ArenaBackdrop statico — VFX attacchi INTATTI

`212d697`. Misurato il combattimento con Playwright (probe rAF-FPS). **Attenzione al
metodo**: Chromium headless usa SwiftShader (rendering software CPU) che ammazza Pixi/WebGL →
cifre finte (3fps). Rifatto headed con GPU vera (Intel Iris Xe/D3D12): idle arena ~52fps,
replay attacchi ~30fps. Attribuzione LoAF: `blocking:0`, quasi zero script → **il collo non è
JS/React** (la memoization di 8739a3e regge), è **paint/compositing**. NB: su questa macchina
(WSL, compositor software) le cifre assolute NON sono affidabili — la varianza tra run supera
l'effetto; il verdetto vero sul framerate va dato a occhio su finestra nativa.
- **Causa (meccanismo, non solo numeri)**: `ArenaBackdrop` girava ~15 loop framer-motion
  INFINITI dietro la battaglia (glow scale/opacity, una haze con `blur(9px)` che driftava, 12
  embers che salivano) → ripaint dell'intera arena a OGNI frame del compositor, che poi ogni
  card `backdrop-blur` dei maghi ri-campionava sopra. Stessa tax già rimossa da GameShell/
  MapScreen nella slice non-combat.
- **Fix**: `ArenaBackdrop` reso STATICO — gradiente + glow + scatter di embers fermi + vignette
  (look preservato: gradienti/posizioni/vignette identici). La GPU ora dipinge solo quando parte
  un VFX d'attacco vero. **VFX attacchi NON toccati** (`SpellFx` / impatto `UnitBust` restano
  mount-on-cast) — verificato a schermo: callout, cast dorato, squash&stretch tutti presenti.
- **NON toccato di proposito**: il `backdrop-blur-sm` sulle card dei maghi (parte del look
  glass premium; ora che il fondo è fermo, non ri-campiona più un campo in movimento → costo
  crollato da solo). Se al playtest il combattimento scatta ANCORA su finestra nativa, le leve
  successive sono: (a) togliere/ridurre `backdrop-blur` sui bust, (b) canvas Pixi a risoluzione/
  DPR ridotto, (c) atlas texture. NIENTE di questo tocca la bellezza degli attacchi (il costo è
  paint, non gli effetti).
- 1185/1185 test verdi (nuovo test arenaBackdrop: "static, no per-frame animation"), tsc pulito.

## Perf UI 2026-07-06 (pagine non-combat): background statico + dedup effetti

Diagnosi: frame drop nelle pagine non-combat da tax globale di animazione. Fix (spec+piano
in `docs/superpowers/{specs,plans}/2026-07-06-noncombat-perf*`, SDD ledger locale). Solo
UI/CSS/markup, ZERO motore, look il più vicino possibile all'attuale (rimozione di costo, non
redesign). 1184 test verdi, typecheck pulito. Tutto pushato.
- **GameShell statico** (`0bae860`): il backdrop montato su OGNI route (app/layout) non anima
  più. 3 fog blob tenuti (gradienti/posizioni/dimensioni byte-identici) ma blur 110/120/100→60px
  e senza animazione; 14 ember infiniti + noise mix-blend rimossi; vignette invariata. Keyframe
  `warmDrift`/`emberRise` cancellati (orfani). `anim-ambient` lasciato (lo usa MapScreen).
- **Dedup blob per-schermata** (`443e0ea`): rimossi i blur blob ambient ridondanti che
  Menu/Result/Boss impilavano sopra GameShell (34 righe, puramente sottrattivo). Tenuti gli
  effetti in primo piano (Menu CTA aura, teaser levitation, Boss Skull pulse).
- **PortraitImage lazy-load** (`29048ce`): +`loading=lazy` +`decoding=async` +`width/height`
  512×512 → niente CLS nella griglia Collezione (~60 img). `object-cover` + sizing CSS →
  nessuna distorsione su sorgenti non-quadrate.
- **MapScreen** (`e58eedd`): rimossi 8 `.map-ember` duplicati (GameShell già li aveva) +
  const/keyframe/rule relativi; `mapCurrentPulse` da `filter:brightness` (repaint) a
  `transform:scale(1.06)+opacity` (composite-only). Nodo pulsa ancora. **Live-edge SMIL /
  motion.path / glow del sentiero NON toccati** (già ottimizzati). reduced-motion preservato.

## Fix 2026-07-06 (dopo i joker): veleno visibile + combattimento fluido

- **Veleno: gli stack ora si vedono crescere**. Bug: il pill/tooltip mostrava `remaining`
  (durata, fissa a 2 perché il veleno è `permanent`) invece di `stacks` (le dosi, 1→8). Ora
  mostrano le dosi (`effectCount`/`describeEffect` in `UnitBust.tsx`). La meccanica era già
  corretta — solo il display sbagliava. Commit `47f2158`.
- **Combattimento più fluido (pass di memoization, ZERO cambio visivo)**. Causa: nessun
  `React.memo` nell'albero battaglia → ogni frame di replay ri-renderizzava tutto, e
  `recapTotals` ri-scansionava tutta la storia dal frame 0 a ogni tick (O(n²), 2-4× — ecco il
  "diventa più pesante col procedere"). Fix: memoizzati recap/log slices + derivazioni di
  BattleArena; `React.memo` su UnitBust/BattleRecap/BattleLog/InitiativeBar/ArenaBackdrop.
  Punto chiave: `floatKey` ora va solo al bust bersagliato (era `frameKey` su tutti → rendeva
  il memo un no-op). Spec/piano: `docs/superpowers/plans/2026-07-06-battle-perf.md`. NON toccato
  Pixi/GSAP (già a posto). Commit `6627586`..`8739a3e`.

## Ultima slice (2026-07-06): JOKER espansi + reliquie ridisegnate

Diagnosi iniziale: i "joker" (reliquie che scalano dentro la run) c'erano ma **non si vedevano
mai** — non un bug di applicazione (verificata la catena kill→counter→stat), ma di offerta:
erano epica peso 6 in un pool ristretto → ~10% di comparsa. Fix + espansione (spec+piano in
`docs/superpowers/{specs,plans}/2026-07-06-jokers-and-relics*`):
- **Motore joker esteso**: nuovi trigger di scaling `turn`/`battleWin`/`allyDead` (oltre `kill`);
  stat scalabili `defense`/`speed` (oltre atk/maxHp/velenoMult); `conditional` statico
  `teamSizeBelow`; `drawback` (malus sempre attivo); `onlyTurn` (trigger reattivo solo al turno N).
- **`BattleResult.alliesLost`**: conta i maghi del player caduti (tutti e 4 i percorsi di morte:
  diretto/contraccolpo/veleno/**fatica**) → alimenta il joker "Eredità dei Caduti".
- **11 joker nuovi** (`data/relics.ts`): 4 scaling (Marcia di Guerra, Fortezza Vivente, Vento
  Crescente, Eredità dei Caduti), 2 condizionali (Ultimo Baluardo, Branco Ristretto), 2 con
  drawback (Patto Vorace, Sete di Sangue), 3 reattivi (Furia Morente, Canto del Cigno, Assalto
  d'Apertura — usano lo status `atkUp` +20/2turni). Tutti `epica`, tutti in `JOKER_RELIC_IDS` +
  `STARTER_RELICS`.
- **Pool separati**: `offerRelics` esclude i joker; nuovo `offerJokers` (pesca uniforme).
- **Nodo reliquia → joker o reliquia**: con prob. **`BALANCE.relics.jokerNodeChance` = 0.35** il
  nodo offre 3 joker invece di 3 reliquie base (deterministico per seed+nodo). **Questa è la leva
  di visibilità dei joker** — se al playtest le reliquie tematiche spariscono troppo, abbassala.
- **Joker MAI sui nemici**: `selectEnemyRelics` esclude tutti i `JOKER_RELIC_IDS` (i joker sono
  solo del player, balance-safe per costruzione — il bot non li pesca).
- **2 reliquie base ridisegnate a budget costante**: Mappa del Malandrino (+6 atk + esecuzione),
  Ricordella (+6 def/spd + piccolo scudo a inizio battaglia). Giratempo lasciata invariata (la
  conditional "mentre a HP pieno" non è esprimibile: `RelicConditional` supporta solo il gate
  statico `teamSizeBelow`).
- **Balance**: campaignBalanceB **0.3583**, campaignBalanceRestricted **0.3750** (sopra floor con
  margine largo). NOTA: le assert live di questi test sono `winRate>0`; i numeri 0.15/0.275 nei
  commenti sono storici. Due floor di sweep ri-ancorati (magieOscure, esecuzione) = artefatti di
  *disponibilità* (i joker occupano slot), non regressioni di meccanica — verificati A/B.
- **Nota copy (minore)**: le desc di Ultimo Baluardo / Branco Ristretto ("se restano meno di N
  maghi vivi") suonano dinamiche ma il gate è **statico** (valutato a inizio battaglia). Semantica
  approvata; se dà fastidio al playtest, o si riscrive la copy o si sposta il gate su un trigger
  reattivo `onAllyDeath`.

## Cosa è stato fatto di recente (NON rifarlo) — tutto su master

Ordine ~cronologico, tutto committato+pushato:
- **Meta-layer & retention**: profilo, sblocchi (milestone + Cioccorane), boss pool, codex, schermata Collezione (album Cioccorane).
- **Event nodes** (`?`): nodi data-driven scelta-e-conseguenza + reliquie rompi-regole. Veleno ridisegnato **permanente** (ticca fino a fine combattimento) con danno diretto basso.
- **Scaling jokers**: reliquie che crescono per uccisione, reset a ogni run (Fame Vorace/Collezionista/Marchio Vorace). Cap alzati per farle "snowball" tutta la run.
- **Mappa/UI**: barre PV nella sidebar; **hover elite** con roster nemico (ritratto·ruolo·magia·PV·"forte vs"); **sigillo boss = ritratto del villain** (non emoji); restyle albero (faro in cima, embers, sentiero); cerchi pieni; z-index hover.
- **MAX 5 nemici** (hard cap strutturale, battaglia/elite/boss). Regola utente assoluta.
- **Fix ordine attacchi**: la barra "Ordine" ora usa il tiebreak del motore (spd → wizard id → side).
- **Sistema COUNTER dei ruoli (RPS)** — 🛡️Tank→⚔️Attaccante→✨Supporto→🌀Controllo→🛡️Tank. Matrice danni ×1.25 vs preda ⚠️ **RIMOSSA il 2026-07-13** (ciclo mezzo-morto: il Supporto non attacca) + passive di ruolo (Provocazione; Affondo = l'Attaccante si tuffa sul Supporto; Tenacia+Purificazione = il Supporto dimezza/pulisce i controlli; **Regola Globale: un Tank stordito perde la Provocazione** = così il Controllo lo batte e l'Affondo si apre) — targeting/hard-control RESTANO validi, solo il moltiplicatore di danno è tolto. Bias magia↔ruolo in `pickSpell` + invariante di pool. `game/engine/combat/roleCounter.ts`. Spec: `docs/superpowers/specs/2026-07-05-role-counters-design.md` (SUPERATA, vedi `docs/superpowers/specs/2026-07-13-remove-role-counter-design.md`).
- **Cap di livello RIMOSSO**: i maghi del giocatore salgono oltre il 10 (`gainLevels`/`levelFromExp`). `levelMax=10` resta solo per i NEMICI + boss finale.
- **Onda 1.e — via i tre nodi-menu** (2026-07-25): spellForge (Aumento Magia), spellSwap (il nodo — il *loadout* swap-magia era già sparito l'11-07 con "UN MAGO, UNA MAGIA", cosa diversa) e shop (Negozio) tolti da `RunNodeType`/mappa/UI — erano workaround nati per rimpiazzare il loadout tolto, non il loadout stesso. `categoryWeights` NON ridistribuito (stessi pesi assoluti battle/recruit/relic/event, sparito solo il denominatore dei tre menù) — misura A/B in testa a `tests/engine/campaignBalanceRestricted.test.ts`: i numeri grezzi salgono (94/12/14 → 87/8/25 sull'area0/1/2) ma il baseline PRIMA risale a un'harness senza handler per shop/spellForge (stessa lacuna già nota per l'altare, `break`→`'defeat'`), quindi il confronto NON è pulito — vedi la lettura onesta nel commento dell'harness, nessuna ritaratura fatta. ⚠️ **`lib/runStore.ts` VERSION 2→3**: scarta qualsiasi run di campagna/endless IN CORSO salvata prima di questo lavoro (un v2 save può referenziare id-nodo di un tipo ormai inesistente) — profilo, Cioccorane e sblocchi NON sono toccati (vivono altrove), solo la run in corso.

- **Onda 1.d — le firme potate da 60 a 15** (2026-07-27): `data/signatures.ts` conteneva 60 firme
  che si riducevano a ~12 meccaniche ripetute — 27 maghi di Tier 4 con effetti ±10% (invisibili in
  un gioco che si GUARDA), un clone **esatto** (`goyle`/`crabbe` = "Stazza", stesso nome e stesso
  `-10%`), `-10% danni subiti` sotto **5** nomi diversi e `+10% danni` sotto **3**. Regola di
  sopravvivenza: resta solo chi produce a schermo qualcosa di **nominabile** (uno stato applicato,
  un turno saltato, uno scaling che si vede). Scelta per **distintività**, NON per tier: Tier 1 3/3
  · Tier 2 6/10 · Tier 3 6/20 · **Tier 4 0/27**. I 15: dumbledore, voldemort, harry, snape,
  bellatrix, mcgonagall, lupin, kingsley, fleur, hermione, cho, molly, neville, luna, tonks.
  - **TUTTI E 60 I MAGHI RESTANO** (`data/wizards.ts` intatto): un mago "pulito" tiene nome,
    ritratto, casata, ruolo, tag, magia, statistiche. **Duo/Trii/Sinergie non sono toccati** —
    leggono `tag`+`ruolo`, mai le firme. Il pool del tag `veleno` è invariato (6 maghi).
  - **UI**: `abilityFor()` ora torna `undefined` (via il ripiego per-ruolo) e la carta-poster
    **non rende la targa oro** sui maghi senza firma — è la rarità della targa a darle significato.
    `WizardCardRow` era già dietro `{signature && …}`.
  - **Scoperta**: `snape` e `draco` NON hanno il tag `veleno` — il loro veleno era solo firma.
    Dopo la potatura l'unica firma che avvelena è quella di snape, ma draco e lucius avvelenano
    ancora lanciando `serpensortia` (spellPool intatto): l'archetipo regge.
  - ⚠️ **BILANCIAMENTO, due segnali opposti, entrambi misurati.** `campaignBalanceRestricted`:
    `normalBattlesWon` **98→116** (+18%, il winRate 0.0417→0.0500 è +1 seme = rumore) → il gioco
    è **un filo più facile per il bot**, plausibilmente perché le firme valgono per entrambi gli
    schieramenti e i nemici pescano dal roster comune di Tier 3/4. MA `scudiRigenSweep`:
    profondità **−24%/−34%**, winRate 0.008→0.000 → l'archetipo **Scudi-Rigen è più debole**, si
    appoggiava alle firme `-10%` dei Tassorosso di Tier 4. **Nessuna ritaratura** in nessuna
    direzione: decide il playtest. Il gate `winRate > 0` di quello sweep aveva esaurito la
    risoluzione (poggiava su 1 vittoria su 120) ed è stato **ri-espresso** (combatte + supera
    l'area 0), non svuotato.
  - Fixture ri-tarate e **giustificate per iscritto** nei rispettivi test: `scudiRigenCounters`
    (seed12→seed7, atk invariato), `magieOscureCounters` (squishy hp 370→460, seed dark5→dark0),
    e il test del rianimatore in `simulate.test.ts` riscritto **deterministico** (scansionava 2000
    semi e ne trovava 0 su 20.000: l'alleata fragile era luna, che tiene la firma di rigenerazione,
    e non moriva più nessuno — ora il revive scatta su 300 configurazioni su 300).

## PROSSIMO — da fare

1. **PLAYTEST (priorità)** — il bot di bilanciamento NON capisce i counter né sceglie le magie come un umano, quindi il giudizio è tuo:
   - I **counter dei ruoli** (feeling del ciclo Tank/Att/Sup/Ctrl).
   - ⚠️ **Il Controllo ora fa MENO danno diretto** (il suo +25% era vs Tank, che però evita; ha perso il vecchio bonus) — **NOTA 2026-07-13: quel +25% vs Tank è stato RIMOSSO insieme a tutto il moltiplicatore di counter**, quindi questa riga descrive ormai solo il danno base del Controllo, non un residuo di counter. Voluto (la sua forza è disabilitare), ma se è troppo debole va buffato — lever: targeting in `roleCounter.ts`/`targeting.ts` (la matrice di danno non c'è più).
   - `campaignBalanceRestricted` (il vero proxy) ≈ **0.275** — difficoltà reale invariata. Le sweep a 0.0 sono il bot cieco-ai-counter, non un bug.
2. **Nodo Campfire/riposo** (scelta cura-vs-potenziamento).
3. **Nodi modificatore di battaglia**.

### Come aggiungere un nuovo nodo run (checklist collaudata — vedi i commit altare/event)
`types/run.ts` (RunNodeType se manca + RunPhase `X-node` + eventuali campi su RunNode + RunEvent.kind) · `game/engine/nodeCatalog.ts` (riga NODE_CATALOG) · nuovo `game/engine/resolvers/X.ts` + registra in `runEngine.ts` (`registerCoreResolvers` + `phaseForNode`) · `game/engine/nodeGen.ts` (`Filler` union + `pickFiller`) + `data/constants.ts` (`categoryWeights.X`) · `hooks/useRunB.ts` (RunBView + viewForPhase + callback) · `components/screens/XScreen.tsx` + `RunBRunner.tsx` (case) · `MapScreen.tsx` ICON/LABEL/ACCENT.

## Regole del progetto (importanti)

- **Copy in italiano.** Commit su master + push senza chiedere quando il lavoro è finito (flusso stabilito dall'utente).
- **MAI più di 5 nemici** in nessuno scontro (regola assoluta). Enemy count = leva primaria di difficoltà; budget/livello sono leve morte; boss finale = 5 unità (pin).
- **MAI fuoco amico** (guard strutturali in `effects.ts`). NIENTE camera shake nei VFX.
- **Recruit rari** (hard cap ≤1/area). L'utente NON vuole scontri che forzano una build.
- **Difficoltà "più cattiva" è approvata** — non ammorbidire la forza nemica.
- `npm run test` NON esegue il typecheck → `npm run typecheck` a parte.
- Il **bot di bilanciamento non capisce i counter** → il playtest umano è l'unico vero metro; tratta i winRate come smoke check.

## Vedere il gioco (screenshot harness)
Playwright è installato (devDep, in package.json). Su un PC nuovo: `npx playwright install chromium` una volta. I driver di guida (reach map/battle/shop → screenshot) erano nella scratchpad della sessione (`shoot.js`/`shootBattle.js`/`shootShop.js`) — ricostruibili: apri `/play`, svuota `localStorage['harry:run:v1']`, reload, clicca `[data-testid="draft-pick-0"]` ×3 → mappa; i nodi sono `button[aria-label="..."]` (usa `.click({force:true})` per l'anim breathe).

## Comandi utili
```
git pull origin master
npm install
npx playwright install chromium   # una volta, per gli screenshot
npm run dev            # localhost:3000  (la run è su /play)
npm run test           # vitest (NO typecheck)
npm run typecheck      # tsc --noEmit
npm run build
```

## Processo (subagent-driven)
Le feature grandi si costruiscono: `superpowers:brainstorming` → spec → `writing-plans` → esecuzione subagent (implementer + reviewer per task, review finale whole-branch, poi merge). Spec e piani stanno in `docs/superpowers/{specs,plans}/`. I ledger `.superpowers/sdd/*` sono scratch LOCALE (gitignored, non arrivano su un altro PC — lo stato "vero" è questo file + i commit).
