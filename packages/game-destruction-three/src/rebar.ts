import type * as THREE_NS from 'three'
import type { Vec3 } from '@adatechnology/game-destruction'

/** Bare rebar of reinforced parts: one instanced cylinder mesh per part, replaced whenever the part exposes more (or less) of its cage. */
export class RebarCages {
  private readonly cages = new Map<string, THREE_NS.InstancedMesh>()
  private readonly geometry: THREE_NS.CylinderGeometry
  private readonly material: THREE_NS.MeshStandardMaterial
  private readonly up: THREE_NS.Vector3
  private readonly dir: THREE_NS.Vector3
  private readonly mid: THREE_NS.Vector3
  private readonly q: THREE_NS.Quaternion
  private readonly scale: THREE_NS.Vector3
  private readonly m: THREE_NS.Matrix4

  constructor(
    private readonly THREE: typeof THREE_NS,
    private readonly scene: THREE_NS.Scene,
    radius = 0.004,
  ) {
    this.geometry = new THREE.CylinderGeometry(radius, radius, 1, 6)
    this.material = new THREE.MeshStandardMaterial({ color: 0x74665c, roughness: 0.55, metalness: 0.6 })
    this.up = new THREE.Vector3(0, 1, 0)
    this.dir = new THREE.Vector3()
    this.mid = new THREE.Vector3()
    this.q = new THREE.Quaternion()
    this.scale = new THREE.Vector3()
    this.m = new THREE.Matrix4()
  }

  /** Bars drawn now, over every part. */
  get count(): number {
    let n = 0
    for (const mesh of this.cages.values()) n += mesh.count
    return n
  }

  /** Meshes of the live cages (tests and picking). */
  meshes(): THREE_NS.InstancedMesh[] {
    return [...this.cages.values()]
  }

  /** Draw `bars` (world space) as the cage of `key`; an empty list removes it. */
  set(key: string, bars: ReadonlyArray<readonly [Vec3, Vec3]>): void {
    this.remove(key)
    if (bars.length === 0) return
    const mesh = new this.THREE.InstancedMesh(this.geometry, this.material, bars.length)
    bars.forEach(([a, b], i) => {
      this.dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2])
      const length = this.dir.length()
      this.mid.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
      this.q.setFromUnitVectors(this.up, length > 1e-9 ? this.dir.divideScalar(length) : this.up)
      this.m.compose(this.mid, this.q, this.scale.set(1, Math.max(length, 1e-4), 1))
      mesh.setMatrixAt(i, this.m)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.castShadow = true
    this.scene.add(mesh)
    this.cages.set(key, mesh)
  }

  remove(key: string): void {
    const mesh = this.cages.get(key)
    if (!mesh) return
    this.scene.remove(mesh)
    mesh.dispose()
    this.cages.delete(key)
  }

  /** Remove the cages of every part of `object` (keys are `object|part`). */
  removeObject(object: string): void {
    for (const key of [...this.cages.keys()]) if (key.startsWith(`${object}|`)) this.remove(key)
  }

  clear(): void {
    for (const key of [...this.cages.keys()]) this.remove(key)
  }

  dispose(): void {
    this.clear()
    this.geometry.dispose()
    this.material.dispose()
  }
}
