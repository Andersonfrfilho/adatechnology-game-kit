import type * as THREE_NS from 'three'
import { STAIN_SAMPLES } from '@adatechnology/game-fluids'
import type { LiquidDef, StainState, Vec3 } from '@adatechnology/game-fluids'
import type { MaterialCache } from './materials'
import { stainColorOf } from './materials'
import type { QualityProfile } from './quality'
import { clamp } from './util'
import type { ThreeLib } from './types'

/** Periodic Catmull-Rom of the 16 front radii: a smooth outline with `subdiv` points per sample. */
export const smoothOutline = (front: number[], subdiv: number, out?: number[]): number[] => {
  const n = front.length
  const res = out ?? []
  res.length = n * subdiv
  for (let i = 0; i < n; i++) {
    const p0 = front[(i + n - 1) % n]
    const p1 = front[i]
    const p2 = front[(i + 1) % n]
    const p3 = front[(i + 2) % n]
    for (let j = 0; j < subdiv; j++) {
      const t = j / subdiv
      const r = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
      res[i * subdiv + j] = Math.max(0.004, r)
    }
  }
  return res
}

interface Fan {
  mesh: THREE_NS.Mesh
  position: Float32Array
  color: Float32Array
}

/**
 * One stain: an outer film (the whole flow-front polygon, soft at the rim) and an inner glossy fan at `wetRadius` that recedes while it dries.
 * Both are triangle fans with preallocated buffers, lying on the surface plane a hair above it.
 */
export class StainVisual {
  readonly group: THREE_NS.Group
  private readonly outer: Fan
  private readonly inner: Fan
  private readonly ring: number
  private readonly radii: number[] = []
  private readonly tint: THREE_NS.Color
  stainId = ''
  signature = Number.NaN
  triangles = 0

  constructor(
    private readonly THREE: ThreeLib,
    profile: QualityProfile,
    readonly slot: number,
  ) {
    this.ring = STAIN_SAMPLES * profile.stainSubdiv
    this.group = new THREE.Group()
    this.group.name = 'fluid_stain'
    this.tint = new THREE.Color()
    this.outer = this.makeFan('fluid_stain_film', 1)
    this.inner = this.makeFan('fluid_stain_wet', 2)
    this.group.add(this.outer.mesh, this.inner.mesh)
    this.group.visible = false
  }

  private makeFan(name: string, order: number): Fan {
    const T = this.THREE
    const count = 1 + this.ring
    const position = new Float32Array(count * 3)
    const color = new Float32Array(count * 4)
    const normal = new Float32Array(count * 3)
    const geometry = new T.BufferGeometry()
    const p = new T.BufferAttribute(position, 3)
    const c = new T.BufferAttribute(color, 4)
    p.setUsage(T.DynamicDrawUsage)
    c.setUsage(T.DynamicDrawUsage)
    geometry.setAttribute('position', p)
    geometry.setAttribute('normal', new T.BufferAttribute(normal, 3))
    geometry.setAttribute('color', c)
    const index: number[] = []
    for (let i = 0; i < this.ring; i++) index.push(0, 1 + i, 1 + ((i + 1) % this.ring))
    geometry.setIndex(index)
    const mesh = new T.Mesh(geometry)
    mesh.name = name
    mesh.frustumCulled = false
    mesh.renderOrder = order
    return { mesh, position, color }
  }

  assign(def: LiquidDef, materials: MaterialCache): void {
    this.outer.mesh.material = materials.stainFilm(def)
    this.inner.mesh.material = materials.stainWet(def)
  }

  hide(): void {
    this.group.visible = false
    this.stainId = ''
    this.signature = Number.NaN
    this.triangles = 0
  }

