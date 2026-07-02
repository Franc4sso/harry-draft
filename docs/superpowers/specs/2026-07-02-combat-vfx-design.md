# Combat VFX Redesign — Design Spec

> Data: 2026-07-02. Blocco: redesign del combattimento (l'UI non-combat "Sala Comune" è già fatta).
> Direzione decisa con l'utente: combattimento **premium/unico**, intuitivo, "la parte più bella".

## 0. Principi non negoziabili

1. **NIENTE camera/screen shake.** L'impatto si legge dalla **reazione del mondo**: onda d'urto (Pixi `ShockwaveFilter`), bloom/glow, squash&stretch sul bersaglio, particelle. Mai muovere la camera/arena.
   - Va rimosso anche il mini-jitter di posizione per-unità in `UnitBust.tsx:155-158` (`x:[0,-6,6,-3,0]`) → sostituito con **recoil squash&stretch** (scale, nessuna traslazione a scatti).
2. **Leggibilità è legge.** HP, numeri di danno, log e turni restano immediatamente leggibili. I VFX non coprono mai le info critiche. Testo su base scura piena.
3. **Rispetto di `prefers-reduced-motion`** ovunque (come già fa SpellFx/UnitBust): sotto reduced-motion i VFX Pixi si spengono, restano solo cambi di stato istantanei.
4. **Armonia con la Sala Comune**: palette calda (ori, pergamena, inchiostro), ma pensata per l'azione. I colori dei proiettili seguono `lib/spellArchetype` (già definiti).
5. **Nessun ricalcolo di combattimento nel layer VFX.** Il fight è pre-simulato; il VFX è pura presentazione guidata dai dati esistenti.

## 1. Architettura

Tre librerie, tre ruoli distinti (installate: `pixi.js` v8, `pixi-filters`, `gsap`, `howler`):

- **PixiJS (WebGL)** — il *renderer degli effetti*. Un canvas `absolute inset-0 pointer-events-none` montato come ultimo figlio del div arena (`BattleArena.tsx:94`, `data-testid="battle-arena"`). Le coordinate `{x,y}%` già calcolate in `BattleArena.tsx:47-68` mappano 1:1 sul canvas. Effetti: proiettili con scia, onde d'urto, glow/bloom, burst di particelle, cupola scudo, distorsione.
- **GSAP** — il *regista*. Una `timeline` per ogni evento di combattimento (una `LogEntry`) che sequenzia le fasi (carica → volo → hit-stop → impatto → reazione) con timing al frame, e pilota sia gli oggetti Pixi sia i cue audio. Deve stare dentro il budget `stepMs/speed` (default 1200ms, `useBattleReplay.ts:46`).
- **Howler.js** — il *bus audio*. Un cue per fase/archetipo (whoosh cast, thud impatto, ping scudo, stinger critico, tick veleno). Sincronizzato ai marker della timeline GSAP. Placeholder procedurali finché non arrivano asset audio veri.

### Moduli (nuovi)

```
lib/vfx/
  PixiStage.ts        # init/teardown dell'Application Pixi, resize, layer di rendering
  effects.ts          # primitive: projectile(), shockwave(), burst(), glow(), dome(), impactBloom()
  choreograph.ts      # entry → GSAP timeline (per archetipo + flags), dentro il budget stepMs
  audio.ts            # Howler bus: cue per fase/archetipo, mute/reduced-motion aware
  palette.ts          # colori derivati da spellArchetype + tokens Sala Comune
components/battle/
  PixiArena.tsx       # client component: monta PixiStage, sottoscrive entry/index/hp/speed, chiama choreograph
app/combat-lab/
  page.tsx            # harness di sviluppo: bottoni che sparano LogEntry mock → vedi ogni effetto dal vivo
```

`PixiArena` è un client component (`'use client'`): `Application.init()` è async e browser-only → si monta in `useEffect`, si smonta con cleanup. Nessun SSR del WebGL (coerente con `motion.tsx`).

## 2. Modello a eventi

Ogni nuovo `frameKey`/`entry` da `useBattleReplay` = **un evento VFX**. `choreograph(entry, fromPoint, toPoint, budgetMs)`:

1. `archetypeFor(entry)` → archetipo (beam/curse/fire/dark/shield/heal/stun/disarm/none).
2. `entry.flags` modula: `crit` → hit-stop + slow-mo + shockwave più ampia + numero oro; `kill` → finisher (desaturazione bersaglio + stamp); `dodge` → whiff (proiettile manca, bersaglio blur-sidestep); `block` → cupola Protego + deflessione; `dot` → tick veleno ricorrente + callout "×N"; `heal` → scintille risalenti + refill.
3. `entry.value` → intensità (dimensione onda d'urto, numero particelle, size del numero).
4. Costruisce la GSAP timeline compressa in `budgetMs = stepMs/speed`, emette i cue Howler ai marker.

## 3. Catalogo effetti (per archetipo)

| Archetipo | Proiettile | Impatto | Audio |
|---|---|---|---|
| **dark** (Avada/Crucio) | orb viola con scia densa, carica al lanciatore | shockwave viola + burst + glow scuro | whoosh grave → boom |
| **curse** (Controllo) | bolt rosso | shockwave rosso + distorsione breve | crackle |
| **beam** (Attacco) | bolt oro/verde veloce | flash + shockwave piccola + scintille | thwip → thud |
| **fire** (dot/Incendio) | burst arancio | fiammata + particelle ascendenti; tick DoT ricorrente | fwoosh + crepitio |
| **shield** (Difesa/block) | — | cupola celeste + deflessione + "PARATO" | ping cristallino |
| **heal** (Cura) | — | scintille verdi risalenti + refill HP + "+N" | shimmer |
| **stun** | burst giallo | anelli gialli attorno al bersaglio + stelle | zap |
| **disarm** (Expelliarmus) | bolt oro | bacchetta che vola via + flash | swipe |

**Trasversali (da flags):** hit-stop (crit/kill), slow-mo pulse (crit/kill), numeri con arco+conteggio, HP a due layer (ghost drain), **crescendo/combo** (moltiplicatore che si accende à la Balatro concatenando colpi della stessa squadra).

## 4. Upgrade HP & numeri (framer-motion, restano)

- `HpBar.tsx`: due layer — `fill` (scatta) + `ghost` cremisi che cala in ritardo (~220ms) → il chunk perso si legge a colpo d'occhio. Colore per soglia (già presente).
- `damageFloat.ts` + il float in `UnitBust.tsx:271-288`: pop-scale + arco verso l'alto; crit più grande/oro con micro-conteggio; heal verde; dodge/parato in celeste corsivo.

## 5. Timing & performance

- Ogni timeline ≤ `stepMs/speed`. A `speed 2/4` le durate si comprimono (leggere `r.speed`).
- Solo transform/opacity/filtri GPU. Particelle limitate (pool riutilizzato). Un solo `Application` Pixi per arena, `ticker` in pausa quando la battaglia non è visibile.
- Reduced-motion: `choreograph` diventa no-op visivo (stato applicato istantaneo), audio opzionale.

## 6. Integrazione (punti esatti)

- Montaggio canvas: ultimo figlio di `BattleArena.tsx:94`, accanto a `SpellFx` (`:110`). `PixiArena` riceve `entry`, `frameKey`, `fx.from/fx.to`, `speed`, `reduced`.
- Sottoscrizione: `entry`/`index`/`hp`/`speed` da `useBattleReplay` (via BattleScreen `:48` → props arena). Usare `r.entry` (frame reale), **non** lo `stickyEntry`.
- `SpellFx`/`ShieldFx` attuali: il layer Pixi li **sostituisce** (proiettile+cupola passano a Pixi); float e HpBar restano su framer.
- `UnitBust` impact: rimuovere jitter x, mettere recoil squash&stretch; il flash resta.

## 7. Strategia di sviluppo (tracer-bullet)

1. **Harness `/combat-lab`** + `PixiArena` scaffold + 1 archetipo completo (dark) end-to-end, guidato da entry mock. Verifica live con `npm run dev` (Pixi v8 su Next 16 / React 19 / Turbopack).
2. Completa il catalogo effetti + audio placeholder.
3. HP ghost-drain + numeri premium + crescendo.
4. Integra in `BattleArena`, rimuovi SpellFx/jitter, rispetta speed & reduced-motion.
5. Test (rendering guard, reduced-motion no-op, timeline entro budget) + review + merge + push.

## 8. Rischi

- **Pixi v8 + Turbopack/Next 16 SSR**: mitigato dal mount client-only in `useEffect`.
- **Budget 1200ms stretto** ad alta speed: timeline parametriche su `budgetMs`.
- **Processo concorrente** (altra sessione su engine/data/test): committare solo i miei file con pathspec esplicito, mai `git add -A`.
