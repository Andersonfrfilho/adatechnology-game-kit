import type { FleetContext } from '../context'

/* Group A, motorcycles and cars. Uses only the kit API.
   Cars: local car() builder, a copy of the base car builder with integrated bumpers, black pillars, per-model cut-outs
   and a "rounding in plan" (warp) applied to the whole vehicle at the end, so the nose and rear do not look boxy.
   Motorcycles: bodies made with a superellipse loft (sloft), which dent under localised damage. */
export function installMotorcyclesCars(fx: FleetContext): void {
  const kit = fx.kit
  const THREE = kit.THREE
  const trl = fx.t
  const lbl = fx.label

  const V3 = kit.V3,
    PI = Math.PI,
    MT = kit.materials,
    CM = kit.makeMaterial,
    G = kit.geo,
    profX = kit.profX,
    halfAt = kit.halfAt,
    clamp = kit.clamp,
    smooth = kit.smooth

  /* ================= local utilities ================= */
  const GLOSS = CM('#07080a', { roughness: 0.18, metalness: 0.5 })
  const ALLOY = CM('#b9bec2', { metalness: 0.75, roughness: 0.3 })
  const ALLOYD = CM('#3a3e42', { metalness: 0.6, roughness: 0.35 })
  const EVRIM = CM('#c9ced1', { metalness: 0.6, roughness: 0.35 })
  const HUBCAP = CM('#9ea4a8', { metalness: 0.55, roughness: 0.38 })
  const RUBBER = CM('#131313', { roughness: 0.9 })
  const ENG = CM('#9a9ea2', { metalness: 0.65, roughness: 0.38 })
  const ENGD = CM('#2c2e31', { metalness: 0.45, roughness: 0.5 })
  const FIN = CM('#7c8084', { metalness: 0.6, roughness: 0.45 })
  const EXH = CM('#b5b9bc', { metalness: 0.9, roughness: 0.25 })
  const HEAT = CM('#2a2b2d', { metalness: 0.5, roughness: 0.45 })

  /* soft deformation applied after assembly: rounds the front and rear in plan and curves the side */
  function mkWarp(o: any) {
    function sec(y: any) {
      if (y >= o.belt) return o.kt
      if (y >= o.ys) {
        const a = (y - o.ys) / (o.belt - o.ys)
        return o.kt * a * a
      }
      const b = clamp((o.ys - y) / (o.ys - o.yb), 0, 1.25)
      return o.kb * b * b
    }
    const f: any = function (x: any, y: any, z: any) {
      const tF = smooth((x - (o.xF - o.Lf)) / o.Lf),
        tR = smooth((o.xR + o.Lr - x) / o.Lr),
        u = Math.min(1.15, Math.abs(z) / o.hw),
        u2 = u * u
      const dropF = o.dropF ? o.dropF * tF * u2 * smooth((y - o.dropY) / 0.25) : 0
      return [x - o.bowF * tF * u2 + o.bowR * tR * u2, y - dropF, z * (1 - sec(y)) * (1 - o.pinF * tF * tF) * (1 - o.pinR * tR * tR)]
    }
    f.sec = sec
    return f
  }
  function applyWarp(c: any, Wf: any) {
    c.root.updateMatrixWorld(true)
    const gInv = new THREE.Matrix4().copy(c.vehicle.matrixWorld).invert(),
      rel = new THREE.Matrix4(),
      irel = new THREE.Matrix4(),
      v = new V3()
    const use = new Map()
    c.root.traverse(function (o: any) {
      if (o.isMesh) use.set(o.geometry, (use.get(o.geometry) || 0) + 1)
    })
    const skip = new Set(c.wheels),
      dset = new Set(c.deform),
      yAx = new V3(0, 1, 0)
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
      if (g.userData.crease) G.crease(g, 42)
      else g.computeVertexNormals()
      g.computeBoundingSphere()
      g.computeBoundingBox()
      return true
    }
    function rigid(o: any) {
      const p = o.position,
        r = Wf(p.x, p.y, p.z),
        a = Wf(p.x, p.y, p.z - 0.03),
        b = Wf(p.x, p.y, p.z + 0.03),
        yaw = Math.atan2(b[0] - a[0], b[2] - a[2])
      p.set(r[0], r[1], r[2])
      if (Math.abs(yaw) > 1e-4) o.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(yAx, yaw))
    }
    c.glass.forEach(function (gm: any) {
      const GD = gm.userData.glass
      if (!GD || !GD.outline || GD.zpos == null) return
      let cx = 0,
        cy = 0
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

  /* superellipse loft in x (sections in the y-z plane) or in y (sections in the x-z plane).
     x axis: stations [x, top, base, width, p, zc]; y axis: stations [y, xFront, xRear, width, p, zc] */
  /* resamples stations with Catmull-Rom (each parameter), for large smooth shells */
  function resample(st: any, n: any) {
    const out = [],
      L = st.length
    function P(i: any) {
      return st[Math.max(0, Math.min(L - 1, i))]
    }
    for (let k = 0; k <= n; k++) {
      const u = (k / n) * (L - 1),
        i = Math.min(L - 2, Math.floor(u)),
        t = u - i,
        a = P(i - 1),
        b = P(i),
        c2 = P(i + 1),
        d = P(i + 2),
        row = []
      for (let j = 0; j < b.length; j++) {
        let p0 = a[j] == null ? b[j] : a[j],
          p1 = b[j],
          p2 = c2[j],
          p3 = d[j] == null ? c2[j] : d[j]
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
  /* half width of the loft shell at height y, at position x (for trim and parts glued to the side) */
  function loftHalf(st: any, x: any, y: any) {
    for (let i = 0; i < st.length - 1; i++) {
      const a = st[i],
        b = st[i + 1]
      if ((a[0] - x) * (b[0] - x) > 0) continue
      const t = (x - a[0]) / (b[0] - a[0] || 1),
        top = a[1] + (b[1] - a[1]) * t,
        bot = a[2] + (b[2] - a[2]) * t,
        w = a[3] + (b[3] - a[3]) * t,
        pp = (a[4] || 2.4) + ((b[4] || 2.4) - (a[4] || 2.4)) * t
      const h = (y - (top + bot) / 2) / ((top - bot) / 2)
      if (Math.abs(h) >= 1) return 0
      return (w / 2) * Math.pow(1 - Math.pow(Math.abs(h), pp), 1 / pp)
    }
    return 0
  }
  function sloft(st: any, o: any) {
    o = o || {}
    if (o.smooth) st = resample(st, o.smooth)
    const seg = o.seg || 24,
      pos: any = [],
      idx = [],
      ring = seg + 1,
      axisY = o.axis === 'y'
    st.forEach(function (s: any) {
      const a0 = s[1],
        b0 = s[2],
        cc = (a0 + b0) / 2,
        hh = Math.abs(a0 - b0) / 2,
        w = s[3] / 2,
        e = 2 / (s[4] || o.p || 2.4),
        zc = s[5] || 0
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * PI * 2,
          cs = Math.cos(a),
          sn = Math.sin(a)
        const u = cc + hh * Math.sign(sn) * Math.pow(Math.abs(sn), e),
          z = zc + w * Math.sign(cs) * Math.pow(Math.abs(cs), e)
        if (axisY) pos.push(u, s[0], z)
        else pos.push(s[0], u, z)
      }
    })
    for (let i = 0; i < st.length - 1; i++)
      for (let k = 0; k < seg; k++) {
        const A = i * ring + k,
          B = A + ring
        if (axisY) idx.push(A, B, A + 1, A + 1, B, B + 1)
        else idx.push(A, A + 1, B, A + 1, B + 1, B)
      }
    ;[0, st.length - 1].forEach(function (si, e) {
      const s = st[si]
      if (s[3] < 0.004) return
      const ci = pos.length / 3,
        cc = (s[1] + s[2]) / 2
      if (axisY) pos.push(cc, s[0], s[5] || 0)
      else pos.push(s[0], cc, s[5] || 0)
      for (let k = 0; k < seg; k++) {
        const a = si * ring + k,
          flip = (e === 0) !== axisY
        if (flip) idx.push(ci, a + 1, a)
        else idx.push(ci, a, a + 1)
      }
    })
    let g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g = G.crease(g.toNonIndexed(), o.crease || 60)
    return g
  }
  function body(c: any, st: any, mat: any, o?: any) {
    o = o || {}
    const m = c.add(sloft(st, o), mat, 0, 0, 0, o.parent)
    if (o.def !== false) c.deform.push(m)
    return m
  }
  /* wheel arch: curved shell over the wheel. cx, cy wheel centre; r inner radius; a0..a1 angles (0 = front); w width; t bulge height */
  function fenderGeo(cx: any, cy: any, r: any, a0: any, a1: any, w: any, t: any, zc: any, o?: any) {
    o = o || {}
    const na = o.na || 22,
      nu = 10,
      pos = [],
      idx = [],
      rf =
        o.rf ||
        function () {
          return r
        }
    for (let i = 0; i <= na; i++) {
      const a = a0 + ((a1 - a0) * i) / na,
        R = rf(a),
        ca = Math.cos(a),
        sa = Math.sin(a)
      for (let j = 0; j <= nu; j++) {
        const u = (j / nu) * 2 - 1,
          bulge = t * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), o.p || 3)), 1 / (o.p || 3)),
          rr = R + bulge
        pos.push(cx + ca * rr, cy + sa * rr, zc + (u * w) / 2)
      }
    }
    for (let i2 = 0; i2 < na; i2++)
      for (let j2 = 0; j2 < nu; j2++) {
        const A = i2 * (nu + 1) + j2,
          B = A + nu + 1
        idx.push(A, B, A + 1, A + 1, B, B + 1)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    return G.crease(g.toNonIndexed(), 70)
  }
  function lamp(c: any, o: any) {
    const L = kit.headlight(c, o)
    if (o.roll) L.group.rotation.x = o.roll
    if (o.pitch) L.group.rotation.z = o.pitch
    return L
  }

  /* side windows with the sloped roof (roofR at the rear, crown in the middle) */
  function roofAt(gh: any, x: any) {
    const rR = gh.roofR || gh.roof,
      t = clamp((x - gh.rt) / (gh.ft - gh.rt), 0, 1)
    return rR + (gh.roof - rR) * t + (gh.crown || 0) * 4 * t * (1 - t)
  }
  function windows(gh: any) {
    const inn = 0.07,
      rise = gh.rise || 0
    function ybAt(x: any) {
      return gh.belt + 0.035 + rise * clamp((gh.fb - x) / (gh.fb - gh.rb), 0, 1)
    }
    function lx(x0: any, x1: any, y: any, top: any) {
      return x0 + ((x1 - x0) * (y - gh.belt)) / (top - gh.belt)
    }
    function rearX(y: any) {
      return lx(gh.rb, gh.rt, y, gh.roofR || gh.roof) + inn * 1.3
    }
    function frontX(y: any) {
      return lx(gh.fb, gh.ft, y, gh.roof) - inn * 1.3
    }
    function topY(x: any) {
      return roofAt(gh, x) - 0.068
    }
    const ps = gh.pillars.slice().sort(function (a: any, b: any) {
        return a - b
      }),
      bounds = [-1e9]
    ps.forEach(function (p: any) {
      bounds.push(p - 0.06, p + 0.06)
    })
    bounds.push(1e9)
    const polys = []
    for (let i = 0; i < bounds.length; i += 2) {
      const xa = bounds[i],
        xb = bounds[i + 1]
      const L = function (y: any) {
          return Math.max(xa, rearX(y))
        },
        R = function (y: any) {
          return Math.min(xb, frontX(y))
        }
      let ybl = ybAt(xa > -1e8 ? xa : gh.rb),
        ybr = ybAt(xb < 1e8 ? xb : gh.fb)
      for (let q = 0; q < 3; q++) {
        ybl = ybAt(L(ybl))
        ybr = ybAt(R(ybr))
      }
      let yl = topY(L(ybl)),
        yr = topY(R(ybr))
      for (let k = 0; k < 4; k++) {
        yl = topY(L(yl))
        yr = topY(R(yr))
      }
      if (R(ybr) - L(ybl) > 0.15 && R(yr) - L(yl) > 0.05)
        polys.push([
          [L(ybl), ybl],
          [R(ybr), ybr],
          [R(yr), yr],
          [L(yl), yl],
        ])
    }
    return polys
  }

  /* ================= car (adjusted copy of the base car builder) ================= */
  /* Front and rear details (headlights, taillights, bumpers, grilles, plates, lids) are a "skin" sampled on the hull:
     rays against the body before the warp give the point and normal of each vertex, so everything sits flush with the bodywork
     (recessed) and follows the rounding in plan and the dents. */
  const REARTINT = CM('#0c1114', {
    roughness: 0.04,
    metalness: 0.45,
    transparent: true,
    opacity: 0.84,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const LH = CM('#0c0d0f', { roughness: 0.3, metalness: 0.35 }) /* glossy black headlight frame */
  const REFL = CM('#c3c9ce', { metalness: 0.92, roughness: 0.16 }) /* chrome reflector */
  const DRL = CM('#f2f7ff', { emissive: '#d6e8ff', emissiveIntensity: 1.7, roughness: 0.2 })
  const TAILHI = CM('#e2301f', { emissive: '#e8200f', emissiveIntensity: 1.35, roughness: 0.25 })
  const TAILD = CM('#5a0d0a', { emissive: '#5a0805', emissiveIntensity: 0.55, roughness: 0.22, metalness: 0.2 })
  const REFLR = CM('#9a1d14', { emissive: '#5a0805', emissiveIntensity: 0.5, roughness: 0.3 })
  const UNDER = CM('#101112', { roughness: 0.96 })
  const UNDER2 = CM('#26282b', { roughness: 0.75, metalness: 0.35 })
  const PLASTIC = CM('#141516', { roughness: 0.82 })
  const RECESS = CM('#0b0c0d', { roughness: 0.9 })
  const PLATEL = CM('#f4f1e4', { emissive: '#f0ead0', emissiveIntensity: 1.0, roughness: 0.3 })
  /* grille textures (repeated pattern) */
  function patTex(kind: any) {
    const cv = kit.document.createElement('canvas')
    cv.width = cv.height = 64
    const x = cv.getContext('2d')
    let i, j
    x.fillStyle = '#060607'
    x.fillRect(0, 0, 64, 64)
    if (kind === 'mesh') {
      x.strokeStyle = '#4a4e52'
      x.lineWidth = 5
      for (j = -1; j < 3; j++)
        for (i = -1; i < 3; i++) {
          const cx = i * 32 + (j % 2 ? 16 : 0),
            cy = j * 28 + 14
          x.beginPath()
          for (let k = 0; k <= 6; k++) {
            const a = PI / 6 + (k * PI) / 3
            x.lineTo(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15)
          }
          x.stroke()
        }
    } else if (kind === 'diamond') {
      x.strokeStyle = '#3f4347'
      x.lineWidth = 6
      for (i = -64; i <= 128; i += 32) {
        x.beginPath()
        x.moveTo(i, 0)
        x.lineTo(i + 64, 64)
        x.stroke()
        x.beginPath()
        x.moveTo(i, 64)
        x.lineTo(i + 64, 0)
        x.stroke()
      }
    } else if (kind === 'bars') {
      const gr = x.createLinearGradient(0, 0, 0, 32)
      gr.addColorStop(0, '#c8ccd0')
      gr.addColorStop(0.5, '#6c7176')
      gr.addColorStop(1, '#2a2d30')
      x.fillStyle = gr
      x.fillRect(0, 4, 64, 14)
      x.fillRect(0, 36, 64, 14)
    } else if (kind === 'barsd') {
      x.fillStyle = '#2b2e32'
      x.fillRect(0, 6, 64, 12)
      x.fillRect(0, 38, 64, 12)
      x.fillStyle = '#4a4f55'
      x.fillRect(0, 6, 64, 3)
      x.fillRect(0, 38, 64, 3)
    } else if (kind === 'slots') {
      x.fillStyle = '#26292c'
      for (i = 0; i < 64; i += 16) x.fillRect(i, 0, 6, 64)
    }
    const t = new THREE.CanvasTexture(cv)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 4
    return t
  }
  const GRM: any = {}
  function grilleMat(kind: any) {
    if (!GRM[kind])
      GRM[kind] = new THREE.MeshStandardMaterial({
        map: patTex(kind),
        roughness: kind === 'bars' ? 0.3 : 0.7,
        metalness: kind === 'bars' ? 0.6 : 0.25,
      })
    return GRM[kind]
  }

  /* hull surface sampler (c.g coordinates, before the warp) */
  function mkSurf(mesh: any, W: any) {
    const geo = mesh.geometry,
      pos = geo.attributes.position,
      ix = geo.index,
      n = ix ? ix.count : pos.count
    geo.computeBoundingBox()
    const bb = geo.boundingBox.clone()
    /* triangles in buckets by y band (horizontal rays) and by x band (vertical rays): fast lookup without a Raycaster */
    const T: any = [],
      BY: any = {},
      BX: any = {},
      Q = 0.02
    for (let i = 0; i < n; i += 3) {
      const a = new V3().fromBufferAttribute(pos, ix ? ix.getX(i) : i),
        b = new V3().fromBufferAttribute(pos, ix ? ix.getX(i + 1) : i + 1),
        d = new V3().fromBufferAttribute(pos, ix ? ix.getX(i + 2) : i + 2),
        k = T.length
      T.push([a, b, d])
      const y0 = Math.floor(Math.min(a.y, b.y, d.y) / Q),
        y1 = Math.floor(Math.max(a.y, b.y, d.y) / Q),
        x0 = Math.floor(Math.min(a.x, b.x, d.x) / Q),
        x1 = Math.floor(Math.max(a.x, b.x, d.x) / Q)
      let q
      for (q = y0; q <= y1; q++) (BY[q] || (BY[q] = [])).push(k)
      for (q = x0; q <= x1; q++) (BX[q] || (BX[q] = [])).push(k)
    }
    const ray = new THREE.Ray(),
      tmp = new V3(),
      e1 = new V3(),
      e2 = new V3(),
      cache: any = {}
    const S: any = { bb: bb, hw: W / 2 }
    S.hit = function (o: any, dd: any) {
      const d = dd.clone().normalize()
      ray.set(o, d)
      const list = Math.abs(d.y) < 0.5 ? BY[Math.floor(o.y / Q)] : BX[Math.floor(o.x / Q)]
      if (!list) return null
      let best = 1e9,
        bt = null
      for (let k = 0; k < list.length; k++) {
        const t = T[list[k]]
        if (!ray.intersectTriangle(t[0], t[1], t[2], false, tmp)) continue
        const dist = tmp.distanceTo(o)
        if (dist < best) {
          best = dist
          bt = t
        }
      }
      if (!bt) return null
      const nn = e1.subVectors(bt[1], bt[0]).clone().cross(e2.subVectors(bt[2], bt[0])).normalize()
      if (nn.dot(d) > 0) nn.negate()
      return { p: o.clone().addScaledVector(d, best), n: nn }
    }
    S.endX = function (E: any, y: any) {
      const k = E + ':' + y.toFixed(3)
      if (cache[k] != null) return cache[k]
      const h = S.hit(new V3(E * 10, y, 0), new V3(-E, 0, 0), E > 0 ? 'F' : 'R')
      return (cache[k] = h ? h.p.x : E > 0 ? bb.max.x : bb.min.x)
    }
    return S
  }
  /* sample grid at one end (E = +1 front, -1 rear). sd = +1/-1 side; sd = 0 full width (side to side).
     Path: along the face (z0..z1), turns the corner (radius R) and runs "wrap" metres along the side. */
  function sgrid(S: any, E: any, sd: any, o: any) {
    const R = 0.07,
      hw = S.hw,
      full = !sd,
      z0 = full ? 0 : o.z0 || 0,
      z1 = Math.max(z0 + 0.01, o.z1 != null ? o.z1 : hw - R),
      wrap = o.wrap || 0
    const L1 = z1 - z0,
      L2 = wrap > 0 ? (R * PI) / 2 : 0,
      tot = L1 + L2 + wrap,
      which = E > 0 ? 'F' : 'R'
    const nu = o.nu || Math.max(6, Math.ceil((tot * (full ? 2 : 1)) / (o.du || 0.022))),
      nv = o.nv || Math.max(2, Math.ceil((o.y1 - o.y0) / (o.dv || 0.025)))
    const P: any = [],
      N: any = []
    for (let i = 0; i <= nu; i++) {
      let s = full ? ((i / nu) * 2 - 1) * tot : (i / nu) * tot
      const side = full ? (s < 0 ? -1 : 1) : sd
      s = Math.abs(s)
      P.push([])
      N.push([])
      for (let j = 0; j <= nv; j++) {
        const y = o.y0 + ((o.y1 - o.y0) * j) / nv,
          ex = S.endX(E, y)
        let O, D
        if (s <= L1 || wrap <= 0) {
          O = new V3(ex + E, y, side * (z0 + Math.min(s, L1)))
          D = new V3(-E, 0, 0)
        } else if (s <= L1 + L2) {
          const th = (s - L1) / R,
            cen = new V3(ex - E * R, y, side * (hw - R)),
            dir = new V3(E * Math.cos(th), 0, side * Math.sin(th))
          O = cen.clone().add(dir)
          D = dir.clone().negate()
        } else {
          const t = s - L1 - L2
          O = new V3(ex - E * (R + t), y, side * (hw + 1))
          D = new V3(0, 0, -side)
        }
        const h: any = S.hit(O, D, which) || { p: O.clone().add(D), n: D.clone().negate() }
        P[i].push(h.p)
        N[i].push(h.n)
      }
    }
    const G: any = { P: P, N: N, nu: nu, nv: nv, y0: o.y0, y1: o.y1, len: tot * (full ? 2 : 1), E: E, sd: sd }
    G.at = function (u: any, y: any) {
      const fi = clamp(u, 0, 1) * nu,
        fj = clamp((y - o.y0) / (o.y1 - o.y0), 0, 1) * nv,
        i0 = Math.min(nu - 1, Math.floor(fi)),
        j0 = Math.min(nv - 1, Math.floor(fj)),
        a = fi - i0,
        b = fj - j0
      function L(M: any) {
        return M[i0][j0]
          .clone()
          .multiplyScalar((1 - a) * (1 - b))
          .addScaledVector(M[i0 + 1][j0], a * (1 - b))
          .addScaledVector(M[i0][j0 + 1], (1 - a) * b)
          .addScaledVector(M[i0 + 1][j0 + 1], a * b)
      }
      return { p: L(P), n: L(N).normalize() }
    }
    /* u of the point with a given z (face only) */
    G.uz = function (z: any) {
      const s = Math.abs(z) - z0
      return full ? ((Math.sign(z || 1) * s) / tot + 1) / 2 : s / tot
    }
    G.zu = function (u: any) {
      return full ? (2 * u - 1) * tot : z0 + u * tot
    }
    return G
  }
  function fnv(v: any) {
    return typeof v === 'function'
      ? v
      : function () {
          return v
        }
  }
  /* skin layer over the grid: region u0..u1, yb(u)..yt(u), offset "off" from the bodywork; "thick" gives thickness (visible edge) */
  function skin(c: any, G: any, mat: any, o: any) {
    const u0 = o.u0 || 0,
      u1 = o.u1 == null ? 1 : o.u1,
      yb = fnv(o.yb),
      yt = fnv(o.yt),
      off = o.off == null ? 0.005 : o.off
    const nu = o.nu || Math.max(3, Math.round((u1 - u0) * G.nu)),
      nv = o.nv || 3,
      layers = o.thick ? [off, off - o.thick] : [off]
    const su = o.tile ? ((u1 - u0) * G.len) / o.tile : 1,
      sv0 = o.tile ? 1 / o.tile : 1
    const grids = layers.map(function (of) {
      const Q = []
      for (let i = 0; i <= nu; i++) {
        const u = u0 + ((u1 - u0) * i) / nu,
          b = yb(u),
          t = yt(u),
          row = []
        for (let j = 0; j <= nv; j++) {
          const y = b + ((t - b) * j) / nv,
            s = G.at(u, y)
          row.push({ p: s.p.addScaledVector(s.n, of), n: s.n, uv: [(i / nu) * su, o.tile ? (y - G.y0) * sv0 : j / nv] })
        }
        Q.push(row)
      }
      return Q
    })
    const pos: any = [],
      uv: any = [],
      A = grids[0]
    const mi = Math.floor(nu / 2),
      mj = Math.floor(nv / 2),
      t0 = new V3().subVectors(A[mi + 1][mj].p, A[mi][mj].p),
      t1 = new V3().subVectors(A[mi][mj + 1].p, A[mi][mj].p),
      flip = t0.cross(t1).dot(A[mi][mj].n) < 0
    function tri(a: any, b: any, d: any, rev: any) {
      const l = flip !== !!rev ? [a, d, b] : [a, b, d]
      l.forEach(function (q) {
        pos.push(q.p.x, q.p.y, q.p.z)
        uv.push(q.uv[0], q.uv[1])
      })
    }
    grids.forEach(function (Q, li) {
      for (let i = 0; i < nu; i++)
        for (let j = 0; j < nv; j++) {
          tri(Q[i][j], Q[i + 1][j], Q[i + 1][j + 1], li > 0)
          tri(Q[i][j], Q[i + 1][j + 1], Q[i][j + 1], li > 0)
        }
    })
    if (grids.length > 1) {
      const F = grids[0],
        B = grids[1],
        edge = []
      for (let i2 = 0; i2 < nu; i2++)
        edge.push([
          [i2, 0],
          [i2 + 1, 0],
        ])
      for (let j2 = 0; j2 < nv; j2++)
        edge.push([
          [nu, j2],
          [nu, j2 + 1],
        ])
      for (let i3 = nu; i3 > 0; i3--)
        edge.push([
          [i3, nv],
          [i3 - 1, nv],
        ])
      for (let j3 = nv; j3 > 0; j3--)
        edge.push([
          [0, j3],
          [0, j3 - 1],
        ])
      edge.forEach(function (e) {
        const a = F[e[0][0]][e[0][1]],
          b = F[e[1][0]][e[1][1]],
          a2 = B[e[0][0]][e[0][1]],
          b2 = B[e[1][0]][e[1][1]]
        tri(a, a2, b2, false)
        tri(a, b2, b, false)
      })
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    G0.crease(geo, o.crease || 50)
    geo.userData.crease = true
    geo.computeBoundingBox()
    const cen = geo.boundingBox.getCenter(new V3())
    geo.translate(-cen.x, -cen.y, -cen.z)
    const m = c.add(geo, mat, cen.x, cen.y, cen.z)
    m.castShadow = !!o.shadow
    if (o.order) m.renderOrder = o.order
    if (o.def !== false) c.deform.push(m)
    return m
  }
  const G0 = G
  /* outline (tube) of a grid region */
  function outline(c: any, Gd: any, o: any, r: any, mat: any, off: any) {
    const u0 = o.u0 || 0,
      u1 = o.u1 == null ? 1 : o.u1,
      yb = fnv(o.yb),
      yt = fnv(o.yt)
    let pts = []
    const n = 16
    let k
    function P(u: any, y: any) {
      const s = Gd.at(u, y)
      return s.p.addScaledVector(s.n, off || 0.006)
    }
    for (k = 0; k < n; k++) {
      const ua = u0 + ((u1 - u0) * k) / n
      pts.push(P(ua, yb(ua)))
    }
    for (k = 0; k < 3; k++) pts.push(P(u1, yb(u1) + ((yt(u1) - yb(u1)) * k) / 3))
    for (k = n; k > 0; k--) {
      const ub = u0 + ((u1 - u0) * k) / n
      pts.push(P(ub, yt(ub)))
    }
    for (k = 3; k > 0; k--) pts.push(P(u0, yb(u0) + ((yt(u0) - yb(u0)) * k) / 3))
    if (o.open) {
      pts = pts.slice(o.open[0], o.open[1])
    }
    const t = c.tube(pts, r, mat, { closed: !o.open, seg: pts.length * 4, rs: 5 })
    t.castShadow = false
    return t
  }
  /* line (tube) along sampled points: list of {u, y} on a grid */
  function lineOn(c: any, Gd: any, list: any, r: any, mat: any, off: any) {
    const pts = list.map(function (q: any) {
      const s = Gd.at(q[0], q[1])
      return s.p.addScaledVector(s.n, off || 0.003)
    })
    const t = c.tube(pts, r, mat, { seg: pts.length * 6, rs: 4 })
    t.castShadow = false
    c.deform.push(t)
    return t
  }
  /* small mesh leaning on the surface, with its axis (y for cylinders) along the normal */
  function onSurf(m: any, s: any, off: any, axis?: any) {
    m.position.copy(s.p).addScaledVector(s.n, off || 0)
    m.quaternion.setFromUnitVectors(axis || new V3(0, 1, 0), s.n)
    m.rotation.order = 'XYZ'
    return m
  }
  function regLight(c: any, kind: any, label: any, inner: any, lens: any, pos: any) {
    const L = { group: null, inner: inner, lens: lens, kind: kind, tint: kind === 'headlight' ? 'clear' : 'red', broken: false }
    c.lights.push(L)
    const pt = c.part(kind, label, inner[0], pos, 0.8)
    pt.light = L
    return L
  }
  function shapeRange(sh: any) {
    let lo = 1e9,
      hi = -1e9
    for (let u = 0; u <= 1.0001; u += 0.05) {
      const r = sh(u)
      lo = Math.min(lo, r[0])
      hi = Math.max(hi, r[1])
    }
    return [lo, hi]
  }
  /* end-detail kit, bound to a car */
  function mkKit(c: any, S: any, I: any) {
    const K: any = { S: S, I: I }
    K.grid = function (E: any, sd: any, o: any) {
      return sgrid(S, E, sd, o)
    }
    K.skin = function (Gd: any, mat: any, o: any) {
      return skin(c, Gd, mat, o)
    }
    /* headlight: o = { z0, wrap, shape(u) -> [yb, yt], proj: [[u, dy, r]], drl: [{u0,u1,yb,yt}], amber: [...], refl, pad } */
    K.head = function (sd: any, o: any) {
      const sh = o.shape,
        rg = shapeRange(sh),
        pad = o.pad == null ? 0.012 : o.pad
      const Gd: any = sgrid(S, 1, sd, {
        z0: o.z0,
        wrap: o.wrap,
        z1: o.z1,
        y0: rg[0] - pad - 0.01,
        y1: rg[1] + pad + 0.01,
        du: 0.018,
        dv: 0.012,
      })
      const pu = pad / Gd.len,
        inner = [],
        lens = []
      const yb = function (u: any) {
          return sh(u)[0]
        },
        yt = function (u: any) {
          return sh(u)[1]
        }
      skin(c, Gd, o.bezel || LH, {
        yb: function (u: any) {
          return yb(u) - pad
        },
        yt: function (u: any) {
          return yt(u) + pad
        },
        off: 0.003,
        nv: 4,
      })
      skin(c, Gd, o.refl || REFL, { u0: pu, u1: 1 - pu, yb: yb, yt: yt, off: 0.006, nv: 4 })
      ;(o.proj || []).forEach(function (q: any) {
        const r = sh(q[0]),
          y = (r[0] + r[1]) / 2 + (q[1] || 0),
          s = Gd.at(q[0], y),
          rad = q[2] || Math.min(0.034, (r[1] - r[0]) * 0.4)
        const cup = onSurf(c.cylinder(rad * 1.35, rad * 1.2, 0.012, LH, 0, 0, 0), s, 0.008)
        cup.castShadow = false
        const ring = onSurf(c.add(new THREE.TorusGeometry(rad * 1.05, 0.004, 6, 22), MT.chrome), s, 0.012, new V3(0, 0, 1))
        ring.castShadow = false
        const b = onSurf(c.sphere(rad, MT.head, 0, 0, 0, 1, 0.55, 1), s, 0.01)
        b.castShadow = false
        inner.push(b)
      })
      ;(o.drl || []).forEach(function (d: any) {
        inner.push(skin(c, Gd, d.mat || DRL, { u0: d.u0, u1: d.u1, yb: d.yb, yt: d.yt, off: 0.0095, nv: 2 }))
      })
      ;(o.amber || []).forEach(function (d: any) {
        inner.push(skin(c, Gd, MT.amber, { u0: d.u0, u1: d.u1, yb: d.yb, yt: d.yt, off: 0.009, nv: 2 }))
      })
      const ln = skin(c, Gd, MT.lens, {
        yb: function (u: any) {
          return yb(u) - pad * 0.4
        },
        yt: function (u: any) {
          return yt(u) + pad * 0.4
        },
        off: 0.015,
        nv: 4,
        order: 3,
      })
      lens.push(ln)
      if (!inner.length) inner.push(ln)
      const cs = Gd.at(0.5, (rg[0] + rg[1]) / 2).p
      regLight(c, 'headlight', o.label || (sd > 0 ? trl('labels.right_headlight') : trl('labels.left_headlight')), inner, lens, cs)
      return Gd
    }
    /* taillight: o = { z0, wrap, shape(u), main (area material), hi: [...], rev: [...], amber: [...] } */
    K.tail = function (sd: any, o: any) {
      const sh = o.shape,
        rg = shapeRange(sh),
        pad = o.pad == null ? 0.01 : o.pad
      const Gd: any = sgrid(S, -1, sd, {
        z0: o.z0,
        z1: o.z1,
        wrap: o.wrap,
        y0: rg[0] - pad - 0.01,
        y1: rg[1] + pad + 0.01,
        du: 0.018,
        dv: 0.012,
      })
      const pu = pad / Gd.len,
        inner = [],
        lens = [],
        yb = function (u: any) {
          return sh(u)[0]
        },
        yt = function (u: any) {
          return sh(u)[1]
        }
      skin(c, Gd, LH, {
        yb: function (u: any) {
          return yb(u) - pad
        },
        yt: function (u: any) {
          return yt(u) + pad
        },
        off: 0.003,
        nv: 4,
      })
      inner.push(skin(c, Gd, o.main || TAILD, { u0: pu, u1: 1 - pu, yb: yb, yt: yt, off: 0.006, nv: 4 }))
      ;(o.hi || []).forEach(function (d: any) {
        inner.push(skin(c, Gd, d.mat || TAILHI, { u0: d.u0, u1: d.u1, yb: d.yb, yt: d.yt, off: 0.009, nv: 2 }))
      })
      ;(o.rev || []).forEach(function (d: any) {
        inner.push(skin(c, Gd, MT.rev, { u0: d.u0, u1: d.u1, yb: d.yb, yt: d.yt, off: 0.0085, nv: 2 }))
      })
      ;(o.amber || []).forEach(function (d: any) {
        inner.push(skin(c, Gd, MT.amber, { u0: d.u0, u1: d.u1, yb: d.yb, yt: d.yt, off: 0.0085, nv: 2 }))
      })
      lens.push(
        skin(c, Gd, o.lens || MT.lensRed, {
          yb: function (u: any) {
            return yb(u) - pad * 0.4
          },
          yt: function (u: any) {
            return yt(u) + pad * 0.4
          },
          off: 0.013,
          nv: 4,
          order: 3,
        }),
      )
      regLight(
        c,
        'taillight',
        o.label || (sd > 0 ? trl('labels.right_taillight') : trl('labels.left_taillight')),
        inner,
        lens,
        Gd.at(0.4, (rg[0] + rg[1]) / 2).p,
      )
      return Gd
    }
    /* bumper: thick shell in the body colour (or black) that covers the end and bends round the corners up to near the wheel arch */
    K.bumper = function (E: any, o: any) {
      const Gd = sgrid(S, E, 0, { wrap: o.wrap, y0: o.y0, y1: o.y1, du: 0.03, dv: 0.03 })
      const m = skin(c, Gd, o.mat, {
        yb: o.yb || o.y0,
        yt: o.yt || o.y1,
        off: o.off || 0.016,
        thick: 0.04,
        nv: Math.max(4, Gd.nv),
        shadow: true,
      })
      const tl = []
      for (let k = 0; k <= 40; k++) tl.push([0.004 + (0.992 * k) / 40, o.y1 + 0.004])
      lineOn(c, Gd, tl, 0.0045, MT.dark, 0.004)
      c.part(
        'bumper',
        E > 0 ? trl('labels.front_bumper') : trl('labels.rear_bumper'),
        m,
        new V3(S.endX(E, (o.y0 + o.y1) / 2), (o.y0 + o.y1) / 2, 0),
        1.1,
      )
      m.userData.grid = Gd
      return m
    }
    /* Mercosur plate in a recess (with a plate light behind) */
    K.plate = function (E: any, y: any, o: any) {
      o = o || {}
      const Gd: any = sgrid(S, E, 0, { z1: 0.32, y0: y - 0.12, y1: y + 0.12, du: 0.03, dv: 0.03 }),
        off = o.off || 0.004,
        s = Gd.at(0.5, y)
      const rc = skin(c, Gd, RECESS, { u0: Gd.uz(-0.235), u1: Gd.uz(0.235), yb: y - 0.083, yt: y + 0.083, off: off, nv: 2 })
      rc.geometry.computeBoundingBox()
      const ext = E > 0 ? rc.position.x + rc.geometry.boundingBox.max.x : rc.position.x + rc.geometry.boundingBox.min.x
      /* rigid plate: the 4-vertex plane, if bent by the warp, ended up behind the recess in the middle (black half-moon over the plate) */
      const pl = c.plate(ext + E * 0.006, s.p.y, 0, E > 0 ? '+x' : '-x')
      pl.userData.noWarp = true
      if (E < 0) {
        const lt = skin(c, Gd, PLATEL, { u0: Gd.uz(-0.06), u1: Gd.uz(0.06), yb: y + 0.071, yt: y + 0.08, off: off + 0.004, nv: 1 })
        lt.castShadow = false
      }
      return pl
    }
    /* lid seam line: list of points {y, z} on the rear face or {x, z, top:true} on the top of the trunk */
    K.lid = function (pts: any) {
      const P = pts
        .map(function (q: any) {
          const h = q.top
            ? S.hit(new V3(q.x, 3, q.z), new V3(0, -1, 0), 'R')
            : S.hit(new V3(S.endX(-1, q.y) - 1, q.y, q.z), new V3(1, 0, 0), 'R')
          return h ? h.p.addScaledVector(h.n, 0.003) : null
        })
        .filter(Boolean)
      const t = c.tube(P, 0.0038, MT.dark, { seg: P.length * 8, rs: 4 })
      t.castShadow = false
      c.deform.push(t)
      return t
    }
    /* red reflector on the rear bumper */
    K.reflector = function (sd: any, z0: any, y: any, w: any) {
      const Gd = sgrid(S, -1, sd, { z0: z0, z1: z0 + (w || 0.12), y0: y - 0.03, y1: y + 0.03, du: 0.03, dv: 0.03 })
      return skin(c, Gd, REFLR, { yb: y - 0.016, yt: y + 0.016, off: 0.03, nv: 1 })
    }
    /* grille over the bodywork (region u0..u1 on a full-width grid) */
    K.grille = function (E: any, o: any) {
      const Gd = sgrid(S, E, 0, { z1: o.z1, y0: o.y0, y1: o.y1, du: 0.03, dv: 0.03 })
      const m = skin(c, Gd, grilleMat(o.tex || 'mesh'), {
        u0: o.u0,
        u1: o.u1,
        yb: o.yb || o.y0,
        yt: o.yt || o.y1,
        off: o.off || 0.006,
        tile: o.tile || 0.07,
        nv: 3,
      })
      if (o.frame)
        outline(c, Gd, { u0: o.u0, u1: o.u1, yb: o.yb || o.y0, yt: o.yt || o.y1 }, o.frameR || 0.008, o.frame, (o.off || 0.006) + 0.002)
      m.userData.grid = Gd
      return m
    }
    return K
  }

  function car(c: any, s: any) {
    const W = s.W,
      gh = s.gh,
      bev = 0.05,
      T = { belt: gh.belt, top: gh.roof + bev, k: gh.k },
      m = c.meta
    m.color = s.col
    m.kind = 'car'
    const front = profX(s.lower, s.noseY, true),
      rear = profX(s.lower, s.tailY, false)
    const intr = s.interior === false ? null : Object.assign({ rows: 2 }, s.interior || {})
    const hoodO = s.hood ? Object.assign({ motor: 'gasoline' }, s.hood === true ? {} : s.hood) : null
    let tireW = 0.2
    ;(s.wheels || []).forEach(function (w: any) {
      tireW = Math.max(tireW, w[2])
    })
    const low = []
    if (intr) low.push(kit.holeTop(gh.rb + 0.05, gh.fb - 0.03, gh.Wg / 2 - 0.05, gh.belt - 0.3))
    const hx0 = gh.fb + 0.08,
      hx1 = front - (hoodO && hoodO.front != null ? hoodO.front : 0.2),
      zH = W / 2 - 0.13
    if (hoodO) low.push(kit.holeTop(hx0, hx1, zH, s.bottomY + 0.2, 'hood'))
    const lowMesh = kit.shell(c, {
      items: s.lower,
      bottomY: s.bottomY,
      arches: s.arches,
      W: W,
      col: s.col,
      holes: low,
      archInner: intr || hoodO ? W / 2 - tireW - 0.16 : null,
    })
    const roofR = gh.roofR || gh.roof,
      crown = gh.crown || 0
    const ghItems = [
      [gh.rb, gh.belt - 0.1, 0],
      [gh.rt, roofR, gh.r1 || 0.12],
    ]
    if (crown || roofR !== gh.roof) ghItems.push([(gh.rt + gh.ft) / 2, (gh.roof + roofR) / 2 + crown, 0.6])
    ghItems.push([gh.ft, gh.roof, gh.r2 || 0.2], [gh.fb, gh.belt - 0.1, 0])
    let polys = windows(gh)
    if (s.dropRear) polys = polys.slice(1)
    const qf = kit.quadDef([gh.fb, gh.belt], [gh.ft, gh.roof], gh.Wg, T, 'front', bev),
      qr = kit.quadDef([gh.rb, gh.belt], [gh.rt, roofR], gh.Wg, T, 'rear', bev)
    const gHoles = []
    if (intr) {
      polys.forEach(function (p) {
        gHoles.push(kit.holeSide(p))
      })
      gHoles.push(
        kit.holeQuad(qf),
        kit.holeQuad(qr),
        kit.holeWhere(function (n: any, ce: any) {
          return n.y < -0.7 && ce.y < gh.belt + 0.02
        }),
      )
    }
    /* roof in its own colour: does not rust when wrecked (it only goes matte and dirty) */
    const roofMat = s.roofCol
      ? CM(c.state === 'damaged' ? new THREE.Color(s.roofCol).multiplyScalar(0.82) : s.roofCol, {
          roughness: c.state === 'damaged' ? 0.78 : 0.4,
          metalness: 0.3,
          side: THREE.DoubleSide,
        })
      : null
    kit.shell(c, { items: ghItems, W: gh.Wg, col: s.col, mat: roofMat, T: T, holes: gHoles, sub: intr ? 0.12 : 0.2 })
    kit.sideWindows(
      c,
      polys,
      gh.Wg,
      T,
      function (i: any, n: any) {
        return i === 0 && n > 2 ? lbl('quarter_glass') : i === n - 1 ? lbl('window_front') : lbl('window_rear')
      },
      { see: !!intr },
    )
    kit.glassQuad(c, qf, lbl('windshield'), { see: !!intr })
    /* dark rear glass (at night it reflects and barely shows the seats; before, it looked like an open pickup bed seen from behind) */
    kit.glassQuad(c, qr, lbl('rear_window'), { see: !!intr, mat: intr ? REARTINT : MT.glassDark })
    m.length = front - rear + 0.1
    m.width = W
    m.front = front + 0.05
    m.rear = rear - 0.05
    m.clearance = s.bottomY
    m.belt = gh.belt
    m.top = gh.roof + bev
    m.bodyHeight = gh.belt - s.bottomY
    m.roof = {
      x0: gh.rt + 0.12,
      x1: gh.ft - 0.12,
      w: halfAt(gh.Wg, T, gh.roof) * 1.6,
      y: Math.max(gh.roof, roofR + crown) + bev + (s.rails ? (typeof s.rails === 'number' ? s.rails : 0.1) - 0.03 : 0),
    }
    m.top = Math.max(gh.roof, roofR + crown) + bev
    m.glasshouse = gh
    m.tumble = T
    m.frontQuad = qf
    if (intr)
      kit.interior(
        c,
        Object.assign(
          {
            x0: gh.fb,
            ft: gh.ft,
            rb: gh.rb,
            rt: gh.rt,
            roof: Math.min(gh.roof, roofR),
            belt: gh.belt,
            floor: s.bottomY + 0.1,
            zIn: gh.Wg / 2 - 0.09,
            zRoof: halfAt(gh.Wg, T, gh.roof) - 0.12,
            xRear: gh.rb + 0.06,
          },
          intr,
        ),
      )
    if (hoodO) {
      let fa = -1e9
      ;(s.arches || []).forEach(function (a: any) {
        fa = Math.max(fa, a[0])
      })
      const hood = kit.makeHood(c, lowMesh.userData.cut.hood, { x0: hx0, col: s.col })
      if (hood)
        kit.engineBay(c, {
          x0: hx0 + 0.02,
          x1: hx1,
          zw: zH - 0.02,
          floor: s.bottomY + 0.12,
          top: hood.yMin - 0.035,
          motor: hoodO.motor,
          axle: fa,
          col: s.col,
        })
    }
    const wo = Object.assign(
      {
        xF: front + 0.05,
        xR: rear - 0.05,
        hw: W / 2,
        Lf: 0.55,
        Lr: 0.45,
        bowF: 0.16,
        bowR: 0.12,
        pinF: 0.05,
        pinR: 0.04,
        yb: s.bottomY,
        ys: (s.bottomY + gh.belt) / 2 + 0.06,
        belt: gh.belt,
        kb: 0.06,
        kt: 0.05,
      },
      s.warp || {},
    )
    const Wf = mkWarp(wo)
    const S = mkSurf(lowMesh, W)
    details(c, s, Wf, S)
    applyWarp(c, Wf)
    return m
  }

  function details(c: any, s: any, Wf: any, S: any) {
    const m = c.meta,
      W = s.W,
      hw = W / 2,
      by = s.bottomY,
      it = s.lower,
      gh = s.gh,
      T = m.tumble
    const fx = function (y: any) {
        return profX(it, y, true)
      },
      rx = function (y: any) {
        return profX(it, y, false)
      }
    const I: any = { fx: fx, rx: rx, W: W, hw: hw, by: by, gh: gh, T: T, Wf: Wf, S: S }
    I.fxB = S.endX(1, by + 0.2)
    I.rxB = S.endX(-1, by + 0.2)
    const K: any = mkKit(c, S, I)
    I.K = K
    const paint = c.paint(s.col),
      bcol = s.bumperCol ? c.paint(s.bumperCol) : paint
    /* front and rear of each model */
    const fa = s.arches[0],
      ra = s.arches[1]
    const wrapF = Math.max(0.1, S.endX(1, by + 0.25) - 0.07 - (fa[0] + fa[2] + 0.06)),
      wrapR = Math.max(0.1, ra[0] - ra[2] - 0.06 - S.endX(-1, by + 0.25) - 0.07)
    I.wrapF = wrapF
    I.wrapR = wrapR
    const bF = Object.assign({ y0: by + 0.01, y1: by + 0.3, mat: bcol }, s.frontBumper || {}),
      bR = Object.assign({ y0: by + 0.01, y1: by + 0.32, mat: bcol }, s.rearBumper || {})
    m.frontBumper = K.bumper(1, { y0: bF.y0, y1: bF.y1, wrap: Math.min(wrapF, bF.wrap || 9), mat: bF.mat })
    m.rearBumper = K.bumper(-1, { y0: bR.y0, y1: bR.y1, wrap: Math.min(wrapR, bR.wrap || 9), mat: bR.mat })
    I.bF = bF
    I.bR = bR
    /* black skirt of the rear bumper (diffuser) and front lip */
    const skG = K.grid(-1, 0, { wrap: Math.min(wrapR, 0.22), y0: by - 0.005, y1: by + 0.1, du: 0.03, dv: 0.03 })
    K.skin(skG, PLASTIC, { yb: by - 0.005, yt: by + (s.skirtH || 0.085), off: 0.03, thick: 0.03, nv: 3, shadow: true })
    for (let f = -2; f <= 2; f++) {
      const sf = skG.at(0.5 + f * 0.06, by + 0.035)
      c.roundBox(0.05, 0.05, 0.012, 0.004, PLASTIC, sf.p.x + 0.035 * sf.n.x, sf.p.y, sf.p.z + 0.035 * sf.n.z)
    }
    const lpG = K.grid(1, 0, { wrap: Math.min(wrapF, 0.18), y0: by - 0.005, y1: by + 0.06, du: 0.03, dv: 0.03 })
    K.skin(lpG, PLASTIC, { yb: by - 0.005, yt: by + 0.045, off: 0.03, thick: 0.03, nv: 2 })
    if (s.front) s.front(c, K, I)
    if (s.rear) s.rear(c, K, I)
    /* plates */
    K.plate(1, s.plateF || (bF.y0 + bF.y1) / 2, { off: 0.03 })
    K.plate(-1, s.plateR || (bR.y0 + bR.y1) / 2 + 0.03, { off: s.plateROnBumper === false ? 0.004 : 0.018 })
    /* pillars, mirrors, trim, handles, skirts */
    const tang = Math.atan(((gh.Wg / 2) * gh.k) / (T.top - T.belt))
    ;[1, -1].forEach(function (sd) {
      ;(s.blackPillars || []).forEach(function (px: any) {
        const ry = roofAt(gh, px),
          yc = (gh.belt + ry) / 2 + 0.005,
          hh = ry - gh.belt - 0.1
        c.roundBox(0.118, hh, 0.003, 0.0015, GLOSS, px, yc, sd * (halfAt(gh.Wg, T, yc) + 0.004), { rot: [-sd * tang, 0, 0] }).castShadow =
          false
      })
      const mx = gh.fb - 0.22,
        my = gh.belt + 0.09,
        mz0 = halfAt(gh.Wg, T, my),
        mcol = s.mirrorCol ? CM(s.mirrorCol, { roughness: 0.4, metalness: 0.3 }) : paint
      c.roundBox(0.16, 0.05, 0.08, 0.02, MT.trim, mx + 0.03, my - 0.04, sd * (mz0 + 0.03))
      c.roundBox(0.12, 0.12, 0.2, 0.05, mcol, mx, my + 0.02, sd * (mz0 + 0.14), { taper: { sx: 0.8, shift: -0.01 } })
      c.roundBox(0.02, 0.09, 0.16, 0.02, MT.chrome, mx - 0.065, my + 0.02, sd * (mz0 + 0.14))
      if (s.mirrorBlink !== false) c.roundBox(0.02, 0.012, 0.12, 0.005, MT.amber, mx + 0.03, my - 0.025, sd * (mz0 + 0.17))
      ;(s.seams || []).forEach(function (x: any) {
        c.roundBox(0.008, gh.belt - by - 0.12, 0.006, 0.003, MT.dark, x, (gh.belt + by) / 2 + 0.03, sd * (hw + 0.001))
      })
      ;(s.handles || []).forEach(function (x: any) {
        c.roundBox(
          0.15,
          0.03,
          0.02,
          0.012,
          s.handleCol ? CM(s.handleCol, { metalness: 0.6, roughness: 0.3 }) : MT.chrome,
          x,
          gh.belt - 0.09,
          sd * (hw + 0.004),
        )
      })
      if (s.arches && s.arches.length > 1) {
        const x0 = s.arches[1][0] + s.arches[1][2] + 0.02,
          x1 = s.arches[0][0] - s.arches[0][2] - 0.02
        c.roundBox(x1 - x0, 0.08, 0.035, 0.015, MT.trim, (x0 + x1) / 2, by + 0.05, sd * (hw - 0.008))
        if (s.clad)
          s.arches.forEach(function (a: any) {
            const a0 = Math.asin(clamp((by - a[1]) / a[2], -1, 1)),
              tor = c.add(new THREE.TorusGeometry(a[2] + 0.02, 0.035, 6, 26, PI - 2 * a0), MT.trim, a[0], a[1], sd * (hw - 0.01))
            tor.rotation.z = a0
            tor.scale.z = 0.8
          })
      }
      if (s.chromeBelt)
        c.roundBox(
          gh.fb - gh.rb - 0.3,
          0.012,
          0.008,
          0.004,
          MT.chrome,
          (gh.fb + gh.rb) / 2 - 0.05,
          gh.belt + 0.035,
          sd * (halfAt(gh.Wg, T, gh.belt + 0.035) + 0.004),
        )
    })
    /* wipers, antenna */
    const wy = gh.belt + 0.06,
      wx = gh.fb - 0.03
    ;[-0.3, 0.2].forEach(function (z) {
      c.rod(new V3(wx + 0.02, wy, z + 0.02), new V3(wx - 0.13, wy + 0.13, z - 0.36), 0.009, MT.trim)
    })
    if (s.fin !== false)
      c.sphere(0.1, s.roofCol ? c.paint(s.roofCol) : GLOSS, gh.rt + 0.2, roofAt(gh, gh.rt + 0.2) + 0.045, 0, 1.0, 0.45, 0.28, {
        tl: PI / 2,
      })
    if (s.spoiler)
      c.roundBox(0.27, 0.05, gh.Wg * 0.84, 0.022, s.roofCol ? c.paint(s.roofCol) : paint, gh.rt - 0.06, roofAt(gh, gh.rt) + 0.005, 0, {
        rot: [0, 0, -0.16],
      })
    if (s.rails)
      [1, -1].forEach(function (sd) {
        const z = sd * (halfAt(gh.Wg, T, gh.roof) - 0.1),
          x0 = gh.rt + 0.08,
          x1 = gh.ft - 0.08,
          rh = typeof s.rails === 'number' ? s.rails : 0.1
        const rl = c.rod(new V3(x0, roofAt(gh, x0) + rh, z), new V3(x1, roofAt(gh, x1) + rh, z), 0.018, MT.trim)
        c.deform.push(rl)
        ;(m.rails = m.rails || []).push(rl)
        ;[x0 + 0.04, x1 - 0.04].forEach(function (x) {
          m.rails.push(c.roundBox(0.1, rh - 0.03, 0.04, 0.015, MT.trim, x, roofAt(gh, x) + rh / 2 + 0.015, z, { def: true }))
        })
      })
    /* wheels (outside the warp; follow the curvature of the side) */
    ;(s.wheels || []).forEach(function (w: any) {
      const zw = hw * (1 - Wf.sec(w[1])) - w[2] / 2 + 0.02
      ;[1, -1].forEach(function (sd) {
        c.wheel(w[0], sd * zw, w[1], w[2], w[3] || {})
      })
    })
    underbody(c, s, I)
    if (s.extra) s.extra(c, I)
    if (
      !c.parts.some(function (p: any) {
        return p.kind === 'engine'
      })
    )
      c.part('engine', trl('labels.engine'), null, new V3(m.front - 0.6, by + 0.45, 0), 1.0)
    if (
      !c.parts.some(function (p: any) {
        return p.kind === 'radiator'
      }) &&
      !s.noRadiator
    )
      c.part('radiator', trl('labels.radiator'), null, new V3(m.front - 0.15, by + 0.35, 0), 0.9)
    c.part('fuel_tank', s.tankLabel || trl('labels.fuel_tank'), null, new V3(m.rear + 0.8, by + 0.15, -W * 0.22), 1.0)
    return I
  }
  /* underbody seen on rollover: matte black plate, exhaust, tank, axles and suspension arms */
  function underbody(c: any, s: any, I: any) {
    const by = I.by,
      fa = s.arches[0],
      ra = s.arches[1],
      _m = c.meta,
      x0 = I.rxB + 0.12,
      x1 = I.fxB - 0.12,
      zi = I.hw - 0.3,
      y = by - 0.008
    c.roundBox(x1 - x0, 0.016, zi * 2, 0.006, UNDER, (x0 + x1) / 2, y, 0).castShadow = false
    ;[1, -1].forEach(function (sd) {
      c.roundBox(fa[0] - ra[0] - 0.8, 0.05, 0.06, 0.015, UNDER2, (fa[0] + ra[0]) / 2, y - 0.02, sd * (zi - 0.06))
    })
    c.roundBox(fa[0] - ra[0] - 0.9, 0.08, 0.2, 0.03, UNDER, (fa[0] + ra[0]) / 2, y - 0.025, 0)
    if (s.hood && !(s.hood.motor === 'electric')) {
      c.roundBox(0.42, 0.08, 0.36, 0.03, UNDER2, fa[0] + 0.12, y - 0.04, 0)
      const ex = s.exhaust !== false
      if (ex) {
        c.tube(
          [
            [fa[0] - 0.05, y - 0.03, 0.12],
            [fa[0] - 0.5, y - 0.05, 0.1],
            [ra[0] + 0.6, y - 0.05, 0.1],
            [ra[0] - 0.1, y - 0.06, 0.28],
            [I.rxB + 0.08, y - 0.03, 0.38],
          ],
          0.025,
          EXH,
          { seg: 50 },
        )
        c.cylinder(0.075, 0.075, 0.36, EXH, (fa[0] + ra[0]) / 2, y - 0.07, 0.1, 'x')
        c.roundBox(0.42, 0.13, 0.3, 0.05, EXH, ra[0] - 0.35, y - 0.06, 0.32)
        c.cylinder(0.032, 0.03, 0.16, EXH, I.rxB - 0.0, by + 0.04, 0.42, 'x')
      }
    }
    c.roundBox(0.5, 0.18, 0.62, 0.05, CM('#1c1e20', { roughness: 0.7 }), ra[0] + 0.55, y - 0.07, -0.2)
    c.rod(new V3(ra[0], ra[1], -I.hw + 0.32), new V3(ra[0], ra[1], I.hw - 0.32), 0.04, UNDER2)
    ;[1, -1].forEach(function (sd) {
      c.rod(new V3(ra[0], ra[1], sd * (I.hw - 0.36)), new V3(ra[0] + 0.42, by - 0.01, sd * (I.hw - 0.42)), 0.03, UNDER2)
      c.rod(new V3(fa[0], fa[1], sd * (I.hw - 0.32)), new V3(fa[0], fa[1] + 0.02, sd * 0.12), 0.02, MT.steel)
      c.rod(new V3(fa[0] - 0.04, fa[1] - 0.06, sd * (I.hw - 0.3)), new V3(fa[0] + 0.25, by - 0.02, sd * 0.3), 0.025, UNDER2)
      c.rod(new V3(fa[0] - 0.04, fa[1] - 0.06, sd * (I.hw - 0.3)), new V3(fa[0] - 0.3, by - 0.02, sd * 0.3), 0.022, UNDER2)
    })
  }
  function wheelOpts(kind: any) {
    if (kind === 'alloy') return { rim: ALLOY, spokes: 5, rimR: 0.62 }
    if (kind === 'alloy2') return { rim: ALLOYD, spokeMat: ALLOY, spokes: 10, rimR: 0.64 }
    if (kind === 'hubcap') return { rim: HUBCAP, spokes: 0, rimR: 0.6 }
    if (kind === 'steel') return { rim: CM('#2b2d30', { metalness: 0.4, roughness: 0.5 }), spokes: 0, rimR: 0.58 }
    if (kind === 'steelg')
      return {
        rim: CM('#8e9398', { metalness: 0.55, roughness: 0.4 }),
        spokes: 8,
        rimR: 0.6,
        spokeMat: CM('#6e7378', { metalness: 0.5, roughness: 0.45 }),
      }
    if (kind === 'aero') return { rim: EVRIM, spokeMat: ALLOYD, spokes: 12, rimR: 0.64 }
    return {}
  }
  /* modified armour: the core default and one extra per model */
  function armorPlus(fn: any) {
    return function (c: any, Z: any) {
      Z.applyArmor(c)
      fn(c, Z)
    }
  }
  function roofLamp(c: any, x: any, y: any, z: any) {
    c.cylinder(0.07, 0.055, 0.1, MT.steel, x, y, z, 'x')
    c.cylinder(0.06, 0.06, 0.012, MT.head, x + 0.055, y, z, 'x')
  }
  function sm(t: any) {
    t = clamp(t, 0, 1)
    return t * t * (3 - 2 * t)
  }
  /* side grille (u along x, from x0 to x1) */
  function sideGrid(S: any, sd: any, o: any) {
    const nu = Math.max(4, Math.ceil(Math.abs(o.x1 - o.x0) / 0.04)),
      nv = Math.max(2, Math.ceil((o.y1 - o.y0) / 0.03)),
      P: any = [],
      N: any = []
    for (let i = 0; i <= nu; i++) {
      P.push([])
      N.push([])
      for (let j = 0; j <= nv; j++) {
        const x = o.x0 + ((o.x1 - o.x0) * i) / nu,
          y = o.y0 + ((o.y1 - o.y0) * j) / nv,
          O = new V3(x, y, sd * (S.hw + 1)),
          D = new V3(0, 0, -sd)
        const h: any = S.hit(O, D, 'M') || { p: new V3(x, y, sd * S.hw), n: new V3(0, 0, sd) }
        P[i].push(h.p)
        N[i].push(h.n)
      }
    }
    const G: any = { P: P, N: N, nu: nu, nv: nv, y0: o.y0, y1: o.y1, len: Math.abs(o.x1 - o.x0) }
    G.at = function (u: any, y: any) {
      const fi = clamp(u, 0, 1) * nu,
        fj = clamp((y - o.y0) / (o.y1 - o.y0), 0, 1) * nv,
        i0 = Math.min(nu - 1, Math.floor(fi)),
        j0 = Math.min(nv - 1, Math.floor(fj)),
        a = fi - i0,
        b = fj - j0
      function L(M: any) {
        return M[i0][j0]
          .clone()
          .multiplyScalar((1 - a) * (1 - b))
          .addScaledVector(M[i0 + 1][j0], a * (1 - b))
          .addScaledVector(M[i0][j0 + 1], (1 - a) * b)
          .addScaledVector(M[i0 + 1][j0 + 1], a * b)
      }
      return { p: L(P), n: L(N).normalize() }
    }
    G.ux = function (x: any) {
      return (x - o.x0) / (o.x1 - o.x0)
    }
    return G
  }
  /* round (decorative) fog light on the surface */
  function fogLamp(c: any, s: any, r: any) {
    onSurf(c.cylinder(r * 1.4, r * 1.4, 0.014, LH, 0, 0, 0), s, 0.006).castShadow = false
    onSurf(c.cylinder(r, r, 0.012, REFL, 0, 0, 0), s, 0.012).castShadow = false
    onSurf(c.sphere(r * 0.45, MT.head, 0, 0, 0, 1, 0.5, 1), s, 0.016).castShadow = false
  }

  /* body crease (character line): thin step in the car colour that follows the side through points [x, y], with a thin shadow fillet below */
  function crease(c: any, I: any, sd: any, pts: any, o: any) {
    o = o || {}
    const x0 = pts[0][0],
      x1 = pts[pts.length - 1][0]
    let lo = 9,
      hi = -9
    pts.forEach(function (q: any) {
      lo = Math.min(lo, q[1])
      hi = Math.max(hi, q[1])
    })
    const h = o.h || 0.03,
      Gd = sideGrid(I.S, sd, { x0: x0, x1: x1, y0: lo - h - 0.03, y1: hi + 0.03 })
    function yAt(u: any) {
      const x = x0 + (x1 - x0) * u
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i],
          b = pts[i + 1]
        if ((x - a[0]) * (x - b[0]) <= 0) {
          const t = (x - a[0]) / (b[0] - a[0] || 1)
          return a[1] + (b[1] - a[1]) * sm(t)
        }
      }
      return pts[pts.length - 1][1]
    }
    I.K.skin(Gd, o.mat || c.paint(o.col), {
      yb: function (u: any) {
        return yAt(u) - h
      },
      yt: yAt,
      off: o.off || 0.006,
      thick: 0.009,
      nv: 2,
      u0: o.u0 || 0.01,
      u1: o.u1 || 0.99,
    })
    const l = []
    for (let k = 0; k <= 30; k++) {
      const u = (o.u0 || 0.01) + (k / 30) * ((o.u1 || 0.99) - (o.u0 || 0.01))
      l.push([u, yAt(u) - h - 0.001])
    }
    lineOn(c, Gd, l, 0.003, o.shade || SHADE, 0.003)
    return Gd
  }
  const SHADE = CM('#000000', { roughness: 1, transparent: true, opacity: 0.45, depthWrite: false })
  /* chrome trim of the window line (DLO): follows the base of the glass and can climb the C pillar (pts [x, y] on the side of the glass) */
  function dloChrome(c: any, I: any, sd: any, pts: any, r: any) {
    const gh = I.gh,
      T = I.T,
      P = pts.map(function (q: any) {
        return [q[0], q[1], sd * (halfAt(gh.Wg, T, q[1]) + 0.012)]
      })
    const t = c.tube(P, r || 0.007, MT.chrome, { seg: P.length * 10, rs: 5 })
    t.castShadow = false
    c.deform.push(t)
    return t
  }

  /* ================= Hatch (Onix type) ================= */
  /* front of the hatch: thin headlight joined to the chrome bar, narrow upper grille, trapezoid lower grille and fog light */
  function onyxFront(c: any, K: any, _I: any) {
    ;[1, -1].forEach(function (sd) {
      const yb = function (u: any) {
          return 0.66 + 0.02 * u
        },
        yt = function (u: any) {
          return 0.735 + 0.028 * u
        }
      K.head(sd, {
        z0: 0.37,
        wrap: 0.14,
        shape: function (u: any) {
          return [yb(u), yt(u)]
        },
        proj: [
          [0.36, -0.004, 0.025],
          [0.6, -0.004, 0.027],
        ],
        drl: [
          {
            u0: 0.04,
            u1: 0.97,
            yb: function (u: any) {
              return yt(u) - 0.015
            },
            yt: function (u: any) {
              return yt(u) - 0.005
            },
          },
        ],
        amber: [
          {
            u0: 0.82,
            u1: 0.98,
            yb: function (u: any) {
              return yb(u) + 0.005
            },
            yt: function (u: any) {
              return yb(u) + 0.02
            },
          },
        ],
      })
    })
    K.grille(1, {
      z1: 0.36,
      y0: 0.62,
      y1: 0.73,
      u0: 0.02,
      u1: 0.98,
      yb: 0.635,
      yt: 0.705,
      tex: 'mesh',
      tile: 0.06,
      frame: MT.trim,
      frameR: 0.006,
    })
    const bar = K.grid(1, 0, { z1: 0.4, y0: 0.69, y1: 0.74, du: 0.03, dv: 0.025 })
    lineOn(
      c,
      bar,
      [
        [0.02, 0.712],
        [0.25, 0.716],
        [0.5, 0.717],
        [0.75, 0.716],
        [0.98, 0.712],
      ],
      0.0085,
      MT.chrome,
      0.012,
    )
    const e = bar.at(0.5, 0.716)
    kit.emblem(c, e.p.x + 0.02, 0.716, 0, 0.04)
    const _bg = c.meta.frontBumper.userData.grid,
      lw = K.grid(1, 0, { z1: 0.64, y0: 0.3, y1: 0.54, du: 0.03, dv: 0.03 })
    const zt = 0.54,
      zb = 0.42,
      y0 = 0.33,
      y1 = 0.51
    function yB(u: any) {
      const z = Math.abs(lw.zu(u))
      return z <= zb ? y0 : y0 + ((y1 - y0) * (z - zb)) / (zt - zb)
    }
    K.skin(lw, grilleMat('mesh'), { u0: lw.uz(-zt), u1: lw.uz(zt), yb: yB, yt: y1, off: 0.021, tile: 0.06, nv: 3 })
    outline(c, lw, { u0: lw.uz(-zt), u1: lw.uz(zt), yb: yB, yt: y1 }, 0.007, LH, 0.022)
    ;[1, -1].forEach(function (sd) {
      const Gc = K.grid(1, sd, { z0: 0.58, wrap: 0.04, y0: 0.32, y1: 0.5, du: 0.02, dv: 0.02 })
      K.skin(Gc, LH, { yb: 0.34, yt: 0.47, off: 0.021, nv: 3 })
      const s2 = Gc.at(0.42, 0.405)
      s2.p.addScaledVector(s2.n, 0.018)
      fogLamp(c, s2, 0.034)
    })
  }
  /* Reference (hatch): Chevrolet Onix 2020+ (fichacompleta.com.br, LT 1.0 Turbo 2024)
     length 4.163 · width 1.730 · height 1.476 · wheelbase 2.551 · track 1.506 / 1.510 · tyre 185/65 R15 (diameter 0.622)
     · overhangs about 0.84 / 0.77 (from memory) · clearance 0.128 (sheet; about 0.15 at the sill).
     Reference (sedan, Onix Plus): length 4.474 · width 1.730 · height 1.474 · wheelbase 2.600 · track 1.506 / 1.510
     · tyre 195/55 R16 (diameter 0.621) · overhangs about 0.84 / 1.03 (from memory) · clearance 0.127.
     Signature traits:
     front: thin LED headlight joined by a chrome trim to the narrow upper grille; large honeycomb trapezoid lower grille;
     fog lights on the corners in black frames.
     side: shoulder crease from the headlight to the taillight, passing through the handles; low crease on the doors rising to the rear wheel;
     window line rising to the rear with a chrome trim that "breaks" upward at the C pillar (teardrop); black B pillar.
     rear: horizontal taillights that invade the lid; lid with a roof spoiler (hatch) or short lid with a chrome trim (sedan).
     top: roof dropping to the rear, "fin" antenna. */
  function onyxSides(sedan: any) {
    return function (c: any, I: any) {
      const gh = I.gh,
        col = c.meta.color
      function yb(x: any) {
        return gh.belt + 0.035 + (gh.rise || 0) * clamp((gh.fb - x) / (gh.fb - gh.rb), 0, 1)
      }
      ;[1, -1].forEach(function (sd) {
        crease(
          c,
          I,
          sd,
          [
            [1.62, 0.79],
            [0.9, 0.84],
            [-0.4, 0.88],
            [sedan ? -2.2 : -1.9, sedan ? 0.89 : 0.9],
          ],
          { col: col, h: 0.028 },
        )
        crease(
          c,
          I,
          sd,
          [
            [0.8, 0.5],
            [-0.3, 0.52],
            [-0.95, 0.58],
          ],
          { col: col, h: 0.022 },
        )
        const P = []
        for (let x = gh.fb - 0.06; x >= gh.rb + (sedan ? 0.32 : 0.36); x -= 0.1) P.push([x, yb(x) - 0.008])
        const xe = gh.rb + (sedan ? 0.28 : 0.3),
          ye = yb(xe) - 0.008
        P.push([xe, ye], [xe - 0.03, ye + 0.05], [xe - 0.04, ye + (sedan ? 0.1 : 0.12)])
        dloChrome(c, I, sd, P, 0.009)
      })
    }
  }
  function ONYX(col: any, sedan?: any) {
    const lower = sedan
      ? [
          [-2.36, 0.27, 0.06],
          [-2.41, 0.55, 0.14],
          [-2.39, 0.9, 0.12],
          [-2.27, 1.02, 0.14],
          [-1.82, 1.02, 0.04],
          [0.68, 1.0, 0],
          [1.27, 0.93, 0.4],
          [1.88, 0.8, 0.16],
          [1.98, 0.58, 0.16],
          [1.94, 0.27, 0.06],
        ]
      : [
          [-2.03, 0.27, 0.06],
          [-2.08, 0.52, 0.14],
          [-2.06, 0.86, 0.12],
          [-1.97, 1.03, 0.06],
          [0.66, 1.0, 0],
          [1.25, 0.93, 0.4],
          [1.86, 0.8, 0.16],
          [1.97, 0.58, 0.16],
          [1.93, 0.27, 0.06],
        ]
    return {
      W: 1.73,
      col: col,
      bottomY: 0.26,
      noseY: 0.74,
      tailY: sedan ? 0.95 : 0.86,
      lower: lower,
      arches: [
        [1.18, 0.315, 0.355],
        [-1.4, 0.315, 0.355],
      ],
      gh: sedan
        ? {
            rb: -1.8,
            rt: -1.1,
            ft: -0.08,
            fb: 0.72,
            belt: 1.0,
            roof: 1.43,
            roofR: 1.37,
            crown: 0.025,
            rise: 0.04,
            Wg: 1.6,
            k: 0.2,
            pillars: [-0.5, -1.3],
            r1: 0.3,
            r2: 0.25,
          }
        : {
            rb: -1.95,
            rt: -1.4,
            ft: -0.08,
            fb: 0.72,
            belt: 1.0,
            roof: 1.43,
            roofR: 1.32,
            crown: 0.035,
            rise: 0.09,
            Wg: 1.6,
            k: 0.2,
            pillars: [-0.5, -1.22],
            r1: 0.12,
            r2: 0.25,
          },
      seams: [0.62, -0.5, sedan ? -1.36 : -1.32],
      handles: [0.22, -0.72],
      blackPillars: [-0.5],
      frontBumper: { y1: 0.56 },
      rearBumper: { y1: sedan ? 0.6 : 0.57 },
      plateF: 0.44,
      plateR: sedan ? 0.79 : 0.72,
      plateROnBumper: false,
      front: onyxFront,
      rear: function (c: any, K: any, I: any) {
        const y0 = sedan ? 0.86 : 0.84,
          y1 = sedan ? 0.97 : 0.96
        ;[1, -1].forEach(function (sd) {
          const yb = function (u: any) {
              return y0 + 0.03 * u
            },
            yt = function (u: any) {
              return y1 - 0.008 * u
            }
          K.tail(sd, {
            z0: sedan ? 0.41 : 0.37,
            wrap: 0.17,
            shape: function (u: any) {
              return [yb(u), yt(u)]
            },
            hi: [
              {
                u0: 0.08,
                u1: 0.97,
                yb: function (u: any) {
                  return yt(u) - 0.024
                },
                yt: function (u: any) {
                  return yt(u) - 0.011
                },
              },
              { u0: 0.3, u1: 0.34, yb: yb, yt: yt },
            ],
            rev: [
              {
                u0: 0.03,
                u1: 0.24,
                yb: function (u: any) {
                  return yb(u) + 0.008
                },
                yt: function (u: any) {
                  return yb(u) + 0.045
                },
              },
            ],
          })
          K.reflector(sd, I.hw - 0.24, 0.42, 0.1)
        })
        if (sedan) {
          K.lid([
            { y: 0.95, z: -0.39 },
            { y: 0.66, z: -0.39 },
            { y: 0.62, z: -0.36 },
            { y: 0.62, z: 0.36 },
            { y: 0.66, z: 0.39 },
            { y: 0.95, z: 0.39 },
            { top: true, x: -2.3, z: 0.56 },
            { top: true, x: -2.15, z: 0.62 },
            { top: true, x: -1.9, z: 0.6 },
            { top: true, x: -1.87, z: 0.4 },
            { top: true, x: -1.87, z: -0.4 },
            { top: true, x: -1.9, z: -0.6 },
            { top: true, x: -2.15, z: -0.62 },
            { top: true, x: -2.3, z: -0.56 },
            { y: 0.95, z: -0.39 },
          ])
          const cb = K.grid(-1, 0, { z1: 0.4, y0: 0.86, y1: 0.92, du: 0.03, dv: 0.03 })
          lineOn(
            c,
            cb,
            [
              [0.02, 0.89],
              [0.5, 0.89],
              [0.98, 0.89],
            ],
            0.007,
            MT.chrome,
            0.006,
          )
        } else {
          K.lid([
            { y: 1.0, z: -0.385 },
            { y: 0.64, z: -0.385 },
            { y: 0.6, z: -0.35 },
            { y: 0.6, z: 0.35 },
            { y: 0.64, z: 0.385 },
            { y: 1.0, z: 0.385 },
          ])
        }
        const ey = sedan ? 0.9 : 0.85
        kit.emblem(c, I.S.endX(-1, ey) - 0.012, ey, 0, 0.04).rotation.y = PI
      },
      spoiler: !sedan,
      interior: { rows: 2, col: '#2b2c30' },
      hood: { motor: 'gasoline' },
      wheels: [
        [1.18, 0.31, 0.2, wheelOpts('alloy')],
        [-1.4, 0.31, 0.2, wheelOpts('alloy')],
      ],
      warp: { bowF: 0.17, bowR: sedan ? 0.1 : 0.13 },
      extra: onyxSides(sedan),
    }
  }
  fx.register(
    {
      key: 'compact_hatch',
      group: 'cars',
      name: trl('vehicles.compact_hatch.name'),
      inspired: trl('vehicles.compact_hatch.inspired'),
      category: trl('vehicles.compact_hatch.category'),
      fuel: 'flex',
      description: trl('vehicles.compact_hatch.description'),
      mass: 1034,
      noise: 60,
      seats: trl('vehicles.compact_hatch.seats'),
      capacity: trl('vehicles.compact_hatch.capacity'),
      efficiency: trl('vehicles.compact_hatch.efficiency'),
      range: trl('vehicles.compact_hatch.range'),
      maxSpeed: 170,
      skill: trl('vehicles.compact_hatch.skill'),
      hood: true,
    },
    function (c) {
      car(c, ONYX('#9a2424'))
      c.meta.armor = armorPlus(function (c: any) {
        const r = c.meta.roof
        roofLamp(c, r.x1 + 0.05, r.y + 0.2, 0.35)
        roofLamp(c, r.x1 + 0.05, r.y + 0.2, -0.35)
      })
    },
  )

  fx.register(
    {
      key: 'taxi',
      group: 'cars',
      name: trl('vehicles.taxi.name'),
      inspired: trl('vehicles.taxi.inspired'),
      category: trl('vehicles.taxi.category'),
      fuel: 'flex',
      description: trl('vehicles.taxi.description'),
      mass: 1100,
      noise: 60,
      seats: trl('vehicles.taxi.seats'),
      capacity: trl('vehicles.taxi.capacity'),
      efficiency: trl('vehicles.taxi.efficiency'),
      range: trl('vehicles.taxi.range'),
      maxSpeed: 175,
      skill: trl('vehicles.taxi.skill'),
      hood: true,
    },
    function (c) {
      const s: any = ONYX('#dedcd5', true)
      s.handleCol = '#d0cfc9'
      s.wheels = [
        [1.18, 0.31, 0.2, wheelOpts('hubcap')],
        [-1.4, 0.31, 0.2, wheelOpts('hubcap')],
      ]
      car(c, s)
      const m = c.meta,
        lit = c.state === 'damaged' ? 0.05 : 0.75,
        ly = m.top + 0.1
      /* the light bar counts toward the rest height on rollover (it dents with the roof) */
      const lamps = [
        c.roundBox(0.52, 0.17, 0.26, 0.06, CM('#e8d36a', { emissive: new THREE.Color('#7a6410'), emissiveIntensity: lit }), -0.55, ly, 0, {
          def: true,
        }),
        c.roundBox(0.56, 0.03, 0.3, 0.012, MT.trim, -0.55, m.top + 0.01, 0, { def: true }),
        c.text(trl('texts.taxi'), 0.24, 0.1, -0.55 + 0.262, ly, 0, '+x', { fg: '#1a1a1a' }),
        c.text(trl('texts.taxi'), 0.24, 0.1, -0.55 - 0.262, ly, 0, '-x', { fg: '#1a1a1a' }),
      ]
      ;[1, -1].forEach(function (s2) {
        const z = s2 * (m.width / 2 + 0.008),
          f = s2 > 0 ? '+z' : '-z'
        c.text(trl('texts.taxi'), 0.46, 0.14, 0.15, 0.72, z, f, { fg: '#2c5f8a' })
        c.text(trl('texts.n_24h_cooperative_3333_1000'), 1.5, 0.075, -0.9, 0.72, z, f, { fg: '#2c5f8a', size: 0.78, w: 1280, h: 64 })
        c.roundBox(3.4, 0.05, 0.01, 0.005, CM('#2c5f8a'), -0.25, 0.58, s2 * (m.width / 2 + 0.003))
      })
      /* short radio antenna, leaning back */
      const prev = c.rod(new V3(-1.45, m.top - 0.03, 0.3), new V3(-1.62, m.top + 0.2, 0.3), 0.005, MT.trim, { r2: 0.003 })
      c.deform.push(prev)
      /* the light bar and the antenna belong to the roof: they go off from a dent and go away when the roof is torn off */
      c.zone('roof', null, null, lamps.concat([prev]), {
        onBand: function (c2: any, b: any) {
          if (b >= 2) lamps[0].material = CM('#6b6135', { roughness: 0.6 })
        },
      })
      m.top = ly + 0.085
      m.roof.y = Math.max(m.roof.y, ly + 0.085)
      m.armor = armorPlus(function (c: any) {
        c.roundBox(0.5, 0.06, 0.5, 0.02, MT.wood, -1.95, 1.08, 0)
        kit.jerryCan(c, -2.0, 1.33, 0.2, '#8e2a20')
      })
    },
  )

  /* ================= Mini hatch (Kwid type) ================= */
  /* Reference: Renault Kwid Zen 1.0 2024 (fichacompleta.com.br)
     Real measurements: length 3.680 · width 1.579 · height 1.479 (with bars) · wheelbase 2.423 · track about 1.385 / 1.394 (from memory)
     · tyre 165/70 R14 (diameter 0.587) · clearance 0.185 · overhangs about 0.69 / 0.57 (from memory).
     Signature traits:
     front: thin LED daytime light at the top, next to the hood, and the main headlight below in a black frame (split headlight);
     grille with a chrome frame between the daytime lights; tall black bumper with a lower intake.
     side: tall short "pocket SUV" body; black mouldings on the wheel arches and sill; roof bars;
     14-inch wheels with hubcaps; wide glassless C pillar.
     rear: vertical "C" taillights on the corner; almost vertical lid; black bumper with reflectors.
     top: straight tall roof, short at the back. */
  fx.register(
    {
      key: 'entry_hatch',
      group: 'cars',
      name: trl('vehicles.entry_hatch.name'),
      inspired: trl('vehicles.entry_hatch.inspired'),
      category: trl('vehicles.entry_hatch.category'),
      fuel: 'flex',
      description: trl('vehicles.entry_hatch.description'),
      mass: 790,
      noise: 55,
      seats: trl('vehicles.entry_hatch.seats'),
      capacity: trl('vehicles.entry_hatch.capacity'),
      efficiency: trl('vehicles.entry_hatch.efficiency'),
      range: trl('vehicles.entry_hatch.range'),
      maxSpeed: 156,
      skill: trl('vehicles.entry_hatch.skill'),
      hood: true,
    },
    function (c) {
      car(c, {
        W: 1.58,
        col: '#c25a1c',
        bottomY: 0.3,
        noseY: 0.86,
        tailY: 0.9,
        lower: [
          [-1.86, 0.31, 0.06],
          [-1.9, 0.55, 0.12],
          [-1.88, 0.88, 0.1],
          [-1.83, 1.0, 0.05],
          [0.52, 1.0, 0],
          [1.03, 0.96, 0.35],
          [1.55, 0.88, 0.16],
          [1.635, 0.62, 0.16],
          [1.595, 0.31, 0.06],
        ],
        arches: [
          [1.0, 0.3, 0.35],
          [-1.42, 0.3, 0.35],
        ],
        gh: {
          rb: -1.85,
          rt: -1.57,
          ft: -0.08,
          fb: 0.56,
          belt: 1.0,
          roof: 1.41,
          roofR: 1.38,
          crown: 0.02,
          Wg: 1.5,
          k: 0.17,
          pillars: [-0.58, -1.38],
          r1: 0.14,
          r2: 0.22,
        },
        dropRear: true,
        seams: [0.48, -0.58, -1.36],
        handles: [0.08, -0.8],
        blackPillars: [-0.58],
        clad: true,
        rails: 0.075,
        frontBumper: { y1: 0.6 },
        rearBumper: { y1: 0.6 },
        bumperCol: '#2a2b2d',
        skirtH: 0.06,
        plateF: 0.45,
        plateR: 0.74,
        plateROnBumper: false,
        front: function (c: any, K: any, _I: any) {
          ;[1, -1].forEach(function (sd) {
            /* main headlight below, in a black frame, and the thin daytime light above, next to the hood (the model signature) */
            K.head(sd, {
              z0: 0.42,
              wrap: 0.1,
              shape: function (u: any) {
                return [0.645 + 0.01 * u, 0.745 + 0.012 * u]
              },
              proj: [
                [0.35, 0, 0.032],
                [0.68, 0, 0.03],
              ],
              amber: [{ u0: 0.86, u1: 0.99, yb: 0.66, yt: 0.7 }],
            })
            K.head(sd, {
              z0: 0.3,
              wrap: 0.12,
              shape: function (u: any) {
                return [0.815 + 0.012 * u, 0.84 + 0.012 * u]
              },
              pad: 0.008,
              label: sd > 0 ? trl('labels.right_daytime_running_light') : trl('labels.left_daytime_running_light'),
              drl: [
                {
                  u0: 0.03,
                  u1: 0.97,
                  yb: function (u: any) {
                    return 0.82 + 0.012 * u
                  },
                  yt: function (u: any) {
                    return 0.835 + 0.012 * u
                  },
                },
              ],
            })
          })
          K.grille(1, {
            z1: 0.4,
            y0: 0.6,
            y1: 0.82,
            u0: 0.03,
            u1: 0.97,
            yb: 0.63,
            yt: 0.79,
            tex: 'mesh',
            tile: 0.06,
            frame: MT.chrome,
            frameR: 0.008,
          })
          const e = K.grid(1, 0, { z1: 0.1, y0: 0.74, y1: 0.8, du: 0.03, dv: 0.03 }).at(0.5, 0.78)
          kit.emblem(c, e.p.x + 0.02, 0.775, 0, 0.045)
          const lw = K.grid(1, 0, { z1: 0.5, y0: 0.33, y1: 0.52, du: 0.03, dv: 0.03 })
          K.skin(lw, grilleMat('mesh'), { u0: lw.uz(-0.42), u1: lw.uz(0.42), yb: 0.35, yt: 0.43, off: 0.021, tile: 0.06, nv: 2 })
          ;[1, -1].forEach(function (sd) {
            const s1 = K.grid(1, sd, { z0: 0.5, z1: 0.62, y0: 0.4, y1: 0.5, du: 0.02, dv: 0.02 }).at(0.5, 0.45)
            c.roundBox(0.03, 0.04, 0.16, 0.015, MT.chrome, s1.p.x + 0.03, 0.45, sd * 0.56)
          })
        },
        rear: function (c: any, K: any, I: any) {
          const z0 = I.hw - 0.07 - 0.11
          ;[1, -1].forEach(function (sd) {
            /* vertical "C" taillight, recessed in the corner */
            const yb = function (..._rest: any[]) {
                return 0.66
              },
              yt = function (..._rest: any[]) {
                return 0.98
              }
            K.tail(sd, {
              z0: z0,
              wrap: 0.09,
              shape: function (u: any) {
                return [yb(u), yt(u)]
              },
              hi: [
                { u0: 0.18, u1: 0.95, yb: 0.945, yt: 0.962 },
                { u0: 0.18, u1: 0.95, yb: 0.678, yt: 0.695 },
                { u0: 0.18, u1: 0.27, yb: 0.678, yt: 0.962 },
              ],
              rev: [{ u0: 0.35, u1: 0.62, yb: 0.74, yt: 0.8 }],
              amber: [{ u0: 0.35, u1: 0.62, yb: 0.82, yt: 0.86 }],
            })
            K.reflector(sd, I.hw - 0.24, 0.45, 0.1)
          })
          K.lid([
            { y: 0.99, z: -0.6 },
            { y: 0.66, z: -0.6 },
            { y: 0.62, z: -0.56 },
            { y: 0.62, z: 0.56 },
            { y: 0.66, z: 0.6 },
            { y: 0.99, z: 0.6 },
          ])
          kit.emblem(c, I.S.endX(-1, 0.86) - 0.012, 0.86, 0, 0.04).rotation.y = PI
        },
        interior: { rows: 2, col: '#3a3c40', trim: '#232427' },
        hood: { motor: 'gasoline' },
        wheels: [
          [1.0, 0.293, 0.17, wheelOpts('hubcap')],
          [-1.42, 0.293, 0.17, wheelOpts('hubcap')],
        ],
        warp: { bowF: 0.15, bowR: 0.16, Lf: 0.5, Lr: 0.45, pinR: 0.07 },
        extra: function (c: any, _I: any) {
          ;[1, -1].forEach(function (sd) {
            c.roundBox(0.05, 0.16, 0.1, 0.03, MT.trim, -1.12, 1.17, sd * 0.69)
          })
        },
      })
      /* roof bars belong to the roof (they dent and go away with it) */
      c.zone('roof', null, null, c.meta.rails || [])
      c.meta.armor = armorPlus(function (c: any) {
        kit.jerryCan(c, -1.98, 0.7, 0.45, '#8e2a20')
        c.roundBox(0.1, 0.5, 0.5, 0.03, kit.steelMaterial, -2.0, 0.72, -0.2)
      })
    },
  )

  /* ================= Electric hatch (Dolphin type) ================= */
  /* Reference: BYD Dolphin 2023+ (global version; km77.com and garagem360.com.br)
     Real measurements: length 4.290 · width 1.770 · height 1.570 · wheelbase 2.700 · track about 1.530 / 1.530 (from memory)
     · tyre 205/55 R16 (diameter 0.632) · overhangs about 0.86 / 0.73 (from memory) · clearance about 0.12.
     Signature traits:
     front: closed front (electric) with headlights whose inner tip rises towards the hood, like "fins", and a continuous DRL
     on the top edge; wide thin lower intake with a trim; vertical inlets on the corners.
     side: embossed "wave" that starts at the rear door and rises to the taillight; dark roof in contrast; black B pillar;
     aerodynamic wheels; charge port on the rear left side.
     rear: taillight bar from end to end joining the taillights; tall, almost vertical lid.
     top: long straight, tall roof (1.57 m hatch). */
  fx.register(
    {
      key: 'electric_hatch',
      group: 'cars',
      name: trl('vehicles.electric_hatch.name'),
      inspired: trl('vehicles.electric_hatch.inspired'),
      category: trl('vehicles.electric_hatch.category'),
      fuel: 'electric',
      description: trl('vehicles.electric_hatch.description'),
      mass: 1405,
      noise: 15,
      seats: trl('vehicles.electric_hatch.seats'),
      capacity: trl('vehicles.electric_hatch.capacity'),
      efficiency: trl('vehicles.electric_hatch.efficiency'),
      range: trl('vehicles.electric_hatch.range'),
      maxSpeed: 150,
      skill: trl('vehicles.electric_hatch.skill'),
      hood: true,
    },
    function (c) {
      const hex = '#4d8f93'
      car(c, {
        W: 1.77,
        col: hex,
        roofCol: '#2b2f34',
        bottomY: 0.3,
        noseY: 0.8,
        tailY: 0.9,
        lower: [
          [-2.06, 0.31, 0.06],
          [-2.11, 0.55, 0.14],
          [-2.09, 0.8, 0.1],
          [-2.01, 0.97, 0.08],
          [-1.92, 1.06, 0.05],
          [0.8, 1.03, 0],
          [1.42, 0.96, 0.45],
          [1.99, 0.84, 0.2],
          [2.08, 0.6, 0.18],
          [2.03, 0.31, 0.06],
        ],
        arches: [
          [1.3, 0.32, 0.365],
          [-1.4, 0.32, 0.365],
        ],
        gh: {
          rb: -1.9,
          rt: -1.42,
          ft: 0.0,
          fb: 0.86,
          belt: 1.03,
          roof: 1.52,
          roofR: 1.42,
          crown: 0.035,
          rise: 0.06,
          Wg: 1.64,
          k: 0.21,
          pillars: [-0.44, -1.26],
          r1: 0.14,
          r2: 0.28,
        },
        seams: [0.76, -0.44, -1.36],
        handles: [0.3, -0.7],
        handleCol: '#c9ced1',
        blackPillars: [-0.44],
        frontBumper: { y1: 0.6 },
        rearBumper: { y1: 0.58 },
        plateF: 0.45,
        plateR: 0.72,
        plateROnBumper: false,
        front: function (c: any, K: any, _I: any) {
          ;[1, -1].forEach(function (sd) {
            /* headlight with the inner tip rising towards the hood; continuous DRL along the top edge */
            const yb = function (u: any) {
                return 0.685 + 0.01 * u
              },
              yt = function (u: any) {
                return 0.765 + 0.06 * (1 - sm(u / 0.32))
              }
            K.head(sd, {
              z0: 0.26,
              wrap: 0.2,
              shape: function (u: any) {
                return [yb(u), yt(u)]
              },
              proj: [
                [0.52, -0.012, 0.026],
                [0.74, -0.012, 0.027],
              ],
              drl: [
                {
                  u0: 0.015,
                  u1: 0.98,
                  yb: function (u: any) {
                    return yt(u) - 0.016
                  },
                  yt: function (u: any) {
                    return yt(u) - 0.005
                  },
                },
              ],
            })
          })
          const e = K.grid(1, 0, { z1: 0.1, y0: 0.62, y1: 0.7, du: 0.03, dv: 0.03 }).at(0.5, 0.66)
          kit.emblem(c, e.p.x + 0.02, 0.66, 0, 0.045)
          const lw = K.grid(1, 0, { z1: 0.6, y0: 0.34, y1: 0.5, du: 0.03, dv: 0.03 })
          K.skin(lw, grilleMat('slots'), { u0: lw.uz(-0.54), u1: lw.uz(0.54), yb: 0.37, yt: 0.44, off: 0.021, tile: 0.05, nv: 2 })
          outline(c, lw, { u0: lw.uz(-0.54), u1: lw.uz(0.54), yb: 0.37, yt: 0.44 }, 0.005, MT.chrome, 0.022)
          ;[1, -1].forEach(function (sd) {
            const Gv = K.grid(1, sd, { z0: 0.62, wrap: 0.06, y0: 0.32, y1: 0.56, du: 0.02, dv: 0.02 })
            K.skin(Gv, LH, {
              u0: 0.1,
              u1: 0.9,
              yb: 0.34,
              yt: function (u: any) {
                return 0.5 + 0.03 * u
              },
              off: 0.021,
              nv: 3,
            })
          })
        },
        rear: function (c: any, K: any, I: any) {
          const z0 = 0.47
          ;[1, -1].forEach(function (sd) {
            K.tail(sd, {
              z0: z0,
              wrap: 0.16,
              shape: function (u: any) {
                return [0.835 + 0.02 * u, 0.955 - 0.01 * u]
              },
              hi: [
                { u0: 0.0, u1: 0.96, yb: 0.877, yt: 0.903 },
                { u0: 0.55, u1: 0.95, yb: 0.84, yt: 0.855 },
              ],
              rev: [{ u0: 0.04, u1: 0.3, yb: 0.85, yt: 0.872 }],
            })
            K.reflector(sd, I.hw - 0.24, 0.42, 0.1)
          })
          /* continuous edge-to-edge taillight bar (lit) */
          const bg = K.grid(-1, 0, { z1: z0 + 0.02, y0: 0.86, y1: 0.92, du: 0.02, dv: 0.02 })
          K.skin(bg, LH, { yb: 0.869, yt: 0.911, off: 0.003, nv: 2 })
          const bar = K.skin(bg, TAILHI, { yb: 0.877, yt: 0.903, off: 0.009, nv: 2 }),
            bl = K.skin(bg, MT.lensRed, { yb: 0.872, yt: 0.908, off: 0.013, nv: 2, order: 3 })
          regLight(c, 'taillight', trl('labels.taillight_bar'), [bar], [bl], bg.at(0.5, 0.89).p)
          K.lid([
            { y: 0.99, z: -0.44 },
            { y: 0.63, z: -0.44 },
            { y: 0.6, z: -0.41 },
            { y: 0.6, z: 0.41 },
            { y: 0.63, z: 0.44 },
            { y: 0.99, z: 0.44 },
          ])
          kit.emblem(c, I.S.endX(-1, 0.8) - 0.012, 0.8, 0, 0.035).rotation.y = PI
        },
        interior: { rows: 2, col: '#6d747b', trim: '#2a2d31' },
        hood: { motor: 'electric' },
        exhaust: false,
        noRadiator: true,
        wheels: [
          [1.3, 0.32, 0.21, wheelOpts('aero')],
          [-1.4, 0.32, 0.21, wheelOpts('aero')],
        ],
        tankLabel: trl('labels.traction_battery'),
        warp: { bowF: 0.2, bowR: 0.12, Lf: 0.6 },
        extra: function (c: any, I: any) {
          ;[1, -1].forEach(function (sd) {
            /* the side "wave": embossed band that starts at the rear door and rises to the taillight */
            const Gw = sideGrid(I.S, sd, { x0: 0.2, x1: -1.98, y0: 0.5, y1: 0.98 })
            const yc = function (u: any) {
              return 0.6 + 0.3 * sm((u - 0.25) / 0.75) + 0.02 * u
            }
            K0(I).skin(Gw, c.paint(hex), {
              yb: function (u: any) {
                return yc(u) - 0.02 - 0.012 * (1 - u)
              },
              yt: function (u: any) {
                return yc(u) + 0.006
              },
              off: 0.008,
              thick: 0.014,
              nv: 2,
              u0: 0.02,
              u1: 0.99,
            })
            lineOn(
              c,
              Gw,
              (function () {
                const l = []
                for (let k = 0; k <= 16; k++) {
                  const u = 0.04 + (k / 16) * 0.94
                  l.push([u, yc(u) - 0.028 - 0.012 * (1 - u)])
                }
                return l
              })(),
              0.004,
              MT.chrome,
              0.004,
            )
            c.text(trl('texts.electric'), 0.42, 0.09, -1.66, 0.56, sd * (I.hw + 0.006), sd > 0 ? '+z' : '-z', { fg: '#d6eef0', size: 0.62 })
          })
          c.roundBox(0.12, 0.13, 0.012, 0.02, c.paint(hex), -1.85, 0.72, -(I.hw + 0.004))
          c.cylinder(0.03, 0.03, 0.01, MT.blue, -1.85, 0.72, -(I.hw + 0.012), 'z')
        },
      })
      c.parts = c.parts.filter(function (p: any) {
        return p.kind !== 'radiator' && p.kind !== 'fuel_tank'
      })
      c.part('battery', trl('labels.traction_battery'), null, new V3(-0.3, 0.3, 0), 1.2)
      c.meta.armor = armorPlus(function (c: any) {
        const r = c.meta.roof,
          y = r.y + 0.2
        c.roundBox(r.x1 - r.x0 - 0.1, 0.03, r.w * 0.9, 0.01, CM('#16233a', { metalness: 0.6, roughness: 0.25 }), (r.x0 + r.x1) / 2, y, 0)
        for (let x = r.x0 + 0.2; x < r.x1 - 0.1; x += 0.25) c.roundBox(0.01, 0.034, r.w * 0.9, 0.003, MT.alu, x, y, 0)
        c.tube(
          [
            [r.x0, y, 0.4],
            [r.x0 - 0.2, y - 0.4, 0.75],
            [-1.85, 0.72, -0.9],
          ],
          0.012,
          MT.hv,
        )
      })
    },
  )
  function K0(I: any) {
    return I.K
  }

  /* ================= Sedan (Corolla type) ================= */
  /* Reference: Toyota Corolla G12 2020+ (fichacompleta.com.br, Altis 2024)
     Real measurements: length 4.630 · width 1.780 · height 1.455 · wheelbase 2.700 · track 1.531 / 1.544
     · tyre 215/50 R17 (diameter 0.647) · clearance 0.148 · overhangs about 0.93 / 1.00 (from memory).
     Signature traits:
     front: thin wedge headlights with an "L" DRL, narrow upper grille joining the headlights; huge trapezoid lower grille
     in diamond; "C" mouldings on the corners with a vertical LED.
     side: almost fastback profile with an early roof drop; strong low crease on the doors rising to the rear; chrome trim on the
     window line; short trunk lid.
     rear: wide taillights that invade the lid with a chrome trim between them; bumper with reflectors.
     top: short roof, very sloped windshield and rear glass. */
  fx.register(
    {
      key: 'midsize_sedan',
      group: 'cars',
      name: trl('vehicles.midsize_sedan.name'),
      inspired: trl('vehicles.midsize_sedan.inspired'),
      category: trl('vehicles.midsize_sedan.category'),
      fuel: 'flex',
      description: trl('vehicles.midsize_sedan.description'),
      mass: 1380,
      noise: 60,
      seats: trl('vehicles.midsize_sedan.seats'),
      capacity: trl('vehicles.midsize_sedan.capacity'),
      efficiency: trl('vehicles.midsize_sedan.efficiency'),
      range: trl('vehicles.midsize_sedan.range'),
      maxSpeed: 195,
      skill: trl('vehicles.midsize_sedan.skill'),
      hood: true,
    },
    function (c) {
      car(c, {
        W: 1.78,
        col: '#8b939a',
        bottomY: 0.26,
        noseY: 0.7,
        tailY: 0.9,
        lower: [
          [-2.29, 0.27, 0.06],
          [-2.34, 0.55, 0.14],
          [-2.32, 0.85, 0.12],
          [-2.23, 0.96, 0.1],
          [-1.84, 0.99, 0.04],
          [0.74, 0.98, 0],
          [1.42, 0.9, 0.45],
          [2.08, 0.74, 0.16],
          [2.18, 0.52, 0.16],
          [2.14, 0.27, 0.06],
        ],
        arches: [
          [1.3, 0.325, 0.365],
          [-1.4, 0.325, 0.365],
        ],
        gh: {
          rb: -1.8,
          rt: -1.12,
          ft: -0.12,
          fb: 0.78,
          belt: 0.98,
          roof: 1.405,
          roofR: 1.35,
          crown: 0.025,
          rise: 0.03,
          Wg: 1.62,
          k: 0.21,
          pillars: [-0.48, -1.28],
          r1: 0.32,
          r2: 0.28,
        },
        seams: [0.7, -0.48, -1.34],
        handles: [0.24, -0.74],
        blackPillars: [-0.48],
        chromeBelt: true,
        frontBumper: { y1: 0.55 },
        rearBumper: { y1: 0.58 },
        plateF: 0.42,
        plateR: 0.74,
        plateROnBumper: false,
        front: function (c: any, K: any, _I: any) {
          ;[1, -1].forEach(function (sd) {
            /* wedge headlight: thin inner tip, widening outward; L-shaped DRL */
            const yb = function (u: any) {
                return 0.664 - 0.046 * sm(u * 1.4)
              },
              yt = function (u: any) {
                return 0.692 + 0.032 * sm(u * 1.5)
              }
            K.head(sd, {
              z0: 0.3,
              wrap: 0.22,
              shape: function (u: any) {
                return [yb(u), yt(u)]
              },
              proj: [
                [0.48, 0.006, 0.025],
                [0.7, 0.006, 0.027],
              ],
              drl: [
                {
                  u0: 0.22,
                  u1: 0.96,
                  yb: function (u: any) {
                    return yb(u) + 0.004
                  },
                  yt: function (u: any) {
                    return yb(u) + 0.015
                  },
                },
                {
                  u0: 0.86,
                  u1: 0.9,
                  yb: function (u: any) {
                    return yb(u) + 0.004
                  },
                  yt: function (u: any) {
                    return yt(u) - 0.008
                  },
                },
              ],
            })
          })
          K.grille(1, {
            z1: 0.3,
            y0: 0.63,
            y1: 0.71,
            u0: 0.02,
            u1: 0.98,
            yb: 0.655,
            yt: 0.69,
            tex: 'barsd',
            tile: 0.05,
            frame: MT.chrome,
            frameR: 0.005,
          })
          const e = K.grid(1, 0, { z1: 0.1, y0: 0.64, y1: 0.7, du: 0.03, dv: 0.03 }).at(0.5, 0.672)
          kit.emblem(c, e.p.x + 0.022, 0.672, 0, 0.042)
          /* large trapezoid lower grille */
          const lw = K.grid(1, 0, { z1: 0.72, y0: 0.29, y1: 0.54, du: 0.03, dv: 0.03 }),
            zt = 0.66,
            zb = 0.5,
            y0 = 0.31,
            y1 = 0.52
          function yB(u: any) {
            const z = Math.abs(lw.zu(u))
            return z <= zb ? y0 : y0 + ((y1 - y0) * (z - zb)) / (zt - zb)
          }
          K.skin(lw, grilleMat('diamond'), { u0: lw.uz(-zt), u1: lw.uz(zt), yb: yB, yt: y1, off: 0.021, tile: 0.05, nv: 3 })
          outline(c, lw, { u0: lw.uz(-zt), u1: lw.uz(zt), yb: yB, yt: y1 }, 0.009, LH, 0.022)
          ;[1, -1].forEach(function (sd) {
            const Gc = K.grid(1, sd, { z0: 0.68, wrap: 0.05, y0: 0.3, y1: 0.54, du: 0.02, dv: 0.02 })
            K.skin(Gc, LH, {
              u0: 0.05,
              u1: 0.95,
              yb: 0.33,
              yt: function (u: any) {
                return 0.5 - 0.04 * u
              },
              off: 0.021,
              nv: 3,
            })
            K.skin(Gc, DRL, { u0: 0.15, u1: 0.25, yb: 0.36, yt: 0.47, off: 0.024, nv: 2 })
          })
        },
        rear: function (c: any, K: any, I: any) {
          ;[1, -1].forEach(function (sd) {
            const yb = function (u: any) {
                return 0.82 + 0.02 * u
              },
              yt = function (u: any) {
                return 0.945 - 0.012 * u
              }
            K.tail(sd, {
              z0: 0.43,
              wrap: 0.22,
              shape: function (u: any) {
                return [yb(u), yt(u)]
              },
              hi: [
                {
                  u0: 0.12,
                  u1: 0.96,
                  yb: function (u: any) {
                    return yt(u) - 0.022
                  },
                  yt: function (u: any) {
                    return yt(u) - 0.01
                  },
                },
                {
                  u0: 0.12,
                  u1: 0.17,
                  yb: function (u: any) {
                    return yb(u) + 0.01
                  },
                  yt: function (u: any) {
                    return yt(u) - 0.01
                  },
                },
              ],
              rev: [
                {
                  u0: 0.22,
                  u1: 0.45,
                  yb: function (u: any) {
                    return yb(u) + 0.01
                  },
                  yt: function (u: any) {
                    return yb(u) + 0.045
                  },
                },
              ],
            })
            K.reflector(sd, I.hw - 0.24, 0.42, 0.12)
          })
          const cb = K.grid(-1, 0, { z1: 0.43, y0: 0.84, y1: 0.92, du: 0.03, dv: 0.03 })
          lineOn(
            c,
            cb,
            [
              [0.01, 0.885],
              [0.5, 0.885],
              [0.99, 0.885],
            ],
            0.012,
            MT.chrome,
            0.008,
          )
          K.lid([
            { y: 0.94, z: -0.41 },
            { y: 0.64, z: -0.41 },
            { y: 0.6, z: -0.38 },
            { y: 0.6, z: 0.38 },
            { y: 0.64, z: 0.41 },
            { y: 0.94, z: 0.41 },
            { top: true, x: -2.23, z: 0.58 },
            { top: true, x: -2.09, z: 0.64 },
            { top: true, x: -1.88, z: 0.62 },
            { top: true, x: -1.86, z: 0.4 },
            { top: true, x: -1.86, z: -0.4 },
            { top: true, x: -1.88, z: -0.62 },
            { top: true, x: -2.09, z: -0.64 },
            { top: true, x: -2.23, z: -0.58 },
            { y: 0.94, z: -0.41 },
          ])
        },
        interior: { rows: 2, col: '#2a2b2e' },
        hood: { motor: 'gasoline' },
        wheels: [
          [1.3, 0.323, 0.21, wheelOpts('alloy2')],
          [-1.4, 0.323, 0.21, wheelOpts('alloy2')],
        ],
        warp: { bowF: 0.2, bowR: 0.12, Lf: 0.6 },
        extra: function (c: any, I: any) {
          ;[1, -1].forEach(function (sd) {
            crease(
              c,
              I,
              sd,
              [
                [1.75, 0.8],
                [0.4, 0.86],
                [-1.0, 0.89],
                [-2.15, 0.9],
              ],
              { col: '#8b939a', h: 0.026 },
            )
            crease(
              c,
              I,
              sd,
              [
                [1.0, 0.47],
                [0.0, 0.5],
                [-0.9, 0.6],
                [-1.2, 0.66],
              ],
              { col: '#8b939a', h: 0.035 },
            )
          })
        },
      })
      c.meta.armor = armorPlus(function (c: any) {
        roofLamp(c, c.meta.roof.x1, c.meta.roof.y + 0.2, 0.3)
      })
    },
  )

  /* ================= Police sedan (Cruze type, military police) ================= */
  /* Reference: Chevrolet Cruze Sedan 2017+ (fichacompleta.com.br, LT 1.4 Turbo 2019)
     Real measurements: length 4.665 · width 1.807 · height 1.484 · wheelbase 2.700 · track about 1.544 / 1.565 (from memory)
     · tyre 205/60 R16 of the police fleet (diameter 0.652; 215/50 R17 on the LT) · clearance about 0.15 · overhangs about 0.94 / 1.03 (from memory).
     Signature traits:
     front: headlights tapering backward with a DRL below; double grille separated by a body-colour bar with the badge (thin slit at the top,
     larger grille below); wide lower intake.
     side: shoulder crease from the headlight to the taillight; low crease on the doors; arched roof dropping into a very sloped rear glass;
     thick C pillar; short tall trunk lid.
     rear: horizontal taillights that invade the lid; bumper with reflectors.
     patrol car: light bar on the roof, push bumper, grille separating the back seat, radio, doors in the force colour
     with "MILITARY POLICE" (or white with blue and yellow stripes for the highway police). */
  /* same builder for the military police and the highway police (prf = true: white doors, blue and yellow stripes, "FEDERAL HIGHWAY POLICE" and "191") */
  function patrol(c: any, highwayPolice: any) {
    const white = '#e9e8e2',
      door = highwayPolice ? white : '#30363f',
      blueP = '#1f3f8f',
      yellowP = '#f2c21a',
      phone = highwayPolice ? '191' : '190'
    car(c, {
      W: 1.8,
      col: white,
      bottomY: 0.27,
      noseY: 0.74,
      tailY: 0.92,
      lower: [
        [-2.34, 0.28, 0.06],
        [-2.39, 0.56, 0.14],
        [-2.37, 0.9, 0.12],
        [-2.26, 1.03, 0.14],
        [-1.88, 1.03, 0.04],
        [0.76, 1.0, 0],
        [1.42, 0.93, 0.45],
        [2.1, 0.78, 0.16],
        [2.2, 0.55, 0.16],
        [2.16, 0.28, 0.06],
      ],
      arches: [
        [1.3, 0.325, 0.365],
        [-1.4, 0.325, 0.365],
      ],
      gh: {
        rb: -1.86,
        rt: -1.08,
        ft: -0.06,
        fb: 0.8,
        belt: 1.0,
        roof: 1.43,
        roofR: 1.38,
        crown: 0.025,
        rise: 0.03,
        Wg: 1.64,
        k: 0.21,
        pillars: [-0.46, -1.3],
        r1: 0.32,
        r2: 0.28,
      },
      seams: [0.72, -0.46, -1.36],
      handles: [0.26, -0.72],
      blackPillars: [-0.46],
      frontBumper: { y1: 0.56 },
      rearBumper: { y1: 0.6 },
      plateF: 0.42,
      plateR: 0.78,
      plateROnBumper: false,
      front: function (c: any, K: any, _I: any) {
        ;[1, -1].forEach(function (sd) {
          const yb = function (u: any) {
              return 0.665 + 0.012 * u
            },
            yt = function (u: any) {
              return 0.752 + 0.024 * u
            }
          K.head(sd, {
            z0: 0.38,
            wrap: 0.18,
            shape: function (u: any) {
              return [yb(u), yt(u)]
            },
            proj: [
              [0.3, -0.004, 0.03],
              [0.58, -0.004, 0.03],
            ],
            drl: [
              {
                u0: 0.08,
                u1: 0.96,
                yb: function (u: any) {
                  return yb(u) + 0.005
                },
                yt: function (u: any) {
                  return yb(u) + 0.016
                },
              },
            ],
            amber: [
              {
                u0: 0.82,
                u1: 0.98,
                yb: function (u: any) {
                  return yt(u) - 0.03
                },
                yt: function (u: any) {
                  return yt(u) - 0.008
                },
              },
            ],
          })
        })
        /* double grille: top slit, body-colour bar with the badge, larger grille below */
        K.grille(1, {
          z1: 0.38,
          y0: 0.7,
          y1: 0.78,
          u0: 0.03,
          u1: 0.97,
          yb: 0.722,
          yt: 0.758,
          tex: 'barsd',
          tile: 0.05,
          frame: MT.chrome,
          frameR: 0.005,
        })
        K.grille(1, {
          z1: 0.4,
          y0: 0.56,
          y1: 0.7,
          u0: 0.04,
          u1: 0.96,
          yb: 0.585,
          yt: 0.692,
          tex: 'mesh',
          tile: 0.06,
          frame: MT.chrome,
          frameR: 0.006,
        })
        const e = K.grid(1, 0, { z1: 0.1, y0: 0.68, y1: 0.73, du: 0.03, dv: 0.025 }).at(0.5, 0.706)
        kit.emblem(c, e.p.x + 0.02, 0.706, 0, 0.04)
        const lw = K.grid(1, 0, { z1: 0.6, y0: 0.31, y1: 0.5, du: 0.03, dv: 0.03 })
        K.skin(lw, grilleMat('mesh'), { u0: lw.uz(-0.48), u1: lw.uz(0.48), yb: 0.34, yt: 0.46, off: 0.021, tile: 0.06, nv: 2 })
        outline(c, lw, { u0: lw.uz(-0.48), u1: lw.uz(0.48), yb: 0.34, yt: 0.46 }, 0.006, LH, 0.022)
      },
      rear: function (c: any, K: any, I: any) {
        ;[1, -1].forEach(function (sd) {
          const yb = function (u: any) {
              return 0.835 + 0.02 * u
            },
            yt = function (u: any) {
              return 0.955 - 0.01 * u
            }
          K.tail(sd, {
            z0: 0.43,
            wrap: 0.2,
            shape: function (u: any) {
              return [yb(u), yt(u)]
            },
            hi: [
              {
                u0: 0.1,
                u1: 0.96,
                yb: function (u: any) {
                  return yt(u) - 0.024
                },
                yt: function (u: any) {
                  return yt(u) - 0.011
                },
              },
              {
                u0: 0.86,
                u1: 0.92,
                yb: function (u: any) {
                  return yb(u) + 0.01
                },
                yt: function (u: any) {
                  return yt(u) - 0.011
                },
              },
            ],
            rev: [
              {
                u0: 0.08,
                u1: 0.3,
                yb: function (u: any) {
                  return yb(u) + 0.01
                },
                yt: function (u: any) {
                  return yb(u) + 0.045
                },
              },
            ],
          })
          K.reflector(sd, I.hw - 0.24, 0.44, 0.12)
        })
        K.lid([
          { y: 0.95, z: -0.41 },
          { y: 0.66, z: -0.41 },
          { y: 0.62, z: -0.38 },
          { y: 0.62, z: 0.38 },
          { y: 0.66, z: 0.41 },
          { y: 0.95, z: 0.41 },
          { top: true, x: -2.28, z: 0.58 },
          { top: true, x: -2.15, z: 0.64 },
          { top: true, x: -1.94, z: 0.62 },
          { top: true, x: -1.92, z: 0.4 },
          { top: true, x: -1.92, z: -0.4 },
          { top: true, x: -1.94, z: -0.62 },
          { top: true, x: -2.15, z: -0.64 },
          { top: true, x: -2.28, z: -0.58 },
          { y: 0.95, z: -0.41 },
        ])
        c.text(phone, 0.22, 0.08, I.S.endX(-1, 0.9) - 0.016, 0.9, 0, '-x', { fg: '#1d3f8a' })
      },
      interior: { rows: 2, col: '#1f2023' },
      hood: { motor: 'gasoline' },
      wheels: [
        [1.3, 0.32, 0.21, wheelOpts('steelg')],
        [-1.4, 0.32, 0.21, wheelOpts('steelg')],
      ],
      warp: { bowF: 0.19, bowR: 0.12, Lf: 0.6 },
      extra: function (c: any, I: any) {
        const S = I.S,
          K = I.K,
          dm = c.paint(door)
        ;[1, -1].forEach(function (sd) {
          crease(
            c,
            I,
            sd,
            [
              [1.8, 0.8],
              [0.6, 0.83],
              [-1.0, 0.87],
              [-2.2, 0.9],
            ],
            { col: white, h: 0.026, u0: 0.01, u1: 0.99 },
          )
        })
        ;[1, -1].forEach(function (sd) {
          /* dark grey doors with "MILITARY POLICE", red stripe at the waist and "190" on the rear fender */
          const Gd: any = sideGrid(S, sd, { x0: 0.715, x1: -1.355, y0: I.by + 0.1, y1: I.gh.belt - 0.01 })
          if (!highwayPolice) K.skin(Gd, dm, { yb: I.by + 0.14, yt: I.gh.belt - 0.035, off: 0.004, nv: 6, u0: 0.003, u1: 0.997 })
          const Gs = sideGrid(S, sd, { x0: 2.0, x1: -2.25, y0: 0.82, y1: 0.9 })
          K.skin(Gs, CM(highwayPolice ? blueP : '#b3201a', { roughness: 0.45, metalness: 0.2 }), {
            yb: 0.845,
            yt: 0.875,
            off: 0.007,
            nv: 1,
            u0: 0.01,
            u1: 0.99,
          })
          if (highwayPolice) {
            /* wide blue stripe and a yellow thread just below the waist */
            const Gs2 = sideGrid(S, sd, { x0: 2.0, x1: -2.25, y0: 0.74, y1: 0.84 })
            K.skin(Gs2, CM(blueP, { roughness: 0.45, metalness: 0.2 }), { yb: 0.775, yt: 0.83, off: 0.007, nv: 1, u0: 0.01, u1: 0.99 })
            K.skin(Gs2, CM(yellowP, { roughness: 0.45, metalness: 0.2 }), { yb: 0.746, yt: 0.77, off: 0.007, nv: 1, u0: 0.01, u1: 0.99 })
          }
          const f = sd > 0 ? '+z' : '-z',
            pt = Gd.at(Gd.ux ? 0.5 : 0.5, 0.62).p
          if (highwayPolice)
            c.text(trl('texts.federal_highway_police'), 1.9, 0.13, -0.32, 0.6, sd * (Math.abs(pt.z) + 0.012), f, {
              fg: blueP,
              w: 1024,
              h: 70,
              size: 0.86,
            })
          else
            c.text(trl('texts.state_police'), 1.5, 0.15, -0.32, 0.64, sd * (Math.abs(pt.z) + 0.012), f, {
              fg: '#f4f2ea',
              w: 1024,
              h: 102,
              size: 0.78,
            })
          const q = S.hit(new V3(-1.95, 0.66, sd * (I.hw + 1)), new V3(0, 0, -sd), 'M')
          c.text(phone, 0.34, 0.15, -1.95, highwayPolice ? 0.6 : 0.66, sd * ((q ? Math.abs(q.p.z) : I.hw) + 0.012), f, {
            fg: '#1d3f8a',
            size: 0.8,
          })
          c.roundBox(0.06, 0.1, 0.06, 0.02, MT.chrome, I.gh.fb - 0.12, I.gh.belt + 0.04, sd * 0.86)
        })
        const top = I.gh.roof + 0.05
        /* light bar (dents with the roof and counts toward the rest height on rollover) */
        const beacon = [
          c.roundBox(0.32, 0.06, 1.24, 0.03, MT.trim, -0.42, top + 0.03, 0, { def: true }),
          c.roundBox(0.26, 0.09, 0.56, 0.04, MT.tail, -0.42, top + 0.1, 0.32, { taper: { sx: 0.8, sz: 0.94 }, def: true }),
          c.roundBox(0.26, 0.09, 0.56, 0.04, MT.blue, -0.42, top + 0.1, -0.32, { taper: { sx: 0.8, sz: 0.94 }, def: true }),
          c.roundBox(0.2, 0.06, 0.04, 0.02, MT.head, -0.42 + 0.06, top + 0.1, 0),
        ]
        /* the light bar belongs to the roof: goes off from a dent (broken lens) and goes away when the roof is torn off */
        c.zone('roof', null, null, beacon, {
          onBand: function (c2: any, b: any) {
            if (b >= 2) {
              beacon[1].material = CM('#4a1512', { roughness: 0.5 })
              beacon[2].material = CM('#15214a', { roughness: 0.5 })
              beacon[3].material = MT.trim
            }
          },
        })
        c.meta.top = top + 0.15
        c.meta.roof.y = Math.max(c.meta.roof.y, top + 0.15)
        /* push bumper (push bar) */
        const fx = I.fxB + 0.12,
          push = []
        ;[0.42, -0.42].forEach(function (z) {
          push.push(
            c.tube(
              [
                [fx - 0.12, 0.34, z],
                [fx, 0.38, z],
                [fx + 0.02, 0.7, z],
                [fx - 0.07, 0.8, z],
              ],
              0.028,
              MT.trim,
            ),
          )
        })
        push.push(c.rod(new V3(fx + 0.01, 0.52, -0.5), new V3(fx + 0.01, 0.52, 0.5), 0.028, MT.trim))
        push.push(c.rod(new V3(fx + 0.02, 0.68, -0.45), new V3(fx + 0.02, 0.68, 0.45), 0.024, MT.trim))
        push.push(c.roundBox(0.04, 0.12, 0.7, 0.02, RUBBER, fx + 0.03, 0.6, 0))
        /* the push bar belongs to the front bumper (it bends, hangs and falls with it) and widens the zone box */
        c.zone('bumper_front', trl('labels.bumper_and_bush_guard'), [fx - 0.55, fx + 0.3, -0.02, 0.86, -I.hw - 0.2, I.hw + 0.2], push)
        /* grille separating the back seat */
        for (let z = -0.7; z <= 0.71; z += 0.1) c.rod(new V3(-0.6, 0.66, z), new V3(-0.6, 1.33, z), 0.007, MT.steel)
        c.rod(new V3(-0.6, 1.0, -0.72), new V3(-0.6, 1.0, 0.72), 0.012, MT.steel)
        c.cylinder(0.08, 0.06, 0.1, MT.trim, I.gh.fb - 0.35, I.gh.belt + 0.08, -0.86, 'x')
        c.cylinder(0.065, 0.065, 0.01, MT.head, I.gh.fb - 0.3, I.gh.belt + 0.08, -0.86, 'x')
      },
    })
    c.meta.armor = armorPlus(function (c: any) {
      roofLamp(c, c.meta.roof.x1, c.meta.roof.y + 0.22, 0.4)
      roofLamp(c, c.meta.roof.x1, c.meta.roof.y + 0.22, -0.4)
    })
  }
  fx.register(
    {
      key: 'police_sedan',
      group: 'cars',
      name: trl('vehicles.police_sedan.name'),
      inspired: trl('vehicles.police_sedan.inspired'),
      category: trl('vehicles.police_sedan.category'),
      fuel: 'flex',
      description: trl('vehicles.police_sedan.description'),
      mass: 1400,
      noise: 70,
      seats: trl('vehicles.police_sedan.seats'),
      capacity: trl('vehicles.police_sedan.capacity'),
      efficiency: trl('vehicles.police_sedan.efficiency'),
      range: trl('vehicles.police_sedan.range'),
      maxSpeed: 205,
      skill: trl('vehicles.police_sedan.skill'),
      hood: true,
    },
    function (c) {
      patrol(c, false)
    },
  )
  fx.register(
    {
      key: 'highway_police_sedan',
      group: 'cars',
      name: trl('vehicles.highway_police_sedan.name'),
      inspired: trl('vehicles.highway_police_sedan.inspired'),
      category: trl('vehicles.highway_police_sedan.category'),
      fuel: 'flex',
      description: trl('vehicles.highway_police_sedan.description'),
      mass: 1400,
      noise: 70,
      seats: trl('vehicles.highway_police_sedan.seats'),
      capacity: trl('vehicles.highway_police_sedan.capacity'),
      efficiency: trl('vehicles.highway_police_sedan.efficiency'),
      range: trl('vehicles.highway_police_sedan.range'),
      maxSpeed: 205,
      skill: trl('vehicles.highway_police_sedan.skill'),
      hood: true,
    },
    function (c) {
      patrol(c, true)
    },
  )

  /* ================= motorcycles: common parts ================= */
  function fork(c: any, top: any, axle: any, zg: any, r: any, up: any, low: any, o?: any) {
    o = o || {}
    ;[1, -1].forEach(function (s) {
      const a = new V3(top[0], top[1], s * zg),
        b = new V3(axle[0], axle[1], s * zg),
        mid = a.clone().lerp(b, o.split || 0.5)
      c.rod(a, mid, r, up, { seg: 12 })
      c.rod(mid.clone().lerp(a, 0.06), b, r * (o.lowK || 1.35), low, { seg: 12 })
      if (o.gaiter) c.rod(mid.clone().lerp(a, 0.25), mid.clone().lerp(b, 0.1), r * 1.6, RUBBER, { seg: 10 })
    })
    c.roundBox(0.1, 0.035, zg * 2 + 0.08, 0.012, o.clamp || MT.trim, top[0] - 0.01, top[1] - 0.02, 0, {
      rot: [0, 0, Math.atan2(axle[0] - top[0], top[1] - axle[1])],
    })
  }
  function handlebar(c: any, x: any, y: any, half: any, o: any) {
    o = o || {}
    const mat = o.mat || MT.trim,
      rise = o.rise || 0.03,
      back = o.back || 0.06,
      n0 = c.vehicle.children.length
    c.deform.push(
      c.tube(
        [
          [x - back, y + rise, -half],
          [x - back * 0.3, y + rise * 0.6, -half * 0.55],
          [x, y, 0],
          [x - back * 0.3, y + rise * 0.6, half * 0.55],
          [x - back, y + rise, half],
        ],
        o.r || 0.012,
        mat,
        { seg: 30 },
      ),
    )
    ;[1, -1].forEach(function (s) {
      c.deform.push(c.cylinder(0.019, 0.019, 0.13, RUBBER, x - back, y + rise, s * (half - 0.05), 'z'))
      c.roundBox(0.13, 0.012, 0.02, 0.005, MT.steel, x - back + 0.05, y + rise - 0.01, s * (half - 0.1), { rot: [0, s * 0.35, 0] })
      c.roundBox(0.05, 0.045, 0.06, 0.012, MT.trim, x - back + 0.01, y + rise, s * (half - 0.17))
      if (o.mirrors !== false) {
        const mz = s * (half - 0.14),
          stalk = new V3(x - back + 0.02, y + rise + (o.stalk || 0.2), mz + s * 0.06)
        c.rod(new V3(x - back + 0.01, y + rise + 0.02, mz), stalk, 0.006, MT.trim, { seg: 6 })
        c.roundBox(0.03, 0.07, 0.12, 0.025, MT.trim, stalk.x, stalk.y + 0.02, stalk.z + s * 0.02, { def: true })
        c.roundBox(0.006, 0.055, 0.1, 0.01, MT.chrome, stalk.x - 0.017, stalk.y + 0.02, stalk.z + s * 0.02)
      }
      if (o.guards)
        c.deform.push(
          c.tube(
            [
              [x - back + 0.02, y + rise, s * (half - 0.2)],
              [x + 0.08, y + rise + 0.01, s * (half - 0.08)],
              [x - back + 0.02, y + rise - 0.01, s * (half + 0.01)],
            ],
            0.02,
            o.guards,
            { seg: 16 },
          ),
        )
    })
    return c.vehicle.children.slice(n0)
  }
  function blinker(c: any, x: any, y: any, z: any, front: any) {
    c.rod(new V3(x, y, z * 0.55), new V3(x, y, z), 0.008, MT.trim, { seg: 6 })
    const b = c.sphere(0.026, MT.amber, x + (front ? 0.012 : -0.012), y, z, 1.5, 0.9, 0.9)
    b.castShadow = false
  }
  function plateMoto(c: any, x: any, y: any) {
    c.roundBox(0.02, 0.15, 0.2, 0.008, MT.trim, x + 0.012, y, 0)
    c.text(kit.config.plate.slice(0, 5), 0.2, 0.135, x, y, 0, '-x', {
      w: 300,
      h: 220,
      bg: '#f2f2ee',
      band: '#1f4fa3',
      fg: '#151515',
      size: 0.42,
      font: "'IBM Plex Mono', monospace",
    })
  }
  function singleEngine(c: any, o: any) {
    const x = o.x,
      y = o.y,
      tilt = o.tilt || 0.3,
      fin = o.fin || FIN
    c.roundBox(0.38, 0.26, 0.24, 0.07, ENG, x - 0.02, y, 0, { def: true })
    c.sphere(0.11, ENG, x - 0.04, y - 0.01, 0.12, 1.1, 1.0, 0.36)
    c.sphere(0.1, ENGD, x - 0.08, y + 0.0, -0.12, 1.0, 1.0, 0.36)
    const cx = x + 0.1,
      cy = y + 0.13
    for (let f = 0; f < 7; f++) {
      const t = f / 6,
        px = cx + Math.sin(tilt) * t * 0.22,
        py = cy + Math.cos(tilt) * t * 0.22
      c.roundBox(0.2 - t * 0.02, 0.014, 0.22 - t * 0.02, 0.006, fin, px, py, 0, { rot: [0, 0, -tilt] })
    }
    c.roundBox(0.12, 0.2, 0.12, 0.03, ENG, cx + Math.sin(tilt) * 0.11, cy + Math.cos(tilt) * 0.11, 0, { rot: [0, 0, -tilt] })
    c.roundBox(0.16, 0.06, 0.18, 0.025, ENG, cx + Math.sin(tilt) * 0.26, cy + Math.cos(tilt) * 0.26, 0, { rot: [0, 0, -tilt] })
    return { exh: new V3(cx + Math.sin(tilt) * 0.2 + 0.06, cy + Math.cos(tilt) * 0.1, 0.06) }
  }
  /* lit LED thread over the lens of a core headlight (an internal part: it goes off if the headlight breaks) */
  function drlOn(L: any, w: any, h: any, y: any, d: any) {
    const m = new THREE.Mesh(G.roundedBox(0.01, h, w, Math.min(0.005, h * 0.4)), DRL)
    m.position.set((d || 0.06) / 2 + 0.004, y || 0, 0)
    m.castShadow = false
    L.group.add(m)
    L.inner.push(m)
    return m
  }
  /* rotates a set of child meshes of c.g around a point (bent handlebar, loose fender) */
  function bendSet(list: any, piv: any, axis: any, ang: any) {
    const q = new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), ang)
    list.forEach(function (m: any) {
      if (!m.parent) return
      m.position.sub(piv).applyQuaternion(q).add(piv)
      m.quaternion.premultiply(q)
    })
  }
  /* jerry can lying down (fixed with straps) */
  function jerryFlat(c: any, x: any, y: any, z: any, col: any) {
    c.roundBox(0.4, 0.15, 0.28, 0.04, CM(col, { roughness: 0.5 }), x, y, z, { def: true })
    c.cylinder(0.022, 0.022, 0.05, MT.trim, x + 0.18, y + 0.06, z + 0.1)
    ;[-0.1, 0.1].forEach(function (dx) {
      c.roundBox(0.03, 0.155, 0.29, 0.005, CM('#1b1c1e'), x + dx, y + 0.002, z)
    })
  }
  function bikeMeta(c: any, o: any) {
    Object.assign(c.meta, { kind: 'bike', clearance: 0.25, bodyHeight: 0.6, belt: 0.88 }, o)
  }

  /* ================= Bicycle (Monark Barra Circular type) ================= */
  /* Reference: Monark Barra Circular 26-inch (monark.com.br: 26-inch, 19.5 to 20 kg; measurements from memory)
     Real measurements: length about 1.82 · handlebar width about 0.62 · handlebar height about 1.05 · wheelbase about 1.10 · tyre 26 x 1.1/2 (diameter about 0.68)
     · saddle height about 0.92 · bottom bracket about 0.29 above the ground.
     Signature traits:
     front: round chrome headlight on the fork; wide touring handlebar, curved back, with rubber grips.
     side: the "circular bar": two parallel tubes that arc down from the head tube to the bottom bracket;
     painted steel frame with a straight top bar; chrome fenders; chain guard; spring saddle.
     rear: chrome rod rack over the wheel; red reflector; coaster brake (no gears).
     from above: thin frame, wide "C" handlebar swept back. */
  fx.register(
    {
      key: 'bicycle',
      group: 'motorcycles',
      name: trl('vehicles.bicycle.name'),
      inspired: trl('vehicles.bicycle.inspired'),
      article: trl('vehicles.bicycle.article'),
      category: trl('vehicles.bicycle.category'),
      fuel: 'none',
      description: trl('vehicles.bicycle.description'),
      mass: 18,
      noise: 5,
      seats: trl('vehicles.bicycle.seats'),
      capacity: trl('vehicles.bicycle.capacity'),
      efficiency: trl('vehicles.bicycle.efficiency'),
      range: trl('vehicles.bicycle.range'),
      maxSpeed: 25,
      skill: trl('vehicles.bicycle.skill'),
      hood: false,
    },
    function (c) {
      const col = CM(kit.paintColor('#6d1f1c', c.state), { roughness: 0.4, metalness: 0.35 }),
        r = 0.34,
        tr = 0.022
      kit.spokedWheel(c, -0.53, r, tr, { spokes: 36 })
      kit.spokedWheel(c, 0.56, r, tr, { spokes: 36 })
      const BB = [-0.02, 0.3],
        SC = [-0.2, 0.84],
        HT = [0.38, 0.88],
        HB = [0.41, 0.72]
      c.tube(
        [
          [BB[0], BB[1], 0],
          [SC[0], SC[1], 0],
        ],
        0.018,
        col,
        { seg: 8 },
      )
      c.tube(
        [
          [SC[0], SC[1] - 0.04, 0],
          [0.08, 0.85, 0],
          [HT[0], HT[1] - 0.02, 0],
        ],
        0.017,
        col,
      )
      /* circular double bar: two parallel tubes in a single arc from the head tube to the bottom bracket */
      ;[0.024, -0.024].forEach(function (z) {
        const P0 = [HT[0] - 0.01, HT[1] - 0.05],
          C = [0.0, 0.76],
          P1 = [BB[0] + 0.06, BB[1] + 0.05],
          pts = []
        for (let k = 0; k <= 8; k++) {
          const t = k / 8,
            a = (1 - t) * (1 - t),
            b2 = 2 * (1 - t) * t,
            d = t * t
          pts.push([a * P0[0] + b2 * C[0] + d * P1[0], a * P0[1] + b2 * C[1] + d * P1[1], z])
        }
        c.tube(pts, 0.014, col, { seg: 48 })
      })
      c.tube(
        [
          [HB[0], HB[1], 0],
          [BB[0], BB[1], 0],
        ],
        0.018,
        col,
        { seg: 8 },
      )
      c.cylinder(0.024, 0.024, 0.2, col, 0.395, 0.8, 0).rotation.z = -0.3
      ;[1, -1].forEach(function (s) {
        c.tube(
          [
            [BB[0], BB[1], s * 0.03],
            [-0.53, r, s * 0.06],
          ],
          0.011,
          col,
          { seg: 6 },
        )
        c.tube(
          [
            [SC[0], SC[1] - 0.04, s * 0.02],
            [-0.53, r, s * 0.06],
          ],
          0.011,
          col,
          { seg: 6 },
        )
        c.tube(
          [
            [HB[0], HB[1], s * 0.04],
            [0.5, 0.48, s * 0.05],
            [0.56, r, s * 0.05],
          ],
          0.012,
          MT.chrome,
          { seg: 10 },
        )
      })
      c.tube(
        [
          [SC[0], SC[1], 0],
          [-0.21, 0.92, 0],
        ],
        0.012,
        MT.chrome,
        { seg: 4 },
      )
      body(
        c,
        [
          [-0.06, 0.965, 0.93, 0.05],
          [-0.14, 0.975, 0.92, 0.12],
          [-0.26, 0.985, 0.92, 0.22],
          [-0.33, 0.98, 0.93, 0.2],
        ],
        MT.leather,
        { p: 2.2 },
      )
      ;[0.06, -0.06].forEach(function (z) {
        const sp = c.add(new THREE.TorusGeometry(0.02, 0.006, 6, 12), MT.chrome, -0.3, 0.9, z)
        sp.rotation.x = PI / 2
      })
      c.tube(
        [
          [0.38, 0.88, 0],
          [0.37, 1.0, 0],
        ],
        0.012,
        MT.chrome,
        { seg: 4 },
      )
      c.deform.push(
        c.tube(
          [
            [0.2, 1.0, -0.3],
            [0.33, 1.04, -0.16],
            [0.37, 1.01, 0],
            [0.33, 1.04, 0.16],
            [0.2, 1.0, 0.3],
          ],
          0.011,
          MT.chrome,
        ),
      )
      ;[0.3, -0.3].forEach(function (z) {
        c.deform.push(c.cylinder(0.018, 0.018, 0.1, MT.seat, 0.2, 1.0, z, 'z'))
      })
      c.add(new THREE.TorusGeometry(0.1, 0.008, 6, 30), MT.steel, BB[0], BB[1], 0.07)
      c.roundBox(0.36, 0.1, 0.012, 0.03, col, BB[0] - 0.24, BB[1] + 0.03, 0.09, { rot: [0, 0, 0.06] })
      c.roundBox(0.16, 0.025, 0.012, 0.006, MT.steel, BB[0] + 0.07, BB[1] - 0.04, 0.08, { rot: [0, 0, -0.5] })
      c.roundBox(0.16, 0.025, 0.012, 0.006, MT.steel, BB[0] - 0.07, BB[1] + 0.04, -0.08, { rot: [0, 0, -0.5] })
      c.roundBox(0.1, 0.02, 0.08, 0.008, MT.trim, BB[0] + 0.14, BB[1] - 0.08, 0.11)
      c.roundBox(0.1, 0.02, 0.08, 0.008, MT.trim, BB[0] - 0.14, BB[1] + 0.08, -0.11)
      ;[-0.53, 0.56].forEach(function (wx) {
        const fd = c.add(fenderGeo(wx, r, r + 0.02, wx < 0 ? 0.25 : 0.05, wx < 0 ? 2.6 : 2.2, 0.06, 0.02, 0), MT.chrome, 0, 0, 0)
        c.deform.push(fd)
      })
      c.roundBox(0.36, 0.015, 0.14, 0.006, MT.chrome, -0.62, 0.74, 0)
      for (let b = 0; b < 4; b++) c.roundBox(0.34, 0.01, 0.01, 0.004, MT.chrome, -0.62, 0.745, -0.06 + b * 0.04)
      ;[0.06, -0.06].forEach(function (z) {
        c.tube(
          [
            [-0.45, 0.74, z],
            [-0.53, r, z],
          ],
          0.008,
          MT.chrome,
          { seg: 4 },
        )
      })
      c.cylinder(0.03, 0.03, 0.03, MT.chrome, 0.32, 1.04, 0.14, 'z')
      kit.headlight(c, { style: 'round', x: 0.47, y: 0.9, z: 0, w: 0.08, h: 0.08, d: 0.06, side: 1, label: trl('labels.headlight') })
      kit.taillight(c, { style: 'round2', x: -0.8, y: 0.72, z: 0, w: 0.09, h: 0.045, side: 1, label: trl('labels.rear_reflector') })
      bikeMeta(c, {
        length: 1.75,
        width: 0.62,
        front: 0.92,
        rear: -0.88,
        clearance: 0.3,
        top: 1.05,
        belt: 0.8,
        color: '#6d1f1c',
        rack: 0.75,
      })
      /* modified: crate tied on the rack (resting), small can inside, basket at the front */
      c.meta.armor = function (c: any, _Z: any) {
        const ry = 0.755
        c.roundBox(0.34, 0.22, 0.28, 0.02, MT.wood, -0.62, ry + 0.115, 0, { def: true })
        for (let k = 0; k < 3; k++) c.roundBox(0.35, 0.012, 0.285, 0.004, CM('#4a3420'), -0.62, ry + 0.04 + k * 0.07, 0)
        c.roundBox(0.16, 0.2, 0.1, 0.02, CM('#8e2a20', { roughness: 0.5 }), -0.66, ry + 0.2, 0.04)
        c.cylinder(0.015, 0.015, 0.04, MT.trim, -0.6, ry + 0.31, 0.04)
        ;[-0.7, -0.54].forEach(function (x) {
          c.roundBox(0.02, 0.235, 0.29, 0.004, CM('#1b1c1e'), x, ry + 0.115, 0)
        })
        c.roundBox(0.22, 0.16, 0.3, 0.02, CM('#4a3d2a'), 0.5, 0.86, 0)
        c.rod(new V3(0.39, 0.86, 0), new V3(0.42, 0.98, 0), 0.008, MT.steel)
      }
    },
  )

  /* ================= Scooter (PCX 160 type) ================= */
  /* Reference: Honda PCX 160 2023+ (Honda sheet, via motoragora.com.br)
     Real measurements: length 1.935 · width 0.742 · height 1.108 (without mirror) · wheelbase 1.313 · seat height 0.764
     · clearance 0.134 · tyres 110/70-14 (diameter 0.510) and 130/70-13 (diameter 0.512) · overhangs about 0.36 / 0.26 (from memory).
     Signature traits:
     front: tall narrow shield with a "V" LED headlight (two thin lenses rising outward); nose with the indicator in the centre;
     closed handlebar fairing with a digital panel and a short windshield.
     side: tall central tunnel between the feet (the tank sits in it), footboards at the sides; long two-level seat;
     long tapered rear fairing; swingarm engine on the left, large exhaust with a guard on the right; small alloy wheels.
     rear: pointed tail with a thin "X" LED taillight, integrated grab handle, low plate.
     from above: teardrop body, wide seat at the back, narrow shield at the front. */
  fx.register(
    {
      key: 'scooter',
      group: 'motorcycles',
      name: trl('vehicles.scooter.name'),
      inspired: trl('vehicles.scooter.inspired'),
      category: trl('vehicles.scooter.category'),
      fuel: 'gasoline',
      description: trl('vehicles.scooter.description'),
      mass: 132,
      noise: 50,
      seats: trl('vehicles.scooter.seats'),
      capacity: trl('vehicles.scooter.capacity'),
      efficiency: trl('vehicles.scooter.efficiency'),
      range: trl('vehicles.scooter.range'),
      maxSpeed: 115,
      skill: trl('vehicles.scooter.skill'),
      hood: false,
    },
    function (c) {
      const hex = '#2f4d73',
        col = c.paint(hex),
        blk = CM('#151618', { roughness: 0.55 }),
        satin = CM('#3b3e42', { roughness: 0.5, metalness: 0.3 })
      const fr = 0.255
      kit.spokedWheel(c, 0.66, fr, 0.055, { cast: true, disc: true, label: trl('labels.front_tire') })
      kit.spokedWheel(c, -0.65, fr, 0.065, { cast: true, label: trl('labels.rear_tire') })
      /* front fairing: leg shield that rises up to the nose of the V headlight */
      body(
        c,
        [
          [0.34, 0.38, 0.2, 0.34, 2.6],
          [0.46, 0.47, 0.22, 0.4, 2.6],
          [0.58, 0.64, 0.26, 0.46, 2.6],
          [0.7, 0.76, 0.3, 0.46, 2.6],
          [0.82, 0.81, 0.36, 0.4, 2.5],
          [0.94, 0.74, 0.42, 0.32, 2.4],
          [1.03, 0.62, 0.48, 0.2, 2.2],
          [1.06, 0.56, 0.52, 0.08, 2],
        ],
        col,
        { axis: 'y' },
      )
      body(
        c,
        [
          [0.36, 0.3, 0.17, 0.3, 2.6],
          [0.6, 0.34, 0.2, 0.38, 2.6],
          [0.84, 0.38, 0.28, 0.36, 2.6],
          [0.98, 0.42, 0.34, 0.26, 2.4],
        ],
        satin,
        { axis: 'y' },
      )
      /* floor: footboards at the sides and the tall central tunnel (the tank sits inside it) */
      c.roundBox(0.56, 0.06, 0.38, 0.03, blk, 0.0, 0.37, 0, { def: true })
      body(
        c,
        [
          [0.36, 0.5, 0.4, 0.16, 2.6],
          [0.24, 0.56, 0.4, 0.2, 2.8],
          [0.04, 0.6, 0.4, 0.21, 2.8],
          [-0.12, 0.66, 0.4, 0.2, 2.6],
        ],
        col,
      )
      c.roundBox(0.3, 0.012, 0.06, 0.004, satin, 0.12, 0.6, 0.0)
      c.roundBox(0.54, 0.012, 0.34, 0.005, CM('#2a2b2d', { roughness: 0.95 }), 0.0, 0.405, 0)
      /* rear fairing and seat */
      body(
        c,
        [
          [0.2, 0.57, 0.42, 0.2, 2.6],
          [0.04, 0.695, 0.36, 0.34, 2.8],
          [-0.3, 0.735, 0.36, 0.38, 2.8],
          [-0.62, 0.765, 0.46, 0.34, 2.6],
          [-0.84, 0.785, 0.6, 0.24, 2.4],
          [-0.95, 0.765, 0.68, 0.1, 2],
        ],
        col,
      )
      body(
        c,
        [
          [0.14, 0.765, 0.685, 0.14],
          [0.02, 0.765, 0.675, 0.3],
          [-0.28, 0.765, 0.685, 0.34],
          [-0.42, 0.815, 0.705, 0.32],
          [-0.74, 0.835, 0.725, 0.28],
          [-0.86, 0.825, 0.745, 0.16],
        ],
        CM('#1b1c1e', { roughness: 0.75 }),
        { p: 3 },
      )
      c.tube(
        [
          [-0.62, 0.795, -0.18],
          [-0.86, 0.805, -0.13],
          [-0.92, 0.815, 0],
          [-0.86, 0.805, 0.13],
          [-0.62, 0.795, 0.18],
        ],
        0.016,
        satin,
        { seg: 24 },
      )
      kit.taillight(c, { style: 'bar', x: -0.945, y: 0.74, z: 0, w: 0.22, h: 0.05, d: 0.05, side: 1, label: trl('labels.taillight') })
      c.roundBox(0.2, 0.05, 0.12, 0.02, blk, -0.885, 0.61, 0, { rot: [0, 0, 0.7] })
      plateMoto(c, -0.955, 0.53)
      ;[1, -1].forEach(function (s) {
        blinker(c, -0.91, 0.71, s * 0.14, false)
        blinker(c, 0.74, 0.78, s * 0.22, true)
      })
      /* swingarm engine (left side) and exhaust (right) */
      c.roundBox(0.62, 0.17, 0.12, 0.05, satin, -0.38, 0.3, -0.13, { def: true })
      c.roundBox(0.42, 0.13, 0.03, 0.04, ENG, -0.4, 0.3, -0.2)
      c.roundBox(0.28, 0.24, 0.24, 0.06, ENGD, -0.06, 0.32, 0.0)
      c.cylinder(0.07, 0.06, 0.42, EXH, -0.62, 0.36, 0.17, 'x')
      c.roundBox(0.36, 0.1, 0.04, 0.03, HEAT, -0.62, 0.38, 0.22)
      c.tube(
        [
          [-0.05, 0.22, 0.05],
          [-0.25, 0.2, 0.15],
          [-0.42, 0.33, 0.17],
        ],
        0.022,
        EXH,
      )
      ;[1, -1].forEach(function (s) {
        c.rod(new V3(-0.62, 0.36, s * 0.14), new V3(-0.5, 0.72, s * 0.15), 0.02, MT.chrome)
        c.rod(new V3(-0.6, 0.44, s * 0.14), new V3(-0.53, 0.62, s * 0.15), 0.032, CM('#a32620', { roughness: 0.5 }))
      })
      /* fork, fender, handlebar, dashboard */
      fork(c, [0.56, 0.92], [0.66, fr], 0.08, 0.02, MT.trim, satin)
      c.add(fenderGeo(0.66, fr, fr + 0.03, 0.15, 2.0, 0.12, 0.022, 0), col, 0, 0, 0)
      /* closed handlebar fairing: covers the whole handlebar, only the grips stay outside */
      body(
        c,
        [
          [0.37, 1.05, 0.95, 0.2, 2.6],
          [0.44, 1.075, 0.92, 0.5, 3.0],
          [0.53, 1.07, 0.9, 0.54, 3.0],
          [0.63, 1.02, 0.88, 0.42, 2.8],
          [0.72, 0.95, 0.9, 0.16],
        ],
        col,
      )
      /* dark digital panel with the display lit only in the middle */
      c.roundBox(0.16, 0.02, 0.2, 0.01, CM('#121518', { roughness: 0.25, metalness: 0.3 }), 0.44, 1.08, 0, { rot: [0, 0, 0.35] })
      c.roundBox(0.08, 0.022, 0.1, 0.006, MT.gauge, 0.445, 1.082, 0, { rot: [0, 0, 0.35] })
      handlebar(c, 0.5, 1.03, 0.36, { rise: 0.0, back: 0.04, stalk: 0.14 })
      /* V headlight on the shield: two lenses with a reflector, projector and lit LED on the edges; central black trim on the shield */
      ;[1, -1].forEach(function (sd) {
        const L = lamp(c, {
          style: 'slim',
          x: 0.875,
          y: 0.75,
          z: sd * 0.085,
          w: 0.2,
          h: 0.065,
          d: 0.06,
          side: sd,
          yaw: 0.28,
          roll: sd * 0.42,
          label: sd > 0 ? trl('labels.right_headlight') : trl('labels.left_headlight'),
        })
        drlOn(L, 0.19, 0.014, 0.022, 0.06)
        drlOn(L, 0.16, 0.008, -0.026, 0.06)
      })
      body(
        c,
        [
          [0.62, 0.7, 0.3, 0.05, 2.2],
          [0.78, 0.74, 0.34, 0.06, 2.2],
          [0.92, 0.68, 0.42, 0.055, 2.2],
          [1.0, 0.6, 0.47, 0.04, 2.0],
        ],
        blk,
        { axis: 'y', def: false },
      )
      c.roundBox(0.02, 0.018, 0.05, 0.006, MT.amber, 0.962, 0.565, 0)
      c.rod(new V3(0.0, 0.26, -0.12), new V3(-0.1, 0.06, -0.24), 0.012, MT.trim)
      c.part('engine', trl('labels.engine_and_transmission'), null, new V3(-0.3, 0.32, -0.1), 0.8)
      c.part('fuel_tank', trl('labels.tank_under_the_floor'), null, new V3(0.05, 0.3, 0), 0.6)
      c.part('fairing', trl('labels.front_fairing'), null, new V3(0.85, 0.55, 0), 0.6)
      bikeMeta(c, {
        length: 1.94,
        width: 0.74,
        front: 1.08,
        rear: -1.06,
        clearance: 0.14,
        bodyHeight: 0.62,
        top: 1.11,
        belt: 0.8,
        color: hex,
      })
      c.meta.armor = function (c: any) {
        c.roundBox(0.42, 0.38, 0.42, 0.04, CM('#a8241c', { roughness: 0.6 }), -0.7, 1.05, 0)
        c.text('ENTREGAS', 0.36, 0.08, -0.7, 1.07, 0.215, '+z', { fg: '#f2efe6' })
        c.text('ENTREGAS', 0.36, 0.08, -0.7, 1.07, -0.215, '-z', { fg: '#f2efe6' })
        c.roundBox(0.46, 0.03, 0.3, 0.01, kit.steelMaterial, -0.7, 0.85, 0)
        ;[1, -1].forEach(function (s) {
          c.tube(
            [
              [0.7, 0.9, s * 0.2],
              [0.85, 0.55, s * 0.28],
              [0.55, 0.32, s * 0.26],
              [0.2, 0.3, s * 0.22],
            ],
            0.018,
            kit.steelMaterial,
          )
        })
        c.rod(new V3(0.6, 1.08, -0.3), new V3(0.95, 1.5, -0.3), 0.008, MT.trim)
        kit.jerryCan(c, 0.15, 0.6, 0, '#8e2a20')
      }
    },
  )

  /* ================= Commuter motorcycle (CG 160 Titan type) ================= */
  /* Reference: Honda CG 160 Titan 2016+ (Honda sheet, via motoragora.com.br)
     Real measurements: length 2.032 · width 0.745 · height 1.087 (without mirror) · wheelbase 1.315 · seat height 0.790
     · clearance 0.170 · tyres 80/100-18 (diameter 0.617) and 90/90-18 (diameter 0.619) · overhangs about 0.35 / 0.37 (from memory).
     Signature traits:
     front: multi-reflector trapezoid headlight in a short painted fairing; indicators on stalks; short painted front fender.
     side: tall tank with black side fins and the name; black side cover under the seat with "160"; silver single-cylinder engine
     with inclined fins; low chrome exhaust with a black guard rising to the rear; alloy wheels with a disc at the front.
     rear: thin tail that rises, taillight recessed in the tip, aluminium grab handle, plate with indicators.
     from above: wide tank tapering into the seat; long straight seat to the tail. */
  fx.register(
    {
      key: 'commuter_motorcycle',
      group: 'motorcycles',
      name: trl('vehicles.commuter_motorcycle.name'),
      inspired: trl('vehicles.commuter_motorcycle.inspired'),
      article: trl('vehicles.commuter_motorcycle.article'),
      category: trl('vehicles.commuter_motorcycle.category'),
      fuel: 'flex',
      description: trl('vehicles.commuter_motorcycle.description'),
      mass: 122,
      noise: 70,
      seats: trl('vehicles.commuter_motorcycle.seats'),
      capacity: trl('vehicles.commuter_motorcycle.capacity'),
      efficiency: trl('vehicles.commuter_motorcycle.efficiency'),
      range: trl('vehicles.commuter_motorcycle.range'),
      maxSpeed: 115,
      skill: trl('vehicles.commuter_motorcycle.skill'),
      hood: false,
    },
    function (c) {
      const hex = '#a4241d',
        col = c.paint(hex),
        blk = CM('#17181a', { roughness: 0.55 }),
        gray = CM('#4a4c4f', { metalness: 0.4, roughness: 0.45 })
      kit.spokedWheel(c, 0.66, 0.31, 0.045, { cast: true, disc: true, label: trl('labels.front_tire') })
      kit.spokedWheel(c, -0.66, 0.31, 0.05, { cast: true, label: trl('labels.rear_tire') })
      /* frame */
      c.tube(
        [
          [0.36, 0.93, 0],
          [0.25, 0.66, 0],
          [0.12, 0.34, 0],
          [-0.16, 0.26, 0],
          [-0.2, 0.5, 0],
          [-0.14, 0.7, 0],
        ],
        0.02,
        blk,
        { seg: 40 },
      )
      c.tube(
        [
          [0.36, 0.93, 0],
          [0.1, 0.8, 0],
          [-0.14, 0.72, 0],
          [-0.5, 0.74, 0],
          [-0.86, 0.78, 0],
        ],
        0.019,
        blk,
        { seg: 40 },
      )
      c.cylinder(0.035, 0.035, 0.16, blk, 0.37, 0.91, 0).rotation.z = -0.42
      const eng = singleEngine(c, { x: 0.02, y: 0.42, tilt: 0.32 })
      /* tank and fins */
      body(
        c,
        [
          [0.38, 0.93, 0.77, 0.14, 2.2],
          [0.3, 0.965, 0.71, 0.3, 2.4],
          [0.14, 0.96, 0.69, 0.34, 2.4],
          [0.0, 0.92, 0.7, 0.3, 2.4],
          [-0.08, 0.86, 0.73, 0.2, 2.2],
          [-0.11, 0.83, 0.77, 0.08, 2],
        ],
        col,
      )
      ;[1, -1].forEach(function (s) {
        body(
          c,
          [
            [0.4, 0.88, 0.78, 0.03, 2, s * 0.13],
            [0.3, 0.87, 0.6, 0.04, 2, s * 0.17],
            [0.18, 0.81, 0.58, 0.03, 2, s * 0.17],
            [0.12, 0.75, 0.64, 0.02, 2, s * 0.15],
          ],
          blk,
          { p: 2 },
        )
        c.text(trl('texts.titan_160'), 0.2, 0.05, 0.16, 0.87, s * 0.176, s > 0 ? '+z' : '-z', { fg: '#f0eee8', size: 0.8 })
      })
      /* seat, tail, fenders */
      body(
        c,
        [
          [-0.04, 0.84, 0.75, 0.16],
          [-0.14, 0.82, 0.73, 0.27],
          [-0.4, 0.83, 0.74, 0.27],
          [-0.62, 0.86, 0.77, 0.24],
          [-0.7, 0.86, 0.79, 0.12],
        ],
        CM('#1c1c1e', { roughness: 0.8 }),
        { p: 3 },
      )
      body(
        c,
        [
          [-0.06, 0.76, 0.58, 0.22, 2.6],
          [-0.3, 0.77, 0.6, 0.24, 2.6],
          [-0.6, 0.81, 0.68, 0.22, 2.6],
          [-0.82, 0.82, 0.74, 0.14, 2.4],
          [-0.9, 0.81, 0.77, 0.06],
        ],
        col,
      )
      c.tube(
        [
          [-0.45, 0.82, -0.14],
          [-0.8, 0.85, -0.11],
          [-0.86, 0.86, 0],
          [-0.8, 0.85, 0.11],
          [-0.45, 0.82, 0.14],
        ],
        0.014,
        CM('#b8bdc1', { metalness: 0.7, roughness: 0.3 }),
        { seg: 24 },
      )
      c.add(fenderGeo(-0.66, 0.31, 0.36, 1.2, 2.9, 0.14, 0.025, 0), blk, 0, 0, 0)
      c.add(fenderGeo(0.66, 0.31, 0.345, 0.2, 2.2, 0.12, 0.02, 0), col, 0, 0, 0)
      kit.taillight(c, { style: 'vertical', x: -0.9, y: 0.775, z: 0, w: 0.12, h: 0.07, d: 0.06, side: 1, label: trl('labels.taillight') })
      plateMoto(c, -1.0, 0.6)
      /* swingarm, shock absorbers, chain, footpegs */
      ;[1, -1].forEach(function (s) {
        c.rod(new V3(-0.18, 0.4, s * 0.1), new V3(-0.66, 0.31, s * 0.1), 0.022, blk)
        c.rod(new V3(-0.6, 0.34, s * 0.13), new V3(-0.5, 0.76, s * 0.13), 0.014, MT.chrome)
        c.tube(
          (function () {
            const p = []
            for (let i = 0; i <= 40; i++) {
              const t = i / 40,
                a = t * PI * 2 * 8
              p.push([-0.58 + 0.06 * t + Math.cos(a) * 0.004, 0.42 + t * 0.26, s * 0.13 + Math.sin(a) * 0.024])
            }
            return p
          })(),
          0.006,
          CM('#b02a22', { roughness: 0.4 }),
          { seg: 200, rs: 4 },
        )
        c.roundBox(0.12, 0.022, 0.05, 0.01, RUBBER, 0.0, 0.32, s * 0.2)
        c.roundBox(0.08, 0.02, 0.045, 0.01, RUBBER, -0.4, 0.46, s * 0.17)
      })
      c.roundBox(0.5, 0.06, 0.03, 0.02, blk, -0.42, 0.38, -0.12, { rot: [0, 0, 0.15] })
      /* black side covers under the seat, with "160", and the air filter box between them */
      c.roundBox(0.22, 0.16, 0.18, 0.04, blk, -0.24, 0.6, 0)
      ;[1, -1].forEach(function (s) {
        body(
          c,
          [
            [-0.06, 0.73, 0.6, 0.02, 2, s * 0.12],
            [-0.16, 0.74, 0.54, 0.035, 2.2, s * 0.13],
            [-0.34, 0.75, 0.56, 0.035, 2.2, s * 0.13],
            [-0.46, 0.76, 0.64, 0.02, 2, s * 0.12],
          ],
          blk,
          { p: 2.2 },
        )
        c.text('160', 0.1, 0.05, -0.26, 0.66, s * 0.152, s > 0 ? '+z' : '-z', { fg: '#e8e6df', size: 0.9 })
      })
      /* exhaust */
      c.tube(
        [
          [eng.exh.x, eng.exh.y, 0.06],
          [eng.exh.x + 0.05, eng.exh.y - 0.1, 0.12],
          [0.08, 0.26, 0.16],
          [-0.3, 0.32, 0.18],
          [-0.48, 0.4, 0.18],
        ],
        0.022,
        EXH,
        { seg: 40 },
      )
      c.cylinder(0.055, 0.045, 0.42, EXH, -0.66, 0.46, 0.18).rotation.z = -PI / 2 + 0.22
      c.roundBox(0.32, 0.07, 0.03, 0.03, HEAT, -0.62, 0.48, 0.23, { rot: [0, 0, 0.22] })
      /* fork, headlight, handlebar */
      fork(c, [0.38, 0.95], [0.66, 0.31], 0.085, 0.017, MT.chrome, gray)
      body(
        c,
        [
          [0.4, 1.01, 0.8, 0.22, 2.6],
          [0.47, 1.0, 0.8, 0.26, 2.6],
          [0.53, 0.98, 0.82, 0.24, 2.6],
          [0.565, 0.94, 0.84, 0.12, 2.2],
        ],
        col,
      )
      lamp(c, { style: 'rect', x: 0.57, y: 0.91, z: 0, w: 0.2, h: 0.11, d: 0.08, side: 1, label: trl('labels.headlight') })
      c.roundBox(0.1, 0.07, 0.18, 0.02, blk, 0.36, 1.04, 0, { rot: [0, 0, 0.4] })
      c.roundBox(0.02, 0.05, 0.15, 0.01, MT.gauge, 0.39, 1.06, 0, { rot: [0, 0, 0.4] })
      handlebar(c, 0.36, 1.03, 0.37, { rise: 0.04, back: 0.06, mat: MT.chrome, stalk: 0.19 })
      ;[1, -1].forEach(function (s) {
        blinker(c, 0.48, 0.9, s * 0.17, true)
        blinker(c, -0.86, 0.77, s * 0.15, false)
      })
      c.rod(new V3(-0.06, 0.3, -0.14), new V3(-0.16, 0.06, -0.26), 0.012, blk)
      c.part('engine', trl('labels.engine'), null, new V3(0.02, 0.45, 0), 0.8)
      c.part('fuel_tank', trl('labels.tank'), null, new V3(0.15, 0.84, 0), 0.7)
      bikeMeta(c, {
        length: 2.04,
        width: 0.75,
        front: 1.0,
        rear: -1.04,
        clearance: 0.17,
        bodyHeight: 0.62,
        top: 1.09,
        belt: 0.84,
        color: hex,
        rack: 0.85,
      })
      /* modified: sheet-metal rack over the tail with a can on top, side cases fixed on the bracket, engine guard */
      c.meta.armor = function (c: any, Z: any) {
        const ry = 0.88
        c.roundBox(0.46, 0.025, 0.3, 0.008, Z.steelMaterial, -0.66, ry, 0, { def: true })
        ;[1, -1].forEach(function (s) {
          c.rod(new V3(-0.45, 0.8, s * 0.13), new V3(-0.48, ry, s * 0.14), 0.012, Z.steelMaterial)
          c.tube(
            [
              [-0.42, ry, s * 0.15],
              [-0.42, 0.56, s * 0.24],
              [-0.9, 0.56, s * 0.24],
              [-0.9, ry, s * 0.15],
            ],
            0.012,
            Z.steelMaterial,
            { seg: 20 },
          )
          c.roundBox(0.44, 0.32, 0.17, 0.05, CM('#3d3a2e'), -0.66, 0.68, s * 0.33, { def: true })
          c.roundBox(0.45, 0.04, 0.175, 0.015, CM('#25241e'), -0.66, 0.84, s * 0.33)
          c.tube(
            [
              [0.38, 0.86, s * 0.16],
              [0.45, 0.6, s * 0.3],
              [0.1, 0.3, s * 0.28],
            ],
            0.02,
            MT.steel,
          )
        })
        jerryFlat(c, -0.68, ry + 0.09, 0, '#8e2a20')
        c.roundBox(0.42, 0.06, 0.3, 0.02, Z.steelMaterial, 0.05, 0.25, 0)
      }
    },
  )

  /* ================= Trail motorcycle (NXR 160 Bros type) ================= */
  /* Reference: Honda NXR 160 Bros 2015+ (Honda sheet, via motoragora.com.br)
     Real measurements: length 2.067 · width 0.810 · height 1.151 (without mirror) · wheelbase 1.356 · seat height 0.836
     · clearance 0.247 · tyres 90/90-19 (diameter 0.645) and 110/90-17 (diameter 0.630) · overhangs about 0.33 / 0.38 (from memory).
     Signature traits:
     front: rectangular headlight in a tall mask with a smoked visor; tall white front fender, fixed below the yoke;
     long fork with bellows; hand guards.
     side: tank with large white fins and the name; long straight seat; thin tail with a tubular rack;
     spoked wheels with knobby tyres; sump guard; exhaust rising to the tail with a guard.
     rear: small taillight under the rack, black rear fender with the plate, indicators on stalks.
     from above: narrow long tank, thin seat, rectangular rack behind. */
  fx.register(
    {
      key: 'trail_bike',
      group: 'motorcycles',
      name: trl('vehicles.trail_bike.name'),
      inspired: trl('vehicles.trail_bike.inspired'),
      article: trl('vehicles.trail_bike.article'),
      category: trl('vehicles.trail_bike.category'),
      fuel: 'flex',
      description: trl('vehicles.trail_bike.description'),
      mass: 125,
      noise: 70,
      seats: trl('vehicles.trail_bike.seats'),
      capacity: trl('vehicles.trail_bike.capacity'),
      efficiency: trl('vehicles.trail_bike.efficiency'),
      range: trl('vehicles.trail_bike.range'),
      maxSpeed: 115,
      skill: trl('vehicles.trail_bike.skill'),
      hood: false,
    },
    function (c) {
      const hex = '#b8261d',
        col = c.paint(hex),
        wht = c.paint('#e7e5df'),
        blk = CM('#17181a', { roughness: 0.55 }),
        gray = CM('#3c3f43', { metalness: 0.4, roughness: 0.45 })
      kit.spokedWheel(c, 0.72, 0.322, 0.05, { spokes: 32, knobby: true, disc: true, label: trl('labels.front_tire') })
      kit.spokedWheel(c, -0.66, 0.315, 0.06, { spokes: 32, knobby: true, label: trl('labels.rear_tire') })
      c.tube(
        [
          [0.4, 1.0, 0],
          [0.28, 0.72, 0],
          [0.14, 0.4, 0],
          [-0.16, 0.32, 0],
          [-0.2, 0.56, 0],
          [-0.14, 0.78, 0],
        ],
        0.021,
        blk,
        { seg: 40 },
      )
      c.tube(
        [
          [0.4, 1.0, 0],
          [0.12, 0.86, 0],
          [-0.14, 0.78, 0],
          [-0.55, 0.8, 0],
          [-0.9, 0.83, 0],
        ],
        0.019,
        blk,
        { seg: 40 },
      )
      c.cylinder(0.035, 0.035, 0.18, blk, 0.41, 0.97, 0).rotation.z = -0.38
      const eng = singleEngine(c, { x: 0.04, y: 0.48, tilt: 0.28 })
      c.roundBox(0.42, 0.03, 0.26, 0.015, CM('#5a5e62', { metalness: 0.6, roughness: 0.4 }), 0.06, 0.3, 0, { rot: [0, 0, 0.12] })
      /* tank and large fins */
      body(
        c,
        [
          [0.44, 0.99, 0.83, 0.14, 2.2],
          [0.34, 1.03, 0.75, 0.3, 2.4],
          [0.18, 1.01, 0.73, 0.33, 2.4],
          [0.02, 0.95, 0.75, 0.27, 2.4],
          [-0.07, 0.89, 0.8, 0.14, 2.2],
        ],
        col,
      )
      ;[1, -1].forEach(function (s) {
        body(
          c,
          [
            [0.46, 0.99, 0.85, 0.03, 2, s * 0.15],
            [0.34, 0.98, 0.67, 0.05, 2, s * 0.19],
            [0.16, 0.92, 0.65, 0.05, 2, s * 0.19],
            [0.04, 0.85, 0.73, 0.03, 2, s * 0.16],
          ],
          wht,
          { p: 2 },
        )
        c.text(trl('texts.br_s'), 0.22, 0.07, 0.24, 0.85, s * 0.218, s > 0 ? '+z' : '-z', { fg: '#b8261d', size: 0.85 })
        body(
          c,
          [
            [-0.1, 0.8, 0.6, 0.03, 2, s * 0.13],
            [-0.4, 0.82, 0.65, 0.04, 2, s * 0.13],
            [-0.7, 0.85, 0.77, 0.03, 2, s * 0.1],
          ],
          wht,
          { p: 2 },
        )
      })
      body(
        c,
        [
          [0.04, 0.89, 0.8, 0.14],
          [-0.08, 0.86, 0.77, 0.26],
          [-0.42, 0.85, 0.76, 0.26],
          [-0.74, 0.86, 0.78, 0.2],
          [-0.82, 0.85, 0.8, 0.1],
        ],
        CM('#1c1c1e', { roughness: 0.8 }),
        { p: 3 },
      )
      body(
        c,
        [
          [-0.06, 0.78, 0.58, 0.22, 2.6],
          [-0.4, 0.8, 0.63, 0.24, 2.6],
          [-0.82, 0.83, 0.75, 0.16, 2.4],
          [-0.95, 0.82, 0.79, 0.06],
        ],
        col,
      )
      for (let i = 0; i < 4; i++) c.rod(new V3(-0.58 - i * 0.09, 0.87, -0.12), new V3(-0.6 - i * 0.1, 0.87, 0.12), 0.008, blk)
      c.tube(
        [
          [-0.5, 0.87, -0.13],
          [-0.9, 0.87, -0.1],
          [-0.92, 0.87, 0.1],
          [-0.5, 0.87, 0.13],
        ],
        0.012,
        blk,
        { seg: 20 },
      )
      kit.taillight(c, { style: 'vertical', x: -0.95, y: 0.78, z: 0, w: 0.1, h: 0.06, d: 0.05, side: 1, label: trl('labels.taillight') })
      body(
        c,
        [
          [-0.9, 0.77, 0.73, 0.12],
          [-0.98, 0.68, 0.65, 0.12],
          [-1.02, 0.6, 0.57, 0.1],
        ],
        blk,
      )
      plateMoto(c, -1.03, 0.53)
      /* tall front fender, headlight fairing */
      const fendF = body(
        c,
        [
          [0.36, 0.84, 0.8, 0.08],
          [0.48, 0.87, 0.81, 0.17],
          [0.7, 0.85, 0.79, 0.17],
          [0.92, 0.8, 0.75, 0.15],
          [1.06, 0.72, 0.69, 0.1],
        ],
        wht,
        { p: 2.2 },
      )
      fork(c, [0.42, 1.02], [0.72, 0.322], 0.085, 0.019, MT.chrome, gray, { gaiter: true, split: 0.42 })
      body(
        c,
        [
          [0.44, 1.13, 0.85, 0.24, 2.6],
          [0.55, 1.11, 0.87, 0.24, 2.6],
          [0.6, 1.05, 0.91, 0.16, 2.4],
        ],
        col,
      )
      c.roundBox(0.02, 0.14, 0.18, 0.02, MT.glassDark, 0.5, 1.17, 0, { rot: [0, 0, 0.35] })
      lamp(c, { style: 'rect', x: 0.58, y: 0.99, z: 0, w: 0.16, h: 0.11, d: 0.07, side: 1, label: trl('labels.headlight') })
      const bars = handlebar(c, 0.38, 1.1, 0.4, { rise: 0.05, back: 0.07, guards: blk, stalk: 0.19 })
      ;[1, -1].forEach(function (s) {
        blinker(c, 0.52, 0.95, s * 0.16, true)
        blinker(c, -0.92, 0.76, s * 0.15, false)
        c.rod(new V3(-0.18, 0.44, s * 0.1), new V3(-0.66, 0.315, s * 0.1), 0.024, gray)
        c.roundBox(0.12, 0.024, 0.06, 0.01, MT.steel, 0.0, 0.36, s * 0.21)
      })
      c.rod(new V3(-0.24, 0.48, 0), new V3(-0.1, 0.77, 0), 0.03, CM('#c83a1e', { roughness: 0.45 }))
      c.tube(
        [
          [eng.exh.x, eng.exh.y, 0.06],
          [eng.exh.x + 0.06, eng.exh.y - 0.12, 0.14],
          [0.02, 0.32, 0.17],
          [-0.3, 0.44, 0.17],
          [-0.48, 0.62, 0.16],
        ],
        0.022,
        EXH,
        { seg: 40 },
      )
      c.cylinder(0.05, 0.045, 0.4, EXH, -0.66, 0.7, 0.16).rotation.z = -PI / 2 + 0.38
      c.roundBox(0.34, 0.08, 0.03, 0.03, HEAT, -0.62, 0.7, 0.21, { rot: [0, 0, 0.38] })
      c.rod(new V3(-0.04, 0.32, -0.14), new V3(-0.16, 0.06, -0.26), 0.012, blk)
      c.part('engine', trl('labels.engine'), null, new V3(0.04, 0.5, 0), 0.8)
      c.part('fuel_tank', trl('labels.tank'), null, new V3(0.18, 0.91, 0), 0.7)
      bikeMeta(c, {
        length: 2.08,
        width: 0.82,
        front: 1.06,
        rear: -1.04,
        clearance: 0.25,
        bodyHeight: 0.66,
        top: 1.17,
        belt: 0.88,
        color: hex,
        rack: 0.87,
      })
      /* wrecked: besides the default dent, the handlebar bends and the front fender comes loose on one side and falls */
      c.meta.damage = function (c: any, Z: any) {
        Z.defaultDamage(c)
        bendSet(bars, new V3(0.4, 1.05, 0), new V3(-0.35, 1, 0), 0.32)
        bendSet(bars, new V3(0.4, 1.05, 0), new V3(1, 0, 0), -0.12)
        bendSet([fendF], new V3(0.4, 0.84, 0), new V3(0.15, 0, 1), -0.32)
        fendF.position.z -= 0.04
      }
      c.meta.armor = function (c: any) {
        ;[1, -1].forEach(function (s) {
          kit.jerryCan(c, -0.55, 0.62, s * 0.3, s > 0 ? '#8e2a20' : '#3e5a34')
          c.rod(new V3(-0.3, 0.8, s * 0.14), new V3(-0.8, 0.8, s * 0.34), 0.012, kit.steelMaterial)
        })
        c.roundBox(0.44, 0.24, 0.3, 0.05, CM('#3d3a2e'), -0.8, 1.0, 0)
        c.rod(new V3(0.5, 0.82, -0.12), new V3(-0.2, 1.0, -0.24), 0.01, MT.wood)
        c.roundBox(0.5, 0.06, 0.32, 0.02, kit.steelMaterial, 0.04, 0.27, 0)
        roofLamp(c, 0.62, 1.12, 0.12)
        roofLamp(c, 0.62, 1.12, -0.12)
      }
    },
  )

  /* ================= Adventure motorcycle (R 1250 GS Adventure type) ================= */
  /* Reference: BMW R 1250 GS Adventure 2019+ (motorcycle.com)
     Real measurements: length 2.270 · width 0.980 (hand guards) · height 1.460 (low windshield, without mirror)
     · wheelbase 1.504 · seat height 0.890 to 0.910 · clearance about 0.22 (from memory) · tyres 120/70 R19 (diameter 0.651)
     and 170/60 R17 (diameter 0.636) · overhangs about 0.38 / 0.39 (from memory).
     Signature traits:
     front: round LED headlight with an asymmetric DRL; tall "beak" under the fairing; tall sloped windshield;
     boxer cylinders sticking out to the sides with tubular guards; hand guards.
     side: huge 30 L tank with wide "shoulders" and the name; two-level seat; telelever and gold fork;
     single-sided swingarm with a shaft drive on the left; tall exhaust on the right.
     rear: square aluminium panniers on both sides, aluminium rack, thin taillight, fender with the plate.
     from above: wide pear-shaped tank, cylinders sticking out on both sides, panniers wider than everything. */
  /* same builder for the civilian and the highway-police one (prf = true: white, blue fairing, blue and yellow stripes on the panniers) */
  function bigtrail(c: any, highwayPolice: any) {
    const hex = highwayPolice ? '#eceae4' : '#cfccc2',
      col = c.paint(hex),
      dark = c.paint(highwayPolice ? '#1f3f8f' : '#33373c'),
      blk = CM('#141517', { roughness: 0.55 }),
      alu = CM('#a9afb3', { metalness: 0.7, roughness: 0.35 })
    const rimGold = CM('#b88a2a', { metalness: 0.8, roughness: 0.3 }),
      aluBox = CM('#c3c8cb', { metalness: 0.35, roughness: 0.42 })
    const fw = kit.spokedWheel(c, 0.78, 0.325, 0.06, { spokes: 40, knobby: true, disc: true, label: trl('labels.front_tire') })
    const rw = kit.spokedWheel(c, -0.72, 0.318, 0.08, { spokes: 40, knobby: true, label: trl('labels.rear_tire') })
    ;[fw, rw].forEach(function (g) {
      g.children.forEach(function (ch: any) {
        if (ch.geometry && ch.geometry.type === 'TorusGeometry' && ch.material === MT.chrome) ch.material = rimGold
      })
    })
    /* boxer engine: crankcase, cylinders sticking out to the sides, gearbox */
    c.roundBox(0.42, 0.3, 0.3, 0.08, ENG, 0.2, 0.5, 0, { def: true })
    c.roundBox(0.3, 0.26, 0.28, 0.06, ENGD, -0.08, 0.5, 0)
    ;[1, -1].forEach(function (s) {
      c.cylinder(0.085, 0.085, 0.2, ENG, 0.34, 0.5, s * 0.24, 'z')
      c.roundBox(0.2, 0.17, 0.12, 0.04, ENG, 0.36, 0.52, s * 0.38, { def: true })
      c.roundBox(0.18, 0.12, 0.06, 0.03, CM('#1a1b1d', { metalness: 0.3, roughness: 0.4 }), 0.37, 0.56, s * 0.45)
      c.text('1250', 0.12, 0.04, 0.37, 0.56, s * 0.481, s > 0 ? '+z' : '-z', { fg: '#c9ced1', size: 0.8 })
      c.tube(
        [
          [0.46, 0.46, s * 0.36],
          [0.5, 0.34, s * 0.3],
          [0.3, 0.24, s * 0.14],
          [0.0, 0.26, 0.08],
        ],
        0.025,
        EXH,
        { seg: 30 },
      )
      /* cylinder guard */
      c.tube(
        [
          [0.5, 0.92, s * 0.2],
          [0.6, 0.66, s * 0.44],
          [0.52, 0.34, s * 0.5],
          [0.22, 0.32, s * 0.5],
          [0.12, 0.6, s * 0.44],
          [0.2, 0.86, s * 0.22],
        ],
        0.017,
        blk,
        { seg: 40 },
      )
      c.roundBox(0.07, 0.2, 0.14, 0.02, blk, 0.52, 0.8, s * 0.23)
    })
    c.roundBox(0.55, 0.035, 0.36, 0.015, alu, 0.18, 0.27, 0, { rot: [0, 0, 0.1] })
    /* frame */
    c.tube(
      [
        [0.5, 1.12, 0],
        [0.32, 0.86, 0],
        [0.0, 0.84, 0],
        [-0.5, 0.88, 0],
        [-0.98, 0.92, 0],
      ],
      0.022,
      blk,
      { seg: 40 },
    )
    /* 30 L tank, beak and windshield */
    body(
      c,
      [
        [0.66, 1.17, 0.98, 0.3, 3.0],
        [0.54, 1.23, 0.86, 0.56, 3.4],
        [0.32, 1.23, 0.8, 0.62, 3.4],
        [0.12, 1.17, 0.82, 0.54, 3.2],
        [-0.04, 1.09, 0.86, 0.38, 2.8],
        [-0.12, 1.02, 0.92, 0.16, 2.2],
      ],
      col,
    )
    ;[1, -1].forEach(function (s) {
      body(
        c,
        [
          [0.5, 1.02, 0.84, 0.03, 2, s * 0.27],
          [0.36, 1.04, 0.76, 0.04, 2, s * 0.3],
          [0.2, 1.0, 0.78, 0.03, 2, s * 0.28],
        ],
        dark,
        { p: 2 },
      )
      c.text(trl('texts.gz_1250'), 0.26, 0.06, 0.2, 1.06, s * 0.296, s > 0 ? '+z' : '-z', { fg: '#2a4f8f', size: 0.85 })
    })
    body(
      c,
      [
        [0.62, 1.0, 0.88, 0.16],
        [0.8, 0.97, 0.82, 0.25],
        [1.0, 0.88, 0.75, 0.21],
        [1.17, 0.77, 0.7, 0.08],
      ],
      c.paint('#2a4f8f'),
      { p: 2.8 },
    )
    ;[1, -1].forEach(function (s) {
      c.roundBox(0.42, 0.018, 0.012, 0.005, c.paint('#b8261d'), 0.88, 0.9, s * 0.08, { rot: [0, 0, -0.38] })
    })
    fork(c, [0.54, 1.14], [0.78, 0.325], 0.11, 0.025, MT.chrome, blk, { split: 0.45 })
    c.add(fenderGeo(0.78, 0.325, 0.37, 0.4, 2.1, 0.16, 0.02, 0), blk, 0, 0, 0)
    body(
      c,
      [
        [0.62, 1.32, 0.98, 0.3, 2.6],
        [0.72, 1.28, 1.0, 0.3, 2.6],
        [0.78, 1.2, 1.02, 0.22, 2.4],
      ],
      dark,
    )
    /* closed headlight: black shell, reflector, lens and asymmetric DRL (half-moon on the right side, thread on the left) */
    c.cylinder(0.125, 0.115, 0.08, blk, 0.73, 1.11, 0, 'x')
    const hlB = lamp(c, { style: 'round', x: 0.77, y: 1.11, z: 0, w: 0.2, h: 0.2, d: 0.08, side: 1, label: trl('labels.headlight') })
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.009, 6, 24, PI * 0.95), DRL)
    arc.rotation.y = PI / 2
    arc.rotation.x = -PI / 2 - 0.1
    arc.position.set(0.042, 0, 0)
    arc.castShadow = false
    hlB.group.add(arc)
    hlB.inner.push(arc)
    const fil = new THREE.Mesh(G.roundedBox(0.008, 0.11, 0.012, 0.004), DRL)
    fil.position.set(0.042, 0.0, -0.085)
    fil.castShadow = false
    hlB.group.add(fil)
    hlB.inner.push(fil)
    const ws = c.roundBox(
      0.012,
      0.36,
      0.38,
      0.05,
      CM('#c9d6dc', { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
      0.7,
      1.33,
      0,
      { rot: [0, 0, 0.42], taper: { sz: 0.8 } },
    )
    ws.castShadow = false
    ws.renderOrder = 2
    c.roundBox(0.1, 0.06, 0.24, 0.02, MT.gauge, 0.56, 1.32, 0, { rot: [0, 0, 0.6] })
    handlebar(c, 0.5, 1.26, 0.46, { rise: 0.04, back: 0.08, guards: blk, stalk: 0.18 })
    /* two-level seat, tail, rack */
    body(
      c,
      [
        [0.04, 0.96, 0.86, 0.2],
        [-0.08, 0.91, 0.82, 0.38],
        [-0.36, 0.9, 0.82, 0.38],
        [-0.44, 0.97, 0.87, 0.32],
        [-0.76, 0.98, 0.89, 0.3],
        [-0.84, 0.96, 0.91, 0.18],
      ],
      CM('#1d1d1f', { roughness: 0.8 }),
      { p: 3 },
    )
    body(
      c,
      [
        [-0.1, 0.9, 0.64, 0.34, 2.6],
        [-0.5, 0.93, 0.72, 0.34, 2.6],
        [-0.86, 0.97, 0.86, 0.24, 2.4],
        [-0.98, 0.96, 0.9, 0.1],
      ],
      dark,
    )
    c.roundBox(0.3, 0.025, 0.3, 0.01, alu, -0.92, 1.0, 0)
    kit.taillight(c, { style: 'bar', x: -1.0, y: 0.9, z: 0, w: 0.16, h: 0.05, d: 0.05, side: 1, label: trl('labels.taillight') })
    body(
      c,
      [
        [-0.96, 0.86, 0.82, 0.14],
        [-1.05, 0.78, 0.74, 0.14],
        [-1.1, 0.68, 0.65, 0.1],
      ],
      blk,
    )
    plateMoto(c, -1.11, 0.6)
    /* single-sided swingarm with a shaft drive (left), exhaust (right), panniers */
    c.roundBox(0.62, 0.1, 0.07, 0.035, alu, -0.42, 0.4, -0.13, { rot: [0, 0, 0.18], def: true })
    c.sphere(0.09, alu, -0.72, 0.318, -0.13, 1, 1, 0.7)
    c.rod(new V3(-0.3, 0.42, 0.08), new V3(-0.2, 0.86, 0.08), 0.03, CM('#b6862a', { metalness: 0.6, roughness: 0.4 }))
    c.cylinder(0.075, 0.065, 0.46, EXH, -0.52, 0.56, 0.24).rotation.z = -PI / 2 + 0.2
    c.cylinder(0.04, 0.04, 0.05, HEAT, -0.76, 0.6, 0.24).rotation.z = -PI / 2 + 0.2
    c.tube(
      [
        [0.0, 0.26, 0.08],
        [-0.15, 0.3, 0.2],
        [-0.3, 0.5, 0.24],
      ],
      0.03,
      EXH,
      { seg: 20 },
    )
    ;[1, -1].forEach(function (s) {
      const z = s * (s > 0 ? 0.44 : 0.4)
      const box = c.roundBox(0.5, 0.38, 0.2, 0.03, aluBox, -0.7, 0.8, z, { def: true }),
        luggageCase = [box, c.roundBox(0.52, 0.04, 0.21, 0.015, blk, -0.7, 0.98, z)]
      ;[-0.88, -0.52].forEach(function (x) {
        luggageCase.push(c.roundBox(0.04, 0.06, 0.03, 0.01, blk, x, 0.95, z + s * 0.1))
      })
      c.tube(
        [
          [-0.42, 0.62, s * 0.3],
          [-0.95, 0.62, s * 0.3],
          [-0.95, 0.98, s * 0.3],
        ],
        0.012,
        blk,
        { seg: 12 },
      )
      c.part('cargo', s > 0 ? trl('labels.right_pannier') : trl('labels.left_pannier'), box, new V3(-0.7, 0.8, z), 0.6)
      /* each aluminium pannier is its own zone: it dents, the lid comes loose and it falls (taking the cargo with it) */
      c.zone(
        s > 0 ? 'case_right' : 'case_left',
        s > 0 ? trl('labels.right_pannier') : trl('labels.left_pannier'),
        [-0.98, -0.42, 0.58, 1.03, s > 0 ? z - 0.12 : z - 0.14, s > 0 ? z + 0.14 : z + 0.12],
        luggageCase,
        {
          type: 'part',
          side: s,
          dir: [0, 0, -s],
          weight: 0.6,
          fx: [
            trl('effects.none'),
            trl('effects.cosmetic_only_scratched_aluminium'),
            trl('effects.dented_pannier_the_lid_jams'),
            trl('effects.loose_lid_the_cargo_falls_on_the_road'),
            trl('effects.pannier_torn_off_cargo_lost'),
          ],
        },
      )
      blinker(c, 0.66, 1.0, s * 0.17, true)
      blinker(c, -0.98, 0.86, s * 0.14, false)
      c.roundBox(0.12, 0.024, 0.07, 0.01, MT.steel, 0.02, 0.4, s * 0.22)
    })
    c.part('engine', trl('labels.boxer_engine'), null, new V3(0.25, 0.5, 0), 0.9)
    c.part('fuel_tank', trl('labels.n_30_l_tank'), null, new V3(0.3, 1.05, 0), 0.8)
    bikeMeta(c, {
      length: 2.29,
      width: 1.04,
      front: 1.18,
      rear: -1.11,
      clearance: 0.24,
      bodyHeight: 0.7,
      top: 1.5,
      belt: 0.98,
      color: hex,
      rack: 1.0,
    })
    c.meta.armor = function (c: any) {
      c.roundBox(0.42, 0.32, 0.42, 0.04, alu, -0.92, 1.17, 0, { def: true })
      c.roundBox(0.43, 0.04, 0.43, 0.015, blk, -0.92, 1.32, 0)
      jerryFlat(c, -0.92, 1.415, 0, '#8e2a20')
      ;[1, -1].forEach(function (s) {
        roofLamp(c, 0.62, 0.62, s * 0.5)
      })
      for (let i = -2; i <= 2; i++) c.rod(new V3(0.82, 1.0, i * 0.04), new V3(0.82, 1.22, i * 0.04), 0.004, MT.steel)
      c.rod(new V3(-0.2, 1.16, 0.26), new V3(0.4, 1.0, 0.36), 0.012, MT.wood)
      ;[1, -1].forEach(function (s) {
        c.tube(
          [
            [0.66, 1.0, s * 0.22],
            [0.82, 0.62, s * 0.5],
            [0.6, 0.28, s * 0.54],
          ],
          0.02,
          kit.steelMaterial,
        )
      })
    }
    if (highwayPolice) {
      /* panniers with blue and yellow stripes and "PRF"; siren and blue/red lights on the guard */
      ;[1, -1].forEach(function (s) {
        const z = s * (s > 0 ? 0.44 : 0.4) + s * 0.101,
          f = s > 0 ? '+z' : '-z'
        c.roundBox(0.5, 0.05, 0.006, 0.002, c.paint('#1f3f8f'), -0.7, 0.86, z)
        c.roundBox(0.5, 0.018, 0.006, 0.002, c.paint('#f2c21a'), -0.7, 0.825, z)
        c.text('PRF', 0.2, 0.08, -0.7, 0.73, z + s * 0.002, f, { fg: '#1f3f8f', size: 0.85 })
        c.text(trl('texts.federal_highway_police'), 0.3, 0.035, 0.24, 1.0, s * 0.3, f, { fg: '#f4f2ea', w: 1024, h: 120, size: 0.8 })
        c.roundBox(0.05, 0.05, 0.04, 0.012, s > 0 ? MT.blue : MT.tail, 0.62, 0.95, s * 0.3, { def: true })
      })
      c.cylinder(0.04, 0.045, 0.06, MT.trim, 0.66, 0.66, 0.36, 'x')
    }
  }
  fx.register(
    {
      key: 'adventure_bike',
      group: 'motorcycles',
      name: trl('vehicles.adventure_bike.name'),
      inspired: trl('vehicles.adventure_bike.inspired'),
      article: trl('vehicles.adventure_bike.article'),
      category: trl('vehicles.adventure_bike.category'),
      fuel: 'gasoline',
      description: trl('vehicles.adventure_bike.description'),
      mass: 268,
      noise: 85,
      seats: trl('vehicles.adventure_bike.seats'),
      capacity: trl('vehicles.adventure_bike.capacity'),
      efficiency: trl('vehicles.adventure_bike.efficiency'),
      range: trl('vehicles.adventure_bike.range'),
      maxSpeed: 220,
      skill: trl('vehicles.adventure_bike.skill'),
      hood: false,
    },
    function (c) {
      bigtrail(c, false)
    },
  )
  fx.register(
    {
      key: 'highway_police_bike',
      group: 'motorcycles',
      name: trl('vehicles.highway_police_bike.name'),
      inspired: trl('vehicles.highway_police_bike.inspired'),
      article: trl('vehicles.highway_police_bike.article'),
      category: trl('vehicles.highway_police_bike.category'),
      fuel: 'gasoline',
      description: trl('vehicles.highway_police_bike.description'),
      mass: 275,
      noise: 85,
      seats: trl('vehicles.highway_police_bike.seats'),
      capacity: trl('vehicles.highway_police_bike.capacity'),
      efficiency: trl('vehicles.highway_police_bike.efficiency'),
      range: trl('vehicles.highway_police_bike.range'),
      maxSpeed: 220,
      skill: trl('vehicles.highway_police_bike.skill'),
      hood: false,
    },
    function (c) {
      bigtrail(c, true)
    },
  )

  /* ================= Quad bike (Grizzly 700 type) ================= */
  /* Reference: Yamaha Grizzly 700 EPS 2016+ (WA state vehicle sheet, in inches)
     Real measurements: length 2.070 · width 1.252 · height 1.229 · wheelbase 1.250 · seat height 0.917 · clearance 0.287
     · tyres 26x8-12 and 26x10-12 (diameter 0.660) · track about 0.97 / 0.94 (from memory) · overhangs about 0.41 / 0.41.
     Signature traits:
     front: pair of wedge headlights in the front fairing with a black grille in the middle; extra headlight in a pod over the handlebar;
     black tubular guard at the front.
     side: large bulging fenders covering all four wheels; footboards with a grille; tall short seat;
     large knobby tyres on dark alloy rims.
     rear: large tubular rack, central taillight, exhaust on the right.
     from above: two racks (front and rear) almost the size of the vehicle, narrow seat in the middle. */
  fx.register(
    {
      key: 'quad_bike',
      group: 'motorcycles',
      name: trl('vehicles.quad_bike.name'),
      inspired: trl('vehicles.quad_bike.inspired'),
      category: trl('vehicles.quad_bike.category'),
      fuel: 'gasoline',
      description: trl('vehicles.quad_bike.description'),
      mass: 296,
      noise: 65,
      seats: trl('vehicles.quad_bike.seats'),
      capacity: trl('vehicles.quad_bike.capacity'),
      efficiency: trl('vehicles.quad_bike.efficiency'),
      range: trl('vehicles.quad_bike.range'),
      maxSpeed: 100,
      skill: trl('vehicles.quad_bike.skill'),
      hood: false,
    },
    function (c) {
      const hex = '#3f5a35',
        col = c.paint(hex),
        blk = CM('#17181a', { roughness: 0.6 }),
        rim = CM('#2b2d2f', { metalness: 0.5, roughness: 0.4 })
      ;[
        [0.62, 0.5, 0.21],
        [0.62, -0.5, 0.21],
        [-0.63, 0.49, 0.25],
        [-0.63, -0.49, 0.25],
      ].forEach(function (p) {
        c.wheel(p[0], p[1], 0.33, p[2], { lugs: true, chevron: true, rim: rim, spokes: 6, rimR: 0.55 })
      })
      /* chassis and engine */
      c.roundBox(1.25, 0.12, 0.42, 0.04, blk, 0, 0.32, 0)
      c.roundBox(0.4, 0.3, 0.34, 0.07, ENG, -0.05, 0.48, 0, { def: true })
      c.roundBox(0.18, 0.18, 0.2, 0.04, FIN, 0.12, 0.66, 0, { rot: [0, 0, -0.3] })
      /* front and rear fenders (shells over the wheels) and central body */
      ;[1, -1].forEach(function (s) {
        ;[
          [0.62, 0.21, 0.15, 2.3],
          [-0.63, 0.25, 0.9, 3.0],
        ].forEach(function (w) {
          const fd = c.add(fenderGeo(w[0], 0.33, 0.41, w[2], w[3], 0.28, 0.014, s * 0.49, { na: 36, p: 4 }), col, 0, 0, 0)
          c.deform.push(fd)
          fd.castShadow = false
        })
        c.roundBox(0.6, 0.04, 0.24, 0.015, blk, 0.0, 0.46, s * 0.4, { def: true })
        for (let t = 0; t < 4; t++) c.roundBox(0.03, 0.012, 0.22, 0.004, MT.steel, -0.2 + t * 0.14, 0.485, s * 0.4)
      })
      body(
        c,
        [
          [1.0, 0.7, 0.52, 0.42, 2.6],
          [0.92, 0.8, 0.5, 0.52, 2.8],
          [0.62, 0.84, 0.52, 0.56, 2.8],
          [0.32, 0.83, 0.52, 0.48, 2.6],
          [0.2, 0.8, 0.56, 0.34, 2.4],
        ],
        col,
        { seg: 40, smooth: 14, crease: 80 },
      ).castShadow = false
      body(
        c,
        [
          [0.36, 0.92, 0.7, 0.3, 2.4],
          [0.2, 0.94, 0.72, 0.34, 2.4],
          [0.04, 0.92, 0.74, 0.3, 2.4],
        ],
        col,
        { seg: 36, crease: 80 },
      )
      body(
        c,
        [
          [-0.2, 0.84, 0.56, 0.4, 2.6],
          [-0.5, 0.86, 0.54, 0.58, 2.8],
          [-0.86, 0.84, 0.54, 0.54, 2.8],
          [-1.0, 0.76, 0.56, 0.34, 2.4],
        ],
        col,
        { seg: 40, smooth: 14, crease: 80 },
      ).castShadow = false
      body(
        c,
        [
          [0.06, 0.97, 0.88, 0.26],
          [-0.1, 0.99, 0.86, 0.36],
          [-0.5, 0.99, 0.86, 0.36],
          [-0.66, 0.96, 0.88, 0.28],
        ],
        CM('#1d1d1f', { roughness: 0.8 }),
        { p: 3 },
      )
      /* racks */
      ;[
        [0.66, 0.9, 0.74, 0.86],
        [-0.66, 0.9, 0.62, 0.8],
      ].forEach(function (r) {
        const x0 = r[0] - r[2] / 2,
          x1 = r[0] + r[2] / 2,
          z = r[3] / 2,
          y = r[1]
        ;[
          [x0, -z, x1, -z],
          [x1, -z, x1, z],
          [x1, z, x0, z],
          [x0, z, x0, -z],
        ].forEach(function (q) {
          c.deform.push(c.rod(new V3(q[0], y, q[1]), new V3(q[2], y, q[3]), 0.018, blk))
        })
        ;[
          [x0, -z],
          [x1, -z],
          [x1, z],
          [x0, z],
        ].forEach(function (q) {
          c.sphere(0.018, blk, q[0], y, q[1])
        })
        for (let k = -2; k <= 2; k++) c.rod(new V3(x0, y + 0.004, k * z * 0.4), new V3(x1, y + 0.004, k * z * 0.4), 0.01, blk)
        ;[x0 + 0.05, x1 - 0.05].forEach(function (x) {
          ;[-z, z].forEach(function (zz) {
            c.rod(new V3(x, y, zz), new V3(x, y - 0.1, zz * 0.9), 0.014, blk)
          })
        })
      })
      /* bumper, headlights, handlebar */
      c.tube(
        [
          [0.9, 0.34, -0.28],
          [1.03, 0.38, -0.22],
          [1.05, 0.52, -0.2],
          [1.05, 0.52, 0.2],
          [1.03, 0.38, 0.22],
          [0.9, 0.34, 0.28],
        ],
        0.026,
        blk,
        { seg: 40 },
      )
      c.roundBox(0.06, 0.1, 0.3, 0.02, blk, 1.03, 0.44, 0)
      /* front: black central grille between two larger lit wedge headlights */
      const gq = c.roundBox(0.03, 0.12, 0.15, 0.012, grilleMat('mesh'), 1.025, 0.62, 0)
      gq.castShadow = false
      c.roundBox(0.04, 0.14, 0.17, 0.015, LH, 1.01, 0.62, 0)
      ;[1, -1].forEach(function (s) {
        const L = lamp(c, { style: 'wedge', x: 1.005, y: 0.655, z: s * 0.165, w: 0.16, h: 0.085, d: 0.07, side: s, yaw: 0.35 })
        drlOn(L, 0.14, 0.014, -0.028, 0.07)
      })
      c.rod(new V3(0.32, 0.86, 0), new V3(0.25, 1.16, 0), 0.03, blk)
      body(
        c,
        [
          [0.17, 1.22, 1.11, 0.2],
          [0.3, 1.23, 1.1, 0.25],
          [0.39, 1.2, 1.11, 0.17],
        ],
        col,
      )
      lamp(c, { style: 'rect', x: 0.39, y: 1.165, z: 0, w: 0.13, h: 0.05, d: 0.05, side: 1, label: trl('labels.handlebar_headlight') })
      handlebar(c, 0.23, 1.17, 0.4, { rise: 0.04, back: 0.05, mirrors: false })
      kit.taillight(c, { style: 'vertical', x: -1.02, y: 0.72, z: 0, w: 0.16, h: 0.06, d: 0.05, side: 1, label: trl('labels.taillight') })
      c.cylinder(0.05, 0.05, 0.22, EXH, -0.92, 0.5, 0.22, 'x')
      c.part('engine', trl('labels.engine'), null, new V3(-0.05, 0.5, 0), 0.8)
      c.part('fuel_tank', trl('labels.tank'), null, new V3(0.2, 0.86, 0), 0.6)
      Object.assign(c.meta, {
        kind: 'quad',
        length: 2.09,
        width: 1.25,
        front: 1.06,
        rear: -1.02,
        clearance: 0.28,
        bodyHeight: 0.56,
        top: 1.23,
        belt: 0.86,
        color: hex,
        roof: { x0: -0.9, x1: -0.42, w: 0.6, y: 0.92 },
        rack: 0.92,
      })
      c.meta.armor = function (c: any, Z: any) {
        ;[1, -1].forEach(function (s) {
          Z.jerryCan(c, -0.72, 1.12, s * 0.2, s > 0 ? '#8e2a20' : '#3e5a34')
        })
        c.roundBox(0.5, 0.3, 0.6, 0.05, CM('#4a4b3c'), 0.66, 1.06, 0)
        c.tube(
          [
            [1.06, 0.52, -0.3],
            [1.2, 0.5, -0.35],
            [1.22, 0.3, -0.35],
            [1.22, 0.3, 0.35],
            [1.2, 0.5, 0.35],
            [1.06, 0.52, 0.3],
          ],
          0.03,
          Z.steelMaterial,
          { seg: 40 },
        )
        for (let i = 0; i < 5; i++) {
          const sp = c.add(new THREE.ConeGeometry(0.03, 0.2, 8), Z.steelMaterial, 1.3, 0.42, -0.3 + i * 0.15)
          sp.rotation.z = -PI / 2
        }
        roofLamp(c, 0.4, 1.32, 0.12)
        roofLamp(c, 0.4, 1.32, -0.12)
      }
    },
  )

  /* ================= Classic rear-engine car (Fusca 1300 type) ================= */
  /* Reference: Volkswagen Fusca 1300 1975 (fichacompleta.com.br)
     Real measurements: length 4.026 (about 4.06 with the guards) · width 1.540 · height 1.500 · wheelbase 2.400 · track 1.305 / 1.288
     · tyre 5.60-15 (diameter 0.665) · clearance 0.152 · overhangs about 0.75 / 0.88 (from memory).
     Signature traits:
     front: short sloping hood (trunk) with the round badge; round headlights in capsules on top of the fenders;
     small indicators on top of the fenders; chrome blade bumper with guards.
     side: single-arc roof from the windshield to the engine grille; separate bulging fenders; rubber running board
     joining the fenders; two windows with rubber and trim; door with a push-button handle; chrome hubcaps.
     rear: vertical engine lid with grilles; teardrop taillights on the fenders; exhaust with two tips.
     top: narrow tall shell in the middle, fenders well out at the four wheels. */
  /* Loft body (truly rounded), separate fenders, windows cut into the hull that become glass,
     rear air-cooled engine and a front hood that opens the trunk (spare, tank and jack). */
  fx.register(
    {
      key: 'beetle',
      group: 'cars',
      name: trl('vehicles.beetle.name'),
      inspired: trl('vehicles.beetle.inspired'),
      category: trl('vehicles.beetle.category'),
      fuel: 'gasoline',
      description: trl('vehicles.beetle.description'),
      mass: 780,
      noise: 75,
      seats: trl('vehicles.beetle.seats'),
      capacity: trl('vehicles.beetle.capacity'),
      efficiency: trl('vehicles.beetle.efficiency'),
      range: trl('vehicles.beetle.range'),
      maxSpeed: 120,
      skill: trl('vehicles.beetle.skill'),
      hood: true,
    },
    function (c) {
      const hex = '#6f93b3',
        col = c.paint(hex),
        m = c.meta
      /* short sloping hood (nose shortened about 16%), tall cabin: the roof is a continuous arc from the windshield to the engine grille */
      const st = [
        [1.81, 0.6, 0.36, 0.66, 2.2],
        [1.71, 0.69, 0.32, 0.98, 2.4],
        [1.49, 0.8, 0.3, 1.12, 2.6],
        [1.16, 0.9, 0.3, 1.2, 2.8],
        [0.82, 0.99, 0.3, 1.28, 2.8],
        [0.6, 1.31, 0.3, 1.32, 2.5],
        [0.32, 1.45, 0.3, 1.34, 2.4],
        [0.0, 1.5, 0.3, 1.34, 2.4],
        [-0.4, 1.475, 0.3, 1.33, 2.4],
        [-0.8, 1.36, 0.3, 1.29, 2.5],
        [-1.12, 1.15, 0.3, 1.23, 2.6],
        [-1.45, 0.92, 0.3, 1.13, 2.5],
        [-1.84, 0.66, 0.32, 0.94, 2.3],
        [-2.03, 0.5, 0.36, 0.62, 2.0],
      ]
      const stS = resample(st, 110),
        shellM = c.add(sloft(stS, { seg: 76, crease: 50 }), col)
      const winD = [
          [-0.36, 1.0],
          [0.54, 1.0],
          [0.4, 1.28],
          [-0.36, 1.355],
        ],
        winT = [
          [-0.98, 1.0],
          [-0.46, 1.0],
          [-0.46, 1.345],
          [-0.72, 1.3],
          [-0.92, 1.18],
        ]
      const holes = []
      ;[1, -1].forEach(function (sd) {
        holes.push(kit.holeSide(winD, { side: sd, tag: 'front_window' + sd }), kit.holeSide(winT, { side: sd, tag: 'quarter_window' + sd }))
      })
      holes.push({
        tag: 'windshield',
        sel: function (n: any, ce: any) {
          return n.x > 0.3 && ce.y > 0.98
        },
        sdf: function (x: any, y: any, z: any) {
          return Math.max(Math.abs(z) - 0.5, 1.02 - y, y - 1.3)
        },
      })
      holes.push({
        tag: 'rear_window',
        sel: function (n: any, ce: any) {
          return n.x < -0.3 && ce.y > 1.0
        },
        sdf: function (x: any, y: any, z: any) {
          return Math.max(Math.abs(z) - 0.36, 1.1 - y, y - 1.31)
        },
      })
      holes.push({
        tag: 'hood',
        sel: function (n: any, ce: any) {
          return n.y > 0.3 && ce.x > 0.9 && ce.y > 0.6
        },
        sdf: function (x: any, y: any, z: any) {
          const t = clamp((x - 1.17) / 0.5, 0, 1)
          return Math.max(0.94 - x, x - 1.69, Math.abs(z) - (0.44 - 0.16 * t * t))
        },
      })
      const cut = kit.cutMesh(shellM, holes, 50)
      c.deform.push(shellM)
      function glassFrom(geo: any, label: any, type: any) {
        if (!geo || !geo.attributes.position.count) return null
        return kit.addGlass(c, geo, label, type, { mat: MT.glass })
      }
      glassFrom(cut.windshield, lbl('windshield'), 'laminated')
      glassFrom(cut.rear_window, lbl('rear_window'), 'laminated')
      ;[1, -1].forEach(function (sd) {
        glassFrom(cut['front_window' + sd], sd > 0 ? lbl('front_window_right') : lbl('front_window_left'), 'tempered')
        glassFrom(cut['quarter_window' + sd], sd > 0 ? lbl('rear_quarter_glass_right') : lbl('rear_quarter_glass_left'), 'tempered')
      })
      /* black rubber and chrome trim around each window (hides the cut-out) */
      ;[1, -1].forEach(function (sd) {
        ;[winD, winT].forEach(function (poly) {
          const pts = []
          for (let i = 0; i < poly.length; i++) {
            const a = poly[i],
              b = poly[(i + 1) % poly.length]
            for (let k = 0; k < 8; k++) {
              const t = k / 8
              pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
            }
          }
          const rub = c.tube(
            pts.map(function (p) {
              return [p[0], p[1], sd * (loftHalf(stS, p[0], p[1]) + 0.002)]
            }),
            0.016,
            RUBBER,
            { closed: true, seg: 120, rs: 6 },
          )
          rub.castShadow = false
          c.deform.push(rub)
          const tb = c.tube(
            pts.map(function (p) {
              return [p[0], p[1], sd * (loftHalf(stS, p[0], p[1]) + 0.012)]
            }),
            0.005,
            MT.chrome,
            { closed: true, seg: 120, rs: 4 },
          )
          tb.castShadow = false
        })
      })
      /* fenders */
      const rfF = function (a: any) {
          return 0.42 + 0.2 * smooth((Math.cos(a) - 0.25) / 0.75)
        },
        rfR = function (a: any) {
          return 0.43 + 0.2 * smooth((-Math.cos(a) - 0.2) / 0.8)
        }
      ;[1, -1].forEach(function (sd) {
        const ff = c.add(fenderGeo(1.15, 0.333, 0.42, 0.02, 3.0, 0.24, 0.06, sd * 0.645, { rf: rfF, na: 30 }), col)
        c.deform.push(ff)
        const fr = c.add(fenderGeo(-1.25, 0.333, 0.43, 0.15, 3.12, 0.25, 0.06, sd * 0.645, { rf: rfR, na: 30 }), col)
        c.deform.push(fr)
        /* running board */
        c.roundBox(1.6, 0.04, 0.12, 0.015, RUBBER, -0.05, 0.33, sd * 0.68)
        c.roundBox(1.6, 0.012, 0.012, 0.004, MT.chrome, -0.05, 0.345, sd * 0.74)
        /* headlights in capsules on the fender, indicators and teardrop taillights */
        c.cylinder(0.105, 0.095, 0.18, col, 1.47, 0.78, sd * 0.6, 'x')
        lamp(c, { style: 'round', x: 1.57, y: 0.78, z: sd * 0.6, w: 0.17, h: 0.17, d: 0.06, side: sd })
        c.sphere(0.03, MT.amber, 1.32, 0.85, sd * 0.61, 1.8, 0.8, 0.8)
        /* teardrop taillight on the rear fender ramp, pointing backward (before, it was hidden inside the fender) */
        c.cylinder(0.075, 0.068, 0.2, col, -1.77, 0.79, sd * 0.635, 'x')
        kit.taillight(c, { style: 'vertical', x: -1.875, y: 0.79, z: sd * 0.635, w: 0.1, h: 0.16, d: 0.05, side: sd })
        /* trim, handle, mirror, hinges */
        c.roundBox(0.008, 0.6, 0.006, 0.003, MT.dark, 0.62, 0.66, sd * 0.665, { rot: [0, 0, 0.1] })
        c.roundBox(0.008, 0.62, 0.006, 0.003, MT.dark, -0.38, 0.65, sd * 0.665)
        c.roundBox(0.12, 0.025, 0.03, 0.01, MT.chrome, -0.28, 0.9, sd * 0.675)
        c.rod(new V3(0.42, 0.98, sd * 0.66), new V3(0.4, 1.06, sd * 0.74), 0.008, MT.chrome)
        c.cylinder(0.05, 0.05, 0.02, MT.chrome, 0.4, 1.08, sd * 0.75, 'x')
        c.roundBox(1.0, 0.012, 0.008, 0.004, MT.chrome, 0.1, 0.62, sd * 0.668)
      })
      /* wheels with chrome hubcaps */
      ;[
        [1.15, 0.6525],
        [-1.25, 0.644],
      ].forEach(function (w) {
        ;[1, -1].forEach(function (sd) {
          const g = c.wheel(w[0], sd * w[1], 0.333, 0.142, { rim: col, spokes: 0, rimR: 0.6 })
          const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 10), MT.chrome)
          cap.scale.z = 0.3
          cap.position.z = sd * 0.075
          g.add(cap)
        })
      })
      /* chrome blade bumpers with guards */
      function blade(x0: any, x1: any, y: any, lab: any, fwd: any) {
        const pts = [
          [x0, y, -0.74],
          [x1 - fwd * 0.02, y, -0.58],
          [x1, y, 0],
          [x1 - fwd * 0.02, y, 0.58],
          [x0, y, 0.74],
        ]
        const t = c.tube(pts, 0.035, MT.chrome, { seg: 40, rs: 10 })
        t.scale.y = 1.9
        t.position.y = -y * 0.9
        c.deform.push(t)
        ;[-0.36, 0.36].forEach(function (z) {
          c.rod(new V3(x1 - fwd * 0.02, y - 0.06, z), new V3(x1 - fwd * 0.04, y + 0.16, z), 0.02, MT.chrome)
          c.rod(new V3(x1 - fwd * 0.12, y, z), new V3(x1 - fwd * 0.01, y, z), 0.018, MT.steel)
        })
        c.part('bumper', lab, t, new V3(x1, y, 0), 1.1)
        return t
      }
      m.frontBumper = blade(1.7, 1.88, 0.42, trl('labels.front_bumper'), 1)
      m.rearBumper = blade(-1.92, -2.12, 0.42, trl('labels.rear_bumper'), -1)
      c.plate(1.845, 0.55, 0, '+x')
      c.plate(-1.98, 0.62, 0, '-x')
      c.roundBox(0.06, 0.03, 0.14, 0.01, MT.chrome, -1.96, 0.71, 0)
      /* front hood (trunk): cut-out skin hinged near the windshield */
      const hood = kit.makeHood(c, cut.hood, {
        x0: 0.95,
        col: hex,
        open: 1.15,
        label: trl('labels.front_trunk_with_spare_tyre_tank_and_jack_the_ai'),
      })
      kit.emblem(c, 1.76, 0.665, 0, 0.05).rotation.z = -0.5
      if (hood)
        c.roundBox(0.1, 0.03, 0.05, 0.012, MT.chrome, 1.64, 0.735, 0, { parent: hood.piv }).position.set(1.64 - hood.x0, 0.735 - hood.y, 0)
      const bf = 0.42
      c.roundBox(0.74, 0.03, 0.76, 0.02, MT.bay, 1.33, bf, 0)
      const spare = c.add(new THREE.TorusGeometry(0.22, 0.065, 10, 24), MT.rubber, 1.42, 0.52, 0)
      spare.rotation.set(PI / 2 - 0.35, 0, 0)
      spare.rotation.order = 'ZXY'
      spare.rotation.z = 0
      const sr = c.cylinder(0.155, 0.155, 0.05, col, 1.42, 0.52, 0)
      sr.rotation.set(0, 0, -0.35)
      c.roundBox(0.36, 0.2, 0.62, 0.05, CM('#55595c', { metalness: 0.5, roughness: 0.5 }), 1.12, 0.62, 0)
      c.cylinder(0.04, 0.04, 0.05, MT.trim, 1.18, 0.74, 0.22)
      c.roundBox(0.36, 0.05, 0.08, 0.02, CM('#7a2a1d', { roughness: 0.6 }), 1.24, 0.47, -0.28, { rot: [0, 0.3, 0] })
      c.part('fuel_tank', trl('labels.fuel_tank_at_the_front'), null, new V3(1.12, 0.6, 0), 0.9)
      /* rear: engine lid with grilles, air-cooled engine and exhaust visible from below */
      /* engine lid grilles in two groups (the long slats crossed the lid curve and looked chopped up) */
      function loftTop(x: any, z: any) {
        for (let q = 0; q < stS.length - 1; q++) {
          const A = stS[q],
            B = stS[q + 1]
          if ((A[0] - x) * (B[0] - x) > 0) continue
          const t = (x - A[0]) / (B[0] - A[0] || 1),
            tp = A[1] + (B[1] - A[1]) * t,
            bt = A[2] + (B[2] - A[2]) * t,
            w = (A[3] + (B[3] - A[3]) * t) / 2,
            pp = (A[4] || 2.4) + ((B[4] || 2.4) - (A[4] || 2.4)) * t
          const hh = (tp - bt) / 2
          return (tp + bt) / 2 + hh * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(z) / w, pp)), 1 / pp)
        }
        return 0
      }
      for (let i = 0; i < 5; i++) {
        const lx = -1.52 - i * 0.045
        ;[-0.1, 0.1].forEach(function (zz) {
          const ly = loftTop(lx, zz),
            sl = Math.atan2(loftTop(lx + 0.02, zz) - loftTop(lx - 0.02, zz), 0.04)
          c.roundBox(0.03, 0.012, 0.13, 0.005, MT.dark, lx, ly + 0.002, zz, { rot: [0, 0, sl] })
        })
      }
      c.tube(
        [
          [-1.18, 1.0, -0.42],
          [-1.5, 0.87, -0.46],
          [-1.86, 0.66, -0.4],
          [-1.9, 0.6, 0],
          [-1.86, 0.66, 0.4],
          [-1.5, 0.87, 0.46],
          [-1.18, 1.0, 0.42],
        ],
        0.006,
        MT.dark,
        { seg: 60, rs: 4 },
      )
      c.roundBox(0.04, 0.02, 0.1, 0.008, MT.chrome, -1.89, 0.62, 0)
      c.roundBox(0.42, 0.18, 0.8, 0.05, CM('#202224', { roughness: 0.6 }), -1.6, 0.42, 0)
      /* air-cooled engine visible from below: crankcase, finned heads on both sides, pulley and transverse muffler */
      c.roundBox(0.36, 0.16, 0.36, 0.05, ENG, -1.62, 0.34, 0)
      ;[1, -1].forEach(function (sd) {
        c.roundBox(0.3, 0.14, 0.12, 0.03, ENG, -1.6, 0.36, sd * 0.3)
        for (let f = 0; f < 5; f++) c.roundBox(0.012, 0.17, 0.15, 0.004, FIN, -1.72 + f * 0.055, 0.36, sd * 0.3)
      })
      c.cylinder(0.07, 0.07, 0.04, EXH, -1.86, 0.44, 0, 'x')
      c.cylinder(0.06, 0.06, 0.82, EXH, -1.86, 0.31, 0, 'z')
      ;[0.3, -0.3].forEach(function (z) {
        c.cylinder(0.025, 0.025, 0.2, EXH, -1.98, 0.3, z, 'x')
      })
      c.part('engine', trl('labels.air_cooled_engine_rear'), null, new V3(-1.6, 0.55, 0), 1.0)
      /* simple 1970s interior */
      const fab = CM('#4b3a2e', { roughness: 0.85 }),
        fl = 0.36
      c.roundBox(1.7, 0.03, 0.62, 0.01, MT.carpet, -0.15, fl, 0).castShadow = false
      c.roundBox(0.2, 0.24, 1.14, 0.04, col, 0.66, 0.92, 0)
      c.roundBox(0.16, 0.05, 1.12, 0.02, CM('#1b1c1e'), 0.6, 1.03, 0)
      c.cylinder(0.075, 0.075, 0.02, MT.gauge, 0.555, 0.95, -0.32, 'x')
      c.cylinder(0.08, 0.08, 0.012, MT.chrome, 0.56, 0.95, -0.32, 'x', { open: true })
      c.roundBox(0.02, 0.06, 0.2, 0.01, MT.chrome, 0.56, 0.9, 0.04)
      kit.steeringWheel(c, 0.38, 0.92, -0.32, { r: 0.2, tilt: 0.55, col: 0.4 })
      c.rod(new V3(0.12, fl, 0), new V3(0.02, fl + 0.42, 0), 0.01, MT.chrome)
      c.sphere(0.025, MT.plastic, 0.02, fl + 0.44, 0)
      ;[-1, 1].forEach(function (sd) {
        kit.seat(c, -0.02, fl, sd * 0.27, { w: 0.44, mat: fab, back: 0.58, lean: 0.2, h: 0.28, headrest: false })
      })
      kit.seat(c, -0.66, fl, 0, { w: 0.94, n: 3, mat: fab, back: 0.44, lean: 0.14, h: 0.26, len: 0.42, headrest: false })
      /* door lining in slices that follow the inner curve of the shell (never crosses the bodywork) */
      ;[1, -1].forEach(function (sd) {
        for (let yk = 0.56; yk < 0.95; yk += 0.075) {
          const zf = Math.min(loftHalf(stS, -0.3, yk - 0.04), loftHalf(stS, 0.5, yk - 0.04)) - 0.045
          c.roundBox(0.86, 0.078, 0.026, 0.01, fab, 0.1, yk, sd * zf)
        }
        c.roundBox(0.07, 0.025, 0.02, 0.008, MT.chrome, -0.25, 0.86, sd * (loftHalf(stS, -0.25, 0.83) - 0.065))
      })
      c.roundBox(0.03, 0.06, 0.2, 0.02, MT.plastic, 0.54, 1.28, 0)
      ;[-0.3, 0.18].forEach(function (z) {
        c.rod(new V3(0.8, 1.02, z), new V3(0.66, 1.2, z - 0.32), 0.009, MT.trim)
      })
      /* zones: the front hood is the trunk (tank and spare), the rear lid is the air-cooled engine one; two doors */
      c.zone('hood', trl('labels.trunk_hood_front'))
      c.zone('lid', trl('labels.engine_cover_rear'), null, null, {})
      c.zone('door_front_left', trl('labels.left_door'), [-0.42, 0.66, 0.18, 1.06, -0.95, -0.42])
      c.zone('door_front_right', trl('labels.right_door'), [-0.42, 0.66, 0.18, 1.06, 0.42, 0.95])
      Object.assign(m, {
        kind: 'car',
        color: hex,
        length: 4.05,
        width: 1.54,
        front: 1.88,
        rear: -2.12,
        clearance: 0.3,
        belt: 0.98,
        top: 1.5,
        bodyHeight: 0.68,
        roof: { x0: -0.5, x1: 0.3, w: 0.86, y: 1.5 },
        frontQuad: { b: [0.8, 1.02], t: [0.6, 1.31], n: [0.86, 0.51] },
      })
      m.armor = function (c: any, Z: any) {
        Z.applyArmor(c)
        for (let z = -0.45; z <= 0.46; z += 0.15) c.rod(new V3(0.86, 1.04, z), new V3(0.64, 1.33, z), 0.014, Z.steelMaterial)
        c.rod(new V3(0.86, 1.04, -0.5), new V3(0.86, 1.04, 0.5), 0.02, Z.steelMaterial)
        for (let z2 = -0.32; z2 <= 0.33; z2 += 0.16) c.rod(new V3(-0.88, 1.34, z2), new V3(-1.18, 1.11, z2), 0.014, Z.steelMaterial)
      }
    },
  )
}
