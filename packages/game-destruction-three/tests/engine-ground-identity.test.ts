import { describe, expect, it } from 'vitest'

import { createTerrain } from '@adatechnology/game-terrain'

import { GROUND_CELL, buildGroundTile, readGround, shapeGround } from '../src/engine-ground'
import type { GroundTile } from '../src/engine-ground'
import { buildSolidVolume } from '../src/engine-ground-solid'
import type { SolidVolume } from '../src/engine-ground-solid'

/**
 * Spec 008 B6: the tile the engine stands the pieces on is a pure function of the ground, and making it cheaper must not move a bit of it. Each case below is fingerprinted
 * (every height, collision height, step box and solid block, and the ring read past the edges, as the bits of their doubles); the fingerprints were taken before the tile was
 * made cheaper, so a change that is only faster leaves them as they are.
 */

/** FNV-1a over the bits of the numbers, as doubles. */
const fingerprint = (...lists: ReadonlyArray<ArrayLike<number>>): string => {
  let hash = 0x811c9dc5
  const cell = new Float64Array(1)
  const bytes = new Uint8Array(cell.buffer)
  for (const list of lists) {
    cell[0] = list.length
    for (const b of bytes) hash = Math.imul(hash ^ b, 0x01000193)
    for (let i = 0; i < list.length; i++) {
      cell[0] = list[i]!
      for (const b of bytes) hash = Math.imul(hash ^ b, 0x01000193)
    }
  }
  return (hash >>> 0).toString(16)
}

const tilePrint = (t: GroundTile): string => fingerprint(t.heights, t.collision, [t.cells, t.collisionCells, t.level ?? NaN], t.boxes, t.solid.boxes, t.solid.ring)
const solidPrint = (s: SolidVolume): string => fingerprint(s.boxes, s.ring)

type Ground = (x: number, z: number) => number

/** The grounds: a blast crater in soil and its rim, a dug hole, a terraced slope (step boxes), a smooth bowl (the coarse field), a tilted plane, across the terrain's edge. */
const grounds = (): ReadonlyArray<{ name: string; groundAt: Ground; tiles: ReadonlyArray<readonly [number, number]> }> => {
  const terrain = createTerrain({ bounds: [-6, -6, 6, 6], cellSize: 0.1, layout: { surface: 'dirt' }, baseHeight: (x, z) => 0.04 * Math.sin(2 * x + z) })
  terrain.strike('explosive', { x: 0.37, z: -0.21, energy: 4e6 })
  for (let k = 0; k < 4; k++) terrain.dig({ x: -2.43, z: 1.2, depth: 0.2 })
  const crater: Ground = (x, z) => terrain.heightAt(x, z)
  const terraces: Ground = (x, z) => 0.15 * Math.floor((x + 0.3 * z) / 0.37)
  const bowl: Ground = (x, z) => -0.4 * Math.max(0, 1 - Math.hypot(x - 1.1, z - 0.9) / 1.6) ** 2
  const tilted: Ground = (x, z) => 0.21 * x - 0.13 * z
  return [
    { name: 'crater', groundAt: crater, tiles: [[0, -2], [-2, -2], [0, 0], [-2, 0], [-4, 0], [4, -2], [6, -2]] },
    { name: 'terraces', groundAt: terraces, tiles: [[0, 0], [2, -2]] },
    { name: 'bowl', groundAt: bowl, tiles: [[0, 0], [2, 0]] },
    { name: 'tilted', groundAt: tilted, tiles: [[0, 0]] },
  ]
}

