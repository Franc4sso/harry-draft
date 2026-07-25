import type { ActiveDuo, ActiveRelic, DraftedWizard, Duo, DuoProgress, DuoSignal, Keyword, SignalCount, Wizard } from '@/types'
import { DUOS } from '@/data/duos'
import { livingOf, tagsOf } from '@/game/engine/roster'

/* ── UN SEGNALE, DUE GRADI ────────────────────────────────────────────────────────────────
 *
 *   grado 1 «acceso»       2 maghi col tag  OPPURE  1 reliquia   → abilita i Duo
 *   grado 2 «potenziato»   3 maghi col tag                        → +50% alla parola chiave
 *
 * Una barra sola per parola chiave (modello a scaglioni "veleno 2/3"), invece di due sistemi
 * che chiedono la stessa cosa con nomi diversi. Il grado 2 è quella che fino al 2026-07-25 era
 * la «Sinergia» omonima (Tossicità / Spietatezza / Bastione / Oscurità): stessa soglia, stesso
 * bonus, un sistema in meno.
 *
 * REGOLA VISIBILE AL GIOCATORE — **le reliquie non portano al grado 2.** Una reliquia accende
 * il segnale (grado 1) e con esso i Duo, ma il potenziamento si paga solo in maghi. È il
 * comportamento storico (il vecchio `membersFor` contava solo maghi); qui va scritto perché
 * col pannello unico diventa una regola che il giocatore legge.
 *
 * I tag si leggono SEMPRE con `tagsOf`, quindi un tag concesso a runtime (il Marchio delle
 * Spoglie della Vittoria) conta per il grado 2 esattamente come uno nativo.
 *
 * `SIGNAL_TIERS` è la FONTE DI VERITÀ UNICA di soglia e bonus del grado 2: `data/synergies.ts`
 * non è più un elenco parallelo, ne è la proiezione nel vecchio tipo `Synergy` — che resta
 * solo il mezzo di trasporto verso il motore (`keywordDamageMult`, `teamExecute`,
 * `teamShieldConvert`, `teamDarkMagic`, `registerSynergyTriggers`, `simulate`), condiviso con
 * la sinergia sintetica dei boss.
 */
export interface SignalTier2 {
  signal: DuoSignal
  /** Id storico del grado 2: è la chiave con cui il motore lo riconosce (`'tossicita'` in
   *  synergyTriggers.ts, `'spietatezza'` in execute.ts, `'bastione'` in shieldConvert.ts,
   *  `'oscurita'` in darkMagic.ts). Non rinominarlo senza aggiornare quei siti. */
  id: string
  name: string
  tag: string
  keyword: Keyword
  /** Maghi col tag necessari. SOLO maghi — le reliquie non contano (vedi sopra). */
  need: number
  /** Quanto aggiunge al moltiplicatore della parola chiave quando è attivo. */
  mult: number
}

export const SIGNAL_TIERS: readonly SignalTier2[] = [
  { signal: 'veleno',      id: 'tossicita',   name: 'Tossicità',   tag: 'veleno',      keyword: 'veleno',      need: 3, mult: 0.5 },
  { signal: 'esecuzione',  id: 'spietatezza', name: 'Spietatezza', tag: 'esecuzione',  keyword: 'esecuzione',  need: 3, mult: 0.5 },
  { signal: 'scudirigen',  id: 'bastione',    name: 'Bastione',    tag: 'scudirigen',  keyword: 'scudo',       need: 3, mult: 0.5 },
  { signal: 'magieOscure', id: 'oscurita',    name: 'Oscurità',    tag: 'magieOscure', keyword: 'magieOscure', need: 3, mult: 0.5 },
]

const TIER2_BY_SIGNAL: ReadonlyMap<DuoSignal, SignalTier2> = new Map(SIGNAL_TIERS.map(t => [t.signal, t]))

/** Il grado 2 di un segnale, se ne ha uno (solo i quattro segnali-tag lo hanno). */
export function tier2Of(sig: DuoSignal): SignalTier2 | undefined {
  return TIER2_BY_SIGNAL.get(sig)
}

/** I maghi della squadra che contribuiscono al grado 2 — SOLO maghi, letti con `tagsOf`.
 *  Nessuna soglia applicata: è il conteggio grezzo che alimenta sia l'attivazione (`>= need`)
 *  sia la barra parziale "2/3". Unico posto che conta i contribuenti del grado 2. */
export function tier2Contributors(tier: SignalTier2, team: DraftedWizard[]): DraftedWizard[] {
  return team.filter(d => tagsOf(d).includes(tier.tag))
}

