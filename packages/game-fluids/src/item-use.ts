import itemUsesData from './data/item-uses.json'
import { lerp3, quatFromEuler, quatMultiply, quatRotate, add } from './math'
import type { FluidEvent, FluidWorld, ItemUseDef, ItemUsePlayer, Quat, Vec3 } from './types'

/** Built-in scripted uses of a held item (data in `data/item-uses.json`): `sip`, `drink`, `chug`, `eat` (spoonfuls from an open tin), `pour`, `pour_out`, `open`, `close`,
 * `unscrew` (the other hand turns a screw cap off, `turn` keys, before the `open` key). */
export const ITEM_USES: ItemUseDef[] = itemUsesData as unknown as ItemUseDef[]

/** World transform of the hand (or any holder) the item pose is relative to. */
export type HandTransform = () => { position: Vec3; rotation: Quat }

const DEFAULT_DRINK_RATE = 0.1

/**
 * Plays an item use on a container: interpolates the keys, applies `drink` and `eat` (rate × dt litres) and `pour` (`world.pour`, `rate` multiplies the
 * time) while the current key has that action, and fires `open` / `close` once when their key is reached. When `getHandTransform` is given, the
 * container's world transform follows hand ∘ pose every update; otherwise the host animates the viewmodel from `pose()`.
 */
export function createItemUse(world: FluidWorld, containerId: string, def: ItemUseDef, getHandTransform?: HandTransform): ItemUsePlayer {
  const keys = [...def.keys].sort((a, b) => a.t - b.t)
  let time = 0
  let done = keys.length === 0 || def.duration <= 0
  let checked = false
  let lastPos: Vec3 | null = null
  const fired = new Set<number>()

  const pose = (): { position: Vec3; rotation: Vec3 } => {
    if (keys.length === 0) return { position: [0, 0, 0], rotation: [0, 0, 0] }
    if (time <= keys[0].t) return { position: [...keys[0].position], rotation: [...keys[0].rotation] }
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i]
      const b = keys[i + 1]
      if (time <= b.t) {
        const k = b.t > a.t ? (time - a.t) / (b.t - a.t) : 1
        return { position: lerp3(a.position, b.position, k), rotation: lerp3(a.rotation, b.rotation, k) }
      }
    }
    const last = keys[keys.length - 1]
    return { position: [...last.position], rotation: [...last.rotation] }
  }

  const follow = (dt: number): void => {
    if (!getHandTransform) return
    const hand = getHandTransform()
    const p = pose()
    const position = add(hand.position, quatRotate(hand.rotation, p.position))
    const rotation = quatMultiply(hand.rotation, quatFromEuler(p.rotation[0], p.rotation[1], p.rotation[2]))
    const velocity: Vec3 | undefined =
      lastPos && dt > 0 ? [(position[0] - lastPos[0]) / dt, (position[1] - lastPos[1]) / dt, (position[2] - lastPos[2]) / dt] : undefined
    lastPos = position
    world.setTransform(containerId, position, rotation, velocity)
  }

  const player: ItemUsePlayer = {
    def,
    get time() {
      return time
    },
    get done() {
      return done
    },
    pose,
    update(dt) {
      if (done) return []
      const events: FluidEvent[] = []
      const off = world.on('*', (e) => events.push(e))
      try {
        if (!checked) {
          checked = true
          const state = world.container(containerId)
          if (!state || (def.liquids && def.liquids.length > 0 && (!state.liquid || !def.liquids.includes(state.liquid)))) {
            done = true
            return events
          }
        }
        const start = time
        const end = Math.min(def.duration, time + Math.max(0, dt))
        for (let i = 0; i < keys.length && !done; i++) {
          const key = keys[i]
          const spanStart = key.t
          const spanEnd = i + 1 < keys.length ? keys[i + 1].t : def.duration
          if ((key.action === 'open' || key.action === 'close') && !fired.has(i) && end >= spanStart) {
            fired.add(i)
            if (key.action === 'open') world.open(containerId)
            else world.close(containerId)
          }
          const overlap = Math.min(end, spanEnd) - Math.max(start, spanStart)
          if (overlap <= 0) continue
          if (key.action === 'drink' || key.action === 'eat') {
            const ev = world.drink(containerId, (key.rate ?? DEFAULT_DRINK_RATE) * overlap, key.action === 'eat' ? { eaten: true } : undefined)
            const left = world.container(containerId)
            if (!ev || !left || left.liters <= 1e-6) {
              time = def.duration
              done = true
            }
          } else if (key.action === 'pour') {
            world.pour(containerId, overlap * (key.rate ?? 1))
          }
        }
        if (!done) {
          time = end
          done = time >= def.duration
        }
        follow(dt)
      } finally {
        off()
      }
      return events
    },
    cancel() {
      done = true
    },
  }
  return player
}
