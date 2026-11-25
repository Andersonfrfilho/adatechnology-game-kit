import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { WIRE_COLORS, wireMeshes } from '../src'

describe('wireMeshes: the wires of an object as tubes the host draws', () => {
  it('draws one tube per wire of two points or more, named by its id, in the colour of its kind, along its points', () => {
    const meshes = wireMeshes(THREE, [
      { id: 'conduit', kind: 'conduit', radius: 0.012, points: [[-0.05, 0.1, 0], [0.05, 0.1, 0]] },
      { id: 'wire_1', kind: 'cable', points: [[0, 1, 0], [1, 0.95, 0], [2, 1, 0]] },
      { id: 'stub', kind: 'cord', points: [[0, 0, 0]] },
    ])
    expect(meshes.map((mesh) => mesh.name)).toEqual(['conduit', 'wire_1'])
    const conduit = meshes[0] as THREE.Mesh
    expect((conduit.material as THREE.MeshStandardMaterial).color.getHex()).toBe(WIRE_COLORS.conduit)
    const box = new THREE.Box3().setFromObject(conduit)
    expect(box.max.x - box.min.x).toBeGreaterThan(0.1)
    expect(box.max.y - box.min.y).toBeCloseTo(0.024, 2)
  })

  it('draws nothing for an object without wires', () => {
    expect(wireMeshes(THREE, undefined)).toEqual([])
  })
})
