// data/relicsRt.ts — spec §7.1. Solo hook/grant/keywordMult: le stat restano in applyRelicBonuses.
import type { RelicRt } from '@/types/rt'
import { riga, cd } from './abilities/util'

const R = (id: string, r: Omit<RelicRt, 'id'>): RelicRt => ({ id, ...r })

export const RELICS_RT: Record<string, RelicRt> = Object.fromEntries(([
  // ── stat-only: nessuna traduzione (applyRelicBonuses) ──
  R('giratempo', {}), R('mantello-invisibilita', {}), R('medaglione-serpeverde', {}), R('diadema-corvonero', {}), R('pensatoio', {}), R('bacchetta-sambuco', {}),
  R('patto-vorace', {}), R('sete-di-sangue', {}),
  R('fame-vorace', {}), R('collezionista-anime', {}), R('marchio-vorace', {}), R('marcia-di-guerra', {}), R('fortezza-vivente', {}), R('vento-crescente', {}), R('eredita-dei-caduti', {}),
  R('ultimo-baluardo', {}), R('branco-ristretto', {}), R('diario-riddle', {}), R('mano-della-gloria', {}), R('specchio-erised', { lines: [riga('ogniSecondi', 'squadraPropria', { kind: 'cura', n: 10 }, { limit: cd(3) })] }),
  // ── esecuzione ──
  R('mappa-malandrino', { lines: [riga('continuo', 'squadraPropria', { kind: 'dannoPct', pct: 0.12 }, { cond: { hpNemicaSotto: 0.5 } })] }),
  R('spada-grifondoro', { lines: [riga('continuo', 'squadraPropria', { kind: 'dannoPct', pct: 0.4 }, { cond: { hpNemicaSotto: 0.3 } })] }),
  R('sigillo-carnefice', { mods: { sogliaBonusPerKo: { step: 0.05, cap: 0.25 } } }),
  R('corona-spettrale', { lines: [riga('continuo', 'squadraPropria', { kind: 'dannoPct', pct: 0.5 }, { cond: { hpNemicaSotto: 0.4 } })] }),
  // ── scudo / rigen ──
  R('ricordatutto', { lines: [riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 10 })] }),
  R('pietra-resurrezione', { lines: [riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 30 })] }),
  R('coppa-tassorosso', { lines: [riga('ogniSecondi', 'squadraPropria', { kind: 'cura', n: 14 }, { limit: cd(3) })] }),
  R('egida-tassorosso', { mods: { curaEccessoToScudo: 0.5 } }),
  R('cuore-del-tasso', { mods: { scudoProdottoMult: 1.5 } }),
  // ── veleno ──
  R('ampolla-veleno', { mods: { velenoMult: 1.5 } }),
  // "a ogni colpo" non esiste per le righe di lato (il motore non accoda eventi 'lancio' di lato): diventano tick periodici.
  R('pugnale-bellatrix', { lines: [riga('ogniSecondi', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 1 }, { limit: cd(2) })] }),
  R('boccino-doro', { lines: [riga('ogniSecondi', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 1 }, { limit: cd(1.5) })] }),
  R('zanna-vorace', { lines: [riga('ogniSecondi', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 2 }, { limit: cd(2) })] }),
  R('calice-avvelenato', { mods: { velenoMult: 2 } }),
  // ── magie oscure ──
  R('marchio-nero', { mods: { magieOscure: { bonus: 0.5, recoil: 0.2 } } }),
  R('patto-di-sangue', { carrierLines: [riga('continuo', 'se', { kind: 'dannoPct', pct: 0.6 })], mods: { magieOscure: { bonus: 0, recoil: 0.25 } } }),
  R('diadema-corrotto', { mods: { magieOscure: { bonus: 0.15, recoil: 0 } } }),
  // ── altro ──
  R('occhio-magico', { mods: { ignoraCopertura: true } }),
  R('lacrime-fenice', {}),   // consumabile: il run layer lo trasforma in +3 vite (spec §7.1)
  R('furia-morente', { lines: [riga('sottoSoglia', 'squadraPropria', { kind: 'dannoPct', pct: 0.2, durata: 6 }, { cond: { hpPropriaSotto: 0.4 } })] }),
  R('canto-del-cigno', { lines: [riga('koAlleato', 'squadraPropria', { kind: 'dannoPct', pct: 0.2, durata: 6 })] }),
  R('assalto-d-apertura', { lines: [riga('inizio', 'squadraPropria', { kind: 'dannoPct', pct: 0.2, durata: 6 })] }),
] as RelicRt[]).map(r => [r.id, r]))

export const relicRt = (id: string): RelicRt => RELICS_RT[id] ?? { id }
