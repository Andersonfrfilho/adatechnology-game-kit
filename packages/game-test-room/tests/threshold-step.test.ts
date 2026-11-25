import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { createPlayer } from '../src/player'
import type { Player } from '../src/player'

const FRAME = 1 / 60
const SILL_HEIGHT = 0.045
const SILL_AT_X = 1

/** A body that walks along +x over a sill (a door threshold, a slab edge) that is stepped onto at once. */
const walkOverSill = (kind: 'footing' | 'ground'): { player: Player; eyeHeights: number[]; feetHeights: number[]; drawnFeetHeights: number[] } => {
  const camera = new THREE.PerspectiveCamera()
  const dom = document.createElement('div')
  const player = createPlayer(THREE, {
    camera,
    dom,
    colliders: [],
    limit: 50,
    start: [0, 0, 0],
    hooks: { primaryDown: () => undefined, primaryUp: () => undefined, secondary: () => undefined, key: () => undefined, wheel: () => undefined },
    ...(kind === 'footing'
      ? { footing: (x: number, _z: number, radius: number) => ({ floor: x + radius > SILL_AT_X ? SILL_HEIGHT : -Infinity, blocked: false }) }
      : { floorAt: (x: number) => (x > SILL_AT_X ? SILL_HEIGHT : 0) }),
  })
  player.look([0, 1.7, 0], [10, 1.7, 0])
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
  const eyeHeights: number[] = []
  const feetHeights: number[] = []
  const drawnFeetHeights: number[] = []
  for (let i = 0; i < 120; i++) {
    player.update(FRAME)
    eyeHeights.push(camera.position.y)
    feetHeights.push(player.feet)
    drawnFeetHeights.push(player.drawnFeet)
  }
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))
  player.dispose()
  return { player, eyeHeights, feetHeights, drawnFeetHeights }
}

describe.each(['footing', 'ground'] as const)('walking over a threshold that is a %s', (kind) => {
  it('the eye rises over several frames, never in one pop, and ends on the sill', () => {
    const { eyeHeights, feetHeights, drawnFeetHeights } = walkOverSill(kind)
    const rises = eyeHeights.slice(1).map((height, i) => height - eyeHeights[i]!)
    expect(Math.min(...rises)).toBeGreaterThanOrEqual(-1e-9)
    expect(Math.max(...rises)).toBeLessThan(SILL_HEIGHT / 2)
    expect(eyeHeights[eyeHeights.length - 1]).toBeCloseTo(1.7 + SILL_HEIGHT, 3)
    // the body is drawn climbing it too (the avatar's root and the third-person camera stand on the drawn feet)
    const drawnRises = drawnFeetHeights.slice(1).map((height, i) => height - drawnFeetHeights[i]!)
    expect(Math.max(...drawnRises)).toBeLessThan(SILL_HEIGHT / 2)
    expect(drawnFeetHeights[drawnFeetHeights.length - 1]).toBeCloseTo(SILL_HEIGHT, 3)
    // the feet are on the sill at once: shots, sounds and what the room reads stay exact
    expect(feetHeights[feetHeights.length - 1]).toBeCloseTo(SILL_HEIGHT, 6)
  })
})