  /** Rebuild the vertices from the stain state (skipped when nothing changed). */
  update(stain: StainState, def: LiquidDef, profile: QualityProfile): void {
    const sig =
      stain.center[0] * 3 +
      stain.center[1] * 5 +
      stain.center[2] * 7 +
      stain.front.reduce((s, v, i) => s + v * (i + 1), 0) * 11 +
      stain.wetness * 13 +
      stain.wetRadius * 17 +
      (stain.soaked / (stain.soaked + stain.liters + 1e-6)) * 19
    if (sig === this.signature && this.group.visible) return
    this.signature = sig

    const n: Vec3 = stain.normal ?? [0, 1, 0]
    const t1: Vec3 = stain.tangent ?? [1, 0, 0]
    const t2: Vec3 = [n[1] * t1[2] - n[2] * t1[1], n[2] * t1[0] - n[0] * t1[2], n[0] * t1[1] - n[1] * t1[0]]
    smoothOutline(stain.front, profile.stainSubdiv, this.radii)
    const ring = this.ring
    const lift = 0.0015 + 0.0004 * (this.slot % 6)
    const mean = stain.front.reduce((s, v) => s + v, 0) / stain.front.length
    const wet = clamp(stain.wetness, 0, 1)
    const soakRatio = stain.soaked / (stain.soaked + stain.liters + 1e-6)

    // Outer film: tinted by the liquid, darker while wet and where it soaked in, fainter once only the mark is left.
    this.tint.setHex(stain.tint?.dry ?? stainColorOf(def))
    const dark = 1 - 0.3 * wet - 0.2 * soakRatio
    const markAlpha = def.leavesMark ? 0.34 : 0.1
    const aMid = (markAlpha + (0.62 - markAlpha) * wet) * (0.75 + 0.25 * Math.min(1, stain.liters * 20 + soakRatio))
    this.writeFan(this.outer, stain.center, n, t1, t2, lift, 1, this.tint.r * dark, this.tint.g * dark, this.tint.b * dark, aMid, aMid * 0.45)
    this.outer.mesh.visible = true

    // Inner glossy wet fan, centred where the liquid came in, shrinking as it dries.
    const wr = clamp(stain.wetRadius, 0, 1)
    const showInner = wr > 0.05 && wet > 0.03
    this.inner.mesh.visible = showInner
    if (showInner) {
      this.tint.setHex(stain.tint?.fresh ?? def.color)
      const shift = stain.flow ? -mean * 0.1 * (1 - wr) : 0
      const centre: Vec3 = stain.flow
        ? [stain.center[0] + stain.flow[0] * shift, stain.center[1] + stain.flow[1] * shift, stain.center[2] + stain.flow[2] * shift]
        : stain.center
      const a = clamp(def.opacity, 0.2, 0.85) * wet * 0.8
      this.writeFan(this.inner, centre, n, t1, t2, lift + 0.0007, 0.9 * wr, this.tint.r, this.tint.g, this.tint.b, a, a * 0.5)
    }
    this.triangles = ring * (showInner ? 2 : 1)
    this.group.visible = true
  }

  private writeFan(
    fan: Fan,
    center: Vec3,
    n: Vec3,
    t1: Vec3,
    t2: Vec3,
    lift: number,
    scale: number,
    r: number,
    g: number,
    b: number,
    aCentre: number,
    aRim: number,
  ): void {
    const ring = this.ring
    const px = center[0] + n[0] * lift
    const py = center[1] + n[1] * lift
    const pz = center[2] + n[2] * lift
    fan.position[0] = px
    fan.position[1] = py
    fan.position[2] = pz
    fan.color[0] = r * 0.85
    fan.color[1] = g * 0.85
    fan.color[2] = b * 0.85
    fan.color[3] = aCentre
    const normalAttr = fan.mesh.geometry.getAttribute('normal') as THREE_NS.BufferAttribute
    for (let i = 0; i <= ring; i++) {
      normalAttr.setXYZ(i, n[0], n[1], n[2])
    }
    normalAttr.needsUpdate = true
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2
      const c = Math.cos(a) * this.radii[i] * scale
      const s = Math.sin(a) * this.radii[i] * scale
      const o = (1 + i) * 3
      fan.position[o] = px + t1[0] * c + t2[0] * s
      fan.position[o + 1] = py + t1[1] * c + t2[1] * s
      fan.position[o + 2] = pz + t1[2] * c + t2[2] * s
      const k = (1 + i) * 4
      fan.color[k] = r
      fan.color[k + 1] = g
      fan.color[k + 2] = b
      fan.color[k + 3] = aRim
    }
    const geometry = fan.mesh.geometry
    ;(geometry.getAttribute('position') as THREE_NS.BufferAttribute).needsUpdate = true
    ;(geometry.getAttribute('color') as THREE_NS.BufferAttribute).needsUpdate = true
  }

  dispose(): void {
    for (const fan of [this.outer, this.inner]) fan.mesh.geometry.dispose()
  }
}
