import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createFakeWebGl } from '../../../test-support/fake-webgl'
import { createProgramWarmup, shadowCasterProbes } from '../src'

// three r160's own WebGLRenderer on a context that draws nothing: the shadow pass, the shared depth material and the program cache run as in a browser
function roomLike() {
  const fake = createFakeWebGl()
  const renderer = new THREE.WebGLRenderer({ canvas: fake.canvas, context: fake.context })
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  const sun = new THREE.DirectionalLight(0xffffff, 2)
  sun.castShadow = true
  sun.position.set(7, 13, 8)
  const caster = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial())
  caster.castShadow = true
  scene.add(sun, new THREE.HemisphereLight(), caster)
  return { renderer, scene, camera: new THREE.PerspectiveCamera() }
}

const depthKeys = (renderer: THREE.WebGLRenderer): string[] => (renderer.info.programs ?? []).map((program) => (program as unknown as { cacheKey: string }).cacheKey).filter((key) => key.startsWith('depth,'))

/** What a blast brings in play: debris (an instanced caster), then a textured wall of a house (a plain caster with an sRGB map) right after it. */
function blastNextToTexturedWall(scene: THREE.Scene, side: THREE.Side): void {
  const debris = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial(), 4)
  debris.castShadow = true
  const map = new THREE.Texture()
  map.colorSpace = THREE.SRGBColorSpace
  const wall = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial({ map, side }))
  wall.castShadow = true
  wall.receiveShadow = true
  scene.add(debris, wall)
}

describe('shadowCasterProbes on three r160', () => {
  it('without the probes, a textured wall drawn after the debris of a blast links a depth program in play', () => {
    const { renderer, scene, camera } = roomLike()
    createProgramWarmup(THREE).warmUp(renderer, scene, camera)
    const before = depthKeys(renderer)
    blastNextToTexturedWall(scene, THREE.FrontSide)
    renderer.render(scene, camera)
    expect(depthKeys(renderer).filter((key) => !before.includes(key)).some((key) => key.includes(',uv,'))).toBe(true)
  })

  it('links every depth variant at load (with a map, on each side, plain and instanced): the textured wall after the debris links none in play', () => {
    for (const side of [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide]) {
      const { renderer, scene, camera } = roomLike()
      const warmup = createProgramWarmup(THREE)
      warmup.register(shadowCasterProbes(THREE))
      warmup.warmUp(renderer, scene, camera, { fogStates: ['none', 'linear', 'exp2'] })
      const atLoad = depthKeys(renderer)
      expect(atLoad.filter((key) => key.includes(',uv,')).length).toBeGreaterThanOrEqual(6)
      blastNextToTexturedWall(scene, side)
      renderer.render(scene, camera)
      expect(depthKeys(renderer).filter((key) => !atLoad.includes(key))).toEqual([])
    }
  })
})
