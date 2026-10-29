import { assemblyPart, createDestruction, sizeStructure } from '../src'
import type { DestructibleSpec, DestructionEvent, DestructionOptions, JointSpec, PartSpec, SizeStructureOptions } from '../src'

/** A wall specimen the size ARS uses (2.4 x 2.1 m) as the only part of an object. */
export const wallSpec = (assembly: string, id = 'wall'): DestructibleSpec => ({
  parts: [assemblyPart(assembly, { id, width: 2.4, height: 2.1, position: [0, 1.05, 0] })],
})

/** A world with one wall specimen and a recorder of every event. */
export const wallWorld = (assembly: string, options: DestructionOptions = {}) => {
  const world = createDestruction({ seed: 7, ...options })
  const objectId = world.add(wallSpec(assembly))
  const events: DestructionEvent[] = []
  world.on('*', (event) => events.push(event))
  return { world, objectId, events }
}

export const countByType = (events: readonly DestructionEvent[]): Record<string, number> => {
  const counts: Record<string, number> = {}
  for (const event of events) counts[event.type] = (counts[event.type] ?? 0) + 1
  return counts
}

export const ofType = <T extends DestructionEvent['type']>(events: readonly DestructionEvent[], type: T): Array<Extract<DestructionEvent, { type: T }>> =>
  events.filter((event): event is Extract<DestructionEvent, { type: T }> => event.type === type)

export const maxStage = (events: readonly DestructionEvent[]): number => Math.max(0, ...ofType(events, 'stage').map((event) => event.stage))

export const runFor = (world: ReturnType<typeof createDestruction>, seconds: number, step = 0.1): DestructionEvent[] => {
  const events: DestructionEvent[] = []
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += step) events.push(...world.update(step))
  return events
}

const REBAR_SLAB = { material: 'steel', spacing: 0.18, diameter: 0.008, residualCapacity: 0.15 } as const

const rcColumn = (id: string, x: number, z: number): PartSpec => ({
  id, material: 'concrete', shape: { kind: 'box', size: [0.3, 3, 0.3] }, position: [x, 1.5, z], structure: { role: 'column' },
  reinforcement: { ...REBAR_SLAB }, breach: { area: 0.25 },
})

const foundation = (id: string, x: number, z: number): PartSpec => ({
  id, material: 'concrete', shape: { kind: 'box', size: [0.8, 0.3, 0.8] }, position: [x, -0.15, z], structure: { role: 'foundation' },
})

const supports = (columns: ReadonlyArray<[string, number, number]>): { parts: PartSpec[]; joints: JointSpec[] } => ({
  parts: columns.flatMap(([id, x, z]) => [foundation(`f_${id}`, x, z), rcColumn(id, x, z)]),
  joints: columns.flatMap(([id]) => [{ a: id, b: `f_${id}`, kind: 'rebar' as const, bears: 'a_on_b' as const }, { a: 'slab', b: id, kind: 'rebar' as const, bears: 'a_on_b' as const }]),
})

const slabOf = (width: number, depth: number): PartSpec => ({
  id: 'slab', material: 'concrete', shape: { kind: 'box', size: [width, 0.2, depth] }, position: [0, 3.1, 0], structure: { role: 'slab' },
  reinforcement: { ...REBAR_SLAB }, breach: { area: 0.25 },
})

/** Two reinforced columns under a slab and a roof: the smallest structure where losing a column drives the slab down. */
export const gateSpec = (): DestructibleSpec => {
  const base = supports([['c0', -1.5, 0], ['c1', 1.5, 0]])
  return {
    name: 'gate',
    parts: [...base.parts, slabOf(4.2, 2.4), { id: 'roof', material: 'wood_soft', shape: { kind: 'box', size: [4.4, 0.1, 2.6] }, position: [0, 3.25, 0], structure: { role: 'roof' } }],
    joints: [...base.joints, { a: 'roof', b: 'slab', kind: 'screw', bears: 'a_on_b' }],
  }
}

export const HOUSE_SIZING: SizeStructureOptions = {
  safety: 0.65, redundancy: 0.97, redundancyRoles: ['column', 'wall'], safetyByRole: { beam: 0.45, slab: 0.45, roof: 0.45, stair: 0.45 },
}

/**
 * Structural equivalent of the AC house: reinforced columns under a reinforced slab and a roof, brick partitions between the columns, a window,
 * a water tank and a gas bottle next to a partition. Sized like a house (N-1 over columns and walls, slab and roof at 0.45).
 */
export const houseSpec = (): DestructibleSpec => {
  const base = supports([['c0', -2.4, -1.8], ['c1', 2.4, -1.8], ['c2', -2.4, 1.8], ['c3', 2.4, 1.8]])
  const partition = (id: string, z: number): PartSpec => assemblyPart('brick_wall_plastered', {
    id, width: 4.5, height: 2.8, position: [0, 1.5, z], structure: { role: 'partition' },
  })
  const parts: PartSpec[] = [
    ...base.parts, slabOf(5.4, 4.2),
    { id: 'roof', material: 'wood_soft', shape: { kind: 'box', size: [5.6, 0.1, 4.4] }, position: [0, 3.25, 0], structure: { role: 'roof' } },
    partition('wall_back', -1.8), partition('wall_front', 1.8),
    assemblyPart('glass_pane', { id: 'window', width: 1, height: 1, position: [0, 1.4, 1.95] }),
    {
      id: 'tank', material: 'plastic', shape: { kind: 'cylinder', radius: 0.5, height: 1.2 }, position: [0.9, 0.6, -0.9], thickness: 0.005,
      contains: { fluid: 'water', liters: 1000 },
    },
    {
      id: 'bottle', material: 'steel', shape: { kind: 'cylinder', radius: 0.15, height: 0.5 }, position: [-1.9, 0.25, 1.3], thickness: 0.003,
      contains: { fluid: 'gas', liters: 13, pressurized: true }, explodes: { energy: 60000, radius: 6, atC: 300 },
    },
  ]
  const joints: JointSpec[] = [
    ...base.joints, { a: 'roof', b: 'slab', kind: 'screw', bears: 'a_on_b' },
    ...['c0', 'c1'].map((c) => ({ a: 'wall_back', b: c, kind: 'mortar' as const, bears: 'a_on_b' as const })),
    ...['c2', 'c3'].map((c) => ({ a: 'wall_front', b: c, kind: 'mortar' as const, bears: 'a_on_b' as const })),
  ]
  return sizeStructure({ name: 'house', parts, joints }, HOUSE_SIZING)
}
