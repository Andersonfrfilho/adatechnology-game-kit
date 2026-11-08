import * as THREE_NS from 'three'
import { describe, expect, it } from 'vitest'

import { houseOf, planOf } from './helpers/houses'

describe('a window of a house', () => {
  it('draws its sill and its grille with its frame, so they go with the window when the wall falls and are never left in the air', () => {
    const { house } = houseOf(planOf('casaA', 1))
    const frame = house.structure.meshesOf('window_frame:w0_0').filter((it: { mesh?: unknown }) => it.mesh) as { mesh: THREE_NS.Mesh; v0: number; v1: number }[]
    expect(frame.length).toBeGreaterThan(0)
    // the bars of the grille stand 7 cm out of the face of the wall: the frame's drawing reaches past the frame itself
    const box = new THREE_NS.Box3(), v = new THREE_NS.Vector3()
    for (const it of frame) {
      const pos = it.mesh.geometry.getAttribute('position')
      for (let i = it.v0; i < it.v1; i++) box.expandByPoint(v.fromBufferAttribute(pos, i))
    }
    const size = box.getSize(new THREE_NS.Vector3())
    expect(Math.min(size.x, size.z)).toBeGreaterThan(0.22)
  })
})
