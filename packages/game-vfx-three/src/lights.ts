import type * as THREE_NS from 'three'
import type { LightPool } from '@adatechnology/game-vfx'
import type { ThreeLib } from './types'

export interface LightLayer {
  readonly group: THREE_NS.Group
  /** Moves and lights the 4 blast lights and 2 fire lights from the pool; answers how many are lit. */
  sync(): number
  dispose(): void
}

/** The Lab's light pool as real point lights (L349-365). Colours are the raw numbers the Lab used, not converted from sRGB. */
export function createLightLayer(THREE: ThreeLib, pool: LightPool, scale: number): LightLayer {
  const group = new THREE.Group()
  const blast = pool.blast.map(() => {
    const light = new THREE.PointLight(0xffa050, 0, 30, 2)
    light.position.set(0, -50, 0)
    group.add(light)
    return light
  })
  const fire = pool.fire.map(() => {
    const light = new THREE.PointLight(0xff7a2a, 0, 16, 2)
    light.position.set(0, -50, 0)
    group.add(light)
    return light
  })
  return {
    group,
    sync() {
      let lit = 0
      pool.blast.forEach((entry, index) => {
        const light = blast[index]!
        light.position.set(entry.x, entry.y, entry.z)
        light.distance = entry.distance
        light.color.setRGB(entry.color[0], entry.color[1], entry.color[2], THREE.LinearSRGBColorSpace)
        light.intensity = entry.intensity * scale
        if (entry.intensity > 0.05) lit++
      })
      pool.fire.forEach((entry, index) => {
        const light = fire[index]!
        light.position.set(entry.x, entry.y, entry.z)
        light.distance = entry.distance
        light.intensity = entry.intensity * scale
        if (entry.intensity > 0.05) lit++
      })
      return lit
    },
    dispose() {
      for (const light of [...blast, ...fire]) light.dispose()
    },
  }
}
