export const SLOTS = [0, 1, 2, 3, 4, 5] as const
export const rowOf = (slot: number) => (slot < 3 ? 0 : 1)
export const colOf = (slot: number) => slot % 3
export const front = (slot: number): number | null => (slot >= 3 ? slot - 3 : null)
export const behind = (slot: number): number | null => (slot < 3 ? slot + 3 : null)
export const leftOf = (slot: number): number | null => (colOf(slot) > 0 ? slot - 1 : null)
export const rightOf = (slot: number): number | null => (colOf(slot) < 2 ? slot + 1 : null)
export function adjacent(slot: number): number[] {
  return [front(slot), behind(slot), leftOf(slot), rightOf(slot)].filter((s): s is number => s !== null)
}
export const rowSlots = (row: 0 | 1) => (row === 0 ? [0, 1, 2] : [3, 4, 5])
export const colSlots = (col: number) => [col, col + 3]
