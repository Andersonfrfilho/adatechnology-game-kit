import type * as THREE_NS from 'three'

/** A mesh (or a subclass: skinned, instanced) found while walking a tree; three marks them with `isMesh`. */
export function isMesh(o: THREE_NS.Object3D | null | undefined): o is THREE_NS.Mesh {
  return !!o && (o as Partial<THREE_NS.Mesh>).isMesh === true
}
