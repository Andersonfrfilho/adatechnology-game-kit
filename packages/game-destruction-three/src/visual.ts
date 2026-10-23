import type * as THREE_NS from 'three'
import type { Dent } from '@adatechnology/game-destruction'
import { heatColor } from './heat'
import type { Decal, MeshVis, PartVis } from './internal'
import { clamp, createRng, lerp } from './math'

type Mesh = THREE_NS.Mesh

const POS_ATTR = 'position'

function positionAttr(geo: THREE_NS.BufferGeometry): THREE_NS.BufferAttribute | null {
  const a = geo.getAttribute(POS_ATTR) as THREE_NS.BufferAttribute | THREE_NS.InterleavedBufferAttribute | undefined
  return a && !(a as THREE_NS.InterleavedBufferAttribute).isInterleavedBufferAttribute ? (a as THREE_NS.BufferAttribute) : null
}

function materialsOf(m: THREE_NS.Material | THREE_NS.Material[]): THREE_NS.Material[] {
  return Array.isArray(m) ? m : [m]
}

function colorOf(m: THREE_NS.Material): THREE_NS.Color | null {
  const c = (m as THREE_NS.MeshStandardMaterial).color
  return c && (c as THREE_NS.Color).isColor ? c : null
}

/** Shared resources for decals (one geometry, a few materials) created lazily and disposed together. */
export class DecalKit {
  private disc: THREE_NS.CircleGeometry | null = null
  private discMat: THREE_NS.MeshBasicMaterial | null = null
  private lineMats = new Map<number, THREE_NS.LineBasicMaterial>()
  constructor(private readonly THREE: typeof THREE_NS) {}

  discGeometry(): THREE_NS.CircleGeometry {
    return (this.disc ??= new this.THREE.CircleGeometry(1, 14))
  }

  discMaterial(): THREE_NS.MeshBasicMaterial {
    return (this.discMat ??= new this.THREE.MeshBasicMaterial({
      color: 0x050505,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    }))
  }

  lineMaterial(color: number): THREE_NS.LineBasicMaterial {
    let m = this.lineMats.get(color)
    if (!m) {
      m = new this.THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false })
      this.lineMats.set(color, m)
    }
    return m
  }

  dispose(): void {
    this.disc?.dispose()
    this.discMat?.dispose()
    for (const m of this.lineMats.values()) m.dispose()
    this.disc = null
    this.discMat = null
    this.lineMats.clear()
  }
}

const tmpV = (THREE: typeof THREE_NS) => new THREE.Vector3()

/** Mesh-level visual changes: copy-on-write geometry and materials, dents, decals, char, glow, melt, hiding, restoring. */
export class Visuals {
  readonly kit: DecalKit
  private readonly a: THREE_NS.Vector3
  private readonly b: THREE_NS.Vector3
  private readonly m4: THREE_NS.Matrix4
  private readonly box: THREE_NS.Box3
  /** Total live decals across meshes (kept in sync by add/remove). */
  decalCount = 0

  constructor(
    private readonly THREE: typeof THREE_NS,
    private readonly lowQuality: boolean,
    private readonly decalCap: number,
  ) {
    this.kit = new DecalKit(THREE)
    this.a = tmpV(THREE)
    this.b = tmpV(THREE)
    this.m4 = new THREE.Matrix4()
    this.box = new THREE.Box3()
  }

  makeMeshVis(mesh: Mesh, home: string): MeshVis {
    return {
      mesh,
      home,
      origGeometry: mesh.geometry,
      origMaterial: mesh.material,
      origVisible: mesh.visible,
      origParent: mesh.parent,
      origPosition: mesh.position.clone(),
      origQuaternion: mesh.quaternion.clone(),
      origScale: mesh.scale.clone(),
      ownMat: false,
      ownGeo: false,
      work: null,
      baseColors: null,
      decals: [],
      meltApplied: 0,
      bottomY: 0,
      moved: false,
    }
  }

  vertexCount(mv: MeshVis): number {
    return mv.mesh.geometry.getAttribute(POS_ATTR)?.count ?? 0
  }

