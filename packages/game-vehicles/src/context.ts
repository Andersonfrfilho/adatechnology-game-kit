import type { Kit } from './types'
import { clamp, rng } from './util'

export function installContext(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._
  const { makeMaterial, DOUBLE_SIDE, MATERIALS, crease, mergeGeometries, paintColor, roundedBoxGeometry, subdivide, taper, textTexture } = I

  /**
   * Normalises a label argument. A plain string is used as given; `{ key }` takes the text from the locale (`parts.<key>`);
   * `{ key, label }` uses the given text but keeps the key, which the zone derivation uses to recognise the part.
   */
  function resolveLabel(l: any): { label: string; key?: string } {
    if (l && typeof l === 'object') return { key: l.key, label: l.label != null ? l.label : kit.t('parts.' + l.key) }
    return { label: l }
  }
  kit.resolveLabel = resolveLabel
  I.resolveLabel = resolveLabel

  /* ================= build context ================= */
  /** The object every vehicle builder receives. Axes: +x front, +y up, +z right (driver at negative z), ground at y = 0, metres. */
  class BuildContext {
    [key: string]: any
    constructor(state: string, seed?: number) {
      this.root = new THREE.Group()
      this.vehicle = new THREE.Group()
      this.effects = new THREE.Group()
      this.root.add(this.vehicle)
      this.root.add(this.effects)
      this.state = state
      this.glass = []
      this.quads = []
      this.deform = []
      this.wheels = []
      this.parts = []
      this.spin = []
      this.lights = []
      this.fluids = []
      this.meta = {}
      this.log = []
      this.paints = new Set()
      this.zoneDefs = []
      this.particles = []
      this.emitters = []
      this.seatTops = []
      this.hood = null
      this.rollState = null
      this.flipped = false
      this.time = 0
      this.rand = rng(seed || 7)
    }
    add(geo: any, mat: any, x: any, y: any, z: any, parent: any) {
      const m = new THREE.Mesh(geo, mat)
      m.position.set(x || 0, y || 0, z || 0)
      m.castShadow = true
      m.receiveShadow = true
      ;(parent || this.vehicle).add(m)
      return m
    }
    /** Paint material; `meta.matte` (or `o.matte`) gives a matte finish to everything, including parts created later (damage, hood). */
    paint(hex: any, o: any) {
      o = Object.assign({}, o || {})
      const matte = o.matte != null ? o.matte : this.meta.matte
      delete o.matte
      const base = matte
        ? { roughness: this.state === 'damaged' ? 0.92 : 0.82, metalness: 0.08, side: DOUBLE_SIDE }
        : { roughness: this.state === 'damaged' ? 0.75 : 0.42, metalness: 0.3, side: DOUBLE_SIDE }
      const pm = makeMaterial(paintColor(hex, this.state), Object.assign(base, o))
      this.paints.add(pm)
      return pm
    }
    roundBox(w: any, h: any, d: any, r: any, mat: any, x: any, y: any, z: any, o: any) {
      o = o || {}
      let geo = roundedBoxGeometry(w, h, d, r)
      if (o.taper) taper(geo, o.taper)
      if (o.sub) geo = crease(subdivide(geo, o.sub), 40)
      else if (o.def) geo = crease(geo.toNonIndexed(), 50)
      const m = this.add(geo, mat, x, y, z, o.parent)
      if (o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2])
      if (o.def) this.deform.push(m)
      return m
    }
    cylinder(r1: any, r2: any, h: any, mat: any, x: any, y: any, z: any, axis: any, o: any) {
      o = o || {}
      const m = this.add(new THREE.CylinderGeometry(r1, r2, h, o.seg || 20, 1, !!o.open), mat, x, y, z, o.parent)
      if (axis === 'x') m.rotation.z = -PI / 2
      else if (axis === 'z') m.rotation.x = PI / 2
      return m
    }
    sphere(r: any, mat: any, x: any, y: any, z: any, sx: any, sy: any, sz: any, o: any) {
      o = o || {}
      const m = this.add(new THREE.SphereGeometry(r, o.ws || 18, o.hs || 12, 0, PI * 2, 0, o.tl || PI), mat, x, y, z, o.parent)
      m.scale.set(sx || 1, sy || 1, sz || 1)
      return m
    }
    rod(a: any, b: any, r: any, mat: any, o: any) {
      o = o || {}
      const len = a.distanceTo(b)
      const m = this.add(
        new THREE.CylinderGeometry(r, o.r2 == null ? r : o.r2, len, o.seg || 10),
        mat,
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
        (a.z + b.z) / 2,
        o.parent,
      )
      m.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3().subVectors(b, a).normalize())
      return m
    }
    tube(pts: any, r: any, mat: any, o: any) {
      o = o || {}
      const curve = new THREE.CatmullRomCurve3(
        pts.map(function (p: any) {
          return p.isVector3 ? p.clone() : new V3(p[0], p[1], p[2] || 0)
        }),
        !!o.closed,
      )
      return this.add(new THREE.TubeGeometry(curve, o.seg || 40, r, o.rs || 8, !!o.closed), mat, 0, 0, 0, o.parent)
    }
    text(txt: any, w: any, h: any, x: any, y: any, z: any, face: any, o: any) {
      o = o || {}
      const mat = new THREE.MeshStandardMaterial({ map: textTexture(txt, o), transparent: !o.bg, roughness: 0.6, alphaTest: o.bg ? 0 : 0.3 })
      if (o.glow) {
        mat.emissive = new THREE.Color(o.glow)
        mat.emissiveMap = mat.map
        mat.emissiveIntensity = 0.6
      }
      const m = this.add(new THREE.PlaneGeometry(w, h), mat, x, y, z, o.parent)
      m.castShadow = false
      if (face === '+y' || face === '-y') m.rotation.x = face === '+y' ? -PI / 2 : PI / 2
      else m.rotation.y = ({ '+z': 0, '-z': PI, '+x': PI / 2, '-x': -PI / 2 } as Record<string, number>)[face] || 0
      return m
    }
    plate(x: any, y: any, z: any, face: any, txt: any) {
      /* the plate is rigid: soft body deformation (warp, sculpting) does not bend it; a dent carries it as a rigid body */
      const pl = this.text(txt || kit.config.plate, 0.4, 0.13, x, y, z, face, {
        w: 400,
        h: 130,
        bg: '#f2f2ee',
        band: '#1f4fa3',
        fg: '#151515',
        size: 0.5,
        font: "'IBM Plex Mono', monospace",
        weight: '500',
      })
      pl.userData.noWarp = true
      pl.userData.plate = true
      return pl
    }
    part(kind: any, label: any, obj: any, pos: any, reach?: any, o?: any) {
      const L = I.resolveLabel(label)
      const pt = Object.assign(
        { kind: kind, label: L.label, key: L.key, obj: obj, pos: pos.clone ? pos.clone() : new V3(pos[0], pos[1], pos[2]), reach: reach || 1 },
        o || {},
      )
      this.parts.push(pt)
      return pt
    }
    wheel(x: any, z: any, r: any, w: any, o: any) {
      o = o || {}
      const s = z >= 0 ? 1 : -1
      const g = new THREE.Group()
      g.position.set(x, o.y == null ? r : o.y, z)
      this.vehicle.add(g)
      const rr = r * (o.rimR || 0.6)
      const prof = [
        [rr, -w / 2 + 0.01],
        [r - 0.06, -w / 2],
        [r - 0.015, -w / 2 + 0.035],
        [r, -w / 2 + 0.08],
        [r, w / 2 - 0.08],
        [r - 0.015, w / 2 - 0.035],
        [r - 0.06, w / 2],
        [rr, w / 2 - 0.01],
      ].map(function (p) {
        return new THREE.Vector2(p[0], p[1])
      })
      const tire = new THREE.Mesh(crease(new THREE.LatheGeometry(prof, 30).toNonIndexed(), 55), MATERIALS.rubber)
      tire.rotation.x = PI / 2
      tire.castShadow = true
      g.add(tire)
      if (o.lugs) {
        const nl = Math.round(r * 30)
        const lugs: any = []
        for (let i = 0; i < nl; i++) {
          const a = (i / nl) * PI * 2
          ;[-1, 1].forEach(function (sd) {
            const lk = clamp(r / 0.55, 0.45, 1)
            const lg = roundedBoxGeometry((0.07 + r * 0.04) * lk, (0.05 + r * 0.03) * lk, w * 0.42, 0.015 * lk)
            const M = new THREE.Matrix4().compose(
              new V3(Math.cos(a) * (r + 0.01 * clamp(r / 0.55, 0.45, 1)), Math.sin(a) * (r + 0.01 * clamp(r / 0.55, 0.45, 1)), sd * w * 0.24),
              new THREE.Quaternion().setFromEuler(new THREE.Euler(0, sd * (o.chevron ? 0.45 : 0), a)),
              new V3(1, 1, 1),
            )
            lg.applyMatrix4(M)
            lugs.push(lg)
          })
        }
        const lm = new THREE.Mesh(mergeGeometries(lugs), MATERIALS.rubber)
        lm.castShadow = true
        g.add(lm)
      }
      const rimMat = o.rim || MATERIALS.steel
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, w * 0.78, 24), rimMat)
      rim.rotation.x = PI / 2
      g.add(rim)
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.92, rr * 0.7, 0.05, 24), rimMat)
      dish.rotation.x = PI / 2
      dish.position.z = s * w * 0.36
      g.add(dish)
      const ns = o.spokes == null ? 5 : o.spokes
      for (let k = 0; k < ns; k++) {
        const sp = new THREE.Mesh(roundedBoxGeometry(rr * 0.85, rr * 0.2, 0.04, 0.015), o.spokeMat || rimMat)
        const a2 = (k / ns) * PI * 2
        sp.position.set(Math.cos(a2) * rr * 0.45, Math.sin(a2) * rr * 0.45, s * (w * 0.4))
        sp.rotation.z = a2
        g.add(sp)
      }
      const cap = new THREE.Mesh(new THREE.SphereGeometry(rr * 0.22, 14, 8), MATERIALS.chrome)
      cap.scale.z = 0.5
      cap.position.z = s * w * 0.42
      g.add(cap)
      for (let n = 0; n < 5; n++) {
        const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 6), MATERIALS.chrome)
        const an = (n / 5) * PI * 2 + 0.3
        nut.rotation.x = PI / 2
        nut.position.set(Math.cos(an) * rr * 0.33, Math.sin(an) * rr * 0.33, s * w * 0.43)
        g.add(nut)
      }
      g.userData.r = r
      this.wheels.push(g)
      if (!o.noPart)
        this.part(
          'wheel',
          o.label || kit.t(x >= 0 ? 'parts.tire_front' : 'parts.tire_rear', { s }),
          g,
          new V3(x, r, z + s * w * 0.4),
          0.9,
        )
      return g
    }
    /** Point in `c.vehicle` coordinates to effects-group coordinates (vehicle world, ground y = 0). */
    toEffects(p: any) {
      this.vehicle.updateMatrix()
      return p.clone().applyMatrix4(this.vehicle.matrix)
    }
    dirToEffects(d: any) {
      return d.clone().applyQuaternion(this.vehicle.quaternion)
    }


    /** Declares or refines a damage zone: `c.zone(id, label, box, parts, options)`. Pass `label === false` to remove an auto-derived zone. */
    zone(id: string, label: any, box?: any, parts?: any, o?: any) {
      const d: any = Object.assign({ id: id }, o || {})
      if (label === false) d.remove = true
      else if (label) d.name = label
      if (box) d.box = I.normalizeBox(box)
      if (parts) d.objs = Array.isArray(parts) ? parts.slice() : [parts]
      this.zoneDefs.push(d)
      return d
    }
  }
  kit.BuildContext = BuildContext
  I.BuildContext = BuildContext
}
