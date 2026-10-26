import type * as THREE_NS from 'three'
import type { Dent } from '@adatechnology/game-destruction'
import { heatColor } from './heat'
import type { Decal, HostVis, MeshVis, PartVis } from './internal'
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
  private patchMats = new Map<number, THREE_NS.MeshBasicMaterial>()
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

  /** Opaque patch in the colour of what shows under a spalled coat. */
  patchMaterial(color: number): THREE_NS.MeshBasicMaterial {
    let m = this.patchMats.get(color)
    if (!m) {
      m = new this.THREE.MeshBasicMaterial({ color, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
      this.patchMats.set(color, m)
    }
    return m
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
    for (const m of this.patchMats.values()) m.dispose()
    this.patchMats.clear()
    this.disc = null
    this.discMat = null
    this.lineMats.clear()
  }
}

const tmpV = (THREE: typeof THREE_NS) => new THREE.Vector3()

/** Mesh-level visual changes: copy-on-write geometry and materials, dents, decals, char, glow, melt, hiding, restoring. */
/** A dent that finds fewer vertices than this on its mesh widens its radius (see `Visuals.applyDent`). */
const MIN_DENT_VERTICES = 3
/** The widened radius is this many times the distance to the nearest vertex, so the nearest ones are inside with a visible falloff. */
const WIDEN_PER_SPACING = 1.5

export class Visuals {
  readonly kit: DecalKit
  private readonly a: THREE_NS.Vector3
  private readonly b: THREE_NS.Vector3
  private readonly m4: THREE_NS.Matrix4
  private readonly box: THREE_NS.Box3
  private readonly t: THREE_NS.Vector3
  private readonly lbox: THREE_NS.Box3
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
    this.t = tmpV(THREE)
    this.lbox = new THREE.Box3()
  }

  /**
   * @param range vertex range `[v0, v1)` of a merged mesh this part is drawn by (see `MeshRange`); `hosts` caches the shared state per mesh for one `bind`.
   */
  makeMeshVis(mesh: Mesh, home: string, range?: [number, number], hosts?: Map<Mesh, HostVis>): MeshVis {
    let host: HostVis | null = null
    if (range) {
      host = hosts?.get(mesh) ?? null
      if (!host) {
        host = { mesh, origGeometry: mesh.geometry, origMaterial: mesh.material, ownGeo: false, work: null, ownMat: false, sharers: [] }
        hosts?.set(mesh, host)
      }
    }
    const mv: MeshVis = {
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
      host,
      range: range ? [range[0], range[1]] : null,
      merged: host && range ? { host, range: [range[0], range[1]] } : null,
      loose: false,
      collapsed: false,
      hidden: false,
      touched: false,
      charK: 0,
      charHex: 0,
      glowHex: 0,
      glowK: 0,
    }
    host?.sharers.push(mv)
    return mv
  }

  vertexCount(mv: MeshVis): number {
    if (mv.range) return mv.range[1] - mv.range[0]
    return mv.mesh.geometry.getAttribute(POS_ATTR)?.count ?? 0
  }

  /** Is the part drawn? (A ranged part shares its mesh, so `mesh.visible` says nothing about it.) */
  shown(mv: MeshVis): boolean {
    return mv.host ? !mv.hidden : mv.mesh.visible
  }

  /** Box of the part's vertices in the space of its mesh (the whole geometry for a plain mesh). */
  localBox(mv: MeshVis, out: THREE_NS.Box3): THREE_NS.Box3 {
    out.makeEmpty()
    if (!mv.host || !mv.range) {
      const geo = mv.mesh.geometry
      if (!geo.boundingBox) geo.computeBoundingBox()
      return geo.boundingBox ? out.copy(geo.boundingBox) : out
    }
    const arr = mv.host.work ?? (positionAttr(mv.mesh.geometry)?.array as unknown as ArrayLike<number> | undefined)
    if (!arr) return out
    for (let i = mv.range[0] * 3; i < mv.range[1] * 3; i += 3) out.expandByPoint(this.t.set(arr[i], arr[i + 1], arr[i + 2]))
    return out
  }

  /** Box of the part in world space. */
  worldBox(mv: MeshVis, out: THREE_NS.Box3): THREE_NS.Box3 {
    if (!mv.host) return out.setFromObject(mv.mesh)
    this.localBox(mv, out)
    mv.mesh.updateWorldMatrix(true, false)
    return out.isEmpty() ? out : out.applyMatrix4(mv.mesh.matrixWorld)
  }

  private readonly tints = new WeakMap<MeshVis, THREE_NS.Color | null>()

  /**
   * Average vertex colour of a mesh whose material uses `vertexColors` (computed once per mesh, from its original geometry), else null. Fragments
   * and debris of such a mesh multiply it by `material.color`; without it they come out white.
   */
  vertexTint(mv: MeshVis): THREE_NS.Color | null {
    if (this.tints.has(mv)) return this.tints.get(mv) ?? null
    let tint: THREE_NS.Color | null = null
    const used = materialsOf(mv.origMaterial).some((m) => (m as THREE_NS.MeshStandardMaterial).vertexColors === true)
    const attr = used ? (mv.origGeometry.getAttribute('color') as THREE_NS.BufferAttribute | undefined) : undefined
    if (attr && attr.count > 0 && attr.itemSize >= 3) {
      // a ranged part averages its own vertices only
      const from = mv.merged ? mv.merged.range[0] : 0
      const to = mv.merged ? Math.min(attr.count, mv.merged.range[1]) : attr.count
      let r = 0, g = 0, b = 0
      for (let i = from; i < to; i++) {
        r += attr.getX(i)
        g += attr.getY(i)
        b += attr.getZ(i)
      }
      const n = Math.max(1, to - from)
      tint = new this.THREE.Color(r / n, g / n, b / n)
    }
    this.tints.set(mv, tint)
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
    if (mv.host) return this.ownHostGeometry(mv.host)
    if (mv.ownGeo) return true
    const pos = positionAttr(mv.mesh.geometry)
    if (!pos) return false
    mv.ownGeo = true
    const g = mv.mesh.geometry.clone()
    mv.mesh.geometry = g
    mv.work = new Float32Array((positionAttr(g) as THREE_NS.BufferAttribute).array as ArrayLike<number>)
    return true
  }

  private ownHostGeometry(host: HostVis): boolean {
    if (host.ownGeo) return true
    const pos = positionAttr(host.mesh.geometry)
    if (!pos) return false
    host.ownGeo = true
    const g = host.mesh.geometry.clone()
    host.mesh.geometry = g
    host.work = new Float32Array((positionAttr(g) as THREE_NS.BufferAttribute).array as ArrayLike<number>)
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
    let bb: THREE_NS.Box3 | null
    if (mv.host) bb = this.localBox(mv, this.lbox)
    else {
      if (!geo.boundingBox) geo.computeBoundingBox()
      bb = geo.boundingBox
    }
    if (bb && !bb.isEmpty() && bb.distanceToPoint(lp) > r) return false
    if (!this.ownGeometry(mv)) return false
    const work = (mv.host ? mv.host.work : mv.work) as Float32Array
    const pos = positionAttr(mesh.geometry) as THREE_NS.BufferAttribute
    const from = mv.range ? mv.range[0] * 3 : 0
    const to = mv.range ? mv.range[1] * 3 : work.length
    let reach = r
    let pass = this.nearestAndCount(work, from, to, lp, reach)
    // a mesh coarser than the dent would swallow it silently: widen to the local vertex spacing so at least the nearest vertices give
    if (pass.count < MIN_DENT_VERTICES && pass.nearest < Infinity) {
      reach = Math.max(r, pass.nearest * WIDEN_PER_SPACING)
      pass = this.nearestAndCount(work, from, to, lp, reach)
    }
    if (pass.count === 0) return false
    const reach2 = reach * reach
    for (let i = from; i < to; i += 3) {
      const dx = work[i] - lp.x
      const dy = work[i + 1] - lp.y
      const dz = work[i + 2] - lp.z
      const d2 = dx * dx + dy * dy + dz * dz
      if (d2 >= reach2) continue
      const f = 1 - d2 / reach2
      const k = depth * f * f
      work[i] -= ln.x * k
      work[i + 1] -= ln.y * k
      work[i + 2] -= ln.z * k
    }
    mv.touched = true
    this.writePositions(mv, pos)
    return true
  }

  /** Vertices of `work[from, to)` within `reach` of `point`, and the distance to the nearest vertex of the whole range. */
  private nearestAndCount(work: Float32Array, from: number, to: number, point: THREE_NS.Vector3, reach: number): { count: number; nearest: number } {
    const reach2 = reach * reach
    let count = 0
    let nearest2 = Infinity
    for (let i = from; i < to; i += 3) {
      const dx = work[i] - point.x
      const dy = work[i + 1] - point.y
      const dz = work[i + 2] - point.z
      const d2 = dx * dx + dy * dy + dz * dz
      if (d2 < nearest2) nearest2 = d2
      if (d2 < reach2) count++
    }
    return { count, nearest: Math.sqrt(nearest2) }
  }

  /** Copy `work` (dents) into the geometry, adding the melt sag when the mesh is melting. */
  private writePositions(mv: MeshVis, pos: THREE_NS.BufferAttribute): void {
    if (mv.host) {
      this.rebuildHost(mv.host)
      return
    }
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

  /** A patch where a surface coat came off, in the colour of the core under it; drawn under the bullet holes. */
  addSpall(mv: MeshVis, worldPoint: THREE_NS.Vector3, worldNormal: THREE_NS.Vector3, radius: number, color: number): void {
    const { s, pos, quat } = this.decalPose(mv.mesh, worldPoint, worldNormal, 0.0015)
    const disc = new this.THREE.Mesh(this.kit.discGeometry(), this.kit.patchMaterial(color))
    disc.position.copy(pos)
    disc.quaternion.copy(quat)
    disc.scale.setScalar(Math.max(0.01, radius) / s)
    disc.renderOrder = 1
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
      if (mv.host) {
        mv.charK = clamp(char, 0, 1)
        mv.charHex = charColor
        this.paint(mv)
        continue
      }
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
      if (mv.host) {
        mv.glowHex = hex
        mv.glowK = intensity
        this.paint(mv)
        continue
      }
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
      if (mv.host) {
        // a range of a shared mesh cannot scale the mesh: squash and widen its own vertices
        mv.meltApplied = m
        mv.touched = true
        if (!(this.lowQuality && this.vertexCount(mv) > 20000) && this.ownGeometry(mv)) this.rebuildHost(mv.host)
        continue
      }
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
    for (const mv of pv.meshes) {
      if (!mv.host || mv.loose) {
        mv.mesh.visible = false
        mv.hidden = true
        continue
      }
      // a range of a shared mesh: collapse its vertices to a point and hide what was drawn on it
      mv.hidden = true
      for (const d of mv.decals) d.obj.visible = false
      this.collapse(mv)
    }
  }

  // ------------------------------------------------------------------------------------------------------------------------------------
  // Parts drawn by a vertex range of a merged mesh
  // ------------------------------------------------------------------------------------------------------------------------------------

  /** Collapse the part's vertices in the merged mesh to one point (its triangles become degenerate and vanish). */
  private collapse(mv: MeshVis): void {
    if (!mv.merged || !this.ownHostGeometry(mv.merged.host)) return
    mv.collapsed = true
    mv.touched = true
    this.rebuildHost(mv.merged.host)
  }

  /** Write `work` into the geometry again with the melt of ranged parts and the collapsed ranges applied. */
  private rebuildHost(host: HostVis): void {
    const geo = host.mesh.geometry
    const pos = positionAttr(geo)
    const work = host.work
    if (!pos || !work) return
    const arr = pos.array as unknown as Float32Array
    arr.set(work)
    for (const s of host.sharers) {
      if (s.merged && s.merged.host === host) {
        if (s.collapsed) this.collapseRange(arr, s.merged.range)
        else if (s.meltApplied > 0 && !s.loose) this.meltRange(arr, work, s.merged.range, s.meltApplied)
      } else if (s.host === host && s.range && s.meltApplied > 0) this.meltRange(arr, work, s.range, s.meltApplied)
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
    geo.boundingBox = null
    geo.boundingSphere = null
  }

  private collapseRange(arr: Float32Array, range: [number, number]): void {
    const x = arr[range[0] * 3]
    const y = arr[range[0] * 3 + 1]
    const z = arr[range[0] * 3 + 2]
    for (let i = range[0] * 3; i < range[1] * 3; i += 3) {
      arr[i] = x
      arr[i + 1] = y
      arr[i + 2] = z
    }
  }

  /** Melt of one range: shorter in Y (down to 25 %) with the bottom fixed, a bit wider around its centre, with the same noise as a whole mesh. */
  private meltRange(arr: Float32Array, work: Float32Array, range: [number, number], melt: number): void {
    let minY = Infinity
    let maxY = -Infinity
    let cx = 0
    let cz = 0
    const n = Math.max(1, range[1] - range[0])
    for (let i = range[0] * 3; i < range[1] * 3; i += 3) {
      minY = Math.min(minY, work[i + 1])
      maxY = Math.max(maxY, work[i + 1])
      cx += work[i]
      cz += work[i + 2]
    }
    cx /= n
    cz /= n
    const h = Math.max(1e-4, maxY - minY)
    const sy = lerp(1, 0.25, melt)
    const sxz = 1 + 0.18 * melt
    for (let i = range[0] * 3, v = 0; i < range[1] * 3; i += 3, v++) {
      const noise = ((Math.imul(v + 1, 2654435761) >>> 0) % 1000) / 1000
      arr[i] = cx + (work[i] - cx) * sxz
      arr[i + 2] = cz + (work[i + 2] - cz) * sxz
      arr[i + 1] = Math.max(minY, minY + (work[i + 1] - minY) * sy - noise * melt * h * 0.04)
    }
  }

  /** The colour attribute of the host's current geometry (created white when there is none) with vertex colours switched on in its material. */
  private ensureColors(host: HostVis): THREE_NS.BufferAttribute | null {
    if (!this.ownHostGeometry(host)) return null
    const geo = host.mesh.geometry
    let attr = geo.getAttribute('color') as THREE_NS.BufferAttribute | undefined
    if (!attr) {
      const n = geo.getAttribute(POS_ATTR).count
      attr = new this.THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3)
      geo.setAttribute('color', attr)
    }
    if (!host.ownMat) {
      host.ownMat = true
      const src = materialsOf(host.mesh.material)
      const cloned = src.map((m) => m.clone())
      host.mesh.material = Array.isArray(host.mesh.material) ? cloned : cloned[0]
    }
    for (const m of materialsOf(host.mesh.material)) {
      if ((m as THREE_NS.MeshStandardMaterial).vertexColors !== true) {
        ;(m as THREE_NS.MeshStandardMaterial).vertexColors = true
        m.needsUpdate = true
      }
    }
    return attr
  }

  /** Colour of the part's vertices from the original colours, its char and its heat. Only the part's range is written. */
  private paint(mv: MeshVis): void {
    if (!mv.host || !mv.range || !mv.merged) return
    const idle = mv.charK <= 0 && mv.glowK <= 0
    if (idle && !mv.touched) return
    const attr = this.ensureColors(mv.host)
    if (!attr) return
    const size = attr.itemSize
    const arr = attr.array as unknown as Float32Array
    const orig = mv.merged.host.origGeometry.getAttribute('color') as THREE_NS.BufferAttribute | undefined
    const oSize = orig?.itemSize ?? 3
    const oArr = orig?.array as unknown as ArrayLike<number> | undefined
    const shift = mv.merged.range[0] - mv.range[0]
    const ch = new this.THREE.Color(mv.charHex)
    const heat = new this.THREE.Color(mv.glowHex)
    const k = clamp(mv.charK, 0, 1)
    const gk = clamp(mv.glowK, 0, 1)
    const boost = 1 + Math.max(0, mv.glowK - 1)
    for (let i = mv.range[0]; i < mv.range[1]; i++) {
      const o = (i + shift) * oSize
      let r = oArr ? oArr[o] : 1
      let g = oArr ? oArr[o + 1] : 1
      let b = oArr ? oArr[o + 2] : 1
      if (k > 0) {
        r = lerp(r, ch.r, k)
        g = lerp(g, ch.g, k)
        b = lerp(b, ch.b, k)
      }
      if (gk > 0) {
        r = lerp(r, heat.r * boost, gk)
        g = lerp(g, heat.g * boost, gk)
        b = lerp(b, heat.b * boost, gk)
      }
      arr[i * size] = r
      arr[i * size + 1] = g
      arr[i * size + 2] = b
    }
    mv.touched = true
    attr.needsUpdate = true
  }

  /**
   * Move a ranged part to a mesh of its own: the faces whose vertices all lie in its range are copied (with the current dents and colours) into a
   * new mesh that takes the merged mesh's transform and material, then attached to `group`; the range is collapsed in the merged mesh. Decals
   * go with it.
   */
  extract(mv: MeshVis, group: THREE_NS.Object3D): void {
    if (!mv.host || !mv.range || !mv.merged || mv.loose) return
    const host = mv.host
    const [v0, v1] = mv.range
    const src = host.mesh.geometry
    const geo = new this.THREE.BufferGeometry()
    const count = v1 - v0
    for (const name of Object.keys(src.attributes)) {
      const a = src.getAttribute(name) as THREE_NS.BufferAttribute
      if ((a as unknown as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute) continue
      const size = a.itemSize
      const from = (name === POS_ATTR ? host.work : null) ?? (a.array as unknown as Float32Array)
      const slice = (from as unknown as { slice(a: number, b: number): ArrayLike<number> }).slice(v0 * size, v1 * size)
      const Ctor = (a.array as unknown as { constructor: new (x: ArrayLike<number>) => ArrayLike<number> }).constructor
      geo.setAttribute(name, new this.THREE.BufferAttribute(new Ctor(slice) as never, size, a.normalized))
    }
    const index = src.getIndex()
    if (index) {
      const out: number[] = []
      for (let i = 0; i + 2 < index.count; i += 3) {
        const a = index.getX(i)
        const b = index.getX(i + 1)
        const c = index.getX(i + 2)
        if (a >= v0 && a < v1 && b >= v0 && b < v1 && c >= v0 && c < v1) out.push(a - v0, b - v0, c - v0)
      }
      geo.setIndex(count > 65535 ? new this.THREE.Uint32BufferAttribute(out, 1) : new this.THREE.Uint16BufferAttribute(out, 1))
    }
    const mats = materialsOf(host.mesh.material).map((m) => m.clone())
    const loose = new this.THREE.Mesh(geo, mats[0])
    loose.name = `${host.mesh.name || 'mesh'}:${v0}-${v1}`
    loose.castShadow = host.mesh.castShadow
    loose.receiveShadow = host.mesh.receiveShadow
    loose.renderOrder = host.mesh.renderOrder
    loose.frustumCulled = host.mesh.frustumCulled
    loose.layers.mask = host.mesh.layers.mask
    loose.position.copy(host.mesh.position)
    loose.quaternion.copy(host.mesh.quaternion)
    loose.scale.copy(host.mesh.scale)
    const parent = host.mesh.parent
    if (parent) parent.add(loose)
    loose.updateMatrixWorld(true)
    // the merged mesh loses the range; the decals and the part's state follow the new mesh
    this.collapse(mv)
    for (const d of mv.decals) {
      d.obj.visible = true
      loose.add(d.obj)
    }
    const lp = positionAttr(geo) as THREE_NS.BufferAttribute
    const lh: HostVis = {
      mesh: loose,
      origGeometry: geo,
      origMaterial: loose.material,
      ownGeo: true,
      work: new Float32Array(lp.array as ArrayLike<number>),
      ownMat: true,
      sharers: [mv],
    }
    mv.host = lh
    mv.range = [0, count]
    mv.mesh = loose
    mv.loose = true
    mv.moved = true
    group.attach(loose)
    for (const m of materialsOf(loose.material)) m.needsUpdate = true
  }

  private restoreRanged(mv: MeshVis): void {
    const merged = mv.merged as NonNullable<MeshVis['merged']>
    const host = merged.host
    for (const d of mv.decals) this.disposeDecal(d)
    mv.decals.length = 0
    if (mv.loose) {
      const loose = mv.mesh
      loose.parent?.remove(loose)
      loose.geometry.dispose()
      for (const m of materialsOf(loose.material)) m.dispose()
      mv.host = host
      mv.range = [merged.range[0], merged.range[1]]
      mv.mesh = host.mesh
      mv.loose = false
      mv.moved = false
    }
    mv.collapsed = false
    mv.hidden = false
    mv.meltApplied = 0
    mv.charK = 0
    mv.glowK = 0
    mv.touched = false
    if (!host.ownGeo) return
    // positions and colours of the range go back to the original ones
    const work = host.work as Float32Array
    const op = positionAttr(host.origGeometry)
    const [v0, v1] = merged.range
    if (op) work.set((op.array as unknown as Float32Array).subarray(v0 * 3, v1 * 3), v0 * 3)
    const attr = host.mesh.geometry.getAttribute('color') as THREE_NS.BufferAttribute | undefined
    if (attr) {
      const orig = host.origGeometry.getAttribute('color') as THREE_NS.BufferAttribute | undefined
      const size = attr.itemSize
      const a = attr.array as unknown as Float32Array
      for (let i = v0; i < v1; i++) {
        for (let c = 0; c < 3; c++) a[i * size + c] = orig ? orig.array[i * orig.itemSize + c] : 1
      }
      attr.needsUpdate = true
    }
    if (host.sharers.every((s) => !s.touched)) {
      host.mesh.geometry.dispose()
      host.mesh.geometry = host.origGeometry
      host.work = null
      host.ownGeo = false
      if (host.ownMat) {
        for (const m of materialsOf(host.mesh.material)) m.dispose()
        host.mesh.material = host.origMaterial
        host.ownMat = false
      }
    } else this.rebuildHost(host)
  }

  /** Bring one mesh back to how it was when it was bound. */
  restoreMesh(mv: MeshVis): void {
    if (mv.merged) {
      this.restoreRanged(mv)
      return
    }
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
