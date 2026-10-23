/** Damage scenarios and the scenario registry. */
import type { Kit } from './types'
import { clamp, rng, strHash } from './util'

export function installScenarios(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const I = kit._

  /* ---- ready-made scenarios: registered by the game plugin ----
     kit.scenario({ id, name, init?(X), zone(z, X) }) registers a scenario. In zone(), X.set(z, health) stores the zone health and X.flags receives
     flags (flipped, burnt, abandoned or those of kit.flagEffects). X carries: c, meta, front, rear, length, width, clearance, top, rand (deterministic random),
     center (centre of the current zone), isWindshield (windshield zone), bodyTypes (bodywork types), clamp. Returns { health, flags, scenario }. */
  kit.scenarios = []
  kit.scenario = function (def: any) {
    if (!def || !def.id || typeof def.zone !== 'function') throw new Error('kit.scenario: id and zone(z, X) are required')
    const i = kit.scenarios.findIndex(function (s: any) {
      return s.id === def.id
    })
    if (i >= 0) kit.scenarios[i] = def
    else kit.scenarios.push(def)
    return def
  }
  /* visual effects of scenario flags: kit.flagEffects[name] = { order, settle, apply(c, flags, kit) } */
  kit.flagEffects = {}
  /* generic ageing: faded paint, rust */
  kit.flagEffects.abandoned = { order: 20, settle: true, apply: I.abandonFx }
  /* fire and soot */
  kit.flagEffects.burnt = { order: 40, settle: true, apply: I.burntFx }
  const BODY_TYPES = { panel: 1, door: 1, roof: 1, lid: 1, hood: 1, bumper: 1 }
  kit.zoneScenario = function (c: any, name: any) {
    const Zs = I.zonesOf(c)
    const m = c.meta
    const F = m.front
    const R = m.rear
    const L = m.length || F - R
    const W = m.width || 1.7
    const cl = m.clearance || 0.3
    const top = m.top || 1.5
    const S = kit.scenarios.find(function (s: any) {
      return s.id === name || s.name === name
    })
    const sc = S ? S.id : name
    const health: Record<string, number> = {}
    const flags: any = {}
    const rand = rng(strHash((c.seedKey || c.key || '') + '|' + ((S && S.seedId) || sc)))
    function set(z: any, v: any) {
      health[z.id] = clamp(Math.round(v), 0, 100)
    }
    const X: any = {
      c: c,
      meta: m,
      front: F,
      rear: R,
      length: L,
      width: W,
      clearance: cl,
      top: top,
      rand: rand,
      set: set,
      flags: flags,
      health: health,
      bodyTypes: BODY_TYPES,
      clamp: clamp,
      center: null,
      isWindshield: false,
    }
    if (S) {
      if (S.init) S.init(X)
      Zs.forEach(function (z: any) {
        X.center = I.boxCenter(z.box)
        X.isWindshield = z.tags.indexOf('windshield') >= 0
        S.zone(z, X)
      })
    }
    return { health: health, flags: flags, scenario: sc }
  }
  /* overall health (weighted average) */
  kit.zoneOverall = function (c: any) {
    const Zs = I.zonesOf(c)
    let s = 0
    let w = 0
    Zs.forEach(function (z: any) {
      s += z.health * z.weight
      w += z.weight
    })
    let h = w ? Math.round(s / w) : 100
    /* floor by the worst structural zone: a destroyed or torn-off zone does not leave the vehicle "Intact" on average */
    const st = Zs.filter(function (z: any) {
      return !z.internal && z.type !== 'glass' && z.type !== 'light'
    })
      .map(function (z: any) {
        return z.health
      })
      .sort(function (a: any, b: any) {
        return a - b
      })
    if (st.length) {
      const w3 = st.slice(0, 3)
      const m3 =
        w3.reduce(function (a: any, b: any) {
          return a + b
        }, 0) / w3.length
      h = Math.min(h, Math.round(st[0] + 30), Math.round(m3 + 22))
    }
    const gl = Zs.filter(function (z: any) {
      return z.type === 'glass' || z.type === 'light'
    }).map(function (z: any) {
      return z.health
    })
    if (gl.length) h = Math.min(h, Math.round(Math.min.apply(null, gl) + 55))
    return { health: h, band: I.bandOf(h), name: kit.bands[I.bandOf(h)].name }
  }
  /* zone of point p (c.vehicle coordinates), with the optional mesh that was hit */
  kit.zoneAt = function (c: any, p: any, obj: any) {
    const Zs = I.zonesOf(c)
    const own = obj ? I.ownerOf(c, obj) : null
    if (own) return own
    let best: any = null
    Zs.forEach(function (z: any) {
      if (z.internal) return
      if (I.boxContains(z.box, p.x, p.y, p.z, 0.03) && (!best || I.boxVolume(z.box) < I.boxVolume(best.box))) best = z
    })
    if (best) return best
    let bd = 1e9
    Zs.forEach(function (z: any) {
      if (z.internal) return
      const d = I.boxDistance(z.box, p)
      if (d < bd) {
        bd = d
        best = z
      }
    })
    return best
  }
  /* impact at a point: takes health from the zones near the point, according to the force (0.3..1.4) */
  kit.zoneDamageAt = function (c: any, p: any, dir: any, force: any, obj: any) {
    const Zs = I.zonesOf(c)
    const main = kit.zoneAt(c, p, obj)
    const Rr = 0.35 + 0.35 * force
    const out: any = []
    Zs.forEach(function (z: any) {
      const d = z === main ? 0 : I.boxDistance(z.box, p)
      let dmg = 0
      if (z === main) dmg = force * 36
      else if (z.internal) {
        if (d < Rr * 0.6) dmg = force * 22 * (1 - d / (Rr * 0.6))
      } else if (d < Rr) dmg = force * 26 * Math.pow(1 - d / Rr, 1.3)
      if (dmg >= 1) out.push({ id: z.id, name: z.name, damage: Math.round(dmg) })
    })
    return { main: main ? main.id : null, list: out }
  }
  /* point and direction of the impacts by side (Front, Rear, Left side and Right side buttons) */
  kit.zonePoint = function (c: any, zone: any) {
    const m = c.meta
    const mid = m.clearance + (m.bodyHeight || 0.6) * 0.5
    let p
    let dir
    if (zone === 'front') {
      p = new V3(m.front, mid, m.width * 0.15)
      dir = new V3(-1, 0, 0)
    } else if (zone === 'rear') {
      p = new V3(m.rear, mid, -m.width * 0.15)
      dir = new V3(1, 0, 0)
    } else {
      const sd = zone === 'left' ? -1 : 1
      p = new V3((m.front + m.rear) * 0.5 + m.length * (sd < 0 ? 0.12 : -0.1), mid + 0.1, (sd * m.width) / 2)
      dir = new V3(0, 0, -sd)
      const h = I.probe(c, new V3(p.x, p.y, sd * (m.width / 2 + 3)), dir, 3 + m.width)
      if (h) p = h.p
    }
    return { p: p, dir: dir }
  }

  Object.assign(I, { BODY_TYPES })
}
