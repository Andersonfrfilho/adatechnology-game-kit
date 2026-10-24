import { segmentsBelow } from '@adatechnology/game-characters'
import type { SegmentId } from '@adatechnology/game-characters'
import type { DestructionEvent } from '@adatechnology/game-contracts'

import type { Three, THREE_NS } from '../three'

import { createWoundMaterials, makeCut, makeStump, ringWound } from './cut'
import type { WoundMaterials } from './cut'
import { createFlyingPieces } from './flying'
import type { FlyingPieces } from './flying'
import type { FluidsBridge } from './fluids-bridge'
import { explodeChunks, exitWound, gouge, woundDecal } from './marks'
import { createPendulum, stepPendulum } from './pendulum'
import type { Pendulum } from './pendulum'
import type { WoundBody } from './segment-nodes'

export type WoundsOptions = {
  readonly random: () => number
  /** Where the flying pieces land. Default: the parent of the body. */
  readonly scene: THREE_NS.Object3D
  readonly groundAt?: (x: number, z: number) => number
  /** The fluids bridge, when the game has the fluids packages. Without it the wounds draw no blood on the ground. */
  readonly bridge?: FluidsBridge
  readonly materials?: WoundMaterials
  /** Pieces alive at once. Default 40. */
  readonly maxPieces?: number
}

type State = {
  readonly body: WoundBody
  readonly pendulums: Pendulum[]
  readonly limp: [boolean, boolean]
  readonly gone: Set<SegmentId>
  dead: boolean
  crawling: boolean
  /** Walk phase for the pendulum sway while the body walks; undefined when it stands. */
  walkPhase?: number
}

export type Wounds = {
  readonly materials: WoundMaterials
  readonly flying: FlyingPieces
  /** Starts watching a body. Returns the same body for chaining. */
  track(body: WoundBody): WoundBody
  untrack(body: WoundBody): void
  /** Reads an event of the body (a `body`, `hole` or `leak` event of the engine) and draws what it says. Events of other objects are the caller's to filter. */
  handle(body: WoundBody, event: DestructionEvent): void
  /** Sets the walk phase the swinging arms sway to; `undefined` when the body stands. */
  setWalkPhase(body: WoundBody, phase: number | undefined): void
  /** Which segments are gone from the drawn body. */
  goneOf(body: WoundBody): ReadonlySet<SegmentId>
  /** Steps the swinging arms and the flying pieces. Call it after the animation of the frame; `applyLimp` then bends the legs that are hurt. */
  update(dt: number): void
  applyLimp(body: WoundBody): void
  dispose(): void
}

const worldPosition = (three: Three, object: THREE_NS.Object3D): THREE_NS.Vector3 => object.getWorldPosition(new three.Vector3())

/**
 * Wounds of the rich body (`near` level of the damage model): a cut leaves a stump and a piece that flies, a broken bone leaves a ring wound and a
 * swinging arm or a limping leg, a part destroyed bursts into chunks, a torso hit hard splits in two, and a bullet leaves an entry decal and, when it
 * went through, a torn exit. The rule (what is cut, when) is the engine's; this draws the Elenco and Arsenal dynamics for it, with the random stream
 * injected so a scene can be repeated.
 */
