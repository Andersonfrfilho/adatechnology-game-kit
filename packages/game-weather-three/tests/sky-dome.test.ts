import { createWeather } from '@adatechnology/game-weather'
import type { WeatherSample } from '@adatechnology/game-weather'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { kitOriginOf } from '@adatechnology/game-contracts'
import { cloudCoverOf, cloudDarknessOf, createSky, createWeatherRenderer, starVisibilityOf, sunsetOf } from '../src'

const sampleOf = (state: string, startHour = 12): WeatherSample => createWeather({ seed: 3, start: state, startHour, autoSchedule: false }).sample()
const uniformOf = (sky: ReturnType<typeof createSky>, name: string): { value: unknown } => ((sky.object as THREE.Mesh).material as THREE.ShaderMaterial).uniforms[name] as { value: unknown }
const domeOf = (options: { sun?: THREE.DirectionalLight } = {}) => {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 1000)
  const sky = createSky(THREE, scene, { camera, ...options })
  return { scene, camera, sky }
}

describe('sky dome: origin', () => {
  it('is marked as drawn by the kit, so the scene audit tells it from something drawn on the spot', () => {
    expect(kitOriginOf(domeOf().sky.object)).toEqual({ owner: 'game-weather-three', kind: 'effect', id: 'sky-dome' })
  })
})

describe('sky dome: cloud cover', () => {
  it('is scattered when clear, full overcast in rain and in an overcast, and followed by the dome', () => {
    const clear = cloudCoverOf(sampleOf('clear'))
    expect(clear).toBeGreaterThan(0.1)
    expect(clear).toBeLessThan(0.35)
    expect(cloudCoverOf(sampleOf('light_rain'))).toBeGreaterThan(0.9)
    expect(cloudCoverOf(sampleOf('heavy_rain'))).toBe(1)
    expect(cloudCoverOf(sampleOf('overcast'))).toBeGreaterThan(0.85)
    const { sky } = domeOf()
    sky.update(sampleOf('clear'))
    expect(uniformOf(sky, 'uCover').value).toBeCloseTo(clear, 10)
    sky.update(sampleOf('heavy_rain'))
    expect(uniformOf(sky, 'uCover').value).toBe(1)
  })
  it('darkens the clouds from a drizzle to a storm to a typhoon', () => {
    const dark = ['clear', 'light_rain', 'heavy_rain', 'storm', 'typhoon'].map((state) => cloudDarknessOf(sampleOf(state)))
    expect(dark[0]).toBe(0)
    for (let index = 1; index < dark.length; index++) expect(dark[index]).toBeGreaterThan(dark[index - 1] as number)
    const { sky } = domeOf()
    sky.update(sampleOf('clear'))
    const clearTop = (uniformOf(sky, 'uCloudLit').value as THREE.Color).getHex()
    sky.update(sampleOf('storm'))
    const stormTop = uniformOf(sky, 'uCloudLit').value as THREE.Color
    expect(stormTop.r).toBeLessThan(new THREE.Color(clearTop).r * 0.6)
  })
  it('drifts with the wind and holds no allocation: the same uniforms are written in place', () => {
    const { sky } = domeOf()
    const drift = uniformOf(sky, 'uDrift').value as THREE.Vector3
    const windy = sampleOf('windy')
    sky.update(windy, undefined, 1)
    const after = drift.x
    expect(after).toBeGreaterThan(0)
    sky.update(windy, undefined, 1)
    expect(drift.x).toBeGreaterThan(after)
    expect(uniformOf(sky, 'uDrift').value).toBe(drift)
  })
})

describe('sky dome: night', () => {
  it('shows stars on a clear night, none under a full overcast, and the moon', () => {
    const clearNight = sampleOf('clear', 0)
    const rainNight = sampleOf('heavy_rain', 0)
    expect(starVisibilityOf(clearNight)).toBeGreaterThan(0.7)
    expect(starVisibilityOf(rainNight)).toBe(0)
    expect(starVisibilityOf(sampleOf('clear', 12))).toBe(0)
    const { sky } = domeOf()
    sky.update(clearNight)
    expect(uniformOf(sky, 'uStars').value).toBeGreaterThan(0.7)
    expect(uniformOf(sky, 'uMoonVis').value).toBeGreaterThan(0.9)
    expect(uniformOf(sky, 'uSunVis').value).toBe(0)
    sky.update(rainNight)
    expect(uniformOf(sky, 'uStars').value).toBe(0)
  })
})

