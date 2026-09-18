import type { House, Role, Tier, Stats } from './wizard'

export type RtSideId = 'left' | 'right'
export type Segno = 'fiamma' | 'veleno' | 'scossa'
export type UnitStatusKind = 'gelo' | 'silenzio' | 'lentezza' | 'indebolito' | 'disarmo' | 'sospeso' | 'protego'

/** `remaining` in secondi. Per `protego` e `disarmo` è il numero di cariche (1). `pct` solo per indebolito. */
export interface UnitStatus { kind: UnitStatusKind; remaining: number; pct?: number }

export type Trigger =
  | 'inizio' | 'lancio' | 'continuo' | 'koSubito' | 'koAlleato' | 'koNemico'
  | 'adiacenteLancia' | 'squadraCura' | 'sottoSoglia' | 'ogniSecondi' | 'vittoria'

export type Target =
  | 'se' | 'dietro' | 'davanti' | 'sinistra' | 'destra' | 'adiacenti' | 'riga' | 'colonna'
  | 'tuttiAlleati' | 'alleatiTag' | 'alleatiCasa' | 'alleatiRuolo' | 'alleatoSlotMinimo'
  | 'opposto' | 'nemicoCasuale' | 'tuttiNemici' | 'primaFilaNemica' | 'adiacenteDelBersaglio'
  | 'squadraNemica' | 'squadraPropria'

export type Effect =
  | { kind: 'danno'; potenza: number }
  | { kind: 'dannoFlat'; n: number }
  | { kind: 'dannoPct'; pct: number; durata?: number | 'battaglia' }
  | { kind: 'cura'; n: number }
  | { kind: 'scudo'; n: number }
  | { kind: 'scudoIniziale'; n: number }
  | { kind: 'segno'; segno: Segno; stacks: number }
  | { kind: 'rimuoviSegnoProprio'; segno: 'fiamma' | 'veleno' }
  | { kind: 'gelo' | 'silenzio' | 'lentezza' | 'sospeso' | 'vulnerabile'; secondi: number }
  | { kind: 'indebolito'; pct: number; secondi: number }
  | { kind: 'disarmo' }
  | { kind: 'carica'; secondi: number }
  | { kind: 'innesco' }
  | { kind: 'multicast'; n: number; durata?: number | 'battaglia' }
  | { kind: 'ko' }
  | { kind: 'protego' }
  | { kind: 'purifica' }
  | { kind: 'rianima' }
  | { kind: 'cdPct'; pct: number }
  | { kind: 'cdFlat'; secondi: number }
  | { kind: 'hpPct'; pct: number }
  | { kind: 'immune'; a: 'gelo' | 'silenzio' | 'ko' }
  | { kind: 'copre'; wizardId: string }
  | { kind: 'durataStatusPct'; status: 'gelo' | 'silenzio' | 'lentezza' | 'vulnerabile'; pct: number }

export type Cond =
  | { adiacente: { wizardId?: string; tag?: string; casa?: House; ruolo?: Role } }
  | { inSquadra: { wizardId?: string; tag?: string } }
  | { hpNemicaSotto: number }
  | { hpPropriaSotto: number }
  | { segnoNemico: { segno: Segno; min: number } }
  | { bersaglio: 'gelato' | 'lento' | 'silenziato' }
  | { entroSecondiDa: { evento: 'gelo' | 'lancioAdiacente'; secondi: number } }
  | { ogniNLanci: number }
  | { chance: number }
  | { slotVuotiOKo: true }
  | { nessunAdiacente: true }

export interface AbilityLine {
  trigger: Trigger
  target: Target
  effect: Effect
  /** Sovrascrive il numero principale dell'effetto per lv1-3 (lv4 usa il valore lv3). */
  params?: [number, number, number]
  /** Argomento del bersaglio: tag per `alleatiTag`, casa per `alleatiCasa`, ruolo per `alleatiRuolo`. */
  targetArg?: string
  cond?: Cond
  limit?: { perBattle?: number; everySeconds?: number; /** opt-out esplicito della regola "ogni riga Al lancio ha un cooldown" */ senzaCooldown?: true }
  /** Testo per la UI (una frase). */
  desc?: string
}

export interface Ability { id: string; name: string; lines: AbilityLine[]; lv4?: AbilityLine; desc?: string }

export type CrescitaTrigger =
  | 'lancio' | 'vittoria' | 'battaglia' | 'boss'
  | 'reazione:miasma' | 'reazione:deflagrazione' | 'reazione:frantuma' | 'reazione:conduzione'
  | 'ko' | 'disarmo' | 'lancioSenzaGelo'
export type CrescitaUnit = 'danno' | 'segno' | 'cd' | 'cura' | 'scudo' | 'secondi' | 'pct' | 'colpi'
export interface CrescitaClause { kind: 'crescendo' | 'memoria'; trigger: CrescitaTrigger; per: number; cap?: number; unit: CrescitaUnit }
export interface ComboClause { cond: Cond; effect: Effect; target?: Target }

