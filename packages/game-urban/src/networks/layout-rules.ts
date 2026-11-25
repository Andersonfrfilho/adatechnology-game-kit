/** Where a lot takes each network when it declares none (a building of `fillBlock`, a lot whose house has no utilities yet), metres. */
export type DefaultConnectionRules = {
  /** The meter post, the water stand and the sewer box stand this far inside the lot's front. */
  readonly frontInset: number
  /** The inspection box stands this far inside the lot's front. */
  readonly sewerInset: number
  /** From the lot's side boundary to the meter post (power and telecom), and to the water stand. */
  readonly meterFromSide: number
  readonly waterFromSide: number
  /** The downspout outlet at the kerb this far from the lot's other side boundary. */
  readonly downspoutFromSide: number
  /** Anchor of the service drop on the meter post over the ground, and of the telecom drop under it. */
  readonly powerHeight: number
  readonly telecomBelowPower: number
  /** On an underground street: the telecom box beside the meter box along the front, metres. */
  readonly telecomBesidePower: number
  /** Invert of the inspection box outlet under the ground; a lot set back from its street gets a shallower one, never under the least. */
  readonly sewerDepth: number
  readonly sewerLeastDepth: number
}

/** How the generator lays the networks out: the numbers of a street, not checked by the validator but by the generator's own tests. */
export type NetworkLayoutRules = {
  /** Width of the sidewalk on each side of a street. */
  readonly sidewalk: number
  /** A run end this close to the map border is where the line leaves the map (a feed, a reservoir). */
  readonly edgeReach: number
  readonly poles: {
    /** Least and longest span between two poles. */
    readonly spacing: readonly [number, number]
    /** The pole's axis from the kerb, on the service strip; the corner pole as far from the cross street's kerb. */
    readonly curbSetback: number
    /** An end-of-line pole this far inside the end of its run. */
    readonly endInset: number
    /** No two poles closer than this (a pole added to reach a lot keeps it). */
    readonly minGap: number
    /** An intermediate pole at least this far from the edge of a cross street's roadway. */
    readonly crossingClearance: number
    /** A pole looks this far either way (in steps) for a lot boundary near its target, and slides as far to clear a gate. */
    readonly snap: number
    readonly slide: number
    readonly slideStep: number
  }
  /** Sag at mid span of each class, metres. */
  readonly sag: { readonly mv: number; readonly lv: number; readonly telecom: number; readonly drop: number; readonly telecomDrop: number }
  readonly telecom: {
    /** A splice box with its reserve coil every this many spans. */
    readonly spliceEvery: number
    /** Gap between two cables of a bundle, from the top of the band down. */
    readonly cableGap: number
    /** Cables of a bundle, least and most, in a clean district and in the periphery. */
    readonly cables: { readonly clean: readonly [number, number]; readonly periphery: readonly [number, number] }
  }
  /** The periphery: district kinds with telecom bundles and a few illegal hookups (a drop with no meter, counted in its transformer's load). */
  readonly periphery: { readonly kinds: readonly string[]; readonly hookupShare: number }
  /** Added to every least slope and least cover the generator lays, so a pipe never sits on the limit. */
  readonly slopeMargin: number
  readonly coverMargin: number
  readonly sewer: {
    readonly mainDiameter: number
    readonly lateralDiameter: number
    /** The lateral drops into the main from a cleanout this far from the street's axis. */
    readonly dropOffset: number
    /** The interceptor runs along the river this far from its bank. */
    readonly interceptorOffset: number
  }
  readonly storm: {
    /** The gallery runs this far from the street's axis, on the side of the poles. */
    readonly galleryOffset: number
    readonly galleryDiameter: number
    readonly lateralDiameter: number
    /** Longest gap between two inlets along a kerb; one at each corner. */
    readonly inletSpacing: number
    /** An inlet's grate this far from the kerb into the road, and the corner inlet this far from the end of its kerb. */
    readonly inletSetback: number
    readonly inletFromCorner: number
    /** Level of the river's water: an outfall's bottom stays above it. */
    readonly riverLevel: number
  }
  readonly water: {
    readonly mainDiameter: number
    readonly serviceDiameter: number
    /** The main runs under the sidewalk opposite the poles, this share of its width out from the kerb. */
    readonly sidewalkShare: number
    /** A hydrant stands this far from the valve of a crossing, toward the kerb. */
    readonly hydrantOffset: number
  }
  readonly connection: DefaultConnectionRules
  /** Underground power: the duct bank under the sidewalk on the water's side, the boxes, the pad-mounted transformers and the light columns across the street. */
  readonly underground: {
    /** The bank's centre this far from the kerb into the sidewalk (between the kerb and the water main), and its width. */
    readonly bankFromKerb: number
    readonly bankWidth: number
    /** Height of each layer of ducts in the bank, low voltage on top, telecom, medium voltage at the bottom, `layerGap` of concrete between. */
    readonly layers: { readonly lv: number; readonly telecom: number; readonly mv: number }
    readonly layerGap: number
    /** Outer diameters of a lot's power lateral, its telecom lateral and a light column's cable. */
    readonly lateralDiameter: number
    readonly telecomLateralDiameter: number
    readonly lightCableDiameter: number
    /** Longest gap between two boxes of the bank. */
    readonly boxSpacing: number
    /** Light columns on the far sidewalk, this far from its kerb, about this far apart. */
    readonly lightFromKerb: number
    readonly lightSpacing: number
    /** A light column or a lateral keeps this far along the street from another pipe that crosses the street. */
    readonly lateralGap: number
    /** The pad-mounted transformer stands on the bank's sidewalk with its centre this far from the kerb. */
    readonly padFromKerb: number
  }
}

