/**
 * Contract of @adatechnology/game-interactables.
 *
 * The package is a renderer-agnostic runtime for interactive world objects: movable parts (doors, drawers, lids, knobs, flaps),
 * containers with pickable items, a logical power grid (meter, circuits, sockets, switches, devices), fuel (gas bottles, charcoal),
 * a logical water network (tanks feeding taps, showers, tanks and flushes), seats and beds, soft volumes that sway instead of blocking,
 * effect emitters (smoke, fire, steam, water, sparks), mirror surfaces and damage.
 *
 * Content packs (for example @adatechnology/game-interactables-household) describe objects as `ObjectSpec` data; the host adds them
 * to a `World`, calls `update(dt)` every frame and draws whatever the world reports. Coordinates in a spec are local to the object
 * (front = +z, origin at the center of the footprint on the floor, meters). `World` converts them with the object's `Transform`.
 */

export type Vec3 = [number, number, number]

/** Placement of an object in the host's space. Rotation is around +y (radians). */
export interface Transform {
  x: number
  y: number
  z: number
  ry: number
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Movable parts
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * How a part moves between t = 0 (closed / off) and t = 1 (open / on).
 * - `hinge`: rotate `angle` radians around `axis` through the pivot (doors, lids, flaps, oven door).
 * - `slide`: translate `distance` meters along `axis` (drawers, sliding panels, gate leaves, curtains).
 * - `scale`: scale along `axis` from 1 to `scale` (blinds being raised, curtains bunching).
 * - `rocker`: small rotation like `hinge`, snaps (switches).
 * - `knob`: rotation like `hinge`, for stove knobs and valves.
 */
export type MotionKind = 'hinge' | 'slide' | 'scale' | 'rocker' | 'knob'

export interface Motion {
  kind: MotionKind
  /** Axis in the part's local frame. Default [0, 1, 0]. */
  axis?: Vec3
  /** Radians, for hinge / rocker / knob. */
  angle?: number
  /** Meters, for slide. */
  distance?: number
  /** Final scale factor, for scale. */
  scale?: number
  /** Units of t per second. Default 2.5 (0.4 s to fully open). */
  speed?: number
}

/** A rectangle on the floor plane in object-local coordinates: [x0, z0, x1, z1]. */
export type Rect = [number, number, number, number]

export interface PartSpec {
  /** Unique inside the object, snake_case or kebab-case (`door`, `drawer_2`, `lid`). */
  id: string
  /** Pivot in object-local coordinates (hinge line, slide origin). */
  pivot: Vec3
  /** Extra rotation of the part frame around +y, radians. */
  ry?: number
  motion: Motion
  /** Initial t. Default 0. */
  t0?: number
  /**
   * Floor area swept by the part when it goes from t = 0 to t = 1, in object-local coordinates.
   * Hosts use it with `fitSweep` so a door never opens through a wall.
   */
  sweep?: Rect
  /**
   * Closed-pose bounding box of the part's geometry, object-local: [x0, y0, z0, x1, y1, z1]. When present, `fitSweep` moves this
   * whole slab (thickness, hinge offset, any hinge axis, slides) instead of testing the thin `sweep` rectangle.
   */
  bounds?: [number, number, number, number, number, number]
  /** The part only moves while this part is at t >= 0.5 (an inner drawer behind a door). */
  requires?: string
  /** Label key used by the default interaction (see `InteractionSpec.label`). */
  label?: string
  /**
   * Parts of one object that share a group move together: `setPart` or a toggle on any member sets the target of all of them
   * (blind slats, the two panels of a curtain).
   */
  group?: string
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Containers and items
// ---------------------------------------------------------------------------------------------------------------------------------

/** One stack of items. `type` is an id from the content pack's item catalog. */
export interface ItemStack {
  type: string
  qty: number
  /** Free per-instance data (letter text key, expiry, condition...). */
  data?: Record<string, unknown>
}

export interface ItemDef {
  id: string
  category: string
  /** Bounding size [w, h, d] in meters, used to place the item on a slot and to check it fits. */
  size: Vec3
  /** kg per unit. */
  weight: number
  /** Max units per stack. Default 1. */
  stack?: number
  /** Can the player take it. Default true. */
  pickable?: boolean
  /** Locale key of the display name. Default `item.<id>`. */
  name?: string
  /** Hint for the host's renderer: which simple shape to draw (`can`, `box`, `bottle`, `jar`, `bag`, `cloth`, `paper`, `tool`...). */
  shape?: string
  color?: number
}

export type ItemCatalog = Record<string, ItemDef>

/** A spot where one stack sits, in object-local coordinates (bottom center of the stack). */
export interface SlotSpec {
  pos: Vec3
  /** Largest item [w, h, d] the slot holds. */
  max: Vec3
  /** The slot moves with this part (a drawer or a door shelf). */
  part?: string
}

export interface ContainerSpec {
  id: string
  /** Part that must be open (t >= 0.5) to see and take items. Omit for open shelves. */
  access?: string
  /** Inner volume, object-local: center and half sizes. Used for previews and to keep items inside. */
  volume: { center: Vec3; half: Vec3 }
  slots: SlotSpec[]
  /** Loot table id used when no explicit contents are given. */
  loot?: string
  /** Explicit contents, slot by slot (null = empty). Wins over `loot`. */
  contents?: Array<ItemStack | null>
}

export interface LootEntry {
  type: string
  /** Relative weight. */
  weight: number
  /** Quantity range [min, max]. Default [1, 1]. */
  qty?: [number, number]
}

export interface LootTable {
  /** Chance that a slot is filled, 0..1. */
  fill: number
  entries: LootEntry[]
}

export type LootTables = Record<string, LootTable>

// ---------------------------------------------------------------------------------------------------------------------------------
// Power, fuel, water
// ---------------------------------------------------------------------------------------------------------------------------------

/** A wall socket. `circuit` refers to a circuit id of the building (see `World.power`). */
export interface SocketSpec {
  id: string
  pos: Vec3
  circuit?: string
}

/** A light switch. Switches toggle devices of kind `lamp` by id (ids are world-wide, `objectId:deviceId` or plain ids). */
export interface SwitchSpec {
  id: string
  /** Rocker part that moves. */
  part?: string
  controls: string[]
}

export type DeviceKind = 'lamp' | 'appliance' | 'screen' | 'pump' | 'heater'

export interface DeviceSpec {
  id: string
  kind: DeviceKind
  watts: number
  /** Needs a powered socket or circuit to run. Default true. */
  electric?: boolean
  /** Socket id it is plugged into (world-wide id) or `auto` to plug into the nearest free socket within 2 m. */
  socket?: string | 'auto'
  /** Hard-wired to a circuit instead of a socket (ceiling lamps, shower heater). */
  circuit?: string
  /** Where the plug sits on the object (local), so the host can draw the cord to the socket. */
  plug?: Vec3
  /** Part that shows the on state (power button, knob). */
  part?: string
  /** Starts on. Default false. */
  on?: boolean
  /** For screens: number of channels the host can draw. */
  channels?: number
  /**
   * Id of a fixture of the same object that flows while this device is on and powered (a washing machine's water inlet).
   * The fixture is driven by the device: it gets no interaction of its own.
   */
  fixture?: string
}

export interface FuelSourceSpec {
  id: string
  kind: 'gas' | 'charcoal' | 'wood'
  /** kg. */
  capacity: number
  /** kg at start. Default = capacity. */
  level?: number
  /** Valve part (gas bottle regulator). */
  valve?: string
}

/** Something that burns fuel when on: stove burner, oven, barbecue bed. */
export interface BurnerSpec {
  id: string
  pos: Vec3
  /** Knob / valve part. */
  part?: string
  /** Fuel source id (local to the object, or world-wide `objectId:sourceId`, or `auto` = nearest gas bottle within 2 m). */
  fuel: string
  /** kg per second at full flame. */
  rate: number
  /** Needs a lighter/match first (charcoal). Gas burners light from the knob. Default false. */
  needsIgnition?: boolean
}

/** Logical water network: tanks feed fixtures. Pipes are not simulated, only the link. */
export interface TankSpec {
  id: string
  /** Liters. */
  capacity: number
  level?: number
  /** Inlet that refills from rain, in m^2 of collecting area. 0 = none. */
  rainArea?: number
}

export type FixtureKind = 'tap' | 'shower' | 'utility_sink' | 'flush' | 'hose' | 'filter'

export interface FixtureSpec {
  id: string
  kind: FixtureKind
  /** Where water comes out, object-local, and its direction. */
  outlet: Vec3
  dir?: Vec3
  /** Liters per minute when fully open. A flush uses `volume` once instead. */
  flow?: number
  volume?: number
  /** Valve / handle part. */
  part?: string
  /** Tank id (world-wide) or `auto` = the building's default tank. */
  tank?: string | 'auto'
  /** Needs power too (electric shower heats; still flows cold without power). */
  heater?: string
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Seats, soft volumes, emitters, mirrors, colliders, damage
// ---------------------------------------------------------------------------------------------------------------------------------

export type SeatPose = 'sit' | 'lie'

export interface SeatSpec {
  id: string
  pose: SeatPose
  /** Hips (sit) or pelvis (lie), object-local. */
  pos: Vec3
  /** Facing of the actor, relative to the object. */
  ry: number
  /** Eye height above `pos` for the camera. Default 0.62 sit, 0.18 lie. */
  eye?: number
  /** Where the actor stands when leaving, object-local. */
  exit: Vec3
}

/**
 * A soft volume never blocks. When an actor pushes through it, it swings like a pendulum (damped spring) and settles back.
 * Panels (shower doors) can also be pushed open if `part` is given: the push drives the part's t.
 */
export interface SoftSpec {
  id: string
  kind: 'cloth' | 'curtain' | 'panel' | 'foliage' | 'strip'
  /** Top anchor line center, object-local. */
  anchor: Vec3
  /** [w, h, d] of the hanging volume below the anchor. */
  size: Vec3
  /** Spring stiffness (1/s^2) and damping (1/s). Defaults 30 and 4. */
  stiffness?: number
  damping?: number
  /** Max swing, radians. Default 0.7. */
  maxAngle?: number
  /** Wind response 0..1. Default 1 for cloth, 0 for panels. */
  wind?: number
  part?: string
}

export type EmitterKind = 'smoke' | 'fire' | 'steam' | 'water' | 'spark' | 'flame'

/** An effect the host should draw while `when` holds. The world reports active emitters with their intensity 0..1. */
export interface EmitterSpec {
  id: string
  kind: EmitterKind
  pos: Vec3
  dir?: Vec3
  /** What drives it: a burner, fixture, device or fuel source id of the same object. */
  source: string
  /** Size hint in meters. */
  size?: number
  /** How far (m) a water stream falls before it hits something (a basin, a bowl). Default: until the floor. */
  reach?: number
}

export interface MirrorSpec {
  id: string
  center: Vec3
  /** Normal in object-local coordinates (the side the mirror faces). */
  normal: Vec3
  w: number
  h: number
  /** Moves with this part (mirror on a wardrobe door). */
  part?: string
}

/** Solid box collider, object-local. Soft things are never colliders. */
export interface ColliderSpec {
  id: string
  center: Vec3
  half: Vec3
  ry?: number
  /** Collider follows this part (a door): off while the part is at t > 0.5 when `offWhenOpen`. */
  part?: string
  offWhenOpen?: boolean
}

export type DamageKind = 'glass' | 'wood' | 'water' | 'metal' | 'masonry' | 'gas' | 'fabric' | 'plastic'

export interface DamageSpec {
  /** Part id, fuel source id, tank id or `self` for the whole object. */
  target: string
  kind: DamageKind
  hp: number
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------------------------------------------------------------

/** What an interaction does. The world executes it. */
export type Action =
  | { do: 'toggle_part'; part: string }
  | { do: 'open_container'; container: string }
  | { do: 'take'; container: string; slot?: number }
  | { do: 'toggle_device'; device: string }
  | { do: 'cycle_device'; device: string }
  | { do: 'toggle_switch'; switch: string }
  /** Flips the building circuit `circuit` (see `World.power.setBreaker`). `part` is a rocker of the same object that mirrors the state (t = 1 when on). */
  | { do: 'toggle_breaker'; circuit: string; part?: string }
  | { do: 'toggle_fixture'; fixture: string }
  | { do: 'toggle_burner'; burner: string }
  | { do: 'ignite'; burner: string }
  | { do: 'toggle_fuel'; fuel: string }
  | { do: 'sit'; seat: string }
  | { do: 'read'; container: string; slot: number }

export interface InteractionSpec {
  id: string
  /** Object-local point the player aims at. */
  pos: Vec3
  /** Reach radius, meters. Default 1.2. */
  radius?: number
  action: Action
  /**
   * Locale key of the prompt, resolved with the current state: the world looks up `<label>.on` / `<label>.off` (or `.open` / `.closed`)
   * and falls back to `<label>`. Example keys: `prompt.door`, `prompt.drawer`, `prompt.stove_knob`.
   */
  label: string
  /** The interaction is available only while this part of this object (world-wide object id) is open (`t >= 0.5`). */
  requires?: { object: string; part: string }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Object spec (what content packs produce)
// ---------------------------------------------------------------------------------------------------------------------------------

export interface ObjectSpec {
  /** Type id from the content pack (`fridge`, `wardrobe`, `stove`...). */
  type: string
  parts?: PartSpec[]
  containers?: ContainerSpec[]
  sockets?: SocketSpec[]
  switches?: SwitchSpec[]
  devices?: DeviceSpec[]
  fuels?: FuelSourceSpec[]
  burners?: BurnerSpec[]
  tanks?: TankSpec[]
  fixtures?: FixtureSpec[]
  seats?: SeatSpec[]
  soft?: SoftSpec[]
  emitters?: EmitterSpec[]
  mirrors?: MirrorSpec[]
  colliders?: ColliderSpec[]
  damage?: DamageSpec[]
  interactions?: InteractionSpec[]
  /** Visible wires / conduits / cords (object-local polylines) the host draws as thin tubes. */
  wires?: Array<{ id: string; kind: 'drop' | 'conduit' | 'cord' | 'cable'; points: Vec3[]; radius?: number }>
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------------------------------------------------------------

export type InteractablesLocale = 'en' | 'pt-BR'

/** Locale table: key -> text. `{n}` style placeholders are filled from `vars`. */
export type Strings = Record<string, string>

export interface WorldOptions {
  locale?: InteractablesLocale | string
  /** Extra strings per locale, merged over the built-in ones (content packs pass theirs here). */
  strings?: Partial<Record<InteractablesLocale, Strings>>
  items?: ItemCatalog
  loot?: LootTables
  /** Seed for loot and any random detail. Same seed + same adds = same world. */
  seed?: number | string
  /** Grid power at start. Default true. */
  grid?: boolean
  /** Rain intensity mm/h at start (fills tanks with `rainArea`). Default 0. */
  rain?: number
  /** Wind vector [x, z] m/s for cloth. Default [0, 0]. */
  wind?: [number, number]
  /**
   * External water network. When given, fixtures draw water through it instead of the world's own tanks: `draw` gets the
   * world-wide fixture id (`objectId:fixtureId`) and the liters wanted for this step and returns the liters actually delivered
   * (0 = dry: the host should show only a drip). Lets a building SDK own the tank, leaks and refills.
   */
  waterSupply?: { draw(fixture: string, liters: number): number }
  /** Called for every event. */
  onEvent?: (event: WorldEvent) => void
  /** Return false to cancel an interaction (locked, needs a tool, tutorial...). */
  canInteract?: (interaction: Interactable, actor: string) => boolean | void
}

export type WorldEvent =
  | { type: 'part'; object: string; part: string; t: number; target: number }
  | { type: 'pickup'; object: string; container: string; slot: number; stack: ItemStack; actor: string }
  | { type: 'device'; object: string; device: string; on: boolean; powered: boolean; channel?: number }
  | { type: 'switch'; object: string; switch: string; on: boolean }
  | { type: 'fixture'; object: string; fixture: string; on: boolean; flowing: boolean }
  | { type: 'burner'; object: string; burner: string; on: boolean; lit: boolean }
  | { type: 'seat'; object: string; seat: string; actor: string; seated: boolean }
  | { type: 'damage'; object: string; target: string; hp: number; destroyed: boolean }
  | { type: 'explosion'; object: string; pos: Vec3; radius: number }
  | { type: 'leak'; object: string; target: string; pos: Vec3 }
  | { type: 'message'; key: string; text: string }
  | { type: 'power'; grid: boolean }
  /** A container without an access part was opened (open shelf): the host may show its contents. */
  | { type: 'container'; object: string; container: string; open: boolean }

/** World-space interaction, compatible with hosts that list `{id, tipo, pos, raio, rotulo, agir()}`. */
export interface Interactable {
  /** `objectId:interactionId`. */
  id: string
  object: string
  kind: Action['do']
  pos: Vec3
  radius: number
  /** Current localized prompt. */
  label: string
  act(actor?: string): boolean
}

export interface ActiveEmitter {
  id: string
  object: string
  kind: EmitterKind
  pos: Vec3
  dir: Vec3
  size: number
  /** Meters a water stream falls before it hits something; omitted = until the floor. */
  reach?: number
  /** 0..1. */
  intensity: number
}

export interface SeatResult {
  /** World-space eye position and facing for the camera. */
  eye: Vec3
  yaw: number
  pose: SeatPose
}

export interface WorldObject {
  id: string
  spec: ObjectSpec
  transform: Transform
  /** Part t values right now (0..1). */
  parts: Record<string, number>
}

export interface World {
  /** Adds an object. `id` must be unique; returns it. */
  add(id: string, spec: ObjectSpec, transform: Transform): WorldObject
  remove(id: string): void
  get(id: string): WorldObject | undefined
  objects(): WorldObject[]

