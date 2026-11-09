import type { DestructibleSpec } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { createDestruction } from '../src'

/** A window 1.5 x 1.2 m in the plane x-y: an aluminium frame 5 cm wide around the glass, a steel grille 7 cm in front with a bar every 12 cm. */
const windowSpec = (): DestructibleSpec => ({
  name: 'window',
  parts: [
    { id: 'frame', material: 'aluminium', shape: { kind: 'box', size: [1.5, 1.2, 0.17] }, position: [0, 1.5, 0], apertures: [{ size: [1.4, 1.1] }], anchored: true },
    { id: 'glass', material: 'glass', shape: { kind: 'box', size: [1.4, 1.1, 0.012] }, position: [0, 1.5, 0], anchored: true },
    { id: 'grille', material: 'steel', shape: { kind: 'box', size: [1.5, 1.26, 0.016] }, position: [0, 1.5, 0.155], apertures: [{ size: [1.5, 1.26], bars: { axis: 0, spacing: 0.125, width: 0.016 } }], anchored: true },
  ],
})

describe('aperture: a frame and a grille are open where they are drawn open', () => {
  for (const [name, position, rotation] of [['at the origin', [0, 0, 0], [0, 0, 0, 1]], ['moved and turned half round, as a house in the room', [10, 0, 8], [0, 1, 0, 0]]] as const) {
    it(`${name}: a shot between the bars reaches the glass, one on a bar hits the grille, one at the frame's rail hits the frame`, () => {
      const world = createDestruction({ seed: 1 })
      world.add(windowSpec(), { id: 'w', position: [...position], rotation: [...rotation] })
      // the world point of a local one: half a turn about y flips x and z
      const at = (x: number, y: number, z: number): [number, number, number] => (rotation[1] === 1 ? [position[0] - x, y, position[2] - z] : [x, y, z])
      const toward = (dz: number): [number, number, number] => (rotation[1] === 1 ? [0, 0, dz] : [0, 0, -dz])
      expect(world.raycast(at(0.0625, 1.5, 2), toward(1))?.part).toBe('glass')
      expect(world.raycast(at(0.125 - 0.75, 1.5, 2), toward(1))?.part).toBe('grille')
      expect(world.raycast(at(0.73, 1.5, 0.5), toward(1))?.part).toBe('frame')
    })
  }

  it('a wall with two window gaps: each gap is open, the brick between them is not', () => {
    const world = createDestruction({ seed: 1 })
    world.add({ parts: [{ id: 'wall', material: 'brick', shape: { kind: 'box', size: [6, 3, 0.15] }, position: [0, 1.5, 0], anchored: true, apertures: [{ size: [1.4, 1.15], offset: [-1.5, 0.08] }, { size: [1.4, 1.15], offset: [1.5, 0.08] }] }] }, { id: 'w', position: [3, 0, 2] })
    expect(world.raycast([1.5, 1.6, 5], [0, 0, -1])).toBeNull()
    expect(world.raycast([4.5, 1.6, 5], [0, 0, -1])).toBeNull()
    expect(world.raycast([3, 1.6, 5], [0, 0, -1])?.part).toBe('wall')
    expect(world.raycast([1.5, 0.5, 5], [0, 0, -1])?.part).toBe('wall')
  })

  it('a box without an aperture stays solid', () => {
    const world = createDestruction({ seed: 1 })
    const spec = windowSpec()
    world.add({ ...spec, parts: spec.parts.map(({ apertures: _apertures, ...part }) => part) }, { id: 'w' })
    expect(world.raycast([0.0625, 1.5, 2], [0, 0, -1])?.part).toBe('grille')
  })
})
