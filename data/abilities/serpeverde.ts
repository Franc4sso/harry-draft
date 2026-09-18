import type { Ability } from '@/types/rt'
import { riga, cd, una, libera } from './util'

export const SERPEVERDE: Ability[] = [
  { id: 'voldemort', name: 'Terrore Immortale', desc: 'Giustizia l\'opposto quando il nemico è agli sgoccioli; a vittoria i Mangiamorte crescono.', lines: [
    riga('lancio', 'opposto', { kind: 'ko' }, { cond: { hpNemicaSotto: 0.3 }, limit: cd(6), desc: 'Al lancio (ogni 6 s): KO all\'opposto se HP nemica < 30%' }),
    riga('lancio', 'squadraNemica', { kind: 'vulnerabile', secondi: 2 }, { limit: cd(4), desc: 'Al lancio (ogni 4 s): il terrore, Vulnerabile 2 s' }),
    riga('vittoria', 'alleatiTag', { kind: 'dannoPct', pct: 0.05 }, { params: [0.05, 0.07, 0.1], targetArg: 'deatheater', desc: 'A vittoria: +5% danno permanente ai Mangiamorte' }),
  ], lv4: riga('koNemico', 'alleatiTag', { kind: 'carica', secondi: 2 }, { targetArg: 'deatheater', limit: cd(3), desc: 'Al KO nemico: Carica 2 s ai Mangiamorte' }) },
  { id: 'snape', name: 'Pozioni Letali', desc: 'Veleno a ogni lancio, molto di più a ogni KO nemico.', lines: [
    riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 2 }, { params: [2, 3, 4], limit: cd(3), desc: 'Al lancio (ogni 3 s): Veleno +2' }),
    riga('koNemico', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 4 }, { params: [4, 6, 8], desc: 'Al KO nemico: Veleno +4' }),
  ], lv4: riga('continuo', 'se', { kind: 'durataStatusPct', status: 'vulnerabile', pct: 1 }, { desc: 'Le sue Vulnerabili durano il doppio' }) },
  { id: 'bellatrix', name: 'Tortura Cruciatus', desc: 'Più forte con un Mangiamorte accanto; a volte gela.', lines: [
    riga('continuo', 'se', { kind: 'dannoPct', pct: 0.25 }, { params: [0.25, 0.4, 0.5], cond: { adiacente: { tag: 'deatheater' } }, desc: '+25% danno se un Mangiamorte è adiacente' }),
    riga('lancio', 'opposto', { kind: 'gelo', secondi: 1 }, { limit: cd(6), desc: 'Al lancio (ogni 6 s): Gelo 1 s all\'opposto' }),
  ], lv4: riga('lancio', 'opposto', { kind: 'ko' }, { cond: { hpNemicaSotto: 0.4 }, limit: cd(10), desc: 'Al lancio (ogni 10 s): KO all\'opposto se HP nemica < 40%' }) },
  { id: 'lucius', name: 'Denaro e Influenza', desc: 'Carica i Mangiamorte all\'inizio e rende il nemico Vulnerabile.', lines: [
    riga('inizio', 'alleatiTag', { kind: 'carica', secondi: 1 }, { params: [1, 1.5, 2], targetArg: 'deatheater', desc: 'All\'inizio: Carica ai Mangiamorte' }),
    riga('lancio', 'squadraNemica', { kind: 'vulnerabile', secondi: 3 }, { limit: cd(5), desc: 'Al lancio (ogni 5 s): Vulnerabile 3 s' }),
  ], lv4: riga('lancio', 'primaFilaNemica', { kind: 'lentezza', secondi: 2 }, { limit: cd(8), desc: 'Al lancio (ogni 8 s): Lentezza 2 s alla prima fila nemica' }) },
  { id: 'draco', name: 'Orgoglio Malfoy', desc: 'Veleno con un Serpeverde accanto; cresce a ogni vittoria.', lines: [
    riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 1 }, { params: [1, 2, 3], cond: { adiacente: { casa: 'Serpeverde' } }, limit: libera(), desc: 'Al lancio: Veleno +1 se un Serpeverde è adiacente' }),
    riga('vittoria', 'se', { kind: 'dannoFlat', n: 3 }, { params: [3, 4, 5], desc: 'A vittoria: +3 danno permanente' }),
  ], lv4: riga('inizio', 'se', { kind: 'protego' }, { cond: { inSquadra: { wizardId: 'goyle' } }, desc: 'All\'inizio: Protego a sé se Goyle è in squadra' }) },
  { id: 'narcissa', name: 'Amore di Madre', desc: 'Scudo a ogni cura; una volta rianima; copre Draco.', lines: [
    riga('squadraCura', 'squadraPropria', { kind: 'scudo', n: 15 }, { params: [15, 22, 30], limit: cd(2), desc: 'Quando la squadra cura (ogni 2 s): Scudo +15' }),
    riga('lancio', 'alleatoSlotMinimo', { kind: 'rianima' }, { cond: { inSquadra: { tag: 'deatheater' } }, limit: una(), desc: 'Una volta: Rianima un alleato (se c\'è un Mangiamorte in squadra)' }),
  ], lv4: riga('inizio', 'se', { kind: 'copre', wizardId: 'draco' }, { desc: 'Copre Draco: gli effetti di unità diretti a lui colpiscono lei' }) },
  { id: 'dolohov', name: 'Maledizione Viola', desc: 'Fiamma sul nemico avvelenato: Miasma facile.', lines: [
    riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'fiamma', stacks: 2 }, { params: [2, 3, 4], cond: { segnoNemico: { segno: 'veleno', min: 1 } }, limit: cd(4), desc: 'Al lancio (ogni 4 s): Fiamma +2 se il nemico è avvelenato' }),
  ], lv4: riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'fiamma', stacks: 2 }, { limit: cd(4), desc: 'Al lancio (ogni 4 s): Fiamma +2' }) },
  { id: 'greyback', name: 'Morso del Lupo', desc: 'Veleno all\'inizio con alleati Veleno; scudo a ogni KO nemico.', lines: [
    riga('inizio', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 1 }, { params: [1, 2, 3], cond: { inSquadra: { tag: 'veleno' } }, desc: 'All\'inizio: Veleno +1 se un alleato Veleno è in squadra' }),
    riga('koNemico', 'squadraPropria', { kind: 'scudo', n: 40 }, { cond: { inSquadra: { tag: 'deatheater' } }, desc: 'Al KO nemico: Scudo +40 se un Mangiamorte è in squadra' }),
  ], lv4: riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 2 }, { limit: cd(4), desc: 'Al lancio (ogni 4 s): Veleno +2' }) },
  { id: 'slughorn', name: 'Lumaclub', desc: 'Le sue pozioni curano gli amici e avvelenano i nemici.', lines: [
    riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 1 }, { params: [1, 2, 3], limit: cd(5), desc: 'Al lancio (ogni 5 s): Veleno +1' }),
    riga('lancio', 'squadraPropria', { kind: 'cura', n: 10 }, { cond: { adiacente: { casa: 'Serpeverde' } }, limit: cd(5), desc: 'Al lancio (ogni 5 s): Cura +10 se un Serpeverde è adiacente' }),
  ], lv4: riga('lancio', 'squadraPropria', { kind: 'cura', n: 10 }, { limit: cd(5), desc: 'Al lancio (ogni 5 s): Cura +10' }) },
  { id: 'pansy', name: 'Pettegolezzo', desc: 'Ogni lingua bloccata è una goccia di veleno.', lines: [
    riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 1 }, { params: [1, 1, 2], limit: cd(3), desc: 'Al lancio (ogni 3 s): Veleno +1' }),
  ], lv4: riga('lancio', 'nemicoCasuale', { kind: 'silenzio', secondi: 2 }, { limit: cd(8), desc: 'Al lancio (ogni 8 s): Silenzio 2 s a un nemico casuale' }) },
  { id: 'goyle', name: 'Guardia del Corpo', desc: 'Scudo all\'inizio; a livello 4 copre Draco.', lines: [
    riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 25 }, { params: [25, 35, 45], desc: 'All\'inizio: Scudo +25' }),
  ], lv4: riga('inizio', 'se', { kind: 'copre', wizardId: 'draco' }, { desc: 'Copre Draco' }) },
  { id: 'crabbe', name: 'Guardia del Corpo', desc: 'Scudo all\'inizio; quando cade, scudo alla squadra.', lines: [
    riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 25 }, { params: [25, 35, 45], desc: 'All\'inizio: Scudo +25' }),
  ], lv4: riga('koSubito', 'squadraPropria', { kind: 'scudo', n: 100 }, { desc: 'Al KO subìto: Scudo +100' }) },
  { id: 'marcus', name: 'Capitano Brutale', desc: 'Colpisce più forte quando il nemico è sotto metà.', lines: [
    riga('continuo', 'se', { kind: 'dannoPct', pct: 0.25 }, { params: [0.25, 0.4, 0.55], cond: { hpNemicaSotto: 0.5 }, desc: '+25% danno se HP nemica < 50%' }),
  ], lv4: riga('koNemico', 'se', { kind: 'multicast', n: 1, durata: 'battaglia' }, { limit: una(3), desc: 'Al KO nemico (max 3): Multicast +1 per il resto della battaglia' }) },
  { id: 'pettigrew', name: 'Codardo', desc: 'Si protegge; quando cade, i Mangiamorte scattano.', lines: [
    riga('inizio', 'se', { kind: 'protego' }, { desc: 'All\'inizio: Protego a sé' }),
  ], lv4: riga('koSubito', 'alleatiTag', { kind: 'innesco' }, { targetArg: 'deatheater', desc: 'Al KO subìto: Innesco dei Mangiamorte' }) },
  { id: 'theodore', name: 'Ombra Silente', desc: 'Veleno nel silenzio.', lines: [
    riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 2 }, { params: [2, 3, 4], limit: cd(4), desc: 'Al lancio (ogni 4 s): Veleno +2' }),
  ], lv4: riga('continuo', 'se', { kind: 'durataStatusPct', status: 'silenzio', pct: 0.5 }, { desc: 'I suoi Silenzi durano +50%' }) },
  { id: 'blaise', name: 'Distacco', desc: 'Più forte quando la squadra ha buchi.', lines: [
    riga('continuo', 'se', { kind: 'dannoPct', pct: 0.1 }, { params: [0.1, 0.15, 0.2], cond: { slotVuotiOKo: true }, desc: '+10% danno se ci sono slot vuoti o KO' }),
  ], lv4: riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 2 }, { cond: { nessunAdiacente: true }, limit: cd(4), desc: 'Al lancio (ogni 4 s): Veleno +2 se nessun alleato è adiacente' }) },
  { id: 'astoria', name: 'Cura Discreta', desc: 'Cura di più con Serpeverde accanto.', lines: [
    riga('lancio', 'squadraPropria', { kind: 'cura', n: 8 }, { params: [8, 12, 16], cond: { adiacente: { casa: 'Serpeverde' } }, limit: cd(5), desc: 'Al lancio (ogni 5 s): Cura +8 se un Serpeverde è adiacente' }),
  ], lv4: riga('squadraCura', 'adiacenti', { kind: 'purifica' }, { limit: cd(4), desc: 'Quando la squadra cura (ogni 4 s): Purifica gli adiacenti' }) },
]
