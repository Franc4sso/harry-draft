import { getStore } from '@netlify/blobs'

export interface Entry { nickname: string; score: number; floor: number }

export async function readLeaderboard(): Promise<Entry[]> {
  const store = getStore('endless-leaderboard')
  const raw = await store.get('top', { type: 'text' })
  const list: Entry[] = raw ? JSON.parse(raw) : []
  return list.sort((a, b) => b.score - a.score)
}

export default async function handler(): Promise<Response> {
  try {
    const list = await readLeaderboard()
    return new Response(JSON.stringify(list), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch {
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }) // fail-silent
  }
}
