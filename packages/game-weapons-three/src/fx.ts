import type { HandTargets, HostEvent, HostTool, MuzzlePose, ToolHand } from '@adatechnology/game-contracts'
import { createBoxFx } from './box-fx'
import type { WeaponFxOptions } from './box-fx'
import { hasWeaponModel } from './models'
import { createLayers } from './fx/layers'
import type { FxLayers } from './fx/layers'
import { createViewmodel } from './fx/viewmodel'

export type { WeaponFxOptions } from './box-fx'
export type { FxLayers } from './fx/layers'

/** The weapon in the hands, its fire and reload motion, ejected casings and dropped magazines, and their sounds. */
export interface WeaponFx {
  /** Feed every tool event of the host, with the tool as it is after the event. */
  handle(event: HostEvent, tool: HostTool): void
  update(dt: number): void
  /** Dresses the weapon for its wear (`new`, `used`, `worn`, `rusty`); the gallery models show it in their metal. */
  setCondition(condition: string): void
  /** Where the hands take the weapon (world space, read every frame after `update`): the grip and the forend of the model, or the handle of the generic prop; null with nothing in the hands. */
  handTargets(): HandTargets | null
  /**
   * The muzzle of the weapon in the hands as drawn now (world space): the gallery model's mark, or the front of the generic prop; null for a tool that fires no shot. `hand: 'L'` is the
   * one of the left hand's weapon with a weapon in each hand.
   */
  muzzle(hand?: ToolHand): MuzzlePose | null
  /** What is drawn (casings, magazines, muzzle flash): change a field and the next event follows it. */
  readonly layers: FxLayers
  /** Weapon shown in the hands, or null. */
  readonly inHand: string | null
  /** Weapon shown in the left hand with a weapon in each hand (`HostTool.offHand`), or null. */
  readonly inLeftHand: string | null
  /** The clips of the model playing now with the seconds each lasts (scaled to the rule's duration): which reload variant went (`reload` or `reload_empty`...). */
  readonly clips: ReadonlyArray<{ name: string; seconds: number }>
  /** Casings and magazines currently on the floor or in the air. */
  readonly casings: number
  readonly magazines: number
  dispose(): void
}

/** What the left hand holds before the host tells: nothing. */
const EMPTY_HAND: HostTool = { weapon: '', category: '', ammo: 0, capacity: 0, reserve: 0, reloading: false }

/** The two presentations of the tool in one hand: the gallery model and, for what the gallery did not draw, the low-poly prop. */
interface HandFx {
  readonly box: ReturnType<typeof createBoxFx>
  readonly model: ReturnType<typeof createViewmodel>
}

const createHandFx = (options: WeaponFxOptions, layers: FxLayers, hand: ToolHand, oneHand?: () => boolean): HandFx => {
  const box = createBoxFx({ ...options, layers, ...(hand === 'L' ? { hand } : {}), ...(oneHand ? { oneHand } : {}) })
  const model = createViewmodel({
    ...(hand === 'L' ? { hand } : {}),
    ...(oneHand ? { oneHand } : {}),
    layers,
    ...(options.soundDistance ? { soundDistance: options.soundDistance } : {}),
    ...(options.soundSpace ? { soundSpace: options.soundSpace } : {}),
    ...(options.surfaceAt ? { surfaceAt: options.surfaceAt } : {}),
    ...(options.onSound ? { onSound: options.onSound } : {}),
    THREE: options.THREE,
    scene: options.scene,
    camera: options.camera,
    arsenal: options.arsenal,
    groundAt: options.groundAt,
    audio: options.audio ?? null,
    ...(options.seed === undefined ? {} : { seed: options.seed }),
    ...(options.tool ? { tool: options.tool } : {}),
    ...(options.condition ? { condition: options.condition } : {}),
    ...(options.attachmentModels ? { attachmentModels: options.attachmentModels } : {}),
    ...(options.raycast ? { raycast: options.raycast } : {}),
    ...(options.contact ? { contact: options.contact } : {}),
    ...(options.bodyHold ? { bodyHold: options.bodyHold } : {}),
    ...(options.firstPerson ? { firstPerson: options.firstPerson } : {}),
    ...(options.viewmodelFov ? { viewmodelFov: options.viewmodelFov } : {}),
    ...(options.aim ? { aim: options.aim } : {}),
    ...(options.motion ? { motion: options.motion } : {}),
    ...(options.effects ? { effects: options.effects } : {}),
    ...(options.flyRocket === undefined ? {} : { flyRocket: options.flyRocket }),
    ...(options.particleLimit ? { particleLimit: options.particleLimit } : {}),
    ...(options.lights ? { lights: options.lights } : {}),
    ...(options.pools ? { pools: options.pools } : {}),
  })
  return { box, model }
}

