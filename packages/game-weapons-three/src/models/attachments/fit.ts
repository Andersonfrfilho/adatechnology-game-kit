import type * as THREE_NS from 'three'
import type { AttachmentDef, FittedAttachment } from '@adatechnology/game-weapons'
import type { WeaponModel } from '../index'
import type { ModelKit } from '../kit'
import { mountFrame } from './mount-frames'
import { ATTACHMENT_MODELS } from './registry'
import type { AttachmentModel, AttachmentModelRegistry, LaserRaycast } from './types'

export interface FitAttachmentOptions {
  /** The accessories of the game by id: where each gets its `model`, size and light or laser. */
  readonly catalogue: ReadonlyMap<string, AttachmentDef>
  /** Builders that replace or add to the ones the kit ships (see `ATTACHMENT_MODELS`). */
  readonly overrides?: AttachmentModelRegistry
  /** How far the laser beam goes, asked every frame. */
  readonly raycast?: LaserRaycast
  /** Asked every frame: false hides the models of the accessories the rig drew (the bench layer). */
  readonly isDrawn?: () => boolean
  /** Asked every frame: false puts the light and laser out whatever they are set to (the bench layer for the beams). */
  readonly areBeamsOn?: () => boolean
}

/** The accessories drawn on one model: it follows the list of fitted parts. */
export interface AttachmentRig {
  /** Puts the models of what is fitted on the weapon and takes the others off: shows or hides what ships on it, switches the lights and lasers. */
  sync(fitted: readonly FittedAttachment[]): void
  /** Call every frame. */
  update(): void
  /** Ids of the accessories that have a model on the weapon now. */
  readonly drawn: readonly string[]
  dispose(): void
}

interface Drawn {
  readonly model: AttachmentModel
  readonly mount: string
}

const toModel = (made: AttachmentModel | THREE_NS.Object3D): AttachmentModel => ('object' in made ? made : { object: made })

/** The factory flash hider sits where a muzzle device screws on: it is not drawn under one. */
const MUZZLE_DEFAULT = 'muzzle_default'

/**
 * Draws the accessories of `fitted` on the model: the ones the builder drew with the weapon (`parts.fittings`) show or hide with the list, the others are built by the registry
 * (`overrides` over `ATTACHMENT_MODELS`) at the frame of their mount and hang from the wrapper (not from `inner`, whose stretch to the real length would stretch them).
 */
export function fitAttachmentModels(model: WeaponModel, fitted: readonly FittedAttachment[], kit: ModelKit, options: FitAttachmentOptions): AttachmentRig {
  const registry: AttachmentModelRegistry = { ...ATTACHMENT_MODELS, ...options.overrides }
  const { parts, root, inner } = model
  const factoryMagazine = parts.mag ? [...parts.mag.children] : []
  const muzzleRest = parts.muzzle ? parts.muzzle.position.x : 0
  const drawn = new Map<string, Drawn>()
  const hiddenBy = new Map<THREE_NS.Object3D, Set<string>>()
  const switchedOn = new Map<string, boolean>()

  const hide = (id: string, objects: readonly THREE_NS.Object3D[]): void => {
    for (const object of objects) {
      const owners = hiddenBy.get(object) ?? new Set<string>()
      owners.add(id)
      hiddenBy.set(object, owners)
      object.visible = false
    }
  }
  const unhide = (id: string, objects: readonly THREE_NS.Object3D[]): void => {
    for (const object of objects) {
      const owners = hiddenBy.get(object)
      owners?.delete(id)
      if (!owners || owners.size === 0) {
        hiddenBy.delete(object)
        object.visible = true
      }
    }
  }
  const take = (id: string): void => {
    const entry = drawn.get(id)
    if (!entry) return
    drawn.delete(id)
    switchedOn.delete(id)
    entry.model.object.removeFromParent()
    unhide(id, entry.model.hides ?? [])
    if (parts.uglMuzzle && entry.model.muzzle === parts.uglMuzzle) delete parts.uglMuzzle
    entry.model.dispose?.()
  }
  const place = (part: FittedAttachment, attachment: AttachmentDef): void => {
    const builder = registry[attachment.model] ?? registry[attachment.id]
    const frame = mountFrame(model, part.mount as Parameters<typeof mountFrame>[1])
    if (!builder || !frame) return
    const made = builder({ kit, model, attachment, fitted: part, frame, raycast: options.raycast, factoryMagazine, slide: parts.ugl })
    if (!made) return
    const entry = toModel(made)
    const parent = entry.hangsFrom === 'magazine' && parts.mag ? parts.mag : root
    if (parent === root) entry.object.position.set(...frame.position)
    parent.add(entry.object)
    hide(attachment.id, entry.hides ?? [])
    if (entry.muzzle) parts.uglMuzzle = entry.muzzle
    drawn.set(attachment.id, { model: entry, mount: part.mount })
  }

  const shine = (): void => {
    const isDrawn = options.isDrawn?.() ?? true
    const beams = options.areBeamsOn?.() ?? true
    for (const [id, entry] of drawn) {
      entry.model.object.visible = isDrawn
      entry.model.setOn?.(beams && switchedOn.get(id) === true)
    }
  }

  const sync = (list: readonly FittedAttachment[]): void => {
    const wanted = new Map(list.map((part) => [part.id, part]))
    for (const id of [...drawn.keys()]) if (!wanted.has(id) || drawn.get(id)?.mount !== wanted.get(id)?.mount) take(id)
    for (const [id, objects] of Object.entries(parts.fittings ?? {})) {
      if (id === MUZZLE_DEFAULT) continue
      for (const object of objects) object.visible = wanted.has(id)
    }
    for (const object of parts.fittings?.[MUZZLE_DEFAULT] ?? []) object.visible = !list.some((part) => part.mount === 'muzzle')
    for (const part of list) {
      const attachment = options.catalogue.get(part.id)
      if (!attachment || drawn.has(part.id) || parts.fittings?.[part.id]) continue
      if (part.integral === true && attachment.kind === 'optic') continue
      place(part, attachment)
    }
    for (const id of drawn.keys()) switchedOn.set(id, wanted.get(id)?.on === true)
    shine()
    if (parts.muzzle) parts.muzzle.position.x = muzzleRest + [...drawn.values()].reduce((sum, entry) => sum + (entry.model.muzzleOffset ?? 0), 0) / inner.scale.x
  }

  sync(fitted)
  return {
    sync,
    update() {
      shine()
      for (const entry of drawn.values()) entry.model.update?.()
    },
    get drawn() {
      return [...drawn.keys()]
    },
    dispose() {
      for (const id of [...drawn.keys()]) take(id)
    },
  }
}
