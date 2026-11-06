/** Glass panes: windshield quads, side windows and ghost glass. */
import type { BufferGeometry, Material, Mesh, Object3D, Vector2, Vector3 } from 'three'

import type { LabelArgument } from './context'
import type { CutTest, TumbleSpec } from './geometry'
import type { BuildContext, Kit } from './types'

/** How a pane is made: its material, outline and seat on the body (side windows), the uv aspect, where its part sits and how far it reaches. */
export type GlassOptions = {
  reuv?: boolean
  uvAxes?: string
  mat?: Material
  outline?: Vector2[] | null
  side?: number
  Wg?: number
  T?: TumbleSpec | null
  zpos?: number
  aspect?: number
  pos?: Vector3
  reach?: number
}
export type PaneLook = { type?: string; mat?: Material; see?: boolean }
/** A windshield or rear window between the base point `pb` and the top `pt` of its pillar line (`kit.quadDef`). */
export type GlassQuad = {
  pb: number[]
  pt: number[]
  L: number
  u: number[]
  n: number[]
  ins: number
  b: number[]
  t: number[]
  hb: number
  ht: number
  which: string
  bev: number
  Wg: number
  T: TumbleSpec | null | undefined
}

export function installGlass(kit: Kit) {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const I = kit._
  const { MATERIALS, crease, cutGeometry, pathShape, subdivide, tumble, uvProject } = I

  /* the rubber around a side window, by its pane: it goes where the pane goes */
  const paneSeals = new WeakMap<Object3D, Mesh>()
  I.paneSeals = paneSeals

  /* ================= glass ================= */
  kit.addGlass = function (c: BuildContext, geo: BufferGeometry, label: LabelArgument, type?: string, o?: GlassOptions | null) {
    o = o || {}
    if (!geo.attributes.uv || o.reuv) o.aspect = uvProject(geo, o.uvAxes)
    const m = c.add(geo, o.mat || MATERIALS.glass)
    m.castShadow = false
    m.receiveShadow = false
    m.renderOrder = 2
    const L = I.resolveLabel(label)
    m.userData.glass = {
      type: type || 'tempered',
      label: L.label,
      key: L.key,
      outline: o.outline || null,
      side: o.side,
      Wg: o.Wg,
      T: o.T,
      zpos: o.zpos,
      aspect: o.aspect || 1,
      hits: 0,
      broken: false,
    }
    c.glass.push(m)
    c.deform.push(m)
    let pos = o.pos
    if (!pos) {
      geo.computeBoundingBox()
      pos = geo.boundingBox!.getCenter(new V3()).add(m.position)
    }
    c.part('glass', L, m, pos, o.reach || 0.9)
    return m
  }
  /* registers a ready mesh (roundBox, sphere...) as glass; type "laminated" cracks, "tempered" shatters */
  kit.asGlass = function (c: BuildContext, mesh: Mesh, label: LabelArgument, type: string, o?: GlassOptions | null) {
    o = o || {}
    const i = c.deform.indexOf(mesh)
    if (i >= 0) c.deform.splice(i, 1)
    if (mesh.parent) mesh.parent.remove(mesh)
    const geo = mesh.geometry
    geo.applyMatrix4(new THREE.Matrix4().compose(mesh.position, mesh.quaternion, mesh.scale))
    if (o.reuv !== false) o.reuv = true
    return kit.addGlass(c, geo, label, type, Object.assign({ mat: mesh.material }, o))
  }
  kit.sideWindows = function (c: BuildContext, polys: number[][][], Wg: number, T: TumbleSpec | null | undefined, label: ((i: number, n: number) => LabelArgument) | null | undefined, o?: (PaneLook & { sides?: number[] }) | null) {
    o = o || {}
    ;(o.sides || [1, -1]).forEach(function (s: number) {
      polys.forEach(function (poly: number[][], i: number) {
        const shp = pathShape(
          poly.map(function (p) {
            return [p[0], p[1], 0.035]
          }),
        )
        const geo = new THREE.ExtrudeGeometry(shp, { depth: 0.008, bevelEnabled: false, curveSegments: 4 })
        const zpos = s > 0 ? Wg / 2 + 0.004 : -Wg / 2 - 0.012
        geo.translate(0, 0, zpos)
        tumble(geo, T)
        geo.computeVertexNormals()
        const asp = uvProject(geo, 'xy')
        let cx = 0
        let cy = 0
        poly.forEach(function (p: number[]) {
          cx += p[0]
          cy += p[1]
        })
        cx /= poly.length
        cy /= poly.length
        const base = I.resolveLabel(label ? label(i, polys.length) : { key: 'window' })
        const lab = { key: base.key, label: kit.t('parts.glass_side', { label: base.label, s }) }
        const pane = kit.addGlass(c, geo, lab, o.type || 'tempered', {
          mat: o.mat || (o.see === false ? MATERIALS.glassDark : MATERIALS.glass),
          pos: new V3(cx, cy, s * I.halfAt(Wg, T, cy)),
          outline: shp.getSpacedPoints(56),
          side: s,
          Wg: Wg,
          T: T,
          zpos: zpos,
          aspect: asp,
        })
        const pts = shp.getSpacedPoints(36).map(function (p) {
          return [p.x, p.y, s * (I.halfAt(Wg, T, p.y) + 0.005)]
        })
        pts.pop()
        const seal = c.tube(pts, 0.011, MATERIALS.trim, { closed: true, seg: 72, rs: 5 })
        seal.castShadow = false
        I.paneSeals.set(pane, seal)
      })
    })
  }
  /* Cuts a ready mesh (mesh local coordinates) and recomputes the normals. */
  kit.cutMesh = function (mesh: Mesh, tests: CutTest[], deg?: number | null, o?: { sub?: number }) {
    /* o.sub: subdivide first (edges longer than o.sub, in m) for windows inside large faces; drops colour/uv */
    const src = o && o.sub ? subdivide(mesh.geometry, o.sub) : mesh.geometry
    const r = cutGeometry(src, tests)
    crease(r.geo, deg || 42)
    mesh.geometry.dispose()
    mesh.geometry = r.geo
    return r.cut
  }
  kit.quadDef = function (pb: number[], pt: number[], Wg: number, T: TumbleSpec | null | undefined, which: string, bev?: number | null, o?: { inset?: number; side?: number } | null): GlassQuad {
    o = o || {}
    const bv = bev == null ? 0.05 : bev
    const dx = pt[0] - pb[0]
    const dy = pt[1] - pb[1]
    const L = Math.hypot(dx, dy)
    const ux = dx / L
    const uy = dy / L
    const nx = which === 'front' ? uy : -uy
    const ny = which === 'front' ? -ux : ux
    const ins = o.inset || 0.09
    const off = bv + 0.006
    const sd = o.side || 0.1
    const b = [pb[0] + ux * ins + nx * off, pb[1] + uy * ins + ny * off]
    const t = [pt[0] - ux * ins * 1.3 + nx * off, pt[1] - uy * ins * 1.3 + ny * off]
    const hb = I.halfAt(Wg, T, b[1]) - sd
    const ht = I.halfAt(Wg, T, t[1]) - sd
    return { pb: pb, pt: pt, L: L, u: [ux, uy], n: [nx, ny], ins: ins, b: b, t: t, hb: hb, ht: ht, which: which, bev: bv, Wg: Wg, T: T }
  }
  kit.glassQuad = function (c: BuildContext, q: GlassQuad, label: LabelArgument, o?: PaneLook | null) {
    o = o || {}
    const NX = 10
    const NY = 8
    const pos: number[] = []
    const uv: number[] = []
    const idx: number[] = []
    for (let j = 0; j <= NY; j++)
      for (let i = 0; i <= NX; i++) {
        const u = i / NX
        const v = j / NY
        const x = q.b[0] + (q.t[0] - q.b[0]) * v
        const y = q.b[1] + (q.t[1] - q.b[1]) * v
        const hw = q.hb + (q.ht - q.hb) * v
        pos.push(x, y, -hw + 2 * hw * u)
        uv.push(u, v)
      }
    for (let jj = 0; jj < NY; jj++)
      for (let ii = 0; ii < NX; ii++) {
        const a = jj * (NX + 1) + ii
        const b = a + 1
        const cc = a + NX + 2
        const d = a + NX + 1
        if (q.which === 'front') idx.push(a, b, cc, a, cc, d)
        else idx.push(a, cc, b, a, d, cc)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    const m = kit.addGlass(c, g, label, o.type || 'laminated', {
      mat: o.mat || (o.see === false ? MATERIALS.glassDark : MATERIALS.glass),
      pos: new V3((q.b[0] + q.t[0]) / 2, (q.b[1] + q.t[1]) / 2, 0),
      aspect: (q.hb + q.ht) / (q.L - q.ins * 2.3),
      reach: 1.0,
    })
    const B0 = new V3(q.b[0], q.b[1], -q.hb)
    const B1 = new V3(q.b[0], q.b[1], q.hb)
    const T0 = new V3(q.t[0], q.t[1], -q.ht)
    const T1 = new V3(q.t[0], q.t[1], q.ht)
    ;[
      [B0, B1],
      [B1, T1],
      [T1, T0],
      [T0, B0],
    ].forEach(function (e) {
      c.rod(e[0], e[1], 0.012, MATERIALS.trim, { seg: 6 }).castShadow = false
    })
    c.quads.push(q)
    return m
  }

  const shared = { paneSeals }

  Object.assign(I, shared)

  return shared
}
