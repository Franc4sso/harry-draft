import type { Role, RunModifiers } from '@/types'
import type { SacrificeCost } from '@/game/engine/sacrifice'

export type EventEffect =
  | { kind: 'healTeam'; pct: number }
  | { kind: 'damageTeam'; pct: number }
  | { kind: 'levelWizard'; which: 'weakest' | 'strongest' | 'random'; levels: number }
  | { kind: 'addWizard'; levelsAboveWeakest: number }
  | { kind: 'removeWizard'; which: 'weakest' | 'random' }
  | { kind: 'grantRelic'; pool: 'ruleBreaking' }
  | { kind: 'cioccorane'; amount: number }
  | { kind: 'gamble'; chance: number; win: EventEffect[]; lose: EventEffect[] }
  | { kind: 'sacrificeCost'; cost: SacrificeCost }
  | { kind: 'setRunModifier'; modifier: keyof RunModifiers }
  | { kind: 'buffTeamPct'; pct: number }

export type EventRequirement =
  | { minCioccorane: number }
  | { role: Role; count: number }
  | { minTeam: number }

export interface EventChoice {
  id: string
  label: string
  requires?: EventRequirement
  effects: EventEffect[]
  resultText: string
}

export interface GameEvent {
  id: string
  title: string
  text: string
  choices: EventChoice[]
}

export const EVENTS: GameEvent[] = [
  {
    id: 'cappello_parlante',
    title: 'Il Cappello Parlante',
    text: 'Il vecchio Cappello si desta e ti offre la sua saggezza — a modo suo.',
    choices: [
      { id: 'level', label: 'Fatti consigliare (mago più debole +2 livelli)', effects: [{ kind: 'levelWizard', which: 'weakest', levels: 2 }], resultText: 'Il Cappello sussurra segreti: il tuo mago più debole cresce.' },
      { id: 'leave', label: 'Ringrazia e vai (cura squadra 15%)', effects: [{ kind: 'healTeam', pct: 0.15 }], resultText: 'Il Cappello ti augura buona fortuna.' },
    ],
  },
  {
    id: 'scambista',
    title: 'Lo Scambista',
    text: 'Un mago incappucciato propone uno scambio: il tuo più debole, per uno più forte.',
    choices: [
      { id: 'trade', label: 'Accetta (scambia il più debole per uno nuovo +2 livelli)', requires: { minTeam: 2 }, effects: [{ kind: 'removeWizard', which: 'weakest' }, { kind: 'addWizard', levelsAboveWeakest: 2 }], resultText: 'Lo scambio è fatto.' },
      { id: 'refuse', label: 'Rifiuta', effects: [], resultText: "Lo scambista svanisce nell'ombra." },
    ],
  },
  {
    id: 'coppa_maledetta',
    title: 'La Coppa Maledetta',
    text: 'Una coppa pulsa di magia oscura. Berne potrebbe darti un potere proibito… o costarti caro.',
    choices: [
      { id: 'drink', label: 'Bevi (60%: reliquia rompi-regole · 40%: -25% vita a tutti)', effects: [{ kind: 'gamble', chance: 0.6, win: [{ kind: 'grantRelic', pool: 'ruleBreaking' }], lose: [{ kind: 'damageTeam', pct: 0.25 }] }], resultText: 'Il liquido brucia in gola…' },
      { id: 'leave', label: 'Lasciala stare', effects: [], resultText: 'Meglio non tentare la sorte.' },
    ],
  },
  {
    id: 'patto',
    title: 'Il Patto',
    text: 'Una voce senza volto offre potere in cambio di un sacrificio.',
    choices: [
      { id: 'sacrifice', label: 'Sacrifica il mago più debole (reliquia rompi-regole + 20 🍫)', requires: { minTeam: 2 }, effects: [{ kind: 'removeWizard', which: 'weakest' }, { kind: 'grantRelic', pool: 'ruleBreaking' }, { kind: 'cioccorane', amount: 20 }], resultText: 'Il patto è suggellato.' },
      { id: 'refuse', label: 'Rifiuta il patto', effects: [], resultText: 'La voce tace, delusa.' },
    ],
  },
  {
    id: 'fonte',
    title: 'La Fonte Incantata',
    text: "Una fonte scintillante chiede un'offerta in Cioccorane per benedire la squadra.",
    choices: [
      { id: 'offer', label: 'Offri 30 🍫 (cura completa della squadra)', requires: { minCioccorane: 30 }, effects: [{ kind: 'cioccorane', amount: -30 }, { kind: 'healTeam', pct: 1 }], resultText: 'Le acque ti rinvigoriscono.' },
      { id: 'leave', label: 'Prosegui', effects: [], resultText: 'Lasci la fonte alle spalle.' },
    ],
  },
  {
    id: 'ombra',
    title: "L'Ombra Danzante",
    text: "Un'ombra ti sfida a un gioco d'azzardo puro. Testa o croce del destino.",
    choices: [
      { id: 'risk', label: 'Rischia (50%: reliquia rompi-regole · 50%: -20% vita alla squadra)', effects: [{ kind: 'gamble', chance: 0.5, win: [{ kind: 'grantRelic', pool: 'ruleBreaking' }], lose: [{ kind: 'damageTeam', pct: 0.2 }] }], resultText: "L'ombra ride mentre la moneta cade…" },
      { id: 'walk', label: 'Allontanati', effects: [], resultText: 'Non tutti i giochi vanno giocati.' },
    ],
  },
  {
    id: 'voto_infrangibile',
    title: 'Il Voto Infrangibile',
    text: 'Una promessa sigillata nella magia più antica: la squadra che hai è la squadra che avrai. Per sempre.',
    choices: [
      { id: 'giura', label: 'Giura (+20% a tutte le statistiche · MAI più reclute, per sempre)',
        effects: [{ kind: 'buffTeamPct', pct: 0.20 }, { kind: 'setRunModifier', modifier: 'noRecruits' }],
        resultText: 'Il filo dorato vi lega i polsi. Siete già completi — o non lo sarete mai.' },
      { id: 'rifiuta', label: 'Rifiuta', effects: [], resultText: 'Il filo si dissolve. La porta resta aperta.' },
    ],
  },
  {
    id: 'patto_della_fame',
    title: 'Il Patto della Fame',
    text: 'La fame divora la carne e nutre il potere. Un morso oggi, la forza per sempre.',
    choices: [
      { id: 'firma', label: 'Firma (+10% a tutte le statistiche · tutti perdono subito il 30% della vita)',
        effects: [{ kind: 'buffTeamPct', pct: 0.10 }, { kind: 'damageTeam', pct: 0.30 }],
        resultText: 'Il morso arriva. Poi, la forza.' },
      { id: 'rifiuta', label: 'Rifiuta', effects: [], resultText: 'La fame resta fuori dalla porta. Per ora.' },
    ],
  },
]

export const EVENT_BY_ID: Record<string, GameEvent> = Object.fromEntries(EVENTS.map(e => [e.id, e]))
