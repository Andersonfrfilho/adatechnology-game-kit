import { describe, it } from 'vitest'

import { createTerrain } from '@adatechnology/game-terrain'

import { GROUND_CELL, readGround, sampleCount } from '../src/engine-ground'
import type { GroundGrid } from '../src/engine-ground'
import { bandLength, readGroundBand } from '../src/engine-ground-job'

/**
 * What reading the ground of a blast's tiles costs on the main thread (`askTile` in `EnginePieces`), split: the terrain's `heightGrid` itself, the rest of `readGround` (the
 * lattice and the scatter into the four series) and of `readGroundBand`. A room-like terrain (flat, 10 cm cells, 28 m), one blast dug in it; the tiles asked are those the
 * terrain's bounds do not prove level (`flatAt`), every one read whole, as a fresh tile is, then again over the blast's rectangle, as a tile marked dirty is.
 * Off unless GROUND_BENCH=1 (it prints and times: no gate): `GROUND_BENCH=1 vitest run tests/engine-ground-read.bench.test.ts`.
 */
const TILE = 2
const ROUNDS = 15
const FLAT_SPAN = 1e-9
const SAMPLES = sampleCount(Math.round(TILE / GROUND_CELL))

const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!

describe.skipIf(process.env.GROUND_BENCH !== '1')('reading the ground of a blast\'s tiles (bench)', () => {
  it('room terrain, one blast', () => {
    const terrain = createTerrain({ bounds: [-14, -14, 14, 14], cellSize: 0.1, layout: { surface: 'dirt' } })
    const blow = terrain.strike('explosive', { x: 0.37, z: -0.21, energy: 4e7 })
    const groundAt = (x: number, z: number): number => terrain.heightAt(x, z)
    const tiles: [number, number][] = []
    for (let ix = -7; ix < 7; ix++) {
      for (let iz = -7; iz < 7; iz++) {
        const range = terrain.heightRange(ix * TILE, ix * TILE + TILE, iz * TILE, iz * TILE + TILE)
        if (!range || range.high - range.low > FLAT_SPAN) tiles.push([ix * TILE, iz * TILE])
      }
    }
    const split = { grid: 0, gridPoints: 0, read: 0, band: 0 }
    const timedGrid: GroundGrid = (xs, zs, out) => {
      const started = performance.now()
      terrain.heightGrid(xs, zs, out)
      split.grid += performance.now() - started
      split.gridPoints += xs.length * zs.length
    }
    const rect = { minX: 0.37 - 1.5, maxX: 0.37 + 1.5, minZ: -0.21 - 1.5, maxZ: -0.21 + 1.5 }
    const samples = tiles.map(() => new Float64Array(SAMPLES))
    const bands = tiles.map(() => new Float64Array(bandLength(TILE)))
    const rows: { whole: number; wholeGrid: number; band: number; bandGrid: number; dirty: number; points: number }[] = []
    for (let round = 0; round < ROUNDS; round++) {
      Object.assign(split, { grid: 0, gridPoints: 0 })
      let t = performance.now()
      tiles.forEach(([x0, z0], k) => readGround(groundAt, samples[k]!, x0, z0, TILE, undefined, timedGrid))
      const whole = performance.now() - t
      const wholeGrid = split.grid
      const points = split.gridPoints
      split.grid = 0
      t = performance.now()
      tiles.forEach(([x0, z0], k) => readGroundBand(groundAt, bands[k]!, x0, z0, TILE, timedGrid))
      const band = performance.now() - t
      const bandGrid = split.grid
      t = performance.now()
      tiles.forEach(([x0, z0], k) => readGround(groundAt, samples[k]!, x0, z0, TILE, rect, terrain.heightGrid))
      rows.push({ whole, wholeGrid, band, bandGrid, dirty: performance.now() - t, points })
    }
    const m = (k: keyof (typeof rows)[number]): string => median(rows.slice(1).map((r) => r[k])).toFixed(2)
    console.log(`blast of ${blow ? 'one strike' : 'nothing'}: ${tiles.length} tiles not level, ${rows[0]!.points} grid points read whole; median of ${ROUNDS - 1} warm rounds:`)
    console.log(`  readGround whole      ${m('whole')} ms (heightGrid ${m('wholeGrid')} ms)`)
    console.log(`  readGroundBand        ${m('band')} ms (heightGrid ${m('bandGrid')} ms)`)
    console.log(`  readGround dirty rect ${m('dirty')} ms`)
  }, 120_000)
})
