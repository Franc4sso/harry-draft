import type { ActiveRelic, DraftedWizard, Duo, DuoSignal, RunEvent, RunState } from '@/types'
import type { Rng } from './rng'
import { createRng } from './rng'
import { parseAreaNodeId } from './map'
import { detectDuos, litSignals } from './duos'
import { detectSynergies } from './synergy'
import { isDead, livingOf, tagsOf } from './roster'
import { gainLevels } from './leveling'
import { SIGNAL_LABEL } from '@/data/duos'

/**
 * LE SPOGLIE DELLA VITTORIA — Fase B: il motore, puro e deterministico.
 *
 * Dopo una battaglia normale vinta il giocatore sceglie UNA di TRE Spoglie. Questo modulo
 * genera l'offerta (`rollSpoils`) e applica la scelta (`applySpoil`). Niente UI, niente
 * runner, niente `Math.random`/`Date.now`: stesso stato + stesso rng ⇒ stessa offerta.
 *
 * La carta della tesi è il MARCHIO: concede un tag a UN mago, cioè muove i segnali Duo.
 * L'offerta è KEYWORD-AWARE — se un Duo è a un solo segnale-tag di distanza, il Marchio che
 * lo completa è garantito nell'offerta e porta il nome del Duo. Il resto (Allenamento,
 * Ristoro) esiste per rendere la scelta un trade-off vero: potere vs sopravvivenza.
 *
 * NOTA per la Fase C: `applySpoil` NON scrive nel `log` della run. La riga narrativa
 * (`RunEvent`) la aggiunge il chiamante, che è anche l'unico a sapere area e nodeId.
 */

/** I tag che un Marchio può concedere: esattamente i segnali-tag dei Duo spediti. */
export type MarchioTag = Extract<DuoSignal, 'veleno' | 'esecuzione' | 'scudirigen' | 'magieOscure'>

const MARCHIO_TAGS: readonly MarchioTag[] = ['veleno', 'esecuzione', 'scudirigen', 'magieOscure']

/** Il Duo che una carta completerebbe (solo id + nome: la carta deve poterlo DIRE). */
export interface SpoilDuoRef { id: string; name: string }

/** Marchio: un mago A SCELTA guadagna un tag. `needsTarget: true` è letterale, così la UI
 *  sa dal TIPO che deve chiedere un bersaglio (niente indovinelli sul `kind`). */
export interface SpoilMarchio {
  kind: 'marchio'
  id: string
  needsTarget: true
  tag: MarchioTag
  title: string
  desc: string
  /** Presente SOLO se questo Marchio completa un Duo qui e ora ("completa CANCRENA"). */
  completes?: SpoilDuoRef
}

/** Allenamento: +1 livello a un mago A SCELTA. */
export interface SpoilAllenamento {
  kind: 'allenamento'
  id: 'allenamento'
  needsTarget: true
  levels: number
  title: string
  desc: string
}

/** Ristoro: cura tutta la squadra. Nessun bersaglio da scegliere → si applica subito. */
export interface SpoilRistoro {
  kind: 'ristoro'
  id: 'ristoro'
  needsTarget: false
  pct: number
  title: string
  desc: string
}

export type Spoil = SpoilMarchio | SpoilAllenamento | SpoilRistoro
/** Le Spoglie che richiedono di scegliere un mago (discriminate su `needsTarget`). */
export type TargetedSpoil = Extract<Spoil, { needsTarget: true }>

/** Type guard: la UI chiede un bersaglio solo per queste. */
export function spoilNeedsTarget(s: Spoil): s is TargetedSpoil {
  return s.needsTarget
}

/** Scelta serializzabile: id della carta (+ mago bersaglio se serve). Sta in questa forma
 *  perché la Fase C deve poterla registrare nello stato della run e ri-applicarla identica
 *  in replay — l'offerta è rigenerabile dal seed, quindi l'id basta. */
export interface SpoilChoice {
  spoilId: string
  wizardId?: string
}

export const RISTORO_PCT = 0.25
export const ALLENAMENTO_LEVELS = 1

const MARCHIO_TITLE: Record<MarchioTag, string> = {
  veleno: 'Marchio del Veleno',
  esecuzione: 'Marchio dell’Esecuzione',
  scudirigen: 'Marchio dello Scudo',
  magieOscure: 'Marchio delle Magie Oscure',
}

const ALLENAMENTO: SpoilAllenamento = {
  kind: 'allenamento', id: 'allenamento', needsTarget: true, levels: ALLENAMENTO_LEVELS,
  title: 'Allenamento',
  desc: 'Un mago a tua scelta sale di 1 livello.',
}

const RISTORO: SpoilRistoro = {
  kind: 'ristoro', id: 'ristoro', needsTarget: false, pct: RISTORO_PCT,
  title: 'Ristoro',
  desc: 'Tutta la squadra recupera il 25% della vita massima.',
}

/** Canale rng dedicato alle Spoglie (1 draft, 2 combat, 4 mappa, 11 starter sono già presi). */
export const spoilsChannel = 7

