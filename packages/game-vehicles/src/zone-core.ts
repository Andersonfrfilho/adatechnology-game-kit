/** Zone core: bands, effects text, box helpers and part lookups. */
import type { Kit } from './types'
import { clamp } from './util'

export function installZoneCore(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const I = kit._

  /* ================= damage zones ================= */
  /* Every vehicle has named zones with health from 0 to 100. The core derives the zones from the meta (autoZones) and the builder refines
     them with c.zone(id, label, box, parts, options). The band (intact, scratched, dented, destroyed, torn_off) decides the look,
     which is deterministic: the same zone in the same band always gives the same result. When the band changes, the app rebuilds the
     vehicle (kit.build(key, state, zoneStates)) and applyZones reapplies every zone. Damage stays inside the zone box: the
     dent field is masked by the box and each owned part (wheel, light, glass, hood, mirror) only obeys its own zone. */
  const BAND_DEFINITIONS = [
    { id: 'intact', min: 76, health: 100, color: '#6f8f63' },
    { id: 'scratched', min: 51, health: 63, color: '#d8b440' },
    { id: 'dented', min: 26, health: 38, color: '#e07c2c' },
    { id: 'destroyed', min: 1, health: 13, color: '#c8392e' },
    { id: 'torn_off', min: 0, health: 0, color: '#6e7377' },
  ]
  /** The five damage bands, worst last. `health` is a typical health value inside the band. */
  const BANDS = BAND_DEFINITIONS.map(function (b) {
    return { id: b.id, name: kit.t('bands.' + b.id), min: b.min, health: b.health, color: b.color }
  })
  function bandOf(h: any) {
    h = Math.round(clamp(h == null ? 100 : h, 0, 100))
    for (let i = 0; i < BANDS.length; i++) if (h >= BANDS[i].min) return i
    return 4
  }
  kit.bands = BANDS
  kit.bandOf = bandOf
  const ZONE_WEIGHTS: Record<string, number> = { door: 1, panel: 1, roof: 1.2, lid: 0.8, hood: 1, bumper: 0.6, glass: 0.4, light: 0.3, wheel: 0.8, internal: 1.5, part: 1 }
  /* effect text per key, in the five bands; {who} becomes the occupant of that side. The text comes from the game plugin. */
  const ZONE_EFFECTS: any = {}
  /* key -> 5 texts (one per band); filled by configure({ zoneEffects }) */
  kit.zoneEffects = ZONE_EFFECTS
  function zoneFx(z: any, b: any) {
    const t = (z.fx || ZONE_EFFECTS[z.fxKey] || ZONE_EFFECTS[z.type] || ZONE_EFFECTS.panel || [])[b] || kit.config.texts.noEffect || ''
    return t.replace(/\{who\}/g, z.who || kit.config.texts.who)
  }
  kit.zoneEffect = function (z: any, h: any) {
    return zoneFx(z, bandOf(h == null ? z.health : h))
  }
  /* box: [x0, x1, y0, y1, z0, z1], { x0, x1, y0, y1, z0, z1 } or THREE.Box3 (c.vehicle coordinates) */
  function normalizeBox(b: any) {
    if (!b) return null
    if (Array.isArray(b))
      return {
        x0: Math.min(b[0], b[1]),
        x1: Math.max(b[0], b[1]),
        y0: Math.min(b[2], b[3]),
        y1: Math.max(b[2], b[3]),
        z0: Math.min(b[4], b[5]),
        z1: Math.max(b[4], b[5]),
      }
    if (b.isBox3) return { x0: b.min.x, x1: b.max.x, y0: b.min.y, y1: b.max.y, z0: b.min.z, z1: b.max.z }
    return { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, z0: b.z0, z1: b.z1 }
  }
  kit.normalizeBox = normalizeBox
  function boxLo(B: any, a: any) {
    return a === 0 ? B.x0 : a === 1 ? B.y0 : B.z0
  }
  function boxHi(B: any, a: any) {
    return a === 0 ? B.x1 : a === 1 ? B.y1 : B.z1
  }
  function boxContains(B: any, x: any, y: any, z: any, e: any) {
    e = e || 0
    return x >= B.x0 - e && x <= B.x1 + e && y >= B.y0 - e && y <= B.y1 + e && z >= B.z0 - e && z <= B.z1 + e
  }
  function boxCenter(B: any) {
    return new V3((B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2, (B.z0 + B.z1) / 2)
  }
  function boxVolume(B: any) {
    return Math.max(1e-4, B.x1 - B.x0) * Math.max(1e-4, B.y1 - B.y0) * Math.max(1e-4, B.z1 - B.z0)
  }
  function boxDistance(B: any, p: any) {
    const dx = Math.max(B.x0 - p.x, 0, p.x - B.x1)
    const dy = Math.max(B.y0 - p.y, 0, p.y - B.y1)
    const dz = Math.max(B.z0 - p.z, 0, p.z - B.z1)
    return Math.hypot(dx, dy, dz)
  }
  function boxIntersects(B: any, b3: any) {
    return b3.max.x >= B.x0 && b3.min.x <= B.x1 && b3.max.y >= B.y0 && b3.min.y <= B.y1 && b3.max.z >= B.z0 && b3.min.z <= B.z1
  }
  function worldInverseOf(c: any) {
    c.root.updateMatrixWorld(true)
    return new THREE.Matrix4().copy(c.vehicle.matrixWorld).invert()
  }
  /* box of an object in c.vehicle coordinates */
  function localBox(c: any, o: any, inv: any) {
    inv = inv || worldInverseOf(c)
    const bb = new THREE.Box3()
    const tmp = new THREE.Box3()
    const M = new THREE.Matrix4()
    o.traverse(function (x: any) {
      if (!x.isMesh || !x.geometry || !x.geometry.attributes.position || x.userData.decal) return
      if (!x.geometry.boundingBox) x.geometry.computeBoundingBox()
      tmp.copy(x.geometry.boundingBox).applyMatrix4(M.multiplyMatrices(inv, x.matrixWorld))
      bb.union(tmp)
    })
    return bb
  }
  kit.localBox = localBox
  function slug(s: any) {
    return String(s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
  }
  function wheelInfo(c: any) {
    const ws = c.wheels.filter(function (w: any) {
      return w.parent
    })
    if (!ws.length) return null
    let xf = -1e9
    let xr = 1e9
    let rf = 0.3
    let rr = 0.3
    ws.forEach(function (w: any) {
      const r = w.userData.r || 0.3
      if (w.position.x > xf) {
        xf = w.position.x
        rf = r
      }
      if (w.position.x < xr) {
        xr = w.position.x
        rr = r
      }
    })
    return { list: ws, xf: xf, xr: xr, rf: rf, rr: rr }
  }
  function partsOf(c: any, kind: any) {
    return c.parts.filter(function (p: any) {
      return p.kind === kind
    })
  }
  function lightCenter(c: any, L: any, inv: any) {
    if (L.group) return localBox(c, L.group, inv).getCenter(new V3())
    const bb = new THREE.Box3()
    L.lens.concat(L.inner).forEach(function (m: any) {
      bb.union(localBox(c, m, inv))
    })
    return bb.isEmpty() ? new V3() : bb.getCenter(new V3())
  }
  function lightBoxOf(c: any, L: any, inv: any) {
    if (L.group) return localBox(c, L.group, inv)
    const bb = new THREE.Box3()
    L.lens.concat(L.inner).forEach(function (m: any) {
      bb.union(localBox(c, m, inv))
    })
    return bb
  }
  function hideObj(c: any, o: any) {
    if (!o) return
    o.visible = false
    c.parts.forEach(function (p: any) {
      if (p.obj === o) p.done = true
    })
  }
  function shown(c: any, o: any) {
    for (let q = o; q && q !== c.vehicle; q = q.parent) if (q.visible === false) return false
    return !!o
  }

  Object.assign(I, {
    BANDS,
    bandOf,
    ZONE_WEIGHTS,
    ZONE_EFFECTS,
    zoneFx,
    normalizeBox,
    boxLo,
    boxHi,
    boxContains,
    boxCenter,
    boxVolume,
    boxDistance,
    boxIntersects,
    worldInverseOf,
    localBox,
    slug,
    wheelInfo,
    partsOf,
    lightCenter,
    lightBoxOf,
    hideObj,
    shown,
  })
}
