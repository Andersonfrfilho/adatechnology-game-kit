/** Zone dent field: deterministic vertex displacement inside a zone box. */
import type { Kit } from './types'
import { smooth } from './util'
import { liveTriIndex, touchTriIndex } from './tri-index'

export function installZoneDent(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const I = kit._
  const { cutGeometry } = I

  /* ---- dent masked by the box (follows the panel) ---- */
  function sm(t: any) {
    return smooth(t)
  }
  function subdivIn(geo: any, rel: any, B: any, maxLen: any) {
    const a = geo.attributes.position.array
    /* the result grows from the size of the mesh (a typed array: a plain array of this many numbers is the slowest part of the call) */
    let out = new Float32Array(a.length + 4096)
    let used = 0
    const push = function (a0: number, a1: number, a2: number, b0: number, b1: number, b2: number, c0: number, c1: number, c2: number) {
      if (used + 9 > out.length) {
        const bigger = new Float32Array(out.length * 2)
        bigger.set(out)
        out = bigger
      }
      out[used] = a0
      out[used + 1] = a1
      out[used + 2] = a2
      out[used + 3] = b0
      out[used + 4] = b1
      out[used + 5] = b2
      out[used + 6] = c0
      out[used + 7] = c1
      out[used + 8] = c2
      used += 9
    }
    const e = 0.15
    function d(p: any, q: any) {
      return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
    }
    function mid(p: any, q: any) {
      return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2]
    }
    function tri(A: any, Bv: any, C: any, depth: any) {
      const ab = d(A, Bv)
      const bc = d(Bv, C)
      const ca = d(C, A)
      const mx = Math.max(ab, bc, ca)
      if (mx <= maxLen || depth > 9) {
        push(A[0], A[1], A[2], Bv[0], Bv[1], Bv[2], C[0], C[1], C[2])
        return
      }
      if (mx === ab) {
        const D = mid(A, Bv)
        tri(A, D, C, depth + 1)
        tri(D, Bv, C, depth + 1)
      } else if (mx === bc) {
        const E2 = mid(Bv, C)
        tri(A, Bv, E2, depth + 1)
        tri(A, E2, C, depth + 1)
      } else {
        const F2 = mid(C, A)
        tri(A, Bv, F2, depth + 1)
        tri(F2, Bv, C, depth + 1)
      }
    }
    /* the box test of each triangle runs on the raw array (what is outside the zone is the most of the mesh and is copied as it is) */
    const M = rel.elements
    const at = function (x: number, y: number, z: number, k: number) {
      const w = 1 / (M[3] * x + M[7] * y + M[11] * z + M[15])
      return k === 0 ? (M[0] * x + M[4] * y + M[8] * z + M[12]) * w : k === 1 ? (M[1] * x + M[5] * y + M[9] * z + M[13]) * w : (M[2] * x + M[6] * y + M[10] * z + M[14]) * w
    }
    const lo = [B.x0 - e, B.y0 - e, B.z0 - e]
    const hi = [B.x1 + e, B.y1 + e, B.z1 + e]
    for (let i = 0; i < a.length; i += 9) {
      let outside = false
      for (let k = 0; k < 3 && !outside; k++) {
        const p = at(a[i], a[i + 1], a[i + 2], k)
        const q = at(a[i + 3], a[i + 4], a[i + 5], k)
        const r = at(a[i + 6], a[i + 7], a[i + 8], k)
        outside = Math.max(p, q, r) < lo[k] || Math.min(p, q, r) > hi[k]
      }
      if (outside) push(a[i], a[i + 1], a[i + 2], a[i + 3], a[i + 4], a[i + 5], a[i + 6], a[i + 7], a[i + 8])
      else tri([a[i], a[i + 1], a[i + 2]], [a[i + 3], a[i + 4], a[i + 5]], [a[i + 6], a[i + 7], a[i + 8]], 0)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(out.slice(0, used), 3))
    g.userData.crease = true
    g.userData.p0 = null
    return g
  }
  /* meshes this zone may dent: shell (c.deform), paint, its own parts and, with anyMesh, any mesh */
  function dentTargets(c: any, z: any, inv: any) {
    const dset = new Set(c.deform)
    const out: any = []
    c.vehicle.traverse(function (o: any) {
      if (!o.isMesh || o.userData.decal || o.userData.ghost || !o.geometry || !o.geometry.attributes.position) return
      for (let q = o; q && q !== c.vehicle; q = q.parent) if (!q.visible) return
      const ow = I.ownerOf(c, o)
      const isG = !!o.userData.glass
      if (isG && !(z.alsoGlass || ow === z)) return
      if (ow && ow !== z && !(isG && z.alsoGlass)) return
      const ok = dset.has(o) || (c.paints && c.paints.has(o.material)) || ow === z || z.anyMesh
      if (!ok) return
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
      if (!I.boxIntersects(z.box, I.localBox(c, o, inv))) return
      out.push({ o: o, deform: dset.has(o) })
    })
    return out
  }
  /* the box `B` (zone frame) seen from the frame that `m` maps into it: [x0, y0, z0, x1, y1, z1] of its 8 corners, widened a hair */
  function boxInFrame(B: any, m: any, tmp: any) {
    const r = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
    for (let i = 0; i < 8; i++) {
      tmp.set(i & 1 ? B.x1 : B.x0, i & 2 ? B.y1 : B.y0, i & 4 ? B.z1 : B.z0).applyMatrix4(m)
      for (let k = 0; k < 3; k++) {
        r[k] = Math.min(r[k], tmp.getComponent(k) - 1e-4)
        r[k + 3] = Math.max(r[k + 3], tmp.getComponent(k) + 1e-4)
      }
    }
    return r
  }
  /* dents: [{ u, v (centre, absolute tangent coordinates), ru, rv (radii in m), depth }], crease: { v, w, depth } */
  function zoneDent(c: any, z: any, dents: any, dirty: any, opt: any) {
    opt = opt || {}
    const B = z.box
    const d = z.dir
    const a = I.axisOf(d)
    const ax = [0, 1, 2].filter(function (k) {
      return k !== a
    })
    const sg = d.getComponent(a) > 0 ? 1 : -1
    const outer = sg > 0 ? I.boxLo(B, a) : I.boxHi(B, a)
    const depthA = I.boxHi(B, a) - I.boxLo(B, a)
    const m = c.meta
    const hu = (I.boxHi(B, ax[0]) - I.boxLo(B, ax[0])) / 2
    const hv = (I.boxHi(B, ax[1]) - I.boxLo(B, ax[1])) / 2
    const cu = I.boxLo(B, ax[0]) + hu
    const cv = I.boxLo(B, ax[1]) + hv
    const C = new V3(((m.front || 1) + (m.rear || -1)) / 2, (m.clearance || 0.3) + (m.bodyHeight || 0.6) * 0.5, 0)
    const edge = opt.edge || 0.28
    function field(p: any) {
      if (!I.boxContains(B, p.x, p.y, p.z, 0)) return 0
      const u = p.getComponent(ax[0])
      const v = p.getComponent(ax[1])
      const su = (u - cu) / hu
      const sv = (v - cv) / hv
      const mask = sm((1 - Math.abs(su)) / edge) * sm((1 - Math.abs(sv)) / edge)
      const tin = Math.abs(p.getComponent(a) - outer) / Math.max(0.05, depthA)
      const md = 1 - sm((tin - 0.5) / 0.5)
      let amt = 0
      dents.forEach(function (D: any) {
        const r = Math.hypot((u - D.u) / D.ru, (v - D.v) / D.rv)
        if (r < 1) amt = Math.max(amt, D.depth * sm(1 - r) * (1 + 0.12 * Math.sin(u * 9.1 + v * 5.3 + D.ph)))
      })
      if (opt.crease) {
        const cr = opt.crease
        const t = 1 - Math.abs(v - cr.v) / cr.w
        if (t > 0) amt = Math.max(amt, cr.depth * sm(t) * sm((1 - Math.abs(su)) / 0.45))
      }
      amt *= mask * md
      const lim = -((p.x - C.x) * d.x + (p.y - C.y) * d.y + (p.z - C.z) * d.z) - 0.05
      return Math.max(0, Math.min(amt, lim))
    }
    const inv = I.worldInverseOf(c)
    const T = opt.targets || dentTargets(c, z, inv)
    const rel = new THREE.Matrix4()
    const irel = new THREE.Matrix4()
    const v = new V3()
    T.forEach(function (t: any) {
      const msh = t.o
      let g = msh.geometry
      rel.multiplyMatrices(inv, msh.matrixWorld)
      if (!t.deform && !msh.userData.zCloned) {
        g = msh.geometry = g.clone()
        msh.userData.zCloned = true
      }
      let boundsDue = false
      const nonIdx = !g.index
      const onlyPos = Object.keys(g.attributes).every(function (k) {
        return k === 'position' || k === 'normal'
      })
      if (t.deform && nonIdx && onlyPos && !msh.userData.glass && !opt.noSub) {
        const ng = subdivIn(g, rel, B, opt.sub || 0.075)
        g.dispose()
        g = msh.geometry = ng
        boundsDue = true /* computed once, after the vertices moved */
        dirty.add(msh)
      }
      irel.copy(rel).invert()
      const pos = g.attributes.position
      let changed = false
      const liveIndex = liveTriIndex(g)
      const movedVertices: number[] = []
      /* the box of the zone in the frame of the mesh: a vertex outside it is outside the field (it returns 0 there), so it skips the transform */
      const near = boxInFrame(B, irel, v)
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i)
        if (v.x < near[0] || v.x > near[3] || v.y < near[1] || v.y > near[4] || v.z < near[2] || v.z > near[5]) continue
        v.applyMatrix4(rel)
        const f = field(v)
        if (f <= 1e-5) continue
        v.addScaledVector(d, f)
        if (opt.extra) opt.extra(v, f)
        v.applyMatrix4(irel)
        pos.setXYZ(i, v.x, v.y, v.z)
        movedVertices.push(i)
        changed = true
      }
      if (opt.extraAll) {
        for (let j = 0; j < pos.count; j++) {
          v.fromBufferAttribute(pos, j).applyMatrix4(rel)
          if (opt.extraAll(v)) {
            v.applyMatrix4(irel)
            pos.setXYZ(j, v.x, v.y, v.z)
            movedVertices.push(j)
            changed = true
          }
        }
      }
      if (changed) {
        pos.needsUpdate = true
        if (liveIndex) touchTriIndex(g, liveIndex, movedVertices)
        dirty.add(msh)
      }
      if (changed || boundsDue) {
        g.computeBoundingSphere()
        g.computeBoundingBox()
      }
    })
    /* rigid parts (trim, handles, liner, plate) follow the field at their centre */
    const dset = new Set(c.deform)
    const moved: any = []
    c.vehicle.children.forEach(function (o: any) {
      if (dset.has(o) || o.userData.noFollow || o.userData.decal || o.isSprite || o.userData.glass) return
      if (!(o.isMesh || (o.isGroup && o.userData.rigid))) return
      const ow = I.ownerOf(c, o)
      if (ow && ow !== z) return
      if (
        T.some(function (t: any) {
          return t.o === o
        })
      )
        return
      const bb = I.localBox(c, o, inv)
      if (bb.isEmpty()) return
      const sz = bb.getSize(new V3())
      if (Math.max(sz.x, sz.y, sz.z) > 1.4) return
      const cen = bb.getCenter(new V3())
      const f = field(cen)
      if (f <= 1e-4) return
      o.position.addScaledVector(d, f)
      moved.push(o)
    })
    return { field: field, moved: moved, ax: ax, a: a, cu: cu, cv: cv, hu: hu, hv: hv, outer: outer }
  }
  /* the box, in the frame of a mesh (rel maps it to the vehicle frame), that holds the panel cut: every point with sdf < 0 of the cut test lies in it;
     undefined when rel cannot be inverted. The pad swallows the rounding of the inverse. */
  function panelBoundsIn(rel: any, rect: any, B: any, a: any, ax: any) {
    const det = rel.determinant()
    if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return undefined
    const back = rel.clone().invert()
    const lo = [Infinity, Infinity, Infinity]
    const hi = [-Infinity, -Infinity, -Infinity]
    const q = new V3()
    for (let i = 0; i < 8; i++) {
      q.setComponent(ax[0], i & 1 ? rect[1] : rect[0])
      q.setComponent(ax[1], i & 2 ? rect[3] : rect[2])
      q.setComponent(a, i & 4 ? I.boxHi(B, a) : I.boxLo(B, a))
      q.applyMatrix4(back)
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], q.getComponent(k))
        hi[k] = Math.max(hi[k], q.getComponent(k))
      }
    }
    const pad = 1e-3
    return { lo: lo.map((x) => x - pad), hi: hi.map((x) => x + pad) }
  }
  /* cuts the skin inside a rectangle of the zone; returns the cut piece (or null). rect: [u0, u1, v0, v1] absolute. `o.pieceTasks` (a Map) takes the smoothing of the kept pieces as tasks to run later, by mesh. */
  function cutPanel(c: any, z: any, rect: any, keep: any, dirty: any, o: any) {
    o = o || {}
    const B = z.box
    const d = z.dir
    const a = I.axisOf(d)
    const ax = [0, 1, 2].filter(function (k) {
      return k !== a
    })
    const inv = I.worldInverseOf(c)
    const outN = d.clone().negate()
    const T = dentTargets(c, z, inv).filter(function (t: any) {
      return !t.o.userData.glass && (t.deform || z.cutAll || z.anyMesh || (c.paints && c.paints.has(t.o.material)))
    })
    const pieces: any = []
    const rel = new THREE.Matrix4()
    const v = new V3()
    const nv = new V3()
    const nm = new THREE.Matrix3()
    T.forEach(function (t: any) {
      const msh = t.o
      const g = msh.geometry
      if (!g.attributes.position.count) return
      rel.multiplyMatrices(inv, msh.matrixWorld)
      nm.getNormalMatrix(rel)
      const bb = I.localBox(c, msh, inv)
      const whole =
        bb.min.x >= B.x0 - 0.02 &&
        bb.max.x <= B.x1 + 0.02 &&
        bb.min.y >= B.y0 - 0.02 &&
        bb.max.y <= B.y1 + 0.02 &&
        bb.min.z >= B.z0 - 0.02 &&
        bb.max.z <= B.z1 + 0.02
      if (whole && !t.deform) {
        pieces.push({ mesh: msh, whole: true })
        return
      }
      const test = {
        tag: 'part',
        pieces: keep ? (o.pieceTasks ? 'later' : 'crease') : 'none',
        sel:
          o.anyN || z.cutAll
            ? null
            : function (n: any) {
                nv.copy(n).applyMatrix3(nm).normalize()
                return nv.dot(outN) > 0.3
              },
        sdf: function (x: any, y: any, zz: any) {
          v.set(x, y, zz).applyMatrix4(rel)
          let q = -1e9
          q = Math.max(
            q,
            rect[0] - v.getComponent(ax[0]),
            v.getComponent(ax[0]) - rect[1],
            rect[2] - v.getComponent(ax[1]),
            v.getComponent(ax[1]) - rect[3],
          )
          q = Math.max(q, I.boxLo(B, a) - v.getComponent(a), v.getComponent(a) - I.boxHi(B, a))
          return q
        },
      }
      const r = cutGeometry(g, [{ ...test, bounds: panelBoundsIn(rel, rect, B, a, ax) }])
      const cg = r.cut.part
      if (!cg || !cg.attributes.position.count) return
      g.dispose()
      msh.geometry = r.geo
      I.refreshBounds(r.geo)
      dirty.add(msh)
      if (!keep) {
        cg.dispose()
        pieces.push({ cut: true })
        return
      }
      const pm = new THREE.Mesh(cg, msh.material)
      pm.castShadow = true
      pm.receiveShadow = true
      rel.decompose(pm.position, pm.quaternion, pm.scale)
      c.vehicle.add(pm)
      pm.updateMatrixWorld(true)
      if (o.pieceTasks) o.pieceTasks.set(pm, r.tasks.part)
      pieces.push({ mesh: pm, cut: true })
    })
    return pieces
  }
  /* groups meshes into a pivot (in c.vehicle coordinates) keeping the world position */
  function pivotOf(c: any, objs: any, at: any) {
    const piv = new THREE.Group()
    piv.position.copy(at)
    piv.userData.rigid = true
    piv.userData.noFollow = true
    c.vehicle.add(piv)
    c.root.updateMatrixWorld(true)
    objs.forEach(function (o: any) {
      if (o && o.parent) {
        piv.attach(o)
        o.traverse(function (x: any) {
          x.userData.noFollow = true
        })
        const di = c.deform.indexOf(o)
        if (di >= 0) c.deform.splice(di, 1)
      }
    })
    return piv
  }

  Object.assign(I, { sm, subdivIn, dentTargets, zoneDent, cutPanel, pivotOf })
}
