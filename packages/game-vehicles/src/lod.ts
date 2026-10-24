/**
 * Light mode ("lite"): the same vehicles with fewer triangles, for a whole street of them. Port of the `[LOD]` hooks of the team's Frota Leve
 * (frota-leve.js lines 21-65, 232-257, 1205-1221, 14155-14170). Every number is a setting; with `on` false nothing changes, so every golden
 * of the full-detail build stays byte for byte the same.
 */
import type { Kit } from './types'

export interface LodSettings {
  /** Light mode is active for the builds that run now. Set by `kit.build(key, state, zones, { lod: true })`. */
  on: boolean
  /** Fraction of the segments three's own generators keep (cylinders, spheres, tori, lathes, tubes, extrusions, circles, rings). */
  segmentFraction: number
  /** Rounding rings of a rounded box (the full build uses 3). */
  roundingRings: number
  /** Multiplier of the maximum edge length when subdividing a mesh (bigger triangles). */
  subdivisionFactor: number
  /** A box with an edge under this, or a rounding radius under 1.2 cm, is drawn as a plain 12-triangle box. */
  flatBoxEdge: number
  /** Fewest segments of a superellipse loft. */
  minLoftSegments: number
  /** Fraction of a loft's segments. */
  loftSegmentFraction: number
  /** Fewest stations of a resampled loft. */
  minStations: number
  /** Fraction of the stations of a resampled loft. */
  stationFraction: number
  /** Multiplier of the grid cell size of grilles and side grilles. */
  gridFactor: number
  /** Materials (by name in `kit.materials`) whose meshes are never seen from outside and are left out in light mode. */
  hiddenMaterials: readonly string[]
}

export const defaultLodSettings: LodSettings = {
  on: false,
  segmentFraction: 0.5,
  roundingRings: 1,
  subdivisionFactor: 2.2,
  flatBoxEdge: 0.22,
  minLoftSegments: 14,
  loftSegmentFraction: 0.45,
  minStations: 20,
  stationFraction: 0.55,
  gridFactor: 2.6,
  hiddenMaterials: ['seat', 'carpet', 'headliner', 'gauge', 'screen', 'bay', 'hoodLiner', 'block', 'cover', 'radiator', 'coolant', 'coolantLiq', 'washer', 'hv', 'hose', 'leather'],
}

/** The settings the kit starts with: the defaults, overridden by the options. */
export function createLod(options?: Partial<LodSettings>): LodSettings {
  return { ...defaultLodSettings, ...(options || {}), on: false }
}

/** Fewer segments of a generator when the light mode is on, never below `min`. */
const fewer = (lod: LodSettings, n: number, min: number): number => Math.max(min, Math.round(n * lod.segmentFraction))

/**
 * A copy of the three.js namespace whose geometry generators take fewer segments while `lod.on` is true (and whose canvas textures come out in
 * sRGB when three has colour management). With `lod.on` false every generator passes its arguments through untouched.
 */
