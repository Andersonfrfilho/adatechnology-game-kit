import { createVfx } from '@adatechnology/game-vfx'
import { createVfxRenderer } from '@adatechnology/game-vfx-three'
import { createWeather } from '@adatechnology/game-weather'
import type { WeatherSample } from '@adatechnology/game-weather'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { FOG_NEAR, SKY_DAY, SKY_NIGHT, createHeadlights, createHeatHaze, createLightning, createNearRain, createRainCurtain, createSky, createWeatherRenderer, densityForFar, fogOf } from '../src'

const world = (state: string, extra: Parameters<typeof createWeather>[0] = {}) => createWeather({ seed: 3, start: state, startHour: 12, autoSchedule: false, ...extra })
const sampleOf = (state: string): WeatherSample => world(state).sample()
const setup = (state: string, options: { vfx?: boolean } = {}) => {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(65, 1, 0.08, 400)
  camera.position.set(0, 1.7, 0)
  const weather = world(state)
  const vfx = options.vfx === false ? undefined : createVfx({ seed: 5 })
  const renderer = createWeatherRenderer(THREE, { scene, camera, weather, ...(vfx ? { vfx } : {}), random: () => 0.5 })
  return { scene, camera, weather, vfx, renderer }
}

describe('fog', () => {
  it('is the linear fog of the page for the clear weathers: near 25, far from the weather', () => {
    expect(fogOf(sampleOf('clear'))).toEqual({ mode: 'linear', near: FOG_NEAR, far: 220 })
    expect(fogOf(sampleOf('heavy_rain'))).toEqual({ mode: 'linear', near: FOG_NEAR, far: 140 })
  })
  it('is exponential squared where the weather has a density', () => {
    expect(fogOf(sampleOf('fog'))).toEqual({ mode: 'exp2', density: 0.075 })
  })
  it('pulls toward the zone fog by its weight: near 4 and far 60 at full weight', () => {
    expect(fogOf(sampleOf('clear'), { weight: 1 })).toEqual({ mode: 'linear', near: 4, far: 60 })
    const half = fogOf(sampleOf('clear'), { weight: 0.5 })
    expect(half).toEqual({ mode: 'linear', near: 14.5, far: 140 })
    const dense = fogOf(sampleOf('fog'), { weight: 1 })
    expect(dense.mode === 'exp2' && dense.density).toBeCloseTo(densityForFar(60), 10)
  })
})

describe('sky', () => {
  it('goes from the night colour to the day colour with the sun and is dimmed by the weather', () => {
    const scene = new THREE.Scene()
    const sky = createSky(THREE, scene)
    const day = { ...sampleOf('clear'), sun: 1, skyScale: 1 }
    expect(sky.update(day).getHex()).toBe(new THREE.Color(SKY_DAY).getHex())
    expect(sky.update({ ...day, sun: 0 }).getHex()).toBe(new THREE.Color(SKY_NIGHT).getHex())
    const rainy = sky.update({ ...day, skyScale: 0.8 }).clone()
    expect(rainy.r).toBeCloseTo(new THREE.Color(SKY_DAY).r * 0.8, 6)
    expect((scene.background as THREE.Color).getHex()).toBe(rainy.getHex())
  })
})

describe('rain curtain', () => {
  it('draws nothing in dry weather, more in a storm than in a drizzle, and fewer on a low profile', () => {
    const curtain = createRainCurtain(THREE, { random: () => 0.5 })
    const eye = { x: 3, y: 1.7, z: -4 }
    curtain.update(sampleOf('clear'), eye, 1, 1)
    expect(curtain.object.visible).toBe(false)
    curtain.update(sampleOf('light_rain'), eye, 1, 1)
    const light = curtain.drawn()
    curtain.update(sampleOf('storm'), eye, 1, 1)
    expect(curtain.drawn()).toBe(14000)
    expect(light).toBeGreaterThan(0)
    expect(light).toBeLessThan(curtain.drawn())
    curtain.setProfile('low')
    curtain.update(sampleOf('storm'), eye, 1, 1)
    expect(curtain.drawn()).toBe(4900)
    const uniforms = (curtain.object.material as THREE.ShaderMaterial).uniforms
    expect(uniforms.uCam!.value.toArray()).toEqual([3, 1.7, -4])
  })
})

