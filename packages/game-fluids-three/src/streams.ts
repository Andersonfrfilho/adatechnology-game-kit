import type * as THREE_NS from 'three'
import { sampleStream } from '@adatechnology/game-fluids'
import type { StreamState } from '@adatechnology/game-fluids'
import type { QualityProfile } from './quality'
import { clamp } from './util'
import type { ThreeLib } from './types'

/** Seconds a stream takes to break up into drops after the world ended it. */
const GHOST_TIME = 0.4

/**
 * One stream: a thread along the ballistic path (a tube updated in place) with a growing drop at its leading tip, a trailing drop while it ends,
 * and for thin streams only a sequence of falling drops. The jet narrows as it accelerates.
 */
export class StreamVisual {
  readonly tube: THREE_NS.Mesh
  readonly drops: THREE_NS.InstancedMesh
  private readonly positions: Float32Array
  private readonly normals: Float32Array
  private readonly samples: number
  private readonly sides: number
  private readonly matrix: THREE_NS.Matrix4
  private readonly maxDrops: number
  id = ''
  age = 0
  ghostAge = -1
  /** Last known state, kept while the stream breaks into drops. */
  state: StreamState | null = null
  triangles = 0

  constructor(
    private readonly THREE: ThreeLib,
    profile: QualityProfile,
    dropGeometry: THREE_NS.SphereGeometry,
  ) {
    const T = THREE
    this.samples = profile.streamSamples
    this.sides = profile.streamSides
    this.maxDrops = Math.max(profile.thinDrops, 2) + 2
    this.positions = new Float32Array(this.samples * this.sides * 3)
    this.normals = new Float32Array(this.samples * this.sides * 3)
    const geometry = new T.BufferGeometry()
    const p = new T.BufferAttribute(this.positions, 3)
    const n = new T.BufferAttribute(this.normals, 3)
    p.setUsage(T.DynamicDrawUsage)
    n.setUsage(T.DynamicDrawUsage)
    geometry.setAttribute('position', p)
    geometry.setAttribute('normal', n)
    const index: number[] = []
    for (let i = 0; i < this.samples - 1; i++) {
      for (let j = 0; j < this.sides; j++) {
        const a = i * this.sides + j
        const b = i * this.sides + ((j + 1) % this.sides)
        const c = (i + 1) * this.sides + j
        const d = (i + 1) * this.sides + ((j + 1) % this.sides)
        index.push(a, c, b, b, c, d)
      }
    }
    geometry.setIndex(index)
    this.tube = new T.Mesh(geometry)
    this.tube.name = 'fluid_stream'
    this.tube.frustumCulled = false
    this.tube.renderOrder = 2
    this.drops = new T.InstancedMesh(dropGeometry, undefined as unknown as THREE_NS.Material, this.maxDrops)
    this.drops.name = 'fluid_stream_drops'
    this.drops.frustumCulled = false
    this.drops.renderOrder = 2
    this.drops.instanceMatrix.setUsage(T.DynamicDrawUsage)
    this.drops.count = 0
    this.matrix = new T.Matrix4()
  }

  setMaterial(material: THREE_NS.Material): void {
    this.tube.material = material
    this.drops.material = material
  }

  hide(): void {
    this.tube.visible = false
    this.drops.visible = false
    this.drops.count = 0
    this.triangles = 0
  }

  private dropAt(slot: number, x: number, y: number, z: number, radius: number): void {
    this.matrix.makeScale(radius, radius, radius).setPosition(x, y, z)
    this.drops.setMatrixAt(slot, this.matrix)
  }

