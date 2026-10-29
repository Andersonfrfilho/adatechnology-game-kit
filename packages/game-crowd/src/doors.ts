import type { NavGrid } from './grid'

export type Door = {
  readonly x: number
  readonly z: number
  /** The leaf runs along `x` (front or back wall) or `z`. */
  readonly axis: 'x' | 'z'
  readonly width: number
  hp: number
  hpMax: number
  open: boolean
  broken: boolean
  planks: number
  readonly rect: readonly [number, number, number, number]
  /** Whatever the game hangs on it (the building it belongs to). */
  readonly data?: unknown
}

export type DoorEventMap = {
  sound: { sound: 'wood'; volume: number; position: [number, number, number] }
  noise: { x: number; z: number; radius: number }
  effect: { effect: 'dust'; point: [number, number, number]; color: number }
  broken: { door: number }
}
export type DoorEventName = keyof DoorEventMap

export type DoorNumbers = {
  /** Hit points of a door (G 63803 `PORTA_VIDA`). */
  readonly doorHp: number
  /** Hit points each plank adds (G 63803 `TABUA_VIDA`). */
  readonly plankHp: number
  readonly height: number
  readonly thickness: number
  readonly soundChance: number
  readonly soundVolume: number
  readonly breakVolume: number
  readonly breakNoise: number
}

export const DOOR_DEFAULTS: DoorNumbers = { doorHp: 300, plankHp: 150, height: 2.2, thickness: 0.1, soundChance: 0.3, soundVolume: 0.8, breakVolume: 1.5, breakNoise: 30 }

export type Doors = {
  readonly list: readonly Door[]
  /** The door index at a grid cell, -1 for none. */
  at(cell: number): number
  add(x: number, z: number, axis: 'x' | 'z', width: number, data?: unknown): number
  /** Opens or closes: the cells become passable (3) or a closed door (5). A broken door stays open. */
  set(index: number, open: boolean): void
  /** An agent hits a closed door (G 64044 `doorHit`): the 30% knock, planks giving way, and the door breaking open. */
  hit(index: number, damage: number): void
  /** Nails a plank on (each adds `plankHp`). */
  plank(index: number): void
  on<K extends DoorEventName>(event: K, listener: (event: DoorEventMap[K]) => void): () => void
}

/** The doors of the game's buildings on a grid (G 63796-63816 `DOORS`, `doorAt`, `addDoor`, `setDoor`; G 64044 `doorHit`). */
export function createDoors(grid: NavGrid, options: { random: () => number; numbers?: Partial<DoorNumbers> }): Doors {
  const N: DoorNumbers = { ...DOOR_DEFAULTS, ...options.numbers }
  const random = options.random
  const list: Door[] = []
  const doorAt = new Int16Array(grid.n * grid.n).fill(-1)
  const listeners = new Map<DoorEventName, Set<(event: never) => void>>()
  const emit = <K extends DoorEventName>(event: K, payload: DoorEventMap[K]): void => {
    for (const listener of listeners.get(event) ?? []) (listener as (event: DoorEventMap[K]) => void)(payload)
  }
  const set = (index: number, open: boolean): void => {
    const d = list[index]
    if (!d) return
    d.open = open
    grid.fillRect(...d.rect, open || d.broken ? 3 : 5, N.height)
  }
  return {
    list,
    at: (cell) => (cell < 0 ? -1 : doorAt[cell]!),
    add(x, z, axis, width, data) {
      const i = list.length
      const t = N.thickness
      const x0 = axis === 'x' ? x - width / 2 : x - t
      const x1 = axis === 'x' ? x + width / 2 : x + t
      const z0 = axis === 'x' ? z - t : z - width / 2
      const z1 = axis === 'x' ? z + t : z + width / 2
      list.push({ x, z, axis, width, hp: N.doorHp, hpMax: N.doorHp, open: false, broken: false, planks: 0, rect: [x0, z0, x1, z1], data })
      grid.fillRect(x0, z0, x1, z1, 5, N.height)
      const a = Math.floor((x0 + grid.half) / grid.cell)
      const b = Math.ceil((x1 + grid.half) / grid.cell)
      const c = Math.floor((z0 + grid.half) / grid.cell)
      const e = Math.ceil((z1 + grid.half) / grid.cell)
      for (let gz = c; gz < e; gz++) for (let gx = a; gx < b; gx++) doorAt[gz * grid.n + gx] = i
      return i
    },
    set,
    hit(index, damage) {
      const d = list[index]
      if (!d || d.open || d.broken) return
      d.hp -= damage
      if (random() < N.soundChance) emit('sound', { sound: 'wood', volume: N.soundVolume, position: [d.x, 1, d.z] })
      if (d.planks && d.hp < d.hpMax - d.planks * N.plankHp + N.plankHp * (d.planks - 1)) d.planks = Math.max(0, d.planks - 1)
      if (d.hp <= 0) {
        d.broken = true
        d.planks = 0
        set(index, true)
        emit('noise', { x: d.x, z: d.z, radius: N.breakNoise })
        emit('sound', { sound: 'wood', volume: N.breakVolume, position: [d.x, 1, d.z] })
        emit('effect', { effect: 'dust', point: [d.x, 1, d.z], color: 0x8a6a4a })
        emit('broken', { door: index })
      }
    },
    plank(index) {
      const d = list[index]
      if (!d) return
      d.planks += 1
      d.hp += N.plankHp
      d.hpMax += N.plankHp
    },
    on(event, listener) {
      let set_ = listeners.get(event)
      if (!set_) listeners.set(event, (set_ = new Set()))
      set_.add(listener as (event: never) => void)
      return () => void set_.delete(listener as (event: never) => void)
    },
  }
}
