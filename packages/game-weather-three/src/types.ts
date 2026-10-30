import type * as THREE_NS from 'three'
import type { WeatherSample } from '@adatechnology/game-weather'

/** The only three.js members the renderer needs at runtime. Pass your own `THREE` instance (the whole namespace works). */
export type ThreeLib = Pick<
  typeof THREE_NS,
  | 'AdditiveBlending'
  | 'Box3'
  | 'BoxGeometry'
  | 'BufferAttribute'
  | 'BufferGeometry'
  | 'Color'
  | 'ConeGeometry'
  | 'DoubleSide'
  | 'Fog'
  | 'FogExp2'
  | 'Group'
  | 'HemisphereLight'
  | 'Mesh'
  | 'Matrix4'
  | 'MeshBasicMaterial'
  | 'Object3D'
  | 'PlaneGeometry'
  | 'Points'
  | 'ShaderMaterial'
  | 'SpotLight'
  | 'Vector3'
>

/** What the renderer reads of a weather world: its sample. A `createWeather` world fits. */
export type WeatherSource = { sample(): WeatherSample }

/** The quality names of game-vfx; they size the rain curtain. */
export type WeatherProfileName = 'low' | 'medium' | 'high'

/** Zone fog (the game's `ZONA_NEBLINA`): colour, far distance in metres and weight 0..1. */
export type ZoneFog = { readonly color?: number; readonly far?: number; readonly weight: number }

export type Vec3 = readonly [number, number, number]