  private readonly tints = new WeakMap<THREE_NS.Mesh, THREE_NS.Color | null>()

  /**
   * Average vertex colour of a mesh whose material uses `vertexColors` (computed once per mesh, from its original geometry), else null. Fragments
   * and debris of such a mesh multiply it by `material.color`; without it they come out white.
   */
  vertexTint(mv: MeshVis): THREE_NS.Color | null {
    if (this.tints.has(mv.mesh)) return this.tints.get(mv.mesh) ?? null
    let tint: THREE_NS.Color | null = null
    const used = materialsOf(mv.origMaterial).some((m) => (m as THREE_NS.MeshStandardMaterial).vertexColors === true)
    const attr = used ? (mv.origGeometry.getAttribute('color') as THREE_NS.BufferAttribute | undefined) : undefined
    if (attr && attr.count > 0 && attr.itemSize >= 3) {
      let r = 0, g = 0, b = 0
      for (let i = 0; i < attr.count; i++) {
        r += attr.getX(i)
        g += attr.getY(i)
        b += attr.getZ(i)
      }
      tint = new this.THREE.Color(r / attr.count, g / attr.count, b / attr.count)
    }
    this.tints.set(mv.mesh, tint)
    return tint
  }

  /** Colour of the original material (before any char) times the vertex tint, `0xRRGGBB`, or -1. */
  baseColorHex(mv: MeshVis): number {
    const c = mv.baseColors?.[0] ?? colorOf(materialsOf(mv.origMaterial)[0])
    if (!c) return -1
    const tint = this.vertexTint(mv)
    return tint ? c.clone().multiply(tint).getHex() : c.getHex()
  }

  /** Is the original material transparent? */
  isTransparent(mv: MeshVis): boolean {
    return materialsOf(mv.origMaterial).some((m) => m.transparent && m.opacity < 1)
  }

  ownMaterial(mv: MeshVis): void {
    if (mv.ownMat) return
    mv.ownMat = true
    const src = materialsOf(mv.origMaterial)
    const cloned = src.map((m) => m.clone())
    mv.baseColors = src.map((m) => colorOf(m)?.clone() ?? new this.THREE.Color(0x888888))
    mv.mesh.material = Array.isArray(mv.origMaterial) ? cloned : cloned[0]
  }

  /** Clone the geometry (vertex edits); false when its positions cannot be edited. */
  ownGeometry(mv: MeshVis): boolean {
    if (mv.ownGeo) return true
    const pos = positionAttr(mv.mesh.geometry)
    if (!pos) return false
    mv.ownGeo = true
    const g = mv.mesh.geometry.clone()
    mv.mesh.geometry = g
    mv.work = new Float32Array((positionAttr(g) as THREE_NS.BufferAttribute).array as ArrayLike<number>)
    return true
  }

  // ------------------------------------------------------------------------------------------------------------------------------------
  // Dents
  // ------------------------------------------------------------------------------------------------------------------------------------

  /**
   * Push the vertices of the mesh within `dent.radius` of `worldPoint` inwards along `worldNormal` by `depth * (1 - (d/r)^2)^2`.
   * Returns false when nothing was changed (too far, low quality on a heavy mesh, or no editable positions).
   */
  applyDent(mv: MeshVis, worldPoint: THREE_NS.Vector3, worldNormal: THREE_NS.Vector3, dent: Dent): boolean {
    const mesh = mv.mesh
    if (this.lowQuality && this.vertexCount(mv) > 20000) return false
    mesh.updateWorldMatrix(true, false)
    const s = mesh.matrixWorld.getMaxScaleOnAxis() || 1
    const lp = mesh.worldToLocal(this.a.copy(worldPoint))
    const ln = this.b.copy(worldNormal).transformDirection(this.m4.copy(mesh.matrixWorld).invert()).normalize()
    const r = dent.radius / s
    const depth = dent.depth / s
    // quick reject: the point must be near the mesh bounds
    const geo = mesh.geometry
    if (!geo.boundingBox) geo.computeBoundingBox()
    if (geo.boundingBox && geo.boundingBox.distanceToPoint(lp) > r) return false
    if (!this.ownGeometry(mv)) return false
    const work = mv.work as Float32Array
    const pos = positionAttr(mesh.geometry) as THREE_NS.BufferAttribute
    const r2 = r * r
    let touched = false
    const px = lp.x
    const py = lp.y
    const pz = lp.z
    const nx = ln.x
    const ny = ln.y
    const nz = ln.z
    for (let i = 0; i < work.length; i += 3) {
      const dx = work[i] - px
      const dy = work[i + 1] - py
      const dz = work[i + 2] - pz
      const d2 = dx * dx + dy * dy + dz * dz
      if (d2 >= r2) continue
      const f = 1 - d2 / r2
      const k = depth * f * f
      work[i] -= nx * k
      work[i + 1] -= ny * k
      work[i + 2] -= nz * k
      touched = true
    }
    if (!touched) return false
    this.writePositions(mv, pos)
    return true
  }