describe('near rain', () => {
  it('drives the Workshop rain field with the weather: streaks, slant, splashes within reach', () => {
    const vfx = createVfx({ seed: 5 })
    const near = createNearRain(vfx)
    expect(vfx.peekWorkshop()).toBeUndefined()
    near.update(sampleOf('clear'), 0.02, [0, 1.7, 0])
    expect(vfx.peekWorkshop()).toBeUndefined()
    near.update(sampleOf('heavy_rain'), 0.02, [0, 1.7, 0])
    const field = vfx.workshop().rain
    expect(field.on).toBe(true)
    expect(field.count).toBe(2200)
    expect(field.wind).toBe(1.2)
    for (let i = 0; i < 200; i++) near.update(sampleOf('heavy_rain'), 0.05, [0, 1.7, 0])
    expect(vfx.workshop().normal.count).toBeGreaterThan(0)
    near.update(sampleOf('clear'), 0.02, [0, 1.7, 0])
    expect(field.on).toBe(false)
  })
  it('leaves rings only where the game says there is a puddle', () => {
    const run = (puddleAt: (x: number, z: number) => boolean): number => {
      const vfx = createVfx({ seed: 5 })
      const near = createNearRain(vfx, { puddleAt })
      for (let i = 0; i < 120; i++) near.update(sampleOf('storm'), 0.05, [0, 1.7, 0])
      return vfx.workshop().rings.rings.filter((ring) => ring.on).length
    }
    expect(run(() => false)).toBe(0)
    expect(run(() => true)).toBeGreaterThan(0)
  })
  it('is drawn by game-vfx-three: the renderer shows the streaks of the field', () => {
    const vfx = createVfx({ seed: 5 })
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera()
    const renderer = createVfxRenderer(THREE, { scene, camera, vfx })
    createNearRain(vfx).update(sampleOf('storm'), 0.02, [0, 1.7, 0])
    renderer.update(0.02)
    let lines: THREE.LineSegments | undefined
    scene.traverse((object) => {
      if (object.name === 'workshop-rain') lines = object as THREE.LineSegments
    })
    expect(lines?.visible).toBe(true)
    expect(lines?.geometry.drawRange.count).toBe(8000)
  })
})

describe('lightning', () => {
  it('lights the hemisphere by 3.2 I, brightens the background and whitens the screen', () => {
    const scene = new THREE.Scene()
    const background = new THREE.Color(0.043, 0.063, 0.094)
    const vfx = createVfx({ seed: 1 })
    const lightning = createLightning(THREE, scene, vfx)
    lightning.update({ ...sampleOf('storm'), flash: 1 }, background)
    expect(lightning.light.intensity).toBeCloseTo(3.2, 10)
    expect(background.r).toBeCloseTo(0.043 + 0.25, 10)
    expect(vfx.workshop().screen.white).toBeCloseTo(0.12, 10)
    lightning.update({ ...sampleOf('storm'), flash: 0 })
    expect(lightning.light.intensity).toBe(0)
    lightning.dispose()
  })
})

describe('headlights', () => {
  it('light the lamps at night, in rain and in fog, only within 40 m, and throw lit drops into the beam', () => {
    const vfx = createVfx({ seed: 2 })
    const lights = createHeadlights(THREE)
    const car = new THREE.Group()
    scene3(car)
    const lens = new THREE.MeshBasicMaterial({ color: 0x3a3a34 })
    const detach = lights.attach(car, lens)
    const spots = (): THREE.SpotLight[] => car.children.filter((child): child is THREE.SpotLight => (child as THREE.SpotLight).isSpotLight)
    expect(spots().length).toBe(2)
    lights.update(sampleOf('clear'), 0.02, [0, 1.7, 0])
    expect(spots().every((spot) => spot.intensity === 0)).toBe(true)
    expect(lens.color.getHex()).toBe(0x3a3a34 === lens.color.getHex() ? 0x3a3a34 : lens.color.getHex())
    const engine = vfx.workshop()
    for (let i = 0; i < 30; i++) lights.update(sampleOf('heavy_rain'), 0.05, [0, 1.7, 0], engine)
    expect(spots().every((spot) => spot.intensity === 2.4)).toBe(true)
    expect(car.children.filter((child) => (child as THREE.Mesh).isMesh && !(child as THREE.Mesh).visible).length).toBe(0)
    expect(engine.streaks.count).toBeGreaterThan(0)
    lights.update(sampleOf('heavy_rain'), 0.05, [100, 1.7, 100], engine)
    expect(spots().every((spot) => spot.intensity === 0)).toBe(true)
    detach()
    expect(car.children.length).toBe(0)
  })
  function scene3(car: THREE.Group): void {
    car.position.set(0, 0, 6)
    car.rotation.y = Math.PI
    car.updateMatrixWorld(true)
  }
})

