import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createGeometryPool, createMaterialAnchors, createMaterialPool, geometryKey, materialKey, programKeysOf } from '../src'
import { THREE } from './helpers'

afterEach(() => vi.restoreAllMocks())

function rendererWithKeys(keysOf: WeakMap<object, string[]>) {
  return { properties: { get: (material: object) => ({ programs: new Map((keysOf.get(material) ?? []).map((key) => [key, {}])) }) } }
}

describe('GeometryPool', () => {
  it('returns the same geometry for a key and never disposes at zero uses', () => {
    const pool = createGeometryPool()
    const built = new THREE.SphereGeometry(1, 6, 4)
    const dispose = vi.spyOn(built, 'dispose')
    const first = pool.acquire('sphere|6|4', () => built)
    const second = pool.acquire('sphere|6|4', () => new THREE.SphereGeometry(1, 6, 4))
    expect(second).toBe(first)
    pool.release(first)
    pool.release(second)
    expect(dispose).not.toHaveBeenCalled()
    expect(pool.stats()).toEqual({ entries: 1, retained: 0, inUse: 0 })
  })

  it('trim disposes idle unretained geometries oldest first and keeps retained and in-use ones', () => {
    const pool = createGeometryPool()
    const spies = ['a', 'b', 'c', 'd'].map((key) => {
      const geometry = new THREE.BoxGeometry()
      return { key, geometry, dispose: vi.spyOn(geometry, 'dispose') }
    })
    const [oldest, retained, newest, inUse] = spies as [(typeof spies)[0], (typeof spies)[0], (typeof spies)[0], (typeof spies)[0]]
    for (const item of spies) pool.acquire(item.key, () => item.geometry)
    pool.retain('b')
    for (const item of [oldest, retained, newest]) pool.release(item.geometry)
    expect(pool.trim(1)).toBe(1)
    expect(oldest.dispose).toHaveBeenCalledTimes(1)
    expect(newest.dispose).not.toHaveBeenCalled()
    expect(pool.trim()).toBe(1)
    expect(newest.dispose).toHaveBeenCalledTimes(1)
    expect(retained.dispose).not.toHaveBeenCalled()
    expect(inUse.dispose).not.toHaveBeenCalled()
    expect(pool.stats()).toEqual({ entries: 2, retained: 1, inUse: 1 })
  })

  it('warns in development when a pooled geometry is disposed directly', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const pool = createGeometryPool()
    pool.acquire('flame', () => new THREE.SphereGeometry()).dispose()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"flame"'))
    const quiet = vi.spyOn(console, 'warn').mockClear()
    pool.dispose()
    expect(quiet).not.toHaveBeenCalled()
  })

  it('builds keys that round near-equal sizes together', () => {
    expect(geometryKey('sphere', [6, 4])).toBe('sphere|6|4')
    expect(geometryKey('box', [1.0001, 2])).toBe(geometryKey('box', [1, 2.0004]))
    expect(geometryKey('box', [1, 2])).not.toBe(geometryKey('box', [1, 2.01]))
  })
})

describe('MaterialPool', () => {
  it('shares a material per key, never disposes at zero uses, and trim never touches a registered one', () => {
    const pool = createMaterialPool({ renderer: rendererWithKeys(new WeakMap()) })
    const shared = new THREE.MeshBasicMaterial()
    const registered = new THREE.MeshBasicMaterial()
    const idle = new THREE.MeshBasicMaterial()
    const disposeShared = vi.spyOn(shared, 'dispose')
    const disposeRegistered = vi.spyOn(registered, 'dispose')
    const disposeIdle = vi.spyOn(idle, 'dispose')
    expect(pool.acquire('flame', () => shared)).toBe(shared)
    expect(pool.acquire('flame', () => new THREE.MeshBasicMaterial())).toBe(shared)
    pool.register('m67', () => registered)
    pool.acquire('idle', () => idle)
    pool.release(shared)
    pool.release(shared)
    pool.release(idle)
    expect(disposeShared).not.toHaveBeenCalled()
    expect(pool.trim()).toBe(2)
    expect(disposeShared).toHaveBeenCalledTimes(1)
    expect(disposeIdle).toHaveBeenCalledTimes(1)
    expect(disposeRegistered).not.toHaveBeenCalled()
    expect(pool.stats().registered).toBe(1)
  })

  it('trim keeps a drawn idle material that is the anchor of its program family', () => {
    const keys = new WeakMap<object, string[]>()
    const pool = createMaterialPool({ renderer: rendererWithKeys(keys) })
    const drawn = new THREE.MeshBasicMaterial()
    keys.set(drawn, ['basic|fog'])
    const dispose = vi.spyOn(drawn, 'dispose')
    pool.acquire('drawn', () => drawn)
    pool.release(drawn)
    expect(pool.trim()).toBe(0)
    expect(dispose).not.toHaveBeenCalled()
    expect(pool.stats().families).toBe(1)
  })

  it('own + release of two materials of one program family keeps the first as anchor and disposes the second', () => {
    const keys = new WeakMap<object, string[]>()
    const anchors = createMaterialAnchors(rendererWithKeys(keys))
    const pool = createMaterialPool({ anchors })
    const first = new THREE.SpriteMaterial()
    const second = new THREE.SpriteMaterial()
    keys.set(first, ['sprite|fog'])
    keys.set(second, ['sprite|fog'])
    const disposeFirst = vi.spyOn(first, 'dispose')
    const disposeSecond = vi.spyOn(second, 'dispose')
    pool.own(() => first)
    pool.own(() => second)
    pool.release(first)
    pool.release(second)
    expect(disposeFirst).not.toHaveBeenCalled()
    expect(disposeSecond).toHaveBeenCalledTimes(1)
    expect(pool.stats().families).toBe(1)
  })

  it('a pooled material disposed directly warns in development', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const pool = createMaterialPool()
    pool.acquire('flame', () => new THREE.MeshBasicMaterial()).dispose()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"flame"'))
  })

  it('builds sorted keys with rounded numbers', () => {
    expect(materialKey('basic', { opacity: 0.50001, color: 255 })).toBe('basic|color=255|opacity=0.5')
    expect(materialKey('basic', { b: 1, a: true })).toBe(materialKey('basic', { a: true, b: 1 }))
  })
})

