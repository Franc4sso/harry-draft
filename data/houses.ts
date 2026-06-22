import type { House } from '@/types'

export const HOUSES: Record<House, { id: House; label: string; color: string; glow: string }> = {
  Grifondoro: { id: 'Grifondoro', label: 'Grifondoro', color: '#ae0001', glow: '#ffc500' },
  Serpeverde: { id: 'Serpeverde', label: 'Serpeverde', color: '#1a472a', glow: '#aaaaaa' },
  Corvonero:  { id: 'Corvonero',  label: 'Corvonero',  color: '#222f5b', glow: '#946b2d' },
  Tassorosso: { id: 'Tassorosso', label: 'Tassorosso', color: '#ecb939', glow: '#372e29' },
}
