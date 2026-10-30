/**
 * Public types of @adatechnology/game-destruction.
 *
 * The model is renderer-free. An object is an assembly of parts (simple shapes with a material) held together by joints. Materials decide what a
 * hit does: ductile parts dent and get holes, brittle parts crack and shatter, wood splinters, masonry crumbles, flammable parts ignite, char and
 * turn to ash, fusible parts melt and drip. Joints break under impulse or when their parts are destroyed (the object breaks apart), or are undone
 * with the right tool (the object is taken apart). The world reports everything as events that a renderer draws.
 *
 * Units: metres, kilograms, seconds, joules, degrees Celsius. Every random choice comes from the world seed, so the same inputs give the same
 * events on every machine (a LAN host can run the world and send only the inputs, or the events).
 */

import type {
  BallisticExtras,
  BlastOptions,
  DamageType,
  DebrisKind,
  DestructibleImpl,
  DestructibleSpec,
  DestructionEvent,
  DestructionEventType,
  FractureStyle,
  IgnitionRules,
  JointState,
  MaterialId,
  ObjectState,
  PartState,
  Quat,
  RayHit,
  HitResult,
  Hit,
  SoilProfile,
  StructureRole,
  ToolKind,
  Vec3,
  WindExposure,
} from '@adatechnology/game-contracts'

// The contract types live in @adatechnology/game-contracts; they are re-exported so that no import from this package breaks.
export type {
  BallisticExtras,
  HitIgnition,
  ChainDelay,
  Crack,
  DamageStage,
  DamageType,
  DebrisKind,
  Dent,
  DestructibleImpl,
  DestructibleSpec,
  DestructionEvent,
  DestructionEventType,
  BlastOptions,
  BlastReport,
  ConfinementOptions,
  ExplosionChain,
  FragmentHitOptions,
  ShelterOptions,
  FluidKind,
  Fragment,
  FragmentMark,
  FractureStyle,
  Hit,
  HitResult,
  Hole,
  ImpactContract,
  JointKind,
  JointSpec,
  JointState,
  MaterialId,
  ObjectState,
  PartBreach,
  PartShape,
  PartSpec,
  PartState,
  PartStatus,
  PartUnits,
  Quat,
  RayHit,
  Reinforcement,
  TensionRebar,
  PileSpec,
  SoilLayer,
  SoilProfile,
  SoilState,
  StructureRole,
  SurfaceLayer,
  ToolKind,
  TunedMassDamper,
  Vec3,
  WindExposure,
  WindState,
} from '@adatechnology/game-contracts'

export interface MaterialThermal {
  /** Temperature at which the part catches fire. Omit for non-flammable. */
  ignitionC?: number
  /** Flame temperature while burning (default 800). */
  flameC?: number
  /** Fraction of the part's mass that can burn, 0..1 (wood 0.9, fabric 1, plastic 0.8). */
  fuelFraction?: number
  /** Burn speed in kg per second per square metre of surface (wood ~0.012, fabric ~0.05, foliage ~0.08). */
  burnRate?: number
  /** Temperature at which the part starts to melt. Omit for materials that do not melt in game (wood, fabric). */
  meltC?: number
  /** Melt speed: fraction of the part per second per 100 °C above `meltC` (default 0.05). */
  meltRate?: number
  /** Heat transfer to touching parts, 0..1 (copper 1, steel 0.5, wood 0.05). */
  conductivity: number
  /** Temperature change per second per unit of heat input; lower means it heats and cools faster (default 1). */
  heatCapacity?: number
  /** Brittle parts crack when their temperature changes faster than this many °C per second (glass ~150). */
  thermalShockC?: number
  /** Smoke the material gives while burning (`black` for plastic and rubber). */
  smoke?: 'white' | 'grey' | 'black'
}

