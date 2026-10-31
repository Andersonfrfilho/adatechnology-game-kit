import type { HandTargets, HostEvent, HostTool } from '@adatechnology/game-contracts'
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
  /** What is drawn (casings, magazines, muzzle flash): change a field and the next event follows it. */
  readonly layers: FxLayers
  /** Weapon shown in the hands, or null. */
  readonly inHand: string | null
  /** The clips of the model playing now with the seconds each lasts (scaled to the rule's duration): which reload variant went (`reload` or `reload_empty`...). */
  readonly clips: ReadonlyArray<{ name: string; seconds: number }>
  /** Casings and magazines currently on the floor or in the air. */
  readonly casings: number
  readonly magazines: number
  dispose(): void
}

/**
 * The presentation of the tool in the hands. The weapons the gallery drew (`MODEL_ENTRIES`) get their model and the clips the rule's events call for
 * (fire, cycle, jam, clear, safety, the seven reloads); the generic archetypes keep their low-poly prop.
 */
export function createWeaponFx(options: WeaponFxOptions): WeaponFx {
  const layers = options.layers ?? createLayers()
  const box = createBoxFx({ ...options, layers })
  const model = createViewmodel({
    layers,
    ...(options.soundDistance ? { soundDistance: options.soundDistance } : {}),
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
    ...(options.effects ? { effects: options.effects } : {}),
    ...(options.flyRocket === undefined ? {} : { flyRocket: options.flyRocket }),
  })
  return {
    handle(event, tool) {
      if (event.type === 'explosion' || event.type === 'player') return
      if (event.type === 'tool') {
        if (hasWeaponModel(event.weapon)) box.unequip()
        else model.unequip()
      }
      if (model.inHand !== null || (event.type === 'tool' && hasWeaponModel(event.weapon))) model.handle(event, tool)
      else box.handle(event, tool)
    },
    update(dt) {
      box.update(dt)
      model.update(dt)
    },
    setCondition: (condition) => model.setCondition(condition),
    handTargets: () => model.handTargets() ?? box.handTargets(),
    layers,
    get inHand() {
      return model.inHand ?? box.inHand
    },
    get clips() {
      return model.clips
    },
    get casings() {
      return box.casings + model.casings
    },
    get magazines() {
      return box.magazines + model.magazines
    },
    dispose() {
      box.dispose()
      model.dispose()
    },
  }
}
