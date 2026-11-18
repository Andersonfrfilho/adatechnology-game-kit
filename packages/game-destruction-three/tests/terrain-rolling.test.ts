import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { TERRAIN_MATERIALS } from '@adatechnology/game-terrain'

import { createDestructionRenderer } from '../src/renderer'
import type { PieceBody } from '../src/internal'
import type { DestructionRenderer } from '../src/types'
import { FakeWorld, mat, partState } from './fake-world'
import { IS_JOLT, physicsOption } from './setup-physics'

const G = 9.81
/** Solid aluminium rods lying across their way: they roll with k = 1/2 (I = m r^2 / 2), and their own rolling resistance (metal, 0.002) is under every ground's. */
const K = 0.5
const FRAME = 1 / 60

const rollingOf = (id: string): number => {
  const rolling = TERRAIN_MATERIALS.find((m) => m.id === id)?.rolling
  if (rolling === undefined) throw new Error(`no rolling resistance for ${id}`)
  return rolling
}

interface RodThrow {
  readonly ground: string | ((x: number, z: number) => number | undefined)
  readonly radius: number
  readonly speed: number
  readonly seconds: number
  /** Roll along +z, its axis along x, its middle at `centreX` and `length` long (default: along +x, 1 m, at 0). */
  readonly alongZ?: boolean
  readonly centreX?: number
  readonly length?: number
  /** A top this high (m) over all the terrain, in `groundAt` (the kit's solver), the terrain staying at 0 (`terrainAt`). */
  readonly top?: number
  /** Called each frame with the time and the renderer. */
  readonly each?: (t: number, renderer: DestructionRenderer) => void
}

/** A rod thrown at `speed` m/s on flat ground: where it starts rolling without slipping (distance along its way and speed), and where it stops. */
const throwRod = (o: RodThrow) => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  world.materials.set('aluminium', mat('aluminium', { density: 2700, tags: ['metal'], fracture: 'none' }))
  const ground = o.ground
  const rollingAt = typeof ground === 'string' ? () => rollingOf(ground) : ground
  const top = o.top ?? 0
  const renderer = createDestructionRenderer(THREE, {
    physics: physicsOption(),
    scene,
    world: world.asWorld(),
    terrainRollingAt: rollingAt,
    ...(o.top === undefined ? {} : { groundAt: () => top, terrainAt: () => 0 }),
  })
  const length = o.length ?? 1
  world.addObject('rod', [partState('body', 'aluminium', { mass: Math.PI * o.radius * o.radius * length * 2700 })])
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(o.radius, o.radius, length, 24))
  if (o.alongZ) mesh.rotation.z = Math.PI / 2
  else mesh.rotation.x = Math.PI / 2
  const root = new THREE.Group()
  root.add(mesh)
  root.position.set(o.centreX ?? 0, top + o.radius + 0.001, 0)
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind('rod', root, { parts: { body: mesh } })
  const piece = renderer.makePiece('rod', { velocity: o.alongZ ? [0, 0, o.speed] : [o.speed, 0, 0], inertia: K }) as PieceBody
  const along = (): number => (o.alongZ ? root.position.z : root.position.x)
  let rollFrom: { x: number; speed: number } | null = null
  let stopAt: number | null = null
  let speed = o.speed
  for (let t = 0; t < o.seconds - 1e-9; t += FRAME) {
    o.each?.(t, renderer)
    renderer.update(FRAME)
    speed = Math.hypot(piece.velocity[0], piece.velocity[2])
    const spin = Math.hypot(...piece.angularVelocity) * o.radius
    if (!rollFrom && speed > 0.5 && Math.abs(speed - spin) < 0.02 * speed) rollFrom = { x: along(), speed }
    if (rollFrom && stopAt === null && speed < 0.02) stopAt = along()
  }
  return { rollFrom, stopAt, x: along(), speed, centreX: root.position.x }
}

