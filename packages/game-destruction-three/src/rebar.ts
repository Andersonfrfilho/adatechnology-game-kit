import type * as THREE_NS from 'three'
import type { Vec3 } from '@adatechnology/game-destruction'

/** A bar of a cage, in world space. */
export interface RebarBar {
  readonly center: Vec3
  readonly rotation: [number, number, number, number]
  readonly length: number
}

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
    private readonly radius = 0.004,
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

  /**
   * Draw `bars` (world space) as the cage of `key`; an empty list removes it. The cage is a child of `holder` (the drawing of the part's object, the scene
   * by default), so it goes where the part goes: a beam that comes down takes its bare bars with it.
   */
  set(key: string, bars: ReadonlyArray<readonly [Vec3, Vec3]>, holder?: THREE_NS.Object3D): void {
    this.remove(key)
    if (bars.length === 0) return
    const parent = holder ?? this.scene
    parent.updateWorldMatrix(true, false)
    const toParent = new this.THREE.Matrix4().copy(parent.matrixWorld).invert()
    const mesh = new this.THREE.InstancedMesh(this.geometry, this.material, bars.length)
    bars.forEach(([a, b], i) => {
      this.dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2])
      const length = this.dir.length()
      this.mid.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
      this.q.setFromUnitVectors(this.up, length > 1e-9 ? this.dir.divideScalar(length) : this.up)
      this.m.compose(this.mid, this.q, this.scale.set(1, Math.max(length, 1e-4), 1)).premultiply(toParent)
      mesh.setMatrixAt(i, this.m)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.castShadow = true
    mesh.name = 'rebar-cage'
    parent.add(mesh)
    this.cages.set(key, mesh)
  }

  /** The cage of `from` now belongs to `to` (a part that left its object for one of its own) and hangs from `holder`, where it is in the world now. */
  move(from: string, to: string, holder: THREE_NS.Object3D): void {
    const mesh = this.cages.get(from)
    if (!mesh) return
    this.cages.delete(from)
    this.remove(to)
    holder.attach(mesh)
    this.cages.set(to, mesh)
  }

  /** Takes the cage of `key` away and gives its bars, where they are in the world now: centre, turn (the bar along its y) and length. */
  take(key: string): RebarBar[] {
    const mesh = this.cages.get(key)
    if (!mesh) return []
    mesh.updateWorldMatrix(true, false)
    const bars: RebarBar[] = []
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, this.m)
      this.m.premultiply(mesh.matrixWorld).decompose(this.mid, this.q, this.scale)
      bars.push({ center: [this.mid.x, this.mid.y, this.mid.z], rotation: [this.q.x, this.q.y, this.q.z, this.q.w], length: this.scale.y })
    }
    this.remove(key)
    return bars
  }

  /** Radius of the bars drawn, metres. */
  get barRadius(): number {
    return this.radius
  }

  remove(key: string): void {
    const mesh = this.cages.get(key)
    if (!mesh) return
    mesh.removeFromParent()
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
