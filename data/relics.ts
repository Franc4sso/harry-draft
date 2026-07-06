import type { Relic } from '@/types'

export const RELICS: Relic[] = [
  // Comuni — passive piatte
  { id: 'giratempo', name: 'Giratempo', desc: '+12 Velocità a tutta la squadra.', rarity: 'comune', bonus: { spd: 12 } },
  { id: 'mantello-invisibilita', name: "Mantello dell'Invisibilità", desc: '+14 Difesa a tutta la squadra.', rarity: 'comune', bonus: { def: 14 } },
  { id: 'mappa-malandrino', name: 'Mappa del Malandrino', desc: '+6 Attacco a tutta la squadra; i colpi infliggono +12% danni ai bersagli sotto il 50% di vita (Esecuzione).', rarity: 'comune', bonus: { atk: 6 }, keywords: ['esecuzione'], grantsExecute: { threshold: 0.5, bonus: 0.12 } },
  { id: 'pozione-fortuna', name: 'Felix Felicis', desc: '+5% a tutte le statistiche.', rarity: 'comune', bonus: { allPct: 0.05 } },
  { id: 'bezoar', name: 'Bezoar', desc: 'Rigenerazione +8 a tutta la squadra.', rarity: 'comune', bonus: { regen: 8 } },
  { id: 'ricordatutto', name: 'Ricordella', desc: '+8 Difesa e +8 Velocità; a inizio battaglia, piccolo scudo a tutta la squadra.', rarity: 'comune', bonus: { def: 8, spd: 8 },
    triggers: [{ hook: 'onBattleStart', effects: [{ kind: 'shield', amount: 10 }] }] },
  // Rara — esecuzione keyword
  { id: 'spada-grifondoro', name: 'Spada di Grifondoro', desc: 'I colpi della squadra infliggono +40% danni ai bersagli sotto il 30% di vita.', rarity: 'rara', keywords: ['esecuzione'], grantsExecute: { threshold: 0.3, bonus: 0.4 } },
  // Non-comuni — condizionali per casa
  { id: 'medaglione-serpeverde', name: 'Medaglione di Serpeverde', desc: '+24 Attacco se hai almeno 3 Serpeverde.', rarity: 'non-comune', bonus: { atk: 24 }, condition: { house: 'Serpeverde', count: 3 } },
  { id: 'diadema-corvonero', name: 'Diadema di Corvonero', desc: '+22 Velocità se hai almeno 3 Corvonero.', rarity: 'non-comune', bonus: { spd: 22 }, condition: { house: 'Corvonero', count: 3 } },
  { id: 'coppa-tassorosso', name: 'Coppa di Tassorosso', desc: 'Rigenerazione +14 se hai almeno 3 Tassorosso.', rarity: 'non-comune', bonus: { regen: 14 }, condition: { house: 'Tassorosso', count: 3 } },
  // Rare — condizionali per ruolo / forti
  { id: 'stemma-attaccanti', name: "Stendardo d'Assalto", desc: '+18 Attacco se hai almeno 3 Attaccanti.', rarity: 'rara', bonus: { atk: 18 }, condition: { role: 'Attaccante', count: 3 } },
  { id: 'egida-tank', name: 'Egida del Guardiano', desc: '+24 Difesa se hai almeno 3 Tank.', rarity: 'rara', bonus: { def: 24 }, condition: { role: 'Tank', count: 3 } },
  { id: 'fiala-supporto', name: 'Calice del Guaritore', desc: 'Rigenerazione +16 se hai almeno 2 Supporti.', rarity: 'rara', bonus: { regen: 16 }, condition: { role: 'Supporto', count: 2 } },
  { id: 'sfera-controllo', name: 'Sfera del Dominio', desc: '+16 Velocità se hai almeno 2 Controllo.', rarity: 'rara', bonus: { spd: 16 }, condition: { role: 'Controllo', count: 2 } },
  { id: 'occhio-moody', name: 'Occhio di Malocchio', desc: '+8% a tutte le statistiche.', rarity: 'rara', bonus: { allPct: 0.08 } },
  { id: 'pensatoio', name: 'Pensatoio', desc: '+15 Attacco e +15 Difesa.', rarity: 'rara', bonus: { atk: 15, def: 15 } },
  // Epiche — passive forti
  { id: 'bacchetta-sambuco', name: 'Bacchetta di Sambuco', desc: '+12% a tutte le statistiche.', rarity: 'epica', bonus: { allPct: 0.12 } },
  { id: 'pietra-resurrezione', name: 'Pietra della Resurrezione', desc: 'A inizio battaglia, scudo a tutta la squadra.', rarity: 'epica', triggers: [{ hook: 'onBattleStart', effects: [{ kind: 'shield', amount: 30 }] }] },
  // Veleno set (non-comune + rara + epica boccino)
  { id: 'ampolla-veleno', name: 'Ampolla di Veleno', desc: 'Il danno da Veleno della squadra è aumentato del 50%.', rarity: 'non-comune', keywords: ['veleno'], keywordMult: { veleno: 0.5 } },
  { id: 'pugnale-bellatrix', name: 'Pugnale di Bellatrix', desc: 'Ogni colpo avvelena il nemico (1 dose).', rarity: 'rara', keywords: ['veleno'], triggers: [{ hook: 'onHit', effects: [{ kind: 'applyStatus', target: 'enemy', statusId: 'veleno' }] }] },
  { id: 'boccino-doro', name: "Boccino d'Oro", desc: 'Ogni colpo ha il 25% di avvelenare il nemico.', rarity: 'epica', keywords: ['veleno'], triggers: [{ hook: 'onHit', effects: [{ kind: 'applyStatus', target: 'enemy', chance: 0.25, statusId: 'veleno' }] }] },
  // Esecuzione set (non-comune + rara)
  { id: 'sigillo-carnefice', name: 'Sigillo del Carnefice', desc: "Il bonus di Esecuzione della squadra è aumentato del 50%.", rarity: 'non-comune', keywords: ['esecuzione'], keywordMult: { esecuzione: 0.5 } },
  // Magie Oscure set (rara + non-comune)
  { id: 'marchio-nero', name: 'Marchio Nero', desc: 'Assegna a un mago: i suoi incantesimi oscuri infliggono +50% danni, ma subisce un contraccolpo pari al 20% del danno inflitto (può essere letale).', rarity: 'rara', keywords: ['magieOscure'], assignable: true, grantsDarkMagic: { bonus: 0.5, recoil: 0.2 } },
  { id: 'diadema-corrotto', name: 'Diadema Corrotto', desc: 'Il bonus delle Magie Oscure della squadra è aumentato del 50%.', rarity: 'non-comune', keywords: ['magieOscure'], keywordMult: { magieOscure: 0.5 } },
  // Infallibile — guaranteed-hit grant
  { id: 'occhio-magico', name: 'Occhio Magico di Malocchio', desc: "L'occhio che vede attraverso ogni inganno: la squadra non manca mai il bersaglio.", rarity: 'rara', grantsAlwaysHit: true },
  // Scudo set (rara + non-comune)
  { id: 'egida-tassorosso', name: 'Egida del Tasso', desc: 'La rigenerazione in eccesso oltre la vita massima si converte in scudo (50%).', rarity: 'rara', keywords: ['scudo'], grantsShieldConvert: { rate: 0.5 } },
  { id: 'cuore-del-tasso', name: 'Cuore del Tasso', desc: 'La conversione in Scudo della squadra è aumentata del 50%.', rarity: 'non-comune', keywords: ['scudo'], keywordMult: { scudo: 0.5 } },
  // Consumabili attivi
  { id: 'lacrime-fenice', name: 'Lacrime di Fenice', desc: 'Usa una volta: riporta in vita tutti i maghi caduti con la vita piena.', rarity: 'epica', active: 'revive' },
  // Rule-breaking pool (event rewards) — reuse existing hooks only.
  { id: 'zanna-vorace', name: 'Zanna Vorace', desc: 'Ogni colpo della squadra avvelena il nemico con 2 dosi invece di 1.', rarity: 'epica', keywords: ['veleno'], triggers: [{ hook: 'onHit', effects: [{ kind: 'applyStatus', target: 'enemy', statusId: 'veleno' }, { kind: 'applyStatus', target: 'enemy', statusId: 'veleno' }] }] },
  { id: 'furia-iniziale', name: 'Furia Iniziale', desc: 'A inizio battaglia, tutta la squadra guadagna +18 Attacco.', rarity: 'epica', bonus: { atk: 18 } },
  { id: 'patto-di-sangue', name: 'Patto di Sangue', desc: 'Assegna a un mago: i suoi colpi infliggono +60% danni, ma subisce un contraccolpo pari al 25% del danno inflitto.', rarity: 'epica', assignable: true, grantsDarkMagic: { bonus: 0.6, recoil: 0.25 } },
  // Scaling jokers — grow a stat with runCounter (kills), reset each run.
  // Caps sized to keep escalating across a WHOLE run (~15-25 kills), not saturate in
  // area 1: the snowball payoff is the whole point of a joker (playtest feedback,
  // 2026-07-05). Safe on balance — the AI bot never drafts jokers, so these tunings
  // don't move the balance harness; they only reward the human's kill-focused builds.
  {
    id: 'fame-vorace', name: 'Fame Vorace', rarity: 'epica',
    desc: 'A ogni nemico sconfitto, +3 attacco per il resto della run (max +60).',
    scaling: { trigger: 'kill', stat: 'attack', per: 3, cap: 60 },
  },
  {
    id: 'collezionista-anime', name: 'Collezionista di Anime', rarity: 'epica',
    desc: 'A ogni nemico sconfitto, +10 salute massima per il resto della run (max +200).',
    scaling: { trigger: 'kill', stat: 'maxHp', per: 10, cap: 200 },
  },
  {
    id: 'marchio-vorace', name: 'Marchio Vorace', rarity: 'epica', keywords: ['veleno'],
    desc: 'A ogni nemico sconfitto, +4% danno da veleno per il resto della run (max +100%).',
    scaling: { trigger: 'kill', stat: 'velenoMult', per: 0.04, cap: 1.0 },
  },
  // --- Joker: scaling (nuovi trigger/stat, Task 8) ---
  {
    id: 'marcia-di-guerra', name: 'Marcia di Guerra', rarity: 'epica',
    desc: 'A ogni turno di battaglia, +6 attacco per il resto della run (max +90).',
    scaling: { trigger: 'turn', stat: 'attack', per: 6, cap: 90 },
  },
  {
    id: 'fortezza-vivente', name: 'Fortezza Vivente', rarity: 'epica',
    desc: 'A ogni battaglia vinta, +5 difesa per il resto della run (max +50).',
    scaling: { trigger: 'battleWin', stat: 'defense', per: 5, cap: 50 },
  },
  {
    id: 'vento-crescente', name: 'Vento Crescente', rarity: 'epica',
    desc: 'A ogni battaglia vinta, +8 velocità per il resto della run (max +64).',
    scaling: { trigger: 'battleWin', stat: 'speed', per: 8, cap: 64 },
  },
  {
    id: 'eredita-dei-caduti', name: 'Eredità dei Caduti', rarity: 'epica',
    desc: 'Per ogni mago caduto nella run, +18 attacco alla squadra (max +90).',
    scaling: { trigger: 'allyDead', stat: 'attack', per: 18, cap: 90 },
  },
  // --- Joker: condizionali (when X then Y) ---
  {
    id: 'ultimo-baluardo', name: 'Ultimo Baluardo', rarity: 'epica',
    desc: 'Se restano meno di 2 maghi vivi, +50% a tutte le statistiche.',
    conditional: { when: { kind: 'teamSizeBelow', value: 2 }, then: { allPct: 0.5 } },
  },
  {
    id: 'branco-ristretto', name: 'Branco Ristretto', rarity: 'epica',
    desc: 'Se hai meno di 3 maghi vivi, +25 attacco e +25 difesa.',
    conditional: { when: { kind: 'teamSizeBelow', value: 3 }, then: { atk: 25, def: 25 } },
  },
  // --- Joker: reattivi (trigger su evento -> applyStatus 'atkUp', vedi nota EffectSpec) ---
  {
    id: 'furia-morente', name: 'Furia Morente', rarity: 'epica',
    desc: 'Quando un mago scende sotto il 40% di vita, guadagna +20 attacco (2 turni).',
    triggers: [{ hook: 'onHpThreshold', threshold: 0.4,
      effects: [{ kind: 'applyStatus', target: 'self', statusId: 'atkUp' }] }],
  },
  {
    id: 'canto-del-cigno', name: 'Canto del Cigno', rarity: 'epica',
    desc: 'Quando un alleato cade, la squadra viva guadagna +20 attacco (2 turni).',
    triggers: [{ hook: 'onAllyDeath',
      effects: [{ kind: 'applyStatus', target: 'ally', statusId: 'atkUp' }] }],
  },
  {
    id: 'assalto-d-apertura', name: "Assalto d'Apertura", rarity: 'epica',
    desc: 'Al primo turno, tutta la squadra guadagna +20 attacco (2 turni).',
    triggers: [{ hook: 'onTurnStart', onlyTurn: 1,
      effects: [{ kind: 'applyStatus', target: 'ally', statusId: 'atkUp' }] }],
  },
  // --- Joker: drawback (rischio/ricompensa) ---
  {
    id: 'patto-vorace', name: 'Patto Vorace', rarity: 'epica',
    desc: '+40 attacco, ma -60 vita massima (cannone di vetro).',
    bonus: { atk: 40 }, drawback: { hp: -60 },
  },
  {
    id: 'sete-di-sangue', name: 'Sete di Sangue', rarity: 'epica',
    desc: '+50 attacco, ma -6 rigenerazione (ti logori).',
    bonus: { atk: 50 }, drawback: { regen: -6 },
  },
]

export const RELIC_BY_ID: Record<string, Relic> = Object.fromEntries(
  RELICS.map(r => [r.id, r]),
)

export const RULE_BREAKING_RELIC_IDS: string[] = ['zanna-vorace', 'furia-iniziale', 'patto-di-sangue']
export const SCALING_RELIC_IDS: string[] = ['fame-vorace', 'collezionista-anime', 'marchio-vorace']
export const JOKER_RELIC_IDS: string[] = [
  'fame-vorace', 'collezionista-anime', 'marchio-vorace',
  'marcia-di-guerra', 'fortezza-vivente', 'vento-crescente', 'eredita-dei-caduti',
  'ultimo-baluardo', 'branco-ristretto', 'furia-morente', 'canto-del-cigno',
  'assalto-d-apertura', 'patto-vorace', 'sete-di-sangue',
]
