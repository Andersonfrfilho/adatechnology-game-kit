import type { Group, Object3D, PointLight, SpotLight } from 'three'

import type { LightKind, LightPatch, LinearRgb, ThreeForLights } from './types'

const PARKED_Y = -50
const DEFAULT_DECAY = 2
const DEFAULT_ANGLE = Math.PI / 3
const POSITION_EPSILON = 1e-6

export type Vec3 = [number, number, number]

export type LightValues = {
  color: number | LinearRgb
  intensity: number
  distance: number
  decay: number
  position: Vec3
  target: Vec3 | undefined
  angle: number
  penumbra: number
}

/** Whoever owns a slot: a request, a source or a lease. */
export interface Holder {
  readonly kind: 'request' | 'source' | 'lease'
  readonly owner: string
  readonly lightKind: LightKind
  priority: number
  urgent: boolean
  values: LightValues
  slot: Slot | null
  alive: boolean
  onLost: (() => void) | undefined
  /** Sources only. */
  follow: Object3D | undefined
  shadow: boolean
  wanted: boolean
  distance: number
  /** Sources only: `values` with the world position and direction of `follow` of this frame. */
  resolved: LightValues
}

export interface Slot {
  readonly index: number
  readonly kind: LightKind
  readonly shadow: boolean
  readonly light: PointLight | SpotLight
  holder: Holder | null
  pending: Holder | null
  leased: boolean
  /** 0..1 multiplier on the holder's intensity. */
  fade: number
  fadeTarget: number
  fadeOutMs: number
  baseIntensity: number
  lastPosition: Vec3
}

export function createValues(base: Partial<LightValues> & Pick<LightValues, 'color' | 'intensity' | 'distance' | 'position'>): LightValues {
  return {
    decay: DEFAULT_DECAY,
    target: undefined,
    angle: DEFAULT_ANGLE,
    penumbra: 0,
    ...base,
    position: [...base.position],
  }
}

export function mergeValues(values: LightValues, patch: LightPatch): void {
  if (patch.color !== undefined) values.color = patch.color
  if (patch.intensity !== undefined) values.intensity = patch.intensity
  if (patch.distance !== undefined) values.distance = patch.distance
  if (patch.decay !== undefined) values.decay = patch.decay
  if (patch.position !== undefined) values.position = [...patch.position]
  if (patch.target !== undefined) values.target = [...patch.target]
  if (patch.angle !== undefined) values.angle = patch.angle
  if (patch.penumbra !== undefined) values.penumbra = patch.penumbra
}

export type ShadowSettings = { readonly bias?: number; readonly normalBias?: number; readonly near?: number }

export function createSlots(THREE: ThreeForLights, group: Group, kind: LightKind, count: number, shadows: number, mapSize: number, settings: ShadowSettings = {}): Slot[] {
  const slots: Slot[] = []
  for (let index = 0; index < count; index++) {
    const light = kind === 'point' ? new THREE.PointLight(0xffffff, 0, 0, DEFAULT_DECAY) : new THREE.SpotLight(0xffffff, 0, 0, DEFAULT_ANGLE, 0, DEFAULT_DECAY)
    light.position.set(0, PARKED_Y, 0)
    light.layers.enableAll()
    const shadow = index < shadows
    if (shadow) {
      light.castShadow = true
      light.shadow.autoUpdate = false
      light.shadow.mapSize.set(mapSize, mapSize)
      if (settings.bias !== undefined) light.shadow.bias = settings.bias
      if (settings.normalBias !== undefined) light.shadow.normalBias = settings.normalBias
      if (settings.near !== undefined) light.shadow.camera.near = settings.near
    }
    group.add(light)
    if ('target' in light) group.add(light.target)
    slots.push({ index, kind, shadow, light, holder: null, pending: null, leased: false, fade: 0, fadeTarget: 0, fadeOutMs: 0, baseIntensity: 0, lastPosition: [0, PARKED_Y, 0] })
  }
  return slots
}

export function isFree(slot: Slot): boolean {
  return !slot.leased && slot.holder === null && slot.pending === null
}

export function applyIntensity(slot: Slot): void {
  slot.light.intensity = slot.baseIntensity * slot.fade
}

export function markShadow(slot: Slot): void {
  if (slot.shadow) slot.light.shadow.needsUpdate = true
}

export function writeLight(THREE: ThreeForLights, slot: Slot, values: LightValues): void {
  const { light } = slot
  if (typeof values.color === 'number') light.color.set(values.color)
  else light.color.setRGB(values.color[0], values.color[1], values.color[2], THREE.LinearSRGBColorSpace)
  light.distance = values.distance
  light.decay = values.decay
  const [x, y, z] = values.position
  light.position.set(x, y, z)
  if ('angle' in light) {
    light.angle = values.angle
    light.penumbra = values.penumbra
    const [tx, ty, tz] = values.target ?? [x, y - 1, z]
    light.target.position.set(tx, ty, tz)
  }
  const last = slot.lastPosition
  if (slot.shadow && (Math.abs(last[0] - x) > POSITION_EPSILON || Math.abs(last[1] - y) > POSITION_EPSILON || Math.abs(last[2] - z) > POSITION_EPSILON)) markShadow(slot)
  slot.lastPosition = [x, y, z]
  slot.baseIntensity = values.intensity
  applyIntensity(slot)
}

/** The holder's writes apply from now on; its light fades in (requests that cut a victim start at full). */
export function install(THREE: ThreeForLights, slot: Slot, holder: Holder, startAtFull: boolean): void {
  slot.holder = holder
  slot.pending = null
  slot.fade = startAtFull ? 1 : 0
  slot.fadeTarget = 1
  holder.slot = slot
  markShadow(slot)
  writeLight(THREE, slot, holder.values)
}

/** Drops the holder: the light keeps its last values and fades to 0 (at once with `fadeOutMs` 0). */
export function vacate(slot: Slot, fadeOutMs: number): void {
  slot.holder = null
  slot.fadeTarget = 0
  slot.fadeOutMs = fadeOutMs
  if (fadeOutMs <= 0) {
    slot.fade = 0
    applyIntensity(slot)
  }
}

export function stepFade(slot: Slot, dtSeconds: number, fadeInMs: number): void {
  if (slot.fade < slot.fadeTarget) {
    slot.fade = fadeInMs <= 0 ? slot.fadeTarget : Math.min(slot.fadeTarget, slot.fade + (dtSeconds * 1000) / fadeInMs)
  } else if (slot.fade > slot.fadeTarget) {
    slot.fade = slot.fadeOutMs <= 0 ? slot.fadeTarget : Math.max(slot.fadeTarget, slot.fade - (dtSeconds * 1000) / slot.fadeOutMs)
  }
  applyIntensity(slot)
}
