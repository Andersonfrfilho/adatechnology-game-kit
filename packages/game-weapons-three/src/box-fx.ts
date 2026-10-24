import type * as THREE_NS from 'three'
import type { EffectSink, HostEvent, HostTool } from '@adatechnology/game-contracts'
import { createRng, muzzleEnergy } from '@adatechnology/game-weapons'
import type { Arsenal, WeaponDef } from '@adatechnology/game-weapons'
import type { WeaponAudio } from './audio'
import { createLayers } from './fx/layers'
import type { FxLayers } from './fx/layers'
import type { AttachmentModelRegistry, LaserRaycast } from './models/attachments/types'
import { IN_HAND_NODE_NAME } from './laser-raycast'
import { BODY_ACTIONS, buildWeaponModel } from './props'

export interface WeaponFxOptions {
  THREE: typeof THREE_NS
  scene: THREE_NS.Scene
  camera: THREE_NS.Camera
  arsenal: Arsenal
  /** Height things rest on at (x, z): casings and magazines land there. */
  groundAt: (x: number, z: number) => number
  /** Sounds (`createWeaponAudio`); null or absent: silent. */
  audio?: WeaponAudio | null
  /** Seed of the scatter of the effects of the gallery models. */
  seed?: number
  /** The tool as it is now (barrel heat, fuel burning). */
  tool?: () => HostTool
  /** Wear of the weapon: `new`, `used`, `worn` or `rusty`. */
  condition?: string
  /** What is drawn: read at the moment of each event, so the bench can change it live. */
  layers?: FxLayers
  /** Metres between the shooter and the listener, for the distance muffling of the shot sound (default 0). */
  soundDistance?: () => number
  /** Builders of accessory models that replace or add to the ones the kit ships (by the `model` of the accessory). */
  attachmentModels?: AttachmentModelRegistry
  /** How far a laser beam goes from a point along a direction (metres), or null when it hits nothing: the dot lands where it ends. */
  raycast?: LaserRaycast
  /** The host's effects: the muzzle flash, smoke, backblast and flame jet of the gallery models are recipes it plays; without it the viewmodel makes a world of its own for them. */
  effects?: EffectSink
}

/** The weapon in the hands, its fire and reload motion, ejected casings and dropped magazines, and their sounds. */
export interface BoxFx {
  /** Feed every tool event of the host, with the tool as it is after the event. */
  handle(event: HostEvent, tool: HostTool): void
  update(dt: number): void
  /** Takes the weapon out of the hands. */
  unequip(): void
  /** Weapon shown in the hands, or null. */
  readonly inHand: string | null
  /** Casings and magazines currently on the floor or in the air. */
  readonly casings: number
  readonly magazines: number
  dispose(): void
}

/** Weapons that throw the spent case out on every shot. Revolvers keep them in the cylinder; break-actions open on reload. */
const EJECTS_ON_SHOT = new Set(['pistol', 'smg', 'carbine', 'rifle', 'sniper', 'shotgun'])
/** Weapons whose reload drops a magazine. */
const DROPS_MAGAZINE = new Set(['pistol', 'smg', 'carbine', 'rifle', 'sniper'])
/** Manual actions that cycle (pump, bolt) after each shot: the sound of the cycle. */
const CYCLES = new Set(['shotgun_pump_12', 'rifle_bolt_308'])
// a bow, a crossbow or a tool has no calibre: about a small handgun round
const FALLBACK_ENERGY = 300
const MAX_CASINGS = 120
const MAX_MAGAZINES = 12
const LIFETIME_S = 25
const HAND_OFFSET: [number, number, number] = [0.2, -0.2, -0.42]
const GRAVITY = 9.81

interface Body {
  mesh: THREE_NS.Mesh
  velocity: THREE_NS.Vector3
  spin: THREE_NS.Vector3
  radius: number
  age: number
  resting: boolean
  bounces: number
  kind: 'casing' | 'magazine'
}

