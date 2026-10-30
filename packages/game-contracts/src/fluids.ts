import type { Vec3 } from './destruction'

/**
 * Fluid contract: what a module says about the liquid its item holds, and how the item is used. Types only: the liquids themselves, their
 * simulation and their rendering live in `@adatechnology/game-fluids` (optional).
 */

/** snake_case liquid id: `water`, `coffee`, `milk`, `soda`, `beer`, `fuel`, `diesel`, `oil`, `blood`, `sap`, `acid`, `paint`... */
export type LiquidId = string

export interface ContainerSpec {
  /** Inner capacity in litres. */
  capacity: number
  /** Liquid it starts with (default none). */
  liquid?: LiquidId
  liters?: number
  temperature?: number
  /**
   * Inner shape in the container's local space, used for the surface height and the spill point. Origin at the inner bottom centre, +Y up.
   * `cylinder` (cups, cans, bottles approximated) or `box` (jerrycans, tanks, sinks).
   */
  shape: { kind: 'cylinder'; radius: number; height: number } | { kind: 'box'; size: [number, number, number] }
  /** Opening at the top: radius in metres (a bottle neck is 0.012, a cup 0.04). Pour rate grows with it. 0 = closed (needs `open()`). */
  opening: number
  /** Starts closed (bottle cap, jerrycan lid). */
  closed?: boolean
  /** The container is insulated (thermos): cools 10× slower. */
  insulated?: boolean
}

/**
 * A scripted use of a held item (drink a coffee, pour water, eat, wipe). Pure data with time-keyed poses so a test room or a game can play it
 * and check what happened. The host maps poses to its hand/viewmodel animation.
 */
export interface ItemUseDef {
  /** snake_case: `drink`, `sip`, `pour`, `fill_from_tap`, `pour_out`, `eat`, `wipe`... */
  id: string
  /** Seconds. */
  duration: number
  /**
   * Keyframes: time 0..duration, the hand-relative position/rotation (Euler XYZ) of the item and the container action during that key. `eat` takes the contents
   * out as `drink` does, as food: the liquid packed with it (the brine of a tin, the oil of the sardines) goes with the food, without the effects of drinking it.
   */
  keys: Array<{ t: number; position: Vec3; rotation: Vec3; action?: 'drink' | 'eat' | 'pour' | 'open' | 'close' | 'none'; rate?: number }>
  /** Only valid when the container holds one of these (empty = any). */
  liquids?: LiquidId[]
}