  /** Advance animations, sway, fuel, water and effects by `dt` seconds. */
  update(dt: number): void

  /** Every interaction in world space, with current labels. */
  interactables(): Interactable[]
  /** Best interaction for an eye looking along yaw/pitch (radians, yaw 0 = -z), within reach. */
  target(eye: { x: number; y: number; z: number; yaw: number; pitch: number }, options?: { reach?: number; cone?: number }): Interactable | null
  act(interactableId: string, actor?: string): boolean

  /** Parts */
  partT(objectId: string, partId: string): number
  setPart(objectId: string, partId: string, target: number, instant?: boolean): void
  /**
   * Largest t in [0, 1] whose swept area stays clear. `blocked(x, z)` gets world coordinates. The world clamps the part to it.
   * Call once after adding objects next to walls.
   */
  fitSweep(objectId: string, partId: string, blocked: (x: number, z: number) => boolean): number

  /** Containers */
  contents(objectId: string, containerId: string): Array<ItemStack | null>
  accessible(objectId: string, containerId: string): boolean
  take(objectId: string, containerId: string, slot: number, actor?: string): ItemStack | null
  put(objectId: string, containerId: string, stack: ItemStack): number | null
  /** World-space position of a slot right now (follows drawers and doors). */
  slotPosition(objectId: string, containerId: string, slot: number): Vec3

