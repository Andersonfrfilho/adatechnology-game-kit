import { describe, expect, it } from 'vitest'

import type { House } from '../src'
import { TEMPLATES, houseOf, planOf } from './helpers/houses'
import { overlapOf, pieceBoxes } from './helpers/piece-boxes'

/** Overlap deeper than this (m) on all three axes at once is one piece inside another. */
const OVERLAP = 0.001

const CASES = Object.keys(TEMPLATES).flatMap((template) => [1, 2, 3].map((seed) => [template, seed] as const))

/** The window ids of a house: each has a frame, a pane and (with a grille) bars, three pieces the engine holds apart. */
const windowIds = (house: House): string[] => house.structure.parts.filter((part) => part.id.startsWith('window_frame:')).map((part) => part.id.slice('window_frame:'.length))

describe('the pieces of a window', () => {
  it.each(CASES)('%s, seed %i: the frame, the pane and the grille of a window do not overlap each other', (template, seed) => {
    const { house } = houseOf(planOf(template, seed))
    const overlaps: string[] = []
    const ids = windowIds(house)
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      const pieces = [`window_frame:${id}`, `window:${id}`, `window_grille:${id}`].map((piece) => ({ piece, boxes: pieceBoxes(house, piece) }))
      for (let a = 0; a < pieces.length; a++) {
        for (let b = a + 1; b < pieces.length; b++) {
          const deepest = Math.max(-1, ...pieces[a]!.boxes.flatMap((boxA) => pieces[b]!.boxes.map((boxB) => overlapOf(boxA, boxB))))
          if (deepest > OVERLAP) overlaps.push(`${pieces[a]!.piece} x ${pieces[b]!.piece}: ${deepest.toFixed(3)} m`)
        }
      }
    }
    expect(overlaps).toEqual([])
  })

  it('covers the windows of the yard outbuilding, with their grilles', () => {
    const { house } = houseOf(planOf('casaA', 1))
    expect(windowIds(house)).toContain('backyard.outbuilding.w0')
    expect(pieceBoxes(house, 'window_grille:backyard.outbuilding.w0').length).toBeGreaterThan(0)
  })
})
