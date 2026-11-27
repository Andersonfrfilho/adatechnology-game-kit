import { describe, expect, it } from 'vitest'
import { footprintBlocker, footprintSolid } from '../src'

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

describe('footprintSolid', () => {
  const car = { minX: -1, maxX: 1, minZ: -2.5, maxZ: 2.5 }
  // the quaternion's turn about y, as the angle it makes (radians)
  const turnOf = (box: { readonly rotation?: readonly [number, number, number, number] }): number => 2 * Math.atan2(box.rotation?.[1] ?? 0, box.rotation?.[3] ?? 1)

  it('is the box the blocker holds: the footprint on the floor, as tall as asked', () => {
    const [box] = footprintSolid(placed(10, 4, 0), car, 1.5)
    expect(box?.center).toEqual([10, 0.75, 4])
    expect(box?.half).toEqual([1, 0.75, 2.5])
  })

  it('turns and moves with the object, and the blocker holds exactly what the box covers', () => {
    const object = placed(3, -2, Math.PI / 3)
    const [box] = footprintSolid(object, { minX: 0, maxX: 2, minZ: 0, maxZ: 4 }, 1)
    expect(turnOf(box!)).toBeCloseTo(Math.PI / 3, 6)
    const blocked = footprintBlocker(object, { minX: 0, maxX: 2, minZ: 0, maxZ: 4 })
    const angle = turnOf(box!)
    const inside = (x: number, z: number): boolean => {
      const dx = x - box!.center[0]
      const dz = z - box!.center[2]
      return Math.abs(dx * Math.cos(angle) - dz * Math.sin(angle)) <= box!.half[0] && Math.abs(dx * Math.sin(angle) + dz * Math.cos(angle)) <= box!.half[2]
    }
    for (let x = -4; x <= 8; x += 0.25) for (let z = -8; z <= 6; z += 0.25) if (Math.abs(x - 3) + Math.abs(z + 2) > 0) expect(inside(x, z), `${x},${z}`).toBe(blocked(x, z, 0))
  })

  it('has no box out of the scene or without an object', () => {
    expect(footprintSolid({ matrixWorld: placed(0, 0, 0).matrixWorld }, car, 1)).toEqual([])
    expect(footprintSolid(() => null, car, 1)).toEqual([])
  })
})