  /** Power */
  power: {
    grid: boolean
    setGrid(on: boolean): void
    setBreaker(circuit: string, on: boolean): void
    breaker(circuit: string): boolean
    isPowered(objectId: string, deviceId: string): boolean
    isOn(objectId: string, deviceId: string): boolean
    /** Socket a device ended up plugged into (`objectId:socketId`) or null. */
    pluggedInto(objectId: string, deviceId: string): string | null
    channel(objectId: string, deviceId: string): number
  }

  /** Fuel */
  fuelLevel(objectId: string, fuelId: string): number
  isLit(objectId: string, burnerId: string): boolean

  /** Water */
  water: {
    /** Default tank of the building (used by fixtures with `tank: 'auto'`). World-wide id `objectId:tankId`. */
    setDefaultTank(tankId: string | null): void
    level(tankId: string): number
    refill(tankId: string, liters: number): number
    setRain(mmPerHour: number): void
    isFlowing(objectId: string, fixtureId: string): boolean
  }

  /** Seats */
  sit(objectId: string, seatId: string, actor?: string): SeatResult | null
  stand(actor?: string): Vec3 | null
  seatOf(actor?: string): { object: string; seat: string } | null

  /** Soft volumes: an actor at `pos` with `radius` moving at `vel` pushes nearby soft volumes. Never blocks. */
  push(pos: Vec3, radius: number, vel: Vec3): void
  /** Current swing of a soft volume: rotation around the anchor line, radians, x (front/back) and z (sideways). */
  sway(objectId: string, softId: string): { ax: number; az: number }
  setWind(x: number, z: number): void

