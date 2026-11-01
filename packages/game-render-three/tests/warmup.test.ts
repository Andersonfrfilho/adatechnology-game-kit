import { describe, expect, it, vi } from 'vitest'

import { type WarmupContext, type WarmupRenderer, createLightBudget, createMaterialPool, createProgramWarmup } from '../src'
import { THREE } from './helpers'

function fakeRenderer() {
  const context: WarmupContext = { MAX_FRAGMENT_UNIFORM_VECTORS: 1, getParameter: () => 1024, linkProgram: vi.fn() }
  const programs: object[] = []
  const renderer = {
    toneMapping: THREE.NoToneMapping,
    outputColorSpace: THREE.SRGBColorSpace,
    shadowMap: { type: THREE.PCFShadowMap },
    compile: vi.fn(),
    render: vi.fn(),
    setRenderTarget: vi.fn(),
    initTexture: vi.fn(),
    getContext: () => context,
    info: { programs, memory: { geometries: 3, textures: 2 } },
  }
  return { renderer: renderer as unknown as WarmupRenderer & typeof renderer, context, programs }
}

function fakeProbe(id: string) {
  const material = new THREE.MeshBasicMaterial()
  const disposeMaterial = vi.spyOn(material, 'dispose')
  const geometryDispose = vi.fn()
  const build = vi.fn(() => {
    const group = new THREE.Group()
    group.add(new THREE.Mesh(new THREE.BoxGeometry(), material))
    return { group, materials: [material], dispose: geometryDispose }
  })
  return { probe: { id, build }, build, disposeMaterial, geometryDispose, material }
}

