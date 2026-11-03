import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { IMPACT_CONTRACT, MISSING_BITS, checkAnimation, checkDestructible, checkHit, shotExtras, shotToHit } from '../src'
import type { AnimationClipSpec, DestructibleImpl, DestructionEvent, HostEvent, Hit, ModuleHost, ObjectState, PlayerState, Shot, TestableModule } from '../src'

/** A tiny module-owned destructible: one panel that dents by its own rule. */
const panelImpl = (id = 'panel_1', material = 'steel'): DestructibleImpl => {
  let hp = 100
  const spec = () => ({ parts: [{ id: 'panel', material, shape: { kind: 'box' as const, size: [1, 1, 0.01] as [number, number, number] }, position: [0, 0.5, 0] as [number, number, number] }] })
  return {
    id,
    describe: spec,
    hit(hit: Hit): DestructionEvent[] {
      hp = Math.max(0, hp - (hit.energy ?? 0) * 0.01)
      return [{ type: 'damage', object: id, time: 0, part: 'panel', amount: 1, hp, damageType: hit.type }]
    },
    state(): ObjectState {
      return { id, position: [0, 0, 0], rotation: [0, 0, 0, 1], destroyed: false, groups: [['panel']], joints: [], parts: [{ id: 'panel', material, status: 'intact', hp, maxHp: 100, mass: 5, temperature: 20, burning: false, fuel: 0, char: 0, melt: 0, dents: [], holes: [], cracks: [], group: 0 }] } as unknown as ObjectState
    },
  }
}

const shot = (over: Partial<Shot> = {}): Shot => ({
  origin: [0, 1, 0],
  direction: [0, 0, -1],
  energy: 500,
  caliber: 9,
  caliberId: '9x19',
  speed: 380,
  energyAt: (d) => 500 * Math.max(0, 1 - d * 0.002),
  pellet: 0,
  weapon: 'pistol_9mm',
  ...over,
})

describe('impact contract', () => {
  it('lists the fields per damage type and checks hits against it', () => {
    expect(IMPACT_CONTRACT.ballistic.required).toEqual(['type', 'point', 'direction', 'energy', 'caliber'])
    expect(checkHit({ type: 'ballistic', point: [0, 0, 0], direction: [0, 0, 1], energy: 500, caliber: 9 })).toEqual([])
    expect(checkHit({ type: 'ballistic', point: [0, 0, 0], energy: 500 })).toEqual(['ballistic hit needs "direction"', 'ballistic hit needs "caliber"'])
    expect(checkHit({ type: 'fire', point: [0, 0, 0], temperature: Number.NaN, radius: 1 })).toEqual(['fire hit needs "temperature"'])
    expect(checkHit({ type: 'nope' as Hit['type'], point: [0, 0, 0] })[0]).toMatch(/unknown damage type/)
  })

  it('the cost contract: opt-in, passes a cached impl and reports one that rebuilds its state on every read', () => {
    const cached = panelImpl()
    const state = cached.state()
    const spec = cached.describe()
    expect(checkDestructible({ ...cached, state: () => state, describe: () => spec }, { cost: true })).toEqual({ ok: true, problems: [] })
    expect(checkDestructible(cached).ok).toBe(true)
    const rebuilding = checkDestructible(panelImpl(), { cost: true })
    expect(rebuilding.problems).toContain('state() returns a new object on each read: cache it between changes (cost contract)')
    expect(rebuilding.problems).toContain('describe() returns a new object on each read: cache it between changes (cost contract)')
    const slow = { ...cached, state: () => state, describe: () => { const end = performance.now() + 0.01; while (performance.now() < end); return spec } }
    expect(checkDestructible(slow, { cost: { reads: 200, ceilingMs: 0.1 } }).problems.join()).toMatch(/describe\(\) took/)
  })

  it('the cost contract flags an impl that keeps allocating while it returns the same object', () => {
    const cached = panelImpl()
    const state = cached.state()
    const spec = cached.describe()
    const retained: number[][] = []
    const leaking = { ...cached, state: () => state, describe: () => { retained.push(new Array<number>(4096).fill(1)); return spec } }
    const result = checkDestructible(leaking, { cost: { reads: 2000, allocationBytes: 1000, ceilingMs: 10_000 } })
    expect(result.problems.join()).toMatch(/describe\(\) grew the heap by/)
  })

  it('checkDestructible needs no world: it hits the impl and validates the shape of everything', () => {
    expect(checkDestructible(panelImpl())).toEqual({ ok: true, problems: [] })
  })

  it('takes the known materials as an option and rejects the others', () => {
    expect(checkDestructible(panelImpl('p', 'unobtainium'), { materials: ['steel'] }).problems).toEqual(['part "panel" has unknown material "unobtainium"'])
    expect(checkDestructible(panelImpl('p', 'unobtainium'), { materials: ['steel', 'unobtainium'] }).ok).toBe(true)
  })

  it('reports an impl that breaks the contract', () => {
    const bad = panelImpl('bad')
    bad.hit = () => [{ type: 'damage', object: 'someone_else', time: 0, part: 'ghost', amount: 1, hp: 1, damageType: 'ballistic' }]
    const r = checkDestructible(bad)
    expect(r.ok).toBe(false)
    expect(r.problems.join('\n')).toMatch(/expected "bad"/)
    expect(r.problems.join('\n')).toMatch(/unknown part "ghost"/)
    expect(checkDestructible({ ...panelImpl(), describe: () => ({ parts: [] }) }).problems).toEqual(['describe() must return at least one part'])
  })
})