/** The presentation of a weapon the gallery did not draw (the generic archetypes): a low-poly prop in the hands, a dip on reload and a casing per shot. */
export function createBoxFx(options: WeaponFxOptions): BoxFx {
  const { THREE, scene, camera, arsenal, groundAt } = options
  const audio = options.audio ?? null
  const random = createRng(options.seed ?? 1)
  const layers = options.layers ?? createLayers()
  const bodies: Body[] = []
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.8, roughness: 0.35 })
  const shell = new THREE.MeshStandardMaterial({ color: 0xa8322b, roughness: 0.6 })
  const steel = new THREE.MeshStandardMaterial({ color: 0x2f3237, metalness: 0.5, roughness: 0.5 })
  const hand = new THREE.Group()
  hand.name = IN_HAND_NODE_NAME
  scene.add(hand)
  let model: THREE_NS.Object3D | null = null
  let inHand: string | null = null
  let def: WeaponDef | null = null
  let kick = 0
  let dip = 0
  let reloading = false
  const v = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const pointForward = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)

  const equip = (weapon: string): void => {
    if (model) hand.remove(model)
    model = null
    inHand = null
    def = arsenal.weapons.get(weapon) ?? null
    if (!def || BODY_ACTIONS.has(def.id)) return
    model = buildWeaponModel(THREE, def)
    const length = new THREE.Box3().setFromObject(model).getSize(v).x
    // long guns are drawn smaller so they do not fill the view
    model.scale.setScalar(length > 0.8 ? 0.55 : length > 0.4 ? 0.75 : 1)
    model.quaternion.copy(pointForward)
    hand.add(model)
    inHand = def.id
  }

  // a point on the gun in camera space, turned into the world
  const handPoint = (x: number, y: number, z: number, out: THREE_NS.Vector3): THREE_NS.Vector3 =>
    out.set(HAND_OFFSET[0] + x, HAND_OFFSET[1] + y, HAND_OFFSET[2] + z).applyQuaternion(camera.quaternion).add(camera.position)

  const throwBody = (kind: Body['kind'], mesh: THREE_NS.Mesh, from: THREE_NS.Vector3, velocity: THREE_NS.Vector3, radius: number): void => {
    if (!(kind === 'casing' ? layers.casings : layers.magazines)) {
      mesh.geometry.dispose()
      return
    }
    const limit = kind === 'casing' ? MAX_CASINGS : MAX_MAGAZINES
    const same = bodies.filter((b) => b.kind === kind)
    if (same.length >= limit) removeBody(same[0])
    mesh.position.copy(from)
    mesh.castShadow = true
    scene.add(mesh)
    bodies.push({ mesh, velocity, spin: new THREE.Vector3(random() * 20 - 10, random() * 30 - 15, random() * 20 - 10), radius, age: 0, resting: false, bounces: 0, kind })
  }

  const ejectCasing = (caliberMm: number, isShell: boolean, downward: boolean): void => {
    const radius = isShell ? 0.0105 : Math.max(0.003, (caliberMm / 1000) * 0.6)
    const length = isShell ? 0.068 : Math.min(0.07, Math.max(0.015, (caliberMm / 1000) * 2.6))
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 8), isShell ? shell : brass)
    mesh.name = 'casing'
    const from = handPoint(0.03, 0.03, 0.05, new THREE.Vector3())
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    const up = new THREE.Vector3(0, 1, 0)
    const velocity = downward
      ? up.clone().multiplyScalar(-0.5).addScaledVector(right, (random() - 0.5) * 0.4)
      : right.multiplyScalar(1.6 + random() * 0.8).addScaledVector(up, 1.4 + random() * 0.8)
    throwBody('casing', mesh, from, velocity, radius)
  }

  const dropMagazine = (category: string): void => {
    const long = category === 'rifle' || category === 'sniper' || category === 'carbine'
    const size: [number, number, number] = long ? [0.03, 0.17, 0.07] : [0.025, 0.11, 0.035]
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), steel)
    mesh.name = 'magazine'
    const from = handPoint(0, -0.06, 0, new THREE.Vector3())
    throwBody('magazine', mesh, from, new THREE.Vector3(0, -0.4, 0), size[1] / 2)
    audio?.reloadStart(category)
  }

  const caliberOf = (weapon: WeaponDef): number => {
    if (weapon.action.kind !== 'firearm') return 9
    return arsenal.calibers.get(weapon.action.caliber)?.diameter ?? 9
  }

  function removeBody(body: Body): void {
    body.mesh.removeFromParent()
    body.mesh.geometry.dispose()
    bodies.splice(bodies.indexOf(body), 1)
  }

  const onShot = (weapon: WeaponDef): void => {
    kick = 1
    const caliber = weapon.action.kind === 'firearm' ? arsenal.calibers.get(weapon.action.caliber) : undefined
    const energy = caliber ? muzzleEnergy(caliber) * (caliber.pellets ?? 1) : FALLBACK_ENERGY
    audio?.shot(energy, weapon.category, { ...(caliber ? { caliber } : {}), distance: options.soundDistance?.() ?? 0 })
    if (CYCLES.has(weapon.id)) audio?.cycle()
    if (EJECTS_ON_SHOT.has(weapon.category) && weapon.id !== 'shotgun_double_12') ejectCasing(caliberOf(weapon), weapon.category === 'shotgun', false)
  }

  const onReloadStart = (weapon: WeaponDef, tool: HostTool): void => {
    if (DROPS_MAGAZINE.has(weapon.category)) dropMagazine(weapon.category)
    else audio?.reloadStart(weapon.category)
    // revolvers and break-action shotguns dump their spent cases when opened
    if (weapon.category === 'revolver' || weapon.id === 'shotgun_double_12') {
      const spent = Math.max(1, tool.capacity - tool.ammo)
      for (let i = 0; i < spent; i++) ejectCasing(caliberOf(weapon), weapon.category === 'shotgun', true)
    }
  }

  const stepBody = (body: Body, dt: number): void => {
    body.age += dt
    if (body.resting) return
    body.velocity.y -= GRAVITY * dt
    body.mesh.position.addScaledVector(body.velocity, dt)
    body.mesh.rotation.x += body.spin.x * dt
    body.mesh.rotation.y += body.spin.y * dt
    body.mesh.rotation.z += body.spin.z * dt
    const floor = groundAt(body.mesh.position.x, body.mesh.position.z) + body.radius
    if (body.mesh.position.y > floor) return
    body.mesh.position.y = floor
    if (Math.abs(body.velocity.y) > 0.7 && body.bounces < 4) {
      body.bounces++
      body.velocity.y = -body.velocity.y * 0.35
      body.velocity.x *= 0.55
      body.velocity.z *= 0.55
      body.spin.multiplyScalar(0.5)
      if (body.kind === 'casing') audio?.clink()
      else audio?.thud()
      return
    }
    if (body.kind === 'magazine' && body.bounces === 0) audio?.thud()
    body.resting = true
    body.mesh.rotation.x = Math.PI / 2
    body.mesh.rotation.z = 0
  }

  return {
    unequip() {
      if (model) hand.remove(model)
      model = null
      inHand = null
    },
    handle(event, tool) {
      if (event.type === 'explosion' || event.type === 'player') return
      const weapon = arsenal.weapons.get(event.weapon)
      if (event.type === 'tool') equip(event.weapon)
      if (!weapon) return
      if (event.type === 'shot') onShot(weapon)
      else if (event.type === 'empty') audio?.click()
      else if (event.type === 'reload' && event.phase === 'start') onReloadStart(weapon, tool)
      else if (event.type === 'reload' && event.phase === 'end') audio?.reloadEnd(weapon.category)
      reloading = tool.reloading
    },
    update(dt) {
      kick *= Math.exp(-dt * 14)
      dip += ((reloading ? 1 : 0) - dip) * Math.min(1, dt * 8)
      if (inHand) {
        handPoint(0, -0.12 * dip, 0.05 * kick, hand.position)
        q.setFromEuler(new THREE.Euler(0.14 * kick - 0.25 * dip, 0, 0.6 * dip))
        hand.quaternion.copy(camera.quaternion).multiply(q)
      }
      for (const body of [...bodies]) {
        stepBody(body, dt)
        if (body.age > LIFETIME_S) removeBody(body)
      }
    },
    get inHand() {
      return inHand
    },
    get casings() {
      return bodies.filter((b) => b.kind === 'casing').length
    },
    get magazines() {
      return bodies.filter((b) => b.kind === 'magazine').length
    },
    dispose() {
      for (const body of [...bodies]) removeBody(body)
      hand.removeFromParent()
      brass.dispose()
      shell.dispose()
      steel.dispose()
    },
  }
}
