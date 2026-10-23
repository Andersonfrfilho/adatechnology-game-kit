/** Geometry helpers: rounded boxes, lofts, creasing, subdivision, merging and convex hulls. */
import type { Kit } from './types'
import { clamp } from './util'

export function installGeometry(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._

  /* ================= geometry ================= */
  function roundedBoxGeometry(w: any, h: any, d: any, r: any) {
    r = Math.max(0.002, Math.min(r, w * 0.45, h * 0.45, d * 0.45))
    const nb = 3
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
  function crease(geo: any, deg: any) {
    if (geo.index) {
      const ni = geo.toNonIndexed()
      Object.keys(ni.attributes).forEach(function (k) {
        geo.setAttribute(k, ni.attributes[k])
      })
      geo.setIndex(null)
    }
    const p = geo.attributes.position
    const n = p.count
    const FN = []
    const map: any = {}
    const A = new V3()
    const B = new V3()
    const C = new V3()
    const e1 = new V3()
    const e2 = new V3()
    function key(i: any) {
      return Math.round(p.getX(i) * 2000) + ',' + Math.round(p.getY(i) * 2000) + ',' + Math.round(p.getZ(i) * 2000)
    }
    const keys = new Array(n)
    for (let f = 0; f < n / 3; f++) {
      A.fromBufferAttribute(p, 3 * f)
      B.fromBufferAttribute(p, 3 * f + 1)
      C.fromBufferAttribute(p, 3 * f + 2)
      const nn = new V3().crossVectors(e1.subVectors(C, B), e2.subVectors(A, B))
      if (nn.lengthSq() > 1e-20) nn.normalize()
      FN.push(nn)
      for (let k = 0; k < 3; k++) {
        const kk = key(3 * f + k)
        keys[3 * f + k] = kk
        ;(map[kk] || (map[kk] = [])).push(f)
      }
    }
    const cs = Math.cos((deg * PI) / 180)
    const out = new Float32Array(n * 3)
    const s = new V3()
    for (let i = 0; i < n; i++) {
      const fi = (i / 3) | 0
      const list = map[keys[i]]
      s.set(0, 0, 0)
      for (let j = 0; j < list.length; j++) {
        const g = FN[list[j]]
        if (g.dot(FN[fi]) >= cs) s.add(g)
      }
      if (s.lengthSq() < 1e-20) s.copy(FN[fi])
      s.normalize()
      out[3 * i] = s.x
      out[3 * i + 1] = s.y
      out[3 * i + 2] = s.z
    }
    geo.setAttribute('normal', new THREE.BufferAttribute(out, 3))
    geo.userData.crease = true
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
     Triangles crossing the edge are cut along the line sdf = 0. Removed pieces with a tag come back in .cut[tag]. */
  function cutGeometry(geo: any, tests: any) {
    const src = geo.index ? geo.toNonIndexed() : geo
    const names = ['position'].concat(
      ['color', 'uv'].filter(function (n) {
        return !!src.attributes[n]
      }),
    )
    const sizes = names.map(function (n) {
      return src.attributes[n].itemSize
    })
    const arrs = names.map(function (n) {
      return src.attributes[n].array
    })
    const nv = src.attributes.position.count
    let tris: any = []
    for (let f = 0; f < nv; f += 3) {
      const t = []
      for (let k = 0; k < 3; k++) {
        const v = []
        for (let a = 0; a < names.length; a++) for (let q = 0; q < sizes[a]; q++) v.push(arrs[a][(f + k) * sizes[a] + q])
        t.push(v)
      }
      tris.push(t)
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
    tests.forEach(function (T: any) {
      const next: any = []
      const rem = T.tag ? (cut[T.tag] = cut[T.tag] || []) : null
      tris.forEach(function (t: any) {
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
      })
      tris = next
    })
    function build(list: any) {
      const g = new THREE.BufferGeometry()
      let off = 0
      names.forEach(function (nm, a) {
        const arr = new Float32Array(list.length * 3 * sizes[a])
        let w = 0
        list.forEach(function (t: any) {
          for (let k = 0; k < 3; k++) for (let q = 0; q < sizes[a]; q++) arr[w++] = t[k][off + q]
        })
        g.setAttribute(nm, new THREE.BufferAttribute(arr, sizes[a]))
        off += sizes[a]
      })
      g.userData.crease = true
      return g
    }
    const out: any = { geo: build(tris), cut: {} }
    Object.keys(cut).forEach(function (k) {
      out.cut[k] = crease(build(cut[k]), 42)
    })
    return out
  }
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

  Object.assign(I, { roundedBoxGeometry, taper, subdivide, crease, pathShape, tumble, loftGeometry, hullGeometry, cutGeometry, mergeGeometries, uvProject })
}
