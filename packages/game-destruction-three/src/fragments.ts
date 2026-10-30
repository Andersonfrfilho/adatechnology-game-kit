import type * as THREE_NS from 'three'
import type { Fragment } from '@adatechnology/game-destruction'
import { pushFittedBoxes } from './fitted-boxes'
import { clamp, createRng, hashString } from './math'
import type { LooseBody } from './types'

interface Live {
  mesh: THREE_NS.Mesh
  home: string
  vel: THREE_NS.Vector3
  ang: THREE_NS.Vector3
  half: THREE_NS.Vector3
  baseScale: THREE_NS.Vector3
  still: number
  asleep: boolean
  /** Seconds at rest. */
  rest: number
  /** 1 while alive; counts down to 0 while shrinking away. */
  fade: number
  dying: boolean
  /** Air drag per second: a loose sheet (a page) glides and flutters down instead of dropping. */
  air: number
  /** A big one (`isBig`): it stays where it lies, and what walks steps on it or kicks it. */
  body: LooseBody | null
}

export interface FragmentSystemOptions {
  scene: THREE_NS.Scene
  groundAt: (x: number, z: number) => number
  gravity: number
  max: number
  life: number
}

/** Thickest scrap that flies as a sheet (m), its air drag (1/s) and how hard it sways (m/s²). */
const SHEET_MAX = 0.004
const SHEET_AIR = 2.5
const SHEET_SWAY = 3
/** A fragment at least this long (m) and this wide is a piece of the thing (half a board), not a splinter; a shard of glass never is. */
const BIG_LENGTH = 0.2
const BIG_WIDTH = 0.03

const isBig = (size: readonly number[]): boolean => {
  const [, middle, longest] = [...size].sort((a, b) => a - b)
  return longest >= BIG_LENGTH && middle >= BIG_WIDTH
}

/** Light physics for fracture debris: gravity, ground bounce and friction, spin damping, settling flat, sleep, shrink-away and removal. */
export class FragmentSystem {
  private readonly list: Live[] = []
  private readonly box: THREE_NS.BoxGeometry
  /** The mesh box of a fragment before its scale. */
  private readonly unitBox = { min: { x: -0.5, y: -0.5, z: -0.5 }, max: { x: 0.5, y: 0.5, z: 0.5 } }
  private shardGeos: THREE_NS.BufferGeometry[] = []
  private readonly materials = new Map<string, THREE_NS.Material>()
  private readonly q: THREE_NS.Quaternion
  private readonly dq: THREE_NS.Quaternion
  private readonly m: THREE_NS.Matrix4
  private readonly v: THREE_NS.Vector3
  private readonly w: THREE_NS.Vector3
  private readonly rng = createRng(0x51ed270b)

  constructor(
    private readonly THREE: typeof THREE_NS,
    private readonly o: FragmentSystemOptions,
  ) {
    this.box = new THREE.BoxGeometry(1, 1, 1)
    this.q = new THREE.Quaternion()
    this.dq = new THREE.Quaternion()
    this.m = new THREE.Matrix4()
    this.v = new THREE.Vector3()
    this.w = new THREE.Vector3()
  }

  get count(): number {
    return this.list.length
  }

  /** Meshes of every live fragment (tests and picking). */
  meshes(): THREE_NS.Mesh[] {
    return this.list.map((f) => f.mesh)
  }