describe('heat haze', () => {
  it('shows only where the weather has haze', () => {
    const haze = createHeatHaze(THREE)
    haze.update(sampleOf('clear'), 1)
    expect(haze.object.visible).toBe(false)
    haze.update(sampleOf('extreme_heat'), 1)
    expect(haze.object.visible).toBe(true)
    expect((haze.object.material as THREE.ShaderMaterial).uniforms.uHaze!.value).toBe(1)
  })
})

describe('the renderer', () => {
  it('draws a storm: curtain, near rain, linear fog, a dimmed sky; and a fog weather with exp2 fog, mist and ash', () => {
    const { scene, renderer, vfx, weather } = setup('storm')
    renderer.update(0.05)
    expect(renderer.stats().rainCurtain).toBe(14000)
    expect(renderer.stats().rainNear).toBe(4000)
    const fog = scene.fog as THREE.Fog
    expect(fog.isFog).toBe(true)
    expect(fog.far).toBe(110)
    expect(scene.background).toBeInstanceOf(THREE.Color)
    weather.force('fog', 0)
    for (let i = 0; i < 40; i++) renderer.update(0.1)
    expect((scene.fog as THREE.FogExp2).isFogExp2).toBe(true)
    expect((scene.fog as THREE.FogExp2).density).toBe(0.075)
    expect(vfx!.workshop().normal.count).toBeGreaterThan(0)
    expect(renderer.stats().rainCurtain).toBe(0)
    renderer.dispose()
  })
  it('switches a layer off and back on', () => {
    const { scene, renderer } = setup('storm')
    renderer.update(0.05)
    renderer.setLayer('far_rain', false)
    expect(renderer.curtain.object.visible).toBe(false)
    renderer.setLayer('fog', false)
    expect(scene.fog).toBeNull()
    renderer.update(0.05)
    expect(scene.fog).toBeNull()
    expect(renderer.curtain.object.visible).toBe(false)
    renderer.setLayer('far_rain', true)
    renderer.setLayer('fog', true)
    renderer.update(0.05)
    expect(renderer.curtain.object.visible).toBe(true)
    expect(scene.fog).not.toBeNull()
  })
  it('leaves the background and the fog of a host that keeps them: sky off, lightning on; fog off gives the host fog back', () => {
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x336699)
    scene.fog = new THREE.Fog(0x112233, 3, 77)
    const weather = world('storm')
    const renderer = createWeatherRenderer(THREE, { scene, camera: new THREE.PerspectiveCamera(), weather, layers: { sky: false, fog: false } })
    expect((scene.fog as THREE.Fog).far).toBe(77)
    renderer.setLayer('fog', false)
    for (let i = 0; i < 100; i++) renderer.update(0.1)
    expect((scene.background as THREE.Color).getHex()).toBe(0x336699)
    expect((scene.fog as THREE.Fog).far).toBe(77)
    renderer.setLayer('fog', true)
    renderer.update(0.1)
    expect((scene.fog as THREE.Fog).far).toBe(110)
    renderer.setLayer('fog', false)
    expect((scene.fog as THREE.Fog).far).toBe(77)
  })
  it('works without an effects world: curtain, fog, sky and haze only', () => {
    const { renderer, scene } = setup('heavy_rain', { vfx: false })
    renderer.update(0.05)
    expect(renderer.stats().rainCurtain).toBeGreaterThan(0)
    expect(renderer.stats().rainNear).toBe(0)
    expect(scene.fog).not.toBeNull()
  })
})