describe('sky dome: sun and horizon', () => {
  it('puts the sun in the direction of the host sun', () => {
    const sun = new THREE.DirectionalLight(0xffffff, 1)
    sun.position.set(107, 213, 58)
    sun.target.position.set(100, 200, 50)
    const { sky } = domeOf({ sun })
    sky.update(sampleOf('clear'))
    const direction = uniformOf(sky, 'uSunDir').value as THREE.Vector3
    const expected = new THREE.Vector3(7, 13, 8).normalize()
    expect(direction.distanceTo(expected)).toBeLessThan(1e-9)
    expect(direction.length()).toBeCloseTo(1, 10)
    expect(uniformOf(sky, 'uSunVis').value).toBe(1)
  })
  it('without a host sun the sun rises in the east at six, is high at noon and below the horizon at midnight', () => {
    const { sky } = domeOf()
    const at = (hour: number): THREE.Vector3 => {
      sky.update(sampleOf('clear', hour))
      return uniformOf(sky, 'uSunDir').value as THREE.Vector3
    }
    expect(at(12).y).toBeGreaterThan(0.9)
    expect(at(0).y).toBeLessThan(-0.9)
    expect(at(6).x).toBeGreaterThan(0.8)
    expect(at(18).x).toBeLessThan(-0.8)
  })
  it('warms the horizon and the fog colour at sunrise and sunset, not at noon or midnight', () => {
    const { sky } = domeOf()
    expect(sunsetOf(sampleOf('clear', 12))).toBe(0)
    expect(sunsetOf(sampleOf('clear', 0))).toBe(0)
    const dusk = { ...sampleOf('clear', 18), sun: 0.12 }
    expect(sunsetOf(dusk)).toBeGreaterThan(0.5)
    const plain = createSky(THREE, new THREE.Scene()).update(dusk).clone()
    const warm = sky.update(dusk)
    expect(warm.r - warm.b).toBeGreaterThan(plain.r - plain.b)
  })
  it('hands the horizon colour to the fog: the horizon uniform is the colour the update returns', () => {
    const { sky } = domeOf()
    const color = sky.update(sampleOf('storm'), { weight: 0.5 })
    expect(uniformOf(sky, 'uHorizon').value).toEqual(color)
  })
})

describe('sky dome: the object', () => {
  it('follows the camera, renders first without depth, is no ray target and fits inside the far plane', () => {
    const { sky, camera } = domeOf()
    const dome = sky.object as THREE.Mesh
    camera.position.set(30, 2, -12)
    sky.update(sampleOf('clear'))
    expect(dome.position.toArray()).toEqual([30, 2, -12])
    const material = dome.material as THREE.ShaderMaterial
    expect(material.depthTest).toBe(false)
    expect(material.depthWrite).toBe(false)
    expect(dome.renderOrder).toBeLessThan(0)
    expect(dome.scale.x).toBeLessThan(camera.far)
    expect(dome.scale.x).toBeGreaterThan(camera.near * 100)
    expect(new THREE.Raycaster(new THREE.Vector3(30, 2, -12), new THREE.Vector3(0, 1, 0)).intersectObject(dome)).toEqual([])
  })
  it('makes no dome without a camera: the colour only, as before', () => {
    const sky = createSky(THREE, new THREE.Scene())
    expect(sky.object).toBeUndefined()
    expect(() => sky.dispose()).not.toThrow()
  })
  it('is released on dispose: geometry, material and its place in the scene', () => {
    const { sky } = domeOf()
    const dome = sky.object as THREE.Mesh
    const parent = new THREE.Group()
    parent.add(dome)
    let geometryDisposed = 0
    let materialDisposed = 0
    dome.geometry.addEventListener('dispose', () => geometryDisposed++)
    ;(dome.material as THREE.Material).addEventListener('dispose', () => materialDisposed++)
    sky.dispose()
    expect(geometryDisposed).toBe(1)
    expect(materialDisposed).toBe(1)
    expect(dome.parent).toBeNull()
  })
})

describe('sky dome in the weather renderer', () => {
  const build = (state: string, hour: number, layers: { sky?: boolean } = {}) => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 400)
    const weather = createWeather({ seed: 3, start: state, startHour: hour, autoSchedule: false })
    const sun = new THREE.DirectionalLight(0xffffff, 1)
    sun.position.set(7, 13, 8)
    const renderer = createWeatherRenderer(THREE, { scene, camera, weather, sun, random: () => 0.5, layers })
    return { scene, camera, renderer }
  }
  const domeIn = (scene: THREE.Scene): THREE.Mesh | undefined => {
    let found: THREE.Mesh | undefined
    scene.traverse((child) => {
      if (child.name === 'sky-dome') found = child as THREE.Mesh
    })
    return found
  }
  it('adds the dome to the weather group, follows the host sun and goes on dispose', () => {
    const { scene, renderer } = build('clear', 12)
    renderer.update(0.05)
    const dome = domeIn(scene)
    expect(dome).toBeDefined()
    const direction = ((dome?.material as THREE.ShaderMaterial).uniforms.uSunDir as { value: THREE.Vector3 }).value
    expect(direction.distanceTo(new THREE.Vector3(7, 13, 8).normalize())).toBeLessThan(1e-9)
    renderer.dispose()
    expect(domeIn(scene)).toBeUndefined()
  })
  it('hides the dome with the sky layer and shows it again', () => {
    const { scene, renderer } = build('clear', 12)
    renderer.update(0.05)
    renderer.setLayer('sky', false)
    expect(domeIn(scene)?.visible).toBe(false)
    renderer.update(0.05)
    expect(domeIn(scene)?.visible).toBe(false)
    renderer.setLayer('sky', true)
    renderer.update(0.05)
    expect(domeIn(scene)?.visible).toBe(true)
  })
  it('follows the weather: scattered cloud on a clear day, full on rain', () => {
    const clear = build('clear', 12)
    clear.renderer.update(0.05)
    const rain = build('heavy_rain', 12)
    rain.renderer.update(0.05)
    const cover = (scene: THREE.Scene): number => ((domeIn(scene)?.material as THREE.ShaderMaterial).uniforms.uCover as { value: number }).value
    expect(cover(clear.scene)).toBeLessThan(0.4)
    expect(cover(rain.scene)).toBe(1)
  })
})
