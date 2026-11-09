import { describe, expect, it, vi } from 'vitest'

import { type WarmupContext, type WarmupRenderer, createProgramWarmup, shadowCasterProbes } from '../src'
import { THREE } from './helpers'

function fakeRenderer() {
  const context: WarmupContext = { MAX_FRAGMENT_UNIFORM_VECTORS: 1, getParameter: () => 1024, linkProgram: vi.fn() }
  const renderer = {
    toneMapping: THREE.NoToneMapping,
    outputColorSpace: THREE.SRGBColorSpace,
    shadowMap: { type: THREE.PCFShadowMap },
    compile: vi.fn(),
    render: vi.fn(),
    setRenderTarget: vi.fn(),
    initTexture: vi.fn(),
    getContext: () => context,
    info: { programs: [] as object[], memory: { geometries: 0, textures: 0 } },
  }
  return renderer as unknown as WarmupRenderer & typeof renderer
}

describe('shadowCasterProbes', () => {
  it('casts shadows with a lit material on every side, with and without a map, never culled by a shadow camera', () => {
    const built = shadowCasterProbes(THREE).build()
    const meshes = built.group.children as InstanceType<typeof THREE.Mesh>[]
    const variants = meshes.map((mesh) => {
      const material = mesh.material as InstanceType<typeof THREE.MeshLambertMaterial>
      return `${material.side}:${material.map ? 'map' : 'plain'}`
    })
    expect(new Set(variants)).toEqual(new Set([THREE.FrontSide, THREE.BackSide, THREE.DoubleSide].flatMap((side) => [`${side}:map`, `${side}:plain`])))
    for (const mesh of meshes) {
      expect(mesh.castShadow).toBe(true)
      expect(mesh.frustumCulled).toBe(false)
      expect((mesh.material as InstanceType<typeof THREE.MeshLambertMaterial>).isMeshLambertMaterial).toBe(true)
    }
    expect(built.materials).toHaveLength(6)
    built.dispose()
  })

  it('anchors its materials in the warmup, so the programs they link stay linked', () => {
    const warmup = createProgramWarmup(THREE)
    warmup.register(shadowCasterProbes(THREE))
    const report = warmup.warmUp(fakeRenderer(), new THREE.Scene(), new THREE.PerspectiveCamera())
    expect(report.anchors).toBeGreaterThan(0)
  })
})

describe('ProgramWarmup shadow casters', () => {
  const sceneWithFarCaster = () => {
    const scene = new THREE.Scene()
    const caster = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial())
    caster.castShadow = true
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial())
    scene.add(caster, receiver)
    return { scene, caster, receiver }
  }

  it('draws every caster into the shadow maps on the first draw, culling off, and gives the culling back', () => {
    const { scene, caster, receiver } = sceneWithFarCaster()
    const renderer = fakeRenderer()
    const seen: Array<[boolean, boolean]> = []
    renderer.render.mockImplementation(() => seen.push([caster.frustumCulled, receiver.frustumCulled]))
    createProgramWarmup(THREE).warmUp(renderer, scene, new THREE.PerspectiveCamera(), { fogStates: ['none', 'linear'] })
    expect(seen).toEqual([
      [false, true],
      [true, true],
    ])
    expect(caster.frustumCulled).toBe(true)
  })

  it('leaves the culling alone with shadowCasters "visible"', () => {
    const { scene, caster } = sceneWithFarCaster()
    const renderer = fakeRenderer()
    const seen: boolean[] = []
    renderer.render.mockImplementation(() => seen.push(caster.frustumCulled))
    createProgramWarmup(THREE).warmUp(renderer, scene, new THREE.PerspectiveCamera(), { shadowCasters: 'visible' })
    expect(seen).toEqual([true])
  })

  it('gives the culling back when a draw throws', () => {
    const { scene, caster } = sceneWithFarCaster()
    const renderer = fakeRenderer()
    renderer.render.mockImplementation(() => {
      throw new Error('lost context')
    })
    expect(() => createProgramWarmup(THREE).warmUp(renderer, scene, new THREE.PerspectiveCamera())).toThrow('lost context')
    expect(caster.frustumCulled).toBe(true)
  })
})
