import type { CylinderShape, PropItem, Uv } from '@adatechnology/game-props3d'
import type { HouseholdApi, MaterialKey, Quality, ThreeLib, ThreeNS, Vec3 } from './types'
import { MATERIAL_KEYS } from './types'
import { rememberRest } from './pose'

export type MaterialMap = Partial<Record<MaterialKey, ThreeNS.Material>>

export interface MeshApiOptions {
  /** Materials per key. Missing keys get a default (vertex-colored) material. */
  materials?: MaterialMap
  /** `high`: smoother cylinders and spheres, standard materials. `game`: fewer segments, Lambert materials. Default `high`. */
  quality?: Quality
  /** Cast and receive shadows on the merged meshes. Default true. */
  shadows?: boolean
  /** Make `plane` primitives double sided (applies to the default materials only). Default false. */
  doubleSidedPlanes?: boolean
}

export interface MeshResult {
  /** Root group: static meshes (one per material) plus one child group per part. */
  group: ThreeNS.Group
  /** Part groups by id. Origin at the pivot, rotated by the part's `ry`; `userData.rest` holds the rest pose. */
  parts: Record<string, ThreeNS.Group>
  /** Real lights requested by the builders (already children of their group). */
  lights: ThreeNS.Light[]
}

export interface MeshApi {
  api: HouseholdApi
  /** Builds the groups from everything drawn so far. Call once; the api is spent afterwards. */
  finish(): MeshResult
  /** Materials in use (defaults merged with the given ones). */
  materials: Record<MaterialKey, ThreeNS.Material>
}

/** Default materials: vertex colors everywhere, glass and water transparent, emissive unlit. */
export function createDefaultMaterials(THREE: ThreeLib, quality: Quality = 'high'): Record<MaterialKey, ThreeNS.Material> {
  const std = (p: ThreeNS.MeshStandardMaterialParameters): ThreeNS.Material =>
    quality === 'game'
      ? new THREE.MeshLambertMaterial({ vertexColors: true, transparent: p.transparent, opacity: p.opacity, depthWrite: p.depthWrite, side: p.side })
      : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, ...p })
  return {
    plain: std({}),
    metal: std({ roughness: 0.35, metalness: 0.7 }),
    wood: std({ roughness: 0.8 }),
    glass: std({ roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false }),
    fabric: std({ roughness: 1 }),
    plant: std({ roughness: 0.9, side: THREE.DoubleSide }),
    water: std({ roughness: 0.1, transparent: true, opacity: 0.7, depthWrite: false }),
    emissive: new THREE.MeshBasicMaterial({ vertexColors: true }),
    atlas_picture: std({ roughness: 0.9 }),
    atlas_floor: std({ roughness: 1 }),
  }
}

/** Growing arrays for one (target, material) pair. */
interface Acc {
  pos: number[]
  nor: number[]
  col: number[]
  uv: number[]
  idx: number[]
}

interface Target {
  id: string | null
  pivot: Vec3
  ry: number
  acc: Map<string, Acc>
  lights: Array<{ x: number; y: number; z: number; color: number; range: number }>
}

interface Template {
  pos: Float32Array
  nor: Float32Array
  uv: Float32Array
  idx: ArrayLike<number>
}

const IDENT_UV: Uv = { u0: 0, v0: 0, u1: 1, v1: 1 }

/**
 * Mesh api for content packs. Every primitive is baked (vertex colors) into one `BufferGeometry` per material and per target
 * (the root, or a part), so the draw calls are the number of materials in use plus the same again for each part.
 */
