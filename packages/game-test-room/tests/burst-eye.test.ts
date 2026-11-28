import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { createPlayer } from '../src/player'

const FRAME = 1 / 60
/** The body's eyes sit ahead of the player's middle and below its own eye height (the room's `placeEye` from `avatar.eye`). */
const BODY_EYE_OFFSET = new THREE.Vector3(0, -0.15, -0.18)
/** Seconds between the rounds of a 700 rpm rifle (the AK-12). */
const ROUND_SECONDS = 60 / 700
/** The farthest the view may stand from the body's eyes while the gun is placed against it (the gun pops by this much otherwise). */
const EYE_TOLERANCE = 1e-6

type BurstResult = { readonly worstDistance: number; readonly shots: number }

/**
 * A held trigger, in the order of the room's frame: the player steps, the body poses and the room puts the camera at its eyes (`stepAvatar`), the trigger
 * fires a round and kicks the view (`fireShots` -> `player.kick`), then the weapon module places the gun against the camera. Answers how far the view stood
 * from the body's eyes at that moment, the worst of the burst.
 */
const holdTrigger = (seconds: number): BurstResult => {
  const camera = new THREE.PerspectiveCamera()
  const dom = document.createElement('div')
  const bodyEye = new THREE.Vector3()
  const placeEye = (): void => {
    bodyEye.set(player.x, player.feet + 1.7, player.z).add(BODY_EYE_OFFSET)
    camera.position.copy(bodyEye)
    camera.updateMatrixWorld(true)
  }
  const player = createPlayer(THREE, {
    camera,
    dom,
    colliders: [],
    limit: 50,
    start: [0, 0, 5],
    hooks: { primaryDown: () => undefined, primaryUp: () => undefined, secondary: () => undefined, key: () => undefined, wheel: () => undefined },
    afterView: () => placeEye(),
  })
  let worstDistance = 0
  let shots = 0
  let untilRound = 0
  for (let time = 0; time < seconds; time += FRAME) {
    player.update(FRAME)
    placeEye()
    untilRound -= FRAME
    if (untilRound <= 0) {
      player.kick(0.73, 0.44)
      shots++
      untilRound += ROUND_SECONDS
    }
    worstDistance = Math.max(worstDistance, camera.position.distanceTo(bodyEye))
  }
  player.dispose()
  return { worstDistance, shots }
}

describe('a burst with the trigger held', () => {
  it('keeps the view at the body eyes on every frame, so the gun in the hands does not jump between rounds', () => {
    const burst = holdTrigger(2)
    expect(burst.shots).toBeGreaterThanOrEqual(20)
    expect(burst.worstDistance).toBeLessThan(EYE_TOLERANCE)
  })
})
