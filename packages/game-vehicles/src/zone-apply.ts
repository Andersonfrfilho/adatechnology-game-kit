/** Applies zone health to a built vehicle: bands, decals, owned parts and scenarios. */
import type { Kit } from './types'
import { clamp, rng, strHash } from './util'
import { SEED_SALTS, legacyZoneId } from './legacy-seeds'

export function installZoneApply(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const I = kit._
  const { RUST, crease } = I

  /* ---- applying all zones ---- */
  function fadePaint(c: any) {
    const cache2 = new Map()
    c.vehicle.traverse(function (o: any) {
      if (!o.isMesh || !c.paints || !c.paints.has(o.material)) return
      let nm2 = cache2.get(o.material)
      if (!nm2) {
        nm2 = o.material.clone()
        const hsl: any = {}
        nm2.color.getHSL(hsl)
        nm2.color.setHSL(hsl.h, hsl.s * 0.45, Math.min(0.75, hsl.l * 0.9 + 0.08))
        nm2.color.lerp(RUST, 0.12)
        nm2.roughness = 0.96
        nm2.metalness = 0.05
        cache2.set(o.material, nm2)
      }
      o.material = nm2
    })
  }
  function abandonFx(c: any) {
    fadePaint(c)
    I.hurtEngine(c, 0.45)
    const inv = I.worldInverseOf(c)
    ;(c.zones || []).forEach(function (z: any) {
      if (z.internal || ['panel', 'door', 'roof', 'lid', 'hood', 'bumper'].indexOf(z.type) < 0) return
      c.rand = rng(strHash(c.key + SEED_SALTS.rust + legacyZoneId(z)))
      I.zoneDecals(c, z, { rust: 3 }, I.zoneCands(c, z, inv))
    })
  }
  function burntFx(c: any) {
    I.burnAll(c)
    const m = c.meta
    const ep = I.enginePos(c)
    I.hurtEngine(c, 0)
    kit.addEmitter(c, ep.clone().add(new V3(0, 0.15, 0)), 'fire', { rate: 5, s: 0.6 })
    kit.addEmitter(c, new V3(((m.front || 1) + (m.rear || -1)) / 2, (m.clearance || 0.3) + 0.35, 0), 'fire', { rate: 4, s: 0.55 })
    kit.addEmitter(c, ep.clone().add(new V3(0, 0.9, 0)), 'black', { rate: 3, s: 1.3 })
    c.emitters = c.emitters.filter(function (e: any) {
      return e.kind !== 'exhaust'
    })
    c.burnt = true
  }
  function settleDrops(c: any) {
    const D = c.zoneDrops
    if (!D || !D.length || (['boat', 'plane', 'heli'].indexOf(c.meta.kind) >= 0 && c.meta.kind !== 'plane')) return
    const WH = I.wheelInfo(c)
    if (!WH) return
    const P = function (w: any) {
      return w.userData.gpos || w.position
    } /* a wheel that went inside a pivot (broken gear) keeps its original position */
    const xs = WH.list.map(function (w: any) {
      return P(w).x
    })
    const zs2 = WH.list.map(function (w: any) {
      return P(w).z
    })
    const dAt = function (w: any) {
      const q = D.filter(function (e: any) {
        return Math.abs(e.x - P(w).x) < 0.01 && Math.abs(e.z - P(w).z) < 0.01
      })
      return q.length
        ? Math.max.apply(
            null,
            q.map(function (e: any) {
              return e.d
            }),
          )
        : 0
    }
    const xc =
      xs.reduce(function (s: any, v: any) {
        return s + v
      }, 0) / xs.length
    const zc =
      zs2.reduce(function (s: any, v: any) {
        return s + v
      }, 0) / zs2.length
    let sxx = 0
    let sxz = 0
    let szz = 0
    let sxd = 0
    let szd = 0
    let sd = 0
    WH.list.forEach(function (w: any) {
      const x = P(w).x - xc
      const z2 = P(w).z - zc
      const d = -dAt(w)
      sxx += x * x
      sxz += x * z2
      szz += z2 * z2
      sxd += x * d
      szd += z2 * d
      sd += d
    })
    const det = sxx * szz - sxz * sxz
    let A = 0
    let Bz = 0
    if (Math.abs(det) > 1e-6) {
      A = (sxd * szz - szd * sxz) / det
      Bz = (szd * sxx - sxd * sxz) / det
    } else if (sxx > 1e-6) A = sxd / sxx
    const t = sd / WH.list.length
    /* Δy(x, z) = A·x + Bz·z + (t − A·xc − Bz·zc): rotation.z gives A·x and rotation.x gives −sin(b)·z */
    c.vehicle.rotation.z += Math.atan(A)
    c.vehicle.rotation.x += -Math.asin(clamp(Bz, -0.5, 0.5))
    c.vehicle.position.y += t - A * xc - Bz * zc
  }
  kit.applyZones = function (c: any, zs: any) {
    const Zs = I.zonesOf(c)
    zs = zs || {}
    const H = zs.health || {}
    const FL = zs.flags || {}
    c.zoneState = { health: {}, flags: Object.assign({}, FL) }
    Zs.forEach(function (z: any) {
      z.health = H[z.id] == null ? 100 : clamp(Math.round(H[z.id]), 0, 100)
      z.band = I.bandOf(z.health)
      c.zoneState.health[z.id] = z.health
    })
    const R0 = c.rand
    const dirty = new Set()
    let any = false
    c.zoneDrops = []
    c.zoneErrors = c.zoneErrors || []
    Zs.forEach(function (z: any) {
      if (z.health >= 100) return
      any = true
      c.rand = rng(strHash(c.key + '|' + legacyZoneId(z) + '|' + z.band))
      try {
        const b = z.band
        if (z.type === 'wheel' && z.fxKey === 'landing_gear' && c.meta.kind === 'plane') I.gearBand(c, z, b)
        else if (z.type === 'wheel')
          z.wheels.forEach(function (w: any) {
            I.wheelBand(c, z, w, b)
          })
        else if (z.type === 'glass')
          z.glass.forEach(function (g: any) {
            I.glassBand(c, z, g, b)
          })
        else if (z.type === 'light')
          z.lights.forEach(function (Lt: any) {
            I.lightBand(c, z, Lt, b)
          })
        else if (z.type === 'internal') I.internalBand(c, z, b)
        else if (z.type === 'hood') I.hoodBand(c, z, b, dirty)
        else if (z.type === 'bumper') I.bumperBand(c, z, b, dirty)
        else if (z.type === 'part') I.partBand(c, z, b, dirty)
        else I.panelBand(c, z, b, dirty)
        if (z.type !== 'glass')
          z.glass.forEach(function (g: any) {
            if (b === 1 && g !== z.glass[0]) return
            I.glassBand(c, z, g, b === 4 ? 4 : b)
          })
        if (z.type !== 'light')
          z.lights.forEach(function (Lt: any) {
            I.lightBand(c, z, Lt, b)
          })
        if (z.type !== 'wheel' && !z.track)
          z.wheels.forEach(function (w: any) {
            I.wheelBand(c, z, w, b)
          })
        if (z.sub && z.type !== 'internal' && b >= 2)
          I.internalBand(c, Object.assign({}, z, { pos: z.pos || I.boxCenter(z.box) }), Math.min(b, 3))
        if (typeof z.onBand === 'function') z.onBand(c, b, z, kit)
      } catch (e: any) {
        c.zoneErrors.push(z.id + ': ' + (e && e.message))
      }
    })
    dirty.forEach(function (msh: any) {
      const g = msh.geometry
      if (g.userData.crease || !g.index) crease(g, 42)
      else g.computeVertexNormals()
      g.computeBoundingSphere()
      g.computeBoundingBox()
    })
    try {
      settleDrops(c)
    } catch (e: any) {
      c.zoneErrors.push('settling: ' + e.message)
    }
    c.rand = rng(strHash(c.key + SEED_SALTS.scenario))
    const flagList = Object.keys(FL)
      .filter(function (k) {
        return FL[k] && kit.flagEffects[k]
      })
      .sort(function (x, y) {
        return kit.flagEffects[x].order - kit.flagEffects[y].order
      })
    flagList.forEach(function (k) {
      kit.flagEffects[k].apply(c, FL, kit)
    })
    if (
      any ||
      FL.flipped ||
      flagList.some(function (k) {
        return kit.flagEffects[k].settle
      })
    ) {
      c.rand = rng(strHash(c.key + SEED_SALTS.settle))
      kit.settle(c, 2.5)
    }
    if (FL.flipped && !c.flipped) {
      c.rand = rng(strHash(c.key + SEED_SALTS.rollover))
      if (c.hood) {
        c.hood.target = 0
      }
      if (kit.roll(c, 1)) {
        for (let i = 0; i < 150 && !c.flipped; i++) kit.tick(c, 1 / 30)
        kit.settle(c, 1.5)
      }
    }
    if (any) I.updateFluids(c, 20)
    c.rand = R0
    return c.zoneState
  }

  Object.assign(I, { fadePaint, abandonFx, burntFx, settleDrops })
}