/** Il segnale è al grado 2? (`need` maghi col tag; le reliquie non contano.) */
export function tier2Active(tier: SignalTier2, team: DraftedWizard[]): boolean {
  return tier2Contributors(tier, team).length >= tier.need
}

const ROLE_OF: Partial<Record<DuoSignal, string>> = {
  attaccante: 'Attaccante', supporto: 'Supporto', controllo: 'Controllo',
}
// Derivato da SIGNAL_TIERS: il segnale-tag e il tag che lo alimenta sono la stessa verità.
const TAG_OF: Partial<Record<DuoSignal, string>> =
  Object.fromEntries(SIGNAL_TIERS.map(t => [t.signal, t.tag])) as Partial<Record<DuoSignal, string>>
// A relic lights a tag signal via keyword OR the matching grant.
const relicLightsTag = (sig: DuoSignal, r: ActiveRelic['relic']): boolean => {
  const kw = r.keywords ?? []
  switch (sig) {
    case 'veleno': return kw.includes('veleno')
    case 'esecuzione': return kw.includes('esecuzione') || !!r.grantsExecute
    case 'scudirigen': return kw.includes('scudo') || !!r.grantsShieldConvert
    case 'magieOscure': return kw.includes('magieOscure') || !!r.grantsDarkMagic
    default: return false
  }
}

export function signalActive(sig: DuoSignal, team: DraftedWizard[], relics: ActiveRelic[]): boolean {
  if (sig === 'taunt') return team.some(d => d.wizard.role === 'Tank')
  const role = ROLE_OF[sig]
  if (role) return team.filter(d => d.wizard.role === role).length >= 2
  const tag = TAG_OF[sig]!
  const comp = team.filter(d => tagsOf(d).includes(tag)).length >= 2
  return comp || relics.some(({ relic }) => relicLightsTag(sig, relic))
}

/** Quanto è vicino un singolo segnale: quanti maghi contribuenti ha la squadra (`have`) vs quanti
 *  ne servono (`need`), o se una reliquia lo accende da sola (`byRelic`). Alimenta il conteggio
 *  "1/2" / "✓ reliquia" delle gemme nel pannello Duo del run. Le soglie rispecchiano signalActive:
 *  taunt=1 Tank, ruolo=2 di quel ruolo, tag=2 maghi OPPURE 1 reliquia. */
export function signalCount(sig: DuoSignal, team: DraftedWizard[], relics: ActiveRelic[]): SignalCount {
  if (sig === 'taunt') {
    return { have: team.filter(d => d.wizard.role === 'Tank').length, need: 1, byRelic: false }
  }
  const role = ROLE_OF[sig]
  if (role) {
    return { have: team.filter(d => d.wizard.role === role).length, need: 2, byRelic: false }
  }
  // tag: una reliquia lo accende da sola → byRelic (have=need, il conteggio maghi non conta più).
  if (relics.some(({ relic }) => relicLightsTag(sig, relic))) {
    return { have: 2, need: 2, byRelic: true }
  }
  const tag = TAG_OF[sig]!
  return { have: team.filter(d => tagsOf(d).includes(tag)).length, need: 2, byRelic: false }
}

/** Il grado del segnale su questa squadra: 0 spento, 1 «acceso» (Duo abilitati),
 *  2 «potenziato» (+bonus alla parola chiave). I segnali di ruolo (taunt/attaccante/
 *  supporto/controllo) si fermano a 1: non hanno un grado 2. Il grado 2 implica il grado 1
 *  (need 3 >= le 2 unità che accendono), quindi la scala è monotona. */
export function signalGrade(sig: DuoSignal, team: DraftedWizard[], relics: ActiveRelic[]): 0 | 1 | 2 {
  const tier = TIER2_BY_SIGNAL.get(sig)
  if (tier && tier2Active(tier, team)) return 2
  return signalActive(sig, team, relics) ? 1 : 0
}

export function litSignals(team: DraftedWizard[], relics: ActiveRelic[]): Set<DuoSignal> {
  const set = new Set<DuoSignal>()
  for (const d of DUOS) for (const s of d.signals) if (!set.has(s) && signalActive(s, team, relics)) set.add(s)
  return set
}

export function detectDuos(team: DraftedWizard[], relics: ActiveRelic[]): ActiveDuo[] {
  const lit = litSignals(team, relics)
  return DUOS.filter(d => d.signals.every(s => lit.has(s))).map(duo => ({ duo }))
}