  /** Copy `work` (dents) into the geometry, adding the melt sag when the mesh is melting. */
  private writePositions(mv: MeshVis, pos: THREE_NS.BufferAttribute): void {
    const work = mv.work as Float32Array
    const arr = pos.array as unknown as Float32Array
    const melt = mv.meltApplied
    if (melt <= 0 || (this.lowQuality && work.length / 3 > 20000)) {
      arr.set(work)
    } else {
      const geo = mv.mesh.geometry
      if (!geo.boundingBox) geo.computeBoundingBox()
      const bb = geo.boundingBox as THREE_NS.Box3
      const h = Math.max(1e-4, bb.max.y - bb.min.y)
      const minY = bb.min.y
      for (let i = 0, v = 0; i < work.length; i += 3, v++) {
        const n = ((Math.imul(v + 1, 2654435761) >>> 0) % 1000) / 1000
        const n2 = ((Math.imul(v + 7, 40503) >>> 0) % 1000) / 1000
        const lowness = 1 - (work[i + 1] - minY) / h // 1 at the bottom, 0 at the top
        const spread = 1 + 0.12 * melt * (0.4 + n2) * (0.3 + lowness)
        arr[i] = work[i] * spread
        arr[i + 2] = work[i + 2] * spread
        arr[i + 1] = Math.max(minY, work[i + 1] - n * melt * h * 0.08)
      }
    }
    pos.needsUpdate = true
    const geo = mv.mesh.geometry
    geo.computeVertexNormals()
    geo.boundingBox = null
    geo.boundingSphere = null
  }

  // ------------------------------------------------------------------------------------------------------------------------------------
  // Decals
  // ------------------------------------------------------------------------------------------------------------------------------------

  /** Decal pose in mesh space: position and a rotation taking +Z to the surface normal. */
  private decalPose(mesh: Mesh, worldPoint: THREE_NS.Vector3, worldNormal: THREE_NS.Vector3, lift: number): { s: number; pos: THREE_NS.Vector3; quat: THREE_NS.Quaternion } {
    mesh.updateWorldMatrix(true, false)
    const s = mesh.matrixWorld.getMaxScaleOnAxis() || 1
    const ln = worldNormal.clone().transformDirection(this.m4.copy(mesh.matrixWorld).invert()).normalize()
    const pos = mesh.worldToLocal(worldPoint.clone()).addScaledVector(ln, lift / s)
    const quat = new this.THREE.Quaternion().setFromUnitVectors(new this.THREE.Vector3(0, 0, 1), ln)
    return { s, pos, quat }
  }

  private addDecal(mv: MeshVis, decal: Decal): void {
    mv.mesh.add(decal.obj)
    mv.decals.push(decal)
    this.decalCount++
    while (mv.decals.length > 48 || this.decalCount > this.decalCap) {
      const old = mv.decals.shift()
      if (!old) break
      this.disposeDecal(old)
    }
  }

  private disposeDecal(d: Decal): void {
    d.obj.parent?.remove(d.obj)
    d.geometry?.dispose()
    this.decalCount = Math.max(0, this.decalCount - 1)
  }

