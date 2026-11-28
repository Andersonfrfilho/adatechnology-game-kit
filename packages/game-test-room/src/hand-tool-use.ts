/**
 * What the tools used in the hand do in the room (game-items hand uses `toggle_flashlight`, `light_lighter`, `use_radio`, `turn_key`): at the use's action the flashlight's
 * beam goes on or off from its lens, the lighter's flame catches or goes out over its top, the radio hisses as its knob turns and as one talks, and a key turns the lock of
 * the leaf in reach (or turns in the air). The light and the flame ride the item, so they follow it in the hand, dropped or thrown, until it leaves the world.
 */
import type * as THREE_NS from 'three'
import type { HandUseAction } from '@adatechnology/game-items'
import { LIGHT_PRIORITY } from '@adatechnology/game-render-three'
import type { LightBudget, SourceHandle } from '@adatechnology/game-render-three'

/** What a key turned: the lock of the leaf in reach, locked or unlocked now, or nothing (no leaf in reach). */
export type KeyTurn = 'locked' | 'unlocked' | 'air'

export type HandToolEffectsOptions = {
  readonly THREE: typeof THREE_NS
  /** The room's light budget: the beam and the flame's glow are sources of it (none: they draw no light). */
  readonly lights?: LightBudget | undefined
  /** Plays a sound of the room's library at a world point. */
  readonly sound: (key: string, point: [number, number, number], volume: number) => void
  /** Turns the key in the lock of the leaf in reach, when there is one. */
  readonly turnKey: () => KeyTurn
}

export type HandToolEffects = {
  /** Acts on `action` reached by the use of the item drawn at `root`; answers the room string of what it did (`effect.<...>`), or undefined for an action of another use. */
  act(action: HandUseAction, objectId: string, root: THREE_NS.Object3D): string | undefined
  /** Whether the item lights (a flashlight on, a lighter lit). */
  isLit(objectId: string): boolean
  /** The flame flickers. */
  update(dt: number): void
  /** The item left the world: its light goes with it. */
  forget(objectId: string): void
}

/** The flashlight's beam: a warm white spot lighting some 15 m ahead. */
const BEAM = { color: 0xfff1d0, intensity: 8, distance: 16, angle: 0.36, penumbra: 0.45, decay: 1.6 } as const
/** The lighter's flame: 2.4 cm tall over the top, a little orange light around it. */
const FLAME = { height: 0.024, radius: 0.0055, color: 0xffa43a, light: 0xff9a40, intensity: 0.9, distance: 2.6 } as const

type Lit = { readonly node: THREE_NS.Object3D; readonly flame?: THREE_NS.Mesh; readonly light: SourceHandle | null }
type Make = (THREE: typeof THREE_NS, root: THREE_NS.Object3D, lights: LightBudget | undefined) => Lit

/** A node at the item's top (the lens, the wick: the item models stand along +y) that keeps world size whatever the item's scale. */
const nodeAtTop = (THREE: typeof THREE_NS, root: THREE_NS.Object3D): THREE_NS.Object3D => {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const node = new THREE.Object3D()
  node.position.copy(root.worldToLocal(new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2)))
  const scale = root.getWorldScale(new THREE.Vector3())
  node.scale.set(1 / (scale.x || 1), 1 / (scale.y || 1), 1 / (scale.z || 1))
  root.add(node)
  return node
}

const beamAt: Make = (THREE, root, lights) => {
  const node = nodeAtTop(THREE, root)
  // a spot of the budget shines along its node's -z: turned so that is the item's +y, out of the lens
  node.rotation.x = Math.PI / 2
  const light = lights?.addSource({ owner: 'hand-flashlight', kind: 'spot', priority: LIGHT_PRIORITY.weaponLight, ...BEAM, position: [0, 0, 0], follow: node }) ?? null
  return { node, light }
}

const flameAt: Make = (THREE, root, lights) => {
  const node = nodeAtTop(THREE, root)
  const geometry = new THREE.ConeGeometry(FLAME.radius, FLAME.height, 10)
  geometry.translate(0, FLAME.height / 2, 0)
  const material = new THREE.MeshBasicMaterial({ color: FLAME.color, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })
  const flame = new THREE.Mesh(geometry, material)
  flame.name = 'lighter-flame'
  node.add(flame)
  const light = lights?.addSource({ owner: 'hand-lighter', kind: 'point', priority: LIGHT_PRIORITY.flare, color: FLAME.light, intensity: FLAME.intensity, distance: FLAME.distance, decay: 2, position: [0, FLAME.height * 0.6, 0], follow: node }) ?? null
  return { node, flame, light }
}

export const createHandToolEffects = (options: HandToolEffectsOptions): HandToolEffects => {
  const { THREE } = options
  const lit = new Map<string, Lit>()
  let clock = 0
  const at = (root: THREE_NS.Object3D): [number, number, number] => {
    const p = root.getWorldPosition(new THREE.Vector3())
    return [p.x, p.y, p.z]
  }
  const forget = (objectId: string): void => {
    const was = lit.get(objectId)
    if (!was) return
    lit.delete(objectId)
    was.node.removeFromParent()
    was.flame?.geometry.dispose()
    if (was.flame) (was.flame.material as THREE_NS.Material).dispose()
    was.light?.remove()
  }
  /** Lights the item with `make`, or puts it out when it is lit; answers whether it is lit now. */
  const toggle = (objectId: string, root: THREE_NS.Object3D, make: Make): boolean => {
    if (lit.has(objectId)) {
      forget(objectId)
      return false
    }
    lit.set(objectId, make(THREE, root, options.lights))
    return true
  }
  const act = (action: HandUseAction, objectId: string, root: THREE_NS.Object3D): string | undefined => {
    switch (action) {
      case 'switch':
        options.sound('flashlight_toggle', at(root), 0.6)
        return toggle(objectId, root, beamAt) ? 'effect.light_on' : 'effect.light_off'
      case 'ignite':
        options.sound('button_press', at(root), 0.5)
        return toggle(objectId, root, flameAt) ? 'effect.flame_on' : 'effect.flame_off'
      case 'tune':
        options.sound('button_press', at(root), 0.4)
        return 'effect.radio_tuned'
      case 'talk':
        options.sound('radio_static', at(root), 0.5)
        return 'effect.radio_call'
      case 'turn': {
        const turned = options.turnKey()
        options.sound(turned === 'air' ? 'button_press' : 'lock_desk_open', at(root), 0.6)
        return `effect.key_${turned}`
      }
      default:
        return undefined
    }
  }
  return {
    act,
    isLit: (objectId) => lit.has(objectId),
    update(dt) {
      clock += dt
      for (const { flame, light } of lit.values()) {
        if (!flame) continue
        const flicker = 1 + 0.12 * Math.sin(clock * 31) + 0.07 * Math.sin(clock * 53 + 1.3)
        flame.scale.set(1, flicker, 1)
        light?.update({ intensity: FLAME.intensity * flicker })
      }
    },
    forget,
  }
}