/** What a test reads of an engine tile: its bodies' surface, and the mark of a change not laid yet (a tile no piece came near since stays marked, its surface read when one does). */
interface EngineTile {
  readonly material: { readonly rolling?: number }
  readonly dirty: object | null
}

/** The engine's ground tiles behind a renderer (Jolt only), for what their bodies carry. */
const tilesOf = (renderer: unknown): ReadonlyMap<number, EngineTile> => (renderer as { pieceSys: { engine: { tiles: ReadonlyMap<number, EngineTile> } } }).pieceSys.engine.tiles

/** How fast (m/s2) a rod slowed from where it rolled to where it stopped: v^2 / (2 d). */
const slowingOf = (rod: ReturnType<typeof throwRod>): number => {
  expect(rod.rollFrom).not.toBeNull()
  expect(rod.stopAt).not.toBeNull()
  return (rod.rollFrom!.speed * rod.rollFrom!.speed) / (2 * (rod.stopAt! - rod.rollFrom!.x))
}

/** How far a solid rod rolling at `speed` goes on a surface of rolling resistance `c`: it slows at C_rr g / (1 + k), so v^2 (1 + k) / (2 C_rr g). */
const rollOut = (speed: number, c: number): number => (speed * speed * (1 + K)) / (2 * c * G)

