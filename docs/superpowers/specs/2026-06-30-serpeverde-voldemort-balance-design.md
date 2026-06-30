# Serpeverde / Voldemort balance — design (il nerf mirato a Sectumsempra)

> Data: 2026-06-30. Backlog `docs/superpowers/remaining-work.md` §1 item #4. Il piano
> `2026-06-29-serpeverde-rebalance` (nerf `deatheater` 25→12) NON fu mai implementato: al suo posto è
> arrivata la redesign casa (flat-atk → `cunning`) + tweak enemy-scaling, che **ha rimandato** il fix
> Voldemort/Sectumsempra. Questo slice lo chiude.

## Problema (numeri live, misurati)

`tests/engine/serpeverdeBalance.test.ts` — sweep N=120 di una squadra Serpeverde competente vs nemici
calibrati — misura **winRate = 0.925**. L'assert di banda reale (`winRate < 0.60`) è **commentato**;
gira solo `> 0.0` (sanity). Quindi il test "passa" ma non sorveglia niente.
- Il numero è salito da 0.742 (pre-`infallibile`) a **0.925**: i 3 maghi `infallibile`
  (snape/lucius/dolohov, tutti Serpeverde Attaccanti) vengono draftati dallo sweep e ora non mancano
  mai → uplift. I commenti diagnostici in-file sono **stale** (vanno rinfrescati).
- `campaignBalanceB` (Grifondoro competente) = **0.183** in banda **[0.15, 0.45]**. È accoppiato a
  Serpeverde SOLO via scaling/menace globale — che NON tocchiamo, quindi resta fermo.

## ⚠️ REVISIONE (post-diagnosi sperimentale, 2026-06-30)

La premessa "Sectumsempra" qui sotto è **superata**: misurazioni sperimentali (report del tentativo
bloccato) mostrano che azzerare sectumsempra+deatheater+spietatezza porta 0.925 solo a **0.825** —
il gate 0.60 è irraggiungibile via spell-power. **La vera causa è lo snowball del leveling win-based**
(`game/engine/leveling.ts`): `1 + growthBudgetPerLevel(0.40) × weight × (lvl-1)` porta l'atk di
Voldemort da 40 a **~98** al cap → ogni colpo è un one-shot (≈310 dmg vs ~22 HP), la spell-power
diventa irrilevante. Serpeverde ha gli starter migliori (Voldemort+Bellatrix) → vince le early fight,
livella più in fretta, raggiunge il cap prima → vantaggio composto. Grifondoro (0.183) non fa snowball
così perché i suoi starter hanno atk base più basso.

**Leva scelta (decisione utente): trim dell'atk BASE degli Attaccanti Serpeverde.** ESITO FINALE
(vedi REVISION 2 nel piano — questa lista iniziale puntava a Voldemort+Bellatrix ma Bellatrix era già
bassa, mid 23.5, e NON è stata toccata):
- `Voldemort` atk `[35,45] → [30,38]` (mid **40 → 34** — resta il/tra i più alti, NON sventrato).
- `Snape` `[28,37] → [19,27]` (mid 32.5 → 23); `Lucius` `[25,33] → [17,25]` (mid 29 → 21);
  `Dolohov` `[24,31] → [15,22]` (mid 27.5 → 18.5, floor).
- Gate finale: `serpeverdeBalance` winRate **0.925 → 0.658**, assert `< 0.71` (NON 0.60 — quello
  avrebbe sventrato Voldemort a 25; decisione utente: identità Voldemort > parità stretta).
- ⚠️ NON "isolato per costruzione": i nemici sono pescati dal pool condiviso `WIZARDS` ordinato per
  `expectedPower` (atk-weighted, `teamGen.ts`), quindi trimmare questi maghi **ri-ordina** anche le
  finestre nemiche di Grifondoro. campaignBalanceB resta a 0.183 **per misura empirica** (banda regge,
  suite verde), non per garanzia strutturale — ri-eseguirlo è doveroso, non saltabile.

La sezione "Causa radice / leva Sectumsempra" qui sotto è conservata per storia ma NON è più il piano.

## Causa radice (SUPERATA — vedi revisione sopra)