describe('anchors and programKeysOf', () => {
  it('reads every key of a material, [] for one never drawn, undefined without three internals', () => {
    const keys = new WeakMap<object, string[]>()
    const material = new THREE.MeshBasicMaterial()
    keys.set(material, ['a|fog', 'a|fog2'])
    expect(programKeysOf(rendererWithKeys(keys), material)).toEqual(['a|fog', 'a|fog2'])
    expect(programKeysOf({ properties: { get: () => ({}) } }, material)).toEqual([])
    expect(programKeysOf({}, material)).toBeUndefined()
    expect(programKeysOf({ properties: { get: () => ({ programs: 'nope' }) } }, material)).toBeUndefined()
  })

  it('keeps a material when any key is uncovered; refuses one whose keys are all covered', () => {
    const keys = new WeakMap<object, string[]>()
    const anchors = createMaterialAnchors(rendererWithKeys(keys))
    const fogOnly = new THREE.MeshBasicMaterial()
    const both = new THREE.MeshBasicMaterial()
    const sameAsFogOnly = new THREE.MeshBasicMaterial()
    const neverDrawn = new THREE.MeshBasicMaterial()
    keys.set(fogOnly, ['k|fog'])
    keys.set(both, ['k|fog', 'k|fog2'])
    keys.set(sameAsFogOnly, ['k|fog'])
    expect(anchors.offer(fogOnly)).toBe(true)
    expect(anchors.offer(sameAsFogOnly)).toBe(false)
    expect(anchors.offer(both)).toBe(true)
    expect(anchors.offer(neverDrawn)).toBe(false)
    expect(anchors.size).toBe(2)
  })

  it('the reverse order keeps the two-key material first and covers the one-key material', () => {
    const keys = new WeakMap<object, string[]>()
    const anchors = createMaterialAnchors(rendererWithKeys(keys))
    const both = new THREE.MeshBasicMaterial()
    const fogOnly = new THREE.MeshBasicMaterial()
    keys.set(both, ['k|fog', 'k|fog2'])
    keys.set(fogOnly, ['k|fog'])
    expect(anchors.offer(both)).toBe(true)
    expect(anchors.offer(fogOnly)).toBe(false)
  })

  it('falls back to keeping every material when the keys cannot be read', () => {
    const anchors = createMaterialAnchors({})
    expect(anchors.offer(new THREE.MeshBasicMaterial())).toBe(true)
    expect(anchors.offer(new THREE.MeshBasicMaterial())).toBe(true)
    expect(anchors.size).toBe(2)
  })
})

describe('the three internals the pools read (r160)', () => {
  const require = createRequire(import.meta.url)
  const threeRoot = dirname(dirname(require.resolve('three')))
  const source = (file: string): string => readFileSync(join(threeRoot, 'src', file), 'utf8')

  it('stays on the three major the peer range allows', () => {
    const { version } = JSON.parse(readFileSync(join(threeRoot, 'package.json'), 'utf8')) as { version: string }
    expect(version.startsWith('0.160.')).toBe(true)
  })

  it('still keeps one program per cache key in properties.get(material).programs, released on dispose', () => {
    const renderer = source('renderers/WebGLRenderer.js')
    expect(renderer).toMatch(/materialProperties\.programs = programs/)
    expect(renderer).toMatch(/programs = new Map\(\)/)
    expect(renderer).toMatch(/releaseMaterialProgramReferences/)
    expect(renderer).toMatch(/programs\.set\( programCacheKey, program \)/)
  })

  it('still puts the opaque flag in the program key, so transparent and opaque materials get different keys', () => {
    expect(source('renderers/webgl/WebGLPrograms.js')).toMatch(/opaque: material\.transparent === false && material\.blending === NormalBlending/)
  })
})
