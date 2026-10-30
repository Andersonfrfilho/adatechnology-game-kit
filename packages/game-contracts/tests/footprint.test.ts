import { describe, expect, it } from 'vitest'
import { footprintBlocker } from '../src'

// a world matrix (column-major, like three.js) turned by `yaw` about y and moved to (x, z)
const placed = (x: number, z: number, yaw: number) => {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return { parent: {}, matrixWorld: { elements: [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, x, 0, z, 1] } }
}

describe('footprintBlocker', () => {
  const car = { minX: -1, maxX: 1, minZ: -2.5, maxZ: 2.5 }

  it('blocks the rectangle in the object space, grown by the radius', () => {
    const blocked = footprintBlocker(placed(10, 0, 0), car)
    expect(blocked(10, 2.4, 0)).toBe(true)
    expect(blocked(10, 2.7, 0)).toBe(false)
    expect(blocked(10, 2.7, 0.3)).toBe(true)
    expect(blocked(11.5, 0, 0.3)).toBe(false)
  })

  it('turns with the object: a quarter turn lays the length along x', () => {
    const blocked = footprintBlocker(placed(0, 0, Math.PI / 2), car)
    expect(blocked(2.4, 0, 0)).toBe(true)
    expect(blocked(0, 2.4, 0)).toBe(false)
  })

  it('blocks nothing out of the scene or without an object', () => {
    expect(footprintBlocker({ matrixWorld: placed(0, 0, 0).matrixWorld }, car)(0, 0, 0)).toBe(false)
    expect(footprintBlocker(() => null, car)(0, 0, 0)).toBe(false)
  })
})