export interface MaterialDef {
  id: MaterialId
  /** Density in kg/m³ (used when a part has no `mass`). */
  density: number
  /** Structural hit points per kilogram. */
  hpPerKg: number
  /**
   * Energy in joules a projectile needs to go through 1 mm of this material. A projectile that carries more than `penetration * thicknessMm` goes
   * through and keeps the rest; one that carries less stops (dent, crack or lodge).
   */
  penetration: number
  /**
   * Which entry of `Hit.penetration` this material is measured by (`steel`, `concrete`, `brick`, `wood`; default its own id). A structural steel beam is
   * `steel`, an aluminium sheet is `steel` too, softwood is `wood`.
   */
  penetrationClass?: string
  /**
   * Millimetres of this material a round goes through for every millimetre of its `penetrationClass` reference in the table (default 1). Structural
   * steel (S235) is softer than the RHA the tables use, so 1.3; softwood against hardwood 1.5; aluminium against steel 3.
   */
  penetrationScale?: number
  /** 0 = brittle (glass), 1 = very ductile (soft steel). Ductile parts dent and bend before they break; brittle parts crack and shatter. */
  ductility: number
  /** How the part fails when its hp reaches 0. */
  fracture: FractureStyle
  /** Fragment size range in metres (default `[0.04, 0.2]`). */
  fragmentSize?: [number, number]
  /**
   * Thickness of one sheet, in metres, for a material that comes in sheets (paper). A `tear` part much thicker than a sheet is a stack of them (a book,
   * a ream, a magazine) and comes apart as thin loose scraps (`Fragment.inner` for the pages) instead of slabs as thick as the part.
   */
  sheet?: number
  /** Damage multipliers per damage type (default 1); `shelter` multiplies the resistance the material adds between a blast and a target (`blast.shelter`). */
  damageScale?: Partial<Record<DamageType | 'shelter', number>>
  /** Debris emitted on a hit that does not break the part. */
  hitDebris: DebrisKind
  /** Debris emitted when the part fractures. */
  breakDebris: DebrisKind
  /** A ballistic hit at a grazing angle (below this many degrees from the surface) ricochets; 0 = never (default 0). */
  ricochetDeg?: number
  thermal: MaterialThermal
  /** Hints for the renderer. Colours are `0xRRGGBB`. */
  visual?: {
    /** Colour a fully charred surface turns to (default 0x1a1410). */
    charColor?: number
    /** The material glows red to white when hot (metals, glass). */
    glows?: boolean
    /** Transparent (glass): cracks are drawn as a star on the surface. */
    transparent?: boolean
    /** Colour of the inside, for the inner fragments and the hit debris (the pages of a book under its cover); default the colour of the part. */
    innerColor?: number
  }
  /** Free tags, e.g. `metal`, `organic`, `conductive`. */
  tags?: string[]
  /**
   * Load a structural part of this material carries per square metre of cross-section, in kg (game-tuned: concrete 444 000, brick 40 000,
   * softwood 100 000, steel 2 000 000). Default 20 000. See `PartSpec.structure`.
   */
  compressive?: number
  /**
   * Engineering strengths of the material, in real units. When present they replace the game-tuned `compressive` for the capacity of the part and
   * turn on the bending model of beams and slabs (`tensileMPa`). See `MaterialStrength`.
   */
  strength?: MaterialStrength
}

/**
 * Real strengths of a structural material (characteristic values). Concrete C25 (NBR 6118 / Eurocode 2): compressive 25, tensile 0.3 * fck^(2/3) = 2.56,
 * elastic 5600 * sqrt(fck) = 28 GPa. Clay brick masonry (Eurocode 6, fk = 0.55 * fb^0.7 * fm^0.3 with fb 4 MPa, mortar M5): compressive 2.35.
 */
export interface MaterialStrength {
  /** Characteristic compressive strength in MPa (fck of concrete, fk of a masonry wall). */
  compressiveMPa: number
  /** Mean axial tensile strength in MPa (fctm of concrete). Without it the material does not take part in the bending model. */
  tensileMPa?: number
  /** Modulus of elasticity in GPa (tangent at the origin, Eci, for the dynamic stiffness). */
  elasticGPa?: number
  /**
   * Masonry and plain concrete walls and pillars lose capacity with their slenderness and the unavoidable eccentricity of the load (`structure.masonry`).
   * Default true for materials tagged `masonry` that are not reinforced.
   */
  slender?: boolean
}

