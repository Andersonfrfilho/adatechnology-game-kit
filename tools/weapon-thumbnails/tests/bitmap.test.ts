import { describe, expect, it } from 'vitest'

import { bitmapSilhouetteSvg, fillEnclosed } from '../src/bitmap'

const bitmapOf = (rows: string[]) => ({
  width: rows[0]?.length ?? 0,
  height: rows.length,
  tone: Uint8Array.from(rows.flatMap((row) => [...row].map((char) => (char === '#' ? 1 : char === '+' ? 2 : 0)))),
})

describe('fillEnclosed', () => {
  it('fills the inside of an outline with the light tone and leaves the outside empty', () => {
    const filled = fillEnclosed(bitmapOf(['.....', '.###.', '.#.#.', '.###.', '.....']))
    expect(filled[2 * 5 + 2]).toBe(2)
    expect(filled[0]).toBe(0)
  })

  it('does not fill an outline that is open', () => {
    const filled = fillEnclosed(bitmapOf(['.....', '.#.#.', '.#.#.', '.###.', '.....']))
    expect(filled[2 * 5 + 2]).toBe(0)
  })
})

describe('bitmapSilhouetteSvg', () => {
  const rows = ['........', '.######.', '.#++++#.', '.######.', '........']

  it('writes the 4:1 currentColor outline with the same bytes every time', () => {
    const svg = bitmapSilhouetteSvg(bitmapOf(rows))
    expect(svg).toContain('viewBox="0 0 800 200"')
    expect(svg).toContain('fill="currentColor"')
    expect(svg).toBe(bitmapSilhouetteSvg(bitmapOf(rows)))
  })

  it('keeps nothing of the picture but two paths', () => {
    expect((bitmapSilhouetteSvg(bitmapOf(rows)) ?? '').replace(/d="[^"]*"/g, '').replace(/<\/?(svg|path)\b[^>]*>/g, '').trim()).toBe('')
  })

  it('is undefined for an empty picture', () => {
    expect(bitmapSilhouetteSvg(bitmapOf(['...', '...']))).toBeUndefined()
  })
})
