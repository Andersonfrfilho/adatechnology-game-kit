import type { FleetContext } from '../context'

/* SUVs, pickups, bigfoot and vans group. Uses only the kit API.
   Measurements in metres, close to the real sheets (length, wheelbase, overhangs, width, height, wheels).
   Local helpers of this file:
   - sculpt(): rounds the extruded body (pulls in the skirt, shoulder at the waist line, corners in plan)
   and makes the rigid parts follow;
   - bed(): cuts the pickup bed into the base car hull and adds floor, lining and wheel arches;
   - fenderFlare(): black plastic wheel-arch frame that follows the arch;
   - roof(), bPillar(), cPillar(), beltLine(): roof that drops to the rear, black pillars, small quarter window and a rising waist line;
   - liveLamp(): recesses the solid box of taillights and headlights so projectors and LEDs show through the lens;
   - plateOut(), sill(), crackedWindshield(): rear plate on the skin, dark inner sill and a cracked windshield in the front crash. */
export function installSuvPickupVan(fx: FleetContext): void {
  const kit = fx.kit
  const THREE = kit.THREE
  const trl = fx.t
  const lbl = fx.label

  const V3 = kit.V3,
    PI = Math.PI,
    MT = kit.materials,
    CM = kit.makeMaterial,
    clamp = kit.clamp,
    smooth = kit.smooth
  const CLAD = CM('#1a1b1d', { roughness: 0.82 }),
    LINER = CM('#1c1d1f', { roughness: 0.92 }),
    RIMDARK = CM('#2a2d30', { metalness: 0.6, roughness: 0.4 })
  const RIMSIL = CM('#b9bec2', { metalness: 0.75, roughness: 0.3 }),
    RIMGUN = CM('#55595d', { metalness: 0.7, roughness: 0.35 })

  /* ================= local utilities ================= */
  /* Real wheelbases and overhangs. The profile (lower) sits dF/dR inside the real measurement: the skin has a 5 cm chamfer and
     bumpers and taillights stick out a little from the profile. dF/dR were tuned by measuring the finished model. */
  function axles(WB: any, oF: any, L: any, dF: any, dR: any) {
    const xf = WB / 2,
      oR = L - WB - oF
    dF = dF == null ? 0.08 : dF
    dR = dR == null ? 0.1 : dR
    return { xf: xf, xr: -xf, F: xf + oF - dF, R: -xf - oR + dR, oF: oF, oR: oR }
  }
  /* Real track: the core puts the outer face of the tyre 3 cm outside the bodywork; takes each wheel to z = +-track/2. */
  function trackWidth(c: any, tF: any, tR: any) {
    c.wheels.forEach(function (w: any) {
      const s = w.position.z >= 0 ? 1 : -1,
        t = w.position.x > 0 ? tF : tR || tF,
        dz = (s * t) / 2 - w.position.z
      w.position.z += dz
      c.parts.forEach(function (p: any) {
        if (p.obj === w) p.pos.z += dz
      })
    })
  }
  /* Removes a glass from the base car that stays hidden under a painted pillar (no ghost zone or shards of a glass that cannot be seen). */
  function noGlass(c: any, label: any) {
    c.glass.slice().forEach(function (g: any) {
      const G = g.userData.glass
      if (!G || !G.label || G.label.indexOf(label) !== 0) return
      c.glass.splice(c.glass.indexOf(g), 1)
      if (g.parent) g.parent.remove(g)
      for (let i = c.parts.length - 1; i >= 0; i--) if (c.parts[i].obj === g) c.parts.splice(i, 1)
    })
  }

  /* Rounds the body. Deforms per vertex the lower hull, the hood, the bumpers and the long parts glued to the side;
     the other parts below the waist follow as a rigid body. o: { low (hull mesh), tuck, sh, peak, pf, pr, Rf, Rr, bowF, bowR, Rb, top, extra:[meshes] } */
  function sculpt(c: any, o: any) {
    const m = c.meta,
      W = m.width,
      by = o.bottom != null ? o.bottom : m.clearance,
      top = o.top != null ? o.top : m.belt
    const Wg = (m.glasshouse && m.glasshouse.Wg) || W,
      front = m.front,
      rear = m.rear
    const tuck = o.tuck == null ? 0.045 : o.tuck,
      peak = o.peak || 0.45
    const B = o.sh != null ? o.sh : clamp(1 - (Wg + 0.06) / W, 0, 0.06)
    const Rf = o.Rf || 0.55,
      Rr = o.Rr || 0.42,
      pf = o.pf == null ? 0.08 : o.pf,
      pr = o.pr == null ? 0.05 : o.pr
    const bowF = o.bowF == null ? 0.07 : o.bowF,
      bowR = o.bowR == null ? 0.04 : o.bowR,
      Rb = o.Rb || 0.35,
      hw = W / 2
    const crown = o.crown == null ? 0.045 : o.crown,
      xc = o.crownX != null ? o.crownX : m.glasshouse ? m.glasshouse.fb : front - 1,
      y0 = by + 0.55 * (top - by)
    function sc(y: any) {
      const t = clamp((y - by) / (top - by), 0, 1)
      return t < peak ? 1 - tuck * Math.pow(1 - t / peak, 2) : 1 - B * Math.pow((t - peak) / (1 - peak), 2)
    }
    function F(v: any) {
      const a = smooth((v.x - (front - Rf)) / Rf),
        b = smooth((rear + Rr - v.x) / Rr),
        zz = clamp(v.z / hw, -1, 1) * clamp(v.z / hw, -1, 1)
      const bf = smooth((v.x - (front - Rb)) / Rb),
        br = smooth((rear + Rb - v.x) / Rb)
      const cr = crown * (1 - zz) * smooth((v.y - y0) / (top - y0)) * smooth((v.x - xc) / 0.3)
      v.x += -bowF * zz * bf + bowR * zz * br
      v.z *= sc(Math.min(v.y, top)) * (1 - pf * a * a - pr * b * b)
      v.y += cr
    }
    c.root.updateMatrixWorld(true)
    const gInv = new THREE.Matrix4().copy(c.vehicle.matrixWorld).invert(),
      rel = new THREE.Matrix4(),
      inv = new THREE.Matrix4(),
      v = new V3()
    function warp(msh: any) {
      rel.multiplyMatrices(gInv, msh.matrixWorld)
      inv.copy(rel).invert()
      const g = msh.geometry,
        p = g.attributes.position
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(rel)
        F(v)
        v.applyMatrix4(inv)
        p.setXYZ(i, v.x, v.y, v.z)
      }
      p.needsUpdate = true
      if (!g.index && g.userData.crease) kit.geo.crease(g, 42)
      g.computeBoundingSphere()
      g.computeBoundingBox()
    }
    const skip = new Set(c.glass.concat(c.wheels)),
      warpSet = new Set([o.low].concat(o.extra || []))
    if (o.skip)
      o.skip.forEach(function (x: any) {
        skip.add(x)
      })
    if (m.frontBumper) warpSet.add(m.frontBumper)
    if (m.rearBumper) warpSet.add(m.rearBumper)
    if (c.hood && c.hood.piv) {
      skip.add(c.hood.piv)
      c.hood.piv.children.forEach(function (h: any) {
        if (h.isMesh) warpSet.add(h)
      })
    }
    c.deform.forEach(function (d: any) {
      if (d !== o.low && !warpSet.has(d) && d.parent === c.vehicle) {
        d.geometry.computeBoundingBox()
        if (d.geometry.boundingBox.min.y > top - 0.2) skip.add(d)
      }
    })
    warpSet.forEach(function (msh) {
      if (msh && msh.parent) warp(msh)
    })
    const bb = new THREE.Box3(),
      cen = new V3(),
      sz = new V3()
    c.vehicle.children.slice().forEach(function (ob: any) {
      if (skip.has(ob) || warpSet.has(ob)) return
      if (ob.isMesh) {
        const g = ob.geometry
        if (!g.boundingBox) g.computeBoundingBox()
        bb.copy(g.boundingBox).applyMatrix4(ob.matrix)
        bb.getCenter(cen)
        bb.getSize(sz)
        if (cen.y > top + 0.02) return
        if (Math.abs(cen.z) > hw * 0.55 && (sz.x > 0.3 || sz.y > 0.3)) {
          warp(ob)
          return
        }
      } else if (ob.isGroup) {
        cen.copy(ob.position)
        if (cen.y > top + 0.02) return
      } else return
      v.copy(cen)
      F(v)
      ob.position.add(v.sub(cen))
    })
    c.parts.forEach(function (pt: any) {
      if (pt.pos.y < top + 0.02) F(pt.pos)
    })
    return F
  }

  /* Wheel arch frame (black plastic) on both sides. a = [x, y, r] of the arch. */
  function fenderFlares(c: any, arches: any, W: any, by: any, o: any) {
    o = o || {}
    const wd = o.w || 0.075,
      dp = o.d || 0.045,
      mat = o.mat || CLAD,
      out: any = []
    arches.forEach(function (a: any) {
      /* the frame also covers the skin chamfer at the arch edge (otherwise a light ring shows between the tyre and the frame) */
      const a0 = Math.asin(clamp((by - a[1]) / a[2], -1, 1)) - 0.02,
        r0 = a[2] - (o.inner == null ? 0.055 : o.inner),
        r1 = a[2] + wd
      const sh = new THREE.Shape()
      if (o.trap) {
        /* trapezoid wheel arch (Jeep type): outer edge with a straight top and sloped sides, inner edge round */
        const yb0 = Math.sin(a0) * r1,
          xb0 = Math.cos(a0) * r1,
          top = r1 * 0.93,
          xt = r1 * 0.52
        sh.moveTo(xb0, yb0)
        sh.lineTo(r1 * 0.9, r1 * 0.5)
        sh.lineTo(xt, top)
        sh.lineTo(-xt, top)
        sh.lineTo(-r1 * 0.9, r1 * 0.5)
        sh.lineTo(-xb0, yb0)
        sh.absarc(0, 0, r0, PI - a0, a0, true)
      } else {
        sh.absarc(0, 0, r1, a0, PI - a0, false)
        sh.absarc(0, 0, r0, PI - a0, a0, true)
      }
      ;[1, -1].forEach(function (s) {
        const geo = new THREE.ExtrudeGeometry(sh, {
          depth: dp,
          bevelEnabled: true,
          bevelThickness: 0.012,
          bevelSize: 0.012,
          bevelSegments: 2,
          curveSegments: 28,
        })
        geo.translate(0, 0, s > 0 ? -0.02 : -dp + 0.02)
        out.push(c.add(geo, mat, a[0], a[1], s * (W / 2 - 0.004)))
      })
    })
    return out
  }
  /* Side skirt between the wheel arches (black plastic). */
  function skirt(c: any, x0: any, x1: any, y: any, h: any, W: any, mat?: any) {
    const out: any = []
    /* subdivided: sculpt() curves the side, and a box with vertices only at the ends would sink into the skin in the middle */
    ;[1, -1].forEach(function (s) {
      out.push(c.roundBox(x1 - x0, h, 0.05, 0.02, mat || CLAD, (x0 + x1) / 2, y, s * (W / 2 + 0.006), { sub: 0.2 }))
    })
    return out
  }
  /* Cuts the bed into the hull and lines it. o: { low, x0 (inner rear), x1 (inner front), floor, top, W, arches } */
  function cargoBed(c: any, o: any) {
    const W = o.W,
      hw = W / 2 - 0.075,
      L = o.x1 - o.x0,
      cx = (o.x0 + o.x1) / 2,
      h = o.top - o.floor
    kit.cutMesh(o.low, [kit.holeTop(o.x0, o.x1, hw + 0.005, o.floor + 0.05)])
    const fl = c.roundBox(L, 0.035, 2 * hw, 0.01, LINER, cx, o.floor, 0)
    for (let k = 0; k < 7; k++) c.roundBox(L - 0.04, 0.018, 0.04, 0.008, LINER, cx, o.floor + 0.025, -hw * 0.8 + (k * hw * 1.6) / 6)
    ;[1, -1].forEach(function (s) {
      c.roundBox(L, h, 0.025, 0.01, LINER, cx, o.floor + h / 2, s * (hw + 0.012))
    })
    c.roundBox(0.025, h, 2 * hw, 0.01, LINER, o.x0 + 0.012, o.floor + h / 2, 0)
    c.roundBox(0.03, h + 0.05, 2 * hw + 0.02, 0.01, c.paint(c.meta.color), o.x1 - 0.015, o.floor + (h + 0.05) / 2, 0)
    ;(o.arches || []).forEach(function (a: any) {
      if (a[0] < o.x0 - 0.3 || a[0] > o.x1 + 0.3) return
      const tt = a[1] + a[2] + 0.04 - o.floor
      if (tt <= 0.02) return
      const lx0 = Math.max(o.x0 + 0.03, a[0] - a[2]),
        lx1 = Math.min(o.x1 - 0.03, a[0] + a[2])
      ;[1, -1].forEach(function (s) {
        c.roundBox(lx1 - lx0, tt, 0.24, 0.05, LINER, (lx0 + lx1) / 2, o.floor + tt / 2, s * (hw - 0.12))
      })
    })
    for (let t = 0; t < 4; t++)
      [1, -1].forEach(function (s) {
        c.cylinder(0.018, 0.018, 0.03, MT.steel, o.x0 + 0.1 + (t * (L - 0.2)) / 3, o.top - 0.04, s * (hw - 0.005), 'z')
      })
    c.meta.bed = { x0: o.x0 + 0.05, x1: o.x1 - 0.05, y: o.floor }
    c.part('cargo', trl('labels.cargo_bed'), fl, new V3(cx, o.floor + 0.2, 0), 1.0)
  }
  /* x of the skin (front, +x) or the rear (-x) at point (y, z), measured by a ray on the already sculpted mesh.
     fX() comes from the profile before sculpt() and is off by a few cm where the nose corner is rounded. */
  function skinX(c: any, msh: any, y: any, z: any, rear?: any) {
    c.root.updateMatrixWorld(true)
    const o = c.vehicle.localToWorld(new V3(rear ? -9 : 9, y, z || 0)),
      d = new V3(rear ? 1 : -1, 0, 0).transformDirection(c.vehicle.matrixWorld)
    const hit = new THREE.Raycaster(o, d, 0, 20).intersectObject(msh, false)[0]
    return hit ? c.vehicle.worldToLocal(hit.point.clone()).x : null
  }
  function grille(c: any, s: any, style: any, w: any, h: any, y: any, o: any) {
    const x = kit.profX(s.lower, y, true)
    return kit.grille(c, Object.assign({ style: style, x: x + 0.03, y: y, w: w, h: h, col: s.col, emblem: false }, o || {}))
  }
  function fog(c: any, s: any, y: any, z: any, r: any) {
    const x = kit.profX(s.lower, s.bottomY + 0.14, true) + 0.09
    ;[1, -1].forEach(function (sd) {
      c.roundBox(0.04, r * 2.6, r * 3.2, 0.015, MT.housing, x, y, sd * z)
      kit.headlight(c, {
        style: 'round',
        x: x + 0.01,
        y: y,
        z: sd * z,
        w: r * 2,
        h: r * 2,
        d: 0.05,
        side: sd,
        label: sd > 0 ? trl('labels.right_fog_light') : trl('labels.left_fog_light'),
        reach: 0.5,
      })
    })
  }
  function roofBars(c: any, z: any, h: any, r: any) {
    const m = c.meta
    h = h || 0.07
    ;[z, -z].forEach(function (zz) {
      c.rod(new V3(m.roof.x0 - 0.02, m.top + h, zz), new V3(m.roof.x1 + 0.02, m.top + h, zz), r || 0.022, MT.trim)
      ;[m.roof.x0, m.roof.x1].forEach(function (x) {
        c.roundBox(0.1, h + 0.02, 0.05, 0.02, MT.trim, x, m.top + h / 2, zz)
      })
    })
  }
  /* Shark-fin antenna at the end of the roof */
  function dorsalFin(c: any, x: any, col?: any) {
    const m = c.meta,
      g = c.roundBox(0.16, 0.06, 0.05, 0.025, col ? c.paint(col) : GLOSS, x, m.top + 0.02, 0, { taper: { sx: 0.35, shift: -0.05 } })
    return g
  }
  function runningBoard(c: any, x0: any, x1: any, y: any, W: any, dz: any) {
    dz = dz == null ? 0.04 : dz
    ;[1, -1].forEach(function (s) {
      c.roundBox(x1 - x0, 0.04, 0.16, 0.015, MT.alu, (x0 + x1) / 2, y, s * (W / 2 + dz))
      ;[x0 + 0.25, (x0 + x1) / 2, x1 - 0.25].forEach(function (x) {
        c.roundBox(0.05, 0.1, 0.14, 0.01, MT.trim, x, y + 0.05, s * (W / 2 - 0.02))
      })
    })
  }
  function snorkel(c: any, x: any, yb: any, yt: any, z: any, xb: any) {
    const s = Math.sign(z)
    c.tube(
      [
        [x, yb, z],
        [x - 0.05, yb + 0.3, z + s * 0.02],
        [xb, yt - 0.1, z - s * 0.06],
        [xb - 0.02, yt, z - s * 0.08],
      ],
      0.045,
      MT.trim,
      { seg: 30, rs: 10 },
    )
    c.roundBox(0.16, 0.12, 0.12, 0.04, MT.trim, xb + 0.04, yt + 0.04, z - s * 0.08)
  }
  function winch(c: any, x: any, y: any) {
    c.cylinder(0.08, 0.08, 0.5, MT.trim, x, y, 0, 'z')
    c.cylinder(0.07, 0.07, 0.3, CM('#7a1d17'), x, y, 0, 'z')
    c.roundBox(0.12, 0.1, 0.1, 0.02, MT.steel, x + 0.08, y, 0)
    c.part('winch', trl('labels.winch'), null, new V3(x, y, 0), 0.5)
  }
  function ledBar(c: any, x: any, y: any, w: any) {
    c.roundBox(0.1, 0.1, w, 0.03, MT.housing, x, y, 0)
    const L = kit.lightBar(c, x + 0.04, y, -w / 2 + 0.04, w / 2 - 0.04, 0.05, 1)
    ;[-w / 2 + 0.1, w / 2 - 0.1].forEach(function (z) {
      c.rod(new V3(x - 0.05, y - 0.05, z), new V3(x - 0.15, y - 0.13, z), 0.015, MT.trim)
    })
    return L
  }
  /* Cage in the bed (modified pickups) */
  function bedCage(c: any) {
    const m = c.meta,
      b = m.bed
    if (!b) return
    const hw = m.width / 2 - 0.1,
      yt = m.top + 0.15
    ;[b.x0 + 0.05, (b.x0 + b.x1) / 2, b.x1 - 0.05].forEach(function (x) {
      c.tube(
        [
          [x, m.belt, -hw],
          [x, yt - 0.05, -hw + 0.05],
          [x, yt, 0],
          [x, yt - 0.05, hw - 0.05],
          [x, m.belt, hw],
        ],
        0.03,
        kit.steelMaterial,
        { seg: 24, rs: 8 },
      )
    })
    ;[-hw * 0.6, 0, hw * 0.6].forEach(function (z) {
      c.rod(new V3(b.x0 + 0.05, yt - (z ? 0.03 : 0), z), new V3(b.x1 - 0.05, yt - (z ? 0.03 : 0), z), 0.018, kit.steelMaterial)
    })
    for (let x = b.x0 + 0.1; x < b.x1; x += 0.16)
      [1, -1].forEach(function (s) {
        c.rod(new V3(x, m.belt, s * hw), new V3(x, yt - 0.1, s * (hw - 0.05)), 0.008, kit.steelMaterial, { seg: 5 })
      })
    const hx = b.x1 - 0.1
    c.cylinder(0.12, 0.09, 0.2, MT.steel, hx, yt + 0.12, 0, 'x')
    c.cylinder(0.1, 0.1, 0.02, MT.head, hx + 0.1, yt + 0.12, 0, 'x')
    c.rod(new V3(hx, yt, 0), new V3(hx, yt + 0.06, 0), 0.03, MT.trim)
  }

  /* ---- round 2: glasshouse with character (dropping roof, black C pillar, rising waist line), trim and damage ---- */
  const BV = 0.05 /* the extruded hull has a 5 cm chamfer: the skin sits 5 cm outside the profile */
  const GLOSS = CM('#0b0c0e', { roughness: 0.16, metalness: 0.55 }),
    SILL = CM('#141517', { roughness: 0.8 })
  function fX(s: any, y: any) {
    return kit.profX(s.lower, y, true) + BV
  }
  function rX(s: any, y: any) {
    return kit.profX(s.lower, y, false) - BV
  }
  /* Rear plate and texts on the lid: the core puts the plate 2.5 cm inside the chamfer. Takes it to the skin. */
  function plateOutside(c: any) {
    const m = c.meta
    c.vehicle.children.forEach(function (o: any) {
      if (
        o.isMesh &&
        o.geometry.type === 'PlaneGeometry' &&
        Math.abs(o.rotation.y + PI / 2) < 0.01 &&
        o.position.x < m.rear + 0.2 &&
        o.material.map &&
        o.material.map.image &&
        o.material.map.image.width === 400
      )
        o.position.x = Math.min(o.position.x, m.rear - BV * 0.5) - BV * 0.62
    })
  }
  /* Dark trim on the inner sill of the doors (without it the top of the bodywork shows through the windshield as a band in the car colour) */
  function sill(c: any) {
    const gh = c.meta.glasshouse
    if (!gh || !gh.Wg || gh.rb == null) return
    const x0 = gh.rb + 0.1,
      x1 = gh.fb - 0.05
    ;[1, -1].forEach(function (s) {
      c.roundBox(x1 - x0, 0.035, 0.12, 0.012, SILL, (x0 + x1) / 2, gh.belt + 0.05, s * (gh.Wg / 2 - 0.06)).castShadow = false
    })
  }
  /* Thin panel glued to the side of the glasshouse (follows the taper T). poly in [x, y]; mat; o.off distance from the skin */
  function applique(c: any, poly: any, mat: any, o?: any) {
    o = o || {}
    const m = c.meta,
      Wg = m.glasshouse.Wg,
      T = m.tumble,
      off = o.off || 0.017,
      out: any = []
    ;(o.sides || [1, -1]).forEach(function (s: any) {
      const shp = kit.geo.pathShape(
        poly.map(function (p: any) {
          return [p[0], p[1], p[2] || 0]
        }),
      )
      const geo = new THREE.ExtrudeGeometry(shp, { depth: 0.007, bevelEnabled: false, curveSegments: 6 })
      geo.translate(0, 0, s > 0 ? Wg / 2 + off : -Wg / 2 - off - 0.007)
      kit.geo.tumble(geo, T)
      geo.computeVertexNormals()
      const me = c.add(geo, mat)
      me.castShadow = false
      c.deform.push(me)
      out.push(me)
    })
    return out
  }
  /* Glasshouse geometry: base/top lines and side glass edges (like the core autoWindows) */
  function glasshouse(c: any) {
    const gh = c.meta.glasshouse,
      b = gh.belt,
      r = gh.roof
    const lx = function (x0: any, x1: any, y: any) {
      return x0 + ((x1 - x0) * (y - b)) / (r - b)
    }
    return {
      b: b,
      yb: b + 0.06,
      yt: r - 0.075,
      top: r + 0.02,
      back: function (y: any) {
        return lx(gh.rb, gh.rt, y)
      },
      win: function (y: any) {
        return lx(gh.rb, gh.rt, y) + 0.0975
      },
    }
  }
  /* Wide black C (or D) pillar, with a small triangular quarter window. xp = pillar that separates the quarter window; vig = [xv (rear tip at the top), yv (lower tip on the pillar)] */
  function pillarC(c: any, xp: any, quarterWindow: any, mat?: any) {
    const E = glasshouse(c),
      yt = E.top - 0.03,
      b = E.b + 0.012
    let poly
    if (quarterWindow)
      poly = [
        [xp + 0.06, b],
        [xp + 0.06, yt],
        [xp - 0.065, yt],
        [xp - 0.065, quarterWindow[1]],
        [quarterWindow[0], E.yt - 0.005],
        [quarterWindow[0], yt],
        [E.back(yt) + 0.035, yt],
        [E.back(b) + 0.035, b],
      ]
    else
      poly = [
        [xp + 0.06, b],
        [xp + 0.06, yt],
        [E.back(yt) + 0.035, yt],
        [E.back(b) + 0.035, b],
      ]
    const out = applique(c, poly, mat || GLOSS)
    if (quarterWindow)
      [1, -1].forEach(function (s) {
        const z = function (y: any) {
          return s * (kit.halfAt(c.meta.glasshouse.Wg, c.meta.tumble, y) + 0.022)
        }
        c.tube(
          [
            [xp - 0.065, quarterWindow[1], z(quarterWindow[1])],
            [quarterWindow[0], E.yt - 0.005, z(E.yt)],
          ],
          0.006,
          MT.chrome,
          { seg: 8, rs: 5 },
        )
      })
    return out
  }
  /* Wide C pillar in the bodywork colour (no quarter window): xb/xt = front edge at the bottom and top (sloped like the real door). */
  function paintedPillar(c: any, xb: any, xt: any, col: any, o?: any) {
    o = o || {}
    const E = glasshouse(c),
      yt = E.top - 0.025,
      b = E.b + 0.005
    const out = applique(
      c,
      [
        [xb, b],
        [xt, yt],
        [E.back(yt) + 0.03, yt],
        [E.back(b) + 0.03, b],
      ],
      o.mat || c.paint(col),
      { off: 0.016 },
    )
    ;[1, -1].forEach(function (s) {
      const z = function (y: any) {
        return s * (kit.halfAt(c.meta.glasshouse.Wg, c.meta.tumble, y) + 0.024)
      }
      c.tube(
        [
          [xb + 0.004, E.yb, z(E.yb)],
          [xt + 0.004, E.yt, z(E.yt)],
        ],
        0.008,
        o.edge || GLOSS,
        { seg: 6, rs: 5 },
      )
    })
    return out
  }
  /* Black B pillar (window trim). */
  function pillarB(c: any, x: any, mat?: any) {
    const E = glasshouse(c)
    return applique(
      c,
      [
        [x - 0.065, E.b + 0.03],
        [x + 0.065, E.b + 0.03],
        [x + 0.065, E.top - 0.03],
        [x - 0.065, E.top - 0.03],
      ],
      mat || GLOSS,
    )
  }
  /* Waist line that rises to the rear: a car-colour panel covers the base of the glass from x0 (rise 0) to the rear (rise dy). */
  function beltline(c: any, x0: any, dy: any, col: any) {
    const E = glasshouse(c),
      xr = E.back(E.yb + dy) + 0.03,
      y0 = E.b - 0.02
    const out = applique(
      c,
      [
        [x0, y0],
        [x0, E.yb - 0.008],
        [xr, E.yb + dy],
        [xr, y0],
      ],
      c.paint(col),
      { off: 0.016 },
    )
    ;[1, -1].forEach(function (s) {
      const z = function (y: any) {
        return s * (kit.halfAt(c.meta.glasshouse.Wg, c.meta.tumble, y) + 0.024)
      }
      c.tube(
        [
          [x0, E.yb - 0.008, z(E.yb)],
          [xr + 0.03, E.yb + dy, z(E.yb + dy)],
        ],
        0.007,
        MT.trim,
        { seg: 10, rs: 5 },
      )
    })
    return out
  }
  /* Roof that drops to the rear: lowers everything above the waist by drop (m) from x0 to x1, proportional to the height above the waist. */
  function roof(c: any, drop: any, x0: any, x1: any) {
    const m = c.meta,
      b = m.glasshouse.belt,
      h = m.top - b
    function dy(x: any, y: any) {
      const t = clamp((y - b) / h, 0, 1)
      return t <= 0 ? 0 : drop * smooth((x0 - x) / (x0 - x1)) * t
    }
    c.root.updateMatrixWorld(true)
    const gInv = new THREE.Matrix4().copy(c.vehicle.matrixWorld).invert(),
      rel = new THREE.Matrix4(),
      inv = new THREE.Matrix4(),
      v = new V3(),
      done = new Set()
    c.vehicle.traverse(function (ob: any) {
      if (!ob.isMesh || done.has(ob.geometry)) return
      done.add(ob.geometry)
      rel.multiplyMatrices(gInv, ob.matrixWorld)
      inv.copy(rel).invert()
      const g = ob.geometry,
        p = g.attributes.position
      let ch = false
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(rel)
        if (v.y <= b + 1e-4 || v.x > x0) continue
        const d = dy(v.x, v.y)
        if (d <= 0) continue
        v.y -= d
        v.applyMatrix4(inv)
        p.setXYZ(i, v.x, v.y, v.z)
        ch = true
      }
      if (!ch) return
      p.needsUpdate = true
      if (!g.index && g.userData.crease) kit.geo.crease(g, 42)
      g.computeBoundingSphere()
      g.computeBoundingBox()
    })
    c.glass.forEach(function (gm: any) {
      const G = gm.userData.glass
      if (G && G.outline)
        G.outline.forEach(function (q: any) {
          q.y -= dy(q.x, q.y)
        })
    })
    c.parts.forEach(function (pt: any) {
      pt.pos.y -= dy(pt.pos.x, pt.pos.y)
    })
  }
  /* Front crash of the damaged state: besides the default, the head of whoever hits cracks the windshield (laminated, web pattern). */
  function crackWindshield(c: any, f: any) {
    const q = c.meta.frontQuad,
      g = c.glass.find(function (x: any) {
        return x.userData.glass && x.userData.glass.label === trl('labels.windshield')
      })
    if (!q || !g) return
    const pt = c.parts.find(function (p: any) {
      return p.obj === g
    })
    if (!pt || pt.done) return
    const v = 0.35,
      p = new V3(q.b[0] + (q.t[0] - q.b[0]) * v, q.b[1] + (q.t[1] - q.b[1]) * v, 0.18)
    pt.done = true
    kit.applyPart(c, pt, f, new V3(-q.n[0], -q.n[1], 0), p)
    c.log.push(pt)
  }
  function crashDamage(c: any) {
    kit.defaultDamage(c)
    crackWindshield(c, 0.95)
  }
  /* Wraps the default effect of a part (to limit hanging off the bumper, half-open hood...) */
  function setOnHit(pt: any, fn: any) {
    if (!pt) return
    pt.onHit = function (c: any, p0: any, f: any, dir: any, p: any) {
      const keep = p0.onHit
      p0.onHit = null
      kit.applyPart(c, p0, f, dir, p)
      p0.onHit = keep
      fn(c, p0, f, dir, p)
    }
  }
  /* Chrome reflector behind the lens: a lit headlight reads as a headlight, not as a matte grey box (goes off when the headlight breaks). */
  function recessedLamps(c: any) {
    c.lights.forEach(function (L: any) {
      if (!L.group || L.group.userData.recessed) return
      L.group.userData.recessed = true
      /* the core housing box is solid and hides projectors and LEDs: pulls its front back 4 cm so the core shows through the lens */
      L.group.children.slice().forEach(function (h: any) {
        if (!h.isMesh || h.material !== MT.housing || h.geometry.type !== 'BoxGeometry' || Math.abs(h.position.x) > 1e-3) return
        h.geometry.computeBoundingBox()
        const bb = h.geometry.boundingBox,
          d = bb.max.x - bb.min.x
        if (d < 0.06) return
        const k = (d - 0.042) / d
        h.scale.x = k
        h.position.x = bb.min.x * (1 - k)
        if (L.kind === 'headlight' && bb.max.z - bb.min.z >= 0.12) {
          const r = c.roundBox(
            0.006,
            (bb.max.y - bb.min.y) * 0.78,
            (bb.max.z - bb.min.z) * 0.9,
            0.003,
            MT.reflector,
            bb.max.x - 0.036,
            h.position.y,
            h.position.z,
            { parent: L.group },
          )
          r.castShadow = false
          L.inner.push(r)
        }
      })
    })
  }
  /* Headliner (and saloon light panel): the core does not put it in the roof zone, and with the roof torn off a light plate
     was left loose over the cabin. Goes away with the roof when torn off, together with what is
     mounted on top of the roof (extra: beacon, roof lights), which would otherwise float. */
  function roofLining(c: any, extra: any) {
    const m = c.meta,
      yb = (m.glasshouse ? m.glasshouse.belt : m.belt) + 0.25,
      bb = new THREE.Box3(),
      sz = new V3(),
      ce = new V3(),
      gl = new Set(c.glass),
      list: any = []
    const cols = [m.color, m.roofCol].filter(Boolean).map(function (h) {
      return new THREE.Color(h).getHex()
    })
    c.vehicle.children.forEach(function (o: any) {
      if (
        !o.isMesh ||
        gl.has(o) ||
        o.geometry.type !== 'BoxGeometry' ||
        o.material === MT.trim ||
        o.material === MT.chrome ||
        o.material.transparent
      )
        return
      if (o.material.color && cols.indexOf(o.material.color.getHex()) >= 0) return
      o.geometry.computeBoundingBox()
      bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrix)
      bb.getSize(sz)
      bb.getCenter(ce)
      if (sz.x > 0.5 && sz.z > 0.6 && sz.y < 0.08 && ce.y > yb) list.push(o)
    })
    extra = extra || []
    /* does not become a roof part (the rust decals would go to the headliner and hang in the air): it only goes away along with it */
    if (list.length || extra.length)
      c.zone('roof', null, null, null, {
        onBand: function (c: any, b: any) {
          if (b >= 4)
            list.concat(extra).forEach(function (o: any) {
              o.visible = false
            })
        },
      })
  }
  function finishing(c: any, extra?: any) {
    plateOutside(c)
    sill(c)
    recessedLamps(c)
    roofLining(c, extra)
    if (!c.meta.damage) c.meta.damage = crashDamage
  }

  /* ================= SUVs ================= */
  function suvBuild(c: any, s: any, o: any) {
    o = o || {}
    const n0 = c.deform.length
    kit.car(c, s)
    const low = c.deform[n0],
      m = c.meta
    let extra: any = []
    if (o.flares !== false) extra = extra.concat(fenderFlares(c, s.arches, s.W, s.bottomY, o.flare))
    if (o.skirt !== false) {
      const a = s.arches
      extra = extra.concat(skirt(c, a[1][0] + a[1][2] + 0.04, a[0][0] - a[0][2] - 0.04, s.bottomY + 0.1, 0.16, s.W))
    }
    if (o.pre) o.pre(c, m, extra)
    const F = sculpt(c, Object.assign({ low: low, extra: extra }, o.sculpt || {}))
    if (o.post) o.post(c, m, F, low)
    if (o.roof) roof(c, o.roof[0], o.roof[1], o.roof[2])
    finishing(c)
    return low
  }
  function suvArmor(xSn?: any) {
    return function (c: any) {
      const m = c.meta
      kit.applyArmor(c)
      if (m.glasshouse)
        snorkel(c, m.glasshouse.fb + 0.25, m.clearance + 0.45, m.top - 0.05, m.width / 2 + 0.03, m.glasshouse.ft + 0.1 + (xSn || 0))
      winch(c, m.front + 0.12, m.clearance + 0.2)
      if (m.roof) ledBar(c, m.roof.x1 - 0.05, m.top + 0.2, Math.min(1.2, m.roof.w))
    }
  }

  /* Compact SUV (VW T-Cross type, 2019-2024, Brazil)
     Reference (fichacompleta.com.br, Highline 2022): length 4.199 m · width 1.760 m · height 1.570 m · wheelbase 2.651 m ·
     track 1.524 m (front) / 1.509 m (rear) · tyre 205/55 R17 (0.657 m) · front overhang about 0.84 m and rear about 0.71 m (from memory) ·
     ground clearance 0.191 m · 1292 kg · tank 52 L · 11.8 km/L (G) and 8.2 km/L (E) in the city.
     Signature traits:
     front   · thin LED headlights at hood height, joined by a glossy black band with a chrome trim below;
     · bumper with a wide lower honeycomb grille and fog lights at the ends;
     side    · tall straight box, high almost flat hood, black frames on the wheel arches and black skirt;
     · black B pillar and wide C pillar in the car colour, with the rear door edge sloped forward;
     · almost straight roof with thin bars; almost vertical tailgate;
     rear    · dark red reflective band joining the horizontal taillights from end to end, name in the middle;
     · tall black bumper with a silver guard;
     top     · thin longitudinal bars; short windshield and small rear glass. */
  fx.register(
    {
      key: 'compact_suv',
      group: 'suvs',
      name: trl('vehicles.compact_suv.name'),
      inspired: trl('vehicles.compact_suv.inspired'),
      category: trl('vehicles.compact_suv.category'),
      fuel: 'flex',
      description: trl('vehicles.compact_suv.description'),
      mass: 1290,
      noise: 60,
      seats: trl('vehicles.compact_suv.seats'),
      capacity: trl('vehicles.compact_suv.capacity'),
      efficiency: trl('vehicles.compact_suv.efficiency'),
      range: trl('vehicles.compact_suv.range'),
      maxSpeed: 190,
      skill: trl('vehicles.compact_suv.skill'),
      hood: true,
    },
    function (c) {
      const A = axles(2.651, 0.84, 4.199, 0.07, 0.145),
        col = '#b8b3a6',
        R = A.R,
        F = A.F
      const s = {
        W: 1.72,
        col: col,
        bottomY: 0.3,
        noseY: 0.86,
        tailY: 0.98,
        lower: [
          [R, 0.33, 0.08],
          [R - 0.03, 0.62, 0.12],
          [R + 0.04, 0.99, 0.08],
          [0.95, 1.0, 0],
          [1.55, 0.955, 0.3],
          [F - 0.045, 0.89, 0.1],
          [F, 0.6, 0.14],
          [F - 0.04, 0.32, 0.08],
        ],
        arches: [
          [A.xf, 0.33, 0.375],
          [A.xr, 0.33, 0.375],
        ],
        gh: {
          rb: R + 0.06,
          rt: R + 0.27,
          ft: 0.13,
          fb: 0.97,
          belt: 1.0,
          roof: 1.475,
          Wg: 1.62,
          k: 0.14,
          pillars: [-0.12, -0.98],
          r1: 0.1,
          r2: 0.2,
        },
        seams: [0.99, -0.13, -0.99],
        handles: [0.42, -0.6],
        plateRearY: 0.75,
        noAntenna: true,
        hl: { style: 'slim', w: 0.36, h: 0.1, y: 0.835, in: 0.04, yaw: 0.25, dx: 0.03, mat: MT.led },
        grille: false,
        tl: { style: 'wrap', w: 0.3, h: 0.095, y: 0.92, wrap: 0.16 },
        interior: { rows: 2, col: '#2b2c30', trim: '#18191b' },
        hood: { motor: 'gasoline' },
        wheels: [
          [A.xf, 0.3285, 0.205, { rim: RIMGUN, spokes: 10 }],
          [A.xr, 0.3285, 0.205, { rim: RIMGUN, spokes: 10 }],
        ],
      }
      suvBuild(c, s, {
        roof: [0.025, -0.3, R + 0.27],
        flare: { w: 0.06, d: 0.035 },
        pre: function (c: any, _m: any) {
          /* glossy black band between the headlights, chrome trim from end to end below it */
          c.roundBox(0.05, 0.095, 1.0, 0.02, GLOSS, fX(s, 0.835) - 0.02, 0.835, 0)
          c.roundBox(0.03, 0.014, 1.36, 0.006, MT.chrome, fX(s, 0.79) - 0.004, 0.79, 0)
          /* bumper: wide honeycomb lower grille in a black frame; fog light niches */
          c.roundBox(0.05, 0.22, 1.1, 0.05, MT.trim, fX(s, 0.52) - 0.025, 0.52, 0)
          grille(c, s, 'mesh', 0.98, 0.16, 0.53, { x: fX(s, 0.53) - 0.01 })
          ;[1, -1].forEach(function (sd) {
            c.roundBox(0.04, 0.1, 0.18, 0.03, GLOSS, fX(s, 0.43) - 0.01, 0.43, sd * 0.66, { rot: [sd * -0.25, 0, 0] })
          })
          fog(c, s, 0.43, 0.66, 0.03)
          /* rear: dark reflective band joining the taillights, with the name in silver */
          c.roundBox(0.03, 0.085, 1.08, 0.012, CM('#3a1412', { roughness: 0.12, metalness: 0.6 }), rX(s, 0.92) + 0.002, 0.92, 0)
          c.text('T-CRUX', 0.24, 0.045, rX(s, 0.92) - 0.016, 0.92, 0, '-x', { fg: '#d7d9db', size: 0.7 })
          /* tall black rear bumper with a silver guard */
          c.roundBox(0.1, 0.16, s.W * 0.95, 0.05, MT.trim, rX(s, 0.52) + 0.02, 0.5, 0, { def: true })
          c.roundBox(0.04, 0.045, 0.8, 0.015, MT.alu, rX(s, 0.4) - 0.07, 0.37, 0)
          roofBars(c, 0.64, 0.035, 0.015)
          dorsalFin(c, R + 0.42)
        },
        post: function (c: any, _m: any) {
          pillarB(c, -0.12)
          noGlass(c, trl('labels.quarter_glass'))
          paintedPillar(c, -1.0, -0.9, col)
          trackWidth(c, 1.524, 1.509)
        },
      })
      c.meta.armor = suvArmor()
    },
  )

  /* Hybrid crossover (Corolla Cross Hybrid type, 2021+, Brazil)
     Reference (fichacompleta.com.br, Altis Premium Hybrid 2022): length 4.460 m · width 1.825 m · height 1.620 m ·
     wheelbase 2.640 m · track 1.559 m / 1.571 m · tyre 225/50 R18 (0.682 m) · front overhang about 0.93 m and rear about 0.89 m (from memory) ·
     ground clearance 0.161 m · 1450 kg · tank 36 L · 17 km/L (G) and 11.8 km/L (E) in the city · 170 km/h.
     Signature traits:
     front   · angular wedge headlights joined by a thin upper grille with a chrome trim;
     · huge trapezoid lower grille in glossy black with a honeycomb, flanked by vertical black "fangs";
     side    · wide black mouldings on the wheel arches, black B pillar, triangular quarter window behind the rear door and D pillar in the car colour;
     · waist line rising to the rear and a roof that drops smoothly; blue HYBRID sticker on the fender;
     rear    · horizontal taillights that invade the lid, joined by a trim; bumper with a black skirt;
     top     · longitudinal bars; roof tapering at the rear. */
  fx.register(
    {
      key: 'hybrid_suv',
      group: 'suvs',
      name: trl('vehicles.hybrid_suv.name'),
      inspired: trl('vehicles.hybrid_suv.inspired'),
      category: trl('vehicles.hybrid_suv.category'),
      fuel: 'hybrid',
      description: trl('vehicles.hybrid_suv.description'),
      mass: 1455,
      noise: 20,
      seats: trl('vehicles.hybrid_suv.seats'),
      capacity: trl('vehicles.hybrid_suv.capacity'),
      efficiency: trl('vehicles.hybrid_suv.efficiency'),
      range: trl('vehicles.hybrid_suv.range'),
      maxSpeed: 170,
      skill: trl('vehicles.hybrid_suv.skill'),
      hood: true,
    },
    function (c) {
      const A = axles(2.64, 0.93, 4.46, 0.07, 0.1),
        col = '#7d8389',
        R = A.R
      const s = {
        W: 1.785,
        col: col,
        bottomY: 0.32,
        noseY: 0.88,
        tailY: 1.04,
        noAntenna: true,
        lower: [
          [A.R, 0.36, 0.08],
          [A.R - 0.03, 0.64, 0.14],
          [A.R + 0.11, 1.04, 0.14],
          [0.98, 1.05, 0],
          [1.62, 0.98, 0.32],
          [A.F - 0.05, 0.88, 0.12],
          [A.F, 0.6, 0.16],
          [A.F - 0.05, 0.35, 0.08],
        ],
        arches: [
          [A.xf, 0.341, 0.395],
          [A.xr, 0.341, 0.395],
        ],
        gh: {
          rb: A.R + 0.12,
          rt: A.R + 0.6,
          ft: 0.12,
          fb: 1.02,
          belt: 1.03,
          roof: 1.525,
          Wg: 1.7,
          k: 0.15,
          pillars: [-0.18, -1.12],
          r1: 0.22,
          r2: 0.22,
        },
        seams: [1.05, -0.19, -1.11],
        handles: [0.42, -0.66],
        plateRearY: 0.74,
        hl: { style: 'wedge', w: 0.46, h: 0.11, y: 0.855, in: 0.025, yaw: 0.3, dx: 0.03, mat: MT.led },
        grille: false,
        tl: { style: 'wrap', w: 0.36, h: 0.085, y: 0.975, in: 0.03, wrap: 0.2 },
        interior: { rows: 2, col: '#3a3c40', trim: '#1b1c1f' },
        hood: { motor: 'gasoline' },
        wheels: [
          [A.xf, 0.341, 0.225, { rim: RIMDARK, spokes: 5 }],
          [A.xr, 0.341, 0.225, { rim: RIMDARK, spokes: 5 }],
        ],
      }
      suvBuild(c, s, {
        roof: [0.06, -0.25, A.R + 0.6],
        flare: { w: 0.085, d: 0.04 },
        pre: function (c: any, _m: any) {
          /* thin upper grille between the headlights */
          c.roundBox(0.05, 0.05, 0.86, 0.018, GLOSS, fX(s, 0.84) - 0.015, 0.84, 0)
          c.roundBox(0.03, 0.012, 0.8, 0.005, MT.chrome, fX(s, 0.815), 0.815, 0)
          /* wide trapezoid lower grille in glossy black (wider at the bottom) with a honeycomb */
          c.roundBox(0.06, 0.3, 1.36, 0.05, GLOSS, fX(s, 0.5) - 0.02, 0.5, 0, { taper: { sz: 0.74 } })
          grille(c, s, 'mesh', 0.98, 0.2, 0.5, { x: fX(s, 0.5) + 0.0 })
          ;[1, -1].forEach(function (sd) {
            c.roundBox(0.04, 0.16, 0.12, 0.03, GLOSS, fX(s, 0.5) - 0.0, 0.48, sd * 0.76, { rot: [sd * 0.35, 0, 0] })
          })
          ;[1, -1].forEach(function (sd) {
            c.text(trl('texts.hybrid'), 0.42, 0.09, 1.2, 0.86, sd * (s.W / 2 + 0.012), sd > 0 ? '+z' : '-z', { fg: '#6fb3e6', size: 0.62 })
          })
          c.roundBox(0.1, 0.12, s.W * 0.94, 0.05, MT.trim, rX(s, 0.56) + 0.02, 0.56, 0, { def: true })
          /* chrome trim joining the taillights on the lid */
          c.roundBox(0.025, 0.03, 0.86, 0.01, MT.chrome, rX(s, 0.975) - 0.004, 0.975, 0)
          roofBars(c, 0.66, 0.04, 0.016)
          dorsalFin(c, R + 0.62)
        },
        post: function (c: any, m: any) {
          pillarB(c, -0.18)
          beltline(c, -0.3, 0.06, col)
          pillarC(c, -1.12, [-1.4, 1.22], c.paint(col))
          trackWidth(c, 1.559, 1.571)
          const b = m.bay
          if (!b) return
          b.motor = 'hibrido'
          const ix = b.x0 + 0.24,
            iy = b.top - 0.08,
            L = b.x1 - b.x0
          c.roundBox(0.24, 0.09, 0.32, 0.03, CM('#9aa1a6', { metalness: 0.7, roughness: 0.35 }), ix, iy, b.zw * 0.45)
          c.text(trl('texts.high_voltage'), 0.22, 0.05, ix, iy + 0.047, b.zw * 0.45, '+y', {
            fg: '#121212',
            bg: '#f0a01e',
            w: 512,
            h: 128,
            size: 0.55,
          })
          /* thick orange high-voltage cables over the engine, to the firewall and down to the battery */
          ;[-0.05, 0.05].forEach(function (dz) {
            c.tube(
              [
                [ix + 0.1, iy, b.zw * 0.45 + dz],
                [b.x0 + L * 0.42, b.top - 0.03, b.zw * 0.15 + dz],
                [b.x0 + L * 0.3, b.top - 0.04, -b.zw * 0.35 + dz],
                [b.x0 + 0.06, b.top - 0.1, -b.zw * 0.5 + dz],
                [b.x0 + 0.03, b.floor + 0.05, -b.zw * 0.5 + dz],
              ],
              0.02,
              MT.hv,
              { seg: 30, rs: 8 },
            )
          })
          c.roundBox(0.7, 0.18, 1.1, 0.03, CM('#4a4f55', { metalness: 0.5, roughness: 0.5 }), -1.05, m.clearance + 0.1, 0)
          c.part('battery', trl('labels.hybrid_battery'), null, new V3(-1.05, m.clearance + 0.2, 0), 0.9)
          c.zone(
            'battery',
            trl('labels.hybrid_battery_high_voltage'),
            [-1.42, -0.68, m.clearance - 0.08, m.clearance + 0.3, -0.58, 0.58],
            null,
            { fxKey: 'battery', sub: 'battery', pos: new V3(-1.05, m.clearance + 0.15, 0) },
          )
        },
      })
      c.meta.armor = suvArmor()
    },
  )

  /* Premium SUV (Jeep Compass type, 2nd generation, Brazil 2022+)
     Reference (from memory; tank and consumption confirmed on moparinsiders.com): length 4.404 m · width 1.819 m · height 1.629 m ·
     wheelbase 2.636 m · track about 1.57 m · tyre 225/55 R18 (0.705 m) · front overhang about 0.88 m and rear about 0.89 m ·
     ground clearance about 0.21 m · 1735 kg (diesel 4x4) · tank 60 L · 10.3 km/L in the city and 13.5 km/L on the road.
     Signature traits:
     front   · seven-slot vertical grille with a chrome frame on each slot, between thin LED headlights;
     · wide lower intake and fog lights in black niches;
     side    · TRAPEZOID wheel arches with a black frame (the Jeep trademark), black floating roof;
     · chrome trim on the waist line that climbs the D pillar to the roof;
     rear    · taillights that wrap the corner, with the "X" drawn inside; chrome trim; black bumper;
     top     · black roof and pillars, longitudinal bars.
     Review: the seven slots sat 3 cm inside the bodywork (invisible); now they are measured on the skin by ray (skinX). */
  fx.register(
    {
      key: 'midsize_suv',
      group: 'suvs',
      name: trl('vehicles.midsize_suv.name'),
      inspired: trl('vehicles.midsize_suv.inspired'),
      category: trl('vehicles.midsize_suv.category'),
      fuel: 'diesel',
      description: trl('vehicles.midsize_suv.description'),
      mass: 1735,
      noise: 70,
      seats: trl('vehicles.midsize_suv.seats'),
      capacity: trl('vehicles.midsize_suv.capacity'),
      efficiency: trl('vehicles.midsize_suv.efficiency'),
      range: trl('vehicles.midsize_suv.range'),
      maxSpeed: 190,
      skill: trl('vehicles.midsize_suv.skill'),
      hood: true,
    },
    function (c) {
      const A = axles(2.636, 0.88, 4.404, 0.07, 0.12),
        col = '#6b1f24',
        R = A.R,
        F = A.F
      const s = {
        W: 1.77,
        col: col,
        roofCol: '#101112',
        bottomY: 0.34,
        noseY: 0.93,
        tailY: 1.04,
        noAntenna: true,
        lower: [
          [R, 0.36, 0.08],
          [R - 0.03, 0.66, 0.14],
          [R + 0.07, 1.04, 0.1],
          [0.98, 1.05, 0],
          [1.6, 1.0, 0.3],
          [F - 0.04, 0.94, 0.1],
          [F, 0.62, 0.15],
          [F - 0.05, 0.35, 0.08],
        ],
        arches: [
          [A.xf, 0.3525, 0.405],
          [A.xr, 0.3525, 0.405],
        ],
        gh: {
          rb: R + 0.1,
          rt: R + 0.5,
          ft: 0.15,
          fb: 1.0,
          belt: 1.05,
          roof: 1.535,
          Wg: 1.69,
          k: 0.14,
          pillars: [-0.16, -1.12],
          r1: 0.16,
          r2: 0.2,
        },
        seams: [1.03, -0.17, -1.11],
        handles: [0.43, -0.64],
        plateRearY: 0.78,
        hl: { style: 'slim', w: 0.3, h: 0.09, y: 0.86, in: 0.07, yaw: 0.3, dx: 0.03, mat: MT.led },
        grille: false,
        tl: { style: 'wrap', w: 0.34, h: 0.1, y: 0.975, wrap: 0.2 },
        interior: { rows: 2, col: '#2c2a28', trim: '#19191a' },
        hood: { motor: 'diesel' },
        wheels: [
          [A.xf, 0.3525, 0.225, { rim: RIMSIL, spokes: 10 }],
          [A.xr, 0.3525, 0.225, { rim: RIMSIL, spokes: 10 }],
        ],
      }
      suvBuild(c, s, {
        roof: [0.04, -0.2, R + 0.5],
        flare: { w: 0.075, d: 0.04, trap: true },
        pre: function (c: any, _m: any) {
          kit.emblem(c, fX(s, 0.97) - 0.03, 0.975, 0, 0.032)
          /* wide lower intake and fog lights in niches */
          c.roundBox(0.05, 0.16, 1.2, 0.04, MT.trim, fX(s, 0.52) - 0.02, 0.52, 0)
          grille(c, s, 'mesh', 1.04, 0.12, 0.52, { x: fX(s, 0.52) - 0.0 })
          fog(c, s, 0.5, 0.72, 0.033)
          const tx = rX(s, 0.975)
          ;[1, -1].forEach(function (sd) {
            c.roundBox(0.02, 0.012, 0.16, 0.004, MT.tail, tx - 0.05, 0.975, sd * 0.7, { rot: [0.6, 0, 0] })
            c.roundBox(0.02, 0.012, 0.16, 0.004, MT.tail, tx - 0.05, 0.975, sd * 0.7, { rot: [-0.6, 0, 0] })
          })
          c.roundBox(0.025, 0.035, 0.9, 0.01, MT.chrome, tx + 0.0, 0.88, 0)
          c.roundBox(0.1, 0.13, s.W * 0.95, 0.05, MT.trim, rX(s, 0.56) + 0.02, 0.55, 0, { def: true })
          ;[1, -1].forEach(function (sd) {
            c.text('4x4', 0.18, 0.08, -1.9, 0.62, sd * (s.W / 2 + 0.012), sd > 0 ? '+z' : '-z', { fg: '#d0d0d0', size: 0.7 })
          })
          roofBars(c, 0.64, 0.04, 0.016)
          dorsalFin(c, R + 0.55)
        },
        post: function (c: any, m: any, F: any, low: any) {
          /* seven-slot grille between the headlights (the Jeep signature): each slot has a chrome frame and a dark back.
         Measured on the already sculpted skin: the nose is rounded at the top and the profile formula left the slots 3 cm inside the bodywork. */
          const gy = 0.83,
            gh = 0.18,
            gw = 0.84,
            xT = skinX(c, low, gy + gh / 2, 0),
            xB = skinX(c, low, gy - gh / 2, 0),
            tilt = Math.atan2(xB - xT, gh)
          c.roundBox(0.03, gh + 0.03, gw + 0.04, 0.012, GLOSS, skinX(c, low, gy, 0) - 0.008, gy, 0, { rot: [0, 0, tilt] })
          for (let i = 0; i < 7; i++) {
            const z = -gw * 0.43 + (i * gw * 0.86) / 6,
              px = skinX(c, low, gy, z)
            c.roundBox(0.04, gh * 0.92, gw * 0.094, 0.018, MT.chrome, px + 0.002, gy, z, { rot: [0, 0, tilt] })
            c.roundBox(0.03, gh * 0.78, gw * 0.058, 0.01, MT.housing, px + 0.012, gy, z, { rot: [0, 0, tilt] })
          }
          /* floating roof: pillars and glasshouse frame in black; small quarter window; chrome trim on the waist that climbs the D pillar to the roof */
          beltline(c, -0.35, 0.035, col)
          pillarC(c, -1.12, [-1.36, 1.25])
          const E = glasshouse(c),
            hz = function (y: any) {
              return kit.halfAt(m.glasshouse.Wg, m.tumble, y) + 0.03
            }
          ;[1, -1].forEach(function (sd) {
            c.tube(
              [
                [m.glasshouse.fb - 0.08, E.yb - 0.03, sd * hz(E.yb)],
                [-0.35, E.yb - 0.03, sd * hz(E.yb)],
                [-1.45, E.yb + 0.01, sd * hz(E.yb)],
                [E.back(E.yb + 0.15) + 0.05, E.yb + 0.15, sd * hz(E.yb + 0.15)],
                [E.back(E.top - 0.05) + 0.06, E.top - 0.05, sd * hz(E.top - 0.05)],
              ],
              0.009,
              MT.chrome,
              { seg: 40, rs: 5 },
            )
          })
          trackWidth(c, 1.57, 1.57)
        },
      })
      c.meta.armor = suvArmor()
    },
  )

  /* Large SUV (Toyota SW4 type, 2021+, Brazil)
     Reference (fichacompleta.com.br, SRX 2.8 2023): length 4.795 m · width 1.855 m · height 1.835 m · wheelbase 2.745 m ·
     track about 1.54 m / 1.55 m (from memory) · tyre 265/60 R18 (0.775 m) · front overhang about 0.88 m and rear about 1.17 m (from memory) ·
     ground clearance 0.279 m · 2175 kg · tank 80 L · 9.8 km/L in the city and 11.2 km/L on the road · 180 km/h · 7 seats.
     Signature traits:
     front   · large trapezoid grille with a chrome frame and horizontal bars, joined to the thin headlights by a chrome bar on the hood;
     · bumper with vertical fog light niches and a silver guard below;
     side    · tall pickup-chassis box, running boards, fender flares;
     · waist line rising to the rear and a quarter window that "kicks" upward behind the rear door; D pillar in the car colour;
     rear    · almost vertical lid, horizontal taillights joined by a wide chrome bar over the plate; spare under the floor;
     top     · straight long roof with tall bars.
     Review: own trapezoid grille that widens downward, with slats (the "big" style looked like a truck radiator); larger headlights. */
  fx.register(
    {
      key: 'large_suv',
      group: 'suvs',
      name: trl('vehicles.large_suv.name'),
      inspired: trl('vehicles.large_suv.inspired'),
      article: trl('vehicles.large_suv.article'),
      category: trl('vehicles.large_suv.category'),
      fuel: 'diesel',
      description: trl('vehicles.large_suv.description'),
      mass: 2175,
      noise: 75,
      seats: trl('vehicles.large_suv.seats'),
      capacity: trl('vehicles.large_suv.capacity'),
      efficiency: trl('vehicles.large_suv.efficiency'),
      range: trl('vehicles.large_suv.range'),
      maxSpeed: 180,
      skill: trl('vehicles.large_suv.skill'),
      hood: true,
    },
    function (c) {
      const A = axles(2.745, 0.88, 4.795, 0.1, 0.075),
        col = '#3b4639',
        R = A.R
      const s = {
        W: 1.79,
        col: col,
        bottomY: 0.44,
        noseY: 1.08,
        tailY: 1.2,
        noAntenna: true,
        lower: [
          [A.R, 0.47, 0.08],
          [A.R - 0.03, 0.8, 0.12],
          [A.R + 0.05, 1.22, 0.1],
          [1.0, 1.23, 0],
          [1.62, 1.16, 0.3],
          [A.F - 0.06, 1.08, 0.12],
          [A.F, 0.74, 0.16],
          [A.F - 0.06, 0.46, 0.08],
        ],
        arches: [
          [A.xf, 0.3875, 0.45],
          [A.xr, 0.3875, 0.45],
        ],
        gh: {
          rb: A.R + 0.07,
          rt: A.R + 0.28,
          ft: 0.28,
          fb: 1.03,
          belt: 1.22,
          roof: 1.715,
          Wg: 1.7,
          k: 0.11,
          pillars: [-0.2, -1.38],
          r1: 0.14,
          r2: 0.2,
        },
        seams: [1.06, -0.21, -1.37],
        handles: [0.44, -0.72],
        plateRearY: 0.95,
        tailLightY: 1.12,
        hl: { style: 'wedge', w: 0.48, h: 0.15, y: 1.0, in: 0.03, yaw: 0.3, dx: 0.03, mat: MT.led },
        grille: false,
        tl: { style: 'wrap', w: 0.28, h: 0.13, y: 1.12, wrap: 0.22 },
        interior: { rows: 3, col: '#3a3029', trim: '#1d1b19' },
        hood: { motor: 'diesel' },
        wheels: [
          [A.xf, 0.3875, 0.265, { rim: RIMSIL, spokes: 6 }],
          [A.xr, 0.3875, 0.265, { rim: RIMSIL, spokes: 6 }],
        ],
      }
      suvBuild(c, s, {
        flare: { w: 0.08, d: 0.035 },
        roof: [0.03, -0.3, A.R + 0.28],
        pre: function (c: any, _m: any) {
          /* large chrome trapezoid grille, from the hood to the bumper, wider at the bottom, with horizontal slats,
         joined to the headlights by a chrome bar (it is not the straight truck box of the "big" style) */
          const gx = fX(s, 0.82) - 0.012,
            gy = 0.82,
            gh = 0.46,
            gw = 1.08,
            tz = 0.8
          c.roundBox(0.05, gh, gw, 0.04, MT.chrome, gx, gy, 0, { taper: { sz: tz } })
          c.roundBox(0.056, gh - 0.1, gw - 0.16, 0.02, GLOSS, gx + 0.002, gy, 0, { taper: { sz: tz - 0.02 } })
          ;[0.13, 0.045, -0.04, -0.125].forEach(function (dy) {
            const k = (dy + gh / 2 - 0.05) / (gh - 0.1)
            c.roundBox(0.06, 0.022, (gw - 0.2) * (1 + (tz - 1) * k), 0.008, MT.chrome, gx + 0.004, gy + dy, 0)
          })
          c.roundBox(0.04, 0.04, 1.32, 0.015, MT.chrome, fX(s, 1.04) - 0.03, 1.04, 0)
          kit.emblem(c, fX(s, 0.9) + 0.03, 0.9, 0, 0.06)
          fog(c, s, 0.62, 0.74, 0.04)
          c.roundBox(0.06, 0.06, 0.9, 0.02, MT.alu, fX(s, 0.5) + 0.07, 0.5, 0)
          const tx = rX(s, 1.12)
          c.roundBox(0.03, 0.05, 0.86, 0.012, MT.chrome, tx + 0.005, 1.12, 0)
          c.roundBox(0.03, 0.04, 0.12, 0.012, MT.chrome, rX(s, 0.86), 0.86, 0)
          runningBoard(c, A.xr + 0.5, A.xf - 0.5, 0.42, s.W, -0.035)
          roofBars(c, 0.66, 0.06, 0.018)
          dorsalFin(c, R + 0.5)
        },
        post: function (c: any, _m: any) {
          /* waist line that rises 8 cm to the rear and a rear quarter window with an upward "kick"; D pillar in the car colour */
          pillarB(c, -0.2)
          beltline(c, -0.3, 0.08, col)
          pillarC(c, -1.38, [-2.0, 1.44], c.paint(col))
          trackWidth(c, 1.54, 1.55)
          const sp = c.wheel(A.R + 0.45, 0, 0.36, 0.25, { noPart: true, y: 0.3 })
          sp.rotation.x = PI / 2
          sp.position.set(A.R + 0.45, 0.3, 0)
          c.wheels.pop()
          c.part('spare_wheel', trl('labels.spare_wheel'), sp, new V3(A.R + 0.45, 0.3, 0), 0.5)
        },
        sculpt: { tuck: 0.04 },
      })
      c.meta.armor = suvArmor()
    },
  )

  /* ================= pickups ================= */
  function pickupBuild(c: any, s: any, o: any) {
    const n0 = c.deform.length
    kit.car(c, s)
    const low = c.deform[n0],
      m = c.meta
    let extra: any = []
    cargoBed(c, { low: low, x0: m.rear + 0.06, x1: o.bedFront, floor: o.floor, top: s.gh.belt, W: s.W, arches: s.arches })
    if (o.flares !== false) extra = extra.concat(fenderFlares(c, s.arches, s.W, s.bottomY, o.flare))
    if (o.pre) o.pre(c, m, extra)
    const F = sculpt(c, Object.assign({ low: low, extra: extra, pr: 0.03, bowR: 0.02 }, o.sculpt || {}))
    const tx = rX(s, o.floor + 0.25)
    c.roundBox(0.012, 0.014, s.W * 0.86, 0.004, MT.dark, tx + 0.002, o.floor + 0.02, 0)
    if (o.handle !== false) c.roundBox(0.03, 0.05, 0.22, 0.012, MT.trim, tx - 0.008, s.gh.belt - 0.1, 0)
    if (o.post) o.post(c, m, F)
    finishing(c)
    pickupZones(c)
    return low
  }
  function rollBar(c: any, x: any, yb: any, yt: any, z: any, mat: any) {
    const ms = []
    ;[z, -z].forEach(function (zz) {
      ms.push(
        c.rod(new V3(x, yb, zz), new V3(x, yt - 0.06, zz * 0.95), 0.032, mat),
        c.rod(new V3(x, yb + 0.12, zz), new V3(x - 0.42, yb, zz), 0.026, mat),
      )
    })
    ms.push(
      c.tube(
        [
          [x, yt - 0.08, -z * 0.95],
          [x, yt, -z * 0.7],
          [x, yt, z * 0.7],
          [x, yt - 0.08, z * 0.95],
        ],
        0.032,
        mat,
        { seg: 24 },
      ),
    )
    c.part('roll_bar', trl('labels.roll_bar'), null, new V3(x, yt - 0.1, 0), 0.6)
    /* own zone: bends, hangs and goes away as a loose part */
    c.zone('roll_bar', trl('labels.roll_bar'), [x - 0.5, x + 0.08, yb - 0.05, yt + 0.06, -z - 0.08, z + 0.08], ms, {
      type: 'part',
      fx: [
        trl('effects.none'),
        trl('effects.cosmetic_only'),
        trl('effects.bent_bar_does_not_hold_tied_down_cargo'),
        trl('effects.loose_bar_hanging_cuts_whoever_jumps_into_the_be'),
        trl('effects.no_roll_bar'),
      ],
      dir: 'up',
      weight: 0.3,
    })
    return ms
  }
  /* Pickup zones: the rear sides are the bed */
  function pickupZones(c: any) {
    c.zone('side_rear_left', trl('labels.left_bed_side'), null, null, { fxKey: 'cargo_bed' })
    c.zone('side_rear_right', trl('labels.right_bed_side'), null, null, { fxKey: 'cargo_bed' })
    c.zone('cargo_bed', trl('labels.bed_lid_and_floor'))
  }
  function pickupArmor(c: any) {
    kit.applyArmor(c)
    bedCage(c)
    const m = c.meta
    if (m.glasshouse) snorkel(c, m.glasshouse.fb + 0.25, m.clearance + 0.45, m.top - 0.05, m.width / 2 + 0.03, m.glasshouse.ft + 0.1)
  }

  /* Compact pickup crew cab (Fiat Strada type, 2020+, crew cab)
     Reference (garagem360.com.br, Ranch/Freedom 2024; crew cab length from memory): length 4.474 m · width 1.732 m ·
     height 1.601 m · wheelbase 2.737 m · track about 1.49 m (from memory) · tyre 205/60 R16 (0.652 m) · front overhang about 0.80 m and
     rear about 0.94 m · ground clearance about 0.185 m · 1135 to 1253 kg · tank 55 L · 12.5 km/L (G) and 8.9 km/L (E) in the city.
     Signature traits:
     front   · thin horizontal headlights with an LED thread, joined by a black bar with the name in the middle;
     · short sloping hood; wide lower honeycomb grille; round fog lights at the ends;
     side    · short crew cab with a narrow rear door, short low bed, black roll bar;
     · thin black mouldings on the wheel arches; straight waist line;
     rear    · narrow vertical taillights on the corners, lid with the embossed name and a black handle at the top;
     top     · short roof, well-sloped windshield. */
  fx.register(
    {
      key: 'compact_pickup',
      group: 'pickups',
      name: trl('vehicles.compact_pickup.name'),
      inspired: trl('vehicles.compact_pickup.inspired'),
      article: trl('vehicles.compact_pickup.article'),
      category: trl('vehicles.compact_pickup.category'),
      fuel: 'flex',
      description: trl('vehicles.compact_pickup.description'),
      mass: 1135,
      noise: 60,
      seats: trl('vehicles.compact_pickup.seats'),
      capacity: trl('vehicles.compact_pickup.capacity'),
      efficiency: trl('vehicles.compact_pickup.efficiency'),
      range: trl('vehicles.compact_pickup.range'),
      maxSpeed: 171,
      skill: trl('vehicles.compact_pickup.skill'),
      hood: true,
    },
    function (c) {
      const A = axles(2.737, 0.8, 4.474, 0.07, 0.07),
        col = '#a4321f'
      /* short sloping hood, low front with thin headlights joined by a black bar, thin honeycomb grille; short low bed */
      const s = {
        W: 1.715,
        col: col,
        bottomY: 0.33,
        noseY: 0.78,
        tailY: 0.98,
        lower: [
          [A.R, 0.35, 0.06],
          [A.R - 0.02, 0.98, 0.06],
          [1.08, 1.0, 0],
          [1.62, 0.9, 0.3],
          [A.F - 0.09, 0.78, 0.12],
          [A.F, 0.55, 0.15],
          [A.F - 0.05, 0.33, 0.08],
        ],
        arches: [
          [A.xf, 0.326, 0.38],
          [A.xr, 0.326, 0.38],
        ],
        gh: { rb: -0.96, rt: -0.9, ft: 0.32, fb: 1.1, belt: 1.0, roof: 1.545, Wg: 1.6, k: 0.14, pillars: [-0.03], r1: 0.1, r2: 0.2 },
        seams: [1.04, -0.04, -0.97],
        handles: [0.42, -0.5],
        plateRearY: 0.77,
        tailLightY: 0.82,
        hl: { style: 'slim', w: 0.36, h: 0.075, y: 0.725, in: 0.045, yaw: 0.28, dx: 0.03, mat: MT.led },
        grille: false,
        tl: { style: 'vertical', w: 0.09, h: 0.3, y: 0.82, in: 0.0 },
        interior: { rows: 2, col: '#2c2d30', trim: '#1a1b1d' },
        hood: { motor: 'gasoline' },
        wheels: [
          [A.xf, 0.326, 0.205, { rim: RIMGUN, spokes: 5 }],
          [A.xr, 0.326, 0.205, { rim: RIMGUN, spokes: 5 }],
        ],
      }
      pickupBuild(c, s, {
        bedFront: -1.02,
        floor: 0.62,
        flare: { w: 0.05, d: 0.03 },
        pre: function (c: any, _m: any) {
          c.roundBox(0.05, 0.07, 0.96, 0.02, GLOSS, fX(s, 0.725) - 0.015, 0.725, 0)
          kit.emblem(c, fX(s, 0.725) + 0.012, 0.725, 0, 0.032)
          c.roundBox(0.04, 0.15, 0.86, 0.03, MT.trim, fX(s, 0.6) - 0.02, 0.6, 0)
          grille(c, s, 'mesh', 0.8, 0.11, 0.6, { x: fX(s, 0.6) - 0.005 })
          fog(c, s, 0.46, 0.64, 0.03)
          rollBar(c, -1.08, 1.0, 1.32, 0.72, MT.trim)
        },
        post: function (c: any, _m: any) {
          const tx = rX(s, 0.9)
          c.text('ESTRADA', 0.34, 0.06, tx - 0.008, 0.9, 0.42, '-x', { fg: '#d7d9db', size: 0.7 })
          trackWidth(c, 1.49, 1.5)
        },
      })
      c.meta.armor = pickupArmor
    },
  )

  /* Mid-size pickup (Fiat Toro type, 2022+, diesel 4x4)
     Reference (fichacompleta.com.br, Freedom 2.0 diesel 2022): length 4.945 m · width 1.845 m · height 1.735 m · wheelbase 2.990 m ·
     track 1.547 m / 1.575 m · tyre 225/65 R17 (0.724 m) · front overhang about 0.94 m and rear about 1.02 m (from memory) ·
     ground clearance 0.234 m · 1906 kg · tank 60 L · 10.1 km/L in the city and 12.6 km/L on the road · 193 km/h · bed 937 L.
     Signature traits:
     front   · headlight split into two levels: thin LED DRL at hood line and dark main headlight, recessed, in the bumper;
     · thin grille between the DRLs with a chrome trim and a wide lower honeycomb grille;
     side    · sloped SUV front, tall cab, bed integrated into the body (no step), black wheel mouldings;
     rear    · SPLIT tailgate that opens like a door (vertical division in the middle, two handles), horizontal taillights that wrap the corner;
     top     · well-sloped windshield and short roof.
     Review: sloped cab rear (rt -0.9), black B pillar and a more visible DRL. */
  fx.register(
    {
      key: 'crossover_pickup',
      group: 'pickups',
      name: trl('vehicles.crossover_pickup.name'),
      inspired: trl('vehicles.crossover_pickup.inspired'),
      article: trl('vehicles.crossover_pickup.article'),
      category: trl('vehicles.crossover_pickup.category'),
      fuel: 'diesel',
      description: trl('vehicles.crossover_pickup.description'),
      mass: 1906,
      noise: 70,
      seats: trl('vehicles.crossover_pickup.seats'),
      capacity: trl('vehicles.crossover_pickup.capacity'),
      efficiency: trl('vehicles.crossover_pickup.efficiency'),
      range: trl('vehicles.crossover_pickup.range'),
      maxSpeed: 193,
      skill: trl('vehicles.crossover_pickup.skill'),
      hood: true,
    },
    function (c) {
      const A = axles(2.99, 0.94, 4.945, 0.07, 0.08),
        col = '#d6d4ce'
      /* sloped SUV front; two-level headlight: thin white DRL at hood line, dark main headlight recessed in the bumper; split tailgate */
      const s = {
        W: 1.82,
        col: col,
        bottomY: 0.4,
        noseY: 0.98,
        tailY: 1.12,
        lower: [
          [A.R, 0.43, 0.08],
          [A.R - 0.03, 1.12, 0.08],
          [1.1, 1.13, 0],
          [1.75, 1.05, 0.34],
          [A.F - 0.1, 0.98, 0.12],
          [A.F - 0.02, 0.78, 0.12],
          [A.F, 0.6, 0.14],
          [A.F - 0.05, 0.42, 0.08],
        ],
        arches: [
          [A.xf, 0.362, 0.42],
          [A.xr, 0.362, 0.42],
        ],
        gh: { rb: -1.08, rt: -0.9, ft: 0.34, fb: 1.14, belt: 1.13, roof: 1.68, Wg: 1.72, k: 0.13, pillars: [-0.06], r1: 0.1, r2: 0.24 },
        seams: [1.16, -0.07, -1.09],
        handles: [0.5, -0.56],
        plateRearY: 0.86,
        tailLightY: 1.0,
        hl: { style: 'slim', w: 0.5, h: 0.05, y: 0.95, in: 0.02, yaw: 0.3, dx: 0.03, mat: MT.led },
        grille: false,
        tl: { style: 'wrap', w: 0.36, h: 0.09, y: 1.0, wrap: 0.16 },
        interior: { rows: 2, col: '#4a3a2e', trim: '#1d1b19' },
        hood: { motor: 'diesel' },
        wheels: [
          [A.xf, 0.362, 0.225, { rim: RIMDARK, spokes: 6 }],
          [A.xr, 0.362, 0.225, { rim: RIMDARK, spokes: 6 }],
        ],
      }
      pickupBuild(c, s, {
        bedFront: -1.14,
        floor: 0.72,
        handle: false,
        flare: { w: 0.065, d: 0.035 },
        pre: function (c: any, _m: any) {
          /* dark niches in the bumper with the recessed main headlight */
          ;[1, -1].forEach(function (sd) {
            const hx = fX(s, 0.72),
              z = sd * (s.W / 2 - 0.27)
            c.roundBox(0.05, 0.19, 0.4, 0.05, GLOSS, hx - 0.02, 0.72, z, { rot: [0, sd * 0.2, 0] })
            kit.headlight(c, {
              style: 'rect',
              x: hx - 0.005,
              y: 0.72,
              z: z,
              w: 0.3,
              h: 0.11,
              side: sd,
              yaw: 0.2,
              lens: CM('#9fb0b8', { roughness: 0.03, transparent: true, opacity: 0.25, depthWrite: false }),
              label: sd > 0 ? trl('labels.right_main_headlight') : trl('labels.left_main_headlight'),
            })
          })
          /* grille between the DRLs (thin, car colour with a trim) and wide lower honeycomb grille */
          c.roundBox(0.05, 0.09, 0.82, 0.03, GLOSS, fX(s, 0.9) - 0.02, 0.9, 0)
          c.roundBox(0.03, 0.016, 0.9, 0.006, MT.chrome, fX(s, 0.945) - 0.012, 0.945, 0)
          kit.emblem(c, fX(s, 0.9) + 0.01, 0.9, 0, 0.04)
          c.roundBox(0.05, 0.2, 0.86, 0.04, MT.trim, fX(s, 0.56) - 0.02, 0.56, 0)
          grille(c, s, 'mesh', 0.78, 0.16, 0.56, { x: fX(s, 0.56) - 0.005 })
          ;[1, -1].forEach(function (sd) {
            c.text('4x4', 0.18, 0.08, -0.5, 0.6, sd * (s.W / 2 + 0.012), sd > 0 ? '+z' : '-z', { fg: '#2a2a2a', size: 0.7 })
          })
        },
        post: function (c: any, _m: any) {
          /* rear lid that opens like a door: marked vertical division and two handles */
          pillarB(c, -0.06)
          const tx = rX(s, 0.9)
          c.roundBox(0.02, 0.46, 0.018, 0.005, MT.dark, tx + 0.006, 0.93, 0)
          ;[1, -1].forEach(function (sd) {
            c.roundBox(0.03, 0.04, 0.12, 0.012, MT.chrome, tx - 0.008, 1.02, sd * 0.1)
          })
          c.roundBox(0.03, 0.035, 0.5, 0.012, CM('#3a3c3e', { metalness: 0.6, roughness: 0.3 }), tx - 0.006, 0.76, 0)
          trackWidth(c, 1.547, 1.575)
        },
      })
      c.meta.armor = pickupArmor
    },
  )

  /* Full-size pickup crew cab (Toyota Hilux type, 8th generation, 2021+)
     Reference (fichacompleta.com.br, SRX 2.8 CD 2023; measurements, clearance, tyre, mass, tank and consumption rechecked in the review): length 5.325 m · width 1.855 m · height 1.815 m · wheelbase 3.085 m ·
     track about 1.535 m / 1.55 m (from memory) · tyre 265/60 R18 (0.775 m) · front overhang about 0.93 m and rear about 1.31 m (from memory) ·
     ground clearance 0.286 m · 2090 kg · tank 80 L · 10.1 km/L in the city and 11.3 km/L on the road · 180 km/h · bed 1000 L.
     Signature traits:
     front   · tall dark trapezoid grille with a thick chrome frame that goes down to the bumper, chrome bar joining the thin headlights;
     · black vertical fog light niches at the bumper ends;
     side    · long straight hood, crew cab with a wide rear door, separate bed (gap between cab and bed), running boards;
     · fender flares on the wheel arches, tyres that fill the arches;
     rear    · tall vertical taillights on the corners, lid with the embossed name, chrome bumper with a step;
     top     · short straight roof; chrome roll bar over the bed.
     Review: the grille now widens downward (before it was wider at the top) and the front plate moved to the front of the frame. */
  fx.register(
    {
      key: 'midsize_pickup',
      group: 'pickups',
      name: trl('vehicles.midsize_pickup.name'),
      inspired: trl('vehicles.midsize_pickup.inspired'),
      article: trl('vehicles.midsize_pickup.article'),
      category: trl('vehicles.midsize_pickup.category'),
      fuel: 'diesel',
      description: trl('vehicles.midsize_pickup.description'),
      mass: 2090,
      noise: 75,
      seats: trl('vehicles.midsize_pickup.seats'),
      capacity: trl('vehicles.midsize_pickup.capacity'),
      efficiency: trl('vehicles.midsize_pickup.efficiency'),
      range: trl('vehicles.midsize_pickup.range'),
      maxSpeed: 180,
      skill: trl('vehicles.midsize_pickup.skill'),
      hood: true,
    },
    function (c) {
      const A = axles(3.085, 0.93, 5.325, 0.07, 0.17),
        col = '#9a9283'
      /* long straight hood, tall vertical front, dark trapezoid grille with a thick chrome frame down to the bumper; all-terrain tyres filling the arches */
      const s = {
        W: 1.795,
        col: col,
        bottomY: 0.46,
        noseY: 1.07,
        tailY: 1.18,
        lower: [
          [A.R, 0.5, 0.06],
          [A.R - 0.02, 1.2, 0.06],
          [1.05, 1.21, 0],
          [1.7, 1.14, 0.3],
          [A.F - 0.05, 1.07, 0.12],
          [A.F, 0.72, 0.16],
          [A.F - 0.06, 0.48, 0.08],
        ],
        arches: [
          [A.xf, 0.3875, 0.45],
          [A.xr, 0.3875, 0.45],
        ],
        gh: { rb: -1.12, rt: -1.06, ft: 0.36, fb: 1.1, belt: 1.2, roof: 1.755, Wg: 1.72, k: 0.1, pillars: [-0.06], r1: 0.08, r2: 0.18 },
        seams: [1.12, -0.07, -1.13],
        handles: [0.5, -0.58],
        plateRearY: 0.98,
        tailLightY: 0.99,
        hl: { style: 'wedge', w: 0.4, h: 0.15, y: 1.0, in: 0.075, yaw: 0.3, dx: 0.045, mat: MT.led },
        grille: false,
        tl: { style: 'vertical', w: 0.1, h: 0.38, y: 0.99, in: 0.0 },
        interior: { rows: 2, col: '#2e2a26', trim: '#1b1a19' },
        hood: { motor: 'diesel' },
        wheels: [
          [A.xf, 0.3875, 0.265, { rim: RIMSIL, spokes: 6 }],
          [A.xr, 0.3875, 0.265, { rim: RIMSIL, spokes: 6 }],
        ],
      }
      pickupBuild(c, s, {
        bedFront: -1.2,
        floor: 0.8,
        flare: { w: 0.09, d: 0.035 },
        pre: function (c: any, _m: any) {
          /* trapezoid mouth that widens downward to the bumper corners (Hilux 2021) */
          const gx = fX(s, 0.8) - 0.012,
            gy = 0.8,
            gw = 1.14,
            gh = 0.52
          c.roundBox(0.05, gh, gw, 0.04, MT.chrome, gx, gy, 0, { taper: { sz: 0.84 } })
          c.roundBox(0.056, gh - 0.12, gw - 0.16, 0.02, GLOSS, gx + 0.002, gy - 0.01, 0, { taper: { sz: 0.82 } })
          ;[0.12, -0.02, -0.14].forEach(function (dy) {
            c.roundBox(0.06, 0.03, (gw - 0.22) * (1 - (dy + 0.2) * 0.4), 0.01, MT.housing, gx + 0.004, gy + dy, 0)
          })
          c.roundBox(0.04, 0.05, 1.3, 0.02, MT.chrome, fX(s, 1.04) - 0.03, 1.04, 0)
          kit.emblem(c, gx + 0.035, gy + 0.06, 0, 0.06)
          ;[1, -1].forEach(function (sd) {
            c.roundBox(0.05, 0.22, 0.12, 0.02, GLOSS, fX(s, 0.6) + 0.0, 0.62, sd * 0.78)
          })
          fog(c, s, 0.6, 0.78, 0.038)
          rollBar(c, -1.27, 1.2, 1.56, 0.78, MT.chrome)
          /* gap between the cab and the bed (rail chassis) */
          ;[1, -1].forEach(function (sd) {
            c.roundBox(0.022, s.gh.belt - 0.5, 0.01, 0.004, MT.dark, -1.205, (s.gh.belt + 0.5) / 2 + 0.02, sd * (s.W / 2 + 0.003))
          })
          runningBoard(c, A.xr + 0.52, A.xf - 0.52, 0.44, s.W, -0.035)
          ;[1, -1].forEach(function (sd) {
            c.text('4x4', 0.2, 0.09, -2.4, 0.95, sd * (s.W / 2 + 0.012), sd > 0 ? '+z' : '-z', { fg: '#222', size: 0.7 })
          })
        },
        post: function (c: any, _m: any) {
          /* chrome rear bumper with a step (light chrome: the scene has no environment map) */
          /* front plate in front of the grille frame (otherwise the chrome edge cuts the plate in half) */
          const gfx = fX(s, 0.8) + 0.04
          c.vehicle.children.forEach(function (o: any) {
            if (
              o.isMesh &&
              o.geometry.type === 'PlaneGeometry' &&
              Math.abs(o.rotation.y - PI / 2) < 0.01 &&
              o.position.x > 1.5 &&
              o.material.map &&
              o.material.map.image &&
              o.material.map.image.width === 400
            )
              o.position.x = Math.max(o.position.x, gfx)
          })
          const bx = rX(s, 0.6)
          c.roundBox(0.16, 0.2, s.W + 0.02, 0.06, CM('#c3c7ca', { metalness: 0.55, roughness: 0.28 }), bx - 0.04, 0.58, 0, { def: true })

          c.roundBox(0.12, 0.03, 0.5, 0.01, CM('#1b1c1d', { roughness: 0.9 }), bx - 0.06, 0.695, 0)
          c.text('HYLUX', 0.34, 0.07, rX(s, 1.08) - 0.008, 1.08, 0, '-x', { fg: '#2a2a2a', size: 0.75 })
          trackWidth(c, 1.535, 1.55)
        },
      })
      c.meta.armor = pickupArmor
    },
  )

  /* Monster truck (Bigfoot type: modern competition Bigfoot, Ford F-250 1979 body)
     Reference (en.wikipedia.org/wiki/Bigfoot_(truck)) for the 66" tyres; the rest from memory, monster truck regulations):
     66" tyre = 1.68 m (width about 0.9 m) · overall width about 3.7 m (12.5 ft, at the tyres) · height about 3.4 m · length about 5.5 m ·
     wheelbase about 3.1 m · track about 2.8 m · fibre body about 5.3 m x 2.0 m · about 5400 kg · big-block V8 with a blower, methanol.
     Signature traits:
     front   · 1979 Ford pickup face: bar grille with round headlights, straight chrome bumper, four roof lights;
     side    · blue body with a white stripe and the large name on the side, high above tractor tyres;
     · red four-link suspension with exposed shock absorbers and yellow springs, chrome exhausts coming out of the fender;
     rear    · open bed, vertical taillights, tubular chassis and exposed differentials;
     top     · chrome blower coming out of the hood, red tubular cage inside the cab. */
  fx.register(
    {
      key: 'monster_truck',
      group: 'pickups',
      name: trl('vehicles.monster_truck.name'),
      inspired: trl('vehicles.monster_truck.inspired'),
      article: trl('vehicles.monster_truck.article'),
      category: trl('vehicles.monster_truck.category'),
      fuel: 'ethanol',
      description: trl('vehicles.monster_truck.description'),
      mass: 5400,
      noise: 220,
      seats: trl('vehicles.monster_truck.seats'),
      capacity: trl('vehicles.monster_truck.capacity'),
      efficiency: trl('vehicles.monster_truck.efficiency'),
      range: trl('vehicles.monster_truck.range'),
      maxSpeed: 110,
      skill: trl('vehicles.monster_truck.skill'),
      hood: true,
    },
    function (c) {
      const col = '#1f4fa3',
        W = 2.0,
        xa = 1.55,
        wr = 0.836,
        tr = 0.79,
        wz = 1.38,
        ww = 0.9 /* wr = hub height; tr = tyre radius (the lugs add 4.6 cm) */
      const s = {
        W: W,
        col: col,
        bottomY: 1.55,
        noseY: 2.22,
        tailY: 2.25,
        lower: [
          [-2.7, 1.58, 0.05],
          [-2.72, 2.25, 0.05],
          [0.95, 2.26, 0],
          [1.2, 2.24, 0.12],
          [2.45, 2.22, 0.08],
          [2.5, 1.9, 0.08],
          [2.47, 1.57, 0.05],
        ],
        arches: [
          [xa, wr, 0.95],
          [-xa, wr, 0.95],
        ],
        gh: { rb: -0.36, rt: -0.32, ft: 0.62, fb: 0.98, belt: 2.25, roof: 2.86, Wg: 1.86, k: 0.06, pillars: [], r1: 0.06, r2: 0.1 },
        seams: [0.92, -0.33],
        handles: [-0.1],
        plateRearY: 1.85,
        tailLightY: 2.06,
        noAntenna: true,
        hl: { style: 'round', w: 0.2, h: 0.2, y: 2.03, in: 0.12, yaw: 0 },
        grille: { style: 'bars', w: 1.0, h: 0.3, y: 2.0 },
        tl: { style: 'vertical', w: 0.12, h: 0.28, y: 2.06, in: 0.0 },
        interior: { rows: 1, col: '#202224', trim: '#141516', front: 'bench' },
        hood: { motor: 'v8' },
        wheels: [],
      }
      const n0 = c.deform.length
      kit.car(c, s)
      const low = c.deform[n0],
        m = c.meta
      cargoBed(c, { low: low, x0: m.rear + 0.06, x1: -0.42, floor: 1.78, top: 2.25, W: W, arches: [] })
      c.roundBox(0.08, 0.08, W + 0.1, 0.03, MT.chrome, m.front + 0.06, 1.72, 0)
      const stripe = c.paint('#e9e7e1')
      const ex: any = []
      ;[1, -1].forEach(function (sd) {
        ex.push(c.roundBox(4.6, 0.08, 0.01, 0.004, stripe, -0.15, 2.17, sd * (W / 2 + 0.006), { sub: 0.15 }))
      })
      sculpt(c, { low: low, extra: ex, tuck: 0.02, sh: 0.03, pf: 0.03, bowF: 0.03, pr: 0.02, bowR: 0.01 })
      ;[1, -1].forEach(function (sd) {
        c.text('BIGFUT', 1.1, 0.26, -1.55, 1.93, sd * (W / 2 + 0.014), sd > 0 ? '+z' : '-z', { fg: '#f2f0ea', size: 0.8 })
      })
      /* tubular chassis, solid axles, four-link and shock absorbers */
      const frame = CM('#d8d4c8', { metalness: 0.4, roughness: 0.45 }),
        red = CM('#b3261e', { metalness: 0.3, roughness: 0.45 }),
        rim = CM('#d9dbdc', { metalness: 0.85, roughness: 0.25 })
      ;[0.48, -0.48].forEach(function (z) {
        c.rod(new V3(-2.55, 1.32, z), new V3(2.35, 1.32, z), 0.06, frame)
        c.rod(new V3(-2.2, 1.32, z), new V3(-2.2, 1.55, z), 0.04, frame)
        c.rod(new V3(2.0, 1.32, z), new V3(2.0, 1.55, z), 0.04, frame)
      })
      ;[-2.2, -0.9, 0.4, 2.0].forEach(function (x) {
        c.rod(new V3(x, 1.32, -0.48), new V3(x, 1.32, 0.48), 0.045, frame)
      })
      ;[xa, -xa].forEach(function (x) {
        const sg = x > 0 ? 1 : -1
        c.rod(new V3(x, wr, -wz + 0.3), new V3(x, wr, wz - 0.3), 0.085, MT.steel)
        c.sphere(0.26, MT.steel, x, wr, 0.12, 1, 1, 0.85)
        c.cylinder(0.11, 0.11, 0.3, MT.steel, x - sg * 0.3, wr, 0.12, 'x')
        ;[0.45, -0.45].forEach(function (z) {
          c.rod(new V3(x, wr - 0.12, z), new V3(x - sg * 1.05, 1.28, z * 1.05), 0.04, red)
          c.rod(new V3(x, wr + 0.14, z * 0.6), new V3(x - sg * 0.95, 1.36, z * 0.4), 0.035, red)
        })
        ;[1, -1].forEach(function (zs) {
          ;[-0.22, 0.22].forEach(function (dx) {
            const b = new V3(x + dx, wr + 0.08, zs * 0.78),
              t = new V3(x + dx * 2.6, 1.52, zs * 0.66)
            c.rod(b, b.clone().lerp(t, 0.55), 0.055, MT.chrome)
            c.rod(b.clone().lerp(t, 0.45), t, 0.04, red)
            for (let k = 0; k < 7; k++) {
              const q = b.clone().lerp(t, 0.12 + k * 0.1),
                tr = c.add(new THREE.TorusGeometry(0.075, 0.012, 6, 16), CM('#e0b81c', { roughness: 0.4 }), q.x, q.y, q.z)
              tr.quaternion.setFromUnitVectors(new V3(0, 0, 1), t.clone().sub(b).normalize())
            }
          })
          c.roundBox(0.6, 0.08, 0.3, 0.02, frame, x, 1.5, zs * 0.66)
          c.part(
            'suspension',
            x > 0
              ? zs > 0
                ? trl('labels.front_right_suspension')
                : trl('labels.front_left_suspension')
              : zs > 0
                ? trl('labels.rear_right_suspension')
                : trl('labels.rear_left_suspension'),
            null,
            new V3(x, 1.1, zs * 0.78),
            0.6,
          )
          const wg = c.wheel(x, zs * wz, tr, ww, {
            y: wr,
            lugs: true,
            chevron: true,
            rim: rim,
            rimR: 0.5,
            spokes: 8,
            label:
              x > 0
                ? zs > 0
                  ? trl('labels.front_right_tire')
                  : trl('labels.front_left_tire')
                : zs > 0
                  ? trl('labels.rear_right_tire')
                  : trl('labels.rear_left_tire'),
          })
          /* full disc rim with a bolted chrome beadlock, flush with the tyre sidewall */
          const rr = tr * 0.5,
            fz = zs * (ww / 2 - 0.05)
          const disc = new THREE.Mesh(
            new THREE.CylinderGeometry(rr * 0.97, rr * 0.97, 0.03, 32),
            CM('#2b2e31', { metalness: 0.6, roughness: 0.35 }),
          )
          disc.rotation.x = PI / 2
          disc.position.z = fz
          wg.add(disc)
          const bead = new THREE.Mesh(new THREE.TorusGeometry(rr * 0.98, 0.04, 10, 40), rim)
          bead.position.z = fz + zs * 0.02
          wg.add(bead)
          for (let bn = 0; bn < 16; bn++) {
            const ba = (bn / 16) * PI * 2,
              bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 6), MT.chrome)
            bolt.rotation.x = PI / 2
            bolt.position.set(Math.cos(ba) * rr * 0.98, Math.sin(ba) * rr * 0.98, fz + zs * 0.055)
            wg.add(bolt)
          }
          for (let sk = 0; sk < 6; sk++) {
            const sa = (sk / 6) * PI * 2,
              hole = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.13, rr * 0.13, 0.034, 14), MT.hole)
            hole.rotation.x = PI / 2
            hole.position.set(Math.cos(sa) * rr * 0.58, Math.sin(sa) * rr * 0.58, fz + zs * 0.002)
            wg.add(hole)
          }
          const hub = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.3, rr * 0.34, 0.08, 20), rim)
          hub.rotation.x = PI / 2
          hub.position.z = fz + zs * 0.03
          wg.add(hub)
        })
      })
      /* side exhausts coming out of the fenders, cage inside the cab and roof lights */
      ;[1, -1].forEach(function (sd) {
        for (let k = 0; k < 4; k++)
          c.tube(
            [
              [1.75 - k * 0.12, 1.9, sd * 0.55],
              [1.7 - k * 0.12, 1.8, sd * 0.95],
              [1.55 - k * 0.12, 2.0, sd * 1.06],
              [1.45 - k * 0.12, 2.4, sd * 1.08],
            ],
            0.035,
            MT.chrome,
            { seg: 20, rs: 8 },
          )
        c.rod(new V3(0.85, 2.3, sd * 0.82), new V3(0.6, 2.8, sd * 0.78), 0.035, red)
        c.rod(new V3(-0.25, 2.3, sd * 0.82), new V3(-0.25, 2.8, sd * 0.78), 0.035, red)
        c.rod(new V3(0.6, 2.8, sd * 0.78), new V3(-0.25, 2.8, sd * 0.78), 0.035, red)
      })
      c.rod(new V3(0.6, 2.8, -0.78), new V3(0.6, 2.8, 0.78), 0.035, red)
      c.rod(new V3(-0.25, 2.8, -0.78), new V3(-0.25, 2.8, 0.78), 0.035, red)
      c.rod(new V3(-0.25, 2.3, -0.8), new V3(-0.25, 2.8, 0.78), 0.03, red)
      const roofItems = [c.roundBox(0.16, 0.05, 1.3, 0.02, MT.trim, 0.42, m.top + 0.08, 0)]
      ;[-0.48, -0.16, 0.16, 0.48].forEach(function (z) {
        roofItems.push(
          kit.headlight(c, {
            style: 'round',
            x: 0.5,
            y: m.top + 0.2,
            z: z,
            w: 0.17,
            h: 0.17,
            d: 0.1,
            side: z > 0 ? 1 : -1,
            label: trl('labels.roof_light'),
            reach: 0.4,
          }).g,
        )
      })
      /* roof light bracket: it is the highest point, enters the rollover box (the cab does not sink into the ground) */
      const hoop = c.tube(
        [
          [0.62, m.top - 0.02, -0.66],
          [0.62, m.top + 0.33, -0.62],
          [0.62, m.top + 0.33, 0.62],
          [0.62, m.top - 0.02, 0.66],
        ],
        0.028,
        MT.steel,
        { seg: 24, rs: 8 },
      )
      c.deform.push(hoop)
      roofItems.push(hoop)
      /* crash zones at the real height and width of the body (the wheels stick well out) */
      const top0 = m.top
      m.width = W
      m.bodyHeight = 0.95
      m.roof.w = 1.5
      m.top = top0 + 0.33
      finishing(c, roofItems)
      pickupZones(c)
      /* headlights: the two in the grille in one zone per side and the four on the roof in their own zone */
      const fGrade = c.lights.filter(function (L: any) {
          return L.kind === 'headlight' && L.group && L.group.position.x > 2
        }),
        fTeto = c.lights.filter(function (L: any) {
          return L.kind === 'headlight' && L.group && L.group.position.y > top0
        })
      c.zone('headlight_right', false)
      c.zone('headlight_left', false)
      c.zone('headlight_center', false)
      ;[1, -1].forEach(function (sd) {
        const L = fGrade.filter(function (q: any) {
          return Math.sign(q.group.position.z) === sd
        })
        c.zone(
          'grille_headlight_' + (sd > 0 ? 'right' : 'left'),
          sd > 0 ? trl('labels.right_headlight') : trl('labels.left_headlight'),
          [2.3, 2.62, 1.85, 2.2, sd > 0 ? 0.4 : -0.95, sd > 0 ? 0.95 : -0.4],
          L,
          { type: 'light', fxKey: 'headlight', side: sd },
        )
      })
      c.zone('roof_lights', trl('labels.roof_lights'), [0.32, 0.68, top0 + 0.05, top0 + 0.45, -0.7, 0.7], fTeto, {
        type: 'light',
        fxKey: 'headlight',
        dir: 'up',
      })
      const bpt = c.parts.find(function (p: any) {
          return p.obj === m.frontBumper
        }),
        bptR = c.parts.find(function (p: any) {
          return p.obj === m.rearBumper
        })
      ;[bpt, bptR].forEach(function (pt) {
        setOnHit(pt, function (c: any, p0: any) {
          const o = p0.obj
          if (o && o.userData.hung && o.parent && o.parent !== c.vehicle) {
            o.parent.rotation.x = clamp(o.parent.rotation.x, -0.22, 0.22)
            o.parent.rotation.y = clamp(o.parent.rotation.y, -0.08, 0.08)
          }
        })
      })
      c.parts
        .filter(function (p: any) {
          return p.kind === 'engine' || p.kind === 'hood'
        })
        .forEach(function (pt: any) {
          setOnHit(pt, function (c: any) {
            if (c.hood) c.hood.latch = Math.min(c.hood.latch, 0.05)
          })
        })
      m.armor = function (c: any) {
        const mm = c.meta,
          tKeep = mm.top
        mm.top = top0
        kit.applyArmor(c)
        mm.top = tKeep
        const spk = CM('#8a8e8a', { metalness: 0.7, roughness: 0.35 })
        ;[xa, -xa].forEach(function (x) {
          ;[1, -1].forEach(function (zs) {
            const sp = c.add(new THREE.ConeGeometry(0.07, 0.35, 12), spk, x, wr, zs * (wz + ww / 2 + 0.17))
            sp.rotation.x = (zs * PI) / 2
          })
        })
        c.roundBox(0.14, 0.7, 2.6, 0.05, kit.steelMaterial, mm.front + 0.55, 1.2, 0, { rot: [0, 0, 0.35] })
        for (let i = 0; i < 6; i++) {
          const cn = c.add(new THREE.ConeGeometry(0.05, 0.4, 10), spk, mm.front + 0.78, 1.05 + (i % 2) * 0.3, -1.1 + i * 0.44)
          cn.rotation.z = -PI / 2
        }
      }
    },
  )

  /* ================= vans ================= */
  /* Cargo van (Mercedes-Benz Sprinter long high-roof type, 3rd generation, 2019+)
     Reference (fichacompleta.com.br, Sprinter Cargo Van 315 Long High Roof 2024): length 5.932 m · width 2.020 m · height 2.620 m ·
     wheelbase 3.665 m · track about 1.72 m (from memory) · tyre 225/75 R16 (0.744 m) · front overhang about 0.98 m and rear about 1.29 m ·
     ground clearance about 0.18 m (from memory) · 2283 kg · tank 71 L · 10.3 km/L in the city and 11.8 km/L on the road · 155 km/h.
     Signature traits:
     front   · large headlights that climb the fender up to near the windshield; three-bar chrome grille with a large badge;
     · tall black bumper from end to end with a central intake and fog lights;
     side    · tall straight roof, short sloped hood, sliding door on the right with a visible rail, black protective strip;
     rear    · two doors with a central split, tall vertical taillights on the corners, third brake light at the top;
     top     · smooth long roof.
     Ambulance van (Fiat Ducato ambulance type, Maxicargo L2H2)
     Reference (from memory): length 5.413 m · width 2.050 m · height 2.524 m (without the beacon) · wheelbase 3.450 m ·
     track about 1.81 m / 1.79 m · tyre 215/70 R15 (0.682 m) · front overhang about 0.95 m and rear about 1.01 m · ground clearance about 0.17 m ·
     tank 90 L · 2950 kg equipped.
     Signature traits:
     front   · huge black bumper that rises to the headlights, with a wide intake and round fog lights;
     · tall headlights on the corner of the short hood, small grille between them; mirrored "AMBULANCE" on the hood;
     side    · red and yellow stripe from end to end, blue star of life, saloon windows, beacon at the front of the roof;
     rear    · doors with windows, vertical taillights, red and amber lights high on the corners. */
  function van(c: any, P: any) {
    const W = P.W,
      T = { belt: P.belt, top: P.roof + 0.02, k: 0.055 },
      col = P.col,
      amb = !!P.amb
    const A = axles(P.WB, P.oF, P.L, P.dF, P.dR),
      F = A.F,
      R = A.R
    const items = [
      [R, 0.44, 0.06],
      [R - 0.02, P.roof - 0.04, 0.16],
      [P.capX, P.roof, 0.3],
      [P.wt[0], P.wt[1], 0.14],
      [P.wb[0], P.wb[1], 0.18],
      [F - 0.14, P.nose, 0.24],
      [F, P.nose - 0.32, 0.16],
      [F - 0.03, 0.42, 0.06],
    ]
    c.meta.color = col
    const q = kit.quadDef(P.wb, P.wt, W, T, 'front', 0.05, { inset: 0.12 })
    const lin = function (y: any) {
      return P.wb[0] + ((P.wt[0] - P.wb[0]) * (y - P.wb[1])) / (P.wt[1] - P.wb[1])
    }
    const yb = P.belt + 0.06,
      yt = P.wt[1] - 0.12
    const cab = [
      [P.cabBack, yb],
      [lin(yb) - 0.14, yb],
      [lin(yt) - 0.14, yt],
      [P.cabBack, yt],
    ]
    const holes = [kit.holeSide(cab), kit.holeQuad(q), kit.holeTop(P.wb[0] + 0.1, F - 0.2, W / 2 - 0.15, 0.8, 'hood')]
    const winS = (P.rearSide || []).slice(),
      winR = P.rearWin
    winS.forEach(function (w: any) {
      holes.push(kit.holeSide(w.p, { side: w.side }))
    })
    if (winR)
      holes.push(
        kit.holeBox([R - 0.2, winR.y0, -winR.z1], [R + 0.2, winR.y1, winR.z1], function (n: any, ce: any) {
          return n.x < -0.6 && Math.abs(ce.z) > winR.z0
        }),
      )
    const n0 = c.deform.length
    const shellM = kit.shell(c, {
      items: items,
      bottomY: 0.42,
      arches: [
        [A.xf, P.wr, P.wr + 0.08],
        [A.xr, P.wr, P.wr + 0.08],
      ],
      W: W,
      col: col,
      T: T,
      archInner: W / 2 - 0.42,
      holes: holes,
    })
    kit.glassQuad(c, q, lbl('windshield'))
    kit.sideWindows(c, [cab], W, T, function () {
      return lbl('cab_window')
    })
    winS.forEach(function (w: any, _i: any) {
      kit.sideWindows(
        c,
        [w.p],
        W,
        T,
        function () {
          return w.label
        },
        { sides: [w.side] },
      )
    })
    if (winR)
      [1, -1].forEach(function (sd) {
        const g = c.roundBox(
          0.012,
          winR.y1 - winR.y0,
          winR.z1 - winR.z0,
          0.02,
          MT.glass,
          R - 0.012,
          (winR.y0 + winR.y1) / 2,
          (sd * (winR.z0 + winR.z1)) / 2,
        )
        kit.asGlass(c, g, sd > 0 ? lbl('right_rear_door_glass') : lbl('left_rear_door_glass'), 'tempered')
      })
    const m = c.meta
    Object.assign(m, {
      length: P.L,
      width: W,
      front: F,
      rear: R,
      clearance: 0.42,
      belt: P.belt,
      top: P.roof + 0.02,
      bodyHeight: P.belt - 0.42,
      tumble: T,
      frontQuad: q,
      glasshouse: { fb: P.wb[0], ft: P.wt[0], rb: R + 0.02, rt: R + 0.02, belt: P.belt + 0.02, roof: P.roof, Wg: W, pillars: [P.cabBack] },
      roof: { x0: R + 0.3, x1: P.capX - 0.1, w: 1.6, y: P.roof + 0.02 },
    })
    const fl = 0.62
    kit.interior(c, {
      x0: P.wb[0],
      ft: P.wt[0],
      roof: P.wt[1] + 0.15,
      belt: P.belt + 0.08,
      floor: fl,
      zIn: W / 2 - 0.13,
      rows: 1,
      col: amb ? '#3a4a5c' : '#2f3033',
      xRear: P.cabBack - 0.12,
      xFront: P.cabBack + 0.42,
      seatH: 0.42,
      front: 'bench',
    })
    c.roundBox(
      0.04,
      P.roof - fl - 0.06,
      W - 0.16,
      0.01,
      CM(amb ? '#c9ccd0' : '#3a3b3d', { roughness: 0.8 }),
      P.cabBack - 0.16,
      (P.roof + fl) / 2,
      0,
    )
    const hood = kit.makeHood(c, shellM.userData.cut.hood, { x0: P.wb[0] + 0.1, col: col })
    if (hood) hood.open = 1.25
    if (hood)
      kit.engineBay(c, {
        x0: P.wb[0] + 0.12,
        x1: F - 0.2,
        zw: W / 2 - 0.17,
        floor: 0.52,
        top: hood.yMin - 0.035,
        motor: 'diesel',
        col: col,
        axle: A.xf,
      })
    const low = [
      [R, 0.44, 0.06],
      [R - 0.02, P.roof - 0.04, 0.16],
      [P.wb[0], P.wb[1], 0],
      [F - 0.14, P.nose, 0.24],
      [F, P.nose - 0.32, 0.16],
      [F - 0.03, 0.42, 0.06],
    ]
    kit.carDetails(c, {
      lower: low,
      bottomY: 0.42,
      noseY: P.nose,
      tailY: 1.2,
      W: W,
      col: col,
      hl: P.hl,
      tl: P.tl,
      grille: P.grille,
      seams: P.seams,
      handles: P.handles,
      wheels: [
        [A.xf, P.wr, 0.24, { rim: P.rim }],
        [A.xr, P.wr, 0.24, { rim: P.rim }],
      ],
      plateRearY: 0.72,
      noAntenna: true,
    })
    /* rear: two doors with a central split, handle, hinges, third brake light, black bumper with a step */
    const rx = R - BV
    c.roundBox(0.016, P.roof - 0.7, 0.018, 0.004, MT.dark, rx + 0.004, (P.roof + 0.58) / 2 - 0.02, 0)
    c.roundBox(0.014, 0.014, W - 0.24, 0.004, MT.dark, rx + 0.004, P.roof - 0.1, 0)
    c.roundBox(0.03, 0.05, 0.18, 0.012, MT.chrome, rx - 0.01, 1.22, 0.11)
    c.roundBox(0.03, 0.09, 0.05, 0.012, MT.trim, rx - 0.012, 1.22, 0.24)
    ;[1, -1].forEach(function (sd) {
      ;[1.8, 1.0].forEach(function (y) {
        c.roundBox(0.035, 0.13, 0.06, 0.012, MT.trim, rx - 0.012, y, sd * (W / 2 - 0.1))
      })
    })
    const brk = c.roundBox(0.03, 0.045, 0.42, 0.012, MT.tail, rx - 0.008, P.roof - 0.05, 0)
    brk.castShadow = false
    c.roundBox(0.03, 0.06, 0.46, 0.015, MT.housing, rx - 0.0, P.roof - 0.05, 0)
    c.roundBox(0.2, 0.05, 0.9, 0.015, CM('#2a2c2e', { roughness: 0.9 }), rx - 0.1, 0.69, 0, { def: true })
    c.roundBox(0.08, 0.2, W - 0.1, 0.03, MT.trim, rx - 0.02, 0.58, 0, { def: true })
    /* sliding door rail in relief */
    c.roundBox(
      P.slide[1] - P.slide[0] + 0.25,
      0.04,
      0.03,
      0.012,
      MT.trim,
      (P.slide[0] + P.slide[1]) / 2 - 0.05,
      P.roof - 0.42,
      W / 2 + 0.012,
    )
    c.roundBox(P.slide[1] - P.slide[0], 0.012, 0.006, 0.003, MT.dark, (P.slide[0] + P.slide[1]) / 2, P.roof - 0.5, W / 2 + 0.003)
    ;[P.slide[0], P.slide[1]].forEach(function (x) {
      c.roundBox(0.012, P.roof - 0.95, 0.006, 0.003, MT.dark, x, (P.roof - 0.5 + 0.45) / 2, W / 2 + 0.003)
    })
    c.roundBox(0.04, 0.12, 0.03, 0.012, MT.trim, P.slide[1] - 0.12, 1.3, W / 2 + 0.012)
    const ext: any = []
    ;[1, -1].forEach(function (sd) {
      ext.push(
        c.roundBox(A.xf - A.xr - 2 * P.wr - 0.3, 0.12, 0.03, 0.012, MT.trim, (A.xf + A.xr) / 2, 0.62, sd * (W / 2 + 0.008), { sub: 0.2 }),
      )
    })
    m.vanLow = low
    trackWidth(c, P.track, P.track)
    if (P.extra) P.extra(c, m, A, ext)
    sculpt(c, {
      low: c.deform[n0],
      extra: ext,
      sh: 0,
      tuck: 0.035,
      peak: 0.55,
      top: P.belt,
      pf: 0.09,
      Rf: 0.6,
      bowF: 0.1,
      Rb: 0.45,
      pr: 0.02,
      bowR: 0.01,
    })
    plateOutside(c)
    recessedLamps(c)
    m.damage = crashDamage
    /* van zones: the box side goes up to the high roof, sliding door on the right, two doors at the back */
    const hw = W / 2,
      yS = 0.3,
      yT = P.roof - 0.25
    const side = function (x0: any, x1: any, sd: any) {
      return sd < 0 ? [x0, x1, yS, yT, -hw - 0.25, -hw + 0.34] : [x0, x1, yS, yT, hw - 0.34, hw + 0.25]
    }
    c.zone('door_rear_right', trl('labels.right_sliding_door'), side(P.slide[0], P.slide[1], 1), null, {
      type: 'door',
      hinge: 'rear',
      side: 1,
      fxKey: 'door',
      who: trl('who.whoever_rides_in_the_back'),
    })
    c.zone('side_rear_right', trl('labels.right_box_side'), side(R + 0.22, P.slide[0], 1), null, {
      side: 1,
      fxKey: 'side_panel',
      who: trl('who.the_cargo'),
    })
    c.zone('door_rear_left', trl('labels.left_box_side'), side(R + 0.22, P.cabBack, -1), null, {
      type: 'panel',
      side: -1,
      fxKey: 'side_panel',
      who: trl('who.the_cargo'),
    })
    c.zone('side_rear_left', false)
    c.zone('roof', trl('labels.high_roof'), [R - 0.06, P.capX + 0.3, yT, P.roof + 0.2, -hw - 0.05, hw + 0.05])
    roofLining(c, m.roofItems)
    /* the rear doors open sideways: when destroyed they dent and tear in place (they do not tilt like a hatch lid) */
    c.zone('lid', trl('labels.rear_doors'), [R - 0.15, R + 0.35, 0.5, P.roof - 0.1, -hw + 0.08, hw - 0.08], null, {
      type: 'panel',
      fxKey: 'lid',
      dir: 'front',
    })
    c.vehicle.children.forEach(function (o: any) {
      if (
        o.isMesh &&
        o.geometry.type === 'PlaneGeometry' &&
        o.material.map &&
        o.material.map.image &&
        o.material.map.image.width === 400 &&
        o.position.x < 0
      )
        o.position.y = 0.84
    })
    return { A: A, m: m }
  }

  fx.register(
    {
      key: 'cargo_van',
      group: 'vans',
      name: trl('vehicles.cargo_van.name'),
      inspired: trl('vehicles.cargo_van.inspired'),
      article: trl('vehicles.cargo_van.article'),
      category: trl('vehicles.cargo_van.category'),
      fuel: 'diesel',
      description: trl('vehicles.cargo_van.description'),
      mass: 2283,
      noise: 75,
      seats: trl('vehicles.cargo_van.seats'),
      capacity: trl('vehicles.cargo_van.capacity'),
      efficiency: trl('vehicles.cargo_van.efficiency'),
      range: trl('vehicles.cargo_van.range'),
      maxSpeed: 155,
      skill: trl('vehicles.cargo_van.skill'),
      hood: true,
    },
    function (c) {
      van(c, {
        W: 1.99,
        L: 5.932,
        WB: 3.665,
        oF: 0.98,
        dF: 0.09,
        dR: 0.25,
        wr: 0.372,
        track: 1.72,
        col: '#b9bab6',
        belt: 1.36,
        roof: 2.58,
        nose: 1.06,
        capX: 0.62,
        wb: [1.9, 1.28],
        wt: [1.0, 2.14],
        cabBack: 0.36,
        slide: [-0.9, 0.42],
        rim: MT.steel,
        hl: { style: 'wedge', w: 0.52, h: 0.3, y: 1.02, in: 0.0, yaw: 0.6, dx: 0.04, mat: MT.led },
        tl: { style: 'vertical', w: 0.17, h: 0.62, y: 1.18, in: 0.0 },
        grille: { style: 'truck', w: 0.84, h: 0.28, y: 0.86 },
        seams: [1.62, 0.44],
        handles: [0.6],
        extra: function (c: any, m: any, _A: any) {
          const fx = kit.profX(m.vanLow, 0.86, true)
          kit.emblem(c, fx + 0.1, 0.86, 0, 0.1)
          /* tall black bumper from end to end, honeycomb central intake and fog lights */
          const bfx = kit.profX(m.vanLow, 0.56, true)
          c.roundBox(0.14, 0.3, 1.99, 0.06, MT.trim, bfx + 0.005, 0.58, 0, { def: true })
          kit.grille(c, { style: 'mesh', x: bfx + 0.07, y: 0.6, w: 0.9, h: 0.12, col: '#222', emblem: false })
          ;[1, -1].forEach(function (sd) {
            kit.headlight(c, {
              style: 'round',
              x: bfx + 0.07,
              y: 0.6,
              z: sd * 0.78,
              w: 0.07,
              h: 0.07,
              d: 0.05,
              side: sd,
              label: sd > 0 ? trl('labels.right_fog_light') : trl('labels.left_fog_light'),
              reach: 0.5,
            })
          })
          c.roundBox(0.3, 0.06, 0.06, 0.02, MT.trim, 0.0, 0.3, 0.7)
          /* cargo in the box: shelves and boxes (seen through the cab window and the partition) */
          const cx0 = m.rear + 0.2
          ;[1, -1].forEach(function (sd) {
            c.roundBox(2.6, 0.03, 0.4, 0.01, MT.steel, cx0 + 1.4, 1.4, sd * 0.75)
            c.roundBox(2.6, 0.03, 0.4, 0.01, MT.steel, cx0 + 1.4, 1.9, sd * 0.75)
          })
          ;[
            [cx0 + 0.4, 0.82, 0.3, '#8a6a44'],
            [cx0 + 0.9, 0.82, -0.3, '#7a5c3a'],
            [cx0 + 0.6, 1.18, -0.3, '#8a6a44'],
            [cx0 + 1.6, 0.82, 0.0, '#6d5232'],
          ].forEach(function (b) {
            c.roundBox(0.5, 0.4, 0.5, 0.02, CM(b[3], { roughness: 0.9 }), b[0], b[1], b[2])
          })
          c.part('cargo', trl('labels.cargo_box'), null, new V3(m.rear + 1.4, 1.2, 0), 1.3)
        },
      })
      c.meta.armor = function (c: any) {
        const m = c.meta
        kit.applyArmor(c)
        const y = m.top + 0.16
        for (let i = 0; i < 6; i++)
          c.roundBox(
            0.42,
            0.16,
            0.3,
            0.07,
            CM('#7a6a48', { roughness: 1 }),
            m.rear + 0.7 + (i % 3) * 0.45,
            y + 0.1 + (i < 3 ? 0 : 0.15),
            0.5,
          )
        ;[0.25, -0.25].forEach(function (z) {
          c.rod(new V3(m.rear - 0.04, 0.5, z), new V3(m.rear - 0.04, y + 0.3, z), 0.02, kit.steelMaterial)
        })
        for (let k = 0; k < 9; k++)
          c.rod(new V3(m.rear - 0.04, 0.6 + k * 0.27, -0.25), new V3(m.rear - 0.04, 0.6 + k * 0.27, 0.25), 0.012, kit.steelMaterial)
      }
    },
  )

  fx.register(
    {
      key: 'ambulance',
      group: 'vans',
      name: trl('vehicles.ambulance.name'),
      inspired: trl('vehicles.ambulance.inspired'),
      article: trl('vehicles.ambulance.article'),
      category: trl('vehicles.ambulance.category'),
      fuel: 'diesel',
      description: trl('vehicles.ambulance.description'),
      mass: 2950,
      noise: 80,
      seats: trl('vehicles.ambulance.seats'),
      capacity: trl('vehicles.ambulance.capacity'),
      efficiency: trl('vehicles.ambulance.efficiency'),
      range: trl('vehicles.ambulance.range'),
      maxSpeed: 150,
      skill: trl('vehicles.ambulance.skill'),
      hood: true,
    },
    function (c) {
      const W = 2.01,
        red = '#b3261e'
      van(c, {
        W: W,
        L: 5.413,
        WB: 3.45,
        oF: 0.95,
        dF: 0.08,
        dR: 0.25,
        wr: 0.341,
        track: 1.8,
        col: '#e4e2dc',
        amb: true,
        belt: 1.34,
        roof: 2.45,
        nose: 1.12,
        capX: 0.55,
        wb: [1.72, 1.32],
        wt: [0.95, 2.05],
        cabBack: 0.3,
        slide: [-0.75, 0.38],
        rim: MT.steel,
        hl: { style: 'wedge', w: 0.42, h: 0.17, y: 1.07, in: 0.01, yaw: 0.55, dx: 0.02, mat: MT.led },
        tl: { style: 'vertical', w: 0.17, h: 0.46, y: 0.95, in: 0.0 },
        grille: { style: 'mesh', w: 0.94, h: 0.09, y: 0.95 },
        seams: [1.5, 0.39],
        handles: [0.55],
        rearSide: [
          {
            side: 1,
            p: [
              [-0.68, 1.5],
              [0.3, 1.5],
              [0.3, 2.0],
              [-0.68, 2.0],
            ],
            label: lbl('sliding_door_window'),
          },
          {
            side: -1,
            p: [
              [-1.3, 1.5],
              [-0.45, 1.5],
              [-0.45, 2.0],
              [-1.3, 2.0],
            ],
            label: lbl('saloon_window'),
          },
        ],
        rearWin: { y0: 1.55, y1: 2.05, z0: 0.12, z1: 0.82 },
        extra: function (c: any, m: any, A: any, ext: any) {
          const fx = kit.profX(
            [
              [m.rear, 0.44],
              [m.rear, 2.4],
              [1.72, 1.32],
              [m.front - 0.14, 1.12],
              [m.front, 0.8],
              [m.front - 0.03, 0.42],
            ],
            0.98,
            true,
          )
          /* own Ducato front: tall black lower bumper with a wide intake and fog lights */
          const bfx = kit.profX(m.vanLow, 0.56, true)
          c.roundBox(0.14, 0.4, W + 0.02, 0.06, MT.trim, bfx + 0.005, 0.63, 0, { def: true })
          c.roundBox(0.03, 0.12, 1.1, 0.03, MT.housing, bfx + 0.08, 0.76, 0)
          ;[1, -1].forEach(function (sd) {
            kit.headlight(c, {
              style: 'round',
              x: bfx + 0.075,
              y: 0.64,
              z: sd * 0.82,
              w: 0.07,
              h: 0.07,
              d: 0.05,
              side: sd,
              label: sd > 0 ? trl('labels.right_fog_light') : trl('labels.left_fog_light'),
              reach: 0.5,
            })
          })
          kit.emblem(c, fx + 0.07, 0.95, 0, 0.045)
          const rd = c.paint(red),
            yl = c.paint('#e0b81c'),
            blu = c.paint('#1d4f9a')
          ;[1, -1].forEach(function (sd) {
            ext.push(
              c.roundBox(m.front - m.rear - 0.45, 0.16, 0.01, 0.005, rd, (m.front + m.rear) / 2 - 0.1, 1.1, sd * (W / 2 + 0.006), {
                sub: 0.15,
              }),
            )
            ext.push(
              c.roundBox(m.front - m.rear - 0.45, 0.05, 0.01, 0.004, yl, (m.front + m.rear) / 2 - 0.1, 0.98, sd * (W / 2 + 0.006), {
                sub: 0.15,
              }),
            )
            const zz = sd * (kit.halfAt(W, m.tumble, 1.75) + 0.012),
              zt = sd * (kit.halfAt(W, m.tumble, 2.22) + 0.012)
            c.text('RESGATE', 1.2, 0.3, sd > 0 ? -1.5 : -0.85, 2.22, zt, sd > 0 ? '+z' : '-z', { fg: red })
            ;[0, PI / 3, -PI / 3].forEach(function (a) {
              c.roundBox(0.09, 0.36, 0.01, 0.01, blu, -2.25, 1.75, zz, { rot: [0, 0, a] })
            })
          })
          /* mirrored AMBULANCE on the hood, in the plane of the hood, to be read in the mirror of whoever is ahead */
          if (c.hood) {
            const hp = c.hood.piv,
              hg = hp.children[0].geometry.attributes.position
            /* hood height at the point; with no vertex nearby, searches a larger window (never returns the -9 of "not found") */
            const topAt = function (lx: any, z?: any) {
              z = z || 0
              for (let tol = 0.07; tol < 0.6; tol *= 1.8) {
                let y = -9
                for (let i = 0; i < hg.count; i++)
                  if (Math.abs(hg.getZ(i) - z) < tol && Math.abs(hg.getX(i) - lx) < tol * 0.7) y = Math.max(y, hg.getY(i))
                if (y > -9) return y
              }
              return 0
            }
            const lc = (c.hood.x1 - c.hood.x0) * 0.42,
              ya = topAt(lc - 0.15),
              yb2 = topAt(lc + 0.15),
              th = Math.atan2(ya - yb2, 0.3),
              _yc = (ya + yb2) / 2
            const tm = c.text(trl('texts.ambulance'), 1.45, 0.24, lc + 0.008 * Math.sin(th), topAt(lc, 0) + 0.008 * Math.cos(th), 0, '+x', {
              fg: red,
              bg: '#f4f3ef',
              size: 0.78,
              parent: hp,
            })
            const pg = new THREE.PlaneGeometry(1.45, 0.24, 24, 1),
              pa = pg.attributes.position,
              y0 = topAt(lc, 0)
            for (let iv = 0; iv < pa.count; iv++) pa.setZ(iv, (topAt(lc, pa.getX(iv)) - y0) * Math.cos(th) + 0.004)
            pa.needsUpdate = true
            pg.computeVertexNormals()
            tm.geometry.dispose()
            tm.geometry = pg
            tm.quaternion
              .setFromAxisAngle(new V3(0, 0, 1), PI / 2 - th)
              .multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), PI / 2))
            tm.scale.x = -1
          }
          c.text('RESGATE', 0.8, 0.18, m.rear - 0.012, 2.22, 0, '-x', { fg: red })
          c.roundBox(0.03, 0.12, 1.9, 0.01, rd, m.rear - 0.008, 1.1, 0)
          /* front beacon and rear lights */
          const beaconBar = [c.roundBox(0.3, 0.08, 1.5, 0.03, MT.trim, 0.6, m.top + 0.04, 0)]
          ;[-0.5, -0.17, 0.17, 0.5].forEach(function (z, i) {
            beaconBar.push(
              c.roundBox(
                0.24,
                0.1,
                0.3,
                0.04,
                i % 2 ? MT.tail : CM('#f2f2f2', { emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.6 }),
                0.6,
                m.top + 0.13,
                z,
              ),
            )
          })
          beaconBar.push(
            c.roundBox(
              0.26,
              0.12,
              1.56,
              0.04,
              CM('#e8e8e8', { transparent: true, opacity: 0.3, depthWrite: false, roughness: 0.05 }),
              0.6,
              m.top + 0.13,
              0,
            ),
          )
          c.part('siren', trl('labels.beacon_and_siren'), null, new V3(0.6, m.top + 0.12, 0), 0.6)
          c.zone('beacon', trl('labels.beacon_and_siren'), [0.4, 0.8, m.top - 0.02, m.top + 0.25, -0.85, 0.85], beaconBar, {
            type: 'part',
            dir: 'up',
            weight: 0.4,
          })
          ;[1, -1].forEach(function (sd) {
            c.roundBox(0.1, 0.14, 0.2, 0.04, MT.tail, m.rear + 0.06, m.top + 0.02, sd * 0.78)
            c.roundBox(0.08, 0.1, 0.14, 0.03, MT.amber, m.rear + 0.06, m.top - 0.18, sd * 0.85)
          })
          /* saloon: stretcher, side seat, cabinets, oxygen and monitor */
          const fl = 0.62,
            sx = m.rear + 0.25
          c.roundBox(2.6, 0.03, W - 0.2, 0.01, CM('#5c6b78', { roughness: 0.8 }), sx + 1.3, fl, 0)
          c.roundBox(1.9, 0.06, 0.56, 0.02, MT.chrome, sx + 1.2, fl + 0.38, 0.32)
          ;[0.25, 1.95].forEach(function (dx) {
            ;[0.1, 0.54].forEach(function (dz) {
              c.rod(new V3(sx + dx, fl, dz), new V3(sx + dx, fl + 0.36, dz), 0.015, MT.chrome)
            })
          })
          const stretcher = c.roundBox(1.86, 0.1, 0.52, 0.04, CM('#e36b1a', { roughness: 0.7 }), sx + 1.2, fl + 0.46, 0.32)
          c.roundBox(0.4, 0.12, 0.48, 0.05, CM('#e36b1a', { roughness: 0.7 }), sx + 1.95, fl + 0.56, 0.32, { rot: [0, 0, 0.35] })
          c.part('stretcher', trl('labels.stretcher'), stretcher, new V3(sx + 1.2, fl + 0.46, 0.32), 0.7)
          c.roundBox(1.5, 0.1, 0.42, 0.03, CM('#3a4a5c', { roughness: 0.85 }), sx + 1.2, fl + 0.45, -0.68)
          c.roundBox(1.5, 0.5, 0.08, 0.03, CM('#3a4a5c', { roughness: 0.85 }), sx + 1.2, fl + 0.78, -0.89)
          c.roundBox(1.0, 0.5, 0.36, 0.02, CM('#d8dadc', { roughness: 0.5 }), sx + 0.6, 1.95, -0.78)
          for (let d = 0; d < 2; d++)
            c.roundBox(
              0.44,
              0.44,
              0.012,
              0.004,
              CM('#8fb3c9', { transparent: true, opacity: 0.4, depthWrite: false }),
              sx + 0.36 + d * 0.48,
              1.95,
              -0.59,
            )
          c.cylinder(0.09, 0.09, 0.9, CM('#2f7a3e', { roughness: 0.4 }), sx + 2.35, fl + 0.5, -0.75)
          c.cylinder(0.03, 0.04, 0.08, MT.chrome, sx + 2.35, fl + 0.99, -0.75)
          c.part('fuel_tank', trl('labels.oxygen_cylinder'), null, new V3(sx + 2.35, fl + 0.5, -0.75), 0.5)
          c.roundBox(0.04, 0.26, 0.34, 0.02, MT.screen, 0.1, 1.7, 0.5)
          const light = c.roundBox(
            2.3,
            0.02,
            W - 0.3,
            0.01,
            CM('#efefe8', { emissive: new THREE.Color('#7c7f86'), emissiveIntensity: 0.25 }),
            sx + 1.2,
            m.top - 0.06,
            0,
          )
          light.castShadow = false
          m.roofItems = beaconBar
        },
      })
      c.meta.armor = function (c: any) {
        const m = c.meta
        kit.applyArmor(c)
        for (let z = -0.7; z <= 0.71; z += 0.14)
          c.rod(new V3(0.38, m.top + 0.05, z), new V3(0.95, m.top + 0.05, z), 0.012, kit.steelMaterial)
        ;[0.38, 0.95].forEach(function (x) {
          c.tube(
            [
              [x, m.top - 0.02, -0.78],
              [x, m.top + 0.3, -0.7],
              [x, m.top + 0.3, 0.7],
              [x, m.top - 0.02, 0.78],
            ],
            0.022,
            kit.steelMaterial,
            { seg: 20 },
          )
        })
        c.rod(new V3(0.38, m.top + 0.3, 0), new V3(0.95, m.top + 0.3, 0), 0.02, kit.steelMaterial)
        for (let y = 1.5; y < 2.1; y += 0.12)
          c.rod(new V3(m.rear - 0.05, y, -0.85), new V3(m.rear - 0.05, y, 0.85), 0.012, kit.steelMaterial)
      }
    },
  )
}
