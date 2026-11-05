/**
 * Which sound the hand makes with what it works: the item's own choice (`TestableItem.sounds`) first, else what its material says. The ids are those of the
 * foley bank of game-audio (`FOLEY_BANK`), named after the sound list, so a recorded take under the same id replaces the synthesised one.
 */
import { LEAF_FOLEY_SETS } from '@adatechnology/game-audio'
import type { LeafFoley, PickupClass } from '@adatechnology/game-audio'
import type { ItemSounds } from '@adatechnology/game-contracts'
import type { MaterialDef } from '@adatechnology/game-destruction'

/** The pickup class of a material: by its tags (metal, glass and ceramic, plastic and rubber, wood, cloth, plants), paper by its id; plastic when nothing says. */
export function pickupClassOf(def: MaterialDef | undefined): PickupClass {
  if (!def) return 'plastic'
  const tags = def.tags ?? []
  if (def.id === 'paper') return 'paper'
  if (tags.includes('metal')) return 'metal'
  if (tags.includes('glass') || tags.includes('ceramic')) return 'glass'
  if (tags.includes('plastic') || tags.includes('rubber')) return 'plastic'
  if (tags.includes('wood')) return 'wood'
  if (tags.includes('fabric')) return 'fabric'
  if (tags.includes('plant')) return 'food'
  return 'plastic'
}

/** The sound of picking the item up. */
export const pickupSoundOf = (sounds: ItemSounds | undefined, def: MaterialDef | undefined): string => `item_pickup_${sounds?.handling ?? pickupClassOf(def)}`

/**
 * The sound set of a leaf: the one the item names for this part (or for `*`), else a drawer for a leaf that slides, else a metal or a wooden door by the
 * sound class of its material (`impact_metal`, `impact_glass` ring like metal). An unknown set name falls back the same way.
 */
export function leafFoleyOf(sounds: ItemSounds | undefined, part: string, impactKey: string, slides: boolean): LeafFoley {
  const named = sounds?.leaves?.[part] ?? sounds?.leaves?.['*']
  const set = named ? LEAF_FOLEY_SETS[named] : undefined
  if (set) return set
  if (slides) return LEAF_FOLEY_SETS.drawer
  return /metal|glass/.test(impactKey) ? LEAF_FOLEY_SETS.metal_door : LEAF_FOLEY_SETS.wood_door
}

/** The sound of opening the item's seal: the item's own, else a metal seal is a can's tab and anything else a screw cap. */
export const openSoundOf = (sounds: ItemSounds | undefined, def: MaterialDef | undefined): string => sounds?.open ?? (pickupClassOf(def) === 'metal' ? 'can_open' : 'bottle_open')

/** The sound each use repeats while it lasts, when the item does not name its own. */
export const USE_SOUNDS: Readonly<Record<string, string>> = {
  drink: 'drink_gulp',
  sip: 'drink_gulp',
  chug: 'drink_gulp',
  eat: 'eat_chew',
}
/** Seconds between two sounds of a use that lasts (a gulp, a bite chewed). */
export const USE_SOUND_EVERY = 0.55

/** The sound a use repeats, if any. */
export const useSoundOf = (sounds: ItemSounds | undefined, useId: string): string | undefined => sounds?.uses?.[useId] ?? USE_SOUNDS[useId]

/**
 * The hand's sounds that have recordings (the takes of `KIT_SAMPLE_ALIASES` or a file of the same id): loaded on the first key or click, so even the
 * first door opened or item taken plays the recording. The pickup is one sound, the item's class, picked up with the hand closing on it (criterion C1).
 */
export const HAND_RECORDED_IDS: readonly string[] = [
  'door_wood_open',
  'door_creak',
  'door_wood_close',
  'door_wood_slam',
  'door_locked_rattle',
  'item_pickup_metal',
  'item_pickup_plastic',
  'item_pickup_glass',
  'item_pickup_wood',
  'item_pickup_fabric',
  'drink_gulp',
  // the old leaf keys still played by a leaf without a set (a vehicle's, whose bank falls back to them)
  'latch',
  'shut_wood',
  'rattle',
]
