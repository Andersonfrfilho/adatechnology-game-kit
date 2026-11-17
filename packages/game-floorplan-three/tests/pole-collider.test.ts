import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import type { Piece } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { THREE, houseOf, planOf } from './helpers/houses'
import { IS_JOLT, physicsOption } from './setup-physics'

const DT = 1 / 60
const C4 = { energy: 345600, radius: 18 }
/** The concrete poles of the lot weigh about 950 kg; the wiring held by one adds a little. */
const POLE_MASS = 900
/** A concrete pole is 7.5 m (`pole()` of the lot's electrical structure); its shaft is one box of nearly that length. */
const SHAFT = 7.4
/** A pole is down when its whole drawing is below half a standing pole: lying flat it reaches 1.6 m (the crossarm upright), standing it reaches 7.5 m. */
const LYING_HEIGHT = SHAFT / 2
const SLEEP_WITHIN = 3
const SIMULATED = 14
/** The C4 at its foot breaks the footing of the first pole; the poles 22 m away stand on theirs (set in the ground, not loose). */
const POLES_DOWN = 1

type Boxes = { readonly partBoxes?: ReadonlyArray<{ readonly half: readonly number[] }> }

/** The lot's blast: C4 at the foot of the first service pole, then what the poles do. */
function blastedLot() {
  const world = createDestruction({ seed: 1 })
  const scene = new THREE.Scene()
  const physics = physicsOption()
  const renderer = createDestructionRenderer(THREE, { physics, scene, world })
  const { house } = houseOf(planOf('casaA', 1), { destruction: world, destructionRenderer: renderer }, { quality: 'game' })
  scene.add(house.group)
  house.destruction.activate()
  const pole = house.structure.parts.find((part) => part.id.startsWith('pole:'))!
  for (let t = 0; t < 1; t += DT) {
    world.update(DT)
    renderer.update(DT)
  }
  world.explode([pole.aabb[0] + 1, 1, pole.aabb[1]], C4.energy, C4.radius)
  return { world, renderer, physics }
}

const polesOf = (pieces: readonly Piece[]): Piece[] => pieces.filter((piece) => piece.mass > POLE_MASS && piece.halfExtents[1] >= SHAFT / 2)
const isLying = (piece: Piece): boolean => new THREE.Box3().setFromObject(piece.root).max.y < LYING_HEIGHT

describe('a concrete pole of the lot, loose', () => {
  it('collides as its shaft, not as plates at its two ends', () => {
    const { world, renderer } = blastedLot()
    for (let t = 0; t < 2; t += DT) {
      world.update(DT)
      renderer.update(DT)
    }
    const poles = polesOf(renderer.pieces())
    expect(poles.length).toBeGreaterThanOrEqual(POLES_DOWN)
    for (const pole of poles) {
      const longest = Math.max(...((pole as unknown as Boxes).partBoxes ?? []).map((box) => Math.max(...box.half) * 2))
      expect(longest, `piece ${pole.objectId}`).toBeGreaterThanOrEqual(SHAFT)
    }
  })

  it.runIf(IS_JOLT)(`lying on the ground it sleeps within ${SLEEP_WITHIN} s, read from the engine`, () => {
    const { world, renderer, physics } = blastedLot()
    const lyingSince = new Map<string, number>()
    const asleepAfter = new Map<string, number>()
    for (let t = 0; t < SIMULATED; t += DT) {
      world.update(DT)
      renderer.update(DT)
      for (const pole of polesOf(renderer.pieces())) {
        if (!isLying(pole)) {
          lyingSince.delete(pole.objectId)
          continue
        }
        if (!lyingSince.has(pole.objectId)) lyingSince.set(pole.objectId, t)
        if (pole.sleeping && !asleepAfter.has(pole.objectId)) asleepAfter.set(pole.objectId, t - lyingSince.get(pole.objectId)!)
      }
    }
    const poles = polesOf(renderer.pieces())
    expect(lyingSince.size).toBeGreaterThanOrEqual(POLES_DOWN)
    for (const pole of poles) expect(pole.sleeping, `piece ${pole.objectId} asleep at the end`).toBe(true)
    for (const id of lyingSince.keys()) expect(asleepAfter.get(id) ?? Infinity, `piece ${id}`).toBeLessThanOrEqual(SLEEP_WITHIN)
    expect(physics !== 'own' && 'activeCount' in physics ? physics.activeCount : -1).toBe(0)
  })
})
