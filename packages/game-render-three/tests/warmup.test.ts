import { describe, expect, it, vi } from 'vitest'

import { type WarmupContext, type WarmupRenderer, createLightBudget, createProgramWarmup } from '../src'
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
