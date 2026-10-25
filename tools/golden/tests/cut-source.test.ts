import { describe, expect, it } from 'vitest'

import { cutBetween, cutDeclaration, cutFunction, cutLines, cutLiteral, evaluateSlice, extractLiteral } from '../src/cut-source'

const SOURCE = `// header { not a group
const A = [1, 2, { s: "]}", t: '[' }, \`x\${ { a: '}' }.a }\`];
const NOT_A = 5;
let TABLE = { rows: [/[\\]}]/.source, 3], note: /* ) */ 'ok' }; // trailing
function twice(value) { const text = "}"; return value * 2 }
const BUILD = (() => { const k = 3; return (n) => n * k })();
async function later() { return 1 }
class Shape { area() { return 1 } }
// ---- marker a
const MID = 1
// ---- marker b
`

describe('cut-source', () => {
  it('cuts a literal and ignores brackets inside strings, templates, regular expressions and comments', () => {
    expect(extractLiteral<unknown[]>(SOURCE, 'A')).toEqual([1, 2, { s: ']}', t: '[' }, 'x}'])
    expect(extractLiteral<{ rows: unknown[]; note: string }>(SOURCE, 'TABLE')).toEqual({ rows: ['[\\]}]', 3], note: 'ok' })
    expect(cutLiteral(SOURCE, 'A').endsWith(']')).toBe(true)
  })

  it('matches the exact name, at the start of a line', () => {
    expect(() => cutLiteral(SOURCE, 'MISSING')).toThrow(/not found/)
    expect(cutLiteral("const NOT_A = [5];", "NOT_A")).toBe("[5]")
  })

  it('skips lines that only mention the name and takes the first one that declares it', () => {
    const source = 'const other = A_NAME + 1; // A_NAME\n  // let A_NAME = 0\n  let A_NAME = [1];\nfunction A_NAME_2() {}\nconst A_NAME = [2];'
    expect(cutLiteral(source, 'A_NAME')).toBe('[1]')
    expect(cutFunction('x = function f() {}\nfunction f() { return 1 }', 'f')).toBe('function f() { return 1 }')
  })

  it('cuts a whole declaration that is not one group, and a function by name', () => {
    const { BUILD } = evaluateSlice<{ BUILD: (n: number) => number }>(cutDeclaration(SOURCE, 'BUILD'), ['BUILD'])
    expect(BUILD(4)).toBe(12)
    const { twice } = evaluateSlice<{ twice: (n: number) => number }>(cutFunction(SOURCE, 'twice'), ['twice'])
    expect(twice(21)).toBe(42)
    expect(cutFunction(SOURCE, 'later').startsWith('async function later')).toBe(true)
    expect(cutFunction(SOURCE, 'Shape').startsWith('class Shape')).toBe(true)
  })

  it('cuts between markers and by lines', () => {
    expect(cutBetween(SOURCE, '// ---- marker a', '// ---- marker b').trim()).toBe('// ---- marker a\nconst MID = 1')
    expect(() => cutBetween(SOURCE, '// ---- marker a', 'nope')).toThrow(/end marker/)
    expect(cutLines('a\nb\nc\nd', 2, 3)).toBe('b\nc')
  })

  it('gives every run of the same slice a fresh state, and the scope reaches it as globals', () => {
    const code = 'let count = 0; const next = () => ++count * FACTOR'
    const first = evaluateSlice<{ next: () => number }>(code, ['next'], { FACTOR: 2 })
    expect([first.next(), first.next()]).toEqual([2, 4])
    const second = evaluateSlice<{ next: () => number }>(code, ['next'], { FACTOR: 3 })
    expect(second.next()).toBe(3)
  })

  it('evaluates a slice with the given scope as its only globals', () => {
    const { total } = evaluateSlice<{ total: number }>('const total = LIST.reduce((a, b) => a + b, 0)', ['total'], { LIST: [1, 2, 3] })
    expect(total).toBe(6)
    expect(() => evaluateSlice('const total = process.pid', ['total'])).toThrow()
  })
})
