import type { District } from '../game/options'
import type { WorldHash } from './runner'

const FNV_OFFSET = 2166136261
const FNV_PRIME = 16777619

/** FNV-1a over text: the hash `tools/gpu/room-determinism.mjs` takes of `world.serialize()`. */
export function hashText(text: string, seed: number = FNV_OFFSET): number {
  let hash = seed
  for (let position = 0; position < text.length; position++) {
    hash ^= text.charCodeAt(position)
    hash = Math.imul(hash, FNV_PRIME) >>> 0
  }
  return hash
}

function hashBytes(bytes: Uint8Array, seed: number): number {
  let hash = seed
  for (const byte of bytes) {
    hash ^= byte
    hash = Math.imul(hash, FNV_PRIME) >>> 0
  }
  return hash
}

/** The agents' place, speed, health and state: every byte of the fields that decide what the horde did. */
function crowdHash(district: District): number {
  const { store } = district.horde.crowd
  const count = store.n
  let hash = hashText(String(count))
  for (const field of [store.x, store.z, store.vx, store.vz, store.hp]) hash = hashBytes(new Uint8Array(field.buffer, field.byteOffset, count * 4), hash)
  return hashBytes(store.state.subarray(0, count), hash)
}

const MAX_DRAIN_FRAMES = 2000

/**
 * The state of the world as three numbers: the destruction world (`serialize`), the horde and the body. `serialize` would run an open blast to its end outside the pacer, so a blast the pacer still
 * holds is first let to finish with the frames the game itself would run (`frame`, held ones do not tick the world): the hash never has a hole. Two runs are the same when every phase has the same three.
 */
export function worldHashOf(district: District, frame: () => void): WorldHash {
  const { state } = district.player.player
  for (let drained = 0; district.world.blastPacing?.isHolding() === true; drained++) {
    if (drained >= MAX_DRAIN_FRAMES) throw new Error(`the blast pacer still holds the world after ${MAX_DRAIN_FRAMES} frames: the hash cannot be taken`)
    frame()
  }
  return {
    destruction: hashText(JSON.stringify(district.world.destruction.world.serialize())),
    crowd: crowdHash(district),
    player: hashText(JSON.stringify([state.x, state.y, state.z, state.vx, state.vz])),
  }
}
