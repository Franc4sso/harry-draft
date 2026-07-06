# Design — Nodo Falò (Campfire): cura vs potenziamento pre-boss

Data: 2026-07-06 · Stato: **approvato in bozza** (utente: "procedi con tutti i task")

## Problema / obiettivo

Il handoff chiede un **nodo Campfire/riposo (cura vs potenziamento)**. Ricognizione del codice:
l'infermeria (cura completa) **esiste già** ed è abbondante — garantita pre-boss (`nodeGen.ts`
hard-code, un'infermeria sul piano `last-1`), auto-cura a fine area (`runEngine.ts` clearArea), e
slot cura a pagamento nel negozio. Quindi un Campfire "cura vs potenzia" come *filler* casuale
avrebbe una cura poco preziosa (ridondante).

**Decisione utente**: il Campfire **sostituisce l'infermeria garantita pre-boss** con una scelta
**cura la squadra** *oppure* **potenzia un mago**. Mette la tensione dove conta di più — subito
prima del boss: mi curo per reggere, o mi rinforzo per colpire più forte? La cura pre-boss non
sparisce, diventa una *scelta* invece che gratuita.

**Ramo potenzia** (decisione utente): **+stat permanente a un mago scelto** (+15% a tutte le stat
per il resto della run).

## Non-obiettivi (YAGNI)

- NON un filler pesato casuale (niente `categoryWeights.campfire`) — è un rimpiazzo del nodo
  garantito, collocazione hard-code come l'infermeria che sostituisce.
- NON teniamo ANCHE l'infermeria pre-boss: il Campfire la rimpiazza (una sola cosa sul piano
  `last-1`). L'infermeria come *tipo* resta nel codice (potrebbe servire altrove), ma non è più
  generata pre-boss.
- NON un ramo "scegli tra 2-3 potenziamenti": una scelta netta cura-vs-+stat. Semplice.
- NON un nuovo meccanismo di cura: riusa l'idioma `{...dw, currentHp: dw.maxHp}` + recompute
  synergie (pattern shop, non infirmary che salta le synergie).

## Vincoli di progetto

- **Copy in italiano.**
- Rimuovere la cura gratuita pre-boss rende il gioco **un filo più difficile** (il player ora deve
  *scegliere*). "Difficoltà più cattiva è approvata" — ma **ri-misuro `campaignBalanceB` +
  `campaignBalanceRestricted`** dopo (memory: re-measure su ogni cambio di potenza; la cura
  pre-boss è potenza del player). Il ramo "potenzia" NON è preso dal bot? — il bot sceglie: va
  deciso quale ramo sceglie il bot nel proxy (vedi §Balance).
- `npm run test` NON fa typecheck → `npm run typecheck` a parte.
- Determinismo: nessun rng consumato dal Campfire (la scelta è del player; enter non genera offerte
  casuali — offre la squadra corrente, come spellForge).
- **MAX 5 nemici**, no fuoco amico: non toccati.

## Architettura (mirror del pattern nodi esistenti)

