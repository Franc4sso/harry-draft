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

/**
 * Extracts the body of a top-level `@keyframes <name> { ... }` block, matched
 * by the BARE animation name (keyframes are never selected by a `.fx-*`
 * class — that class only binds `animation: <name> ...` on the element).
 * Brace-matched so nested `{ }` from percentage stops don't truncate it.
 */
function keyframesBody(source: string, name: string): string {
  const marker = new RegExp(`@keyframes\\s+${name}\\s*\\{`)
  const m = marker.exec(source)
  expect(m, `@keyframes ${name} must exist`).not.toBeNull()
  const braceStart = m!.index + m![0].length - 1
  let depth = 0
  let i = braceStart
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}') {
      depth--
      if (depth === 0) break
    }
  }
  return source.slice(braceStart + 1, i)
}

/** The final stop of a keyframes body: the `100% { ... }` block (or the last
 *  comma-joined selector ending in `100%`, e.g. `0%, 100% { ... }`). This is
 *  the state the animation actually settles into once it finishes playing —
 *  exactly where "ends at opacity: 0" would live. */
function finalStopBody(body: string): string {
  const stopRegex = /([\d%,\s]+)\{([^}]*)\}/g
  let last: string | null = null
  let match: RegExpExecArray | null
  while ((match = stopRegex.exec(body))) {
    const selectors = match[1] ?? ''
    if (/\b100%/.test(selectors)) last = match[2] ?? ''
  }
  expect(last, 'a 100% stop must exist in the keyframes body').not.toBeNull()
  return last!
}

describe('battleAnim.css — reduced motion keeps numbers/words visible', () => {
  const TEXT_CLASSES = ['.fx-numPop', '.fx-numCrit', '.fx-wordPop', '.fx-tickUp']
  // Bare animation names bound by the classes above (keyframes are keyed by
  // name, not by the `.fx-*` class — see keyframesBody).
  const TEXT_ANIMATIONS = ['numPop', 'numCrit', 'wordPop', 'tickUp']

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

  it('never lets a text-bearing @keyframes animation settle at opacity: 0', () => {
    // Regression target: the base `@keyframes numPop { ... 100% { opacity: 0 } }`
    // (etc.) is where an animation "ending invisible" actually lives — the
    // reduced-motion override (checked above) can't compensate for a base
    // keyframe that legitimately plays (motion allowed) and fades to nothing.
    for (const name of TEXT_ANIMATIONS) {
      const body = keyframesBody(css, name)
      const finalStop = finalStopBody(body)
      expect(finalStop, `@keyframes ${name}'s 100% stop must not settle at opacity: 0`)
        .not.toMatch(/opacity:\s*0(?!\.\d)/)
    }
  })
})
