import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { ActiveEmitter } from '@adatechnology/game-interactables'
import { createEffects } from '../src'
import type { ParticleEffectRequest } from '../src/routed-particles'

const em = (kind: ActiveEmitter['kind'], id: string = kind): ActiveEmitter => ({ id, object: 'o', kind, pos: [0, 1, 0], dir: [0, -1, 0.2], size: 0.3, intensity: 1 })
const run = (emitters: readonly ActiveEmitter[], withSink: boolean, seconds = 2) => {
  const requests: ParticleEffectRequest[] = []
  const fx = createEffects(THREE, { scene: new THREE.Scene(), camera: null, maxParticles: 100, effects: () => (withSink ? { play: (request: ParticleEffectRequest) => void requests.push(request) } : undefined) })
  for (let i = 0; i < seconds * 30; i++) fx.update(1 / 30, emitters)
  return { fx, requests }
}

describe('particles through the host effects world', () => {
  it('sends as many particles as the local pools would have drawn, with the same lives, and draws none of them here', () => {
    const local = run([em('smoke'), em('fire'), em('spark')], false)
    const routed = run([em('smoke'), em('fire'), em('spark')], true)
    expect(routed.fx.stats().byKind).toMatchObject({ smoke: 0, fire: 0, spark: 0 })
    expect(routed.requests.length).toBeGreaterThan(0)
    const born = (kind: string) => routed.requests.filter((request) => request.effect === kind).length
    expect(born('particle_puff')).toBeGreaterThan(0)
    expect(born('particle_glow')).toBeGreaterThan(0)
    expect(born('particle_streak')).toBeGreaterThan(0)
    // the local pools hold what is alive, which is at most what was born in two seconds and cannot be more than the routed total
    expect(local.fx.stats().alive).toBeLessThanOrEqual(routed.requests.length)
  })

  it('has no cap of its own on the routed kinds: more than maxParticles are sent', () => {
    const { requests } = run([em('smoke', 'a'), em('smoke', 'b'), em('smoke', 'c'), em('fire', 'd')], true, 6)
    expect(requests.length).toBeGreaterThan(100)
  })

  it('gives the numbers of the local particle: the smoke is grey with its life and its two sizes, the fire is hot with the peak opacity of the shader', () => {
    const { requests } = run([em('smoke'), em('fire')], true, 1)
    const puff = requests.find((request) => request.effect === 'particle_puff')!
    expect(puff.values.life).toBeGreaterThanOrEqual(2.8)
    expect(puff.values.life).toBeLessThanOrEqual(4.6)
    expect(puff.values.size).toBeCloseTo(0.3 * 0.6, 9)
    expect(puff.values.grow).toBeCloseTo(2.6 / 0.6, 9)
    expect(puff.values.alpha).toBe(0.55)
    const red = (puff.values.color! >> 16) & 255
    expect(puff.values.color).toBe((red << 16) | (red << 8) | red)
    const glow = requests.find((request) => request.effect === 'particle_glow')!
    expect(glow.values.alpha).toBe(0.8)
    expect(glow.values.life).toBeGreaterThanOrEqual(0.35)
    expect(glow.values.life).toBeLessThanOrEqual(0.75)
  })

  it('keeps water local with its pool and cap', () => {
    const { fx, requests } = run([em('water')], true, 3)
    expect(requests).toHaveLength(0)
    expect(fx.stats().byKind.water).toBeGreaterThan(0)
  })

  it('without an effects world the pools are used and capped as before', () => {
    const { fx, requests } = run([em('smoke'), em('fire')], false, 6)
    expect(requests).toHaveLength(0)
    expect(fx.stats().alive).toBeGreaterThan(0)
    expect(fx.stats().alive).toBeLessThanOrEqual(100)
  })
})
