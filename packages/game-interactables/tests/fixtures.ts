import type { ItemCatalog, LootTables, ObjectSpec, WorldEvent, WorldOptions } from '../src'
import { createWorld } from '../src'

export const origin = { x: 0, y: 0, z: 0, ry: 0 }

export const items: ItemCatalog = {
  can: { id: 'can', category: 'food', size: [0.07, 0.11, 0.07], weight: 0.4, stack: 6 },
  big: { id: 'big', category: 'misc', size: [0.6, 0.6, 0.6], weight: 4 },
  statue: { id: 'statue', category: 'misc', size: [0.1, 0.1, 0.1], weight: 9, pickable: false },
}

export const loot: LootTables = { pantry: { fill: 1, entries: [{ type: 'can', weight: 1, qty: [1, 3] }, { type: 'big', weight: 1 }] } }

export function world(options: WorldOptions = {}) {
  const events: WorldEvent[] = []
  const w = createWorld({ items, loot, seed: 'test', ...options, onEvent: (e) => { events.push(e); options.onEvent?.(e) } })
  return { w, events }
}

export function run(w: ReturnType<typeof createWorld>, seconds: number, step = 1 / 30): void {
  for (let t = 0; t < seconds; t += step) w.update(step)
}

/** Cabinet: hinged door in front (+z) guarding a container, a drawer behind it, an open shelf. */
export const cabinet: ObjectSpec = {
  type: 'cabinet',
  parts: [
    { id: 'door', pivot: [-0.4, 0, 0.3], motion: { kind: 'hinge', angle: -Math.PI / 2 }, sweep: [-0.4, 0.3, 0.4, 1.1], label: 'prompt.door' },
    { id: 'drawer', pivot: [0, 0.3, 0.3], motion: { kind: 'slide', axis: [0, 0, 1], distance: 0.4 }, requires: 'door', label: 'prompt.drawer' },
  ],
  containers: [
    {
      id: 'main',
      access: 'door',
      volume: { center: [0, 0.5, 0], half: [0.4, 0.4, 0.25] },
      slots: [
        { pos: [-0.2, 0.1, 0], max: [0.2, 0.3, 0.2] },
        { pos: [0.2, 0.1, 0], max: [0.2, 0.3, 0.2] },
      ],
      contents: [{ type: 'can', qty: 2 }, null],
    },
    {
      id: 'inner',
      access: 'drawer',
      volume: { center: [0, 0.3, 0.3], half: [0.3, 0.1, 0.25] },
      slots: [{ pos: [0, 0.2, 0.3], max: [0.3, 0.2, 0.3], part: 'drawer' }],
      loot: 'pantry',
    },
    { id: 'shelf', volume: { center: [0, 1.2, 0], half: [0.4, 0.1, 0.2] }, slots: [{ pos: [0, 1.1, 0], max: [0.2, 0.3, 0.2] }], contents: [{ type: 'statue', qty: 1 }] },
  ],
}
