import { DEFERRED_PRIORITY, DEFERRED_QUEUE_ID, checkDeferredQueue } from '@adatechnology/game-contracts'
import type { DestructionEvent } from '@adatechnology/game-contracts'
import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { createFrameBudget } from '../../game-runtime/src'
import { THREE, houseOf, planOf } from './helpers/houses'
import { physicsOption } from './setup-physics'

type WallMaskLike = { readonly data: Uint8Array }
type Scene = ReturnType<typeof setup>

function setup() {
  const world = createDestruction({ seed: 5 })
  const scene = new THREE.Scene()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world })
  const houseRenderer = houseOf(planOf('sobrado', 3), { destruction: world, destructionRenderer: renderer })
  const { house } = houseRenderer
  scene.add(house.group)
  const d = house.destruction
  d.activate()
  return { d, house, world, scene, houseRenderer, paintQueue: houseRenderer.renderer.deferredQueue!(), cutQueue: houseRenderer.renderer.cutQueue!() }
}

const attach = (scene: Scene): void => {
  scene.cutQueue.attach?.()
  scene.paintQueue.attach?.()
}

const detach = (scene: Scene): void => {
  scene.cutQueue.detach?.()
  scene.paintQueue.detach?.()
}

/** Rifle rounds along the length of a wall: chips and spalls, no opening. */
const burstOn = (scene: Pick<Scene, 'house' | 'd' | 'world'>, id: string, rounds: number, energy = 3500): void => {
  const p = scene.house.structure.byId.get(id)!
  const along = p.aabb[2] - p.aabb[0] > p.aabb[3] - p.aabb[1]
  for (let k = 0; k < rounds; k++) {
    const x = along ? p.aabb[0] + 0.6 + k * 0.25 : (p.aabb[0] + p.aabb[2]) / 2
    const z = along ? (p.aabb[1] + p.aabb[3]) / 2 : p.aabb[1] + 0.6 + k * 0.25
    scene.world.hitPart(scene.d.id!, id, { type: 'ballistic', point: [x, (p.y0 + p.y1) / 2, z], direction: along ? [0, 0, -1] : [-1, 0, 0], energy, caliber: 7.62 })
  }
}

/** A blow that opens the wall (stage 2 with an opening, read when the event reaches the listeners after the breach's own). */
const openingOn = (scene: Scene, id: string): { cutPending: number; painted: string[] } => {
  const p = scene.house.structure.byId.get(id)!
  const seen = { cutPending: -1, painted: [] as string[] }
  scene.world.on('stage', (raw: DestructionEvent) => {
    const event = raw as Extract<DestructionEvent, { type: 'stage' }>
    if (event.part !== id || event.stage !== 2 || !event.opening) return
    seen.cutPending = scene.cutQueue.pending()
    seen.painted = paintedWalls(scene)
  })
  scene.world.hitPart(scene.d.id!, id, { type: 'blunt', point: [(p.aabb[0] + p.aabb[2]) / 2, (p.y0 + p.y1) / 2, (p.aabb[1] + p.aabb[3]) / 2], energy: 3e4, radius: 0.35, source: 'test' })
  for (let t = 0; t < 0.5; t += 0.05) scene.world.update(0.05)
  return seen
}

/** Every wall mask of the house, keyed by where its shell stands: the ones that carry paint. */
const masksOf = (scene: Scene): Map<string, string> => {
  const found = new Map<string, string>()
  scene.house.group.traverse((object) => {
    const mask = (object.userData as { breachMask?: { texture: { image: WallMaskLike } } }).breachMask
    if (!mask) return
    const box = new THREE.Box3().setFromObject(object)
    const centre = box.getCenter(new THREE.Vector3())
    found.set(`${centre.x.toFixed(3)},${centre.y.toFixed(3)},${centre.z.toFixed(3)}`, Array.from(mask.texture.image.data).join(','))
  })
  return found
}

const paintedWalls = (scene: Scene): string[] => [...masksOf(scene)].filter(([, texels]) => texels.includes('255')).map(([key]) => key)

