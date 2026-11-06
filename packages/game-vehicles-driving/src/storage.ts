/**
 * What a vehicle carries besides its people: the glovebox (reached from a front seat, or through an open front door, with its lid open) and the trunk
 * (reached with the lid up, from behind). Each compartment holds item stacks by slot, up to a slot count and a weight; nothing is reached while it is
 * shut, and the weight it carries is there for the driver to add to the vehicle's mass. Items are the host's (a game's catalog, `game-items`): a stack
 * is its id, its count, the weight of one and whatever state the host keeps with it. Every number is an option.
 */

export type CompartmentId = string

export interface CompartmentSpec {
  readonly id: CompartmentId
  /** Stacks it holds. */
  readonly slots: number
  /** Weight it takes, kg. */
  readonly capacityKg: number
  /** How it is reached: `cabin` from a front seat or an open front door with its own lid open (a glovebox); `lid` with the trunk lid up. */
  readonly access: 'cabin' | 'lid'
}

/** A stack in a compartment: the host's item id, how many and the weight of one; `data` is the host's own state of the stack (age, charge), kept as is. */
export interface StorageStack {
  readonly itemId: string
  readonly count: number
  readonly unitKg: number
  readonly data?: unknown
}

/** What reaches the compartments now. */
export interface StorageAccess {
  /** Someone sits in a front seat. */
  readonly seated: boolean
  /** A front door is open (someone standing outside reaches the glovebox). */
  readonly frontDoorOpen: boolean
  /** The glovebox lid is open (`ControlState.glovebox`). */
  readonly gloveboxOpen: boolean
  /** The trunk lid is up, 0..1 (open from 0.5). */
  readonly lid: number
}

export type StoreResult = 'ok' | 'shut' | 'full' | 'too_heavy' | 'missing'

/** A glovebox: a few small things (papers, a torch, a charger), about 8 litres. */
export const GLOVEBOX: CompartmentSpec = { id: 'glovebox', slots: 6, capacityKg: 4, access: 'cabin' }

/** The trunk of a car by its size in litres (a hatch 280, a sedan 450, an estate 600): a slot every 25 litres and a kilo for every 4 litres. */
export const trunkFor = (litres = 450): CompartmentSpec => ({ id: 'trunk', slots: Math.max(4, Math.round(litres / 25)), capacityKg: Math.round(litres / 4), access: 'lid' })

export interface VehicleStorageOptions {
  /** Default: a glovebox and a 450-litre trunk. A motorcycle passes none, a pickup its bed as a `lid` compartment. */
  compartments?: readonly CompartmentSpec[]
}

export interface VehicleStorage {
  readonly compartments: readonly CompartmentSpec[]
  /** The compartment can be reached now. */
  reachable(id: CompartmentId, access: StorageAccess): boolean
  /** Stacks by slot (null an empty slot). */
  contents(id: CompartmentId): ReadonlyArray<StorageStack | null>
  /** Weight in one compartment, or in all of them. */
  loadKg(id?: CompartmentId): number
  /** Puts a stack in (it joins a stack of the same item without host state); refused while shut, without a free slot or over the weight. */
  put(id: CompartmentId, stack: StorageStack, access: StorageAccess): StoreResult
  /** Takes the stack of a slot out; null while shut or empty. */
  take(id: CompartmentId, slot: number, access: StorageAccess): StorageStack | null
  /** Fills a compartment at once, reachable or not (what was in it when the vehicle was found); what does not fit is left out and returned. */
  stock(id: CompartmentId, stacks: readonly StorageStack[]): StorageStack[]
  /** Empties every compartment (the vehicle goes away). */
  clear(): void
}

const weightOf = (stack: StorageStack): number => stack.unitKg * stack.count

export function createVehicleStorage(options: VehicleStorageOptions = {}): VehicleStorage {
  const compartments = [...(options.compartments ?? [GLOVEBOX, trunkFor()])]
  const slots = new Map<CompartmentId, Array<StorageStack | null>>(compartments.map((c) => [c.id, Array.from({ length: c.slots }, () => null)]))
  const specOf = (id: CompartmentId): CompartmentSpec | undefined => compartments.find((c) => c.id === id)
  const load = (id: CompartmentId): number => (slots.get(id) ?? []).reduce((kg, s) => kg + (s ? weightOf(s) : 0), 0)
  const reachable = (id: CompartmentId, access: StorageAccess): boolean => {
    const spec = specOf(id)
    if (!spec) return false
    return spec.access === 'lid' ? access.lid >= 0.5 : access.gloveboxOpen && (access.seated || access.frontDoorOpen)
  }
  const place = (id: CompartmentId, stack: StorageStack): StoreResult => {
    const spec = specOf(id)
    const list = slots.get(id)
    if (!spec || !list) return 'missing'
    if (load(id) + weightOf(stack) > spec.capacityKg + 1e-9) return 'too_heavy'
    const same = stack.data === undefined ? list.findIndex((s) => s !== null && s.itemId === stack.itemId && s.data === undefined) : -1
    if (same >= 0) {
      const s = list[same] as StorageStack
      list[same] = { ...s, count: s.count + stack.count }
      return 'ok'
    }
    const free = list.indexOf(null)
    if (free < 0) return 'full'
    list[free] = { ...stack }
    return 'ok'
  }
  return {
    compartments,
    reachable,
    contents: (id) => [...(slots.get(id) ?? [])],
    loadKg: (id) => (id === undefined ? compartments.reduce((kg, c) => kg + load(c.id), 0) : load(id)),
    put(id, stack, access) {
      if (!specOf(id)) return 'missing'
      if (!reachable(id, access)) return 'shut'
      return place(id, stack)
    },
    take(id, slot, access) {
      const list = slots.get(id)
      if (!list || !reachable(id, access)) return null
      const stack = list[slot] ?? null
      if (stack) list[slot] = null
      return stack
    },
    stock(id, stacks) {
      return stacks.filter((s) => place(id, s) !== 'ok')
    },
    clear() {
      for (const list of slots.values()) list.fill(null)
    },
  }
}