  /**
   * Draw the stream. `state` is the world's stream while it lives, or the last known one while ghost (`ghostAge >= 0`).
   */
  update(state: StreamState, gravity: number, dt: number, profile: QualityProfile, time: number): void {
    this.state = state
    this.age += dt
    if (this.ghostAge >= 0) this.ghostAge += dt

    const flight = Math.max(0.02, state.flightTime ?? 1)
    const [vx, vy, vz] = state.velocity
    const speed0 = Math.max(0.3, Math.hypot(vx, vy, vz))
    const q = Math.max(state.rate, 0) / 1000
    const r0 = clamp(Math.sqrt(q / (Math.PI * speed0)), 0.0015, 0.03)

    const tB = Math.min(flight, this.age)
    // The tail leaves the origin at free fall once the world stopped the stream.
    const tA = this.ghostAge >= 0 ? Math.min(flight, this.ghostAge) : 0

    let drops = 0
    const thin = state.thin && this.ghostAge < 0

    if (thin) {
      this.tube.visible = false
      this.triangles = 0
      const n = profile.thinDrops
      const phase = time * 1.3
      for (let k = 0; k < n && drops < this.maxDrops; k++) {
        const tau = ((phase + k / n) % 1) * flight
        if (tau > tB) continue
        const p = sampleStream(state, gravity, tau)
        const grow = Math.min(1, tau / (0.12 * flight + 0.02))
        this.dropAt(drops++, p[0], p[1], p[2], Math.max(0.002, r0 * 1.8) * (0.4 + 0.6 * grow))
      }
    } else if (tB - tA > 0.015) {
      this.writeTube(state, gravity, tA, tB, r0, speed0)
      this.tube.visible = true
      this.triangles = (this.samples - 1) * this.sides * 2
      // Leading drop that grows and detaches while the jet is still advancing; trailing drop while it ends.
      if (tB < flight) {
        const p = sampleStream(state, gravity, tB)
        const w = this.radiusAt(state, gravity, tB, r0, speed0)
        this.dropAt(drops++, p[0], p[1], p[2], w * 1.35)
      }
      if (this.ghostAge >= 0) {
        const p = sampleStream(state, gravity, tA)
        const w = this.radiusAt(state, gravity, tA, r0, speed0)
        this.dropAt(drops++, p[0], p[1], p[2], w * 1.4 * (1 - this.ghostAge / GHOST_TIME * 0.4))
      }
    } else {
      this.tube.visible = false
      this.triangles = 0
      if (tA < flight) {
        // Only the drop is left.
        const p = sampleStream(state, gravity, this.ghostAge >= 0 ? tA : tB)
        this.dropAt(drops++, p[0], p[1], p[2], Math.max(0.003, r0 * 1.3))
      }
    }

    this.drops.count = drops
    this.drops.visible = drops > 0
    this.drops.instanceMatrix.needsUpdate = true
    this.triangles += drops * 24
  }

  /** The ghost is over once its tail reached the landing. */
  get finished(): boolean {
    return this.ghostAge >= 0 && (this.ghostAge >= GHOST_TIME || this.ghostAge >= (this.state?.flightTime ?? 0))
  }

  private radiusAt(state: StreamState, gravity: number, t: number, r0: number, speed0: number): number {
    const vy = state.velocity[1] - gravity * t
    const speed = Math.max(0.3, Math.hypot(state.velocity[0], vy, state.velocity[2]))
    const fade = this.ghostAge >= 0 ? clamp(1 - this.ghostAge / GHOST_TIME, 0.15, 1) : 1
    return r0 * Math.sqrt(speed0 / speed) * fade
  }

  private writeTube(state: StreamState, gravity: number, tA: number, tB: number, r0: number, speed0: number): void {
    const n = this.samples
    const sides = this.sides
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1)
      const t = tA + (tB - tA) * k
      const p = sampleStream(state, gravity, t)
      const vx = state.velocity[0]
      const vy = state.velocity[1] - gravity * t
      const vz = state.velocity[2]
      const l = Math.hypot(vx, vy, vz) || 1
      const tx = vx / l
      const ty = vy / l
      const tz = vz / l
      // Any vector not parallel to the tangent gives the first side axis.
      const ax = Math.abs(tz) < 0.9 ? 0 : 1
      const az = Math.abs(tz) < 0.9 ? 1 : 0
      let b1x = ty * az - tz * 0
      let b1y = tz * ax - tx * az
      let b1z = tx * 0 - ty * ax
      const bl = Math.hypot(b1x, b1y, b1z) || 1
      b1x /= bl
      b1y /= bl
      b1z /= bl
      const b2x = ty * b1z - tz * b1y
      const b2y = tz * b1x - tx * b1z
      const b2z = tx * b1y - ty * b1x
      // Rounded ends: the radius tapers to a bead at both ends.
      const end = Math.min(1, 0.35 + Math.min(k, 1 - k) * 8)
      const r = this.radiusAt(state, gravity, t, r0, speed0) * end
      for (let j = 0; j < sides; j++) {
        const a = (j / sides) * Math.PI * 2
        const c = Math.cos(a)
        const s = Math.sin(a)
        const nx = b1x * c + b2x * s
        const ny = b1y * c + b2y * s
        const nz = b1z * c + b2z * s
        const o = (i * sides + j) * 3
        this.positions[o] = p[0] + nx * r
        this.positions[o + 1] = p[1] + ny * r
        this.positions[o + 2] = p[2] + nz * r
        this.normals[o] = nx
        this.normals[o + 1] = ny
        this.normals[o + 2] = nz
      }
    }
    const g = this.tube.geometry
    ;(g.getAttribute('position') as THREE_NS.BufferAttribute).needsUpdate = true
    ;(g.getAttribute('normal') as THREE_NS.BufferAttribute).needsUpdate = true
  }

  start(id: string): void {
    this.id = id
    this.age = 0
    this.ghostAge = -1
    this.state = null
  }

  dispose(): void {
    this.tube.geometry.dispose()
    this.drops.dispose()
  }
}
