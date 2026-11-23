import type * as THREE_NS from 'three'
import { kitOriginOf, markKitOrigin } from '@adatechnology/game-contracts'
import { BATCHED_LAYER } from '@adatechnology/game-render-three'

/**
 * The camera layer a fragment's own mesh moves to while an instance draws it: a layer no camera enables, so neither the colour pass nor the shadow pass draws it (three's
 * `WebGLShadowMap` tests an object's layers against the viewing camera's, not the light's), and it is not drawn twice. Its mask is given back when it leaves the instances.
 * Apart from the batches' `BATCHED_LAYER` (30), which the settled batches read as "drawn by a batcher already".
 */
export const INSTANCED_FRAGMENT_LAYER = 29

/** The name of the instanced meshes (not `fragment`: what counts the fragments in a scene counts their own meshes). */
export const FRAGMENT_INSTANCES_NAME = 'fragment-instances'

/** Instances a bucket starts with; it doubles when full. */
const FIRST_CAPACITY = 16

interface Bucket {
  readonly key: string
  readonly source: THREE_NS.Material
  mesh: THREE_NS.InstancedMesh
  readonly members: THREE_NS.Mesh[]
}

interface Slot {
  readonly bucket: Bucket
  index: number
  /** The layer mask the mesh gets back when it leaves (what it had when it joined, or what was set on it from outside since). */
  mask: number
  readonly geometry: THREE_NS.BufferGeometry
  readonly material: THREE_NS.Material
}

/** What the instances hold now: draws (one per bucket with members) and the fragments they draw. */
export interface FragmentInstanceStats {
  readonly buckets: number
  readonly drawn: number
}

const HIDDEN_MASK = 1 << INSTANCED_FRAGMENT_LAYER
const BATCHED_MASK = 1 << BATCHED_LAYER

/**
 * Whether a fragment's mesh can be drawn by an instance: one opaque material, no marks on it (a bullet hole is a mesh of its own on the fragment), and not drawn by a batch
 * now. A batched one woken without the batch letting go of it yet waits until the batcher gives it back its layers (the update after it moved): taking it before would
 * keep the batch's mask as the one to give back, and it would vanish when it lands.
 */
export const isInstanceable = (mesh: THREE_NS.Mesh): boolean =>
  !Array.isArray(mesh.material) && !mesh.material.transparent && mesh.children.length === 0 && (mesh.layers.mask & BATCHED_MASK) === 0

const keyOf = (geometry: THREE_NS.BufferGeometry, material: THREE_NS.Material): string => `${geometry.uuid}|${material.uuid}`

/**
 * The fragments in flight drawn as one `InstancedMesh` per shared geometry and material instead of a draw each (and a shadow draw each). Only the drawing changes: each
 * fragment keeps its own mesh in the scene, with its name, origin and transform, moved to `INSTANCED_FRAGMENT_LAYER` while an instance draws it. `sync` copies the
 * transforms into the instances once per update; the instances' bounds wrap their members, so they are culled as a whole.
 */
export class FragmentInstances {
  private readonly buckets = new Map<string, Bucket>()
  private readonly slots = new Map<THREE_NS.Mesh, Slot>()
  private readonly sphere: THREE_NS.Sphere
  private readonly reaches = new WeakMap<THREE_NS.BufferGeometry, number>()
  /** The material the instanced meshes draw with, one per fragment material: sharing the fragment's own would make three rebuild the program key every draw that alternates between a mesh and an instanced mesh. */
  private readonly twins = new Map<THREE_NS.Material, { readonly twin: THREE_NS.Material; version: number }>()

  constructor(
    private readonly THREE: typeof THREE_NS,
    private readonly parent: THREE_NS.Object3D,
  ) {
    this.sphere = new THREE.Sphere()
  }

  has(mesh: THREE_NS.Mesh): boolean {
    return this.slots.has(mesh)
  }

