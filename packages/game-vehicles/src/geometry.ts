/** Geometry helpers: rounded boxes, lofts, creasing, subdivision, merging and convex hulls. */
import type { Kit } from './types'
import { clamp } from './util'
import { TRI_BLOCK, boundsFromIndex, storeTriIndex, triIndexOf } from './tri-index'

export function installGeometry(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._
  const lod = kit.lod

  /* ================= geometry ================= */
  function roundedBoxGeometry(w: any, h: any, d: any, r: any) {
    r = Math.max(0.002, Math.min(r, w * 0.45, h * 0.45, d * 0.45))
    /* light mode: a small or hard-edged box is a plain box (12 triangles), the rest gets fewer rounding rings */
    if (lod.on && (r < 0.012 || Math.max(w, h, d) < lod.flatBoxEdge || Math.min(w, h, d) < 0.08)) return new THREE.BoxGeometry(w, h, d)
    const nb = lod.on ? lod.roundingRings : 3
    const n = 2 * nb + 1
    const g = new THREE.BoxGeometry(1, 1, 1, n, n, n)
    const p = g.attributes.position
    const nr = g.attributes.normal
    const hx = w / 2 - r
    const hy = h / 2 - r
    const hz = d / 2 - r
    function map(v: any, hi: any) {
      const i = Math.round((v + 0.5) * n)
      return i <= nb ? -hi - (r * (nb - i)) / nb : hi + (r * (i - nb - 1)) / nb
    }
    const q = new V3()
    const c = new V3()
    const dir = new V3()
    for (let i = 0; i < p.count; i++) {
      q.set(map(p.getX(i), hx), map(p.getY(i), hy), map(p.getZ(i), hz))
      c.set(clamp(q.x, -hx, hx), clamp(q.y, -hy, hy), clamp(q.z, -hz, hz))
      dir.subVectors(q, c)
      if (dir.lengthSq() > 1e-12) {
        dir.normalize()
        q.copy(c).addScaledVector(dir, r)
        nr.setXYZ(i, dir.x, dir.y, dir.z)
      }
      p.setXYZ(i, q.x, q.y, q.z)
    }
    return g
  }
  function taper(geo: any, t: any) {
    geo.computeBoundingBox()
    const bb = geo.boundingBox
    const h = bb.max.y - bb.min.y
    const p = geo.attributes.position
    const sx = t.sx == null ? 1 : t.sx
    const sz = t.sz == null ? 1 : t.sz
    const sh = t.shift || 0
    for (let i = 0; i < p.count; i++) {
      const k = (p.getY(i) - bb.min.y) / h
      p.setX(i, p.getX(i) * (1 + (sx - 1) * k) + sh * k)
      p.setZ(i, p.getZ(i) * (1 + (sz - 1) * k))
    }
    p.needsUpdate = true
    geo.computeVertexNormals()
  }
  function subdivide(geo: any, maxLen: any) {
    if (lod.on) maxLen = maxLen * lod.subdivisionFactor
    const src = geo.index ? geo.toNonIndexed() : geo
    const a = src.attributes.position.array
    const out: any = []
    function d(p: any, q: any) {
      return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
    }
    function m(p: any, q: any) {
      return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2]
    }
    function tri(A: any, B: any, C: any, depth: any) {
      const ab = d(A, B)
      const bc = d(B, C)
      const ca = d(C, A)
      const mx = Math.max(ab, bc, ca)
      if (mx <= maxLen || depth > 12) {
        out.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2])
        return
      }
      if (mx === ab) {
        const D = m(A, B)
        tri(A, D, C, depth + 1)
        tri(D, B, C, depth + 1)
      } else if (mx === bc) {
        const E2 = m(B, C)
        tri(A, B, E2, depth + 1)
        tri(A, E2, C, depth + 1)
      } else {
        const F = m(C, A)
        tri(A, B, F, depth + 1)
        tri(F, B, C, depth + 1)
      }
    }
    for (let i = 0; i < a.length; i += 9) tri([a[i], a[i + 1], a[i + 2]], [a[i + 3], a[i + 4], a[i + 5]], [a[i + 6], a[i + 7], a[i + 8]], 0)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3))
    g.userData.crease = true
    return g
  }
  const latestCrease = new WeakMap<object, object>()
  /* The smoothing of `crease` as slices: `step(deadline)` works until the clock passes it and returns whether it finished.
     The normals start as flat face normals, so the mesh draws right between the slices; the end result is the same as one call. */
  function creaseTask(geo: any, deg: any) {
    if (geo.index) {
      const ni = geo.toNonIndexed()
      Object.keys(ni.attributes).forEach(function (k) {
        geo.setAttribute(k, ni.attributes[k])
      })
      geo.setIndex(null)
    }
    const P: ArrayLike<number> = geo.attributes.position.array
    const n = geo.attributes.position.count
    const faces = n / 3
    /* face normals in one array (x, y, z per face): the same arithmetic as the vector operations, without an object per face */
    const FN = new Float64Array(faces * 3)
    const out = new Float32Array(n * 3)
    for (let f = 0; f < faces; f++) {
      const o = 9 * f
      const ax = P[o]
      const ay = P[o + 1]
      const az = P[o + 2]
      const bx = P[o + 3]
      const by = P[o + 4]
      const bz = P[o + 5]
      const cx = P[o + 6]
      const cy = P[o + 7]
      const cz = P[o + 8]
      /* cross(C - B, A - B) */
      const e1x = cx - bx
      const e1y = cy - by
      const e1z = cz - bz
      const e2x = ax - bx
      const e2y = ay - by
      const e2z = az - bz
      let nx = e1y * e2z - e1z * e2y
      let ny = e1z * e2x - e1x * e2z
      let nz = e1x * e2y - e1y * e2x
      if (nx * nx + ny * ny + nz * nz > 1e-20) {
        const inv = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1)
        nx *= inv
        ny *= inv
        nz *= inv
      }
      FN[3 * f] = nx
      FN[3 * f + 1] = ny
      FN[3 * f + 2] = nz
      for (let k = 0; k < 3; k++) {
        out[9 * f + 3 * k] = nx
        out[9 * f + 3 * k + 1] = ny
        out[9 * f + 3 * k + 2] = nz
      }
    }
    const normal = new THREE.BufferAttribute(out, 3)
    geo.setAttribute('normal', normal)
    /* a later crease of the same geometry replaces this task: its normals are the ones that stand */
    const token = {}
    latestCrease.set(geo, token)
    /* vertices closer than 1/2000 share a group: open-addressing hash over the three rounded coordinates, no object or string per vertex */
    let size = 16
    while (size < n * 2) size *= 2
    const mask = size - 1
    const slot = new Int32Array(size).fill(-1)
    const gx = new Int32Array(n)
    const gy = new Int32Array(n)
    const gz = new Int32Array(n)
    const groupOf = new Int32Array(n)
    let groups = 0
    let start: Int32Array
    let members: Int32Array
    const cs = Math.cos((deg * PI) / 180)
    let phase = 0
    let at = 0
    function hashSlice(deadline: number) {
      for (; at < n; at++) {
        if ((at & 1023) === 0 && performance.now() > deadline) return false
        const x = Math.round(P[3 * at] * 2000) | 0
        const y = Math.round(P[3 * at + 1] * 2000) | 0
        const z = Math.round(P[3 * at + 2] * 2000) | 0
        let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & mask
        let g = slot[h]
        while (g >= 0 && (gx[g] !== x || gy[g] !== y || gz[g] !== z)) {
          h = (h + 1) & mask
          g = slot[h]
        }
        if (g < 0) {
          g = groups++
          slot[h] = g
          gx[g] = x
          gy[g] = y
          gz[g] = z
        }
        groupOf[at] = g
      }
      return true
    }
    function gather() {
      /* faces of each group, in ascending face order so the sums add in the same order as ever */
      start = new Int32Array(groups + 1)
      for (let i = 0; i < n; i++) start[groupOf[i] + 1]++
      for (let g = 0; g < groups; g++) start[g + 1] += start[g]
      const fill = start.slice(0, groups)
      members = new Int32Array(n)
      for (let i = 0; i < n; i++) members[fill[groupOf[i]]++] = (i / 3) | 0
    }
    function smoothSlice(deadline: number) {
      for (; at < n; at++) {
        if ((at & 1023) === 0 && performance.now() > deadline) return false
        const fi = ((at / 3) | 0) * 3
        const g = groupOf[at]
        let sx = 0
        let sy = 0
        let sz = 0
        for (let j = start[g], end = start[g + 1]; j < end; j++) {
          const o = members[j] * 3
          if (FN[o] * FN[fi] + FN[o + 1] * FN[fi + 1] + FN[o + 2] * FN[fi + 2] >= cs) {
            sx += FN[o]
            sy += FN[o + 1]
            sz += FN[o + 2]
          }
        }
        if (sx * sx + sy * sy + sz * sz < 1e-20) {
          sx = FN[fi]
          sy = FN[fi + 1]
          sz = FN[fi + 2]
        }
        const inv = 1 / (Math.sqrt(sx * sx + sy * sy + sz * sz) || 1)
        out[3 * at] = sx * inv
        out[3 * at + 1] = sy * inv
        out[3 * at + 2] = sz * inv
      }
      return true
    }
    function step(deadline: number) {
      if (latestCrease.get(geo) !== token) return true
      if (phase === 0) {
        if (!hashSlice(deadline)) return false
        gather()
        phase = 1
        at = 0
      }
      if (phase === 1) {
        const done = smoothSlice(deadline)
        /* a one-shot crease replaces the normals before anything could draw them; only sliced work follows an upload of the flat ones */
        if (deadline !== Infinity) normal.needsUpdate = true
        if (!done) return false
        phase = 2
        geo.userData.crease = true
      }
      return true
    }
    return { geo: geo, step: step }
  }
  function crease(geo: any, deg: any) {
    creaseTask(geo, deg).step(Infinity)
    return geo
  }
  function pathShape(items: any) {
    const s = new THREE.Shape()
    const n = items.length
    function sp(it: any) {
      return it.arc ? [it.arc[0] + it.arc[2] * Math.cos(it.arc[3]), it.arc[1] + it.arc[2] * Math.sin(it.arc[3])] : [it[0], it[1]]
    }
    function ep(it: any) {
      return it.arc ? [it.arc[0] + it.arc[2] * Math.cos(it.arc[4]), it.arc[1] + it.arc[2] * Math.sin(it.arc[4])] : [it[0], it[1]]
    }
    const ins = []
    const outs = []
    for (let i = 0; i < n; i++) {
      const it = items[i]
      if (it.arc) {
        ins.push(sp(it))
        outs.push(ep(it))
        continue
      }
      const r = it[2] || 0
      const pv = ep(items[(i - 1 + n) % n])
      const nx = sp(items[(i + 1) % n])
      const dp = Math.hypot(pv[0] - it[0], pv[1] - it[1]) || 1
      const dn = Math.hypot(nx[0] - it[0], nx[1] - it[1]) || 1
      const rp = Math.min(r, dp * 0.45)
      const rn = Math.min(r, dn * 0.45)
      ins.push([it[0] + ((pv[0] - it[0]) / dp) * rp, it[1] + ((pv[1] - it[1]) / dp) * rp])
      outs.push([it[0] + ((nx[0] - it[0]) / dn) * rn, it[1] + ((nx[1] - it[1]) / dn) * rn])
    }
    s.moveTo(outs[0][0], outs[0][1])
    for (let j = 1; j <= n; j++) {
      const idx = j % n
      const it2 = items[idx]
      s.lineTo(ins[idx][0], ins[idx][1])
      if (it2.arc) s.absarc(it2.arc[0], it2.arc[1], it2.arc[2], it2.arc[3], it2.arc[4], !!it2.arc[5])
      else if ((it2[2] || 0) > 0) s.quadraticCurveTo(it2[0], it2[1], outs[idx][0], outs[idx][1])
    }
    return s
  }
  function tumble(geo: any, T: any) {
    if (!T) return
    const p = geo.attributes.position
    for (let i = 0; i < p.count; i++) {
      const t = clamp((p.getY(i) - T.belt) / (T.top - T.belt), 0, 1)
      p.setZ(i, p.getZ(i) * (1 - T.k * t))
    }
    p.needsUpdate = true
  }
  function loftGeometry(st: any, seg: any, pw: any, colorFn: any) {
    seg = seg || 22
    pw = pw || 2
    const pos: any = []
    const col: any = []
    const idx = []
    const ring = seg + 1
    st.forEach(function (s: any) {
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * PI * 2
        const c = Math.cos(a)
        const sn = Math.sin(a)
        const e = 2 / (s.p || pw)
        const yy = s.y + (s.h / 2) * Math.sign(sn) * Math.pow(Math.abs(sn), e)
        const zz = (s.w / 2) * Math.sign(c) * Math.pow(Math.abs(c), e)
        pos.push(s.x, yy, zz)
        if (colorFn) {
          const cc = colorFn(s.x, yy, zz, s)
          col.push(cc.r, cc.g, cc.b)
        }
      }
    })
    for (let i = 0; i < st.length - 1; i++)
      for (let k = 0; k < seg; k++) {
        const a0 = i * ring + k
        const b0 = a0 + ring
        idx.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0)
      }
    ;[0, st.length - 1].forEach(function (si, e) {
      const s = st[si]
      if (s.w < 0.01) return
      const ci = pos.length / 3
      pos.push(s.x, s.y, 0)
      if (colorFn) {
        const cc = colorFn(s.x, s.y, 0, s)
        col.push(cc.r, cc.g, cc.b)
      }
      for (let k = 0; k < seg; k++) {
        const a = si * ring + k
        if (e === 0) idx.push(ci, a + 1, a)
        else idx.push(ci, a, a + 1)
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }
  function hullGeometry(o: any, colorFn: any) {
    const n = o.n || 18
    const m = 14
    const pos = []
    const col = []
    const idx = []
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const x = -o.L / 2 + t * o.L
      const b = o.beam(t)
      const ky = o.keel(t)
      const sy = o.sheer(t)
      for (let j = 0; j <= m; j++) {
        const v = (j / m) * 2 - 1
        const z = b * v
        const y = ky + (sy - ky) * Math.pow(Math.abs(v), o.p || 2)
        pos.push(x, y, z)
        if (colorFn) {
          const c = colorFn(x, y, z)
          col.push(c.r, c.g, c.b)
        }
      }
    }
    for (let a = 0; a < n; a++)
      for (let k = 0; k < m; k++) {
        const p0 = a * (m + 1) + k
        const p1 = p0 + m + 1
        idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1)
      }
    const ci = pos.length / 3
    const x0 = -o.L / 2
    const sy0 = o.sheer(0)
    pos.push(x0, sy0, 0)
    if (colorFn) {
      const c0 = colorFn(x0, sy0, 0)
      col.push(c0.r, c0.g, c0.b)
    }
    for (let q = 0; q < m; q++) idx.push(ci, q, q + 1)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }
  /* Cuts triangles: each test { sel(normal, centre) -> bool, sdf(x,y,z) -> number (negative = remove), tag }.
     Triangles crossing the edge are cut along the line sdf = 0. Removed pieces with a tag come back in .cut[tag].
     A lone test may carry `bounds` { lo, hi } (a box in the frame of the geometry that holds every point with sdf < 0): triangles outside it are
     copied as they are, with no per-triangle work, and the result is the same as testing them. */
  function cutGeometry(geo: any, tests: any) {
    const idx = geo.index ? geo.index.array : null
    const names = ['position'].concat(
      ['color', 'uv'].filter(function (n) {
        return !!geo.attributes[n]
      }),
    )
    const sizes = names.map(function (n) {
      return geo.attributes[n].itemSize
    })
    const arrs = names.map(function (n) {
      return geo.attributes[n].array
    })
    const nv = idx ? idx.length : geo.attributes.position.count
    function readTri(f: number) {
      const t = []
      for (let k = 0; k < 3; k++) {
        const vi = idx ? idx[f + k] : f + k
        const v = []
        for (let a = 0; a < names.length; a++) for (let q = 0; q < sizes[a]; q++) v.push(arrs[a][vi * sizes[a] + q])
        t.push(v)
      }
      return t
    }
    const cut: any = {}
    const n = new V3()
    const e1 = new V3()
    const e2 = new V3()
    const ce = new V3()
    function lerp(P: any, Q: any, k: any) {
      const o = new Array(P.length)
      for (let i = 0; i < P.length; i++) o[i] = P[i] + (Q[i] - P[i]) * k
      return o
    }
    function clip(t: any, d: any, s: any) {
      const out = []
      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3
        const di = s * d[i]
        const dj = s * d[j]
        if (di >= 0) out.push(t[i])
        if (di >= 0 !== dj >= 0) out.push(lerp(t[i], t[j], di / (di - dj)))
      }
      return out
    }
    function fan(poly: any, arr: any) {
      for (let i = 1; i < poly.length - 1; i++) arr.push([poly[0], poly[i], poly[i + 1]])
    }
    function testTri(T: any, t: any, next: any, rem: any) {
      const A = t[0]
      const B = t[1]
      const C = t[2]
      e1.set(B[0] - A[0], B[1] - A[1], B[2] - A[2])
      e2.set(C[0] - A[0], C[1] - A[1], C[2] - A[2])
      n.crossVectors(e1, e2)
      const len = n.length()
      if (len < 1e-12) {
        next.push(t)
        return
      }
      n.multiplyScalar(1 / len)
      ce.set((A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3)
      if (T.sel && !T.sel(n, ce)) {
        next.push(t)
        return
      }
      const d = [T.sdf(A[0], A[1], A[2]), T.sdf(B[0], B[1], B[2]), T.sdf(C[0], C[1], C[2])]
      const ins = (d[0] < 0 ? 1 : 0) + (d[1] < 0 ? 1 : 0) + (d[2] < 0 ? 1 : 0)
      if (ins === 0) next.push(t)
      else if (ins === 3) {
        if (rem) rem.push(t)
      } else {
        fan(clip(t, d, 1), next)
        if (rem) fan(clip(t, d, -1), rem)
      }
    }
    /* what the result is made of, in order: [first, end) triangle ranges copied as they are, and lists of triangles that went through the test */
    const segments: any = []
    let total = 0
    const ti = tests.length === 1 && tests[0].bounds ? triIndexOf(geo) : undefined
    if (ti) {
      const T = tests[0]
      const lo = T.bounds.lo
      const hi = T.bounds.hi
      const rem = T.tag ? (cut[T.tag] = cut[T.tag] || []) : null
      const boxes = ti.boxes
      const blocks = ti.blocks
      let runFrom = -1
      const closeRun = function (end: number) {
        if (runFrom < 0) return
        segments.push([runFrom, end])
        total += end - runFrom
        runFrom = -1
      }
      for (let blk = 0, t0 = 0; t0 < ti.triangles; blk++, t0 += TRI_BLOCK) {
        const j = blk * 6
        if (blocks[j + 3]! < lo[0] || blocks[j]! > hi[0] || blocks[j + 4]! < lo[1] || blocks[j + 1]! > hi[1] || blocks[j + 5]! < lo[2] || blocks[j + 2]! > hi[2]) {
          if (runFrom < 0) runFrom = t0
          continue
        }
        const t1 = Math.min(ti.triangles, t0 + TRI_BLOCK)
        for (let t = t0; t < t1; t++) {
          const q = t * 6
          if (boxes[q + 3]! < lo[0] || boxes[q]! > hi[0] || boxes[q + 4]! < lo[1] || boxes[q + 1]! > hi[1] || boxes[q + 5]! < lo[2] || boxes[q + 2]! > hi[2]) {
            if (runFrom < 0) runFrom = t
            continue
          }
          closeRun(t)
          const next: any = []
          testTri(T, readTri(t * 3), next, rem)
          if (next.length) {
            segments.push(next)
            total += next.length
          }
        }
      }
      closeRun(ti.triangles)
    } else {
      let tris: any = []
      for (let f = 0; f < nv; f += 3) tris.push(readTri(f))
      tests.forEach(function (T: any) {
        const next: any = []
        const rem = T.tag ? (cut[T.tag] = cut[T.tag] || []) : null
        tris.forEach(function (t: any) {
          testTri(T, t, next, rem)
        })
        tris = next
      })
      segments.push(tris)
      total = tris.length
    }
    function fill(segs: any, count: number, boxesOut?: Float64Array) {
      const g = new THREE.BufferGeometry()
      const dst = names.map(function (_nm, a) {
        return new Float32Array(count * 3 * sizes[a])
      })
      const w = names.map(function () {
        return 0
      })
      let wb = 0
      segs.forEach(function (seg: any) {
        if (typeof seg[0] === 'number') {
          for (let a = 0; a < names.length; a++) {
            const size = sizes[a]
            if (!idx) {
              dst[a].set(arrs[a].subarray(seg[0] * 3 * size, seg[1] * 3 * size), w[a])
              w[a] += (seg[1] - seg[0]) * 3 * size
              continue
            }
            for (let f = seg[0] * 3; f < seg[1] * 3; f++) for (let q = 0; q < size; q++) dst[a][w[a]++] = arrs[a][idx[f] * size + q]
          }
          if (boxesOut && ti) {
            boxesOut.set(ti.boxes.subarray(seg[0] * 6, seg[1] * 6), wb)
            wb += (seg[1] - seg[0]) * 6
          }
          return
        }
        seg.forEach(function (t: any) {
          if (boxesOut) {
            for (let k = 0; k < 3; k++) {
              boxesOut[wb + k] = Math.fround(Math.min(t[0][k], t[1][k], t[2][k]))
              boxesOut[wb + 3 + k] = Math.fround(Math.max(t[0][k], t[1][k], t[2][k]))
            }
            wb += 6
          }
          let off = 0
          for (let a = 0; a < names.length; a++) {
            for (let k = 0; k < 3; k++) for (let q = 0; q < sizes[a]; q++) dst[a][w[a]++] = t[k][off + q]
            off += sizes[a]
          }
        })
      })
      names.forEach(function (nm, a) {
        g.setAttribute(nm, new THREE.BufferAttribute(dst[a], sizes[a]))
      })
      g.userData.crease = true
      return g
    }
    const boxesOut = ti ? new Float64Array(total * 6) : undefined
    const out: any = { geo: fill(segments, total, boxesOut), cut: {}, tasks: {} }
    if (boxesOut) storeTriIndex(out.geo, boxesOut)
    Object.keys(cut).forEach(function (k) {
      const piece = fill([cut[k]], cut[k].length)
      const mode = tests.find(function (T: any) {
        return T.tag === k
      }).pieces
      if (mode === 'none') out.cut[k] = piece
      else if (mode === 'later') {
        out.cut[k] = piece
        out.tasks[k] = creaseTask(piece, 42)
      } else out.cut[k] = crease(piece, 42)
    })
    return out
  }
  /* The bounding box and sphere of a geometry, the same numbers as computeBoundingBox and computeBoundingSphere; for a non-indexed geometry with a
     complete triangle index the box comes from the blocks and the vertices are read once, and nothing is redone while the positions stand. */
  function refreshBounds(geo: any) {
    const found = boundsFromIndex(geo)
    if (!found) {
      geo.computeBoundingSphere()
      geo.computeBoundingBox()
      return
    }
    if (geo.boundingBox && geo.boundingSphere && boundsDone.get(geo) === found.version) return
    const b = found.box
    if (!geo.boundingBox) geo.boundingBox = new THREE.Box3()
    geo.boundingBox.min.set(b[0], b[1], b[2])
    geo.boundingBox.max.set(b[3], b[4], b[5])
    if (!geo.boundingSphere) geo.boundingSphere = new THREE.Sphere()
    const center = geo.boundingBox.getCenter(geo.boundingSphere.center)
    const P = geo.attributes.position.array
    let maxRadiusSq = 0
    for (let i = 0; i < P.length; i += 3) {
      const dx = center.x - P[i]
      const dy = center.y - P[i + 1]
      const dz = center.z - P[i + 2]
      maxRadiusSq = Math.max(maxRadiusSq, dx * dx + dy * dy + dz * dz)
    }
    geo.boundingSphere.radius = Math.sqrt(maxRadiusSq)
    boundsDone.set(geo, found.version)
  }
  const boundsDone = new WeakMap<object, number>()
  /* Merges geometries (already transformed) into one, for repeated parts such as track links and honeycomb. */
  function mergeGeometries(list: any) {
    const pos: any = []
    const nor: any = []
    list.forEach(function (g: any) {
      const n = g.index ? g.toNonIndexed() : g
      if (!n.attributes.normal) n.computeVertexNormals()
      const pa = n.attributes.position.array
      const na = n.attributes.normal.array
      for (let i = 0; i < pa.length; i++) {
        pos.push(pa[i])
        nor.push(na[i])
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    return g
  }
  /* Normalised 0..1 UV projecting onto the two axes of greatest extent (or onto the given axes, e.g. "xy"). */
  function uvProject(geo: any, axes: any) {
    geo.computeBoundingBox()
    const bb = geo.boundingBox
    const sz = new V3().subVectors(bb.max, bb.min)
    const ax = axes
      ? [axes.charCodeAt(0) - 120, axes.charCodeAt(1) - 120]
      : [0, 1, 2]
          .sort(function (a, b) {
            return sz.getComponent(b) - sz.getComponent(a)
          })
          .slice(0, 2)
          .sort()
    const p = geo.attributes.position
    const uv = new Float32Array(p.count * 2)
    const v = new V3()
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      uv[2 * i] = (v.getComponent(ax[0]) - bb.min.getComponent(ax[0])) / (sz.getComponent(ax[0]) || 1)
      uv[2 * i + 1] = (v.getComponent(ax[1]) - bb.min.getComponent(ax[1])) / (sz.getComponent(ax[1]) || 1)
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    return sz.getComponent(ax[0]) / (sz.getComponent(ax[1]) || 1)
  }
  kit.geo = {
    roundedBox: roundedBoxGeometry,
    taper: taper,
    subdivide: subdivide,
    crease: crease,
    pathShape: pathShape,
    tumble: tumble,
    loft: loftGeometry,
    hull: hullGeometry,
    cut: cutGeometry,
    merge: mergeGeometries,
    uvProject: uvProject,
  }
  /* Ready-made holes for shell({ holes }) and geo.cut */
  kit.holeTop = function (x0: any, x1: any, z: any, yMin: any, tag: any) {
    return {
      tag: tag,
      sel: function (n: any, ce: any) {
        return n.y > 0.3 && ce.y > yMin
      },
      sdf: function (x: any, y: any, zz: any) {
        return Math.max(x0 - x, x - x1, Math.abs(zz) - z)
      },
    }
  }
  kit.holeSide = function (poly: any, o: any) {
    o = o || {}
    let area = 0
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      area += a[0] * b[1] - b[0] * a[1]
    }
    const sg = area > 0 ? 1 : -1
    const E2 = poly.map(function (a: any, i: any) {
      const b = poly[(i + 1) % poly.length]
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const L = Math.hypot(dx, dy) || 1
      return [a[0], a[1], (sg * dy) / L, (-sg * dx) / L]
    })
    const sh = o.shrink || 0
    const zMin = o.zMin || 0
    return {
      tag: o.tag,
      sel: function (n: any, ce: any) {
        return Math.abs(n.z) > 0.5 && Math.abs(ce.z) >= zMin && (o.side == null || Math.sign(ce.z) === o.side)
      },
      sdf: function (x: any, y: any) {
        let d = -1e9
        for (let i = 0; i < E2.length; i++) {
          const e = E2[i]
          d = Math.max(d, (x - e[0]) * e[2] + (y - e[1]) * e[3])
        }
        return d + sh
      },
    }
  }
  kit.holeQuad = function (q: any, margin: any) {
    margin = margin || 0
    return {
      sel: function (n: any) {
        return n.x * q.n[0] + n.y * q.n[1] > 0.55
      },
      sdf: function (x: any, y: any, z: any) {
        const rx = x - q.pb[0]
        const ry = y - q.pb[1]
        const s = rx * q.u[0] + ry * q.u[1]
        const dn = rx * q.n[0] + ry * q.n[1]
        const s0 = q.ins
        const s1 = q.L - q.ins * 1.3
        const k = clamp((s - s0) / (s1 - s0), 0, 1)
        const hw = q.hb + (q.ht - q.hb) * k - margin
        return Math.max(s0 + margin - s, s - s1 + margin, Math.abs(z) - hw, Math.abs(dn - q.bev) - 0.08)
      },
    }
  }
  kit.holeBox = function (min: any, max: any, sel: any, tag: any) {
    return {
      tag: tag,
      sel: sel || null,
      sdf: function (x: any, y: any, z: any) {
        return Math.max(min[0] - x, x - max[0], min[1] - y, y - max[1], min[2] - z, z - max[2])
      },
    }
  }
  kit.holeWhere = function (sel: any, tag: any) {
    return {
      tag: tag,
      sel: sel,
      sdf: function () {
        return -1
      },
    }
  }

  Object.assign(I, { roundedBoxGeometry, taper, subdivide, crease, creaseTask, refreshBounds, pathShape, tumble, loftGeometry, hullGeometry, cutGeometry, mergeGeometries, uvProject })
}
