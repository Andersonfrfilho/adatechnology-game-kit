import type { BenchChange, ModuleHost } from '@adatechnology/game-contracts'
import { createVfx } from '@adatechnology/game-vfx'
import { createWeatherTestModule } from '@adatechnology/game-weather'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createWeatherVisual } from '../src'

function lend() {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(65, 1, 0.08, 400)
  camera.position.set(0, 1.7, 0)
  const frames: Array<(dt: number) => void> = []
  const changes: Array<(change: BenchChange) => void> = []
  const host = {
    THREE,
    scene,
    camera,
    locale: 'en',
    groundAt: () => 0,
    tool: () => ({}),
    on: () => () => undefined,
    onFrame: (update: (dt: number) => void) => {
      frames.push(update)
      return () => undefined
    },
    log: () => undefined,
    bench: { onChange: (listener: (change: BenchChange) => void) => (changes.push(listener), () => undefined), get: () => undefined },
  } as unknown as ModuleHost
  return { host, scene, frames, send: (change: BenchChange) => changes.forEach((listener) => listener(change)) }
}

describe('the weather bench with the visual', () => {
  it('declares the visual layers before it is attached, in both languages', () => {
    const module = createWeatherTestModule({ locale: 'pt-BR', visual: createWeatherVisual() })
    const ids = module.layers?.('pt-BR').map((layer) => layer.id)
    expect(ids).toEqual(['environment', 'fog', 'far_rain', 'near_rain', 'mist', 'sky', 'lightning', 'headlights', 'haze'])
    expect(module.layers?.('pt-BR').find((layer) => layer.id === 'far_rain')?.name).toBe('Cortina de chuva')
    expect(createWeatherTestModule({ locale: 'en', visual: createWeatherVisual() }).layers?.('en').find((layer) => layer.id === 'far_rain')?.name).toBe('Rain curtain')
  })

  it('draws the weather it shows: the storm sets the rain curtain, the fog and the lamp rig lights', () => {
    const { host, scene, frames, send } = lend()
    const vfx = createVfx({ seed: 4 })
    const module = createWeatherTestModule({ seed: 3, start: 'storm', autoSchedule: false, sound: false, visual: createWeatherVisual({ vfx }) })
    const detach = module.attach?.(host)
    for (let i = 0; i < 5; i++) frames.forEach((frame) => frame(0.05))
    const curtain = scene.getObjectByName('weather-rain-curtain') as THREE.Points
    expect(curtain.visible).toBe(true)
    expect((scene.fog as THREE.Fog).far).toBe(110)
    const rig = scene.getObjectByName('weather-lamp-rig')!
    const spots = rig.children.filter((child) => (child as THREE.SpotLight).isSpotLight) as THREE.SpotLight[]
    expect(spots.length).toBe(2)
    expect(spots[0]!.intensity).toBe(2.4)
    send({ kind: 'layer', id: 'far_rain', on: false })
    expect(curtain.visible).toBe(false)
    send({ kind: 'layer', id: 'fog', on: false })
    expect(scene.fog).toBeNull()
    detach?.()
    expect(scene.getObjectByName('weather-rain-curtain')).toBeUndefined()
    expect(scene.getObjectByName('weather-lamp-rig')).toBeUndefined()
  })
})
