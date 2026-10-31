import type { HemisphereLight, Object3D, Scene } from 'three'

import { type ArbiterCore, admitRequest, arbitrateSources, poolOf, stepSlots } from './arbiter'
import { type Sealed, captureSealed, checkSealed } from './scene-state'
import { type Holder, type Slot, type Vec3, createSlots, createValues, isFree, markShadow, mergeValues, vacate, writeLight } from './slots'
import type {
  LightBudget,
  LightBudgetOptions,
  LightHandle,
  LightKind,
  LightLease,
  LightPatch,
  LightRequest,
  LightSource,
  RendererState,
  SourceHandle,
  ThreeForLights,
} from './types'

const DEFAULTS = { point: 16, spot: 4, pointShadows: 2, spotShadows: 0, shadowMapSize: 512, urgentReserve: 2, fadeMs: 120, hysteresis: 0.15, hemisphere: 0 }
const ZERO: Vec3 = [0, 0, 0]
const ALL_LAYERS_MASK = -1

function newHolder(kind: Holder['kind'], lightKind: LightKind, request: LightRequest | LightSource, urgent: boolean): Holder {
  return {
    kind,
    owner: request.owner,
    lightKind,
    priority: request.priority,
    urgent,
    values: createValues({ color: request.color, intensity: request.intensity, distance: request.distance, position: [...request.position], ...optional(request) }),
    slot: null,
    alive: true,
    onLost: undefined,
    follow: undefined,
    shadow: false,
    wanted: true,
    distance: 0,
    resolved: createValues({ color: request.color, intensity: 0, distance: 0, position: ZERO }),
  }
}

function optional(request: LightRequest | LightSource): Partial<Holder['values']> {
  const values: Partial<Holder['values']> = {}
  if (request.decay !== undefined) values.decay = request.decay
  if (request.target !== undefined) values.target = [...request.target]
  if (request.angle !== undefined) values.angle = request.angle
  if (request.penumbra !== undefined) values.penumbra = request.penumbra
  return values
}

function isAttached(object: Object3D, root: Object3D): boolean {
  for (let node: Object3D | null = object; node !== null; node = node.parent) if (node === root) return true
  return false
}

