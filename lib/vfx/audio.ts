/**
 * Howler-based SFX bus for combat. Until real sound assets land, cues are short
 * procedurally-generated WAV tones (data URIs) — real Howl instances, so the
 * wiring is production-shaped; only the `defs` table gets swapped for asset URLs.
 *
 * Browser-only: `createAudio()` dynamically imports Howler so nothing touches
 * the AudioContext during SSR.
 */
export interface AudioBus {
  play: (cue: string) => void
  setMuted: (muted: boolean) => void
  dispose: () => void
}

type Wave = 'sine' | 'square' | 'saw' | 'noise'
type ToneDef = [freq: number, ms: number, type: Wave, sweep: number]

/** [base frequency, duration ms, waveform, linear frequency sweep over the tone]. */
const DEFS: Record<string, ToneDef> = {
  cast:   [300, 170, 'saw', 200],
  hit:    [190, 90, 'square', -130],
  crit:   [90, 230, 'saw', 300],
  heal:   [640, 260, 'sine', 240],
  shield: [900, 180, 'sine', -320],
  poison: [150, 120, 'square', -50],
  stun:   [420, 140, 'square', 120],
}

function toneWav([freq, ms, type, sweep]: ToneDef): string {
  const sr = 11025
  const n = Math.floor((sr * ms) / 1000)
  const buf = new ArrayBuffer(44 + n * 2)
  const dv = new DataView(buf)
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); str(8, 'WAVE')
  str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true)
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true)
  str(36, 'data'); dv.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) {
    const t = i / sr
    const env = Math.pow(1 - i / n, 2)
    const f = freq + sweep * t
    let s: number
    if (type === 'noise') s = Math.random() * 2 - 1
    else if (type === 'square') s = Math.sin(2 * Math.PI * f * t) > 0 ? 1 : -1
    else if (type === 'saw') s = 2 * ((f * t) % 1) - 1
    else s = Math.sin(2 * Math.PI * f * t)
    const v = Math.max(-1, Math.min(1, s * env * 0.5))
    dv.setInt16(44 + i * 2, v * 32767, true)
  }
  let bin = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return 'data:audio/wav;base64,' + btoa(bin)
}

export async function createAudio(): Promise<AudioBus> {
  const { Howl, Howler } = await import('howler')
  const cache: Record<string, InstanceType<typeof Howl>> = {}
  let muted = false

  const get = (cue: string) => {
    const def = DEFS[cue]
    if (!def) return null
    if (!cache[cue]) cache[cue] = new Howl({ src: [toneWav(def)], volume: 0.45 })
    return cache[cue]
  }

  return {
    play: (cue) => {
      if (muted) return
      try { get(cue)?.play() } catch { /* autoplay blocked until first gesture */ }
    },
    setMuted: (m) => {
      muted = m
      try { Howler.mute(m) } catch { /* no context yet */ }
    },
    dispose: () => {
      for (const h of Object.values(cache)) { try { h.unload() } catch { /* noop */ } }
    },
  }
}
