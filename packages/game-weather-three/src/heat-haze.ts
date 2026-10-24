import type * as THREE_NS from 'three'
import type { WeatherSample } from '@adatechnology/game-weather'
import type { ThreeLib } from './types'

/** Peak opacity of the shimmer at full haze, and how fast the bands rise (SDK-made: no team delivered heat haze, see the open question). */
export const HEAT_HAZE = { opacity: 0.09, bands: 38, rise: 1.4, color: [1, 0.93, 0.82] } as const

export const HEAT_HAZE_VERTEX = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }'
export const HEAT_HAZE_FRAGMENT =
  'uniform float uTime; uniform float uHaze; uniform vec3 uColor; varying vec2 vUv; void main(){ float low = 1. - smoothstep(0.15, 0.7, vUv.y); float wave = sin(vUv.y*38. - uTime*1.4 + sin(vUv.x*11. + uTime*.7)*2.2) * .5 + .5; gl_FragColor = vec4(uColor, uHaze*low*wave*.09); }'

export type HeatHaze = {
  readonly object: THREE_NS.Mesh
  update(sample: WeatherSample, time: number): void
  dispose(): void
}

/**
 * The heat shimmer of `extreme_heat` (`WeatherSample.haze`, 0..1): a screen-space layer of warm bands that rise over the lower half of the view. It is a layer, not a
 * distortion of the picture, because bending the picture needs a render target that only the host owns.
 */
export function createHeatHaze(THREE: ThreeLib): HeatHaze {
  const uniforms = { uTime: { value: 0 }, uHaze: { value: 0 }, uColor: { value: new THREE.Vector3(...HEAT_HAZE.color) } }
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: HEAT_HAZE_VERTEX, fragmentShader: HEAT_HAZE_FRAGMENT, transparent: true, depthTest: false, depthWrite: false })
  const object = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  object.frustumCulled = false
  object.renderOrder = 999
  object.name = 'weather-heat-haze'
  object.visible = false
  return {
    object,
    update(sample, time) {
      uniforms.uHaze.value = sample.haze
      uniforms.uTime.value = time
      object.visible = sample.haze > 0
    },
    dispose() {
      object.geometry.dispose()
      material.dispose()
    },
  }
}