  /** Effects the host should draw now. */
  emitters(): ActiveEmitter[]

  /** Mirrors facing `eye` within `maxDistance`, nearest first (world ids `objectId:mirrorId`). */
  mirrors(eye: Vec3, maxDistance?: number, count?: number): Array<{ id: string; center: Vec3; normal: Vec3; w: number; h: number; distance: number }>

  /** Solid colliders in world space (OBB on the floor plane plus height range). Soft volumes never appear here. */
  colliders(): Array<{ id: string; object: string; cx: number; cz: number; hw: number; hd: number; ry: number; y0: number; y1: number }>

  /** Damage */
  damage(objectId: string, target: string, amount: number, kind?: string): { hp: number; destroyed: boolean } | null
  hp(objectId: string, target: string): number | null

  /** Localized text. */
  t(key: string, vars?: Record<string, string | number>): string
  setLocale(locale: string): void

  /** Plain JSON state (parts, contents, power, fuel, water, seats) for saves and LAN sync. */
  serialize(): WorldState
  load(state: WorldState): void
}

export interface WorldState {
  version: 1
  objects: Record<string, { parts: Record<string, number>; contents: Record<string, Array<ItemStack | null>>; devices: Record<string, { on: boolean; channel: number }>; fuels: Record<string, { level: number; open: boolean }>; burners: Record<string, { on: boolean; lit: boolean }>; tanks: Record<string, number>; fixtures: Record<string, boolean>; hp: Record<string, number> }>
  grid: boolean
  breakers: Record<string, boolean>
  seats: Record<string, { object: string; seat: string }>
  defaultTank: string | null
}
