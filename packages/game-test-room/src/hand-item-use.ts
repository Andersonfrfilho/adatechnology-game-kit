/**
 * The room's side of a hand use (game-items `HandUseDef`): an item without a liquid eaten, taken, applied or rubbed in. It plays in the room's item-use slot like a
 * fluid use (the hand and the item follow its pose, the body takes the arms `body` names), a bite shrinks the food in the hand, and at the end the effect the catalogue
 * gave (`ModuleItemUse.effect`) is told and logged and a spent item leaves the world.
 */
import type * as THREE_NS from 'three'
import type { HandTargets, ModuleItemUse } from '@adatechnology/game-contracts'
import type { ItemUsePlayer } from '@adatechnology/game-fluids'
import { createHandUse } from '@adatechnology/game-items'
import type { HandUseBody, HandUseDef } from '@adatechnology/game-items'

/** The share of its size food keeps after the last bite, just before it is gone. */
const EATEN_SCALE = 0.35

/** A use in the room's slot that also says which arms it takes. */
export type RoomUsePlayer = ItemUsePlayer & { readonly body?: HandUseBody }

/** Plays `def` on the item drawn at `root`: the pose for the hand, and the food shrinking a little at each bite. */
export const createHandItemUse = (def: HandUseDef, root: THREE_NS.Object3D): RoomUsePlayer => {
  const hand = createHandUse(def)
  const size = root.scale.x
  return {
    def: { id: def.id, duration: def.duration, keys: def.keys.map((key) => ({ t: key.t, position: [...key.position], rotation: [...key.rotation], action: 'none' })) },
    body: def.body,
    get time() {
      return hand.time
    },
    get done() {
      return hand.done
    },
    pose: () => hand.pose(),
    update: (dt) => {
      for (const event of hand.update(dt)) if (event.action === 'bite') root.scale.setScalar(size * (1 - (1 - EATEN_SCALE) * event.share))
      return []
    },
    cancel: () => {
      hand.cancel()
      root.scale.setScalar(size)
    },
  }
}

type Translate = (key: string, vars?: Record<string, string | number>) => string

/** What the use gave, in words (`effect.<id>` of the room's strings with the effect's numbers). */
export const handUseEffectText = (use: ModuleItemUse, t: Translate): string => {
  const effect = use.effect
  if (!effect) return t('effect.none')
  const numbers: Record<string, string | number> = {}
  for (const [key, value] of Object.entries({ ...effect.params, satiety: effect.satiety, hydration: effect.hydration })) {
    if (typeof value === 'number') numbers[key] = value > 0 ? `+${Math.round(value)}` : Math.round(value)
  }
  if (typeof effect.params?.amount === 'number') numbers.amount = Math.round(effect.params.amount)
  const text = t(`effect.${effect.id}`, numbers)
  return text === `effect.${effect.id}` ? effect.id : text
}

/** The other hand beside the one that holds the item, in the item's frame (metres): soap between the palms, a dressing held on the forearm. */
const OTHER_HAND: readonly [number, number, number] = [-0.09, 0, 0.02]

/** Where the hands go for an item being used before the eye: the right hand on it, and with `two_hands` the left one beside it. */
export const usedItemTargets = (root: THREE_NS.Object3D, grip: THREE_NS.Quaternion, body: HandUseBody | undefined): HandTargets => {
  const at = root.getWorldPosition(root.position.clone())
  const quaternion: [number, number, number, number] = [grip.x, grip.y, grip.z, grip.w]
  const right = { position: [at.x, at.y, at.z] as [number, number, number], quaternion }
  if (body !== 'two_hands') return { R: right, grip: 1 }
  const side = root.position.clone().set(OTHER_HAND[0], OTHER_HAND[1], OTHER_HAND[2]).applyQuaternion(grip).add(at)
  return { R: right, L: { position: [side.x, side.y, side.z], quaternion }, grip: 1, gripL: 0.6 }
}