**Voldemort + Sectumsempra one-shotta i nemici early.** `sectumsempra.power = 2.4`
(`data/spells.ts:9`), portata da 7 forti Attaccanti Serpeverde; con atk≈40 (Voldemort, il più alto del
gioco) → ~88-96 dmg/colpo, uccide prima che la soglia conti. Il meccanismo casa **`cunning`**
(+10/18/28% danno vs bersagli <50% HP, `houseEffects.ts:23`) è progettato per premiare il "colpire il
ferito" ma **non scatta mai** perché il nemico è già morto (commento `houseEffects.ts:14-15`).

## La leva (preferenza utente: NON sventrare Voldemort → abbassare Sectumsempra)

**Leva primaria: `sectumsempra.power` 2.4 → tarato empiricamente (~1.6–1.9).** Doppiamente corretto:
1. Rimuove il one-shot → i nemici sopravvivono sotto il 50% HP → **`cunning` scatta come progettato**
   (il kit funziona come voluto, non solo "più debole").
2. Sectumsempra è anche la spell-chiave dell'archetipo **Magie Oscure** (sweep a **0.950**, anch'esso
   troppo alto): lo stesso nerf raffredda *entrambi* gli skew con una leva sola. Bonus, non bug.
3. Lascia intatti stat e identità di Voldemort (rispetta la preferenza utente).

**Leva secondaria (SOLO se la primaria da sola non porta < 0.60 senza un valore assurdo):** il nerf
`deatheater` differito dal 2026-06-29 — synergy `deatheater` `atk` **25 → ~12** (`data/synergies.ts:34`).
Spalmare invece di affondare un solo numero.

**Target / gate:** ri-abilitare l'assert `winRate < 0.60` in `serpeverdeBalance.test.ts` (gate
intenzionale: la casa "potente/scaltra" può stare competente fino a 0.60, ma non a 0.925). Tarare i
numeri *contro il valore live 0.925* finché il gate passa.

## Guardrail (cosa NON deve rompersi)

- `campaignBalanceB` resta in **[0.15, 0.45]** (non tocchiamo scaling globale → atteso fermo, ma
  verificare).
- `magieOscureCounters.test.ts`: le asserzioni sono **direzionali** (batte squishy, perde vs scudi/
  chip) con stat estreme → un calo di power da 2.4 a ~1.7 deve **preservare la direzione**. Verificare
  che passino ancora; se una flippa, è un segnale di over-nerf → alzare leggermente.
- `magieOscureSweep.test.ts`: la banda si muoverà (Magie Oscure scenderà da 0.950 — desiderabile) →
  rinfrescare il commento/banda, NON spingerla sotto il suo floor di draftabilità.
- Snapshot/replay (`combat/snapshots.test.ts`, `replay.test.ts`, `replayRelics.test.ts`): **regen
  inevitabile** (pinano danni esatti). Rigenerare SOLO dopo aver confermato che il diff è il calo-danno
  voluto (winner/turns coerenti), non una regressione strutturale.
- Rinfrescare i commenti win-rate stale in `serpeverdeBalance`, `velenoSweep`, `esecuzioneSweep`,
  `magieOscureSweep` (commenti, non bande — le bande di quelli reggono salvo deriva).

## Non in scope (YAGNI)
- Nerf agli stat di Voldemort (preferenza utente esplicita).
- Toccare lo scaling/menace globale (accoppiato a campaignBalanceB — fuori scope, rischioso).
- Ri-bilanciare le altre case (Grifondoro è già calibrato).
- Spostare i tag `infallibile` fuori da Serpeverde: la feature è corretta; il fix è il kit, non il tag.

## Ordine di implementazione (per il piano)
1. **Tune**: abbassare `sectumsempra.power` (primaria), + `deatheater` synergy atk se serve; ri-abilitare
   il gate `winRate < 0.60`; iterare finché passa. Verificare i guardrail (campaignBalanceB,
   magieOscureCounters). Rinfrescare commenti stale. Regen snapshot/replay con diff verificato.
2. **Docs**: `remaining-work.md` item #4 → done (numero finale + leva).
