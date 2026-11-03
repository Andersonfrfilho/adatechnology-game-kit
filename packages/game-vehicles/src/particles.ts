/** Particle system: smoke, fire, sparks, shards, dust and water. */
import type { Kit } from './types'
import { warnOnce } from '@adatechnology/game-contracts'
import { routedParticleRequest, ROUTED_PARTICLE_TYPES } from './routed-particles'
import { clamp, hash, smooth } from './util'

export function installParticles(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._
  const document = kit.document
  const { makeMaterial } = I

  /* ================= particles ================= */
  const PARTICLE_LIMIT = 400
  const PARTICLE_GEOMETRIES: any = {
    spark: new THREE.BoxGeometry(0.012, 0.012, 0.1),
    shard: new THREE.TetrahedronGeometry(0.028, 0),
    cube: new THREE.BoxGeometry(0.014, 0.014, 0.014),
    lens: new THREE.TetrahedronGeometry(0.022, 0),
    scrap: new THREE.BoxGeometry(0.07, 0.008, 0.05),
    plastic: new THREE.BoxGeometry(0.06, 0.014, 0.04),
    water: new THREE.SphereGeometry(0.03, 6, 4),
    droplet: new THREE.SphereGeometry(0.012, 6, 4),
  }
  const PARTICLE_MATERIALS: any = {
    spark: new THREE.MeshBasicMaterial({ color: 0xffc46a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }),
    shard: makeMaterial('#cfe3e8', { roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.8 }),
    cube: makeMaterial('#d6e8ec', { roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.85 }),
    lensclear: makeMaterial('#f2f6f7', { roughness: 0.05, transparent: true, opacity: 0.7 }),
    lensred: makeMaterial('#c0281c', { roughness: 0.05, transparent: true, opacity: 0.8 }),
    plastic: makeMaterial('#18191b', { roughness: 0.7 }),
    water: new THREE.MeshBasicMaterial({ color: 0xbfd8e0, transparent: true, opacity: 0.7, depthWrite: false }),
    droplet: makeMaterial('#0b0908', { roughness: 0.05, metalness: 0.7 }),
  }
  /* ---- smoke, fire and dust: sprite puffs with a noise texture; they grow, drift with the wind and dissolve by noise ---- */
  function valueNoise(seed: any) {
    const N = 16
    const g: any = []
    for (let i = 0; i < N * N; i++) g.push(hash(i % N, (i / N) | 0, seed))
    return function (x: any, y: any) {
      const xi = Math.floor(x)
      const yi = Math.floor(y)
      const fx = x - xi
      const fy = y - yi
      const sx = fx * fx * (3 - 2 * fx)
      const sy = fy * fy * (3 - 2 * fy)
      function G(a: any, b: any) {
        return g[(((a % N) + N) % N) + (((b % N) + N) % N) * N]
      }
      const a = G(xi, yi) + (G(xi + 1, yi) - G(xi, yi)) * sx
      const b = G(xi, yi + 1) + (G(xi + 1, yi + 1) - G(xi, yi + 1)) * sx
      return a + (b - a) * sy
    }
  }
  function puffTexture(seed: any, fire: any) {
    const S = 96
    const cv = document.createElement('canvas')
    cv.width = cv.height = S
    const x: any = cv.getContext('2d')
    const img = x.createImageData(S, S)
    const nz = valueNoise(seed)
    for (let j = 0; j < S; j++)
      for (let i = 0; i < S; i++) {
        const u = (i / S) * 2 - 1
        const v = (j / S) * 2 - 1
        const r = Math.hypot(u, v)
        const f = nz(i / 12, j / 12) * 0.5 + nz(i / 6 + 7, j / 6 + 3) * 0.3 + nz(i / 3 + 11, j / 3 + 5) * 0.2
        const edge = 1 - smooth((r - 0.25 - f * 0.35) / 0.45)
        const a = clamp(edge * (0.55 + f * 0.6), 0, 1)
        const k = (j * S + i) * 4
        if (fire) {
          const hot = clamp(1 - r * 1.3 + f * 0.3, 0, 1)
          img.data[k] = 255
          img.data[k + 1] = Math.round(90 + 165 * hot)
          img.data[k + 2] = Math.round(30 + 170 * hot * hot * hot)
        } else {
          const sh = Math.round(150 + 105 * clamp(f * 1.1 - v * 0.25, 0, 1))
          img.data[k] = img.data[k + 1] = img.data[k + 2] = sh
        }
        img.data[k + 3] = Math.round(a * 255)
      }
    x.putImageData(img, 0, 0)
    const t = new THREE.CanvasTexture(cv)
    return t
  }
  let SMOKE_TEXTURES: any = null
  let FIRE_TEXTURES: any = null
  function puffMaterial(fire: any, col: any, op: any) {
    if (!SMOKE_TEXTURES) {
      SMOKE_TEXTURES = [1, 2, 3, 4].map(function (k) {
        return puffTexture(k * 13, false)
      })
      FIRE_TEXTURES = [5, 6, 7].map(function (k) {
        return puffTexture(k * 17, true)
      })
    }
    const list = fire ? FIRE_TEXTURES : SMOKE_TEXTURES
    const build = () =>
      new THREE.SpriteMaterial({
        map: list[Math.floor(Math.random() * list.length)],
        color: new THREE.Color(col),
        transparent: true,
        depthWrite: false,
        opacity: op,
        blending: fire ? THREE.AdditiveBlending : THREE.NormalBlending,
      })
    const mat = kit.particleMaterials ? kit.particleMaterials.own(build) : build()
    const dis = { value: 0 }
    mat.userData.dis = dis
    mat.onBeforeCompile = function (sh: any) {
      sh.uniforms.uDis = dis
      /* the sampled texel is called texelColor up to r152 and sampledDiffuseColor from r153 */
      const texel = parseInt(THREE.REVISION, 10) >= 153 ? 'sampledDiffuseColor' : 'texelColor'
      sh.fragmentShader =
        'uniform float uDis;\n' +
        sh.fragmentShader.replace(
          '#include <alphatest_fragment>',
          'diffuseColor.a *= smoothstep(uDis, uDis + 0.2, ' + texel + '.a); if (diffuseColor.a < 0.003) discard;',
        )
    }
    return mat
  }
  const SPRITE_TYPES: any = { smoke: 1, fire: 1, dust: 1 }
  const PUFF_COLORS: any = {
    smokewhite: ['#9aa1a7', 0.42],
    smokeblack: ['#1b1b1c', 0.62],
    smokegray: ['#55595c', 0.5],
    smokesteam: ['#b6bcc1', 0.3],
    dust: ['#6e6658', 0.34],
    fire: ['#ffffff', 0.9],
  }
  const WIND = new V3(-0.45, 0, 0.16)
  const PARTICLE_LIFE: any = { spark: 0.6, dust: 1.6, smoke: 2.8, fire: 0.7, water: 1.2, droplet: 1.0 }
  const TRANSIENT_TYPES: any = { spark: 1, dust: 1, smoke: 1, fire: 1, water: 1, droplet: 1 }
  function killParticle(c: any, i: any) {
    const P = c.particles[i]
    c.effects.remove(P.m)
    if (P.own) {
      if (kit.particleMaterials) kit.particleMaterials.release(P.m.material)
      else P.m.material.dispose()
    }
    c.particles.splice(i, 1)
  }
  /* Particle in the sibling group c.effects (vehicle world coordinates). type: spark|shard|cube|lens|scrap|plastic|dust|smoke|fire|water|droplet */
  /* The effects world draws the puff and its budget caps it: positions and velocities go from the vehicle's effects group to the world. */
  function routeParticle(c: any, effects: any, type: any, pos: any, vel: any, o: any) {
    c.effects.updateWorldMatrix(true, false)
    const at = pos.clone().applyMatrix4(c.effects.matrixWorld)
    const to = vel.clone().transformDirection(c.effects.matrixWorld).multiplyScalar(vel.length())
    const colour = o.col == null ? undefined : new THREE.Color(o.col).getHex()
    effects.play(
      routedParticleRequest({
        type,
        position: [at.x, at.y, at.z],
        velocity: [to.x, to.y, to.z],
        ...(o.variant ? { variant: o.variant } : {}),
        ...(colour !== undefined ? { color: colour } : {}),
        ...(o.op != null ? { alpha: o.op } : {}),
        ...(o.s ? { size: o.s } : {}),
        ...(o.life ? { life: o.life } : {}),
        ...(o.grow ? { grow: o.grow } : {}),
      }),
    )
    return null
  }
  kit.spawn = function (c: any, type: any, pos: any, vel: any, o: any) {
    o = o || {}
    const effects = ROUTED_PARTICLE_TYPES[type] ? kit.effects?.() : undefined
    if (effects) return routeParticle(c, effects, type, pos, vel, o)
    if (ROUTED_PARTICLE_TYPES[type] && !kit.effects) warnOnce('game-vehicles.own-particles', 'game-vehicles drew its smoke, fire and dust with sprites of its own because the host lent no effects world (options.effects); pass the host effects so the puffs share one budget')
    if (c.particles.length >= PARTICLE_LIMIT) {
      const idx = c.particles.findIndex(function (q: any) {
        return TRANSIENT_TYPES[q.type]
      })
      killParticle(c, idx >= 0 ? idx : 0)
    }
    let m
    let own = false
    let op = 1
    if (SPRITE_TYPES[type]) {
      const pc = PUFF_COLORS[type + (o.variant || '')] || PUFF_COLORS[type] || PUFF_COLORS.smokewhite
      const opv = o.op != null ? o.op : pc[1]
      m = new THREE.Sprite(puffMaterial(type === 'fire', o.col || pc[0], opv))
      m.raycast = function () {}
      own = true
      op = opv
      if (o.nofog) m.material.fog = false
      m.material.rotation = c.rand() * PI * 2
      m.scale.setScalar(0.01)
    } else {
      const mat = o.mat || PARTICLE_MATERIALS[type + (o.variant || '')] || PARTICLE_MATERIALS[type]
      m = new THREE.Mesh(PARTICLE_GEOMETRIES[type], mat)
      m.castShadow = false
      m.receiveShadow = false
      op = mat.opacity
      if (o.s) m.scale.setScalar(o.s)
      m.rotation.set(c.rand() * 6, c.rand() * 6, c.rand() * 6)
    }
    m.position.copy(pos)
    c.effects.add(m)
    const P = {
      m: m,
      v: vel.clone(),
      type: type,
      age: 0,
      life: o.life || PARTICLE_LIFE[type] || 99,
      rest: false,
      w: new V3(c.rand() - 0.5, c.rand() - 0.5, c.rand() - 0.5).multiplyScalar(14),
      s0: o.s || 1,
      op: op,
      own: own,
      r: o.r || 0.01,
      spin: (c.rand() - 0.5) * 1.2,
      ph: c.rand() * 6.28,
      grow: o.grow || 1,
    }
    c.particles.push(P)
    return P
  }
  const _q = new THREE.Quaternion()
  const _z = new V3(0, 0, 1)
  const _t = new V3()
  function tickParticles(c: any, dt: any) {
    for (let i = c.particles.length - 1; i >= 0; i--) {
      const P = c.particles[i]
      if (P.rest) continue
      P.age += dt
      const m = P.m
      const t = P.age / P.life
      if (t >= 1 && TRANSIENT_TYPES[P.type]) {
        killParticle(c, i)
        continue
      }
      if (P.type === 'spark') {
        P.v.y -= 9.8 * dt
        m.position.addScaledVector(P.v, dt)
        if (m.position.y < 0.005) {
          m.position.y = 0.005
          P.v.y *= -0.35
          P.v.x *= 0.6
          P.v.z *= 0.6
        }
        const sp = P.v.length()
        if (sp > 0.01) {
          m.quaternion.setFromUnitVectors(_z, _t.copy(P.v).divideScalar(sp))
          m.scale.set(1, 1, clamp(sp * 0.25, 0.3, 1.6) * (1 - t))
        }
      } else if (P.type === 'smoke' || P.type === 'dust') {
        /* thrust that fades, drag towards the wind speed, soft turbulence */
        const k = Math.min(1, dt * (P.type === 'dust' ? 2.5 : 0.9))
        P.v.x += (WIND.x - P.v.x) * k
        P.v.z += (WIND.z - P.v.z) * k
        P.v.y = P.type === 'dust' ? P.v.y * Math.max(0, 1 - 2.5 * dt) : P.v.y * Math.max(0, 1 - 0.7 * dt) + 0.08 * dt
        m.position.addScaledVector(P.v, dt)
        m.position.x += Math.sin(P.age * 1.7 + P.ph) * 0.08 * dt
        m.position.z += Math.cos(P.age * 1.3 + P.ph) * 0.08 * dt
        const gs = P.s0 * P.grow * (0.18 + 1.5 * (1 - Math.exp(-P.age * 1.1)) + P.age * 0.12)
        m.scale.set(gs, gs, 1)
        m.material.rotation += P.spin * dt
        m.material.opacity = P.op * Math.min(1, P.age / 0.3)
        m.material.userData.dis.value = Math.pow(t, 1.3) * 0.95
      } else if (P.type === 'fire') {
        P.v.x += (WIND.x * 0.6 - P.v.x) * Math.min(1, dt * 1.5)
        P.v.z += (WIND.z * 0.6 - P.v.z) * Math.min(1, dt * 1.5)
        m.position.addScaledVector(P.v, dt)
        const fs =
          P.s0 * (0.35 + 0.5 * Math.sin(Math.min(1, t * 1.4) * PI * 0.5)) * (1 - t * 0.55) * (0.9 + 0.2 * Math.sin(P.age * 25 + P.ph))
        m.scale.set(fs * 0.85, fs * 1.25, 1)
        m.material.rotation += P.spin * dt * 2
        m.material.color.setHSL(0.11 - t * 0.09, 1, 0.62 - t * 0.3)
        m.material.userData.dis.value = Math.pow(t, 1.1) * 0.9
      } else if (P.type === 'water') {
        P.v.y -= 9.8 * dt
        m.position.addScaledVector(P.v, dt)
        if (m.position.y < -0.05) killParticle(c, i)
      } else if (P.type === 'droplet') {
        P.v.y -= 9.8 * dt
        m.position.addScaledVector(P.v, dt)
        if (m.position.y < 0.012) killParticle(c, i)
      } else {
        P.v.y -= 9.8 * dt
        m.position.addScaledVector(P.v, dt)
        m.rotation.x += P.w.x * dt
        m.rotation.y += P.w.y * dt
        m.rotation.z += P.w.z * dt
        const floor = P.floor != null ? P.floor : 0.006
        if (m.position.y < floor) {
          m.position.y = floor
          if (Math.abs(P.v.y) < 1.1) {
            P.rest = true
            m.rotation.x = (c.rand() - 0.5) * 0.3
            m.rotation.z = (c.rand() - 0.5) * 0.3
          } else {
            P.v.y *= -0.32
            P.v.x *= 0.5
            P.v.z *= 0.5
            P.w.multiplyScalar(0.5)
          }
        }
      }
    }
  }
  function burst(c: any, type: any, pFx: any, n: any, o: any) {
    o = o || {}
    const d = o.dir || new V3(0, 1, 0)
    const spd = o.speed || 2
    const spread = o.spread == null ? 1 : o.spread
    for (let i = 0; i < n; i++) {
      const v = new V3(c.rand() - 0.5, c.rand() * 0.8, c.rand() - 0.5).multiplyScalar(spread * spd).addScaledVector(d, spd * (0.5 + c.rand()))
      kit.spawn(
        c,
        type,
        pFx
          .clone()
          .add(new V3((c.rand() - 0.5) * (o.jitter || 0.08), (c.rand() - 0.5) * (o.jitter || 0.08), (c.rand() - 0.5) * (o.jitter || 0.08))),
        v,
        o,
      )
    }
  }
  kit.burst = burst
  /* Continuous emitter. p in c.vehicle (or in the vehicle world with o.world). kind: white|black|fire|exhaust (exhaust follows c.engineHealth) */
  kit.addEmitter = function (c: any, p: any, kind: any, o: any) {
    o = o || {}
    if (
      c.emitters.some(function (e: any) {
        return e.kind === kind && e.p.distanceTo(p) < 0.3
      })
    )
      return null
    const e = {
      p: p.clone(),
      kind: kind,
      world: !!o.world,
      rate: o.rate || (kind === 'fire' ? 14 : kind === 'exhaust' ? 7 : 6),
      acc: 0,
      s: o.s || 1,
      dir: o.dir || null,
      gap: 0,
    }
    c.emitters.push(e)
    return e
  }
  /* colour and opacity of the exhaust smoke by engine condition: 100% almost invisible, 60% grey, 30% dark grey, 10% black with misfires */
  function exhaustLook(h: any) {
    if (h >= 0.85) return ['#a7adb2', 0.05]
    if (h >= 0.45) return ['#7b8084', 0.2 + (0.85 - h) * 0.3]
    if (h >= 0.2) return ['#3f4245', 0.42]
    return ['#141414', 0.66]
  }
  kit.exhaustLook = exhaustLook
  function tickEmit(c: any, dt: any) {
    c.emitters.forEach(function (e: any) {
      if (e.kind === 'exhaust') {
        const h = c.engineHealth == null ? 1 : c.engineHealth
        if (h <= 0 || c.flipped || c.rollState) return
        if (h < 0.2) {
          e.gap -= dt
          if (e.gap < -0.5 && c.rand() < dt * 1.5) e.gap = 0.25 + c.rand() * 0.35
          if (e.gap > 0) return
        }
      }
      e.acc += e.rate * dt
      while (e.acc >= 1) {
        e.acc -= 1
        const p = e.world ? e.p.clone() : c.toEffects(e.p)
        if (e.kind !== 'exhaust') {
          p.x += (c.rand() - 0.5) * 0.15
          p.z += (c.rand() - 0.5) * 0.15
        }
        if (e.kind === 'fire') {
          kit.spawn(c, 'fire', p, new V3((c.rand() - 0.5) * 0.3, 1.1 + c.rand() * 0.8, (c.rand() - 0.5) * 0.3), {
            s: (0.45 + c.rand() * 0.45) * e.s,
            life: 0.55 + c.rand() * 0.35,
          })
          if (c.rand() < 0.45)
            kit.spawn(c, 'smoke', p.clone().add(new V3(0, 0.7 * e.s, 0)), new V3(0, 1.0, 0), { variant: 'black', s: 0.9 * e.s, life: 3.2 })
          if (c.rand() < 0.15)
            kit.spawn(
              c,
              'spark',
              p.clone().add(new V3(0, 0.2, 0)),
              new V3((c.rand() - 0.5) * 0.6, 1.6 + c.rand(), (c.rand() - 0.5) * 0.6),
              { life: 0.9 },
            )
        } else if (e.kind === 'exhaust') {
          const lk = exhaustLook(c.engineHealth == null ? 1 : c.engineHealth)
          const d = e.dir ? c.dirToEffects(e.dir) : c.dirToEffects(new V3(-1, 0, 0))
          kit.spawn(c, 'smoke', p, d.multiplyScalar(1.1 + c.rand() * 0.4).add(new V3(0, 0.15, 0)), {
            col: lk[0],
            op: lk[1],
            s: 0.35 + c.rand() * 0.15,
            life: 1.4 + c.rand() * 0.5,
          })
        } else {
          const preta = e.kind === 'black'
          kit.spawn(
            c,
            'smoke',
            p,
            new V3((c.rand() - 0.5) * 0.2, preta ? 0.9 + c.rand() * 0.3 : 1.1 + c.rand() * 0.3, (c.rand() - 0.5) * 0.2),
            { variant: preta ? 'black' : 'steam', s: (preta ? 0.75 : 0.6) * e.s * (0.8 + c.rand() * 0.4), life: preta ? 3.2 : 2.0 },
          )
        }
      }
    })
  }

  Object.assign(I, {
    PARTICLE_LIMIT,
    PARTICLE_GEOMETRIES,
    PARTICLE_MATERIALS,
    valueNoise,
    puffTexture,
    puffMaterial,
    SPRITE_TYPES,
    PUFF_COLORS,
    WIND,
    PARTICLE_LIFE,
    TRANSIENT_TYPES,
    killParticle,
    _q,
    _z,
    _t,
    tickParticles,
    burst,
    exhaustLook,
    tickEmit,
  })
}
