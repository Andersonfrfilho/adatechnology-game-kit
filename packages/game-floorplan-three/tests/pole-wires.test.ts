import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import type { Piece } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { THREE, houseOf, planOf } from './helpers/houses'
import { physicsOption } from './setup-physics'

const DT = 1 / 60
const C4 = { energy: 345600, radius: 18 }
const SETTLED = 14
/** A wire lying where it fell rests on the ground, or on what fell there: never up in the air. */
const FLOATS_ABOVE = 1.5
const SUNK_BELOW = -0.05
/** The C4 at its foot breaks the footing of the first pole; the poles 22 m away stand on theirs (set in the ground, not loose). */
const POLES_DOWN = 1
/** A pole's shaft as drawn: 7.5 m above the ground and its buried 1.35 m, with a little to spare (a wire would add metres). */
const POLE_DRAWN = 7.5 + 1.35 + 0.1
/** The grid stretches that hung on the pole that came down: four wires each side of it. */
const STRETCHES_DOWN = 8

type Frame = { readonly partBoxes?: ReadonlyArray<{ readonly center: readonly number[]; readonly half: readonly number[]; readonly rotation?: readonly number[] }>; readonly localCenter: readonly number[] }

/** The lot's blast: C4 at the foot of the first service pole, then the world as it falls and settles. */
function blastedLot(seconds: number) {
  const world = createDestruction({ seed: 1 })
  const scene = new THREE.Scene()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world })
  const { house } = houseOf(planOf('single_storey_a', 1), { destruction: world, destructionRenderer: renderer }, { quality: 'game' })
  scene.add(house.group)
  house.destruction.activate()
  const pole = house.structure.parts.find((part) => part.id.startsWith('pole:'))!
  const wiringMass = (): number => world.ids().reduce((sum, id) => sum + (world.state(id)?.parts ?? []).filter((part) => part.id.startsWith('wiring:')).reduce((inner, part) => inner + part.mass, 0), 0)
  const before = wiringMass()
  for (let t = 0; t < 1; t += DT) {
    world.update(DT)
    renderer.update(DT)
  }
  world.explode([pole.aabb[0] + 1, 1, pole.aabb[1]], C4.energy, C4.radius)
  for (let t = 0; t < seconds; t += DT) {
    world.update(DT)
    renderer.update(DT)
  }
  return { world, renderer, wiringMassBefore: before, wiringMassAfter: wiringMass() }
}

const partsOf = (world: ReturnType<typeof createDestruction>, objectId: string): string[] => (world.state(objectId)?.parts ?? []).map((part) => part.id)
const objectsWith = (world: ReturnType<typeof createDestruction>, prefix: string): string[] => world.ids().filter((id) => partsOf(world, id).some((part) => part.startsWith(prefix)))
const lowestCorner = (piece: Piece): number => {
  const frame = piece as unknown as Frame
  if (!frame.partBoxes?.length) return new THREE.Box3().setFromObject(piece.root).min.y
  let lowest = Infinity
  for (const box of frame.partBoxes) {
    const centre = new THREE.Vector3(...(box.center as [number, number, number])).add(new THREE.Vector3(...(frame.localCenter as [number, number, number])))
    for (let corner = 0; corner < 8; corner++) {
      const local = new THREE.Vector3(...(box.half as [number, number, number])).multiply(new THREE.Vector3(corner & 1 ? 1 : -1, corner & 2 ? 1 : -1, corner & 4 ? 1 : -1))
      if (box.rotation) local.applyQuaternion(new THREE.Quaternion(...(box.rotation as [number, number, number, number])))
      const world = local.add(centre).applyQuaternion(piece.root.quaternion).add(piece.root.position)
      lowest = Math.min(lowest, world.y)
    }
  }
  return lowest
}

describe('the wires of a pole, when the pole is knocked down', () => {
  it('the pole piece keeps its shaft, crossarm and insulators: no wire is in its object, and it weighs the pole alone', () => {
    const { world, renderer } = blastedLot(2)
    const poleObjects = objectsWith(world, 'pole:').filter((id) => !partsOf(world, id).some((part) => part.startsWith('wall_')))
    expect(poleObjects.length).toBeGreaterThanOrEqual(POLES_DOWN)
    for (const id of poleObjects) {
      expect(partsOf(world, id).filter((part) => !part.startsWith('pole:')), `object ${id}`).toEqual([])
      const piece = renderer.pieces().find((candidate) => candidate.objectId === id)!
      const poleMass = world.state(id)!.parts.find((part) => part.id.startsWith('pole:'))!.mass
      expect(piece.mass, `object ${id}`).toBeCloseTo(poleMass, 1)
      const longest = Math.max(...((piece as unknown as Frame).partBoxes ?? []).map((box) => Math.max(...box.half) * 2))
      // its shaft, 7.5 m standing and 1.35 m buried (`postEmbedment`): no wire stretches it
      expect(longest, `object ${id}`).toBeLessThan(POLE_DRAWN)
    }
  })

  it('every wire stretch of the grid detaches as a piece of its own, none inside a pole or with another stretch', () => {
    const { world, renderer } = blastedLot(2)
    // the stretches on the standing poles stay with the house
    const grid = objectsWith(world, 'wiring:grid:').filter((id) => !partsOf(world, id).some((part) => part.startsWith('wall_')))
    expect(grid.length).toBeGreaterThanOrEqual(STRETCHES_DOWN)
    for (const id of grid) expect(partsOf(world, id).length, `object ${id}`).toBe(1)
    const pieces = new Set(renderer.pieces().map((piece) => piece.objectId))
    for (const id of grid) expect(pieces.has(id), `object ${id} is a piece`).toBe(true)
  })

  it('the copper of the wires is conserved: the blast loses none of it and the pole pieces carry none', () => {
    const { world, renderer, wiringMassBefore, wiringMassAfter } = blastedLot(2)
    expect(wiringMassBefore).toBeGreaterThan(200)
    expect(wiringMassAfter).toBeCloseTo(wiringMassBefore, 3)
    const wireMass = renderer.pieces().filter((piece) => partsOf(world, piece.objectId).every((part) => part.startsWith('wiring:'))).reduce((sum, piece) => sum + piece.mass, 0)
    expect(wireMass).toBeGreaterThan(0.5 * wiringMassBefore)
  })

  it(`the wires that came down lie on the ground or on what fell there after ${SETTLED} s: none floats, none sinks`, () => {
    const { world, renderer } = blastedLot(SETTLED)
    const wires = renderer.pieces().filter((piece) => partsOf(world, piece.objectId).length > 0 && partsOf(world, piece.objectId).every((part) => part.startsWith('wiring:')))
    expect(wires.length).toBeGreaterThanOrEqual(STRETCHES_DOWN)
    for (const piece of wires) {
      expect(piece.sleeping, `piece ${piece.objectId} asleep`).toBe(true)
      const low = lowestCorner(piece)
      expect(low, `piece ${piece.objectId} low corner`).toBeLessThan(FLOATS_ABOVE)
      expect(low, `piece ${piece.objectId} low corner`).toBeGreaterThan(SUNK_BELOW)
    }
  })
})