export function wrapThreeForLod(TH: any, lod: LodSettings): any {
  const T: any = Object.assign({}, TH)
  if (TH.SRGBColorSpace) {
    T.CanvasTexture = class extends TH.CanvasTexture {
      constructor(a: any, b: any, c: any, d: any, e: any, f: any, g: any, h: any, i: any) {
        super(a, b, c, d, e, f, g, h, i)
        this.colorSpace = TH.SRGBColorSpace
      }
    }
  }
  T.CylinderGeometry = class extends TH.CylinderGeometry {
    constructor(rt: any, rb: any, h: any, rs: any, hs: any, open: any, ts: any, tl: any) {
      super(rt, rb, h, lod.on && rs != null ? fewer(lod, rs, 6) : rs, lod.on ? 1 : hs, open, ts, tl)
    }
  }
  T.SphereGeometry = class extends TH.SphereGeometry {
    constructor(r: any, ws: any, hs: any, ps: any, pl: any, ts: any, tl: any) {
      super(r, lod.on && ws != null ? fewer(lod, ws, 8) : ws, lod.on && hs != null ? fewer(lod, hs, 5) : hs, ps, pl, ts, tl)
    }
  }
  T.TorusGeometry = class extends TH.TorusGeometry {
    constructor(r: any, tube: any, rs: any, ts: any, arc: any) {
      super(r, tube, lod.on && rs != null ? fewer(lod, rs, 4) : rs, lod.on && ts != null ? fewer(lod, ts, 8) : ts, arc)
    }
  }
  T.LatheGeometry = class extends TH.LatheGeometry {
    constructor(pts: any, seg: any, a: any, b: any) {
      super(pts, lod.on && seg != null ? fewer(lod, seg, 10) : seg, a, b)
    }
  }
  T.TubeGeometry = class extends TH.TubeGeometry {
    constructor(path: any, ts: any, r: any, rs: any, closed: any) {
      if (lod.on) {
        let len = 1
        try {
          len = path.getLength()
        } catch (e) {
          /* a path without a length keeps the default */
        }
        ts = Math.max(6, Math.min(ts == null ? 64 : ts, Math.ceil(len / 0.14)))
        rs = r < 0.025 ? 3 : Math.max(4, fewer(lod, rs == null ? 8 : rs, 4))
      }
      super(path, ts, r, rs, closed)
    }
  }
  T.ExtrudeGeometry = class extends TH.ExtrudeGeometry {
    constructor(shape: any, o: any) {
      if (lod.on && o) {
        o = Object.assign({}, o)
        if (o.curveSegments) o.curveSegments = fewer(lod, o.curveSegments, 5)
        if (o.bevelSegments) o.bevelSegments = Math.max(1, Math.round(o.bevelSegments * 0.5))
      }
      super(shape, o)
    }
  }
  T.CircleGeometry = class extends TH.CircleGeometry {
    constructor(r: any, seg: any, a: any, b: any) {
      super(r, lod.on && seg != null ? fewer(lod, seg, 8) : seg, a, b)
    }
  }
  T.RingGeometry = class extends TH.RingGeometry {
    constructor(a: any, b: any, ts: any, ps: any, c: any, d: any) {
      super(a, b, lod.on && ts != null ? fewer(lod, ts, 8) : ts, ps, c, d)
    }
  }
  return T
}

/** Names of the kit functions that add the inside of a vehicle (seen only through the glass, left out in light mode). */
const INTERIOR_FUNCTIONS = ['interior', 'engineBay', 'seat', 'dashboard', 'steeringWheel', 'yoke', 'busRows'] as const

/**
 * Wraps the interior builders: while the light mode is on, the meshes a call adds get `userData.skipLite`, which the lite builder of
 * `game-vehicles-three` leaves out. Also resolves `lod.hiddenMaterials` into `kit.lodHiddenMaterials`.
 */
export function installLod(kit: Kit): void {
  const lod: LodSettings = kit.lod
  const meshesOf = (c: any): Set<any> => {
    const set = new Set<any>()
    c.vehicle.traverse((o: any) => {
      if (o.isMesh) set.add(o)
    })
    return set
  }
  for (const name of INTERIOR_FUNCTIONS) {
    const original = kit[name]
    if (typeof original !== 'function') continue
    kit[name] = function (this: unknown, ...args: any[]) {
      const c = args[0]
      if (!lod.on || !c || !c.vehicle) return original.apply(this, args)
      const before = meshesOf(c)
      const result = original.apply(this, args)
      c.vehicle.traverse((o: any) => {
        if (o.isMesh && !before.has(o)) o.userData.skipLite = true
      })
      return result
    }
  }
  /** Materials of the parts nobody sees from outside, as a set to test by identity. */
  kit.lodHiddenMaterials = function () {
    const materials = kit.materials
    return new Set(lod.hiddenMaterials.map((name) => materials[name]).filter(Boolean))
  }
}
