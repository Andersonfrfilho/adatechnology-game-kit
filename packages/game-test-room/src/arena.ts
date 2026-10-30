import type * as THREE_NS from 'three'
import type { DestructibleSpec, JointSpec, PartSpec, Vec3 } from '@adatechnology/game-destruction'
import type { SurfaceSpec } from '@adatechnology/game-fluids'
import { markKitOrigin } from '@adatechnology/game-contracts'
import { brickWallSpec } from './items'
import type { SceneryObject, SceneryTap } from './types'

export interface ArenaObject {
  id: string
  spec: DestructibleSpec
  position: Vec3
  rotationY: number
  colors?: Record<string, number>
  build?: SceneryObject['build']
  follow?: SceneryObject['follow']
  label?: string
  top?: SceneryObject['top']
  spout?: SceneryObject['spout']
}

/** A top that loose things rest on while its part stands: the footprint in world space and the height of the upper face. */
export interface ArenaTop {
  /** Id of the arena object the top belongs to, and of its part. */
  id: string
  topPart: string
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  top: number
}

/** The static part of the room: lights, floor, grid, ruler and the destructible scenery. */
export interface Arena {
  group: THREE_NS.Group
  /** Objects to register in the world (by default the target wall, the table and the shelf). */
  objects: ArenaObject[]
  surfaces: SurfaceSpec[]
  /** `[minX, minZ, maxX, maxZ]` boxes the player cannot walk into. */
  colliders: Array<[number, number, number, number]>
  playerStart: Vec3
  wallZ: number
  /** Tops of the scenery (pieces rest on them while their part stands). */
  tops: ArenaTop[]
  /** Where the tap pours: over the top of the `table` object; null when the room has no table with a top. */
  tapSpout: Vec3 | null
  sun: THREE_NS.DirectionalLight
}

/** Box of a spec in world space, ignoring the parts that lie flat on the floor (a plinth, a ground slab: the player walks over them). */
export interface SpecBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

const sizeOf = (shape: PartSpec['shape']): Vec3 => (shape.kind === 'box' ? shape.size : shape.kind === 'cylinder' ? [shape.radius * 2, shape.height, shape.radius * 2] : [shape.radius * 2, shape.radius * 2, shape.radius * 2])

/**
 * Bounds of a spec turned `rotationY` about the vertical axis and moved to `position`: the corners of every part (after its own rotation).
 * `onlyPart` limits it to one part; `minHeight` leaves out the parts whose upper face is lower than that (default 0: all).
 */
export function specBounds(THREE: typeof THREE_NS, spec: DestructibleSpec, position: Vec3, rotationY: number, options: { onlyPart?: string; minHeight?: number } = {}): SpecBounds | null {
  const out: SpecBounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity }
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotationY, 0))
  const v = new THREE.Vector3()
  const e = new THREE.Euler()
  const pq = new THREE.Quaternion()
  let any = false
  for (const p of spec.parts) {
    if (options.onlyPart !== undefined && p.id !== options.onlyPart) continue
    const [sx, sy, sz] = sizeOf(p.shape)
    pq.setFromEuler(e.set(p.rotation?.[0] ?? 0, p.rotation?.[1] ?? 0, p.rotation?.[2] ?? 0, 'XYZ'))
    const corners: Vec3[] = []
    let top = -Infinity
    for (const cx of [-0.5, 0.5]) for (const cy of [-0.5, 0.5]) for (const cz of [-0.5, 0.5]) {
      v.set(cx * sx, cy * sy, cz * sz).applyQuaternion(pq)
      const c: Vec3 = [v.x + p.position[0], v.y + p.position[1], v.z + p.position[2]]
      top = Math.max(top, c[1])
      corners.push(c)
    }
    if (top < (options.minHeight ?? 0)) continue
    any = true
    for (const c of corners) {
      v.set(c[0], c[1], c[2]).applyQuaternion(q)
      out.minX = Math.min(out.minX, v.x + position[0])
      out.maxX = Math.max(out.maxX, v.x + position[0])
      out.minY = Math.min(out.minY, v.y + position[1])
      out.maxY = Math.max(out.maxY, v.y + position[1])
      out.minZ = Math.min(out.minZ, v.z + position[2])
      out.maxZ = Math.max(out.maxZ, v.z + position[2])
    }
  }
  return any ? out : null
}

const tableSpec = (): DestructibleSpec => {
  const parts: PartSpec[] = [{ id: 'top', material: 'wood_hard', shape: { kind: 'box', size: [1.6, 0.05, 0.8] }, position: [0, 0.755, 0] }]
  const joints: JointSpec[] = []
  for (const [i, [x, z]] of [
    [-0.72, -0.32],
    [0.72, -0.32],
    [-0.72, 0.32],
    [0.72, 0.32],
  ].entries()) {
    parts.push({ id: `leg_${i + 1}`, material: 'wood_hard', shape: { kind: 'box', size: [0.06, 0.73, 0.06] }, position: [x, 0.365, z], anchored: true })
    joints.push({ a: `leg_${i + 1}`, b: 'top', kind: 'screw' })
  }
  return { name: 'table', parts, joints, tags: ['furniture'] }
}

