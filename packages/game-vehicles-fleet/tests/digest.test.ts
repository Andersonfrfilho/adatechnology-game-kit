import { describe, expect, it } from 'vitest'
import type { Mesh, Object3D } from 'three'
import { digest } from './helpers/digest'
import { makeFleetKit } from './helpers/kit'

function firstMeshPositions(root: Object3D): { array: Float32Array } {
  let found: { array: Float32Array } | undefined
  root.traverse((obj) => {
    const node = obj as Mesh
    if (!found && node.geometry?.attributes?.position?.count > 3) found = node.geometry.attributes.position as unknown as { array: Float32Array }
  })
  if (!found) throw new Error('no mesh with positions')
  return found
}

describe('golden digest sensitivity', () => {
  it('is repeatable, sees a 1 mm move of one vertex, and ignores sub-precision noise', () => {
    const kit = makeFleetKit('pt-BR')
    const baseline = digest(kit.build('compact_hatch', 'intact')).hash
    expect(digest(kit.build('compact_hatch', 'intact')).hash).toBe(baseline)

    const moved = kit.build('compact_hatch', 'intact')
    firstMeshPositions(moved.root).array[0] += 0.001
    expect(digest(moved).hash).not.toBe(baseline)

    const noisy = kit.build('compact_hatch', 'intact')
    firstMeshPositions(noisy.root).array[0] += 1e-6
    expect(digest(noisy).hash).toBe(baseline)
  })
})
