import type * as THREE_NS from 'three'
import { createToolClipPlayer, toolAnimationStep } from '@adatechnology/game-contracts'
import type { AnimationPose, EffectSink, HandTargets, HostEvent, HostTool, HostToolAttachment, ToolAnimationStep, ToolClipPlayer } from '@adatechnology/game-contracts'
import { createRng, muzzleEnergy } from '@adatechnology/game-weapons'
import type { Arsenal, CaliberDef, FittedAttachment, MountKind, WeaponDef } from '@adatechnology/game-weapons'
import { ease } from '../animation/clip-builder'
import { buildToolClips } from '../animation/clip-set'
import type { WeaponAudio } from '../audio'
import { weaponEventOf } from '../audio/host-events'
import { buildWeaponModelById } from '../models'
import { fitAttachmentModels } from '../models/attachments/fit'
import type { AttachmentModelRegistry, LaserRaycast } from '../models/attachments/types'
import { rigUnderbarrel } from '../models/attachments/rig-underbarrel'
import { rigStock } from '../models/rig-stock'
import { attachmentsKey } from '../attachments-key'
import { VIEWMODEL_NODE_NAME } from '../laser-raycast'
import { applyCondition } from '../models/condition'
import { cartridgeShape } from '../models/cartridge'
import { modelKit } from '../models/kit'
import { createVfxRenderer } from '@adatechnology/game-vfx-three'
import type { VfxRenderer } from '@adatechnology/game-vfx-three'
import { createEffects } from './effects'
import { createLayers } from './layers'
import type { FxLayers } from './layers'
import { flameJet, launchRocket } from './heavy'
import type { HeavyContext } from './heavy'
import { createParticles } from './particles'
import { createModelRig } from './rig'
import type { FxWorld, Session } from './session'
import { toWorld, worldPositionOf } from './session'
import { createClipEventHandler } from './viewmodel-events'
import { HAND_HOLD, holdOfModel, targetsOf } from './hand-hold'
import type { Hold } from './hand-hold'

const PI = Math.PI
// where the weapon sits against the camera: right, down and ahead; long guns are drawn smaller so they do not fill the view
const HAND_OFFSET: [number, number, number] = [0.2, -0.2, -0.42]
/** A handgun is held in both hands, so it rides higher and nearer the middle than a long gun: both hands stay in the view. */
const HANDGUN_OFFSET: [number, number, number] = [0.1, -0.12, -0.44]
const HEAT_DISPLAY_MAX_FALLBACK = 120
// the launcher has no calibre: its shot is the game's `explosao` class, at the volume of a mid-sized blast
const LAUNCH_VOLUME = 0.6

export interface ViewmodelOptions {
  THREE: typeof THREE_NS
  scene: THREE_NS.Scene
  camera: THREE_NS.Camera
  arsenal: Arsenal
  groundAt: (x: number, z: number) => number
  audio: WeaponAudio | null
  /** Seed of the scatter of casings, smoke and sparks. */
  seed?: number
  /** The tool as it is now, for what no event announces: the barrel heat and the fuel burning. */
  tool?: () => HostTool
  /** Wear of the weapon (`new`, `used`, `worn`, `rusty`). */
  condition?: string
  /** What is drawn: read at the moment of each event, so the bench can change it live. */
  layers?: FxLayers
  /** Metres between the shooter and the listener, for the distance muffling of the shot sound (default 0). */
  soundDistance?: () => number
  /** Builders of accessory models that replace or add to the ones the kit ships. */
  attachmentModels?: AttachmentModelRegistry
  /** How far a laser beam goes (metres) from a point along a direction, or null when it hits nothing. */
  raycast?: LaserRaycast
  /** The host's effects (`host.effects`): the muzzle flash, the smoke, the backblast and the flame jet are recipes it plays. Without it the viewmodel makes a world of its own for them. */
  effects?: EffectSink
  /** The rocket of a launcher flies out along the barrel (default true); false leaves the round to the host. */
  flyRocket?: boolean
}

/** The weapon in the hands for the models the gallery drew: it follows the camera, plays the clips of the rule's events, and throws casings, magazines and smoke. */
export interface Viewmodel {
  /** Puts the weapon in the hands; false (and the hands stay as they were) when the gallery has no model for it. */
  equip(weapon: string): boolean
  /** Takes the weapon out of the hands. */
  unequip(): void
  handle(event: HostEvent, tool: HostTool): void
  update(dt: number): void
  setCondition(condition: string): void
  /** Where the hands take the weapon now (world space), or null with nothing in the hands. The right hand sits on the grip, the left on the forend, and goes to the magazine while it is changed. */
  handTargets(): HandTargets | null
  readonly inHand: string | null
  readonly casings: number
  readonly magazines: number
  dispose(): void
}