export function createMeshApi(THREE: ThreeLib, options: MeshApiOptions = {}): MeshApi {
  const quality: Quality = options.quality ?? 'high'
  const shadows = options.shadows !== false
  const materials = { ...createDefaultMaterials(THREE, quality), ...stripUndefined(options.materials) } as Record<MaterialKey, ThreeNS.Material>
  if (options.doubleSidedPlanes) for (const k of MATERIAL_KEYS) materials[k].side = THREE.DoubleSide

  const root: Target = { id: null, pivot: [0, 0, 0], ry: 0, acc: new Map(), lights: [] }
  const partTargets = new Map<string, Target>()
  const stack: Target[] = []
  let current = root
  let finished = false

  const templates = new Map<string, Template>()
  const template = (key: string, make: () => ThreeNS.BufferGeometry): Template => {
    let t = templates.get(key)
    if (!t) {
      const g = make()
      t = {
        pos: g.getAttribute('position').array as Float32Array,
        nor: g.getAttribute('normal').array as Float32Array,
        uv: g.getAttribute('uv').array as Float32Array,
        idx: g.index ? (g.index.array as ArrayLike<number>) : Array.from({ length: g.getAttribute('position').count }, (_, i) => i),
      }
      templates.set(key, t)
    }
    return t
  }
  const segs = quality === 'high' ? { cyl: 12, sphereW: 12, sphereH: 8 } : { cyl: 8, sphereW: 8, sphereH: 6 }
  const tBox = () => template('box', () => new THREE.BoxGeometry(1, 1, 1))
  const tCyl = (shape: CylinderShape | undefined) => {
    switch (shape) {
      case 'cyl6':
        return template('cyl6', () => new THREE.CylinderGeometry(1, 1, 1, 6))
      case 'cone':
        return template('cone', () => new THREE.CylinderGeometry(0, 1, 1, segs.cyl))
      case 'sphere':
        return template('sphere', () => new THREE.SphereGeometry(1, segs.sphereW, segs.sphereH))
      default:
        return template('cyl', () => new THREE.CylinderGeometry(1, 1, 1, segs.cyl))
    }
  }
  const tPlane = () => template('plane', () => new THREE.PlaneGeometry(1, 1))
  const tLeaf = (): Template => {
    let t = templates.get('leaf')
    if (!t) {
      // diamond in the xy plane, base at the origin, tip at +y; both faces
      const f = [0, 0, 0, -0.5, 0.4, 0, 0.5, 0.4, 0, 0, 1, 0]
      const pos: number[] = []
      const nor: number[] = []
      const uv: number[] = []
      const idx: number[] = []
      for (const side of [1, -1]) {
        const base = pos.length / 3
        for (let i = 0; i < 4; i++) {
          pos.push(f[i * 3], f[i * 3 + 1], f[i * 3 + 2])
          nor.push(0, 0, side)
          uv.push(f[i * 3] + 0.5, f[i * 3 + 1])
        }
        if (side === 1) idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3)
        else idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
      }
      // winding for the front face: counter clockwise seen from +z
      t = { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), idx }
      templates.set('leaf', t)
    }
    return t
  }

  const m4 = new THREE.Matrix4()
  const mFinal = new THREE.Matrix4()
  const mItem = new THREE.Matrix4()
  const mPartInv = new THREE.Matrix4()
  const n3 = new THREE.Matrix3()
  const v = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const euler = new THREE.Euler()
  const scl = new THREE.Vector3()
  const color = new THREE.Color()

  const accOf = (key: MaterialKey): Acc => {
    let a = current.acc.get(key)
    if (!a) {
      a = { pos: [], nor: [], col: [], uv: [], idx: [] }
      current.acc.set(key, a)
    }
    return a
  }

  /** Item transform (M.x, M.z, M.ry), then the inverse of the target frame. */
  const frame = (M: PropItem | undefined): ThreeNS.Matrix4 => {
    mItem.makeRotationY(M?.ry ?? 0)
    mItem.setPosition(M?.x ?? 0, 0, M?.z ?? 0)
    if (current.id === null) return mItem
    mPartInv.makeRotationY(current.ry)
    mPartInv.setPosition(current.pivot[0], current.pivot[1], current.pivot[2])
    mPartInv.invert()
    return mFinal.multiplyMatrices(mPartInv, mItem)
  }

  const emit = (requested: MaterialKey, M: PropItem | undefined, local: ThreeNS.Matrix4, t: Template, hexColor: number, uv?: Uv): void => {
    const key: MaterialKey = requested in materials ? requested : 'plain'
    const a = accOf(key)
    const fr = frame(M)
    const total = fr === mFinal ? mFinal : mFinal.copy(fr)
    total.multiply(local)
    n3.getNormalMatrix(total)
    const base = a.pos.length / 3
    color.setHex(hexColor)
    const count = t.pos.length / 3
    const e = total.elements
    const nm = n3.elements
    const u = uv ?? IDENT_UV
    for (let i = 0; i < count; i++) {
      const x = t.pos[i * 3]
      const y = t.pos[i * 3 + 1]
      const z = t.pos[i * 3 + 2]
      a.pos.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14])
      const nx = t.nor[i * 3]
      const ny = t.nor[i * 3 + 1]
      const nz = t.nor[i * 3 + 2]
      v.set(nm[0] * nx + nm[3] * ny + nm[6] * nz, nm[1] * nx + nm[4] * ny + nm[7] * nz, nm[2] * nx + nm[5] * ny + nm[8] * nz).normalize()
      a.nor.push(v.x, v.y, v.z)
      a.col.push(color.r, color.g, color.b)
      a.uv.push(u.u0 + t.uv[i * 2] * (u.u1 - u.u0), u.v0 + t.uv[i * 2 + 1] * (u.v1 - u.v0))
    }
    for (let i = 0; i < t.idx.length; i++) a.idx.push(base + t.idx[i])
  }

  const compose = (x: number, y: number, z: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number): ThreeNS.Matrix4 => {
    euler.set(rx, ry, rz, 'YXZ')
    quat.setFromEuler(euler)
    return m4.compose(v.set(x, y, z), quat, scl.set(sx, sy, sz))
  }

  const api: HouseholdApi = {
    box(M, material, x, y, z, w, h, d, col, ry, rx, rz) {
      emit(material as MaterialKey, M, compose(x, y + h / 2, z, rx, ry, rz, w, h, d), tBox(), col)
    },
    cylinder(M, material, x, y, z, r, h, col, rx, rz, shape) {
      const tilted = rx !== 0 || rz !== 0
      const cy = shape === 'sphere' ? y + h / 2 : tilted ? y : y + h / 2
      const sy = shape === 'sphere' ? h / 2 : h
      emit(material as MaterialKey, M, compose(x, cy, z, rx, 0, rz, r, sy, r), tCyl(shape), col)
    },
    leaf(M, x, y, z, w, h, col, ry, rx) {
      emit('plant', M, compose(x, y, z, rx, ry, 0, w, h, 1), tLeaf(), col)
    },
    plane(M, material, x, y, z, w, h, col, ry, rx, rz, uv) {
      emit(material as MaterialKey, M, compose(x, y, z, rx, ry, rz, w, h, 1), tPlane(), col, uv)
    },
    light(M, x, y, z, col, range) {
      const fr = frame(M)
      v.set(x, y, z).applyMatrix4(fr)
      current.lights.push({ x: v.x, y: v.y, z: v.z, color: col, range })
    },
    part(id, pivot, ry, draw) {
      let target = partTargets.get(id)
      if (!target) {
        target = { id, pivot: [pivot[0], pivot[1], pivot[2]], ry, acc: new Map(), lights: [] }
        partTargets.set(id, target)
      }
      stack.push(current)
      current = target
      try {
        draw()
      } finally {
        current = stack.pop() ?? root
      }
    },
  }

  const build = (target: Target, into: ThreeNS.Group): void => {
    for (const [key, a] of target.acc) {
      if (!a.idx.length) continue
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(a.pos, 3))
      g.setAttribute('normal', new THREE.Float32BufferAttribute(a.nor, 3))
      g.setAttribute('color', new THREE.Float32BufferAttribute(a.col, 3))
      g.setAttribute('uv', new THREE.Float32BufferAttribute(a.uv, 2))
      g.setIndex(a.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(a.idx, 1) : new THREE.Uint16BufferAttribute(a.idx, 1))
      g.computeBoundingSphere()
      g.computeBoundingBox()
      const mesh = new THREE.Mesh(g, materials[key as MaterialKey])
      mesh.name = target.id === null ? `static:${key}` : `part:${target.id}`
      if (target.id !== null) mesh.userData.part = target.id
      mesh.userData.material = key
      mesh.castShadow = shadows
      mesh.receiveShadow = shadows
      into.add(mesh)
    }
    for (const l of target.lights) {
      const light = new THREE.PointLight(l.color, 1, l.range)
      light.position.set(l.x, l.y, l.z)
      into.add(light)
      lightsOut.push(light)
    }
  }

  const lightsOut: ThreeNS.Light[] = []

  return {
    api,
    materials,
    finish() {
      if (finished) throw new Error('createMeshApi: finish() was already called')
      finished = true
      const group = new THREE.Group()
      group.name = 'interactable'
      const parts: Record<string, ThreeNS.Group> = {}
      build(root, group)
      for (const [id, target] of partTargets) {
        const g = new THREE.Group()
        g.name = `part:${id}`
        g.userData.part = id
        g.position.set(target.pivot[0], target.pivot[1], target.pivot[2])
        g.rotation.y = target.ry
        g.updateMatrix()
        build(target, g)
        rememberRest(g)
        group.add(g)
        parts[id] = g
      }
      return { group, parts, lights: lightsOut }
    },
  }
}

function stripUndefined<T extends object>(o: T | undefined): Partial<T> {
  const out: Partial<T> = {}
  if (o) for (const k of Object.keys(o) as Array<keyof T>) if (o[k] !== undefined) out[k] = o[k]
  return out
}