const shelfSpec = (): DestructibleSpec => {
  const parts: PartSpec[] = []
  const joints: JointSpec[] = []
  for (const [i, x] of [-0.6, 0.6].entries()) {
    parts.push({ id: `upright_${i + 1}`, material: 'wood_hard', shape: { kind: 'box', size: [0.04, 1.7, 0.4] }, position: [x, 0.85, 0], anchored: true })
  }
  for (const [i, y] of [0.4, 0.9, 1.4].entries()) {
    parts.push({ id: `board_${i + 1}`, material: 'wood_soft', shape: { kind: 'box', size: [1.2, 0.03, 0.4] }, position: [0, y, 0] })
    joints.push({ a: `board_${i + 1}`, b: 'upright_1', kind: 'screw' }, { a: `board_${i + 1}`, b: 'upright_2', kind: 'screw' })
  }
  return { name: 'shelf', parts, joints, tags: ['furniture'] }
}

/** The scenery a bare room has: the brick target wall, the table (the tap stands beside it) and the shelf. */
export const defaultScenery = (wallZ: number): Record<string, SceneryObject> => ({
  target_wall: { spec: brickWallSpec(), position: [0, 0, wallZ], colors: { brick: 0xa5472e } },
  table: { spec: tableSpec(), position: [3.5, 0, 0], top: { part: 'top', y: 0.78 } },
  shelf: { spec: shelfSpec(), position: [-3.5, 0, 0], colors: { wood_soft: 0xc79a62 } },
})

const DEFAULT_WALL_Z = -11
const WALL_ID = 'target_wall'
const TABLE_ID = 'table'

/** The scenery of the room: the defaults with the host's `scenery` applied (replace by id, `null` removes, a new id adds). */
export function resolveScenery(scenery: Record<string, SceneryObject | null> | undefined): ArenaObject[] {
  const merged = new Map<string, SceneryObject>(Object.entries(defaultScenery(DEFAULT_WALL_Z)))
  for (const [id, obj] of Object.entries(scenery ?? {})) {
    if (obj === null) {
      merged.delete(id)
      continue
    }
    const old = merged.get(id)
    const position = obj.position ?? old?.position
    if (!position) throw new Error(`game-test-room: scenery "${id}" is new, so it needs a position`)
    merged.set(id, { ...obj, position })
  }
  return [...merged.entries()].map(([id, o]) => ({ id, spec: o.spec, position: o.position as Vec3, rotationY: o.rotationY ?? 0, colors: o.colors, build: o.build, follow: o.follow, label: o.label, top: o.top, spout: o.spout }))
}

