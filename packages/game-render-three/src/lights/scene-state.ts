import type { Object3D, Scene } from 'three'

import { NEUTRAL_FOG_NEAR } from '../fog'
import type { FogState, LightCheck, RendererState, SealOptions } from './types'

type Flags = Record<string, unknown>
type Counter = { count: number; shadows: number }

const LIGHT_FLAGS = [
  ['point', 'isPointLight'],
  ['spot', 'isSpotLight'],
  ['hemi', 'isHemisphereLight'],
  ['dir', 'isDirectionalLight'],
  ['ambient', 'isAmbientLight'],
  ['rect', 'isRectAreaLight'],
] as const

/** The visible lights the way the renderer collects them: they decide the shader's light counts. */
export function lightSignature(scene: Object3D): string {
  const counters: Record<string, Counter> = {}
  for (const [name] of LIGHT_FLAGS) counters[name] = { count: 0, shadows: 0 }
  scene.traverseVisible((object) => {
    const flags = object as unknown as Flags
    for (const [name, flag] of LIGHT_FLAGS) {
      if (flags[flag] !== true) continue
      const counter = counters[name] as Counter
      counter.count++
      if ((flags as { castShadow?: boolean }).castShadow === true) counter.shadows++
    }
  })
  return LIGHT_FLAGS.map(([name]) => `${name}:${(counters[name] as Counter).count}/${(counters[name] as Counter).shadows}`).join(' ')
}

export function fogStateOf(scene: Scene): FogState {
  const fog = scene.fog as Flags | null
  if (fog === null) return 'none'
  return fog.isFogExp2 === true ? 'exp2' : 'linear'
}

/** Every PointLight/SpotLight under `scene` that is not under `group`, as a path of child indices. */
export function findStrays(scene: Object3D, group: Object3D): string[] {
  const strays: string[] = []
  const visit = (object: Object3D, path: string): void => {
    if (object === group) return
    const flags = object as unknown as Flags
    if (flags.isPointLight === true || flags.isSpotLight === true) strays.push(`${path}${object.name === '' ? object.type : object.name}`)
    object.children.forEach((child, index) => visit(child, `${path}${index}/`))
  }
  visit(scene, '')
  return strays
}

export type Sealed = {
  readonly lights: string
  readonly environment: string
  readonly toneMapping: number
  readonly outputColorSpace: string
  readonly targetColorSpace: string
  readonly shadowMapType: number
  readonly fogStates: readonly FogState[]
  readonly cameras: SealOptions['cameras']
  readonly target: SealOptions['target']
}

function environmentOf(scene: Scene): string {
  return scene.environment === null ? 'none' : `texture:${scene.environment.mapping}`
}

function targetColorSpaceOf(target: SealOptions['target']): string {
  return target ? target.texture.colorSpace : 'canvas'
}

export function captureSealed(renderer: RendererState, scene: Scene, options: SealOptions): Sealed {
  return {
    lights: lightSignature(scene),
    environment: environmentOf(scene),
    toneMapping: renderer.toneMapping,
    outputColorSpace: renderer.outputColorSpace,
    targetColorSpace: targetColorSpaceOf(options.target),
    shadowMapType: renderer.shadowMap.type,
    fogStates: options.fogStates ?? [fogStateOf(scene)],
    cameras: options.cameras,
    target: options.target,
  }
}

type Described = {
  readonly lights: string
  readonly fog: string
  readonly environment: string
  readonly toneMapping: number
  readonly outputColorSpace: string
  readonly targetColorSpace: string
  readonly shadowMapType: number
}

function describe(state: Described): string {
  const { lights, fog, environment, toneMapping, outputColorSpace, targetColorSpace, shadowMapType } = state
  return `${lights} | fog:${fog} env:${environment} tone:${toneMapping} out:${outputColorSpace}/${targetColorSpace} shadow:${shadowMapType}`
}

function farBeyondNeutralFog(scene: Scene, sealed: Sealed): boolean {
  const fog = scene.fog as { isFog?: boolean; near?: number } | null
  if (fog?.isFog !== true || fog.near !== NEUTRAL_FOG_NEAR) return false
  return (sealed.cameras ?? []).some((camera) => ((camera as unknown as { far?: number }).far ?? 0) >= NEUTRAL_FOG_NEAR)
}

export function checkSealed(sealed: Sealed | null, renderer: RendererState, scene: Scene, group: Object3D): LightCheck {
  const strays = findStrays(scene, group)
  const lights = lightSignature(scene)
  if (sealed === null) return { ok: strays.length === 0, expected: lights, actual: lights, strays }
  const fog = fogStateOf(scene)
  const fogAllowed = sealed.fogStates.includes(fog)
  const expected = describe({ ...sealed, fog: fogAllowed ? fog : sealed.fogStates.join('|') })
  const actual = describe({
    lights,
    fog,
    environment: environmentOf(scene),
    toneMapping: renderer.toneMapping,
    outputColorSpace: renderer.outputColorSpace,
    targetColorSpace: targetColorSpaceOf(sealed.target),
    shadowMapType: renderer.shadowMap.type,
  })
  const ok = strays.length === 0 && expected === actual && !farBeyondNeutralFog(scene, sealed)
  return { ok, expected, actual, strays }
}