export const createWounds = (three: Three, options: WoundsOptions): Wounds => {
  const { random, scene, bridge } = options
  const materials = options.materials ?? createWoundMaterials(three)
  const flying = createFlyingPieces(three, { random, ...(options.groundAt ? { groundAt: options.groundAt } : {}), ...(options.maxPieces ? { max: options.maxPieces } : {}) })
  const states = new Map<WoundBody, State>()

  const stateOf = (body: WoundBody): State => {
    const found = states.get(body)
    if (!found) throw new Error('game-characters-three: this body is not tracked by the wounds (call `track` first)')
    return found
  }

  const burstBlood = (state: State, change: 'severed' | 'destroyed' | 'split', object: THREE_NS.Object3D, direction?: THREE_NS.Vector3): void => {
    const point = worldPosition(three, object)
    bridge?.burst(change, [point.x, point.y, point.z], state.body.blood, direction ? [direction.x, direction.y, direction.z] : undefined)
  }

  const sideOf = (object: THREE_NS.Object3D, body: WoundBody): THREE_NS.Vector3 => new three.Vector3(object.position.x >= 0 ? 1 : -1, 0, 0).applyQuaternion(body.root.quaternion)

  const hideBelow = (state: State, id: SegmentId): void => {
    for (const below of segmentsBelow(id)) state.gone.add(below)
  }

  const sever = (state: State, id: SegmentId): void => {
    const target = state.body.nodes[id]
    if (!target || state.gone.has(id)) {
      state.gone.add(id)
      hideBelow(state, id)
      return
    }
    const { node, radius, flip } = target
    const direction = sideOf(node, state.body)
    const fell = flying.launch(node, scene, direction, (clone) => {
      makeCut(three, materials, random, clone, radius, true)
    }, id)
    void fell
    node.visible = false
    makeStump(three, materials, random, node.parent as THREE_NS.Object3D, node.position, radius, flip)
    state.gone.add(id)
    hideBelow(state, id)
    // the pendulums of arms that are no longer shown stop
    for (let i = state.pendulums.length - 1; i >= 0; i--) {
      const pendulum = state.pendulums[i] as Pendulum
      let shown = true
      for (let o: THREE_NS.Object3D | null = pendulum.node as unknown as THREE_NS.Object3D; o; o = o.parent) if (!o.visible) shown = false
      if (!shown) state.pendulums.splice(i, 1)
    }
    burstBlood(state, 'severed', node, direction)
    if (id === 'head') state.dead = true
  }

  const destroy = (state: State, id: SegmentId, direction: THREE_NS.Vector3): void => {
    const target = state.body.nodes[id]
    if (!target || state.gone.has(id)) return
    const { node, radius, flip } = target
    const box = new three.Box3().setFromObject(node)
    explodeChunks(three, materials, random, box, direction, (chunk, velocity, spin) => {
      scene.add(chunk)
      flying.throwObject(chunk, velocity, spin, id)
    })
    node.visible = false
    makeStump(three, materials, random, node.parent as THREE_NS.Object3D, node.position, radius, flip)
    state.gone.add(id)
    hideBelow(state, id)
    burstBlood(state, 'destroyed', node, direction)
    if (id === 'head') state.dead = true
  }

  const breakBone = (state: State, id: SegmentId): void => {
    const target = state.body.nodes[id]
    if (!target || state.gone.has(id)) return
    if (target.arm) {
      const { index, joint } = target.arm
      const arm = state.body.rig.arms[index]!
      const node = (joint === 'shoulder' ? arm.g : arm.el) as unknown as THREE_NS.Object3D & { rotation: { x: number; z: number } }
      ringWound(three, materials, node, joint === 'shoulder' ? 0.078 : 0.064, joint === 'shoulder' ? -0.06 : -0.01)
      const kept = state.pendulums.filter((pendulum) => pendulum.node !== (node as unknown))
      state.pendulums.length = 0
      state.pendulums.push(...kept, createPendulum(node, joint, (arm as unknown as { s: number }).s ?? 1, joint === 'shoulder' ? arm.el : undefined))
    }
    if (target.leg !== undefined) state.limp[target.leg as 0 | 1] = true
  }

  const split = (state: State, direction: THREE_NS.Vector3): void => {
    const upper = state.body.rig.upper as unknown as THREE_NS.Object3D
    if (!upper.visible) return
    flying.launch(upper, scene, direction, (clone) => {
      makeCut(three, materials, random, clone, 0.16, false)
    }, 'torso')
    upper.visible = false
    makeStump(three, materials, random, upper.parent as THREE_NS.Object3D, upper.position, 0.16)
    for (const id of ['torso', 'neck', 'head', 'jaw', 'upperArmL', 'upperArmR', 'forearmL', 'forearmR', 'handL', 'handR'] as SegmentId[]) state.gone.add(id)
    state.pendulums.length = 0
    state.dead = true
    burstBlood(state, 'split', upper, direction)
  }

  const direction3 = (v: [number, number, number] | undefined, fallback: THREE_NS.Vector3): THREE_NS.Vector3 => (v ? new three.Vector3(v[0], v[1], v[2]).normalize() : fallback)

  return {
    materials,
    flying,
    track(body) {
      states.set(body, { body, pendulums: [], limp: [false, false], gone: new Set(), dead: false, crawling: false })
      return body
    },
    untrack: (body) => void states.delete(body),
    handle(body, event) {
      const state = stateOf(body)
      if (event.type === 'leak') {
        bridge?.handle(event)
        return
      }
      if (event.type === 'hole') {
        const target = body.nodes[event.part as SegmentId]
        const node = target?.node ?? (body.root as THREE_NS.Object3D)
        const point = new three.Vector3(...event.worldPoint)
        const centre = worldPosition(three, node)
        const normal = point.clone().sub(centre).normalize()
        if (normal.lengthSq() < 0.5) normal.set(0, 0, 1)
        woundDecal(three, materials, node, point, normal, 0.014)
        if (event.exitPoint) {
          const exit = new three.Vector3(...event.exitPoint)
          const through = exit.clone().sub(point).normalize()
          exitWound(three, materials, random, node, exit, through, 40)
        }
        return
      }
      if (event.type !== 'body') return
      const id = event.part as SegmentId | undefined
      const fallback = new three.Vector3(0, 0.2, 1)
      const direction = direction3(event.exit, fallback)
      switch (event.change) {
        case 'severed':
          if (id) sever(state, id)
          break
        case 'destroyed':
          if (id) destroy(state, id, direction)
          break
        case 'broken':
          if (id) breakBone(state, id)
          break
        case 'split':
          split(state, direction)
          break
        case 'limp':
          if (id) breakBone(state, id)
          break
        case 'crawl':
          state.crawling = true
          break
        case 'killed':
          state.dead = true
          break
        case 'wound': {
          const target = id ? body.nodes[id] : undefined
          const at = worldPosition(three, target?.node ?? (body.root as THREE_NS.Object3D))
          bridge?.wound([at.x, at.y, at.z], body.blood, event.exit ? [direction.x, direction.y, direction.z] : undefined)
          if (target && event.exit) gouge(three, materials, random, target.node, id!.replace(/[LR]$/, ''), worldPosition(three, target.node), direction.clone().negate(), direction, 60, (chunk, velocity, spin) => {
            scene.add(chunk)
            flying.throwObject(chunk, velocity, spin, id)
          })
          break
        }
        default:
          break
      }
    },
    setWalkPhase(body, phase) {
      const state = stateOf(body)
      if (phase === undefined) delete state.walkPhase
      else state.walkPhase = phase
    },
    goneOf: (body) => stateOf(body).gone,
    update(dt) {
      flying.update(dt)
      for (const state of states.values()) {
        const { rig } = state.body
        for (const pendulum of state.pendulums) {
          const arm = rig.arms.find((candidate) => (candidate.g as unknown) === pendulum.node || (candidate.el as unknown) === pendulum.node)!
          const base = pendulum.kind === 'shoulder' ? rig.upper.rotation.x + rig.fig.rotation.x : arm.g.rotation.x + rig.upper.rotation.x + rig.fig.rotation.x
          stepPendulum(pendulum, base, dt, state.walkPhase)
        }
      }
    },
    applyLimp(body) {
      const state = stateOf(body)
      const bothLost = state.limp[0] && state.limp[1]
      state.limp.forEach((hurt, index) => {
        if (!hurt || bothLost) return
        const leg = body.rig.legs[index]!
        leg.g.rotation.x *= 0.3
        leg.kn.rotation.x = 0.05
        body.rig.upper.rotation.z += index ? -0.07 : 0.07
      })
    },
    dispose() {
      flying.clear()
      materials.dispose()
      states.clear()
    },
  }
}
