/** Rollover physics and the rolled-over state. */
import type { Kit } from './types'
import { hash } from './util'

export function installRollover(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._
  const { MATERIALS } = I

  /* ================= rollover ================= */
  /* Rolls the vehicle sideways around the longitudinal axis (x). s = +1 falls to the right, -1 to the left.
     The support comes from the real shape: the convex hull (y, z) of all visible meshes (except decals, particles and thin rods),
     plus meta.rollRest [[y, z]...] and meta.rollTop if declared. The contact point stays still on the ground while the vehicle turns. */
  function rollMeshes(c: any) {
    const list: any = []
    const thin: any = []
    c.root.updateMatrixWorld(true)
    const inv = new THREE.Matrix4().copy(c.vehicle.matrixWorld).invert()
    c.vehicle.traverse(function (ob: any) {
      if (!ob.isMesh || !ob.geometry || !ob.geometry.attributes.position) return
      for (let q = ob; q && q !== c.vehicle; q = q.parent) if (!q.visible || q.userData.decal || q.userData.ghost) return
      const M = new THREE.Matrix4().multiplyMatrices(inv, ob.matrixWorld)
      if (!ob.geometry.boundingBox) ob.geometry.computeBoundingBox()
      const sz = ob.geometry.boundingBox.getSize(new V3())
      const sc = new V3().setFromMatrixScale(M)
      const d = [sz.x * sc.x, sz.y * sc.y, sz.z * sc.z].sort(function (a, b) {
        return a - b
      })
      /* `antena` is the original spelling of the flag */
      if (ob.userData.antenna || ob.userData.antena || (d[1] < 0.045 && d[2] > 0.2)) {
        thin.push({ o: ob, M: M })
        return
      }
      list.push({ o: ob, M: M })
    })
    return { list: list, thin: thin }
  }
  function convexHull(pts: any) {
    pts.sort(function (a: any, b: any) {
      return a[1] - b[1] || a[0] - b[0]
    })
    function cr(o: any, a: any, b: any) {
      return (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1])
    }
    const lo: any = []
    const up = []
    pts.forEach(function (p: any) {
      while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop()
      lo.push(p)
    })
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i]
      while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop()
      up.push(p)
    }
    up.pop()
    lo.pop()
    return lo.concat(up)
  }
  kit.roll = function (c: any, s: any) {
    if (c.rollState || c.flipped) return false
    s = s || 1
    const m = c.meta
    const bike = m.kind === 'bike'
    const R = rollMeshes(c)
    let pts: any = []
    const v = new V3()
    let yc = 0
    let zc = 0
    let n = 0
    R.list.forEach(function (e: any) {
      const pos = e.o.geometry.attributes.position
      const st = Math.max(1, Math.floor(pos.count / 600))
      for (let i = 0; i < pos.count; i += st) {
        v.fromBufferAttribute(pos, i).applyMatrix4(e.M)
        pts.push([v.y, v.z])
        yc += v.y
        zc += v.z
        n++
      }
    })
    ;(m.rollRest || []).forEach(function (q: any) {
      pts.push([q[0], q[1]])
    })
    if (m.rollTop)
      [-1, 1].forEach(function (k) {
        pts.push([m.rollTop, k * m.width * 0.3])
      })
    if (pts.length < 3)
      pts = [
        [0, -m.width / 2],
        [0, m.width / 2],
        [m.top, m.width / 2],
        [m.top, -m.width / 2],
      ]
    const S = convexHull(pts)
    c.rollState = {
      t: 0,
      dur: bike ? 0.9 : m.kind === 'bus' || m.kind === 'truck' ? 2.0 : 1.6,
      s: s,
      S: S,
      last: -1,
      cz: c.vehicle.position.z,
      target: bike ? PI / 2 : PI,
      x: ((m.front || 1) + (m.rear || -1)) / 2,
      L: m.length || 2,
      bounce: 0,
      cen: [n ? yc / n : m.top / 2, n ? zc / n : 0],
      hitAt: null,
      hits: 0,
      thin: R.thin,
      y0: c.vehicle.position.y,
    }
    if (c.hood) c.hood.target = 0
    return true
  }
  function rollContact(c: any, A: any, q: any) {
    const m = c.meta
    const list: any = []
    const dy = A.cen[0] - q[0]
    const dz = A.cen[1] - q[1]
    const dl = Math.hypot(dy, dz) || 1
    const dir = new V3(0, dy / dl, dz / dl)
    const f = 0.75
    const bike = m.kind === 'bike'
    ;(bike ? [0] : [-0.28, 0, 0.28]).forEach(function (k) {
      list.push([new V3(A.x + k * A.L, q[0], q[1]), dir])
    })
    /* lying on its side: the window strip touches the ground too */
    if (!bike && Math.abs(dir.z) > 0.75 && m.top - m.belt > 0.25 && A.hits < 3) {
      const sd = -Math.sign(dir.z)
      const yw = m.belt + (m.top - m.belt) * 0.45
      ;[-0.25, 0.2].forEach(function (k) {
        const h = I.probe(c, new V3(A.x + k * A.L, yw, sd * (m.width / 2 + 2)), new V3(0, 0, -sd), 2 + m.width)
        if (h) list.push([h.p, new V3(0, 0, -sd)])
      })
    }
    list.forEach(function (e: any) {
      I.impact(c, e[0], e[1], f, { noStain: true, maxDepth: 0.1 })
      const pf = c.toEffects(e[0])
      pf.y = Math.max(0.03, pf.y)
      I.burst(c, 'dust', pf.clone().setY(0.1), 4, { speed: 0.9, spread: 2.2, jitter: 0.4, s: 1.2 })
      I.burst(c, 'spark', pf, 14, { speed: 3, spread: 1.6 })
      I.burst(c, 'shard', pf, 4, { speed: 1.5 })
    })
    A.hits++
    A.bounce = A.hits === 1 ? 0.06 : 0.1
    if (m.kind === 'boat') I.burst(c, 'water', c.toEffects(list[0][0]).setY(0.05), 30, { speed: 3 })
  }
  /* lowest y (in the c.root frame) of all supporting meshes, vertex by vertex */
  function exactMinY(c: any, list: any) {
    c.root.updateMatrixWorld(true)
    const inv = new THREE.Matrix4().copy(c.root.matrixWorld).invert()
    const M = new THREE.Matrix4()
    const v = new V3()
    let mn = 1e9
    list.forEach(function (e: any) {
      const ob = e.o
      if (!ob.parent || !I.shown(c, ob)) return
      M.multiplyMatrices(inv, ob.matrixWorld)
      const pos = ob.geometry.attributes.position
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(M)
        if (v.y < mn) mn = v.y
      }
    })
    return mn
  }
  function finishRoll(c: any) {
    const A = c.rollState
    const m = c.meta
    c.rollState = null
    c.flipped = true
    c.vehicle.rotation.x = A.s * A.target
    if (A.hits < 2 && m.kind !== 'bike') {
      const cs = Math.cos(c.vehicle.rotation.x)
      const sn = Math.sin(c.vehicle.rotation.x)
      let best = null
      let by = 1e9
      A.S.forEach(function (q: any) {
        const y = q[0] * cs - q[1] * sn
        if (y < by) {
          by = y
          best = q
        }
      })
      if (best) rollContact(c, A, best)
    }
    /* settles on the real lowest point (the dented roof and rigid parts count) */
    const R = rollMeshes(c)
    const mn = exactMinY(c, R.list)
    if (mn < 1e8) c.vehicle.position.y -= mn
    /* thin rods (antennas, sticks) that would go through the ground break and shed pieces */
    c.root.updateMatrixWorld(true)
    const inv = new THREE.Matrix4().copy(c.root.matrixWorld).invert()
    R.thin.forEach(function (e: any) {
      const ob = e.o
      const bb = new THREE.Box3().setFromObject(ob).applyMatrix4(inv)
      if (bb.min.y < -0.01 && ob.parent) {
        const pf = bb.getCenter(new V3())
        pf.y = Math.max(0.05, pf.y)
        ob.visible = false
        I.burst(c, 'plastic', pf, 3, { speed: 1.2 })
        I.burst(c, 'spark', pf, 5, { speed: 2 })
      }
    })
    /* upside-down helicopter: the blades that would go through the ground break into pieces */
    if (m.kind === 'heli')
      c.parts.forEach(function (p: any) {
        if ((p.kind !== 'rotor' && p.kind !== 'tail_rotor') || !p.obj) return
        const main = p.kind === 'rotor'
        p.obj.traverse(function (o: any) {
          if (!o.isMesh || !o.visible) return
          const bb = new THREE.Box3().setFromObject(o).applyMatrix4(inv)
          if (!main && bb.min.y >= -0.01) return
          const pf = bb.getCenter(new V3())
          pf.y = Math.max(0.05, Math.min(pf.y, 0.4))
          o.visible = false
          I.burst(c, 'scrap', pf, 3, { speed: 1.4, mat: o.material && !Array.isArray(o.material) ? o.material : MATERIALS.trim })
          I.burst(c, 'spark', pf, 6, { speed: 2.2 })
          I.burst(c, 'dust', pf.clone().setY(0.1), 2, { speed: 0.8, s: 1.1 })
        })
        c.spin = c.spin.filter(function (sp: any) {
          return sp.o !== p.obj
        })
      })
    if (m.kind === 'heli') {
      const mn2 = exactMinY(c, R.list)
      if (mn2 < 1e8 && Math.abs(mn2) > 0.005) c.vehicle.position.y -= mn2
    }
    if (m.kind === 'boat') {
      c.vehicle.position.y -= 0.45
      c.sunk = c.vehicle.position.y
    }
    c.wheels.forEach(function (w: any, i: any) {
      c.spin.push({ o: w, axis: 'z', v: 2.2 + hash(i, 2, 3) * 2, decay: 0.12 })
    })
    const mot = c.parts.find(function (p: any) {
      return p.kind === 'engine'
    })
    if (mot && m.kind !== 'boat') kit.addEmitter(c, mot.pos.clone().add(new V3(0, -0.3, 0)), 'black', { rate: 4 })
  }
  function tickRoll(c: any, dt: any) {
    const A = c.rollState
    A.t += dt
    const p = Math.min(1, A.t / A.dur)
    const e = p * p * (3 - 2 * p)
    const phi = A.s * A.target * e
    const cs = Math.cos(phi)
    const sn = Math.sin(phi)
    let minY = 1e9
    let idx = 0
    A.S.forEach(function (q: any, i: any) {
      const y = q[0] * cs - q[1] * sn
      if (y < minY - 1e-6) {
        minY = y
        idx = i
      }
    })
    const q = A.S[idx]
    const zi = q[0] * sn + q[1] * cs
    if (idx !== A.last) {
      if (A.last < 0) A.cz = c.vehicle.position.z + zi
      else {
        const pq = A.S[A.last]
        A.cz += zi - (pq[0] * sn + pq[1] * cs)
      }
      A.last = idx
      if (A.t > 0.15 && (!A.hitAt || Math.hypot(q[0] - A.hitAt[0], q[1] - A.hitAt[1]) > 0.35)) {
        A.hitAt = q
        c.vehicle.rotation.x = phi
        c.vehicle.position.y = -minY
        c.vehicle.position.z = A.cz - zi
        rollContact(c, A, q)
      }
    }
    A.bounce = Math.max(0, A.bounce - dt * 0.5)
    c.vehicle.rotation.x = phi
    c.vehicle.position.y = -minY + Math.sin(Math.min(1, A.bounce / 0.1) * PI) * A.bounce * 0.6
    c.vehicle.position.z = A.cz - zi
    if (p >= 1) finishRoll(c)
  }
  kit.rollContact = rollContact

  Object.assign(I, { rollMeshes, convexHull, rollContact, exactMinY, finishRoll, tickRoll })
}
