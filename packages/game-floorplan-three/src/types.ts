import type { Messages } from './locale.js'

/** A part of the house a hit can damage (door, window, glass, tank...): the game reads `hp`. */
export interface Damageable {
  type: string
  hp: number
  hpMax: number
}

/** What `create(THREE, options)` reads. Everything is optional; the three.js namespace is the first argument. */
export interface HouseRendererOptions {
  /** Document used to draw the procedural textures on a canvas (default: the page's). */
  document?: any
  /** `'game'` merges more and draws less than `'high'`. */
  quality?: 'high' | 'game'
  /** Locale of the texts the house shows (`en`, `pt-BR`) or a table of messages. */
  locale?: string | Partial<Messages>
  /** `@adatechnology/game-props3d` (default: the package's own dependency). */
  props?: any
  /** `THREE.Reflector` (three/examples/jsm/objects/Reflector.js); without it the mirrors use only the environment map. */
  reflector?: any
  /** Cars of the lot and garage: `build(kind, { quality, seed })` -> `{ group, damageable, release() }`. Without it there are no cars. */
  fleet?: { build(kind: string, options: { quality: string; seed: number }): any } | null
  /** Car kinds (fleet ids) per lot style (`budget`, `mid`, `high`); replaces the list of a style. */
  carKinds?: Record<string, string[]>
  /** Hit points per damage class (glass, wood, water, metal, masonry, rubber, fuel, gas). */
  hp?: Record<string, number>
  /** Textures from the app that replace the procedural ones. */
  textures?: Record<string, any>
  atlas?: Record<string, any>
  /** Materials the game swaps (a material or a function of the default one). */
  materials?: Record<string, any>
  /** The world of `@adatechnology/game-destruction`; the house registers itself in it on first need. */
  destruction?: any
  /** `createDestructionRenderer(THREE, { scene, world })` of `@adatechnology/game-destruction-three`: draws fracture, collapse, fragments, spalls and the rebar cage on the house's meshes. */
  destructionRenderer?: any
  /** The interactables kit, injected: `{ GameInteractables, GameInteractablesHousehold, GameInteractablesThree, adapter (optional), adapterOptions, locale, region, items, effects, camera, onEvent, onSeat }`. */
  interactives?: any
  /** The vegetation packages, injected: `{ GameVegetation, GameVegetationSpecies }`. */
  vegetation?: any
  /** Maps an id of the plan to the key its seeded random draws use, to reproduce a scene drawn with other ids (golden tests). */
  seedKey?: (id: string) => string | null | undefined
  /** Distance (m) beyond which the interior (`interior`) and the house (`hide`) are drawn no more, or `false` to switch distance LOD off. */
  lod?: false | { interior?: number; hide?: number }
  drawCallBudget?: number
  onChange?: (change: { shadow: boolean }) => void
  onCollider?: (collider: any) => void
  onDamage?: (part: any, point: { x: number; y: number; z: number } | null, type: string) => void
  onWreck?: (event: any, house: any) => void
  onInteract?: (target: any, action: any) => boolean | void
  onLight?: (light: any) => void
  onMessage?: (text: string) => void
}

export interface BuildOptions {
  /** `'high'` (default) or `'game'`. */
  quality?: 'high' | 'game'
  /** Night: lit windows and room lamps. */
  night?: boolean
  /** Roof cut off and floors above hidden, to look into the plan. */
  cut?: boolean
  /** A state returned by `newState()`: pass the same one to rebuild without closing every door. */
  state?: any
  /** `false`: the app already has ground, street and lawn. */
  terrain?: boolean
  /** `true`: no lot wall, fence or gates (the game has its own). */
  noPerimeter?: boolean
  /** `'meshes'`: one mesh per structural piece instead of one per group and material. */
  pieces?: 'meshes'
  drawCallBudget?: number
  building?: { floors?: number; floor?: number; unit?: number; showBuilding?: boolean }
}

/** The house the renderer built. The three.js groups are ready to add to a scene. */
export interface House {
  version: string
  r: any
  name: string
  quality: string
  group: any
  house: any
  groups: Record<string, any>
  floors: any[]
  ceilings: any[]
  roof: any
  lot: any
  ground: any
  building: any
  /** Public colliders: walls, doors, lot walls and gates (aabb) and furniture (obb). */
  colliders: any[]
  /** Parts that move or take damage: id -> `{ group, type, opens(t), damageable }`. */
  parts: Record<string, any>
  doors: any[]
  stairs: any[]
  labels: any[]
  /** The real lights the builders asked for (at night) in `list`, and the same grouped by room id in `byRoom`. */
  lights: { list: any[]; byRoom: Record<string, any[]> }
  stats: any
  structure: any
  destruction: any
  interactives: any
  update(dt: number, time?: number, focus?: { x: number; y: number; z: number }): void
  show(options: { floor?: number; cut?: boolean; lot?: boolean }): void
  target(eye: any, options?: any): any
  interact(target: any): any
  toggleDoor(id: string): any
  toggleLight(room?: string): any
  lightOn(room: string): boolean
  collide(x: number, z: number, floor: number, options?: any): any
  roomAt(floor: number, x: number, z: number): any
  setLod(level: number): void
  readonly lod: number
  damage(id: string, point?: any, type?: string, amount?: number): void
  colliderDamage(collider: any, point?: any, type?: string, amount?: number): void
  /** The part (door, window, furniture piece...) an object belongs to, found by going up its parents. */
  partOf(object: any): any | null
  /** The first part whose box holds the point (with a tolerance, default 5 cm). */
  partAt(point: { x: number; y: number; z: number }, tolerance?: number): any | null
  dispose(): void
  [extra: string]: any
}

/** The renderer `create(THREE, options)` returns. */
export interface HouseRenderer {
  version: string
  build(result: any, options?: BuildOptions): House
  newState(): any
  types: Record<string, any>
  mv: any
  applyPart(group: any, t: number): void
  materials: Record<string, any>
  roomLightMask(material: any): void
  lighting(options?: any): any
  setNight(night: boolean): void
  cars: { model(kind: string, seed?: number): any; group(...args: any[]): any; info(kind: string, seed?: number): any }
  dispose(): void
}