export function createLightBudget(THREE: ThreeForLights, scene: Object3D, options: LightBudgetOptions = {}): LightBudget {
  const opts = { ...DEFAULTS, ...options }
  const pointShadows = Math.min(opts.pointShadows, opts.point)
  const spotShadows = Math.min(opts.spotShadows, opts.spot)
  const group = new THREE.Group()
  group.name = 'light-budget'
  const core: ArbiterCore = {
    THREE,
    slots: {
      point: createSlots(THREE, group, 'point', opts.point, pointShadows, opts.shadowMapSize, options.shadowSettings),
      spot: createSlots(THREE, group, 'spot', opts.spot, spotShadows, opts.shadowMapSize, options.shadowSettings),
    },
    urgentReserve: opts.urgentReserve,
    fadeMs: opts.fadeMs,
    hysteresis: opts.hysteresis,
    preempted: 0,
    refused: 0,
  }
  const hemispheres: HemisphereLight[] = []
  for (let index = 0; index < opts.hemisphere; index++) {
    const light = new THREE.HemisphereLight(0xffffff, 0xffffff, 0)
    light.layers.enableAll()
    group.add(light)
    hemispheres.push(light)
  }
  scene.add(group)
  scene.children.splice(scene.children.indexOf(group), 1)
  scene.children.unshift(group)

  const sources = new Set<Holder>()
  const world = new THREE.Vector3()
  const direction = new THREE.Vector3()
  let sealed: Sealed | null = null
  let leasedHemispheres = 0

  const allSlots = (): Slot[] => [...core.slots.point, ...core.slots.spot]

  function writeHolder(holder: Holder): void {
    if (holder.slot !== null && holder.slot.holder === holder) writeLight(THREE, holder.slot, holder.values)
  }

  function makeHandle(holder: Holder, release: ((fadeMs: number | undefined) => void) | null): LightHandle {
    return {
      get slot() {
        return holder.slot?.index ?? -1
      },
      kind: holder.lightKind,
      get alive() {
        return holder.alive
      },
      update(patch: LightPatch) {
        if (!holder.alive) return
        mergeValues(holder.values, patch)
        writeHolder(holder)
      },
      release(releaseOptions) {
        if (!holder.alive || release === null) return
        holder.alive = false
        release(releaseOptions?.fadeMs)
      },
    }
  }

  function dropHolder(holder: Holder, fadeMs: number): void {
    const slot = holder.slot
    holder.slot = null
    if (slot === null) return
    if (slot.pending === holder) slot.pending = null
    else if (slot.holder === holder) vacate(slot, fadeMs)
  }

  function resolveSource(holder: Holder, focus: readonly [number, number, number]): void {
    const { follow, values, resolved } = holder
    holder.wanted = values.intensity > 0
    if (follow === undefined) {
      holder.distance = Math.hypot(values.position[0] - focus[0], values.position[1] - focus[1], values.position[2] - focus[2])
      Object.assign(resolved, values)
      return
    }
    holder.wanted = holder.wanted && isAttached(follow, scene)
    if (!holder.wanted) return
    follow.getWorldPosition(world)
    const [ox, oy, oz] = values.position
    if (ox !== 0 || oy !== 0 || oz !== 0) world.set(ox, oy, oz).applyMatrix4(follow.matrixWorld)
    const axis = follow.matrixWorld.elements
    direction.set(-(axis[8] as number), -(axis[9] as number), -(axis[10] as number))
    holder.distance = Math.hypot(world.x - focus[0], world.y - focus[1], world.z - focus[2])
    Object.assign(resolved, values)
    resolved.position = [world.x, world.y, world.z]
    resolved.target = values.target ?? [world.x + direction.x, world.y + direction.y, world.z + direction.z]
  }

  return {
    group,
    sizes: { point: opts.point, spot: opts.spot, pointShadows, spotShadows },
    acquire(request) {
      const holder = newHolder('request', request.kind ?? 'point', request, request.urgent === true)
      holder.onLost = request.onLost
      if (!admitRequest(core, holder)) return null
      return makeHandle(holder, (fadeMs) => dropHolder(holder, fadeMs ?? opts.fadeMs))
    },
    addSource(source) {
      const holder = newHolder('source', source.kind ?? 'point', source, false)
      holder.follow = source.follow
      holder.shadow = source.shadow === true
      sources.add(holder)
      return {
        get slot() {
          return holder.slot !== null && holder.slot.holder === holder ? holder.slot.index : -1
        },
        update(patch: Partial<LightSource>) {
          mergeValues(holder.values, patch)
          if (patch.priority !== undefined) holder.priority = patch.priority
          if ('follow' in patch) holder.follow = patch.follow
          if (holder.follow === undefined) writeHolder(holder)
        },
        remove() {
          holder.alive = false
          holder.wanted = false
          sources.delete(holder)
          dropHolder(holder, opts.fadeMs)
        },
      } satisfies SourceHandle
    },
    lease({ owner, point, shadows = 0 }) {
      const shadowSlots = core.slots.point.filter((slot) => slot.shadow && isFree(slot))
      const plainSlots = core.slots.point.filter((slot) => !slot.shadow && isFree(slot))
      if (shadowSlots.length < shadows || plainSlots.length < point - shadows) return null
      const taken = [...shadowSlots.slice(0, shadows), ...plainSlots.slice(0, point - shadows)]
      const holders = taken.map((slot) => {
        const holder = newHolder('lease', 'point', { owner, priority: Number.POSITIVE_INFINITY, color: 0xffffff, intensity: 0, distance: 0, position: ZERO }, false)
        slot.leased = true
        slot.holder = holder
        slot.fade = 1
        slot.fadeTarget = 1
        holder.slot = slot
        markShadow(slot)
        return holder
      })
      const handles = holders.map((holder) => makeHandle(holder, null))
      return {
        handles,
        invalidateShadow(index) {
          for (const [at, holder] of holders.entries()) if ((index === undefined || index === at) && holder.slot !== null) markShadow(holder.slot)
        },
        release() {
          for (const holder of holders) {
            const slot = holder.slot
            holder.alive = false
            holder.slot = null
            if (slot === null) continue
            slot.leased = false
            slot.holder = null
            vacate(slot, 0)
          }
        },
      } satisfies LightLease
    },
    leaseHemisphere() {
      const light = hemispheres[leasedHemispheres]
      if (light === undefined) return null
      leasedHemispheres++
      return light
    },
    present(focus, dtSeconds) {
      for (const holder of sources) resolveSource(holder, focus)
      for (const kind of ['point', 'spot'] as const) {
        const reserve = kind === 'point' ? core.urgentReserve : 0
        const kindSources = [...sources].filter((holder) => holder.lightKind === kind)
        arbitrateSources(core, poolOf(core, kind, true), kindSources.filter((holder) => holder.shadow), 0)
        arbitrateSources(core, poolOf(core, kind, false), kindSources.filter((holder) => !holder.shadow), reserve)
      }
      stepSlots(core, dtSeconds)
      for (const holder of sources) if (holder.wanted && holder.slot?.holder === holder) writeLight(THREE, holder.slot, holder.resolved)
    },
    seal(renderer, scene, sealOptions = {}) {
      sealed = captureSealed(renderer, scene, sealOptions)
    },
    check(renderer: RendererState, checkedScene: Scene) {
      const result = checkSealed(sealed, renderer, checkedScene, group)
      const layersIntact = allSlots().every((slot) => slot.light.visible && slot.light.layers.mask === ALL_LAYERS_MASK)
      return layersIntact ? result : { ...result, ok: false, actual: `${result.actual} | budget lights hidden or off a layer` }
    },
    stats() {
      const slots = allSlots()
      return {
        lit: slots.filter((slot) => slot.light.intensity > 0).length,
        free: slots.filter(isFree).length,
        leased: slots.filter((slot) => slot.leased).length,
        sources: sources.size,
        sourcesWithoutSlot: [...sources].filter((holder) => holder.wanted && holder.slot === null).length,
        preempted: core.preempted,
        refused: core.refused,
      }
    },
    dispose() {
      group.removeFromParent()
      for (const slot of allSlots()) slot.light.dispose()
      sources.clear()
    },
  }
}
