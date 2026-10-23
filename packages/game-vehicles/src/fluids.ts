/** Fluid types (oil, stains, rain...) and the splat/puddle system. */
import type { Kit } from './types'
import { clamp } from './util'

export function installFluids(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const PI = Math.PI
  const I = kit._
  const { DOUBLE_SIDE } = I

  /* ================= fluids ================= */
  /* Splat fluid types. A game registers its own with kit.defineFluid(key, def) or configure({ fluids }).
     def: { fresh, dry (hex colours), dryTime (s until dry), roughFresh, roughDry, metalFresh, metalDry, wipeable (wiper/rain remove the fresh one) }
     Types without "fresh" (def.update(c, f, dt, i) returning true removes it) become fully custom fluids of the plugin. */
  kit.fluidTypes = {}
  kit.defineFluid = function (key: any, def: any) {
    const d = Object.assign({ dryTime: 600, roughFresh: 0.12, roughDry: 0.92, metalFresh: 0.15, metalDry: 0, wipeable: false }, def || {})
    d.key = key
    d.freshC = new THREE.Color(d.fresh || '#444444')
    d.dryC = new THREE.Color(d.dry || d.fresh || '#222222')
    kit.fluidTypes[key] = d
    return d
  }
  kit.defineFluid('stain', { fresh: '#4a4a44', dry: '#26241f', wipeable: false })
  const _fr = new THREE.Raycaster()
  /* Liquid splat: a flat stain glued to the surface, irregular outline, satellite drops and a trickle that runs down,
     thins and ends in a bulb. The trickle stops when the volume runs out. Glossy when fresh, dries matte in the fluid type's time.
     o: { fluid (key of kit.fluidTypes; default config.defaultSplat), glass, obj (mesh to attach to; the trickle follows its curve) } */
  kit.splat = function (c: any, p: any, n: any, r: any, o: any) {
    o = o || {}
    n = n.clone().normalize()
    const fdef = kit.fluidTypes[o.fluid || kit.config.defaultSplat] || kit.fluidTypes.stain
    const mat = new THREE.MeshStandardMaterial({
      color: fdef.freshC.clone(),
      roughness: fdef.roughFresh,
      metalness: fdef.metalFresh,
      side: DOUBLE_SIDE,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    })
    const grp = new THREE.Group()
    grp.position.copy(p)
    c.vehicle.add(grp)
    const g = new V3(0, -1, 0).addScaledVector(n, n.y)
    if (g.lengthSq() < 1e-4) g.set(1, 0, 0)
    g.normalize()
    const side = new V3().crossVectors(g, n).normalize()
    const M = new THREE.Matrix4().makeBasis(g, n, side)
    grp.quaternion.setFromRotationMatrix(M)
    const rnd = c.rand
    const nz = I.valueNoise(Math.floor(rnd() * 1000))
    function blobShape(cx: any, cz: any, rr: any, k: any, ph: any) {
      const sh = new THREE.Shape()
      const N = 28
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * PI * 2
        const q = rr * (0.72 + 0.42 * nz(Math.cos(a) * k + ph, Math.sin(a) * k + ph) + 0.12 * Math.max(0, Math.cos(a)))
        const x = cx + Math.cos(a) * q
        const y = cz + Math.sin(a) * q
        if (i === 0) sh.moveTo(x, y)
        else sh.lineTo(x, y)
      }
      return sh
    }
    const shapes = [blobShape(0, 0, r, 2.2, rnd() * 9)]
    const nsat = 4 + Math.floor(rnd() * 4)
    for (let i = 0; i < nsat; i++) {
      const a = rnd() * PI * 2
      const d = r * (1.15 + rnd() * 1.1)
      shapes.push(blobShape(Math.cos(a) * d, Math.sin(a) * d, r * (0.07 + rnd() * 0.12), 3, rnd() * 9))
    }
    const bg = new THREE.ShapeGeometry(shapes, 2)
    bg.rotateX(PI / 2)
    const blob = new THREE.Mesh(bg, mat)
    blob.castShadow = false
    blob.receiveShadow = true
    blob.position.y = 0.004
    grp.add(blob)
    /* trickle path: samples along the descent, glued to the surface by ray against the source mesh */
    const Lmax = r * (2.2 + rnd() * 2.2)
    const NS = 10
    const off = []
    c.root.updateMatrixWorld(true)
    for (let k = 0; k <= NS; k++) {
      const xl = r * 0.55 + (Lmax * k) / NS
      let h = 0.004
      if (o.obj && o.obj.isMesh && k > 0) {
        const lp = p.clone().addScaledVector(g, xl)
        const wo = lp.clone().addScaledVector(n, 0.2).applyMatrix4(c.vehicle.matrixWorld)
        const wd = n.clone().negate().transformDirection(c.vehicle.matrixWorld)
        _fr.set(wo, wd)
        _fr.far = 0.45
        const hit = _fr.intersectObject(o.obj, false)[0]
        if (hit) {
          const hl = hit.point.clone().applyMatrix4(new THREE.Matrix4().copy(c.vehicle.matrixWorld).invert())
          h = hl.sub(p).dot(n) + 0.004
          if (h < -0.15) h = off[k - 1]
        } else h = off[k - 1]
      }
      off.push(h)
    }
    const drip = new THREE.Mesh(new THREE.BufferGeometry(), mat)
    drip.castShadow = false
    grp.add(drip)
    const f = {
      kind: fdef.key,
      def: fdef,
      grp: grp,
      mat: mat,
      drip: drip,
      r: r,
      t: 0,
      onGlass: !!o.glass,
      Lmax: Lmax,
      off: off,
      len: -1,
      w0: r * (0.26 + rnd() * 0.1),
    }
    buildDrip(f, 0.02)
    c.fluids.push(f)
    return f
  }
  function buildDrip(f: any, L: any) {
    const pos = []
    const NS = 12
    const r = f.r
    const x0 = r * 0.55
    function hAt(x: any) {
      const u = clamp((x - x0) / f.Lmax, 0, 1) * (f.off.length - 1)
      const i = Math.min(f.off.length - 2, Math.floor(u))
      const t = u - i
      return f.off[i] + (f.off[i + 1] - f.off[i]) * t
    }
    let prev = null
    for (let k = 0; k <= NS; k++) {
      const t = k / NS
      const x = x0 - r * 0.25 + (L + r * 0.25) * t
      const hw = f.w0 * (1 - 0.72 * Math.pow(t, 0.7)) * (1 + 0.08 * Math.sin(t * 9 + r * 50))
      const y = hAt(x) + 0.0005
      const cur = [
        [x, y, -hw],
        [x, y, hw],
      ]
      if (prev)
        pos.push(
          prev[0][0],
          prev[0][1],
          prev[0][2],
          prev[1][0],
          prev[1][1],
          prev[1][2],
          cur[0][0],
          cur[0][1],
          cur[0][2],
          prev[1][0],
          prev[1][1],
          prev[1][2],
          cur[1][0],
          cur[1][1],
          cur[1][2],
          cur[0][0],
          cur[0][1],
          cur[0][2],
        )
      prev = cur
    }
    const bx = x0 + L + r * 0.02
    const by = hAt(bx) + 0.0008
    const rb = f.w0 * 0.62 * Math.min(1, 0.4 + L / (f.Lmax * 0.5))
    for (let q = 0; q < 14; q++) {
      const a0 = (q / 14) * PI * 2
      const a1 = ((q + 1) / 14) * PI * 2
      pos.push(bx, by, 0, bx + Math.cos(a1) * rb * 1.2, by, Math.sin(a1) * rb, bx + Math.cos(a0) * rb * 1.2, by, Math.sin(a0) * rb)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.computeVertexNormals()
    f.drip.geometry.dispose()
    f.drip.geometry = g
    f.len = L
  }
  /* Ground puddles: outline irregular by noise, lobes that advance towards the lower side and stop.
     oil: mirror-black centre, rainbow only on a thin edge with hue varying along it, never dries, drop that swells and makes a crown.
     diesel: like oil, lighter and slower, does not catch fire. gasoline: nearly transparent, darkens the asphalt ~45%, shimmering air, evaporates from the edge in 60 s. */
  const DOWNHILL = new V3(-0.55, 0, 0.83).normalize()
  const PN = 72
  function puddleGeometry() {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array((PN + 1) * 3)
    const nor = new Float32Array((PN + 1) * 3)
    const idx = []
    for (let i = 0; i <= PN; i++) nor[3 * i + 1] = 1
    for (let k = 0; k < PN; k++) idx.push(0, 1 + ((k + 1) % PN), 1 + k)
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
    g.setIndex(idx)
    return g
  }
  function rimGeometry() {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(PN * 2 * 3)
    const col = new Float32Array(PN * 2 * 3)
    const idx = []
    for (let k = 0; k < PN; k++) {
      const a = 2 * k
      const b = 2 * k + 1
      const c2 = 2 * ((k + 1) % PN)
      const d = c2 + 1
      idx.push(a, c2, b, b, c2, d)
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.setIndex(idx)
    return g
  }
  function puddle(c: any, kind: any, pLocal: any, maxR: any) {
    const q = c.toEffects(pLocal)
    const oily = kind === 'oil' || kind === 'diesel'
    const mat =
      kind === 'oil'
        ? new THREE.MeshStandardMaterial({
            color: 0x050404,
            roughness: 0.04,
            metalness: 0.85,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -2,
          })
        : kind === 'diesel'
          ? new THREE.MeshStandardMaterial({
              color: 0x15110a,
              roughness: 0.06,
              metalness: 0.6,
              transparent: true,
              opacity: 0.9,
              depthWrite: false,
            })
          : new THREE.MeshStandardMaterial({
              color: 0x000000,
              roughness: 0.03,
              metalness: 0.5,
              transparent: true,
              opacity: 0.45,
              depthWrite: false,
            })
    const m = new THREE.Mesh(puddleGeometry(), mat)
    m.position.set(q.x, kind === 'oil' ? 0.013 : 0.016, q.z)
    m.receiveShadow = true
    m.castShadow = false
    m.raycast = function () {}
    c.effects.add(m)
    const rnd = c.rand
    const lobes = []
    const nl = 5 + Math.floor(rnd() * 3)
    const down = Math.atan2(DOWNHILL.z, DOWNHILL.x)
    for (let i = 0; i < nl; i++) {
      const a = i < 2 ? down + (rnd() - 0.5) * 0.9 : rnd() * PI * 2
      const dh = Math.max(0, Math.cos(a - down))
      lobes.push({ a: a, w: 0.22 + rnd() * 0.3, amp: (0.1 + rnd() * 0.16) * (1 + 1.1 * dh), stop: 0.35 + rnd() * 0.65 })
    }
    const f: any = { kind: kind, m: m, t: 0, max: maxR, x0: q.x, z0: q.z, lobes: lobes, nz: I.valueNoise(Math.floor(rnd() * 999)), ph: rnd() * 10 }
    if (oily) {
      const rim = new THREE.Mesh(
        rimGeometry(),
        new THREE.MeshBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: kind === 'oil' ? 0.55 : 0.4,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      rim.position.set(q.x, m.position.y + 0.002, q.z)
      rim.raycast = function () {}
      c.effects.add(rim)
      f.rim = rim
    }
    if (kind === 'oil') {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), I.PARTICLE_MATERIALS.droplet)
      drop.raycast = function () {}
      c.effects.add(drop)
      f.drop = drop
      f.dy0 = Math.max(0.15, q.y - 0.1)
      drop.position.set(q.x, f.dy0, q.z)
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 0.7, 1, 18, 1, true),
        new THREE.MeshStandardMaterial({
          color: 0x0b0908,
          roughness: 0.05,
          metalness: 0.7,
          transparent: true,
          opacity: 0,
          side: DOUBLE_SIDE,
          depthWrite: false,
        }),
      )
      crown.position.set(q.x, 0.02, q.z)
      crown.visible = false
      crown.raycast = function () {}
      c.effects.add(crown)
      f.crown = crown
      f.phase = 0
    } else if (kind === 'gasoline') {
      const haze = new THREE.Mesh(
        puddleGeometry(),
        new THREE.MeshBasicMaterial({ color: 0x9fb2be, transparent: true, opacity: 0.035, depthWrite: false, side: DOUBLE_SIDE }),
      )
      haze.position.set(q.x, 0.22, q.z)
      haze.raycast = function () {}
      c.effects.add(haze)
      f.haze = haze
    }
    f.R = new Float32Array(PN)
    shapePuddle(f)
    c.fluids.push(f)
    return f
  }
  kit.puddle = puddle
  function shapePuddle(f: any) {
    const t = f.t
    let g
    let evap = 1
    if (f.kind === 'gasoline') {
      g = f.max * (1 - Math.exp(-f.t * 1.4))
    } else if (f.kind === 'diesel') g = f.max * Math.min(1, Math.sqrt(f.t / 70))
    else g = f.max * Math.min(1, Math.sqrt(f.t / 40))
    const grow = f.kind === 'gasoline' ? clamp(t / 6, 0, 1) : clamp(t / (f.kind === 'diesel' ? 90 : 60), 0, 1)
    const pos = f.m.geometry.attributes.position
    for (let k = 0; k < PN; k++) {
      const a = (k / PN) * PI * 2
      let rr =
        0.68 + 0.22 * f.nz(Math.cos(a) * 2.3 + f.ph, Math.sin(a) * 2.3 + f.ph) + 0.08 * f.nz(Math.cos(a) * 6 + 3, Math.sin(a) * 6 + 3)
      f.lobes.forEach(function (L: any) {
        const d = Math.atan2(Math.sin(a - L.a), Math.cos(a - L.a)) / L.w
        rr += L.amp * Math.exp(-d * d) * Math.min(1, grow / L.stop)
      })
      if (f.kind === 'gasoline' && t > 6) {
        /* evaporates from the edge: each stretch recedes at its own pace, the puddle vanishes in 60 s */
        const e = clamp((t - 6) / 54, 0, 1)
        evap = clamp(1 - e * (0.75 + 0.5 * f.nz(Math.cos(a) * 3 + 9, Math.sin(a) * 3 + 9)) - e * e * 0.4, 0, 1)
        rr *= evap
      }
      f.R[k] = g * rr
      pos.setXYZ(k + 1, Math.cos(a) * f.R[k], 0, Math.sin(a) * f.R[k])
    }
    pos.needsUpdate = true
    f.m.geometry.computeBoundingSphere()
    if (f.haze) {
      const hp = f.haze.geometry.attributes.position
      for (let j = 0; j < PN; j++) {
        const aa = (j / PN) * PI * 2
        const w = f.R[j] * (1 + 0.08 * Math.sin(t * 11 + j))
        hp.setXYZ(j + 1, Math.cos(aa) * w, 0.03 * Math.sin(t * 9 + j * 0.7), Math.sin(aa) * w)
      }
      hp.needsUpdate = true
      f.haze.geometry.computeBoundingSphere()
    }
    if (f.rim) {
      const rp = f.rim.geometry.attributes.position
      const rc = f.rim.geometry.attributes.color
      const col = new THREE.Color()
      for (let q = 0; q < PN; q++) {
        const an = (q / PN) * PI * 2
        const R = f.R[q]
        const band = Math.min(0.085, R * 0.16)
        rp.setXYZ(2 * q, Math.cos(an) * (R - band), 0, Math.sin(an) * (R - band))
        rp.setXYZ(2 * q + 1, Math.cos(an) * (R + 0.004), 0, Math.sin(an) * (R + 0.004))
        col.setHSL((an / PI + f.nz(Math.cos(an) * 4, Math.sin(an) * 4) * 0.8 + t * 0.01) % 1, 0.8, f.kind === 'oil' ? 0.5 : 0.36)
        rc.setXYZ(2 * q, 0, 0, 0)
        rc.setXYZ(2 * q + 1, col.r, col.g, col.b)
      }
      rp.needsUpdate = true
      rc.needsUpdate = true
      f.rim.geometry.computeBoundingSphere()
    }
    return evap
  }
  function updateFluids(c: any, dt: any) {
    for (let i = c.fluids.length - 1; i >= 0; i--) {
      const f = c.fluids[i]
      f.t += dt
      if (f.kind === 'gasoline') {
        shapePuddle(f)
        f.m.material.opacity = 0.45 * (f.t > 50 ? Math.max(0, (60 - f.t) / 10) : 1)
        if (f.t > 60) {
          c.effects.remove(f.m)
          c.effects.remove(f.haze)
          f.m.geometry.dispose()
          f.haze.geometry.dispose()
          c.fluids.splice(i, 1)
        }
      } else if (f.kind === 'oil' || f.kind === 'diesel') {
        if (f.t < 95 || (f.rimT = (f.rimT || 0) + dt) > 0.25) {
          f.rimT = 0
          shapePuddle(f)
        }
        if (f.drop) {
          /* the drop swells (0.9 s), detaches, falls and makes a crown when it hits the puddle */
          f.phase += dt
          const fall = Math.sqrt((2 * Math.max(0.05, f.dy0 - 0.015)) / 9.8)
          const cyc = 0.9 + fall + 0.5
          const ph = f.phase % cyc
          if (ph < 0.9) {
            const sw = 0.35 + (0.75 * ph) / 0.9
            f.drop.visible = true
            f.drop.position.y = f.dy0 - 0.01 * sw
            f.drop.scale.set(sw, sw * (1 + (0.5 * ph) / 0.9), sw)
            f.splashed = false
          } else if (ph < 0.9 + fall) {
            const tf = ph - 0.9
            f.drop.position.y = f.dy0 - 0.5 * 9.8 * tf * tf
            f.drop.scale.set(0.85, 1.5, 0.85)
          } else {
            f.drop.visible = false
            if (!f.splashed) {
              f.splashed = true
              f.crownT = 0
              for (let s = 0; s < 6; s++) {
                const a = (s / 6) * PI * 2 + c.rand()
                kit.spawn(
                  c,
                  'droplet',
                  new V3(f.x0 + Math.cos(a) * 0.02, 0.02, f.z0 + Math.sin(a) * 0.02),
                  new V3(Math.cos(a) * 0.5, 0.9 + c.rand() * 0.4, Math.sin(a) * 0.5),
                  { s: 0.5 + c.rand() * 0.4 },
                )
              }
            }
          }
          if (f.crownT != null) {
            f.crownT += dt
            const ct = f.crownT / 0.3
            if (ct < 1) {
              f.crown.visible = true
              f.crown.scale.set(0.015 + 0.05 * ct, 0.03 * Math.sin(ct * PI), 0.015 + 0.05 * ct)
              f.crown.position.y = 0.015 + f.crown.scale.y / 2
              f.crown.material.opacity = 0.9 * (1 - ct)
            } else {
              f.crown.visible = false
              f.crownT = null
            }
          }
        }
      } else if (f.def && f.def.update) {
        if (f.def.update(c, f, dt, i) === true) {
          c.fluids.splice(i, 1)
        }
      } else if (f.def) {
        const dry = Math.min(1, f.t / f.def.dryTime)
        f.mat.color.copy(f.def.freshC).lerp(f.def.dryC, dry)
        f.mat.roughness = f.def.roughFresh + dry * (f.def.roughDry - f.def.roughFresh)
        f.mat.metalness = f.def.metalFresh + (f.def.metalDry - f.def.metalFresh) * dry
        const L = f.Lmax * (1 - Math.exp(-f.t / 5))
        if (L - f.len > 0.004) buildDrip(f, L)
      }
    }
  }
  kit.updateFluids = updateFluids
  /* The wiper (glass only) and rain clean only fresh stains (less than half dry) of the types with wipeable. */
  kit.wipe = function (c: any, mode: any) {
    let n = 0
    for (let i = c.fluids.length - 1; i >= 0; i--) {
      const f = c.fluids[i]
      if (!f.def || !f.def.wipeable) continue
      if (f.t / f.def.dryTime < 0.5 && (mode === 'rain' || f.onGlass)) {
        if (f.grp.parent) f.grp.parent.remove(f.grp)
        c.fluids.splice(i, 1)
        n++
      }
    }
    return n
  }

  Object.assign(I, { _fr, buildDrip, DOWNHILL, PN, puddleGeometry, rimGeometry, puddle, shapePuddle, updateFluids })
}
