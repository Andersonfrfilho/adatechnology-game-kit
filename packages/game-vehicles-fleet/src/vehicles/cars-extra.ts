import type { FleetContext } from '../context'

/* Cars added after the first batch (cars group). Uses only the kit API.
   Small hatch, compact hatches, sedan and muscle coupe (parody names).
   Local car() builder: a copy of the builder of the first car group, because it is closed over inside that file.
   Local change: wipers lying over the windshield and a single-wiper option (s.wiper = 1).
   New local helpers (not in the core): hoodHit/onHood (parts attached to the hood), gutter (rain gutter). */
export function installCarsExtra(fx: FleetContext): void {
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
  const EXH = CM('#b5b9bc', { metalness: 0.9, roughness: 0.25 })

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
      /* o.zx(x, y): extra width factor by position (door waist narrower than the hip, for example) */
      return [
        x - o.bowF * tF * u2 + o.bowR * tR * u2,
        y - dropF,
        z * (1 - sec(y)) * (1 - o.pinF * tF * tF) * (1 - o.pinR * tR * tR) * (o.zx ? o.zx(x, y) : 1),
      ]
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
      /* the plate (4-vertex plane) stays outside the warp: warped, it receded entirely into the recess and the recess pierced the plate */
      const pl = c.plate(ext + E * 0.004, s.p.y, 0, E > 0 ? '+x' : '-x')
      pl.userData.noWarp = true
      if (E < 0) {
        const lt = skin(c, Gd, PLATEL, { u0: Gd.uz(-0.06), u1: Gd.uz(0.06), yb: y + 0.071, yt: y + 0.08, off: off + 0.004, nv: 1 })
        lt.castShadow = false
      }
      return pl
    }
    /* lid seam line: list of points {y, z} on the rear face or {x, z, top:true} on the top of the trunk */
    K.lid = function (pts0: any) {
      /* intermediate points every 4 cm: the line follows the bodywork in straight runs (no spline belly crossing the plate or lid) */
      const pts: any = []
      pts0.forEach(function (q: any, i: any) {
        const n = pts0[i + 1]
        pts.push(q)
        if (!n || !!n.top !== !!q.top) return
        const d = q.top ? Math.hypot(n.x - q.x, n.z - q.z) : Math.hypot(n.y - q.y, n.z - q.z),
          k = Math.floor(d / 0.04)
        for (let j = 1; j < k; j++) {
          const t = j / k
          pts.push(
            q.top
              ? { top: true, x: q.x + (n.x - q.x) * t, z: q.z + (n.z - q.z) * t }
              : { y: q.y + (n.y - q.y) * t, z: q.z + (n.z - q.z) * t },
          )
        }
      })
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
    /* gh.polys(polys): the model swaps or adds side windows (sloped C pillar, pillar glass on fastbacks) */
    if (gh.polys) polys = gh.polys(polys)
    /* gh.qrSide / gh.qfSide: side margin of the rear glass / windshield (wider pillar seen from behind) */
    const qf = kit.quadDef([gh.fb, gh.belt], [gh.ft, gh.roof], gh.Wg, T, 'front', bev, { side: gh.qfSide }),
      qr = kit.quadDef([gh.rb, gh.belt], [gh.rt, roofR], gh.Wg, T, 'rear', bev, { side: gh.qrSide })
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
    kit.glassQuad(c, qr, lbl('rear_window'), { see: !!intr, mat: intr ? MT.tint : MT.glassDark })
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
    /* trunk plug (hatch): covers the cut-out hull edge seen through the rear glass */
    if (intr && s.shelf) {
      const sx0 = gh.rb + 0.03,
        sx1 = gh.rb + s.shelf
      c.roundBox(sx1 - sx0, 0.014, gh.Wg - 0.24, 0.006, CM('#1b1c1e', { roughness: 0.92 }), (sx0 + sx1) / 2, gh.belt - 0.02, 0).castShadow =
        false
    }
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
        kt: 0.035,
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
      /* door gap: x (sill to waist) or [x, y0, y1] (rear door that wraps the wheel arch: it cannot cross the wheel opening) */
      ;(s.seams || []).forEach(function (q: any) {
        const x = q.length ? q[0] : q,
          y0 = q.length ? q[1] : by + 0.09,
          y1 = q.length ? q[2] : gh.belt - 0.03
        c.roundBox(0.008, y1 - y0, 0.006, 0.003, MT.dark, x, (y0 + y1) / 2, sd * (hw + 0.001))
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
    /* black vent grille at the base of the windshield (covers the cut-out edge between the hood and the glass) */
    const cwh = S.hit(new V3(gh.fb + 0.03, 3, 0), new V3(0, -1, 0)),
      cwy = cwh ? cwh.p.y : gh.belt
    c.roundBox(0.15, 0.02, gh.Wg - 0.06, 0.008, PLASTIC, gh.fb + 0.02, cwy + 0.004, 0).castShadow = false
    /* wipers, antenna */
    /* wipers lying over the windshield (follow the glass slope); s.wiper = 1 is the single central wiper */
    const wd = new V3(gh.ft - gh.fb, gh.roof - gh.belt, 0).normalize(),
      wn = new V3(wd.y, -wd.x, 0)
    /* black silk-screen band at the base of the windshield (hides the cut-out edge of the glasshouse behind the glass) */
    const fr = new V3(gh.fb, gh.belt, 0).addScaledVector(wd, 0.065).addScaledVector(wn, 0.047),
      frw = 2 * (halfAt(gh.Wg, T, gh.belt + 0.05) - 0.07)
    c.roundBox(0.14, 0.006, frw, 0.003, PLASTIC, fr.x, fr.y, 0, { rot: [0, 0, Math.atan2(wd.y, wd.x)] }).castShadow = false
    ;(s.wiper === 1
      ? [[0.12, 0.66, -0.5]]
      : [
          [-0.3, 0.42, -0.36],
          [0.2, 0.42, -0.36],
        ]
    ).forEach(function (q) {
      const p0 = new V3(gh.fb, gh.belt, q[0]).addScaledVector(wd, 0.07).addScaledVector(wn, 0.035),
        p1 = p0.clone().addScaledVector(wd, q[1] * 0.42)
      p1.z += q[2]
      c.rod(p0, p1, 0.009, MT.trim)
      c.cylinder(0.018, 0.018, 0.03, MT.trim, p0.x, p0.y, p0.z)
    })
    if (s.fin !== false)
      c.sphere(0.1, s.roofCol ? c.paint(s.roofCol) : GLOSS, gh.rt + 0.2, roofAt(gh, gh.rt + 0.2) + 0.045, 0, 1.0, 0.45, 0.28, {
        tl: PI / 2,
      })
    if (s.spoiler)
      c.roundBox(0.2, 0.04, gh.Wg * 0.78, 0.02, s.roofCol ? c.paint(s.roofCol) : paint, gh.rt - 0.02, roofAt(gh, gh.rt) + 0.01, 0, {
        rot: [0, 0, -0.12],
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
    ;(s.wheels || []).forEach(function (w: any, wi: any) {
      /* s.track = [front track, rear track] (tyre centre); without it, the tyre touches the side */
      const zw = s.track ? s.track[wi] / 2 : hw * (1 - Wf.sec(w[1])) - w[2] / 2 + 0.02
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

  /* ================= group helpers ================= */
  const CHROMEH = CM('#c9cdd0', { metalness: 0.85, roughness: 0.25 })
  /* light chrome for large flat parts facing the camera (without an environment map, metallic chrome goes black) */
  const CHROMEB = CM('#d4d8db', { metalness: 0.5, roughness: 0.24 })
  const VINYL = '#2e2622'
  /* ribbed lit lens of old headlights (vertical glass ribs) */
  const LENSLIT = (function () {
    const cv = kit.document.createElement('canvas')
    cv.width = 64
    cv.height = 16
    const x = cv.getContext('2d')
    for (let i = 0; i < 64; i++) {
      const t = 0.5 + 0.5 * Math.cos((i / 64) * PI * 2 * 8)
      x.fillStyle = 'rgb(' + Math.round(170 + 70 * t) + ',' + Math.round(166 + 66 * t) + ',' + Math.round(150 + 60 * t) + ')'
      x.fillRect(i, 0, 1, 16)
    }
    const tx = new THREE.CanvasTexture(cv)
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping
    tx.repeat.set(3, 1)
    return new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: tx,
      emissive: new THREE.Color('#e8dcb8'),
      emissiveMap: tx,
      emissiveIntensity: 0.75,
      roughness: 0.25,
      metalness: 0.2,
    })
  })()
  /* light reflector for bulb headlights (pure chrome, without an environment map, renders almost black) */
  const REFLB = CM('#d3d7da', { metalness: 0.35, roughness: 0.28 })
  /* replaces the rear door window (and adds the pillar one) while keeping the front one automatic */
  function dlo(list: any) {
    return function (def: any) {
      return list.concat([def[def.length - 1]])
    }
  }
  /* glasshouse that narrows in plan towards the rear (C pillars converging): width factor above the waist */
  function cabTaper(belt: any, top: any, x0: any, L: any, a: any) {
    return function (x: any, y: any) {
      return 1 - a * sm((y - belt) / (top - belt)) * sm((x0 - x) / L)
    }
  }
  function hubChrome() {
    return { rim: CHROMEB, spokes: 0, rimR: 0.62 }
  }
  /* hood surface (point and normal) by vertical ray, for parts glued to it (vents) */
  function hoodHit(c: any, x: any, z: any) {
    if (!c.hood) return null
    c.root.updateMatrixWorld(true)
    const top = c.hood.piv.children[0],
      rc = new THREE.Raycaster(),
      inv = new THREE.Matrix4().copy(c.vehicle.matrixWorld).invert()
    rc.set(new V3(x, 4, z).applyMatrix4(c.vehicle.matrixWorld), new V3(0, -1, 0))
    const h = rc.intersectObject(top, false)[0]
    if (!h) return null
    const p = h.point.clone().applyMatrix4(inv),
      n = h.face.normal.clone().transformDirection(top.matrixWorld).transformDirection(inv)
    if (n.y < 0) n.negate()
    return { p: p, n: n }
  }
  /* part attached to the hood (opens with it): converts from c.g to the pivot */
  function onHood(c: any, m: any) {
    const piv = c.hood.piv
    c.vehicle.remove(m)
    m.position.sub(piv.position)
    piv.add(m)
    c.deform.push(m)
    return m
  }
  /* roof rail (black rubber) of the old cars */
  function gutter(c: any, gh: any, T: any, mat?: any) {
    ;[1, -1].forEach(function (sd) {
      const pts = [],
        z = function (y: any) {
          return sd * (halfAt(gh.Wg, T, y) - 0.004)
        }
      for (let x = gh.ft - 0.04; x >= gh.rt + 0.04; x -= 0.08) {
        const y = roofAt(gh, x) + 0.012
        pts.push([x, y, z(y)])
      }
      const t = c.tube(pts, 0.009, mat || MT.trim, { seg: pts.length * 4, rs: 4 })
      t.castShadow = false
      c.deform.push(t)
    })
  }

  /* ================= Small hatch (Uno Mille type) ================= */
  /* Reference: Fiat Uno Mille Economy Way 1.0 Fire 2011 (fichacompleta.com.br)
     Real measurements: length 3.693 · width 1.548 · height 1.489 (Way, with bars; about 1.445 without bars) · wheelbase 2.361
     · track 1.337 / 1.357 · tyre 175/70 R13 (diameter 0.575) · clearance 0.190 · overhangs about 0.70 / 0.63 (from memory).
     Signature traits:
     front: straight rectangular headlights flush with the bodywork, with an amber indicator on the outer corner; low wide black grille between the headlights
     with horizontal bars and a badge; black plastic bumper with an air slit.
     side: boxy: low straight waist, large vertical windows, black B pillar, small fixed window behind the rear door,
     black mouldings on the wheel arches and sill (Way), black protective strip on the doors.
     rear: almost vertical lid with a large glass; tall vertical taillights on the corners, in bands (red, amber and reverse);
     plate on the lid.
     top: long straight roof, rain gutters, single wiper on the windshield; aluminium ladder on the rack (the "Uno with a ladder"). */
  fx.register(
    {
      key: 'boxy_hatch',
      group: 'cars',
      name: trl('vehicles.boxy_hatch.name'),
      inspired: trl('vehicles.boxy_hatch.inspired'),
      category: trl('vehicles.boxy_hatch.category'),
      fuel: 'flex',
      description: trl('vehicles.boxy_hatch.description'),
      mass: 820,
      noise: 62,
      seats: trl('vehicles.boxy_hatch.seats'),
      capacity: trl('vehicles.boxy_hatch.capacity'),
      efficiency: trl('vehicles.boxy_hatch.efficiency'),
      range: trl('vehicles.boxy_hatch.range'),
      maxSpeed: 153,
      skill: trl('vehicles.boxy_hatch.skill'),
      hood: true,
    },
    function (c) {
      const hex = '#e2ddd0'
      car(c, {
        W: 1.548,
        col: hex,
        track: [1.337, 1.357],
        bottomY: 0.21,
        noseY: 0.7,
        tailY: 0.84,
        wiper: 1,
        fin: false,
        mirrorBlink: false,
        lower: [
          [-1.71, 0.24, 0.04],
          [-1.735, 0.5, 0.08],
          [-1.72, 0.88, 0.05],
          [-1.685, 0.93, 0.02],
          [0.7, 0.915, 0],
          [1.12, 0.855, 0.2],
          [1.76, 0.775, 0.06],
          [1.795, 0.62, 0.07],
          [1.78, 0.24, 0.04],
        ],
        arches: [
          [1.17, 0.29, 0.33],
          [-1.191, 0.29, 0.33],
        ],
        gh: {
          rb: -1.68,
          rt: -1.6,
          ft: 0.14,
          fb: 0.72,
          belt: 0.92,
          roof: 1.39,
          roofR: 1.385,
          crown: 0.006,
          rise: 0.0,
          Wg: 1.46,
          k: 0.1,
          pillars: [-0.42, -1.3],
          r1: 0.07,
          r2: 0.1,
        },
        seams: [0.69, -0.42, [-1.3, 0.62, 0.89]],
        handles: [0.12, -0.86],
        handleCol: '#1b1c1e',
        blackPillars: [-0.42],
        clad: true,
        rails: 0.07,
        frontBumper: { y1: 0.5, mat: CM('#232426', { roughness: 0.75 }) },
        rearBumper: { y1: 0.52, mat: CM('#232426', { roughness: 0.75 }) },
        skirtH: 0.05,
        plateF: 0.38,
        plateR: 0.72,
        plateROnBumper: false,
        mirrorCol: '#1b1c1e',
        front: function (c: any, K: any, _I: any) {
          ;[1, -1].forEach(function (sd) {
            K.head(sd, {
              z0: 0.3,
              wrap: 0.03,
              shape: function () {
                return [0.625, 0.745]
              },
              proj: [],
              refl: REFL,
              drl: [{ mat: LENSLIT, u0: 0.03, u1: 0.83, yb: 0.635, yt: 0.735 }],
              amber: [{ u0: 0.84, u1: 0.99, yb: 0.632, yt: 0.738 }],
            })
          })
          K.grille(1, {
            z1: 0.3,
            y0: 0.6,
            y1: 0.76,
            u0: 0.02,
            u1: 0.98,
            yb: 0.635,
            yt: 0.735,
            tex: 'barsd',
            tile: 0.045,
            frame: MT.trim,
            frameR: 0.007,
          })
          const e = K.grid(1, 0, { z1: 0.2, y0: 0.64, y1: 0.74, du: 0.03, dv: 0.03 }).at(0.5, 0.69)
          kit.emblem(c, e.p.x + 0.02, 0.69, 0, 0.032)
          const lw = K.grid(1, 0, { z1: 0.5, y0: 0.28, y1: 0.42, du: 0.03, dv: 0.03 })
          K.skin(lw, grilleMat('slots'), { u0: lw.uz(-0.42), u1: lw.uz(0.42), yb: 0.31, yt: 0.37, off: 0.021, tile: 0.05, nv: 2 })
          /* black bumper strips */
          const bg = c.meta.frontBumper.userData.grid
          lineOn(
            c,
            bg,
            [
              [0.03, 0.44],
              [0.5, 0.44],
              [0.97, 0.44],
            ],
            0.006,
            MT.dark,
            0.018,
          )
        },
        rear: function (c: any, K: any, I: any) {
          ;[1, -1].forEach(function (sd) {
            K.tail(sd, {
              z0: I.hw - 0.22,
              wrap: 0.035,
              shape: function () {
                return [0.6, 0.905]
              },
              hi: [{ u0: 0.05, u1: 0.95, yb: 0.79, yt: 0.89 }],
              amber: [{ u0: 0.05, u1: 0.95, yb: 0.705, yt: 0.775 }],
              rev: [{ u0: 0.05, u1: 0.95, yb: 0.62, yt: 0.69 }],
            })
            K.reflector(sd, I.hw - 0.26, 0.4, 0.12)
          })
          K.lid([
            { y: 0.95, z: -0.52 },
            { y: 0.6, z: -0.52 },
            { y: 0.56, z: -0.49 },
            { y: 0.56, z: 0.49 },
            { y: 0.6, z: 0.52 },
            { y: 0.95, z: 0.52 },
          ])
          c.roundBox(0.03, 0.05, 0.16, 0.012, MT.trim, I.S.endX(-1, 0.84) - 0.01, 0.84, 0.0)
        },
        interior: { rows: 2, col: '#4a4c52', trim: '#26272a' },
        hood: { motor: 'gasoline' },
        wheels: [
          [1.17, 0.2875, 0.175, wheelOpts('hubcap')],
          [-1.191, 0.2875, 0.175, wheelOpts('hubcap')],
        ],
        warp: { bowF: 0.07, bowR: 0.04, Lf: 0.4, Lr: 0.3, pinF: 0.02, pinR: 0.01, kt: 0.02, kb: 0.04 },
        extra: function (c: any, I: any) {
          const gh = I.gh
          gutter(c, gh, I.T)
          ;[1, -1].forEach(function (sd) {
            /* black protective strip on the doors */
            const Gs = sideGrid(I.S, sd, { x0: 0.95, x1: -1.62, y0: 0.5, y1: 0.6 })
            I.K.skin(Gs, CM('#1d1e20', { roughness: 0.7 }), { yb: 0.53, yt: 0.575, off: 0.008, thick: 0.012, nv: 1, u0: 0.01, u1: 0.99 })
          })
          /* mast antenna at the front of the roof */
          const an = c.rod(
            new V3(gh.ft - 0.12, roofAt(gh, gh.ft - 0.12) + 0.04, -0.55),
            new V3(gh.ft - 0.42, roofAt(gh, gh.ft - 0.12) + 0.5, -0.55),
            0.004,
            MT.trim,
          )
          c.deform.push(an)
          I.antenna = an
        },
      })
      /* aluminium ladder fixed on the bars: it belongs to the roof (it dents and goes away with it) */
      const m = c.meta,
        ry = m.roof.y + 0.03,
        esc = []
      ;[1, -1].forEach(function (sd) {
        esc.push(c.roundBox(1.9, 0.045, 0.035, 0.008, MT.alu, -0.75, ry, sd * 0.2, { def: true }))
      })
      for (let x = -1.62; x <= 0.14; x += 0.29) esc.push(c.roundBox(0.035, 0.03, 0.4, 0.01, MT.alu, x, ry, 0, { def: true }))
      ;[-1.45, 0.0].forEach(function (x) {
        esc.push(c.roundBox(0.05, 0.04, 0.5, 0.01, CM('#a8321d', { roughness: 0.8 }), x, ry + 0.035, 0))
      })
      c.zone('roof', null, null, esc.concat(m.rails || []))
      m.top = ry + 0.04
      m.roof.y = ry + 0.04
      m.armor = armorPlus(function (c: any) {
        kit.jerryCan(c, -0.9, m.roof.y + 0.2, 0.35, '#8e2a20')
        kit.jerryCan(c, -0.9, m.roof.y + 0.2, -0.35, '#2f5b2a')
      })
    },
  )

  /* ================= Hatch G5 (Gol G5 type) ================= */
  /* Reference: Volkswagen Gol G5 2009-2012 (autoo.com.br, Power 1.6 2010; fichacompleta.com.br)
     Real measurements: length 3.899 · width 1.656 · height 1.464 · wheelbase 2.465 · track about 1.43 / 1.42 (from memory)
     · tyre 175/70 R14 on the 1.0 version (diameter 0.601; 195/55 R15 on the Power) · clearance 0.163 · overhangs about 0.78 / 0.66 (from memory).
     Signature traits:
     front: large trapezoid headlights, with a high inner corner and the base rising outward; narrow upper grille with two bars
     and the round badge in the middle; bumper with a wide lower intake and round fog lights.
     side: waist rising slightly towards the rear, wide glassless C pillar, straight crease at handle height, short rear door.
     rear: wedge-shaped horizontal taillights that wrap the corner and enter the lid; plate on the lid in a recess; roof spoiler.
     top: roof dropping at the rear, antenna at the top of the windshield. */
  fx.register(
    {
      key: 'family_hatch',
      group: 'cars',
      name: trl('vehicles.family_hatch.name'),
      inspired: trl('vehicles.family_hatch.inspired'),
      category: trl('vehicles.family_hatch.category'),
      fuel: 'flex',
      description: trl('vehicles.family_hatch.description'),
      mass: 935,
      noise: 60,
      seats: trl('vehicles.family_hatch.seats'),
      capacity: trl('vehicles.family_hatch.capacity'),
      efficiency: trl('vehicles.family_hatch.efficiency'),
      range: trl('vehicles.family_hatch.range'),
      maxSpeed: 168,
      skill: trl('vehicles.family_hatch.skill'),
      hood: true,
    },
    function (c) {
      const hex = '#a7acb1'
      car(c, {
        W: 1.656,
        col: hex,
        shelf: 0.42,
        bottomY: 0.22,
        noseY: 0.72,
        tailY: 0.86,
        fin: false,
        lower: [
          [-1.818, 0.25, 0.05],
          [-1.858, 0.5, 0.12],
          [-1.838, 0.86, 0.1],
          [-1.768, 0.99, 0.05],
          [0.56, 0.97, 0],
          [1.06, 0.9, 0.35],
          [1.84, 0.78, 0.13],
          [1.91, 0.57, 0.13],
          [1.88, 0.25, 0.05],
        ],
        arches: [
          [1.2, 0.3, 0.34],
          [-1.265, 0.3, 0.34],
        ],
        gh: {
          rb: -1.79,
          rt: -1.45,
          ft: -0.08,
          fb: 0.68,
          belt: 0.96,
          roof: 1.415,
          roofR: 1.31,
          crown: 0.035,
          rise: 0.07,
          Wg: 1.52,
          k: 0.2,
          pillars: [-0.5, -1.2],
          r1: 0.16,
          r2: 0.22,
          qrSide: 0.15,
          /* rear door with the back edge sloped like the wide C pillar */
          polys: dlo([
            [
              [-1.36, 1.065],
              [-0.56, 1.035],
              [-0.56, 1.345],
              [-1.08, 1.305],
            ],
          ]),
        },
        dropRear: true,
        seams: [0.64, -0.5, [-1.27, 0.67, 0.93]],
        handles: [0.12, -0.86],
        blackPillars: [-0.5],
        frontBumper: { y1: 0.6 },
        rearBumper: { y1: 0.58 },
        plateF: 0.43,
        plateR: 0.74,
        plateROnBumper: false,
        spoiler: true,
        front: function (c: any, K: any, _I: any) {
          ;[1, -1].forEach(function (sd) {
            const yb = function (u: any) {
                return 0.635 + 0.065 * sm(u)
              },
              yt = function (u: any) {
                return 0.785 - 0.012 * u
              }
            K.head(sd, {
              z0: 0.34,
              wrap: 0.13,
              shape: function (u: any) {
                return [yb(u), yt(u)]
              },
              refl: REFLB,
              proj: [
                [0.26, 0.004, 0.04],
                [0.55, 0.008, 0.033],
              ],
              amber: [
                {
                  u0: 0.78,
                  u1: 0.98,
                  yb: function (u: any) {
                    return yb(u) + 0.006
                  },
                  yt: function (u: any) {
                    return yb(u) + 0.03
                  },
                },
              ],
            })
          })
          K.grille(1, {
            z1: 0.35,
            y0: 0.64,
            y1: 0.79,
            u0: 0.02,
            u1: 0.98,
            yb: 0.665,
            yt: 0.765,
            tex: 'barsd',
            tile: 0.05,
            frame: MT.trim,
            frameR: 0.006,
          })
          const bar = K.grid(1, 0, { z1: 0.36, y0: 0.68, y1: 0.75, du: 0.03, dv: 0.025 })
          lineOn(
            c,
            bar,
            [
              [0.02, 0.718],
              [0.5, 0.718],
              [0.98, 0.718],
            ],
            0.007,
            MT.chrome,
            0.012,
          )
          const e = bar.at(0.5, 0.716)
          kit.emblem(c, e.p.x + 0.02, 0.716, 0, 0.045)
          const lw = K.grid(1, 0, { z1: 0.62, y0: 0.27, y1: 0.5, du: 0.03, dv: 0.03 }),
            zt = 0.48,
            zb = 0.4,
            y0 = 0.3,
            y1 = 0.47
          function yB(u: any) {
            const z = Math.abs(lw.zu(u))
            return z <= zb ? y0 : y0 + (((y1 - y0) * (z - zb)) / (zt - zb)) * 0.6
          }
          K.skin(lw, grilleMat('mesh'), { u0: lw.uz(-zt), u1: lw.uz(zt), yb: yB, yt: y1, off: 0.021, tile: 0.06, nv: 3 })
          outline(c, lw, { u0: lw.uz(-zt), u1: lw.uz(zt), yb: yB, yt: y1 }, 0.006, LH, 0.022)
          ;[1, -1].forEach(function (sd) {
            const Gc = K.grid(1, sd, { z0: 0.52, wrap: 0.05, y0: 0.3, y1: 0.48, du: 0.02, dv: 0.02 })
            K.skin(Gc, LH, { yb: 0.33, yt: 0.45, off: 0.021, nv: 3 })
            const s2 = Gc.at(0.4, 0.39)
            s2.p.addScaledVector(s2.n, 0.018)
            fogLamp(c, s2, 0.036)
          })
        },
        rear: function (c: any, K: any, I: any) {
          ;[1, -1].forEach(function (sd) {
            const yb = function (u: any) {
                return 0.78 + 0.05 * u
              },
              yt = function (u: any) {
                return 0.97 - 0.035 * u
              }
            K.tail(sd, {
              z0: 0.45,
              wrap: 0.19,
              shape: function (u: any) {
                return [yb(u), yt(u)]
              },
              hi: [
                {
                  u0: 0.06,
                  u1: 0.96,
                  yb: function (u: any) {
                    return yt(u) - 0.035
                  },
                  yt: function (u: any) {
                    return yt(u) - 0.012
                  },
                },
              ],
              amber: [
                {
                  u0: 0.06,
                  u1: 0.3,
                  yb: function (u: any) {
                    return yb(u) + 0.045
                  },
                  yt: function (u: any) {
                    return yb(u) + 0.075
                  },
                },
              ],
              rev: [
                {
                  u0: 0.06,
                  u1: 0.3,
                  yb: function (u: any) {
                    return yb(u) + 0.01
                  },
                  yt: function (u: any) {
                    return yb(u) + 0.04
                  },
                },
              ],
            })
            K.reflector(sd, I.hw - 0.26, 0.4, 0.1)
          })
          K.lid([
            { y: 1.0, z: -0.445 },
            { y: 0.64, z: -0.445 },
            { y: 0.6, z: -0.41 },
            { y: 0.6, z: 0.41 },
            { y: 0.64, z: 0.445 },
            { y: 1.0, z: 0.445 },
          ])
          const cb = K.grid(-1, 0, { z1: 0.42, y0: 0.82, y1: 0.9, du: 0.03, dv: 0.03 })
          lineOn(
            c,
            cb,
            [
              [0.02, 0.86],
              [0.5, 0.86],
              [0.98, 0.86],
            ],
            0.005,
            MT.dark,
            0.004,
          )
          kit.emblem(c, I.S.endX(-1, 0.9) - 0.012, 0.9, 0, 0.04).rotation.y = PI
        },
        interior: { rows: 2, col: '#34363b' },
        hood: { motor: 'gasoline' },
        wheels: [
          [1.2, 0.3, 0.175, wheelOpts('alloy')],
          [-1.265, 0.3, 0.175, wheelOpts('alloy')],
        ],
        warp: { bowF: 0.15, bowR: 0.14, Lf: 0.5, Lr: 0.48, kt: 0.05, zx: cabTaper(0.96, 1.36, -0.3, 1.4, 0.07) },
        extra: function (c: any, I: any) {
          const gh = I.gh
          ;[1, -1].forEach(function (sd) {
            crease(
              c,
              I,
              sd,
              [
                [1.75, 0.8],
                [0.6, 0.82],
                [-0.6, 0.835],
                [-1.82, 0.85],
              ],
              { col: hex, h: 0.024 },
            )
            crease(
              c,
              I,
              sd,
              [
                [0.9, 0.46],
                [-0.95, 0.47],
              ],
              { col: hex, h: 0.02 },
            )
          })
          const an = c.rod(
            new V3(gh.ft - 0.1, roofAt(gh, gh.ft - 0.1) + 0.04, 0),
            new V3(gh.ft - 0.4, roofAt(gh, gh.ft - 0.1) + 0.42, 0),
            0.004,
            MT.trim,
          )
          c.deform.push(an)
        },
      })
      c.meta.armor = armorPlus(function (c: any) {
        const m = c.meta,
          fx = m.front + 0.05
        ;[0.45, -0.45].forEach(function (z) {
          c.tube(
            [
              [fx - 0.15, 0.32, z],
              [fx, 0.36, z],
              [fx + 0.02, 0.68, z],
              [fx - 0.08, 0.76, z],
            ],
            0.03,
            kit.steelMaterial,
          )
        })
        c.rod(new V3(fx + 0.01, 0.55, -0.55), new V3(fx + 0.01, 0.55, 0.55), 0.03, kit.steelMaterial)
        const t = c.add(new THREE.TorusGeometry(0.22, 0.08, 10, 22), MT.rubber, -0.9, m.roof.y + 0.11, 0)
        t.rotation.x = PI / 2
      })
    },
  )

  /* ================= HB-21 (HB20 type) ================= */
  /* Reference: Hyundai HB20 2023+ (facelift; fichacompleta.com.br, Comfort 1.0 2023)
     Real measurements: length 4.015 · width 1.720 · height 1.470 · wheelbase 2.530 · track about 1.50 / 1.51 (from memory)
     · tyre 185/60 R15 (diameter 0.603) · clearance 0.160 · overhangs about 0.80 / 0.68 (from memory).
     Signature traits:
     front: huge grille that takes the whole front, edge to edge, in a geometric pattern; thin headlights high on the corners,
     glued to the hood; vertical daytime lights on the bumper corners.
     side: strong shoulder crease rising to the taillight; window line rising at the rear and "breaking" at the C pillar;
     black B pillar; marked wheel arches.
     rear: thin taillights joined by a black band with a red thread edge to edge on the lid; plate on the bumper;
     roof spoiler.
     top: roof dropping to the rear, shark-fin antenna. */
  fx.register(
    {
      key: 'rideshare_hatch',
      group: 'cars',
      name: trl('vehicles.rideshare_hatch.name'),
      inspired: trl('vehicles.rideshare_hatch.inspired'),
      category: trl('vehicles.rideshare_hatch.category'),
      fuel: 'flex',
      description: trl('vehicles.rideshare_hatch.description'),
      mass: 993,
      noise: 58,
      seats: trl('vehicles.rideshare_hatch.seats'),
      capacity: trl('vehicles.rideshare_hatch.capacity'),
      efficiency: trl('vehicles.rideshare_hatch.efficiency'),
      range: trl('vehicles.rideshare_hatch.range'),
      maxSpeed: 161,
      skill: trl('vehicles.rideshare_hatch.skill'),
      hood: true,
    },
    function (c) {
      const hex = '#c9c2b2'
      car(c, {
        W: 1.72,
        col: hex,
        shelf: 0.42,
        bottomY: 0.23,
        noseY: 0.74,
        tailY: 0.9,
        lower: [
          [-1.9, 0.26, 0.05],
          [-1.94, 0.52, 0.13],
          [-1.92, 0.86, 0.1],
          [-1.84, 1.01, 0.06],
          [0.66, 0.98, 0],
          [1.2, 0.9, 0.4],
          [1.87, 0.79, 0.15],
          [1.94, 0.56, 0.15],
          [1.91, 0.26, 0.05],
        ],
        arches: [
          [1.21, 0.302, 0.345],
          [-1.32, 0.302, 0.345],
        ],
        gh: {
          rb: -1.84,
          rt: -1.42,
          ft: -0.1,
          fb: 0.68,
          belt: 0.98,
          roof: 1.42,
          roofR: 1.33,
          crown: 0.03,
          rise: 0.09,
          Wg: 1.6,
          k: 0.22,
          pillars: [-0.47, -1.24],
          r1: 0.16,
          r2: 0.25,
          qrSide: 0.16,
          /* window line that rises and "breaks" upward at the C pillar (the HB20 signature) */
          polys: dlo([
            [
              [-1.42, 1.165],
              [-1.22, 1.07],
              [-0.53, 1.04],
              [-0.53, 1.35],
              [-1.12, 1.31],
            ],
          ]),
        },
        dropRear: true,
        seams: [0.64, -0.47, [-1.3, 0.67, 0.95]],
        handles: [0.2, -0.76],
        blackPillars: [-0.47],
        frontBumper: { y1: 0.42 },
        rearBumper: { y1: 0.62 },
        plateF: 0.33,
        plateR: 0.48,
        spoiler: true,
        front: function (c: any, K: any, _I: any) {
          ;[1, -1].forEach(function (sd) {
            const yb = function (u: any) {
                return 0.735 + 0.01 * u
              },
              yt = function (u: any) {
                return 0.785 + 0.004 * u
              }
            K.head(sd, {
              z0: 0.36,
              wrap: 0.16,
              shape: function (u: any) {
                return [yb(u), yt(u)]
              },
              proj: [
                [0.38, 0.0, 0.019],
                [0.56, 0.0, 0.019],
              ],
              pad: 0.008,
              drl: [
                {
                  u0: 0.04,
                  u1: 0.97,
                  yb: function (u: any) {
                    return yt(u) - 0.012
                  },
                  yt: function (u: any) {
                    return yt(u) - 0.004
                  },
                },
              ],
            })
            /* vertical daytime light on the bumper corner */
            const Gc = K.grid(1, sd, { z0: 0.6, wrap: 0.07, y0: 0.32, y1: 0.66, du: 0.02, dv: 0.02 })
            K.skin(Gc, LH, { u0: 0.15, u1: 0.75, yb: 0.36, yt: 0.62, off: 0.024, nv: 3 })
            K.skin(Gc, DRL, { u0: 0.3, u1: 0.4, yb: 0.39, yt: 0.6, off: 0.027, nv: 2 })
          })
          /* huge edge-to-edge grille (geometric pattern) */
          const g = K.grid(1, 0, { z1: 0.62, y0: 0.4, y1: 0.73, du: 0.03, dv: 0.03 })
          function yT(u: any) {
            const z = Math.abs(g.zu(u))
            return 0.715 - 0.03 * sm((z - 0.3) / 0.3)
          }
          K.skin(g, grilleMat('diamond'), { u0: g.uz(-0.6), u1: g.uz(0.6), yb: 0.44, yt: yT, off: 0.022, tile: 0.055, nv: 4 })
          outline(c, g, { u0: g.uz(-0.6), u1: g.uz(0.6), yb: 0.44, yt: yT }, 0.007, MT.chrome, 0.024)
          const e = g.at(0.5, 0.66)
          kit.emblem(c, e.p.x + 0.03, 0.66, 0, 0.04)
        },
        rear: function (c: any, K: any, I: any) {
          ;[1, -1].forEach(function (sd) {
            const yb = function (u: any) {
                return 0.85 + 0.01 * u
              },
              yt = function (u: any) {
                return 0.925 - 0.008 * u
              }
            K.tail(sd, {
              z0: 0.48,
              wrap: 0.17,
              shape: function (u: any) {
                return [yb(u), yt(u)]
              },
              hi: [
                {
                  u0: 0.04,
                  u1: 0.97,
                  yb: function (u: any) {
                    return yt(u) - 0.022
                  },
                  yt: function (u: any) {
                    return yt(u) - 0.01
                  },
                },
              ],
              rev: [
                {
                  u0: 0.08,
                  u1: 0.3,
                  yb: function (u: any) {
                    return yb(u) + 0.008
                  },
                  yt: function (u: any) {
                    return yb(u) + 0.03
                  },
                },
              ],
            })
            K.reflector(sd, I.hw - 0.26, 0.4, 0.1)
          })
          /* black band with a red thread joining the taillights */
          const bg = K.grid(-1, 0, { z1: 0.5, y0: 0.84, y1: 0.93, du: 0.02, dv: 0.02 })
          K.skin(bg, LH, { yb: 0.86, yt: 0.915, off: 0.003, nv: 2 })
          const bar = K.skin(bg, TAILHI, { yb: 0.894, yt: 0.904, off: 0.008, nv: 1 }),
            bl = K.skin(bg, MT.lensRed, { yb: 0.89, yt: 0.908, off: 0.012, nv: 1, order: 3 })
          regLight(c, 'taillight', trl('labels.taillight_strip'), [bar], [bl], bg.at(0.5, 0.9).p)
          K.lid([
            { y: 1.0, z: -0.47 },
            { y: 0.66, z: -0.47 },
            { y: 0.63, z: -0.44 },
            { y: 0.63, z: 0.44 },
            { y: 0.66, z: 0.47 },
            { y: 1.0, z: 0.47 },
          ])
          kit.emblem(c, I.S.endX(-1, 0.8) - 0.012, 0.8, 0, 0.035).rotation.y = PI
        },
        interior: { rows: 2, col: '#2a2b2f' },
        hood: { motor: 'gasoline' },
        wheels: [
          [1.21, 0.302, 0.185, wheelOpts('alloy2')],
          [-1.32, 0.302, 0.185, wheelOpts('alloy2')],
        ],
        warp: { bowF: 0.19, bowR: 0.15, Lf: 0.6, Lr: 0.5, kt: 0.05, zx: cabTaper(0.98, 1.38, -0.3, 1.4, 0.07) },
        extra: function (c: any, I: any) {
          ;[1, -1].forEach(function (sd) {
            crease(
              c,
              I,
              sd,
              [
                [1.8, 0.79],
                [0.7, 0.82],
                [-0.6, 0.86],
                [-1.88, 0.91],
              ],
              { col: hex, h: 0.03 },
            )
            crease(
              c,
              I,
              sd,
              [
                [0.95, 0.5],
                [-0.2, 0.51],
                [-0.95, 0.56],
              ],
              { col: hex, h: 0.02 },
            )
          })
        },
      })
      c.meta.armor = armorPlus(function (c: any) {
        const r = c.meta.roof
        roofLamp(c, r.x1, r.y + 0.2, 0.32)
        roofLamp(c, r.x1, r.y + 0.2, -0.32)
      })
    },
  )

  /* ================= Polo type ================= */
  /* Reference: Volkswagen Polo 1.0 TSI 2023 (Brazil, facelift; fichacompleta.com.br)
     Real measurements: length 4.074 · width 1.751 · height 1.471 · wheelbase 2.566 · track 1.524 / 1.506
     · tyre 185/65 R15 (diameter 0.621) · clearance 0.149 · overhangs about 0.81 / 0.70 (from memory).
     Signature traits:
     front: thin straight headlights joined by an LED thread that crosses the narrow grille; badge in the middle of the thread;
     wide honeycomb lower grille with side intakes.
     side: sharp straight "tornado" crease from the headlight to the taillight, passing through the handles; very wide C pillar;
     almost straight window line; low crease on the doors.
     rear: horizontal taillights split between the bodywork and the lid; large badge in the middle (opens the lid); plate on the lid.
     top: straight roof, short spoiler, fin antenna. */
  fx.register(
    {
      key: 'turbo_hatch',
      group: 'cars',
      name: trl('vehicles.turbo_hatch.name'),
      inspired: trl('vehicles.turbo_hatch.inspired'),
      category: trl('vehicles.turbo_hatch.category'),
      fuel: 'flex',
      description: trl('vehicles.turbo_hatch.description'),
      mass: 1112,
      noise: 58,
      seats: trl('vehicles.turbo_hatch.seats'),
      capacity: trl('vehicles.turbo_hatch.capacity'),
      efficiency: trl('vehicles.turbo_hatch.efficiency'),
      range: trl('vehicles.turbo_hatch.range'),
      maxSpeed: 197,
      skill: trl('vehicles.turbo_hatch.skill'),
      hood: true,
    },
    function (c) {
      const hex = '#8c2b2b'
      car(c, {
        W: 1.751,
        col: hex,
        shelf: 0.42,
        bottomY: 0.22,
        noseY: 0.74,
        tailY: 0.9,
        lower: [
          [-1.913, 0.26, 0.05],
          [-1.953, 0.52, 0.13],
          [-1.933, 0.88, 0.1],
          [-1.863, 1.0, 0.05],
          [0.7, 0.99, 0],
          [1.25, 0.92, 0.4],
          [1.92, 0.8, 0.15],
          [1.99, 0.58, 0.15],
          [1.96, 0.26, 0.05],
        ],
        arches: [
          [1.25, 0.31, 0.35],
          [-1.316, 0.31, 0.35],
        ],
        gh: {
          rb: -1.86,
          rt: -1.5,
          ft: -0.12,
          fb: 0.72,
          belt: 0.99,
          roof: 1.42,
          roofR: 1.37,
          crown: 0.025,
          rise: 0.03,
          Wg: 1.6,
          k: 0.21,
          pillars: [-0.48, -1.28],
          r1: 0.15,
          r2: 0.25,
          qrSide: 0.17,
          /* almost straight window line and wide C pillar, with the back edge of the door sloped */
          polys: dlo([
            [
              [-1.42, 1.04],
              [-0.54, 1.03],
              [-0.54, 1.335],
              [-1.12, 1.32],
            ],
          ]),
        },
        dropRear: true,
        seams: [0.68, -0.48, [-1.34, 0.68, 0.96]],
        handles: [0.22, -0.78],
        blackPillars: [-0.48],
        frontBumper: { y1: 0.58 },
        rearBumper: { y1: 0.6 },
        plateF: 0.42,
        plateR: 0.73,
        plateROnBumper: false,
        spoiler: true,
        front: function (c: any, K: any, _I: any) {
          ;[1, -1].forEach(function (sd) {
            const yb = function (u: any) {
                return 0.665 + 0.012 * u
              },
              yt = function (u: any) {
                return 0.745 + 0.018 * u
              }
            K.head(sd, {
              z0: 0.34,
              wrap: 0.18,
              shape: function (u: any) {
                return [yb(u), yt(u)]
              },
              proj: [
                [0.36, -0.006, 0.026],
                [0.6, -0.006, 0.026],
              ],
              drl: [
                {
                  u0: 0.03,
                  u1: 0.97,
                  yb: function (u: any) {
                    return yt(u) - 0.016
                  },
                  yt: function (u: any) {
                    return yt(u) - 0.006
                  },
                },
              ],
            })
          })
          K.grille(1, {
            z1: 0.35,
            y0: 0.64,
            y1: 0.76,
            u0: 0.02,
            u1: 0.98,
            yb: 0.665,
            yt: 0.735,
            tex: 'barsd',
            tile: 0.045,
            frame: GLOSS,
            frameR: 0.005,
          })
          /* LED thread crossing the grille and joining the headlights */
          const bar = K.grid(1, 0, { z1: 0.36, y0: 0.72, y1: 0.76, du: 0.02, dv: 0.02 })
          K.skin(bar, DRL, { yb: 0.738, yt: 0.745, off: 0.012, nv: 1 })
          const e = bar.at(0.5, 0.735)
          kit.emblem(c, e.p.x + 0.025, 0.71, 0, 0.045)
          const lw = K.grid(1, 0, { z1: 0.66, y0: 0.28, y1: 0.52, du: 0.03, dv: 0.03 }),
            zt = 0.46,
            zb = 0.38,
            y0 = 0.31,
            y1 = 0.49
          function yB(u: any) {
            const z = Math.abs(lw.zu(u))
            return z <= zb ? y0 : y0 + (((y1 - y0) * (z - zb)) / (zt - zb)) * 0.5
          }
          K.skin(lw, grilleMat('mesh'), { u0: lw.uz(-zt), u1: lw.uz(zt), yb: yB, yt: y1, off: 0.021, tile: 0.05, nv: 3 })
          outline(c, lw, { u0: lw.uz(-zt), u1: lw.uz(zt), yb: yB, yt: y1 }, 0.006, LH, 0.022)
          ;[1, -1].forEach(function (sd) {
            const Gc = K.grid(1, sd, { z0: 0.54, wrap: 0.08, y0: 0.3, y1: 0.52, du: 0.02, dv: 0.02 })
            K.skin(Gc, grilleMat('mesh'), {
              u0: 0.08,
              u1: 0.8,
              yb: 0.34,
              yt: function (u: any) {
                return 0.49 - 0.06 * u
              },
              off: 0.021,
              tile: 0.05,
              nv: 3,
            })
            outline(
              c,
              Gc,
              {
                u0: 0.08,
                u1: 0.8,
                yb: 0.34,
                yt: function (u: any) {
                  return 0.49 - 0.06 * u
                },
              },
              0.005,
              LH,
              0.022,
            )
          })
        },
        rear: function (c: any, K: any, I: any) {
          ;[1, -1].forEach(function (sd) {
            const yb = function (u: any) {
                return 0.84 + 0.015 * u
              },
              yt = function (u: any) {
                return 0.955 - 0.012 * u
              }
            K.tail(sd, {
              z0: 0.36,
              wrap: 0.2,
              shape: function (u: any) {
                return [yb(u), yt(u)]
              },
              hi: [
                {
                  u0: 0.05,
                  u1: 0.96,
                  yb: function (u: any) {
                    return yt(u) - 0.03
                  },
                  yt: function (u: any) {
                    return yt(u) - 0.016
                  },
                },
                {
                  u0: 0.05,
                  u1: 0.96,
                  yb: function (u: any) {
                    return yb(u) + 0.014
                  },
                  yt: function (u: any) {
                    return yb(u) + 0.026
                  },
                },
              ],
              rev: [
                {
                  u0: 0.08,
                  u1: 0.28,
                  yb: function (u: any) {
                    return yb(u) + 0.03
                  },
                  yt: function (u: any) {
                    return yb(u) + 0.06
                  },
                },
              ],
            })
            K.reflector(sd, I.hw - 0.26, 0.42, 0.1)
          })
          K.lid([
            { y: 1.0, z: -0.47 },
            { y: 0.88, z: -0.47 },
            { y: 0.88, z: -0.36 },
            { y: 0.64, z: -0.36 },
            { y: 0.6, z: -0.33 },
            { y: 0.6, z: 0.33 },
            { y: 0.64, z: 0.36 },
            { y: 0.88, z: 0.36 },
            { y: 0.88, z: 0.47 },
            { y: 1.0, z: 0.47 },
          ])
          kit.emblem(c, I.S.endX(-1, 0.88) - 0.012, 0.88, 0, 0.055).rotation.y = PI
        },
        interior: { rows: 2, col: '#26272b', trim: '#1a1b1e' },
        hood: { motor: 'gasoline' },
        wheels: [
          [1.25, 0.31, 0.185, wheelOpts('alloy')],
          [-1.316, 0.31, 0.185, wheelOpts('alloy')],
        ],
        warp: { bowF: 0.18, bowR: 0.15, Lf: 0.6, Lr: 0.5, kt: 0.05, zx: cabTaper(0.99, 1.4, -0.3, 1.45, 0.07) },
        extra: function (c: any, I: any) {
          ;[1, -1].forEach(function (sd) {
            /* "tornado" crease: straight, sharp, high */
            crease(
              c,
              I,
              sd,
              [
                [1.85, 0.83],
                [0.4, 0.84],
                [-1.0, 0.85],
                [-1.95, 0.86],
              ],
              { col: hex, h: 0.03 },
            )
            crease(
              c,
              I,
              sd,
              [
                [0.95, 0.48],
                [-0.95, 0.48],
              ],
              { col: hex, h: 0.018 },
            )
          })
        },
      })
      c.meta.armor = armorPlus(function (c: any) {
        const r = c.meta.roof,
          y = r.y + 0.1
        ;[r.x0 + 0.1, r.x1 - 0.1].forEach(function (x) {
          c.roundBox(0.05, 0.04, r.w * 1.1, 0.01, kit.steelMaterial, x, y, 0)
        })
        ;[1, -1].forEach(function (sd) {
          c.roundBox(r.x1 - r.x0, 0.12, 0.03, 0.01, kit.steelMaterial, (r.x0 + r.x1) / 2, y + 0.06, sd * r.w * 0.55)
        })
        c.roundBox(0.6, 0.25, 0.4, 0.04, CM('#4b5130', { roughness: 0.9 }), (r.x0 + r.x1) / 2, y + 0.15, 0)
      })
    },
  )

  /* ================= Sedan (Civic G10 type) ================= */
  /* Reference: Honda Civic sedan G10 2017-2021 (autoo.com.br, EXL 2.0 2017)
     Real measurements: length 4.637 · width 1.799 · height 1.433 · wheelbase 2.700 · track about 1.547 / 1.563 (from memory)
     · tyre 215/50 R17 (diameter 0.647) · clearance about 0.135 (from memory) · overhangs about 0.93 / 1.01 (from memory).
     Signature traits:
     front: thick chrome bar ("wing") over the grille, running into the headlights; tapered headlights with an LED eyebrow;
     huge trapezoid lower grille and black "C" mouldings on the corners.
     side: fastback profile: long arched roof that drops straight to the short lid; small glass on the C pillar; strong low crease that
     rises from the doors to the taillight; high waist.
     rear: thin boomerang ("C") taillights that enter the lid and run down the side; short lid with a spoiler lip.
     top: low long roof, fin antenna. */
  fx.register(
    {
      key: 'fastback_sedan',
      group: 'cars',
      name: trl('vehicles.fastback_sedan.name'),
      inspired: trl('vehicles.fastback_sedan.inspired'),
      category: trl('vehicles.fastback_sedan.category'),
      fuel: 'flex',
      description: trl('vehicles.fastback_sedan.description'),
      mass: 1291,
      noise: 62,
      seats: trl('vehicles.fastback_sedan.seats'),
      capacity: trl('vehicles.fastback_sedan.capacity'),
      efficiency: trl('vehicles.fastback_sedan.efficiency'),
      range: trl('vehicles.fastback_sedan.range'),
      maxSpeed: 200,
      skill: trl('vehicles.fastback_sedan.skill'),
      hood: true,
    },
    function (c) {
      const hex = '#5a5f66'
      car(c, {
        W: 1.799,
        col: hex,
        bottomY: 0.2,
        noseY: 0.68,
        tailY: 0.92,
        lower: [
          [-2.257, 0.24, 0.06],
          [-2.297, 0.52, 0.14],
          [-2.277, 0.86, 0.1],
          [-2.167, 0.975, 0.08],
          [-1.98, 0.97, 0.03],
          [0.8, 0.95, 0],
          [1.46, 0.86, 0.45],
          [2.124, 0.72, 0.15],
          [2.214, 0.5, 0.15],
          [2.174, 0.24, 0.06],
        ],
        arches: [
          [1.35, 0.3235, 0.365],
          [-1.35, 0.3235, 0.365],
        ],
        gh: {
          rb: -1.96,
          rt: -0.95,
          ft: -0.14,
          fb: 0.82,
          belt: 0.97,
          roof: 1.38,
          roofR: 1.34,
          crown: 0.03,
          rise: 0.04,
          Wg: 1.62,
          k: 0.22,
          pillars: [-0.45, -1.12],
          r1: 0.4,
          r2: 0.3,
          qrSide: 0.2,
          /* 4-door fastback: rear door glass and the small pillar glass that runs under the roof fall */
          polys: dlo([
            [
              [-1.6, 1.035],
              [-1.1, 1.025],
              [-1.08, 1.235],
            ],
            [
              [-1.03, 1.02],
              [-0.51, 1.01],
              [-0.51, 1.31],
              [-0.95, 1.285],
            ],
          ]),
        },
        seams: [0.78, -0.45, [-1.06, 0.57, 0.94]],
        handles: [0.3, -0.72],
        blackPillars: [-0.45],
        mirrorCol: hex,
        frontBumper: { y1: 0.54 },
        rearBumper: { y1: 0.6 },
        plateF: 0.4,
        plateR: 0.79,
        plateROnBumper: false,
        front: function (c: any, K: any, _I: any) {
          ;[1, -1].forEach(function (sd) {
            const yb = function (u: any) {
                return 0.6 + 0.07 * sm(u * 1.2)
              },
              yt = function (u: any) {
                return 0.69 + 0.045 * sm(u)
              }
            K.head(sd, {
              z0: 0.38,
              wrap: 0.26,
              shape: function (u: any) {
                return [yb(u), yt(u)]
              },
              proj: [
                [0.28, 0.0, 0.022],
                [0.4, 0.0, 0.022],
                [0.52, 0.0, 0.022],
              ],
              drl: [
                {
                  u0: 0.05,
                  u1: 0.95,
                  yb: function (u: any) {
                    return yt(u) - 0.014
                  },
                  yt: function (u: any) {
                    return yt(u) - 0.004
                  },
                },
              ],
              amber: [
                {
                  u0: 0.66,
                  u1: 0.95,
                  yb: function (u: any) {
                    return yb(u) + 0.004
                  },
                  yt: function (u: any) {
                    return yb(u) + 0.016
                  },
                },
              ],
            })
          })
          /* black upper grille and the chrome "wing" over it */
          K.grille(1, {
            z1: 0.4,
            y0: 0.56,
            y1: 0.7,
            u0: 0.04,
            u1: 0.96,
            yb: 0.585,
            yt: 0.665,
            tex: 'mesh',
            tile: 0.045,
            frame: GLOSS,
            frameR: 0.005,
          })
          const wg = K.grid(1, 0, { z1: 0.46, y0: 0.64, y1: 0.72, du: 0.02, dv: 0.02 })
          K.skin(wg, CHROMEB, {
            u0: 0.01,
            u1: 0.99,
            yb: function (u: any) {
              const z = Math.abs(wg.zu(u))
              return 0.66 + 0.014 * sm((z - 0.3) / 0.12)
            },
            yt: function (u: any) {
              const z = Math.abs(wg.zu(u))
              return 0.705 + 0.008 * sm((z - 0.3) / 0.12)
            },
            off: 0.018,
            thick: 0.014,
            nv: 2,
          })
          const e = wg.at(0.5, 0.63)
          kit.emblem(c, e.p.x + 0.03, 0.625, 0, 0.042)
          const lw = K.grid(1, 0, { z1: 0.62, y0: 0.24, y1: 0.5, du: 0.03, dv: 0.03 }),
            zt = 0.54,
            zb = 0.42,
            y0 = 0.27,
            y1 = 0.47
          function yB(u: any) {
            const z = Math.abs(lw.zu(u))
            return z <= zb ? y0 : y0 + (((y1 - y0) * (z - zb)) / (zt - zb)) * 0.7
          }
          K.skin(lw, grilleMat('mesh'), { u0: lw.uz(-zt), u1: lw.uz(zt), yb: yB, yt: y1, off: 0.021, tile: 0.05, nv: 3 })
          outline(c, lw, { u0: lw.uz(-zt), u1: lw.uz(zt), yb: yB, yt: y1 }, 0.007, LH, 0.022)
          ;[1, -1].forEach(function (sd) {
            /* "C" moulding on the corner with the fog light */
            const Gc = K.grid(1, sd, { z0: 0.6, wrap: 0.1, y0: 0.26, y1: 0.54, du: 0.02, dv: 0.02 })
            K.skin(Gc, LH, {
              u0: 0.05,
              u1: 0.95,
              yb: 0.29,
              yt: function (u: any) {
                return 0.5 - 0.05 * u
              },
              off: 0.021,
              nv: 3,
            })
            const s2 = Gc.at(0.38, 0.36)
            s2.p.addScaledVector(s2.n, 0.018)
            fogLamp(c, s2, 0.03)
          })
        },
        rear: function (c: any, K: any, I: any) {
          ;[1, -1].forEach(function (sd) {
            /* boomerang: thin on the lid, tall at the corner, running down the side */
            const yb = function (u: any) {
                return 0.885 - 0.13 * sm((u - 0.35) / 0.55)
              },
              yt = function (u: any) {
                return 0.925 - 0.01 * u
              }
            K.tail(sd, {
              z0: 0.24,
              wrap: 0.24,
              shape: function (u: any) {
                return [yb(u), yt(u)]
              },
              hi: [
                {
                  u0: 0.02,
                  u1: 0.97,
                  yb: function (u: any) {
                    return yt(u) - 0.016
                  },
                  yt: function (u: any) {
                    return yt(u) - 0.006
                  },
                },
                {
                  u0: 0.86,
                  u1: 0.95,
                  yb: function (u: any) {
                    return yb(u) + 0.006
                  },
                  yt: function (u: any) {
                    return yt(u) - 0.006
                  },
                },
              ],
              rev: [
                {
                  u0: 0.5,
                  u1: 0.66,
                  yb: function (u: any) {
                    return yb(u) + 0.01
                  },
                  yt: function (u: any) {
                    return yb(u) + 0.05
                  },
                },
              ],
            })
            K.reflector(sd, I.hw - 0.26, 0.38, 0.12)
          })
          K.lid([
            { y: 0.94, z: -0.5 },
            { y: 0.7, z: -0.5 },
            { y: 0.66, z: -0.47 },
            { y: 0.66, z: 0.47 },
            { y: 0.7, z: 0.5 },
            { y: 0.94, z: 0.5 },
            { top: true, x: -2.187, z: 0.6 },
            { top: true, x: -2.047, z: 0.66 },
            { top: true, x: -1.877, z: 0.64 },
            { top: true, x: -1.847, z: 0.42 },
            { top: true, x: -1.847, z: -0.42 },
            { top: true, x: -1.877, z: -0.64 },
            { top: true, x: -2.047, z: -0.66 },
            { top: true, x: -2.187, z: -0.6 },
            { y: 0.94, z: -0.5 },
          ])
          const cb = K.grid(-1, 0, { z1: 0.3, y0: 0.84, y1: 0.9, du: 0.03, dv: 0.03 })
          lineOn(
            c,
            cb,
            [
              [0.02, 0.87],
              [0.5, 0.87],
              [0.98, 0.87],
            ],
            0.007,
            MT.chrome,
            0.006,
          )
          kit.emblem(c, I.S.endX(-1, 0.87) - 0.016, 0.87, 0, 0.035).rotation.y = PI
        },
        interior: { rows: 2, col: '#1e1f22', trim: '#15161a' },
        hood: { motor: 'gasoline' },
        wheels: [
          [1.35, 0.3235, 0.215, wheelOpts('alloy2')],
          [-1.35, 0.3235, 0.215, wheelOpts('alloy2')],
        ],
        warp: { bowF: 0.21, bowR: 0.13, Lf: 0.65, zx: cabTaper(0.97, 1.36, -0.5, 1.3, 0.06) },
        extra: function (c: any, I: any) {
          ;[1, -1].forEach(function (sd) {
            crease(
              c,
              I,
              sd,
              [
                [1.95, 0.79],
                [0.6, 0.84],
                [-1.0, 0.87],
                [-2.2, 0.9],
              ],
              { col: hex, h: 0.024 },
            )
            crease(
              c,
              I,
              sd,
              [
                [0.95, 0.42],
                [0.0, 0.45],
                [-0.9, 0.58],
                [-1.5, 0.7],
              ],
              { col: hex, h: 0.03 },
            )
          })
          /* spoiler lip at the end of the lid */
          const lip = I.K.grid(-1, 0, { z1: 0.62, y0: 0.9, y1: 1.0, du: 0.03, dv: 0.02 })
          c.meta.lip = I.K.skin(lip, c.paint(hex), { u0: 0.08, u1: 0.92, yb: 0.935, yt: 0.975, off: 0.012, thick: 0.02, nv: 2 })
        },
      })
      /* the spoiler lip belongs to the trunk lid (it dents, hangs and goes away with it) */
      c.zone('lid', trl('labels.trunk_lid'), null, [c.meta.lip])
      c.meta.armor = armorPlus(function (c: any) {
        const g = c.meta.glasshouse
        for (let z = -0.6; z <= 0.61; z += 0.15)
          c.rod(new V3(g.fb + 0.02, g.belt + 0.04, z), new V3(g.ft + 0.05, g.roof - 0.04, z * 0.92), 0.012, kit.steelMaterial)
      })
    },
  )

  /* ================= Comodoro (Opala Comodoro type) ================= */
  /* Reference: Chevrolet Opala Comodoro 4-door sedan 1985-1987 (fichacompleta.com.br, Diplomata 4.1 1988, same body;
     carzin.com.br, Comodoro 1985)
     Real measurements: length 4.844 (1985-onward bumpers; about 4.80 in some sheets) · width 1.766 · height 1.408
     · wheelbase 2.667 · track 1.432 / 1.410 · tyre 195/70 R14 (diameter 0.629) · clearance 0.130 · overhangs about 0.98 / 1.20 (from memory).
     Signature traits:
     front: straight wide front; one large rectangular headlight each side; chrome grille of horizontal bars filling the whole gap
     between the headlights; amber indicators that wrap the corner; chrome blade bumper with a rubber strip.
     side: three-box sedan, long straight hood, long trunk; low straight waist with a chrome trim;
     chrome rain gutters; dark vinyl roof (Comodoro); rubber side strip; chrome hubcaps.
     rear: wide low rectangular taillights on the rear panel, with the plate between them; straight trunk lid;
     chrome bumper.
     top: tall straight roof, steeply sloped rear glass, wide C pillar. */
  fx.register(
    {
      key: 'classic_six_sedan',
      group: 'cars',
      name: trl('vehicles.classic_six_sedan.name'),
      inspired: trl('vehicles.classic_six_sedan.inspired'),
      article: trl('vehicles.classic_six_sedan.article'),
      category: trl('vehicles.classic_six_sedan.category'),
      fuel: 'gasoline',
      description: trl('vehicles.classic_six_sedan.description'),
      mass: 1330,
      noise: 78,
      seats: trl('vehicles.classic_six_sedan.seats'),
      capacity: trl('vehicles.classic_six_sedan.capacity'),
      efficiency: trl('vehicles.classic_six_sedan.efficiency'),
      range: trl('vehicles.classic_six_sedan.range'),
      maxSpeed: 170,
      skill: trl('vehicles.classic_six_sedan.skill'),
      hood: true,
    },
    function (c) {
      const hex = '#5e1a1c'
      car(c, {
        W: 1.766,
        col: hex,
        track: [1.432, 1.41],
        roofCol: VINYL,
        bottomY: 0.24,
        noseY: 0.7,
        tailY: 0.78,
        fin: false,
        mirrorBlink: false,
        mirrorCol: '#c4c8cb',
        lower: [
          [-2.467, 0.28, 0.04],
          [-2.502, 0.5, 0.06],
          [-2.497, 0.84, 0.05],
          [-2.457, 0.895, 0.03],
          [-1.62, 0.905, 0],
          [0.62, 0.9, 0],
          [1.25, 0.86, 0.25],
          [2.16, 0.815, 0.05],
          [2.2, 0.7, 0.05],
          [2.18, 0.28, 0.04],
        ],
        arches: [
          [1.3, 0.3145, 0.355],
          [-1.367, 0.3145, 0.355],
        ],
        gh: {
          rb: -1.6,
          rt: -1.18,
          ft: 0.06,
          fb: 0.68,
          belt: 0.91,
          roof: 1.355,
          roofR: 1.355,
          crown: 0.005,
          rise: 0.0,
          Wg: 1.62,
          k: 0.14,
          pillars: [-0.52, -1.26],
          r1: 0.08,
          r2: 0.09,
        },
        seams: [0.64, -0.52, [-1.28, 0.68, 0.88]],
        handles: [0.24, -0.9],
        handleCol: '#c4c8cb',
        chromeBelt: true,
        frontBumper: { y0: 0.3, y1: 0.47, mat: CHROMEB },
        rearBumper: { y0: 0.3, y1: 0.48, mat: CHROMEB },
        skirtH: 0.05,
        plateF: 0.38,
        plateR: 0.66,
        plateROnBumper: false,
        front: function (c: any, K: any, _I: any) {
          ;[1, -1].forEach(function (sd) {
            /* large rectangular headlight and the amber indicator that wraps the corner */
            K.head(sd, {
              z0: 0.42,
              z1: 0.7,
              wrap: 0,
              shape: function () {
                return [0.59, 0.745]
              },
              proj: [],
              drl: [{ mat: LENSLIT, u0: 0.04, u1: 0.96, yb: 0.6, yt: 0.735 }],
              bezel: CHROMEH,
              pad: 0.014,
            })
            K.head(sd, {
              z0: 0.725,
              wrap: 0.12,
              shape: function () {
                return [0.6, 0.735]
              },
              label: sd > 0 ? trl('labels.right_turn_signal') : trl('labels.left_turn_signal'),
              pad: 0.008,
              bezel: CHROMEH,
              amber: [{ u0: 0.02, u1: 0.98, yb: 0.605, yt: 0.73 }],
            })
          })
          K.grille(1, {
            z1: 0.42,
            y0: 0.56,
            y1: 0.78,
            u0: 0.01,
            u1: 0.99,
            yb: 0.585,
            yt: 0.755,
            tex: 'bars',
            tile: 0.03,
            frame: CHROMEB,
            frameR: 0.009,
          })
          const e = K.grid(1, 0, { z1: 0.1, y0: 0.64, y1: 0.72, du: 0.03, dv: 0.03 }).at(0.5, 0.67)
          kit.emblem(c, e.p.x + 0.025, 0.67, 0, 0.045)
          /* rubber strip on the chrome bumper */
          const bg = c.meta.frontBumper.userData.grid
          c.deform.push(K.skin(bg, MT.rubber, { u0: 0.02, u1: 0.98, yb: 0.37, yt: 0.405, off: 0.02, nv: 1 }))
        },
        rear: function (c: any, K: any, _I: any) {
          ;[1, -1].forEach(function (sd) {
            K.tail(sd, {
              z0: 0.27,
              wrap: 0.08,
              shape: function () {
                return [0.57, 0.765]
              },
              pad: 0.012,
              hi: [{ u0: 0.36, u1: 0.98, yb: 0.6, yt: 0.74 }],
              amber: [{ u0: 0.18, u1: 0.34, yb: 0.6, yt: 0.74 }],
              rev: [{ u0: 0.03, u1: 0.16, yb: 0.6, yt: 0.74 }],
            })
          })
          const pn = K.grid(-1, 0, { z1: 0.28, y0: 0.56, y1: 0.78, du: 0.03, dv: 0.03 })
          K.skin(pn, CHROMEH, { yb: 0.565, yt: 0.58, off: 0.006, nv: 1 })
          K.skin(pn, CHROMEH, { yb: 0.755, yt: 0.77, off: 0.006, nv: 1 })
          const bg = c.meta.rearBumper.userData.grid
          c.deform.push(K.skin(bg, MT.rubber, { u0: 0.02, u1: 0.98, yb: 0.37, yt: 0.405, off: 0.02, nv: 1 }))
          K.lid([
            { top: true, x: -2.447, z: -0.66 },
            { top: true, x: -2.447, z: 0.66 },
            { top: true, x: -1.68, z: 0.66 },
            { top: true, x: -1.68, z: -0.66 },
            { top: true, x: -2.447, z: -0.66 },
          ])
        },
        interior: { rows: 2, col: '#6a4a36', trim: '#3a2a20' },
        hood: { motor: 'gasoline', front: 0.08 },
        wheels: [
          [1.3, 0.3145, 0.195, hubChrome()],
          [-1.367, 0.3145, 0.195, hubChrome()],
        ],
        warp: { bowF: 0.05, bowR: 0.04, Lf: 0.35, Lr: 0.3, pinF: 0.02, pinR: 0.02, kt: 0.02, kb: 0.04 },
        extra: function (c: any, I: any) {
          gutter(c, I.gh, I.T, CHROMEH)
          ;[1, -1].forEach(function (sd) {
            /* rubber trim with a chrome thread on the side */
            const Gs = sideGrid(I.S, sd, { x0: 2.1, x1: -2.4, y0: 0.5, y1: 0.6 })
            I.K.skin(Gs, MT.rubber, { yb: 0.535, yt: 0.565, off: 0.008, thick: 0.012, nv: 1, u0: 0.01, u1: 0.99 })
            I.K.skin(Gs, CHROMEH, { yb: 0.546, yt: 0.554, off: 0.0105, nv: 1, u0: 0.012, u1: 0.988 })
            /* "six cylinders" badge on the front fender */
            c.text('4100', 0.14, 0.04, 1.75, 0.66, sd * (I.hw + 0.004), sd > 0 ? '+z' : '-z', {
              fg: '#d6d8da',
              bg: 'rgba(0,0,0,0)',
              size: 0.8,
            })
          })
          /* hood ornament */
          I.hoodOrn = true
        },
      })
      c.meta.armor = armorPlus(function (c: any) {
        const m = c.meta,
          fx = m.front + 0.06
        c.roundBox(0.06, 0.38, 1.7, 0.02, kit.steelMaterial, fx, 0.42, 0, { rot: [0, 0, -0.25] })
        ;[0.6, 0, -0.6].forEach(function (z) {
          c.rod(new V3(fx - 0.25, 0.4, z), new V3(fx, 0.45, z), 0.03, kit.steelMaterial)
        })
      })
    },
  )

  /* ================= Mustangue GT (Mustang GT type) ================= */
  /* Reference: Ford Mustang GT S650 2024+ (en.wikipedia.org; autotijd.be)
     Real measurements: length 4.810 · width 1.915 (without mirrors) · height 1.394 · wheelbase 2.719 · track 1.585 / 1.642
     · tyres 255/40 R19 (diameter 0.687) front and 275/40 R19 (diameter 0.703) rear · clearance about 0.13 (from memory)
     · overhangs about 0.92 / 1.17 (from memory).
     Signature traits:
     front: long hood with two vents; large honeycomb trapezoid grille, almost the full height of the front; thin angular headlights
     on the corners with the three vertical LED bars (tri-bar); black front lip.
     side: 2-door fastback: arched roof that drops to the short lid; very long door; triangular rear side
     glass; wide shoulder (hip) over the rear wheel and a narrower door waist (seen from above).
     rear: three vertical taillight bars each side, on a black panel; four exhaust tips; black diffuser;
     short spoiler on the lid.
     top: low wide roof, very reclined rear glass. */
  fx.register(
    {
      key: 'v8_coupe',
      group: 'cars',
      name: trl('vehicles.v8_coupe.name'),
      inspired: trl('vehicles.v8_coupe.inspired'),
      category: trl('vehicles.v8_coupe.category'),
      fuel: 'gasoline',
      description: trl('vehicles.v8_coupe.description'),
      mass: 1800,
      noise: 120,
      seats: trl('vehicles.v8_coupe.seats'),
      capacity: trl('vehicles.v8_coupe.capacity'),
      efficiency: trl('vehicles.v8_coupe.efficiency'),
      range: trl('vehicles.v8_coupe.range'),
      maxSpeed: 250,
      skill: trl('vehicles.v8_coupe.skill'),
      hood: true,
    },
    function (c) {
      const hex = '#2f5bb0'
      car(c, {
        W: 1.915,
        col: hex,
        track: [1.585, 1.642],
        bottomY: 0.2,
        noseY: 0.7,
        tailY: 0.86,
        fin: false,
        lower: [
          [-2.44, 0.27, 0.06],
          [-2.48, 0.52, 0.12],
          [-2.46, 0.82, 0.1],
          [-2.36, 0.93, 0.08],
          [-1.95, 0.93, 0.03],
          [0.48, 0.925, 0],
          [1.25, 0.87, 0.45],
          [2.17, 0.8, 0.04],
          [2.215, 0.72, 0.05],
          [2.19, 0.5, 0.12],
          [2.15, 0.27, 0.06],
        ],
        arches: [
          [1.35, 0.3435, 0.385],
          [-1.369, 0.3515, 0.39],
        ],
        gh: {
          rb: -1.93,
          rt: -1.0,
          ft: -0.32,
          fb: 0.5,
          belt: 0.93,
          roof: 1.344,
          roofR: 1.27,
          crown: 0.035,
          rise: 0.06,
          Wg: 1.66,
          k: 0.26,
          pillars: [-0.82],
          r1: 0.4,
          r2: 0.3,
          qrSide: 0.21,
        },
        seams: [0.64, -0.82],
        handles: [-0.55],
        blackPillars: [],
        frontBumper: { y0: 0.21, y1: 0.6, wrap: 0.22 },
        rearBumper: { y1: 0.56, wrap: 0.3 },
        plateF: 0.3,
        plateR: 0.46,
        exhaust: true,
        front: function (c: any, K: any, _I: any) {
          ;[1, -1].forEach(function (sd) {
            /* angular headlight: base rising outward, three vertical LED bars on the inner side (tri-bar) */
            const yb = function (u: any) {
                return 0.605 + 0.06 * sm(u * 1.1)
              },
              yt = function (u: any) {
                return 0.762 - 0.004 * u
              }
            K.head(sd, {
              z0: 0.4,
              wrap: 0.2,
              shape: function (u: any) {
                return [yb(u), yt(u)]
              },
              proj: [
                [0.5, 0.004, 0.024],
                [0.64, 0.008, 0.022],
              ],
              pad: 0.01,
              drl: [0.06, 0.13, 0.2].map(function (u) {
                return {
                  u0: u,
                  u1: u + 0.028,
                  yb: function (v: any) {
                    return yb(v) + 0.008
                  },
                  yt: function (v: any) {
                    return yt(v) - 0.008
                  },
                }
              }),
              amber: [
                {
                  u0: 0.8,
                  u1: 0.96,
                  yb: function (u: any) {
                    return yb(u) + 0.004
                  },
                  yt: function (u: any) {
                    return yb(u) + 0.018
                  },
                },
              ],
            })
            /* "fangs": vertical black intakes on the bumper corners */
            const Gc = K.grid(1, sd, { z0: 0.64, wrap: 0.08, y0: 0.26, y1: 0.54, du: 0.02, dv: 0.02 })
            const fy = function (u: any) {
              return 0.5 - 0.1 * u
            }
            K.skin(Gc, grilleMat('mesh'), { u0: 0.06, u1: 0.9, yb: 0.29, yt: fy, off: 0.021, tile: 0.045, nv: 3 })
            outline(c, Gc, { u0: 0.06, u1: 0.9, yb: 0.29, yt: fy }, 0.007, LH, 0.022)
          })
          /* large inverted-trapezoid grille (wide at the top, just below the headlights) with a thick black frame */
          const g = K.grid(1, 0, { z1: 0.66, y0: 0.27, y1: 0.61, du: 0.03, dv: 0.03 }),
            zt = 0.6,
            zb = 0.43,
            yB0 = 0.3,
            yT = 0.585
          const gyb = function (u: any) {
            const z = Math.abs(g.zu(u))
            return z <= zb ? yB0 : yB0 + (yT - 0.02 - yB0) * clamp((z - zb) / (zt - zb), 0, 1)
          }
          K.skin(g, grilleMat('mesh'), { u0: g.uz(-zt), u1: g.uz(zt), yb: gyb, yt: yT, off: 0.022, tile: 0.05, nv: 6 })
          outline(c, g, { u0: g.uz(-zt), u1: g.uz(zt), yb: gyb, yt: yT }, 0.012, LH, 0.024)
          const e = g.at(0.5, 0.45)
          kit.emblem(c, e.p.x + 0.03, 0.45, 0, 0.05)
          /* black lip */
          const lp = K.grid(1, 0, { wrap: 0.25, y0: 0.19, y1: 0.27, du: 0.03, dv: 0.02 })
          K.skin(lp, PLASTIC, { yb: 0.2, yt: 0.24, off: 0.04, thick: 0.03, nv: 2 })
        },
        rear: function (c: any, K: any, _I: any) {
          /* black panel between the taillights and the three vertical bars on each side */
          const pn = K.grid(-1, 0, { z1: 0.86, y0: 0.74, y1: 0.92, du: 0.02, dv: 0.02 })
          K.skin(pn, GLOSS, { yb: 0.765, yt: 0.9, off: 0.004, nv: 2 })
          ;[1, -1].forEach(function (sd) {
            K.tail(sd, {
              z0: 0.42,
              wrap: 0.1,
              shape: function () {
                return [0.77, 0.895]
              },
              pad: 0.006,
              main: CM('#160707', { roughness: 0.3 }),
              hi: [0.12, 0.38, 0.64].map(function (u) {
                return { u0: u, u1: u + 0.14, yb: 0.785, yt: 0.88 }
              }),
            })
          })
          K.lid([
            { y: 0.93, z: -0.6 },
            { y: 0.7, z: -0.6 },
            { y: 0.66, z: -0.56 },
            { y: 0.66, z: 0.56 },
            { y: 0.7, z: 0.6 },
            { y: 0.93, z: 0.6 },
          ])
          /* diffuser and four tips */
          const dg = K.grid(-1, 0, { z1: 0.7, y0: 0.18, y1: 0.32, du: 0.03, dv: 0.02 })
          K.skin(dg, PLASTIC, { yb: 0.2, yt: 0.3, off: 0.035, thick: 0.03, nv: 2 })
          ;[0.62, 0.48, -0.48, -0.62].forEach(function (z) {
            const s = dg.at(dg.uz(z), 0.25)
            c.cylinder(0.045, 0.045, 0.1, EXH, s.p.x - 0.02, 0.25, z, 'x')
            c.cylinder(0.036, 0.036, 0.102, MT.dark, s.p.x - 0.02, 0.25, z, 'x')
          })
          /* short spoiler */
          const lip = K.grid(-1, 0, { z1: 0.7, y0: 0.88, y1: 0.97, du: 0.03, dv: 0.02 })
          K.skin(lip, GLOSS, { u0: 0.05, u1: 0.95, yb: 0.925, yt: 0.955, off: 0.016, thick: 0.02, nv: 2 })
        },
        interior: { rows: 2, col: '#1c1d20', trim: '#121316' },
        hood: { motor: 'v8_na' },
        wheels: [
          [1.35, 0.3435, 0.255, { rim: ALLOYD, spokeMat: ALLOY, spokes: 10, rimR: 0.72 }],
          [-1.369, 0.3515, 0.275, { rim: ALLOYD, spokeMat: ALLOY, spokes: 10, rimR: 0.71 }],
        ],
        /* wasp waist: doors 3.5 cm narrower than the hips over the wheels (seen from above and behind) */
        warp: {
          bowF: 0.2,
          bowR: 0.14,
          Lf: 0.65,
          kb: 0.05,
          kt: 0.06,
          zx: (function () {
            const ct = cabTaper(0.93, 1.32, -0.5, 1.3, 0.06)
            return function (x: any, y: any) {
              return (1 - 0.035 * sm((x + 1.0) / 0.45) * sm((0.95 - x) / 0.4)) * ct(x, y)
            }
          })(),
        },
        extra: function (c: any, I: any) {
          ;[1, -1].forEach(function (sd) {
            /* hip over the rear wheel and door crease */
            crease(
              c,
              I,
              sd,
              [
                [1.9, 0.77],
                [0.6, 0.79],
                [-0.5, 0.8],
                [-0.9, 0.86],
                [-2.3, 0.89],
              ],
              { col: hex, h: 0.05 },
            )
            crease(
              c,
              I,
              sd,
              [
                [0.5, 0.5],
                [-0.55, 0.55],
                [-0.85, 0.66],
              ],
              { col: hex, h: 0.028 },
            )
          })
        },
      })
      /* central bulge ("power dome") and hood vents: they open with it */
      if (c.hood) {
        const hd = hoodHit(c, 1.25, 0)
        if (hd) onHood(c, onSurf(c.sphere(0.5, c.paint(hex), 0, 0, 0, 1, 1, 1), hd, -0.008)).scale.set(1.3, 0.06, 0.38)
      }
      if (c.hood)
        [0.32, -0.32].forEach(function (z) {
          const s = hoodHit(c, 1.25, z)
          if (!s) return
          const v = onSurf(c.roundBox(0.28, 0.035, 0.12, 0.012, GLOSS, 0, 0, 0), s, 0.006)
          onHood(c, v)
        })
      /* two doors: the door zones cover the long door and the rear ones go away */
      c.zone('door_front_left', trl('labels.left_door'), [-0.84, 0.66, 0.15, 1.0, -1.1, -0.6], null, { type: 'door', hinge: 'front' })
      c.zone('door_front_right', trl('labels.right_door'), [-0.84, 0.66, 0.15, 1.0, 0.6, 1.1], null, { type: 'door', hinge: 'front' })
      c.zone('door_rear_left', false)
      c.zone('door_rear_right', false)
      /* on the coupe, the rear window is the fixed side glass of the pillar */
      c.zone('window_rear_left', trl('labels.left_rear_quarter_glass'), null, null, {})
      c.zone('window_rear_right', trl('labels.right_rear_quarter_glass'), null, null, {})
      c.meta.armor = armorPlus(function (c: any) {
        const r = c.meta.roof
        roofLamp(c, r.x1, r.y + 0.18, 0.35)
        roofLamp(c, r.x1, r.y + 0.18, -0.35)
      })
    },
  )
}
