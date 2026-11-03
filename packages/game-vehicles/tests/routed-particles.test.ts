import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { ParticleEffectRequest } from '../src'
import { makeKit } from './helpers/kit'

const world = () => ({ effects: new THREE.Group(), particles: [] as any[], rand: () => 0.5 })
const sink = () => {
  const requests: ParticleEffectRequest[] = []
  return { requests, effects: () => ({ play: (request: ParticleEffectRequest) => void requests.push(request) }) }
}

describe('puffs through the host effects world', () => {
  it('a puff goes to the effects world with the colour, opacity, life and size of the local one, and nothing is drawn locally', () => {
    const { requests, effects } = sink()
    const routed: any = makeKit({ effects }, false)
    const local: any = makeKit({}, false)
    const c = world()
    const options = { variant: 'black', s: 0.75, life: 3.2 }
    const puff = local.spawn(world(), 'smoke', new THREE.Vector3(1, 2, 3), new THREE.Vector3(0, 1, 0), options)
    routed.spawn(c, 'smoke', new THREE.Vector3(1, 2, 3), new THREE.Vector3(0, 1, 0), options)
    expect(c.particles).toHaveLength(0)
    expect(c.effects.children).toHaveLength(0)
    expect(requests).toHaveLength(1)
    const sent = requests[0]!
    expect(sent.effect).toBe('particle_puff')
    expect(sent.point).toEqual([1, 2, 3])
    expect(sent.values.life).toBe(puff.life)
    expect(sent.values.alpha).toBeCloseTo(puff.op, 9)
    expect(sent.values.color).toBe(0x1b1b1c)
    expect(sent.values.size).toBeCloseTo(puff.s0 * 0.18, 9)
    expect(sent.values.vy).toBeCloseTo(1, 9)
  })

  it('takes the colour and opacity the exhaust asks for and the fire goes to the additive kind', () => {
    const { requests, effects } = sink()
    const kit: any = makeKit({ effects }, false)
    const c = world()
    kit.spawn(c, 'smoke', new THREE.Vector3(), new THREE.Vector3(0, 1, 0), { col: '#3f4245', op: 0.42, s: 0.4, life: 1.5 })
    kit.spawn(c, 'fire', new THREE.Vector3(), new THREE.Vector3(0, 1, 0), { s: 0.6, life: 0.7 })
    expect(requests.map((request) => request.effect)).toEqual(['particle_puff', 'particle_glow'])
    expect(requests[0]!.values).toMatchObject({ color: 0x3f4245, alpha: 0.42, life: 1.5 })
  })

  it('carries the position and velocity of the vehicle group to the world', () => {
    const { requests, effects } = sink()
    const kit: any = makeKit({ effects }, false)
    const c = world()
    c.effects.position.set(10, 0, 0)
    c.effects.rotation.y = Math.PI / 2
    kit.spawn(c, 'smoke', new THREE.Vector3(1, 0, 0), new THREE.Vector3(2, 0, 0), {})
    expect(requests[0]!.point[0]).toBeCloseTo(10, 6)
    expect(requests[0]!.point[2]).toBeCloseTo(-1, 6)
    expect(requests[0]!.values.vz).toBeCloseTo(-2, 6)
  })

  it('without a host effects world the puff is drawn locally with its cap, as before', () => {
    const kit: any = makeKit({ effects: () => undefined }, false)
    const c = world()
    for (let k = 0; k < 450; k++) kit.spawn(c, 'smoke', new THREE.Vector3(), new THREE.Vector3(0, 1, 0), {})
    expect(c.particles).toHaveLength(400)
  })

  it('solid particles stay local even with an effects world', () => {
    const { requests, effects } = sink()
    const kit: any = makeKit({ effects }, false)
    const c = world()
    kit.spawn(c, 'spark', new THREE.Vector3(), new THREE.Vector3(1, 1, 0), { life: 0.1 })
    expect(requests).toHaveLength(0)
    expect(c.particles).toHaveLength(1)
  })
})
