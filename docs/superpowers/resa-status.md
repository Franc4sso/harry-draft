# Redesign "La Resa" — Stato & prossimi passi

**Aggiornato:** 2026-06-24
**Spec di riferimento:** `docs/superpowers/specs/2026-06-23-resa-redesign-design.md`
**Direzione visiva validata:** Notturno di Hogwarts (palette midnight + oro + viola, ritratti formato A).

Il redesign è decomposto in **4 piani sequenziali** (spec §12), ognuno verde a sé. Esecuzione a subagent (implementer + review per task + review finale dell'intero branch).

---

## ✅ Fatto e in `master`

### Plan 1 — Fondamenta visive — `docs/superpowers/plans/2026-06-23-resa-1-visual-foundations.md`
Mergiato (`f6b4883`). Suite 352.
- `lib/rarity.ts` — `rarityStyle(tier)`: trattamento per rarità (etichetta/colore/bordo/aura/gemma/corona).
- `lib/notturno.ts` + token CSS in `app/globals.css` (palette, sfondo arena, keyframe shimmer/reduced-motion).
- `components/ui/HouseCrest.tsx` — stemmi SVG delle 4 case (glifi placeholder, da raffinare con l'arte).
- `components/ui/RarityFrame.tsx` — cornice/aura/gemma/corona + anello di selezione.
- `components/ui/PortraitImage.tsx` — ritratto da `/portraits/<id>.webp` con fallback silhouette.
- `components/cards/WizardCard.tsx` — monta cornice rarità + ritratto + stemma.

### Plan 2 — Draft leggibile — `docs/superpowers/plans/2026-06-24-resa-2-draft-redesign.md`
Mergiato. Suite 367.
- `game/engine/synergy.ts` — `synergyProgress` / `previewSynergies` / `synergyThreshold` / `matchingMemberIds` (engine sinergie esistente invariato).
- `lib/affiliations.ts` — `wizardAffiliations(wizard)`.
- `components/draft/DraftCandidateCard.tsx` — chip affiliazione + highlight "hot".
- `components/draft/SynergyTracker.tsx` — stato attuale + anteprima al tocco ("2 → 3", "SI ATTIVA").
- `components/draft/SquadPanel.tsx` — maghi già presi + slot vuoti.
- `components/screens/DraftScreen.tsx` — layout mobile-first (header fisso squadra + candidati + tracker rail/sheet).
- Nota: desktop è a **2 colonne** (squadra nell'header), non le 3 letterali dello spec — scelta migliore a tutte le larghezze. `DraftBoard`/`DraftProgress` ora inutilizzati nel flusso ma tenuti coi loro test (eventuale pulizia futura).

---

## ⏭️ Da fare (prossimi piani)

### Plan 3 — Battaglia animata (spec §7) — DA SCRIVERE ed eseguire
Il pezzo più grande. Tutto presentazionale: legge il replay/log esistente e lo mette in scena, **senza toccare il motore deterministico**.
- **Ordine d'iniziativa per velocità**: barra in alto, chi agisce ORA + coda; derivata dalla sequenza azioni già ordinata del replay (no nuovo concetto nel combat engine).
- **Coreografia mossa in 5 fasi**: carica → lancio → volo (raggio/proiettile) → impatto (flash + numero che vola) → rinculo.
- **Vocabolario animazioni per tipo magia** (motion + colore archetipici, mappati dai dati `EffectSpec`): raggio/disarmo, maledizione, fuoco/AoE, oscura, scudo, cura, stordimento.
- **Protego = cupola** che para: il proiettile si dissolve, onda d'urto, "PARATO", 0 danni (insegna la meccanica per contrasto).
- **Icone di stato** sui maghi (dot/stun/scudo), HP bar rosse/verdi, caduti grigi.
- **Controlli ritmo**: pausa, passo-passo, velocità; rispetta `prefers-reduced-motion` (fallback statico).
- Architettura: separare `useBattlePlayback` (stato replay) dalla presentazione (`BattleArena`, `SpellFx`, `ShieldFx`, `UnitBust`, `InitiativeBar`). Spezzare `BattleScreen`.
- File chiave attuali da studiare: `components/screens/BattleScreen.tsx`, `game/engine/combat/replay.ts`, `components/battle/`.

### Plan 4 — Gameplay (spec §8) — DA SCRIVERE ed eseguire
Tocca il motore — coperto da test.
- **Fix boss** (bug noto): `BossDef` + `identityId` → forzare **Lord Voldemort** come leader reale del team finale (`game/engine/combat/teamGen.ts:64` `generateBossTeam`), HP×mult, magia forzata, e **applicare la `exclusiveSynergy` `darkLord`** (oggi definita ma mai usata in `data/bosses.ts:19`).
- **Valore potenza E sinergia**: comprimere il divario tra tier (le stat sono ora il punto medio fisso di ogni range — niente RNG per-stat, `tierRollBias` rimosso) e rinforzare/scalare le sinergie (per numero membri) → una squadra di comuni sinergica regge contro 5 leggendari scoordinati. Tarare con `tests/engine/campaignBalance.test.ts` (+ nuova misura "build sinergica vs solo-potenza").
- Difficoltà: lasciata sostanzialmente com'è (non è priorità).

### Batch arte — ritratti del roster
Generare un ritratto originale per ogni mago in `public/portraits/<wizard.id>.webp` (stile Notturno, niente somiglianze reali). Finché mancano, la UI usa la silhouette di fallback (non bloccante). Ritratto di prova generato e validato in fase di brainstorm.

---

## Come riprendere
1. Per ogni piano: `superpowers:writing-plans` (lo scrivo da spec §7 / §8), poi `superpowers:subagent-driven-development` per eseguirlo task-by-task.
2. I Minor differiti annotati nel ledger di lavoro (`.superpowers/sdd/progress.md`, git-ignored): annotazioni `: JSX.Element`, eventuale `useMemo` su `hotByCandidate`, glifi stemma placeholder, cablaggio effettivo dello shimmer leggendario.
3. Branch suggerito per Plan 3: `feat/resa-battle`.
