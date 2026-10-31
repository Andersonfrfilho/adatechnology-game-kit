import type { BenchChange, ModuleHost } from '@adatechnology/game-contracts'
import { createVfx } from '@adatechnology/game-vfx'
import { createWeatherTestModule } from '@adatechnology/game-weather/testing'
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

  it('draws no car of its own: the rig only carries the lamps unless the vehicles SDK lends one', () => {
    const { host, scene } = lend()
    const bare = createWeatherTestModule({ seed: 3, autoSchedule: false, sound: false, visual: createWeatherVisual() })
    const detachBare = bare.attach?.(host)
    const empty = scene.getObjectByName('weather-lamp-rig')!
    expect(empty.children.some((child) => (child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry.type === 'BoxGeometry')).toBe(false)
    detachBare?.()

    const built: string[] = []
    let disposed = 0
    const vehicles = () => ({
      build(key: string) {
        built.push(key)
        const group = new THREE.Group()
        group.name = 'fleet-car'
        return { group, length: 4.8, dispose: () => void disposed++ }
      },
    })
    const module = createWeatherTestModule({ seed: 3, autoSchedule: false, sound: false, visual: createWeatherVisual({ vehicles }) })
    const detach = module.attach?.(host)
    const car = scene.getObjectByName('weather-lamp-rig')!.getObjectByName('fleet-car')!
    expect(built).toEqual(['midsize_sedan'])
    expect(car.position.z).toBeCloseTo(2.15 + 0.1 - 2.4)
    detach?.()
    expect(disposed).toBe(1)
  })

  it('keeps the walking player out of the rig car (its length and width), and takes the block away with the module', () => {
    const { host, scene } = lend()
    const blockers = new Set<(x: number, z: number, radius: number) => boolean>()
    ;(host as { addBlocker?: unknown }).addBlocker = (fn: (x: number, z: number, radius: number) => boolean) => (blockers.add(fn), () => blockers.delete(fn))
    const vehicles = () => ({ build: () => ({ group: new THREE.Group(), length: 4.8, width: 1.9, dispose: () => undefined }) })
    const module = createWeatherTestModule({ seed: 3, autoSchedule: false, sound: false, visual: createWeatherVisual({ vehicles }) })
    const detach = module.attach?.(host)
    const rig = scene.getObjectByName('weather-lamp-rig')!
    rig.updateWorldMatrix(true, true)
    const centre = new THREE.Vector3(0, 0, 2.15 + 0.1 - 2.4).applyMatrix4(rig.matrixWorld)
    const side = new THREE.Vector3(1.9 / 2 + 0.5, 0, 2.15 + 0.1 - 2.4).applyMatrix4(rig.matrixWorld)
    const blocked = (p: THREE.Vector3): boolean => [...blockers].some((fn) => fn(p.x, p.z, 0.3))
    expect(blockers.size).toBe(1)
    expect(blocked(centre)).toBe(true)
    expect(blocked(side)).toBe(false)
    detach?.()
    expect(blockers.size).toBe(0)
  })
})
