/** Per-zone damage for body panels: doors, lids, hoods, roofs, hulls and wings. */
import type { Kit } from './types'
import { clamp } from './util'

export function installDamagePanels(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const I = kit._
  const { MATERIALS } = I

  /* ---- body panel (door, fender, side panel, roof, lid, armour, hull, wing) ---- */
  function panelBand(c: any, z: any, b: any, dirty: any) {
    const R = c.rand
    const inv = I.worldInverseOf(c)
    const B = z.box
    const d = z.dir
    const a = I.axisOf(d)
    const ax = [0, 1, 2].filter(function (k) {
      return k !== a
    })
    const u0 = I.boxLo(B, ax[0])
    const u1 = I.boxHi(B, ax[0])
    const v0 = I.boxLo(B, ax[1])
    const v1 = I.boxHi(B, ax[1])
    const lu = u1 - u0
    const lv = v1 - v0
    const depA = I.boxHi(B, a) - I.boxLo(B, a)
    const stiff = clamp(c.meta.stiff || 0, 0, 1) * (z.fxKey === 'armor' ? 1 : 0.6)
    const dk = 1 - 0.7 * stiff
    if (b === 0) {
      if (z.health < 92) I.zoneDecals(c, z, { fine: 2 }, I.zoneCands(c, z, inv))
      return
    }
    if (b === 4) {
      const mg = Math.min(0.05, lu * 0.08, lv * 0.08)
      let rect = [u0 + mg, u1 - mg, v0 + mg, v1 - mg]
      if (z.type === 'door' || z.type === 'lid') rect = [u0 + 0.03, u1 - 0.03, v0 + Math.min(0.08, lv * 0.1), v1 - 0.02]
      const pcs = I.cutPanel(c, z, rect, false, dirty)
      pcs.forEach(function (q: any) {
        if (q.whole) I.hideObj(c, q.mesh)
      })
      followersIn(c, z, inv).forEach(function (o: any) {
        I.hideObj(c, o)
      })
      /* owned parts (propeller, pylon, siren) disappear whole: cutting only the skin left pieces floating */
      z.owned.forEach(function (o: any) {
        if (o.parent && c.wheels.indexOf(o) < 0 && !o.userData.glass) I.hideObj(c, o)
      })
      c.spin = c.spin.filter(function (sp: any) {
        return I.shown(c, sp.o)
      })
      if (z.type === 'roof') roofOff(c, z, inv)
      if (z.fxKey === 'tail_cone' && c.meta.kind === 'heli') tailOff(c, z, inv)
      ;(z.mirrors || []).forEach(function (o: any) {
        I.hideObj(c, o)
      })
      if (z.type === 'door')
        windowsOver(c, z, inv).forEach(function (g: any) {
          I.glassBand(c, z, g, 4)
        })
      I.zoneDecals(c, z, { rust: 3, deep: 2 }, I.zoneCands(c, z, I.worldInverseOf(c)))
      return
    }
    const dents = []
    const opt: any = {}
    if (b === 1) {
      for (let i = 0; i < 3; i++)
        dents.push({
          u: u0 + lu * (0.2 + R() * 0.6),
          v: v0 + lv * (0.25 + R() * 0.5),
          ru: 0.06 + R() * 0.04,
          rv: 0.06 + R() * 0.04,
          depth: (0.012 + R() * 0.016) * dk,
          ph: R() * 6,
        })
      I.zoneDent(c, z, dents, dirty, { edge: 0.15 })
      I.zoneDecals(c, z, { deep: 4, chip: 3, fine: 2 }, I.zoneCands(c, z, inv))
      return
    }
    /* the dent follows the panel: an ellipse stretched along the long axis, with a crease along it */
    const longU = lu >= lv
    const D0 = b === 2 ? 0.06 + R() * 0.06 : 0.15 + R() * 0.15
    const maxD = Math.max(0.03, Math.min(D0, depA * 0.55, 0.3)) * dk
    const uc = u0 + lu * (0.4 + R() * 0.2)
    const vc = v0 + lv * (0.4 + R() * 0.2)
    dents.push({ u: uc, v: vc, ru: lu * (longU ? 0.48 : 0.38), rv: lv * (longU ? 0.38 : 0.48), depth: maxD, ph: R() * 6 })
    if (b === 3)
      dents.push({
        u: u0 + lu * (0.2 + R() * 0.6),
        v: v0 + lv * (0.25 + R() * 0.5),
        ru: lu * 0.3,
        rv: lv * 0.3,
        depth: maxD * 0.8,
        ph: R() * 6,
      })
    opt.crease = longU ? null : null
    if (longU) opt.crease = { v: vc + (R() - 0.5) * lv * 0.15, w: Math.min(0.09, lv * 0.2), depth: maxD * 0.55 }
    if (b === 3)
      opt.extra = function (p: any, f: any) {
        p.addScaledVector(d, 0.012 * Math.sin(p.getComponent(ax[0]) * 17) * Math.min(1, f / 0.05))
      }
    /* dented door: the rear edge of the door sticks out (misaligned gap) */
    if (z.type === 'door' && b >= 2) {
      const hingeHi = z.hinge !== 'rear'
      const xe = hingeHi ? B.x0 : B.x1
      const sideOut = d.clone().negate()
      opt.extraAll = function (p: any) {
        if (!I.boxContains(B, p.x, p.y, p.z, 0)) return false
        const t = 1 - Math.abs(p.x - xe) / 0.12
        if (t <= 0) return false
        const tin = Math.abs(p.getComponent(a) - (d.getComponent(a) > 0 ? B.z0 : B.z1))
        if (tin > 0.2) return false
        p.addScaledVector(sideOut, 0.014 * I.sm(t) * I.sm((p.y - B.y0) / 0.1) * I.sm((B.y1 - p.y) / 0.1))
        return true
      }
    }
    I.zoneDent(c, z, dents, dirty, opt)
    if (z.fxKey === 'tail_cone' && c.meta.kind === 'heli') {
      const kxx = B.x0 + (B.x1 - B.x0) * (b === 2 ? 0.55 : 0.62)
      const kyy = (B.y0 + B.y1) / 2
      I.bendAft(c, z, kxx, kyy, b === 2 ? 0.035 : 0.16, dirty)
    }
    if (z.mirrors && z.mirrors.length) mirrorHang(c, z, b === 2 ? 0.95 : 1.3)
    if (b === 3) {
      if (z.type === 'door') doorHang(c, z, dirty, inv)
      else if (z.type === 'lid') lidHang(c, z, dirty)
      else if (z.type !== 'roof' && !z.noFlap) flapHang(c, z, dirty)
      if (z.type === 'door')
        windowsOver(c, z, I.worldInverseOf(c)).forEach(function (g: any) {
          I.glassBand(c, z, g, 3)
        })
    }
    const cands = I.zoneCands(c, z, I.worldInverseOf(c))
    /* armour barely dents and fibre hulls crack: the band shows through the marks (craters, soot, chips) */
    if (z.fxKey === 'armor') I.zoneDecals(c, z, b === 2 ? { crater: 5, soot: 2 } : { crater: 8, soot: 4, tear: 1 }, cands)
    else if (z.fxKey === 'hull') I.zoneDecals(c, z, b === 2 ? { deep: 5, chip: 6 } : { deep: 4, chip: 4, soot: 2, tear: 2 }, cands)
    if (b === 2) I.zoneDecals(c, z, { deep: 4, chip: 3 }, cands)
    else
      I.zoneDecals(
        c,
        z,
        {
          deep: 4,
          chip: z.plastic ? 0 : 2,
          rust: z.plastic ? 0 : 3,
          tear: z.plastic || z.noFlap || z.type === 'door' || z.type === 'lid' ? 0 : 1,
        },
        cands,
      )
    if (z.type === 'door' && b === 2) doorGap(c, z, b, cands)
  }
  /* torn-off roof: the headliner and whatever is attached on top (beacon, light bar, roof rack, roof lights) come away with it */
  function roofOff(c: any, z: any, inv: any) {
    const B = z.box
    const top = c.meta.top || B.y1
    c.vehicle.traverse(function (o: any) {
      if (!o.isMesh || !o.visible || o.userData.decal || o.userData.glass) return
      if (o.material === MATERIALS.headliner) {
        const hb = I.localBox(c, o, inv)
        const hc = hb.getCenter(new V3())
        if (I.boxContains(B, hc.x, hc.y, hc.z, 0.12)) I.hideObj(c, o)
      }
    })
    c.vehicle.children.forEach(function (o: any) {
      if (!o.visible || o.userData.decal || o.isSprite || o.userData.glass || c.deform.indexOf(o) >= 0 || c.wheels.indexOf(o) >= 0) return
      const ow = I.ownerOf(c, o)
      if (ow && ow !== z) return
      const bb = I.localBox(c, o, inv)
      if (bb.isEmpty()) return
      const cen = bb.getCenter(new V3())
      const sz = bb.getSize(new V3())
      if (Math.max(sz.x, sz.z) > 2.2) return
      if (
        (bb.min.y > top - 0.1 || bb.min.y > B.y0 + (B.y1 - B.y0) * 0.5 - 0.1) &&
        cen.x > B.x0 - 0.1 &&
        cen.x < B.x1 + 0.1 &&
        Math.abs(cen.z) < Math.max(Math.abs(B.z0), Math.abs(B.z1)) + 0.1
      )
        I.hideObj(c, o)
    })
  }
  /* torn-off tail cone: everything behind the start of the cone (pylon, fin, tail rotor, tail skid) disappears, from any zone */
  function tailOff(c: any, z: any, inv: any) {
    const kx = z.box.x1 - (z.box.x1 - z.box.x0) * 0.15
    c.vehicle.children.forEach(function (o: any) {
      if (!o.visible || o.userData.decal || o.isSprite) return
      const bb = I.localBox(c, o, inv)
      if (bb.isEmpty()) return
      if (bb.max.x < kx + 0.05) I.hideObj(c, o)
    })
    c.spin = c.spin.filter(function (sp: any) {
      return I.shown(c, sp.o)
    })
  }
  function followersIn(c: any, z: any, inv: any) {
    const dset = new Set(c.deform)
    const out: any = []
    c.vehicle.children.forEach(function (o: any) {
      if (dset.has(o) || o.userData.decal || o.isSprite || o.userData.glass || !o.visible) return
      if (!(o.isMesh || (o.isGroup && o.userData.rigid))) return
      const ow = I.ownerOf(c, o)
      if (ow && ow !== z) return
      if (c.wheels.indexOf(o) >= 0) return
      const bb = I.localBox(c, o, inv)
      if (bb.isEmpty()) return
      const cen = bb.getCenter(new V3())
      const sz = bb.getSize(new V3())
      if (!I.boxContains(z.box, cen.x, cen.y, cen.z, 0) || Math.max(sz.x, sz.y, sz.z) > 1.4) return
      if (sz.getComponent(I.axisOf(z.dir)) > 0.09) return /* only thin parts along the direction of the bodywork (liner, trim, handle, plate) */
      out.push(o)
    })
    return out
  }
  function windowsOver(c: any, z: any, inv: any) {
    return c.glass.filter(function (g: any) {
      if (!g.parent || !g.visible) return false
      const cen = I.localBox(c, g, inv).getCenter(new V3())
      return (
        Math.sign(cen.z) === z.side &&
        Math.abs(cen.z) > (c.meta.width || 1.7) * 0.25 &&
        cen.x > z.box.x0 + 0.05 &&
        cen.x < z.box.x1 - 0.05 &&
        cen.y > z.box.y1 - 0.15
      )
    })
  }
  function doorGap(c: any, z: any, b: any, cands: any) {
    const B = z.box
    const xe = z.hinge === 'rear' ? B.x1 : B.x0
    const inv = I.worldInverseOf(c)
    const d = z.dir
    const Mw = c.vehicle.matrixWorld
    const pts = []
    for (let k = 0; k < 6; k++) {
      const y = B.y0 + 0.08 + ((B.y1 - B.y0 - 0.16) * k) / 5
      const org = new V3(xe + 0.006, y, z.side < 0 ? B.z0 - 0.5 : B.z1 + 0.5)
      I._zr.set(org.clone().applyMatrix4(Mw), d.clone().transformDirection(Mw))
      I._zr.far = 0.5 + (B.z1 - B.z0)
      const h = I._zr.intersectObjects(cands, false)[0]
      if (h) pts.push(h.point.clone().applyMatrix4(inv).addScaledVector(d, -0.004))
    }
    if (pts.length < 3) return
    const seam = c.tube(pts, b === 2 ? 0.0045 : 0.006, I.DAMAGE_MATERIALS.seam, { seg: 24, rs: 4 })
    seam.castShadow = false
    seam.userData.decal = true
  }
  function mirrorHang(c: any, z: any, ang: any) {
    const objs = z.mirrors.filter(function (o: any) {
      return o.parent
    })
    if (!objs.length) return
    const inv = I.worldInverseOf(c)
    const bb = new THREE.Box3()
    objs.forEach(function (o: any) {
      bb.union(I.localBox(c, o, inv))
    })
    const at = new V3((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, z.side < 0 ? bb.max.z : bb.min.z)
    const piv = I.pivotOf(c, objs, at)
    piv.rotation.x = z.side * -ang
    piv.rotation.y = z.side * 0.25
  }
  /* door hanging on a hinge: the door skin becomes a part, swings out on the front hinge and falls behind */
  function doorHang(c: any, z: any, dirty: any, inv: any) {
    const B = z.box
    const rect = [B.x0 + 0.03, B.x1 - 0.03, B.y0 + Math.min(0.08, (B.y1 - B.y0) * 0.1), B.y1 - 0.02]
    const pcs = I.cutPanel(c, z, rect, true, dirty).filter(function (q: any) {
      return q.mesh
    })
    if (!pcs.length) return
    const objs = pcs
      .map(function (q: any) {
        return q.mesh
      })
      .concat(followersIn(c, z, inv))
    const hx = z.hinge === 'rear' ? B.x0 + 0.03 : B.x1 - 0.03
    const bb = new THREE.Box3()
    objs.forEach(function (o: any) {
      bb.union(I.localBox(c, o, I.worldInverseOf(c)))
    })
    const at = new V3(hx, (bb.min.y + bb.max.y) / 2, z.side < 0 ? bb.min.z : bb.max.z)
    const yaw = I.pivotOf(c, [], at)
    const tilt = new THREE.Group()
    yaw.add(tilt)
    c.root.updateMatrixWorld(true)
    objs.forEach(function (o: any) {
      tilt.attach(o)
      o.traverse(function (x: any) {
        x.userData.noFollow = true
      })
    })
    const dx = Math.abs(hx - (z.hinge === 'rear' ? B.x1 : B.x0))
    const sgn = z.hinge === 'rear' ? -1 : 1
    yaw.rotation.y = z.side * sgn * (0.42 + c.rand() * 0.15)
    tilt.rotation.z = sgn * Math.min(0.22, Math.asin(clamp((bb.min.y - 0.03) / Math.max(0.3, dx), 0, 0.9)))
    c.parts.forEach(function (p: any) {
      if (p.kind === 'door') p.done = true
    })
  }
  /* hanging lid: opens on the top hinge (or drops on the bottom one, on a cargo bed) */
  function lidHang(c: any, z: any, dirty: any) {
    const B = z.box
    const rect = [B.y0 + 0.05, B.y1 - 0.03, B.z0 + 0.05, B.z1 - 0.05]
    const d = z.dir
    const a = I.axisOf(d)
    if (a !== 0) return flapHang(c, z, dirty)
    const pcs = I.cutPanel(c, z, rect, true, dirty).filter(function (q: any) {
      return q.mesh
    })
    if (!pcs.length) return
    const bb = new THREE.Box3()
    const inv = I.worldInverseOf(c)
    pcs.forEach(function (q: any) {
      bb.union(I.localBox(c, q.mesh, inv))
    })
    const top = z.hinge !== 'down'
    const sx = d.x > 0 ? -1 : 1
    const at = new V3(sx < 0 ? bb.min.x : bb.max.x, top ? bb.max.y : bb.min.y, 0)
    const piv = I.pivotOf(
      c,
      pcs.map(function (q: any) {
        return q.mesh
      }),
      at,
    )
    piv.rotation.z = (top ? 1 : -1) * sx * (top ? 0.55 : 1.2)
    piv.rotation.x = (c.rand() - 0.5) * 0.12
  }
  /* torn and bent-out metal flap on a panel corner */
  function flapHang(c: any, z: any, dirty: any) {
    const R = c.rand
    const B = z.box
    const d = z.dir
    const a = I.axisOf(d)
    const ax = [0, 1, 2].filter(function (k) {
      return k !== a
    })
    const u0 = I.boxLo(B, ax[0])
    const u1 = I.boxHi(B, ax[0])
    const v0 = I.boxLo(B, ax[1])
    const v1 = I.boxHi(B, ax[1])
    const lu = u1 - u0
    const lv = v1 - v0
    const ks = clamp((c.meta.length || 4.2) / 4.2, 0.45, 1)
    const fu = Math.min(0.45 * ks, lu * 0.32)
    const fv = Math.min(0.35 * ks, lv * 0.4)
    const cu = u0 + lu * (0.3 + R() * 0.4)
    const cv = v0 + lv * (0.3 + R() * 0.4)
    const rect = [cu - fu / 2, cu + fu / 2, cv - fv / 2, cv + fv / 2]
    const pcs = I.cutPanel(c, z, rect, true, dirty).filter(function (q: any) {
      return q.mesh && q.cut
    })
    if (!pcs.length) return
    const at = new V3()
    at.setComponent(a, d.getComponent(a) > 0 ? I.boxLo(B, a) : I.boxHi(B, a))
    at.setComponent(ax[0], rect[0])
    at.setComponent(ax[1], (rect[2] + rect[3]) / 2)
    const inv = I.worldInverseOf(c)
    const bb = new THREE.Box3()
    pcs.forEach(function (q: any) {
      bb.union(I.localBox(c, q.mesh, inv))
    })
    at.setComponent(a, bb.getCenter(new V3()).getComponent(a))
    const piv = I.pivotOf(
      c,
      pcs.map(function (q: any) {
        return q.mesh
      }),
      at,
    )
    const axisV = new V3()
    axisV.setComponent(ax[1], 1)
    const outv = d.clone().negate()
    const tangent = new V3()
    tangent.setComponent(ax[0], 1)
    const sgn = new V3().crossVectors(axisV, tangent).dot(outv) > 0 ? 1 : -1
    piv.quaternion.setFromAxisAngle(axisV, sgn * (0.6 + R() * 0.3))
  }

  Object.assign(I, { panelBand, roofOff, tailOff, followersIn, windowsOver, doorGap, mirrorHang, doorHang, lidHang, flapHang })
}