describe('ProgramWarmup.warmUp', () => {
  it('draws an empty instanced batch and what is off camera once, then gives them back as they were', () => {
    const scene = new THREE.Scene()
    const batch = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 4)
    batch.count = 0
    scene.add(batch)
    const { renderer } = fakeRenderer()
    const seen: Array<[number, boolean]> = []
    renderer.render.mockImplementation(() => seen.push([batch.count, batch.frustumCulled]))
    createProgramWarmup(THREE).warmUp(renderer, scene, new THREE.PerspectiveCamera())
    expect(seen[0]).toEqual([1, false])
    expect([batch.count, batch.frustumCulled]).toEqual([0, true])
  })

  it('waits for the GPU at the end, so that the first upload of play does not', () => {
    const { renderer, context } = fakeRenderer()
    const readPixels = vi.fn()
    Object.assign(context, { RGBA: 1, UNSIGNED_BYTE: 2, readPixels })
    createProgramWarmup(THREE).warmUp(renderer, new THREE.Scene(), new THREE.PerspectiveCamera())
    expect(readPixels).toHaveBeenCalledTimes(1)
  })

  it('draws each probe once per fog state, on the target, seals the budget, warms shadows and never disposes probe materials', () => {
    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x888888, 1, 100)
    const budget = createLightBudget(THREE, scene, { point: 2, pointShadows: 1, spot: 0 })
    const camera = new THREE.PerspectiveCamera()
    const { renderer } = fakeRenderer()
    const warmup = createProgramWarmup(THREE)
    const first = fakeProbe('a')
    const second = fakeProbe('b')
    warmup.register(first.probe)
    warmup.register(second.probe)
    const target = new THREE.WebGLRenderTarget(4, 4)
    const shadowLight = budget.group.children.find((child) => (child as InstanceType<typeof THREE.PointLight>).castShadow) as InstanceType<typeof THREE.PointLight>
    expect(shadowLight.shadow.needsUpdate).toBe(false)
    let sawShadowReady = false
    renderer.render.mockImplementation(() => {
      sawShadowReady = shadowLight.shadow.needsUpdate
    })

    const report = warmup.warmUp(renderer, scene, camera, { lights: budget, fogStates: ['linear', 'exp2'], target })

    expect(first.build).toHaveBeenCalledTimes(1)
    expect(renderer.compile).toHaveBeenCalledTimes(2)
    expect(renderer.render).toHaveBeenCalledTimes(2)
    expect(renderer.setRenderTarget).toHaveBeenCalledWith(target)
    expect(sawShadowReady).toBe(true)
    expect(scene.fog).toBeInstanceOf(THREE.Fog)
    expect(scene.children).toHaveLength(1)
    expect(first.disposeMaterial).not.toHaveBeenCalled()
    expect(second.disposeMaterial).not.toHaveBeenCalled()
    expect(first.geometryDispose).toHaveBeenCalledTimes(1)
    expect(warmup.anchors.size).toBe(2)
    expect(report.anchors).toBe(2)
    expect(report.uniformVectors).toBe(1024)
    expect(report.geometries).toBe(3)
    expect(budget.check(renderer, scene).ok).toBe(true)
    scene.fog = new THREE.FogExp2(0x888888, 0.01)
    expect(budget.check(renderer, scene).ok).toBe(true)
    scene.fog = null
    expect(budget.check(renderer, scene).ok).toBe(false)
  })

  it('plays each effect for its frames, renders after every step and stops it, then inits textures', () => {
    const scene = new THREE.Scene()
    const { renderer } = fakeRenderer()
    const warmup = createProgramWarmup(THREE)
    const calls: string[] = []
    warmup.registerEffect({ id: 'm67', play: () => calls.push('play'), step: () => calls.push('step'), stop: () => calls.push('stop') })
    const texture = new THREE.Texture()
    warmup.registerTexture(texture)
    renderer.render.mockImplementation(() => calls.push('render'))
    warmup.warmUp(renderer, scene, new THREE.PerspectiveCamera())
    expect(calls).toEqual(['render', 'play', 'step', 'render', 'step', 'render', 'step', 'render', 'stop'])
    expect(renderer.initTexture).toHaveBeenCalledWith(texture)
  })

  it('refuses an instanced shadow caster with a depth material but no distance material', () => {
    const scene = new THREE.Scene()
    const { renderer } = fakeRenderer()
    const warmup = createProgramWarmup(THREE)
    warmup.register({
      id: 'horde',
      build: () => {
        const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 2)
        mesh.castShadow = true
        mesh.customDepthMaterial = new THREE.MeshDepthMaterial()
        const group = new THREE.Group()
        group.add(mesh)
        return { group, materials: [], dispose: () => undefined }
      },
    })
    expect(() => warmup.warmUp(renderer, scene, new THREE.PerspectiveCamera())).toThrow(/customDistanceMaterial/)
  })

  it('turns a program that failed to link into an error that names the uniform budget', () => {
    const { renderer, programs } = fakeRenderer()
    programs.push({ diagnostics: { runnable: false, programLog: 'too many uniforms' } })
    expect(() => createProgramWarmup(THREE).warmUp(renderer, new THREE.Scene(), new THREE.PerspectiveCamera())).toThrow(/MAX_FRAGMENT_UNIFORM_VECTORS 1024.*too many uniforms/)
  })

  it('unregisters a probe', () => {
    const { renderer } = fakeRenderer()
    const warmup = createProgramWarmup(THREE)
    const { probe, build } = fakeProbe('a')
    warmup.register(probe)()
    warmup.warmUp(renderer, new THREE.Scene(), new THREE.PerspectiveCamera())
    expect(build).not.toHaveBeenCalled()
  })
})

describe('ProgramWarmup.linkedSince', () => {
  it('counts linkProgram calls after warmUp, even when info.programs does not change', () => {
    const { renderer, context, programs } = fakeRenderer()
    const warmup = createProgramWarmup(THREE)
    const original = context.linkProgram
    warmup.warmUp(renderer, new THREE.Scene(), new THREE.PerspectiveCamera())
    expect(warmup.linkedSince(renderer)).toBe(0)
    const program = {} as WebGLProgram
    context.linkProgram(program)
    context.linkProgram(program)
    context.linkProgram(program)
    expect(warmup.linkedSince(renderer)).toBe(3)
    expect(programs).toHaveLength(0)
    expect(original).toHaveBeenCalledTimes(3)
    warmup.warmUp(renderer, new THREE.Scene(), new THREE.PerspectiveCamera())
    expect(warmup.linkedSince(renderer)).toBe(0)
  })
})