Il Campfire è un **nodo a scelta** (come spellForge) ma **collocato per hard-code** (come
l'infermeria che sostituisce). Segue la checklist collaudata dei nodi run.

### Il bonus stat permanente — dove vive

`leveledStats(dw)` DERIVA le stat effettive da `dw.stats` × crescita-livello (non muta `dw.stats`).
Per comporre in modo pulito, il bonus Campfire è un **nuovo campo su DraftedWizard**:

```ts
// types/combat.ts — DraftedWizard
/** Permanent per-run stat multiplier earned at a Falò (Campfire) node. Player-only.
 *  e.g. 0.15 = +15% to all effective stats. Absent = 0. Stacks additively if a wizard
 *  is chosen at multiple Falò (rare — one Falò per run pre-boss, but future-proof). */
campfireBonusPct?: number
```

`leveledStats` applica il moltiplicatore DOPO la crescita livello:
```ts
const bonus = 1 + (dw.campfireBonusPct ?? 0)
return { hp: Math.round(dw.stats.hp * m('hp') * bonus), ... }  // same for atk/def/spd
```
Così il bonus è permanente per la run, si compone con i livelli, ed è serializzabile (come
`level`/`spellLevel`, già persistiti nel nodo battaglia — vedi memory 10439).

`CAMPFIRE_STAT_BONUS = 0.15` in `data/constants.ts` (`BALANCE.campfire.statBonus`).

### Componenti (file toccati — checklist nodi run)

1. **types/run.ts**: `RunPhase` += `'campfire-node'`; `RunNodeType` += `'campfire'`; `RunEvent.kind`
   += `'campfire'`.
2. **types/combat.ts**: `DraftedWizard.campfireBonusPct?: number`.
3. **resolvers/types.ts**: `ResolverChoice` += `{ kind: 'campfire-choice'; option: 'heal' | 'upgrade'; wizardId?: string }`.
4. **game/engine/nodeCatalog.ts**: NODE_CATALOG entry `{ type:'campfire', label:'Falò', emoji:'🔥',
   theme:'Accampamento', isCombat:false, resolverId:'campfire', generatedInPhase:1 }`.
5. **game/engine/resolvers/campfire.ts** (NEW): `campfireResolver`.
   - `enter`: `{ offers: { wizardIds: state.team.map(d=>d.wizard.id) }, isCombat:false }` (mirror
     spellForge — offre i maghi per il ramo potenzia).
   - `resolve`: on `choice.kind==='campfire-choice'`:
     - `option==='heal'`: `team = state.team.map(dw=>({...dw, currentHp: dw.maxHp}))`, recompute
       `activeSynergies = detectSynergies(livingOf(team))`, append RunEvent `kind:'campfire'`
       summary "Riposi al falò: squadra curata".
     - `option==='upgrade'`: find `wizardId` in team; `team = state.team.map(dw => dw.wizard.id===id
       ? {...dw, campfireBonusPct: (dw.campfireBonusPct ?? 0) + BALANCE.campfire.statBonus} : dw)`;
       append RunEvent summary "Ti alleni al falò: {nome} +15% a tutte le statistiche". No-op safe
       if wizardId missing (return state unchanged).
6. **game/engine/leveling.ts**: `leveledStats` applies `campfireBonusPct`.
7. **game/engine/runEngine.ts**: register `campfireResolver`; `phaseForNode` += `t==='campfire' ?
   'campfire-node'`.
8. **game/engine/nodeGen.ts**: in the pre-boss hard-code (currently forces `'infirmary'` on
   `last-1`), place `'campfire'` INSTEAD of `'infirmary'`. (No `Filler`/`categoryWeights` change —
   it's not a weighted filler.)
9. **hooks/useRunB.ts**: `RunBView` += `'campfire'`; `viewForPhase` `case 'campfire-node': return
   'campfire'`; controller callback `chooseCampfire(option, wizardId?)` (mirror `chooseSpellUpgrade`:
   resolveCurrent then commit to map); export it.
10. **components/screens/CampfireScreen.tsx** (NEW): two-choice UI — "Riposa (cura tutta la
    squadra)" button + "Allenati (+15% stat a un mago)" which reveals the team to pick one. Props
    `{ team, onChoose: (option, wizardId?) => void }`. Mirror SpellForgeScreen's team-pick layout.
11. **components/screens/RunBRunner.tsx**: import + `case 'campfire': return
    withTeamSidebar(<CampfireScreen .../>)`.
12. **components/screens/MapScreen.tsx**: add `'campfire'` key to ICON (`🔥`), LABEL (`Falò`),
    ACCENT (e.g. `#f59e0b` amber) — required for TS exhaustiveness on `Record<RunNodeType,...>`.

## Balance (+ il proxy DEVE gestire il nuovo nodo)

**Il proxy non gestisce automaticamente un nodo a scelta nuovo.** `campaignBalanceB.test.ts`
`runOne` risolve ogni fase per `kind` esplicito (combat-ack / recruit-pick / relic-pick /
event-choice — righe ~446-478); NON c'è un ramo per `campfire-choice`. Se il piano non aggiunge
un handler, quando il walk incontra `campfire-node` la fase non avanza → simulazione rotta o loop.
**Quindi il piano DEVE aggiungere al proxy un ramo `campfire-node` che chiama
`resolveCurrent(s, { kind:'campfire-choice', option:'heal' }, rng)`.**

Perché `heal` nel proxy:
- È la scelta "safe" più vicina all'infermeria che il Campfire sostituisce.
- Nota dal codice (campaignBalanceB.test.ts:58): la policy near-optimal **già SKIPPAVA
  l'infermeria** ("infirmary-skipping behavior") — cioè il proxy spesso non passava dal nodo
  infermeria comunque. Perciò rimpiazzarla con un campfire+heal potrebbe muovere il proxy **poco o
  nulla** (dipende da quanto il path near-optimal tocca il piano pre-boss). Da verificare con la
  ri-misura, non da assumere.
- Il ramo `upgrade` è una leva **solo-umana** (come i joker): il proxy non lo usa, quindi non muove
  il balance misurato. Va documentato nel test.

**Ri-misura obbligatoria**: `campaignBalanceB` + `campaignBalanceRestricted` dopo, sopra floor
(assert live = winRate>0; baseline attuale ~0.358/0.375). Se il walk ora tocca il piano pre-boss e
la cura passa dal resolver invece dell'auto-heal, i numeri possono muoversi — verificare che il
proxy scelga davvero heal e che nessuna fase resti non risolta. NON abbassare soglie.

## Testing (mirror spellForge/infirmary/shop tests)

- **resolver** (`tests/engine/campfire.test.ts`): `resolverFor('campfire').id`; heal branch full-heals
  + recomputes synergies + logs event; upgrade branch adds campfireBonusPct to the chosen wizard
  only + logs; upgrade no-op on missing wizardId.
- **leveledStats** (`tests/engine/leveling.test.ts` extend): campfireBonusPct multiplies effective
  stats after level growth; absent = no change; stacks additively.
- **generation** (`tests/engine/` — mirror `mapInfirmary.test.ts`): the pre-boss floor now places
  `'campfire'` (not `'infirmary'`); exactly one; infirmary no longer auto-placed pre-boss. Update
  `mapInfirmary.test.ts` accordingly (rename/repoint to campfire).
- **engine wiring** (`tests/engine/nodeResolvers.test.ts` / shopEngine pattern): campfire registered.
- **screen** (`tests/screens/campfireScreen.test.tsx` — mirror spellForgeAndHp): renders two
  choices; heal calls onChoose('heal'); picking a wizard + upgrade calls onChoose('upgrade', id).
- **nodeGen exhaustiveness** (`tests/engine/nodeGen.test.ts`): if a test asserts the allowed Fase-1
  categories, campfire is placed by hard-code NOT weight, so it should NOT appear in the weighted
  filler set — verify the "only emits Fase-1 categories" test still holds (campfire excluded from
  pickFiller).
- **balance**: `campaignBalanceB` + `campaignBalanceRestricted` re-measured, above floor.
- Full suite + typecheck + build green.

## Rischi

- **Balance drift** dalla cura pre-boss ora opzionale → mitigato: bot sceglie heal nel proxy;
  re-measure obbligatoria.
- **mapInfirmary test** e ogni test che assume infermeria pre-boss → aggiornare a campfire.
- **Serializzazione** `campfireBonusPct` nel nodo battaglia (come level/spellLevel) → è un number,
  JSON-safe; il test battaglia deve vedere le stat potenziate.
- **Esaustività Record<RunNodeType>** in MapScreen (ICON/LABEL/ACCENT) → TS lo forza, non
  dimenticarne uno.
