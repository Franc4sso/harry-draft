const BESTS_KEY = 'endless.bests'
const NICK_KEY = 'endless.nickname'
const MAX_BESTS = 10

export function recordLocalBest(score: number, floor: number): void {
  const list = getLocalBests()
  list.push({ score, floor })
  list.sort((a, b) => b.score - a.score)
  localStorage.setItem(BESTS_KEY, JSON.stringify(list.slice(0, MAX_BESTS)))
}

export function getLocalBests(): { score: number; floor: number }[] {
  try { return JSON.parse(localStorage.getItem(BESTS_KEY) ?? '[]') } catch { return [] }
}

export function getNickname(): string | null {
  return localStorage.getItem(NICK_KEY)
}

export function setNickname(n: string): void {
  localStorage.setItem(NICK_KEY, n.slice(0, 20))
}
