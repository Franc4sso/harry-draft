# Handoff — dove riprendere (redesign UI)

Aggiornato: 2026-07-02. Ultimo commit su `origin/master`: `8534a61`.
Da un altro PC: `git pull origin master`, poi leggi questo file.

## Stato in una riga

Ridisegno UI/UX di **tutte le schermate NON-combattimento** in stile Slay-the-Spire ("Sala Comune": pergamena calda, cornici oro spesse, mappa dipinta) — **FATTO e pushato**. Il **combattimento è ancora vecchio stile**, volutamente rimandato: è il prossimo blocco.

## Cosa è già fatto (non rifarlo)

Redesign non-combat completo, 13 commit `c5b31f2..8534a61`. Verificato: build ok, typecheck pulito, 961 test verdi, walkthrough visivo (menu/draft/mappa/rules).
- Sistema condiviso: materiali CSS in `app/globals.css` (`.frame-thick`+`.frame-inner`, `.parchment`, `.emboss`, `.seal`, `.kicker`, `.title-gradient`, palette calda `--ink/--leather/--gold-1/2/3/--arcane/--crimson`).
- Primitive: `components/ui/Frame.tsx`, `Parchment.tsx`, `Insegna.tsx`, `SealButton.tsx`; in `motion.tsx`: `FoilText`, `DrawDivider`, `Stagger/StaggerItem`, `Reveal`, `TiltCard`, `screenVariants`, `EASE_CINEMATIC`.
- `GameShell.tsx`: ambiente caldo a lume di candela (montato in `app/layout.tsx`).
- Schermate ricomposte: Menu (poster), Draft, Recruit/Relic/Infermeria, Victory/AreaCleared, Result/Boss, Rules/Credits/Team, sidebar in-run (`RunBRunner`).
- Bug risolti: flicker collegamenti mappa (test `tests/screens/mapTrail.test.tsx`), titolo menu invisibile.

Spec+piano di riferimento:
- `docs/superpowers/specs/2026-07-02-slay-the-spire-redesign-design.md`
- `docs/superpowers/plans/2026-07-02-slay-the-spire-redesign.md`
Ledger d'esecuzione: `.superpowers/sdd/redesign-progress.md` (tutte le 12 task marcate `[x]`).

## PROSSIMO BLOCCO — redesign del combattimento

Non ancora iniziato. File coinvolti (tutti in vecchio stile, da portare al sistema "Sala Comune"):
- `components/screens/BattleScreen.tsx`
- `components/battle/*`: ArenaBackdrop, BattleArena, BattleEndModal, BattleLog, BattleRecap, HpBar, InitiativeBar, SpellFx, StatBar, StatusLegend, SynergyRibbon, UnitBust, ActionPanel, damageFloat.

Come iniziare (stesso flusso usato per il non-combat):
1. `superpowers:brainstorming` per la direzione visiva del combat (deve armonizzarsi col resto: cornici oro, pergamena, ma pensato per l'azione — leggibilità delle HP/log/turni è critica).
2. Poi `writing-plans`, poi esecuzione con subagent.
3. RIUSA le primitive esistenti (Frame/Parchment/Insegna/FoilText/materiali CSS) — non reinventarle.

## Regole del progetto da ricordare (importanti)

- **Processo concorrente**: un'altra sessione modifica bilanciamento su `data/`, `game/engine/`, `runEngine.ts`, `tests/engine/` sullo STESSO master. Committa SEMPRE con pathspec esplicito (`git commit -- <file>`), MAI `git add -A`. I fallimenti dei test engine non sono tuoi.
- `npm run test` NON esegue il typecheck → lancia `npm run typecheck` a parte.
- **Legibilità è legge**: testo su base scura piena; pergamena/texture solo d'ambiente, mai dietro testo leggibile.
- **FoilText**: passagli una STRINGA semplice. `background-clip:text` non passa attraverso span annidati (→ testo invisibile).
- Ogni animazione va gated su `prefers-reduced-motion`.
- Copy in italiano. Commit su master + push senza chiedere quando il lavoro è finito.

## Comandi utili

```
git pull origin master
npm install            # se serve
npm run dev            # dev server (localhost:3000)
npm run test           # vitest (no typecheck!)
npm run typecheck      # tsc --noEmit
npm run build          # build produzione
```
