import type { Ability } from '@/types/rt'
import { riga, cd, una, libera } from './util'

export const TASSOROSSO: Ability[] = [
  { id: 'tonks', name: 'Riflessi Mutanti', desc: 'Più veloce con l\'Ordine accanto.', lines: [
    riga('continuo', 'se', { kind: 'cdPct', pct: -0.15 }, { params: [-0.15, -0.2, -0.25], cond: { adiacente: { tag: 'order' } }, desc: 'Cooldown −15% se un membro dell\'Ordine è adiacente' }),
    riga('lancio', 'se', { kind: 'carica', secondi: 0.5 }, { cond: { adiacente: { tag: 'order' } }, limit: cd(4), desc: 'Al lancio (ogni 4 s): Carica 0,5 s con l\'Ordine accanto' }),
  ], lv4: riga('inizio', 'se', { kind: 'carica', secondi: 2 }, { desc: 'All\'inizio: Carica 2 s a sé' }) },
  { id: 'cedric', name: 'Campione di Hogwarts', desc: 'Scudo a ogni lancio; più forte con uno Scudo/Rigen in squadra.', lines: [
    riga('lancio', 'squadraPropria', { kind: 'scudo', n: 15 }, { params: [15, 20, 25], limit: cd(3), desc: 'Al lancio (ogni 3 s): Scudo +15' }),
    riga('continuo', 'se', { kind: 'dannoPct', pct: 0.2 }, { params: [0.2, 0.3, 0.4], cond: { inSquadra: { tag: 'scudirigen' } }, desc: '+20% danno se un altro Scudo/Rigen è in squadra' }),
  ], lv4: riga('koSubito', 'squadraPropria', { kind: 'scudo', n: 100 }, { desc: 'Al KO subìto: Scudo +100' }) },
  { id: 'sprout', name: 'Serra', desc: 'Rigenera con un Tassorosso accanto; scudo a ogni lancio.', lines: [
    riga('ogniSecondi', 'squadraPropria', { kind: 'cura', n: 3 }, { params: [3, 4, 5], cond: { adiacente: { casa: 'Tassorosso' } }, limit: cd(1), desc: 'Ogni secondo: Cura 3 se un Tassorosso è adiacente' }),
    riga('lancio', 'squadraPropria', { kind: 'scudo', n: 15 }, { params: [15, 20, 25], cond: { inSquadra: { tag: 'scudirigen' } }, limit: cd(3), desc: 'Al lancio (ogni 3 s): Scudo +15 se uno Scudo/Rigen è in squadra' }),
  ], lv4: riga('ogniSecondi', 'squadraPropria', { kind: 'rimuoviSegnoProprio', segno: 'veleno' }, { limit: cd(5), desc: 'Ogni 5 s: Mandragola, via il Veleno dalla squadra' }) },
  { id: 'hannah', name: 'Tenacia', desc: 'Cura di più con Tassorosso accanto.', lines: [
    riga('lancio', 'squadraPropria', { kind: 'cura', n: 10 }, { params: [10, 15, 20], cond: { adiacente: { casa: 'Tassorosso' } }, limit: cd(5), desc: 'Al lancio (ogni 5 s): Cura +10 se un Tassorosso è adiacente' }),
  ], lv4: riga('lancio', 'squadraPropria', { kind: 'cura', n: 20 }, { limit: cd(5), desc: 'Al lancio (ogni 5 s): Cura +20' }) },
  { id: 'susan', name: 'Memoria dei Caduti', desc: 'Si carica quando un alleato cade.', lines: [
    riga('koAlleato', 'se', { kind: 'carica', secondi: 2 }, { limit: cd(2), desc: 'Al KO alleato: Carica 2 s a sé' }),
  ], lv4: riga('lancio', 'alleatoSlotMinimo', { kind: 'rianima' }, { limit: cd(12), desc: 'Al lancio (ogni 12 s): Rianima un alleato' }) },
  { id: 'ernie', name: 'Prefetto Zelante', desc: 'Scudo a ogni lancio.', lines: [
    riga('lancio', 'squadraPropria', { kind: 'scudo', n: 15 }, { params: [15, 20, 25], limit: cd(3), desc: 'Al lancio (ogni 3 s): Scudo +15' }),
  ], lv4: riga('inizio', 'riga', { kind: 'protego' }, { desc: 'All\'inizio: Protego alla sua fila' }) },
  { id: 'justin', name: 'Nato Babbano', desc: 'Impara combattendo: ogni lancio lo rende più forte.', lines: [
    riga('lancio', 'se', { kind: 'dannoPct', pct: 0.05, durata: 'battaglia' }, { params: [0.05, 0.08, 0.1], limit: libera(), desc: 'Al lancio: +5% danno per il resto della battaglia' }),
  ], lv4: riga('lancio', 'se', { kind: 'multicast', n: 1, durata: 'battaglia' }, { limit: una(), desc: 'Una volta: Multicast +1 per il resto della battaglia' }) },
  { id: 'zacharias', name: 'Lingua Lunga', desc: 'Indebolisce l\'opposto.', lines: [
    riga('lancio', 'opposto', { kind: 'indebolito', pct: 0.1, secondi: 3 }, { params: [0.1, 0.15, 0.2], limit: cd(4), desc: 'Al lancio (ogni 4 s): Indebolito 10% per 3 s all\'opposto' }),
  ], lv4: riga('lancio', 'nemicoCasuale', { kind: 'silenzio', secondi: 2 }, { limit: cd(8), desc: 'Al lancio (ogni 8 s): Silenzio 2 s a un nemico casuale' }) },
  { id: 'leanne', name: 'Amica Fedele', desc: 'Rende il nemico Vulnerabile.', lines: [
    riga('lancio', 'squadraNemica', { kind: 'vulnerabile', secondi: 1 }, { params: [1, 1.5, 2], limit: cd(4), desc: 'Al lancio (ogni 4 s): Vulnerabile 1 s' }),
  ], lv4: riga('continuo', 'se', { kind: 'durataStatusPct', status: 'lentezza', pct: 0.5 }, { desc: 'Le sue Lentezze durano +50%' }) },
  { id: 'eloise', name: 'Pelle Dura', desc: 'Scudo all\'inizio.', lines: [
    riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 25 }, { params: [25, 35, 45], desc: 'All\'inizio: Scudo +25' }),
  ], lv4: riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 40 }, { desc: 'All\'inizio: Scudo +40' }) },
  { id: 'megan', name: 'Gelo Tassorosso', desc: 'I Gelo della squadra durano di più.', lines: [
    riga('continuo', 'se', { kind: 'durataStatusPct', status: 'gelo', pct: 0.15 }, { params: [0.15, 0.25, 0.35], desc: 'I Gelo della squadra durano +15%' }),
  ], lv4: riga('lancio', 'opposto', { kind: 'gelo', secondi: 1 }, { limit: cd(6), desc: 'Al lancio (ogni 6 s): Gelo 1 s all\'opposto' }) },
]
