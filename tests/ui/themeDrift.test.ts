import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'
import { HOUSES } from '@/data/houses'

const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')

const CSS_NAME_TO_HOUSE = {
  grifondoro: 'Grifondoro',
  serpeverde: 'Serpeverde',
  corvonero: 'Corvonero',
  tassorosso: 'Tassorosso',
} as const

type CssKey = keyof typeof CSS_NAME_TO_HOUSE
type HouseKey = (typeof CSS_NAME_TO_HOUSE)[CssKey]

function parseCssVar(varName: string): string {
  const re = new RegExp(`--${varName}:\\s*(#[0-9a-fA-F]{3,8})`)
  const m = re.exec(css)
  if (!m || !m[1]) throw new Error(`CSS var --${varName} not found in app/globals.css`)
  return m[1].toLowerCase()
}

describe('house color drift: globals.css ↔ data/houses.ts', () => {
  for (const [cssKey, houseKey] of Object.entries(CSS_NAME_TO_HOUSE) as [CssKey, HouseKey][]) {
    const house = HOUSES[houseKey]

    it(`${houseKey} color matches --house-${cssKey}`, () => {
      const cssColor = parseCssVar(`house-${cssKey}`)
      const jsColor = house.color.toLowerCase()
      expect(
        cssColor,
        `${houseKey} color drift: CSS --house-${cssKey} is "${cssColor}" but HOUSES.${houseKey}.color is "${jsColor}"`
      ).toBe(jsColor)
    })

    it(`${houseKey} glow matches --house-${cssKey}-glow`, () => {
      const cssGlow = parseCssVar(`house-${cssKey}-glow`)
      const jsGlow = house.glow.toLowerCase()
      expect(
        cssGlow,
        `${houseKey} glow drift: CSS --house-${cssKey}-glow is "${cssGlow}" but HOUSES.${houseKey}.glow is "${jsGlow}"`
      ).toBe(jsGlow)
    })
  }
})