export interface SpellRt {
  id: string
  name: string
  desc: string
  verb: 'danno' | 'cura' | 'scudo' | 'status' | 'carica' | 'protego' | 'rianima' | 'buff'
  potenza?: number
  cura?: number
  scudo?: number
  segno?: { kind: Segno; stacks: number }
  gelo?: number
  unitStatus?: { kind: 'lentezza' | 'silenzio' | 'indebolito' | 'disarmo' | 'sospeso'; secondi?: number; pct?: number }
  teamStatus?: { kind: 'vulnerabile'; secondi: number }
  multicast?: number
  cdMod?: number
  carica?: { secondi: number; target: Target }
  buff?: { dannoPct: number; max: number }
  combo?: ComboClause
  crescita?: CrescitaClause
  keywords?: string[]
  frantumaMult?: number
}

export interface RtUnitInput {
  id: string
  name: string
  house: House
  role: Role
  tier: Tier
  tags: string[]
  stats: Stats
  level: 1 | 2 | 3 | 4
  slot: number
  spell: SpellRt
  ability?: Ability
  /** Righe extra (tratti shiny, reliquie assegnate). Stesso vocabolario. */
  extraLines?: AbilityLine[]
  memoria?: Record<string, number>
  permanenti?: { dannoFlat?: number; dannoPct?: number }
  corrotto?: boolean
  bossLeader?: boolean
}

/** Modificatori di lato calcolati FUORI dal motore (Duo, Trio, archetipi, reliquie di squadra). */
export interface RtSideMods {
  segnoOnCast?: Partial<Record<Segno, number>>
  fiammaNonDecade?: boolean
  scudoInizialeMult?: number
  scudoProdottoMult?: number
  velenoMult?: number
  conduzioneSecondi?: number
  cancrenaSotto?: number
  contagioOnKo?: number
  untore?: boolean
  muroVivente?: number
  esecuzioneAFreddo?: boolean
  mietitore?: number
  sogliaBonusPerKo?: { step: number; cap: number }
  curaEccessoToScudo?: number
  magieOscure?: { bonus: number; recoil: number }
  dannoPct?: number
  dannoSubitoPct?: number
  curaPct?: number
  ignoraCopertura?: boolean
  /** Righe di squadra (reliquie con trigger). L'attore è il lato: `se`/`tuttiAlleati` = tutta la squadra. */
  lines?: AbilityLine[]
}

export interface RtOptions {
  leftMods?: RtSideMods
  rightMods?: RtSideMods
  kind?: 'normal' | 'elite' | 'boss'
  maxSeconds?: number
}

export type RtEventKind =
  | 'inizio' | 'cast' | 'danno' | 'cura' | 'scudo' | 'segno' | 'reazione' | 'status'
  | 'ko' | 'rianima' | 'trigger' | 'carica' | 'innesco' | 'maledizione' | 'fine'

export interface RtEvent {
  t: number
  kind: RtEventKind
  side?: RtSideId
  slot?: number
  targetSide?: RtSideId
  targetSlot?: number
  name?: string
  value?: number
  segno?: Segno
  stacks?: number
  status?: UnitStatusKind | 'vulnerabile'
  abilityId?: string
}

export interface RtUnitFrame { timer: number; cd: number; statuses: UnitStatus[]; ko: boolean; multicast: number }

export interface RtFrame {
  t: number
  hp: [number, number]
  hpMax: [number, number]
  shield: [number, number]
  segni: [Record<Segno, number>, Record<Segno, number>]
  vulnerabile: [number, number]
  units: Record<string, RtUnitFrame>
  /** Indici in `events` degli eventi di questo frame. */
  eventRange: [number, number]
}

export interface RtBattleResult {
  winner: RtSideId
  durata: number
  events: RtEvent[]
  frames: RtFrame[]
  mvpId: string
  koLeft: string[]
  koRight: string[]
  hpFinal: [number, number]
  hpMax: [number, number]
  /** Delta di Memoria per i trigger IN battaglia (reazione:*, ko, disarmo). `vittoria`/`battaglia`/`boss` li applica il run layer. */
  memoriaDelta: Record<string, number>
  reazioni: Record<string, number>
  timedOut: boolean
}

export function rtUnitKey(side: RtSideId, id: string): string { return `${side}:${id}` }

/** Traduzione rt di una reliquia (i bonus alle stat restano in applyRelicBonuses). */
export interface RelicRt {
  id: string
  mods?: Partial<RtSideMods>
  /** Righe di lato (attore = lato). */
  lines?: AbilityLine[]
  /** Righe del portatore (solo reliquie `assignable`): finiscono in `extraLines` del mago assegnato. */
  carrierLines?: AbilityLine[]
}
/** Dati di run che il Piano 3 aggiungerà a DraftedWizard; l'adapter li accetta a parte finché non esistono. */
export interface RtRunExtras { memoria?: Record<string, number>; permanenti?: { dannoFlat?: number; dannoPct?: number } }