describe('weapon contract', () => {
  it('shotToHit makes the ballistic hit with the energy left at that distance', () => {
    const h = shotToHit(shot({ source: 'player_1' }), [0, 1, -50])
    expect(h).toMatchObject({ type: 'ballistic', point: [0, 1, -50], direction: [0, 0, -1], caliber: 9, source: 'player_1' })
    expect(h.energy).toBeCloseTo(450, 5)
    expect(checkHit(h)).toEqual([])
    expect(shotToHit(shot(), [0, 1, 0], [0, 0, 1]).source).toBe('pistol_9mm')
    expect(shotToHit(shot(), [0, 1, 0]).energy).toBe(500)
  })

  it('shotToHit carries the round: penetration scaled by the energy left, the flags and the ignition chances', () => {
    const round = { penetration: { steel: 10, concrete: 100 }, incendiary: true, tracer: true, ignition: { spark: 0.05, flame: 0.5 }, ammo: 'incendiary' }
    const s = shot({ ...round })
    const near = shotToHit(s, [0, 1, 0])
    expect(near.penetration).toEqual({ steel: 10, concrete: 100 })
    expect(near).toMatchObject({ incendiary: true, tracer: true, ignition: { spark: 0.05, flame: 0.5 } })
    const far = shotToHit(s, [0, 1, -50])
    expect(far.penetration!.steel).toBeCloseTo(9, 5) // 450 J of 500 J
    expect(shotExtras(s, 50).penetration).toEqual(far.penetration)
    expect(shotToHit(shot(), [0, 1, 0]).penetration).toBeUndefined()
    expect(shotToHit(shot(), [0, 1, 0]).incendiary).toBeUndefined()
    expect(checkHit(far)).toEqual([])
  })

  it('shotToHit copies the projectile mass and leaves the field out when the shot has none', () => {
    expect(shotToHit(shot({ mass: 7.5 }), [0, 1, -5]).mass).toBe(7.5)
    expect('mass' in shotToHit(shot(), [0, 1, -5])).toBe(false)
  })
})

describe('body contract', () => {
  it('MISSING_BITS is the mask the instanced body shader reads: ten distinct bits', () => {
    const values = Object.values(MISSING_BITS)
    expect(values).toEqual([1, 2, 4, 8, 16, 32, 64, 128, 256, 512])
    expect(new Set(values).size).toBe(values.length)
  })
})

describe('animation contract', () => {
  const pistolReload: AnimationClipSpec = {
    id: 'reload',
    duration: 2,
    keys: [{ t: 0 }, { t: 0.5, rotation: [0.2, 0, 0], parts: { mag: { position: [0, -0.1, 0] } } }, { t: 2, parts: { mag: { position: [0, 0, 0] } } }],
    events: [{ t: 0.6, type: 'sound', data: { key: 'mag_out' } }],
  }

  it('accepts a good clip and checks the part ids', () => {
    expect(checkAnimation(pistolReload, ['body', 'mag'])).toEqual({ ok: true, problems: [] })
    expect(checkAnimation(pistolReload, ['body']).problems).toEqual(['clip "reload" key 1 moves unknown part "mag"', 'clip "reload" key 2 moves unknown part "mag"'])
  })

  it('finds bad times, vectors and ids', () => {
    const bad: AnimationClipSpec = {
      id: 'Bad Id',
      duration: 1,
      keys: [{ t: 0.5 }, { t: 0.2 }, { t: 3 }, { t: 0.9, position: [0, Number.NaN, 0] }],
      events: [{ t: -1, type: '' }],
    }
    const p = checkAnimation(bad, []).problems.join('\n')
    expect(p).toMatch(/snake_case/)
    expect(p).toMatch(/key 1 goes back in time/)
    expect(p).toMatch(/key 2 has t=3 outside/)
    expect(p).toMatch(/key 3 has an invalid position/)
    expect(p).toMatch(/event 0 has t=-1/)
    expect(p).toMatch(/event 0 needs a type/)
    expect(checkAnimation({ id: 'x', duration: 0, keys: [] }, []).problems).toEqual(['clip "x" needs a positive finite duration', 'clip "x" needs at least one key'])
  })
})

describe('testable module', () => {
  it('is plain data a module can build without three.js or a world', () => {
    const mod: TestableModule = {
      id: 'toys',
      name: 'Toys',
      group: 'Toys',
      items: (locale) => [{ id: 'panel', name: locale === 'pt-BR' ? 'Painel' : 'Panel', build: () => ({}), impl: (_root, id) => panelImpl(id) }],
      scenarios: () => [{ id: 'noop', name: 'Nothing', run: () => undefined }],
    }
    const item = mod.items('pt-BR')[0]
    expect(item.name).toBe('Painel')
    expect(checkDestructible(item.impl!({}, 'panel_1')).ok).toBe(true)
  })

  it('has no runtime dependencies', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as Record<string, unknown>
    expect(pkg.dependencies).toBeUndefined()
    expect(pkg.peerDependencies).toBeUndefined()
  })
})

describe('player state', () => {
  it('is what the host reports and a player event carries nothing more', () => {
    const state: PlayerState = { position: [1, 0, -2], yaw: 0.5, pitch: -0.1, crouching: true, speed: 1, running: false, cameraMode: 'first' }
    const host: Pick<ModuleHost, 'player'> = { player: () => state }
    const events: HostEvent[] = [{ type: 'player' }]
    expect(host.player().crouching).toBe(true)
    expect(host.player().position).toEqual([1, 0, -2])
    expect(events[0]?.type).toBe('player')
  })
})