/** The walls in the order the paint queue paints them (a painted wall has a units mesh named for it): one unit per call (a deadline already past). */
const paintOrder = (scene: Scene): string[] => {
  const order: string[] = []
  const unitMeshes = (): string[] => {
    const names: string[] = []
    scene.house.group.traverse((object) => { if (object.name.startsWith('breach:')) names.push(object.name) })
    return names
  }
  for (let guard = 0; guard < 1000 && scene.paintQueue.pending() > 0; guard++) {
    scene.paintQueue.pending(1)
    expect(scene.paintQueue.run(0, () => 1)).toBe(1)
    for (const name of unitMeshes()) if (!order.includes(name)) order.push(name)
  }
  return order
}

const chipsOnly = (scene: Scene): void => {
  burstOn(scene, 'wall_0_0', 3, 800)
  burstOn(scene, 'wall_0_1', 3, 800)
  burstOn(scene, 'wall_0_2', 3, 800)
}

const wallIds = (scene: Scene): string[] => scene.house.structure.parts.filter((part) => part.role === 'wall').map((part) => part.id)

/** Walls hit one by one, until `count` of them wait in the paint queue. */
const queueWalls = (scene: Scene, count: number, from = 0): number => {
  const ids = wallIds(scene)
  let used = from
  while (scene.paintQueue.pending() < count && used < ids.length) burstOn(scene, ids[used++]!, 3, 800)
  return used
}

/** The walls the queue paints in each frame, the budget spent every frame (a deadline already past). */
const paintedPerFrame = (scene: Scene, frames: number, firstFrame = 1): number[] => {
  const counts: number[] = []
  for (let frame = firstFrame; frame < firstFrame + frames; frame++) {
    scene.paintQueue.pending(frame)
    const before = scene.paintQueue.pending()
    scene.paintQueue.run(0, () => 1)
    counts.push(before - scene.paintQueue.pending())
  }
  return counts
}

