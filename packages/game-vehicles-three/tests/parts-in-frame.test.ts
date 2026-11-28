import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { bodyMassOf, partsInFrame } from '../src/crash-parts-math'
import type { MassPart } from '../src/crash-parts-math'

const PARTS: readonly MassPart[] = [
  { mass: 300, box: { center: [-1.6, 0.6, 0], size: [3, 0.2, 1.6] } },
  { mass: 100, box: { center: [1.2, 0.8, 0.2], size: [0.6, 0.5, 0.4] } },
]

describe('partsInFrame: the model parts in the chassis frame', () => {
  it('turns the centres and the sizes with the quarter turn the drawing has inside its root, so the centre of mass stays on the long axis', () => {
    const toFrame = new THREE.Matrix4().makeRotationY(-Math.PI / 2).setPosition(0, 0, 1.6)
    const inFrame = partsInFrame(PARTS, toFrame.elements)
    expect(inFrame[0]!.box.center[0]).toBeCloseTo(0, 9)
    expect(inFrame[0]!.box.center[2]).toBeCloseTo(0, 9)
    expect(inFrame[0]!.box.size).toEqual([expect.closeTo(1.6, 9), expect.closeTo(0.2, 9), expect.closeTo(3, 9)])
    const model = bodyMassOf(PARTS)
    const frame = bodyMassOf(inFrame)
    const expected = new THREE.Vector3(...model.centre).applyMatrix4(toFrame)
    expect(frame.centre).toEqual([expect.closeTo(expected.x, 9), expect.closeTo(expected.y, 9), expect.closeTo(expected.z, 9)])
    expect(frame.mass).toBe(model.mass)
    // a quarter turn about y swaps the moments about x and z
    expect(frame.inertia).toEqual([expect.closeTo(model.inertia[2], 6), expect.closeTo(model.inertia[1], 6), expect.closeTo(model.inertia[0], 6)])
  })

  it('leaves the parts as they are under the identity', () => {
    const inFrame = partsInFrame(PARTS, new THREE.Matrix4().elements)
    expect(inFrame.map((part) => part.box)).toEqual(PARTS.map((part) => part.box))
  })
})

describe('bodyMassOf: a part whose weight is not at the middle of its box', () => {
  it('puts that part at its mass centre, and the frame turns the mass centre with the box', () => {
    const chassis: MassPart = { mass: 1000, box: { center: [-1.7, 0.6, 0], size: [3.5, 0.14, 1.7] }, massCentre: [0.1, 0.6, 0] }
    expect(bodyMassOf([chassis]).centre).toEqual([0.1, 0.6, 0])
    const toFrame = new THREE.Matrix4().makeRotationY(-Math.PI / 2)
    const [inFrame] = partsInFrame([chassis], toFrame.elements)
    expect(inFrame!.massCentre).toEqual([expect.closeTo(0, 9), expect.closeTo(0.6, 9), expect.closeTo(0.1, 9)])
  })
})
