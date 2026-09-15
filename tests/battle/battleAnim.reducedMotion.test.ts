import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Step 5 of the Task 4 brief: with `prefers-reduced-motion`, numbers and
 * words must stay visible and readable — no animation may end at
 * `opacity: 0`. jsdom doesn't evaluate `@media (prefers-reduced-motion)`
 * against real media features, so this checks the CSS source directly: the
 * reduced-motion block must pin every text-bearing class
 * (.fx-numPop/.fx-numCrit/.fx-wordPop/.fx-tickUp) at `opacity: 1`, and must
 * never set `opacity: 0` on any of them.
 */
const css = readFileSync(join(__dirname, '../../components/battle/battleAnim.css'), 'utf8')

function reducedMotionBlock(source: string): string {
  const marker = '@media (prefers-reduced-motion: reduce)'
  const start = source.indexOf(marker)
  expect(start).toBeGreaterThan(-1)
  // naive brace matching from the opening `{` right after the marker
  const braceStart = source.indexOf('{', start)
  let depth = 0
  let i = braceStart
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}') {
      depth--
      if (depth === 0) break
    }
  }
  return source.slice(braceStart, i + 1)
}

describe('battleAnim.css — reduced motion keeps numbers/words visible', () => {
  const TEXT_CLASSES = ['.fx-numPop', '.fx-numCrit', '.fx-wordPop', '.fx-tickUp']

  it('has a reduced-motion block', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('pins every text-bearing animation class at opacity: 1 in reduced motion', () => {
    const block = reducedMotionBlock(css)
    for (const cls of TEXT_CLASSES) {
      const idx = block.indexOf(cls)
      expect(idx, `${cls} must appear in the reduced-motion block`).toBeGreaterThan(-1)
      // grab the rule body for this selector occurrence
      const ruleStart = block.indexOf('{', idx)
      const ruleEnd = block.indexOf('}', ruleStart)
      const rule = block.slice(idx, ruleEnd)
      expect(rule, `${cls} reduced-motion rule must set opacity: 1`).toMatch(/opacity:\s*1\s*!important/)
    }
  })

  it('never sets opacity: 0 on a text-bearing class anywhere in the file', () => {
    for (const cls of TEXT_CLASSES) {
      // Find every rule block whose selector list includes this class, and
      // confirm none of them (base keyframe end-state or override) leaves it
      // at opacity: 0. We scan `100% { ... }` keyframe stops for the base
      // animation and the override rule bodies above.
      const classSelectorRegex = new RegExp(`\\${cls}[^{]*\\{([^}]*)\\}`, 'g')
      let match: RegExpExecArray | null
      while ((match = classSelectorRegex.exec(css))) {
        expect(match[1], `${cls} rule must not end at opacity: 0`).not.toMatch(/opacity:\s*0(?!\.\d)(?!\s*;?\s*!important;?\s*\/\*)/)
      }
    }
  })
})