describe('the cut queue gets the impact and the paint queue the rest, one wall a unit (spec 017, T3.1)', () => {
  it('walls with only chips and spalls wait in the paint queue: the cut queue has nothing and paints none of them', () => {
    const s = setup()
    attach(s)
    chipsOnly(s)
    expect(s.cutQueue.pending()).toBe(0)
    expect(s.paintQueue.pending()).toBeGreaterThan(1)
    expect(paintedWalls(s)).toEqual([])
    detach(s)
  })

  it('a wall that got an opening is painted by the cut queue, at the strike, and does not wait in the paint queue', () => {
    const s = setup()
    attach(s)
    const seen = openingOn(s, 'wall_0_0')
    expect(seen.cutPending).toBe(1)
    expect(seen.painted).toEqual([])
    expect(s.paintQueue.pending()).toBe(0)
    detach(s)
  })

  it('a wall that fell is painted at the strike and leaves the paint queue', () => {
    const s = setup()
    attach(s)
    burstOn(s, 'wall_0_1', 3, 800)
    const waiting = s.paintQueue.pending()
    expect(waiting).toBeGreaterThan(0)
    s.d.breach.drop('wall_0_1')
    expect(s.paintQueue.pending()).toBe(waiting - 1)
    expect(s.cutQueue.pending()).toBe(0)
    detach(s)
  })

  it('one paint unit paints one wall', () => {
    const s = setup()
    attach(s)
    chipsOnly(s)
    const waiting = s.paintQueue.pending(1)
    expect(s.paintQueue.run(0, () => 1)).toBe(1)
    expect(s.paintQueue.pending()).toBe(waiting - 1)
    expect(paintedWalls(s)).toHaveLength(1)
    detach(s)
  })

  it('the paint queue paints the last-struck wall first and then the others from the nearest to the farthest, not in the order they were queued', () => {
    const s = setup()
    const centre = (id: string): number[] => { const p = s.house.structure.byId.get(id)!; return [(p.aabb[0] + p.aabb[2]) / 2, (p.y0 + p.y1) / 2, (p.aabb[1] + p.aabb[3]) / 2] }
    const distanceFromLast = (id: string): number => Math.hypot(...centre(id).map((v, i) => v - centre('wall_0_1')[i]!) as [number, number, number])
    attach(s)
    // queued farthest first and the struck wall last
    for (const id of ['wall_0_2', 'wall_0_0', 'wall_0_1']) burstOn(s, id, 3, 800)
    const others = ['wall_0_0', 'wall_0_2'].sort((a, b) => distanceFromLast(a) - distanceFromLast(b) || (a < b ? -1 : 1))
    expect(paintOrder(s).filter((name) => ['wall_0_0', 'wall_0_1', 'wall_0_2'].includes(name.slice('breach:'.length)))).toEqual(['wall_0_1', ...others].map((id) => `breach:${id}`))
    detach(s)
  })

  it('the paint queue asks the budget to run it every frame and keeps it out of the mustDrain', () => {
    expect(DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.BREACH_PAINT].minEveryFrames).toBe(1)
    expect(DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.BREACH_PAINT]).not.toHaveProperty('mustDrain')
  })

  it('with the budget spent every frame, every waiting wall is painted within 3 frames of the strike', () => {
    const s = setup()
    attach(s)
    const walls = s.house.structure.parts.filter((part) => part.role === 'wall').map((part) => part.id)
    for (const id of walls) burstOn(s, id, 3, 800)
    const waiting = s.paintQueue.pending()
    expect(waiting).toBeGreaterThan(5)
    let frames = 0
    while (s.paintQueue.pending() > 0 && frames < 100) {
      frames++
      s.paintQueue.pending(frames)
      s.paintQueue.run(0, () => 1)
    }
    expect(frames).toBeLessThanOrEqual(3)
    detach(s)
  })

  it('with room in the frame deadline the queue paints more than one wall in a frame, and stops at the deadline', () => {
    const s = setup()
    attach(s)
    for (const id of s.house.structure.parts.filter((part) => part.role === 'wall').map((part) => part.id)) burstOn(s, id, 3, 800)
    const waiting = s.paintQueue.pending()
    s.paintQueue.pending(1)
    let now = 0
    const ran = s.paintQueue.run(3, () => now++)
    expect(ran).toBeGreaterThan(1)
    expect(ran).toBeLessThan(waiting)
    detach(s)
  })

  it('a wall is painted even when the distance to the last strike is not a number', () => {
    const s = setup()
    attach(s)
    chipsOnly(s)
    const point = [Number.NaN, Number.NaN, Number.NaN]
    s.d.breach.spall({ type: 'spall', part: 'wall_0_1', point, area: 0.05 } as Parameters<typeof s.d.breach.spall>[0])
    expect(s.paintQueue.pending()).toBeGreaterThan(0)
    paintOrder(s)
    expect(s.paintQueue.pending()).toBe(0)
    detach(s)
  })

  it('a blow that opens a wall whose paint was waiting moves it to the cut queue, but later chips and spalls do not', () => {
    const s = setup()
    attach(s)
    chipsOnly(s)
    expect(s.paintQueue.pending()).toBeGreaterThan(1)
    s.cutQueue.pending(1)
    s.cutQueue.pending(2)
    burstOn(s, 'wall_0_1', 6, 800)
    expect(s.cutQueue.pending()).toBe(0)
    expect(s.paintQueue.pending()).toBeGreaterThan(0)
    // the age of the waiting walls did not start over: at tick 3 they are all overdue
    s.paintQueue.pending(3)
    expect(s.paintQueue.run(0, () => 1)).toBeGreaterThan(1)
    expect(s.paintQueue.pending()).toBe(0)
    const opened = openingOn(s, 'wall_0_0')
    expect(opened.cutPending).toBe(1)
    detach(s)
  })

  it('a second strike in the same frame does not move a waiting wall to the cut queue', () => {
    const s = setup()
    attach(s)
    burstOn(s, 'wall_0_1', 3, 800)
    burstOn(s, 'wall_0_1', 2, 800)
    expect(s.cutQueue.pending()).toBe(0)
    detach(s)
  })

  it('dropping a wall or restoring the house leaves both queues clean', () => {
    const s = setup()
    attach(s)
    chipsOnly(s)
    s.d.breach.drop('wall_0_1')
    s.d.breach.restore()
    expect(s.paintQueue.pending()).toBe(0)
    expect(s.cutQueue.pending()).toBe(0)
    detach(s)
  })

  it('the paint queue keeps the deferred-queue contract', () => {
    const s = setup()
    const report = checkDeferredQueue(s.paintQueue, () => chipsOnly(s))
    expect(report.problems).toEqual([])
  })

  it('without a host the walls are painted at the strike, as before', () => {
    const s = setup()
    burstOn(s, 'wall_0_1', 3, 800)
    expect(s.cutQueue.pending()).toBe(0)
    s.d.breach.flush(Infinity)
    expect(paintedWalls(s).length).toBeGreaterThan(0)
    expect(s.paintQueue.pending()).toBe(0)
  })

  it('21 walls queued in one frame (the walls hit and the pillars in them) with the deadline always past are painted 1, 10 and 10 in the next three frames', () => {
    const s = setup()
    attach(s)
    queueWalls(s, 20)
    expect(s.paintQueue.pending()).toBe(21)
    expect(paintedPerFrame(s, 4)).toEqual([1, 10, 10, 0])
    detach(s)
  })

  it('with mixed ages the quota counts only the walls of earlier frames, and a lone shot with room in the deadline is painted in its own frame', () => {
    const s = setup()
    attach(s)
    const used = queueWalls(s, 6)
    expect(paintedPerFrame(s, 1)).toEqual([1])
    const older = s.paintQueue.pending()
    // the next frame's strike lands before its drain polls the queue
    burstOn(s, wallIds(s)[used]!, 3, 800)
    expect(s.paintQueue.pending()).toBeGreaterThan(older)
    s.paintQueue.pending(2)
    expect(s.paintQueue.run(0, () => 1)).toBe(Math.ceil(older / 2))
    detach(s)

    const lone = setup()
    attach(lone)
    burstOn(lone, 'wall_0_1', 3, 800)
    expect(lone.paintQueue.pending()).toBeGreaterThan(0)
    lone.paintQueue.pending(1)
    let now = 0
    lone.paintQueue.run(1e9, () => now++)
    expect(lone.paintQueue.pending()).toBe(0)
    detach(lone)
  })

  it('a wall queued in frame 2 is painted by frame 4, and the walls queued before it keep their own window', () => {
    const s = setup()
    attach(s)
    const used = queueWalls(s, 12)
    expect(paintedPerFrame(s, 1)).toEqual([1])
    const before = s.paintQueue.pending()
    burstOn(s, wallIds(s)[used]!, 3, 800)
    const late = s.paintQueue.pending() - before
    expect(late).toBeGreaterThan(0)
    const counts = paintedPerFrame(s, 3, 2)
    expect(s.paintQueue.pending()).toBe(0)
    expect(counts.reduce((sum, n) => sum + n, 0)).toBe(before + late)
  })

  it('a house that keeps being hit does not hold back the overdue walls of another house of the renderer', () => {
    const a = setup()
    const houseB = a.houseRenderer.renderer.build(planOf('sobrado', 4), { quality: 'high', night: false })
    a.scene.add(houseB.group)
    houseB.destruction.activate()
    const b: Scene = { ...a, house: houseB, d: houseB.destruction }
    attach(a)
    queueWalls(b, 5)
    expect(b.d.breach.deferredQueue().pending()).toBe(5)
    const ids = wallIds(a)
    for (let frame = 1; frame <= 3; frame++) {
      a.paintQueue.pending(frame)
      burstOn(a, ids[frame - 1]!, 3, 800)
      a.paintQueue.run(0, () => 1)
    }
    expect(b.d.breach.deferredQueue().pending()).toBe(0)
    detach(a)
  })

  it('a queue run with no frame number counts as a frame: the window still closes', () => {
    const s = setup()
    attach(s)
    queueWalls(s, 9)
    for (let run = 0; run < 3 && s.paintQueue.pending() > 0; run++) s.paintQueue.run(0, () => 1)
    expect(s.paintQueue.pending()).toBe(0)
    detach(s)
  })

  it('the real frame budget, spent every frame, paints every waiting wall within 3 frames', () => {
    const s = setup()
    const budget = createFrameBudget({ ms: 0, clock: () => 0 })
    const stopCut = budget.register(s.cutQueue, { ...DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.BREACH_CUT], mustDrain: true })
    const stopPaint = budget.register(s.paintQueue, DEFERRED_PRIORITY[DEFERRED_QUEUE_ID.BREACH_PAINT])
    queueWalls(s, 20)
    expect(s.paintQueue.pending()).toBe(21)
    const left: number[] = []
    for (let frame = 0; frame < 3; frame++) {
      budget.drain('present')
      budget.drain('idle')
      left.push(s.paintQueue.pending())
    }
    expect(left[2]).toBe(0)
    expect(left[0]).toBeLessThan(21)
    stopPaint()
    stopCut()
  })

  it('no strike point is kept while no frame budget owns the paint queue', () => {
    const s = setup()
    chipsOnly(s)
    s.d.breach.flush(Infinity)
    expect(paintedWalls(s).length).toBeGreaterThan(0)
  })
})
