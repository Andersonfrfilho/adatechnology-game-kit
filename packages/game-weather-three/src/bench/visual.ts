import type { ModuleHost, ModuleLayer } from '@adatechnology/game-contracts'
import type { VfxWorld } from '@adatechnology/game-vfx'
import type { WeatherVisual, WeatherVisualContext, WeatherVisualFactory } from '@adatechnology/game-weather'
import type * as THREE_NS from 'three'
import { HEADLIGHTS } from '../headlights'
import { createWeatherRenderer } from '../renderer'
import type { WeatherLayerId, WeatherRenderer, WeatherRendererOptions } from '../renderer'
import type { ThreeLib } from '../types'
import { weatherVisualTextOf } from './text'

export type WeatherVisualOptions = Pick<WeatherRendererOptions, 'profile' | 'random' | 'zone' | 'puddles' | 'puddleAt' | 'headlights'> & {
  /** The effects world of the room (`room.vfx`); without it the near rain, mist, ash, white flash and lit drops are left out. */
  readonly vfx?: VfxWorld
  /** Where the lamp rig stands (the two headlights of the Workshop's car, to see the beams); `false` leaves it out. Default 2.5 m ahead of the test room camera, lamps toward it. */
  readonly rig?: readonly [x: number, z: number, turn: number] | false
  /**
   * The car the lamps are mounted on, built by the vehicles SDK for the host's three.js (`createVehiclesThree` of game-vehicles-three with the fleet installed), so the rig follows the fleet when it
   * changes. Without it the rig has only the lamps and their beams: no car drawn here.
   */
  readonly vehicles?: (THREE: ThreeLib) => RigVehicles
  /** Fleet id of the rig's car (default `midsize_sedan`). */
  readonly rigVehicle?: string
  /** Which layers start on (all do by default); the room that is not about weather starts the sky and the fog off to keep its own look. */
  readonly layers?: Partial<Record<WeatherLayerId, boolean>>
}

/** What the rig needs of the vehicles SDK (`VehiclesThree` of game-vehicles-three): a car in the game frame (front on +z, wheels on y = 0) and its length. */
export interface RigVehicles {
  build(key: string, options?: { quality?: 'high' | 'lite' }): { readonly group: THREE_NS.Object3D; readonly length: number; dispose(): void }
}

const RIG_VEHICLE = 'midsize_sedan'
const LAYER_ORDER: readonly Exclude<WeatherLayerId, 'fog'>[] = ['far_rain', 'near_rain', 'mist', 'sky', 'lightning', 'headlights', 'haze']
const RIG_DEFAULT = [1.6, -2.5, 0] as const

/**
 * The lamps of the Workshop's car and, when the vehicles SDK is lent, a car of the fleet under them, its nose just ahead of the lamps: what the headlights are attached to when the viewer has no
 * car in the room.
 */
function buildRig(THREE: ThreeLib, vehicles: RigVehicles | undefined, key: string): { readonly group: THREE_NS.Group; dispose(): void } {
  const group = new THREE.Group()
  group.name = 'weather-lamp-rig'
  const car = vehicles?.build(key, { quality: 'lite' })
  if (car) {
    car.group.position.z = HEADLIGHTS.lamp[2] + 0.1 - car.length / 2
    group.add(car.group)
  }
  return {
    group,
    dispose() {
      car?.dispose()
    },
  }
}

/**
 * The picture of the weather for the weather bench: `createWeatherTestModule({ visual: createWeatherVisual({ vfx: room.vfx }) })`. It draws the weather the bench shows with
 * `createWeatherRenderer` on the room's scene and camera, switches each part with the bench layers and puts a lamp rig in front of the camera for the headlights.
 */
export function createWeatherVisual(options: WeatherVisualOptions = {}): WeatherVisualFactory {
  return {
    layers(locale): readonly ModuleLayer[] {
      const text = weatherVisualTextOf(locale)
      return LAYER_ORDER.map((id) => ({ id, name: text.layers[id], default: options.layers?.[id] ?? true }))
    },
    create({ host, weather }: WeatherVisualContext): WeatherVisual {
      const THREE = host.THREE as ThreeLib
      const renderer: WeatherRenderer = createWeatherRenderer(THREE, {
        scene: host.scene as THREE_NS.Scene,
        camera: host.camera as THREE_NS.Camera,
        weather,
        ...(options.vfx ? { vfx: options.vfx } : {}),
        ...(options.profile ? { profile: options.profile } : {}),
        ...(options.random ? { random: options.random } : {}),
        ...(options.zone ? { zone: options.zone } : {}),
        ...(options.puddles ? { puddles: options.puddles } : {}),
        ...(options.puddleAt ? { puddleAt: options.puddleAt } : {}),
        ...(options.headlights ? { headlights: options.headlights } : {}),
        ...(options.layers ? { layers: options.layers } : {}),
      })
      return attachRig(THREE, host, renderer, options.rig === undefined ? RIG_DEFAULT : options.rig, options.vehicles?.(THREE), options.rigVehicle ?? RIG_VEHICLE)
    },
  }
}

function attachRig(THREE: ThreeLib, host: ModuleHost, renderer: WeatherRenderer, place: readonly [number, number, number] | false, vehicles: RigVehicles | undefined, key: string): WeatherVisual {
  const scene = host.scene as THREE_NS.Scene
  const rig = place === false ? undefined : buildRig(THREE, vehicles, key)
  let detach: (() => void) | undefined
  if (rig && place) {
    rig.group.position.set(place[0], 0, place[1])
    rig.group.rotation.y = place[2]
    scene.add(rig.group)
    detach = renderer.headlights.attach(rig.group)
  }
  return {
    update: (dt) => renderer.update(dt),
    setLayer(id, on) {
      if ((WEATHER_IDS as readonly string[]).includes(id)) renderer.setLayer(id as WeatherLayerId, on)
    },
    dispose() {
      detach?.()
      if (rig) {
        scene.remove(rig.group)
        rig.dispose()
      }
      renderer.dispose()
    },
  }
}

const WEATHER_IDS: readonly WeatherLayerId[] = ['far_rain', 'near_rain', 'mist', 'fog', 'sky', 'lightning', 'headlights', 'haze']
