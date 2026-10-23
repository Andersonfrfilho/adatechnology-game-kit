import type { FleetContext } from '../context'

/* Military group (military file). Uses only the kit API.
   Matte olive green, generic white star, no real coat of arms or insignia.
   Vehicles: light 4x4, military truck,
   6x6 armoured carrier, 6x6 armoured car,
   main battle tank and utility helicopter.
   Local helpers of this file:
   - matteOlive(): swaps the glossy paint of c.paint() for matte olive green on all meshes
   - star(): flat five-point white star glued to a face
   - militaryWheel(): military wheel with V studs and a green rim
   - hull(): armoured hull from an extruded tapered profile with holes
   - sideSeat(): troop seat facing the aisle
   - hatch(): round hatch with a hinged lid (open or closed)
   - periscope(): vision block with armoured glass
   - tiltCab() and engineNoLatch(): tilting cab (copied from the heavy group)
   - mirroredBay(): mirrored engine bay for a rear engine (copied from the heavy group)
   - camoNet(), sandbags(), slat(): items of the "modified" state */
export function installMilitary(fx: FleetContext): void {
  const kit = fx.kit
  const THREE = kit.THREE
  const trl = fx.t
  const lbl = fx.label

  const V3 = kit.V3,
    PI = Math.PI,
    MT = kit.materials,
    CM = kit.makeMaterial,
    G = kit.geo,
    DS = THREE.DoubleSide
  const GRP = 'military'
  const OLIVE = '#4d5236',
    OLIVE2 = '#454a30'
  const WHITE = CM('#e4e2d6', { roughness: 0.8 }),
    BLACK = CM('#1a1b18', { roughness: 0.85 })
  const OLIVE_STEEL = CM('#3c4030', { metalness: 0.4, roughness: 0.6 }),
    CANVAS = CM('#55553c', { roughness: 0.98, side: DS }),
    CANVAS2 = CM('#4a4b34', { roughness: 0.98, side: DS })
  const RIMO = CM('#3f4430', { metalness: 0.25, roughness: 0.7 }),
    BARREL = CM('#2b2d29', { metalness: 0.6, roughness: 0.45 })
  const BAG = CM('#76694b', { roughness: 0.97 }),
    NET = CM('#3e4a2c', { roughness: 1, side: DS }),
    NET2 = CM('#5a5638', { roughness: 1, side: DS })
  /* spare can: matte dark sand (no bright red in military paint) */
  const SAND = '#6b6448'
  /* canvas top: lighter and less saturated than the bodywork, fully matte */
  const CANVAS_TOP = CM('#646349', { roughness: 1, side: DS }),
    CANVAS_TOP2 = CM('#57563f', { roughness: 1, side: DS })
  /* light inner lining with a reflection of the red combat light (the gap does not go black) */
  const LINING = CM('#78806f', { roughness: 0.9, emissive: new THREE.Color('#2c0805'), emissiveIntensity: 0.35 })
  const TROOP_SEAT = CM('#4a4f3c', { roughness: 0.9, emissive: new THREE.Color('#1e0604'), emissiveIntensity: 0.8 })
  const RED_LIGHT = CM('#a01a12', { emissive: new THREE.Color('#ff2a14'), emissiveIntensity: 1.6 })
  const BAY_LIGHT = CM('#5f645b', { roughness: 0.85, metalness: 0.15 })
  /* double-sided materials without shadow acne (dark bands) */
  ;[CANVAS, CANVAS2, NET, NET2, CANVAS_TOP, CANVAS_TOP2].forEach(function (mt) {
    mt.shadowSide = THREE.BackSide
  })

  /* ================= rollover, stiffness and antennas (local to the military group) ================= */
  /* runs fn(c) every frame of the tick (neutral input in c.spin: the core only adds rotation 0) */
  function perFrame(c: any, fn: any) {
    const o = { rotation: {} }
    Object.defineProperty(o.rotation, 'y', {
      get: function () {
        return 0
      },
      set: function () {
        fn(c)
      },
    })
    c.spin.push({ o: o, axis: 'y', v: 0, hook: true })
  }
  /* armoured steel: each new dent keeps only k of the depth, without rippling like putty.
     Applies to meshes in c.deform and to the rigid parts that follow the dent. */
  function armor(c: any, k: any) {
    perFrame(c, function () {
      c.deform.forEach(function (msh: any) {
        const g = msh.geometry,
          pos = g.attributes.position,
          ud = g.userData
        if (!ud.p0 || ud.p0.length !== pos.array.length || ud.militaryVersion === pos.version) return
        if (!ud.militaryPrev) ud.militaryPrev = new Float32Array(ud.p0)
        const a = pos.array,
          pr = ud.militaryPrev
        for (let i = 0; i < a.length; i++) {
          a[i] = pr[i] + (a[i] - pr[i]) * k
          pr[i] = a[i]
        }
        pos.needsUpdate = true
        if (ud.crease) G.crease(g, 42)
        else g.computeVertexNormals()
        g.computeBoundingSphere()
        g.computeBoundingBox()
        ud.militaryVersion = pos.version
      })
      c.vehicle.children.forEach(function (o: any) {
        const u = o.userData
        if (!u.pos0) return
        if (!u.militaryPrev) u.militaryPrev = u.pos0.clone()
        if (o.position.distanceToSquared(u.militaryPrev) < 1e-10) return
        o.position.sub(u.militaryPrev).multiplyScalar(k).add(u.militaryPrev)
        u.militaryPrev.copy(o.position)
      })
    })
  }
  /* parts that neither dent nor sink with the dent (turret, cannon, mast) */
  function rigid(c: any, objs: any) {
    objs.forEach(function (o: any) {
      const i = c.deform.indexOf(o)
      if (i >= 0) c.deform.splice(i, 1)
      o.userData.noFollow = true
    })
  }
  /* antennas break at the first contact of the rollover (the rod goes away and pieces fly off) */
  function breakAntennas(c: any) {
    ;(c.militaryAntennas || []).forEach(function (w: any) {
      if (!w.parent) return
      const p = c.toEffects(w.position.clone())
      w.parent.remove(w)
      kit.burst(c, 'plastic', p, 3, { speed: 1.4 })
      kit.burst(c, 'spark', p, 6, { speed: 2 })
    })
  }
  /* settles the vehicle on the ground by the lowest point of EVERYTHING visible (turret, mast, gear), not only the hull */
  function settle(c: any, tilt: any, riseOnly?: any) {
    if (tilt) c.vehicle.rotation.z += tilt
    c.root.updateMatrixWorld(true)
    const inv = new THREE.Matrix4().copy(c.root.matrixWorld).invert(),
      box = new THREE.Box3(),
      tmp = new THREE.Box3()
    c.vehicle.traverse(function (ob: any) {
      if (!ob.isMesh) return
      for (let q = ob; q && q !== c.vehicle; q = q.parent)
        if (!q.visible || q.userData.decal || q.userData.ghost || q.userData.antena) return
      if (!ob.geometry.boundingBox) ob.geometry.computeBoundingBox()
      tmp.copy(ob.geometry.boundingBox).applyMatrix4(ob.matrixWorld).applyMatrix4(inv)
      box.union(tmp)
    })
    if (!box.isEmpty() && (!riseOnly || box.min.y < -0.005)) c.vehicle.position.y -= box.min.y
  }
  /* o: { tilt (rad, final inclination), onStart(c, A), onRoll(c, A), onFlip(c) } */
  function rollover(c: any, o?: any) {
    o = o || {}
    let done = false,
      prev = false,
      after = 0
    perFrame(c, function () {
      /* during the next 3 s the half-open hood and the loose parts still move: nothing may go through the ground */
      if (done && after > 0) {
        after--
        if (after % 3 === 0) settle(c, 0, true)
      }
      const A = c.rollState
      if (A) {
        if (!A.mil) {
          A.mil = true
          c.militaryRollSide = A.s
          if (o.onStart) o.onStart(c, A)
        }
        if (o.onRoll) o.onRoll(c, A)
        if (!prev && A.last >= 1) {
          prev = true
          breakAntennas(c)
        }
      }
      if (c.flipped && !done) {
        done = true
        if (!prev) {
          prev = true
          breakAntennas(c)
        }
        if (o.onFlip) o.onFlip(c)
        settle(c, o.tilt || 0)
        after = 90
      }
    })
  }
  /* damage of the "damaged" state of armoured vehicles: same zones as the default, without a stain on the armour */
  function armoredCrashDamage(c: any) {
    const m = c.meta,
      mid = m.clearance + (m.bodyHeight || 0.6) * 0.5
    kit.impact(c, new V3(m.front, mid, m.width * 0.15), new V3(-1, 0, 0), 1.0, { noStain: true })
    kit.impact(c, new V3((m.front + m.rear) * 0.5 + m.length * 0.12, mid + 0.1, -m.width / 2), new V3(0, 0, 1), 0.7, { noStain: true })
  }
  /* scales everything assembled since n0 around cen (bigger engine without rewriting the core engine bay) */
  function scale(c: any, n0: any, cen: any, s: any) {
    c.vehicle.children.slice(n0).forEach(function (ob: any) {
      ob.position.sub(cen).multiplyScalar(s).add(cen)
      ob.scale.multiplyScalar(s)
    })
  }
  function renameHood(c: any, name: any) {
    c.parts.forEach(function (p: any) {
      if (p.kind === 'hood') p.label = name
    })
  }

  /* ================= utilities ================= */
  function paintMat(c: any, hex: any) {
    return CM(kit.paintColor(hex, c.state), { roughness: c.state === 'damaged' ? 0.92 : 0.82, metalness: 0.08, side: DS })
  }
  /* swaps the glossy material of c.paint(hex) for the matte one on everything already assembled */
  const MATTE_STEEL = CM('#2e3128', { metalness: 0.45, roughness: 0.6 })
  function matteOlive(c: any, hex: any, o?: any) {
    o = o || {}
    const bright = c.paint(hex),
      mate = paintMat(c, hex),
      roofB = o.roof ? c.paint(o.roof) : null,
      roofM = o.roofMat || CANVAS
    c.root.traverse(function (ob: any) {
      if (!ob.isMesh) return
      if (ob.material === bright) ob.material = mate
      else if (roofB && ob.material === roofB) ob.material = roofM
      else if (o.dechrome !== false && ob.material === MT.chrome) ob.material = MATTE_STEEL
    })
    return mate
  }
  /* five-point star. face: "+z" | "-z" | "+y" | "+x" | "-x" */
  const starGeoCache: any = {}
  function star(c: any, x: any, y: any, z: any, r: any, face: any, o: any) {
    o = o || {}
    const key = r.toFixed(3)
    if (!starGeoCache[key]) {
      const s = new THREE.Shape()
      for (let i = 0; i < 10; i++) {
        const a = PI / 2 + (i * PI) / 5,
          rr = i % 2 ? r * 0.4 : r
        if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
        else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
      }
      const g = new THREE.ShapeGeometry(s)
      starGeoCache[key] = g
    }
    const m = c.add(starGeoCache[key].clone(), o.mat || WHITE, x, y, z, o.parent)
    m.castShadow = false
    if (face === '+y') m.rotation.x = -PI / 2
    else m.rotation.y = ({ '+z': 0, '-z': PI, '+x': PI / 2, '-x': -PI / 2 } as Record<string, number>)[face] || 0
    if (o.rotZ) m.rotateZ(o.rotZ)
    if (o.ring) {
      const rg = c.add(new THREE.RingGeometry(r * 1.12, r * 1.24, 32), o.mat || WHITE, x, y, z, o.parent)
      rg.castShadow = false
      rg.rotation.copy(m.rotation)
      m.userData.ring = rg
    }
    return m
  }
  /* military wheel: stud tyre with a V pattern and an olive-green rim */
  function militaryWheel(c: any, x: any, z: any, r: any, w: any, o: any) {
    o = o || {}
    return c.wheel(x, z, r, w, Object.assign({ lugs: true, chevron: true, rim: RIMO, spokes: 0, rimR: 0.55 }, o))
  }
  function jerry(c: any, x: any, y: any, z: any, col: any, rotY: any) {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    g.rotation.y = rotY || 0
    g.userData.rigid = true
    c.vehicle.add(g)
    c.roundBox(0.34, 0.46, 0.17, 0.04, CM(col || '#3e4a2c', { roughness: 0.7 }), 0, 0, 0, { parent: g })
    c.roundBox(0.3, 0.012, 0.02, 0.004, BLACK, 0, 0.05, 0.088, { parent: g })
    c.roundBox(0.3, 0.012, 0.02, 0.004, BLACK, 0, -0.05, 0.088, { parent: g })
    c.tube(
      [
        [-0.1, 0.23, 0],
        [-0.05, 0.29, 0],
        [0.05, 0.29, 0],
        [0.1, 0.23, 0],
      ],
      0.015,
      CM(col || '#3e4a2c'),
      { parent: g, seg: 12, rs: 5 },
    )
    c.cylinder(0.025, 0.025, 0.05, MT.trim, 0.12, 0.25, 0, null, { parent: g })
    return g
  }
  /* canvas top over a roof (x0..x1, half width hw, top y): bulging cloth that sags between the arches and marked arches */
  function canvasTop(c: any, x0: any, x1: any, y: any, hw: any, pitch: any) {
    const nxs = 32,
      nzs = 16,
      pos = [],
      idx = [],
      out = [],
      nb = Math.max(2, Math.round((x1 - x0) / pitch)),
      sp = (x1 - x0) / nb
    function yAt(x: any, z: any) {
      const t = Math.min(1, Math.abs(z) / hw),
        ph = ((x - x0) / sp) % 1,
        bulge = 1 - t * t
      return y + 0.045 * bulge - 0.014 * Math.sin(ph * PI) * bulge - (t > 0.9 ? (t - 0.9) * 0.9 : 0)
    }
    for (let i = 0; i <= nxs; i++)
      for (let j = 0; j <= nzs; j++) {
        const x = x0 + ((x1 - x0) * i) / nxs,
          z = ((j / nzs) * 2 - 1) * hw
        pos.push(x, yAt(x, z), z)
      }
    for (let i = 0; i < nxs; i++)
      for (let j = 0; j < nzs; j++) {
        const a = i * (nzs + 1) + j,
          b = a + nzs + 1
        idx.push(a, a + 1, b, a + 1, b + 1, b)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    const sheet = c.add(g, CANVAS_TOP)
    c.deform.push(sheet)
    out.push(sheet)
    for (let k = 0; k <= nb; k++) {
      const bx = x0 + k * sp,
        pts = [
          [bx, y - 0.26, -(hw + 0.035)],
          [bx, y - 0.06, -(hw + 0.03)],
        ]
      for (let q = -4; q <= 4; q++) {
        const zq = (q / 4) * hw * 0.92
        pts.push([bx, yAt(bx, zq) + 0.012, zq])
      }
      pts.push([bx, y - 0.06, hw + 0.03], [bx, y - 0.26, hw + 0.035])
      out.push(c.tube(pts, 0.02, CANVAS_TOP2, { seg: 40, rs: 6 }))
    }
    /* tie cords on the edge */
    ;[1, -1].forEach(function (sd) {
      out.push(c.rod(new V3(x0, y - 0.05, sd * (hw + 0.035)), new V3(x1, y - 0.05, sd * (hw + 0.035)), 0.01, CANVAS_TOP2, { seg: 5 }))
    })
    return out
  }
  function sandbags(c: any, x0: any, x1: any, y: any, z: any, along: any, rows: any) {
    rows = rows || 2
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? 0.2 : 0
      for (let t = x0 + off; t <= x1 + 1e-6; t += 0.42) {
        const j = kit.hash(t, r, z) - 0.5
        if (along === 'z') c.roundBox(0.32, 0.16, 0.42, 0.07, BAG, z, y + r * 0.14, t, { rot: [0, j * 0.2, 0] })
        else c.roundBox(0.42, 0.16, 0.32, 0.07, BAG, t, y + r * 0.14, z, { rot: [0, j * 0.2, 0] })
      }
    }
  }
  /* camouflage net draped over a box (x0..x1, width w, height y) */
  /* camouflage net draped over a box (x0..x1, width w of what is underneath, top at y):
     sits 5 cm above the top and drops OUTSIDE the width; fine mesh with smooth normals; irregular tufts */
  const NET_MAT = CM('#ffffff', { vertexColors: true, roughness: 1, side: DS })
  NET_MAT.shadowSide = THREE.BackSide
  function camoNet(c: any, x0: any, x1: any, y: any, w: any, drop: any, prof?: any) {
    prof =
      prof ||
      function () {
        return y
      }
    const nx = 28,
      nz = 14,
      pos = [],
      idx = [],
      col = [],
      cs = ['#3e4a2c', '#55543a', '#2f3626', '#4a5233'].map(function (h) {
        return new THREE.Color(h)
      })
    const hw = w / 2 + 0.06,
      span = hw + drop * 0.45
    for (let i = 0; i <= nx; i++)
      for (let j = 0; j <= nz; j++) {
        const u = i / nx,
          v = j / nz,
          x = x0 + (x1 - x0) * u,
          zz = (v * 2 - 1) * span,
          az = Math.abs(zz)
        let yy, zo
        const wav = 0.025 * (1 + Math.sin(u * 11 + v * 7)) * 0.5 + 0.02 * kit.hash(i, j, 5)
        if (az <= hw) {
          yy = Math.max(prof(zz), prof(Math.min(hw, az + 0.08) * Math.sign(zz || 1))) + 0.05 + wav * (1 - Math.pow(az / hw, 6))
          zo = zz
        } else {
          const t = (az - hw) / (span - hw)
          yy = prof(hw) + 0.05 - drop * t * (0.85 + 0.15 * Math.sin(u * 13))
          zo = Math.sign(zz) * (hw + 0.04 * Math.sin(t * PI) + 0.03 * t)
        }
        /* front and back edges also drop a little */
        const ex = Math.min(u, 1 - u) * (x1 - x0)
        if (ex < 0.25) yy -= (0.25 - ex) * 0.5 * drop
        pos.push(x, yy, zo)
        const h = kit.hash(Math.floor(i / 2), Math.floor(j / 2), 3),
          cc = cs[Math.floor(h * 4) % 4],
          k2 = 0.85 + 0.3 * kit.hash(i, j, 9)
        col.push(cc.r * k2, cc.g * k2, cc.b * k2)
      }
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        const a = i * (nz + 1) + j,
          b = a + nz + 1
        idx.push(a, b, a + 1, a + 1, b, b + 1)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    const m = c.add(g, NET_MAT)
    m.castShadow = true
    m.receiveShadow = false /* no self-shadowing: no jagged bands */
    /* foliage tufts: groups of 3 to 5 deformed, irregular icosahedra */
    for (let k = 0; k < 14; k++) {
      const hx = x0 + 0.2 + (x1 - x0 - 0.4) * kit.hash(k, 1, 7),
        hz = (kit.hash(k, 2, 7) - 0.5) * w * 0.85,
        n = 3 + Math.floor(kit.hash(k, 4, 7) * 3)
      for (let q = 0; q < n; q++) {
        const r = 0.07 + kit.hash(k, q, 11) * 0.07,
          geo = new THREE.IcosahedronGeometry(r, 1),
          p = geo.attributes.position
        for (let vi = 0; vi < p.count; vi++) {
          const f = 0.7 + 0.6 * kit.hash(p.getX(vi) * 31 + k, p.getY(vi) * 17 + q, p.getZ(vi) * 13)
          p.setXYZ(vi, p.getX(vi) * f, p.getY(vi) * f * 0.8, p.getZ(vi) * f)
        }
        geo.computeVertexNormals()
        const ang = (q / n) * PI * 2 + k,
          tf = c.add(geo, (k + q) % 2 ? NET : NET2, hx + Math.cos(ang) * 0.1, prof(hz) + 0.1 + r * 0.5, hz + Math.sin(ang) * 0.1)
        tf.rotation.set(kit.hash(k, q, 1) * 3, kit.hash(k, q, 2) * 3, 0)
      }
    }
    return m
  }
  /* anti-rocket grille (slat): horizontal bars set off from the side */
  function slat(c: any, x0: any, x1: any, y0: any, y1: any, z: any, mat?: any) {
    mat = mat || OLIVE_STEEL
    const s = Math.sign(z)
    for (let y = y0; y <= y1 + 1e-6; y += 0.11) c.rod(new V3(x0, y, z), new V3(x1, y, z), 0.012, mat, { seg: 5 })
    for (let x = x0; x <= x1 + 1e-6; x += 0.7) {
      c.rod(new V3(x, y0 - 0.03, z), new V3(x, y1 + 0.03, z), 0.022, mat, { seg: 6 })
      c.rod(new V3(x, y0 + 0.05, z), new V3(x, y0 + 0.05, z - s * 0.2), 0.02, mat, { seg: 6 })
      c.rod(new V3(x, y1 - 0.05, z), new V3(x, y1 - 0.05, z - s * 0.2), 0.02, mat, { seg: 6 })
    }
  }
  /* generic heavy machine gun (.50) pointing to +x from (x, y, z) */
  function machineGun(c: any, x: any, y: any, z: any, o: any) {
    o = o || {}
    const len = o.len || 1.6,
      g = new THREE.Group()
    g.position.set(x, y, z)
    g.rotation.y = o.yaw || 0
    g.rotation.z = o.pitch || 0
    g.userData.rigid = true
    c.vehicle.add(g)
    c.roundBox(0.5, 0.17, 0.16, 0.03, BARREL, 0, 0, 0, { parent: g })
    c.cylinder(0.055, 0.055, len * 0.55, BARREL, 0.25 + len * 0.27, 0.02, 0, 'x', { parent: g })
    c.cylinder(0.026, 0.026, len * 0.5, BARREL, 0.25 + len * 0.75, 0.02, 0, 'x', { parent: g })
    c.cylinder(0.04, 0.03, 0.12, BARREL, 0.25 + len, 0.02, 0, 'x', { parent: g })
    c.roundBox(0.2, 0.14, 0.12, 0.02, CM('#46482f', { roughness: 0.7 }), -0.05, -0.08, 0.15, { parent: g })
    ;[-1, 1].forEach(function (s) {
      c.rod(new V3(-0.28, 0, s * 0.06), new V3(-0.4, -0.02, s * 0.06), 0.015, BARREL, { parent: g })
    })
    return g
  }
  /* round hatch: ring and a lid hinged backwards (open in rad) */
  function hatch(c: any, x: any, y: any, z: any, r: any, open: any, mat: any, o?: any) {
    o = o || {}
    c.cylinder(r + 0.05, r + 0.07, 0.07, mat, x, y + 0.02, z, null, { seg: 24 })
    c.cylinder(r - 0.01, r - 0.01, 0.075, MT.dark, x, y + 0.025, z, null, { seg: 24 })
    const piv = new THREE.Group()
    piv.position.set(x - r * (o.hingeX || 1), y + 0.06, z)
    piv.userData.rigid = true
    c.vehicle.add(piv)
    c.cylinder(r + 0.02, r + 0.02, 0.05, mat, r, 0.0, 0, null, { seg: 24, parent: piv })
    c.roundBox(0.06, 0.04, r * 1.3, 0.015, OLIVE_STEEL, r * 0.6, 0.04, 0, { parent: piv })
    piv.rotation.z = open || 0
    if (o.yaw) {
      piv.rotation.order = 'YXZ'
      piv.rotation.y = o.yaw
    }
    return piv
  }
  /* vision block (periscope) with armoured glass. Face +x by default */
  function periscope(c: any, x: any, y: any, z: any, w: any, label: any, o?: any) {
    o = o || {}
    const rot = o.rot || 0
    const box = c.roundBox(0.14, 0.12, w + 0.06, 0.02, o.mat || OLIVE_STEEL, x, y, z, { rot: [0, rot, 0] })
    const gl = c.roundBox(0.02, 0.07, w, 0.01, MT.armorGlass, x + Math.cos(rot) * 0.07, y, z - Math.sin(rot) * 0.07, { rot: [0, rot, 0] })
    if (label) kit.asGlass(c, gl, label, 'laminated')
    return box
  }
  /* troop seat against the wall, facing the centre (dir = +1 faces +z) */
  function sideSeat(c: any, x0: any, x1: any, fl: any, z: any, dir: any, o: any) {
    o = o || {}
    const fab = o.mat || CM('#2f3226', { roughness: 0.9 }),
      h = o.h || 0.42,
      n = Math.max(1, Math.round((x0 - x1) / 0.55))
    c.roundBox(x0 - x1, 0.06, 0.42, 0.02, OLIVE_STEEL, (x0 + x1) / 2, fl + h - 0.12, z + dir * 0.2)
    for (let i = 0; i < n; i++) {
      const x = x1 + ((i + 0.5) * (x0 - x1)) / n
      c.roundBox(0.48, 0.09, 0.42, 0.035, fab, x, fl + h - 0.05, z + dir * 0.2)
      c.roundBox(0.46, 0.5, 0.08, 0.035, fab, x, fl + h + 0.28, z + dir * 0.02, { rot: [-dir * 0.08, 0, 0] })
      c.roundBox(0.2, 0.15, 0.07, 0.03, fab, x, fl + h + 0.66, z + dir * 0.03)
      c.rod(new V3(x, fl, z + dir * 0.36), new V3(x, fl + h - 0.12, z + dir * 0.36), 0.02, OLIVE_STEEL, { seg: 6 })
      c.seatTops.push({ x: x, y: fl + h, z: z + dir * 0.2, w: 0.42, l: 0.48 })
    }
  }
  /* armoured hull: side profile [x, y, radius] extruded to width W and tapered above belt (k) */
  function hull(c: any, o: any) {
    const T = { belt: o.belt, top: o.top, k: o.k || 0 }
    const m = kit.shell(c, {
      items: o.items,
      bottomY: o.bottomY,
      arches: o.arches,
      W: o.W,
      mat: o.mat,
      col: o.col,
      T: T,
      holes: o.holes || [],
      archInner: o.archInner,
      sub: o.sub || 0.22,
      bev: o.bev == null ? 0.06 : o.bev,
    })
    return {
      mesh: m,
      T: T,
      half: function (y: any) {
        return kit.halfAt(o.W, T, y)
      },
    }
  }

  /* tilting cab (adapted from the heavy group): the meshes get the tilt in their own matrix */
  function engineNoLatch(c: any) {
    c.parts.forEach(function (p: any) {
      if (p.kind !== 'engine') return
      p.onHit = function (c2: any, pt: any, force: any) {
        kit.addEmitter(c2, pt.pos.clone().add(new V3(0, 0.35, 0)), 'black')
        kit.puddle(c2, 'oil', pt.pos.clone().setY(Math.max(0.2, c2.meta.clearance || 0.3)), 0.6 + force * 0.3)
      }
    })
  }
  function tiltCab(c: any, objs: any, pivot: any, o: any) {
    o = o || {}
    const h = kit.hinge(c, [], pivot, {
      len: -(o.len || 1.8),
      open: o.open || 0.9,
      sign: -1,
      zw: 0.7,
      label: o.label || trl('labels.tilting_cab'),
    })
    const piv = h.piv,
      A = new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z),
      B = new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z)
    const R = new THREE.Matrix4(),
      M = new THREE.Matrix4()
    let last = 0
    function tm() {
      const a = piv.rotation.z
      if (Math.abs(a) < 1e-5) return null
      if (a !== last) {
        R.makeRotationZ(a)
        M.copy(A).multiply(R).multiply(B)
        last = a
      }
      return M
    }
    objs.forEach(function (ob: any) {
      if (ob === piv) return
      ob.updateMatrix = function () {
        this.matrix.compose(this.position, this.quaternion, this.scale)
        const t = tm()
        if (t) this.matrix.premultiply(t)
        this.matrixWorldNeedsUpdate = true
      }
    })
    c.parts.forEach(function (p: any) {
      if (p.kind === 'hood' && p.obj === piv) {
        p.onHit = function () {}
        p.pos = new V3(pivot.x - 0.8, pivot.y + 1.0, 0)
      }
    })
    engineNoLatch(c)
    return h
  }
  /* mirrored engine bay (rear engine): engineBay turned 180 degrees around the vertical axis at xm */
  function mirroredBay(c: any, o: any, xm: any) {
    const n0 = c.vehicle.children.length,
      np = c.parts.length
    kit.engineBay(c, o)
    const q = new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), PI)
    c.vehicle.children.slice(n0).forEach(function (ob: any) {
      ob.position.x = 2 * xm - ob.position.x
      ob.position.z = -ob.position.z
      ob.quaternion.premultiply(q)
    })
    c.parts.slice(np).forEach(function (p: any) {
      p.pos.x = 2 * xm - p.pos.x
      p.pos.z = -p.pos.z
    })
    const b = c.meta.bay
    if (b) {
      const a = 2 * xm - b.x1,
        z = 2 * xm - b.x0
      b.x0 = a
      b.x1 = z
      b.center.x = 2 * xm - b.center.x
    }
  }
  function antenna(c: any, x: any, y: any, z: any, h: any) {
    c.cylinder(0.03, 0.035, 0.08, BLACK, x, y + 0.04, z)
    const w = c.rod(new V3(x, y + 0.08, z), new V3(x - 0.15, y + h, z), 0.006, BLACK, { r2: 0.003, seg: 5 })
    w.userData.antena = true
    ;(c.militaryAntennas = c.militaryAntennas || []).push(w)
    return w
  }

  /* ================================================================ */
  /* Light 4x4 (Agrale Marrua AM2 type, army 1/2 t utility)
     Reference (Agrale/ECSB sheet and Wikipedia, confirmed on the web):
     length 3.80 m (with spare) · body width 1.87 m (1.92 m with the running board) · height 1.95 m with the top (1.40 m with the windshield folded)
     wheelbase 2.30 m · track 1.54 m · tyre 7.50-16 or 235/85 R16 (about 0.81 m) · clearance 0.27 m (differential), floor at about 0.52 m
     front overhang about 0.62 m (approach angle 64 degrees) · rear overhang about 0.88 m with spare (departure 52 degrees) · 1,960 kg in running order · 100 L
     Signature traits:
     front: straight vertical panel with a black grille of horizontal slats edge to edge; round headlights at the ends, inside black frames;
     straight steel bumper with two tow hooks and a winch in the middle; convoy lights on top of the fenders
     side: only two doors (jeep), straight low box, long flat hood, nearly vertical windshield that folds, cut-out wheel arches
     with flat fenders, running board between the wheels
     rear: small vertical taillights, spare in the middle of the rear and a can beside it, low tailgate
     top: canvas top with marked arches from the windshield to the rear; white star on the hood */
  fx.register(
    {
      key: 'light_4x4',
      group: GRP,
      name: trl('vehicles.light_4x4.name'),
      inspired: trl('vehicles.light_4x4.inspired'),
      category: trl('vehicles.light_4x4.category'),
      fuel: 'diesel',
      description: trl('vehicles.light_4x4.description'),
      mass: 1960,
      noise: 85,
      seats: trl('vehicles.light_4x4.seats'),
      capacity: trl('vehicles.light_4x4.capacity'),
      efficiency: trl('vehicles.light_4x4.efficiency'),
      range: trl('vehicles.light_4x4.range'),
      maxSpeed: 120,
      skill: trl('vehicles.light_4x4.skill'),
      hood: true,
    },
    function (c) {
      /* origin at mid-wheelbase; F = face of the front panel, R = rear face of the box */
      const col = OLIVE,
        WB = 2.3,
        xf = WB / 2,
        xr = -WB / 2,
        F = 1.79,
        R = -1.6,
        W = 1.87,
        wr = 0.365,
        ww = 0.235,
        zt = 0.77
      const s = {
        W: W,
        col: col,
        roofCol: '#5b5a40',
        bottomY: 0.52,
        noseY: 1.0,
        tailY: 1.08,
        lower: [
          [R, 0.56, 0.05],
          [R - 0.01, 1.17, 0.04],
          [0.5, 1.2, 0],
          [F - 0.06, 1.18, 0.05],
          [F, 1.06, 0.03],
          [F, 0.6, 0.04],
          [F - 0.06, 0.52, 0.04],
        ],
        arches: [
          [xf, 0.4, 0.47],
          [xr, 0.4, 0.47],
        ],
        gh: { rb: R + 0.04, rt: R + 0.06, ft: 0.34, fb: 0.42, belt: 1.2, roof: 1.8, Wg: 1.8, k: 0.03, pillars: [-0.6], r1: 0.08, r2: 0.05 },
        seams: [0.38, -0.6],
        handles: [-0.48],
        plateRearY: 0.8,
        tailLightY: 0.86,
        hl: { style: 'round', w: 0.2, h: 0.2, y: 0.88, in: 0.07, yaw: 0, dx: 0.06 },
        grille: { style: 'bars', w: 1.12, h: 0.3, y: 0.88, emblem: false },
        tl: { style: 'vertical', w: 0.09, h: 0.18, y: 0.86, in: 0.05 },
        interior: { rows: 1, col: '#3a3b2e', trim: '#23241e' },
        hood: { motor: 'diesel' },
        noAntenna: true,
        mirrorCol: '#22231d',
        wheels: [],
      }
      kit.car(c, s)
      ;[xf, xr].forEach(function (x) {
        ;[1, -1].forEach(function (sd) {
          militaryWheel(c, x, sd * zt, wr, ww, {
            label:
              x > 0
                ? sd > 0
                  ? trl('labels.front_right_tire')
                  : trl('labels.front_left_tire')
                : sd > 0
                  ? trl('labels.rear_right_tire')
                  : trl('labels.rear_left_tire'),
          })
        })
      })
      const m = c.meta,
        paint = matteOlive(c, col, { roof: '#5b5a40', roofMat: CANVAS_TOP })
      /* square black frames around the round headlights and the black edge-to-edge grille panel (the light 4x4 signature) */
      /* the shell bulges up to F + 0.05: the panel sits ahead of it, otherwise it disappears inside the bodywork */
      c.roundBox(0.03, 0.36, W - 0.12, 0.03, BLACK, F + 0.057, 0.88, 0)
      const LAM = CM('#34362f', { metalness: 0.3, roughness: 0.55 })
      for (let gl = 0; gl < 6; gl++) c.roundBox(0.02, 0.022, 1.0, 0.008, LAM, F + 0.077, 0.775 + gl * 0.042, 0)
      ;[1, -1].forEach(function (sd) {
        const rg = c.add(new THREE.TorusGeometry(0.112, 0.022, 8, 28), BLACK, F + 0.075, 0.88, sd * (W / 2 - 0.07 - 0.1))
        rg.rotation.y = PI / 2
      })
      /* amber indicators below the headlights */
      ;[1, -1].forEach(function (sd) {
        c.roundBox(0.03, 0.05, 0.12, 0.015, MT.amber, F + 0.02, 0.68, sd * (W / 2 - 0.17))
      })
      /* rear troop seats: two on each side, facing the aisle */
      sideSeat(c, -0.7, -1.52, s.bottomY + 0.1, 0.8, -1, { h: 0.42 })
      sideSeat(c, -0.7, -1.52, s.bottomY + 0.1, -0.8, 1, { h: 0.42 })
      /* flat fenders over the wheels and running board */
      const flares: any = []
      ;[1, -1].forEach(function (sd) {
        ;[xf, xr].forEach(function (x) {
          flares.push(c.roundBox(1.0, 0.05, 0.14, 0.02, paint, x, 0.9, sd * (W / 2 + 0.04), { def: true }))
          ;[-1, 1].forEach(function (q) {
            flares.push(c.roundBox(0.05, 0.26, 0.14, 0.02, paint, x + q * 0.51, 0.77, sd * (W / 2 + 0.04), { rot: [0, 0, q * 0.5] }))
          })
        })
        c.roundBox(1.25, 0.04, 0.12, 0.01, OLIVE_STEEL, 0.0, 0.5, sd * (W / 2 - 0.02))
        star(c, -0.12, 0.84, sd * (W / 2 + 0.009), 0.15, sd > 0 ? '+z' : '-z', { ring: true })
        c.text(trl('texts.army'), 0.56, 0.1, 1.2, 1.06, sd * (W / 2 + 0.009), sd > 0 ? '+z' : '-z', { fg: '#dcdace', size: 0.7 })
        /* tow hooks */
        c.tube(
          [
            [F + 0.1, 0.62, sd * 0.52],
            [F + 0.2, 0.6, sd * 0.52],
            [F + 0.2, 0.5, sd * 0.52],
            [F + 0.12, 0.48, sd * 0.52],
          ],
          0.024,
          OLIVE_STEEL,
          { seg: 10, rs: 6 },
        )
        /* convoy (blackout) light on the fender */
        c.roundBox(0.08, 0.06, 0.1, 0.02, BLACK, F - 0.12, 1.22, sd * (W / 2 - 0.15))
        c.roundBox(0.01, 0.025, 0.06, 0.005, MT.amber, F - 0.08, 1.22, sd * (W / 2 - 0.15))
        /* side hood latches */
        c.roundBox(0.06, 0.08, 0.02, 0.01, BLACK, 1.1, 1.13, sd * (W / 2 + 0.006))
      })
      if (c.hood) {
        const hp = c.hood.piv
        star(c, 1.1 - hp.position.x, 1.215 - hp.position.y, 0, 0.19, '+y', { ring: true, parent: hp })
      }
      /* folding windshield frame with hinges and braces */
      const gh = s.gh
      ;[1, -1].forEach(function (sd) {
        c.roundBox(0.06, 0.08, 0.1, 0.02, OLIVE_STEEL, gh.fb + 0.02, gh.belt + 0.03, sd * 0.86)
        c.roundBox(0.05, 0.05, 0.08, 0.015, OLIVE_STEEL, gh.fb - 0.02, gh.belt + 0.03, sd * 0.6)
      })
      /* canvas top: roof bulging between the arches (4 cm rise), arches marked under the canvas, and cords */
      c.militaryCanvasTop = canvasTop(c, gh.rt + 0.04, gh.ft - 0.06, gh.roof + 0.045, kit.halfAt(gh.Wg, m.tumble, gh.roof) - 0.02, 0.5)
      /* spare in the middle of the rear and a can on the left */
      /* spare without the protruding studs: seen from the front they looked like a gear */
      const sp = militaryWheel(c, 0, 0, wr, ww, { noPart: true, lugs: false })
      sp.rotation.y = PI / 2
      sp.position.set(R - 0.15, 0.98, 0.18)
      c.wheels.pop()
      c.part('spare_wheel', trl('labels.spare_wheel'), sp, new V3(R - 0.15, 0.98, 0.18), 0.5)
      const gal = jerry(c, R - 0.1, 0.98, -0.6, '#3e4a2c', PI / 2)
      c.roundBox(0.06, 0.1, 0.62, 0.02, OLIVE_STEEL, R - 0.03, 0.98, 0.18)
      /* straight steel bumper with a winch */
      const pcF = c.roundBox(0.14, 0.18, W - 0.12, 0.03, OLIVE_STEEL, F + 0.07, 0.6, 0, { def: true })
      const winch = c.cylinder(0.075, 0.075, 0.36, BLACK, F + 0.1, 0.75, 0, 'z')
      antenna(c, R + 0.3, 1.2, -0.8, 1.9)
      /* zones: two-door jeep, no rear door; the rear side runs from the end of the door to the rear */
      const hw = W / 2,
        y0 = 0.4,
        y1 = 1.23
      c.zone('door_rear_left', false)
      c.zone('door_rear_right', false)
      c.zone('door_front_left', trl('labels.left_door'), [-0.62, gh.fb - 0.03, y0, y1, -hw - 0.25, -hw + 0.34], null, {
        type: 'door',
        side: -1,
        hinge: 'front',
        mirror: true,
        who: trl('who.the_driver'),
      })
      c.zone('door_front_right', trl('labels.right_door'), [-0.62, gh.fb - 0.03, y0, y1, hw - 0.34, hw + 0.25], null, {
        type: 'door',
        side: 1,
        hinge: 'front',
        mirror: true,
        who: trl('who.the_front_passenger'),
      })
      c.zone('side_rear_left', trl('labels.rear_left_side'), [R + 0.2, -0.62, y0, y1, -hw - 0.25, -hw + 0.34], null, {
        side: -1,
        fxKey: 'side_panel',
        who: trl('who.whoever_rides_in_the_back_on_the_left'),
      })
      c.zone('side_rear_right', trl('labels.rear_right_side'), [R + 0.2, -0.62, y0, y1, hw - 0.34, hw + 0.25], null, {
        side: 1,
        fxKey: 'side_panel',
        who: trl('who.whoever_rides_in_the_back_on_the_right'),
      })
      c.zone('roof', trl('labels.canvas_top_and_windshield'), null, c.militaryCanvasTop)
      c.zone('bumper_front', trl('labels.bumper_and_winch'), null, [pcF, winch])
      c.zone('spare_wheel', trl('labels.spare_wheel_and_jerry_can'), [R - 0.42, R + 0.05, 0.5, 1.45, -0.85, 0.65], [sp, gal], {
        type: 'part',
        fxKey: 'wheel',
        dir: 'front',
      })
      c.zone('lid', trl('labels.rear_lid'), [R - 0.15, R + 0.3, 0.6, 1.25, -hw + 0.12, hw - 0.12])
      void flares
      rollover(c)
      m.armor = function (c2: any) {
        marruaArmor(c2, s, F, R, W)
      }
    },
  )
  function marruaArmor(c: any, s: any, F: any, R: any, W: any) {
    const gh = s.gh,
      m = c.meta,
      q = m.frontQuad,
      paint = paintMat(c, OLIVE)
    /* folded top: the canvas goes away (roof, sides and plastic windows) and only the framed windshield remains */
    const hide = new Set(c.militaryCanvasTop || [])
    c.vehicle.children.forEach(function (o: any) {
      if (!o.isMesh) return
      const g = o.geometry
      if (!g.boundingSphere) g.computeBoundingSphere()
      const ce = g.boundingSphere.center.clone().applyMatrix4(o.matrix)
      if (o.material === CANVAS_TOP || o.material === MT.headliner) hide.add(o)
      else if (g.type === 'TubeGeometry' && o.material === MT.trim && ce.y > gh.belt && ce.x < gh.fb - 0.02) hide.add(o)
      else if (
        ce.y > gh.roof - 0.25 &&
        ce.x > gh.rt - 0.1 &&
        ce.x < gh.ft + 0.05 &&
        Math.abs(ce.z) < 0.95 &&
        !o.userData.glass &&
        !o.userData.antena
      )
        hide.add(o)
    })
    c.glass.forEach(function (gm: any) {
      if (gm.userData.glass && gm.userData.glass.label !== trl('labels.windshield')) hide.add(gm)
    })
    hide.forEach(function (o: any) {
      o.visible = false
      const i = c.deform.indexOf(o)
      if (i >= 0) c.deform.splice(i, 1)
    })
    c.parts = c.parts.filter(function (p: any) {
      return !(p.obj && hide.has(p.obj))
    })
    c.glass = c.glass.filter(function (gm: any) {
      return !hide.has(gm)
    })
    m.roof = null
    if (q) {
      const e = 0.035
      c.rod(new V3(q.t[0], q.t[1] + 0.02, -q.ht - e), new V3(q.t[0], q.t[1] + 0.02, q.ht + e), 0.03, paint)
      ;[1, -1].forEach(function (sd) {
        c.rod(new V3(q.b[0], q.b[1], sd * (q.hb + e)), new V3(q.t[0], q.t[1] + 0.02, sd * (q.ht + e)), 0.03, paint)
      })
    }
    /* canvas folded and tied behind the rear seat */
    c.cylinder(0.14, 0.14, 1.62, CANVAS_TOP, gh.rb + 0.16, gh.belt + 0.12, 0, 'z', { seg: 16 })
    ;[-0.5, 0, 0.5].forEach(function (z) {
      c.cylinder(0.147, 0.147, 0.04, BLACK, gh.rb + 0.16, gh.belt + 0.12, z, 'z', { seg: 16 })
    })
    /* tubular bush bar */
    ;[1, -1].forEach(function (sd) {
      c.tube(
        [
          [F + 0.08, 0.55, sd * 0.75],
          [F + 0.3, 0.6, sd * 0.75],
          [F + 0.32, 1.15, sd * 0.7],
          [F + 0.15, 1.3, sd * 0.6],
        ],
        0.04,
        OLIVE_STEEL,
        { seg: 20 },
      )
    })
    ;[0.75, 1.0, 1.2].forEach(function (y) {
      c.rod(new V3(F + 0.31, y, -0.75), new V3(F + 0.31, y, 0.75), 0.03, OLIVE_STEEL)
    })
    /* snorkel */
    c.tube(
      [
        [F - 0.6, 1.0, W / 2 + 0.06],
        [gh.fb + 0.05, 1.1, W / 2 + 0.08],
        [gh.fb - 0.05, 1.9, W / 2 + 0.06],
        [gh.fb + 0.1, 2.05, W / 2],
      ],
      0.055,
      BLACK,
      { seg: 24, rs: 10 },
    )
    c.roundBox(0.16, 0.14, 0.14, 0.04, BLACK, gh.fb + 0.14, 2.06, W / 2 - 0.02)
    /* roll bar with a pedestal machine gun (now open-top) */
    ;[1, -1].forEach(function (sd) {
      c.rod(new V3(-0.6, 1.2, sd * 0.86), new V3(-0.6, 2.25, sd * 0.8), 0.035, OLIVE_STEEL)
    })
    c.rod(new V3(-0.6, 2.25, -0.8), new V3(-0.6, 2.25, 0.8), 0.035, OLIVE_STEEL)
    c.rod(new V3(-0.6, 1.25, 0), new V3(-0.6, 2.35, 0), 0.04, OLIVE_STEEL)
    machineGun(c, -0.55, 2.42, 0, { len: 1.4 })
    c.roundBox(0.04, 0.32, 0.5, 0.02, OLIVE_STEEL, -0.32, 2.48, 0)
    /* luggage rack fixed to the roll bar and two uprights at the back, covered by the net */
    c.roundBox(0.9, 0.04, 1.3, 0.01, OLIVE_STEEL, -1.1, 1.95, 0)
    ;[1, -1].forEach(function (sd) {
      c.rod(new V3(-0.6, 2.0, sd * 0.62), new V3(R + 0.06, 1.95, sd * 0.62), 0.025, OLIVE_STEEL)
      c.rod(new V3(R + 0.06, 1.2, sd * 0.62), new V3(R + 0.06, 1.95, sd * 0.62), 0.025, OLIVE_STEEL)
    })
    c.roundBox(0.75, 0.3, 1.0, 0.06, CM('#4a4b3a', { roughness: 0.95 }), -1.1, 2.12, 0)
    camoNet(c, R + 0.02, -0.66, 2.27, 1.2, 0.32)
    /* cans on the rear sides */
    ;[1, -1].forEach(function (sd) {
      jerry(c, -1.3, 1.0, sd * (W / 2 + 0.1), sd > 0 ? SAND : '#3e4a2c', 0)
    })
    /* sandbags in front of the hood (the star stays free) */
    sandbags(c, -0.62, 0.62, 1.27, 1.55, 'z', 1)
    /* extra long-range lights */
    ;[1, -1].forEach(function (sd) {
      c.cylinder(0.09, 0.07, 0.12, BLACK, F + 0.3, 1.3, sd * 0.4, 'x')
      c.cylinder(0.075, 0.075, 0.01, MT.head, F + 0.37, 1.3, sd * 0.4, 'x')
    })
  }

  /* ================================================================ */
  /* Military truck (Volkswagen Worker 15.210 4x4 type, army VOP 5 t, tilting cab-over)
     Reference (the maker does not publish the sheet of the military version; measurements from memory and by photo proportions, marked as estimated):
     length about 7.40 m · width about 2.48 m (body 2.46 m, without mirrors) · height about 3.35 m at the canvas (cab about 3.05 m)
     wheelbase about 4.10 m · track about 1.95 m · tyre 14.00 R20 single (about 1.24 m) · front overhang about 1.35 m · rear about 1.95 m
     clearance about 0.35 m (axles), frame at about 0.98 m · MWM 6.10 TCA engine of 206 hp (confirmed on the web) · payload 5 t (confirmed)
     Signature traits:
     front: tall flat cab-over, one-piece nearly vertical windshield, band of black horizontal slats under the windshield,
     rectangular headlights set in the steel bumper, winch and hooks on the bumper, sun visor with amber lights
     side: door with a window that drops at the front, access steps behind the front wheel, large tubular-arm mirrors,
     diesel tank and battery box between the axles, single wheels with V studs at the back
     rear: low-sided cargo body with the tailgate down, double round taillights, hitch on the bumper
     top: rounded canvas over five arches, white star on the canvas, radio antenna behind the cab */
  function militaryCab(c: any, o: any) {
    const f = o.f,
      W = o.W,
      len = o.len,
      ry = o.roof,
      belt = o.belt,
      bot = o.bot,
      fl = o.floor,
      col = o.col
    const m = c.meta
    m.color = col
    m.kind = 'truck'
    const ws0 = [f + 0.02, belt - 0.03],
      ws1 = [f - 0.13, ry - 0.2]
    const items = [
      [f - len, bot, 0.06],
      [f - len - 0.01, ry - 0.08, 0.16],
      [ws1[0] - 0.32, ry, 0.18],
      [ws1[0], ws1[1], 0.1],
      [ws0[0], ws0[1], 0.1],
      [f + 0.04, bot + 0.3, 0.1],
      [f, bot, 0.05],
    ]
    const T = { belt: belt, top: ry + 0.03, k: 0.045 }
    function wsx(y: any) {
      return ws0[0] + ((ws1[0] - ws0[0]) * (y - ws0[1])) / (ws1[1] - ws0[1])
    }
    function l2(a: any, b: any, t: any) {
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    }
    const q = kit.quadDef(l2(ws0, ws1, 0.05), l2(ws0, ws1, 0.93), W, T, 'front', 0.05, { inset: 0.04, side: 0.11 })
    const yb = belt + 0.06,
      ty = ry - 0.27,
      xr = f - len * 0.62
    const poly = [
      [xr, yb],
      [wsx(yb) - 0.2, yb],
      [wsx(ty) - 0.2, ty],
      [xr, ty],
    ]
    kit.shell(c, {
      items: items,
      bottomY: bot,
      arches: [[o.ax, o.wr, o.wr + 0.08]],
      W: W,
      col: col,
      T: T,
      holes: [kit.holeSide(poly), kit.holeQuad(q)],
      archInner: W / 2 - o.ww - 0.16,
    })
    kit.glassQuad(c, q, lbl('windshield'))
    kit.sideWindows(c, [poly], W, T, function () {
      return lbl('door_window')
    })
    Object.assign(m, {
      width: W,
      front: f + 0.1,
      clearance: bot,
      belt: belt,
      top: ry + 0.03,
      bodyHeight: belt - bot,
      tumble: T,
      frontQuad: q,
      glasshouse: { fb: f, belt: belt + 0.03, Wg: W },
      cabRear: f - len,
    })
    const zi = W / 2 - 0.13,
      fab = CM('#3c3e30', { roughness: 0.9 }),
      trim = CM('#25261f', { roughness: 0.75 }),
      xd = wsx(belt)
    c.roundBox(len - 0.28, 0.04, zi * 2, 0.015, MT.carpet, f - len / 2 - 0.04, fl, 0)
    c.roundBox(0.62, 0.22, 0.5, 0.09, trim, f - len * 0.5, fl + 0.1, 0)
    kit.dashboard(c, {
      x: xd - 0.07,
      y: belt + 0.02,
      w: zi * 2,
      d: 0.48,
      h: Math.min(0.55, belt - fl - 0.08),
      drv: -zi * 0.52,
      mat: trim,
      top: fab,
      screen: false,
    })
    kit.steeringWheel(c, xd - 0.66, belt + 0.06, -zi * 0.52, { r: 0.23, tilt: 1.12, col: 0.5, mat: trim })
    const sx = Math.max(f - len + 0.62, xd - 1.08)
    kit.seat(c, sx, fl, -zi * 0.52, { w: 0.5, mat: fab, h: 0.44, back: 0.64, lean: 0.18 })
    kit.seat(c, sx, fl, zi * 0.42, { w: zi * 0.98, n: 2, mat: fab, h: 0.44, back: 0.6, lean: 0.18 })
    c.rod(new V3(sx + 0.55, fl, -0.05), new V3(sx + 0.5, fl + 0.48, -0.08), 0.014, OLIVE_STEEL)
    c.sphere(0.035, BLACK, sx + 0.5, fl + 0.5, -0.08)
    /* military radio on the dashboard and a rifle fixed behind the seat */
    c.roundBox(0.25, 0.16, 0.34, 0.02, CM('#3b402d', { roughness: 0.7 }), xd - 0.35, belt + 0.12, 0.1)
    for (let k = 0; k < 3; k++) c.cylinder(0.015, 0.015, 0.02, MT.gauge, xd - 0.47, belt + 0.14, 0.0 + k * 0.08, 'x')
    c.roundBox(0.03, ry - fl - 0.12, zi * 2, 0.01, trim, f - len + 0.07, (ry + fl) / 2, 0)
    c.roundBox(len - 0.45, 0.02, zi * 1.8, 0.01, MT.headliner, f - len / 2 - 0.05, ry - 0.07, 0).castShadow = false
    ;[1, -1].forEach(function (s) {
      c.roundBox(len * 0.55, belt - fl - 0.06, 0.03, 0.012, trim, f - len * 0.42, (belt + fl) / 2, s * (zi + 0.03))
    })
    const stepX = o.ax - o.wr - 0.24
    ;[1, -1].forEach(function (s) {
      const zs = s * (W / 2 + 0.003)
      c.roundBox(0.012, belt - bot + 0.55, 0.006, 0.003, MT.dark, xr - 0.06, (belt + bot) / 2 + 0.3, zs)
      c.roundBox(0.012, belt - bot + 0.35, 0.006, 0.003, MT.dark, f - 0.1, (belt + bot) / 2 + 0.15, zs)
      c.roundBox(0.16, 0.045, 0.03, 0.012, BLACK, xr + 0.2, belt - 0.12, s * (W / 2 + 0.012))
      ;[bot - 0.02, bot + 0.3].forEach(function (y, i) {
        c.roundBox(0.42, 0.04, 0.22, 0.01, OLIVE_STEEL, stepX, y, s * (W / 2 - 0.1 - i * 0.05))
      })
      c.rod(new V3(xr - 0.02, belt - 0.3, s * (W / 2 + 0.04)), new V3(xr - 0.02, belt + 0.45, s * (W / 2 + 0.04)), 0.016, BLACK)
      const mx = f - 0.2,
        mz = s * (W / 2 + 0.3)
      c.tube(
        [
          [mx - 0.05, belt + 0.55, s * (W / 2 - 0.02)],
          [mx + 0.1, belt + 0.66, s * (W / 2 + 0.16)],
          [mx + 0.13, belt + 0.5, mz],
        ],
        0.018,
        BLACK,
        { seg: 16, rs: 6 },
      )
      c.roundBox(0.07, 0.44, 0.2, 0.03, BLACK, mx + 0.13, belt + 0.3, mz)
      c.roundBox(0.01, 0.4, 0.17, 0.008, MT.steel, mx + 0.093, belt + 0.3, mz)
      star(c, f - len * 0.32, belt - 0.35, s * (W / 2 + 0.01), 0.17, s > 0 ? '+z' : '-z', { ring: true })
    })
    ;[-0.38, 0.38].forEach(function (z) {
      const y0 = belt + 0.05
      c.rod(new V3(wsx(y0) + 0.06, y0, z - 0.25), new V3(wsx(y0 + 0.5) + 0.06, y0 + 0.5, z + 0.05), 0.011, MT.trim)
    })
    /* front: wide black grille of horizontal slats, band below the windshield and sun visor */
    const fx = function (y: any) {
      return kit.profX(items, y, true)
    }
    /* the shell bulges about 5 cm ahead of the profile: panel, slats and band sit ahead of it */
    c.roundBox(0.04, 0.62, 1.7, 0.04, BLACK, fx(1.5) + 0.065, 1.5, 0)
    for (let sl = 0; sl < 5; sl++)
      c.roundBox(0.03, 0.05, 1.6, 0.02, CM('#34362f', { metalness: 0.3, roughness: 0.55 }), fx(1.5) + 0.09, 1.27 + sl * 0.12, 0)
    c.roundBox(0.04, 0.13, W * 0.88, 0.03, BLACK, fx(belt - 0.14) + 0.075, belt - 0.14, 0)
    c.text(trl('texts.army'), 0.9, 0.12, fx(belt - 0.14) + 0.1, belt - 0.14, 0, '+x', { fg: '#dcdace', size: 0.75 })
    /* sun visor leaning on the roof: thick rounded-corner brim with two brackets */
    c.roundBox(0.3, 0.09, W * 0.92, 0.04, c.paint(col), ws1[0] + 0.06, ry - 0.035, 0, { rot: [0, 0, -0.12], def: true })
    ;[-0.7, 0.7].forEach(function (z) {
      c.roundBox(0.16, 0.12, 0.05, 0.02, c.paint(col), ws1[0] - 0.04, ry - 0.07, z)
    })
    for (let k2 = -1; k2 <= 1; k2++) c.roundBox(0.05, 0.035, 0.08, 0.012, MT.amber, ws1[0] + 0.08, ry - 0.09, k2 * 0.35)
    /* own floor and rear wall: with the cab tilted, no open gap shows */
    const zf = W / 2 - o.ww - 0.2
    c.roundBox(len - 0.12, 0.05, zf * 2, 0.02, CM('#2e3127', { roughness: 0.9 }), f - len / 2, bot + 0.035, 0)
    c.roundBox(0.05, ry - bot - 0.2, W - 0.14, 0.03, c.paint(col), f - len + 0.035, (ry + bot) / 2 - 0.02, 0)
    return { items: items, q: q, wsx: wsx, xr: xr, T: T, fx: fx }
  }
  /* cargo body with sides, arches and canvas; the rear stays open and shows the seats */
  function canvasBody(c: any, o: any) {
    const x0 = o.x0,
      x1 = o.x1,
      y0 = o.y0,
      W = o.W,
      sideH = o.sideH || 0.62,
      bowH = o.bowH || 1.55,
      L = x0 - x1,
      cx = (x0 + x1) / 2
    const wood = paintMat(c, OLIVE2),
      m = c.meta
    const floor = c.roundBox(L, 0.1, W, 0.02, wood, cx, y0, 0, { def: true })
    c.roundBox(L - 0.1, 0.14, 0.2, 0.02, MT.trim, cx, y0 - 0.12, 0.45)
    c.roundBox(L - 0.1, 0.14, 0.2, 0.02, MT.trim, cx, y0 - 0.12, -0.45)
    for (let xs = x1 + 0.2; xs < x0; xs += 0.55) c.roundBox(0.08, 0.1, W - 0.05, 0.02, MT.trim, xs, y0 - 0.1, 0)
    const sides = []
    ;[1, -1].forEach(function (s) {
      const sd = c.roundBox(L, sideH, 0.06, 0.02, wood, cx, y0 + sideH / 2 + 0.05, s * (W / 2 - 0.03), { def: true })
      sides.push(sd)
      for (let x = x1 + 0.3; x < x0 - 0.1; x += 0.9)
        c.roundBox(0.06, sideH + 0.02, 0.03, 0.01, OLIVE_STEEL, x, y0 + sideH / 2 + 0.05, s * (W / 2 + 0.005))
      ;[0.15, 0.45].forEach(function (t) {
        c.roundBox(L, 0.03, 0.015, 0.006, CM('#3a3c2e', { roughness: 0.9 }), cx, y0 + 0.05 + sideH * t * 2, s * (W / 2 + 0.002))
      })
    })
    c.roundBox(0.06, sideH, W, 0.02, wood, x0 - 0.03, y0 + sideH / 2 + 0.05, 0, { def: true })
    /* tailgate down */
    const tg = c.roundBox(0.06, sideH * 0.7, W - 0.1, 0.02, wood, x1 - 0.02, y0 - sideH * 0.3, 0)
    tg.rotation.z = 0.08
    /* canvas: roof rounded by a loft along x, with marked arches */
    const top = y0 + sideH + bowH,
      yb = y0 + sideH + 0.05,
      nseg = 20,
      pos = [],
      idx = []
    const hw = W / 2 + 0.02,
      nx = 12
    for (let i = 0; i <= nx; i++) {
      const x = x1 + 0.02 + ((L - 0.04) * i) / nx
      for (let j = 0; j <= nseg; j++) {
        const a = (j / nseg) * PI,
          zz = -Math.cos(a) * hw,
          ww = Math.sin(a)
        let yy = yb + (top - yb - 0.25) * Math.min(1, ww * 3) + 0.25 * Math.pow(ww, 3)
        if (j === 0 || j === nseg) yy = yb - 0.05
        const sag = i % 2 === 1 ? -0.035 * ww : 0
        pos.push(x, yy + sag, zz * (1 - 0.06 * Math.pow(ww, 4)))
      }
    }
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nseg; j++) {
        const a0 = i * (nseg + 1) + j,
          b0 = a0 + nseg + 1
        idx.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    const tarp = c.add(g, CANVAS)
    c.deform.push(tarp)
    /* front wall of the canvas */
    const fs = new THREE.Shape()
    fs.moveTo(-hw, yb - 0.05)
    for (let j = 0; j <= nseg; j++) {
      const aa = (j / nseg) * PI,
        w2 = Math.sin(aa)
      fs.lineTo(
        -Math.cos(aa) * hw,
        j === 0 || j === nseg ? yb - 0.05 : yb + (top - yb - 0.25) * Math.min(1, w2 * 3) + 0.25 * Math.pow(w2, 3),
      )
    }
    const fg = new THREE.ShapeGeometry(fs)
    const fw = c.add(fg, CANVAS2, x0 - 0.02, 0, 0)
    fw.rotation.y = PI / 2
    /* rear flap rolled up at the top */
    c.cylinder(0.09, 0.09, W * 0.86, CANVAS2, x1 + 0.02, top - 0.32, 0, 'z')
    ;[-1, 1].forEach(function (s) {
      c.rod(new V3(x1 + 0.02, top - 0.3, s * W * 0.3), new V3(x1 + 0.02, top - 0.45, s * W * 0.3), 0.012, BLACK)
    })
    /* interior: floor, side seats facing the centre and arches */
    sideSeat(c, x0 - 0.2, x1 + 0.25, y0 + 0.05, W / 2 - 0.1, -1, { h: 0.45 })
    sideSeat(c, x0 - 0.2, x1 + 0.25, y0 + 0.05, -(W / 2 - 0.1), 1, { h: 0.45 })
    for (let bx = x1 + 0.1; bx <= x0 - 0.05; bx += (L - 0.15) / 4) {
      const pts = []
      for (let j = 0; j <= 12; j++) {
        const a3 = (j / 12) * PI,
          w3 = Math.sin(a3)
        pts.push([bx, yb + (top - yb - 0.25) * Math.min(1, w3 * 3) + 0.25 * Math.pow(w3, 3) - 0.04, -Math.cos(a3) * (hw - 0.04)])
      }
      c.tube(pts, 0.02, OLIVE_STEEL, { seg: 24, rs: 5 })
    }
    /* backpacks and an ammunition box on the floor */
    c.roundBox(0.5, 0.3, 0.35, 0.03, CM('#3f4a2c', { roughness: 0.6 }), x0 - 0.6, y0 + 0.2, 0.1)
    c.roundBox(0.35, 0.4, 0.25, 0.08, CM('#5a5a3e', { roughness: 0.95 }), x0 - 1.2, y0 + 0.25, -0.2)
    c.part('cargo', trl('labels.body_and_canvas'), tarp, new V3(cx, y0 + 1.0, 0), 1.8)
    m.roof = { x0: x1 + 0.3, x1: x0 - 0.3, w: W - 0.6, y: top }
    m.top = top
    m.bodyHeight = Math.max(m.bodyHeight || 0, 1.2)
    return { tarp: tarp, floor: floor, top: top }
  }
  fx.register(
    {
      key: 'troop_truck',
      group: GRP,
      name: trl('vehicles.troop_truck.name'),
      inspired: trl('vehicles.troop_truck.inspired'),
      category: trl('vehicles.troop_truck.category'),
      fuel: 'diesel',
      description: trl('vehicles.troop_truck.description'),
      mass: 9800,
      noise: 120,
      seats: trl('vehicles.troop_truck.seats'),
      capacity: trl('vehicles.troop_truck.capacity'),
      efficiency: trl('vehicles.troop_truck.efficiency'),
      range: trl('vehicles.troop_truck.range'),
      maxSpeed: 95,
      skill: trl('vehicles.troop_truck.skill'),
      hood: true,
    },
    function (c) {
      const f = 3.55,
        W = 2.36,
        len = 1.95,
        ax = 2.45,
        wr = 0.56,
        ww = 0.36,
        col = OLIVE,
        rax = -1.65
      c.meta.bodyKind = 'body'
      const n0 = c.vehicle.children.length
      militaryCab(c, { f: f, W: W, len: len, roof: 3.05, belt: 1.92, bot: 0.98, floor: 1.4, ax: ax, wr: wr, ww: ww, col: col })
      const cabObjs = c.vehicle.children.slice(n0)
      /* six-cylinder diesel engine between the rails, at frame height, just below the cab floor */
      const nB = c.vehicle.children.length,
        bc = new V3(f - len / 2 + 0.25, 1.0, 0)
      kit.engineBay(c, { x0: f - len + 0.12, x1: f - 0.45, zw: 0.42, floor: 0.8, top: 1.5, motor: 'diesel', col: '#3a3c32' })
      scale(c, nB, bc, 1.35)
      c.parts.forEach(function (p: any) {
        if (p.kind === 'engine' || p.kind === 'radiator') p.pos.sub(bc).multiplyScalar(1.35).add(bc)
      })
      /* the cab tilts past vertical: the engine is clear for whoever looks from the front and from above */
      tiltCab(c, cabObjs, new V3(f - 0.02, 1.0, 0), { len: len, open: 1.68 })
      if (c.meta.bay) {
        c.meta.bay.center.set(bc.x - 0.25, 2.25, -0.3)
        c.meta.bay.zw = 0.58
      }
      const m = c.meta
      /* steel bumper, rectangular and convoy headlights, winch */
      const by = 0.82
      m.frontBumper = c.roundBox(0.26, 0.34, W + 0.06, 0.05, OLIVE_STEEL, f + 0.12, by, 0, { def: true })
      c.part('bumper', trl('labels.front_bumper'), m.frontBumper, new V3(f + 0.2, by, 0), 1.1)
      ;[1, -1].forEach(function (s) {
        c.roundBox(0.06, 0.27, 0.53, 0.03, BLACK, f + 0.235, by + 0.03, s * (W / 2 - 0.36))
        kit.headlight(c, { style: 'rect', x: f + 0.25, y: by + 0.03, z: s * (W / 2 - 0.36), w: 0.45, h: 0.2, d: 0.07, side: s })
        /* silver reflector behind the lens: the headlight reads as one whole rectangle, not two dots */
        c.roundBox(
          0.004,
          0.17,
          0.42,
          0.002,
          CM('#aeb4b4', { metalness: 0.2, roughness: 0.35, emissive: new THREE.Color('#2a2c2a') }),
          f + 0.288,
          by + 0.03,
          s * (W / 2 - 0.36),
        )
        c.roundBox(0.06, 0.07, 0.1, 0.02, BLACK, f + 0.27, by + 0.03, s * (W / 2 - 0.08))
        c.roundBox(0.01, 0.025, 0.06, 0.005, MT.amber, f + 0.305, by + 0.03, s * (W / 2 - 0.08))
        c.tube(
          [
            [f + 0.25, by - 0.12, s * 0.45],
            [f + 0.38, by - 0.14, s * 0.45],
            [f + 0.38, by - 0.26, s * 0.45],
            [f + 0.28, by - 0.28, s * 0.45],
          ],
          0.03,
          BLACK,
          { seg: 10, rs: 6 },
        )
        militaryWheel(c, ax, s * (W / 2 - ww / 2 - 0.02), wr, ww, {
          label: s > 0 ? trl('labels.front_right_tire') : trl('labels.front_left_tire'),
        })
      })
      c.cylinder(0.1, 0.1, 0.5, BLACK, f + 0.3, by + 0.05, 0, 'z')
      c.text(trl('texts.eb_34_1720'), 0.5, 0.12, f + 0.26, by - 0.08, 0, '+x', { fg: '#e4e2d6', bg: '#24261d', size: 0.6 })
      /* chassis, rear axle, single wheels, tank, batteries, spare */
      ;[0.45, -0.45].forEach(function (z) {
        c.roundBox(f + 3.6, 0.26, 0.1, 0.02, MT.trim, (f - 3.85) / 2 + 0.1, 0.98, z)
      })
      ;[ax, rax].forEach(function (x) {
        c.cylinder(0.09, 0.09, W - 0.5, MT.trim, x, wr, 0, 'z')
        c.sphere(0.22, MT.trim, x, wr, 0, 1, 1, 0.9)
      })
      ;[1, -1].forEach(function (s) {
        militaryWheel(c, rax, s * (W / 2 - ww / 2 - 0.02), wr, ww, {
          label: s > 0 ? trl('labels.rear_right_tire') : trl('labels.rear_left_tire'),
        })
        c.roundBox(1.3, 0.05, ww + 0.1, 0.02, OLIVE_STEEL, rax, wr * 2 + 0.12, s * (W / 2 - ww / 2 - 0.02))
        ;[-1, 1].forEach(function (q) {
          c.roundBox(0.04, 0.35, ww + 0.1, 0.02, OLIVE_STEEL, rax + q * 0.66, wr * 2 - 0.05, s * (W / 2 - ww / 2 - 0.02), {
            rot: [0, 0, -q * 0.4],
          })
        })
        c.roundBox(0.02, 0.5, ww + 0.1, 0.01, MT.rubber, rax - 0.72, 0.6, s * (W / 2 - ww / 2))
        c.roundBox(1.9, 0.08, 0.04, 0.01, OLIVE_STEEL, 0.4, 0.7, s * (W / 2 - 0.05))
      })
      const tank = c.roundBox(0.9, 0.5, 0.55, 0.18, paintMat(c, OLIVE2), 0.65, 0.85, -(W / 2 - 0.36), { def: true })
      c.cylinder(0.06, 0.06, 0.04, MT.trim, 0.9, 1.12, -(W / 2 - 0.3))
      c.part('fuel_tank', trl('labels.diesel_tank'), tank, new V3(0.65, 0.85, -(W / 2 - 0.36)), 0.8)
      const bat = c.roundBox(0.6, 0.42, 0.45, 0.04, BLACK, 0.65, 0.85, W / 2 - 0.36)
      c.part('battery', trl('labels.battery_box'), bat, new V3(0.65, 0.85, W / 2 - 0.36), 0.7)
      const sp = militaryWheel(c, -0.4, 0, wr, ww, { noPart: true, y: 0.85 })
      sp.rotation.x = PI / 2
      sp.position.set(-0.45, 0.82, 0)
      c.wheels.pop()
      c.cylinder(0.13, 0.13, 0.5, CM('#2f312a', { metalness: 0.5 }), 1.5, 0.75, 0.75, 'x')
      c.tube(
        [
          [1.25, 0.75, 0.75],
          [1.0, 0.85, 1.05],
          [1.0, 3.2, 1.05],
        ],
        0.05,
        CM('#2f312a', { metalness: 0.5 }),
        { seg: 16 },
      )
      const rear = -3.52
      const body = canvasBody(c, { x0: f - len - 0.15, x1: rear, y0: 1.32, W: 2.46, sideH: 0.6, bowH: 1.45 })
      /* zones: the canvas and arches form the body roof; the tilting cab gets the roof and the sun visor */
      c.zone('canvas', trl('labels.canvas_and_body_bows'), [rear - 0.1, f - len - 0.1, 1.95, body.top + 0.2, -1.4, 1.4], [body.tarp], {
        type: 'roof',
        fxKey: 'roof',
        dir: 'up',
        who: trl('who.the_troops_in_the_body'),
      })
      c.zone('cab_roof', trl('labels.cab_roof'), [f - len - 0.1, f + 0.15, 2.75, 3.3, -W / 2 - 0.05, W / 2 + 0.05], null, {
        type: 'roof',
        fxKey: 'roof',
        dir: 'up',
        who: trl('who.the_driver'),
      })
      /* rear bumper, taillights and hitch */
      m.rearBumper = c.roundBox(0.14, 0.18, W - 0.2, 0.03, OLIVE_STEEL, rear + 0.08, 0.8, 0, { def: true })
      c.part('bumper', trl('labels.rear_bumper'), m.rearBumper, new V3(rear, 0.8, 0), 1.0)
      ;[1, -1].forEach(function (s) {
        kit.taillight(c, { style: 'round2', x: rear + 0.02, y: 1.05, z: s * (W / 2 - 0.3), w: 0.26, h: 0.12, d: 0.06, side: s })
      })
      c.cylinder(0.05, 0.05, 0.2, OLIVE_STEEL, rear - 0.05, 0.8, 0, 'x')
      c.text(trl('texts.eb_34_1720'), 0.5, 0.12, rear - 0.005, 1.0, 0, '-x', { fg: '#e4e2d6', bg: '#24261d', size: 0.6 })
      c.militaryCanvasStars = [1, -1].map(function (s) {
        return star(c, -1.0, 2.6, s * 1.255, 0.3, s > 0 ? '+z' : '-z', { ring: true, mat: CM('#d2d0c2', { roughness: 0.95 }) })
      })
      antenna(c, f - len + 0.1, 3.05, -0.9, 2.2)
      c.part('cab', trl('labels.cab'), null, new V3(f - len / 2, 2.2, W / 2), 1.0)
      m.front = f + 0.3
      m.rear = rear
      m.length = m.front - rear
      m.clearance = 0.6
      m.belt = 1.92
      m.bodyHeight = 1.4
      matteOlive(c, col)
      rollover(c)
      /* wrecked: besides the default, the cab front left corner and the body side are heavily dented */
      m.damage = function (c2: any) {
        kit.defaultDamage(c2)
        kit.impact(c2, new V3(f - 0.05, 2.15, -(W / 2 - 0.1)), new V3(0.55, -0.1, 0.83), 1.3)
        kit.impact(c2, new V3(-1.6, 1.75, -1.23), new V3(0, 0, 1), 1.25, { noStain: true })
        kit.impact(c2, new V3(-2.9, 2.9, -1.2), new V3(0, -0.35, 0.94), 1.1, { noStain: true })
      }
      m.armor = function (c2: any) {
        workerArmor(c2, f, len, W, rear, body.top)
      }
    },
  )
  function workerArmor(c: any, f: any, len: any, W: any, rear: any, top: any) {
    /* plates on the door and a grille over the windshield, machine gun on the cab ring, sandbags on the body */
    const m = c.meta,
      q = m.frontQuad
    if (q) {
      const off = 0.08
      for (let t = -1; t <= 1.0001; t += 0.125)
        c.rod(
          new V3(q.b[0] + q.n[0] * off, q.b[1] + q.n[1] * off, t * q.hb),
          new V3(q.t[0] + q.n[0] * off, q.t[1] + q.n[1] * off, t * q.ht),
          0.016,
          OLIVE_STEEL,
        )
    }
    ;[1, -1].forEach(function (s) {
      c.roundBox(1.1, 0.95, 0.05, 0.02, kit.steelMaterial, f - len * 0.55, 1.95, s * (W / 2 + 0.05), {
        rot: [0, 0, (kit.hash(s, 1, 2) - 0.5) * 0.06],
      })
      ;[-1, 1].forEach(function (u) {
        ;[-1, 1].forEach(function (v) {
          c.sphere(0.02, MT.steel, f - len * 0.55 + u * 0.48, 1.95 + v * 0.42, s * (W / 2 + 0.08))
        })
      })
      slat(c, rear + 0.1, f - len - 0.3, 1.45, 1.95, s * (W / 2 + 0.25))
    })
    c.cylinder(0.42, 0.42, 0.06, OLIVE_STEEL, f - len * 0.55, 3.12, 0.35, null, { seg: 24, open: false })
    machineGun(c, f - len * 0.55, 3.35, 0.35, { len: 1.5 })
    c.roundBox(0.04, 0.34, 0.55, 0.02, OLIVE_STEEL, f - len * 0.55 + 0.25, 3.42, 0.35)
    sandbags(c, rear + 0.3, f - len - 0.5, 1.98, 1.05, 'x', 1)
    sandbags(c, rear + 0.3, f - len - 0.5, 1.98, -1.05, 'x', 1)
    /* net over the canvas, following its rounding; the canvas stars are covered (hidden) */
    const yb = 1.32 + 0.6 + 0.05,
      hwc = 2.46 / 2 + 0.02
    const prof = function (z: any) {
      const t = Math.min(1, Math.abs(z) / hwc),
        sn = Math.sqrt(1 - t * t)
      return t >= 1 ? yb - 0.05 : yb + (top - yb - 0.25) * Math.min(1, sn * 3) + 0.25 * Math.pow(sn, 3)
    }
    camoNet(c, rear + 0.15, f - len - 0.2, top, 2.5, 0.75, prof)
    ;(c.militaryCanvasStars || []).forEach(function (st: any) {
      st.visible = false
      if (st.userData.ring) st.userData.ring.visible = false
    })
    ;[0.6, 0.2, -0.2].forEach(function (z, i) {
      jerry(c, rear - 0.05, 1.35, z, i % 2 ? SAND : '#3e4a2c', PI / 2)
    })
    ;[1, -1].forEach(function (s) {
      c.tube(
        [
          [f + 0.25, 0.7, s * 0.9],
          [f + 0.5, 0.75, s * 0.9],
          [f + 0.5, 1.6, s * 0.85],
          [f + 0.25, 1.75, s * 0.8],
        ],
        0.05,
        OLIVE_STEEL,
        { seg: 20 },
      )
    })
    ;[0.95, 1.25, 1.55].forEach(function (y) {
      c.rod(new V3(f + 0.5, y, -0.9), new V3(f + 0.5, y, 0.9), 0.035, OLIVE_STEEL)
    })
  }

  /* engine bay shifted to one side (front right engine of the armoured vehicles) */
  function offsetBay(c: any, o: any, dz: any) {
    const n0 = c.vehicle.children.length,
      np = c.parts.length
    kit.engineBay(c, o)
    c.vehicle.children.slice(n0).forEach(function (ob: any) {
      ob.position.z += dz
    })
    c.parts.slice(np).forEach(function (p: any) {
      p.pos.z += dz
    })
    if (c.meta.bay) c.meta.bay.center.z += dz
  }
  /* protected military headlight: box, headlight and bar grille */
  function guardedHeadlight(c: any, x: any, y: any, z: any, s: any, o?: any) {
    o = o || {}
    c.roundBox(0.16, 0.24, 0.32, 0.03, OLIVE_STEEL, x - 0.05, y, z)
    const L = kit.headlight(c, {
      style: o.style || 'rect',
      x: x + 0.02,
      y: y,
      z: z,
      w: o.w || 0.26,
      h: o.h || 0.15,
      d: 0.06,
      side: s,
      noPart: o.noPart,
    })
    for (let k = -1; k <= 1; k++)
      c.rod(new V3(x + 0.08, y - 0.12, z + k * 0.1), new V3(x + 0.08, y + 0.12, z + k * 0.1), 0.01, OLIVE_STEEL, { seg: 5 })
    c.rod(new V3(x + 0.08, y + 0.12, z - 0.15), new V3(x + 0.08, y + 0.12, z + 0.15), 0.012, OLIVE_STEEL, { seg: 5 })
    return L
  }
  /* generic remote weapon station */
  function weaponStation(c: any, x: any, y: any, z: any, o?: any) {
    o = o || {}
    const g = new THREE.Group()
    g.position.set(x, y, z)
    g.userData.rigid = true
    c.vehicle.add(g)
    const mat = o.mat || OLIVE_STEEL
    c.cylinder(0.42, 0.46, 0.12, mat, 0, 0.06, 0, null, { seg: 24, parent: g })
    c.roundBox(0.75, 0.32, 0.48, 0.06, mat, -0.05, 0.3, 0.05, { parent: g })
    c.roundBox(0.3, 0.26, 0.24, 0.04, mat, 0.08, 0.36, -0.42, { parent: g })
    c.roundBox(0.02, 0.1, 0.09, 0.01, MT.armorGlass, 0.235, 0.4, -0.47, { parent: g })
    c.roundBox(0.02, 0.07, 0.06, 0.01, MT.glassDark, 0.235, 0.4, -0.37, { parent: g })
    c.cylinder(0.05, 0.05, 0.8, BARREL, 0.65, 0.32, 0.12, 'x', { parent: g })
    c.cylinder(0.025, 0.025, 0.7, BARREL, 1.35, 0.32, 0.12, 'x', { parent: g })
    c.cylinder(0.04, 0.032, 0.1, BARREL, 1.72, 0.32, 0.12, 'x', { parent: g })
    c.roundBox(0.25, 0.22, 0.12, 0.03, CM('#46482f', { roughness: 0.7 }), -0.1, 0.25, 0.36, { parent: g })
    ;[-1, 1].forEach(function (s) {
      for (let k = 0; k < 3; k++)
        c.cylinder(0.04, 0.04, 0.18, BARREL, 0.05 + k * 0.1, 0.55, s * 0.18, 'x', { parent: g }).rotation.y = s * 0.3
    })
    return g
  }

  /* ================================================================ */
  /* 6x6 armoured carrier (VBTP-MR Guarani type, Iveco/Army)
     Reference (Tanks Encyclopedia, GlobalSecurity and the Army, confirmed on the web):
     length 6.91 m · width 2.70 m · height 2.34 m at the hull roof (3.33 m with the REMAX turret) · clearance 0.45 m
     wheelbase about 1.80 m + 1.50 m (3.30 m from the 1st to the 3rd axle, estimated from photos) · track about 2.26 m (estimated) · tyre 14.00 R20 (about 1.24 m)
     front overhang about 1.45 m · rear about 2.15 m (estimated) · 18.5 t · 3 + 8 · 600 km · 100 km/h · FPT Cursor 9 engine of 383 hp
     Signature traits:
     front: nearly flat upper plate (15 degrees) and a V lower bow; four protected headlights on the upper plate; trim vane (wave breaker)
     lying on the bow; driver at the front left with a hatch and three vision blocks
     side: six large wheels with cut-out wheel arches, vertical lower part and upper part sloping inward, stowage boxes,
     exhaust and NBC filter on the right side
     rear: ramp with an emergency exit door, protected taillights on the corners, two water propellers underneath
     top: engine grille on the right, commander and troop hatches, remote weapon station in the middle and two antenna bases at the back */
  fx.register(
    {
      key: 'apc_6x6',
      group: GRP,
      name: trl('vehicles.apc_6x6.name'),
      inspired: trl('vehicles.apc_6x6.inspired'),
      category: trl('vehicles.apc_6x6.category'),
      fuel: 'diesel',
      description: trl('vehicles.apc_6x6.description'),
      mass: 18500,
      noise: 140,
      seats: trl('vehicles.apc_6x6.seats'),
      capacity: trl('vehicles.apc_6x6.capacity'),
      efficiency: trl('vehicles.apc_6x6.efficiency'),
      range: trl('vehicles.apc_6x6.range'),
      maxSpeed: 100,
      skill: trl('vehicles.apc_6x6.skill'),
      hood: true,
    },
    function (c) {
      const col = OLIVE,
        W = 2.7,
        F = 3.45,
        R = -3.45,
        roofY = 2.31,
        belt = 1.3,
        wr = 0.58,
        ww = 0.4
      const axles = [2.0, 0.2, -1.3]
      /* plate profile: roof, slightly sloped engine deck, short well-sloped glacis, low bow and V skirt; vertical rear with the ramp */
      const GX = F - 0.7,
        GY = 1.92
      const items = [
        [R + 0.04, 0.6, 0.03],
        [R - 0.01, roofY - 0.04, 0.04],
        [1.15, roofY, 0.05],
        [GX, GY, 0.04],
        [F, 1.1, 0.03],
        [F - 0.45, 0.52, 0.04],
        [2.6, 0.46, 0.03],
      ]
      const deckY = function (x: any) {
        return roofY - ((x - 1.15) * (roofY - GY)) / (GX - 1.15)
      }
      const glacisX = function (y: any) {
        return GX + ((F - GX) * (GY - y)) / (GY - 1.02)
      }
      const arches = axles.map(function (x) {
        return [x, wr, wr + 0.14]
      })
      const hood0 = 1.6,
        hood1 = 2.75
      const holes = [
        kit.holeBox(
          [hood0, 0.9, 0.08],
          [hood1, 2.5, 1.05],
          function (n: any) {
            return n.y > 0.3
          },
          'hood',
        ),
        kit.holeBox([R - 0.3, 0.68, -0.8], [R + 0.3, 1.98, 0.8], function (n: any) {
          return n.x < -0.5
        }),
      ]
      const H = hull(c, {
        items: items,
        bottomY: 0.46,
        arches: arches,
        W: W,
        col: col,
        belt: belt,
        top: roofY + 0.03,
        k: 0.28,
        holes: holes,
        archInner: W / 2 - ww - 0.1,
        sub: 0.18,
        bev: 0.025,
      })
      const m = c.meta
      m.color = col
      m.kind = 'car'
      m.bullet = true
      Object.assign(m, {
        width: W,
        length: F - R,
        front: F,
        rear: R,
        clearance: 0.46,
        belt: belt,
        top: roofY + 0.03,
        bodyHeight: belt - 0.5,
        roof: { x0: R + 0.3, x1: 1.0, w: H.half(roofY) * 1.7, y: roofY + 0.03 },
      })
      /* engine cover (right side of the deck), hinge on the back edge */
      const hood = kit.makeHood(c, H.mesh.userData.cut.hood, { x0: hood0, col: col, open: 1.2 })
      if (hood) {
        const nB = c.vehicle.children.length
        offsetBay(
          c,
          {
            x0: hood0 + 0.05,
            x1: hood1 - 0.08,
            zw: 0.42,
            floor: 0.95,
            top: Math.max(1.45, hood.yMin - 0.04),
            motor: 'diesel',
            axle: null,
            col: '#3a3c32',
          },
          0.58,
        )
        const bcen = new V3((hood0 + hood1) / 2, 1.1, 0.58)
        scale(c, nB, bcen, 1.35)
        /* bay floor and walls in medium grey, so the engine shows */
        c.roundBox(hood1 - hood0 - 0.1, 0.02, 0.9, 0.01, BAY_LIGHT, bcen.x, 0.97, 0.58)
        ;[0.12, 1.04].forEach(function (z) {
          c.roundBox(hood1 - hood0 - 0.1, 0.55, 0.02, 0.01, BAY_LIGHT, bcen.x, 1.25, z)
        })
        if (c.meta.bay) {
          c.meta.bay.center.set(bcen.x + 0.1, 1.45, 0.58)
          c.meta.bay.zw = 0.78
        }
        for (let gx = hood0 + 0.2; gx < hood1 - 0.2; gx += 0.12)
          c.roundBox(0.05, 0.03, 0.62, 0.01, OLIVE_STEEL, gx - hood.piv.position.x, deckY(gx) + 0.035 - hood.piv.position.y, 0.58, {
            parent: hood.piv,
            rot: [0, 0, -Math.atan((roofY - GY) / (GX - 1.15))],
          })
        renameHood(c, trl('labels.engine_cover'))
      }
      /* wheels more exposed, bigger wheel arches */
      axles.forEach(function (x, i) {
        ;[1, -1].forEach(function (s) {
          militaryWheel(c, x, s * (W / 2 - ww / 2 - 0.02), wr, ww, {
            label: s > 0 ? trl('labels.axle_tire_n_right', { n: i + 1 }) : trl('labels.axle_tire_n_left', { n: i + 1 }),
          })
          c.cylinder(0.07, 0.07, 0.08, OLIVE_STEEL, x, wr, s * (W / 2 - 0.03), 'z')
        })
      })
      /* interior: floor, light lining, troop seats (4 per side), driver station, red combat light */
      const fl = 0.82,
        zi = 0.84
      c.roundBox(4.3, 0.04, 1.7, 0.01, CM('#3b3f35', { roughness: 0.95 }), -1.2, fl, 0)
      ;[1, -1].forEach(function (s) {
        c.roundBox(3.3, roofY - fl - 0.12, 0.03, 0.01, LINING, R + 0.1 + 1.65, (roofY + fl) / 2 - 0.02, s * (zi + 0.03))
      })
      c.roundBox(4.3, 0.02, zi * 2, 0.01, LINING, -1.2, roofY - 0.07, 0).castShadow = false
      c.roundBox(0.03, roofY - fl - 0.1, zi * 2, 0.01, LINING, -0.12, (roofY + fl) / 2, 0)
      sideSeat(c, -0.45, -2.65, fl, zi, -1, { h: 0.42, mat: TROOP_SEAT })
      sideSeat(c, -0.45, -2.65, fl, -zi, 1, { h: 0.42, mat: TROOP_SEAT })
      ;[-0.9, -2.2].forEach(function (x) {
        c.roundBox(0.3, 0.04, 0.1, 0.02, RED_LIGHT, x, roofY - 0.1, 0).castShadow = false
      })
      kit.seat(c, 0.95, fl + 0.1, -0.62, { w: 0.5, h: 0.42, back: 0.62, lean: 0.12, mat: CM('#2f3226', { roughness: 0.9 }) })
      kit.steeringWheel(c, 1.5, 1.42, -0.62, { r: 0.2, tilt: 0.9, col: 0.35 })
      c.roundBox(0.35, 0.3, 0.7, 0.04, CM('#25261f'), 1.85, 1.45, -0.6)
      kit.seat(c, 0.15, fl, 0.0, { w: 0.5, h: 0.45, back: 0.62, lean: 0.12, mat: CM('#2f3226', { roughness: 0.9 }) })
      for (let r2 = 0; r2 < 3; r2++)
        c.roundBox(0.25, 0.32, 0.25, 0.03, CM('#3f4a2c', { roughness: 0.6 }), -0.7 - r2 * 0.6, roofY - 0.35, 0.68)
      /* rear ramp closed (hinge at the base) with the emergency door open: the troops and seats show through the door */
      const ramp = new THREE.Group(),
        RL = 1.36,
        rmat = paintMat(c, col)
      ramp.position.set(R - 0.05, 0.62, 0)
      ramp.rotation.z = -PI / 2
      ramp.userData.rigid = true
      c.vehicle.add(ramp)
      const dz0 = 0.02,
        dz1 = 0.64,
        dx0 = -0.14,
        dx1 = -1.2
      c.roundBox(RL, 0.09, 0.8, 0.025, rmat, -RL / 2, -0.045, -0.38 + dz0 / 2, { parent: ramp })
      c.roundBox(RL, 0.09, 0.78 - dz1, 0.02, rmat, -RL / 2, -0.045, (dz1 + 0.78) / 2, { parent: ramp })
      c.roundBox(-dx0, 0.09, dz1 - dz0, 0.02, rmat, dx0 / 2, -0.045, (dz0 + dz1) / 2, { parent: ramp })
      c.roundBox(RL + dx1, 0.09, dz1 - dz0, 0.02, rmat, (dx1 - RL) / 2, -0.045, (dz0 + dz1) / 2, { parent: ramp })
      /* ramp reinforcements and latches on the outside */
      ;[-0.6, -0.2].forEach(function (z) {
        c.roundBox(RL - 0.1, 0.03, 0.06, 0.01, OLIVE_STEEL, -RL / 2, -0.1, z, { parent: ramp })
      })
      ;[0.7].forEach(function (z) {
        c.roundBox(0.14, 0.04, 0.05, 0.01, OLIVE_STEEL, -RL + 0.1, -0.1, z, { parent: ramp })
      })
      /* door hinged on the right side, open outward */
      const door = new THREE.Group()
      door.position.set(0, -0.09, dz1)
      door.rotation.x = -1.75
      ramp.add(door)
      c.roundBox(dx0 - dx1 - 0.02, 0.07, dz1 - dz0 - 0.02, 0.02, rmat, (dx0 + dx1) / 2, 0.035, -(dz1 - dz0) / 2, { parent: door })
      c.roundBox(0.3, 0.02, 0.18, 0.01, MT.armorGlass, (dx0 + dx1) / 2 - 0.3, -0.005, -(dz1 - dz0) / 2, { parent: door })
      c.roundBox(0.06, 0.05, 0.12, 0.015, OLIVE_STEEL, (dx0 + dx1) / 2, -0.01, -(dz1 - dz0) + 0.08, { parent: door })
      ;[dx0 - 0.12, dx1 + 0.12].forEach(function (x) {
        c.cylinder(0.025, 0.025, 0.1, OLIVE_STEEL, x, 0.0, 0, 'x', { parent: ramp })
      })
      /* door sill and step inside */
      c.roundBox(0.25, 0.05, 0.62, 0.01, OLIVE_STEEL, R + 0.15, 0.76, (dz0 + dz1) / 2)
      c.cylinder(0.05, 0.05, 1.5, OLIVE_STEEL, R - 0.04, 0.62, 0, 'z')
      c.part('ramp', trl('labels.rear_ramp'), ramp, new V3(R - 0.05, 1.2, 0), 0.9)
      /* roof: hatches, periscopes, weapon station */
      hatch(c, 1.0, roofY, -0.62, 0.3, 0, OLIVE_STEEL)
      ;[-0.85, -0.62, -0.39].forEach(function (z, i) {
        periscope(c, 1.32, deckY(1.32) + 0.06, z, 0.16, i === 1 ? lbl('driver_periscope') : null)
      })
      const est = weaponStation(c, 0.15, roofY + 0.02, 0.1)
      rigid(c, [est])
      hatch(c, -1.6, roofY, -0.4, 0.28, -1.6, OLIVE_STEEL)
      hatch(c, -1.6, roofY, 0.45, 0.28, 0, OLIVE_STEEL)
      hatch(c, -2.6, roofY, 0.0, 0.32, 0, OLIVE_STEEL, { hingeX: 1 })
      ;[-0.6, 0.6].forEach(function (z) {
        periscope(c, -0.7, roofY + 0.06, z, 0.14, z < 0 ? lbl('left_vision_block') : lbl('right_vision_block'), {
          rot: z < 0 ? PI / 2 : -PI / 2,
        })
      })
      /* front: protected headlights on the glacis, trim vane lying on the glacis, hooks */
      ;[1, -1].forEach(function (s) {
        guardedHeadlight(c, glacisX(1.5) + 0.03, 1.5, s * 1.0, s)
        guardedHeadlight(c, glacisX(1.5) + 0.03, 1.5, s * 0.66, s, { noPart: true })
        c.roundBox(0.03, 0.1, 0.14, 0.01, BLACK, glacisX(1.5) + 0.06, 1.5, s * 0.33)
      })
      const tv = c.roundBox(0.05, 0.5, 2.1, 0.02, OLIVE_STEEL, glacisX(1.5) + 0.045, 1.53, 0, {
        rot: [0, 0, Math.atan2(F - GX, GY - 1.02)],
      })
      void tv
      ;[1, -1].forEach(function (s) {
        c.tube(
          [
            [F - 0.25, 0.7, s * 0.6],
            [F - 0.05, 0.68, s * 0.6],
            [F - 0.05, 0.55, s * 0.6],
            [F - 0.2, 0.52, s * 0.6],
          ],
          0.035,
          OLIVE_STEEL,
          { seg: 10, rs: 6 },
        )
      })
      const bF = c.roundBox(0.1, 0.16, 2.2, 0.03, OLIVE_STEEL, F - 0.06, 0.94, 0, { def: true })
      m.frontBumper = bF
      c.part('bumper', trl('labels.front_guard'), bF, new V3(F, 0.94, 0), 1.0)
      /* rear: protected taillights, water propellers, plate */
      ;[1, -1].forEach(function (s) {
        c.roundBox(0.12, 0.2, 0.26, 0.03, OLIVE_STEEL, R - 0.06, 1.75, s * 1.02)
        kit.taillight(c, { style: 'round2', x: R - 0.1, y: 1.75, z: s * 1.02, w: 0.2, h: 0.09, d: 0.05, side: s })
        c.cylinder(0.24, 0.24, 0.28, OLIVE_STEEL, R + 0.1, 0.62, s * 1.0, 'x', { open: true })
        c.cylinder(0.05, 0.05, 0.3, BARREL, R + 0.1, 0.62, s * 1.0, 'x')
        c.part(
          'propeller',
          s > 0 ? trl('labels.right_water_propeller') : trl('labels.left_water_propeller'),
          null,
          new V3(R, 0.62, s * 1.0),
          0.5,
        )
      })
      c.text(trl('texts.eb_1290_301'), 0.4, 0.1, R - 0.03, 1.42, 1.04, '-x', { fg: '#e4e2d6', bg: '#24261d', size: 0.6 })
      /* sides: stowage boxes, star, band, exhaust */
      ;[1, -1].forEach(function (s) {
        c.roundBox(1.1, 0.34, 0.12, 0.03, paintMat(c, OLIVE2), -2.4, 1.72, s * (H.half(1.72) + 0.04), { rot: [-s * 0.37, 0, 0] })
        c.roundBox(0.9, 0.28, 0.1, 0.03, paintMat(c, OLIVE2), -0.9, 1.7, s * (H.half(1.7) + 0.035), { rot: [-s * 0.37, 0, 0] })
        star(c, 1.25, 0.98, s * (W / 2 + 0.03), 0.2, s > 0 ? '+z' : '-z', { ring: true })
        c.roundBox(4.4, 0.06, 0.05, 0.02, OLIVE_STEEL, -0.4, 1.42, s * (H.half(1.42) + 0.02))
        c.text(trl('texts.army'), 0.9, 0.14, -2.55, 1.0, s * (W / 2 + 0.03), s > 0 ? '+z' : '-z', { fg: '#dcdace', size: 0.7 })
      })
      c.roundBox(0.5, 0.12, 0.22, 0.04, BARREL, 2.0, 1.62, H.half(1.62) - 0.02, { rot: [-0.37, 0, 0] })
      antenna(c, -3.0, roofY, -0.92, 2.2)
      antenna(c, -3.0, roofY, 0.92, 1.6)
      /* parts for localised damage */
      c.part('fuel_tank', trl('labels.diesel_tank'), null, new V3(-0.2, 0.75, -0.9), 0.9)
      c.part('troops', trl('labels.troop_compartment'), null, new V3(-1.6, roofY, 0), 1.3)
      c.part('station', trl('labels.weapon_station'), null, new V3(0.15, roofY + 0.35, 0.1), 0.6)
      c.part('battery', trl('labels.batteries'), null, new V3(2.5, 1.0, -0.6), 0.6)
      c.part('hull', trl('labels.side_armor'), null, new V3(-1.0, 1.3, W / 2), 1.0, {
        onHit: function (c2: any, pt: any, f: any, dir: any, p: any) {
          kit.burst(c2, 'spark', c2.toEffects(p || pt.pos), 20, { speed: 3 })
        },
      })
      /* zones: the automatic weapon is the barrel of the remote station; the ramp is the rear that opens; periscopes in place of the windshield */
      c.zone('weapon', trl('labels.remote_weapon_station'), [-0.4, 2.1, roofY - 0.05, roofY + 0.75, -0.65, 0.75], [est], {
        type: 'part',
        fxKey: 'weapon',
        dir: 'up',
        anchor: [0.15, roofY + 0.05, 0.1],
      })
      c.zone('ramp', trl('labels.ramp_and_rear_door'), [R - 0.2, R + 0.25, 0.55, 2.05, -0.9, 0.9], [ramp], {
        type: 'lid',
        fxKey: 'lid',
        hinge: 'down',
        dir: 'front',
        who: trl('who.the_troops'),
      })
      c.zone('armor_rear', trl('labels.rear_armor_corners_and_taillights'), [
        R - 0.25,
        R + 0.5,
        0.4,
        roofY + 0.1,
        -W / 2 - 0.2,
        W / 2 + 0.2,
      ])
      c.zone('glass_front', trl('labels.driver_vision_blocks'))
      c.zone('glass_rear', trl('labels.troop_vision_blocks'))
      c.zone('turret', trl('labels.roof_and_hatches'))
      c.zone(
        'engine_cover',
        trl('labels.engine_grille_and_cover'),
        [hood0 - 0.05, hood1 + 0.05, 1.7, roofY + 0.2, 0.05, 1.15],
        hood ? [hood.piv] : null,
        { type: 'hood', fxKey: 'hood', dir: 'up' },
      )
      matteOlive(c, col)
      m.damage = armoredCrashDamage
      armor(c, 0.4)
      /* rolled over: the weapon station is torn off and falls to the side, the hull settles on the roof */
      rollover(c, {
        onFlip: function (c2: any) {
          est.rotation.x = (c2.militaryRollSide || 1) * 1.35
          est.position.y -= 0.12
        },
      })
      m.armor = function (c2: any) {
        guaraniMod(c2, F, R, W, roofY, H)
      }
    },
  )
  function guaraniMod(c: any, F: any, R: any, W: any, roofY: any, H: any) {
    ;[1, -1].forEach(function (s) {
      slat(c, R + 0.1, F - 1.1, 0.95, 1.8, s * (W / 2 + 0.3))
    })
    camoNet(c, R + 0.2, -1.95, roofY + 0.06, 2 * H.half(roofY), 0.45)
    sandbags(c, -0.5, 0.6, roofY + 0.1, -0.85, 'x', 2)
    c.roundBox(0.06, 0.5, 0.9, 0.02, OLIVE_STEEL, 0.75, roofY + 0.55, 0.1)
    ;[0.6, 0.25].forEach(function (z, i) {
      jerry(c, -0.3, roofY + 0.25, z + 0.3, i ? SAND : '#3e4a2c', 0)
    })
    const sp = militaryWheel(c, 0, 0, 0.6, 0.4, { noPart: true })
    sp.rotation.x = PI / 2
    sp.position.set(-1.0, roofY + 0.25, 0.45)
    c.wheels.pop()
  }

  /* turret: plan [x, z] extruded upward (h), with sloped sides (k = how much the top shrinks) */
  function buildTurret(c: any, o: any) {
    const sh = new THREE.Shape(),
      pl = o.plan
    pl.forEach(function (p: any, i: any) {
      if (i === 0) sh.moveTo(p[0], -p[1])
      else sh.lineTo(p[0], -p[1])
    })
    const bev = o.bev == null ? 0.05 : o.bev
    let geo = new THREE.ExtrudeGeometry(sh, {
      depth: o.h - 2 * bev,
      bevelEnabled: true,
      bevelThickness: bev,
      bevelSize: bev,
      bevelSegments: 3,
      curveSegments: 6,
    })
    geo.rotateX(-PI / 2)
    geo.translate(0, bev, 0)
    geo = G.subdivide(geo, o.sub || 0.25)
    const p = geo.attributes.position,
      cx = o.cx || 0
    for (let i = 0; i < p.count; i++) {
      const t = Math.max(0, Math.min(1, p.getY(i) / o.h)),
        k = 1 - (o.k || 0) * t
      p.setX(i, cx + (p.getX(i) - cx) * (1 - (o.kx || 0) * t))
      p.setZ(i, p.getZ(i) * k)
    }
    G.crease(geo, o.crease || 40)
    const m = c.add(geo, o.mat, o.x || 0, o.y, o.z || 0)
    c.deform.push(m)
    return m
  }
  /* cannon: tube along +x from x0, with a thermal sleeve (rings), optional fume extractor and muzzle brake */
  function cannon(c: any, x0: any, y: any, z: any, len: any, r: any, o: any) {
    o = o || {}
    const mat = o.mat || paintMat(c, OLIVE)
    const g = new THREE.Group()
    g.position.set(x0, y, z)
    g.userData.rigid = true
    c.vehicle.add(g)
    c.cylinder(r * 1.05, r * 1.15, len, mat, len / 2, 0, 0, 'x', { parent: g, seg: 18 })
    if (o.sleeve)
      for (let k = 1; k < 5; k++)
        c.cylinder(r * 1.22, r * 1.22, 0.05, CM('#30342a', { roughness: 0.8 }), (len * k) / 5.4, 0, 0, 'x', { parent: g, seg: 18 })
    if (o.fume) c.cylinder(r * 1.6, r * 1.6, 0.6, mat, len * o.fume, 0, 0, 'x', { parent: g, seg: 18 })
    if (o.fume)
      [0.3, -0.3].forEach(function (d) {
        c.cylinder(r * 1.15, r * 1.6, 0.12, mat, len * o.fume + d, 0, 0, 'x', { parent: g, seg: 18 }).rotation.z = d > 0 ? -PI / 2 : PI / 2
      })
    if (o.brake) {
      c.cylinder(r * 1.6, r * 1.6, 0.32, mat, len + 0.12, 0, 0, 'x', { parent: g, seg: 16 })
      ;[1, -1].forEach(function (s) {
        c.roundBox(0.08, r * 2.4, 0.03, 0.01, MT.dark, len + 0.1, 0, s * r * 1.62, { parent: g })
      })
    }
    c.cylinder(r * 0.62, r * 0.62, 0.02, MT.dark, len + (o.brake ? 0.29 : 0.005), 0, 0, 'x', { parent: g, seg: 14 })
    c.part('cannon', trl('labels.cannon'), g, new V3(x0 + len * 0.6, y, z), 0.8)
    return g
  }
  function smokeLauncher(c: any, x: any, y: any, z: any, s: any, n: any) {
    for (let i = 0; i < n; i++) {
      const t = c.cylinder(0.045, 0.045, 0.22, BARREL, x + (i % 2) * 0.1, y + Math.floor(i / 2) * 0.1, z, 'x')
      t.rotation.y = -s * 0.5
      t.rotation.z = -PI / 2 + 0.4
    }
  }

  /* ================================================================ */
  /* 6x6 armoured car (Engesa EE-9 Cascavel type, M4/M7, ET-90 turret with a 90 mm EC-90 gun)
     Reference (Wikipedia and Tanks Encyclopedia, confirmed on the web):
     hull length 5.25 m · 6.29 m with the gun · width 2.59 m · height 2.60 m at the turret roof · clearance 0.375 to 0.50 m
     wheelbase 3.05 m (front axle to the centre of the Boomerang bogie) · bogie wheels about 1.30 m apart (estimated)
     track about 2.27 m (estimated) · tyre 11.00-20 run-flat (about 1.08 m) · front overhang about 1.0 m · rear about 0.5 m · 12 to 13.4 t · 360 L · 750 km
     Signature traits:
     front: wedge bow (V seen from above) with a well-sloped upper plate; headlights and convoy lights on the bow corners with a guard;
     driver vision blocks on the edge of the upper plate
     side: three wheels with the rear two on the Boomerang walking beam, flat fenders with stowage over the rear wheels,
     upper sides sloping inward
     rear: sloped rear plate with protected taillights on the corners, exhaust high on the right
     top: wide low ET-90 turret with sloped faces and a protruding mantlet, 90 mm gun with a muzzle brake,
     smoke launchers on both sides, commander and gunner hatches, basket at the back and engine cover grille at the rear */
  fx.register(
    {
      key: 'armored_car_6x6',
      group: GRP,
      name: trl('vehicles.armored_car_6x6.name'),
      inspired: trl('vehicles.armored_car_6x6.inspired'),
      category: trl('vehicles.armored_car_6x6.category'),
      fuel: 'diesel',
      description: trl('vehicles.armored_car_6x6.description'),
      mass: 13400,
      noise: 120,
      seats: trl('vehicles.armored_car_6x6.seats'),
      capacity: trl('vehicles.armored_car_6x6.capacity'),
      efficiency: trl('vehicles.armored_car_6x6.efficiency'),
      range: trl('vehicles.armored_car_6x6.range'),
      maxSpeed: 100,
      skill: trl('vehicles.armored_car_6x6.skill'),
      hood: true,
    },
    function (c) {
      const col = '#4a5034',
        W = 2.59,
        F = 2.62,
        R = -2.6,
        roofY = 1.78,
        belt = 1.14,
        wr = 0.5,
        ww = 0.32
      const axles = [1.6, -0.8, -2.1]
      const items = [
        [R + 0.06, 0.62, 0.06],
        [R - 0.04, 1.48, 0.06],
        [R + 0.25, roofY, 0.08],
        [1.3, roofY, 0.1],
        [F - 0.04, 1.02, 0.06],
        [F, 0.9, 0.05],
        [2.05, 0.46, 0.06],
        [-1.4, 0.44, 0.04],
      ]
      const arches = axles.map(function (x) {
        return [x, wr, wr + 0.09]
      })
      const dx0 = -2.5,
        dx1 = -1.7
      const H = hull(c, {
        items: items,
        bottomY: 0.44,
        arches: arches,
        W: W,
        col: col,
        belt: belt,
        top: roofY + 0.06,
        k: 0.24,
        holes: [kit.holeTop(dx0, dx1, 0.62, roofY - 0.2, 'hood')],
        archInner: W / 2 - ww - 0.1,
        sub: 0.18,
      })
      /* wedge bow seen from above: the hull front tapers into a V from the front axle */
      ;(function () {
        const g = H.mesh.geometry,
          p = g.attributes.position,
          xs = 2.0,
          ks = 0.3
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i)
          if (x > xs) p.setZ(i, p.getZ(i) * (1 - ks * Math.min(1, (x - xs) / (F + 0.05 - xs))))
        }
        p.needsUpdate = true
        G.crease(g, 42)
        g.computeBoundingSphere()
        g.computeBoundingBox()
      })()
      const m = c.meta
      m.color = col
      m.kind = 'car'
      m.bullet = true
      const tx = -0.25,
        ty = roofY + 0.04,
        tTop = ty + 0.06 + 0.72
      /* the rollover uses the full height (with the turret) */
      Object.assign(m, {
        width: W,
        length: F - R,
        front: F,
        rear: R,
        clearance: 0.44,
        belt: belt,
        top: tTop,
        bodyHeight: belt - 0.44,
        roof: { x0: tx - 1.1, x1: tx + 0.7, w: 1.5, y: tTop },
      })
      /* rear engine cover: hinge on the back edge, opens backward past vertical (about 110 degrees) */
      const hood = kit.makeHood(c, H.mesh.userData.cut.hood, { col: col, open: 1.95 })
      if (hood) {
        const nB = c.vehicle.children.length,
          bcen = new V3((dx0 + dx1) / 2, 1.1, 0)
        mirroredBay(
          c,
          { x0: dx0 + 0.04, x1: dx1 - 0.04, zw: 0.58, floor: 1.0, top: roofY - 0.05, motor: 'diesel', col: '#3a3c32' },
          (dx0 + dx1) / 2,
        )
        scale(c, nB, bcen, 1.4)
        c.roundBox(dx1 - dx0 - 0.08, 0.02, 1.25, 0.01, BAY_LIGHT, bcen.x, 1.0, 0)
        ;[1, -1].forEach(function (sd) {
          c.roundBox(dx1 - dx0 - 0.08, 0.6, 0.02, 0.01, BAY_LIGHT, bcen.x, 1.32, sd * 0.64)
        })
        /* the hood camera comes from the front right and from above: aims at the rear half of the bay, which the turret does not cover */
        if (c.meta.bay) {
          c.meta.bay.center.set(dx0 + 0.1, 1.5, 1.05)
          c.meta.bay.zw = 0.85
        }
        for (let gx = dx0 + 0.12; gx < dx1 - 0.1; gx += 0.1)
          c.roundBox(0.04, 0.025, 1.0, 0.01, MT.dark, gx - hood.piv.position.x, roofY + 0.07 - hood.piv.position.y, 0, { parent: hood.piv })
        renameHood(c, trl('labels.engine_cover'))
      }
      /* wheels: front axle and rear bogie with walking beam */
      axles.forEach(function (x, i) {
        ;[1, -1].forEach(function (s) {
          militaryWheel(c, x, s * (W / 2 - ww / 2), wr, ww, {
            label: s > 0 ? trl('labels.axle_tire_n_right', { n: i + 1 }) : trl('labels.axle_tire_n_left', { n: i + 1 }),
          })
        })
      })
      ;[1, -1].forEach(function (s) {
        c.roundBox(1.6, 0.16, 0.12, 0.04, OLIVE_STEEL, (axles[1] + axles[2]) / 2, wr, s * (W / 2 - ww - 0.1))
        c.cylinder(0.12, 0.12, 0.2, OLIVE_STEEL, (axles[1] + axles[2]) / 2, wr, s * (W / 2 - ww - 0.1), 'z')
        /* fenders and stowage boxes over the wheels */
        c.roundBox(1.0, 0.05, 0.32, 0.02, paintMat(c, col), axles[0], 1.12, s * (W / 2 - 0.16), { def: true })
        c.roundBox(2.35, 0.05, 0.32, 0.02, paintMat(c, col), (axles[1] + axles[2]) / 2, 1.12, s * (W / 2 - 0.16), { def: true })
        c.roundBox(1.2, 0.26, 0.28, 0.03, paintMat(c, OLIVE2), -1.45, 1.28, s * (W / 2 - 0.17))
        /* recesses for cans in the bogie stowage */
        ;[-0.95, -1.95].forEach(function (x) {
          c.roundBox(0.3, 0.2, 0.02, 0.01, MT.dark, x, 1.28, s * (W / 2 - 0.025))
        })
        star(c, 0.72, 0.86, s * (H.half(0.86) + 0.012), 0.17, s > 0 ? '+z' : '-z', { ring: true })
        c.text(trl('texts.army'), 0.62, 0.11, 0.05, 0.88, s * (H.half(0.88) + 0.012), s > 0 ? '+z' : '-z', { fg: '#dcdace', size: 0.7 })
        /* protected headlights on the glacis and convoy light */
        guardedHeadlight(c, 2.6, 0.93, s * 0.72, s)
        c.roundBox(0.06, 0.05, 0.08, 0.015, MT.amber, 2.62, 1.09, s * 0.72)
        c.text(trl('texts.eb_3460_21'), 0.42, 0.1, R - 0.015, 1.15, s * 0.55, '-x', { fg: '#e4e2d6', bg: '#24261d', size: 0.6 })
        c.roundBox(0.1, 0.16, 0.22, 0.03, OLIVE_STEEL, R - 0.02, 1.32, s * 0.95)
        kit.taillight(c, { style: 'round2', x: R - 0.07, y: 1.32, z: s * 0.95, w: 0.18, h: 0.08, d: 0.05, side: s })
        c.tube(
          [
            [F - 0.35, 0.7, s * 0.55],
            [F - 0.1, 0.72, s * 0.55],
            [F - 0.12, 0.58, s * 0.55],
          ],
          0.03,
          OLIVE_STEEL,
          { seg: 10, rs: 6 },
        )
      })
      const bF = c.roundBox(0.08, 0.12, 1.6, 0.03, OLIVE_STEEL, F - 0.02, 0.9, 0, { def: true })
      c.part('armor', trl('labels.bow_plate'), bF, new V3(F, 0.9, 0), 1.0)
      /* driver: open hatch and periscopes on the glacis */
      /* closed: open upright, the lid became a big disc beside the gun and changed the silhouette */
      hatch(c, 1.1, roofY, -0.55, 0.27, 0, OLIVE_STEEL, { hingeX: -1 })
      ;[-0.75, -0.55, -0.35].forEach(function (z, i) {
        periscope(c, 1.42, roofY - 0.02, z, 0.14, i === 1 ? lbl('driver_periscope') : null)
      })
      const fl = 0.72,
        fab = CM('#2f3226', { roughness: 0.9 })
      c.roundBox(3.0, 0.04, 1.6, 0.01, MT.carpet, 0.2, fl, 0)
      kit.seat(c, 1.0, fl + 0.3, -0.55, { w: 0.46, h: 0.4, back: 0.5, lean: 0.25, mat: fab })
      kit.steeringWheel(c, 1.5, 1.38, -0.55, { r: 0.18, tilt: 0.9, col: 0.3 })
      c.roundBox(0.3, 0.26, 0.6, 0.04, CM('#25261f'), 1.75, 1.35, -0.5)
      /* turret with a 90 mm gun: everything from here to the end of the turret is rigid (it neither dents nor sinks) */
      const nT = c.vehicle.children.length
      c.cylinder(0.95, 0.98, 0.08, OLIVE_STEEL, tx, ty + 0.02, 0, null, { seg: 32 })
      const tur = buildTurret(c, {
        plan: [
          [1.0, 0],
          [0.75, 0.7],
          [0.15, 0.92],
          [-0.95, 0.85],
          [-1.25, 0.55],
          [-1.25, -0.55],
          [-0.95, -0.85],
          [0.15, -0.92],
          [0.75, -0.7],
        ],
        h: 0.72,
        k: 0.2,
        kx: 0.1,
        x: tx,
        y: ty + 0.06,
        mat: paintMat(c, col),
        bev: 0.035,
        sub: 0.2,
        crease: 14,
      })
      c.part('turret', trl('labels.turret'), tur, new V3(tx, ty + 0.35, 0), 1.45)
      c.roundBox(0.42, 0.48, 0.62, 0.1, paintMat(c, col), tx + 1.0, ty + 0.4, 0)
      cannon(c, tx + 1.18, ty + 0.42, 0, 2.55, 0.07, { brake: true })
      /* mantlet spotlight: cylindrical housing with a lens, rim and bracket */
      c.roundBox(0.08, 0.1, 0.08, 0.02, OLIVE_STEEL, tx + 0.72, ty + 0.78, -0.45)
      c.cylinder(0.085, 0.095, 0.2, OLIVE_STEEL, tx + 0.8, ty + 0.9, -0.45, 'x', { seg: 18 })
      c.cylinder(0.098, 0.098, 0.025, BLACK, tx + 0.9, ty + 0.9, -0.45, 'x', { seg: 18 })
      /* spotlight off (matte lens): lit, it became a loose white dot above the turret */
      c.cylinder(0.075, 0.075, 0.012, CM('#8d9690', { metalness: 0.4, roughness: 0.25 }), tx + 0.912, ty + 0.9, -0.45, 'x', { seg: 18 })
      hatch(c, tx - 0.35, ty + 0.72, 0.42, 0.3, -1.7, OLIVE_STEEL)
      hatch(c, tx - 0.35, ty + 0.72, -0.42, 0.28, 0, OLIVE_STEEL)
      ;[-0.6, -0.42, -0.24].forEach(function (z, i) {
        periscope(c, tx + 0.45, ty + 0.76, z, 0.12, i === 1 ? lbl('gunner_periscope') : null)
      })
      ;[1, -1].forEach(function (s) {
        smokeLauncher(c, tx + 0.3, ty + 0.42, s * 0.86, s, 2)
      })
      /* low stowage behind the turret (does not cover the engine bay) */
      c.roundBox(0.28, 0.2, 1.3, 0.05, CANVAS2, tx - 1.38, ty + 0.24, 0)
      c.part('cargo', trl('labels.turret_stowage'), null, new V3(tx - 1.45, ty + 0.3, 0), 0.9)
      c.part('rear', trl('labels.rear_plate'), null, new V3(R, 1.1, 0), 1.2)
      for (let k = 0; k < 4; k++)
        c.rod(new V3(tx - 1.55, ty + 0.14, -0.6 + k * 0.4), new V3(tx - 1.55, ty + 0.4, -0.6 + k * 0.4), 0.015, OLIVE_STEEL)
      c.rod(new V3(tx - 1.55, ty + 0.4, -0.65), new V3(tx - 1.55, ty + 0.4, 0.65), 0.015, OLIVE_STEEL)
      /* commander visible through the open hatch: seat and breech */
      kit.seat(c, tx - 0.4, fl + 0.45, 0.42, { w: 0.42, h: 0.38, back: 0.45, lean: 0.1, mat: fab })
      kit.seat(c, tx - 0.4, fl + 0.45, -0.42, { w: 0.42, h: 0.38, back: 0.45, lean: 0.1, mat: fab })
      c.roundBox(0.8, 0.3, 0.3, 0.05, BARREL, tx + 0.1, ty + 0.1, 0)
      c.roundBox(1.6, 0.02, 1.2, 0.01, MT.headliner, tx - 0.2, ty + 0.66, 0).castShadow = false
      rigid(c, c.vehicle.children.slice(nT))
      antenna(c, tx - 1.0, ty + 0.62, -0.7, 2.1)
      c.part('fuel_tank', trl('labels.diesel_tank'), null, new V3(-0.6, 0.8, 0.9), 0.9)
      c.part('battery', trl('labels.batteries'), null, new V3(-1.0, 0.9, -0.9), 0.6)
      /* exhaust high on the rear plate, on the right (EE-9 M4 with a Detroit engine) */
      c.roundBox(0.5, 0.2, 0.22, 0.05, BARREL, R + 0.28, roofY + 0.05, 0.86)
      c.cylinder(0.06, 0.06, 0.2, MT.dark, R + 0.0, roofY + 0.07, 0.86, 'x')
      /* zones: names of the armoured car; the rear engine cover is its own zone */
      c.zone('glass_front', trl('labels.driver_and_gunner_periscopes'))
      c.zone('weapon', trl('labels.n_90_mm_cannon'))
      c.zone('turret', trl('labels.et_90_turret_and_roof'))
      c.zone(
        'engine_cover',
        trl('labels.engine_cover_and_grille'),
        [dx0 - 0.08, dx1 + 0.08, roofY - 0.3, roofY + 0.3, -0.7, 0.7],
        hood ? [hood.piv] : null,
        { type: 'hood', fxKey: 'hood', dir: 'up' },
      )
      matteOlive(c, col)
      m.damage = armoredCrashDamage
      armor(c, 0.35)
      rollover(c, { tilt: 0.05 })
      m.armor = function (c2: any) {
        cascavelArmor(c2, F, R, W, roofY, tx)
      }
    },
  )
  function cascavelArmor(c: any, F: any, R: any, W: any, roofY: any, tx: any) {
    sandbags(c, -0.75, 0.75, 1.6, 1.85, 'z', 2)
    camoNet(c, tx - 1.9, tx + 0.1, roofY + 0.72, 1.6, 0.5)
    machineGun(c, tx - 0.25, roofY + 0.95, 0.42, { len: 1.3 })
    c.roundBox(0.04, 0.3, 0.45, 0.02, OLIVE_STEEL, tx - 0.0, roofY + 1.0, 0.42)
    const sp = militaryWheel(c, 0, 0, 0.53, 0.32, { noPart: true })
    sp.rotation.y = PI / 2
    sp.position.set(R - 0.2, 1.2, 0)
    c.wheels.pop()
    ;[0.85, 0.6].forEach(function (z, i) {
      jerry(c, R + 0.6, roofY + 0.25, z, i ? SAND : '#3e4a2c', 0)
      jerry(c, R + 0.6, roofY + 0.25, -z, '#3e4a2c', 0)
    })
    ;[1, -1].forEach(function (s) {
      for (let x = -2.4; x < 1.6; x += 0.5)
        c.roundBox(0.45, 0.3, 0.05, 0.02, kit.steelMaterial, x, 1.0, s * (W / 2 + 0.05), {
          rot: [s * 0.25, 0, (kit.hash(x, s, 1) - 0.5) * 0.1],
        })
    })
  }

  /* ================================================================ */
  /* Main battle tank (Leopard 1A5 BR type, Krauss-Maffei, Brazilian Army)
     Reference (Wikipedia, Army Recognition and KNDS, confirmed on the web; running gear details from memory):
     hull 7.09 m · 9.54 m with the gun forward · width 3.37 m with skirts (3.25 m without) · height 2.39 m at the turret roof (2.7 m at the top of the periscopes)
     clearance 0.44 m · track (centre of the tracks) about 2.70 m · 0.55 m track · seven double road wheels of 0.70 m · four return rollers
     drive sprocket at the back, idler at the front · 42.4 t · 4 crew · 955 L · about 160 L/100 km · 600 km · 65 km/h · MTU MB 838 of 830 hp
     Signature traits:
     front: long gently sloped glacis with caged headlights on the corners and a tow cable, wedge lower bow;
     wedge turret with bolted spaced armour forming a "beak" on both sides of the mantlet
     side: steel skirts with rubber at the bottom covering the top half of the wheels, seven double road wheels, high drive sprocket at the back
     rear: long engine deck with grilles, exhausts on the rear sides, boxed taillights on the corners
     top: EMES-18 sight box right of the turret front, commander PERI periscope on the right, loader hatch on the left,
     smoke launchers in two groups of four, baggage basket behind the turret, 105 mm L7 gun with a thermal sleeve and fume extractor */
  fx.register(
    {
      key: 'battle_tank',
      group: GRP,
      name: trl('vehicles.battle_tank.name'),
      inspired: trl('vehicles.battle_tank.inspired'),
      category: trl('vehicles.battle_tank.category'),
      fuel: 'diesel',
      description: trl('vehicles.battle_tank.description'),
      mass: 42400,
      noise: 320,
      seats: trl('vehicles.battle_tank.seats'),
      capacity: trl('vehicles.battle_tank.capacity'),
      efficiency: trl('vehicles.battle_tank.efficiency'),
      range: trl('vehicles.battle_tank.range'),
      maxSpeed: 65,
      skill: trl('vehicles.battle_tank.skill'),
      hood: true,
    },
    function (c) {
      const col = '#465033',
        W = 3.25,
        F = 3.55,
        R = -3.54,
        roofY = 1.52,
        deckY = 1.48
      const gl = function (x: any) {
        return roofY + ((x - 1.6) * (1.18 - roofY)) / (F - 0.05 - 1.6)
      }
      const m = c.meta
      m.color = col
      m.kind = 'car'
      m.bullet = true
      /* lower hull between the tracks */
      const low = c.roundBox(6.6, 0.62, 2.0, 0.08, paintMat(c, col), -0.1, 0.78, 0, { def: true, sub: 0.3 })
      c.roundBox(0.55, 0.62, 2.0, 0.06, paintMat(c, col), 3.1, 0.8, 0, { def: true, rot: [0, 0, -0.95] })
      /* upper hull (covers the tracks) */
      const items = [
        [R, 1.05, 0.04],
        [R - 0.02, deckY - 0.04, 0.05],
        [-1.2, deckY + 0.02, 0.06],
        [1.6, roofY, 0.08],
        [F - 0.05, 1.18, 0.06],
        [F - 0.12, 1.05, 0.03],
      ]
      const ex0 = -3.4,
        ex1 = -2.2
      const H = hull(c, {
        items: items,
        bottomY: 1.05,
        W: W - 0.12,
        col: col,
        belt: 1.3,
        top: roofY + 0.06,
        k: 0.03,
        holes: [kit.holeTop(ex0, ex1, 1.12, 1.3, 'hood')],
        sub: 0.22,
        bev: 0.05,
      })
      const tx = 0.0,
        ty = roofY + 0.02,
        tH = 0.77,
        tTop = ty + 0.08 + tH
      /* the rollover uses the full height, with the turret */
      Object.assign(m, {
        width: W,
        length: F - R,
        front: F,
        rear: R,
        clearance: 0.44,
        belt: 1.3,
        top: tTop,
        bodyHeight: 0.95,
        roof: { x0: -1.9, x1: 0.9, w: 2.3, y: tTop },
      })
      /* engine cover: hinge on the back edge, opens about 110 degrees (past vertical and does not cover the bay) */
      const hood = kit.makeHood(c, H.mesh.userData.cut.hood, { col: col, open: 1.95 })
      if (hood) {
        const nB = c.vehicle.children.length,
          bcen = new V3((ex0 + ex1) / 2, 1.1, 0)
        mirroredBay(
          c,
          { x0: ex0 + 0.06, x1: ex1 - 0.06, zw: 1.0, floor: 0.95, top: deckY - 0.05, motor: 'diesel', col: '#3a3c32' },
          (ex0 + ex1) / 2,
        )
        scale(c, nB, bcen, 1.45)
        c.roundBox(ex1 - ex0 - 0.1, 0.02, 2.1, 0.01, BAY_LIGHT, bcen.x, 0.95, 0)
        ;[1, -1].forEach(function (sd) {
          c.roundBox(ex1 - ex0 - 0.1, 0.55, 0.02, 0.01, BAY_LIGHT, bcen.x, 1.25, sd * 1.08)
        })
        /* transmission box behind the engine (MTU V10 + gearbox) */
        c.roundBox(0.42, 0.42, 1.5, 0.05, MT.block, ex0 + 0.2, 1.2, 0)
        /* camera: aims at the right side of the bay, which passes beside the turret and the basket */
        if (c.meta.bay) {
          c.meta.bay.center.set(-3.0, 1.45, 1.3)
          c.meta.bay.zw = 1.0
        }
        for (let gx = ex0 + 0.15; gx < ex1 - 0.1; gx += 0.12)
          [-0.55, 0.55].forEach(function (z) {
            c.roundBox(0.05, 0.03, 0.95, 0.01, MT.dark, gx - hood.piv.position.x, deckY + 0.06 - hood.piv.position.y, z, {
              parent: hood.piv,
            })
          })
        renameHood(c, trl('labels.engine_cover'))
      }
      /* tracks: 7 double road wheels, toothed drive sprocket at the back (smaller and higher), idler at the front, 4 return rollers */
      const tz = W / 2 - 0.3
      ;[1, -1].forEach(function (s) {
        leopardTrack(c, { x0: R + 0.32, x1: F - 0.5, z: s * tz, w: 0.55, wheelMat: paintMat(c, OLIVE2) })
        const sk = c.roundBox(5.9, 0.42, 0.04, 0.02, paintMat(c, col), -0.2, 0.86, s * (W / 2 + 0.05), { def: true })
        for (let x = -3.0; x < 2.6; x += 0.86) c.roundBox(0.012, 0.42, 0.01, 0.004, MT.dark, x, 0.86, s * (W / 2 + 0.075))
        c.roundBox(5.9, 0.1, 0.025, 0.01, MT.rubber, -0.2, 0.61, s * (W / 2 + 0.05))
        c.roundBox(0.55, 0.42, 0.03, 0.01, MT.rubber, 2.95, 0.86, s * (W / 2 + 0.05))
        c.part('armor', s > 0 ? trl('labels.right_skirt') : trl('labels.left_skirt'), sk, new V3(-0.2, 0.86, (s * W) / 2), 1.2)
        c.roundBox(0.5, 0.03, 0.6, 0.01, paintMat(c, col), F - 0.25, 1.08, s * tz, { rot: [0, 0, -0.35] })
        c.roundBox(0.03, 0.5, 0.55, 0.01, MT.rubber, R + 0.02, 0.85, s * tz)
        star(c, 0.6, 1.3, s * (H.half(1.3) + 0.01), 0.17, s > 0 ? '+z' : '-z', { ring: true })
        c.text(trl('texts.army'), 1.0, 0.16, -1.5, 1.3, s * (H.half(1.3) + 0.01), s > 0 ? '+z' : '-z', { fg: '#dcdace', size: 0.7 })
        /* headlights on the glacis with a guard, taillights */
        guardedHeadlight(c, 2.95, gl(2.95) + 0.16, s * 1.3, s, { style: 'round' })
        c.roundBox(0.1, 0.16, 0.08, 0.02, OLIVE_STEEL, 2.9, gl(2.9) + 0.04, s * 1.3)
        c.roundBox(0.1, 0.18, 0.3, 0.03, OLIVE_STEEL, R - 0.04, 1.35, s * 1.25)
        kit.taillight(c, { style: 'round2', x: R - 0.08, y: 1.35, z: s * 1.25, w: 0.2, h: 0.09, d: 0.05, side: s })
        c.tube(
          [
            [F - 0.2, 0.95, s * 0.6],
            [F + 0.02, 0.92, s * 0.6],
            [F, 0.78, s * 0.6],
          ],
          0.04,
          OLIVE_STEEL,
          { seg: 10, rs: 6 },
        )
        /* tow cable on the glacis */
        c.tube(
          [
            [2.4, gl(2.4) + 0.03, s * 0.25],
            [2.8, gl(2.8) + 0.03, s * 0.6],
            [3.1, gl(3.1) + 0.03, s * 0.95],
            [2.6, gl(2.6) + 0.03, s * 1.2],
            [1.6, gl(1.6) + 0.03, s * 1.25],
          ],
          0.025,
          BARREL,
          { seg: 40, rs: 5 },
        )
        /* side exhausts at the rear */
        c.roundBox(0.8, 0.14, 0.04, 0.02, MT.dark, -2.6, 1.3, s * (H.half(1.3) + 0.005))
      })
      /* bow: no bumper (a tank has none); the glacis plate is armour and only dents */
      const bF = c.roundBox(0.1, 0.16, 2.0, 0.03, OLIVE_STEEL, F - 0.08, 1.05, 0, { def: true })
      c.part('armor', trl('labels.bow_plate'), bF, new V3(F, 1.05, 0), 1.0)
      c.text(trl('texts.eb_6150_02'), 0.5, 0.12, R - 0.025, 1.12, 0, '-x', { fg: '#e4e2d6', bg: '#24261d', size: 0.6 })
      /* spare track links on the glacis */
      for (let k = 0; k < 4; k++)
        c.roundBox(
          0.13,
          0.05,
          0.55,
          0.015,
          CM('#2b2c2a', { metalness: 0.5, roughness: 0.6 }),
          2.45 + k * 0.15,
          gl(2.45 + k * 0.15) + 0.03,
          -0.95,
          { rot: [0, 0, -0.18] },
        )
      /* driver: hatch and periscopes */
      hatch(c, 2.05, roofY - 0.1, -0.78, 0.28, 0, OLIVE_STEEL, { yaw: 0 })
      kit.seat(c, 1.95, 0.62, -0.78, { w: 0.44, h: 0.34, back: 0.5, lean: 0.5, mat: CM('#2f3226', { roughness: 0.9 }) })
      ;[-0.95, -0.78, -0.61].forEach(function (z, i) {
        periscope(c, 2.3, roofY - 0.08, z, 0.14, i === 1 ? lbl('driver_periscope') : null)
      })
      /* 1A5 turret: higher base with sloped sides, with the additional wedge-shaped spaced armour at the front.
       Everything on the turret is rigid: it neither dents nor sinks in a rollover */
      const nT = c.vehicle.children.length,
        fab = CM('#2f3226', { roughness: 0.9 }),
        tpaint = paintMat(c, col)
      c.cylinder(1.15, 1.2, 0.1, OLIVE_STEEL, tx + 0.1, ty + 0.03, 0, null, { seg: 32 })
      const tur = buildTurret(c, {
        plan: [
          [1.2, 0.7],
          [0.95, 1.12],
          [-1.3, 1.22],
          [-2.05, 1.06],
          [-2.15, 0.6],
          [-2.15, -0.6],
          [-2.05, -1.06],
          [-1.3, -1.22],
          [0.95, -1.12],
          [1.2, -0.7],
        ],
        h: tH,
        k: 0.12,
        kx: 0.03,
        x: tx,
        y: ty + 0.08,
        mat: tpaint,
        bev: 0.05,
        sub: 0.25,
        crease: 14,
      })
      c.part('turret', trl('labels.turret'), tur, new V3(tx, ty + 0.45, 0), 1.7)
      /* wedge plates (tip forward), set off from the turret by spacers, with the top sloping inward */
      ;[1, -1].forEach(function (s) {
        const x0p = 2.0,
          z0p = 0.34,
          x1p = 0.72,
          z1p = 1.36,
          len = Math.hypot(x0p - x1p, z1p - z0p),
          yaw = Math.atan2(z1p - z0p, x0p - x1p)
        c.roundBox(len, tH * 0.86, 0.11, 0.03, tpaint, tx + (x0p + x1p) / 2, ty + 0.1 + tH * 0.5, (s * (z0p + z1p)) / 2, {
          rot: [0, s * yaw, 0],
          taper: { sx: 0.97, sz: 0.6 },
        })
        ;[0.3, 0.7].forEach(function (t) {
          const px = x0p + (x1p - x0p) * t,
            pz = z0p + (z1p - z0p) * t
          c.roundBox(0.1, 0.12, 0.22, 0.02, OLIVE_STEEL, tx + px - 0.12, ty + 0.4, s * (pz - 0.12))
        })
        c.roundBox(0.12, tH * 0.5, 0.03, 0.01, MT.dark, tx + x0p - 0.06, ty + 0.1 + tH * 0.5, s * (z0p - 0.03))
      })
      /* mantlet and 105 mm gun with a thermal sleeve and fume extractor */
      c.roundBox(0.55, 0.5, 0.6, 0.06, tpaint, tx + 1.62, ty + 0.44, 0.05)
      cannon(c, tx + 1.85, ty + 0.46, 0.05, 4.15, 0.085, { sleeve: true, fume: 0.45 })
      /* EMES-18 at the front left, commander PERI, hatches */
      const ye = tTop + 0.1
      c.roundBox(0.7, 0.36, 0.4, 0.05, tpaint, tx + 0.85, ye, 0.5)
      c.roundBox(0.02, 0.2, 0.28, 0.01, MT.armorGlass, tx + 1.21, ye + 0.02, 0.5)
      kit.asGlass(c, c.roundBox(0.02, 0.16, 0.24, 0.01, MT.armorGlass, tx + 1.22, ye + 0.02, 0.5), lbl('emes_18_sight'), 'laminated')
      c.cylinder(0.18, 0.2, 0.3, OLIVE_STEEL, tx + 0.15, tTop + 0.1, 0.92)
      c.roundBox(0.25, 0.2, 0.3, 0.05, OLIVE_STEEL, tx + 0.2, tTop + 0.32, 0.92)
      c.roundBox(0.02, 0.12, 0.2, 0.01, MT.armorGlass, tx + 0.33, tTop + 0.32, 0.92)
      hatch(c, tx - 0.55, tTop - 0.02, 0.6, 0.34, -1.75, OLIVE_STEEL)
      hatch(c, tx - 0.55, tTop - 0.02, -0.6, 0.32, 0, OLIVE_STEEL)
      ;[0.3, 0.55].forEach(function (z, i) {
        periscope(c, tx - 0.12, tTop + 0.04, z, 0.12, i === 1 ? lbl('commander_periscope') : null, { rot: 0 })
      })
      ;[1, -1].forEach(function (s) {
        smokeLauncher(c, tx + 0.45, ty + 0.55, s * 1.22, s, 4)
        for (let b = 0; b < 3; b++) c.roundBox(0.5, 0.25, 0.05, 0.02, paintMat(c, OLIVE2), tx - 0.6 - b * 0.55, ty + 0.45, s * 1.24)
      })
      /* baggage basket at the back of the turret */
      const bx = tx - 2.35
      for (let bz = -1.0; bz <= 1.0; bz += 0.25) c.rod(new V3(bx, ty + 0.25, bz), new V3(bx, ty + 0.75, bz), 0.015, OLIVE_STEEL, { seg: 5 })
      ;[0.25, 0.75].forEach(function (y) {
        c.tube(
          [
            [tx - 2.05, ty + y, -1.08],
            [bx, ty + y, -1.0],
            [bx, ty + y, 1.0],
            [tx - 2.05, ty + y, 1.08],
          ],
          0.016,
          OLIVE_STEEL,
          { seg: 16, rs: 5 },
        )
      })
      c.roundBox(0.25, 0.3, 1.6, 0.06, CANVAS2, bx + 0.12, ty + 0.4, 0)
      c.part('cargo', trl('labels.luggage_basket'), null, new V3(bx + 0.1, ty + 0.5, 0), 1.0)
      /* interior visible through the commander hatch */
      kit.seat(c, tx - 0.55, ty - 0.45, 0.6, { w: 0.42, h: 0.38, back: 0.45, lean: 0.1, mat: fab })
      kit.seat(c, tx + 0.2, ty - 0.55, 0.62, { w: 0.4, h: 0.36, back: 0.42, lean: 0.1, mat: fab })
      kit.seat(c, tx - 0.3, ty - 0.55, -0.62, { w: 0.4, h: 0.36, back: 0.42, lean: 0.1, mat: fab })
      c.roundBox(1.1, 0.35, 0.4, 0.05, BARREL, tx + 0.6, ty + 0.35, 0.05)
      c.roundBox(2.2, 0.02, 1.6, 0.01, MT.headliner, tx - 0.3, tTop - 0.08, 0).castShadow = false
      c.cylinder(0.05, 0.05, 0.03, RED_LIGHT, tx - 0.4, tTop - 0.1, 0.2)
      rigid(c, c.vehicle.children.slice(nT))
      c.part('rear', trl('labels.rear_plate'), null, new V3(R, 1.2, 0), 1.2)
      antenna(c, tx - 1.6, tTop - 0.04, -0.85, 2.4)
      antenna(c, tx - 1.6, tTop - 0.04, 0.85, 1.8)
      c.part('fuel_tank', trl('labels.diesel_tanks'), null, new V3(-1.2, 1.1, 1.1), 1.0)
      c.part('battery', trl('labels.batteries'), null, new V3(-0.5, 0.9, -1.0), 0.6)
      /* zones: names of the tank; the engine cover and the turret basket are their own zones */
      c.zone('weapon', trl('labels.n_105_mm_cannon'))
      c.zone('turret', trl('labels.turret_and_spaced_armor'))
      c.zone('glass_front', trl('labels.driver_periscopes_and_emes_18_sight'))
      c.zone('glass_rear', trl('labels.commander_periscopes'))
      c.zone(
        'engine_cover',
        trl('labels.deck_and_engine_grilles'),
        [ex0 - 0.1, ex1 + 0.1, deckY - 0.3, deckY + 0.3, -1.3, 1.3],
        hood ? [hood.piv] : null,
        { type: 'hood', fxKey: 'hood', dir: 'up' },
      )
      c.zone('basket', trl('labels.luggage_basket'), [tx - 2.55, tx - 2.0, ty + 0.1, ty + 0.85, -1.15, 1.15], null, {
        type: 'part',
        fxKey: 'fairing',
        dir: 'front',
      })
      void low
      matteOlive(c, col)
      m.damage = armoredCrashDamage
      armor(c, 0.3)
      /* rolled over: rests on the turret and tilts slightly forward */
      rollover(c, { tilt: 0.07 })
      m.armor = function (c2: any) {
        leopardArmor(c2, F, R, W, roofY, tx, ty, tTop)
      }
    },
  )
  /* tank track: double road wheels, toothed sprocket at the back, idler at the front, return rollers */
  function leopardTrack(c: any, o: any) {
    const x0 = o.x0,
      x1 = o.x1,
      z = o.z,
      w = o.w || 0.55,
      th = 0.06,
      n = 7,
      r = 0.35,
      mat = CM('#2b2c2a', { metalness: 0.5, roughness: 0.6 }),
      wm = o.wheelMat
    const xs = x0 + 0.55,
      xe = x1 - 0.5,
      sp = (xe - xs) / (n - 1),
      rS = 0.26,
      yS = 0.8,
      rI = 0.27,
      yI = 0.66,
      rr = 0.075
    function wheel(x: any, y: any, rad: any, opt: any) {
      const g = new THREE.Group()
      g.position.set(x, y, z)
      c.vehicle.add(g)
      const wmsh = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, w * 0.8, 24), wm)
      wmsh.rotation.x = PI / 2
      wmsh.castShadow = true
      g.add(wmsh)
      if (opt.tires)
        [-1, 1].forEach(function (q) {
          const t = new THREE.Mesh(new THREE.TorusGeometry(rad - 0.035, 0.035, 6, 24), MT.rubber)
          t.position.z = q * w * 0.22
          g.add(t)
        })
      const hb = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.32, rad * 0.32, w * 0.86, 10), MT.steel)
      hb.rotation.x = PI / 2
      g.add(hb)
      if (opt.teeth)
        for (let t2 = 0; t2 < 12; t2++) {
          const a = (t2 / 12) * PI * 2,
            tg = new THREE.Mesh(G.roundedBox(0.07, 0.07, w * 0.5, 0.012), BARREL)
          tg.position.set(Math.cos(a) * (rad + 0.02), Math.sin(a) * (rad + 0.02), 0)
          tg.rotation.z = a
          g.add(tg)
        }
      if (opt.spokes)
        for (let k = 0; k < 6; k++) {
          const b = new THREE.Mesh(G.roundedBox(rad * 1.5, 0.05, 0.04, 0.01), wm)
          b.rotation.z = (k / 6) * PI
          b.position.z = (z > 0 ? 1 : -1) * w * 0.42
          g.add(b)
        }
      c.spin.push({ o: g, axis: 'z', v: 0, track: true })
      return g
    }
    for (let i = 0; i < n; i++) wheel(xs + i * sp, r + th, r, { tires: true })
    wheel(x0, yS, rS, { teeth: true })
    wheel(x1, yI, rI, { spokes: true, tires: true })
    const topY = function (x: any) {
      return yS + rS + th / 2 + ((yI + rI - yS - rS) * (x - x0)) / (x1 - x0)
    }
    for (let q = 0; q < 4; q++) {
      const xr = x0 + (x1 - x0) * (0.2 + q * 0.2)
      wheel(xr, topY(xr) - rr - th / 2 - 0.01, rr, {})
    }
    const path = [],
      segs = 12
    function arc(cx: any, cy: any, rad: any, a0: any, a1: any) {
      for (let s = 0; s <= segs; s++) {
        const a = a0 + ((a1 - a0) * s) / segs
        path.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad])
      }
    }
    path.push([xs - 0.06, th / 2])
    for (let i = 1; i < n - 1; i++) path.push([xs + i * sp, th / 2])
    path.push([xe + 0.06, th / 2])
    arc(x1, yI, rI + th / 2, -PI / 2 + 0.75, PI / 2)
    for (let q = 3; q >= 0; q--) {
      const xq = x0 + (x1 - x0) * (0.2 + q * 0.2)
      path.push([xq, topY(xq) - 0.012])
    }
    arc(x0, yS, rS + th / 2, PI / 2, PI * 1.5 - 0.55)
    const pts = path.map(function (p) {
      return new THREE.Vector2(p[0], p[1])
    })
    const curve = new THREE.SplineCurve(pts.concat([pts[0]])),
      lenT = curve.getLength(),
      nl = Math.round(lenT / 0.15),
      links = []
    for (let l = 0; l < nl; l++) {
      const t = l / nl,
        p = curve.getPointAt(t),
        tg = curve.getTangentAt(t),
        ang = Math.atan2(tg.y, tg.x)
      const lg = G.roundedBox(0.13, th, w, 0.015)
      lg.applyMatrix4(new THREE.Matrix4().makeRotationZ(ang).setPosition(p.x, p.y, 0))
      links.push(lg)
      const gh2 = G.roundedBox(0.05, 0.05, 0.05, 0.01)
      gh2.applyMatrix4(new THREE.Matrix4().makeRotationZ(ang).setPosition(p.x - Math.sin(ang) * 0.04, p.y + Math.cos(ang) * 0.04, 0))
      links.push(gh2)
    }
    const tm = c.add(G.merge(links), mat, 0, 0, z)
    tm.userData.noFollow = true
    c.part('track', z > 0 ? trl('labels.right_track') : trl('labels.left_track'), tm, new V3((x0 + x1) / 2, 0.3, z), 1.4)
  }
  function leopardArmor(c: any, F: any, R: any, W: any, roofY: any, tx: any, ty: any, tTop: any) {
    /* dozer blade, sandbags on the glacis, net over the turret, cans and the commander machine gun */
    c.roundBox(0.12, 0.75, W + 0.1, 0.04, kit.steelMaterial, F + 0.45, 0.55, 0, { rot: [0, 0, 0.15] })
    c.roundBox(0.06, 0.12, W + 0.1, 0.02, MT.steel, F + 0.55, 0.18, 0)
    ;[1, -1].forEach(function (s) {
      c.rod(new V3(F - 0.1, 0.95, s * 1.0), new V3(F + 0.42, 0.6, s * 1.0), 0.06, BARREL)
    })
    sandbags(c, -0.9, 0.9, 1.5, 2.45, 'z', 2)
    camoNet(c, tx - 2.3, tx - 0.35, tTop, 2.3, 0.55)
    machineGun(c, tx - 0.45, tTop + 0.35, 0.6, { len: 1.3 })
    c.roundBox(0.04, 0.32, 0.45, 0.02, OLIVE_STEEL, tx - 0.2, tTop + 0.38, 0.6)
    for (let x = -3.2; x <= -2.0; x += 0.4)
      [1, -1].forEach(function (s) {
        jerry(c, x, roofY + 0.0, s * 1.38, s > 0 ? '#3e4a2c' : SAND, 0)
      })
    for (let b = 0; b < 5; b++) c.cylinder(0.09, 0.09, 1.6, CM('#5a4530', { roughness: 0.95 }), R - 0.15, 0.9 + b * 0.18, 0, 'z')
    void ty
  }

  /* ================================================================ */
  /* Utility helicopter (Sikorsky UH-60L Black Hawk type, Army Aviation HM-2)
     Reference (UH-60L sheet confirmed on the web; gear and stabilizer from memory):
     length with rotors turning 19.76 m · fuselage 15.26 m (nose to tail rotor tip) · height 5.13 m (top of the tail rotor)
     fuselage width 2.36 m · main rotor 16.36 m with 4 blades · tail rotor 3.35 m canted 20 degrees to the right
     main gear track about 2.70 m · wheelbase (main gear to tail wheel) about 8.83 m · stabilizer about 4.38 m span
     rotor hub about 3.7 m from the nose · clearance about 0.6 m · 5,224 kg empty, 7,900 kg take-off · 1,360 L internal · 584 km · 296 km/h
     Signature traits:
     front: short blunt nose with a two-panel large windshield, wire cutter above and below, pitots on both sides
     side: long cabin with a wide sliding door, gunner window right behind the pilot door, trailing-arm main gear
     with large wheels under the cockpit, long low tail cone with a tail wheel
     rear: inclined pylon with the tail rotor on the right and a large stabilizer below
     top: two turboshafts side by side in nacelles with the air intake at the front and infrared suppressors turned outward, 4-blade rotor */
  function boxKeep(x0: any, x1: any, y0: any, y1: any, zw: any, zMin?: any) {
    return {
      sdf: function (x: any, y: any, z: any) {
        const d = Math.max(x0 - x, x - x1, y0 - y, y - y1, Math.abs(z) - zw, (zMin || -1) - Math.abs(z))
        return -d
      },
    }
  }
  function boxCut(x0: any, x1: any, y0: any, y1: any, zw: any, zMin?: any) {
    return {
      sdf: function (x: any, y: any, z: any) {
        return Math.max(x0 - x, x - x1, y0 - y, y - y1, Math.abs(z) - zw, (zMin || -1) - Math.abs(z))
      },
    }
  }
  function militaryRotor(c: any, x: any, y: any, z: any, n: any, len: any, chord: any, mat: any, o: any) {
    o = o || {}
    const g = new THREE.Group()
    g.position.set(x, y, z)
    c.vehicle.add(g)
    for (let i = 0; i < n; i++) {
      const piv = new THREE.Group()
      piv.rotation[o.axis === 'z' ? 'z' : 'y'] = (i / n) * PI * 2 + (o.phase || 0)
      const geo = G.roundedBox(len, o.th || 0.06, chord, 0.02)
      geo.translate(len / 2 + (o.hub || 0.3), 0, 0)
      if (o.droop) {
        const p = geo.attributes.position
        for (let k = 0; k < p.count; k++) {
          const t = p.getX(k) / len
          p.setY(k, p.getY(k) - o.droop * t * t)
        }
        geo.computeVertexNormals()
      }
      const b = new THREE.Mesh(geo, mat)
      b.castShadow = true
      if (o.axis === 'z') b.rotation.x = PI / 2
      piv.add(b)
      if (o.tip) {
        const tp = new THREE.Mesh(G.roundedBox(0.25, (o.th || 0.06) + 0.005, chord + 0.005, 0.01), o.tip)
        tp.position.set(len + (o.hub || 0.3) - 0.12, -(o.droop || 0), 0)
        if (o.axis === 'z') tp.rotation.x = PI / 2
        piv.add(tp)
      }
      g.add(piv)
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(o.hubR || 0.32, o.hubR || 0.32, 0.22, 18), BARREL)
    if (o.axis === 'z') hub.rotation.x = PI / 2
    g.add(hub)
    c.spin.push({ o: g, axis: o.axis === 'z' ? 'z' : 'y', v: o.v || 3 })
    return g
  }
  fx.register(
    {
      key: 'transport_helicopter',
      group: GRP,
      name: trl('vehicles.transport_helicopter.name'),
      inspired: trl('vehicles.transport_helicopter.inspired'),
      category: trl('vehicles.transport_helicopter.category'),
      fuel: 'jet_fuel',
      description: trl('vehicles.transport_helicopter.description'),
      mass: 7700,
      noise: 600,
      seats: trl('vehicles.transport_helicopter.seats'),
      capacity: trl('vehicles.transport_helicopter.capacity'),
      efficiency: trl('vehicles.transport_helicopter.efficiency'),
      range: trl('vehicles.transport_helicopter.range'),
      maxSpeed: 295,
      skill: trl('vehicles.transport_helicopter.skill'),
      hood: false,
    },
    function (c) {
      const col = '#55603f',
        paint = paintMat(c, col),
        dark = paintMat(c, '#363b2e')
      const st = [
        { x: 3.58, w: 0.3, h: 0.36, y: 1.32 },
        { x: 3.38, w: 1.3, h: 1.15, y: 1.45, p: 2.2 },
        { x: 2.8, w: 1.95, h: 1.62, y: 1.56, p: 2.6 },
        { x: 1.9, w: 2.25, h: 1.86, y: 1.62, p: 3 },
        { x: 0.6, w: 2.36, h: 1.9, y: 1.62, p: 3.3 },
        { x: -2.4, w: 2.3, h: 1.86, y: 1.64, p: 3.3 },
        { x: -3.4, w: 1.6, h: 1.36, y: 1.9, p: 2.6 },
        { x: -4.6, w: 0.9, h: 0.86, y: 2.15, p: 2.2 },
        { x: -8.3, w: 0.5, h: 0.6, y: 2.32, p: 2 },
        { x: -8.95, w: 0.4, h: 0.52, y: 2.38, p: 2 },
        { x: -9.15, w: 0.06, h: 0.2, y: 2.42 },
      ]
      const wsCut = boxCut(2.15, 3.25, 1.8, 2.7, 1.2),
        cockSide = boxCut(1.12, 2.08, 1.72, 2.38, 2, 0.8),
        gun = boxCut(0.3, 0.95, 1.78, 2.28, 2, 0.8),
        door = boxCut(-1.65, 0.12, 0.84, 2.26, 2, 0.8)
      const fus = c.add(G.subdivide(G.loft(st, 32, 2.4), 0.12), paint)
      kit.cutMesh(fus, [wsCut, cockSide, gun, door], 30)
      c.deform.push(fus)
      /* glass moulded into the fuselage itself (cut-out inner loft) */
      function glass(test: any, label: any, type: any) {
        const st2 = st.map(function (q) {
          return Object.assign({}, q, { w: q.w * 0.985, h: q.h * 0.985 })
        })
        const g = new THREE.Mesh(G.subdivide(G.loft(st2, 32, 2.4), 0.1), MT.glass)
        kit.cutMesh(g, [test], 30)
        c.vehicle.add(g)
        return kit.asGlass(c, g, label, type)
      }
      glass(boxKeep(2.15, 3.25, 1.8, 2.7, 1.2), lbl('windshield'), 'laminated')
      glass(boxKeep(1.12, 2.08, 1.72, 2.38, 2, 0.8), lbl('cab_door_windows'), 'tempered')
      glass(boxKeep(0.3, 0.95, 1.78, 2.28, 2, 0.8), lbl('gunner_windows'), 'tempered')
      /* windshield frames */
      c.rod(new V3(2.25, 2.55, 0), new V3(3.15, 1.85, 0), 0.025, BLACK)
      ;[1, -1].forEach(function (sd) {
        c.rod(new V3(2.15, 2.55, sd * 0.85), new V3(2.2, 1.8, sd * 1.05), 0.025, BLACK)
      })
      /* interior: cockpit */
      const fl = 0.86,
        fab = CM('#2f3226', { roughness: 0.9 })
      c.roundBox(5.6, 0.04, 2.05, 0.01, MT.carpet, -0.4, fl, 0).castShadow = false
      ;[0.5, -0.5].forEach(function (z) {
        kit.seat(c, 1.55, fl, z, { w: 0.5, h: 0.42, back: 0.72, lean: 0.12, mat: fab })
        c.rod(new V3(2.0, fl, z), new V3(1.95, fl + 0.55, z), 0.016, BLACK)
        c.sphere(0.035, BLACK, 1.95, fl + 0.57, z)
      })
      c.roundBox(0.25, 0.45, 1.9, 0.05, CM('#232427'), 2.45, fl + 0.55, 0)
      c.roundBox(0.4, 0.05, 1.95, 0.02, CM('#1a1b1d'), 2.4, fl + 0.8, 0, { rot: [0, 0, 0.25] })
      ;[-0.75, -0.45, -0.15, 0.15, 0.45, 0.75].forEach(function (z) {
        c.roundBox(0.012, 0.14, 0.18, 0.01, MT.screen, 2.32, fl + 0.62, z)
      })
      c.roundBox(0.5, 0.3, 0.3, 0.04, CM('#232427'), 1.95, fl + 0.15, 0)
      /* troop cabin: three rows of canvas seats (4 + 4 + 3 = 11 soldiers), one registered place per seat */
      ;[
        [-0.25, 4],
        [-1.15, 4],
        [-2.35, 3],
      ].forEach(function (r) {
        const wB = r[1] === 4 ? 1.95 : 1.5
        kit.seat(c, r[0], fl, 0, { w: wB, n: r[1], h: 0.4, back: 0.55, lean: 0.08, dir: 1, mat: CANVAS_TOP, headrest: false })
        const st = c.seatTops.pop()
        for (let q = 0; q < r[1]; q++)
          c.seatTops.push({ x: st.x, y: st.y, z: ((q - (r[1] - 1) / 2) * wB) / r[1], w: wB / r[1] - 0.02, l: st.l })
      })
      ;[1, -1].forEach(function (sd) {
        kit.seat(c, 0.6, fl, sd * 0.75, { w: 0.5, h: 0.4, back: 0.55, lean: 0.08, mat: fab, headrest: false })
      })
      c.roundBox(4.6, 0.02, 1.9, 0.01, MT.headliner, -0.6, 2.45, 0).castShadow = false
      /* weak interior light (greenish white) and light lining on the bulkhead: the cabin shows through the door at night */
      const cabLight = CM('#d8e2c8', { emissive: new THREE.Color('#a4b896'), emissiveIntensity: 0.9 })
      ;[-0.3, -1.6].forEach(function (x) {
        c.roundBox(0.5, 0.02, 0.08, 0.01, cabLight, x, 2.43, 0).castShadow = false
      })
      c.roundBox(
        0.04,
        1.5,
        1.95,
        0.01,
        CM('#6e7564', { roughness: 0.9, emissive: new THREE.Color('#1c2216'), emissiveIntensity: 1 }),
        -2.9,
        1.6,
        0,
      )
      /* sliding doors open, pulled back */
      ;[1, -1].forEach(function (sd) {
        const dz = sd * 1.2
        c.roundBox(1.75, 1.38, 0.05, 0.08, paint, -2.45, 1.56, dz, { def: true })
        kit.asGlass(
          c,
          c.roundBox(0.55, 0.45, 0.02, 0.06, MT.glass, -2.1, 1.95, dz + sd * 0.03),
          sd > 0 ? lbl('right_door_window') : lbl('left_door_window'),
          'tempered',
        )
        c.roundBox(1.9, 0.05, 0.06, 0.02, OLIVE_STEEL, -1.6, 2.28, sd * 1.19)
        c.roundBox(1.9, 0.05, 0.06, 0.02, OLIVE_STEEL, -1.6, 0.86, sd * 1.15)
        star(c, -2.45, 1.4, dz + sd * 0.03, 0.22, sd > 0 ? '+z' : '-z', { ring: true })
        c.text(trl('texts.army'), 1.3, 0.22, -6.0, 2.25, sd * 0.34, sd > 0 ? '+z' : '-z', { fg: '#dcdace', size: 0.75 })
        c.text(trl('texts.eb_2008'), 0.8, 0.2, -4.3, 2.1, sd * 0.48, sd > 0 ? '+z' : '-z', { fg: '#dcdace', size: 0.7 })
        /* step and handles */
        c.roundBox(0.4, 0.04, 0.2, 0.01, OLIVE_STEEL, 1.5, 0.82, sd * 1.15)
      })
      /* landing gear: main wheels and tail wheel */
      ;[1, -1].forEach(function (sd) {
        const w = c.wheel(1.15, sd * 1.35, 0.33, 0.2, {
          rim: RIMO,
          spokes: 0,
          rimR: 0.55,
          label: sd > 0 ? trl('labels.right_landing_gear_wheel') : trl('labels.left_landing_gear_wheel'),
        })
        c.rod(new V3(1.15, 0.33, sd * 1.28), new V3(1.0, 1.15, sd * 1.05), 0.06, OLIVE_STEEL)
        c.rod(new V3(1.15, 0.33, sd * 1.28), new V3(0.4, 0.85, sd * 0.95), 0.045, OLIVE_STEEL)
        c.roundBox(0.25, 0.2, 0.2, 0.04, OLIVE_STEEL, 1.15, 0.36, sd * 1.22)
        void w
      })
      const tailwheel = [
        c.wheel(-7.7, 0, 0.2, 0.14, { rim: RIMO, spokes: 0, noPart: true, label: trl('labels.tail_wheel') }),
        c.rod(new V3(-7.7, 0.2, 0), new V3(-7.55, 2.0, 0), 0.05, OLIVE_STEEL),
        c.rod(new V3(-7.7, 0.25, 0), new V3(-7.2, 2.05, 0), 0.035, OLIVE_STEEL),
      ]
      /* engine cowling, air intakes, exhausts with an IR suppressor */
      c.roundBox(3.4, 0.5, 1.5, 0.22, paint, -0.8, 2.75, 0, { def: true })
      ;[1, -1].forEach(function (sd) {
        c.cylinder(0.3, 0.27, 2.1, paint, -0.9, 2.82, sd * 0.78, 'x', { seg: 20 })
        c.cylinder(0.22, 0.22, 0.05, MT.dark, 0.16, 2.82, sd * 0.78, 'x', { seg: 20 })
        c.cylinder(0.24, 0.24, 0.08, OLIVE_STEEL, 0.18, 2.82, sd * 0.78, 'x', { seg: 20, open: true })
        const ex = c.cylinder(0.2, 0.25, 0.7, dark, -2.15, 2.85, sd * 1.0, 'x', { seg: 16 })
        ex.rotation.y = sd * 0.5
        c.cylinder(0.17, 0.17, 0.02, MT.dark, -2.47, 2.85, sd * 1.18, 'x').rotation.y = sd * 0.5
      })
      c.cylinder(0.12, 0.14, 0.55, OLIVE_STEEL, 0.0, 3.25, 0)
      c.cylinder(0.32, 0.28, 0.12, BARREL, 0.0, 3.15, 0)
      /* 4-blade main rotor with swept tips */
      const mr = militaryRotor(c, 0.0, 3.58, 0, 4, 7.78, 0.53, CM('#23251f', { roughness: 0.55 }), {
        hub: 0.4,
        droop: 0.32,
        tip: CM('#b9a640', { roughness: 0.5 }),
        v: 2.6,
        phase: PI / 4,
      })
      /* tail: inclined pylon, tail rotor on the right, stabilizer */
      const py = c.roundBox(1.0, 1.65, 0.22, 0.08, paint, -9.15, 3.1, 0, { taper: { sx: 0.6, shift: -0.4 }, def: true })
      void py
      const trg = new THREE.Group()
      trg.position.set(-9.6, 3.62, 0.3)
      trg.rotation.x = -0.35
      c.vehicle.add(trg)
      const tr = militaryRotor(c, 0, 0, 0, 4, 1.555, 0.24, CM('#23251f', { roughness: 0.55 }), {
        axis: 'z',
        hub: 0.12,
        hubR: 0.12,
        v: 14,
        th: 0.03,
      })
      c.vehicle.remove(tr)
      trg.add(tr)
      /* stabilizer in two halves (the lower one folds when the helicopter tips over) */
      const stab = [1, -1].map(function (sd) {
        return c.roundBox(1.0, 0.06, 2.2, 0.03, paint, -9.05, 2.3, sd * 1.1, { def: true })
      })
      const stripes = [1, -1].map(function (sd) {
        return c.roundBox(0.8, 0.012, 0.06, 0.004, MT.amber, -9.05, 2.34, sd * 2.1)
      })
      /* antennas, pitots, wire cutter, navigation lights */
      ;[1, -1].forEach(function (sd) {
        c.rod(new V3(3.3, 1.75, sd * 0.35), new V3(3.95, 1.75, sd * 0.4), 0.015, OLIVE_STEEL)
      })
      c.roundBox(0.6, 0.25, 0.04, 0.01, OLIVE_STEEL, 2.9, 2.5, 0, { rot: [0, 0, -0.6] })
      c.roundBox(0.5, 0.2, 0.04, 0.01, OLIVE_STEEL, 3.15, 0.9, 0, { rot: [0, 0, 0.5] })
      c.sphere(0.05, CM('#1d7a3a', { emissive: new THREE.Color('#2fbf5a'), emissiveIntensity: 1.0 }), -0.3, 2.3, 1.2)
      c.sphere(0.05, CM('#8a1a14', { emissive: new THREE.Color('#c0281c'), emissiveIntensity: 1.0 }), -0.3, 2.3, -1.2)
      c.cylinder(0.1, 0.08, 0.15, OLIVE_STEEL, 2.3, 0.62, 0.3)
      c.cylinder(0.08, 0.08, 0.02, MT.head, 2.3, 0.54, 0.3)
      antenna(c, -3.6, 2.5, 0, 0.9)
      c.part('rotor', trl('labels.main_rotor'), mr, new V3(0, 3.58, 0), 2.2)
      c.part('tail_rotor', trl('labels.tail_rotor'), tr, new V3(-9.6, 3.62, 0.3), 1.2)
      c.part('engine', trl('labels.turboshafts'), null, new V3(-0.9, 2.82, 0), 1.0)
      c.part('fuel_tank', trl('labels.jet_a_1_tanks'), null, new V3(-2.2, 1.0, 0), 1.0)
      c.part('landing_gear', trl('labels.landing_gear'), null, new V3(1.15, 0.3, 1.3), 1.0)
      c.part('fuselage', trl('labels.troop_cabin'), null, new V3(-0.8, 1.6, 1.15), 1.2)
      c.part('fuselage', trl('labels.tail_cone'), null, new V3(-5.5, 2.2, 0.3), 1.6)
      c.part('cab', trl('labels.flight_deck'), null, new V3(3.0, 1.8, 0), 1.0)
      c.part('avionics', trl('labels.nose_avionics'), null, new V3(3.45, 1.35, 0), 1.0)
      c.part('fuselage', trl('labels.rear_fuselage'), null, new V3(-3.3, 1.5, 0), 1.2)
      c.part('fuselage', trl('labels.low_tail_and_tail_wheel'), null, new V3(-7.6, 1.5, 0), 1.2)
      c.parts.forEach(function (p: any) {
        if (p.label === trl('labels.windshield')) {
          p.pos.set(3.0, 2.1, 0)
          p.reach = 1.0
        }
      })
      c.part('tail', trl('labels.pylon_and_stabilizer'), null, new V3(-9.1, 2.8, 0), 1.6)
      Object.assign(c.meta, {
        kind: 'heli',
        color: col,
        length: 13.25,
        width: 2.4,
        fuselageWidth: 2.36,
        front: 3.6,
        rear: -9.65,
        clearance: 0.67,
        belt: 1.5,
        bodyHeight: 1.3,
        top: 3.7,
        fuselageTop: 2.57,
        roof: null,
      })
      /* rollover: the helicopter tips onto its side (90 degrees), as in real accidents; the blades break on the ground */
      function breakBlades(c2: any) {
        if (mr.userData.broken) return
        mr.userData.broken = true
        c2.spin = c2.spin.filter(function (sp: any) {
          return sp.o !== mr
        })
        const sphi = Math.sin(((c2.militaryRollSide || 1) * PI) / 2),
          hubH = 1.35
        mr.children.forEach(function (piv: any, i: any) {
          if (!piv.isGroup) return
          const a = mr.rotation.y + piv.rotation.y,
            dz = -Math.sin(a),
            d = dz * sphi
          let k
          if (d > 0.05) k = Math.max(0.02, Math.min(0.4, (hubH / d - 0.4) / 7.6))
          else k = 0.16 + 0.22 * kit.hash(i, 3, 7)
          const b = piv.children[0]
          b.scale.x = k
          b.position.x = 0.4 * (1 - k)
          if (piv.children[1]) piv.remove(piv.children[1])
          piv.rotation.z += (kit.hash(i, 5, 1) - 0.5) * 0.35
        })
        const hp = c2.toEffects(new V3(0, 3.58, 0))
        kit.burst(c2, 'scrap', hp, 12, { speed: 4, spread: 2, mat: CM('#23251f', { roughness: 0.55 }) })
        kit.burst(c2, 'spark', hp, 26, { speed: 4, spread: 2 })
        const rp = c2.parts.find(function (p: any) {
          return p.kind === 'rotor'
        })
        if (rp && !rp.done) {
          rp.done = true
          c2.log.push(rp)
        }
      }
      rollover(c, {
        onStart: function (c2: any, A: any) {
          A.target = PI / 2
        },
        onRoll: function (c2: any, A: any) {
          if (A.last >= 1 && A.last < 3) A.last = 3
          if (A.t / A.dur > 0.33) breakBlades(c2)
        },
        onFlip: function (c2: any) {
          breakBlades(c2)
          const sd = c2.militaryRollSide || 1,
            half = stab[sd > 0 ? 0 : 1]
          half.scale.z = 0.35
          half.position.z = sd * 0.42
          half.rotation.x = sd * 0.5
          kit.burst(c2, 'scrap', c2.toEffects(new V3(-9.05, 2.3, sd * 1.6)), 5, { speed: 2, mat: paint })
        },
      })
      /* zones: automatic derivation puts the troop cabin inside the cone; here each section of the helicopter has its own */
      const fz = 1.18 + 0.3
      c.zone('nose', trl('labels.nose_and_windshield'))
      c.zone('cab', trl('labels.flight_deck_and_pilot_doors'), [1.05, 2.45, 0.6, 2.7, -fz, fz], null, {
        dir: 'left',
        fxKey: 'aircraft_cabin',
        who: trl('who.the_pilots'),
      })
      c.zone('troop_cabin', trl('labels.troop_cabin_and_sliding_doors'), [-2.95, 1.05, 0.6, 2.6, -fz - 0.1, fz + 0.1], null, {
        dir: 'left',
        fxKey: 'cab',
        who: trl('who.the_soldiers'),
        anyMesh: true,
      })
      /* the core folds the cone (dent and destroyed) by rotating what is behind the crease, but skips parts of another zone:
       the pylon and the stabilizer (zone "pylon") rotate here along with it, otherwise they hang in the air; torn off takes the whole tail */
      const coneB = [-8.7, -2.95, 1.2, 2.9]
      c.zone('tail_cone', trl('labels.tail_cone'), [coneB[0], coneB[1], coneB[2], coneB[3], -0.9, 0.9], null, {
        dir: 'up',
        fxKey: 'tail_cone',
        cutAll: true,
        anyMesh: true,
        onBand: function (c2: any, b: any) {
          const tail = [py].concat(stab)
          if (b === 4) {
            /* the whole tail goes away: pylon, stabilizer, rotor, tail wheel and the cone tip that is outside the box */
            tail.concat(stripes, tailwheel, [trg]).forEach(function (o) {
              o.visible = false
            })
            kit.cutMesh(fus, [boxCut(-9.5, coneB[0] + 0.05, 0, 4.5, 2)], 30)
            return
          }
          if (b < 2) return
          const kx = coneB[0] + (coneB[1] - coneB[0]) * (b === 2 ? 0.55 : 0.62),
            ky = (coneB[2] + coneB[3]) / 2,
            ang = b === 2 ? 0.035 : 0.16
          const q = new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), ang),
            cs = Math.cos(ang),
            sn = Math.sin(ang)
          tail.forEach(function (o) {
            const dx = o.position.x - kx,
              dy = o.position.y - ky
            o.position.x = kx + dx * cs - dy * sn
            o.position.y = ky + dx * sn + dy * cs
            o.quaternion.premultiply(q)
          })
        },
      })
      c.zone('pylon', trl('labels.pylon_and_stabilizer'), [-9.8, -8.6, 1.9, 4.05, -2.4, 2.4], [py].concat(stab), {
        type: 'part',
        fxKey: 'tail',
        dir: 'front',
        anyMesh: true,
      })
      c.zone('engine', trl('labels.turboshafts_and_transmission'), [-2.6, 0.4, 2.3, 3.35, -1.15, 1.15], null, {
        type: 'internal',
        fxKey: 'engine',
        sub: 'engine',
        pos: new V3(-0.9, 2.82, 0),
      })
      c.meta.armor = function (c2: any) {
        blackhawkMod(c2, paint)
      }
    },
  )
  function blackhawkMod(c: any, paint: any) {
    /* external armament wings with auxiliary tanks, machine guns in the gunner windows, flare launchers */
    const tankM = paintMat(c, '#3a4030')
    ;[1, -1].forEach(function (sd) {
      c.roundBox(0.75, 0.08, 2.6, 0.03, paint, -0.6, 2.25, sd * 2.4, { rot: [sd * -0.12, 0, 0] })
      c.rod(new V3(-0.6, 1.2, sd * 1.1), new V3(-0.6, 2.15, sd * 3.2), 0.03, OLIVE_STEEL)
      ;[1.9, 3.3].forEach(function (z) {
        c.cylinder(0.32, 0.32, 2.2, tankM, -0.6, 1.85, sd * z, 'x', { seg: 20 })
        c.sphere(0.32, tankM, 0.5, 1.85, sd * z, 1.8, 1, 1)
        c.sphere(0.32, tankM, -1.7, 1.85, sd * z, 1.5, 1, 1)
        c.roundBox(0.4, 0.15, 0.06, 0.02, OLIVE_STEEL, -0.6, 2.1, sd * z)
      })
      machineGun(c, 0.62, 1.95, sd * 1.25, { len: 1.0, yaw: -sd * 1.3 })
      c.roundBox(0.3, 0.2, 0.15, 0.03, OLIVE_STEEL, -2.9, 1.0, sd * 0.95)
      c.roundBox(0.04, 0.6, 0.45, 0.01, kit.steelMaterial, 1.6, 1.65, sd * 1.12)
    })
    c.part('fuel_tank', trl('labels.external_tanks'), null, new V3(-0.6, 1.85, 2.6), 1.2)
  }
}
