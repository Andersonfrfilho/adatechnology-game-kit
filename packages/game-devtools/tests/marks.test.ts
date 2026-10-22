import { describe, expect, it } from 'vitest'
import { compass, escapeHtml, formatMarkLine, locales, serializeMarks, sortMarks, type Mark, type Team } from '../src'

const teams: Team[] = [
  ['map', 'Map'],
  ['art', 'Art'],
]

const mark = (over: Partial<Mark> = {}): Mark => ({
  id: 'm1',
  x: 10.5,
  y: 2,
  z: -4.2,
  yaw: 0.5,
  pitch: -0.1,
  area: 'Plaza',
  heading: 'NW',
  degrees: 331,
  look: 6,
  time: '12:00',
  flying: false,
  team: 'map',
  text: 'tree is floating',
  at: 1000,
  ...over,
})

describe('compass', () => {
  it('yaw 0 looks north and headings run clockwise', () => {
    const en = locales.en.compass
    expect(compass(0, en)).toEqual(['N', 0])
    expect(compass(-Math.PI / 2, en)).toEqual(['E', 90])
    expect(compass(Math.PI, en)).toEqual(['S', 180])
    expect(compass(Math.PI / 2, en)).toEqual(['W', 270])
    expect(compass(Math.PI / 4, en)).toEqual(['NW', 315])
  })
  it('uses the pt-BR headings', () => {
    expect(compass(-Math.PI / 2, locales['pt-BR'].compass)[0]).toBe('L')
    expect(compass(Math.PI / 2, locales['pt-BR'].compass)[0]).toBe('O')
    expect(compass(Math.PI / 4, locales['pt-BR'].compass)[0]).toBe('NO')
  })
})

describe('mark serialization', () => {
  it('formats one line in English', () => {
    expect(formatMarkLine(mark(), teams, locales.en)).toBe('[Map] Plaza · x 10.5 y 2 z -4.2 · looking NW 331° · 12:00 · tree is floating')
  })
  it('formats one line in pt-BR exactly like the original SDK', () => {
    expect(formatMarkLine(mark({ team: 'art', text: 'árvore flutuando' }), teams, locales['pt-BR'])).toBe(
      '[Art] Plaza · x 10.5 y 2 z -4.2 · olhando NW 331° · 12:00 · árvore flutuando',
    )
  })
  it('omits the note separator when there is no text and falls back to the raw team id', () => {
    expect(formatMarkLine(mark({ text: '', team: 'unknown' }), teams, locales.en)).toBe('[unknown] Plaza · x 10.5 y 2 z -4.2 · looking NW 331° · 12:00')
  })
  it('sorts newest first without mutating the input', () => {
    const input = [mark({ id: 'a', at: 1 }), mark({ id: 'c', at: 3 }), mark({ id: 'b', at: 2 })]
    expect(sortMarks(input).map((m) => m.id)).toEqual(['c', 'b', 'a'])
    expect(input.map((m) => m.id)).toEqual(['a', 'c', 'b'])
  })
  it('serializes text (newest first) and a file with the raw JSON appended', () => {
    const a = mark({ id: 'a', at: 1, text: 'first' })
    const b = mark({ id: 'b', at: 2, text: 'second' })
    const { text, file } = serializeMarks([a, b], teams, locales.en)
    const lines = text.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('second')
    expect(lines[1]).toContain('first')
    expect(file.startsWith(text + '\n\n')).toBe(true)
    // the JSON tail round-trips to the original array (in the original order)
    expect(JSON.parse(file.slice(text.length + 2))).toEqual([a, b])
  })
  it('serializes an empty list', () => {
    expect(serializeMarks([], teams, locales.en)).toEqual({ text: '', file: '\n\n[]' })
  })
  it('escapes HTML', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;')
    expect(escapeHtml(null)).toBe('')
  })
})
