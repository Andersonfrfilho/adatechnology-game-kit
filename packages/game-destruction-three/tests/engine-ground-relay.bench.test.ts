import * as THREE from 'three'
import { describe, it } from 'vitest'

import { PieceSystem } from '../src/pieces'
import { IS_JOLT, physicsOption } from './setup-physics'

/**
 * T3.8q: what laying the ground again costs after the host dug it, tile by tile, in the engine's own path (`groundChanged` marks, `layTile` lays). Off unless
 * GROUND_BENCH=1 (it prints and times: no gate): `GROUND_BENCH=1 PIECE_SOLVER=jolt vitest run tests/engine-ground-relay.bench.test.ts`.
 */
interface Engine {
  layTile(key: number, ix: number, iz: number, tile: unknown): void
  groundChanged(x: number, z: number, radius: number): void
  tiles: Map<number, unknown>
}

const KEY = 65536
const ORIGIN = 32768
const COLUMNS = 10
const ROWS = 9
const TILES = COLUMNS * ROWS
const ROUNDS = 9

const crater = (cx: number, cz: number, radius: number, depth: number, x: number, z: number): number => {
  const d = Math.hypot(x - cx, z - cz)
  return d >= radius ? 0 : -depth * Math.cos((Math.PI / 2) * (d / radius)) ** 2
}

const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!

/** Each tile has a 30 cm deep crater in its middle (so it is a height field with room to go) and a second, on its rim, whose depth is `depth`. */
const makeGround = (level: boolean) => {
  const state = { depth: 0.1 }
  const at = (x: number, z: number): number => {
    if (level) return 0
    const cx = Math.floor(x / 2) * 2 + 1
    const cz = Math.floor(z / 2) * 2 + 1
    return 0.01 * Math.sin(2 * x) * Math.sin(2 * z) + crater(cx, cz, 0.6, 0.3, x, z) + crater(cx + 0.9, cz, 0.3, state.depth, x, z)
  }
  return { state, at }
}

describe.skipIf(!IS_JOLT || process.env.GROUND_BENCH !== '1')('laying the ground again after the host dug it (bench)', () => {
  for (const level of [false, true]) {
    it(`${level ? 'level (slab)' : 'height field + solid'} tiles, ${TILES} of them`, () => {
      const ground = makeGround(level)
      const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: ground.at, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene() })
      const engine = (system as unknown as { engine: Engine }).engine
      let told = 0
      // the tiles the host told about are laid again, as `layAround` does when a piece is over them; the first lay makes them all
      const lay = (): number => {
        told = 0
        const started = performance.now()
        for (let ix = 0; ix < COLUMNS; ix++) {
          for (let iz = 0; iz < ROWS; iz++) {
            const key = (ix + ORIGIN) * KEY + (iz + ORIGIN)
            const tile = engine.tiles.get(key) as { dirty: unknown } | undefined
            if (tile && !tile.dirty) continue
            told++
            engine.layTile(key, ix, iz, tile)
          }
        }
        return performance.now() - started
      }
      lay()
      const out: string[] = []
      const run = (name: string, tell: () => void, change: (round: number) => void): void => {
        const times: number[] = []
        const counts: number[] = []
        for (let round = 0; round < ROUNDS; round++) {
          change(round)
          tell()
          times.push(lay())
          counts.push(told)
        }
        out.push(`${name}: median ${median(times).toFixed(2)} ms for ${median(counts)} tiles told (${(median(times) / median(counts)).toFixed(3)} ms a tile), worst ${Math.max(...times).toFixed(2)} ms`)
      }
      const everyTile = (radius: number): void => {
        for (let ix = 0; ix < COLUMNS; ix++) for (let iz = 0; iz < ROWS; iz++) engine.groundChanged(ix * 2 + 1.9, iz * 2 + 1, radius)
      }
      // one dig: the second crater of one tile changes (a few tiles told at most)
      run('one 30 cm dig, one tile', () => engine.groundChanged(5 * 2 + 1.9, 4 * 2 + 1, 0.3), (r) => { ground.state.depth = 0.05 + 0.05 * (r % 5) })
      // the burst of the room: every one of the tiles told by its own small event, the ground changes in all of them
      run(`burst, ${TILES} tiles each told by a 30 cm event, ground changed in each`, () => everyTile(0.3), (r) => { ground.state.depth = 0.05 + 0.05 * (r % 5) })
      // the same burst when nothing changed (events that settle nothing the engine sees)
      run(`burst, ${TILES} tiles each told by a 30 cm event, nothing changed`, () => everyTile(0.3), () => undefined)
      // a wide disc over everything: whole tiles are read
      run(`one wide disc over ${TILES} tiles, nothing changed`, () => engine.groundChanged(COLUMNS, ROWS, 40), () => undefined)
      console.log(`[bench ${level ? 'level' : 'height field'}]\n  ${out.join('\n  ')}`)
    })
  }
})