interface Task {
  delay: number
  seconds: number
  elapsed: number
  step: (progress: number, dt: number) => void
  done: (() => void) | undefined
}

const fittedOf = (parts: readonly HostToolAttachment[]): FittedAttachment[] =>
  parts.map((part) => ({ id: part.id, mount: part.mount as MountKind, ...(part.integral ? { integral: true } : {}), ...(part.on === undefined ? {} : { on: part.on }) }))

/** The pose the stock pivot holds when the stock is collapsed: a half turn about its axis, or the slide along the weapon. */
const collapsedStockPose = (move: NonNullable<Session['model']['parts']['stockMove']>): AnimationPose => {
  if (move.kind === 'retract') return { position: [move.travel, 0, 0] }
  return { rotation: [move.axis === 'x' ? PI : 0, move.axis === 'y' ? PI : 0, move.axis === 'z' ? PI : 0] }
}

// the shot of the launcher under the barrel and its reload have clips of their own; the rest of the weapon's clips play as they are
const underbarrelStep = (step: ToolAnimationStep, tool: HostTool): ToolAnimationStep => (tool.underbarrelActive && step.type === 'play' && (step.clip === 'shot' || step.clip === 'reload') ? { ...step, variant: 'ugl' } : step)

const caliberOf = (arsenal: Arsenal, def: WeaponDef): CaliberDef | undefined => (def.action.kind === 'firearm' ? arsenal.calibers.get(def.action.caliber) : undefined)

