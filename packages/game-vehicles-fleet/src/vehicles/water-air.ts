import type { FleetContext } from '../context'

/* Water and air, boats, planes and helicopters (rebuilt with real measurements).
   Uses only the kit API. The hull, wing, fuselage, propeller, rotor and navigation light functions
   live here (not in the core) and are exposed as the shared EA for the boats file. */
export function installWaterAir(fx: FleetContext): void {
  const kit = fx.kit
  const THREE = kit.THREE
  const shared = fx.shared
  const trl = fx.t
  const lbl = fx.label

  const V3 = kit.V3,
    PI = Math.PI,
    MT = kit.materials,
    CM = kit.makeMaterial,
    _paintCol = kit.paintColor,
    G = kit.geo,
    DS = THREE.DoubleSide,
    clamp = kit.clamp

  /* ================= local utilities (group E) ================= */
  /* per-vertex colour on a finished geometry: fn(x, y, z) -> THREE.Color */
  function colorize(geo: any, fn: any) {
    const p = geo.attributes.position,
      col = new Float32Array(p.count * 3)
    for (let i = 0; i < p.count; i++) {
      const cc = fn(p.getX(i), p.getY(i), p.getZ(i))
      col[3 * i] = cc.r
      col[3 * i + 1] = cc.g
      col[3 * i + 2] = cc.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return geo
  }
  function mix(a: any, b: any, t: any) {
    return a + (b - a) * t
  }
  function sstep(a: any, b: any, x: any) {
    const t = clamp((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)
  }
  /* interpolates a table [[t, v], ...] (t increasing) with smoothing */
  function tab(T: any) {
    return function (t: any) {
      if (t <= T[0][0]) return T[0][1]
      for (let i = 1; i < T.length; i++)
        if (t <= T[i][0]) {
          let k = (t - T[i - 1][0]) / (T[i][0] - T[i - 1][0])
          k = k * k * (3 - 2 * k)
          return mix(T[i - 1][1], T[i][1], k)
        }
      return T[T.length - 1][1]
    }
  }
  function tabL(T: any) {
    return function (t: any) {
      if (t <= T[0][0]) return T[0][1]
      for (let i = 1; i < T.length; i++)
        if (t <= T[i][0]) {
          const k = (t - T[i - 1][0]) / (T[i][0] - T[i - 1][0])
          return mix(T[i - 1][1], T[i][1], k)
        }
      return T[T.length - 1][1]
    }
  }

  /* ---- boat hull by sections ----
     o: { x0 (stern), L, n, m1 (points keel->chine), m2 (chine->sheer), keel(t), chine(t)->[z,y], sheer(t)->[z,y], q (bottom curve: 1 = straight V),
     fl (flank curve: <1 flares outward at the top), col(x,y,z) }   t = 0 at the stern, 1 at the bow stem */
  function boatHull(o: any) {
    const n = o.n || 40,
      m1 = o.m1 || 6,
      m2 = o.m2 || 6,
      q = o.q || 1,
      fl = o.fl || 1,
      pos = [],
      col = [],
      idx = []
    function sec(t: any) {
      const ky = o.keel(t),
        ch = o.chine(t),
        sh = o.sheer(t),
        pts = []
      for (let i = 0; i <= m1; i++) {
        const s = i / m1
        pts.push([ch[0] * s, ky + (ch[1] - ky) * Math.pow(s, q)])
      }
      for (let j = 1; j <= m2; j++) {
        const s2 = j / m2
        pts.push([ch[0] + (sh[0] - ch[0]) * Math.pow(s2, fl), ch[1] + (sh[1] - ch[1]) * s2])
      }
      return pts
    }
    const ring = 2 * (m1 + m2) + 1
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        x = o.x0 + t * o.L,
        P = sec(t),
        row = []
      for (let k = P.length - 1; k >= 1; k--) row.push([-P[k][0], P[k][1]])
      P.forEach(function (p) {
        row.push(p)
      })
      row.forEach(function (p) {
        pos.push(x, p[1], p[0])
        if (o.col) {
          const cc = o.col(x, p[1], p[0])
          col.push(cc.r, cc.g, cc.b)
        }
      })
    }
    for (let a = 0; a < n; a++)
      for (let k2 = 0; k2 < ring - 1; k2++) {
        const p0 = a * ring + k2,
          p1 = p0 + ring
        idx.push(p0, p0 + 1, p1, p0 + 1, p1 + 1, p1)
      }
    /* transom */
    const ci = pos.length / 3,
      sh0 = o.sheer(0),
      ky0 = o.keel(0)
    pos.push(o.x0, (sh0[1] + ky0) / 2, 0)
    if (o.col) {
      const c0 = o.col(o.x0, (sh0[1] + ky0) / 2, 0)
      col.push(c0.r, c0.g, c0.b)
    }
    for (let r = 0; r < ring - 1; r++) idx.push(ci, r + 1, r)
    let g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    if (o.col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(idx)
    g = G.crease(g, o.crease || 38)
    const H = {
      geo: g,
      o: o,
      sec: sec,
      t: function (x: any) {
        return clamp((x - o.x0) / o.L, 0, 1)
      },
      /* half beam of the hull at height y (inside, so floors and decks do not leak) */
      half: function (x: any, y: any) {
        const t = H.t(x),
          P = sec(t)
        if (y <= P[0][1]) return 0
        for (let i = 1; i < P.length; i++)
          if (y <= P[i][1]) {
            const k = (y - P[i - 1][1]) / Math.max(1e-6, P[i][1] - P[i - 1][1])
            return mix(P[i - 1][0], P[i][0], k)
          }
        return P[P.length - 1][0]
      },
      sheerAt: function (x: any) {
        const s = o.sheer(H.t(x))
        return { z: s[0], y: s[1] }
      },
    }
    return H
  }
  /* deck (or floor) that follows the hull: from x0 to x1, height y(x) (default: the sheer), crown in the middle, rim inset */
  function deckGeo(H: any, x0: any, x1: any, o: any) {
    o = o || {}
    const n = o.n || 24,
      m = o.m || 10,
      pos: any = [],
      idx: any = [],
      strips = o.inner ? [-1, 1] : [0]
    strips.forEach(function (sd) {
      const base = pos.length / 3
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n,
          y = o.y ? o.y(x) : H.sheerAt(x).y,
          hw = Math.max(0.002, (o.y ? H.half(x, y) : H.sheerAt(x).z) - (o.inset || 0)),
          zin = o.inner ? Math.max(0, Math.min(hw - 0.01, o.inner(x))) : 0
        for (let j = 0; j <= m; j++) {
          const u = j / m,
            z = sd === 0 ? (u * 2 - 1) * hw : sd * (zin + (hw - zin) * u)
          const cr = (o.crown || 0) * (1 - Math.pow(z / hw, 2))
          pos.push(x, y + cr + (o.lift || 0), z)
        }
      }
      for (let a2 = 0; a2 < n; a2++)
        for (let k = 0; k < m; k++) {
          const p0 = base + a2 * (m + 1) + k,
            p1 = p0 + m + 1
          if (sd < 0) idx.push(p0, p0 + 1, p1, p0 + 1, p1 + 1, p1)
          else idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1)
        }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    return G.crease(g, 40)
  }
  /* trim along the rim (or at another relative height) */
  function sheerTube(c: any, H: any, x0: any, x1: any, r: any, mat: any, o: any) {
    o = o || {}
    let pts = []
    const n = o.n || 30
    ;[1, -1].forEach(function (s) {
      pts = []
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n,
          sh = H.sheerAt(x),
          y = sh.y + (o.dy || 0),
          z = (o.dy ? H.half(x, y) : sh.z) + (o.dz || 0)
        pts.push([x, y, s * z])
      }
      if (o.closeBow) pts.push([x1 + 0.02, H.sheerAt(x1).y + (o.dy || 0), 0])
      c.tube(pts, r, mat, { seg: o.seg || 80, rs: o.rs || 8 })
    })
  }

  /* ---- airfoil (wing, empennage, blade) ----
     sts: [{ p: [x, y, z] of the leading edge, c: chord, t: relative thickness, cam: camber }] along the span.
     o.up: "y" (wing, thickness in y) or "z" (fin, thickness in z). Chord always towards -x. */
  function foilGeo(sts: any, o: any) {
    o = o || {}
    const n = o.n || 12,
      up = o.up || 'y',
      pos: any = [],
      idx = []
    let ring: any
    const cnt = 0
    function prof(st: any) {
      const out = [],
        cam = st.cam || 0
      for (let i = n; i >= 0; i--) {
        const u = (1 - Math.cos((i / n) * PI)) / 2
        out.push([u, 1])
      }
      for (let j = 1; j < n; j++) {
        const u2 = (1 - Math.cos((j / n) * PI)) / 2
        out.push([u2, -1])
      }
      return out.map(function (q) {
        const u = q[0],
          yt = 5 * st.t * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u * u * u - 0.1036 * u * u * u * u),
          cm = cam * 4 * u * (1 - u)
        const off = (q[1] * yt + cm) * st.c,
          x = st.p[0] - u * st.c
        return up === 'y' ? [x, st.p[1] + off, st.p[2]] : [x, st.p[1], st.p[2] + off]
      })
    }
    sts.forEach(function (st: any) {
      const P = prof(st)
      ring = P.length
      P.forEach(function (p) {
        pos.push(p[0], p[1], p[2])
      })
    })
    for (let a = 0; a < sts.length - 1; a++)
      for (let k = 0; k < ring; k++) {
        const k1 = (k + 1) % ring,
          p0 = a * ring + k,
          p1 = (a + 1) * ring + k,
          q0 = a * ring + k1,
          q1 = (a + 1) * ring + k1
        idx.push(p0, q0, p1, q0, q1, p1)
      }
    ;[0, sts.length - 1].forEach(function (si, e) {
      if (sts[si].noCap) return
      const ci = pos.length / 3,
        st = sts[si]
      pos.push(st.p[0] - st.c * 0.35, st.p[1], st.p[2])
      for (let k = 0; k < ring; k++) {
        const a0 = si * ring + k,
          a1 = si * ring + ((k + 1) % ring)
        if (e === 0) idx.push(ci, a1, a0)
        else idx.push(ci, a0, a1)
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    void cnt
    return G.crease(g, o.crease || 55)
  }
  /* fuselage: stations [x, yLow, yHigh, width, exponent, zCentre] smoothed; col(x,y,z) optional */
  function fuseGeo(st: any, o: any) {
    o = o || {}
    const g = G.smoothLoft(st, { smooth: o.smooth || 48, seg: o.seg || 30, p: o.p || 2.4, crease: o.crease || 70 })
    if (o.col) colorize(g, o.col)
    return g
  }
  /* inner glass shell: the same fuselage slightly smaller, cut out to leave only the window */
  function fuseGlass(c: any, st: any, keep: any, label: any, type: any, o: any) {
    o = o || {}
    const k = o.k || 0.988
    const st2 = st.map(function (s: any) {
      const cy = (s[1] + s[2]) / 2,
        hh = ((s[2] - s[1]) / 2) * k
      return [s[0], cy - hh, cy + hh, s[3] * k, s[4], s[5]]
    })
    const m = new THREE.Mesh(fuseGeo(st2, { smooth: o.smooth || 48, seg: o.seg || 30 }), o.mat || MT.glass)
    c.vehicle.add(m)
    kit.cutMesh(m, [keep], 40)
    if (o.M) m.geometry.applyMatrix4(o.M)
    return kit.asGlass(c, m, label, type || 'laminated', o.pos ? { pos: o.pos } : {})
  }
  /* paint stripe: shell 0.4% bigger, cut out (sharp edge) */
  function fuseSkin(c: any, st: any, keep: any, mat: any, o: any) {
    o = o || {}
    const k = o.k || 1.004
    const st2 = st.map(function (s: any) {
      const cy = (s[1] + s[2]) / 2,
        hh = ((s[2] - s[1]) / 2) * k
      return [s[0], cy - hh, cy + hh, s[3] * k, s[4], s[5]]
    })
    const m = c.add(fuseGeo(st2, { smooth: o.smooth || 48, seg: o.seg || 30 }), mat, 0, 0, 0, o.parent)
    m.castShadow = false
    kit.cutMesh(m, [keep], 40)
    c.deform.push(m)
    return m
  }
  function bandT(f: any) {
    return { sdf: f }
  }
  /* cut tests: inside the box (cut) / outside the box (keep); zMin limits to one side only */
  function inBox(b: any) {
    return function (x: any, y: any, z: any) {
      return Math.max(
        b[0] - x,
        x - b[1],
        b[2] - y,
        y - b[3],
        (b[4] == null ? -9 : b[4]) - Math.abs(z),
        Math.abs(z) - (b[5] == null ? 9 : b[5]),
      )
    }
  }
  function cutT(b: any, sel: any) {
    return { sel: sel || null, sdf: inBox(b) }
  }
  function keepT(b: any, sel: any) {
    const f = inBox(b)
    return {
      sel: sel || null,
      sdf: function (x: any, y: any, z: any) {
        return -f(x, y, z)
      },
    }
  }
  /* window by polygon in the x-y plane (side), cut only on side faces */
  function polySdf(poly: any) {
    return function (x: any, y: any) {
      let inside = false,
        d = 1e9
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i],
          b = poly[j]
        if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside
        const vx = b[0] - a[0],
          vy = b[1] - a[1],
          wx = x - a[0],
          wy = y - a[1],
          t = clamp((wx * vx + wy * vy) / (vx * vx + vy * vy), 0, 1)
        d = Math.min(d, Math.hypot(wx - vx * t, wy - vy * t))
      }
      return inside ? -d : d
    }
  }
  function sideCutP(poly: any, zMin: any) {
    const f = polySdf(poly)
    return {
      sel: function (n: any) {
        return Math.abs(n.z) > 0.3
      },
      sdf: function (x: any, y: any, z: any) {
        return Math.max(f(x, y), (zMin || 0) - Math.abs(z))
      },
    }
  }
  function sideKeepP(poly: any, zMin: any, side: any) {
    const f = polySdf(poly)
    return {
      sdf: function (x: any, y: any, z: any) {
        return -Math.max(f(x, y), (zMin || 0) - (side ? side * z : Math.abs(z)))
      },
    }
  }

  /* ---- propeller: twisted and tapered blades, hub and spinner. Outer group rigid (inclination), inner turns in x ---- */
  function propeller(c: any, x: any, y: any, z: any, o: any) {
    o = o || {}
    const R = o.R || 0.95,
      nb = o.blades || 2,
      mat = o.mat || CM('#232426', { roughness: 0.5, metalness: 0.3 }),
      tip = o.tip === false ? null : CM(o.tip || '#d8d8d2', { roughness: 0.5 })
    const outer = new THREE.Group()
    outer.position.set(x, y, z)
    if (o.pitch) outer.rotation.z = o.pitch
    outer.userData.rigid = true
    ;(o.parent || c.vehicle).add(outer)
    const g = new THREE.Group()
    outer.add(g)
    for (let i = 0; i < nb; i++) {
      const piv = new THREE.Group()
      piv.rotation.x = (i / nb) * PI * 2 + (o.phase || 0.4)
      g.add(piv)
      const bl = G.roundedBox(0.035, R - 0.08, o.chord || 0.15, 0.012)
      bl.translate(0, (R - 0.08) / 2 + 0.08, 0)
      const p = bl.attributes.position
      for (let k = 0; k < p.count; k++) {
        const yy = p.getY(k),
          t = yy / R,
          ch = 1 - 0.45 * t - (t > 0.85 ? (t - 0.85) * 2.5 : 0),
          tw = (o.tw0 || 0.75) - 0.5 * t,
          zz = p.getZ(k) * ch,
          xx = p.getX(k)
        p.setXYZ(k, xx * Math.cos(tw) - zz * Math.sin(tw), yy, xx * Math.sin(tw) + zz * Math.cos(tw))
      }
      bl.computeVertexNormals()
      const b = new THREE.Mesh(bl, mat)
      b.castShadow = true
      piv.add(b)
      if (tip) {
        const tp = new THREE.Mesh(G.roundedBox(0.04, 0.1, (o.chord || 0.15) * 0.55, 0.012), tip)
        tp.position.y = R - 0.06
        tp.rotation.y = -((o.tw0 || 0.75) - 0.5)
        piv.add(tp)
      }
    }
    if (o.spinner !== false) {
      const sl = o.spinL || 0.36,
        sr = o.spinR || 0.15,
        sp = new THREE.Mesh(
          new THREE.SphereGeometry(sr, 20, 12, 0, PI * 2, 0, PI / 2),
          CM(o.spinCol || '#d9d7d0', { metalness: 0.35, roughness: 0.35 }),
        )
      sp.rotation.z = -PI / 2
      sp.scale.set(1, sl / sr, 1)
      g.add(sp)
      const bp = new THREE.Mesh(
        new THREE.CylinderGeometry(sr, sr, 0.06, 20),
        CM(o.spinCol || '#d9d7d0', { metalness: 0.35, roughness: 0.35 }),
      )
      bp.rotation.z = PI / 2
      bp.position.x = -0.03
      g.add(bp)
    }
    c.spin.push({ o: g, axis: 'x', v: o.v == null ? 7 : o.v })
    return g
  }
  /* main rotor: thin-profile blades with a tip, hub, plates and rods; o.axis "y" (default) */
  function mainRotor(c: any, x: any, y: any, z: any, o: any) {
    o = o || {}
    const nb = o.blades || 2,
      R = o.R || 5,
      ch = o.chord || 0.27,
      mat = o.mat || CM('#1e2023', { roughness: 0.5 }),
      hub = o.hub || 0.25
    const g = new THREE.Group()
    g.position.set(x, y, z)
    c.vehicle.add(g)
    for (let i = 0; i < nb; i++) {
      const piv = new THREE.Group()
      piv.rotation.y = (i / nb) * PI * 2 + (o.phase || 0.3)
      g.add(piv)
      const L = R - hub,
        geo = foilGeo(
          [
            { p: [ch / 3, 0, hub], c: ch, t: 0.12 },
            { p: [ch / 3, -(o.droop || 0) * 0.3, hub + L * 0.5], c: ch, t: 0.12 },
            { p: [ch / 3, -(o.droop || 0), R], c: ch, t: 0.1 },
          ],
          { up: 'y', n: 6 },
        )
      geo.rotateY(PI / 2) /* span along +x */
      const b = new THREE.Mesh(geo, mat)
      b.castShadow = true
      piv.add(b)
      if (o.tipCol) {
        const tp = new THREE.Mesh(G.roundedBox(0.25, ch * 0.105, ch * 0.96, 0.008), CM(o.tipCol, { roughness: 0.5 }))
        tp.position.set(R - 0.14, -(o.droop || 0) * 0.97, ch / 6)
        piv.add(tp)
      }
      const grip = new THREE.Mesh(G.roundedBox(hub + 0.2, 0.08, 0.1, 0.03), MT.steel)
      grip.position.x = (hub + 0.2) / 2
      piv.add(grip)
    }
    const hb = new THREE.Mesh(new THREE.CylinderGeometry(o.hubR || 0.13, o.hubR || 0.13, 0.16, 16), MT.steel)
    g.add(hb)
    if (o.cap) {
      const cp = new THREE.Mesh(new THREE.SphereGeometry(o.hubR || 0.13, 14, 8, 0, PI * 2, 0, PI / 2), MT.steel)
      cp.position.y = 0.08
      g.add(cp)
    }
    c.spin.push({ o: g, axis: 'y', v: o.v || 3.2 })
    return g
  }
  /* tail rotor: group at the point, turns in z (blades in the x-y plane), side +1/-1 only for the hub position */
  function tailRotorE(c: any, x: any, y: any, z: any, o: any) {
    o = o || {}
    const nb = o.blades || 2,
      R = o.R || 0.73,
      ch = o.chord || 0.12,
      mat = o.mat || CM('#e6e4dd', { roughness: 0.5 })
    const g = new THREE.Group()
    g.position.set(x, y, z)
    c.vehicle.add(g)
    for (let i = 0; i < nb; i++) {
      const p = new THREE.Group()
      p.rotation.z = (i / nb) * PI * 2 + (o.phase || 0.6)
      g.add(p)
      const b = new THREE.Mesh(G.roundedBox(ch, R - 0.06, 0.018, 0.008), mat)
      b.position.y = (R - 0.06) / 2 + 0.06
      b.rotation.y = 0.2
      b.castShadow = true
      p.add(b)
      if (o.tipCol) {
        const t = new THREE.Mesh(G.roundedBox(ch * 1.03, 0.12, 0.02, 0.006), CM(o.tipCol))
        t.position.y = R - 0.06
        p.add(t)
      }
    }
    const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12), MT.steel)
    hb.rotation.x = PI / 2
    g.add(hb)
    c.spin.push({ o: g, axis: 'z', v: o.v || 12 })
    return g
  }
  /* navigation/position light: lens over an emissive bulb, breaks like a taillight */
  const NAV: any = {
    red: CM('#9a1c14', { emissive: new THREE.Color('#e0281c'), emissiveIntensity: 1.3, roughness: 0.3 }),
    green: CM('#1d7a3a', { emissive: new THREE.Color('#2fe06a'), emissiveIntensity: 1.2, roughness: 0.3 }),
    white: CM('#f2f0e8', { emissive: new THREE.Color('#fff6dc'), emissiveIntensity: 1.4, roughness: 0.3 }),
    amber: CM('#c8781e', { emissive: new THREE.Color('#ffa030'), emissiveIntensity: 1.2, roughness: 0.3 }),
    blue: CM('#1d4f9a', { emissive: new THREE.Color('#3a7cff'), emissiveIntensity: 1.4, roughness: 0.3 }),
  }
  const HALO: any = { red: '#ff3a2a', green: '#3aff7a', white: '#fff1d0', amber: '#ffb040', blue: '#4a8cff' }
  function navLight(c: any, x: any, y: any, z: any, color: any, label: any, o: any) {
    o = o || {}
    const r = o.r || 0.045,
      g = new THREE.Group()
    g.position.set(x, y, z)
    g.userData.rigid = true
    ;(o.parent || c.vehicle).add(g)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.1, r * 1.2, r * 0.8, 12), MT.housing)
    base.position.y = -r * 0.4
    if (o.rot) base.rotation.set(o.rot[0], o.rot[1], o.rot[2])
    g.add(base)
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 10, 8), NAV[color] || NAV.white)
    g.add(bulb)
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(r, 12, 8),
      color === 'red' ? MT.lensRed : color === 'amber' ? MT.lensAmber : MT.lens,
    )
    lens.renderOrder = 3
    g.add(lens)
    const L: any = {
      group: g,
      inner: [bulb],
      lens: [lens],
      kind: o.front ? 'headlight' : 'taillight',
      tint: color === 'red' ? 'red' : 'clear',
      broken: false,
    }
    if (o.halo !== false) L.halo = [kit.halo(g, 0, 0, 0, o.hs || 0.35, HALO[color] || '#ffffff', 0.5)]
    c.lights.push(L)
    const pt = c.part(o.front ? 'headlight' : 'taillight', label, g, new V3(x, y, z), o.reach || 0.5)
    pt.light = L
    return L
  }
  /* round landing light/spotlight, pointing to +x (or rotY) */
  function lamp(c: any, x: any, y: any, z: any, r: any, label: any, o: any) {
    o = o || {}
    return kit.headlight(c, {
      style: 'round',
      x: x,
      y: y,
      z: z,
      w: r * 2,
      h: r * 2,
      d: o.d || 0.08,
      side: z >= 0 ? 1 : -1,
      yaw: o.yaw || 0,
      label: label,
      reach: o.reach || 0.6,
    })
  }
  /* Flattens a group assembled separately (e.g. a tail-down tilted plane) into direct children of c.g,
     preserving the pose (the core dents, folds and finds parts only on direct children of c.g). */
  function bake(c: any, grp: any) {
    grp.updateMatrix()
    const M = grp.matrix
    grp.children.slice().forEach(function (o: any) {
      o.updateMatrix()
      const m = new THREE.Matrix4().multiplyMatrices(M, o.matrix)
      grp.remove(o)
      m.decompose(o.position, o.quaternion, o.scale)
      /* mesh: the rotation goes to the vertices (tight bounding box for the zones and the settling); the position stays */
      if (o.isMesh && o.geometry) {
        o.geometry.applyMatrix4(new THREE.Matrix4().compose(new V3(), o.quaternion, o.scale))
        o.geometry.computeBoundingBox()
        o.quaternion.identity()
        o.scale.set(1, 1, 1)
      }
      c.vehicle.add(o)
    })
    if (grp.parent) grp.parent.remove(grp)
  }
  /* plane/helicopter panel: dark top, round gauges and screens */
  function instPanel(c: any, x: any, y: any, w: any, o: any) {
    o = o || {}
    const h = o.h || 0.26,
      tilt = o.tilt || 0.15
    c.roundBox(0.16, h, w, 0.04, CM('#232427', { roughness: 0.8 }), x, y, 0, { rot: [0, 0, tilt] })
    c.roundBox(0.26, 0.04, w + 0.04, 0.015, CM('#18191b', { roughness: 0.9 }), x + 0.06, y + h / 2 + 0.01, 0)
    const nG = o.gauges || 6,
      nx = Math.ceil(nG / 2)
    for (let i = 0; i < nG; i++) {
      const col = i % nx,
        row = (i / nx) | 0,
        zz = (o.z0 == null ? -w * 0.32 : o.z0) + col * 0.095,
        yy = y + 0.05 - row * 0.1
      const gg = c.cylinder(0.038, 0.038, 0.012, MT.gauge, x - 0.085, yy, zz, 'x', { seg: 16 })
      gg.castShadow = false
    }
    ;(o.screens || []).forEach(function (s: any) {
      const sc = c.roundBox(0.012, s[2], s[3], 0.008, MT.screen, x - 0.085, y + s[0], s[1])
      sc.castShadow = false
    })
  }
  /* helicopter stick (cyclic) and collective */
  function cyclic(c: any, x: any, fl: any, z: any) {
    c.rod(new V3(x, fl, z), new V3(x - 0.04, fl + 0.55, z), 0.014, MT.plastic)
    c.roundBox(0.04, 0.12, 0.04, 0.015, MT.plastic, x - 0.05, fl + 0.6, z)
  }
  function collective(c: any, x: any, fl: any, z: any) {
    c.rod(new V3(x - 0.35, fl + 0.18, z), new V3(x + 0.05, fl + 0.32, z), 0.016, MT.plastic)
    c.cylinder(0.022, 0.022, 0.1, MT.plastic, x + 0.07, fl + 0.33, z, 'x')
  }
  function pedals(c: any, x: any, fl: any, z: any) {
    ;[-0.09, 0.09].forEach(function (d) {
      c.roundBox(0.05, 0.14, 0.08, 0.015, MT.steel, x, fl + 0.1, z + d, { rot: [0, 0, 0.5] })
    })
  }

  /* outboard motor: rigid group fixed to the transom (x = transom, y = top of the transom). k = scale (1 about 40 hp, 1.7 about 250 hp) */
  function outboard(c: any, x: any, y: any, z: any, o: any) {
    o = o || {}
    const k = o.k || 1,
      col = CM(o.col || '#16181b', { roughness: 0.35, metalness: 0.25 }),
      low = CM(o.low || '#202224', { roughness: 0.4, metalness: 0.3 }),
      shaft = o.shaft || (k > 1.3 ? 0.66 : 0.52)
    const g = new THREE.Group()
    g.position.set(x, y, z)
    g.userData.rigid = true
    c.vehicle.add(g)
    const P = { parent: g }
    c.roundBox(0.1, 0.16, 0.18 * k, 0.03, MT.steel, -0.02, -0.04, 0, P)
    const cw = c.roundBox(
      0.44 * k,
      0.42 * k,
      0.32 * k,
      0.12 * k,
      col,
      -0.2 * k - 0.05,
      0.16 * k,
      0,
      Object.assign({ taper: { sx: 0.82, sz: 0.85, shift: -0.03 * k } }, P),
    )
    c.roundBox(0.42 * k, 0.07 * k, 0.33 * k, 0.03 * k, CM(o.band || '#2a2c30', { roughness: 0.5 }), -0.2 * k - 0.05, -0.02 * k, 0, P)
    c.roundBox(0.17 * k, shaft, 0.11 * k, 0.04 * k, low, -0.16 * k, -shaft / 2 - 0.02, 0, P)
    c.roundBox(0.36 * k, 0.018, 0.2 * k, 0.008, low, -0.17 * k, -shaft - 0.01, 0, P)
    c.cylinder(0.055 * k, 0.05 * k, 0.32 * k, low, -0.2 * k, -shaft - 0.09 * k, 0, 'x', P)
    c.roundBox(0.16 * k, 0.12 * k, 0.025, 0.01, low, -0.18 * k, -shaft - 0.17 * k, 0, P)
    const pr = propeller(c, -0.38 * k, -shaft - 0.09 * k, 0, {
      R: 0.17 * k,
      blades: 3,
      chord: 0.11 * k,
      spinner: false,
      tip: false,
      mat: CM('#3a3c3f', { metalness: 0.6, roughness: 0.35 }),
      parent: g,
      v: 0,
      tw0: 0.9,
    })
    if (o.tiller) {
      c.rod(new V3(-0.05, 0.12 * k, 0), new V3(0.45, 0.2 * k, 0.05), 0.022, MT.plastic, P)
      c.cylinder(0.03, 0.03, 0.14, MT.rubber, 0.47, 0.2 * k, 0.05, 'x', P)
    }
    if (o.label) c.text(o.label, 0.26 * k, 0.07 * k, -0.2 * k - 0.05, 0.2 * k, 0.165 * k, '+z', { fg: o.lc || '#d8d8d8', parent: g })
    if (o.label) c.text(o.label, 0.26 * k, 0.07 * k, -0.2 * k - 0.05, 0.2 * k, -0.165 * k, '-z', { fg: o.lc || '#d8d8d8', parent: g })
    g.userData.cowl = cw
    g.userData.prop = pr
    return g
  }
  /* mooring cleat and bow navigation light (two-colour) */
  function cleat(c: any, x: any, y: any, z: any, r: any) {
    r = r || 1
    c.roundBox(0.16 * r, 0.03, 0.04, 0.012, MT.chrome, x, y + 0.04, z)
    c.roundBox(0.04, 0.04, 0.03, 0.01, MT.chrome, x, y + 0.02, z)
  }
  /* paint skin over a finished mesh (hull stripe): a slightly inflated copy in z, cut out by the keep test */
  function skinOf(c: any, mesh: any, keep: any, mat: any, o: any) {
    o = o || {}
    const g = mesh.geometry.clone(),
      p = g.attributes.position,
      sz = o.sz || 1.006,
      dy = o.dy || 0
    for (let i = 0; i < p.count; i++) {
      p.setZ(i, p.getZ(i) * sz)
      p.setY(i, p.getY(i) + dy * Math.sign(p.getY(i)))
    }
    if (g.attributes.color) g.deleteAttribute('color')
    const m = c.add(g, mat, mesh.position.x, mesh.position.y, mesh.position.z)
    m.castShadow = false
    kit.cutMesh(m, [keep], 40, o.sub ? { sub: o.sub } : undefined)
    c.deform.push(m)
    return m
  }
  /* wraparound windshield: points in plan [x, z] (base), height h, top setback, at y0; tempered glass with a frame */
  function wrapShield(c: any, pts: any, y0: any, h: any, rake: any, label: any, o: any) {
    o = o || {}
    const pos: any = [],
      idx = [],
      n = pts.length
    pts.forEach(function (q: any) {
      pos.push(q[0], y0, q[1], q[0] - rake, y0 + h, q[1] * (o.pinch || 0.97))
    })
    for (let i = 0; i < n - 1; i++) {
      const a = 2 * i
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    const m = c.add(g, o.mat || MT.glass)
    const top = pts.map(function (q: any) {
      return [q[0] - rake, y0 + h, q[1] * (o.pinch || 0.97)]
    })
    if (o.frame !== false) c.tube(top, 0.014, o.frameMat || MT.chrome, { seg: 40, rs: 6 })
    return kit.asGlass(c, m, label, o.type || 'tempered', o.pos ? { pos: o.pos } : {})
  }
  /* stainless lifeline / stanchion rail: tube through points with feet at every step */
  function rail(c: any, pts: any, h: any, r: any, every: any) {
    const top = pts.map(function (p: any) {
      return [p[0], p[1] + h, p[2]]
    })
    c.tube(top, r || 0.016, MT.chrome, { seg: 60, rs: 6 })
    pts.forEach(function (p: any, i: any) {
      if (i % (every || 2) === 0) c.rod(new V3(p[0], p[1], p[2]), new V3(p[0], p[1] + h, p[2]), (r || 0.016) * 0.75, MT.chrome, { seg: 6 })
    })
  }
  /* variable-radius tube through points (inflatable boat, fender): rf(u) gives the radius at u = 0..1 */
  function sweepGeo(pts: any, rf: any, o: any) {
    o = o || {}
    const n = o.n || 80,
      rs = o.rs || 16,
      curve = new THREE.CatmullRomCurve3(
        pts.map(function (p: any) {
          return new V3(p[0], p[1], p[2])
        }),
        false,
        'centripetal',
      )
    const pos = [],
      idx = [],
      up = new V3(0, 1, 0),
      T = new V3(),
      N = new V3(),
      B = new V3(),
      P = new V3()
    for (let i = 0; i <= n; i++) {
      const u = i / n
      curve.getPointAt(u, P)
      curve.getTangentAt(u, T)
      B.crossVectors(T, up)
      if (B.lengthSq() < 1e-6) B.set(0, 0, 1)
      B.normalize()
      N.crossVectors(B, T).normalize()
      const r = rf(u)
      for (let j = 0; j <= rs; j++) {
        const a = (j / rs) * PI * 2,
          cs = Math.cos(a),
          sn = Math.sin(a)
        pos.push(P.x + (N.x * cs + B.x * sn) * r, P.y + (N.y * cs + B.y * sn) * r, P.z + (N.z * cs + B.z * sn) * r)
      }
    }
    for (let a2 = 0; a2 < n; a2++)
      for (let k = 0; k < rs; k++) {
        const p0 = a2 * (rs + 1) + k,
          p1 = p0 + rs + 1
        idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1)
      }
    ;[0, n].forEach(function (ii, e) {
      curve.getPointAt(ii / n, P)
      const ci = pos.length / 3
      pos.push(P.x, P.y, P.z)
      for (let k = 0; k < rs; k++) {
        const a0 = ii * (rs + 1) + k
        if (e === 0) idx.push(ci, a0, a0 + 1)
        else idx.push(ci, a0 + 1, a0)
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }
  /* name painted on the flank: plane rotated to the hull tangent and offset enough so the ends do not enter the curve of the bow (reviewer) */
  function hullText(c: any, H: any, txt: any, w: any, h: any, x: any, y: any, s: any, o: any) {
    o = o || {}
    const d = 0.05,
      m = (H.half(x + d, y) - H.half(x - d, y)) / (2 * d),
      z0 = H.half(x, y)
    let off = o.off || 0.012
    for (let i = -4; i <= 4; i++) {
      const xi = x + (i / 8) * w,
        dy = [-h / 2, 0, h / 2]
      dy.forEach(function (e) {
        const g = H.half(xi, y + e) - (z0 + m * (xi - x))
        if (g + 0.008 > off) off = g + 0.008
      })
    }
    const t = c.text(txt, w, h, x, y, s * (z0 + off), s > 0 ? '+z' : '-z', o)
    t.rotation.y += s > 0 ? -Math.atan(m) : Math.atan(m)
    return t
  }
  shared.EA = {
    colorize: colorize,
    tab: tab,
    tabL: tabL,
    mix: mix,
    sstep: sstep,
    boatHull: boatHull,
    deckGeo: deckGeo,
    sheerTube: sheerTube,
    foilGeo: foilGeo,
    fuseGeo: fuseGeo,
    fuseGlass: fuseGlass,
    fuseSkin: fuseSkin,
    bandT: bandT,
    cutT: cutT,
    keepT: keepT,
    sideCutP: sideCutP,
    sideKeepP: sideKeepP,
    polySdf: polySdf,
    propeller: propeller,
    mainRotor: mainRotor,
    tailRotor: tailRotorE,
    navLight: navLight,
    lamp: lamp,
    bake: bake,
    instPanel: instPanel,
    sweepGeo: sweepGeo,
    skinOf: skinOf,
    wrapShield: wrapShield,
    rail: rail,
    outboard: outboard,
    hullText: hullText,
    cleat: cleat,
    cyclic: cyclic,
    collective: collective,
    pedals: pedals,
    NAV: NAV,
  }

  /* ================= boats ================= */
  /* Reference · Levefort Marajo (aluminium boat with an outboard motor) - measurements from memory (the maker sheet did not show up in the search)
     Real measurements: length 5.00 m · beam 1.60 m · depth 0.58 m · draft about 0.15 m · freeboard about 0.42 m · 2 mm aluminium plate ·
     3 cross benches · 15 to 40 hp outboard with a short shaft and a tiller.
     Signature traits:
     front: fine V bow that rises little, small foredeck with a cleat, thick aluminium rim trim
     side: almost straight rim, smooth plate flank with rivet lines, semi-flat bottom, straight low transom with a tiller motor
     rear: wide straight transom with a central reinforcement, black motor with a short shaft, portable red tank on the floor
     top: open hull with three aluminium benches, frames on the floor, bow tapering from 60% of the length */
  fx.register(
    {
      key: 'river_skiff',
      group: 'water',
      name: trl('vehicles.river_skiff.name'),
      inspired: trl('vehicles.river_skiff.inspired'),
      article: trl('vehicles.river_skiff.article'),
      category: trl('vehicles.river_skiff.category'),
      fuel: 'gasoline',
      description: trl('vehicles.river_skiff.description'),
      mass: 150,
      noise: 90,
      seats: trl('vehicles.river_skiff.seats'),
      capacity: trl('vehicles.river_skiff.capacity'),
      efficiency: trl('vehicles.river_skiff.efficiency'),
      range: trl('vehicles.river_skiff.range'),
      maxSpeed: 50,
      skill: trl('vehicles.river_skiff.skill'),
      hood: false,
    },
    function (c) {
      const EA = shared.EA,
        tb = EA.tab,
        alu = CM('#9aa1a6', { metalness: 0.65, roughness: 0.38, side: DS }),
        aluD = CM('#7d8489', { metalness: 0.6, roughness: 0.45, side: DS })
      const L = 5.0,
        x0 = -2.5
      const H = EA.boatHull({
        x0: x0,
        L: L,
        n: 40,
        m1: 5,
        m2: 6,
        q: 1.2,
        fl: 0.9,
        keel: tb([
          [0, -0.15],
          [0.55, -0.16],
          [0.85, -0.02],
          [1, 0.36],
        ]),
        chine: function (t: any) {
          return [
            tb([
              [0, 0.62],
              [0.55, 0.62],
              [0.9, 0.3],
              [1, 0.0],
            ])(t),
            tb([
              [0, -0.1],
              [0.55, -0.1],
              [0.85, 0.06],
              [1, 0.38],
            ])(t),
          ]
        },
        sheer: function (t: any) {
          return [
            tb([
              [0, 0.755],
              [0.6, 0.772],
              [0.88, 0.49],
              [1, 0.0],
            ])(t),
            tb([
              [0, 0.42],
              [0.7, 0.43],
              [1, 0.52],
            ])(t),
          ]
        },
        col: null,
      })
      const hull = c.add(H.geo, c.paint('#9aa1a6', { metalness: 0.65, roughness: 0.38 }))
      c.deform.push(hull)
      /* rim trim, chines, rivet lines and frames */
      EA.sheerTube(c, H, x0 + 0.02, 2.46, 0.028, aluD, { closeBow: true })
      for (let x = -2.2; x < 1.4; x += 0.45) {
        const hw = H.half(x, -0.06)
        c.roundBox(0.035, 0.035, hw * 2 - 0.05, 0.01, aluD, x, -0.08, 0)
      }
      ;[1, -1].forEach(function (s) {
        const pts = []
        for (let i = 0; i <= 16; i++) {
          const xx = x0 + 0.1 + (i / 16) * 3.9
          pts.push([xx, 0.2, s * (H.half(xx, 0.2) + 0.004)])
        }
        c.tube(pts, 0.006, aluD, { seg: 40, rs: 4 })
        EA.hullText(c, H, trl('texts.maraj'), 0.8, 0.14, 0.9, 0.3, s, { fg: '#1e2a33' })
      })
      /* plywood floor, aluminium benches (L section), foredeck */
      const fy = -0.07,
        flr = c.add(
          EA.deckGeo(H, -2.35, 1.5, {
            y: function () {
              return fy
            },
            inset: 0.03,
            n: 16,
            m: 6,
          }),
          CM('#5c4a35', { roughness: 0.9, side: DS }),
        )
      flr.castShadow = false
      ;[-1.55, -0.15, 1.05].forEach(function (x) {
        const hw = H.half(x, 0.3) - 0.01
        c.roundBox(0.3, 0.035, hw * 2, 0.01, alu, x, 0.3, 0)
        c.roundBox(0.03, 0.34, H.half(x, -0.02) * 2 - 0.04, 0.01, alu, x - 0.14, 0.13, 0)
        c.seatTops.push({ x: x, y: 0.32, z: 0, w: hw * 2 - 0.1, l: 0.3 })
      })
      const bd = c.add(EA.deckGeo(H, 1.75, 2.48, { n: 8, m: 8, crown: 0.02, lift: -0.005 }), alu)
      c.deform.push(bd)
      EA.cleat(c, 2.15, 0.48, 0, 0.8)
      /* reinforced transom, 30 hp tiller outboard, portable tank, oar */
      c.roundBox(0.06, 0.5, 0.42, 0.02, aluD, x0 + 0.05, 0.18, 0)
      const motor = EA.outboard(c, x0, 0.44, 0, { k: 0.85, tiller: true, label: trl('labels.n_30_hp') })
      const tank = c.roundBox(0.48, 0.24, 0.3, 0.06, CM('#a3241c', { roughness: 0.5 }), -2.05, 0.06, -0.38)
      c.rod(new V3(-2.0, 0.18, -0.38), new V3(-2.3, 0.4, -0.1), 0.01, CM('#1b1b1b'))
      c.roundBox(1.8, 0.03, 0.1, 0.01, MT.wood, -0.6, 0.0, 0.5, { rot: [0.3, 0, 0] })
      c.roundBox(0.35, 0.03, 0.14, 0.02, MT.wood, 0.45, 0.0, 0.5, { rot: [0.3, 0, 0] })
      /* white stern light (removable mast) and bow two-colour light */
      c.rod(new V3(-2.35, 0.42, 0.6), new V3(-2.35, 1.1, 0.6), 0.012, MT.chrome)
      EA.navLight(c, -2.35, 1.13, 0.6, 'white', trl('labels.stern_light_mast'), { r: 0.035 })
      EA.navLight(c, 2.3, 0.53, 0.06, 'green', trl('labels.starboard_bow_light_green'), { r: 0.03 })
      EA.navLight(c, 2.3, 0.53, -0.06, 'red', trl('labels.port_bow_light_red'), { r: 0.03 })
      c.part('hull', trl('labels.hull'), hull, new V3(0, -0.05, 0), 1.6)
      c.part('stern', trl('labels.outboard_motor'), motor, new V3(-2.75, 0.4, 0), 0.9)
      c.part('fuel_tank', trl('labels.portable_tank'), tank, new V3(-2.05, 0.06, -0.38), 0.6)
      Object.assign(c.meta, {
        kind: 'boat',
        length: L,
        width: 1.6,
        front: 2.5,
        rear: -2.95,
        clearance: -0.16,
        belt: 0.43,
        bodyHeight: 0.6,
        top: 0.6,
        roof: null,
      })
      c.zone('deck', trl('labels.seats_floor_and_bow_deck'))
      c.zone('taillight_center', trl('labels.bow_navigation_lights'))
      c.zone('taillight_right', trl('labels.stern_light'))
      c.meta.armor = function (c2: any) {
        /* modified: riveted steel plates on the flank, wire cage in front of the helmsman, cans and spotlight on the bow bench */
        const stl = kit.steelMaterial
        ;[1, -1].forEach(function (s) {
          for (let x2 = -2.1; x2 < 1.3; x2 += 0.7)
            c2.roundBox(0.66, 0.3, 0.015, 0.01, stl, x2 + 0.33, 0.6, s * (H.half(x2 + 0.33, 0.42) + 0.01))
        })
        for (let z = -0.6; z <= 0.61; z += 0.15) c2.rod(new V3(-1.3, 0.32, z), new V3(-1.25, 1.05, z * 0.9), 0.008, stl)
        c2.rod(new V3(-1.27, 1.05, -0.55), new V3(-1.27, 1.05, 0.55), 0.015, stl)
        ;[0.25, -0.05, -0.35].forEach(function (z, i) {
          kit.jerryCan(c2, -0.7, 0.04, z, i % 2 ? '#3e5a34' : '#8e2a20')
        })
        c2.cylinder(0.1, 0.08, 0.16, MT.steel, 1.25, 0.42, 0, 'x')
        EA.lamp(c2, 1.33, 0.42, 0.0001, 0.07, trl('labels.spotlight'))
      }
    },
  )

  /* Reference · Fibrafort Focker 240/242 GTO (WebSearch: itboat "Focker 242 GTO Outboard"; the 240 is the previous generation of the same hull)
     Real measurements: length 7.26 m · beam 2.59 m · draft 0.40 m · tank 140 L · up to 10 people · one 200 to 250 hp outboard ·
     21 degree V at the transom · freeboard about 0.8 m at the stern and about 1.0 m at the bow (from memory).
     Signature traits:
     front: open bow (bowrider) with U cushions, short stainless lifeline, two-colour light on the stem, deep V
     side: sheer rising to the bow, dark wedge-shaped graphic stripe, black trim, low sloped wraparound windshield
     rear: transom with a large black outboard, bathing platforms on both sides, stainless ladder, white light mast
     top: two consoles (driver on the right, passenger on the left) with a central walkway in the windshield, L sofa at the stern */
  fx.register(
    {
      key: 'speedboat',
      group: 'water',
      name: trl('vehicles.speedboat.name'),
      inspired: trl('vehicles.speedboat.inspired'),
      article: trl('vehicles.speedboat.article'),
      category: trl('vehicles.speedboat.category'),
      fuel: 'gasoline',
      description: trl('vehicles.speedboat.description'),
      mass: 1490,
      noise: 110,
      seats: trl('vehicles.speedboat.seats'),
      capacity: trl('vehicles.speedboat.capacity'),
      efficiency: trl('vehicles.speedboat.efficiency'),
      range: trl('vehicles.speedboat.range'),
      maxSpeed: 85,
      skill: trl('vehicles.speedboat.skill'),
      hood: false,
    },
    function (c) {
      const EA = shared.EA,
        tb = EA.tab,
        L = 7.26,
        x0 = -3.63
      const white = c.paint('#ecebe5', { roughness: 0.3, metalness: 0.1 }),
        navy = c.paint('#1f2f4a', { roughness: 0.3, metalness: 0.1 }),
        vinyl = CM('#e3ddd0', { roughness: 0.65 }),
        _vinylD = CM('#3c4a5c', { roughness: 0.65 }),
        teak = CM('#8a6a45', { roughness: 0.8 })
      const H = EA.boatHull({
        x0: x0,
        L: L,
        n: 44,
        m1: 6,
        m2: 6,
        q: 0.85,
        fl: 0.75,
        keel: tb([
          [0, -0.4],
          [0.5, -0.42],
          [0.8, -0.3],
          [0.95, 0.22],
          [1, 0.95],
        ]),
        chine: function (t: any) {
          return [
            tb([
              [0, 1.05],
              [0.55, 1.1],
              [0.85, 0.72],
              [1, 0.0],
            ])(t),
            tb([
              [0, -0.02],
              [0.6, 0.0],
              [0.9, 0.38],
              [1, 0.95],
            ])(t),
          ]
        },
        sheer: function (t: any) {
          return [
            tb([
              [0, 1.27],
              [0.55, 1.29],
              [0.8, 1.06],
              [0.95, 0.45],
              [1, 0.0],
            ])(t),
            tb([
              [0, 0.78],
              [0.6, 0.83],
              [1, 1.03],
            ])(t),
          ]
        },
      })
      const hull = c.add(H.geo, white)
      c.deform.push(hull)
      /* bottom with antifouling paint, wedge graphic stripe and thread */
      EA.skinOf(
        c,
        hull,
        EA.bandT(function (x: any, y: any) {
          return 0.02 - y
        }),
        c.paint('#2a3340', { roughness: 0.5 }),
        { sz: 1.004, dy: 0.003 },
      )
      /* reviewer: wedge redone as a smooth curve (thin thread at the stern that thickens to the bow and ends in a rounded point), cut out in a subdivided mesh */
      EA.skinOf(
        c,
        hull,
        EA.bandT(function (x: any, y: any, z: any) {
          const yc = 0.34 + (x + 3.6) * 0.055 - EA.sstep(0.6, 2.3, x) * 0.05,
            hw = 0.018 + 0.11 * EA.sstep(-1.6, 1.3, x),
            tip = (2.3 - x) * 0.35
          return Math.min(Math.min(hw, tip) - Math.abs(y - yc), x + 3.55, Math.abs(z) - 0.3)
        }),
        navy,
        { sz: 1.006, sub: 0.05 },
      )
      EA.sheerTube(c, H, x0 + 0.01, 3.6, 0.035, CM('#141516', { roughness: 0.6 }), { closeBow: true })
      /* rim (cap) and side decks, foredeck with an anchor locker */
      const side = c.add(
        EA.deckGeo(H, x0 + 0.05, 2.6, {
          inner: function (x: any) {
            return H.sheerAt(x).z - 0.2
          },
          n: 30,
          m: 3,
        }),
        white,
      )
      c.deform.push(side)
      const bow = c.add(EA.deckGeo(H, 2.6, 3.62, { n: 10, m: 8, crown: 0.03 }), white)
      c.deform.push(bow)
      c.roundBox(0.4, 0.02, 0.35, 0.01, CM('#cfcfc8'), 3.0, H.sheerAt(3.0).y + 0.03, 0)
      EA.cleat(c, 3.3, H.sheerAt(3.3).y, 0, 0.8)
      /* cockpit floor (anti-slip), U bow cushions, L sofa at the stern */
      const fy = 0.22,
        flr = c.add(
          EA.deckGeo(H, -3.5, 2.75, {
            y: function () {
              return fy
            },
            inset: 0.02,
            n: 24,
            m: 8,
          }),
          CM('#d6d2c6', { roughness: 0.85, side: DS }),
        )
      flr.castShadow = false
      ;[1, -1].forEach(function (s) {
        for (let x = 1.55; x < 2.65; x += 0.3) {
          const hw = H.half(x, 0.5) - 0.08
          c.roundBox(0.3, 0.2, 0.42, 0.06, vinyl, x, 0.45, s * (hw - 0.2), { rot: [0, s * 0.15, 0] })
        }
        c.roundBox(
          0.9,
          0.35,
          0.12,
          0.05,
          vinyl,
          2.05,
          0.68,
          s * (Math.min(H.half(1.6, 0.5), H.half(2.5, 0.5)) - 0.08),
        ) /* reviewer: backrest by the narrowest half beam of the base, so it does not pierce the flank at the bow */
        c.roundBox(2.3, 0.22, 0.5, 0.07, vinyl, -2.3, 0.45, s * 0.75)
        c.roundBox(2.3, 0.4, 0.12, 0.05, vinyl, -2.3, 0.72, s * (H.half(-2.3, 0.7) - 0.08))
      })
      c.roundBox(0.5, 0.22, 1.5, 0.07, vinyl, -3.35, 0.45, 0)
      c.roundBox(0.12, 0.42, 2.1, 0.05, vinyl, -3.52, 0.74, 0)
      c.seatTops.push(
        { x: -2.3, y: 0.57, z: 0.75, w: 0.5, l: 2.2 },
        { x: -2.3, y: 0.57, z: -0.75, w: 0.5, l: 2.2 },
        { x: 2.0, y: 0.57, z: 0, w: 1.2, l: 0.9 },
      )
      /* consoles: driver on the right with panel, wheel and throttle; passenger on the left with a glove box */
      const cy = 0.22
      c.roundBox(0.85, 0.72, 0.78, 0.12, white, 0.75, cy + 0.36, 0.72)
      c.roundBox(0.85, 0.72, 0.72, 0.12, white, 0.75, cy + 0.36, -0.74)
      c.roundBox(0.42, 0.04, 0.7, 0.015, CM('#18191b', { roughness: 0.7 }), 0.95, cy + 0.74, 0.72, { rot: [0, 0, -0.35] })
      ;[0.55, 0.72, 0.89].forEach(function (z, i) {
        c.cylinder(0.045, 0.045, 0.012, MT.gauge, 0.93 + (i === 1 ? 0.05 : 0), cy + 0.79, z, null, { seg: 16 }).rotation.set(0, 0, 1.22)
      })
      c.roundBox(0.012, 0.13, 0.2, 0.01, MT.screen, 0.86, cy + 0.83, 0.72, { rot: [0, 0, -0.35] })
      const wh = c.add(new THREE.TorusGeometry(0.17, 0.02, 8, 26), MT.chrome, 0.55, cy + 0.82, 0.62)
      wh.rotation.set(0, PI / 2, -0.55)
      c.rod(new V3(0.62, cy + 0.72, 0.62), new V3(0.55, cy + 0.82, 0.62), 0.02, MT.chrome)
      c.rod(new V3(0.55, cy + 0.7, 0.98), new V3(0.42, cy + 0.88, 1.0), 0.015, MT.chrome)
      c.sphere(0.035, MT.plastic, 0.42, cy + 0.9, 1.0)
      kit.seat(c, -0.1, cy, 0.72, { w: 0.55, h: 0.42, back: 0.48, lean: 0.12, mat: vinyl, headrest: false })
      kit.seat(c, -0.1, cy, -0.74, { w: 0.55, h: 0.42, back: 0.48, lean: 0.12, mat: vinyl, headrest: false })
      /* wraparound windshield with a central walkway */
      ;[1, -1].forEach(function (s) {
        const pts = []
        for (let i = 0; i <= 8; i++) {
          const u = i / 8,
            z = s * (0.32 + u * 0.85),
            x = 1.2 - u * u * 0.45
          pts.push([x, z])
        }
        EA.wrapShield(c, pts, cy + 0.72, 0.36, 0.22, s > 0 ? lbl('right_windshield') : lbl('left_windshield'), {
          pos: new V3(1.05, cy + 0.9, s * 0.7),
        })
      })
      /* bow lifeline, ladder and bathing platforms */
      ;[1, -1].forEach(function (s) {
        const pts = []
        for (let i = 0; i <= 6; i++) {
          const x = 2.5 + i * 0.17,
            sh = H.sheerAt(x)
          pts.push([x, sh.y + 0.02, s * (sh.z - 0.08)])
        }
        EA.rail(c, pts, 0.3, 0.015, 2)
        c.roundBox(0.55, 0.06, 0.55, 0.02, teak, x0 - 0.27, 0.27, s * 0.78)
        EA.navLight(
          c,
          3.5,
          1.06,
          s * 0.05,
          s > 0 ? 'green' : 'red',
          s > 0 ? trl('labels.starboard_bow_light_green') : trl('labels.port_bow_light_red'),
          { r: 0.03 },
        )
        EA.hullText(c, H, trl('texts.foker_240'), 0.9, 0.16, -1.6, 0.6, s, { fg: '#1f2f4a' })
      })
      ;[0, 1, 2].forEach(function (k) {
        c.roundBox(0.03, 0.02, 0.3, 0.01, MT.chrome, x0 - 0.42, 0.1 - k * 0.15, -0.78)
      })
      c.rod(new V3(x0 - 0.42, 0.28, -0.92), new V3(x0 - 0.42, -0.25, -0.92), 0.012, MT.chrome)
      c.rod(new V3(x0 - 0.42, 0.28, -0.64), new V3(x0 - 0.42, -0.25, -0.64), 0.012, MT.chrome)
      c.rod(new V3(-3.4, 0.82, 1.15), new V3(-3.4, 1.65, 1.15), 0.015, MT.chrome)
      EA.navLight(c, -3.4, 1.68, 1.15, 'white', trl('labels.overtaking_light_mast'), { r: 0.035 })
      /* 250 hp outboard */
      const motor = EA.outboard(c, x0, 0.8, 0, { k: 1.7, label: '250', col: '#121315' })
      c.part('hull', trl('labels.hull'), hull, new V3(0.5, -0.2, 0), 1.8)
      c.part('stern', trl('labels.outboard_motor'), motor, new V3(-4.1, 0.9, 0), 1.0)
      c.part('fuel_tank', trl('labels.tank_140_l'), null, new V3(-1.2, 0.05, 0), 0.8)
      Object.assign(c.meta, {
        kind: 'boat',
        length: L,
        width: 2.59,
        front: 3.63,
        rear: -4.5,
        clearance: -0.42,
        belt: 0.82,
        bodyHeight: 1.2,
        top: 1.35,
        roof: null,
      })
      c.zone('deck', trl('labels.cockpit_consoles_and_upholstery'), null, null, { alsoGlass: true })
      c.zone('taillight_center', trl('labels.bow_navigation_lights'))
      c.zone('taillight_right', trl('labels.overtaking_light'))
      c.meta.armor = function (c2: any) {
        /* modified: steel plates on the rim, grille over the windshield, cans on the sofa, spotlight on the console and a protective arch */
        const stl = kit.steelMaterial
        ;[1, -1].forEach(function (s) {
          for (let x2 = -3.3; x2 < 2.4; x2 += 0.75) {
            const sh = H.sheerAt(x2 + 0.35)
            c2.roundBox(0.72, 0.42, 0.015, 0.01, stl, x2 + 0.35, sh.y + 0.18, s * (sh.z + 0.01))
          }
        })
        for (let z = -1.1; z <= 1.11; z += 0.14) c2.rod(new V3(1.25, 0.95, z), new V3(0.95, 1.4, z * 0.95), 0.008, stl)
        ;[
          [-2.3, 0.75],
          [-2.3, -0.75],
          [-2.0, 0.75],
        ].forEach(function (q, i) {
          kit.jerryCan(c2, q[0], 0.78, q[1], i % 2 ? '#3e5a34' : '#8e2a20')
        })
        c2.tube(
          [
            [-1.4, 0.82, -1.25],
            [-1.4, 1.9, -1.0],
            [-1.4, 2.0, 0],
            [-1.4, 1.9, 1.0],
            [-1.4, 0.82, 1.25],
          ],
          0.035,
          stl,
          { seg: 30 },
        )
        EA.lamp(c2, -1.3, 2.0, 0.0001, 0.08, trl('labels.arch_spotlight'))
      }
    },
  )

  /* Reference · wooden trawler / artisanal fishing boat of the Brazilian coast (generic, measurements from memory)
     Real measurements: length 11.0 m · beam 3.6 m · draft 1.2 m (with keel and heel) · depth 1.9 m · freeboard about 0.95 m amidships,
     about 1.9 m at the bow · 2.0 x 2.2 m house aft · inboard diesel of 90 to 120 hp · fish hold amidships.
     Signature traits:
     front: tall raked stem, strong sheer rising to the bow, name painted on the bow, anchor in the hawse
     side: plank hull painted in three colours (blue, white thread, red at the bottom), hanging fender tyres,
     wooden house aft with small windows, foremast with a cargo boom, funnel behind the house
     rear: narrow panel stern with an external rudder, white light, pennant on the house mast
     top: open deck forward with a hold hatch, drum winch, piled net and fish boxes */
  fx.register(
    {
      key: 'fishing_boat',
      group: 'water',
      name: trl('vehicles.fishing_boat.name'),
      inspired: trl('vehicles.fishing_boat.inspired'),
      article: trl('vehicles.fishing_boat.article'),
      category: trl('vehicles.fishing_boat.category'),
      fuel: 'diesel',
      description: trl('vehicles.fishing_boat.description'),
      mass: 12000,
      noise: 80,
      seats: trl('vehicles.fishing_boat.seats'),
      capacity: trl('vehicles.fishing_boat.capacity'),
      efficiency: trl('vehicles.fishing_boat.efficiency'),
      range: trl('vehicles.fishing_boat.range'),
      maxSpeed: 18,
      skill: trl('vehicles.fishing_boat.skill'),
      hood: false,
    },
    function (c) {
      const EA = shared.EA,
        tb = EA.tab,
        L = 11.0,
        x0 = -5.5
      const blue = c.paint('#2f5e86', { roughness: 0.7, metalness: 0.05 }),
        wht = c.paint('#e6e3da', { roughness: 0.7, metalness: 0.05 }),
        redP = c.paint('#7a2219', { roughness: 0.8, metalness: 0.05 }),
        wood = CM('#6b4a2e', { roughness: 0.85 }),
        deckW = CM('#8a6e4c', { roughness: 0.9, side: DS })
      const H = EA.boatHull({
        x0: x0,
        L: L,
        n: 48,
        m1: 7,
        m2: 6,
        q: 0.45,
        fl: 0.9,
        keel: tb([
          [0, -0.95],
          [0.12, -1.0],
          [0.75, -1.0],
          [0.92, -0.4],
          [1, 1.6],
        ]),
        chine: function (t: any) {
          return [
            tb([
              [0, 1.15],
              [0.2, 1.55],
              [0.6, 1.62],
              [0.85, 1.05],
              [1, 0.0],
            ])(t),
            tb([
              [0, -0.15],
              [0.25, -0.45],
              [0.7, -0.45],
              [0.9, 0.3],
              [1, 1.6],
            ])(t),
          ]
        },
        sheer: function (t: any) {
          return [
            tb([
              [0, 1.3],
              [0.2, 1.72],
              [0.55, 1.8],
              [0.85, 1.3],
              [0.97, 0.35],
              [1, 0.0],
            ])(t),
            tb([
              [0, 1.3],
              [0.45, 0.98],
              [0.75, 1.15],
              [1, 1.95],
            ])(t),
          ]
        },
      })
      const hull = c.add(H.geo, blue)
      c.deform.push(hull)
      EA.skinOf(
        c,
        hull,
        EA.bandT(function (x: any, y: any) {
          return 0.05 - y
        }),
        redP,
        { sz: 1.004, dy: 0.004 },
      )
      EA.skinOf(
        c,
        hull,
        EA.bandT(function (x: any, y: any) {
          const sy = H.sheerAt(x).y
          return 0.07 - Math.abs(y - (sy - 0.18))
        }),
        wht,
        { sz: 1.006 },
      )
      /* planks: thin lines along the flank */
      ;[1, -1].forEach(function (s) {
        ;[0.25, 0.5, 0.75].forEach(function (yy) {
          const pts = []
          for (let i = 0; i <= 20; i++) {
            const x = x0 + 0.2 + (i / 20) * 9.9,
              y = yy * H.sheerAt(x).y - (1 - yy) * 0.3
            pts.push([x, y, s * (H.half(x, y) + 0.004)])
          }
          c.tube(pts, 0.006, CM('#22476a'), { seg: 60, rs: 4 })
        })
        EA.hullText(c, H, trl('texts.hope'), 1.7, 0.3, 2.4, H.sheerAt(2.4).y - 0.42, s, { fg: '#f2efe6' })
        /* fender tyres */
        ;[-3.6, -1.2, 1.2].forEach(function (x) {
          const y = H.sheerAt(x).y - 0.45,
            tr = c.add(new THREE.TorusGeometry(0.28, 0.1, 10, 22), MT.rubber, x, y, s * (H.half(x, y) + 0.1))
          tr.rotation.y = PI / 2
          c.rod(new V3(x, y + 0.28, s * (H.half(x, y) + 0.08)), new V3(x, H.sheerAt(x).y, s * H.sheerAt(x).z), 0.01, CM('#9b8a62'))
        })
      })
      /* bulwark: wooden cap, plank deck, hold hatch, winch, net, boxes */
      EA.sheerTube(c, H, x0 + 0.02, 5.45, 0.07, wood, { closeBow: true })
      const dk = function (x: any) {
        return H.sheerAt(x).y - 0.55
      }
      const deck = c.add(EA.deckGeo(H, x0 + 0.1, 5.1, { y: dk, inset: 0.05, n: 40, m: 10 }), deckW)
      deck.castShadow = false
      for (let x = x0 + 0.4; x < 4.8; x += 0.18) {
        const hw = H.half(x, dk(x)) - 0.06
        if (hw > 0.1) c.roundBox(0.012, 0.004, hw * 2, 0.002, CM('#5c4630'), x, dk(x) + 0.004, 0).castShadow = false
      }
      c.roundBox(1.4, 0.25, 1.4, 0.05, wood, 0.6, dk(0.6) + 0.12, 0)
      c.roundBox(1.2, 0.05, 1.2, 0.02, CM('#4a3a28'), 0.6, dk(0.6) + 0.27, 0)
      c.cylinder(0.25, 0.25, 0.8, CM('#5a5e60', { metalness: 0.4 }), -0.6, dk(-0.6) + 0.45, 0, 'z')
      c.roundBox(0.4, 0.4, 0.15, 0.05, CM('#3a3c3e'), -0.6, dk(-0.6) + 0.25, 0.5)
      c.sphere(0.6, CM('#2f4a2c', { roughness: 1 }), 2.4, dk(2.4) + 0.2, 0.5, 1.6, 0.45, 1.1)
      c.sphere(0.45, CM('#3d5b37', { roughness: 1 }), 3.2, dk(3.2) + 0.18, -0.4, 1.3, 0.45, 1.0)
      ;[
        [1.6, -1.0],
        [1.6, -0.55],
        [1.95, -1.0],
      ].forEach(function (q) {
        c.roundBox(0.42, 0.24, 0.32, 0.03, CM('#3f6fa0', { roughness: 0.6 }), q[0], dk(q[0]) + 0.12, q[1])
      })
      /* wooden house aft, hollow, with cut-out windows, door, roof and interior */
      const hx = -2.7,
        hy0 = dk(hx),
        hh = 1.9,
        hw2 = 1.1,
        cas = c.roundBox(2.0, hh, hw2 * 2, 0.08, wht, hx, hy0 + hh / 2, 0, { def: true })
      const cutF = {
        sel: function (n: any) {
          return n.x > 0.5
        },
        sdf: function (x: any, y: any, z: any) {
          return Math.max(0.15 - y, y - 0.62, Math.abs(z) - 0.85, Math.max(0.05 - Math.abs(z - 0.3), 0.05 - Math.abs(z + 0.3)))
        },
      }
      kit.cutMesh(cas, [
        EA.sideCutP(
          [
            [-0.85, 0.2],
            [-0.25, 0.2],
            [-0.25, 0.6],
            [-0.85, 0.6],
          ],
          0.5,
        ),
        EA.sideCutP(
          [
            [0.15, 0.2],
            [0.75, 0.2],
            [0.75, 0.6],
            [0.15, 0.6],
          ],
          0.5,
        ),
        cutF,
        {
          sel: function (n: any, ce: any) {
            return Math.abs(n.x) > 0.5 && ce.x < 0
          },
          sdf: function (x: any, y: any, z: any) {
            return Math.max(-0.88 - y, y - 0.68, Math.abs(z - 0.3) - 0.35)
          },
        },
      ])
      const fw = c.roundBox(0.016, 0.47, 1.7, 0.01, MT.glass, hx + 1.0, hy0 + hh / 2 + 0.385, 0)
      kit.asGlass(c, fw, lbl('deckhouse_forward_windows'), 'tempered')
      ;[-0.3, 0.3].forEach(function (z) {
        c.roundBox(0.03, 0.5, 0.1, 0.01, wht, hx + 1.0, hy0 + hh / 2 + 0.385, z)
      })
      ;[1, -1].forEach(function (s) {
        ;[-0.55, 0.45].forEach(function (dx) {
          const gp = c.roundBox(0.6, 0.4, 0.016, 0.03, MT.glass, hx + dx, hy0 + hh / 2 + 0.4, s * (hw2 - 0.04))
          kit.asGlass(
            c,
            gp,
            dx < 0
              ? s > 0
                ? lbl('starboard_aft_window')
                : lbl('port_aft_window')
              : s > 0
                ? lbl('starboard_forward_window')
                : lbl('port_forward_window'),
            'tempered',
          )
        })
        /* navigation lights in boxes on the house */
        c.roundBox(0.25, 0.18, 0.06, 0.02, CM('#151617'), hx + 0.7, hy0 + hh - 0.25, s * (hw2 + 0.04))
        EA.navLight(
          c,
          hx + 0.7,
          hy0 + hh - 0.25,
          s * (hw2 + 0.08),
          s > 0 ? 'green' : 'red',
          s > 0 ? trl('labels.starboard_side_light_green') : trl('labels.port_side_light_red'),
          { r: 0.045 },
        )
      })
      c.roundBox(2.4, 0.1, 2.5, 0.04, blue, hx, hy0 + hh + 0.05, 0)
      const door = c.roundBox(0.05, 1.5, 0.66, 0.02, CM('#5a3e26'), hx - 1.3, hy0 + 0.8, 0.68, { rot: [0, 1.3, 0] })
      void door
      /* interior: wooden wheel, panel, compass, radio, bench and bunk */
      const inner = CM('#b9a888', { roughness: 0.9 })
      c.roundBox(0.4, 0.95, 1.9, 0.03, wood, hx + 0.75, hy0 + 0.48, 0)
      c.roundBox(0.42, 0.03, 1.9, 0.01, CM('#2a2b2c'), hx + 0.75, hy0 + 0.97, 0)
      ;[-0.45, 0.45].forEach(function (z) {
        c.cylinder(0.05, 0.05, 0.012, MT.gauge, hx + 0.66, hy0 + 1.0, z, null, { seg: 16 })
      })
      c.sphere(0.07, CM('#c9b26a', { metalness: 0.5, roughness: 0.3 }), hx + 0.7, hy0 + 1.05, 0, 1, 0.6, 1)
      c.roundBox(0.2, 0.12, 0.25, 0.02, MT.plastic, hx + 0.75, hy0 + 1.6, -0.6)
      const whl = new THREE.Group()
      whl.position.set(hx + 0.5, hy0 + 1.15, 0)
      whl.userData.rigid = true
      c.vehicle.add(whl)
      const rim = c.add(new THREE.TorusGeometry(0.26, 0.022, 8, 28), MT.wood, 0, 0, 0, whl)
      rim.rotation.y = PI / 2
      for (let sp = 0; sp < 8; sp++) {
        const a8 = (sp / 8) * PI * 2
        c.rod(new V3(0, 0, 0), new V3(0, Math.cos(a8) * 0.36, Math.sin(a8) * 0.36), 0.014, MT.wood, { parent: whl })
      }
      c.cylinder(0.05, 0.05, 0.14, MT.wood, 0.06, 0, 0, 'x', { parent: whl })
      kit.seat(c, hx - 0.05, hy0, 0, { w: 0.5, h: 0.55, back: 0.45, mat: inner, headrest: false })
      c.roundBox(1.8, 0.12, 0.65, 0.04, CM('#7c5a3b'), hx - 0.2, hy0 + 0.5, -0.72)
      c.roundBox(1.7, 0.08, 0.55, 0.04, CM('#6b7c8f', { roughness: 1 }), hx - 0.2, hy0 + 0.6, -0.72)
      c.roundBox(1.9, 0.02, 2.1, 0.01, inner, hx, hy0 + hh - 0.06, 0).castShadow = false
      /* funnel, house mast with a masthead light, foremast with a cargo boom, anchor, rudder */
      c.cylinder(0.1, 0.1, 1.2, MT.trim, hx - 0.75, hy0 + hh + 0.6, 0.65)
      c.cylinder(0.13, 0.1, 0.1, MT.trim, hx - 0.75, hy0 + hh + 1.22, 0.65)
      c.rod(new V3(hx + 0.4, hy0 + hh + 0.1, 0), new V3(hx + 0.4, hy0 + hh + 1.6, 0), 0.04, wood)
      EA.navLight(c, hx + 0.4, hy0 + hh + 1.65, 0, 'white', trl('labels.masthead_light'), { r: 0.05 })
      c.roundBox(0.02, 0.25, 0.4, 0.01, CM('#c8a02a'), hx + 0.4, hy0 + hh + 1.35, 0.22)
      const mx = 2.2
      c.rod(new V3(mx, dk(mx), 0), new V3(mx, dk(mx) + 4.2, 0), 0.07, wood)
      c.rod(new V3(mx, dk(mx) + 3.6, -0.8), new V3(mx, dk(mx) + 3.6, 0.8), 0.04, wood)
      c.rod(new V3(mx, dk(mx) + 1.4, 0), new V3(-0.4, dk(-0.4) + 2.3, 0), 0.05, wood)
      c.rod(new V3(mx, dk(mx) + 4.0, 0), new V3(-0.4, dk(-0.4) + 2.3, 0), 0.008, CM('#9b8a62'))
      c.rod(new V3(-0.4, dk(-0.4) + 2.3, 0), new V3(-0.4, dk(-0.4) + 0.6, 0), 0.006, CM('#9b8a62'))
      c.sphere(0.07, MT.head, mx, dk(mx) + 4.25, 0)
      /* anchor in the starboard hawse */
      const ax = 4.4,
        ay = H.sheerAt(ax).y - 0.3,
        az = H.half(ax, ay) + 0.04,
        anc = CM('#2e3032', { metalness: 0.5, roughness: 0.5 })
      c.rod(new V3(ax, ay + 0.2, az), new V3(ax, ay - 0.25, az), 0.025, anc)
      c.tube(
        [
          [ax - 0.2, ay - 0.12, az],
          [ax, ay - 0.27, az],
          [ax + 0.2, ay - 0.12, az],
        ],
        0.022,
        anc,
        { seg: 12 },
      )
      c.rod(new V3(ax - 0.12, ay + 0.15, az), new V3(ax + 0.12, ay + 0.15, az), 0.018, anc)
      c.roundBox(0.5, 1.1, 0.06, 0.02, wood, x0 - 0.2, -0.45, 0)
      c.cylinder(0.03, 0.03, 1.6, MT.steel, x0 - 0.02, 0.0, 0)
      EA.navLight(c, x0 + 0.05, H.sheerAt(x0).y + 0.15, 0, 'white', trl('labels.stern_light'), { r: 0.045 })
      c.part('hull', trl('labels.hull'), hull, new V3(0, -0.5, 0), 2.4)
      c.part('engine', trl('labels.centre_engine_diesel'), null, new V3(-2.7, 0.0, 0), 1.2)
      c.part('fuel_tank', trl('labels.diesel_tank'), null, new V3(-3.6, 0.1, 0.8), 1.0)
      Object.assign(c.meta, {
        kind: 'boat',
        length: L,
        width: 3.6,
        front: 5.5,
        rear: -5.75,
        clearance: -1.0,
        belt: 1.0,
        bodyHeight: 2.0,
        top: 2.75,
        roof: { x0: hx - 1.0, x1: hx + 1.0, w: 2.2, y: hy0 + hh + 0.1 },
      })
      c.zone('deck', trl('labels.deck_deckhouse_and_masts'), null, null, { alsoGlass: true })
      c.zone('glass_rear', trl('labels.deckhouse_forward_windows'))
      c.zone('glass_left', trl('labels.port_windows'))
      c.zone('glass_right', trl('labels.starboard_windows'))
      c.zone('taillight_right', trl('labels.starboard_side_light'))
      c.zone('taillight_left', trl('labels.port_side_light'))
      c.zone('taillight_center', trl('labels.masthead_and_stern_lights'))
      c.meta.armor = function (c2: any) {
        /* modified: steel plates welded on the house, grille on the windows, barbed wire on the rim and extra diesel drums */
        const stl = kit.steelMaterial
        ;[1, -1].forEach(function (s) {
          c2.roundBox(2.0, 0.9, 0.02, 0.02, stl, hx, hy0 + 0.6, s * (hw2 + 0.02))
          for (let x2 = hx - 0.9; x2 <= hx + 0.9; x2 += 0.12)
            c2.rod(new V3(x2, hy0 + 1.15, s * (hw2 + 0.04)), new V3(x2, hy0 + 1.7, s * (hw2 + 0.04)), 0.008, stl)
        })
        for (let z = -0.85; z <= 0.86; z += 0.12) c2.rod(new V3(hx + 1.03, hy0 + 1.15, z), new V3(hx + 1.03, hy0 + 1.65, z), 0.008, stl)
        ;[1, -1].forEach(function (s) {
          const pts = []
          for (let i = 0; i <= 30; i++) {
            const x2 = x0 + 0.3 + (i / 30) * 9.5,
              sh = H.sheerAt(x2)
            pts.push([x2, sh.y + 0.18 + 0.03 * Math.sin(i * 2.1), s * (sh.z - 0.03)])
          }
          c2.tube(pts, 0.012, stl, { seg: 120, rs: 4 })
          for (let k = 0; k <= 30; k += 3)
            c2.rod(new V3(pts[k][0], H.sheerAt(pts[k][0]).y, pts[k][2]), new V3(pts[k][0], pts[k][1], pts[k][2]), 0.015, stl)
        })
        ;[
          [-4.3, 0.9],
          [-4.3, -0.9],
          [-4.8, 0.0],
        ].forEach(function (q) {
          c2.cylinder(0.29, 0.29, 0.88, CM('#3e5a34', { roughness: 0.6 }), q[0], dk(q[0]) + 0.44, q[1])
        })
      }
    },
  )

  /* ================= planes ================= */
  /* Reference · Cessna 172S Skyhawk (WebSearch: planeandpilotmag; POH measurements, partly from memory)
     Real measurements: length 8.28 m · span 11.00 m · height 2.72 m (top of the fin) · wheelbase (nose-main) 1.65 m ·
     main gear track 2.54 m · tyres 0.44 m (main 6.00-6) and 0.38 m (nose 5.00-5) · propeller 1.93 m (2 blades) ·
     wing chord 1.63 m at the root and 1.12 m at the tip · elevator 3.45 m · cabin 1.12 m external width · belly about 0.62 m off the ground.
     Signature traits:
     front: short cowling with two round air intakes on the sides of the spinner, two-blade propeller, straight high wing with inverted V struts
     side: high wing over the cabin, single strut each side from the gear to the wing, "Omni-Vision" rear window that drops behind the wing,
     swept fin with a long dorsal fin, fixed tricycle gear with arched steel legs and wheel fairings
     rear: low straight elevator, tapering tail cone, struts forming a V up to the wing
     top: wing rectangular inboard and tapered outboard, tanks with a filler on the upper surface, tapered elevator with a rudder cut-out */
  fx.register(
    {
      key: 'single_engine_plane',
      group: 'air',
      name: trl('vehicles.single_engine_plane.name'),
      inspired: trl('vehicles.single_engine_plane.inspired'),
      category: trl('vehicles.single_engine_plane.category'),
      fuel: 'avgas',
      description: trl('vehicles.single_engine_plane.description'),
      mass: 1157,
      noise: 300,
      seats: trl('vehicles.single_engine_plane.seats'),
      capacity: trl('vehicles.single_engine_plane.capacity'),
      efficiency: trl('vehicles.single_engine_plane.efficiency'),
      range: trl('vehicles.single_engine_plane.range'),
      maxSpeed: 302,
      skill: trl('vehicles.single_engine_plane.skill'),
      hood: false,
    },
    function (c) {
      const EA = shared.EA,
        white = '#ecebe6'
      const paintW = c.paint(white)
      const ST = [
        [2.3, 0.98, 1.46, 0.7, 2.4],
        [2.15, 0.88, 1.55, 0.92, 2.6],
        [1.85, 0.8, 1.61, 1.02, 2.8],
        [1.45, 0.72, 1.65, 1.08, 3],
        [1.25, 0.68, 1.7, 1.11, 3],
        [0.95, 0.64, 1.9, 1.12, 3.2],
        [0.62, 0.62, 2.03, 1.12, 3.2],
        [0.0, 0.62, 2.04, 1.12, 3.2],
        [-0.95, 0.66, 2.03, 1.08, 3],
        [-1.4, 0.72, 1.93, 1.0, 2.8],
        [-2.0, 0.84, 1.77, 0.86, 2.6],
        [-3.0, 1.02, 1.63, 0.62, 2.4],
        [-4.2, 1.2, 1.56, 0.38, 2.2],
        [-5.2, 1.3, 1.52, 0.2, 2.2],
        [-5.62, 1.35, 1.5, 0.06, 2],
      ]
      function yc(x: any) {
        return 1.12 + 0.3 * EA.sstep(1.6, -5.0, x)
      }
      const fus = c.add(EA.fuseGeo(ST), paintW)
      /* stripes: wide blue rising from the hood to the tail and a gold thread above */
      EA.fuseSkin(
        c,
        ST,
        EA.bandT(function (x: any, y: any, z: any) {
          return Math.min(0.055 - Math.abs(y - yc(x)), x - -5.3, 2.2 - x, Math.abs(z) - 0.03)
        }),
        c.paint('#1f3d6e'),
      )
      EA.fuseSkin(
        c,
        ST,
        EA.bandT(function (x: any, y: any, z: any) {
          return Math.min(0.01 - Math.abs(y - yc(x) - 0.085), x - -5.3, 2.2 - x, Math.abs(z) - 0.03)
        }),
        c.paint('#b8862e'),
        { k: 1.005 },
      )
      const wsK = [0.66, 1.29, 1.69, 2.2, null, 0.52],
        drP = [
          [1.2, 1.71],
          [0.12, 1.71],
          [0.12, 1.99],
          [0.64, 1.99],
        ],
        rsP = [
          [0.0, 1.71],
          [-0.86, 1.73],
          [-0.86, 1.96],
          [0.0, 1.99],
        ],
        rwK = [-1.72, -0.98, 1.83, 2.1, null, 0.42]
      kit.cutMesh(
        fus,
        [
          EA.cutT(wsK, function (n: any) {
            return n.x > 0.15 && n.y > 0.1
          }),
          EA.sideCutP(drP, 0.3),
          EA.sideCutP(rsP, 0.3),
          EA.cutT(rwK, function (n: any) {
            return n.y > 0.25
          }),
        ],
        40,
      )
      c.deform.push(fus)
      EA.fuseGlass(c, ST, EA.keepT(wsK), lbl('windshield'), 'laminated', { pos: new V3(1.0, 1.85, 0) })
      ;[1, -1].forEach(function (s) {
        EA.fuseGlass(c, ST, EA.sideKeepP(drP, 0.3, s), s > 0 ? lbl('right_door_window') : lbl('left_door_window'), 'tempered', {
          pos: new V3(0.6, 1.85, s * 0.56),
        })
        EA.fuseGlass(c, ST, EA.sideKeepP(rsP, 0.3, s), s > 0 ? lbl('right_rear_window') : lbl('left_rear_window'), 'tempered', {
          pos: new V3(-0.45, 1.85, s * 0.55),
        })
      })
      EA.fuseGlass(c, ST, EA.keepT(rwK), lbl('omni_vision_rear_window'), 'laminated', { pos: new V3(-1.35, 1.95, 0) })
      /* frames: windshield centre pillar, door pillars, door and hood seams */
      c.rod(new V3(1.27, 1.7, 0), new V3(0.66, 2.03, 0), 0.016, MT.trim)
      /* door and hood gaps: dark threads on the skin itself */
      const doorF = EA.polySdf([
        [1.24, 0.86],
        [0.1, 0.82],
        [0.1, 1.7],
        [0.12, 2.0],
        [0.64, 2.0],
        [1.24, 1.7],
      ])
      EA.fuseSkin(
        c,
        ST,
        EA.bandT(function (x: any, y: any, z: any) {
          return Math.min(0.007 - Math.abs(doorF(x, y)), Math.abs(z) - 0.3)
        }),
        MT.dark,
        { k: 1.003 },
      )
      EA.fuseSkin(
        c,
        ST,
        EA.bandT(function (x: any, y: any, _z: any) {
          return Math.min(0.006 - Math.abs(x - 1.47), y - 0.75)
        }),
        MT.dark,
        { k: 1.003 },
      )
      ;[1, -1].forEach(function (s) {
        c.roundBox(0.12, 0.025, 0.035, 0.01, MT.chrome, 0.95, 1.36, s * 0.57)
        /* hood air intakes and exhaust */
        c.cylinder(0.085, 0.085, 0.05, MT.dark, 2.29, 1.27, s * 0.23, 'x', { seg: 18 })
        c.add(new THREE.TorusGeometry(0.085, 0.014, 6, 20), paintW, 2.31, 1.27, s * 0.23).rotation.y = PI / 2
        c.text('PT-ZDA', 0.95, 0.22, -3.05, 1.36, s * 0.317, s > 0 ? '+z' : '-z', { fg: '#1f3d6e' })
      })
      c.cylinder(0.03, 0.035, 0.22, MT.steel, 1.62, 0.78, 0.18, null, { seg: 10 }).rotation.z = -0.4
      c.roundBox(0.5, 0.04, 0.3, 0.02, MT.dark, 2.05, 0.86, 0, { rot: [0, 0, 0.2] })
      /* interior: floor, 4 seats, panel, sticks, pedals, power lever, lining */
      const fl = 0.74,
        fab = CM('#4a463f', { roughness: 0.9 })
      c.roundBox(2.2, 0.03, 0.98, 0.01, MT.carpet, 0.2, fl, 0).castShadow = false
      ;[0.26, -0.26].forEach(function (z) {
        kit.seat(c, 0.38, fl, z, { w: 0.44, h: 0.34, back: 0.62, lean: 0.18, mat: fab })
        EA.pedals(c, 1.18, fl, z)
        kit.yoke(c, 0.98, 1.47, z)
      })
      kit.seat(c, -0.52, fl, 0, { w: 0.96, n: 2, h: 0.34, back: 0.58, lean: 0.2, mat: fab })
      EA.instPanel(c, 1.1, 1.52, 1.0, { gauges: 6, z0: -0.38, screens: [[0.0, 0.12, 0.14, 0.22]] })
      c.roundBox(0.1, 0.1, 0.1, 0.02, MT.plastic, 1.0, 1.32, 0)
      c.cylinder(0.018, 0.018, 0.1, MT.chrome, 0.93, 1.34, 0.02, 'x')
      c.sphere(0.02, MT.plastic, 0.88, 1.34, 0.02)
      c.roundBox(1.6, 0.02, 1.0, 0.01, MT.headliner, -0.2, 2.0, 0).castShadow = false
      c.roundBox(0.04, 0.14, 0.04, 0.01, MT.plastic, 0.9, 1.93, 0)
      /* high wing: two half wings (zone per side), rectangular inboard and tapered outboard, dihedral 1.7 degrees */
      const wingMat = c.paint(white)
      function halfWing(s: any) {
        const dh = function (z: any) {
          return 2.135 + Math.max(0, z - 0.56) * 0.03
        }
        const g = EA.foilGeo(
          [
            { p: [0.66, dh(0), 0], c: 1.63, t: 0.12, cam: 0.02 },
            { p: [0.66, dh(2.6), s * 2.6], c: 1.63, t: 0.12, cam: 0.02 },
            { p: [0.62, dh(5.2), s * 5.2], c: 1.14, t: 0.11, cam: 0.02 },
            { p: [0.58, dh(5.5) + 0.02, s * 5.5], c: 0.98, t: 0.06, cam: 0.01 },
          ],
          { up: 'y', n: 14 },
        )
        const w = c.add(g, wingMat)
        c.deform.push(w)
        /* ailerons and flaps: hinge lines, tank filler, navigation light at the tip */
        ;[
          [0.62, 2.55, -0.65],
          [2.65, 5.0, -0.62],
        ].forEach(function (q) {
          c.roundBox(0.012, 0.012, q[1] - q[0], 0.004, MT.dark, q[2], dh((q[0] + q[1]) / 2) + 0.075, (s * (q[0] + q[1])) / 2).castShadow =
            false
        })
        c.cylinder(0.04, 0.04, 0.02, MT.steel, 0.35, dh(1.4) + 0.105, s * 1.4)
        EA.navLight(
          c,
          0.36,
          dh(5.5) + 0.02,
          s * 5.53,
          s > 0 ? 'green' : 'red',
          s > 0 ? trl('labels.right_navigation_light_green') : trl('labels.left_navigation_light_red'),
        )
        /* wing strut (streamlined) */
        const st = c.rod(new V3(0.12, 0.86, s * 0.55), new V3(0.3, 2.1, s * 2.55), 0.034, paintW)
        st.scale.x = 1.8
        c.roundBox(0.16, 0.06, 0.08, 0.02, MT.steel, 0.12, 0.86, s * 0.56)
        return w
      }
      halfWing(1)
      halfWing(-1)
      EA.lamp(c, 0.66, 2.12, -2.85, 0.06, trl('labels.landing_light_left_wing'))
      EA.lamp(c, 0.66, 2.12, -3.05, 0.05, trl('labels.taxi_light_left_wing'))
      c.rod(new V3(0.3, 2.0, -3.6), new V3(0.75, 2.0, -3.6), 0.008, MT.steel)
      /* empennage: tapered elevator, swept fin with a dorsal fin */
      const tailMat = c.paint(white)
      ;[1, -1].forEach(function (s) {
        const hs = c.add(
          EA.foilGeo(
            [
              { p: [-4.6, 1.42, 0], c: 1.2, t: 0.09 },
              { p: [-4.95, 1.42, s * 1.72], c: 0.86, t: 0.08 },
            ],
            { up: 'y', n: 10 },
          ),
          tailMat,
        )
        c.deform.push(hs)
      })
      const fin = c.add(
        EA.foilGeo(
          [
            { p: [-4.25, 1.46, 0], c: 1.58, t: 0.09 },
            { p: [-5.1, 2.64, 0], c: 0.74, t: 0.08 },
          ],
          { up: 'z', n: 10 },
        ),
        tailMat,
      )
      c.deform.push(fin)
      const dors = c.add(
        EA.foilGeo(
          [
            { p: [-2.85, 1.6, 0], c: 1.45, t: 0.04 },
            { p: [-4.25, 1.98, 0], c: 0.3, t: 0.05 },
          ],
          { up: 'z', n: 8 },
        ),
        tailMat,
      )
      c.deform.push(dors)
      const finB = c.add(
        EA.foilGeo(
          [
            { p: [-4.24, 1.46, 0], c: 1.6, t: 0.1 },
            { p: [-5.09, 2.645, 0], c: 0.76, t: 0.095 },
          ],
          { up: 'z', n: 10 },
        ),
        c.paint('#1f3d6e'),
      )
      finB.castShadow = false
      kit.cutMesh(
        finB,
        [
          EA.bandT(function (x: any, y: any) {
            const yy = 2.0 + (x + 5.0) * 0.55
            return Math.min(0.13 - Math.abs(y - yy), 2.6 - y)
          }),
        ],
        40,
      )
      c.deform.push(finB)
      EA.navLight(c, -5.81, 1.58, 0, 'white', trl('labels.tail_light'))
      EA.navLight(c, -5.2, 2.66, 0, 'red', trl('labels.anti_collision_light'), { r: 0.04 })
      /* tricycle gear: arched spring legs, wheel fairings, nose wheel with a shock absorber */
      const pant = c.paint(white)
      ;[1, -1].forEach(function (s) {
        c.tube(
          [
            [0.06, 0.66, s * 0.5],
            [0.05, 0.52, s * 0.82],
            [0.03, 0.34, s * 1.12],
            [0.02, 0.24, s * 1.22],
          ],
          0.032,
          MT.steel,
          { seg: 20 },
        )
        c.wheel(0.02, s * 1.27, 0.22, 0.15, { spokes: 0, rimR: 0.5, noPart: true, rim: CM('#d9d7d0', { metalness: 0.4 }) })
        c.sphere(0.26, pant, 0.0, 0.25, s * 1.27, 1.85, 1.05, 0.48, { tl: PI * 0.6, ws: 24, hs: 12 })
        c.roundBox(0.22, 0.03, 0.1, 0.01, MT.steel, 0.3, 0.55, s * 0.95)
      })
      c.rod(new V3(1.72, 0.92, 0), new V3(1.72, 0.25, 0), 0.04, MT.chrome)
      c.cylinder(0.055, 0.055, 0.22, MT.steel, 1.72, 0.78, 0)
      c.wheel(1.72, 0.0001, 0.19, 0.13, { spokes: 0, rimR: 0.5, noPart: true, rim: CM('#d9d7d0', { metalness: 0.4 }) })
      c.sphere(0.22, pant, 1.72, 0.22, 0, 1.75, 1.05, 0.42, { tl: PI * 0.6, ws: 24, hs: 12 })
      /* 1.93 m two-blade propeller and spinner */
      const pr = EA.propeller(c, 2.3, 1.22, 0, { R: 0.965, blades: 2, chord: 0.16, spinL: 0.2, spinR: 0.17 })
      /* antennas and pitot */
      c.rod(new V3(-0.4, 2.04, 0), new V3(-0.7, 2.35, 0), 0.008, MT.trim)
      c.rod(new V3(0.4, 2.0, -1.9), new V3(0.75, 2.0, -1.9), 0.01, MT.steel)
      c.part('propeller', trl('labels.propeller'), pr, new V3(2.38, 1.22, 0), 0.9)
      c.part('engine', trl('labels.lycoming_engine_4_cylinders'), null, new V3(1.9, 1.2, 0), 0.9)
      c.part('fuel_tank', trl('labels.wing_tanks'), null, new V3(0.2, 2.13, 1.6), 1.0)
      c.part('landing_gear', trl('labels.landing_gear'), null, new V3(0.02, 0.4, 0), 1.2)
      Object.assign(c.meta, {
        kind: 'plane',
        length: 8.28,
        width: 11.0,
        fuselageWidth: 1.12,
        front: 2.5,
        rear: -5.86,
        clearance: 0.62,
        belt: 1.66,
        bodyHeight: 1.42,
        top: 2.7,
        roof: null,
      })
      /* zones: the cabin takes the windshield and windows; the nose takes the hood, intakes and spinner */
      c.zone('cab', trl('labels.cabin_doors_and_windows'), [-1.75, 1.3, 0.6, 2.12, -0.75, 0.75], null, {
        dir: 'left',
        fxKey: 'aircraft_cabin',
        who: trl('who.the_pilot_and_the_passengers'),
        anyMesh: true,
      })
      c.zone('nose', trl('labels.engine_hood_and_propeller'), [1.3, 2.75, 0.7, 1.75, -0.7, 0.7], null, {
        onBand: function (c2: any, b: any) {
          if (b >= 4) pr.visible = false
        },
      }) /* reviewer: when torn off the propeller comes off whole (the core cut-out left blade tips loose in the air) */
      c.zone('fuselage', trl('labels.tail_cone'), [-4.2, -1.75, 0.8, 2.05, -0.6, 0.6])
      c.zone('tail', trl('labels.empennage_fin_and_elevator'), [-6.0, -4.2, 1.2, 2.8, -1.9, 1.9])
      c.zone('taillight_right', trl('labels.right_navigation_light_green'))
      c.zone('taillight_left', trl('labels.left_navigation_light_red'))
      c.zone('taillight_center', trl('labels.tail_and_anti_collision_light'))
      c.zone('headlight_left', trl('labels.landing_and_taxi_lights'))
      c.meta.armor = function (c2: any) {
        /* modified for survival: ventral cargo pod, wing spotlight, cans tied on the back seat and a grille on the windshield */
        const pod = CM('#7d8278', { roughness: 0.6, metalness: 0.2 })
        const cp = c2.add(
          EA.fuseGeo(
            [
              [1.2, 0.5, 0.64, 0.2, 2.2],
              [0.9, 0.42, 0.66, 0.5, 2.6],
              [-0.9, 0.42, 0.68, 0.58, 2.6],
              [-1.9, 0.56, 0.74, 0.3, 2.4],
              [-2.3, 0.66, 0.78, 0.06, 2],
            ],
            { smooth: 20 },
          ),
          pod,
        )
        void cp
        EA.lamp(c2, 0.72, 2.0, 3.2, 0.09, trl('labels.search_spotlight'))
        ;[0.16, -0.16].forEach(function (z) {
          kit.jerryCan(c2, -0.5, 1.32, z, '#8e2a20')
        })
        for (let k = -0.4; k <= 0.41; k += 0.1) c2.rod(new V3(1.33, 1.72, k), new V3(0.7, 2.06, k * 0.9), 0.008, kit.steelMaterial)
        c2.part('cargo', trl('labels.cargo_pod'), cp, new V3(-0.3, 0.55, 0), 0.9)
      }
    },
  )

  /* Reference · Embraer EMB-202/203 Ipanema (WebSearch: Wikipedia "Embraer EMB 202 Ipanema"; the rest from memory)
     Real measurements: length 7.43 m (tail raised) · span 11.69 m · height 2.20 m (tail on the ground) · wing area 19.94 m2
     (constant chord about 1.71 m) · main gear track about 2.2 m and tyres about 0.66 m (from memory) · tail wheel of 0.26 m ·
     propeller about 2.1 m · tail-down attitude about 11 degrees · 950 L hopper ahead of the cabin · Lycoming IO-540 engine of 300 hp.
     Signature traits:
     front: square cowling with side exhausts, tall narrow cabin behind the hopper, straight low wing with dihedral
     side: nose-high (conventional gear with a tail wheel), stepped glazed cabin above the fuselage, with straight sides and an almost flat roof (reviewer: squarer section), wire cutter on the
     windshield and deflector cable from the cabin to the fin, spray boom under the trailing edge, wind-driven pump under the belly
     rear: tall straight fin with a large rudder, straight elevator, nozzle boom from end to end
     top: rectangular wing without taper, yellow hopper lid ahead of the windshield, fuselage tapering after the cabin */
  fx.register(
    {
      key: 'crop_duster',
      group: 'air',
      name: trl('vehicles.crop_duster.name'),
      inspired: trl('vehicles.crop_duster.inspired'),
      category: trl('vehicles.crop_duster.category'),
      fuel: 'ethanol',
      description: trl('vehicles.crop_duster.description'),
      mass: 1800,
      noise: 300,
      seats: trl('vehicles.crop_duster.seats'),
      capacity: trl('vehicles.crop_duster.capacity'),
      efficiency: trl('vehicles.crop_duster.efficiency'),
      range: trl('vehicles.crop_duster.range'),
      maxSpeed: 230,
      skill: trl('vehicles.crop_duster.skill'),
      hood: false,
    },
    function (c) {
      const EA = shared.EA,
        TH = 0.19,
        X0 = 0.3,
        Y0 = 1.0,
        cs = Math.cos(TH),
        sn = Math.sin(TH)
      function P(x: any, y: any, z?: any) {
        return new V3(x * cs - y * sn + X0, x * sn + y * cs + Y0, z || 0)
      }
      const grp = new THREE.Group()
      grp.position.set(X0, Y0, 0)
      grp.rotation.z = TH
      c.vehicle.add(grp)
      grp.updateMatrix()
      const yel = c.paint('#d9aa22'),
        grn = c.paint('#2f6b3a'),
        dark = CM('#232427', { roughness: 0.6 })
      /* fuselage in the flight frame (axis at y = 0) */
      const ST = [
        [3.22, -0.28, 0.28, 0.58, 2.4],
        [3.0, -0.4, 0.38, 0.86, 2.8],
        [2.5, -0.46, 0.44, 0.98, 3.2],
        [2.0, -0.5, 0.56, 1.0, 3.4],
        [1.2, -0.54, 0.62, 1.02, 3.4],
        [0.45, -0.54, 0.66, 1.0, 3.2],
        [0.1, -0.52, 1.07, 0.98, 4.4],
        [-0.5, -0.48, 1.17, 0.94, 5],
        [-1.1, -0.42, 1.06, 0.86, 3.8],
        [-1.7, -0.33, 0.66, 0.74, 2.4],
        [-2.6, -0.15, 0.5, 0.48, 2.3],
        [-3.4, 0.0, 0.44, 0.24, 2.2],
        [-3.82, 0.1, 0.4, 0.07, 2],
      ]
      const fus = c.add(EA.fuseGeo(ST), yel, 0, 0, 0, grp)
      const wsK = [0.02, 0.5, 0.64, 1.2, null, 0.44],
        swP = [
          [0.12, 0.62],
          [-1.0, 0.6],
          [-1.0, 1.0],
          [-0.55, 1.12],
          [0.04, 1.04],
        ]
      kit.cutMesh(
        fus,
        [
          EA.cutT(wsK, function (n: any) {
            return n.x > 0.2 && n.y > 0.05
          }),
          EA.sideCutP(swP, 0.3),
        ],
        40,
      )
      c.deform.push(fus)
      /* green lower half with a thread, green stripe in the middle */
      EA.fuseSkin(
        c,
        ST,
        EA.bandT(function (x: any, y: any) {
          return Math.min(-0.12 - y, x + 3.7)
        }),
        grn,
        { parent: grp },
      )
      EA.fuseSkin(
        c,
        ST,
        EA.bandT(function (x: any, y: any, z: any) {
          return Math.min(0.03 - Math.abs(y - 0.12 - (x < -1.5 ? (x + 1.5) * -0.08 : 0)), x + 3.6, 3.05 - x, Math.abs(z) - 0.05)
        }),
        grn,
        { parent: grp, k: 1.005 },
      )
      /* cabin: floor, seat, stick, panel */
      const fl = -0.36
      c.roundBox(1.3, 0.03, 0.8, 0.01, MT.carpet, -0.4, fl, 0, { parent: grp }).castShadow = false
      kit.seat(c, -0.55, fl, 0, { w: 0.5, h: 0.32, back: 0.66, lean: 0.12, mat: CM('#3a3530', { roughness: 0.9 }), parent: grp })
      c.rod(new V3(0.0, fl, 0), new V3(-0.06, fl + 0.55, 0), 0.016, MT.plastic, { parent: grp })
      c.roundBox(0.04, 0.13, 0.05, 0.015, MT.plastic, -0.07, fl + 0.6, 0, { parent: grp })
      c.roundBox(0.16, 0.3, 0.8, 0.04, CM('#232427'), 0.36, 0.5, 0, { parent: grp, rot: [0, 0, 0.2] })
      ;[-0.24, -0.12, 0.0, 0.12, 0.24].forEach(function (z, i) {
        c.cylinder(0.036, 0.036, 0.012, MT.gauge, 0.27, 0.55 - (i % 2) * 0.09, z, 'x', { seg: 16, parent: grp }).castShadow = false
      })
      /* cabin frame (cage) and windshield struts */
      ;[1, -1].forEach(function (s) {
        c.rod(new V3(0.44, 0.66, s * 0.445), new V3(0.05, 1.05, s * 0.395), 0.014, dark, { parent: grp })
        c.rod(new V3(-0.45, 0.62, s * 0.468), new V3(-0.45, 1.12, s * 0.43), 0.012, dark, { parent: grp })
      })
      c.rod(new V3(0.48, 0.66, 0), new V3(0.07, 1.06, 0), 0.016, dark, { parent: grp })
      /* hopper: yellow lid with latches, ahead of the windshield */
      c.cylinder(0.26, 0.26, 0.05, CM('#e8c33a', { roughness: 0.5 }), 1.1, 0.64, 0, null, { seg: 24, parent: grp })
      c.roundBox(0.08, 0.03, 0.3, 0.01, MT.steel, 1.1, 0.68, 0, { parent: grp })
      c.roundBox(0.4, 0.05, 0.14, 0.02, CM('#cfd3d6', { transparent: true, opacity: 0.5 }), 1.6, 0.58, 0.32, { parent: grp })
      /* cowling: exhausts, lower air intake */
      ;[1, -1].forEach(function (s) {
        c.cylinder(0.04, 0.05, 0.3, MT.steel, 2.45, -0.3, s * 0.5, 'x', { parent: grp }).rotation.y = -s * 0.25
        c.text('PT-ZAG', 0.9, 0.22, -2.3, 0.2, s * 0.25, s > 0 ? '+z' : '-z', { fg: '#1f3f25', parent: grp })
        c.text('ETANOL', 0.5, 0.11, 2.4, 0.2, s * 0.495, s > 0 ? '+z' : '-z', { fg: '#1f3f25', parent: grp })
      })
      c.roundBox(0.3, 0.12, 0.45, 0.04, MT.dark, 3.0, -0.4, 0, { parent: grp })
      /* straight low wing of constant chord with dihedral, tips with navigation lights */
      const wingM = c.paint('#d9aa22')
      ;[1, -1].forEach(function (s) {
        const dh = function (z: any) {
          return -0.4 + Math.max(0, z - 0.5) * 0.1
        }
        const w = c.add(
          EA.foilGeo(
            [
              { p: [1.18, dh(0), 0], c: 1.71, t: 0.15, cam: 0.02 },
              { p: [1.18, dh(5.6), s * 5.6], c: 1.71, t: 0.14, cam: 0.02 },
              { p: [1.12, dh(5.84) + 0.02, s * 5.84], c: 1.55, t: 0.07, cam: 0.01 },
            ],
            { up: 'y', n: 14 },
          ),
          wingM,
          0,
          0,
          0,
          grp,
        )
        c.deform.push(w)
        c.roundBox(0.012, 0.012, 4.6, 0.004, MT.dark, -0.2, dh(3.3) + 0.11, s * 3.3, { parent: grp }).castShadow = false
        EA.navLight(
          c,
          0.4,
          dh(5.84) + 0.02,
          s * 5.87,
          s > 0 ? 'green' : 'red',
          s > 0 ? trl('labels.right_navigation_light_green') : trl('labels.left_navigation_light_red'),
          { parent: grp },
        )
        /* spray boom under the trailing edge, with nozzles */
        c.rod(new V3(-0.62, dh(5.3) - 0.2, s * 5.3), new V3(-0.62, dh(0.6) - 0.2, s * 0.6), 0.022, MT.steel, { parent: grp })
        for (let z = 0.8; z <= 5.2; z += 0.4) {
          c.cylinder(0.018, 0.01, 0.07, MT.steel, -0.62, dh(z) - 0.25, s * z, null, { parent: grp })
          c.rod(new V3(-0.62, dh(z) - 0.2, s * z), new V3(-0.5, dh(z) - 0.08, s * z), 0.008, MT.steel, { parent: grp })
        }
      })
      /* empennage: straight elevator with a strut, tall fin */
      const tm = c.paint('#d9aa22')
      ;[1, -1].forEach(function (s) {
        const hs = c.add(
          EA.foilGeo(
            [
              { p: [-2.95, 0.36, 0], c: 0.95, t: 0.09 },
              { p: [-3.05, 0.36, s * 1.8], c: 0.8, t: 0.08 },
            ],
            { up: 'y', n: 10 },
          ),
          tm,
          0,
          0,
          0,
          grp,
        )
        c.deform.push(hs)
        c.rod(new V3(-3.3, 0.36, s * 0.9), new V3(-3.2, 0.05, s * 0.1), 0.012, MT.steel, { parent: grp })
      })
      const fin = c.add(
        EA.foilGeo(
          [
            { p: [-2.65, 0.42, 0], c: 1.25, t: 0.1 },
            { p: [-3.25, 1.85, 0], c: 0.72, t: 0.09 },
          ],
          { up: 'z', n: 10 },
        ),
        tm,
        0,
        0,
        0,
        grp,
      )
      c.deform.push(fin)
      const finB = c.add(
        EA.foilGeo(
          [
            { p: [-2.64, 0.42, 0], c: 1.27, t: 0.11 },
            { p: [-3.24, 1.85, 0], c: 0.74, t: 0.1 },
          ],
          { up: 'z', n: 10 },
        ),
        grn,
        0,
        0,
        0,
        grp,
      )
      finB.castShadow = false
      kit.cutMesh(
        finB,
        [
          EA.bandT(function (x: any, y: any) {
            return y - 1.45
          }),
        ],
        40,
      )
      c.deform.push(finB)
      EA.navLight(c, -3.95, 0.5, 0, 'white', trl('labels.tail_light'), { parent: grp })
      EA.navLight(c, -3.4, 1.88, 0, 'red', trl('labels.anti_collision_light'), { parent: grp, r: 0.04 })
      /* wire cutter on the windshield and deflector cable to the fin */
      c.rod(new V3(0.5, 0.66, 0), new V3(0.15, 1.35, 0), 0.02, MT.steel, { parent: grp })
      c.rod(new V3(0.15, 1.35, 0), new V3(-0.4, 1.17, 0), 0.012, MT.steel, { parent: grp })
      c.rod(new V3(-0.6, 1.17, 0), new V3(-3.25, 1.85, 0), 0.007, MT.steel, { parent: grp })
      /* 2.1 m three-blade propeller */
      const pr = EA.propeller(c, 3.28, 0, 0, { R: 1.05, blades: 3, chord: 0.17, spinL: 0.26, spinR: 0.16, parent: grp, spinCol: '#c9c6bd' })
      /* wind-driven pump under the belly */
      c.cylinder(0.07, 0.07, 0.35, MT.steel, 0.9, -0.72, 0, 'x', { parent: grp })
      c.rod(new V3(0.9, -0.55, 0), new V3(0.9, -0.68, 0), 0.02, MT.steel, { parent: grp })
      const pump = EA.propeller(c, 1.1, -0.72, 0, {
        R: 0.22,
        blades: 2,
        chord: 0.06,
        spinL: 0.08,
        spinR: 0.06,
        parent: grp,
        tip: false,
        v: 12,
      })
      void pump
      EA.bake(c, grp)
      const M = new THREE.Matrix4().compose(
        new V3(X0, Y0, 0),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, TH)),
        new V3(1, 1, 1),
      )
      EA.fuseGlass(c, ST, EA.keepT(wsK), lbl('windshield'), 'laminated', { M: M, pos: P(0.25, 0.85) })
      ;[1, -1].forEach(function (s) {
        EA.fuseGlass(c, ST, EA.sideKeepP(swP, 0.3, s), s > 0 ? lbl('right_cabin_window') : lbl('left_cabin_window'), 'tempered', {
          M: M,
          pos: P(-0.45, 0.85, s * 0.47),
        })
      })
      /* conventional gear (ground frame): spring legs, large wheels, tail wheel */
      const leg = CM('#3a3c3e', { roughness: 0.5, metalness: 0.3 })
      ;[1, -1].forEach(function (s) {
        const top = P(1.3, -0.5, s * 0.42)
        c.tube(
          [
            [top.x, top.y, top.z],
            [1.55, 0.6, s * 0.75],
            [1.5, 0.34, s * 1.02],
          ],
          0.045,
          leg,
          { seg: 16 },
        )
        c.wheel(1.5, s * 1.1, 0.33, 0.21, { rim: leg, spokes: 0, rimR: 0.45, noPart: true })
      })
      const tw = P(-3.45, 0.04)
      c.rod(new V3(tw.x, tw.y, 0), new V3(tw.x - 0.08, 0.13, 0), 0.025, leg)
      c.wheel(tw.x - 0.1, 0.0001, 0.13, 0.08, { rim: leg, spokes: 0, noPart: true })
      /* landing light on the left leading edge */
      const lp = P(1.2, -0.38, -2.4)
      EA.lamp(c, lp.x, lp.y, lp.z, 0.065, trl('labels.landing_light'))
      c.part('propeller', trl('labels.propeller'), pr, P(3.35, 0), 0.9)
      c.part('engine', trl('labels.io_540_ethanol_engine'), null, P(2.6, 0), 0.9)
      c.part('fuel_tank', trl('labels.wing_tanks'), null, P(0.4, -0.4, 1.8), 1.0)
      c.part('cargo', trl('labels.hopper_950_l'), null, P(1.2, 0.2), 0.9)
      c.part('landing_gear', trl('labels.landing_gear'), null, new V3(1.5, 0.45, 0), 1.2)
      const F = P(3.5, 0).x,
        R = P(-3.9, 0.3).x
      Object.assign(c.meta, {
        kind: 'plane',
        length: F - R,
        width: 11.74,
        fuselageWidth: 1.02,
        front: F,
        rear: R,
        clearance: 0.72,
        belt: 1.5,
        bodyHeight: 1.2,
        top: 2.2,
        roof: null,
      })
      c.zone('cab', trl('labels.glazed_cabin'), [P(-1.1, 0).x, P(0.5, 0).x, 1.2, 2.25, -0.6, 0.6], null, {
        dir: 'left',
        fxKey: 'aircraft_cabin',
        who: trl('who.the_pilot'),
        anyMesh: true,
      })
      c.zone('nose', trl('labels.hood_hopper_and_propeller'), [P(0.5, 0).x, F + 0.2, 0.9, 2.5, -0.62, 0.62], null, {
        onBand: function (c2: any, b: any) {
          if (b >= 4) pr.visible = false
        },
      }) /* reviewer: when torn off the propeller comes off whole (the core cut-out left blade tips loose in the air) */
      c.zone('fuselage', trl('labels.rear_fuselage'), [P(-2.6, 0).x, P(-1.1, 0).x, 0.5, 1.9, -0.55, 0.55])
      c.zone('tail', trl('labels.empennage_and_tail_wheel'), [R - 0.2, P(-2.6, 0).x, 0.0, 2.3, -1.95, 1.95])
      c.zone('taillight_right', trl('labels.right_navigation_light_green'))
      c.zone('taillight_left', trl('labels.left_navigation_light_red'))
      c.zone('taillight_center', trl('labels.tail_and_anti_collision_light'))
      c.zone('headlight_left', trl('labels.landing_light'))
      c.zone('bar', trl('labels.spray_boom'), [P(-0.75, 0).x - 0.3, P(-0.5, 0).x + 0.3, 0.6, 1.4, -5.6, 5.6], null, {
        type: 'part',
        fxKey: 'fairing',
        dir: 'up',
        fx: [
          trl('effects.none'),
          trl('effects.bent_nozzles_crooked_jet'),
          trl('effects.boom_loose_on_one_side_sprays_the_ground'),
          trl('effects.boom_dragging_spray_leaking'),
          trl('effects.boom_torn_off_no_spraying'),
        ],
      })
      c.meta.armor = function (c2: any) {
        /* modified: hopper becomes an incendiary slurry tank, larger nozzles, steel plate under the cabin and cans tied at the side */
        const stl = kit.steelMaterial
        ;[1, -1].forEach(function (s) {
          const a = P(0.4, -0.2, s * 0.5),
            b = P(-1.0, -0.15, s * 0.47)
          c2.roundBox(Math.abs(a.x - b.x), 0.5, 0.02, 0.02, stl, (a.x + b.x) / 2, (a.y + b.y) / 2, s * 0.515, { rot: [0, 0, TH] })
          kit.jerryCan(c2, P(-1.4, 0.1).x, P(-1.4, 0.1).y, s * 0.42, '#8e2a20')
        })
        ;[1, -1].forEach(function (s) {
          for (let z = 1.2; z <= 5.0; z += 1.2) {
            const q = P(-0.62, -0.62 + (z - 0.5) * 0.1, s * z)
            c2.cylinder(0.05, 0.03, 0.14, CM('#b8401c'), q.x, q.y, q.z)
          }
        })
        const t = P(1.1, 0.7)
        c2.cylinder(0.28, 0.28, 0.12, CM('#8e2a20', { roughness: 0.5 }), t.x, t.y, 0)
        c2.text(trl('texts.flammable'), 0.5, 0.1, t.x, t.y + 0.07, 0, '+y', { fg: '#f2e6c8' })
      }
    },
  )

  /* ================= helicopters ================= */
  /* skids: two tubes with an upturned tip and two cross tubes arching up to the belly */
  function skidGear(c: any, o: any) {
    const mat = o.mat || MT.steel,
      z = o.z,
      y = o.y || 0.045
    ;[1, -1].forEach(function (s) {
      c.tube(
        [
          [o.x0, y + 0.02, s * z],
          [o.x0 + 0.1, y, s * z],
          [o.x1 - 0.15, y, s * z],
          [o.x1 + 0.05, y + 0.07, s * z],
          [o.x1 + 0.16, y + 0.2, s * z],
        ],
        o.r || 0.04,
        mat,
        { seg: 40 },
      )
      ;(o.shoes || []).forEach(function (x: any) {
        c.roundBox(0.16, 0.03, 0.06, 0.01, MT.trim, x, y - 0.03, s * z)
      })
    })
    o.cross.forEach(function (q: any) {
      const x = q[0],
        top = q[1],
        zi = q[2]
      c.tube(
        [
          [x, y, -z],
          [x + (q[3] || 0), (y + top) * 0.55, -(z + zi) / 2 - 0.08],
          [x + (q[3] || 0) * 1.4, top, -zi],
          [x + (q[3] || 0) * 1.4, top + 0.03, 0],
          [x + (q[3] || 0) * 1.4, top, zi],
          [x + (q[3] || 0), (y + top) * 0.55, (z + zi) / 2 + 0.08],
          [x, y, z],
        ],
        o.r2 || 0.035,
        mat,
        { seg: 40 },
      )
    })
  }
  /* Reference · Robinson R44 Raven II (WebSearch: Wikipedia "Robinson R44", aerocorner; skid and cabin partly from memory)
     Real measurements: overall length with rotors 11.66 m · main rotor 10.06 m (2 blades) · tail rotor 1.47 m · height 3.28 m (top of the hub) ·
     cabin width 1.28 m · skid track about 2.18 m (from memory) · skid length about 2.5 m · tail rotor hub about 5.9 m behind the mast.
     Signature traits:
     front: large windshield bubble split by a central strip, two landing lights on the chin, tall mast with an exposed teetering hub
     side: tadpole profile (round cabin tapering into a thin straight tail cone), triangular mast fairing, four doors
     with windows, engine compartment with louvres behind the cabin, skids with an arched front tube
     rear: two-blade tail rotor on the left side, inclined upper fin and lower fin with a protective skid, horizontal stabilizer
     top: long two-blade rotor, teardrop cabin, thin tail cone */
  fx.register(
    {
      key: 'piston_helicopter',
      group: 'air',
      name: trl('vehicles.piston_helicopter.name'),
      inspired: trl('vehicles.piston_helicopter.inspired'),
      category: trl('vehicles.piston_helicopter.category'),
      fuel: 'avgas',
      description: trl('vehicles.piston_helicopter.description'),
      mass: 1134,
      noise: 400,
      seats: trl('vehicles.piston_helicopter.seats'),
      capacity: trl('vehicles.piston_helicopter.capacity'),
      efficiency: trl('vehicles.piston_helicopter.efficiency'),
      range: trl('vehicles.piston_helicopter.range'),
      maxSpeed: 240,
      skill: trl('vehicles.piston_helicopter.skill'),
      hood: false,
    },
    function (c) {
      const EA = shared.EA,
        red = c.paint('#a9241e'),
        white = c.paint('#e9e7e0'),
        blk = CM('#1c1d1f', { roughness: 0.6 })
      const ST = [
        [1.96, 0.96, 1.06, 0.06, 2],
        [1.85, 0.76, 1.4, 0.76, 2.2],
        [1.55, 0.65, 1.7, 1.14, 2.4],
        [1.0, 0.6, 1.92, 1.27, 2.6],
        [0.3, 0.6, 1.99, 1.3, 2.8],
        [-0.5, 0.62, 1.97, 1.26, 2.8],
        [-1.0, 0.72, 1.92, 1.08, 2.6],
        [-1.35, 0.95, 1.88, 0.78, 2.4],
        [-1.75, 1.22, 1.84, 0.48, 2.2],
        [-2.05, 1.44, 1.8, 0.3, 2],
      ]
      const wsT = {
        sel: null,
        sdf: function (x: any, y: any) {
          return Math.min(x - 0.8 - 0.2 * (y - 0.9), y - 0.86)
        },
      }
      const fdP = [
          [0.74, 1.12],
          [0.02, 1.12],
          [0.02, 1.86],
          [0.74, 1.9],
        ],
        rdP = [
          [-0.08, 1.15],
          [-0.88, 1.2],
          [-0.88, 1.8],
          [-0.08, 1.86],
        ]
      const fus = c.add(EA.fuseGeo(ST, { seg: 32 }), red)
      kit.cutMesh(
        fus,
        [
          {
            sdf: function (x: any, y: any) {
              return -wsT.sdf(x, y)
            },
          },
          EA.sideCutP(fdP, 0.35),
          EA.sideCutP(rdP, 0.35),
        ],
        40,
      )
      c.deform.push(fus)
      /* white belly with a black thread (outside the bubble) */
      const wsS = wsT.sdf,
        bl: any = function (x: any) {
          return 1.0 + (x < -1.0 ? (-1.0 - x) * 0.4 : 0)
        }
      EA.fuseSkin(
        c,
        ST,
        EA.bandT(function (x: any, y: any) {
          return Math.min(bl(x) - y, -wsS(x, y))
        }),
        white,
      )
      EA.fuseSkin(
        c,
        ST,
        EA.bandT(function (x: any, y: any) {
          return Math.min(0.018 - Math.abs(y - bl(x) - 0.05), -wsS(x, y) - 0.02)
        }),
        blk,
        { k: 1.005 },
      )
      EA.fuseGlass(c, ST, { sdf: wsT.sdf }, lbl('windshield_bubble'), 'laminated', { pos: new V3(1.4, 1.5, 0) })
      ;[1, -1].forEach(function (s) {
        EA.fuseGlass(
          c,
          ST,
          EA.sideKeepP(fdP, 0.35, s),
          s > 0 ? lbl('front_right_door_window') : lbl('front_left_door_window'),
          'tempered',
          { pos: new V3(0.4, 1.5, s * 0.64) },
        )
        EA.fuseGlass(c, ST, EA.sideKeepP(rdP, 0.35, s), s > 0 ? lbl('rear_right_door_window') : lbl('rear_left_door_window'), 'tempered', {
          pos: new V3(-0.5, 1.5, s * 0.63),
        })
        /* door gaps and handles */
        const df = EA.polySdf([
            [0.78, 0.72],
            [0.0, 0.68],
            [0.0, 1.9],
            [0.78, 1.93],
          ]),
          dr = EA.polySdf([
            [-0.06, 0.68],
            [-0.92, 0.75],
            [-0.92, 1.84],
            [-0.06, 1.9],
          ])
        EA.fuseSkin(
          c,
          ST,
          EA.bandT(function (x: any, y: any, z: any) {
            return Math.min(0.006 - Math.min(Math.abs(df(x, y)), Math.abs(dr(x, y))), s * z - 0.35)
          }),
          MT.dark,
          { k: 1.003 },
        )
        c.roundBox(0.1, 0.022, 0.03, 0.01, MT.chrome, 0.1, 1.08, s * 0.645)
        c.roundBox(0.1, 0.022, 0.03, 0.01, MT.chrome, -0.8, 1.1, s * 0.63)
        /* engine compartment louvres */
        for (let k = 0; k < 6; k++) c.roundBox(0.05, 0.3, 0.02, 0.01, blk, -1.25 - k * 0.08, 1.45, s * (0.42 - k * 0.035))
      })
      /* central bubble strip */
      c.tube(
        [
          [0.95, 1.93, 0],
          [1.3, 1.83, 0],
          [1.6, 1.62, 0],
          [1.82, 1.38, 0],
          [1.93, 1.12, 0],
          [1.94, 0.98, 0],
        ],
        0.02,
        blk,
        { seg: 30 },
      )
      /* interior: floor, 4 seats, tall central console, T cyclic, collective, pedals */
      const fl = 0.72,
        fab = CM('#3b3a38', { roughness: 0.9 })
      c.roundBox(1.9, 0.03, 1.16, 0.01, MT.carpet, 0.2, fl, 0).castShadow = false
      ;[0.3, -0.3].forEach(function (z) {
        kit.seat(c, 0.35, fl, z, { w: 0.48, h: 0.36, back: 0.62, lean: 0.14, mat: fab })
        EA.pedals(c, 1.35, fl, z)
      })
      kit.seat(c, -0.55, fl + 0.06, 0, { w: 1.06, n: 2, h: 0.36, back: 0.6, lean: 0.12, mat: fab })
      c.roundBox(0.42, 0.62, 0.3, 0.06, CM('#232427'), 1.15, fl + 0.32, 0, { rot: [0, 0, 0.35] })
      c.roundBox(0.06, 0.3, 0.3, 0.02, CM('#1a1b1d'), 1.25, fl + 0.65, 0, { rot: [0, 0, 0.6] })
      ;[-0.07, 0.07].forEach(function (z) {
        c.cylinder(0.04, 0.04, 0.01, MT.gauge, 1.21, fl + 0.68, z, 'x', { seg: 14 }).rotation.set(0, 0, -PI / 2 + 0.6)
      })
      c.roundBox(0.03, 0.08, 0.2, 0.01, MT.screen, 1.11, fl + 0.5, 0, { rot: [0, 0, 0.35] })
      c.rod(new V3(0.82, fl, 0), new V3(0.72, fl + 0.6, 0), 0.02, blk)
      c.rod(new V3(0.72, fl + 0.6, -0.3), new V3(0.72, fl + 0.6, 0.3), 0.015, blk)
      ;[0.3, -0.3].forEach(function (z) {
        c.roundBox(0.06, 0.06, 0.05, 0.02, blk, 0.7, fl + 0.62, z)
      })
      EA.collective(c, 0.45, fl, -0.12)
      EA.collective(c, 0.45, fl, 0.48)
      c.roundBox(1.6, 0.02, 1.15, 0.01, MT.headliner, 0.0, 1.95, 0).castShadow = false
      /* mast fairing, transmission, mast and teetering hub */
      c.roundBox(1.3, 0.62, 0.62, 0.2, red, -0.65, 2.18, 0, { taper: { sx: 0.35, sz: 0.55, shift: 0.3 }, def: true })
      c.cylinder(0.07, 0.08, 0.7, MT.steel, 0, 2.78, 0)
      c.cylinder(0.19, 0.16, 0.06, MT.steel, 0, 2.55, 0)
      c.cylinder(0.15, 0.13, 0.05, MT.chrome, 0, 2.63, 0)
      ;[0, 1].forEach(function (i) {
        const a = i * PI
        c.rod(
          new V3(Math.cos(a) * 0.15, 2.62, Math.sin(a) * 0.15),
          new V3(Math.cos(a + 0.3) * 0.18, 2.98, Math.sin(a + 0.3) * 0.18),
          0.012,
          MT.steel,
        )
      })
      const mr = EA.mainRotor(c, 0, 3.15, 0, {
        blades: 2,
        R: 5.03,
        chord: 0.254,
        droop: 0.12,
        hub: 0.25,
        v: 3.4,
        tipCol: '#e6e4dd',
        phase: 0.35,
      })
      c.roundBox(0.28, 0.12, 0.12, 0.04, MT.steel, 0, 3.19, 0)
      /* engine compartment (low) and exhaust */
      c.roundBox(0.75, 0.5, 0.7, 0.12, CM('#4a4c4e', { roughness: 0.6, metalness: 0.3 }), -1.35, 1.12, 0)
      c.cylinder(0.04, 0.05, 0.5, MT.steel, -1.65, 0.98, 0.22, 'x').rotation.y = -0.3
      /* thin straight tail cone, tilted slightly upward */
      const bx0 = -1.9,
        bx1 = -6.05,
        by0 = 1.63,
        by1 = 1.78,
        boomLen = Math.hypot(bx1 - bx0, by1 - by0)
      const boom = c.add(new THREE.CylinderGeometry(0.075, 0.17, boomLen, 20, 8), red, (bx0 + bx1) / 2, (by0 + by1) / 2, 0)
      boom.rotation.z = PI / 2 + Math.atan2(by1 - by0, bx0 - bx1)
      c.deform.push(boom)
      c.rod(new V3(-2.0, 1.66, 0), new V3(-5.6, 1.77, 0), 0.006, blk, { seg: 5 })
      /* empennage: horizontal stabilizer, inclined upper fin, lower fin with a skid */
      const tm = c.paint('#a9241e')
      ;[1, -1].forEach(function (s) {
        const hs = c.add(
          EA.foilGeo(
            [
              { p: [-5.25, 1.76, 0], c: 0.45, t: 0.1 },
              { p: [-5.32, 1.76, s * 0.62], c: 0.34, t: 0.09 },
            ],
            { up: 'y', n: 8 },
          ),
          tm,
        )
        c.deform.push(hs)
      })
      const fu = c.add(
        EA.foilGeo(
          [
            { p: [-5.65, 1.8, 0], c: 0.6, t: 0.11 },
            { p: [-6.1, 2.42, 0], c: 0.36, t: 0.09 },
          ],
          { up: 'z', n: 8 },
        ),
        tm,
      )
      c.deform.push(fu)
      const fd = c.add(
        EA.foilGeo(
          [
            { p: [-5.7, 1.74, 0], c: 0.5, t: 0.11 },
            { p: [-5.95, 1.1, 0], c: 0.32, t: 0.09 },
          ],
          { up: 'z', n: 8 },
        ),
        tm,
      )
      c.deform.push(fd)
      c.tube(
        [
          [-5.98, 1.12, 0],
          [-6.12, 1.0, 0],
          [-6.3, 1.02, 0],
        ],
        0.02,
        MT.steel,
        { seg: 10 },
      )
      c.cylinder(0.07, 0.07, 0.14, MT.steel, -5.92, 1.85, -0.1, 'z')
      const tr = EA.tailRotor(c, -5.92, 1.85, -0.2, {
        blades: 2,
        R: 0.735,
        chord: 0.12,
        mat: CM('#e6e4dd', { roughness: 0.5 }),
        tipCol: '#a9241e',
      })
      /* skids */
      skidGear(c, {
        x0: -1.25,
        x1: 1.15,
        z: 1.09,
        cross: [
          [0.62, 0.62, 0.55, 0.06],
          [-0.78, 0.66, 0.6, -0.04],
        ],
        shoes: [-0.6, 0.6],
      })
      /* lights: two landing lights on the chin, navigation on the stabilizer, anti-collision on the cone and white on the tail */
      EA.lamp(c, 1.86, 0.86, 0.13, 0.055, trl('labels.right_landing_light'), { yaw: 0.05 })
      EA.lamp(c, 1.86, 0.86, -0.13, 0.055, trl('labels.left_landing_light'), { yaw: 0.05 })
      EA.navLight(c, -5.33, 1.76, 0.64, 'green', trl('labels.right_navigation_light_green'), { r: 0.035 })
      EA.navLight(c, -5.33, 1.76, -0.64, 'red', trl('labels.left_navigation_light_red'), { r: 0.035 })
      EA.navLight(c, -6.2, 2.4, 0, 'white', trl('labels.tail_light'), { r: 0.03 })
      EA.navLight(c, -1.55, 1.9, 0, 'red', trl('labels.anti_collision_light'), { r: 0.045 })
      ;[1, -1].forEach(function (s) {
        c.text('PT-HZB', 0.75, 0.16, -3.3, 1.71, s * 0.135, s > 0 ? '+z' : '-z', { fg: '#f2efe6' })
      })
      c.rod(new V3(1.55, 1.72, 0.3), new V3(1.95, 1.62, 0.3), 0.01, MT.steel)
      c.part('rotor', trl('labels.main_rotor'), mr, new V3(0, 3.15, 0), 1.6)
      c.part('tail_rotor', trl('labels.tail_rotor'), tr, new V3(-5.92, 1.85, -0.2), 1.0)
      c.part('engine', trl('labels.lycoming_o_540_engine'), null, new V3(-1.35, 1.2, 0), 0.9)
      c.part('fuel_tank', trl('labels.tanks_main_and_auxiliary'), null, new V3(-0.9, 1.7, 0), 0.9)
      c.part('landing_gear', trl('labels.skids'), null, new V3(0, 0.1, 1.09), 1.0)
      Object.assign(c.meta, {
        kind: 'heli',
        length: 8.4,
        width: 2.26,
        fuselageWidth: 1.3,
        front: 1.97,
        rear: -6.35,
        clearance: 0.6,
        belt: 1.15,
        bodyHeight: 1.4,
        top: 3.28,
        fuselageTop: 1.99,
        roof: null,
      })
      c.zone('nose', trl('labels.windshield_bubble_and_nose'), [0.8, 2.2, 0.55, 2.05, -0.75, 0.75])
      c.zone('cab', trl('labels.cabin_and_doors'), [-1.0, 0.8, 0.55, 2.05, -0.8, 0.8], null, {
        dir: 'left',
        fxKey: 'cab',
        who: trl('who.the_occupants'),
        anyMesh: true,
      })
      c.zone('tail_cone', trl('labels.tail_cone'), [-5.2, -1.85, 1.35, 2.0, -0.35, 0.35], null, {
        dir: 'up',
        fxKey: 'tail_cone',
        cutAll: true,
        anyMesh: true,
      })
      c.zone('empennage', trl('labels.fins_and_stabilizer'), [-6.45, -5.2, 0.95, 2.55, -0.75, 0.75], null, {
        type: 'part',
        fxKey: 'tail',
        dir: 'front',
        anyMesh: true,
      })
      c.zone('engine', trl('labels.engine_and_transmission'), [-1.8, -0.2, 0.85, 2.55, -0.45, 0.45], null, {
        type: 'internal',
        fxKey: 'engine',
        sub: 'engine',
        pos: new V3(-1.35, 1.2, 0),
      })
      c.zone('headlight_center', trl('labels.landing_lights'))
      c.zone('taillight_right', trl('labels.right_navigation_light_green'))
      c.zone('taillight_left', trl('labels.left_navigation_light_red'))
      c.zone('taillight_center', trl('labels.tail_and_anti_collision_lights'))
      c.meta.armor = function (c2: any) {
        /* modified: emergency floats on the skids, spotlight under the nose, side cargo basket and a grille on the bubble */
        const fl2 = CM('#d8d4c8', { roughness: 0.7 })
        ;[1, -1].forEach(function (s) {
          c2.cylinder(0.13, 0.13, 2.0, fl2, -0.05, 0.2, s * 1.09, 'x', { seg: 18 })
          c2.sphere(0.13, fl2, 0.95, 0.2, s * 1.09, 1.8, 1, 1)
          c2.sphere(0.13, fl2, -1.05, 0.2, s * 1.09, 1.3, 1, 1)
        })
        c2.cylinder(0.11, 0.08, 0.16, MT.steel, 1.55, 0.6, 0, 'x')
        EA.lamp(c2, 1.64, 0.6, 0.0001, 0.08, trl('labels.search_spotlight'))
        c2.roundBox(1.0, 0.25, 0.32, 0.03, CM('#3d3a2e'), -0.3, 0.55, 0.85)
        kit.jerryCan(c2, -0.5, 0.8, 0.85, '#8e2a20')
        kit.jerryCan(c2, -0.1, 0.8, 0.85, '#3e5a34')
        for (let k = -0.45; k <= 0.46; k += 0.15) c2.rod(new V3(1.05, 1.93, k), new V3(1.92, 1.02, k * 0.3), 0.007, kit.steelMaterial)
        c2.part('cargo', trl('labels.cargo_basket'), null, new V3(-0.3, 0.6, 0.85), 0.7)
      }
    },
  )

  /* Reference · Helibras/Airbus AS350 B2 Esquilo (WebSearch: flugzeuginfo and airvectors, AS350/AS550 data; skid and cabin from memory)
     Real measurements: length with rotors turning 12.94 m · fuselage (with tail rotor) 10.93 m · main rotor 10.69 m (3 blades) ·
     tail rotor 1.86 m · height 3.14 m (top of the rotor head) · cabin width about 1.80 m · skid track about 2.3 m (from memory).
     Signature traits:
     front: large two-piece windshield with chin windows, short rounded nose, 3-arm "Starflex" rotor head
     side: long tall cabin with front and rear doors, stepped engine cowling behind the rotor with the exhaust pointing back,
     thin tail cone leaving from the top of the fuselage, long skids with steps
     rear: horizontal stabilizer with vertical end plates, large fin on top and a ventral fin with a skid, tail rotor on the left
     top: three wide blades, long narrow engine cowling, rescue hoist on the right side */
  fx.register(
    {
      key: 'rescue_helicopter',
      group: 'air',
      name: trl('vehicles.rescue_helicopter.name'),
      inspired: trl('vehicles.rescue_helicopter.inspired'),
      category: trl('vehicles.rescue_helicopter.category'),
      fuel: 'jet_fuel',
      description: trl('vehicles.rescue_helicopter.description'),
      mass: 2250,
      noise: 450,
      seats: trl('vehicles.rescue_helicopter.seats'),
      capacity: trl('vehicles.rescue_helicopter.capacity'),
      efficiency: trl('vehicles.rescue_helicopter.efficiency'),
      range: trl('vehicles.rescue_helicopter.range'),
      maxSpeed: 287,
      skill: trl('vehicles.rescue_helicopter.skill'),
      hood: false,
    },
    function (c) {
      const EA = shared.EA,
        org = c.paint('#d0531e'),
        white = c.paint('#e8e6df'),
        blk = CM('#1c1d1f', { roughness: 0.6 })
      const ST = [
        [3.34, 1.0, 1.12, 0.1, 2],
        [3.2, 0.82, 1.48, 0.95, 2.2],
        [2.9, 0.72, 1.88, 1.42, 2.4],
        [2.4, 0.68, 2.16, 1.7, 2.6],
        [1.6, 0.66, 2.28, 1.8, 2.8],
        [0.5, 0.66, 2.3, 1.82, 3],
        [-0.6, 0.68, 2.3, 1.78, 3],
        [-1.4, 0.84, 2.26, 1.5, 2.8],
        [-2.0, 1.18, 2.22, 1.0, 2.4],
        [-2.55, 1.5, 2.18, 0.58, 2.2],
      ]
      const wsF = function (x: any, y: any) {
        return Math.min(x - 1.7 - 0.28 * (y - 0.9), y - 0.86)
      }
      const fdP = [
          [1.62, 1.18],
          [0.6, 1.18],
          [0.6, 2.12],
          [1.3, 2.16],
          [1.62, 1.7],
        ],
        rdP = [
          [0.48, 1.22],
          [-0.7, 1.24],
          [-0.7, 2.08],
          [0.48, 2.12],
        ]
      const fus = c.add(EA.fuseGeo(ST, { seg: 32 }), white)
      kit.cutMesh(
        fus,
        [
          {
            sdf: function (x: any, y: any) {
              return -wsF(x, y)
            },
          },
          EA.sideCutP(fdP, 0.5),
          EA.sideCutP(rdP, 0.5),
        ],
        40,
      )
      c.deform.push(fus)
      EA.fuseSkin(
        c,
        ST,
        EA.bandT(function (x: any, y: any) {
          return Math.min(1.14 - y, -wsF(x, y))
        }),
        org,
      )
      EA.fuseSkin(
        c,
        ST,
        EA.bandT(function (x: any, y: any) {
          return Math.min(0.022 - Math.abs(y - 1.1), -wsF(x, y) - 0.02)
        }),
        CM('#1c3b6b'),
        { k: 1.005 },
      )
      EA.fuseGlass(c, ST, { sdf: wsF }, lbl('windshield'), 'laminated', { pos: new V3(2.6, 1.6, 0) })
      ;[1, -1].forEach(function (s) {
        EA.fuseGlass(c, ST, EA.sideKeepP(fdP, 0.5, s), s > 0 ? lbl('front_right_door_window') : lbl('front_left_door_window'), 'tempered', {
          pos: new V3(1.1, 1.7, s * 0.9),
        })
        EA.fuseGlass(c, ST, EA.sideKeepP(rdP, 0.5, s), s > 0 ? lbl('rear_right_door_window') : lbl('rear_left_door_window'), 'tempered', {
          pos: new V3(-0.1, 1.7, s * 0.9),
        })
        const df = EA.polySdf([
            [1.7, 0.75],
            [0.56, 0.72],
            [0.56, 2.18],
            [1.33, 2.22],
            [1.72, 1.72],
          ]),
          dr = EA.polySdf([
            [0.52, 0.72],
            [-0.74, 0.74],
            [-0.74, 2.14],
            [0.52, 2.18],
          ])
        EA.fuseSkin(
          c,
          ST,
          EA.bandT(function (x: any, y: any, z: any) {
            return Math.min(0.007 - Math.min(Math.abs(df(x, y)), Math.abs(dr(x, y))), s * z - 0.5)
          }),
          MT.dark,
          { k: 1.003 },
        )
        c.text('RESGATE', 1.0, 0.22, -1.25, 1.02, s * 0.79, s > 0 ? '+z' : '-z', { fg: '#f4f2ea' })
        /* steps on the skids */
        c.roundBox(0.3, 0.03, 0.18, 0.01, MT.steel, 1.0, 0.42, s * 1.02)
      })
      /* central strip and chin windows */
      c.tube(
        [
          [2.3, 2.2, 0],
          [2.75, 1.98, 0],
          [3.1, 1.62, 0],
          [3.28, 1.25, 0],
          [3.32, 1.0, 0],
        ],
        0.022,
        blk,
        { seg: 30 },
      )
      ;[1, -1].forEach(function (s) {
        c.tube(
          [
            [1.9, 0.98, s * 0.86],
            [2.6, 0.95, s * 0.66],
            [3.1, 1.05, s * 0.4],
          ],
          0.016,
          blk,
          { seg: 16 },
        )
      })
      /* interior: 2 seats at the front, 4-seat bench behind, panel with console, cyclic, collective, pedals */
      const fl = 0.78,
        fab = CM('#2f3a46', { roughness: 0.9 })
      c.roundBox(3.0, 0.03, 1.6, 0.01, MT.carpet, 0.6, fl, 0).castShadow = false
      ;[0.42, -0.42].forEach(function (z) {
        kit.seat(c, 1.25, fl, z, { w: 0.5, h: 0.38, back: 0.66, lean: 0.12, mat: fab })
        EA.cyclic(c, 1.6, fl, z)
        EA.pedals(c, 2.5, fl, z)
      })
      EA.collective(c, 1.3, fl, -0.72)
      EA.collective(c, 1.3, fl, 0.12)
      kit.seat(c, -0.35, fl + 0.04, 0, { w: 1.56, n: 4, h: 0.38, back: 0.62, lean: 0.1, mat: fab })
      EA.instPanel(c, 2.25, 1.55, 1.2, { gauges: 8, z0: -0.45, tilt: 0.3, screens: [[0.05, 0.25, 0.14, 0.2]] })
      c.roundBox(0.5, 0.45, 0.32, 0.06, CM('#232427'), 2.05, fl + 0.24, 0)
      c.roundBox(2.3, 0.02, 1.4, 0.01, MT.headliner, 0.45, 2.24, 0).castShadow = false
      /* engine and transmission cowling, air intake, exhaust, mast and Starflex head */
      const cow = c.add(
        EA.fuseGeo(
          [
            [0.95, 2.2, 2.3, 0.5, 2.4],
            [0.55, 2.2, 2.6, 1.0, 2.6],
            [-0.6, 2.2, 2.74, 1.12, 2.8],
            [-1.9, 2.2, 2.72, 1.04, 2.8],
            [-2.45, 2.24, 2.64, 0.66, 2.4],
            [-2.72, 2.34, 2.56, 0.3, 2.2],
          ],
          { smooth: 24 },
        ),
        white,
      )
      c.deform.push(cow)
      ;[1, -1].forEach(function (s) {
        c.roundBox(0.5, 0.2, 0.03, 0.03, blk, -0.15, 2.5, s * 0.54)
        for (let k = 0; k < 5; k++) c.roundBox(0.03, 0.22, 0.02, 0.008, MT.steel, -1.35 - k * 0.09, 2.5, s * 0.545)
      })
      c.cylinder(0.19, 0.24, 0.6, MT.trim, -2.45, 2.6, 0.18, 'x').rotation.y = 0.12
      c.cylinder(0.17, 0.17, 0.02, MT.dark, -2.76, 2.6, 0.22, 'x').rotation.y = 0.12
      c.cylinder(0.09, 0.11, 0.38, MT.steel, 0, 2.86, 0)
      c.cylinder(0.3, 0.26, 0.08, MT.steel, 0, 3.05, 0, null, { seg: 3 })
      const mr = EA.mainRotor(c, 0, 3.08, 0, {
        blades: 3,
        R: 5.345,
        chord: 0.35,
        droop: 0.15,
        hub: 0.32,
        hubR: 0.16,
        cap: true,
        v: 2.9,
        mat: CM('#2a2c30', { roughness: 0.5 }),
        phase: 0.2,
      })
      /* thin tail cone */
      const bx0 = -2.45,
        bx1 = -6.65,
        by0 = 1.86,
        by1 = 2.02,
        bl = Math.hypot(bx1 - bx0, by1 - by0)
      const boom = c.add(new THREE.CylinderGeometry(0.1, 0.3, bl, 22, 8), white, (bx0 + bx1) / 2, (by0 + by1) / 2, 0)
      boom.rotation.z = PI / 2 + Math.atan2(by1 - by0, bx0 - bx1)
      c.deform.push(boom)
      c.rod(new V3(-2.5, 1.95, 0), new V3(-6.1, 2.06, 0), 0.006, blk, { seg: 5 })
      /* empennage: stabilizer with plates, tall fin, ventral fin with a skid */
      const tm = c.paint('#d0531e')
      ;[1, -1].forEach(function (s) {
        const hs = c.add(
          EA.foilGeo(
            [
              { p: [-5.3, 1.98, 0], c: 0.6, t: 0.11 },
              { p: [-5.38, 1.98, s * 1.0], c: 0.52, t: 0.1 },
            ],
            { up: 'y', n: 8 },
          ),
          tm,
        )
        c.deform.push(hs)
        const ep = c.add(
          EA.foilGeo(
            [
              { p: [-5.3, 1.75, s * 1.02], c: 0.55, t: 0.08 },
              { p: [-5.42, 2.3, s * 1.02], c: 0.42, t: 0.08 },
            ],
            { up: 'z', n: 6 },
          ),
          tm,
        )
        c.deform.push(ep)
      })
      const fu = c.add(
        EA.foilGeo(
          [
            { p: [-6.15, 2.05, 0], c: 0.95, t: 0.12 },
            { p: [-6.8, 3.12, 0], c: 0.5, t: 0.1 },
          ],
          { up: 'z', n: 8 },
        ),
        tm,
      )
      c.deform.push(fu)
      const fd = c.add(
        EA.foilGeo(
          [
            { p: [-6.3, 1.97, 0], c: 0.62, t: 0.12 },
            { p: [-6.55, 1.38, 0], c: 0.4, t: 0.1 },
          ],
          { up: 'z', n: 8 },
        ),
        tm,
      )
      c.deform.push(fd)
      c.tube(
        [
          [-6.6, 1.4, 0],
          [-6.78, 1.3, 0],
          [-6.98, 1.34, 0],
        ],
        0.022,
        MT.steel,
        { seg: 10 },
      )
      c.cylinder(0.09, 0.09, 0.18, MT.steel, -6.68, 2.25, -0.12, 'z')
      const tr = EA.tailRotor(c, -6.68, 2.25, -0.24, {
        blades: 2,
        R: 0.93,
        chord: 0.18,
        mat: CM('#2a2c30', { roughness: 0.5 }),
        tipCol: '#e8e6df',
      })
      /* long skids */
      skidGear(c, {
        x0: -1.55,
        x1: 1.9,
        z: 1.15,
        cross: [
          [1.25, 0.66, 0.75, 0.05],
          [-0.85, 0.7, 0.7, -0.03],
        ],
        shoes: [-1.0, 1.4],
      })
      /* rescue hoist on the right side, spotlight under the nose, lights */
      c.roundBox(0.12, 0.08, 0.7, 0.03, MT.steel, 0.55, 2.38, 0.75)
      c.rod(new V3(0.55, 2.38, 1.08), new V3(0.55, 2.2, 1.08), 0.03, MT.steel)
      c.cylinder(0.11, 0.11, 0.3, CM('#d8d4c8'), 0.55, 2.08, 1.08)
      c.rod(new V3(0.55, 1.92, 1.08), new V3(0.55, 1.5, 1.08), 0.006, MT.steel)
      c.sphere(0.04, MT.yellow, 0.55, 1.48, 1.08)
      c.cylinder(0.13, 0.1, 0.16, MT.steel, 2.6, 0.62, 0, 'x')
      EA.lamp(c, 2.7, 0.62, 0.0001, 0.1, trl('labels.search_spotlight'))
      EA.lamp(c, 3.12, 0.92, -0.18, 0.06, trl('labels.landing_light'))
      EA.navLight(c, -5.38, 1.98, 1.06, 'green', trl('labels.right_navigation_light_green'), { r: 0.035 })
      EA.navLight(c, -5.38, 1.98, -1.06, 'red', trl('labels.left_navigation_light_red'), { r: 0.035 })
      EA.navLight(c, -6.98, 3.05, 0, 'white', trl('labels.tail_light'), { r: 0.03 })
      EA.navLight(c, -2.9, 2.08, 0, 'red', trl('labels.anti_collision_light'), { r: 0.05 })
      ;[1, -1].forEach(function (s) {
        c.text('PR-ESQ', 0.9, 0.2, -4.3, 1.98, s * 0.2, s > 0 ? '+z' : '-z', { fg: '#2a2c30' })
      })
      c.part('rotor', trl('labels.main_rotor'), mr, new V3(0, 3.08, 0), 1.6)
      c.part('tail_rotor', trl('labels.tail_rotor'), tr, new V3(-6.68, 2.25, -0.24), 1.0)
      c.part('engine', trl('labels.arriel_turbine'), null, new V3(-1.3, 2.5, 0), 1.0)
      c.part('fuel_tank', trl('labels.jet_a_1_tank'), null, new V3(-1.2, 1.2, 0), 1.0)
      c.part('landing_gear', trl('labels.skids'), null, new V3(0, 0.1, 1.15), 1.0)
      c.part('winch', trl('labels.rescue_winch'), null, new V3(0.55, 2.2, 1.08), 0.6)
      Object.assign(c.meta, {
        kind: 'heli',
        length: 10.35,
        width: 2.38,
        fuselageWidth: 1.82,
        front: 3.36,
        rear: -7.0,
        clearance: 0.66,
        belt: 1.25,
        bodyHeight: 1.65,
        top: 3.15,
        fuselageTop: 2.3,
        roof: null,
      })
      c.zone('nose', trl('labels.windshield_and_nose'), [1.7, 3.6, 0.6, 2.4, -1.0, 1.0])
      c.zone('cab', trl('labels.cabin_and_doors'), [-0.8, 1.7, 0.6, 2.35, -1.05, 1.05], null, {
        dir: 'left',
        fxKey: 'cab',
        who: trl('who.the_occupants'),
        anyMesh: true,
      })
      c.zone('tail_cone', trl('labels.tail_cone'), [-5.25, -2.5, 1.5, 2.3, -0.45, 0.45], null, {
        dir: 'up',
        fxKey: 'tail_cone',
        cutAll: true,
        anyMesh: true,
      })
      c.zone('empennage', trl('labels.fins_and_stabilizer'), [-7.1, -5.25, 1.2, 3.1, -1.2, 1.2], null, {
        type: 'part',
        fxKey: 'tail',
        dir: 'front',
        anyMesh: true,
      })
      c.zone('engine', trl('labels.turbine_and_transmission'), [-2.9, 0.8, 2.15, 2.85, -0.6, 0.6], null, {
        type: 'internal',
        fxKey: 'engine',
        sub: 'engine',
        pos: new V3(-1.3, 2.5, 0),
      })
      c.zone('winch', trl('labels.rescue_winch'), [0.3, 0.8, 1.4, 2.5, 0.6, 1.25], null, {
        type: 'part',
        fxKey: 'fairing',
        dir: 'left',
        fx: [
          trl('effects.none'),
          trl('effects.frayed_cable'),
          trl('effects.winch_jams_halfway'),
          trl('effects.cable_snapped_hook_dropped'),
          trl('effects.winch_torn_off_no_rescue'),
        ],
      })
      c.zone('headlight_center', trl('labels.landing_light_and_spotlight'))
      c.zone('taillight_right', trl('labels.right_navigation_light_green'))
      c.zone('taillight_left', trl('labels.left_navigation_light_red'))
      c.zone('taillight_center', trl('labels.tail_and_anti_collision_lights'))
      c.meta.armor = function (c2: any) {
        /* modified: steel plates on the floor and the pilot doors, left door machine gun, supply basket on the skid */
        const stl = kit.steelMaterial
        ;[1, -1].forEach(function (s) {
          c2.roundBox(0.95, 0.5, 0.02, 0.02, stl, 1.1, 0.98, s * 0.92)
        })
        c2.roundBox(2.8, 0.03, 1.5, 0.01, stl, 0.5, 0.64, 0)
        c2.rod(new V3(0.0, 1.0, -0.92), new V3(0.0, 1.5, -1.05), 0.03, stl)
        c2.cylinder(0.03, 0.03, 0.9, MT.trim, 0.2, 1.55, -1.08, 'x')
        c2.roundBox(0.25, 0.12, 0.1, 0.02, MT.trim, -0.15, 1.52, -1.08)
        c2.roundBox(0.9, 0.3, 0.4, 0.03, CM('#3d3a2e'), -0.2, 0.35, 1.15)
        kit.jerryCan(c2, -0.4, 0.66, 1.15, '#8e2a20')
        c2.part('weapon', trl('labels.door_machine_gun'), null, new V3(0.2, 1.55, -1.08), 0.6)
      }
    },
  )
}
