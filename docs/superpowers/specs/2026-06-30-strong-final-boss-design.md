# Boss finale forte (il climax) — design

> Data: 2026-06-30. Backlog `docs/superpowers/remaining-work.md` §1 item #5 (ultimo). Il boss finale è
> oggi un **pushover**: `finalBossMenace = -0.40` → statMult **0.60**, mentre i boss d'area stanno a
> **1.33** (`menaceForLevel(levelMax)` = 9×0.12 − 0.75 = 0.33 → 1+0.33). Il climax è ~metà di un boss
> d'area. Era stato pinnato debole perché il sistema-morte ha reso il gioco più duro e non c'era
> headroom nella win-band. Ora la leva di recupero (**Lacrime di Fenice**, item #3) esiste → si può
> alzare il boss in modo onesto.

## Causa del cap & la chiave per alzarlo

`campaignBalanceB` (band [0.15, 0.45], oggi 0.183) **combatte il boss finale** end-to-end → alzare
`finalBossMenace` abbassa direttamente quel winRate (scan in `constants.ts`: +0.38 → 0.092, sotto il
floor 0.15). MA l'harness **NON modella la Lacrime di Fenice**: `useConsumableRelic`
(`runEngine.ts:118`) è un'azione manuale del giocatore via bottone "Usa", e il loop `runOne` del test
non la chiama mai. Quindi l'harness **sotto-modella il gioco reale**: ignora una leva di recupero
spedita. Il forced-Infermeria pre-boss cura prima di OGNI boss (incluso il finale → il boss finale si
combatte sempre a squadra piena), quindi la Lacrime NON aiuta il fight finale in sé — aiuta le fight
**mid-area** (resuscita i caduti senza aspettare l'Infermeria pre-boss), così la squadra arriva più
integra attraverso le aree → winRate complessivo più alto → **headroom** per un boss finale forte.

## Decisioni

1. **Modellare la Lacrime di Fenice nell'harness** (`campaignBalanceB.test.ts` `runOne`): dare alla
   squadra-sweep una `lacrime-fenice` e usarla (`useConsumableRelic`) quando è sulla mappa e
   `team.some(isDead)`. Rende l'harness FEDELE al gioco spedito (oggi sotto-modella). Assunzione
   dichiarata: modella "il giocatore competente ha ed usa la leva di recupero" — coerente col resto
   dell'harness (drafta top-power). Riusare lo stesso branch nelle altre sweep che combattono il finale,
   se condividono l'harness.
2. **Alzare `finalBossMenace`** verso lo statMult del boss d'area: target **+0.33** (statMult 1.33,
   parità col boss area-2) — o **+0.38** (1.38) se la band (ora fedele) lo regge. Tarare al valore più
   alto che tiene `campaignBalanceB` in [0.15, 0.45] **dopo** aver modellato la Lacrime.
3. **Invariante climax (test puro-matematico)**: `1 + finalBossMenace >= 1 + menaceForLevel(levelMax)`
   — il boss finale non può più silenziosamente scendere sotto il boss d'area. Indipendente dalla band
   rumorosa.
4. **Ri-baseline** i winRate registrati nelle altre sweep che combattono il finale (esecuzione, veleno,
   magieOscure, scudiRigen, serpeverde) — commenti/band se si muovono.

## Gate / esito atteso & fork possibile

- Se, modellata la Lacrime, `finalBossMenace = +0.33/+0.38` tiene la band [0.15,0.45] → **fatto**: climax
  reale, band intatta, invariante locked.
- Se NEMMENO con la Lacrime la parità (1.33) tiene il floor 0.15 → l'implementer si FERMA e riporta il
  winRate ottenuto a parità. È un fork di difficoltà (climax forte vs completion-rate) da decidere:
  prendere il valore più alto che tiene la band (climax parziale ma onesto) OPPURE rilassare il floor
  della band (finale duro, documentato). NON forzare numeri assurdi né indebolire in silenzio.

## Guardrail
- `campaignBalanceB` resta in [0.15,0.45] (col modello Lacrime) — è il gate primario.
- Le altre sweep (esecuzione/veleno/magieOscure/scudiRigen/serpeverde) restano verdi; ri-baseline i
  commenti winRate se si muovono, senza spingere sotto i loro floor.
- Snapshot/replay: se qualcuno pina un fight col boss finale, regen con diff verificato.
- NON toccare `menaceOffset`/`menacePerLevel` (sposterebbe TUTTI i nemici) — solo `finalBossMenace`.

## Non in scope (YAGNI)
- Boss finale scriptato nuovo / meccaniche-regola (è il pillar P4 "Boss roster", futuro). Qui solo la
  FORZA (statMult) del boss esistente (Voldemort, `data/bosses.ts`).
- Modellare il drafting reale della Lacrime (probabilistico): l'harness la assume disponibile (come
  competente). Va dichiarato.
- Toccare la curva di leveling/snowball (follow-up separato del #4).

## Ordine di implementazione (per il piano)
1. **Harness + invariante**: modellare `useConsumableRelic` in `campaignBalanceB` `runOne`; aggiungere il
   test invariante `finalBoss statMult >= area-boss statMult`.
2. **Tune**: alzare `finalBossMenace` al massimo che tiene la band (target ≥ +0.33); ri-baseline le
   altre sweep. Se la parità non tiene il floor → STOP & report (fork difficoltà).
3. **Docs**: `remaining-work.md` item #5 → done (valore finale + statMult + eventuale nota band).
