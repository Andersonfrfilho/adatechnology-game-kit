/** Per-zone damage for separate parts: lights, wheels, glass, internals, rotors and landing gear. */
import type { Kit } from './types'
import { clamp, hash, rng } from './util'

export function installDamageParts(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._
  const document = kit.document
  const { MATERIALS } = I

  /* ---- glass ---- */
  function glassPt(c: any, g: any, rnd: any) {
    g.geometry.computeBoundingBox()
    const bb = g.geometry.boundingBox.clone().applyMatrix4(g.matrix)
    const s = bb.getSize(new V3())
    return new V3(bb.min.x + s.x * (0.3 + rnd() * 0.4), bb.min.y + s.y * (0.3 + rnd() * 0.4), bb.min.z + s.z * (0.3 + rnd() * 0.4))
  }
  function glassIn(c: any, g: any) {
    const p = glassPt(c, g, function () {
      return 0.5
    })
    const m = c.meta
    return new V3((m.front + m.rear) / 2 - p.x, 0, -p.z).normalize()
  }
  function glassBand(c: any, z: any, g: any, b: any) {
    const G = g.userData.glass
    if (!G || !g.parent) return
    const R = c.rand
    const bullet = c.meta.bullet
    if (b === 1) I.crackGlass(c, g, glassPt(c, g, R), 0.2, 0.26)
    else if (b === 2) I.crackGlass(c, g, glassPt(c, g, R), 1.0)
    else if (b === 3) {
      if (G.type === 'laminated' || bullet) {
        for (let i = 0; i < 3; i++) I.crackGlass(c, g, glassPt(c, g, R), 1.2)
        I.burst(c, 'shard', c.toEffects(glassPt(c, g, R)), 10, { speed: 1.2 })
      } else I.shatterGlass(c, g, 1.0, glassIn(c, g))
    } else if (b === 4) {
      if (!G.broken && G.type !== 'laminated' && !bullet) I.shatterGlass(c, g, 1.0, glassIn(c, g))
      else I.burst(c, 'shard', c.toEffects(glassPt(c, g, R)), 14, { speed: 1.4 })
      G.broken = true
      g.visible = false
    }
  }
  /* ---- headlights and taillights ---- */
  const crackLensCache = new Map()
  let crackTextureCache: any = null
  function crackTexture() {
    if (crackTextureCache) return crackTextureCache
    const cv = document.createElement('canvas')
    cv.width = cv.height = 128
    const x: any = cv.getContext('2d')
    const r = rng(77)
    x.fillStyle = '#ffffff'
    x.fillRect(0, 0, 128, 128)
    for (let pass = 0; pass < 2; pass++) {
      x.strokeStyle = pass ? 'rgba(255,255,255,1)' : 'rgba(30,30,30,0.9)'
      x.lineWidth = pass ? 1 : 2.4
      const rr = rng(77)
      for (let i = 0; i < 9; i++) {
        let a = (i / 9) * PI * 2 + rr() * 0.4
        let px = 60
        let py = 66
        x.beginPath()
        x.moveTo(px, py)
        for (let k = 1; k < 5; k++) {
          a += (rr() - 0.5) * 0.5
          px += Math.cos(a) * 14
          py += Math.sin(a) * 14
          x.lineTo(px, py)
        }
        x.stroke()
      }
    }
    void r
    crackTextureCache = new THREE.CanvasTexture(cv)
    return crackTextureCache
  }
  function crackLens(mat: any) {
    if (crackLensCache.has(mat)) return crackLensCache.get(mat)
    const m2 = mat.clone()
    m2.map = crackTexture()
    m2.needsUpdate = true
    crackLensCache.set(mat, m2)
    return m2
  }
  function lightBand(c: any, z: any, Lt: any, b: any) {
    if (!Lt || Lt.broken === 'gone') return
    const dir = new V3(Lt.kind === 'taillight' ? 1 : -1, 0, 0)
    if (b === 1) {
      Lt.lens.forEach(function (m: any) {
        if (m.material && !Array.isArray(m.material)) m.material = crackLens(m.material)
      })
      ;(Lt.halo || []).forEach(function (h: any) {
        h.material = h.material.clone()
        h.material.opacity *= 0.55
      })
    } else if (b >= 2) {
      I.breakLight(c, Lt, dir)
      if (b === 3 && Lt.group) {
        Lt.group.rotation.x += (c.rand() - 0.5) * 0.5
        Lt.group.rotation.z += -0.25
        Lt.group.position.y -= 0.035
        Lt.group.position.addScaledVector(dir, -0.02)
        Lt.group.userData.noFollow = true
      }
      if (b === 4) {
        if (Lt.group) Lt.group.visible = false
        else
          Lt.lens.concat(Lt.inner).forEach(function (m: any) {
            m.visible = false
          })
        Lt.broken = 'gone'
      }
    }
  }
  /* ---- wheels: flat flattens the bottom of the tyre; without a tyre, the wheel sits on its rim ---- */
  function tireMeshes(w: any) {
    const out: any = []
    w.traverse(function (o: any) {
      if (o.isMesh && o.material === MATERIALS.rubber) out.push(o)
    })
    return out
  }
  function flattenTire(w: any, k: any) {
    const r = w.userData.r || 0.3
    const yb = -r * (1 - k)
    const v = new V3()
    const M = new THREE.Matrix4()
    const Mi = new THREE.Matrix4()
    tireMeshes(w).forEach(function (t: any) {
      if (!t.userData.zCloned) {
        t.geometry = t.geometry.clone()
        t.userData.zCloned = true
      }
      t.updateMatrix()
      M.copy(t.matrix)
      Mi.copy(M).invert()
      const p = t.geometry.attributes.position
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(M)
        if (v.y < yb) {
          const e = (yb - v.y) / Math.max(0.01, r * k)
          v.y = yb
          v.z *= 1 + 0.25 * Math.min(1, e)
          v.applyMatrix4(Mi)
          p.setXYZ(i, v.x, v.y, v.z)
        }
      }
      p.needsUpdate = true
      t.geometry.computeVertexNormals()
      t.geometry.computeBoundingSphere()
    })
  }
  function wheelBand(c: any, z: any, w: any, b: any) {
    if (!w || !w.parent) return
    const r = w.userData.r || 0.3
    const s = w.position.z >= 0 ? 1 : -1
    const R = c.rand
    if (b === 1) {
      for (let i = 0; i < 3; i++) {
        const a = R() * PI * 2
        const sc = new THREE.Mesh(new THREE.BoxGeometry(r * 0.35, 0.006, 0.002), I.DAMAGE_MATERIALS.deep)
        sc.position.set(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, s * (r * 0.5 + 0.02))
        sc.rotation.z = a + PI / 2
        sc.userData.decal = true
        w.add(sc)
      }
    } else if (b === 2) {
      flattenTire(w, 0.13)
      c.zoneDrops.push({ x: w.position.x, z: w.position.z, d: r * 0.13 })
    } else if (b === 3) {
      flattenTire(w, 0.24)
      w.rotation.y += (R() - 0.5) * 0.25
      w.rotation.x += s * 0.1
      c.zoneDrops.push({ x: w.position.x, z: w.position.z, d: r * 0.24 })
    } else if (b === 4) {
      let rr = 0
      w.traverse(function (o: any) {
        if (!o.isMesh || o.material === MATERIALS.rubber) return
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere()
        const cc = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrix)
        rr = Math.max(rr, Math.hypot(cc.x, cc.y) + o.geometry.boundingSphere.radius * 0.7)
      })
      rr = clamp(rr || r * 0.62, r * 0.4, r * 0.85)
      tireMeshes(w).forEach(function (t: any) {
        t.visible = false
      })
      c.zoneDrops.push({ x: w.position.x, z: w.position.z, d: r - rr })
      const gp = c.toEffects(new V3(w.position.x, 0.02, w.position.z))
      I.burst(c, 'spark', gp, 14, { speed: 2.4, spread: 1.6 })
      const mk = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.06), I.DAMAGE_MATERIALS.scrape)
      mk.rotation.x = -PI / 2
      mk.position.set(gp.x - 0.8, 0.006, gp.z)
      mk.userData.decal = true
      mk.raycast = function () {}
      c.effects.add(mk)
    }
  }
  /* ---- aircraft landing gear: dented sags, destroyed breaks the front leg (nose on the ground), torn off = belly landing ---- */
  function gearBand(c: any, z: any, b: any) {
    const R = c.rand
    const ws = z.wheels.filter(function (w: any) {
      return w.parent
    })
    const objs = z.owned.filter(function (o: any) {
      return o.parent
    })
    if (!ws.length) return
    if (b <= 2) {
      ws.forEach(function (w: any) {
        wheelBand(c, z, w, b)
      })
      return
    }
    if (b === 3) {
      const xmax = Math.max.apply(
        null,
        ws.map(function (w: any) {
          return w.position.x
        }),
      )
      const front = ws.filter(function (w: any) {
        return w.position.x > xmax - 0.3
      })
      ws.forEach(function (w: any) {
        if (front.indexOf(w) < 0) wheelBand(c, z, w, 2)
      })
      front.forEach(function (w: any) {
        const r = w.userData.r || 0.3
        const near = objs.filter(function (o: any) {
          const p = o.position
          const bb = I.localBox(c, o, I.worldInverseOf(c))
          const cen = bb.getCenter(new V3())
          void p
          return Math.abs(cen.x - w.position.x) < 0.5 && Math.abs(cen.z - w.position.z) < 0.5
        })
        const inv = I.worldInverseOf(c)
        const top = new V3(w.position.x, w.position.y + r, w.position.z)
        near.forEach(function (o: any) {
          const bb = I.localBox(c, o, inv)
          top.y = Math.max(top.y, bb.max.y)
        })
        w.userData.gpos = w.position.clone()
        const piv = I.pivotOf(c, [w].concat(near), top)
        piv.rotation.z = 0.75 + R() * 0.25
        piv.rotation.x = (R() - 0.5) * 0.3
        c.zoneDrops.push({ x: w.position.x, z: w.position.z, d: r * 1.25 })
        I.burst(c, 'spark', c.toEffects(new V3(w.position.x, 0.03, w.position.z)), 10, { speed: 2, spread: 1.4 })
      })
      return
    }
    /* torn off: the gear disappears and the aircraft settles on its belly, slightly nose down */
    ws.concat(objs).forEach(function (o: any) {
      I.hideObj(c, o)
    })
    /* propeller stopped horizontally (hit the ground and the engine died) */
    I.partsOf(c, 'propeller').forEach(function (hp: any) {
      const o = hp.obj
      if (!o || !o.parent) return
      c.spin = c.spin.filter(function (q: any) {
        return q.o !== o
      })
      let best = 0
      let by = -1e9
      for (let k = 0; k < 12; k++) {
        o.rotation.x = (k / 12) * PI
        c.root.updateMatrixWorld(true)
        const y0 = I.localBox(c, o, I.worldInverseOf(c)).min.y
        if (y0 > by + 1e-4) {
          by = y0
          best = o.rotation.x
        }
      }
      o.rotation.x = best
      I.hurtEngine(c, 0.3)
    })
    c.root.updateMatrixWorld(true)
    const inv2 = I.worldInverseOf(c)
    let lo = 1e9
    let xs = 0
    c.vehicle.traverse(function (o: any) {
      if (!o.isMesh || o.userData.decal || o.isSprite || !o.geometry || !o.geometry.attributes.position) return
      for (let q = o; q && q !== c.vehicle; q = q.parent) if (!q.visible) return
      const bb = I.localBox(c, o, inv2)
      if (bb.min.y < lo) {
        lo = bb.min.y
        xs = (bb.min.x + bb.max.x) / 2
      }
    })
    if (lo < 1e8 && lo > 0.02) c.vehicle.position.y -= lo - 0.01
    const m = c.meta
    const gp = c.toEffects(new V3(xs, 0.02, 0))
    I.burst(c, 'spark', gp, 18, { speed: 2.6, spread: 1.8 })
    const mk = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(4, (m.length || 6) * 0.5), 0.5), I.DAMAGE_MATERIALS.scrape)
    mk.rotation.x = -PI / 2
    mk.position.set(gp.x - 1.2, 0.006, gp.z)
    mk.userData.decal = true
    mk.raycast = function () {}
    c.effects.add(mk)
  }
  /* ---- internal zones: engine, radiator, tank, battery, underbody ---- */
  function internalBand(c: any, z: any, b: any) {
    const m = c.meta
    const p = z.pos ? z.pos.clone() : I.boxCenter(z.box)
    const sub = z.sub || z.id
    const land = ['boat', 'plane', 'heli'].indexOf(m.kind) < 0
    if (b === 0) return
    if (sub === 'engine') {
      if (b === 1) I.hurtEngine(c, 0.8)
      if (b === 2) {
        I.hurtEngine(c, 0.55)
        kit.addEmitter(c, p.clone().add(new V3(0, 0.3, 0)), 'white', { rate: 2, s: 0.7 })
      }
      if (b >= 3) {
        I.hurtEngine(c, b === 4 ? 0.05 : 0.25)
        kit.addEmitter(c, p.clone().add(new V3(0, 0.3, 0)), 'black', { rate: b === 4 ? 6 : 4 })
        if (land) I.puddle(c, 'oil', p.clone().setY(Math.max(0.2, m.clearance || 0.3)), b === 4 ? 0.9 : 0.6)
      }
      if (b === 4) kit.addEmitter(c, p.clone().add(new V3(0, 0.15, 0)), 'fire', { rate: 7, s: 0.7 })
      if (b >= 2 && c.hood && !c.hood.noLatch && c.hood.x1 > 0 === p.x > 0) c.hood.latch = Math.max(c.hood.latch, 0.08)
    } else if (sub === 'radiator') {
      if (b === 2) kit.addEmitter(c, p.clone().add(new V3(-0.1, 0.25, 0)), 'white', { rate: 2.5, s: 0.7 })
      if (b >= 3) {
        kit.addEmitter(c, p.clone().add(new V3(-0.1, 0.25, 0)), 'white', { rate: b === 4 ? 8 : 5 })
        I.hurtEngine(c, b === 4 ? 0.35 : 0.6)
      }
    } else if (sub === 'fuel_tank') {
      const fu = I.tankFuel(c, { label: z.name })
      if (fu && land && b >= 2) {
        const pd = I.puddle(c, fu, p.clone(), b === 2 ? 0.35 : b === 3 ? 0.95 : 1.4)
        if (b === 4 && fu === 'gasoline') I.igniteFuel(c, pd)
      }
      if (b === 4 && !land) kit.addEmitter(c, p.clone(), 'black', { rate: 3 })
    } else if (sub === 'battery') {
      if (b >= 3) kit.addEmitter(c, p.clone().add(new V3(0, 0.6, 0)), 'black', { rate: 3 })
      if (b === 4) kit.addEmitter(c, p.clone().add(new V3(0, 0.15, 0)), 'fire', { rate: 8, s: 0.8 })
    } else if (sub === 'underbody') {
      const ug = m.underbodyGroup
      if (b >= 2 && ug) {
        ug.rotation.z += b === 2 ? 0.012 : 0.03
        ug.position.y -= b === 2 ? 0.015 : 0.05
      }
      if (b === 4 && ug) {
        ug.position.y -= 0.06
        I.burst(c, 'spark', c.toEffects(new V3(m.rear + 0.6, 0.05, 0)), 12, { speed: 2 })
      }
      if (b >= 3 && land) I.puddle(c, 'oil', new V3(((m.front || 1) + (m.rear || -1)) / 2 + 0.6, 0.2, 0), 0.4)
    }
  }
  /* ---- hood ---- */
  function hoodBand(c: any, z: any, b: any, dirty: any) {
    const H = c.hood && z.owned.indexOf(c.hood.piv) >= 0 ? c.hood : null
    if (!H) return I.panelBand(c, z, b, dirty)
    const R = c.rand
    const inv = I.worldInverseOf(c)
    const cands = I.zoneCands(c, z, inv)
    if (b === 0) {
      if (z.health < 92) I.zoneDecals(c, z, { fine: 2 }, cands)
      return
    } /* intact (76 to 99): only fine scratches, no dents and no unlatching */
    if (b === 1) {
      I.zoneDecals(c, z, { deep: 3, chip: 3, fine: 2 }, cands)
      return
    }
    if (b === 4) {
      H.piv.visible = false
      c.parts.forEach(function (p: any) {
        if (p.kind === 'hood') p.done = true
      })
      c.hood = null
      return
    }
    const B = z.box
    const len = B.x1 - B.x0
    const wz = B.z1 - B.z0
    const dep = b === 2 ? 0.05 + R() * 0.03 : 0.1 + R() * 0.05
    I.zoneDent(
      c,
      z,
      [{ u: B.x0 + len * (0.55 + R() * 0.2), v: (R() - 0.5) * wz * 0.3, ru: len * 0.38, rv: wz * 0.32, depth: dep, ph: R() * 6 }],
      dirty,
      { crease: { v: (R() - 0.5) * wz * 0.2, w: 0.08, depth: dep * 0.6 }, noSub: false },
    )
    H.latch = Math.max(H.latch, b === 2 ? 0.15 : 0.28)
    if (b === 3) {
      /* folded up: the front half rises around a crease line */
      const xf = H.x0 + (H.x1 - H.x0) * (0.5 + R() * 0.1)
      const k = 0.55 + R() * 0.2
      const v = new V3()
      H.piv.children.forEach(function (msh: any) {
        if (!msh.isMesh) return
        msh.updateMatrix()
        const M = msh.matrix
        const Mi = new THREE.Matrix4().copy(M).invert()
        const p = msh.geometry.attributes.position
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(M)
          const gx = v.x + H.x0
          if (gx > xf) {
            const t = gx - xf
            v.y += t * k * (1 + 0.15 * Math.sin(v.z * 7))
            v.x -= t * (1 - Math.cos(Math.atan(k))) * 0.5
          }
          v.applyMatrix4(Mi)
          p.setXYZ(i, v.x, v.y, v.z)
        }
        p.needsUpdate = true
        msh.geometry.computeBoundingSphere()
        dirty.add(msh)
      })
      I.zoneDecals(c, z, { deep: 3, chip: 2, rust: 2, tear: 1 }, I.zoneCands(c, z, I.worldInverseOf(c)))
    } else I.zoneDecals(c, z, { deep: 3, chip: 3 }, I.zoneCands(c, z, I.worldInverseOf(c)))
  }
  /* ---- bumper ---- */
  function bumperBand(c: any, z: any, b: any, dirty: any) {
    const o = z.owned[0]
    if (!o || !o.parent) return I.panelBand(c, z, b, dirty)
    const R = c.rand
    const inv = I.worldInverseOf(c)
    const cands = I.zoneCands(c, z, inv)
    const bb = I.localBox(c, o, inv)
    const cen = bb.getCenter(new V3())
    const sx = cen.x > 0 ? 1 : -1
    if (b === 0) {
      if (z.health < 92) I.zoneDecals(c, z, { fine: 2 }, cands)
      return
    } /* intact (76 to 99): the bumper stays in place */
    if (b === 1) {
      I.zoneDecals(c, z, { deep: 3, chip: 2 }, cands)
      return
    }
    if (b === 4) {
      I.hideObj(c, o)
      return
    }
    I.zoneDecals(c, z, { deep: 3, chip: 2, rust: b === 3 ? 2 : 0 }, cands)
    const sideHit = R() < 0.5 ? -1 : 1
    const p = new V3(cen.x, cen.y, (sideHit * (bb.max.z - bb.min.z)) / 2)
    if (b === 2) {
      I.hangBumper(c, o, p)
      return
    }
    /* destroyed: fell off and lies on the ground in front of (or behind) the vehicle, slightly crooked */
    const di = c.deform.indexOf(o)
    if (di >= 0) c.deform.splice(di, 1)
    if (o.parent !== c.vehicle) {
      c.root.updateMatrixWorld(true)
      c.vehicle.attach(o)
    }
    const hh = (bb.max.y - bb.min.y) / 2
    o.position.x += sx * (0.35 + R() * 0.2)
    o.position.y += hh + 0.004 - bb.min.y - hh
    o.rotation.y += (R() - 0.5) * 0.5
    o.rotation.x += (R() - 0.5) * 0.12
    o.userData.noFollow = true
    c.parts.forEach(function (q: any) {
      if (q.obj === o) q.done = true
    })
  }
  /* ---- loose parts (bike, rotor, weapon, skid) ---- */
  function partBand(c: any, z: any, b: any, dirty: any) {
    const objs = z.owned.filter(function (o: any) {
      return o.parent
    })
    if (!objs.length) return I.panelBand(c, z, b, dirty)
    const R = c.rand
    const inv = I.worldInverseOf(c)
    const cands = I.zoneCands(c, z, inv)
    if (b >= 1 && b <= 3)
      I.zoneDecals(c, z, { deep: b + 1, chip: z.plastic ? 0 : b, rust: b === 3 && !z.plastic && !z.noFlap ? 2 : 0 }, cands)
    if (z.track) {
      const tk = z.track
      if (b === 2) {
        tk.position.y -= 0.025
      }
      if (b === 3) {
        tk.position.addScaledVector(z.dir, -0.12)
        tk.position.y -= 0.05
        tk.rotation.x += z.side * 0.05
      }
      if (b === 4) I.hideObj(c, tk)
      return
    }
    if (z.kindPart && b >= 2 && b <= 3) {
      objs.forEach(function (o: any) {
        o.children.forEach(function (ch: any, i: any) {
          if (ch.type === 'Group' || ch.isMesh) {
            ch.rotation.z += (-0.12 - hash(i, 1, 1) * 0.2) * (b - 1)
            ch.rotation.x += (i % 2 ? 0.15 : -0.15) * (b - 1)
          }
        })
      })
      c.spin = c.spin.filter(function (s: any) {
        return objs.indexOf(s.o) < 0
      })
      return
    }
    if (b === 4) {
      objs.forEach(function (o: any) {
        I.hideObj(c, o)
      })
      c.spin = c.spin.filter(function (s: any) {
        return objs.indexOf(s.o) < 0
      })
      return
    }
    if (b < 2) return
    const m = c.meta
    const B = z.box
    const C = new V3(((m.front || 1) + (m.rear || -1)) / 2, (m.clearance || 0.3) + 0.3, 0)
    const at = z.anchor
      ? new V3(z.anchor[0], z.anchor[1], z.anchor[2])
      : new V3(clamp(C.x, B.x0, B.x1), clamp(C.y, B.y0, B.y1), clamp(C.z, B.z0, B.z1))
    const outv = I.boxCenter(B).sub(at)
    outv.y = 0
    if (outv.lengthSq() < 1e-4) outv.set(1, 0, 0)
    outv.normalize()
    const axis = new V3().crossVectors(new V3(0, 1, 0), outv).normalize()
    const th = b === 2 ? 0.08 + R() * 0.05 : 0.3 + R() * 0.15
    const piv = I.pivotOf(c, objs, at)
    piv.quaternion.setFromAxisAngle(axis, th)
    piv.position.y -= b === 3 ? 0.03 : 0.01
    c.spin = c.spin.filter(function (s: any) {
      return objs.indexOf(s.o) < 0
    })
  }
  /* bent tail cone: everything behind the crease (cone, fin, tail rotor) rotates downward around it.
     Meshes that cross the crease bend per vertex; whole parts behind it rotate as a rigid body. */
  function bendAft(c: any, z: any, kx: any, ky: any, ang: any, dirty: any) {
    const inv = I.worldInverseOf(c)
    const q = new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), ang)
    const K = new V3(kx, ky, 0)
    const v = new V3()
    const rel = new THREE.Matrix4()
    const irel = new THREE.Matrix4()
    const blend = 0.25
    function rot(p: any, k: any) {
      const a2 = ang * k
      const cs = Math.cos(a2)
      const sn = Math.sin(a2)
      const dx = p.x - kx
      const dy = p.y - ky
      p.x = kx + dx * cs - dy * sn
      p.y = ky + dx * sn + dy * cs
    }
    const rigid: any = []
    const verts: any = []
    c.vehicle.children.forEach(function (o: any) {
      if (o.userData.decal || o.isSprite || !o.visible) return
      const ow = I.ownerOf(c, o)
      if (ow && ow !== z && ow.id !== 'rotor_cauda' && I.boxCenter(ow.box).x > kx) return
      const bb = I.localBox(c, o, inv)
      if (bb.isEmpty() || bb.min.x >= kx) return
      if (bb.max.x < kx - 0.02 || !o.isMesh) {
        if (bb.max.x < kx + 0.3) rigid.push(o)
      } else verts.push(o)
    })
    rigid.forEach(function (o: any) {
      const p = o.position.clone()
      rot(p, 1)
      o.position.copy(p)
      o.quaternion.premultiply(q)
    })
    verts.forEach(function (msh: any) {
      if (!msh.geometry || !msh.geometry.attributes.position) return
      if (!msh.userData.zCloned && c.deform.indexOf(msh) < 0) {
        msh.geometry = msh.geometry.clone()
        msh.userData.zCloned = true
      }
      msh.updateMatrixWorld(true)
      rel.multiplyMatrices(inv, msh.matrixWorld)
      irel.copy(rel).invert()
      const pos = msh.geometry.attributes.position
      let ch = false
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(rel)
        if (v.x >= kx) continue
        rot(v, I.sm((kx - v.x) / blend))
        v.applyMatrix4(irel)
        pos.setXYZ(i, v.x, v.y, v.z)
        ch = true
      }
      if (ch) {
        pos.needsUpdate = true
        dirty.add(msh)
      }
    })
    void K
  }

  Object.assign(I, {
    glassPt,
    glassIn,
    glassBand,
    crackLensCache,
    crackTextureCache,
    crackTexture,
    crackLens,
    lightBand,
    tireMeshes,
    flattenTire,
    wheelBand,
    gearBand,
    internalBand,
    hoodBand,
    bumperBand,
    partBand,
    bendAft,
  })
}
