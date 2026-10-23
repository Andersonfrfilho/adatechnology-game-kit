/** Car body shell, panels and body helpers. */
import type { Kit } from './types'
import { clamp } from './util'

export function installBody(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._
  const { MATERIALS, crease, cutGeometry, pathShape, subdivide, tumble } = I

  /* ================= bodies ================= */
  function halfAt(Wg: any, T: any, y: any) {
    return (Wg / 2) * (T ? 1 - T.k * clamp((y - T.belt) / (T.top - T.belt), 0, 1) : 1)
  }
  kit.halfAt = halfAt
  function shell(c: any, o: any) {
    const items = o.items.slice()
    if (o.arches)
      o.arches
        .slice()
        .sort(function (a: any, b: any) {
          return b[0] - a[0]
        })
        .forEach(function (a: any) {
          const a0 = Math.asin(clamp((o.bottomY - a[1]) / a[2], -1, 1))
          items.push({ arc: [a[0], a[1], a[2], a0, PI - a0, false] })
        })
    const bev = o.bev == null ? 0.05 : o.bev
    let geo = new THREE.ExtrudeGeometry(pathShape(items), {
      depth: Math.max(0.01, o.W - 2 * bev),
      bevelEnabled: bev > 0,
      bevelThickness: bev,
      bevelSize: bev,
      bevelSegments: 4,
      curveSegments: 14,
      steps: 1,
    })
    geo.translate(0, 0, -(o.W - 2 * bev) / 2)
    geo = subdivide(geo, o.sub || 0.2)
    tumble(geo, o.T)
    const tests = (o.holes || []).slice()
    let cut: any = {}
    if (o.arches && o.archInner != null)
      o.arches.forEach(function (a: any) {
        const zk = o.archInner
        tests.push({
          sel: function (n: any, ce: any) {
            const dx = a[0] - ce.x
            const dy = a[1] - ce.y
            const d = Math.hypot(dx, dy) || 1
            return d < a[2] + 0.08 && (n.x * dx + n.y * dy) / d > 0.4
          },
          sdf: function (x: any, y: any, z: any) {
            return Math.abs(z) - zk
          },
        })
      })
    if (tests.length) {
      const r = cutGeometry(geo, tests)
      geo = r.geo
      cut = r.cut
    }
    crease(geo, 42)
    const m = c.add(geo, o.mat || c.paint(o.col))
    c.deform.push(m)
    m.userData.cut = cut
    if (o.arches)
      o.arches.forEach(function (a: any) {
        const a0 = Math.asin(clamp((o.bottomY - a[1]) / a[2], -1, 1))
        const rr = a[2] - 0.01
        if (o.archInner == null) {
          const wl = c.add(new THREE.CylinderGeometry(rr, rr, o.W - 0.12, 20, 1, true, a0 + PI / 2, PI - 2 * a0), MATERIALS.dark, a[0], a[1], 0)
          wl.rotation.x = PI / 2
          wl.castShadow = false
        } else
          [1, -1].forEach(function (s) {
            const len = o.W / 2 - 0.06 - o.archInner
            const w2 = c.add(
              new THREE.CylinderGeometry(rr, rr, len, 20, 1, true, a0 + PI / 2, PI - 2 * a0),
              MATERIALS.dark,
              a[0],
              a[1],
              s * (o.archInner + len / 2),
            )
            w2.rotation.x = PI / 2
            w2.castShadow = false
            const cap = c.add(new THREE.CircleGeometry(rr, 20, a0, PI - 2 * a0), MATERIALS.dark, a[0], a[1], s * o.archInner)
            cap.castShadow = false
          })
      })
    return m
  }
  kit.shell = shell
  function autoWindows(gh: any) {
    const inn = 0.075
    const yb = gh.belt + 0.06
    const yt = gh.roof - 0.075
    function lx(x0: any, x1: any, y: any) {
      return x0 + ((x1 - x0) * (y - gh.belt)) / (gh.roof - gh.belt)
    }
    function rearX(y: any) {
      return lx(gh.rb, gh.rt, y) + inn * 1.3
    }
    function frontX(y: any) {
      return lx(gh.fb, gh.ft, y) - inn * 1.3
    }
    const ps = gh.pillars.slice().sort(function (a: any, b: any) {
      return a - b
    })
    const bounds = [-1e9]
    ps.forEach(function (p: any) {
      bounds.push(p - 0.06, p + 0.06)
    })
    bounds.push(1e9)
    const polys = []
    for (let i = 0; i < bounds.length; i += 2) {
      ;(function (xa, xb) {
        const L = function (y: any) {
          return Math.max(xa, rearX(y))
        }
        const R = function (y: any) {
          return Math.min(xb, frontX(y))
        }
        if (R(yb) - L(yb) > 0.15 && R(yt) - L(yt) > 0.05)
          polys.push([
            [L(yb), yb],
            [R(yb), yb],
            [R(yt), yt],
            [L(yt), yt],
          ])
      })(bounds[i], bounds[i + 1])
    }
    return polys
  }
  kit.autoWindows = autoWindows
  function profX(items: any, y: any, front: any) {
    let best = front ? -1e9 : 1e9
    for (let i = 0; i < items.length; i++) {
      const a = items[i]
      const b = items[(i + 1) % items.length]
      if (a.arc || b.arc) continue
      if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) {
        const x = a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1])
        best = front ? Math.max(best, x) : Math.min(best, x)
      }
    }
    return best
  }
  kit.profX = profX
  /* Real surface of the bodywork by ray. The shell of kit.shell/kit.car bulges 2 to 8 cm beyond the profile (bevel, tumble, sculpting),
     so a part, plate or text placed with profX() can end up buried. Use this to seat parts on the finished skin.
     kit.surfaceAt(c, origin, direction, { all, max }) -> { p, n, obj } in c.vehicle coordinates, or null.
     By default only paint and the meshes that dent count; all: true accepts any visible mesh. */
  const _sr = new THREE.Raycaster()
  kit.surfaceAt = function (c: any, org: any, dir: any, o: any) {
    o = o || {}
    c.root.updateMatrixWorld(true)
    const Mw = c.vehicle.matrixWorld
    const inv = new THREE.Matrix4().copy(Mw).invert()
    const dset = new Set(c.deform)
    const cands: any = []
    c.vehicle.traverse(function (q: any) {
      if (!q.isMesh || !q.visible || q.userData.glass || q.userData.decal || q.isSprite) return
      if (o.all || dset.has(q) || (c.paints && c.paints.has(q.material))) cands.push(q)
    })
    const d = (dir.isVector3 ? dir.clone() : new V3(dir[0], dir[1], dir[2])).normalize()
    const p0 = org.isVector3 ? org.clone() : new V3(org[0], org[1], org[2])
    _sr.set(p0.clone().applyMatrix4(Mw), d.clone().transformDirection(Mw))
    _sr.near = 0
    _sr.far = o.max || 20
    const h = _sr.intersectObjects(cands, false)[0]
    if (!h) return null
    const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld).transformDirection(inv) : d.clone().negate()
    if (n.dot(d) > 0) n.negate()
    return { p: h.point.clone().applyMatrix4(inv), n: n, obj: h.object }
  }
  /* x of the skin at the front (front = true) or at the rear, at height y and side z; falls back to profX(items) if the ray finds nothing */
  kit.surfaceX = function (c: any, y: any, z: any, front: any, items: any) {
    const m = c.meta
    const sg = front === false ? -1 : 1
    const x0 = sg > 0 ? (m.front || 3) + 2 : (m.rear || -3) - 2
    const h = kit.surfaceAt(c, new V3(x0, y, z || 0), new V3(-sg, 0, 0))
    return h ? h.p.x : items ? profX(items, y, front !== false) : null
  }

  Object.assign(I, { halfAt, shell, autoWindows, profX, _sr })
}
