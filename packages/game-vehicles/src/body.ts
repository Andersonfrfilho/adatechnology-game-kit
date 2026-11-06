/** Car body shell, panels and body helpers. */
import type { BufferGeometry, ColorRepresentation, Material, Object3D, Vector3 } from './three-types'

import type { CutTest, PathItem, TumbleSpec } from './geometry'
import type { BuildContext, Kit, SceneNode } from './types'
import { clamp } from './util'
import { raycastIndexed } from './tri-index'

/** A body shell (`kit.shell`): the side profile, its width, the wheel arches ([x, y, r]), the holes cut in it and the tumble of the sides. */
export type ShellSpec = {
  items: readonly PathItem[]
  W: number
  arches?: readonly number[][] | null
  bottomY?: number
  bev?: number | null
  sub?: number
  T?: TumbleSpec | null
  holes?: readonly CutTest[] | null
  archInner?: number | null
  mat?: Material
  col?: ColorRepresentation
}
/** The greenhouse of a car: belt and roof heights, the rear and front pillar feet and tops, the pillars between windows and the width. */
export type Greenhouse = { belt: number; roof: number; rb: number; rt: number; fb: number; ft: number; pillars: readonly number[]; Wg: number }
type VectorLike = Vector3 | readonly number[]

export function installBody(kit: Kit) {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._
  const { MATERIALS, crease, cutGeometry, pathShape, subdivide, tumble } = I

  /* ================= bodies ================= */
  function halfAt(Wg: number, T: TumbleSpec | null | undefined, y: number) {
    return (Wg / 2) * (T ? 1 - T.k * clamp((y - T.belt) / (T.top - T.belt), 0, 1) : 1)
  }
  kit.halfAt = halfAt
  function shell(c: BuildContext, o: ShellSpec) {
    const items = o.items.slice()
    if (o.arches)
      o.arches
        .slice()
        .sort(function (a: readonly number[], b: readonly number[]) {
          return b[0] - a[0]
        })
        .forEach(function (a: readonly number[]) {
          const a0 = Math.asin(clamp((o.bottomY! - a[1]) / a[2], -1, 1))
          items.push({ arc: [a[0], a[1], a[2], a0, PI - a0, false] })
        })
    const bev = o.bev == null ? 0.05 : o.bev
    let geo: BufferGeometry = new THREE.ExtrudeGeometry(pathShape(items), {
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
    const tests: CutTest[] = (o.holes || []).slice()
    let cut: ReturnType<typeof cutGeometry>['cut'] | Record<string, never> = {}
    if (o.arches && o.archInner != null)
      o.arches.forEach(function (a: readonly number[]) {
        const zk = o.archInner!
        tests.push({
          sel: function (n: Vector3, ce: Vector3) {
            const dx = a[0] - ce.x
            const dy = a[1] - ce.y
            const d = Math.hypot(dx, dy) || 1
            return d < a[2] + 0.08 && (n.x * dx + n.y * dy) / d > 0.4
          },
          sdf: function (x: number, y: number, z: number) {
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
    const m = c.add(geo, o.mat || c.paint(o.col!))
    c.deform.push(m)
    m.userData.cut = cut
    if (o.arches)
      o.arches.forEach(function (a: readonly number[]) {
        const a0 = Math.asin(clamp((o.bottomY! - a[1]) / a[2], -1, 1))
        const rr = a[2] - 0.01
        const archInner = o.archInner!
        if (o.archInner == null) {
          const wl = c.add(new THREE.CylinderGeometry(rr, rr, o.W - 0.12, 20, 1, true, a0 + PI / 2, PI - 2 * a0), MATERIALS.dark, a[0], a[1], 0)
          wl.rotation.x = PI / 2
          wl.castShadow = false
        } else
          [1, -1].forEach(function (s) {
            const len = o.W / 2 - 0.06 - archInner
            const w2 = c.add(
              new THREE.CylinderGeometry(rr, rr, len, 20, 1, true, a0 + PI / 2, PI - 2 * a0),
              MATERIALS.dark,
              a[0],
              a[1],
              s * (archInner + len / 2),
            )
            w2.rotation.x = PI / 2
            w2.castShadow = false
            const cap = c.add(new THREE.CircleGeometry(rr, 20, a0, PI - 2 * a0), MATERIALS.dark, a[0], a[1], s * archInner)
            cap.castShadow = false
          })
      })
    return m
  }
  kit.shell = shell
  function autoWindows(gh: Greenhouse) {
    const inn = 0.075
    const yb = gh.belt + 0.06
    const yt = gh.roof - 0.075
    function lx(x0: number, x1: number, y: number) {
      return x0 + ((x1 - x0) * (y - gh.belt)) / (gh.roof - gh.belt)
    }
    function rearX(y: number) {
      return lx(gh.rb, gh.rt, y) + inn * 1.3
    }
    function frontX(y: number) {
      return lx(gh.fb, gh.ft, y) - inn * 1.3
    }
    const ps = gh.pillars.slice().sort(function (a: number, b: number) {
      return a - b
    })
    const bounds = [-1e9]
    ps.forEach(function (p: number) {
      bounds.push(p - 0.06, p + 0.06)
    })
    bounds.push(1e9)
    const polys: number[][][] = []
    for (let i = 0; i < bounds.length; i += 2) {
      ;(function (xa, xb) {
        const L = function (y: number) {
          return Math.max(xa, rearX(y))
        }
        const R = function (y: number) {
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
  function profX(items: readonly PathItem[], y: number, front: boolean) {
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
  // batched meshes leave the camera layer (createStaticBatcher), not the world: rays still find them
  _sr.layers.enableAll()
  kit.surfaceAt = function (c: BuildContext, org: VectorLike, dir: VectorLike, o?: { all?: boolean; max?: number } | null) {
    o = o || {}
    c.root.updateMatrixWorld(true)
    const Mw = c.vehicle.matrixWorld
    const inv = new THREE.Matrix4().copy(Mw).invert()
    const dset = new Set<Object3D>(c.deform)
    const cands: Object3D[] = []
    c.vehicle.traverse(function (q: SceneNode) {
      if (!q.isMesh || !q.visible || q.userData.glass || q.userData.decal || q.isSprite) return
      if (o.all || dset.has(q) || (c.paints && c.paints.has(q.material as Material))) cands.push(q)
    })
    const dv = dir as Vector3
    const da = dir as readonly number[]
    const d = (dv.isVector3 ? dv.clone() : new V3(da[0], da[1], da[2])).normalize()
    const ov = org as Vector3
    const oa = org as readonly number[]
    const p0 = ov.isVector3 ? ov.clone() : new V3(oa[0], oa[1], oa[2])
    _sr.set(p0.clone().applyMatrix4(Mw), d.clone().transformDirection(Mw))
    _sr.near = 0
    _sr.far = o.max || 20
    const h = raycastIndexed(THREE, _sr, cands)[0]
    if (!h) return null
    const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld).transformDirection(inv) : d.clone().negate()
    if (n.dot(d) > 0) n.negate()
    return { p: h.point.clone().applyMatrix4(inv), n: n, obj: h.object }
  }
  /* x of the skin at the front (front = true) or at the rear, at height y and side z; falls back to profX(items) if the ray finds nothing */
  kit.surfaceX = function (c: BuildContext, y: number, z: number, front: boolean, items?: readonly PathItem[] | null) {
    const m = c.meta
    const sg = front === false ? -1 : 1
    const x0 = sg > 0 ? (m.front || 3) + 2 : (m.rear || -3) - 2
    const h = kit.surfaceAt(c, new V3(x0, y, z || 0), new V3(-sg, 0, 0))
    return h ? h.p.x : items ? profX(items, y, front !== false) : null
  }

  const shared = { halfAt, shell, autoWindows, profX, _sr }

  Object.assign(I, shared)

  return shared
}
