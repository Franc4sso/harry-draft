import type { Trait } from '@/types'

export const TRAITS: Trait[] = []
export const TRAIT_BY_ID: Record<string, Trait> = Object.fromEntries(TRAITS.map(t => [t.id, t]))