export function createArena(THREE: typeof THREE_NS, size: number, scene: THREE_NS.Scene, scenery?: Record<string, SceneryObject | null>, tapOption?: SceneryTap | null): Arena {
  // the room's own floor, grid and ruler (not a piece: the pieces in the room come from their packages)
  const group = markKitOrigin(new THREE.Group(), { owner: 'game-test-room', kind: 'room' })
  group.name = 'test-room-arena'
  scene.background = new THREE.Color(0x9fb4c8)

  group.add(new THREE.HemisphereLight(0xcfe3ff, 0x6b6257, 0.75))
  const sun = new THREE.DirectionalLight(0xffffff, 2.1)
  sun.position.set(7, 13, 8)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  const sc = sun.shadow.camera
  sc.left = -16
  sc.right = 16
  sc.top = 16
  sc.bottom = -16
  sc.near = 1
  sc.far = 40
  sun.shadow.bias = -0.0006
  group.add(sun)

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size * 2), new THREE.MeshStandardMaterial({ color: 0x8e8e8a, roughness: 0.95 }))
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  floor.name = 'floor'
  group.add(floor)

  const grid = new THREE.GridHelper(size * 2, size * 2, 0x4c4c52, 0x77777b)
  grid.position.y = 0.004
  group.add(grid)

  const sceneryObjects = resolveScenery(scenery)
  const wallObject = sceneryObjects.find((o) => o.id === WALL_ID)
  const wallZ = wallObject ? wallObject.position[2] : DEFAULT_WALL_Z
  const playerStart: Vec3 = [0, 1.7, 5]

  // distance ruler along the left of the lane: a tick every metre (taller every 5 m) and a label every 5 m
  const pts: number[] = []
  const rx = -1.6
  for (let z = Math.round(playerStart[2]); z >= wallZ; z--) {
    const d = playerStart[2] - z
    const len = d % 5 === 0 ? 0.5 : 0.2
    pts.push(rx, 0.01, z, rx + len, 0.01, z)
  }
  pts.push(rx, 0.01, playerStart[2], rx, 0.01, wallZ)
  const rg = new THREE.BufferGeometry()
  rg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  group.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xffd23f })))
  for (let d = 5; playerStart[2] - d >= wallZ; d += 5) {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 64
      const ctx = canvas.getContext('2d')
      if (!ctx) break
      ctx.fillStyle = '#ffd23f'
      ctx.font = 'bold 44px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`${d} m`, 64, 48)
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }))
      sprite.scale.set(1.2, 0.6, 1)
      sprite.position.set(rx - 0.8, 0.45, playerStart[2] - d)
      group.add(sprite)
    } catch {
      break
    }
  }

  // the tops loose things rest on, and the water surface of each
  const tops: ArenaTop[] = []
  const surfaces: SurfaceSpec[] = [{ id: 'floor', point: [0, 0, 0], normal: [0, 1, 0], halfSize: [size, size], porosity: 0.05 }]
  for (const o of sceneryObjects) {
    if (!o.top) continue
    const b = specBounds(THREE, o.spec, o.position, o.rotationY, { onlyPart: o.top.part })
    if (!b) continue
    const top = o.position[1] + o.top.y
    tops.push({ id: o.id, topPart: o.top.part, minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, top })
    surfaces.push({ id: o.id, point: [(b.minX + b.maxX) / 2, top, (b.minZ + b.maxZ) / 2], normal: [0, 1, 0], halfSize: [(b.maxX - b.minX) / 2, (b.maxZ - b.minZ) / 2], porosity: 0.3 })
  }

  // colliders: the footprint of every object (what lies flat on the floor is walked over); the wall also closes the arena behind it
  const colliders: Array<[number, number, number, number]> = []
  for (const o of sceneryObjects) {
    const b = specBounds(THREE, o.spec, o.position, o.rotationY, { minHeight: 0.1 })
    if (!b) continue
    colliders.push(o.id === WALL_ID ? [-size, b.minZ - 1, size, b.maxZ + 0.1] : [b.minX, b.minZ, b.maxX, b.maxZ])
  }

  // the tap: the host's model standing on the table top, or (by default) a post with an arm and a spout beside the table
  let tapSpout: Vec3 | null = null
  const tableTop = tops.find((t) => t.id === TABLE_ID)
  const spouting = sceneryObjects.find((o) => o.spout)
  if (spouting?.spout && tapOption !== null) {
    // a piece of the scenery (a sink, a tub) carries its own tap: the stream pours from its spout
    const s = new THREE.Vector3(spouting.spout[0], spouting.spout[1], spouting.spout[2]).applyAxisAngle(new THREE.Vector3(0, 1, 0), spouting.rotationY)
    tapSpout = [spouting.position[0] + s.x, spouting.position[1] + s.y, spouting.position[2] + s.z]
  } else if (tableTop && tapOption !== null) {
    const cx = (tableTop.minX + tableTop.maxX) / 2
    const cz = (tableTop.minZ + tableTop.maxZ) / 2
    const y = tableTop.top
    if (tapOption) {
      const rot = tapOption.rotationY ?? 0
      const sp = new THREE.Vector3(tapOption.spout[0], tapOption.spout[1], tapOption.spout[2]).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot)
      const at: Vec3 = tapOption.position ?? [cx + 0.3 - sp.x, y, cz - sp.z]
      const model = tapOption.build(THREE)
      model.position.set(at[0], at[1], at[2])
      model.rotation.y = rot
      model.traverse((m) => {
        m.castShadow = true
      })
      group.add(model)
      tapSpout = [at[0] + sp.x, at[1] + sp.y, at[2] + sp.z]
    } else {
      const postX = tableTop.maxX + 0.35
      const tapMat = new THREE.MeshStandardMaterial({ color: 0xb9bec4, metalness: 0.8, roughness: 0.35 })
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 10), tapMat)
      post.position.set(postX, 0.7, cz)
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, postX - (cx + 0.3), 10), tapMat)
      arm.rotation.z = Math.PI / 2
      arm.position.set((postX + cx + 0.3) / 2, y + 0.6, cz)
      const spoutMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 10), tapMat)
      spoutMesh.position.set(cx + 0.3, y + 0.55, cz)
      for (const m of [post, arm, spoutMesh]) {
        m.castShadow = true
        group.add(m)
      }
      tapSpout = [cx + 0.3, y + 0.5, cz]
      colliders.push([postX - 0.05, cz - 0.1, postX + 0.05, cz + 0.1])
    }
  }

  return {
    group,
    objects: sceneryObjects,
    surfaces,
    colliders,
    playerStart,
    wallZ,
    tops,
    tapSpout,
    sun,
  }
}