export function createViewmodel(options: ViewmodelOptions): Viewmodel {
  const { THREE, scene, camera, arsenal, groundAt, audio } = options
  const kit = modelKit(THREE)
  const random = createRng(options.seed ?? 1)
  const layers = options.layers ?? createLayers()
  const distance = (): number => options.soundDistance?.() ?? 0
  const particles = createParticles(THREE, scene, groundAt)
  particles.onBounce = (kind) => (kind === 'casing' ? audio?.clink() : kind === 'magazine' ? audio?.thud() : undefined)
  // a host that lends no effect sink gets a world of its own for the flash and the smoke, stepped and drawn here (as `destruction-three` does)
  const ownVfx: VfxRenderer | undefined = options.effects ? undefined : createVfxRenderer(THREE, { scene, camera, vfx: { profile: 'medium' } })
  const effects = createEffects(THREE, options.effects ?? ownVfx, random)
  const hand = new THREE.Group()
  hand.name = VIEWMODEL_NODE_NAME
  scene.add(hand)
  const holder = new THREE.Group()
  holder.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), PI / 2)
  hand.add(holder)
  let tasks: Task[] = []
  let session: Session | null = null
  let player: ToolClipPlayer | null = null
  let condition = options.condition ?? 'new'
  let lastAmmo = 0
  let smokeDebt = 0
  let secondsSinceShot = Number.POSITIVE_INFINITY
  let hold: Hold | null = null
  let reloading = false
  let magazineHand = 0
  const rootQuaternion = new THREE.Quaternion()

  const world: FxWorld = {
    kit,
    scene,
    particles,
    effects,
    random,
    audio,
    layers,
    groundAt,
    schedule: (delay, seconds, step, done) => void tasks.push({ delay, seconds, elapsed: 0, step: (progress) => step(ease(progress)), done }),
  }

  const heatMax = arsenal.rules.heat.displayMax || HEAT_DISPLAY_MAX_FALLBACK
  const visual = arsenal.rules.heat.visual
  const hasSuppressor = (parts: readonly FittedAttachment[]): boolean => parts.some((part) => arsenal.attachments.get(part.id)?.kind === 'suppressor')

  const release = (): void => {
    if (!session) return
    session.attachments?.dispose()
    session.model.root.removeFromParent()
    player = null
    session = null
    tasks = []
    hold = null
  }

  const heavy = (current: Session): HeavyContext => ({
    kit,
    scene,
    particles,
    effects,
    random,
    parts: current.model.parts,
    forward: () => toWorld(current, new THREE.Vector3(1, 0, 0)).normalize(),
    positionOf: (part) => worldPositionOf(current, part, new THREE.Vector3()),
    orientation: () => current.model.root.getWorldQuaternion(new THREE.Quaternion()),
    every: (seconds, step, done) => void tasks.push({ delay: 0, seconds, elapsed: 0, step, done }),
    groundAt,
  })

  const equip = (weapon: string): boolean => {
    const def = arsenal.weapons.get(weapon)
    const model = def ? buildWeaponModelById(THREE, weapon) : undefined
    if (!def || !model) return false
    release()
    hold = null
    reloading = false
    magazineHand = 0
    rigStock(THREE, model, def)
    rigUnderbarrel(THREE, model, def)
    const length = new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3()).x
    const scale = length > 0.8 ? 0.55 : length > 0.4 ? 0.75 : 1
    holder.scale.setScalar(scale)
    holder.position.set(0, 0, Math.min(0.25, 0.25 * length * scale))
    holder.add(model.root)
    const caliber = caliberOf(arsenal, def)
    const dims = caliber?.cartridge
    const hostTool = options.tool?.()
    const onTool = hostTool?.weapon === weapon ? hostTool : undefined
    const fitted = onTool?.attachments ? fittedOf(onTool.attachments) : [...(def.fitted ?? [])]
    session = {
      id: weapon,
      def,
      caliber,
      model,
      holderScale: scale,
      lengthMetres: length,
      caseType: caliber?.caseType ?? 'rifle',
      kit,
      cartridge: caliber && dims ? { dims, shape: cartridgeShape(caliber, dims) } : null,
      stuckCase: null,
      nextChamber: 0,
      attachments: null,
      attachmentsSignature: '',
      suppressed: onTool?.suppressed ?? hasSuppressor(fitted),
    }
    session.attachments = fitAttachmentModels(model, fitted, kit, { catalogue: arsenal.attachments, isDrawn: () => layers.attachments, areBeamsOn: () => layers.beams, ...(options.attachmentModels ? { overrides: options.attachmentModels } : {}), ...(options.raycast ? { raycast: options.raycast } : {}) })
    session.attachmentsSignature = attachmentsKey(onTool?.attachments)
    const action = def.action
    const reloadFamily = action.kind === 'firearm' || action.kind === 'flame' || action.kind === 'launcher' ? action.family : undefined
    const rpm = action.kind === 'firearm' ? action.rpm : 0
    const rig = createModelRig(model)
    player = createToolClipPlayer({
      clips: buildToolClips({ parts: model.parts, family: model.parts.family, caseType: session.caseType, reloadFamily }),
      rig,
      onEvent: createClipEventHandler(world, session),
      repeatInterval: () => (rpm > 0 ? 60 / rpm : 0.1),
    })
    if (model.parts.stockMove && onTool?.stock === 'collapsed') rig.setPartPose('stock', collapsedStockPose(model.parts.stockMove))
    applyCondition(kit, model, condition)
    lastAmmo = options.tool?.().ammo ?? 0
    hand.updateMatrixWorld(true)
    hold = holdOfModel(THREE, model, scale)
    return true
  }

  const syncAttachments = (current: Session, tool: HostTool | undefined): void => {
    if (!current.attachments || tool?.weapon !== current.id) return
    if (tool.suppressed !== undefined) current.suppressed = tool.suppressed
    if (!tool.attachments) return
    const signature = attachmentsKey(tool.attachments)
    if (signature === current.attachmentsSignature) return
    current.attachmentsSignature = signature
    const fitted = fittedOf(tool.attachments)
    if (tool.suppressed === undefined) current.suppressed = hasSuppressor(fitted)
    current.attachments.sync(fitted)
  }

  const place = (): void => {
    const family = session?.model.parts.family
    const [x, y, z] = family === 'pistol' || family === 'revolver' ? HANDGUN_OFFSET : HAND_OFFSET
    hand.position.set(x, y, z).applyQuaternion(camera.quaternion).add(camera.position)
    hand.quaternion.copy(camera.quaternion)
    hand.updateMatrixWorld(true)
  }

  const glow = (tool: HostTool | undefined): void => {
    if (!session) return
    const heat = (tool?.heat ?? 0) * heatMax
    const level = Math.max(0, Math.min(1, (heat - visual.glowFrom) / visual.glowSpan))
    for (const mesh of session.model.parts.glow) {
      const material = mesh.material as THREE_NS.MeshStandardMaterial
      material.emissive.setRGB(level, 0.2 * level * level, 0.02 * level * level)
      material.emissiveIntensity = 2.2 * level
    }
  }

  const handleShot = (current: Session, event: Extract<HostEvent, { type: 'shot' }>, tool: HostTool): void => {
    secondsSinceShot = 0
    if (event.suppressed !== undefined) current.suppressed = event.suppressed
    else if (tool.suppressed !== undefined) current.suppressed = tool.suppressed
    else current.suppressed = hasSuppressor(tool.attachments ? fittedOf(tool.attachments) : (current.def.fitted ?? []))
    if (tool.underbarrelActive && current.model.parts.uglMuzzle) {
      audio?.play('explosion', LAUNCH_VOLUME, distance())
      return
    }
    const action = current.def.action
    if (action.kind === 'launcher') {
      launchRocket(heavy(current), options.flyRocket !== false)
      audio?.play('explosion', LAUNCH_VOLUME, distance())
    }
    if (action.kind !== 'firearm') return
    const caliber = caliberOf(arsenal, current.def)
    if (!caliber) return
    audio?.shot(muzzleEnergy(caliber) * (caliber.pellets ?? 1), current.def.category, { caliber, distance: distance(), ...(current.suppressed ? { suppressed: true } : {}) })
  }

  return {
    equip,
    unequip: release,
    handle(event, tool) {
      if (event.type === 'explosion' || event.type === 'player') return
      if (event.type === 'tool') equip(event.weapon)
      if (!session || !player || event.weapon !== session.id) return
      const current = session
      if (event.type === 'shot') handleShot(current, event, tool)
      else if (event.type === 'reload' && event.phase === 'start') {
        current.nextChamber = 0
        reloading = true
      } else if (event.type === 'reload' && event.phase === 'end') reloading = false
      else if (event.type === 'clear' && event.phase === 'end') current.stuckCase = null
      const mechanical = weaponEventOf(event)
      if (mechanical) audio?.event(mechanical)
      const step = toolAnimationStep(event)
      if (!step) return
      const last = step.type === 'play' && step.clip === 'shot' && current.model.parts.family === 'pistol' && tool.ammo === 0
      player.apply(last ? { ...step, variant: 'last' } : underbarrelStep(step, tool))
    },
    update(dt) {
      if (session) {
        place()
        player?.update(dt)
        const wantsMagazine = reloading || options.tool?.().reloading === true
        magazineHand += ((wantsMagazine ? 1 : 0) - magazineHand) * Math.min(1, dt * HAND_HOLD.magRate)
        const tool = options.tool?.()
        syncAttachments(session, tool)
        session.attachments?.update()
        glow(tool)
        if (tool && session.def.action.kind === 'flame') {
          if (tool.ammo < lastAmmo) flameJet(heavy(session), dt, session.model.parts.launcherType === 'flame' ? 1 : 0.6)
          lastAmmo = tool.ammo
        }
        secondsSinceShot += dt
        if (tool && tool.heat !== undefined && tool.heat * heatMax > visual.smokeFrom && secondsSinceShot < visual.smokeSeconds && session.model.parts.muzzle) {
          smokeDebt += dt * (tool.heat * heatMax - visual.smokeFrom) * 0.1
          while (smokeDebt > 1) {
            smokeDebt -= 1
            const k = 0.5 + (tool.heat * heatMax - visual.smokeFrom) / 60
            effects.smoke(worldPositionOf(session, session.model.parts.muzzle, new THREE.Vector3()), new THREE.Vector3((random() - 0.5) * 0.015, 0.07 + random() * 0.08, (random() - 0.5) * 0.015), 0.004 * k, 1.2 + random() * 0.6, Math.min(0.18, 0.06 + k * 0.04))
          }
        }
      }
      for (const task of [...tasks]) {
        task.elapsed += dt
        if (task.elapsed < task.delay) continue
        const progress = task.seconds > 0 ? Math.min(1, (task.elapsed - task.delay) / task.seconds) : 1
        task.step(progress, dt)
        if (progress >= 1) {
          task.done?.()
          tasks = tasks.filter((other) => other !== task)
        }
      }
      particles.update(dt)
      ownVfx?.update(dt)
    },
    setCondition(next) {
      condition = next
      if (session) applyCondition(kit, session.model, condition)
    },
    handTargets() {
      if (!session || !hold) return null
      hand.updateMatrixWorld(true)
      return targetsOf(THREE, hold, session.model.root.getWorldQuaternion(rootQuaternion), magazineHand)
    },
    get inHand() {
      return session?.id ?? null
    },
    get casings() {
      return particles.count('casing')
    },
    get magazines() {
      return particles.count('magazine')
    },
    dispose() {
      release()
      particles.dispose()
      ownVfx?.dispose()
      hand.removeFromParent()
    },
  }
}
