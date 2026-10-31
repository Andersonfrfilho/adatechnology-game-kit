import * as THREE from 'three'

import type { RendererState } from '../src'

export { THREE }

export const FOCUS = [0, 0, 0] as const

export function fakeRendererState(): RendererState & { toneMapping: number; outputColorSpace: string; shadowMap: { type: number } } {
  return { toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace, shadowMap: { type: THREE.PCFShadowMap } }
}

export function lightAt(budgetLights: THREE.Object3D, index: number): THREE.PointLight {
  const lights: THREE.PointLight[] = []
  budgetLights.traverse((object) => {
    if ((object as THREE.PointLight).isPointLight) lights.push(object as THREE.PointLight)
  })
  return lights[index] as THREE.PointLight
}

export function lampSource(owner: string, x: number, priority: number = 200): Parameters<import('../src').LightBudget['addSource']>[0] {
  return { owner, priority, color: 0xffffff, intensity: 1, distance: 10, position: [x, 0, 0] }
}