describe('ProgramWarmup.warmUp when something throws', () => {
  it('puts the fog back, takes the probes out of the scene, disposes them and stops the effect', () => {
    const scene = new THREE.Scene()
    const fog = new THREE.Fog(0x888888, 1, 100)
    scene.fog = fog
    const { renderer } = fakeRenderer()
    const warmup = createProgramWarmup(THREE)
    const probe = fakeProbe('a')
    warmup.register(probe.probe)
    const stop = vi.fn()
    warmup.registerEffect({ id: 'boom', frames: 1, play: vi.fn(), step: () => { throw new Error('effect broke') }, stop } as never)
    expect(() => warmup.warmUp(renderer, scene, new THREE.PerspectiveCamera(), { fogStates: ['exp2'] })).toThrow('effect broke')
    expect(scene.fog).toBe(fog)
    expect(scene.children.some((child) => child.children.some((mesh) => (mesh as InstanceType<typeof THREE.Mesh>).material === probe.material))).toBe(false)
    expect(probe.geometryDispose).toHaveBeenCalledTimes(1)
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('cleans up when a draw throws too', () => {
    const scene = new THREE.Scene()
    const { renderer } = fakeRenderer()
    renderer.render.mockImplementation(() => {
      throw new Error('gl lost')
    })
    const warmup = createProgramWarmup(THREE)
    const probe = fakeProbe('a')
    warmup.register(probe.probe)
    expect(() => warmup.warmUp(renderer, scene, new THREE.PerspectiveCamera(), { fogStates: ['linear'] })).toThrow('gl lost')
    expect(scene.fog).toBeNull()
    expect(scene.children).toHaveLength(0)
    expect(probe.geometryDispose).toHaveBeenCalledTimes(1)
  })
})

describe('ProgramWarmup.warmUp with materials', () => {
  it('draws every material it is given once, as the kind of object its program is for, and takes them out again without disposing them', () => {
    const scene = new THREE.Scene()
    const { renderer } = fakeRenderer()
    const seen: Array<Array<{ type: string; material: unknown }>> = []
    renderer.render.mockImplementation((drawn: InstanceType<typeof THREE.Scene>) => {
      const drawables: Array<{ type: string; material: unknown }> = []
      drawn.traverse((object) => {
        const material = (object as InstanceType<typeof THREE.Mesh>).material
        if (material) drawables.push({ type: object.type, material })
      })
      seen.push(drawables)
    })
    const mesh = new THREE.MeshBasicMaterial()
    const sprite = new THREE.SpriteMaterial()
    const points = new THREE.PointsMaterial()
    const line = new THREE.LineBasicMaterial()
    const dispose = vi.spyOn(mesh, 'dispose')
    createProgramWarmup(THREE).warmUp(renderer, scene, new THREE.PerspectiveCamera(), { fogStates: ['none'], materials: [mesh, sprite, points, line] })
    expect(seen).toHaveLength(1)
    expect(seen[0]).toEqual([
      { type: 'Mesh', material: mesh },
      { type: 'Sprite', material: sprite },
      { type: 'Points', material: points },
      { type: 'LineSegments', material: line },
    ])
    expect(scene.children).toHaveLength(0)
    expect(dispose).not.toHaveBeenCalled()
  })

  it('a pool lists the materials it was told to register, and only those', () => {
    const pool = createMaterialPool()
    const kept = pool.register('kept', () => new THREE.MeshBasicMaterial())
    pool.acquire('shared', () => new THREE.MeshBasicMaterial())
    expect(pool.registeredMaterials?.()).toEqual([kept])
  })
})
