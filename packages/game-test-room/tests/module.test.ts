import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { AnimationClipSpec, DestructibleImpl, TestableModule } from '@adatechnology/game-contracts'
import type { ScenarioContext } from '../src'
import { makeRoom } from './helpers'

/** A module-owned panel: one steel part, its own damage rule, one `slide` animation that moves it. */
const panelImpl = (id: string): DestructibleImpl => {
  let hp = 50
  return {
    id,
    describe: () => ({ parts: [{ id: 'panel', material: 'steel', shape: { kind: 'box', size: [1, 1, 0.02] }, position: [0, 0.5, 0], mass: 4, hp: 50 }] }),
    hit(hit) {
      hp = Math.max(0, hp - (hit.energy ?? 0) / 10)
      return [{ type: 'damage', object: id, time: 0, part: 'panel', amount: 1, hp, damageType: hit.type }]
    },
    state: () =>
      ({
        id,
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        parts: [{ id: 'panel', material: 'steel', status: hp > 0 ? 'intact' : 'broken', hp, maxHp: 50, mass: 4, temperature: 20, burning: false, fuel: 0, char: 0, melt: 0, dents: [], holes: [], cracks: [], group: 0 }],
        joints: [],
        groups: [['panel']],
        destroyed: hp <= 0,
      }) as ReturnType<DestructibleImpl['state']>,
    reset: () => {
      hp = 50
    },
  }
}

const slide: AnimationClipSpec = {
  id: 'slide',
  duration: 1,
  keys: [{ t: 0 }, { t: 1, parts: { panel: { position: [1, 0, 0] } } }],
  events: [{ t: 0.5, type: 'sound', data: { key: 'whoosh' } }],
}

const mod = (clip: AnimationClipSpec = slide): TestableModule<ScenarioContext> => ({
  id: 'panels',
  name: 'Panels',
  group: 'Panels',
  items: (locale) => [
    {
      id: 'sliding_panel',
      name: locale === 'pt-BR' ? 'Painel deslizante' : 'Sliding panel',
      build: (T) => {
        const three = T as typeof THREE
        const g = new three.Group()
        const m = new three.Mesh(new three.BoxGeometry(1, 1, 0.02), new three.MeshStandardMaterial())
        m.name = 'panel'
        m.position.set(0, 0.5, 0)
        g.add(m)
        return g
      },
      impl: (_root, id) => panelImpl(id),
      movable: false,
      animations: [clip],
    },
  ],
  scenarios: () => [{ id: 'panel_scenario', name: 'Panel scenario', run: ({ expect }) => expect(true, 'ran') }],
})

describe('loadModule', () => {
  it('adds the items under the group, the scenarios as buttons, and logs a check line per contract check', () => {
    const room = makeRoom()
    const before = room.scenarios.length
    const rep = room.loadModule(mod())
    expect(rep).toEqual({ module: 'panels', items: ['sliding_panel'], scenarios: ['panel_scenario'], ok: true, problems: [] })
    expect(room.scenarios.length).toBe(before + 1)
    const checks = room.log.entries({ channel: 'check' })
    expect(checks.map((c) => c.type)).toEqual(['pass', 'pass'])
    expect(checks.map((c) => c.text)).toEqual([expect.stringContaining('✓ Sliding panel: destructible contract ok'), expect.stringContaining('✓ Sliding panel: animation "slide" ok')])
    expect(room.log.entries({ type: 'module' })[0].text).toMatch(/Module "Panels" loaded: 1 item\(s\), 1 scenario\(s\), contract checks: all passed/)
    // loading again replaces, it does not duplicate
    room.loadModule(mod())
    expect(room.scenarios.length).toBe(before + 1)
  })

  it('reports a broken contract with ✗ lines and ok false', () => {
    const room = makeRoom()
    const rep = room.loadModule(mod({ id: 'slide', duration: 1, keys: [{ t: 0, parts: { ghost: { position: [0, 0, 0] } } }] }))
    expect(rep.ok).toBe(false)
    expect(rep.problems[0]).toMatch(/unknown part "ghost"/)
    const bad = room.log.entries({ type: 'fail' })
    expect(bad).toHaveLength(1)
    expect(bad[0].text).toMatch(/^✗ Sliding panel: animation "slide" broken/)
  })

  it('hosts the impl in the world: the room gives it its id and hits reach it', () => {
    const room = makeRoom({ locale: 'pt-BR' })
    room.loadModule(mod())
    const so = room.spawn('sliding_panel', [0, 0, -4], 0)
    expect(so.movable).toBe(false)
    expect(room.world.part(so.objectId, 'panel')?.hp).toBe(50)
    room.world.hit(so.objectId, { type: 'blunt', point: [0, 0.5, -4], energy: 600, radius: 0.05 })
    expect(room.world.part(so.objectId, 'panel')?.status).toBe('broken')
    room.resetAll()
    expect(room.world.part(so.objectId, 'panel')?.status).toBe('intact')
    expect(room.log.entries({ type: 'spawn' })[0].text).toContain('Painel deslizante')
  })

  it('rejects an impl whose id is not the one the room gave it', () => {
    const room = makeRoom()
    const m = mod()
    m.items = () => [{ ...mod().items('en')[0], impl: () => panelImpl('fixed_id') }]
    room.loadModule(m)
    expect(() => room.spawn('sliding_panel')).toThrow(/DestructibleImpl\.id is "fixed_id"/)
  })
})

describe('animations', () => {
  it('plays a clip on the aimed item: poses interpolate, events are logged and reach onSound, the last pose stays', () => {
    const sounds: string[] = []
    const room = makeRoom({ onSound: (k) => sounds.push(k) })
    room.loadModule(mod())
    const so = room.spawn('sliding_panel', [0, 0, -4], 0)
    const panel = so.root.getObjectByName('panel')!
    room.look([0, 1, -1.5], [0, 0.5, -4])
    expect(room.animations()).toMatchObject({ objectId: so.objectId, itemId: 'sliding_panel', clips: [{ id: 'slide', duration: 1 }], playing: null })
    expect(room.playAnimation('slide')).toBe(true)
    expect(room.animations()?.playing).toBe('slide')
    for (let i = 0; i < 31; i++) room.update(1 / 60)
    expect(panel.position.x).toBeCloseTo(0.52, 1)
    expect(sounds).toEqual(['whoosh'])
    for (let i = 0; i < 60; i++) room.update(1 / 60)
    expect(panel.position.x).toBeCloseTo(1, 5)
    expect(room.animations()?.playing).toBeNull()
    expect(room.log.entries().filter((e) => e.type.startsWith('animation')).map((e) => e.type)).toEqual(['animation', 'animation_event', 'animation_end'])
    expect(room.playAnimation('nope')).toBe(false)
  })

  it('an item without animations says so; nothing aimed gives null', () => {
    const room = makeRoom()
    room.look([0, 1.6, 6], [0, 1.6, 8])
    expect(room.animations()).toBeNull()
    const so = room.spawn('chair', [0, 0, -4], 0)
    room.look([0, 0.6, -2], [0, 0.45, -4])
    expect(room.animations()).toMatchObject({ objectId: so.objectId, clips: [] })
  })
})
