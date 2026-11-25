import { describe, expect, it } from 'vitest'

import { createTerrain } from '@adatechnology/game-terrain'
import type { Crater } from '@adatechnology/game-urban/networks'

import { createHouseBuriedPipes } from '../src/construction-stages/buried-pipes'
import { THREE, houseOf, planOf } from './helpers/houses'

interface Piece { readonly points: readonly (readonly number[])[]; readonly bore: number }

/** PG-7V (RPG-7) as the destruction world hands it to the ground: 200 kJ on the arsenal's scale, its charge 0.45 kg of TNT. */
const PG7V = { energy: 200_000, tnt: 0.45, radius: 16 } as const

/** The finished house turned and moved as the houses area lays it. */
function placedHouse(): ReturnType<typeof houseOf>['house'] {
  const { house } = houseOf(planOf('single_storey_a', 1), {}, { quality: 'game', constructionStages: true })
  house.group.rotation.y = Math.PI
  house.group.position.set(6, 0, 7)
  house.group.updateMatrixWorld(true)
  return house
}

/** A world point over a stretch of the house's sewer or rain pipes, at a share of its length (the last sewer piece is the collector, from under the house to the box at the front of the lot). */
function over(house: ReturnType<typeof placedHouse>, network: 'sewer' | 'rain', share: number, piece?: number): THREE.Vector3 {
  const stage = house.group.getObjectByName('stage:4:installations')!
  const pieces = (stage.userData[network] as { pieces: Piece[] }).pieces
  const points = pieces[piece ?? pieces.length - 1]!.points
  const [from, to] = [points[points.length - 2]!, points[points.length - 1]!]
  return new THREE.Vector3(from[0]! + (to[0]! - from[0]!) * share, 0, from[2]! + (to[2]! - from[2]!) * share).applyMatrix4(stage.matrixWorld)
}

/** The yard's soil, and the bowl each blast at `at` leaves in it as the host tells it (`onCrater`: the floor as deep as the column is now). */
function yard(): (at: THREE.Vector3, hit: { readonly energy: number; readonly tnt?: number; readonly radius: number }) => Crater {
  const terrain = createTerrain({ bounds: [-30, -30, 30, 30], cellSize: 0.1, layout: { surface: 'dirt' } })
  return (at, hit) => {
    const result = terrain.applyHit({ type: 'explosive', point: [at.x, 0, at.z], ...hit })!
    return { x: result.point[0], z: result.point[2], radius: result.radius, depth: result.totalDepth }
  }
}

describe("the house's buried pipes and the craters in its yard", () => {
  it('reads the sewer and the rain pipes under the yard, at their depths (NBR 8160 / 10844)', () => {
    const pipes = createHouseBuriedPipes(THREE, placedHouse().group)!.pipes
    expect(pipes.some((pipe) => pipe.content === 'sewage')).toBe(true)
    for (const pipe of pipes) expect(pipe.ground[0] - (pipe.from[1] + pipe.diameter / 2)).toBeGreaterThan(0.2)
  })

  it('an RPG by the downpipe breaks the rain pipe under it (0.25 m of cover): it shows in the hole and, in the rain, runs', () => {
    const house = placedHouse()
    const buried = createHouseBuriedPipes(THREE, house.group)!
    const { breach, leaks } = buried.crater(yard()(over(house, 'rain', 0.05, 0), PG7V), { isRaining: true })
    expect(breach.pipes.some((pipe) => pipe.content === 'stormwater' && pipe.severed)).toBe(true)
    expect(leaks.some((leak) => leak.content === 'stormwater' && leak.rate > 0)).toBe(true)
    expect(house.group.getObjectByName('buried_pipes')!.children.length).toBeGreaterThanOrEqual(2)
    buried.dispose()
  })

  it('the collector at the front of the lot (half a metre down) is broken by a second RPG in the same hole, and leaks sewage', () => {
    const house = placedHouse()
    const buried = createHouseBuriedPipes(THREE, house.group)!
    const blast = yard()
    const at = over(house, 'sewer', 0.9)
    const first = buried.crater(blast(at, PG7V), { isRaining: false })
    expect(first.breach.pipes.filter((pipe) => pipe.content === 'sewage' && pipe.severed)).toHaveLength(0)
    const { breach, leaks } = buried.crater(blast(at, PG7V), { isRaining: false })
    expect(breach.pipes.some((pipe) => pipe.content === 'sewage' && pipe.severed)).toBe(true)
    expect(leaks.some((leak) => leak.content === 'sewage' && leak.rate > 0 && leak.volume > 0)).toBe(true)
    const drawn = house.group.getObjectByName('buried_pipes')!
    expect(drawn.children.length).toBeGreaterThanOrEqual(2)
    // the same pipe is not broken twice
    expect(buried.crater(blast(at, PG7V), { isRaining: false }).leaks).toHaveLength(0)
    buried.reset()
    expect(drawn.children).toHaveLength(0)
    buried.dispose()
    expect(house.group.getObjectByName('buried_pipes')).toBeUndefined()
  })

  it('a bowl that does not get down to the pipe leaves it whole and buried', () => {
    const house = placedHouse()
    const buried = createHouseBuriedPipes(THREE, house.group)!
    const { breach, leaks } = buried.crater(yard()(over(house, 'sewer', 0.9), PG7V), { isRaining: false })
    expect(breach.pipes).toHaveLength(0)
    expect(leaks).toHaveLength(0)
    expect(house.group.getObjectByName('buried_pipes')!.children).toHaveLength(0)
    buried.dispose()
  })
})
