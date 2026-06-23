export const NOTTURNO = {
  ink: '#0a0813', inkSoft: '#0c0a16',
  night: '#161d33', nightSoft: '#1b2440',
  gold: '#b08d57', goldBright: '#caa24a', goldPale: '#f3e6a0',
  violet: '#7c3aed', violetBright: '#a855f7',
} as const

export type NotturnoColor = keyof typeof NOTTURNO