  addHole(mv: MeshVis, worldPoint: THREE_NS.Vector3, worldNormal: THREE_NS.Vector3, diameter: number): void {
    const { s, pos, quat } = this.decalPose(mv.mesh, worldPoint, worldNormal, 0.0025)
    const disc = new this.THREE.Mesh(this.kit.discGeometry(), this.kit.discMaterial())
    disc.position.copy(pos)
    disc.quaternion.copy(quat)
    disc.scale.setScalar((Math.max(0.004, diameter) * 0.5 * 1.25) / s)
    disc.renderOrder = 2
    this.addDecal(mv, { obj: disc })
  }

  /** A star of jagged lines: `rays` rays up to `length` metres, seeded so the same event always draws the same star. */
  addCrack(mv: MeshVis, worldPoint: THREE_NS.Vector3, worldNormal: THREE_NS.Vector3, rays: number, length: number, color: number, seed: number): void {
    const { s, pos, quat } = this.decalPose(mv.mesh, worldPoint, worldNormal, 0.002)
    const rnd = createRng(seed)
    const verts: number[] = []
    const n = clamp(Math.round(rays), 3, 16)
    const L = Math.max(0.02, length) / s
    for (let r = 0; r < n; r++) {
      let ang = (r / n) * Math.PI * 2 + (rnd() - 0.5) * 0.5
      let x = 0
      let y = 0
      const segs = 3
      const total = L * (0.6 + 0.4 * rnd())
      for (let k = 0; k < segs; k++) {
        const step = (total / segs) * (0.7 + 0.6 * rnd())
        ang += (rnd() - 0.5) * 0.45
        const nx = x + Math.cos(ang) * step
        const ny = y + Math.sin(ang) * step
        verts.push(x, y, 0, nx, ny, 0)
        if (k > 0 && rnd() < 0.5) {
          const ba = ang + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.5)
          const bl = step * (0.6 + 0.6 * rnd())
          verts.push(nx, ny, 0, nx + Math.cos(ba) * bl, ny + Math.sin(ba) * bl, 0)
        }
        x = nx
        y = ny
      }
    }
    // a faint ring around the impact
    const ringR = L * 0.12
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * Math.PI * 2
      const a1 = ((k + 1) / 8) * Math.PI * 2
      if (rnd() < 0.75) verts.push(Math.cos(a0) * ringR, Math.sin(a0) * ringR, 0, Math.cos(a1) * ringR, Math.sin(a1) * ringR, 0)
    }
    const geo = new this.THREE.BufferGeometry()
    geo.setAttribute('position', new this.THREE.Float32BufferAttribute(verts, 3))
    const lines = new this.THREE.LineSegments(geo, this.kit.lineMaterial(color))
    lines.position.copy(pos)
    lines.quaternion.copy(quat)
    lines.renderOrder = 2
    this.addDecal(mv, { obj: lines, geometry: geo })
  }

  // ------------------------------------------------------------------------------------------------------------------------------------
  // Char and heat glow
  // ------------------------------------------------------------------------------------------------------------------------------------

  setChar(pv: PartVis, char: number, charColor: number): void {
    if (Math.abs(char - pv.charApplied) < 0.004) return
    pv.charApplied = char
    const target = new this.THREE.Color(charColor)
    for (const mv of pv.meshes) {
      this.ownMaterial(mv)
      const mats = materialsOf(mv.mesh.material)
      mats.forEach((m, i) => {
        const c = colorOf(m)
        const base = mv.baseColors?.[i]
        if (c && base) c.copy(base).lerp(target, clamp(char, 0, 1))
      })
    }
  }

  /** Emissive glow of a hot part. `temperature` below the glow threshold switches it off. */
  setGlow(pv: PartVis, temperatureC: number): void {
    const hex = heatColor(temperatureC)
    const key = hex === 0 ? 0 : Math.round(temperatureC / 5) * 5
    if (key === pv.glowApplied) return
    pv.glowApplied = key
    const intensity = hex === 0 ? 0 : clamp(0.35 + (temperatureC - 450) / 900, 0, 1.4)
    for (const mv of pv.meshes) {
      this.ownMaterial(mv)
      for (const m of materialsOf(mv.mesh.material)) {
        const e = (m as THREE_NS.MeshStandardMaterial).emissive
        if (e && (e as THREE_NS.Color).isColor) {
          e.setHex(hex)
          ;(m as THREE_NS.MeshStandardMaterial).emissiveIntensity = intensity
        }
      }
    }
  }

  // ------------------------------------------------------------------------------------------------------------------------------------
  // Melt
  // ------------------------------------------------------------------------------------------------------------------------------------

  /** Sag the part: shorter in Y (down to 25 %), a bit wider, vertices pushed down with noise, the bottom stays put. */
  setMelt(pv: PartVis, melt: number): void {
    const m = clamp(melt, 0, 1)
    if (Math.abs(m - pv.meltApplied) < 0.01) return
    pv.meltApplied = m
    for (const mv of pv.meshes) {
      const mesh = mv.mesh
      if (mv.meltApplied === 0 && m > 0) {
        mesh.updateWorldMatrix(true, false)
        mv.bottomY = this.box.setFromObject(mesh).min.y
      }
      mv.meltApplied = m
      mv.moved = true
      const sy = lerp(1, 0.25, m)
      const sxz = 1 + 0.18 * m
      mesh.scale.set(mv.origScale.x * sxz, mv.origScale.y * sy, mv.origScale.z * sxz)
      mesh.position.copy(mv.origPosition)
      mesh.updateWorldMatrix(true, false)
      const bottom = this.box.setFromObject(mesh).min.y
      const dy = mv.bottomY - bottom
      if (Math.abs(dy) > 1e-6 && mesh.parent) {
        mesh.parent.updateWorldMatrix(true, false)
        const inv = this.m4.copy(mesh.parent.matrixWorld).invert()
        this.a.set(0, dy, 0).applyMatrix4(inv)
        this.b.set(0, 0, 0).applyMatrix4(inv)
        mesh.position.copy(mv.origPosition).add(this.a.sub(this.b))
      }
      if (!(this.lowQuality && this.vertexCount(mv) > 20000) && this.ownGeometry(mv)) {
        this.writePositions(mv, positionAttr(mesh.geometry) as THREE_NS.BufferAttribute)
      }
    }
  }

  // ------------------------------------------------------------------------------------------------------------------------------------
  // Visibility and restore
  // ------------------------------------------------------------------------------------------------------------------------------------

  hide(pv: PartVis, reason: PartVis['gone']): void {
    pv.gone = reason
    for (const mv of pv.meshes) mv.mesh.visible = false
  }

  /** Bring one mesh back to how it was when it was bound. */
  restoreMesh(mv: MeshVis): void {
    const mesh = mv.mesh
    for (const d of mv.decals) this.disposeDecal(d)
    mv.decals.length = 0
    if (mv.ownGeo) {
      mesh.geometry.dispose()
      mesh.geometry = mv.origGeometry
      mv.ownGeo = false
      mv.work = null
    }
    if (mv.ownMat) {
      for (const m of materialsOf(mesh.material)) m.dispose()
      mesh.material = mv.origMaterial
      mv.ownMat = false
      mv.baseColors = null
    }
    mesh.visible = mv.origVisible
    if (mv.origParent && mesh.parent !== mv.origParent) {
      mv.origParent.add(mesh)
      mv.moved = true
    }
    if (mv.moved) {
      mesh.position.copy(mv.origPosition)
      mesh.quaternion.copy(mv.origQuaternion)
      mesh.scale.copy(mv.origScale)
      mv.moved = false
    }
    mv.meltApplied = 0
  }

  restorePart(pv: PartVis): void {
    for (const mv of pv.meshes) this.restoreMesh(mv)
    pv.charApplied = 0
    pv.glowApplied = 0
    pv.meltApplied = 0
    pv.gone = 'none'
  }

  dispose(): void {
    this.kit.dispose()
  }
}