/** Rng deterministico per le Spoglie di un nodo: stesso seed + stesso nodo ⇒ stessa offerta,
 *  sempre. Stesso pattern di salt-per-nodo dei pick evento/recluta/negozio
 *  (`game/engine/resolvers/*.ts`), su un canale tutto suo così non ruba estrazioni a nessuno. */
export function spoilsRngForNode(seed: string, nodeId: string): Rng {
  const { area, floor, idx } = parseAreaNodeId(nodeId)
  return createRng(seed).fork(spoilsChannel).fork(area * 100 + floor * 10 + idx)
}

/** Fascia di priorità di un Marchio: 0 = completa un Duo, 1 = accende il segnale (avvicina),
 *  2 = semina soltanto (il segnale resta spento). */
type MarchioTier = 0 | 1 | 2
interface MarchioCandidate { tag: MarchioTag; completes?: Duo; tier: MarchioTier }

/** Cosa farebbe DAVVERO ogni Marchio a questa squadra. Non reimplementa la logica dei
 *  segnali: costruisce la squadra ipotetica col tag concesso e chiede a `detectDuos` /
 *  `litSignals` (le stesse funzioni del motore) come cambia il quadro.
 *  Il bersaglio ipotetico è il primo mago vivo che NON ha già il tag: concedere il tag a un
 *  mago qualsiasi privo di esso alza il conteggio di esattamente 1, quindi la fascia non
 *  dipende da QUALE mago lo riceve. Un tag che nessuno può ricevere è una carta morta: fuori. */
function marchioCandidates(team: DraftedWizard[], relics: ActiveRelic[]): MarchioCandidate[] {
  const living = livingOf(team)
  const activeBefore = new Set(detectDuos(living, relics).map(x => x.duo.id))
  const litBefore = litSignals(living, relics)
  const out: MarchioCandidate[] = []
  for (const tag of MARCHIO_TAGS) {
    const target = living.find(d => !tagsOf(d).includes(tag))
    if (!target) continue
    const hypo = living.map(d => d === target
      ? { ...d, grantedTags: [...(d.grantedTags ?? []), tag] }
      : d)
    const completed = detectDuos(hypo, relics).map(x => x.duo).filter(duo => !activeBefore.has(duo.id))
    const lights = !litBefore.has(tag) && litSignals(hypo, relics).has(tag)
    out.push({ tag, completes: completed[0], tier: completed.length > 0 ? 0 : lights ? 1 : 2 })
  }
  return out
}

function marchioCard(c: MarchioCandidate): SpoilMarchio {
  return {
    kind: 'marchio',
    id: `marchio:${c.tag}`,
    needsTarget: true,
    tag: c.tag,
    title: MARCHIO_TITLE[c.tag],
    desc: `Un mago a tua scelta guadagna il segnale ${SIGNAL_LABEL[c.tag]}.`,
    ...(c.completes ? { completes: { id: c.completes.id, name: c.completes.name } } : {}),
  }
}

/** La squadra ha qualcosa da curare? Solo i vivi e non corrotti contano: un corrotto NON è
 *  curabile (vedi `DraftedWizard.corrotto`), quindi non giustifica un Ristoro. */
function teamIsHurt(team: DraftedWizard[]): boolean {
  return livingOf(team).some(d => !d.corrotto && (d.currentHp ?? d.maxHp) < d.maxHp)
}

/**
 * Genera l'offerta: SEMPRE 3 carte distinte, deterministica su `rng`.
 *
 * Composizione (nell'ordine in cui la UI le mostrerà):
 *  1. un MARCHIO, scelto per fascia: prima quelli che COMPLETANO un Duo (regola keyword-aware
 *     del piano §3: se un Duo è a un solo segnale-tag, il Marchio che lo chiude è garantito e
 *     porta il nome del Duo), poi quelli che accendono un segnale, poi il resto;
 *  2. ALLENAMENTO: la carta sempre buona, il contrappeso "crescita" al Marchio;
 *  3. RISTORO se la squadra è ferita, altrimenti un SECONDO Marchio con un tag diverso.
 *
 * CASI LIMITE (decisi qui, non altrove):
 *  - **Squadra a piena vita**: il Ristoro sarebbe una carta sprecata — una scelta finta non
 *    è una scelta. Al suo posto entra un secondo Marchio, così il terzo slot resta una
 *    decisione vera (due direzioni di build contro una crescita).
 *  - **Nessun Duo raggiungibile**: si offre comunque un Marchio, ma dalla fascia migliore
 *    disponibile (accende un segnale > semina) e SENZA nome di Duo: la carta non promette
 *    ciò che non può mantenere. Non si nasconde il Marchio, perché è l'unico modo che il
 *    giocatore ha di COSTRUIRE verso un Duo quando non ne ha nessuno a portata.
 *  - Un Marchio il cui tag nessun mago può ricevere non entra nel pool (carta morta). Se la
 *    scarsità di candidati lasciasse meno di 3 carte, si riempie con Ristoro (anche a vita
 *    piena) e infine con i Marchi restanti: la garanzia "sempre 3" viene prima dell'estetica.
 *  - Nessun duplicato: le carte sono distinte per `id`.
 */
