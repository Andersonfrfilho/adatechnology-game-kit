/** Spoked wheels and track assemblies. */
import type { Kit } from './types'

export function installWheels(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._
  const { makeMaterial, MATERIALS, mergeGeometries, roundedBoxGeometry } = I

  /* ================= special wheels ================= */
  /* Spoked wheel for motorcycle/bicycle. o: { spokes, knobby, disc, cast (5-spoke alloy), z, label } */
  kit.spokedWheel = function (c: any, x: any, r: any, tireR: any, o: any) {
    o = o || {}
    const g = new THREE.Group()
    g.position.set(x, r, o.z || 0)
    c.vehicle.add(g)
    const t = new THREE.Mesh(new THREE.TorusGeometry(r - tireR, tireR, 12, 40), MATERIALS.rubber)
    t.castShadow = true
    g.add(t)
    if (o.knobby) {
      const kn = []
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * PI * 2
        const k = roundedBoxGeometry(0.04, 0.03, tireR * 1.6, 0.01)
        k.applyMatrix4(new THREE.Matrix4().makeRotationZ(a).setPosition(Math.cos(a) * r, Math.sin(a) * r, 0))
        kn.push(k)
      }
      g.add(new THREE.Mesh(mergeGeometries(kn), MATERIALS.rubber))
    }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r - tireR * 2 - 0.005, 0.012, 6, 40), o.cast ? MATERIALS.trim : MATERIALS.chrome)
    g.add(rim)
    const sl = r - tireR * 2
    if (o.cast) {
      for (let j = 0; j < 5; j++) {
        const sp = new THREE.Mesh(roundedBoxGeometry(sl, 0.03, 0.025, 0.01), MATERIALS.trim)
        const a3 = (j / 5) * PI * 2
        sp.position.set((Math.cos(a3) * sl) / 2, (Math.sin(a3) * sl) / 2, 0)
        sp.rotation.z = a3
        g.add(sp)
      }
    } else {
      const ns = o.spokes || 28
      const list = []
      for (let jj = 0; jj < ns; jj++) {
        const a2 = (jj / ns) * PI * 2
        const cg = new THREE.CylinderGeometry(0.0025, 0.0025, sl, 4)
        cg.applyMatrix4(
          new THREE.Matrix4()
            .makeRotationZ(a2 - PI / 2)
            .setPosition((Math.cos(a2) * sl) / 2, (Math.sin(a2) * sl) / 2, (jj % 2 ? 1 : -1) * 0.012),
        )
        list.push(cg)
      }
      g.add(new THREE.Mesh(mergeGeometries(list), MATERIALS.chrome))
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 12), MATERIALS.steel)
    hub.rotation.x = PI / 2
    g.add(hub)
    if (o.disc) {
      const dsk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.008, 24), MATERIALS.steel)
      dsk.rotation.x = PI / 2
      dsk.position.z = 0.06
      g.add(dsk)
    }
    g.userData.r = r
    c.wheels.push(g)
    c.part('wheel', o.label || { key: x > 0 ? 'bike_tire_front' : 'bike_tire_rear' }, g, new V3(x, r, o.z || 0), 0.8)
    return g
  }
  /* Simple track (tank). o: { x0 (drive wheel, rear), x1 (idler wheel, front), z, w, r (road wheels), n, top, mat } */
  kit.tracks = function (c: any, o: any) {
    const x0 = o.x0
    const x1 = o.x1
    const z = o.z
    const w = o.w || 0.55
    const r = o.r || 0.33
    const n = o.n || 6
    const top = o.top || 1.0
    const th = 0.06
    const mat = o.mat || makeMaterial('#2b2c2a', { metalness: 0.5, roughness: 0.6 })
    const wheelMat = o.wheelMat || makeMaterial('#3f4a36', { roughness: 0.7 })
    const rs = (top - th) / 2 - 0.02
    const rsY = top - rs - th
    const sp = ((x1 - x0 - 2 * rs) / Math.max(1, n - 1)) * 0.92
    const firstX = x0 + rs + 0.1
    const gs: any = []
    function road(x: any, y: any, rr: any) {
      const g = new THREE.Group()
      g.position.set(x, y, z)
      c.vehicle.add(g)
      const wm = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, w * 0.8, 22), wheelMat)
      wm.rotation.x = PI / 2
      wm.castShadow = true
      g.add(wm)
      const rb2 = new THREE.Mesh(new THREE.TorusGeometry(rr - 0.03, 0.03, 6, 22), MATERIALS.rubber)
      g.add(rb2)
      const hb = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.3, rr * 0.3, w * 0.84, 10), MATERIALS.steel)
      hb.rotation.x = PI / 2
      g.add(hb)
      gs.push(g)
      c.spin.push({ o: g, axis: 'z', v: 0, track: true })
      return g
    }
    for (let i = 0; i < n; i++) road(firstX + i * sp, r + th, r)
    const spr = road(x0, rsY, rs)
    const idl = road(x1, rsY, rs)
    for (let k = 0; k < 3; k++) road(x0 + (x1 - x0) * (0.25 + k * 0.25), top - th - 0.07, 0.07)
    const path = []
    const segs = 40
    function arc(cx: any, cy: any, rr: any, a0: any, a1: any) {
      for (let s = 0; s <= segs / 4; s++) {
        const a = a0 + ((a1 - a0) * s) / (segs / 4)
        path.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr])
      }
    }
    path.push([firstX - 0.05, th / 2])
    path.push([firstX + (n - 1) * sp + 0.05, th / 2])
    arc(x1, rsY, rs + th / 2, -PI / 2 + 0.6, PI / 2)
    arc(x0, rsY, rs + th / 2, PI / 2, PI * 1.5 - 0.6)
    const pts = path.map(function (p) {
      return new THREE.Vector2(p[0], p[1])
    })
    const curve = new THREE.SplineCurve(pts.concat([pts[0]]))
    const lenT = curve.getLength()
    const nl = Math.round(lenT / 0.15)
    const links = []
    for (let l = 0; l < nl; l++) {
      const t = l / nl
      const p = curve.getPointAt(t)
      const tg = curve.getTangentAt(t)
      const ang = Math.atan2(tg.y, tg.x)
      const lg = roundedBoxGeometry(0.13, th, w, 0.015)
      lg.applyMatrix4(new THREE.Matrix4().makeRotationZ(ang).setPosition(p.x, p.y, 0))
      links.push(lg)
      const gh2 = roundedBoxGeometry(0.05, 0.05, 0.05, 0.01)
      gh2.applyMatrix4(new THREE.Matrix4().makeRotationZ(ang).setPosition(p.x - Math.sin(ang) * 0.04, p.y + Math.cos(ang) * 0.04, 0))
      links.push(gh2)
    }
    const tm = c.add(mergeGeometries(links), mat, 0, 0, z)
    tm.userData.noFollow = true
    c.part('track', kit.t('parts.track', { s: z > 0 ? 1 : -1 }), tm, new V3((x0 + x1) / 2, 0.3, z), 1.4)
    return { mesh: tm, wheels: gs, sprocket: spr, idler: idl }
  }

  Object.assign(I, {})
}
