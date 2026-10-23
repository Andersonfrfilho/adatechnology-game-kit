import type { ThreeLib, ThreeNS, Vec3 } from './types'

/** `Reflector` from `three/examples/jsm/objects/Reflector.js`, passed by the host. */
export type ReflectorConstructor = new (geometry: ThreeNS.BufferGeometry, options?: { textureWidth?: number; textureHeight?: number; clipBias?: number; color?: ThreeNS.ColorRepresentation }) => ThreeNS.Mesh

export interface MirrorOptions {
  /** Without it every mirror shows the env map only. */
  Reflector?: ReflectorConstructor
  /** Cube / equirect env map for the cheap look. */
  envMap?: ThreeNS.Texture | null
  /** Real reflectors alive at once. Default 1. */
  max?: number
  /** Reflector texture size in pixels. Default 512. */
  resolution?: number
  /** Where reflectors are added. Default: the root ancestor of the registered mesh. */
  scene?: ThreeNS.Object3D
  /** Distance in front of the plane, meters. Default 0.001. */
  offset?: number
  /**
   * three's `Reflector` renders the scene again inside the main `render()`, and that nested render resets `renderer.info` when
   * `info.autoReset` is on, so the counters would only show the reflector pass. With `keepInfo` (default true) the reflector adds
   * what was counted before it back, so `renderer.info.render.calls` covers the whole frame. Skipped when `info.autoReset` is off.
   */
  keepInfo?: boolean
}

/** The mirror entries of `world.mirrors(...)` (only these fields are read). */
export interface MirrorCandidate {
  id: string
  center: Vec3
  normal: Vec3
}

export interface Mirrors {
  /** Registers the display mesh of a mirror (world id `objectId:mirrorId`). It gets the env-map material. `normal` is the world normal; default: the mesh's +z. */
  register(id: string, mesh: ThreeNS.Mesh, normal?: Vec3): void
  unregister(id: string): void
  /** Activates real reflectors for the nearest facing registered mirrors among `candidates`. Returns the active ids. */
  update(camera: ThreeNS.Camera, candidates: readonly MirrorCandidate[]): string[]
  /** Ids that currently have a real reflector. */
  active(): string[]
  /** The shared env-map material registered meshes use. */
  envMaterial: ThreeNS.Material
  dispose(): void
}

interface Entry {
  mesh: ThreeNS.Mesh
  normal: Vec3 | null
  original: ThreeNS.Material | ThreeNS.Material[]
}

interface Slot {
  reflector: ThreeNS.Mesh
  id: string | null
}

/**
 * Mirrors: every registered mirror shows an env-map material; the nearest `max` that face the camera get a real `Reflector`
 * (pooled and reused), placed `offset` in front of the plane with the mesh's rotation and size.
 */
