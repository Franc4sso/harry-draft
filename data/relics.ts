import type { Relic } from '@/types'

export const RELICS: Relic[] = [
  // Comuni — passive piatte
  { id: 'giratempo', name: 'Giratempo', desc: '+12 Velocità a tutta la squadra.', rarity: 'comune', bonus: { spd: 12 } },
  { id: 'mantello-invisibilita', name: "Mantello dell'Invisibilità", desc: '+14 Difesa a tutta la squadra.', rarity: 'comune', bonus: { def: 14 } },
  { id: 'mappa-malandrino', name: 'Mappa del Malandrino', desc: '+10 Attacco a tutta la squadra.', rarity: 'comune', bonus: { atk: 10 } },
  { id: 'pozione-fortuna', name: 'Felix Felicis', desc: '+5% a tutte le statistiche.', rarity: 'comune', bonus: { allPct: 0.05 } },
  { id: 'bezoar', name: 'Bezoar', desc: 'Rigenerazione +8 a tutta la squadra.', rarity: 'comune', bonus: { regen: 8 } },
  { id: 'ricordatutto', name: 'Ricordella', desc: '+8 Difesa e +8 Velocità.', rarity: 'comune', bonus: { def: 8, spd: 8 } },
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
]

export const RELIC_BY_ID: Record<string, Relic> = Object.fromEntries(
  RELICS.map(r => [r.id, r]),
)