export function duoProgress(team: DraftedWizard[], relics: ActiveRelic[]): DuoProgress[] {
  const lit = litSignals(team, relics)
  return DUOS.map(duo => {
    const litPair = duo.signals.map(s => lit.has(s)) as [boolean, boolean]
    return { duo, lit: litPair, active: litPair.every(Boolean), missing: duo.signals.filter(s => !lit.has(s)) }
  })
}

const ROLE_SIGNAL: Record<string, DuoSignal> = {
  Tank: 'taunt', Attaccante: 'attaccante', Supporto: 'supporto', Controllo: 'controllo',
}
const TAG_SIGNALS: DuoSignal[] = SIGNAL_TIERS.map(t => t.signal)

/** The Duo signals that appear in at least one shipped Duo. */
export const DUO_SIGNALS_IN_USE: ReadonlySet<DuoSignal> = new Set(DUOS.flatMap(d => d.signals))

/** A wizard's Duo signals that feed a SHIPPED Duo (role-signal if in use, + its Duo-family tags).
 *  Il ruolo viene sempre dal `Wizard`; i TAG arrivano da `effectiveTags` quando il chiamante ne
 *  ha di migliori. Chi ha in mano un `DraftedWizard` DEVE passare `tagsOf(d)`: altrimenti la
 *  card mostra solo i tag nativi e un mago marchiato (Spoglie della Vittoria) non fa vedere il
 *  segnale che ha appena ricevuto — la UI direbbe una cosa e il motore un'altra (§4 del piano).
 *  Senza il secondo argomento il comportamento resta quello storico (soli tag nativi), così i
 *  contesti che hanno davvero solo un `Wizard` di catalogo (codex/collezione) restano validi. */
export function wizardDuoSignals(wizard: Wizard, effectiveTags?: string[]): DuoSignal[] {
  const out: DuoSignal[] = []
  const roleSig = ROLE_SIGNAL[wizard.role]
  if (roleSig && DUO_SIGNALS_IN_USE.has(roleSig)) out.push(roleSig)
  const tags = effectiveTags ?? wizard.tags ?? []
  for (const t of TAG_SIGNALS) if (tags.includes(t) && DUO_SIGNALS_IN_USE.has(t)) out.push(t)
  return out
}

/** The shipped Duos a given signal feeds (for the "→ alimenta: …" tooltip). */
export function duosForSignal(signal: DuoSignal): Duo[] {
  return DUOS.filter(d => d.signals.includes(signal))
}

export type DuoPreview = { completes: Duo[]; advances: Duo[] }

/** Diff of duoProgress with `candidate` added: which Duos it completes (inactive→active)
 *  and which it advances (two-away → one-away). Uses livingOf so a fallen ally never inflates it. */
export function previewDuos(team: DraftedWizard[], relics: ActiveRelic[], candidate: DraftedWizard): DuoPreview {
  const before = new Map(duoProgress(livingOf(team), relics).map(p => [p.duo.id, p]))
  const after = duoProgress(livingOf([...team, candidate]), relics)
  const completes: Duo[] = []
  const advances: Duo[] = []
  for (const a of after) {
    const b = before.get(a.duo.id)!
    if (a.active && !b.active) completes.push(a.duo)
    else if (!a.active && a.missing.length === 1 && b.missing.length >= 2) advances.push(a.duo)
  }
  return { completes, advances }
}

export type DuoLoss = { breaks: Duo[]; regresses: Duo[] }

/** Diff INVERSO di previewDuos: quando una sostituzione (recruit a squadra piena) rimuove un
 *  teammate. `current` = squadra COMPLETA attuale, `next` = squadra risultante (current − uscito
 *  + candidato). breaks = Duo attivo ora che si spegne; regresses = Duo a un passo ora che
 *  arretra a due+. Pure, usa livingOf come previewDuos così un morto non gonfia il diff. */
export function previewDuoLoss(current: DraftedWizard[], next: DraftedWizard[], relics: ActiveRelic[]): DuoLoss {
  const before = new Map(duoProgress(livingOf(current), relics).map(p => [p.duo.id, p]))
  const after = new Map(duoProgress(livingOf(next), relics).map(p => [p.duo.id, p]))
  const breaks: Duo[] = []
  const regresses: Duo[] = []
  for (const b of before.values()) {
    const a = after.get(b.duo.id)!
    if (b.active && !a.active) breaks.push(b.duo)
    else if (b.missing.length === 1 && a.missing.length >= 2) regresses.push(b.duo)
  }
  return { breaks, regresses }
}
