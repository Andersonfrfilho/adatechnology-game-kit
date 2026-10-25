/** Soft body warp (sculpting) used for panel deformation. */
import type { Kit } from './types'
import { clamp, smooth } from './util'

export function installWarp(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._
  const lod = kit.lod
  const { crease } = I

  /* ================= global rounding (warp), resampled loft ================= */
  /* makeWarp(o) creates f(x, y, z) -> [x, y, z] that rounds the front/rear in plan view and curves the side.
     o: { xF, xR, Lf, Lr, hw, bowF, bowR, pinF, pinR, belt, ys, yb, kt, kb, dropF, dropY }. applyWarp(c, f) deforms everything already assembled. */
  function makeWarp(o: any) {
    function sec(y: any) {
      if (y >= o.belt) return o.kt
      if (y >= o.ys) {
        const a = (y - o.ys) / (o.belt - o.ys)
        return o.kt * a * a
      }
      const b = clamp((o.ys - y) / (o.ys - o.yb), 0, 1.25)
      return o.kb * b * b
    }
    const f = function (x: any, y: any, z: any) {
      const tF = smooth((x - (o.xF - o.Lf)) / o.Lf)
      const tR = smooth((o.xR + o.Lr - x) / o.Lr)
      const u = Math.min(1.15, Math.abs(z) / o.hw)
      const u2 = u * u
      const dropF = o.dropF ? o.dropF * tF * u2 * smooth((y - o.dropY) / 0.25) : 0
      return [x - o.bowF * tF * u2 + o.bowR * tR * u2, y - dropF, z * (1 - sec(y)) * (1 - o.pinF * tF * tF) * (1 - o.pinR * tR * tR)]
    }
    f.sec = sec
    return f
  }
  function applyWarp(c: any, Wf: any) {
    c.root.updateMatrixWorld(true)
    const gInv = new THREE.Matrix4().copy(c.vehicle.matrixWorld).invert()
    const rel = new THREE.Matrix4()
    const irel = new THREE.Matrix4()
    const v = new V3()
    const use = new Map()
    c.root.traverse(function (o: any) {
      if (o.isMesh) use.set(o.geometry, (use.get(o.geometry) || 0) + 1)
    })
    const skip = new Set(c.wheels)
    const dset = new Set(c.deform)
    const yAx = new V3(0, 1, 0)
    function warpMesh(msh: any) {
      const g = msh.geometry
      if (use.get(g) > 1 || !g.attributes.position) return false
      rel.multiplyMatrices(gInv, msh.matrixWorld)
      irel.copy(rel).invert()
      const p = g.attributes.position
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(rel)
        const r = Wf(v.x, v.y, v.z)
        v.set(r[0], r[1], r[2]).applyMatrix4(irel)
        p.setXYZ(i, v.x, v.y, v.z)
      }
      p.needsUpdate = true
      if (g.userData.crease) crease(g, 42)
      else g.computeVertexNormals()
      g.computeBoundingSphere()
      g.computeBoundingBox()
      return true
    }
    function rigid(o: any) {
      const p = o.position
      const r = Wf(p.x, p.y, p.z)
      const a = Wf(p.x, p.y, p.z - 0.03)
      const b = Wf(p.x, p.y, p.z + 0.03)
      const yaw = Math.atan2(b[0] - a[0], b[2] - a[2])
      p.set(r[0], r[1], r[2])
      if (Math.abs(yaw) > 1e-4) o.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(yAx, yaw))
    }
    c.glass.forEach(function (gm: any) {
      const GD = gm.userData.glass
      if (!GD || !GD.outline || GD.zpos == null) return
      let cx = 0
      let cy = 0
      GD.outline.forEach(function (p: any) {
        cx += p.x
        cy += p.y
      })
      cx /= GD.outline.length
      cy /= GD.outline.length
      const f = Wf(cx, cy, GD.zpos)[2] / GD.zpos
      GD.outline = GD.outline.map(function (p: any) {
        const r = Wf(p.x, p.y, GD.zpos)
        return new THREE.Vector2(r[0], r[1])
      })
      GD.zpos *= f
      GD.Wg *= f
    })
    c.vehicle.children.slice().forEach(function (o: any) {
      if (skip.has(o) || o.userData.noWarp) return
      if (o.isMesh) {
        if (!warpMesh(o)) rigid(o)
        return
      }
      const defs: any = []
      o.traverse(function (x: any) {
        if (x !== o && x.isMesh && dset.has(x)) defs.push(x)
      })
      if (defs.length) defs.forEach(warpMesh)
      else rigid(o)
    })
  }
  function resample(st: any, n: any) {
    if (lod.on) n = Math.max(lod.minStations, Math.round(n * lod.stationFraction))
    const out = []
    const L = st.length
    function P(i: any) {
      return st[Math.max(0, Math.min(L - 1, i))]
    }
    for (let k = 0; k <= n; k++) {
      const u = (k / n) * (L - 1)
      const i = Math.min(L - 2, Math.floor(u))
      const t = u - i
      const a = P(i - 1)
      const b = P(i)
      const c2 = P(i + 1)
      const d = P(i + 2)
      const row = []
      for (let j = 0; j < b.length; j++) {
        let p0 = a[j] == null ? b[j] : a[j]
        let p1 = b[j]
        let p2 = c2[j]
        let p3 = d[j] == null ? c2[j] : d[j]
        p0 = p0 || 0
        p1 = p1 || 0
        p2 = p2 || 0
        p3 = p3 || 0
        row.push(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t))
      }
      out.push(row)
    }
    return out
  }
  function smoothLoft(st: any, o: any) {
    o = o || {}
    if (lod.on) o = Object.assign({}, o, { seg: Math.max(lod.minLoftSegments, Math.round((o.seg || 24) * lod.loftSegmentFraction)) })
    if (o.smooth) st = resample(st, o.smooth)
    const seg = o.seg || 24
    const pos: any = []
    const idx = []
    const ring = seg + 1
    const axisY = o.axis === 'y'
    st.forEach(function (s: any) {
      const a0 = s[1]
      const b0 = s[2]
      const cc = (a0 + b0) / 2
      const hh = Math.abs(a0 - b0) / 2
      const w = s[3] / 2
      const e = 2 / (s[4] || o.p || 2.4)
      const zc = s[5] || 0
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * PI * 2
        const cs = Math.cos(a)
        const sn = Math.sin(a)
        const u = cc + hh * Math.sign(sn) * Math.pow(Math.abs(sn), e)
        const z = zc + w * Math.sign(cs) * Math.pow(Math.abs(cs), e)
        if (axisY) pos.push(u, s[0], z)
        else pos.push(s[0], u, z)
      }
    })
    for (let i = 0; i < st.length - 1; i++)
      for (let k = 0; k < seg; k++) {
        const A = i * ring + k
        const B = A + ring
        if (axisY) idx.push(A, B, A + 1, A + 1, B, B + 1)
        else idx.push(A, A + 1, B, A + 1, B + 1, B)
      }
    ;[0, st.length - 1].forEach(function (si, e) {
      const s = st[si]
      if (s[3] < 0.004) return
      const ci = pos.length / 3
      const cc = (s[1] + s[2]) / 2
      if (axisY) pos.push(cc, s[0], s[5] || 0)
      else pos.push(s[0], cc, s[5] || 0)
      for (let k = 0; k < seg; k++) {
        const a = si * ring + k
        const flip = (e === 0) !== axisY
        if (flip) idx.push(ci, a + 1, a)
        else idx.push(ci, a, a + 1)
      }
    })
    let g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g = crease(g.toNonIndexed(), o.crease || 60)
    return g
  }
  kit.makeWarp = makeWarp
  kit.applyWarp = applyWarp
  kit.geo.resample = resample
  kit.geo.smoothLoft = smoothLoft

  Object.assign(I, { makeWarp, applyWarp, resample, smoothLoft })
}
