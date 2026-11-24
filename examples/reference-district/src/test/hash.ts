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

/**
 * The state of the world as three numbers: the destruction world (`serialize`, which would run an open blast to its end, so it is read as `null` while the blast pacer holds one), the horde and the
 * body. Two runs of a script are the same when every phase has the same three.
 */
export function worldHashOf(district: District): WorldHash {
  const { state } = district.player.player
  const isHeld = district.world.blastPacing?.isHolding() === true
  return {
    destruction: isHeld ? null : hashText(JSON.stringify(district.world.destruction.world.serialize())),
    crowd: crowdHash(district),
    player: hashText(JSON.stringify([state.x, state.y, state.z, state.vx, state.vz])),
  }
}