/** Feeds one hand's presentations: the gallery model when it drew the weapon, the prop otherwise. */
const handleHand = (pair: HandFx, event: HostEvent, tool: HostTool): void => {
  const { box, model } = pair
  if (event.type === 'explosion' || event.type === 'player' || event.type === 'footfall') return
  if (event.type === 'tool') {
    if (hasWeaponModel(event.weapon)) box.unequip()
    else model.unequip()
  }
  if (model.inHand !== null || (event.type === 'tool' && hasWeaponModel(event.weapon))) model.handle(event, tool)
  else box.handle(event, tool)
}

/**
 * The presentation of the tool in the hands. The weapons the gallery drew (`MODEL_ENTRIES`) get their model and the clips the rule's events call for
 * (fire, cycle, jam, clear, safety, the seven reloads); the generic archetypes keep their low-poly prop.
 * With a tool in each hand (`HostTool.offHand`, events with `hand: 'L'`) the left hand gets presentations of its own.
 */
export function createWeaponFx(options: WeaponFxOptions): WeaponFx {
  const layers = options.layers ?? createLayers()
  // the left hand's weapon, with a weapon in each hand: made the first time the left hand takes one, and kept (put away) for the next
  let left: HandFx | null = null
  const leftOptions = (): WeaponFxOptions => {
    const own: WeaponFxOptions = { ...options, tool: () => options.tool?.().offHand ?? options.tool?.() ?? EMPTY_HAND }
    // the right hand's presentation sets the lens of the view, and the left one is drawn through it; neither goes to the eye
    delete own.viewmodelFov
    delete own.aim
    if (options.leftBodyHold) own.bodyHold = options.leftBodyHold
    else delete own.bodyHold
    return own
  }
  const leftHeld = (): boolean => (left?.model.inHand ?? left?.box.inHand ?? null) !== null
  const right = createHandFx(options, layers, 'R', leftHeld)
  const { box, model } = right
  const putAwayLeft = (): void => {
    left?.box.unequip()
    left?.model.unequip()
  }
  return {
    handle(event, tool) {
      if (event.type === 'explosion' || event.type === 'player' || event.type === 'footfall') return
      if (event.hand !== 'L') {
        handleHand(right, event, tool)
        return
      }
      if (event.type === 'tool' && (event.weapon === '' || !tool.offHand)) {
        putAwayLeft()
        return
      }
      left ??= createHandFx(leftOptions(), layers, 'L')
      handleHand(left, event, tool.offHand ?? tool)
    },
    update(dt) {
      box.update(dt)
      model.update(dt)
      left?.box.update(dt)
      left?.model.update(dt)
    },
    setCondition: (condition) => {
      model.setCondition(condition)
      left?.model.setCondition(condition)
    },
    handTargets: () => {
      const own = model.handTargets() ?? box.handTargets()
      if (!left || !leftHeld()) return own
      const other = left.model.handTargets() ?? left.box.handTargets()
      if (!own) return other
      if (!other) return own
      return { ...own, L: other.L ?? null, ...(other.gripL === undefined ? {} : { gripL: other.gripL }) }
    },
    muzzle: (hand) => {
      const pair = hand === 'L' ? left : right
      if (!pair) return null
      return pair.model.inHand !== null ? pair.model.muzzle() : pair.box.muzzle()
    },
    layers,
    get inHand() {
      return model.inHand ?? box.inHand
    },
    get inLeftHand() {
      return left ? (left.model.inHand ?? left.box.inHand) : null
    },
    get clips() {
      return model.clips
    },
    get casings() {
      return box.casings + model.casings + (left ? left.box.casings + left.model.casings : 0)
    },
    get magazines() {
      return box.magazines + model.magazines + (left ? left.box.magazines + left.model.magazines : 0)
    },
    dispose() {
      box.dispose()
      model.dispose()
      left?.box.dispose()
      left?.model.dispose()
      left = null
    },
  }
}