  /** Draws `mesh` by an instance from now on; false (and nothing changes) when it cannot be (`isInstanceable`) or is already. */
  add(mesh: THREE_NS.Mesh): boolean {
    if (this.slots.has(mesh) || !isInstanceable(mesh)) return false
    const geometry = mesh.geometry
    const material = mesh.material as THREE_NS.Material
    const key = keyOf(geometry, material)
    let bucket = this.buckets.get(key)
    if (!bucket) {
      bucket = { key, source: material, mesh: this.makeMesh(geometry, material, FIRST_CAPACITY, mesh), members: [] }
      this.buckets.set(key, bucket)
    }
    if (bucket.members.length === bucket.mesh.instanceMatrix.count) this.grow(bucket)
    this.slots.set(mesh, { bucket, index: bucket.members.length, mask: mesh.layers.mask, geometry, material })
    bucket.members.push(mesh)
    mesh.layers.mask = HIDDEN_MASK
    return true
  }

  /** `mesh` draws on its own again (its layers back as they were); the last member of its bucket takes its place. */
  remove(mesh: THREE_NS.Mesh): void {
    const slot = this.slots.get(mesh)
    if (!slot) return
    this.slots.delete(mesh)
    const members = slot.bucket.members
    const last = members.pop()
    const instanced = slot.bucket.mesh
    if (last === undefined) throw new Error('FragmentInstances: a member has a slot in an empty bucket')
    if (last !== mesh) {
      const lastSlot = this.slots.get(last)
      if (!lastSlot) throw new Error('FragmentInstances: the last member of a bucket has no slot')
      members[slot.index] = last
      lastSlot.index = slot.index
      // drawn right even before the next sync (a fragment taken away between an update and the render)
      instanced.instanceMatrix.array.copyWithin(slot.index * 16, members.length * 16, members.length * 16 + 16)
    }
    instanced.count = members.length
    instanced.instanceMatrix.needsUpdate = true
    mesh.layers.mask = slot.mask
  }

  /**
   * Copies the members' transforms into the instances and wraps them in their bounds. A member whose geometry, material or marks changed moves to where it now belongs.
   * A member whose layers were set from outside (a batcher handing back the mask it kept for it) gets that mask back when it leaves, and is hidden again now.
   */
  sync(): void {
    for (const [mesh, slot] of this.slots) {
      const mask = mesh.layers.mask
      if (mask !== HIDDEN_MASK) {
        slot.mask = mask
        if ((mask & BATCHED_MASK) === 0) mesh.layers.mask = HIDDEN_MASK
      }
      if (mesh.geometry === slot.geometry && mesh.material === slot.material && isInstanceable(mesh)) continue
      this.remove(mesh)
      this.add(mesh)
    }
    this.syncTwins()
    for (const bucket of [...this.buckets.values()]) this.syncBucket(bucket)
  }

  stats(): FragmentInstanceStats {
    let buckets = 0
    for (const bucket of this.buckets.values()) if (bucket.members.length > 0) buckets++
    return { buckets, drawn: this.slots.size }
  }

  /** The instanced meshes (tests). */
  instancedMeshes(): THREE_NS.InstancedMesh[] {
    return [...this.buckets.values()].map((bucket) => bucket.mesh)
  }

  /** Every member draws on its own again; the instanced meshes leave the scene and their instance buffers are freed (geometries and materials are the fragment system's, shared). */
  clear(): void {
    for (const mesh of [...this.slots.keys()]) this.remove(mesh)
    for (const bucket of [...this.buckets.values()]) this.syncBucket(bucket)
  }

  dispose(): void {
    this.clear()
    for (const { twin } of this.twins.values()) twin.dispose()
    this.twins.clear()
  }

  /** The instanced material standing for `material` (made once; a program already linked for the same look is reused, so no shader compiles for it). */
  private twinOf(material: THREE_NS.Material): THREE_NS.Material {
    let entry = this.twins.get(material)
    if (!entry) {
      entry = { twin: material.clone(), version: material.version }
      this.twins.set(material, entry)
    }
    return entry.twin
  }

