import { RT, near } from './constants'
import { fireLine, linesOf } from './abilities'
import { alive, emit, sideOf, unitByKey, type RtState, type TriggerEvent } from './state'

export function enqueue(state: RtState, ev: TriggerEvent): void { state.queue.push(ev) }

function fireFor(state: RtState, ev: TriggerEvent): void {
  const bersaglio = ev.bersaglioKey ? unitByKey(state, ev.bersaglioKey) ?? undefined : undefined
  if (ev.unitKey) {
    const u = unitByKey(state, ev.unitKey)
    if (!u) return
    for (const ol of linesOf(u)) if (ol.line.trigger === ev.trigger) fireLine(state, u, u.side, ol.line, ol.key, ol.abilityId, { bersaglio })
  }
  ;(sideOf(state, ev.side).mods.lines ?? []).forEach((line, i) => {
    if (line.trigger === ev.trigger && (!ev.unitKey || ev.trigger === 'koAlleato' || ev.trigger === 'koNemico' || ev.trigger === 'squadraCura'))
      fireLine(state, null, ev.side, line, `${ev.side}#m${i}`, 'mods', { bersaglio })
  })
}

/** Svuota la coda a passate. Ogni passata è un livello di profondità; oltre `triggerDepthMax` scarta. */
export function processQueue(state: RtState): void {
  while (state.queue.length) {
    if (state.depth >= RT.triggerDepthMax) {
      emit(state, { kind: 'trigger', name: 'anti-loop', value: state.queue.length })
      state.queue = []
      break
    }
    state.depth += 1
    const batch = state.queue; state.queue = []
    for (const ev of batch) fireFor(state, ev)
  }
  state.depth = 0
}

export function fireInizio(state: RtState): void {
  for (const side of ['left', 'right'] as const) {
    for (const u of alive(state, side)) enqueue(state, { trigger: 'inizio', side, unitKey: u.key })
    if (sideOf(state, side).mods.lines?.some(l => l.trigger === 'inizio')) enqueue(state, { trigger: 'inizio', side })
  }
  processQueue(state)
}

export function fireSoglie(state: RtState): void {
  for (const side of ['left', 'right'] as const) {
    const s = sideOf(state, side)
    for (const u of alive(state, side)) for (const ol of linesOf(u)) {
      if (ol.line.trigger !== 'sottoSoglia' || s.soglieScattate.has(ol.key)) continue
      if (fireLine(state, u, side, ol.line, ol.key, ol.abilityId, {})) s.soglieScattate.add(ol.key)
    }
    ;(s.mods.lines ?? []).forEach((line, i) => {
      const key = `${side}#m${i}`
      if (line.trigger !== 'sottoSoglia' || s.soglieScattate.has(key)) return
      if (fireLine(state, null, side, line, key, 'mods', {})) s.soglieScattate.add(key)
    })
  }
  processQueue(state)
}

export function fireOgniSecondi(state: RtState): void {
  for (const side of ['left', 'right'] as const) {
    const s = sideOf(state, side)
    for (const u of alive(state, side)) for (const ol of linesOf(u)) {
      const every = ol.line.limit?.everySeconds
      if (ol.line.trigger !== 'ogniSecondi' || !every) continue
      if (state.t > 0 && near(Math.round(state.t / every) * every, state.t)) fireLine(state, u, side, ol.line, ol.key, ol.abilityId, {})
    }
    ;(s.mods.lines ?? []).forEach((line, i) => {
      const every = line.limit?.everySeconds
      if (line.trigger === 'ogniSecondi' && every && state.t > 0 && near(Math.round(state.t / every) * every, state.t)) fireLine(state, null, side, line, `${side}#m${i}`, 'mods', {})
    })
  }
  processQueue(state)
}