  /** One shared material per source material id + colour (+ transparency). */
  materialFor(materialId: string, color: number, transparent: boolean, opacity = 0.5): THREE_NS.Material {
    const key = `${materialId}:${color}:${transparent ? 1 : 0}`
    let m = this.materials.get(key)
    if (!m) {
      m = transparent
        ? new this.THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.1, transparent: true, opacity, side: this.THREE.DoubleSide, depthWrite: false })
        : new this.THREE.MeshLambertMaterial({ color })
      this.materials.set(key, m)
    }
    return m
  }

  private shardGeometry(seed: number): THREE_NS.BufferGeometry {
    const idx = seed % 6
    let g = this.shardGeos[idx]
    if (!g) {
      const r = createRng(1000 + idx)
      const n = 3 + Math.floor(r() * 3) // triangle, quad or pentagon, irregular
      const shape = new this.THREE.Shape()
      const pts: Array<[number, number]> = []
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.7
        const rad = 0.35 + r() * 0.15
        pts.push([Math.cos(a) * rad, Math.sin(a) * rad])
      }
      shape.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < n; i++) shape.lineTo(pts[i][0], pts[i][1])
      shape.closePath()
      g = new this.THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false })
      g.translate(0, 0, -0.5)
      this.shardGeos[idx] = g
    }
    return g
  }

  private markGeometry: THREE_NS.CircleGeometry | null = null
  private markMaterial: THREE_NS.MeshBasicMaterial | null = null

  /**
   * Bullet holes that stay on a fragment (`Fragment.marks`): dark discs that are children of its mesh, so they fall, spin and settle with it. The mesh is
   * a unit box scaled to the fragment, so each disc is scaled back; exact for a mark on a face, which is where a bullet hole is.
   */
  addMarks(mesh: THREE_NS.Mesh, f: Fragment): void {
    if (!f.marks?.length) return
    this.markGeometry ??= new this.THREE.CircleGeometry(1, 10)
    this.markMaterial ??= new this.THREE.MeshBasicMaterial({ color: 0x0b0a09, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
    const sc = mesh.scale
    for (const mark of f.marks) {
      const disc = new this.THREE.Mesh(this.markGeometry, this.markMaterial)
      const radius = Math.max(0.004, mark.diameter) * 0.6
      const n = this.v.set(mark.normal[0], mark.normal[1], mark.normal[2]).normalize()
      disc.position.set(mark.point[0] / sc.x + (n.x * 0.002) / sc.x, mark.point[1] / sc.y + (n.y * 0.002) / sc.y, mark.point[2] / sc.z + (n.z * 0.002) / sc.z)
      disc.quaternion.setFromUnitVectors(this.w.set(0, 0, 1), n)
      disc.scale.set(radius / sc.x, radius / sc.y, radius / sc.z)
      mesh.add(disc)
    }
  }

  /** Create the mesh of a fragment and start its motion. `maxAllowed` is the live budget. */
  spawn(f: Fragment, material: THREE_NS.Material, home: string, maxAllowed: number): THREE_NS.Mesh {
    const geo = f.shape === 'shard' ? this.shardGeometry(hashString(f.id)) : this.box
    const mesh = new this.THREE.Mesh(geo, material)
    mesh.position.set(f.center[0], f.center[1], f.center[2])
    mesh.quaternion.set(f.rotation[0], f.rotation[1], f.rotation[2], f.rotation[3]).normalize()
    const sz = f.size
    const sc = new this.THREE.Vector3(Math.max(0.005, sz[0]), Math.max(0.005, sz[1]), Math.max(0.003, sz[2]))
    mesh.scale.copy(sc)
    mesh.castShadow = true
    // pure visual debris: a host that picks with a raycast can skip it
    mesh.userData.destructionDebris = true
    this.o.scene.add(mesh)
    const live: Live = {
      mesh,
      home,
      vel: new this.THREE.Vector3(f.velocity[0], f.velocity[1], f.velocity[2]),
      ang: new this.THREE.Vector3(f.angularVelocity[0], f.angularVelocity[1], f.angularVelocity[2]),
      // shards are thin: the contact extent uses the real (small) thickness, the chunk uses half of each side
      half: sc.clone().multiplyScalar(0.5),
      baseScale: sc,
      still: 0,
      asleep: false,
      rest: 0,
      fade: 1,
      dying: false,
      air: f.shape === 'scrap' && sz[2] <= SHEET_MAX ? SHEET_AIR : 0,
      body: null,
    }
    if (f.shape !== 'shard' && isBig(f.size)) {
      live.body = {
        mass: f.mass,
        push: (x, z) => {
          live.vel.x = x
          live.vel.z = z
          live.vel.y = Math.max(live.vel.y, 0.3)
          live.asleep = false
          live.rest = 0
        },
      }
    }
    this.list.push(live)
    let alive = this.list.reduce((n, l) => n + (l.dying ? 0 : 1), 0)
    // over the limit the splinters go first; the big ones only when nothing else is left
    for (const big of [false, true]) {
      for (let i = 0; i < this.list.length && alive > maxAllowed; i++) {
        if (!this.list[i].dying && (this.list[i].body !== null) === big) {
          this.list[i].dying = true
          alive--
        }
      }
    }
    this.addMarks(mesh, f)
    return mesh
  }

  /** The boxes of the big fragments around (x, z). */
  solidsNear(x: number, z: number, radius: number, found: (home: string, min: [number, number, number], max: [number, number, number], body: LooseBody) => void): void {
    const boxes: number[] = []
    for (const f of this.list) {
      if (!f.body || f.dying) continue
      const reach = f.half.length() + radius
      if (Math.abs(f.mesh.position.x - x) > reach || Math.abs(f.mesh.position.z - z) > reach) continue
      f.mesh.updateMatrixWorld()
      boxes.length = 0
      pushFittedBoxes(this.unitBox, f.mesh.matrixWorld, boxes)
      for (let i = 0; i < boxes.length; i += 6) {
        if (x < boxes[i] - radius || x > boxes[i + 3] + radius || z < boxes[i + 2] - radius || z > boxes[i + 5] + radius) continue
        found(f.home, [boxes[i], boxes[i + 1], boxes[i + 2]], [boxes[i + 3], boxes[i + 4], boxes[i + 5]], f.body)
      }
    }
  }

  /** Add velocity to every fragment within `radius` of a point (blasts). */
  blast(point: [number, number, number], radius: number, speed: number): void {
    for (const f of this.list) {
      const d = this.v.copy(f.mesh.position).sub(this.w.set(point[0], point[1], point[2]))
      const dist = d.length()
      if (dist > radius || f.dying) continue
      const k = (1 - dist / radius) ** 2 * speed
      d.normalize().multiplyScalar(k)
      d.y += k * 0.4
      f.vel.add(d)
      f.ang.add(this.w.set(this.rng() - 0.5, this.rng() - 0.5, this.rng() - 0.5).multiplyScalar(k))
      f.asleep = false
      f.rest = 0
    }
  }

  update(dt: number): void {
    const g = this.o.gravity
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i]
      if (f.dying) {
        f.fade -= dt / 0.6
        if (f.fade <= 0) {
          this.o.scene.remove(f.mesh)
          this.list.splice(i, 1)
          continue
        }
        f.mesh.scale.copy(f.baseScale).multiplyScalar(f.fade)
      }
      if (f.asleep) {
        f.rest += dt
        if (this.o.life > 0 && f.rest > this.o.life && !f.body) f.dying = true
        continue
      }
      this.step(f, dt, g)
    }
  }

  private step(f: Live, dt: number, g: number): void {
    const mesh = f.mesh
    f.vel.y -= g * dt
    mesh.position.addScaledVector(f.vel, dt)
    const w = f.ang.length()
    if (w > 1e-5) {
      this.dq.setFromAxisAngle(this.v.copy(f.ang).multiplyScalar(1 / w), w * dt)
      mesh.quaternion.premultiply(this.dq).normalize()
    }
    // ground contact: lowest point of the oriented box
    this.m.makeRotationFromQuaternion(mesh.quaternion)
    const e = this.m.elements
    const h = f.half
    const sc = f.dying ? f.fade : 1
    const ext = (Math.abs(e[1]) * h.x + Math.abs(e[5]) * h.y + Math.abs(e[9]) * h.z) * sc
    const gy = this.o.groundAt(mesh.position.x, mesh.position.z)
    let contact = false
    if (mesh.position.y - ext < gy) {
      contact = true
      mesh.position.y = gy + ext
      if (f.vel.y < -0.6) {
        f.vel.y = -f.vel.y * 0.25
        f.vel.x *= 0.7
        f.vel.z *= 0.7
        f.ang.multiplyScalar(0.55)
        // a hit on a corner makes it tumble a little
        f.ang.x += (this.rng() - 0.5) * 2
        f.ang.z += (this.rng() - 0.5) * 2
      } else {
        f.vel.y = 0
        const fr = Math.exp(-7 * dt)
        f.vel.x *= fr
        f.vel.z *= fr
        f.ang.multiplyScalar(Math.exp(-6 * dt))
      }
    } else {
      f.ang.multiplyScalar(Math.exp(-0.15 * dt))
      if (f.air > 0) this.flutter(f, dt)
    }
    if (contact && f.vel.lengthSq() < 4) this.settle(f, dt)
    const slow = f.vel.lengthSq() < 0.012 && f.ang.lengthSq() < 0.2
    if (contact && slow) {
      f.still += dt
      if (f.still > 0.4) {
        f.asleep = true
        f.vel.set(0, 0, 0)
        f.ang.set(0, 0, 0)
      }
    } else {
      f.still = 0
    }
  }

  /** A sheet in the air: drag slows it to a slow fall, and it sways and turns over as it goes. */
  private flutter(f: Live, dt: number): void {
    f.vel.multiplyScalar(Math.exp(-f.air * dt))
    f.vel.x += (this.rng() - 0.5) * SHEET_SWAY * dt
    f.vel.z += (this.rng() - 0.5) * SHEET_SWAY * dt
    f.ang.x += (this.rng() - 0.5) * SHEET_SWAY * 4 * dt
    f.ang.z += (this.rng() - 0.5) * SHEET_SWAY * 4 * dt
  }

  /** Tip the fragment towards lying on its flattest face. */
  private settle(f: Live, dt: number): void {
    const mesh = f.mesh
    this.m.makeRotationFromQuaternion(mesh.quaternion)
    const e = this.m.elements
    const up = [e[1], e[5], e[9]] // world-y component of each local axis
    const half = [f.half.x, f.half.y, f.half.z]
    let small = 0
    for (let i = 1; i < 3; i++) if (half[i] < half[small]) small = i
    let axis = small
    // a broken board does not stand on its end
    if (Math.abs(up[small]) < 0.35 && !f.body) {
      axis = 0
      for (let i = 1; i < 3; i++) if (Math.abs(up[i]) > Math.abs(up[axis])) axis = i
    }
    const sign = up[axis] >= 0 ? 1 : -1
    this.v.set(e[axis * 4], e[axis * 4 + 1], e[axis * 4 + 2]).multiplyScalar(sign)
    this.w.set(0, 1, 0)
    this.dq.setFromUnitVectors(this.v, this.w)
    this.q.copy(this.dq).multiply(mesh.quaternion)
    mesh.quaternion.slerp(this.q, clamp(dt * 7, 0, 1))
  }

  /** Remove the fragments of one object (after `restore`). */
  removeHome(home: string): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i].home === home) {
        this.o.scene.remove(this.list[i].mesh)
        this.list.splice(i, 1)
      }
    }
  }

  clear(): void {
    for (const f of this.list) this.o.scene.remove(f.mesh)
    this.list.length = 0
  }

  dispose(): void {
    this.clear()
    this.box.dispose()
    this.markGeometry?.dispose()
    this.markMaterial?.dispose()
    for (const g of this.shardGeos) g?.dispose()
    this.shardGeos = []
    for (const m of this.materials.values()) m.dispose()
    this.materials.clear()
  }
}
