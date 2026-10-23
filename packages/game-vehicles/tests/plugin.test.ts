import { describe, expect, it } from 'vitest'
import type { Plugin, ScenarioDefinition } from '../src'
import { makeKit } from './helpers/kit'
import { DEMO_CAR } from './helpers/sample-fleet'

const crashed: ScenarioDefinition = {
  id: 'crashed',
  name: 'Crashed nose',
  init: (x) => {
    x.limit = x.front - 0.4 * x.length
  },
  zone: (z, x) => {
    if (x.center.x > x.limit) x.set(z, 15 + x.rand() * 20)
    if (z.type === 'roof') x.set(z, 10)
    x.flags.burnt = true
  },
}

const pack: Plugin = {
  name: 'test-pack',
  configure: {
    scenarios: [crashed],
    zoneEffects: { hood: ['None', 'Scratched', 'Bent', 'Folded', 'Gone'] },
    texts: { who: 'the pilot' },
    damagedScenario: 'crashed',
    groups: ['Test'],
    fuels: { flex: { label: 'Flex' } },
  },
  install(kit) {
    kit.register({ key: 'pack-car', name: 'Pack car', group: 'Test', fuel: 'flex' }, (c) =>
      kit.car(c, JSON.parse(JSON.stringify(DEMO_CAR))),
    )
  },
}

describe('plugins and scenarios', () => {
  it('registers a scenario, the vehicle and the texts of a plugin', () => {
    const kit = makeKit()
    kit.plugin(pack)
    expect(kit.plugins).toEqual(['test-pack'])
    expect(kit.scenarios.map((s) => s.id)).toEqual(['crashed'])
    expect(kit.groups).toEqual(['Test'])
    expect(kit.config.texts.who).toBe('the pilot')
    expect(kit.find('pack-car')?.name).toBe('Pack car')
  })

  it('runs a scenario: deterministic healths, flags and an effect text', () => {
    const kit = makeKit({ plugins: [pack] })
    const c = kit.build('proto', 'intact')
    const a = kit.zoneScenario(c, 'crashed')
    const b = kit.zoneScenario(kit.build('proto', 'intact'), 'crashed')
    expect(b).toEqual(a)
    expect(a.scenario).toBe('crashed')
    expect(a.flags).toEqual({ burnt: true })
    expect(a.health.roof).toBe(10)
    expect(a.health.bumper_front).toBeLessThan(100)
    expect(Object.keys(a.health).length).toBeGreaterThan(2)
    const hood = c.zones.find((z) => z.id === 'hood')!
    expect(kit.zoneEffect(hood, 38)).toBe('Bent')
  })

  it('applies a scenario to a vehicle and reports the new overall health', () => {
    const kit = makeKit({ plugins: [pack] })
    const c = kit.build('proto', 'intact')
    kit.applyZones(c, kit.zoneScenario(c, 'crashed'))
    expect(kit.zoneOverall(c).health).toBeLessThan(60)
    expect(c.zoneState.flags.burnt).toBe(true)
    expect(c.zones.find((z) => z.id === 'roof')!.band).toBe(3)
  })

  it('uses damagedScenario for the damaged state', () => {
    const kit = makeKit({ plugins: [pack] })
    const c = kit.build('proto', 'damaged')
    expect(c.zoneState.health.roof).toBe(10)
  })

  it('identifies a scenario by name too and ignores unknown ones', () => {
    const kit = makeKit({ plugins: [pack] })
    const c = kit.build('proto', 'intact')
    expect(kit.zoneScenario(c, 'Crashed nose').scenario).toBe('crashed')
    expect(kit.zoneScenario(c, 'nope')).toEqual({ health: {}, flags: {}, scenario: 'nope' })
  })

  it('rejects a scenario without id or zone()', () => {
    const kit = makeKit()
    expect(() => kit.scenario({ id: 'x' } as unknown as ScenarioDefinition)).toThrow()
  })

  it('runs the visual effect of a plugin flag', () => {
    const kit = makeKit()
    let applied = ''
    kit.configure({
      flagEffects: {
        glitter: {
          apply: (c, flags) => {
            applied = c.key + ':' + Object.keys(flags).join()
          },
        },
      },
    })
    kit.applyZones(kit.build('proto', 'intact'), { health: {}, flags: { glitter: true } })
    expect(applied).toBe('proto:glitter')
  })

  it('keeps kits independent', () => {
    const a = makeKit()
    const b = makeKit()
    a.plugin(pack)
    expect(b.scenarios).toHaveLength(0)
    expect(b.plugins).toHaveLength(0)
  })

  it('requires the THREE namespace', () => {
    expect(() => makeKit({ THREE: undefined as never }, false)).toThrow(/THREE/)
  })
})