export function rollSpoils(state: RunState, rng: Rng): Spoil[] {
  const team = state.team ?? []
  const relics = state.relics ?? []
  const cands = marchioCandidates(team, relics)
  // Dentro la stessa fascia l'ordine è mescolato dall'rng (deterministico): due nodi diversi
  // vedono Marchi diversi, ma la fascia — cioè la regola keyword-aware — non si perde mai.
  const marchi = ([0, 1, 2] as MarchioTier[])
    .flatMap(t => rng.shuffle(cands.filter(c => c.tier === t)))
    .map(marchioCard)

  const picks: Spoil[] = []
  const add = (card: Spoil) => {
    if (picks.length < 3 && !picks.some(p => p.id === card.id)) picks.push(card)
  }

  if (marchi[0]) add(marchi[0])
  add(ALLENAMENTO)
  if (teamIsHurt(team)) add(RISTORO)
  for (const card of marchi.slice(1)) add(card)
  add(RISTORO)
  // Rete di sicurezza finale: i Marchi senza bersaglio disponibile, pur di avere 3 carte.
  for (const tag of MARCHIO_TAGS) add(marchioCard({ tag, tier: 2 }))

  return picks
}

/** Applica la Spoglia scelta. PURO: non muta nulla in ingresso, restituisce strutture nuove
 *  (o lo stato IDENTICO se la scelta è un no-op — bersaglio inesistente/morto, tag già
 *  posseduto, nessuno da curare). Il leveling passa da `gainLevels`, la cura ricalca
 *  `healTeam` degli eventi, i tag concessi finiscono in `grantedTags` (che `tagsOf` fonde
 *  con i nativi): nessuna formula nuova inventata qui. */
export function applySpoil(state: RunState, spoil: Spoil, wizardId?: string): RunState {
  switch (spoil.kind) {
    case 'marchio': {
      const target = state.team.find(d => d.wizard.id === wizardId)
      if (!target || isDead(target) || tagsOf(target).includes(spoil.tag)) return state
      const team = state.team.map(d => d === target
        ? { ...d, grantedTags: [...(d.grantedTags ?? []), spoil.tag] }
        : d)
      // I tag alimentano anche le sinergie: ricalcolarle qui evita che lo stato menta.
      return { ...state, team, activeSynergies: detectSynergies(livingOf(team)) }
    }
    case 'allenamento': {
      const target = state.team.find(d => d.wizard.id === wizardId)
      if (!target || isDead(target)) return state
      const team = state.team.map(d => d === target ? gainLevels(d, spoil.levels).dw : d)
      return { ...state, team }
    }
    case 'ristoro': {
      let changed = false
      const team = state.team.map(d => {
        if (isDead(d) || d.corrotto) return d
        const cur = d.currentHp ?? d.maxHp
        const healed = Math.min(d.maxHp, cur + Math.round(d.maxHp * spoil.pct))
        if (healed === cur) return d
        changed = true
        return { ...d, currentHp: healed }
      })
      return changed ? { ...state, team } : state
    }
  }
}

/** Variante per la Fase C: risolve la scelta serializzata contro l'offerta mostrata. No-op se
 *  l'id non appartiene all'offerta (nessuna fiducia cieca in un input che passa dalla UI). */
export function applySpoilChoice(state: RunState, offer: Spoil[], choice: SpoilChoice): RunState {
  const spoil = offer.find(s => s.id === choice.spoilId)
  if (!spoil) return state
  return applySpoil(state, spoil, choice.wizardId)
}

/** La riga di racconto della scelta, per il `log` della run (alimenta il resoconto di fine
 *  run, Onda 4). Sta qui — e non nel chiamante — perché il testo dipende dal TIPO di Spoglia,
 *  che è roba di questo modulo; l'area e il nodo li passa il chiamante, che è l'unico a
 *  saperli (vedi la nota in testa al file). Il nome del mago è `wizard.name`, come in ogni
 *  altro resolver che scrive nel log (recruit/altare). */
export function spoilLogEvent(state: RunState, nodeId: string, spoil: Spoil, wizardId?: string): RunEvent {
  const name = state.team.find(d => d.wizard.id === wizardId)?.wizard.name
  const summary = spoil.kind === 'marchio'
    ? `${spoil.title}${name ? ` a ${name}` : ''}${spoil.completes ? ` — completa ${spoil.completes.name}` : ''}`
    : spoil.kind === 'allenamento'
      ? `Allenamento${name ? `: ${name}` : ''} sale di ${spoil.levels} livello`
      : `Ristoro: la squadra recupera il ${Math.round(spoil.pct * 100)}% della vita`
  return { area: state.area ?? 0, nodeId, kind: 'spoglie', summary }
}
