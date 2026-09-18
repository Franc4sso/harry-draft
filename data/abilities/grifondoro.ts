import type { Ability } from '@/types/rt'
import { riga, cd, una, libera } from './util'

export const GRIFONDORO: Ability[] = [
  { id: 'harry', name: 'Coraggio del Grifondoro', desc: 'Colpisce più forte subito dopo un compagno; a ogni vittoria rende più forti Ron e Hermione.', lines: [
    riga('continuo', 'se', { kind: 'dannoPct', pct: 0.5 }, { params: [0.5, 0.75, 1], cond: { entroSecondiDa: { evento: 'lancioAdiacente', secondi: 2 } }, desc: '+50% danno se un alleato adiacente ha lanciato negli ultimi 2 s' }),
    riga('lancio', 'se', { kind: 'carica', secondi: 0.5 }, { params: [0.5, 0.75, 1], limit: cd(5), desc: 'Al lancio (ogni 5 s): Carica a sé' }),
    riga('vittoria', 'alleatiTag', { kind: 'dannoFlat', n: 2 }, { params: [2, 3, 4], targetArg: 'trio', desc: 'A vittoria: +2 danno permanente al Trio' }),
  ], lv4: riga('sottoSoglia', 'se', { kind: 'multicast', n: 1, durata: 'battaglia' }, { cond: { hpPropriaSotto: 0.5 }, desc: 'Sotto 50% HP: Multicast +1' }) },
  { id: 'dumbledore', name: 'Bacchetta di Sambuco', desc: 'Gela la prima fila nemica all\'inizio e carica tutta la squadra a ogni lancio.', lines: [
    riga('inizio', 'primaFilaNemica', { kind: 'gelo', secondi: 1.5 }, { params: [1.5, 2, 2.5], desc: 'All\'inizio: Gelo alla prima fila nemica' }),
    riga('lancio', 'tuttiAlleati', { kind: 'carica', secondi: 0.5 }, { params: [0.5, 0.75, 1], limit: cd(3), desc: 'Al lancio (ogni 3 s): Carica a tutti' }),
  ], lv4: riga('lancio', 'tuttiAlleati', { kind: 'protego' }, { limit: una(), desc: 'Una volta: Protego a tutti' }) },
  { id: 'mcgonagall', name: 'Trasfigurazione Marziale', desc: 'Scudo grande all\'inizio e Protego alla sua fila.', lines: [
    riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 50 }, { params: [50, 75, 100], desc: 'All\'inizio: Scudo +50' }),
    riga('inizio', 'riga', { kind: 'protego' }, { desc: 'All\'inizio: Protego alla sua fila' }),
  ], lv4: riga('ogniSecondi', 'squadraPropria', { kind: 'scudo', n: 50 }, { limit: cd(10), desc: 'Ogni 10 s: Scudo +50' }) },
  { id: 'sirius', name: 'Fuga da Azkaban', desc: 'Si carica se un Malandrino è in squadra; ogni KO nemico gli dà Multicast.', lines: [
    riga('lancio', 'se', { kind: 'carica', secondi: 1 }, { params: [1, 1.5, 2], cond: { inSquadra: { tag: 'marauder' } }, limit: cd(4), desc: 'Al lancio (ogni 4 s): Carica a sé se un Malandrino è in squadra' }),
    riga('koNemico', 'se', { kind: 'multicast', n: 1, durata: 5 }, { desc: 'Al KO nemico: Multicast +1 per 5 s' }),
  ], lv4: riga('koNemico', 'alleatiTag', { kind: 'innesco' }, { targetArg: 'marauder', limit: cd(6), desc: 'Al KO nemico: Innesco dei Malandrini' }) },
  { id: 'lupin', name: 'Furia Lupesca', desc: 'Sotto metà vita la bestia si scatena.', lines: [
    riga('sottoSoglia', 'se', { kind: 'multicast', n: 1, durata: 'battaglia' }, { cond: { hpPropriaSotto: 0.5 }, desc: 'Sotto 50% HP: Multicast +1' }),
    riga('sottoSoglia', 'se', { kind: 'dannoPct', pct: 0.3, durata: 'battaglia' }, { params: [0.3, 0.45, 0.6], cond: { hpPropriaSotto: 0.5 }, desc: 'Sotto 50% HP: +30% danno' }),
  ], lv4: riga('sottoSoglia', 'tuttiAlleati', { kind: 'immune', a: 'gelo' }, { cond: { hpPropriaSotto: 0.25 }, desc: 'Sotto 25% HP: la squadra è immune al Gelo' }) },
  { id: 'moody', name: 'Vigilanza Costante', desc: 'Protegge la sua fila e vendica un alleato caduto con un KO.', lines: [
    riga('inizio', 'riga', { kind: 'protego' }, { desc: 'All\'inizio: Protego alla sua fila' }),
    riga('koAlleato', 'opposto', { kind: 'ko' }, { cond: { hpNemicaSotto: 0.5 }, limit: una(), desc: 'Al KO alleato (una volta): KO all\'opposto se HP nemica < 50%' }),
  ], lv4: riga('inizio', 'tuttiAlleati', { kind: 'protego' }, { desc: 'All\'inizio: Protego a tutti' }) },
  { id: 'hermione', name: 'Mente Brillante', desc: 'Carica chi le sta davanti e ogni tre lanci silenzia l\'opposto.', lines: [
    riga('lancio', 'davanti', { kind: 'carica', secondi: 0.75 }, { params: [0.75, 1, 1.25], limit: cd(4), desc: 'Al lancio (ogni 4 s): Carica all\'alleato davanti' }),
    riga('lancio', 'opposto', { kind: 'silenzio', secondi: 2 }, { cond: { ogniNLanci: 3 }, limit: libera(), desc: 'Ogni 3° lancio: Silenzio 2 s all\'opposto' }),
  ], lv4: riga('continuo', 'se', { kind: 'durataStatusPct', status: 'lentezza', pct: 1 }, { desc: 'Le sue Lentezze durano il doppio' }) },
  { id: 'ron', name: 'Scacchi Magici', desc: 'Protego agli adiacenti; scudo extra con i Weasley in squadra.', lines: [
    riga('inizio', 'adiacenti', { kind: 'protego' }, { desc: 'All\'inizio: Protego agli adiacenti' }),
    riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 30 }, { params: [30, 45, 60], cond: { inSquadra: { tag: 'weasley' } }, desc: 'All\'inizio: Scudo +30 se un Weasley è in squadra' }),
  ], lv4: riga('koSubito', 'adiacenti', { kind: 'innesco' }, { desc: 'Al KO subìto: Innesco degli adiacenti' }) },
  { id: 'ginny', name: 'Fattura Mocciovolante', desc: 'Con un Weasley accanto il prossimo lancio è doppio; a vittoria cresce.', lines: [
    riga('lancio', 'se', { kind: 'multicast', n: 1, durata: 6 }, { cond: { adiacente: { tag: 'weasley' } }, limit: cd(8), desc: 'Al lancio (ogni 8 s), con un Weasley adiacente: Multicast +1 per 6 s' }),
    riga('vittoria', 'se', { kind: 'dannoFlat', n: 3 }, { params: [3, 4, 5], desc: 'A vittoria: +3 danno permanente' }),
  ], lv4: riga('lancio', 'se', { kind: 'dannoPct', pct: 0.5, durata: 3 }, { limit: cd(6), desc: 'Al lancio (ogni 6 s): +50% danno per 3 s' }) },
  { id: 'neville', name: 'Coraggio Tardivo', desc: 'Quando un alleato cade, l\'Esercito di Silente si infuria.', lines: [
    riga('koAlleato', 'alleatiTag', { kind: 'dannoPct', pct: 0.4, durata: 'battaglia' }, { params: [0.4, 0.6, 0.8], targetArg: 'da', desc: 'Al KO alleato: +40% danno agli ES per il resto della battaglia' }),
    riga('inizio', 'se', { kind: 'protego' }, { cond: { inSquadra: { tag: 'da' } }, desc: 'All\'inizio: Protego a sé se un altro ES è in squadra' }),
  ], lv4: riga('lancio', 'alleatoSlotMinimo', { kind: 'rianima' }, { limit: una(), desc: 'Una volta: Rianima un alleato' }) },
  { id: 'fred', name: 'Tiro Mancino', desc: 'Innesca l\'alleato alla sua destra (mettici George).', lines: [
    riga('lancio', 'destra', { kind: 'innesco' }, { limit: cd(4), desc: 'Al lancio (ogni 4 s): Innesco dell\'alleato a destra' }),
  ], lv4: riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'fiamma', stacks: 2 }, { limit: cd(4), desc: 'Al lancio (ogni 4 s): Fiamma +2' }) },
  { id: 'george', name: 'Scherzo Ustionante', desc: 'Innesca l\'alleato alla sua sinistra (mettici Fred).', lines: [
    riga('lancio', 'sinistra', { kind: 'innesco' }, { limit: cd(4), desc: 'Al lancio (ogni 4 s): Innesco dell\'alleato a sinistra' }),
  ], lv4: riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'scossa', stacks: 2 }, { limit: cd(4), desc: 'Al lancio (ogni 4 s): Scossa +2' }) },
  { id: 'molly', name: 'Istinto Materno', desc: 'Cura extra con i Weasley e scudo a ogni cura.', lines: [
    riga('squadraCura', 'squadraPropria', { kind: 'scudo', n: 10 }, { params: [10, 15, 20], limit: cd(3), desc: 'Quando la squadra cura (ogni 3 s): Scudo +10' }),
    riga('lancio', 'squadraPropria', { kind: 'cura', n: 10 }, { params: [10, 15, 20], cond: { inSquadra: { tag: 'weasley' } }, limit: cd(5), desc: 'Al lancio (ogni 5 s): Cura +10 se un Weasley è in squadra' }),
  ], lv4: riga('koAlleato', 'opposto', { kind: 'ko' }, { cond: { hpNemicaSotto: 0.5 }, limit: una(), desc: 'Al KO alleato (una volta): KO all\'opposto se HP nemica < 50%' }) },
  { id: 'arthur', name: 'Officina Weasley', desc: 'Carica tutti i Weasley a ogni lancio.', lines: [
    riga('lancio', 'alleatiTag', { kind: 'carica', secondi: 0.5 }, { params: [0.5, 0.75, 1], targetArg: 'weasley', limit: cd(3), desc: 'Al lancio (ogni 3 s): Carica a tutti i Weasley' }),
  ], lv4: riga('lancio', 'adiacenti', { kind: 'carica', secondi: 0.5 }, { limit: cd(3), desc: 'Al lancio (ogni 3 s): Carica agli adiacenti' }) },
  { id: 'hagrid', name: 'Cuore di Mezzogigante', desc: 'Più HP di squadra e uno scudo grosso.', lines: [
    riga('continuo', 'squadraPropria', { kind: 'hpPct', pct: 0.1 }, { params: [0.1, 0.15, 0.2], desc: 'HP di squadra +10%' }),
    riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 40 }, { cond: { inSquadra: { tag: 'da' } }, desc: 'All\'inizio: Scudo +40 se un ES è in squadra' }),
  ], lv4: riga('koSubito', 'squadraPropria', { kind: 'scudo', n: 150 }, { desc: 'Al KO subìto: Scudo +150' }) },
  { id: 'seamus', name: 'Esplosione Facile', desc: 'Fiamma a ogni lancio; ogni tanto esplode anche sui suoi.', lines: [
    riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'fiamma', stacks: 1 }, { params: [1, 2, 3], limit: cd(3), desc: 'Al lancio (ogni 3 s): Fiamma +1' }),
  ], lv4: riga('lancio', 'squadraPropria', { kind: 'segno', segno: 'fiamma', stacks: 2 }, { cond: { chance: 0.25 }, limit: cd(3), desc: 'Al lancio: 25% esplode, Fiamma +2 alla propria squadra' }) },
  { id: 'dean', name: 'Tifoso', desc: 'Più forte con Seamus accanto.', lines: [
    riga('continuo', 'se', { kind: 'dannoPct', pct: 0.15 }, { params: [0.15, 0.25, 0.35], cond: { adiacente: { wizardId: 'seamus' } }, desc: '+15% danno se Seamus è adiacente' }),
  ], lv4: riga('continuo', 'se', { kind: 'dannoPct', pct: 0.15 }, { cond: { adiacente: { casa: 'Grifondoro' } }, desc: '+15% danno se un Grifondoro è adiacente' }) },
  { id: 'parvati', name: 'Divinazione Gemella', desc: 'Con Padma in squadra lancia più spesso.', lines: [
    riga('continuo', 'se', { kind: 'cdFlat', secondi: -0.5 }, { params: [-0.5, -0.75, -1], cond: { inSquadra: { wizardId: 'padma' } }, desc: 'Cooldown −0,5 s se Padma è in squadra' }),
  ], lv4: riga('lancio', 'nemicoCasuale', { kind: 'sospeso', secondi: 3 }, { limit: cd(6), desc: 'Al lancio (ogni 6 s): Sospeso a un nemico casuale' }) },
  { id: 'lavender', name: 'Won-Won', desc: 'Cura di più con Ron accanto.', lines: [
    riga('lancio', 'squadraPropria', { kind: 'cura', n: 10 }, { params: [10, 15, 20], cond: { adiacente: { wizardId: 'ron' } }, limit: cd(5), desc: 'Al lancio (ogni 5 s): Cura +10 se Ron è adiacente' }),
  ], lv4: riga('koAlleato', 'squadraPropria', { kind: 'cura', n: 80 }, { limit: una(), desc: 'Al KO alleato (una volta): Cura 80' }) },
]