/** Bending of beams, slabs, roofs and stairs (`DestructionOptions.structure.flexure`). Every number is configurable; the defaults are real values. */
export interface FlexureOptions {
  /** Off: beams and slabs are checked in compression only, as before (default true). */
  enabled?: boolean
  /** Roles the bending model applies to (default beam, slab, roof, stair). Only parts whose material has `strength.tensileMPa`. */
  roles?: readonly StructureRole[]
  /**
   * Which beams and slabs the bending model takes. `rebar` (default): those that declare their tension steel in `structure.rebar` (a ratio of 0 is
   * plain concrete). `reinforced`: also those with only a `reinforcement` cage, their steel taken from the cage. `all`: every one, and those with no
   * steel at all are plain concrete. The default leaves structures made before this model as they were.
   */
  scope?: 'rebar' | 'reinforced' | 'all'
  /** Factor alpha on the tensile strength for the cracking moment of a rectangular section, `Mr = alpha * fct * b * h^2 / 6` (NBR 6118 17.3.1: 1.5). */
  crackFactor?: number
  /** Yield strength of the tension steel in MPa when the part does not say it (500: CA-50, NBR 7480). */
  rebarYieldMPa?: number
  /** Cover from the tension face to the bar in metres when the part does not say it (0.03: NBR 6118 table 7.2, class II, beams). */
  cover?: number
  /**
   * Largest neutral axis depth over d of a ductile section (0.45: NBR 6118 14.6.4.3). Steel beyond it is taken as double reinforcement (it adds its
   * pull times `d - d'`).
   */
  neutralAxisLimit?: number
  /** Support rotation in degrees at which a reinforced member fails under a blast (10: PDC-TR 06-08, hazardous damage of RC beams and slabs). */
  failRotationDeg?: number
  /** Load factor of the equivalent one-degree-of-freedom system (0.64: Biggs 1964, simply supported, uniform load, elastic). */
  loadFactor?: number
  /** Mass factor of the equivalent system (0.50: Biggs 1964, same case). */
  massFactor?: number
  /** Joules per kilogram of TNT to turn a blast energy into a charge mass (4.184e6, the definition of the TNT equivalent). */
  tntJoules?: number
  /** Incident impulse coefficient in Pa s m / kg^(2/3): `i = impulse * W^(2/3) / R` (200: Sadovsky). */
  impulse?: number
  /** Reflected over incident impulse far from the charge (2: normal reflection of a weak shock). */
  reflection?: number
  /** Rise of the reflection near the charge, in m/kg^(1/3): the factor is `reflection + reflectionNear / Z` (4: about 4 at Z = 2, 6 at Z = 1). */
  reflectionNear?: number
  /** Smallest scaled distance in m/kg^(1/3) the impulse formula is used at; nearer, the breach model of the hit points takes over (0.5). */
  nearScaled?: number
}

/** Crushing of bearing walls and pillars of masonry or plain concrete (`DestructionOptions.structure.masonry`). */
export interface MasonryOptions {
  /** Unavoidable eccentricity of the load over the thickness (0.05: NBR 16868-1 and Eurocode 6 6.1.2.2): the capacity is times `1 - 2 * e`. */
  minEccentricity?: number
  /** Slenderness `h / t` at which the capacity reaches zero in `1 - (lambda / limit)^3` (40: NBR 16868-1 reduction factor R). */
  slendernessLimit?: number
  /** Share of the cross-section of concrete counted in the axial capacity of a reinforced pillar, `0.85 * fck` (0.85: NBR 6118 17.2.2). */
  concreteFactor?: number
}

/** What a soil is made of: decides the pile factors (Décourt-Quaresma) and the modulus correlation. */
export type SoilKind = 'clay' | 'silt' | 'sand' | 'gravel' | 'rock'

