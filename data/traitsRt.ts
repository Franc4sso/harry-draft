// data/traitsRt.ts — spec §7.2. Righe extra del portatore shiny (RtUnitInput.extraLines).
import type { AbilityLine } from '@/types/rt'
import { riga, cd } from './abilities/util'

export const TRAIT_LINES_RT: Record<string, AbilityLine[]> = {
  esecuzione:     [riga('continuo', 'se', { kind: 'dannoPct', pct: 0.5 }, { cond: { hpNemicaSotto: 0.3 }, desc: '+50% danno mentre HP nemica < 30%' })],
  furia:          [riga('sottoSoglia', 'se', { kind: 'dannoPct', pct: 0.3, durata: 'battaglia' }, { cond: { hpPropriaSotto: 0.5 }, desc: 'Sotto 50% HP: +30% danno' }), riga('sottoSoglia', 'se', { kind: 'dannoPct', pct: 0.3, durata: 'battaglia' }, { cond: { hpPropriaSotto: 0.25 }, desc: 'Sotto 25% HP: altri +30%' })],
  roccia:         [riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 40 }, { desc: 'All\'inizio: Scudo +40' })],
  sifone:         [riga('lancio', 'opposto', { kind: 'lentezza', secondi: 1 }, { limit: cd(3), desc: 'Al lancio (ogni 3 s): Lentezza 1 s all\'opposto' })],
  benedizione:    [riga('squadraCura', 'squadraPropria', { kind: 'scudo', n: 25 }, { limit: cd(3), desc: 'Quando la squadra cura (ogni 3 s): Scudo +25' })],
  pietrificazione:[riga('lancio', 'opposto', { kind: 'gelo', secondi: 1 }, { cond: { chance: 0.3 }, limit: cd(3), desc: 'Al lancio: 30% Gelo 1 s' })],
  bavaglio:       [riga('lancio', 'opposto', { kind: 'silenzio', secondi: 2 }, { cond: { chance: 0.3 }, limit: cd(3), desc: 'Al lancio: 30% Silenzio 2 s' })],
  disarmo:        [riga('lancio', 'opposto', { kind: 'disarmo' }, { cond: { chance: 0.3 }, limit: cd(3), desc: 'Al lancio: 30% Disarmo' })],
  logoramento:    [riga('lancio', 'opposto', { kind: 'indebolito', pct: 0.25, secondi: 3 }, { cond: { chance: 0.4 }, limit: cd(3), desc: 'Al lancio: 40% Indebolito 25% per 3 s' })],
  ferocia:        [riga('lancio', 'se', { kind: 'dannoFlat', n: 6 }, { limit: { perBattle: 5 }, desc: 'Al lancio (max 5): +6 danno per il resto della battaglia' })],
  rigenerazione:  [riga('ogniSecondi', 'squadraPropria', { kind: 'cura', n: 12 }, { limit: cd(3), desc: 'Ogni 3 s: Cura 12' })],
  anticipo:       [riga('inizio', 'se', { kind: 'carica', secondi: 2 }, { desc: 'All\'inizio: Carica 2 s a sé' })],
  crescendo:      [riga('ogniSecondi', 'se', { kind: 'dannoPct', pct: 0.06, durata: 'battaglia' }, { limit: cd(3), desc: 'Ogni 3 s: +6% danno per il resto della battaglia' })],
  vendetta:       [riga('koAlleato', 'se', { kind: 'dannoPct', pct: 0.3, durata: 'battaglia' }, { desc: 'Al KO alleato: +30% danno' })],
  frantumazione:  [riga('lancio', 'squadraNemica', { kind: 'vulnerabile', secondi: 2 }, { cond: { chance: 0.5 }, limit: cd(3), desc: 'Al lancio: 50% Vulnerabile 2 s' })],
  gelo:           [riga('lancio', 'opposto', { kind: 'gelo', secondi: 2 }, { cond: { chance: 0.25 }, limit: cd(4), desc: 'Al lancio: 25% Gelo 2 s' })],
}