describe('engine ground: the same tile, to the bit', () => {
  it('a new tile with its solid', () => {
    const seen: Record<string, string> = {}
    for (const { name, groundAt, tiles } of grounds()) for (const [x0, z0] of tiles) seen[`${name} ${x0},${z0}`] = tilePrint(buildGroundTile(groundAt, x0, z0, 2, true))
    if (process.env.PRINT_GROUND) console.log('[NEW]', JSON.stringify(seen))
    expect(seen).toEqual(EXPECTED_NEW)
  })

  it('a tile read again where the ground changed, from the coarse field or the read grid, and its solid made apart', () => {
    const seen: Record<string, string> = {}
    for (const { name, groundAt, tiles } of grounds()) {
      for (const [x0, z0] of tiles) {
        const n = Math.round(2 / GROUND_CELL)
        const held = new Float64Array((n + 1) * (n + 1) + n * n + 2 * n * (n + 1))
        const moved: Ground = (x, z) => groundAt(x, z) - (Math.hypot(x - x0 - 1.3, z - z0 - 0.7) < 0.45 ? 0.06 : 0)
        readGround(groundAt, held, x0, z0, 2)
        readGround(moved, held, x0, z0, 2, { minX: x0 + 0.8, maxX: x0 + 1.8, minZ: z0 + 0.2, maxZ: z0 + 1.2 })
        for (const wasCoarse of [false, true]) {
          const t = shapeGround(held, x0, z0, 2, null, wasCoarse)
          const solid = t.level === null ? buildSolidVolume(t.heights, t.cells, x0, z0, 2 / t.cells, moved, t.cells / t.collisionCells) : null
          seen[`${name} ${x0},${z0} ${wasCoarse ? 'coarse' : 'fine'}`] = `${tilePrint(t)} ${solid ? solidPrint(solid) : '-'}`
        }
      }
    }
    if (process.env.PRINT_GROUND) console.log('[READ]', JSON.stringify(seen))
    expect(seen).toEqual(EXPECTED_READ)
  })
})

// taken from the tile as made before it was made cheaper (spec 008 B6, `PRINT_GROUND=1` prints them)
const EXPECTED_NEW: Record<string, string> = {
  'crater 0,-2': '76caa897',
  'crater -2,-2': 'd4c42e67',
  'crater 0,0': '68387d45',
  'crater -2,0': 'f3d37136',
  'crater -4,0': '15a5f6c0',
  'crater 4,-2': 'c2d0f0ca',
  'crater 6,-2': '8958b96d',
  'terraces 0,0': '18a26f91',
  'terraces 2,-2': '796419e2',
  'bowl 0,0': 'a3547f39',
  'bowl 2,0': '9df8a7dc',
  'tilted 0,0': 'd6e2c1fd',
}

const EXPECTED_READ: Record<string, string> = {
  'crater 0,-2 fine': '9898ec82 ee084bc2',
  'crater 0,-2 coarse': '9898ec82 ee084bc2',
  'crater -2,-2 fine': 'c3a04072 50fa0d98',
  'crater -2,-2 coarse': 'c3a04072 50fa0d98',
  'crater 0,0 fine': '14eb0a76 347d5f7c',
  'crater 0,0 coarse': '14eb0a76 347d5f7c',
  'crater -2,0 fine': 'b33f979b d1608a52',
  'crater -2,0 coarse': 'b33f979b d1608a52',
  'crater -4,0 fine': 'ed19e02c 2aed5480',
  'crater -4,0 coarse': 'ed19e02c 2aed5480',
  'crater 4,-2 fine': 'c6632463 fc2b0768',
  'crater 4,-2 coarse': 'c6632463 fc2b0768',
  'crater 6,-2 fine': 'ea792d48 8dc4d341',
  'crater 6,-2 coarse': 'ea792d48 8dc4d341',
  'terraces 0,0 fine': '95d2b7f2 e92b4a46',
  'terraces 0,0 coarse': '95d2b7f2 e92b4a46',
  'terraces 2,-2 fine': 'e65db948 e807725b',
  'terraces 2,-2 coarse': 'e65db948 e807725b',
  'bowl 0,0 fine': '8ca10ecc 69650af',
  'bowl 0,0 coarse': '8ca10ecc 69650af',
  'bowl 2,0 fine': 'cc2b1935 11ce5b74',
  'bowl 2,0 coarse': 'cc2b1935 11ce5b74',
  'tilted 0,0 fine': 'd873ba04 6e07af72',
  'tilted 0,0 coarse': 'd873ba04 6e07af72',
}
