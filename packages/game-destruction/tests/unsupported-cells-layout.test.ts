import { describe, expect, it } from 'vitest'

import { holeInBox, marksInBox, planeAxes, unitGrid, unsupportedCells } from '../src/breach'
import type { LocalHole, UnitCell } from '../src/breach'

type Vec3 = [number, number, number]

const random = (seed: number): (() => number) => {
  let state = seed
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/** The rows built from scratch at every call, as `unsupportedCells` did before it kept them for the grid. */
const unsupportedCellsFromScratch = (cells: readonly UnitCell[], thin: number, dims: Vec3, standing: (index: number) => boolean): number[] => {
  if (thin === 1) return []
  const [u, v] = planeAxes(thin)
  const bottom = -dims[v] / 2
  const rowOf = (y: number): number => Math.round((y - bottom) * 1e4)
  const rows = new Map<number, number[]>()
  for (let i = 0; i < cells.length; i++) {
    if (!standing(i)) continue
    const cell = cells[i]!
    const key = rowOf(cell.center[v] - cell.size[v] / 2)
    const row = rows.get(key)
    if (row) row.push(i)
    else rows.set(key, [i])
  }
  const held = new Set<number>()
  const queue: number[] = []
  for (const i of rows.get(0) ?? []) {
    held.add(i)
    queue.push(i)
  }
  const overlap = (a: UnitCell, b: UnitCell): number =>
    Math.min(a.center[u] + a.size[u] / 2, b.center[u] + b.size[u] / 2) - Math.max(a.center[u] - a.size[u] / 2, b.center[u] - b.size[u] / 2)
  const climb = (): void => {
    while (queue.length > 0) {
      const cell = cells[queue.pop()!]!
      for (const j of rows.get(rowOf(cell.center[v] + cell.size[v] / 2)) ?? []) {
        const other = cells[j]!
        if (held.has(j) || overlap(cell, other) <= Math.max(1e-4, 0.25 * Math.min(cell.size[u], other.size[u]))) continue
        held.add(j)
        queue.push(j)
      }
    }
  }
  for (const row of rows.values()) row.sort((a, b) => cells[a]!.center[u] - cells[b]!.center[u])
  const touching = (a: UnitCell, b: UnitCell): boolean => Math.abs(a.center[u] + a.size[u] / 2 - (b.center[u] - b.size[u] / 2)) <= 1e-3
  for (let wedged = true; wedged;) {
    climb()
    wedged = false
    for (const row of rows.values()) {
      for (let k = 1; k < row.length - 1; k++) {
        const i = row[k]!
        if (held.has(i) || !held.has(row[k - 1]!) || !held.has(row[k + 1]!)) continue
        if (!touching(cells[row[k - 1]!]!, cells[i]!) || !touching(cells[i]!, cells[row[k + 1]!]!)) continue
        held.add(i)
        queue.push(i)
        wedged = true
      }
    }
  }
  const loose: number[] = []
  for (const row of rows.values()) for (const i of row) if (!held.has(i)) loose.push(i)
  return loose
}

describe('unsupportedCells with the rows kept for the grid', () => {
  it('lists the same units in the same order as building the rows at every call, over many removals, for running and stack bond', () => {
    const next = random(11)
    for (const bond of ['running', 'stack'] as const) {
      for (const thin of [0, 2] as const) {
        const dims: Vec3 = thin === 2 ? [4, 2.5, 0.2] : [0.2, 2.5, 4]
        const cells = unitGrid(dims, thin, { size: [0.25, 0.1, 0.2], bond }, 600)
        for (let round = 0; round < 40; round++) {
          const gone = new Set<number>()
          for (let k = 0; k < 1 + Math.floor(next() * 40); k++) gone.add(Math.floor(next() * cells.length))
          const standing = (index: number): boolean => !gone.has(index)
          const expected = unsupportedCellsFromScratch(cells, thin, dims, standing)
          expect(unsupportedCells(cells, thin, dims, standing)).toEqual(expected)
          expect(unsupportedCells([...cells], thin, dims, standing)).toEqual(expected)
        }
      }
    }
  })

  it('measures again when the same grid comes with another height', () => {
    const cells = unitGrid([4, 2.5, 0.2], 2, { size: [0.25, 0.1, 0.2], bond: 'running' }, 600)
    const standing = (index: number): boolean => index % 7 !== 0
    unsupportedCells(cells, 2, [4, 2.5, 0.2], standing)
    expect(unsupportedCells(cells, 2, [4, 2.9, 0.2], standing)).toEqual(unsupportedCellsFromScratch(cells, 2, [4, 2.9, 0.2], standing))
  })
})

describe('holeInBox', () => {
  it('answers like marksInBox for one hole, inside, on the edge and outside', () => {
    const center: Vec3 = [1, 1, 0]
    const size: Vec3 = [0.2, 0.1, 0.2]
    const holes: LocalHole[] = [
      { point: [1, 1, 0], normal: [0, 0, 1], diameter: 0.01 },
      { point: [1.1, 1, 0], normal: [0, 0, 1], diameter: 0 },
      { point: [1.105, 1, 0], normal: [0, 0, 1], diameter: 0.01 },
      { point: [1.2, 1, 0], normal: [0, 0, 1], diameter: 0.01 },
      { point: [1, 1.2, 0], normal: [0, 0, 1], diameter: 0.05 },
    ]
    for (const hole of holes) expect(holeInBox(center, size, hole)).toBe(marksInBox(center, size, undefined, [hole]).length > 0)
  })
})
