import type * as THREE_NS from 'three'
import type { GroundField } from '@adatechnology/game-vfx'
import type { ThreeLib } from './types'

export interface GroundPatchOptions {
  /** The height field the craters dig; the mesh follows it. */
  readonly field: GroundField
  /** What the patch is made of (default a plain flat-shaded grey standard material). */
  readonly material?: THREE_NS.Material
  /** Texture coordinates repeat every this many metres (the Lab's 17). */
  readonly textureMetres?: number
}

export interface GroundPatch {
  readonly mesh: THREE_NS.Mesh
  /** Redraws the vertices when the field changed since the last call. Returns whether it did. */
  sync(): boolean
  dispose(): void
}

const DEFAULT_TEXTURE_METRES = 17

/** The Lab's 60 m deformable patch with 33 cm cells (L60-83), as a mesh that follows a `GroundField`. */
export function createGroundPatch(THREE: ThreeLib, options: GroundPatchOptions): GroundPatch {
  const field = options.field
  const metres = options.textureMetres ?? DEFAULT_TEXTURE_METRES
  const geometry = new THREE.PlaneGeometry(field.size, field.size, field.segments, field.segments).rotateX(-Math.PI / 2)
  const position = geometry.attributes.position!
  const uv = geometry.attributes.uv!
  for (let index = 0; index < position.count; index++) uv.setXY(index, position.getX(index) / metres, position.getZ(index) / metres)
  const material = options.material ?? new THREE.MeshStandardMaterial({ color: 0x2b2c2f, roughness: 0.93, flatShading: true })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.receiveShadow = true
  let version = -1

  function sync(): boolean {
    if (field.version === version) return false
    version = field.version
    for (let index = 0; index < position.count; index++) position.setY(index, field.heights[index]!)
    position.needsUpdate = true
    geometry.computeBoundingSphere()
    return true
  }

  return {
    mesh,
    sync,
    dispose() {
      geometry.dispose()
      if (!options.material) material.dispose()
    },
  }
}
