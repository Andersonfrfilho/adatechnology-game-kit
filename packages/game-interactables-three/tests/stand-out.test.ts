import { coincidentFacesOf } from '@adatechnology/game-shapes-three'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createMeshApi } from '../src'

const FRAME = { x: 0, z: 0, ry: 0, w: 1, d: 1, h: 1, seed: 'a' } as never

function build(standOut: boolean, draw: (api: ReturnType<typeof createMeshApi>['api']) => void): THREE.Group {
  const mesh = createMeshApi(THREE, { standOut })
  draw(mesh.api)
  return mesh.finish().group
}

const faces = (group: THREE.Group): number => coincidentFacesOf(group as never, { maxHits: Number.POSITIVE_INFINITY }).length

describe('standOutCoincidentBoxes', () => {
  it('moves apart a lining that sits flush with its body, and keeps the body box', () => {
    const draw = (api: ReturnType<typeof createMeshApi>['api']): void => {
      api.box(FRAME, 'wood', 0, 0, 0, 1, 1, 1, 0x884422, 0, 0, 0)
      api.box(FRAME, 'plain', 0, 0.1, 0, 1, 0.5, 1, 0xffffff, 0, 0, 0)
    }
    expect(faces(build(false, draw))).toBeGreaterThan(0)
    const fixed = build(true, draw)
    expect(faces(fixed)).toBe(0)
    const box = new THREE.Box3().setFromObject(fixed)
    expect(box.max.y - box.min.y).toBeCloseTo(1, 2)
  })

  it('lifts a plane lying on the face of a box and clears boxes turned off the axes', () => {
    const draw = (api: ReturnType<typeof createMeshApi>['api']): void => {
      api.box(FRAME, 'wood', 0, 0, 0, 1, 0.2, 1, 0x884422, 0, 0, 0)
      api.plane(FRAME, 'glass', 0, 0.2, 0, 0.5, 0.5, 0xffffff, 0, -Math.PI / 2, 0)
      api.box(FRAME, 'metal', 0.2, 0.3, 0, 0.3, 0.2, 0.3, 0xcccccc, 0.4, 0, 0)
      api.box(FRAME, 'plain', 0.2, 0.3, 0, 0.3, 0.2, 0.3, 0xcccccc, 0.4, 0, 0)
    }
    expect(faces(build(false, draw))).toBeGreaterThan(0)
    expect(faces(build(true, draw))).toBe(0)
  })
})
