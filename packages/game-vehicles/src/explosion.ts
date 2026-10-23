/** Fuel tank explosion, fireball, flying debris and burnt-out state. */
import type { Kit } from './types'

export function installExplosion(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._
  const { makeMaterial, DOUBLE_SIDE, MATERIALS, paintColor, textTexture } = I

  /* ================= explosion ================= */
  /* Chain: the engine catches fire with black smoke (3 to 8 s), the vehicle jumps ~1.5 m, hood, doors, trunk and a wheel fly off with a fire trail,
     the glass bursts into shards and the burnt-out shell is left with a low fire. Fuel tank explosion damage: > 200 fire, > 400 explodes in 0.6 s.
     The tanker truck (meta.bigBlast) makes a gas station tank explosion: lethal radius 12 m, injury radius 30 m, 16 m mushroom cloud. */
  const BURNT = ['#1d1a17', '#26211c', '#171514', '#2e2620'].map(function (h, i) {
    return makeMaterial(h, { roughness: 1, metalness: i === 3 ? 0.35 : 0.15 })
  })
  const BURNT_RUB = makeMaterial('#0b0b0b', { roughness: 1 })
  function boomMat(hex: any, op: any, add?: any) {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(hex),
      transparent: true,
      opacity: op,
      depthWrite: false,
      side: DOUBLE_SIDE,
      fog: false,
      blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
  }
  function enginePos(c: any) {
    const mot = c.parts.find(function (p: any) {
      return p.kind === 'engine'
    })
    if (mot) return mot.pos.clone()
    const m = c.meta
    return new V3(m.front - 0.6, (m.clearance || 0.3) + 0.3, 0)
  }
  kit.explode = function (c: any, o: any) {
    o = o || {}
    if (c.blast || c.exploded) return false
    const fuse = o.now ? 0 : o.delay != null ? o.delay : 3 + c.rand() * 5
    c.blast = { phase: 'fire', t: 0, T: fuse }
    if (fuse > 0) {
      const ep = enginePos(c)
      kit.addEmitter(c, ep.clone().add(new V3(0, 0.25, 0)), 'fire', { rate: 10, s: 0.9 })
      kit.addEmitter(c, ep.clone().add(new V3(0, 0.6, 0)), 'black', { rate: 6, s: 1.2 })
      I.hurtEngine(c, 0.1)
    }
    if (c.hood) c.hood.target = 0
    return fuse
  }
  /* explosion damage on the tank (sum). Returns "fire", "explosion" or null */
  kit.blastDamage = function (c: any, amount: any) {
    c.tankDamage = (c.tankDamage || 0) + amount
    if (c.tankDamage > 400 && !c.exploded && (!c.blast || c.blast.phase === 'fire')) {
      c.blast = { phase: 'fire', t: 0, T: 0.6 }
      return 'explosion'
    }
    if (c.tankDamage > 200 && !c.tankFire) {
      c.tankFire = true
      const tk = c.parts.find(function (p: any) {
        return p.kind === 'fuel_tank'
      })
      const tp = tk ? tk.pos.clone() : enginePos(c)
      kit.addEmitter(c, tp.clone().setY(Math.max(0.15, tp.y)), 'fire', { rate: 12, s: 1.1 })
      kit.addEmitter(c, tp.clone().setY(tp.y + 0.8), 'black', { rate: 5, s: 1.4 })
      return 'fire'
    }
    return null
  }
  function fling(c: any, obj: any, v: any, w: any) {
    if (!obj || !obj.parent) return null
    c.root.updateMatrixWorld(true)
    const bb = new THREE.Box3().setFromObject(obj)
    if (bb.isEmpty()) return null
    const cen = bb.getCenter(new V3())
    const holder = new THREE.Group()
    c.root.worldToLocal(cen)
    holder.position.copy(cen)
    c.effects.add(holder)
    c.effects.updateMatrixWorld(true)
    holder.attach(obj)
    const sz = bb.getSize(new V3())
    const piece = { o: holder, v: v, w: w, r: Math.max(0.08, Math.min(sz.x, sz.y, sz.z) * 0.5 + 0.02), landed: false, trail: 2.2 }
    c.flying = c.flying || []
    c.flying.push(piece)
    obj.traverse(function (x: any) {
      x.userData.noFollow = true
    })
    const di = c.deform.indexOf(obj)
    if (di >= 0) c.deform.splice(di, 1)
    return piece
  }
  function burnAll(c: any) {
    let i = 0
    c.vehicle.traverse(function (o: any) {
      if (o.isSprite) {
        o.visible = false
        return
      }
      if (!o.isMesh || o.userData.decal) return
      const mt = o.material
      if (!mt || Array.isArray(mt)) return
      if (mt === MATERIALS.rubber) {
        o.material = BURNT_RUB
        return
      }
      if (mt.transparent && mt.opacity < 0.7) {
        if (!o.userData.glass) o.visible = false
        return
      }
      o.material = BURNT[i++ % BURNT.length]
    })
    c.lights.forEach(function (L: any) {
      L.broken = true
      L.lens.forEach(function (m: any) {
        m.visible = false
      })
      ;(L.halo || []).forEach(function (h: any) {
        h.visible = false
      })
    })
  }
  function bigBoomFx(c: any) {
    const g = new THREE.Group()
    c.effects.add(g)
    c.bigFx = { g: g, t: 0, rings: [], col: [] }
    ;[
      [12, '#d8322a', kit.t('blast.lethal', { m: 12 })],
      [30, '#e0a548', kit.t('blast.injury', { m: 30 })],
    ].forEach(function (r: any) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r[0] - 0.25, r[0], 96), boomMat(r[1], 0.85))
      ring.rotation.x = -PI / 2
      ring.position.y = 0.06
      ring.renderOrder = 5
      g.add(ring)
      const fill = new THREE.Mesh(new THREE.CircleGeometry(r[0], 96), boomMat(r[1], 0.07))
      fill.rotation.x = -PI / 2
      fill.position.y = 0.05
      g.add(fill)
      const lb = new THREE.Mesh(
        new THREE.PlaneGeometry(r[0] * 0.45, r[0] * 0.08),
        new THREE.MeshBasicMaterial({
          map: textTexture(r[2], { w: 1024, h: 160, fg: r[1], size: 0.62 }),
          transparent: true,
          depthWrite: false,
          fog: false,
        }),
      )
      lb.rotation.x = -PI / 2
      lb.position.set(0, 0.08, r[0] + r[0] * 0.06)
      g.add(lb)
      c.bigFx.rings.push(ring, fill, lb)
    })
  }
  function detonate(c: any) {
    const m = c.meta
    const B = c.blast
    const ep = enginePos(c)
    const cen = c.toEffects(new V3(((m.front || 1) + (m.rear || -1)) / 2, (m.clearance || 0.3) + (m.bodyHeight || 0.6) * 0.5, 0))
    const big = !!m.bigBlast
    B.phase = 'flight'
    B.t = 0
    B.vy = Math.sqrt(2 * 9.8 * (big ? 1.0 : 1.5))
    B.y0 = c.vehicle.position.y
    B.rx = (c.rand() - 0.5) * 0.5
    B.rz = (c.rand() - 0.5) * 0.35
    c.exploded = true
    c.engineHealth = 0
    c.emitters = c.emitters.filter(function (e: any) {
      return e.kind !== 'exhaust'
    })
    /* flash, fireball, smoke, shock wave on the ground */
    const fl = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: I.glowTexture(),
        color: 0xffd9a0,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    )
    fl.raycast = function () {}
    fl.position.copy(cen)
    fl.scale.setScalar(0.1)
    c.effects.add(fl)
    B.flash = fl
    const sw = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 64), boomMat('#ffcf8a', 0.6, true))
    sw.rotation.x = -PI / 2
    sw.position.set(cen.x, 0.07, cen.z)
    c.effects.add(sw)
    B.shock = sw
    const k = big ? 1.8 : 1
    for (let i = 0; i < (big ? 70 : 46); i++) {
      const d = new V3(c.rand() - 0.5, c.rand() * 0.9, c.rand() - 0.5).normalize()
      kit.spawn(c, 'fire', cen.clone().addScaledVector(d, 0.3), d.multiplyScalar((2.5 + c.rand() * 4) * k), {
        s: (1.0 + c.rand() * 1.4) * k,
        life: 0.8 + c.rand() * 0.7,
      })
    }
    for (let j = 0; j < (big ? 30 : 18); j++) {
      const d2 = new V3(c.rand() - 0.5, 0.4 + c.rand(), c.rand() - 0.5).normalize()
      kit.spawn(c, 'smoke', cen.clone().addScaledVector(d2, 0.6), d2.multiplyScalar(1.5 + c.rand() * 2), {
        variant: 'black',
        s: (1.4 + c.rand()) * k,
        life: 4 + c.rand() * 2,
      })
    }
    I.burst(c, 'spark', cen, 40, { speed: 7, spread: 1.6 })
    I.burst(c, 'scrap', cen, 14, {
      speed: 5,
      spread: 1.5,
      mat: makeMaterial(paintColor(m.color || '#777', c.state), { roughness: 0.5, metalness: 0.3, side: DOUBLE_SIDE }),
    })
    I.burst(c, 'plastic', cen, 8, { speed: 4 })
    /* the glass bursts into shards */
    c.glass.slice().forEach(function (gm2: any) {
      const G = gm2.userData.glass
      if (!G || G.broken || !gm2.visible || !gm2.parent) return
      if (G.type === 'laminated') {
        G.type = 'tempered'
      }
      I.shatterGlass(c, gm2, 1.4, new V3(0, 1, 0))
    })
    /* parts that fly off with a fire trail */
    function rv(a: any, b: any) {
      return a + c.rand() * (b - a)
    }
    if (c.hood) {
      fling(c, c.hood.piv, new V3(rv(1, 3), rv(6, 8.5), rv(-1.5, 1.5)), new V3(rv(-4, 4), rv(-2, 2), rv(3, 7)))
      c.hood = null
    }
    const W = m.width || 1.6
    const gh = m.glasshouse
    if (m.kind === 'car' && gh) {
      ;[1, -1].forEach(function (sd) {
        const dh = Math.max(0.35, (m.belt || 1) - (m.clearance || 0.3) - 0.08)
        const dx = gh.fb - 0.55
        const door = c.roundBox(0.95, dh, 0.045, 0.03, c.paint(m.color || '#777'), dx, (m.clearance || 0.3) + dh / 2 + 0.04, sd * (W / 2 + 0.01))
        const hole = c.roundBox(0.9, dh * 0.95, 0.02, 0.02, MATERIALS.dark, dx, (m.clearance || 0.3) + dh / 2 + 0.04, sd * (W / 2 - 0.01))
        hole.userData.noFollow = true
        fling(c, door, c.dirToEffects(new V3(rv(-1, 1), rv(3.5, 6), sd * rv(4, 6.5))), new V3(rv(-5, 5), rv(-4, 4), rv(-5, 5)))
      })
    }
    if (m.rearBumper && m.rearBumper.parent)
      fling(
        c,
        m.rearBumper.parent.isGroup && m.rearBumper.parent !== c.vehicle ? m.rearBumper.parent : m.rearBumper,
        c.dirToEffects(new V3(rv(-5, -3), rv(4, 6), rv(-1, 1))),
        new V3(rv(-3, 3), rv(-6, 6), rv(-3, 3)),
      )
    if (c.wheels.length) {
      const wi = Math.floor(c.rand() * c.wheels.length)
      const wh = c.wheels[wi]
      c.wheels.splice(wi, 1)
      c.parts.forEach(function (p: any) {
        if (p.obj === wh) p.done = true
      })
      fling(
        c,
        wh,
        c.dirToEffects(new V3(rv(-2, 2), rv(5, 7.5), (wh.position.z >= 0 ? 1 : -1) * rv(3, 5))),
        new V3(rv(-8, 8), rv(-3, 3), rv(-8, 8)),
      )
    }
    burnAll(c)
    /* low fire that stays on the shell */
    c.emitters = c.emitters.filter(function (e: any) {
      return e.kind === 'exhaust' ? false : true
    })
    c.emitters.forEach(function (e: any) {
      if (e.kind === 'fire') e.rate = Math.min(e.rate, 7)
    })
    kit.addEmitter(c, ep.clone().add(new V3(0, 0.15, 0)), 'fire', { rate: 8, s: 0.8 })
    kit.addEmitter(c, new V3(((m.front || 1) + (m.rear || -1)) / 2, (m.clearance || 0.3) + 0.35, 0), 'fire', { rate: 6, s: 0.7 })
    kit.addEmitter(c, ep.clone().add(new V3(0, 0.9, 0)), 'black', { rate: 4, s: 1.4 })
    c.parts.forEach(function (p: any) {
      if (p.kind === 'glass' || p.kind === 'headlight' || p.kind === 'taillight' || p.kind === 'hood') p.done = true
    })
    c.log.push({ kind: 'explosion', label: kit.t(big ? 'blast.tank_explosion' : 'blast.explosion') })
    if (big) bigBoomFx(c)
  }
  function tickBoom(c: any, dt: any) {
    const B = c.blast
    B.t += dt
    if (B.phase === 'fire') {
      if (B.t >= B.T) detonate(c)
      return
    }
    if (B.phase === 'flight') {
      B.vy -= 9.8 * dt
      c.vehicle.position.y += B.vy * dt
      c.vehicle.rotation.x += B.rx * dt * (B.vy > 0 ? 1 : -1)
      c.vehicle.rotation.z += B.rz * dt * (B.vy > 0 ? 1 : -1)
      if (c.vehicle.position.y <= B.y0 && B.vy < 0) {
        c.vehicle.position.y = B.y0
        if (B.vy < -2.5) {
          B.vy *= -0.18
          I.burst(c, 'dust', c.toEffects(new V3(0, 0.1, 0)).setY(0.1), 10, { speed: 1.5, spread: 2.5, jitter: 1.0, s: 1.6 })
        } else {
          B.phase = 'burnt'
          c.vehicle.rotation.x *= 0.3
          c.vehicle.rotation.z *= 0.3
        }
      }
    }
    if (B.flash) {
      const ft = B.t / 0.6
      if (ft < 1) {
        const sc = (c.meta.bigBlast ? 22 : 9) * Math.sin(Math.min(1, ft * 4) * PI * 0.5)
        B.flash.scale.set(sc, sc, 1)
        B.flash.material.opacity = 1 - ft
      } else {
        c.effects.remove(B.flash)
        B.flash.material.dispose()
        B.flash = null
      }
    }
    if (B.shock) {
      const st = B.t / 0.7
      if (st < 1) {
        const r = (c.meta.bigBlast ? 18 : 7) * st + 0.5
        B.shock.scale.set(r, r, 1)
        B.shock.material.opacity = 0.6 * (1 - st)
      } else {
        c.effects.remove(B.shock)
        B.shock.geometry.dispose()
        B.shock = null
      }
    }
  }
  function tickFlying(c: any, dt: any) {
    ;(c.flying || []).forEach(function (P: any) {
      if (P.landed) {
        if (P.trail > 0) {
          P.trail -= dt
          if (c.rand() < dt * 8) kit.spawn(c, 'fire', P.o.position.clone(), new V3(0, 0.8, 0), { s: 0.35, life: 0.5 })
        }
        return
      }
      P.v.y -= 9.8 * dt
      P.o.position.addScaledVector(P.v, dt)
      P.o.rotation.x += P.w.x * dt
      P.o.rotation.y += P.w.y * dt
      P.o.rotation.z += P.w.z * dt
      if (P.trail > 0 && c.rand() < dt * 30) {
        kit.spawn(c, 'fire', P.o.position.clone(), P.v.clone().multiplyScalar(-0.1), { s: 0.45 + c.rand() * 0.3, life: 0.45 })
        if (c.rand() < 0.4) kit.spawn(c, 'smoke', P.o.position.clone(), new V3(0, 0.6, 0), { variant: 'black', s: 0.5, life: 2 })
      }
      if (P.o.position.y < P.r) {
        P.o.position.y = P.r
        if (P.v.y < -2) {
          P.v.y *= -0.3
          P.v.x *= 0.5
          P.v.z *= 0.5
          P.w.multiplyScalar(0.5)
          I.burst(c, 'spark', P.o.position.clone().setY(0.05), 8, { speed: 2 })
        } else {
          P.landed = true
          P.o.rotation.x = Math.round(P.o.rotation.x / (PI / 2)) * (PI / 2) * 0 + P.o.rotation.x * 0.2
          P.o.rotation.z *= 0.2
        }
      }
    })
    if (c.bigFx) {
      const F = c.bigFx
      F.t += dt
      /* mushroom: a column that rises and a cap that opens to ~16 m */
      if (F.t < 4.5) {
        const cen = c.toEffects(new V3(((c.meta.front || 1) + (c.meta.rear || -1)) / 2, 1.5, 0))
        if (c.rand() < dt * 40)
          kit.spawn(
            c,
            'fire',
            cen.clone().add(new V3((c.rand() - 0.5) * 1.5, c.rand() * 2, (c.rand() - 0.5) * 1.5)),
            new V3(c.rand() - 0.5, 7 + c.rand() * 3, c.rand() - 0.5),
            { s: 2.6 + c.rand() * 1.5, life: 1.8, nofog: true },
          )
        if (c.rand() < dt * 18)
          kit.spawn(
            c,
            'smoke',
            cen.clone().add(new V3(0, 2, 0)),
            new V3((c.rand() - 0.5) * 0.6, 8 + c.rand() * 2, (c.rand() - 0.5) * 0.6),
            { variant: 'gray', s: 2.6, life: 2.0, grow: 1.6, nofog: true },
          )
        if (F.t > 1.0 && c.rand() < dt * 30) {
          const a = c.rand() * PI * 2
          kit.spawn(
            c,
            'smoke',
            cen.clone().add(new V3(Math.cos(a) * 2, 14.5 + c.rand() * 2, Math.sin(a) * 2)),
            new V3(Math.cos(a) * 3.2, 0.6, Math.sin(a) * 3.2),
            { variant: 'gray', s: 3.6, life: 5, grow: 2.2, nofog: true },
          )
        }
        if (F.t > 0.8 && c.rand() < dt * 10) {
          const a2 = c.rand() * PI * 2
          kit.spawn(
            c,
            'fire',
            cen.clone().add(new V3(Math.cos(a2) * 1.5, 15 + c.rand(), Math.sin(a2) * 1.5)),
            new V3(Math.cos(a2) * 2.5, 0.4, Math.sin(a2) * 2.5),
            { s: 3.8, life: 1.3, nofog: true },
          )
        }
      }
      const fade = F.t < 6 ? 1 : Math.max(0, 1 - (F.t - 6) / 2)
      F.rings.forEach(function (r: any, i: any) {
        r.material.opacity = (i % 3 === 1 ? 0.07 : 0.85) * fade * Math.min(1, F.t * 3)
      })
      if (fade <= 0) {
        c.effects.remove(F.g)
        c.bigFx = null
      }
    }
  }

  Object.assign(I, { BURNT, BURNT_RUB, boomMat, enginePos, fling, burnAll, bigBoomFx, detonate, tickBoom, tickFlying })
}