/** The defaults of a Brazilian street: 30 to 40 m spans, MV bare on the crossarm, LV multiplexed, sewer to an interceptor along the river. */
export const DEFAULT_NETWORK_LAYOUT: NetworkLayoutRules = {
  sidewalk: 2.5,
  edgeReach: 5,
  poles: { spacing: [30, 40], curbSetback: 0.4, endInset: 1, minGap: 3, crossingClearance: 5, snap: 5, slide: 6, slideStep: 0.25 },
  sag: { mv: 0.5, lv: 0.6, telecom: 0.6, drop: 0.2, telecomDrop: 0.15 },
  telecom: { spliceEvery: 4, cableGap: 0.1, cables: { clean: [1, 2], periphery: [3, 5] } },
  periphery: { kinds: ['residential_popular'], hookupShare: 0.1 },
  slopeMargin: 0.0005,
  coverMargin: 0.05,
  sewer: { mainDiameter: 0.15, lateralDiameter: 0.1, dropOffset: 1, interceptorOffset: 2 },
  storm: { galleryOffset: 2, galleryDiameter: 0.6, lateralDiameter: 0.4, inletSpacing: 60, inletSetback: 0.3, inletFromCorner: 1, riverLevel: -4 },
  water: { mainDiameter: 0.075, serviceDiameter: 0.02, sidewalkShare: 1 / 3, hydrantOffset: 0.6 },
  connection: { frontInset: 0.3, sewerInset: 1, meterFromSide: 1, waterFromSide: 1.6, downspoutFromSide: 1, powerHeight: 5.7, telecomBelowPower: 0.6, telecomBesidePower: 0.3, sewerDepth: 0.6, sewerLeastDepth: 0.3 },
  underground: {
    bankFromKerb: 0.35,
    bankWidth: 0.26,
    layers: { lv: 0.15, telecom: 0.1, mv: 0.15 },
    layerGap: 0.02,
    lateralDiameter: 0.1,
    telecomLateralDiameter: 0.05,
    lightCableDiameter: 0.05,
    boxSpacing: 40,
    lightFromKerb: 0.4,
    lightSpacing: 35,
    lateralGap: 1,
    padFromKerb: 1.85,
  },
}
