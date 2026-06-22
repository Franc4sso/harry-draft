const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function randomSeed(): string {
  let s = ''
  for (let i = 0; i < 8; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return s
}

export function normalizeSeed(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim()
  return trimmed.length > 0 ? trimmed : randomSeed()
}
