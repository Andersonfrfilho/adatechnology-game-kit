/** Impact resolution: direction, surface lookup, deformation, shards and sparks. */
import type { Kit } from './types'
import { clamp, hash, markDecal } from './util'

export function installImpact(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._
  const { makeMaterial, DOUBLE_SIDE, crease, paintColor } = I

  /* ================= impact ================= */
  /* Dent field: smooth falloff (smoothstep), low-frequency ripple (<= 0.015), never crosses the centre plane. */
  function dentField(v: any, H: any) {
    const d = v.distanceTo(H.p)
    if (d >= H.R) return 0
    const t = 1 - d / H.R
    const f = t * t * (3 - 2 * t)
    const a = H.depth * f + 0.015 * f * Math.sin(v.x * 2.1 + v.z * 1.7 + H.ph) * Math.cos(v.y * 1.9)
    const lim = -((v.x - H.C.x) * H.dir.x + (v.y - H.C.y) * H.dir.y + (v.z - H.C.z) * H.dir.z) - 0.03
    return Math.max(0, Math.min(a, lim))
  }
  /* The bumper comes loose on the side of the hit and hangs from the other side (does not fly): the real part rotates around the attached end,
     without swapping the geometry, and the angle is limited so the loose end touches the ground without going through it (and does not become a pole on a tall vehicle). */
  function hangBumper(c: any, o: any, p: any) {
    if (!o || o.userData.hung || !o.parent || c.meta.noBumper) return
    o.userData.hung = true
    const di = c.deform.indexOf(o)
    if (di >= 0) c.deform.splice(di, 1)
    o.updateMatrix()
    o.geometry.computeBoundingBox()
    const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrix)
    const wz = (bb.max.z - bb.min.z) * 0.97
    const hh = (bb.max.y - bb.min.y) / 2
    if (wz < 0.2) return
    const att = p.z >= (bb.min.z + bb.max.z) / 2 ? -1 : 1
    const par = o.parent
    const sx = o.position.x >= 0 ? 1 : -1
    const zc = (bb.min.z + bb.max.z) / 2
    const piv = new THREE.Group()
    piv.position.set(o.position.x, o.position.y, zc + (att * wz) / 2)
    par.add(piv)
    par.remove(o)
    piv.add(o)
    o.position.set(0, 0, o.position.z - piv.position.z)
    piv.userData.rigid = true
    piv.userData.noFollow = true
    const drop = Math.max(0.0, piv.position.y - hh - 0.01)
    const th = Math.min(Math.asin(Math.min(0.98, drop / wz)), 0.42)
    piv.rotation.x = -att * th
    piv.rotation.y = -0.1 * sx * att
  }
  /* fuel of the tank that was hit: the part label wins ("diesel"), otherwise the vehicle sheet */
  function tankFuel(c: any, pt: any) {
    const lb = (pt.label || '').toLowerCase()
    const fu = c.spec && c.spec.fuel
    if (pt.fuel === 'diesel' || kit.matchers.diesel.test(lb)) return 'diesel'
    if ((pt.fuel === 'gasoline' || kit.matchers.fuel.test(lb)) && fu !== 'diesel') return 'gasoline'
    return fu === 'diesel' ? 'diesel' : fu === 'electric' || fu === 'none' ? null : 'gasoline'
  }
  function hurtEngine(c: any, h: any) {
    c.engineHealth = Math.min(c.engineHealth == null ? 1 : c.engineHealth, h)
  }
  kit.hurtEngine = hurtEngine
  function igniteFuel(c: any, pd: any) {
    if (!pd || pd.kind !== 'gasoline' || pd.fire) return
    pd.fire = true
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * PI * 2 + c.rand()
      const r = pd.max * 0.35 * c.rand()
      kit.addEmitter(c, new V3(pd.x0 + Math.cos(a) * r, 0.05, pd.z0 + Math.sin(a) * r), 'fire', { world: true, rate: 9, s: 1.2 })
    }
    I.burst(c, 'spark', new V3(pd.x0, 0.1, pd.z0), 14, { speed: 2.5 })
  }
  kit.igniteFuel = igniteFuel
  function applyPart(c: any, pt: any, force: any, dir: any, p: any) {
    const k = pt.kind
    const o = pt.obj
    const m = c.meta
    if (pt.onHit) return pt.onHit(c, pt, force, dir, p)
    if (k === 'headlight' || k === 'taillight') I.breakLight(c, pt.light, dir)
    else if (k === 'glass') I.hitGlass(c, o, p, dir, force)
    else if (k === 'wheel') {
      if (o && !o.userData.flat) {
        o.userData.flat = true
        o.scale.y = 0.74
        o.position.y -= o.userData.r * 0.24
        o.rotation.y += (hash(o.position.x, 1, 1) - 0.5) * 0.25
      }
    } else if (k === 'bumper') {
      if (o && force > 0.6) hangBumper(c, o, p)
    } else if (k === 'radiator') {
      kit.addEmitter(c, pt.pos.clone().add(new V3(-0.1, 0.25, 0)), 'white')
      hurtEngine(c, 0.6)
    } else if (k === 'engine') {
      kit.addEmitter(c, pt.pos.clone().add(new V3(0, 0.3, 0)), 'black')
      hurtEngine(c, force > 1.1 ? 0.1 : 0.3)
      if (c.hood && force > 0.5 && !c.hood.noLatch) {
        c.hood.latch = Math.max(c.hood.latch, 0.15)
      }
      if (m.kind !== 'boat' && m.kind !== 'plane' && m.kind !== 'heli')
        I.puddle(c, 'oil', pt.pos.clone().setY(Math.max(0.2, m.clearance || 0.3)), 0.55 + force * 0.25)
    } else if (k === 'hood') {
      if (c.hood && force > 0.4 && !c.hood.noLatch) c.hood.latch = Math.max(c.hood.latch, 0.15)
    } else if (k === 'fuel_tank') {
      const fu = tankFuel(c, pt)
      if (m.kind !== 'boat' && fu) {
        const pd = I.puddle(c, fu, pt.pos, (fu === 'diesel' ? 1.0 : 0.9) + force * 0.7)
        if (fu === 'gasoline' && force >= 1.0) igniteFuel(c, pd)
      }
      if (fu === 'gasoline' && force >= 1.0) kit.blastDamage(c, force * 180)
    } else if (k === 'battery') {
      kit.addEmitter(c, pt.pos.clone().add(new V3(0, 0.15, 0)), 'fire')
      kit.addEmitter(c, pt.pos.clone().add(new V3(0, 0.7, 0)), 'black', { rate: 3 })
    } else if (k === 'hull') {
      c.sunk = Math.max((c.sunk || 0) - 0.3 * force, -(m.belt || 0.5) * 0.45)
      c.vehicle.rotation.x += 0.06 * force
      I.burst(c, 'water', c.toEffects(p).setY(0.05), 20, { speed: 2.5 })
    } else if (k === 'armor') {
      I.burst(c, 'spark', c.toEffects(p), 18, { dir: c.dirToEffects(dir.clone().negate()), speed: 3.5, spread: 1.5 })
    } else if (k === 'stern') {
      if (o) {
        o.rotation.z = 0.5
        o.position.y -= 0.1
      }
    } else if (k === 'propeller' || k === 'rotor' || k === 'tail_rotor') {
      if (o) {
        o.children.forEach(function (ch: any, i: any) {
          if (ch.type === 'Group') {
            ch.rotation.z += -0.15 - hash(i, 1, 1) * 0.25
            ch.rotation.x += i % 2 ? 0.2 : -0.2
          }
        })
        c.spin = c.spin.filter(function (s: any) {
          return s.o !== o
        })
      }
    } else if (k === 'landing_gear') {
      c.vehicle.rotation.x += (m.kind === 'plane' ? 0.2 : 0.13) * (pt.pos.z < 0 ? -1 : 1)
      c.vehicle.position.y -= 0.12
    }
  }
  kit.applyPart = applyPart
  const SCRATCH_MATERIAL = makeMaterial('#9da3a6', { metalness: 0.85, roughness: 0.35 })
  const SOOT_MATERIAL = makeMaterial('#141312', {
    roughness: 1,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  })
  const _ray = new THREE.Raycaster()
  function findSurface(c: any, p: any, dir: any) {
    c.root.updateMatrixWorld(true)
    const Mw = c.vehicle.matrixWorld
    const o = p.clone().addScaledVector(dir, -1.2).applyMatrix4(Mw)
    const d = dir.clone().transformDirection(Mw)
    _ray.set(o, d)
    _ray.far = 1.2 + 0.45
    const hits = _ray.intersectObject(c.vehicle, true)
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i]
      const ob = h.object
      let vis = true
      for (let q = ob; q && q !== c.vehicle; q = q.parent)
        if (!q.visible) {
          vis = false
          break
        }
      if (!vis || ob.userData.decal || ob.userData.ghost || !h.face) continue
      const inv = new THREE.Matrix4().copy(Mw).invert()
      const lp = h.point.clone().applyMatrix4(inv)
      const n = h.face.normal.clone().transformDirection(ob.matrixWorld).transformDirection(inv)
      if (n.dot(dir) > 0) n.negate()
      return { p: lp, n: n, obj: ob }
    }
    return null
  }
  function scratches(c: any, p: any, dir: any, force: any) {
    const d = dir.clone().normalize()
    const t1 = new V3().crossVectors(d, Math.abs(d.y) > 0.9 ? new V3(1, 0, 0) : new V3(0, 1, 0)).normalize()
    const t2 = new V3().crossVectors(d, t1)
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(1, 0, 0), t1)
    const n = 3 + Math.round(force * 3)
    for (let i = 0; i < n; i++) {
      const a = hash(p.x * 7 + i, p.y * 5, p.z * 3) - 0.5
      const b = hash(i, p.x * 3, p.z * 7) - 0.5
      const len = 0.22 + force * 0.3 * hash(i, 9, p.y)
      const m = c.add(new THREE.BoxGeometry(len, 0.01, 0.005), SCRATCH_MATERIAL, 0, 0, 0)
      m.castShadow = false
      m.userData.decal = true
      m.position
        .copy(p)
        .addScaledVector(t1, a * 0.5)
        .addScaledVector(t2, b * 0.35)
        .addScaledVector(d, -0.008)
      m.quaternion.copy(q)
      m.rotation.z += (a - b) * 0.25
    }
    const sr = 0.12 + force * 0.1
    const ss = new THREE.Shape()
    const nzs = I.valueNoise(Math.floor(hash(p.x, p.y, p.z) * 997))
    for (let k = 0; k <= 20; k++) {
      const an = (k / 20) * PI * 2
      const rr = sr * (0.6 + 0.6 * nzs(Math.cos(an) * 2 + 5, Math.sin(an) * 2 + 5))
      ss[k ? 'lineTo' : 'moveTo'](Math.cos(an) * rr * 1.3, Math.sin(an) * rr)
    }
    const soot = c.add(new THREE.ShapeGeometry(ss), SOOT_MATERIAL, 0, 0, 0)
    soot.castShadow = false
    soot.userData.decal = true
    soot.position.copy(p).addScaledVector(d, -0.005)
    soot.lookAt(soot.position.clone().sub(d))
  }
  /* Impact at point p (c.vehicle coordinates), direction dir (into the vehicle), force 0.3..1.4. Returns the parts hit. */
  function impact(c: any, p: any, dir: any, force: any, opts?: any) {
    opts = opts || {}
    dir = dir.clone().normalize()
    const m = c.meta
    const air = m.kind === 'plane' || m.kind === 'heli'
    const Wref = air ? m.fuselageWidth || 1.3 : m.width || 1.7
    const R0 = (0.55 + 0.45 * force) * (air ? 1.25 : 1)
    /* depth: up to 18% of the width, never more than 0.3 m nor 35% of the dent radius; meta.stiff (0..1) hardens armour */
    const maxD = Math.min(0.18 * Wref, 0.26, R0 * 0.32, opts.maxDepth || 9) * (1 - 0.85 * clamp(m.stiff || 0, 0, 1))
    const H = {
      p: p,
      dir: dir,
      R: R0,
      depth: Math.min(maxD, (0.04 + 0.15 * force) * (1 - 0.85 * clamp(m.stiff || 0, 0, 1))),
      ph: hash(p.x, p.y, p.z) * 6,
      C: new V3(((m.front || 1) + (m.rear || -1)) / 2, (m.clearance || 0.3) + (m.bodyHeight || 0.6) * 0.5, 0),
    }
    c.root.updateMatrixWorld(true)
    const gInv = new THREE.Matrix4().copy(c.vehicle.matrixWorld).invert()
    const rel = new THREE.Matrix4()
    const irel = new THREE.Matrix4()
    const v = new V3()
    const v0 = new V3()
    const w = new V3()
    const sc = new V3()
    const cab = m.cabin && !c.flipped && !c.rollState ? m.cabin : null
    c.deform.forEach(function (msh: any) {
      if (!msh.parent || !msh.visible) return
      rel.multiplyMatrices(gInv, msh.matrixWorld)
      const g = msh.geometry
      const pos = g.attributes.position
      let changed = false
      if (!g.boundingSphere) g.computeBoundingSphere()
      sc.setFromMatrixScale(rel)
      v.copy(g.boundingSphere.center).applyMatrix4(rel)
      if (v.distanceTo(p) > H.R + g.boundingSphere.radius * Math.max(sc.x, sc.y, sc.z)) return
      irel.copy(rel).invert()
      if (!g.userData.p0) g.userData.p0 = new Float32Array(pos.array)
      const p0 = g.userData.p0
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(rel)
        const a = dentField(v, H)
        if (a <= 0) continue
        v.addScaledVector(dir, a)
        v0.set(p0[3 * i], p0[3 * i + 1], p0[3 * i + 2]).applyMatrix4(rel)
        w.subVectors(v, v0)
        if (w.length() > maxD) v.copy(v0).add(w.setLength(maxD))
        /* the bodywork does not enter the cabin: it stops at the outer face of the liner (meta.cabin) */
        if (cab && v0.x > cab.x0 && v0.x < cab.x1 && v0.y > cab.y0 && v0.y < cab.y1 && Math.abs(v0.z) >= cab.z && Math.abs(v.z) < cab.z)
          v.z = (v0.z > 0 ? 1 : -1) * cab.z
        v.applyMatrix4(irel)
        pos.setXYZ(i, v.x, v.y, v.z)
        changed = true
      }
      if (changed) {
        pos.needsUpdate = true
        if (g.userData.crease) crease(g, 42)
        else g.computeVertexNormals()
        g.computeBoundingSphere()
        g.computeBoundingBox()
      }
    })
    const dset = new Set(c.deform)
    const box = new THREE.Box3()
    c.vehicle.children.forEach(function (o: any) {
      if (dset.has(o) || o.userData.noFollow) return
      if (!(o.isMesh || (o.isGroup && o.userData.rigid))) return
      if (!o.userData.c0) {
        if (o.isMesh) {
          if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere()
          o.userData.c0 = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrix)
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
          o.userData.bb0 = o.geometry.boundingBox.clone().applyMatrix4(o.matrix)
        } else {
          box.setFromObject(o)
          box.applyMatrix4(gInv)
          o.userData.c0 = box.getCenter(new V3())
          o.userData.bb0 = box.clone()
        }
        o.userData.pos0 = o.position.clone()
      }
      const sh = new V3().subVectors(o.position, o.userData.pos0)
      let cen = o.userData.c0.clone().add(sh)
      const bb0 = o.userData.bb0
      /* thin panel along the impact direction (door liner, trim, plate): follows the dent from the point nearest the impact, so it does not stick out of the bodywork */
      if (bb0) {
        const ext = new V3().subVectors(bb0.max, bb0.min)
        if (Math.abs(ext.x * dir.x) + Math.abs(ext.y * dir.y) + Math.abs(ext.z * dir.z) < 0.1) {
          const bq = bb0.clone().translate(sh)
          cen = bq.clampPoint(p, new V3())
        }
      }
      const a = dentField(cen, H)
      if (a <= 0) return
      o.position.addScaledVector(dir, a)
      w.subVectors(o.position, o.userData.pos0)
      if (w.length() > maxD) o.position.copy(o.userData.pos0).add(w.setLength(maxD))
    })
    const hit: any = []
    c.parts.forEach(function (pt: any) {
      if (pt.done) return
      if (pt.pos.distanceTo(p) < H.R * pt.reach + 0.1) {
        pt.done = true
        applyPart(c, pt, force, dir, p)
        hit.push(pt)
      }
    })
    const pf = c.toEffects(p)
    const df = c.dirToEffects(dir.clone().negate())
    if (!opts.noFx) {
      if (m.kind === 'boat' && p.y < (m.belt || 0.5))
        I.burst(c, 'water', pf.clone().setY(Math.max(0.05, pf.y)), 18, { dir: df, speed: 2.2 })
      else I.burst(c, 'spark', pf, Math.round(8 + force * 16), { dir: df, speed: 2.5 + force * 2, spread: 1.4, jitter: 0.05 })
      if (force > 0.6) {
        I.burst(c, 'scrap', pf, Math.round(force * 5), {
          dir: df,
          speed: 1.4,
          mat: makeMaterial(paintColor(m.color || '#777', c.state), { roughness: 0.5, metalness: 0.3, side: DOUBLE_SIDE }),
        })
        I.burst(c, 'plastic', pf, 2, { dir: df, speed: 1.2 })
      }
    }
    /* stain (config.impactStain) and scratches only where there is bodywork (bikes and motorcycles are hollow) */
    const surf = findSurface(c, p, dir)
    if (surf) {
      if (kit.config.impactStain && !opts.noStain && force > 0.45 && !air && m.kind !== 'boat') {
        const sp = surf.p.clone().addScaledVector(surf.n, 0.002)
        markDecal(
          kit.splat(c, sp, surf.n, 0.08 + force * 0.04, {
            fluid: kit.config.impactStain,
            obj: surf.obj,
            glass: !!(surf.obj && surf.obj.userData.glass),
          }).grp,
        )
      }
      scratches(c, surf.p, surf.n.clone().negate(), force)
    }
    hit.forEach(function (pt: any) {
      c.log.push(pt)
    })
    return hit
  }
  kit.impact = impact
  /* Effect text per part kind (crash report). Empty in the SDK; the game plugin fills it (configure({ partEffects })). */
  kit.partEffects = {}
  /* ray in c.vehicle coordinates against the visible meshes of the vehicle (no decals); returns the first point */
  const _pr = new THREE.Raycaster()
  function probe(c: any, o: any, d: any, far: any) {
    c.root.updateMatrixWorld(true)
    const Mw = c.vehicle.matrixWorld
    const inv = new THREE.Matrix4().copy(Mw).invert()
    _pr.set(o.clone().applyMatrix4(Mw), d.clone().transformDirection(Mw))
    _pr.far = far || 10
    const hits = _pr.intersectObject(c.vehicle, true)
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i]
      const ob = h.object
      let ok = !!h.face
      for (let q = ob; ok && q && q !== c.vehicle; q = q.parent) if (!q.visible || q.userData.decal || q.userData.ghost) ok = false
      if (ok) return { p: h.point.clone().applyMatrix4(inv), obj: ob }
    }
    return null
  }
  kit.probe = probe
  function zoneImpact(c: any, zone: any, force: any) {
    const m = c.meta
    const mid = m.clearance + (m.bodyHeight || 0.6) * 0.5
    let p
    let dir
    const land = m.kind !== 'plane' && m.kind !== 'heli' && m.kind !== 'boat'
    if (zone === 'rolled') {
      kit.roll(c, 1)
      return []
    }
    if (zone === 'front') {
      p = new V3(m.front, mid, m.width * 0.15)
      dir = new V3(-1, 0, 0)
    } else if (zone === 'rear') {
      p = new V3(m.rear, mid, -m.width * 0.15)
      dir = new V3(1, 0, 0)
    } else if (zone === 'left') {
      p = new V3((m.front + m.rear) * 0.5 + m.length * 0.12, mid + 0.1, -m.width / 2)
      dir = new V3(0, 0, 1)
    } else {
      p = new V3((m.front + m.rear) * 0.5 - m.length * 0.1, mid + 0.1, m.width / 2)
      dir = new V3(0, 0, -1)
    }
    if (m.kind === 'plane' && (zone === 'left' || zone === 'right')) {
      p.set(0.2, m.top - 0.1, (zone === 'left' ? -1 : 1) * 4.2)
      dir.set(0, -0.6, 0)
    }
    if ((m.kind === 'plane' || m.kind === 'heli') && (zone === 'left' || zone === 'right') && m.fuselageWidth) {
      if (m.kind === 'heli') p.z = ((zone === 'left' ? -1 : 1) * m.fuselageWidth) / 2
    }
    if (m.kind === 'boat' && (zone === 'left' || zone === 'right')) p.y = m.belt - 0.2
    if (land && (zone === 'left' || zone === 'right') && !m.zoneFixed) {
      /* height from the real bodywork: buses and trucks aim between the belt line and the roof (windows); the others, at mid side.
         Tries several heights and keeps the first that finds bodywork on the outside. */
      const sd = zone === 'left' ? -1 : 1
      const tall = m.kind === 'bus' || m.kind === 'truck' || (m.belt > 1.5 && m.top - m.belt > 0.9)
      const yPref = tall ? m.belt + (m.top - m.belt) * 0.3 : mid + 0.1
      const ys = []
      for (let y = Math.max(0.12, m.clearance * 0.6); y < m.top - 0.04; y += 0.07) ys.push(y)
      ys.sort(function (a, b) {
        return Math.abs(a - yPref) - Math.abs(b - yPref)
      })
      for (let k = 0; k < ys.length; k++) {
        const h = probe(c, new V3(p.x, ys[k], sd * (m.width / 2 + 3)), new V3(0, 0, -sd), 3 + m.width * 0.45)
        if (h && Math.abs(h.p.z) > m.width * 0.22 && !(h.obj.parent && h.obj.parent.userData.r && c.wheels.indexOf(h.obj.parent) >= 0)) {
          p = h.p
          break
        }
      }
    }
    const hit = impact(c, p, dir, force)
    if (zone === 'front' && force > 0.7 && land) {
      /* a hard frontal impact cracks the windshield from its base (the body hits the glass) */
      const ws = c.parts.find(function (pt: any) {
        return (
          pt.kind === 'glass' &&
          !pt.done &&
          (pt.key ? pt.key === 'windshield' : kit.matchers.windshield.test(pt.label)) &&
          pt.obj &&
          pt.obj.userData.glass &&
          pt.obj.userData.glass.type === 'laminated'
        )
      })
      if (ws) {
        const g = ws.obj
        g.geometry.computeBoundingBox()
        const bb = g.geometry.boundingBox.clone().applyMatrix4(g.matrix)
        const pb = new V3(
          bb.max.x - (bb.max.x - bb.min.x) * 0.25,
          bb.min.y + (bb.max.y - bb.min.y) * 0.28,
          (bb.min.z + bb.max.z) / 2 + (bb.max.z - bb.min.z) * 0.18,
        )
        ws.done = true
        I.hitGlass(c, g, pb, new V3(-1, -0.2, 0), force * 0.9)
        hit.push(ws)
        c.log.push(ws)
      }
    }
    return hit
  }
  kit.zoneImpact = zoneImpact

  Object.assign(I, {
    dentField,
    hangBumper,
    tankFuel,
    hurtEngine,
    igniteFuel,
    applyPart,
    SCRATCH_MATERIAL,
    SOOT_MATERIAL,
    _ray,
    findSurface,
    scratches,
    impact,
    _pr,
    probe,
    zoneImpact,
  })
}