/** A soil class of the registry (`SOILS`, `soils.json`): real allowable pressures and stiffness. Add or override them with `soil.soils`. */
export interface SoilDef {
  id: string
  kind: SoilKind
  /** Allowable pressure of a shallow footing in kPa (NBR 6122 basic pressures); the soil gives way at `allowableKPa * soil.safety`. */
  allowableKPa: number
  /** SPT blow count N (NBR 6484), used for the pile resistance (Décourt-Quaresma). */
  spt: number
  /** Young's modulus in MPa (Teixeira & Godoy: `alpha * K * N`). */
  elasticMPa: number
  /** Poisson's ratio. */
  poisson: number
  /** Ultimate pile resistances in kPa when they do not come from `spt` (rock): end bearing at the tip and skin friction on the shaft. */
  pile?: { tipKPa?: number; skinKPa?: number }
}

/** The soil model. Every number has a real default; see `SOIL_DEFAULTS`. */
export interface SoilOptions {
  /** Extra or overriding soil classes (merged over `SOILS` by id). */
  soils?: SoilDef[]
  /** Profile for objects with foundations whose spec has no `soil` (default none: only objects with `soil` bear on the ground). */
  site?: string | SoilProfile
  /** Global safety factor of a shallow footing: the soil gives way at this times the allowable pressure (3: NBR 6122). */
  safety?: number
  /** Global safety factor of a pile (2: NBR 6122); `pileLength` sizes with it. */
  pileSafety?: number
  /** Influence factor of a rigid footing in the elastic settlement `q B (1 - nu^2) Iw / E` (0.82: rigid square, Bowles). */
  rigidity?: number
  /** Depth under a footing, in footing widths, whose soil it bears on (2: the stress bulb of a square footing). */
  influence?: number
  /** Out-of-plumb of a building, radians (1/200: Eurocode 2 5.2 basic imperfection); it leans this way before any load. */
  imperfection?: number
  /** Footing cells per side for the contact pressure (default 4). */
  cells?: number
  /** Speed at which a yielding foundation sinks, in m/s of game time (0.05; the real thing takes hours to days). */
  sinkRate?: number
  /** Speed at which a yielding object leans further, in degrees per second of game time (1.5). */
  tiltRate?: number
  /** Width a footing has at least under a part that rests on a `terrain` foundation, metres (0.6: NBR 6122 minimum), unless the profile says. */
  footingWidth?: number
  /** Young's modulus of the piles in GPa when the material has no `strength.elasticGPa` (25). */
  pileElasticGPa?: number
}

/** A terrain roughness category of the wind profile (`wind.terrains`, `WIND_TERRAIN`): NBR 6123 table 1 and the roughness length. */
export interface WindTerrainDef {
  id: string
  /** Gradient height in metres: the profile stops growing above it. */
  zg: number
  /** Parameter `b` of the profile `S2 = b * Fr * (z / 10)^p`, by class of the building. */
  b: { A: number; B: number; C: number }
  /** Exponent `p` of the profile, by class. */
  p: { A: number; B: number; C: number }
  /** Roughness length in metres, for the turbulence intensity `1 / ln(z / z0)` (EN 1991-1-4 4.4). */
  z0: number
}

/**
 * The wind. Every number has a real default; see `WIND_DEFAULTS`. The fields of `WindExposure` are the defaults for every object; an object's
 * `DestructibleSpec.wind` replaces them for itself.
 */
