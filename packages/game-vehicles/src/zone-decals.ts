/** Zone decals: scratches, rust, burn marks and dents drawn as textures. */
import type { Kit } from './types'

export function installZoneDecals(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._
  const { makeMaterial, DOUBLE_SIDE } = I

  /* ---- damage materials ---- */
  function dmat(hex: any, o: any) {
    return makeMaterial(hex, Object.assign({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3, side: DOUBLE_SIDE }, o || {}))
  }
  const DAMAGE_MATERIALS = {
    /* without an environment map, high-metalness metal turns black and chipped paint looks like a bullet hole: light, barely metallic metal */
    fine: dmat('#b9bec0', { metalness: 0.3, roughness: 0.45 }),
    deep: dmat('#d6dadc', { metalness: 0.35, roughness: 0.35 }),
    primer: dmat('#8a8d8b', { roughness: 0.95 }),
    metal: dmat('#c3c7ca', { metalness: 0.35, roughness: 0.38 }),
    rust: dmat('#6b3a1e', { roughness: 1 }),
    rust2: dmat('#46220f', { roughness: 1 }),
    hole: dmat('#0a0a0b', { roughness: 1 }),
    edge: dmat('#c9cdd0', { metalness: 0.45, roughness: 0.3 }),
    seam: dmat('#060607', { roughness: 1 }),
    soot: makeMaterial('#14110f', {
      roughness: 1,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      side: DOUBLE_SIDE,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -3,
    }),
    scrape: makeMaterial('#1b1a19', {
      roughness: 1,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    }),
  }
  kit.damageMaterials = DAMAGE_MATERIALS
  const _zq = new THREE.Quaternion()
  const _zq2 = new THREE.Quaternion()
  const _zz = new V3(0, 0, 1)
  function orientDecal(m: any, p: any, n: any, ang: any) {
    _zq.setFromUnitVectors(_zz, n)
    _zq2.setFromAxisAngle(n, ang || 0)
    m.quaternion.copy(_zq2.multiply(_zq))
    m.position.copy(p).addScaledVector(n, 0.004)
  }
  function decalMesh(c: any, geo: any, mat: any, p: any, n: any, ang: any, obj?: any) {
    const m = c.add(geo, mat, 0, 0, 0)
    m.castShadow = false
    m.receiveShadow = false
    m.userData.decal = true
    m.raycast = function () {}
    orientDecal(m, p, n, ang)
    if (obj && obj.parent && obj.parent !== c.vehicle) {
      c.root.updateMatrixWorld(true)
      obj.parent.attach(m)
    }
    return m
  }
  function blobGeometry(r: any, rnd: any, jag?: any, ell?: any) {
    const s = new THREE.Shape()
    const nz = I.valueNoise(Math.floor(rnd() * 997))
    const N = 18
    const e = ell || 1
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * PI * 2
      const rr = r * (0.55 + 0.6 * nz(Math.cos(a) * 1.7 + 3, Math.sin(a) * 1.7 + 3)) * (jag && k % 2 ? 0.7 : 1)
      s[k ? 'lineTo' : 'moveTo'](Math.cos(a) * rr * e, Math.sin(a) * rr)
    }
    return new THREE.ShapeGeometry(s)
  }
  /* torn metal: a dark hole with a sharp edge of metal teeth that bend outward */
  function tearDecal(c: any, p: any, n: any, r: any, rnd: any, obj: any) {
    const N = 13
    const pts: any = []
    for (let k = 0; k < N; k++) {
      const a = (k / N) * PI * 2 + (rnd() - 0.5) * 0.3
      const rr = r * (k % 2 ? 0.42 + rnd() * 0.25 : 0.8 + rnd() * 0.35)
      pts.push([Math.cos(a) * rr * 1.25, Math.sin(a) * rr])
    }
    const s = new THREE.Shape()
    pts.forEach(function (q: any, i: any) {
      s[i ? 'lineTo' : 'moveTo'](q[0] * 0.86, q[1] * 0.86)
    })
    const hole = decalMesh(c, new THREE.ShapeGeometry(s), DAMAGE_MATERIALS.hole, p, n, rnd() * 6)
    const hp = hole.parent
    const pos: any = []
    pts.forEach(function (q: any, i: any) {
      const q2 = pts[(i + 1) % N]
      const ox = q[0] * 1.12
      const oy = q[1] * 1.12
      pos.push(q[0] * 0.86, q[1] * 0.86, 0, q2[0] * 0.86, q2[1] * 0.86, 0, ox, oy, 0.025 + rnd() * 0.03)
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.computeVertexNormals()
    const e = c.add(g, DAMAGE_MATERIALS.edge, 0, 0, 0)
    e.castShadow = false
    e.userData.decal = true
    e.raycast = function () {}
    e.quaternion.copy(hole.quaternion)
    e.position.copy(hole.position)
    if (obj && obj.parent && obj.parent !== c.vehicle) {
      c.root.updateMatrixWorld(true)
      obj.parent.attach(hole)
      obj.parent.attach(e)
    }
    void hp
    return hole
  }
  /* ---- surface inside the box: rays from outside in ---- */
  const _zr = new THREE.Raycaster()
  /* Every ray of a `zoneDecals` call stays inside one region around the zone (the rays of `zoneSurf` and the strokes of `scratchPath`). Bodywork
     meshes have tens of thousands of triangles and three.js tests all of them per ray, so for those the call raycasts a proxy that holds only the
     triangles whose box meets the region: same triangles that can be hit, same faces and distances, a fraction of the tests. */
  const PROXY_MIN_TRIANGLES = 500
  const STROKE_REACH = 0.6 /* scratchPath: 0.08 above the surface + 0.2 of ray + up to 0.25 along the stroke + the 0.02 of the box test */
  const _pv = new V3()
  const _pm = new THREE.Matrix4()
  function decalRegion(c: any, z: any) {
    const B = z.box
    const lo = [0, 1, 2].map(function (k) {
      return I.boxLo(B, k) - STROKE_REACH
    })
    const hi = [0, 1, 2].map(function (k) {
      return I.boxHi(B, k) + STROKE_REACH
    })
    const a = axisOf(z.dir)
    const dn = z.dir.clone().normalize()
    const sg = z.dir.getComponent(a) > 0 ? 1 : -1
    const outer = sg > 0 ? I.boxLo(B, a) - 0.6 : I.boxHi(B, a) + 0.6
    const far = 0.6 + (I.boxHi(B, a) - I.boxLo(B, a)) + 0.05
    for (let i = 0; i < 8; i++) {
      const p = new V3()
      p.setComponent(a, outer)
      ;[0, 1, 2]
        .filter(function (k) {
          return k !== a
        })
        .forEach(function (k, j) {
          p.setComponent(k, (i >> j) & 1 ? I.boxHi(B, k) : I.boxLo(B, k))
        })
      for (let e = 0; e < 2; e++) {
        const q = e ? p.clone().addScaledVector(dn, far) : p
        for (let k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k], q.getComponent(k) - 0.05)
          hi[k] = Math.max(hi[k], q.getComponent(k) + 0.05)
        }
      }
    }
    return { lo, hi }
  }
  /* the candidates of a decal call with the heavy meshes cut down to the region of the zone (the others stay as they are) */
  function regionCands(c: any, z: any, cands: any) {
    if (!cands.some(heavy)) return cands
    const R = decalRegion(c, z)
    const Mw = c.vehicle.matrixWorld
    return cands.map(function (o: any) {
      if (!heavy(o)) return o
      /* the ray test would have left the bounds of the mesh computed; the mesh keeps that */
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere()
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
      return proxyIn(o, Mw, R)
    })
  }
  function heavy(o: any) {
    const g = o.geometry
    const pos = g && g.attributes && g.attributes.position
    return (
      o.raycast === THREE.Mesh.prototype.raycast /* a mesh with a raycast of its own (the no-op of marks and puddles) keeps it */ &&
      !o.isSkinnedMesh &&
      !Array.isArray(o.material) &&
      pos &&
      !pos.isInterleavedBufferAttribute &&
      pos.itemSize === 3 &&
      !g.groups.length &&
      !(g.morphAttributes && g.morphAttributes.position) &&
      (g.index ? g.index.count : pos.count) / 3 >= PROXY_MIN_TRIANGLES
    )
  }
  function proxyIn(o: any, Mw: any, R: any) {
    /* the region (vehicle frame) as a box in the frame of the mesh */
    _pm.copy(o.matrixWorld).invert().multiply(Mw)
    const lo = [Infinity, Infinity, Infinity]
    const hi = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < 8; i++) {
      _pv.set(i & 1 ? R.hi[0] : R.lo[0], i & 2 ? R.hi[1] : R.lo[1], i & 4 ? R.hi[2] : R.lo[2]).applyMatrix4(_pm)
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], _pv.getComponent(k))
        hi[k] = Math.max(hi[k], _pv.getComponent(k))
      }
    }
    const g = o.geometry
    const P = g.attributes.position.array
    const ix = g.index ? g.index.array : null
    const n = ix ? ix.length : P.length / 3
    const keep = new Uint32Array(n - (n % 3))
    let nk = 0
    for (let t = 0; t + 2 < n; t += 3) {
      const a = (ix ? ix[t] : t) * 3
      const b = (ix ? ix[t + 1] : t + 1) * 3
      const d = (ix ? ix[t + 2] : t + 2) * 3
      let out = false
      for (let k = 0; k < 3 && !out; k++) {
        const u = P[a + k]
        const v = P[b + k]
        const w = P[d + k]
        out = Math.max(u, v, w) < lo[k] || Math.min(u, v, w) > hi[k]
      }
      if (!out) {
        keep[nk++] = ix ? ix[t] : t
        keep[nk++] = ix ? ix[t + 1] : t + 1
        keep[nk++] = ix ? ix[t + 2] : t + 2
      }
    }
    if (!nk) return null
    /* the triangles of the region (kept) and the ones a single ray needs (scratch, narrowed again in castAt) share one index buffer */
    const kept = keep.slice(0, nk)
    const box = new Float32Array((kept.length / 3) * 6)
    for (let t = 0, j = 0; t < kept.length; t += 3, j += 6) {
      const a = kept[t] * 3
      const b = kept[t + 1] * 3
      const d = kept[t + 2] * 3
      for (let k = 0; k < 3; k++) {
        box[j + k] = Math.min(P[a + k], P[b + k], P[d + k])
        box[j + 3 + k] = Math.max(P[a + k], P[b + k], P[d + k])
      }
    }
    const pg = new THREE.BufferGeometry()
    pg.setAttribute('position', g.attributes.position)
    pg.setIndex(new THREE.BufferAttribute(new Uint32Array(kept.length), 1))
    /* the bounds of the whole mesh hold for the proxy too (the ray test only skips with them), and the proxy shares its positions: no pass over all vertices */
    pg.boundingSphere = g.boundingSphere
    pg.boundingBox = g.boundingBox
    const proxy: any = new THREE.Mesh(pg, o.material)
    proxy.layers.mask = o.layers.mask
    proxy.proxyOf = o
    proxy.kept = kept
    proxy.keptBox = box
    return proxy
  }
  /* the triangles of a proxy whose box meets the box of the ray (in the frame of the mesh): the rest cannot be hit by it */
  function narrowTo(rc: any, proxy: any) {
    const o = proxy.proxyOf
    const ray = rc.ray
    _pm.copy(o.matrixWorld).invert()
    _pv.copy(ray.origin).applyMatrix4(_pm)
    const x0 = _pv.x
    const y0 = _pv.y
    const z0 = _pv.z
    _pv.copy(ray.direction).multiplyScalar(rc.far).add(ray.origin).applyMatrix4(_pm)
    const lo0 = Math.min(x0, _pv.x) - 1e-4
    const lo1 = Math.min(y0, _pv.y) - 1e-4
    const lo2 = Math.min(z0, _pv.z) - 1e-4
    const hi0 = Math.max(x0, _pv.x) + 1e-4
    const hi1 = Math.max(y0, _pv.y) + 1e-4
    const hi2 = Math.max(z0, _pv.z) + 1e-4
    const K = proxy.kept
    const X = proxy.keptBox
    const dst = proxy.geometry.index.array
    let m = 0
    for (let t = 0, j = 0; t < K.length; t += 3, j += 6) {
      if (X[j + 3] < lo0 || X[j] > hi0 || X[j + 4] < lo1 || X[j + 1] > hi1 || X[j + 5] < lo2 || X[j + 2] > hi2) continue
      dst[m++] = K[t]
      dst[m++] = K[t + 1]
      dst[m++] = K[t + 2]
    }
    proxy.geometry.setDrawRange(0, m)
  }
  /* raycast against decal candidates; a hit on a proxy is reported on the mesh it stands for */
  function castAt(rc: any, cands: any) {
    for (let i = 0; i < cands.length; i++) {
      const q = cands[i]
      if (!q.proxyOf) continue
      q.matrixWorld.copy(q.proxyOf.matrixWorld)
      narrowTo(rc, q)
    }
    const hits = rc.intersectObjects(cands, false)
    for (let i = 0; i < hits.length; i++) if (hits[i].object.proxyOf) hits[i].object = hits[i].object.proxyOf
    return hits
  }
  function zoneCands(c: any, z: any, inv: any, glassToo: any) {
    const out: any = []
    c.vehicle.traverse(function (o: any) {
      if (!o.isMesh || o.userData.decal || o.userData.ghost || !o.geometry || o.isSprite) return
      for (let q = o; q && q !== c.vehicle; q = q.parent) if (!q.visible) return
      if (o.userData.glass && !glassToo) return
      const ow = I.ownerOf(c, o)
      if (ow && ow !== z) return
      if (!skinOK(c, z, o, ow)) return
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
      if (I.boxIntersects(z.box, I.localBox(c, o, inv))) out.push(o)
    })
    return out
  }
  /* decals only on bodywork: shell, paint, parts of the zone itself (or any mesh with anyMesh/part) */
  const _dsetC = new WeakMap()
  function skinOK(c: any, z: any, o: any, ow: any) {
    if (ow === z || z.anyMesh || z.type === 'part' || z.type === 'wheel') return true
    if (c.paints && c.paints.has(o.material)) return true
    let ds = _dsetC.get(c.deform)
    if (!ds) {
      ds = new Set(c.deform)
      _dsetC.set(c.deform, ds)
    }
    return ds.has(o) || c.deform.indexOf(o) >= 0
  }
  function axisOf(d: any) {
    const a = Math.abs(d.x) >= Math.abs(d.y) && Math.abs(d.x) >= Math.abs(d.z) ? 0 : Math.abs(d.y) >= Math.abs(d.z) ? 1 : 2
    return a
  }
  function zoneSurf(c: any, z: any, n: any, rnd: any, cands: any, o?: any) {
    o = o || {}
    const out = []
    const B = z.box
    const d = z.dir
    const a = axisOf(d)
    const ax = [0, 1, 2].filter(function (k) {
      return k !== a
    })
    const Mw = c.vehicle.matrixWorld
    const inv = I.worldInverseOf(c)
    const sg = d.getComponent(a) > 0 ? 1 : -1
    const outer = sg > 0 ? I.boxLo(B, a) - 0.6 : I.boxHi(B, a) + 0.6
    const u0 = o.u0 == null ? 0.1 : o.u0
    const u1 = o.u1 == null ? 0.9 : o.u1
    for (let t = 0; t < n * 4 && out.length < n; t++) {
      const org = new V3()
      org.setComponent(a, outer)
      ax.forEach(function (k) {
        org.setComponent(k, I.boxLo(B, k) + (I.boxHi(B, k) - I.boxLo(B, k)) * (u0 + (u1 - u0) * rnd()))
      })
      _zr.set(org.clone().applyMatrix4(Mw), d.clone().transformDirection(Mw))
      _zr.far = 0.6 + (I.boxHi(B, a) - I.boxLo(B, a)) + 0.05
      const hits = castAt(_zr, cands)
      for (let i = 0; i < hits.length; i++) {
        const h = hits[i]
        if (!h.face) continue
        const lp = h.point.clone().applyMatrix4(inv)
        if (!I.boxContains(B, lp.x, lp.y, lp.z, 0.02)) break
        const nn = h.face.normal.clone().transformDirection(h.object.matrixWorld).transformDirection(inv)
        if (nn.dot(d) > 0) nn.negate()
        out.push({ p: lp, n: nn, obj: h.object })
        break
      }
    }
    return out
  }
  /* scratch that follows the surface: points along the stroke are projected onto the bodywork and the stroke stops where the bodywork ends
     (no straight stick sticking out of the body curve) */
  const _rt = new THREE.Raycaster()
  function scratchPath(c: any, s: any, len: any, ang: any, cands: any, B: any) {
    const n = s.n.clone().normalize()
    const t = Math.abs(n.y) < 0.9 ? new V3().crossVectors(new V3(0, 1, 0), n) : new V3().crossVectors(new V3(1, 0, 0), n)
    t.normalize().applyAxisAngle(n, ang || 0)
    if (!cands || !cands.length) return null
    const Mw = c.vehicle.matrixWorld
    const inv = I.worldInverseOf(c)
    const M = Math.max(3, Math.round(len / 0.04))
    const pts = []
    function at(k: any) {
      const q = s.p.clone().addScaledVector(t, (len * 0.5 * k) / M)
      _rt.set(q.clone().addScaledVector(n, 0.08).applyMatrix4(Mw), n.clone().negate().transformDirection(Mw))
      _rt.far = 0.2
      const h = castAt(_rt, cands).find(function (x: any) {
        return x.face
      })
      if (!h) return null
      const lp = h.point.clone().applyMatrix4(inv)
      if (B && !I.boxContains(B, lp.x, lp.y, lp.z, 0.02)) return null
      const nn = h.face.normal.clone().transformDirection(h.object.matrixWorld).transformDirection(inv)
      if (nn.dot(n) < 0) nn.negate()
      if (nn.dot(n) < 0.55) return null
      return { p: lp, n: nn }
    }
    const c0 = at(0)
    if (!c0) return null
    pts.push(c0)
    for (let k = 1; k <= M; k++) {
      const a = at(k)
      if (!a) break
      pts.push(a)
    }
    for (let k = -1; k >= -M; k--) {
      const b = at(k)
      if (!b) break
      pts.unshift(b)
    }
    return pts.length >= 3 ? pts : null
  }
  function ribbonGeo(pts: any, wd: any, lift: any) {
    const pos: any = []
    const idx: any = []
    const N = pts.length
    const tg = new V3()
    const sd = new V3()
    pts.forEach(function (q: any, i: any) {
      const a = pts[Math.max(0, i - 1)].p
      const b = pts[Math.min(N - 1, i + 1)].p
      tg.subVectors(b, a).normalize()
      const e = Math.min(i, N - 1 - i) / Math.max(1, (N - 1) / 2)
      const w = wd * 0.5 * (0.25 + 0.75 * Math.min(1, e * 2.2))
      sd.crossVectors(q.n, tg).normalize().multiplyScalar(w)
      const base = q.p.clone().addScaledVector(q.n, lift)
      pos.push(base.x + sd.x, base.y + sd.y, base.z + sd.z, base.x - sd.x, base.y - sd.y, base.z - sd.z)
      if (i) {
        const j = (i - 1) * 2
        idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2)
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }
  function scratchDecal(c: any, s: any, len: any, wd: any, mat: any, ang: any, cands: any, B: any, pts?: any) {
    pts = pts || scratchPath(c, s, len, ang, cands, B)
    if (!pts) return null
    const m = c.add(ribbonGeo(pts, wd, mat === DAMAGE_MATERIALS.deep ? 0.0038 : 0.003), mat, 0, 0, 0)
    m.castShadow = false
    m.receiveShadow = false
    m.userData.decal = true
    m.raycast = function () {}
    if (s.obj && s.obj.parent && s.obj.parent !== c.vehicle) {
      c.root.updateMatrixWorld(true)
      s.obj.parent.attach(m)
    }
    return m
  }
  /* scratches, chipped paint (grey primer and metal), rust and torn metal */
  function zoneDecals(c: any, z: any, spec: any, cands: any) {
    const R = c.rand
    const need =
      (spec.fine || 0) +
      (spec.deep || 0) +
      (spec.chip || 0) +
      (spec.rust || 0) +
      (spec.tear || 0) +
      (spec.ding || 0) +
      (spec.soot || 0) +
      (spec.crater || 0)
    if (!need) return []
    cands = regionCands(c, z, cands).filter(Boolean)
    const S = zoneSurf(c, z, need + 2, R, cands)
    let k = 0
    const ang0 = R() * PI
    function nx() {
      return S.length ? S[k++ % S.length] : null
    }
    let s
    let i
    for (i = 0; i < (spec.fine || 0); i++)
      if ((s = nx())) scratchDecal(c, s, 0.12 + R() * 0.18, 0.0035, DAMAGE_MATERIALS.fine, ang0 + (R() - 0.5) * 0.4, cands, z.box)
    for (i = 0; i < (spec.deep || 0); i++)
      if ((s = nx())) {
        const L2 = 0.18 + R() * 0.26
        const an = ang0 + (R() - 0.5) * 0.5
        const pth = scratchPath(c, s, L2, an, cands, z.box)
        if (pth) {
          scratchDecal(c, s, L2, 0.014, DAMAGE_MATERIALS.primer, an, cands, z.box, pth)
          scratchDecal(c, s, L2, 0.005, DAMAGE_MATERIALS.deep, an, cands, z.box, pth.slice(1, -1).length >= 3 ? pth.slice(1, -1) : pth)
        }
      }
    for (i = 0; i < (spec.chip || 0); i++)
      if ((s = nx())) {
        const r = 0.025 + R() * 0.035
        decalMesh(c, blobGeometry(r, R), DAMAGE_MATERIALS.primer, s.p, s.n, R() * 6, s.obj)
        const mm = decalMesh(c, blobGeometry(r * 0.55, R), DAMAGE_MATERIALS.metal, s.p.clone().addScaledVector(s.n, 0.0008), s.n, R() * 6, s.obj)
        void mm
      }
    for (i = 0; i < (spec.rust || 0); i++)
      if ((s = nx())) {
        const rr2 = 0.05 + R() * 0.08
        decalMesh(c, blobGeometry(rr2, R, false, 1.4), DAMAGE_MATERIALS.rust, s.p, s.n, R() * 6, s.obj)
        decalMesh(c, blobGeometry(rr2 * 0.5, R), DAMAGE_MATERIALS.rust2, s.p.clone().addScaledVector(s.n, 0.0008), s.n, R() * 6, s.obj)
      }
    /* soot (impact burn) and impact crater (metal ring with a dark core): armour and hull */
    for (i = 0; i < (spec.soot || 0); i++)
      if ((s = nx())) decalMesh(c, blobGeometry(0.14 + R() * 0.12, R, false, 1.5), DAMAGE_MATERIALS.soot, s.p, s.n, R() * 6, s.obj)
    for (i = 0; i < (spec.crater || 0); i++)
      if ((s = nx())) {
        const rc = 0.035 + R() * 0.035
        decalMesh(c, blobGeometry(rc * 1.5, R, true), DAMAGE_MATERIALS.metal, s.p, s.n, R() * 6, s.obj)
        decalMesh(c, blobGeometry(rc * 0.8, R), DAMAGE_MATERIALS.hole, s.p.clone().addScaledVector(s.n, 0.0008), s.n, R() * 6, s.obj)
      }
    const tears = []
    for (i = 0; i < (spec.tear || 0); i++) if ((s = nx())) tears.push(tearDecal(c, s.p, s.n, 0.07 + R() * 0.06, R, s.obj))
    return S
  }

  Object.assign(I, {
    dmat,
    DAMAGE_MATERIALS,
    _zq,
    _zq2,
    _zz,
    orientDecal,
    decalMesh,
    blobGeometry,
    tearDecal,
    _zr,
    zoneCands,
    _dsetC,
    skinOK,
    axisOf,
    zoneSurf,
    _rt,
    scratchPath,
    ribbonGeo,
    scratchDecal,
    zoneDecals,
  })
}