export function createMirrors(THREE: ThreeLib, options: MirrorOptions = {}): Mirrors {
  const max = Math.max(0, Math.floor(options.max ?? 1))
  const resolution = options.resolution ?? 512
  const offset = options.offset ?? 0.001
  const envMaterial = new THREE.MeshStandardMaterial({ color: 0xdfe6ea, metalness: 1, roughness: 0.04, envMap: options.envMap ?? null })
  const entries = new Map<string, Entry>()
  const slots: Slot[] = []
  const geometry = new THREE.PlaneGeometry(1, 1)

  const worldNormal = (e: Entry, out: ThreeNS.Vector3): ThreeNS.Vector3 => {
    if (e.normal) return out.set(e.normal[0], e.normal[1], e.normal[2]).normalize()
    e.mesh.updateWorldMatrix(true, false)
    return out.set(0, 0, 1).transformDirection(e.mesh.matrixWorld)
  }

  const slotFor = (id: string): Slot | null => {
    if (!options.Reflector) return null
    const existing = slots.find((s) => s.id === id)
    if (existing) return existing
    const free = slots.find((s) => s.id === null)
    if (free) return free
    if (slots.length >= max) return null
    const reflector = new options.Reflector(geometry, { textureWidth: resolution, textureHeight: resolution, clipBias: 0.003 })
    reflector.name = 'mirror:reflector'
    if (options.keepInfo !== false) {
      const original = reflector.onBeforeRender
      reflector.onBeforeRender = function (this: ThreeNS.Mesh, renderer, scene, camera, geo, mat, grp) {
        const info = renderer.info
        if (!info.autoReset) return original.call(this, renderer, scene, camera, geo, mat, grp)
        const before = { calls: info.render.calls, triangles: info.render.triangles, points: info.render.points, lines: info.render.lines }
        original.call(this, renderer, scene, camera, geo, mat, grp)
        info.render.calls += before.calls
        info.render.triangles += before.triangles
        info.render.points += before.points
        info.render.lines += before.lines
      }
    }
    reflector.visible = false
    const s: Slot = { reflector, id: null }
    slots.push(s)
    return s
  }

  const release = (s: Slot): void => {
    s.id = null
    s.reflector.visible = false
  }

  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const scl = new THREE.Vector3()
  const n = new THREE.Vector3()
  const toEye = new THREE.Vector3()
  const box = new THREE.Box3()
  const size = new THREE.Vector3()
  const facing = new THREE.Vector3()
  const flip = new THREE.Quaternion(0, 1, 0, 0)

  return {
    envMaterial,
    register(id, mesh, normal) {
      const previous = entries.get(id)
      entries.set(id, { mesh, normal: normal ?? null, original: previous ? previous.original : mesh.material })
      mesh.material = envMaterial
    },
    unregister(id) {
      const e = entries.get(id)
      const s = slots.find((x) => x.id === id)
      if (s) release(s)
      if (e) e.mesh.material = e.original
      entries.delete(id)
    },
    update(camera, candidates) {
      const eye = camera.getWorldPosition(toEye)
      const wanted: Array<{ id: string; d: number }> = []
      for (const c of candidates) {
        const e = entries.get(c.id)
        if (!e) continue
        n.set(c.normal[0], c.normal[1], c.normal[2])
        const dx = eye.x - c.center[0]
        const dy = eye.y - c.center[1]
        const dz = eye.z - c.center[2]
        if (n.x * dx + n.y * dy + n.z * dz <= 0) continue
        wanted.push({ id: c.id, d: dx * dx + dy * dy + dz * dz })
      }
      wanted.sort((a, b) => a.d - b.d)
      const chosen = new Set<string>()
      for (let i = 0; i < wanted.length && chosen.size < max; i++) chosen.add(wanted[i].id)
      for (const s of slots) if (s.id !== null && !chosen.has(s.id)) release(s)
      for (const id of chosen) {
        const s = slotFor(id)
        if (!s) continue
        const e = entries.get(id)!
        e.mesh.updateWorldMatrix(true, false)
        e.mesh.matrixWorld.decompose(pos, quat, scl)
        if (!e.mesh.geometry.boundingBox) e.mesh.geometry.computeBoundingBox()
        box.copy(e.mesh.geometry.boundingBox!)
        box.getSize(size)
        worldNormal(e, n)
        s.reflector.position.copy(pos).addScaledVector(n, offset)
        s.reflector.quaternion.copy(quat)
        // a Reflector only renders for a camera in front of its +z: when the registered normal points the other way, turn it around
        if (facing.set(0, 0, 1).applyQuaternion(quat).dot(n) < 0) s.reflector.quaternion.multiply(flip)
        s.reflector.scale.set(Math.max(size.x * scl.x, 1e-3), Math.max(size.y * scl.y, 1e-3), 1)
        s.id = id
        s.reflector.visible = true
        if (!s.reflector.parent) {
          let top: ThreeNS.Object3D = e.mesh
          while (top.parent) top = top.parent
          ;(options.scene ?? top).add(s.reflector)
        }
      }
      return slots.filter((s) => s.id !== null).map((s) => s.id as string)
    },
    active() {
      return slots.filter((s) => s.id !== null).map((s) => s.id as string)
    },
    dispose() {
      for (const s of slots) s.reflector.removeFromParent()
      slots.length = 0
      for (const e of entries.values()) e.mesh.material = e.original
      entries.clear()
      envMaterial.dispose()
      geometry.dispose()
    },
  }
}