export interface WindOptions extends WindExposure {
  /** Basic wind speed V0 in m/s: the 3 s gust at 10 m over flat open ground, 50-year return (NBR 6123 isopleths; 40). */
  speed?: number
  /** Direction the wind blows towards, in world space (the horizontal part is used; default `[1, 0, 0]`). */
  direction?: Vec3
  /** Air density in kg/m³ (1.226: `q = 0.613 V^2`). */
  airDensity?: number
  /** Lowest height the profile is evaluated at, metres (5: NBR 6123). */
  minHeight?: number
  /** Height of one slice of the building, metres (3). */
  bandHeight?: number
  /** Share of the gross stiffness the cracked structure keeps (0.8: NBR 6118 15.7.3). */
  stiffnessFactor?: number
  /** Share of the gross stiffness the cracked beams keep (0.4: NBR 6118 15.7.3); they set how much the columns of a frame resist. */
  beamFactor?: number
  /** Share of the span each side of the web that the slab adds to a beam as a flange (0.1: NBR 6118 14.6.2.2); 0 leaves the slab out of the frame. */
  flange?: number
  /** Drift limit, top deflection over height (1/500). */
  driftLimit?: number
  /** Factor on the wind in the strength checks of the parts and the overturning (1.4: NBR 8681 variable action). */
  loadFactor?: number
  /** Count the axial stiffness of the columns in the bending of the whole building (false: a frame of shallow beams does not act as a tube). */
  chord?: boolean
  /** Fraction of the design gust the 10-minute mean wind is (0.69: NBR 6123 chapter 9). */
  meanRatio?: number
  /** Gust factor Fr of each class (NBR 6123 table 1: 1, 0.98, 0.95). */
  gustFactor?: { A: number; B: number; C: number }
  /** Extra or overriding terrain categories (merged over `WIND_TERRAIN` by id). */
  terrains?: WindTerrainDef[]
  /** The gust in time: sines drawn from the Davenport spectrum (`components` of them up to `maxHz`, `scale` metres in `x = scale f / V10`, `seed` for the phases). */
  gust?: { components?: number; maxHz?: number; scale?: number; seed?: number }
  /** Seconds in which the recorded peak of the sway decays by a factor e (60). */
  peakDecay?: number
  /** Tuning of a tuned mass damper that gives no frequency: `den-hartog` (harmonic force) or `warburton` (random force). */
  tuning?: 'den-hartog' | 'warburton'
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------------------------------------------------------------------------

export interface DestructionOptions {
  /** Extra or overriding materials (merged over `MATERIALS` by id). */
  materials?: MaterialDef[]
  /** Seed for every random choice (default 1). */
  seed?: number
  /** Ambient temperature (default 20). */
  ambientC?: number
  /** Called for every event, in order. */
  onEvent?: (event: DestructionEvent) => void
  /** Maximum fragments in one `fracture` event (default 24). The renderer can draw fewer. */
  maxFragments?: number
  /** Maximum dents kept per part; older nearby dents merge (default 24). */
  maxDents?: number
  /** Maximum holes kept per part (default 32). */
  maxHoles?: number
  /** Distance at which a burning part heats parts of other objects, in metres (default 0.6). */
  fireSpread?: number
  /**
   * The structure solver. A slab or beam is held by the sum of the capacities of what it rests on: its load is shared among the supports that are
   * left, so losing columns moves the load to the rest and the structure falls when the capacity left (the sum) is less than the load.
   * The capacity of each part is `structure.capacity`, else the material's `compressive` (kg/m², in `MaterialDef`) times its section.
   */
  structure?: {
    /**
     * Multiplies every load before it is compared with the capacities: stress = `load * safetyFactor / capacity` (default 1). Above 1 the whole
     * structure is loaded harder than its capacities were sized for (a worn building, a weaker material); below 1 it has extra margin. It does not
     * change the capacities; to size them use `sizeStructure({ safety })`.
     */
    safetyFactor?: number
    /** Bending of beams and slabs: the tension face cracks, the steel carries the pull, a member without steel snaps. See `FlexureOptions`. */
    flexure?: FlexureOptions
    /** Crushing of bearing walls and pillars with slenderness. See `MasonryOptions`. */
    masonry?: MasonryOptions
  }
  /** The ground under objects that have `DestructibleSpec.soil` (or `soil.site`): settlement, tilt, bearing failure and piles. See `SoilOptions`. */
  soil?: SoilOptions
  /**
   * The wind of the world on every structure (default none: no wind). A lateral load that grows with height, the core and the frame that resist it, the
   * sway of the top and tuned mass dampers. See `WindOptions`.
   */
  wind?: WindOptions
  /**
   * What lights the flammable fluid that leaks from a container (a fuel tank, a jerrycan, a gas bottle). A round that goes through only makes a
   * leak; it lights it only when `Hit.ignition` (a spark on metal), `Hit.incendiary` or `Hit.tracer` say so, by the chance of the round weighed by
   * how full the container is; a burning part within `fireNear.radius` or a blast also lights it. See `IgnitionRules` of the contracts for every
   * number and its default.
   */
  ignition?: Partial<IgnitionRules>
  /** Breach of staged parts (see `PartSpec.breach`). */
  breach?: {
    /** Metres around a hit within which through damage adds up (default 0.55). */
    radius?: number
    /** Multiplier of the breach area a blast makes over a blow of the same damage: a blast loads the whole crater (default 6). */
    blastFactor?: number
  }
  /**
   * Speed of the blast front in m/s. A glass part at distance `d` from an explosion breaks `d / blastFrontSpeed` seconds later, in `update`
   * (the speed of sound is 340). Default off: every part takes the blast at once.
   */
  blastFrontSpeed?: number
  /**
   * Defaults of every blast (`explode`, an explosive `hit`, a part that explodes); each call can override them. All off by default, and a world
   * with all of them off gives the results it always gave. See `ShelterOptions`, `FragmentHitOptions` and `ConfinementOptions`.
   */
  blast?: BlastOptions
}

export interface SizeStructureOptions {
  /** Stress every structural part has at rest after sizing (`load / capacity`), 0..1 (default 0.65). */
  safety?: number
  /** Stress at rest per structural role, over `safety` (a house: beams, slabs, roofs and stairs at 0.45 so they outlast a lost column). */
  safetyByRole?: Partial<Record<StructureRole, number>>
  /** Roles whose parts are removed one at a time by the redundancy check (default `['column']`; a house adds `'wall'`). */
  redundancyRoles?: readonly StructureRole[]
  /**
   * Redundancy target: when set, the capacity of a part is raised (never lowered) until losing any single part of `redundancyRoles` leaves every other
   * structural part at this stress or below, e.g. 0.97 (an N-1 design: the building stands with one column gone). Omit to skip the check.
   * Should be above `safety` and, to let the structure fall when a second column goes, below 1.
   */
  redundancy?: number
  /** Extra or overriding materials, the same list given to `createDestruction`. */
  materials?: MaterialDef[]
  /**
   * Bending options of the world the spec will go into (`DestructionOptions.structure.flexure`). Reinforced beams and slabs (a `reinforcement` cage
   * or `structure.rebar`) get the tension steel ratio they need: at rest at `safety` (per role) of their moment, and, with `redundancy`, after the loss
   * of any part of `redundancyRoles`. Steel is only added, never removed, and plain concrete stays plain.
   */
  flexure?: FlexureOptions
  /**
   * The wind the structure is designed for (the same `WindOptions` the world will have): each wall and column gets the capacity for its dead load
   * plus the factored axial force the wind adds to it, at `safety`, and a reinforced one that the wind pulls past its dead load gets bars thick enough
   * (to 40 mm) to hold the pull at `safety`. Beams and slabs do not change (the wind moment in the frame is not modelled).
   */
  wind?: WindOptions
}

/*
 * Notes on behaviour that the types cannot express:
 * - `leak` events carry the hole's world point, the outward normal as `direction`, and `rate` in litres per second; `PartState.liters` drops
 *   in `update` while the part has through holes.
 * - `state()` and `part()` return live views owned by the world. Do not mutate them; copy them if you need a snapshot.
 * - A part with `explodes` can be destroyed even if its material never fractures (`fracture: 'none'`); it then fractures as `snap`.
 */

export interface AddOptions {
  /** Object id (default a generated `obj_1`, `obj_2`...). */
  id?: string
  position?: Vec3
  rotation?: Quat
}

export interface DestructionWorld {
  readonly materials: ReadonlyMap<MaterialId, MaterialDef>
  /** Add an object and return its id. */
  add(spec: DestructibleSpec, options?: AddOptions): string
  /**
   * Host an object whose behaviour a game module owns (see `DestructibleImpl`) next to the world's own objects. Returns its id (`options.id`, else
   * `impl.id`). Raycast, shoot, explode, hit, disassemble, extinguish, update, state, reset, remove and `on` route to it; its events go through the
   * same listeners in order. `splitGroup` on it throws.
   */
  register(impl: DestructibleImpl, options?: AddOptions): string
  remove(id: string): void
  has(id: string): boolean
  ids(): string[]
  /** Move an object (the renderer or physics owns transforms; keep the world in sync so world-space hits land). */
  setTransform(id: string, position: Vec3, rotation: Quat): void
  /**
   * Move a part's collision shape (raycast, hits, blast and joint distance) to an object-local pose; the part's spec is unchanged. Animations are
   * visual, so a host that plays a clip calls this every frame with `rest + clip offset`. `rotation` is Euler XYZ (radians), default none. For a
   * registered impl it forwards to the optional `DestructibleImpl.setPartPose` and otherwise only moves the world's raycast shape. Dents and holes
   * stay in object space.
   */
  setPartPose(objectId: string, partId: string, position: Vec3, rotation?: Vec3): void
  /**
   * Split a loose group into its own object (after a `detach`, when the renderer makes the piece a separate body). The parts move with their
   * state; the new object starts at the old object's transform. Returns the new id.
   */
  splitGroup(id: string, group: number, newId?: string): string
  /** Apply a hit to one object (to the part it lands on, or for `explosive`/`fire`/`heat`, to every part in `radius`). */
  hit(objectId: string, hit: Hit): HitResult
  /** Apply a hit to a known part (e.g. after the host's own raycast). */
  hitPart(objectId: string, partId: string, hit: Hit): HitResult
  /**
   * A blast in world space against every object in range. With `options` (else `DestructionOptions.blast`) the blast can be sheltered by what
   * stands in the way, throw the fragments of what it breaks and gain pressure in an enclosed volume; each `HitResult.blast` says what it did to
   * that target, and a `blast` event sums it up.
   */
  explode(point: Vec3, energy: number, radius: number, source?: string, options?: BlastOptions): HitResult[]
  /** Raycast against every part shape (world space). */
  raycast(origin: Vec3, direction: Vec3, maxDistance?: number): RayHit | null
  /** Ballistic shot: raycast, hit, and continue through with the exit energy (up to 4 objects/parts). */
  shoot(origin: Vec3, direction: Vec3, energy: number, caliber: number, source?: string, round?: number | BallisticExtras): HitResult[]
  /**
   * Work on a joint with a tool for `dt` seconds (call every frame while the player holds the button). Returns the progress 0..1, or -1 when the
   * tool cannot undo this joint. At 1 the joint opens (`detach` with `by: 'tool'`).
   */
  disassemble(objectId: string, jointId: string, tool: ToolKind, dt: number): number
  /** Joints of an object that `tool` can undo now (open joints excluded). */
  workableJoints(objectId: string, tool: ToolKind): JointState[]
  /**
   * Joint nearest to a world point (for "aim at the screw"). With `tool`, the nearest open-able joint that tool can undo within `maxDistance`
   * wins; only when none qualifies does it fall back to the nearest joint of any kind.
   */
  nearestJoint(objectId: string, point: Vec3, maxDistance?: number, tool?: ToolKind): JointState | null
  /** Put out fire on a part or the whole object, and cool it by `coolC` (default 200). */
  extinguish(objectId: string, partId?: string, coolC?: number): void
  /** Advance fire, heat transfer, cooling, melting, leaks and delayed explosions. */
  update(dt: number): DestructionEvent[]
  /**
   * The object's LIVE state: the same object the world mutates every update (parts, joints, groups). Treat it as read-only and change the world only
   * through the API (`hit`, `disassemble`, `setLiters`...). Do not keep it across frames to compare "before" and "after": use `snapshot`.
   */
  state(id: string): ObjectState | null
  /** The part's LIVE state (see `state`): read-only, mutated by the world. */
  part(id: string, partId: string): PartState | null
  /** A deep copy of the object's state at this moment: safe to keep, compare and mutate. Null for an unknown id. */
  snapshot(id: string): ObjectState | null
  /** Repair an object to its spec (test benches use it for "reset"). */
  reset(id: string): void
  on(type: DestructionEventType | '*', fn: (event: DestructionEvent) => void): () => void
  /** Plain JSON of every object (spec + state + transform) and the rng state. */
  serialize(): DestructionSnapshot
  load(snapshot: DestructionSnapshot): void
  /**
   * Fill or empty a container part (`PartSpec.contains`); `liters` is clamped to `[0, contains.liters]` of its spec. Used by fluid simulations
   * that drain or refill the part. Does nothing when the part has no `contains`.
   */
  setLiters(objectId: string, partId: string, liters: number): void
  /**
   * Opens a through opening of `diameter` metres (default 8 mm) in a container part (`PartSpec.contains`) at a world point, as a valve or a tap does: the part leaks like it does from a bullet hole
   * (a `leak` event, the level drops in `update`, gas lights from a flame and then burns or goes off by its `explodes.chain`) but nothing is damaged and no `hole` event is sent. `point` defaults to the part's
   * centre and `normal` (the way the fluid leaves) to up. Returns false when the part holds nothing, is lost or the object is a registered impl; true when it is open (also when it already was).
   */
  vent(objectId: string, partId: string, opening?: { point?: Vec3; normal?: Vec3; diameter?: number }): boolean
  /** Closes the openings `vent` made in a part; returns how many it closed. The leak stops (a gas jet that is burning goes out when the level reaches zero or the fluid no longer flows). */
  seal(objectId: string, partId: string): number
  /**
   * Change the wind of the world (`DestructionOptions.wind`) while playing: its speed and the direction it blows towards. Turns the wind on when the
   * world was made without it.
   */
  setWind(wind: { speed?: number; direction?: Vec3 }): void
  /** Seconds since creation. */
  readonly time: number
}

/** Internal bookkeeping of a part that is saved with the world so that a loaded world continues identically. Treat as opaque. */
export interface PartRuntime {
  /** Last melt fraction reported in a `melt` event. */
  meltEmitted: number
  /** Seconds since the last `drip`. */
  dripT: number
  /** Temperature at the end of the previous update (thermal shock). */
  prevTemp: number
  /** Seconds left before another thermal crack is allowed. */
  shockT: number
  /** A leaking flammable fluid is burning on this part. */
  jet: boolean
  /** A spark, a flame or a blast reached the flammable fluid that leaks from this part: it burns (or goes off) at the next update. */
  lit?: boolean
  /** Seconds left before the next `stress` event. */
  stressT?: number
  /** World time at which a primed explosive part goes off (`explodes.chain`). */
  chainDue?: number
  /** Patches of surface layers that came off (`layers.ts`). */
  spalls?: Array<[number, number, number, number, number, number]>
  /** Through damage so far: `[x, y, z, area]` in object space, newest last. */
  breach?: Array<[number, number, number, number]>
  /** Mass in kg that left the part in a breach. */
  removed?: number
  /** Plastic rotation in radians a reinforced beam or slab took in bending (blasts add it up; `flexure.failRotationDeg` breaks it). */
  hinge?: number
}

/** Opaque bookkeeping of an object (see `PartRuntime`). `joints` holds the last disassembly step reported per joint id. */
export interface ObjectRuntime {
  parts: Record<string, PartRuntime>
  joints: Record<string, number>
  /** Parts of groups that already reported a `collapse`. */
  collapsed?: string[]
  /** Permanent settlement of the soil under each footing cell or pile that yielded (`DestructibleSpec.soil`), metres. */
  soil?: Record<string, number>
  /** Sway of the top and of the tuned mass damper: `[x, v, y, w, peak]` (displacement and velocity of the building, of the damper, recorded peak). */
  wind?: [number, number, number, number, number]
}

export interface DestructionSnapshot {
  version: 1
  time: number
  rng: number
  /** Counter for generated object ids (`obj_1`...). */
  counter?: number
  objects: Array<{ id: string; spec: DestructibleSpec; state: ObjectState; runtime?: ObjectRuntime }>
  /** Registered impls: transform and `serialize()` data. `load` restores them into impls registered under the same ids. */
  impls?: Array<{ id: string; position: Vec3; rotation: Quat; data?: unknown }>
}
