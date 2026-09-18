import type { Ability } from '@/types/rt'
import { riga, cd, una, libera } from './util'

export const CORVONERO: Ability[] = [
  { id: 'kingsley', name: 'Pugno dell\'Auror', desc: 'Rallenta l\'opposto; scudo extra con l\'Ordine in squadra.', lines: [
    riga('lancio', 'opposto', { kind: 'lentezza', secondi: 2 }, { params: [2, 2.5, 3], limit: cd(4), desc: 'Al lancio (ogni 4 s): Lentezza 2 s all\'opposto' }),
    riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 20 }, { params: [20, 30, 40], cond: { inSquadra: { tag: 'order' } }, desc: 'All\'inizio: Scudo +20 se un membro dell\'Ordine è in squadra' }),
  ], lv4: riga('inizio', 'alleatiTag', { kind: 'protego' }, { targetArg: 'order', desc: 'All\'inizio: Protego all\'Ordine' }) },
  { id: 'fleur', name: 'Fascino Veela', desc: 'Disarma l\'opposto e accende una Fiamma con un Corvonero accanto.', lines: [
    riga('lancio', 'opposto', { kind: 'disarmo' }, { limit: cd(6), desc: 'Al lancio (ogni 6 s): Disarmo all\'opposto' }),
    riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'fiamma', stacks: 1 }, { cond: { adiacente: { casa: 'Corvonero' } }, limit: libera(), desc: 'Al lancio: Fiamma +1 se un Corvonero è adiacente' }),
  ], lv4: riga('lancio', 'opposto', { kind: 'gelo', secondi: 1 }, { cond: { segnoNemico: { segno: 'fiamma', min: 3 } }, limit: cd(6), desc: 'Al lancio (ogni 6 s): Gelo 1 s se il nemico ha ≥3 Fiamma (Vapore)' }) },
  { id: 'viktor', name: 'Bulgaro d\'Acciaio', desc: 'Lupo solitario: più forte senza alleati accanto.', lines: [
    riga('continuo', 'se', { kind: 'dannoPct', pct: 0.3 }, { params: [0.3, 0.5, 0.7], cond: { nessunAdiacente: true }, desc: '+30% danno se nessun alleato è adiacente' }),
    riga('lancio', 'se', { kind: 'carica', secondi: 0.5 }, { limit: cd(5), desc: 'Al lancio (ogni 5 s): Carica 0,5 s a sé' }),
  ], lv4: riga('lancio', 'se', { kind: 'dannoPct', pct: 0.5, durata: 3 }, { limit: cd(6), desc: 'Al lancio (ogni 6 s): +50% danno per 3 s' }) },
  { id: 'luna', name: 'Serenità', desc: 'Cura lenta e costante; purifica chi le sta accanto.', lines: [
    riga('ogniSecondi', 'squadraPropria', { kind: 'cura', n: 10 }, { params: [10, 15, 20], limit: cd(4), desc: 'Ogni 4 s: Cura 10' }),
    riga('squadraCura', 'adiacenti', { kind: 'purifica' }, { cond: { inSquadra: { tag: 'da' } }, limit: cd(2), desc: 'Quando la squadra cura (ogni 2 s): Purifica gli adiacenti se un altro ES è in squadra' }),
  ], lv4: riga('inizio', 'tuttiAlleati', { kind: 'immune', a: 'silenzio' }, { desc: 'La squadra è immune al Silenzio' }) },
  { id: 'cho', name: 'Lacrime Gelide', desc: 'Dopo un Gelo alleato colpisce l\'opposto: Frantuma.', lines: [
    riga('lancio', 'opposto', { kind: 'danno', potenza: 1.5 }, { params: [1.5, 1.9, 2.3], cond: { entroSecondiDa: { evento: 'gelo', secondi: 2 } }, limit: cd(4), desc: 'Al lancio (ogni 4 s): Danno 1,5 all\'opposto entro 2 s da un Gelo alleato' }),
  ], lv4: riga('lancio', 'nemicoCasuale', { kind: 'gelo', secondi: 1 }, { limit: cd(6), desc: 'Al lancio (ogni 6 s): Gelo 1 s a un nemico casuale' }) },
  { id: 'flitwick', name: 'Maestro d\'Incantesimi', desc: 'Carica i Corvonero; ogni tre lanci gela l\'opposto.', lines: [
    riga('lancio', 'alleatiCasa', { kind: 'carica', secondi: 0.5 }, { params: [0.5, 0.75, 1], targetArg: 'Corvonero', limit: cd(3), desc: 'Al lancio (ogni 3 s): Carica ai Corvonero' }),
    riga('lancio', 'opposto', { kind: 'gelo', secondi: 1 }, { cond: { ogniNLanci: 3 }, limit: libera(), desc: 'Ogni 3° lancio: Gelo 1 s all\'opposto' }),
  ], lv4: riga('lancio', 'tuttiAlleati', { kind: 'carica', secondi: 0.5 }, { limit: cd(3), desc: 'Al lancio (ogni 3 s): Carica a tutti' }) },
  { id: 'padma', name: 'Divinazione Gemella', desc: 'Con Parvati in squadra lancia più spesso.', lines: [
    riga('continuo', 'se', { kind: 'cdFlat', secondi: -0.5 }, { params: [-0.5, -0.75, -1], cond: { inSquadra: { wizardId: 'parvati' } }, desc: 'Cooldown −0,5 s se Parvati è in squadra' }),
  ], lv4: riga('lancio', 'opposto', { kind: 'sospeso', secondi: 3 }, { limit: cd(6), desc: 'Al lancio (ogni 6 s): Sospeso 3 s all\'opposto' }) },
  { id: 'terry', name: 'Analisi', desc: 'Ogni due lanci una Scossa.', lines: [
    riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'scossa', stacks: 1 }, { params: [1, 1, 2], cond: { ogniNLanci: 2 }, limit: libera(), desc: 'Ogni 2° lancio: Scossa +1' }),
  ], lv4: riga('lancio', 'squadraNemica', { kind: 'vulnerabile', secondi: 1 }, { limit: cd(4), desc: 'Al lancio (ogni 4 s): Vulnerabile 1 s' }) },
  { id: 'michael', name: 'Precisione', desc: 'Colpisce forte il nemico Scosso.', lines: [
    riga('continuo', 'se', { kind: 'dannoPct', pct: 0.2 }, { params: [0.2, 0.3, 0.4], cond: { segnoNemico: { segno: 'scossa', min: 3 } }, desc: '+20% danno se il nemico ha ≥3 Scossa' }),
  ], lv4: riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'scossa', stacks: 2 }, { limit: cd(5), desc: 'Al lancio (ogni 5 s): Scossa +2' }) },
  { id: 'roger', name: 'Capitano Corvonero', desc: 'Scudo all\'inizio; a livello 4 la sua fila colpisce di più.', lines: [
    riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 25 }, { params: [25, 35, 45], desc: 'All\'inizio: Scudo +25' }),
  ], lv4: riga('continuo', 'riga', { kind: 'dannoPct', pct: 0.1 }, { desc: 'La sua fila: +10% danno' }) },
  { id: 'marietta', name: 'Spifferona', desc: 'Rende il nemico Vulnerabile.', lines: [
    riga('lancio', 'squadraNemica', { kind: 'vulnerabile', secondi: 1 }, { params: [1, 1.5, 2], limit: cd(4), desc: 'Al lancio (ogni 4 s): Vulnerabile 1 s' }),
  ], lv4: riga('lancio', 'opposto', { kind: 'silenzio', secondi: 1 }, { limit: cd(6), desc: 'Al lancio (ogni 6 s): Silenzio 1 s all\'opposto' }) },
  { id: 'anthony', name: 'Prefetto', desc: 'Scudo all\'inizio; a livello 4 protegge gli adiacenti.', lines: [
    riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 25 }, { params: [25, 35, 45], desc: 'All\'inizio: Scudo +25' }),
  ], lv4: riga('inizio', 'adiacenti', { kind: 'protego' }, { desc: 'All\'inizio: Protego agli adiacenti' }) },
  { id: 'penelope', name: 'Prefetta', desc: 'Carica chi le sta davanti.', lines: [
    riga('lancio', 'davanti', { kind: 'carica', secondi: 0.5 }, { params: [0.5, 0.75, 1], limit: cd(3), desc: 'Al lancio (ogni 3 s): Carica all\'alleato davanti' }),
  ], lv4: riga('lancio', 'dietro', { kind: 'carica', secondi: 0.75 }, { limit: cd(3), desc: 'Al lancio (ogni 3 s): Carica all\'alleato dietro' }) },
]