  /** A fragment material that was marked for update (`needsUpdate`) gets its twin copied again; a read of one number per material, nothing allocated otherwise. */
  private syncTwins(): void {
    for (const [material, entry] of this.twins) {
      if (entry.version === material.version) continue
      entry.twin.copy(material)
      entry.twin.needsUpdate = true
      entry.version = material.version
    }
  }

  /** An empty bucket is let go (made again when a fragment of its kind flies): nothing empty is left in the scene. */
  private syncBucket(bucket: Bucket): void {
    const { mesh, members } = bucket
    if (members.length === 0) {
      this.buckets.delete(bucket.key)
      this.release(mesh)
      return
    }
    mesh.count = members.length
    const array = mesh.instanceMatrix.array as Float32Array
    const reach = this.reachOf(mesh.geometry)
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
    for (let i = 0; i < members.length; i++) {
      const member = members[i] as THREE_NS.Mesh
      member.updateMatrix()
      array.set(member.matrix.elements, i * 16)
      const { x, y, z } = member.position
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (z < minZ) minZ = z
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
      if (z > maxZ) maxZ = z
    }
    const sphere = this.sphere
    sphere.center.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2)
    let radius = 0
    for (const member of members) {
      const s = member.scale
      radius = Math.max(radius, member.position.distanceTo(sphere.center) + reach * Math.max(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z)))
    }
    sphere.radius = radius
    mesh.boundingSphere ??= new this.THREE.Sphere()
    mesh.boundingSphere.copy(sphere)
    mesh.instanceMatrix.needsUpdate = true
  }

  /** How far the geometry reaches from its origin, kept per geometry; read from its vertices, so the shared geometry's own bounds are left as they were. */
  private reachOf(geometry: THREE_NS.BufferGeometry): number {
    let reach = this.reaches.get(geometry)
    if (reach === undefined) {
      const position = geometry.getAttribute('position')
      reach = 0
      for (let i = 0; i < position.count; i++) reach = Math.max(reach, Math.hypot(position.getX(i), position.getY(i), position.getZ(i)))
      this.reaches.set(geometry, reach)
    }
    return reach
  }

  private makeMesh(geometry: THREE_NS.BufferGeometry, material: THREE_NS.Material, capacity: number, like: THREE_NS.Mesh): THREE_NS.InstancedMesh {
    const mesh = new this.THREE.InstancedMesh(geometry, this.twinOf(material), capacity)
    mesh.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage)
    mesh.count = 0
    mesh.name = FRAGMENT_INSTANCES_NAME
    mesh.castShadow = like.castShadow
    mesh.receiveShadow = like.receiveShadow
    // pure visual debris, as each fragment is: a host that picks with a raycast can skip it
    mesh.userData.destructionDebris = true
    // a ray finds the fragment's own mesh (on its layer, for a raycaster that enables it): walking every instance again would only find the same fragments twice
    mesh.raycast = () => {}
    const origin = kitOriginOf(like)
    markKitOrigin(mesh, origin ?? { owner: 'game-destruction-three', kind: 'fragment' })
    this.parent.add(mesh)
    return mesh
  }

  private grow(bucket: Bucket): void {
    const old = bucket.mesh
    const bigger = this.makeMesh(old.geometry, bucket.source, old.instanceMatrix.count * 2, bucket.members[0] ?? old)
    this.release(old)
    bucket.mesh = bigger
  }

  /**
   * Out of the scene, its instance buffer freed. `dispose()` and not `discardObject3D`: the only resource of its own is the instance buffer, which `releaseObject3D` does not
   * free; its geometry is the fragment system's, shared with the fragments' meshes, and its material is the twin kept until `dispose`.
   */
  private release(mesh: THREE_NS.InstancedMesh): void {
    mesh.removeFromParent()
    mesh.dispose()
  }
}
