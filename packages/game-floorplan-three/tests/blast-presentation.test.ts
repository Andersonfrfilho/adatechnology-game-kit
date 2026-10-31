import { createHash } from 'node:crypto'

import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { THREE, houseOf, planOf } from './helpers/houses'

const BLAST_ENERGY = 4e6
const BLAST_RADIUS = 6
// sha1 of the results, events and state of that blast on this house, taken before the solver remembered the contact boxes of its parts
const RECORDED_BLAST_OUTCOME = '66e69f55179c303ee6995a69f99198b8644c2929'

function setup(paintBudgetMs?: number, isDrawn = true) {
  const world = createDestruction({ seed: 5 })
  const scene = new THREE.Scene()
  const renderer = createDestructionRenderer(THREE, { scene, world })
  const { house } = houseOf(planOf('sobrado', 3), { destruction: world, ...(isDrawn ? { destructionRenderer: renderer } : {}), ...(paintBudgetMs !== undefined ? { breachPaintBudgetMs: paintBudgetMs } : {}) })
  scene.add(house.group)
  const d = house.destruction
  d.activate()
  const events: any[] = []
  world.on('*', (event: any) => events.push(event))
  const wall = house.structure.byId.get('wall_0_0')
  const point: [number, number, number] = [(wall.aabb[0] + wall.aabb[2]) / 2, (wall.y0 + wall.y1) / 2, (wall.aabb[1] + wall.aabb[3]) / 2 + 0.4]
  const centre = (id: string): [number, number, number] => { const p = house.structure.byId.get(id); return [(p.aabb[0] + p.aabb[2]) / 2, (p.y0 + p.y1) / 2, (p.aabb[1] + p.aabb[3]) / 2] }
  return { world, renderer, house, d, events, point, centre }
}

const outcomeOf = (world: ReturnType<typeof createDestruction>, id: string) => world.state(id)?.parts.map((part) => [part.id, part.status, part.hp, part.stage])

describe('the blast of a house', () => {
  it('has the same events and part states with the house drawing it as with the bare world', () => {
    const { world, d, events, point } = setup()
    const state = world.state(d.id)!
    const bare = createDestruction({ seed: 5 })
    bare.add(d.spec, { id: d.id, position: state.position, rotation: state.rotation })
    const bareEvents: any[] = []
    bare.on('*', (event: any) => bareEvents.push(event))
    world.explode(point, BLAST_ENERGY, BLAST_RADIUS)
    bare.explode(point, BLAST_ENERGY, BLAST_RADIUS)
    expect(events.length).toBeGreaterThan(0)
    expect(events.some((event) => event.type === 'spall' || event.type === 'chip' || event.type === 'stage')).toBe(true)
    expect(events).toEqual(bareEvents)
    expect(outcomeOf(world, d.id)).toEqual(outcomeOf(bare, d.id))
  })

  it('keeps the outcome the solver gave before it remembered the contact boxes of the parts', () => {
    const { world, d, point } = setup(undefined, false)
    const state = world.state(d.id)!
    const bare = createDestruction({ seed: 5 })
    bare.add(d.spec, { id: d.id, position: state.position, rotation: state.rotation })
    const events: any[] = []
    bare.on('*', (event: any) => events.push(event))
    const results = bare.explode(point, BLAST_ENERGY, BLAST_RADIUS)
    bare.update(0.05)
    bare.update(0.05)
    const outcome = JSON.stringify({ r: results, events, state: bare.state(d.id) })
    expect(createHash('sha1').update(outcome).digest('hex')).toBe(RECORDED_BLAST_OUTCOME)
  })

  it('paints the plaster chipped off each wall once per frame within the budget, and all of them in the end', () => {
    const { world, d, house, centre } = setup(0)
    const shotWalls = ['wall_0_0', 'wall_0_1', 'wall_0_2']
    for (const id of shotWalls) world.hitPart(d.id, id, { type: 'ballistic', point: centre(id), direction: [0, 0, -1], energy: 500, caliber: 9 })
    const walls = [...house.structure.byId.keys()].filter((id) => d.breach.has(id)).length
    expect(walls).toBeGreaterThan(1)
    let waiting = d.breach.flush(0)
    expect(waiting).toBe(walls - 1)
    while (waiting > 0) {
      const before = waiting
      waiting = d.breach.flush(0)
      expect(waiting).toBe(before - 1)
    }
    expect(d.breach.statistics().walls).toBe(walls)
    expect(d.breach.statistics().flakes).toBeGreaterThan(0)
  })

  it('leaves no damage waiting once the frame that follows the blast has run', () => {
    const { world, renderer, d, point } = setup()
    world.explode(point, BLAST_ENERGY, BLAST_RADIUS)
    world.update(0.016)
    renderer.update(0.016)
    d.animate(0.016)
    expect(d.breach.flush(0)).toBe(0)
  })
})