describe('a round piece rolls by the ground it is on (TerrainMaterial.rolling)', () => {
  // a 10 cm pipe thrown at 3 m/s slides until its spin catches up (2 m/s, 3 / (1 + k)), then rolls out slowing at C_rr g / (1 + k): 0.52 m/s2 on soil (3.8 m), 0.10 on
  // asphalt (20 m). Under Jolt it slows by about 0.11 m/s2 more on both grounds alike (measured: 0.64 and 0.20), a loss of the engine's contact, not of the ground.
  it("a pipe rolling at 2 m/s slows on soil and on asphalt by each one's rolling resistance; the difference is the grounds' alone", () => {
    const slowing = (ground: string): number => slowingOf(throwRod({ ground, radius: 0.05, speed: 3, seconds: 30 }))
    const expected = (ground: string): number => (rollingOf(ground) * G) / (1 + K)
    const soil = slowing('soil')
    const asphalt = slowing('asphalt')
    expect(rollingOf('asphalt')).toBe(0.015)
    expect(soil).toBeGreaterThan(expected('soil') * 0.85)
    expect(soil).toBeLessThan(expected('soil') * (IS_JOLT ? 1.3 : 1.15))
    expect(soil - asphalt).toBeGreaterThan((expected('soil') - expected('asphalt')) * 0.9)
    expect(soil - asphalt).toBeLessThan((expected('soil') - expected('asphalt')) * 1.1)
  })

  // the case from the room: a thin rod thrown at 15 m/s. It slides and hops for 18 m, rolls from about 7 m/s and rolls out over 7^2 x 1.5 / (2 x 0.08 x 9.81) = 47 m on
  // soil: it stops 63 m from the throw (measured), 24 m in sand, and 309 m on asphalt (the old 0.015, which every ground had). Kit solver only: Jolt caps a body's spin at
  // 47 rad/s (its default `mMaxAngularVelocity`, 0.25 pi per step at 60 Hz), so a 1.5 cm rod cannot roll faster than 0.7 m/s there and slides instead (the case above stays under it).
  it.skipIf(IS_JOLT)('a 3 cm rod thrown at 15 m/s rolls out on soil within 10 % of its rolling resistance, in sand in a quarter of that, and on asphalt is still rolling', () => {
    const soil = throwRod({ ground: 'soil', radius: 0.015, speed: 15, seconds: 25 })
    expect(soil.stopAt).not.toBeNull()
    const run = soil.stopAt! - soil.rollFrom!.x
    const expected = rollOut(soil.rollFrom!.speed, rollingOf('soil'))
    expect(run).toBeGreaterThan(expected * 0.9)
    expect(run).toBeLessThan(expected * 1.1)
    const sand = throwRod({ ground: 'sand', radius: 0.015, speed: 15, seconds: 10 })
    expect(sand.stopAt).not.toBeNull()
    expect(sand.stopAt! - sand.rollFrom!.x).toBeLessThan(rollOut(sand.rollFrom!.speed, rollingOf('sand')) * 1.1)
    const asphalt = throwRod({ ground: 'asphalt', radius: 0.015, speed: 15, seconds: 25 })
    expect(asphalt.stopAt).toBeNull()
    expect(asphalt.x).toBeGreaterThan(soil.stopAt! * 1.5)
  })

  // sand for x under 1 m, asphalt past it: the tile from 0 to 2 m has its middle at 1 m, so it is all asphalt, though the rod's points (x 0.2 to 0.8) are over the sand
  it('a tile across two grounds is the one at its middle, in both solvers: a pipe rolling along the sand side of such a tile slows as on asphalt', () => {
    const split = (x: number): number => (x < 1 ? rollingOf('sand') : rollingOf('asphalt'))
    const onSplit = slowingOf(throwRod({ ground: split, radius: 0.05, speed: 3, seconds: 30, alongZ: true, centreX: 0.5, length: 0.6 }))
    const onAsphalt = slowingOf(throwRod({ ground: 'asphalt', radius: 0.05, speed: 3, seconds: 30, alongZ: true, centreX: 0.5, length: 0.6 }))
    expect(Math.abs(onSplit - onAsphalt)).toBeLessThan(onAsphalt * 0.05)
    expect(onSplit).toBeLessThan((rollingOf('sand') * G) / (1 + K) / 3)
  })

  // the engine draws every top (a table, a counter) as a body of its own with its own surface; the kit's solver has it in `groundAt`, over the terrain (`terrainAt`)
  it.skipIf(IS_JOLT)('a pipe rolling on a top over sand keeps the default surface (0.015), not the sand under the top', () => {
    const onTop = slowingOf(throwRod({ ground: 'sand', radius: 0.05, speed: 3, seconds: 30, top: 0.5 }))
    const onAsphalt = slowingOf(throwRod({ ground: 'asphalt', radius: 0.05, speed: 3, seconds: 30 }))
    expect(Math.abs(onTop - onAsphalt)).toBeLessThan(onAsphalt * 0.05)
  })

  // the host marks the ground changed (`wakeRegion`) where only its surface changed: the heights are the same, the tile is not laid again, but its bodies take the new surface
  it('a surface that turns from asphalt to sand under a rolling pipe, marked by the host, slows it as sand from then on, in both solvers', () => {
    const surface = { rolling: rollingOf('asphalt') }
    // under Jolt, what the tiles laid again carry an update after it (read off the engine: the rod soon rolls onto tiles laid after it, which would hide a miss)
    let laid: number[] = []
    const rod = throwRod({
      ground: () => surface.rolling,
      radius: 0.05,
      speed: 3,
      seconds: 6,
      each: (t, renderer) => {
        if (IS_JOLT && Math.abs(t - 1 - FRAME) < FRAME / 2) laid = [...tilesOf(renderer).values()].filter((tile) => tile.dirty === null).map((tile) => tile.material.rolling ?? Number.NaN)
        if (Math.abs(t - 1) > FRAME / 2) return
        surface.rolling = rollingOf('sand')
        renderer.wakeRegion(0, 0, 50)
      },
    })
    // on asphalt the roll from about 2 m/s goes 16 to 20 m and takes 20 s; on sand from 1 s on it stops within a metre or two of where it was
    expect(rod.stopAt).not.toBeNull()
    expect(rod.stopAt!).toBeLessThan(5)
    if (IS_JOLT) {
      expect(laid.length).toBeGreaterThan(0)
      for (const rolling of laid) expect(rolling).toBe(rollingOf('sand'))
    }
  })
})

