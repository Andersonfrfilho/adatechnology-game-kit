import type { Composer } from './types'

/** Every composer reads its numbers from `pattern.params`; the defaults are in `patterns.ts`. */

export type DowntownParams = {
  roadLength: number
  roadColor: number
  median: { width: number; height: number; color: number }
  poles: { from: number; to: number }
  buildings: { perRow: number; first: number; pitch: number; rowOffset: number; size: number; north: { minHeight: number; range: number; lit: number }; south: { minHeight: number; range: number; lit: number } }
  walks: { offset: number; length: number }
  car: { dx: number; dz: number; ry: number; color: number }
}

/** Avenue: LED poles down the median, two rows of tall buildings, a walk each side and a parked car. */
export const composeDowntown: Composer<DowntownParams> = ({ b, kit, pattern, params, x0, z0, pole, building, vehicle }) => {
  b.plane(x0, 0.02, z0, params.roadLength, pattern.streetWidth, params.roadColor)
  b.box(x0, 0, z0, params.roadLength, params.median.height, params.median.width, params.median.color)
  for (let u = params.poles.from; u <= params.poles.to; u += pattern.spacing) pole({ x: x0 + u, z: z0, on: true })
  const { buildings } = params
  for (let i = 0; i < buildings.perRow; i++) {
    const x = x0 + buildings.first + i * buildings.pitch
    const northHeight = buildings.north.minHeight + b.random() * buildings.north.range
    building(x, z0 - buildings.rowOffset, buildings.size, buildings.size, northHeight, b.pick(kit.block.facades), { lit: buildings.north.lit })
    building(x, z0 + buildings.rowOffset, buildings.size, buildings.size, buildings.south.minHeight + b.random() * buildings.south.range, b.pick(kit.block.facades), { lit: buildings.south.lit })
  }
  kit.streets.walk(b, x0, z0 - params.walks.offset, params.walks.length, pattern.walkWidth)
  kit.streets.walk(b, x0, z0 + params.walks.offset, params.walks.length, pattern.walkWidth)
  vehicle({ x: x0 + params.car.dx, z: z0 + params.car.dz, ry: params.car.ry, color: params.car.color })
}

export type SuburbParams = {
  roadLength: number
  walkOffset: number
  houses: { count: number; first: number; pitch: number; north: { z: number; typologies: readonly [string, string]; colors: readonly number[] }; south: { z: number; colors: readonly number[] }; roofColor: number; width: number; depth: number }
  walls: { color: number; height: number; thickness: number; offset: number; gateColor: number; gateWidth: number; gateHeight: number; gateOffset: number; gateInset: number; length: number }
  poles: { at: readonly number[]; z: number; transformerFrom: number }
  wires: { half: number; height: number }
}

/** Houses and two-storey houses behind low walls, concrete poles on the north side with the wires between them. */
export const composeSuburb: Composer<SuburbParams> = ({ b, kit, pattern, params, x0, z0, pole, house, isLit }) => {
  kit.streets.road(b, x0, z0, pattern.streetWidth, params.roadLength, 'x')
  kit.streets.walk(b, x0, z0 - params.walkOffset, params.roadLength, pattern.walkWidth)
  kit.streets.walk(b, x0, z0 + params.walkOffset, params.roadLength, pattern.walkWidth)
  const { houses, walls } = params
  for (let i = 0; i < houses.count; i++) {
    const x = x0 + houses.first + i * houses.pitch
    house(houses.north.typologies[i % 2 ? 0 : 1], { x, z: z0 + houses.north.z, width: houses.width, depth: houses.depth, color: b.pick(houses.north.colors), roofColor: houses.roofColor, ry: 0 })
    b.box(x, 0, z0 - walls.offset, walls.length, walls.height, walls.thickness, walls.color)
    b.box(x + walls.gateOffset, 0, z0 - walls.gateInset, walls.gateWidth, walls.gateHeight, 0.06, walls.gateColor)
    b.box(x, 0, z0 + walls.offset, walls.length, walls.height, walls.thickness, walls.color)
    b.box(x - walls.gateOffset, 0, z0 + walls.gateInset, walls.gateWidth, walls.gateHeight, 0.06, walls.gateColor)
  }
  for (const u of params.poles.at) pole({ x: x0 + u, z: z0 + params.poles.z, dir: 1, on: isLit(pattern.lit), transformer: u > params.poles.transformerFrom })
  kit.props.wires(b, [[x0 - params.wires.half, z0 + params.poles.z], [x0 + params.wires.half, z0 + params.poles.z]], params.wires.height)
  for (let i = 0; i < houses.count; i++) {
    house('detached', { x: x0 + houses.first + i * houses.pitch, z: z0 + houses.south.z, width: houses.width, depth: houses.depth, color: b.pick(houses.south.colors), roofColor: houses.roofColor, ry: Math.PI })
  }
}

export type WorkingClassParams = {
  houses: { count: number; first: number; pitch: number; width: number; depth: number; north: { z: number; colors: readonly number[] }; south: { z: number; colors: readonly number[] }; maxFloors: number }
  poles: { from: number; to: number; z: number; jitter: number }
  wires: { count: number; from: number; to: number; z: number; step: number; height: number; heightStep: number; sag: number; color: number }
}

/** Slab houses of one to three floors in two rows, concrete poles half burnt out and a tangle of wires. */
export const composeWorkingClass: Composer<WorkingClassParams> = ({ b, kit, pattern, params, x0, z0, pole, house, isLit }) => {
  kit.streets.road(b, x0, z0, pattern.streetWidth, 60, 'x')
  const { houses } = params
  for (let i = 0; i < houses.count; i++) {
    const x = x0 + houses.first + i * houses.pitch
    house('slab', { x, z: z0 + houses.north.z, width: houses.width, depth: houses.depth, floors: 1 + Math.floor(b.random() * houses.maxFloors), color: b.pick(houses.north.colors) })
    house('slab', { x, z: z0 + houses.south.z, width: houses.width, depth: houses.depth, floors: 1 + Math.floor(b.random() * houses.maxFloors), color: b.pick(houses.south.colors) })
  }
  for (let u = params.poles.from; u <= params.poles.to; u += pattern.spacing + b.random() * params.poles.jitter) pole({ x: x0 + u, z: z0 + params.poles.z, dir: 1, on: isLit(pattern.lit), transformer: true })
  const { wires } = params
  for (let k = 0; k < wires.count; k++) {
    kit.props.wires(b, [[x0 + wires.from, z0 + wires.z + k * wires.step], [x0 + wires.to, z0 + wires.z + (b.random() - 0.5) * wires.sag]], wires.height + k * wires.heightStep, wires.color)
  }
}

export type HistoricParams = {
  cobbles: { y: number; length: number; color: number; from: number; to: number; step: number; spread: number; sizes: readonly [number, number, number]; colors: readonly number[] }
  rows: { from: number; to: number; minWidth: number; widthSteps: number; north: { z: number; colors: readonly number[] }; south: { z: number; colors: readonly number[] } }
  poles: { from: number; to: number; step: number; z: number; sideOffset: number }
}

/** A cobbled street between rows of colonial houses wall to wall, with cast-iron lanterns. */
export const composeHistoricStreet: Composer<HistoricParams> = ({ b, pattern, params, x0, z0, pole, house, isLit }) => {
  const { cobbles, rows } = params
  b.plane(x0, cobbles.y, z0, cobbles.length, pattern.streetWidth, cobbles.color)
  for (let u = cobbles.from; u < cobbles.to; u += cobbles.step) b.item(x0 + u, cobbles.y, z0 + (b.random() - 0.5) * cobbles.spread, cobbles.sizes[0], cobbles.sizes[1], cobbles.sizes[2], b.pick(cobbles.colors))
  for (const side of [rows.north, rows.south] as const) {
    let x = x0 + rows.from
    while (x < x0 + rows.to) {
      const width = rows.minWidth + Math.floor(b.random() * rows.widthSteps)
      house('colonial', { x: x + width / 2, z: z0 + side.z, width, color: b.pick(side.colors), hasDoor: true, ry: side === rows.south ? Math.PI : undefined })
      x += width
    }
  }
  for (let u = params.poles.from; u <= params.poles.to; u += params.poles.step) {
    for (const s of [-1, 1]) pole({ x: x0 + u + (s > 0 ? params.poles.sideOffset : 0), z: z0 + s * params.poles.z, on: isLit(pattern.lit) })
  }
}

export type IndustrialParams = {
  yard: { length: number; color: number }
  hangar: { x: number; z: number; width: number; height: number; depth: number; color: number; roofColor: number; roofRadius: number; roofY: number; doorColor: number; doorWidth: number; doorHeight: number; stripeColor: number }
  towers: readonly { dx: number; dz: number; on: boolean }[]
  container: { dx: number; dz: number; ry: number; color: number }
}

/** A paved yard with two hangars under barrel roofs, floodlight towers and a container. */
export const composeIndustrial: Composer<IndustrialParams> = ({ b, kit, pattern, params, x0, z0, pole }) => {
  b.plane(x0, 0.02, z0, params.yard.length, pattern.streetWidth, params.yard.color)
  const { hangar } = params
  for (const s of [-1, 1]) {
    const g = b.group(x0 + s * hangar.x, 0, z0 + hangar.z)
    b.box(0, 0, 0, hangar.width, hangar.height, hangar.depth, hangar.color, { parent: g })
    b.vault({ x: 0, y: hangar.roofY, z: 0, radius: hangar.roofRadius, length: hangar.depth, arc: Math.PI, segments: 16, color: hangar.roofColor, rotation: { x: Math.PI / 2, y: 0, z: Math.PI / 2 }, scale: { x: 1, y: 1, z: 0.25 }, parent: g })
    b.box(0, 0, hangar.depth / 2 + 0.05, hangar.doorWidth, hangar.doorHeight, 0.1, hangar.doorColor, { parent: g })
    b.box(0, 6, hangar.depth / 2 + 0.06, 10, 1.2, 0.05, hangar.stripeColor, { parent: g })
  }
  for (const tower of params.towers) pole({ x: x0 + tower.dx, z: z0 + tower.dz, on: tower.on })
  kit.props.container(b, x0 + params.container.dx, 0, z0 + params.container.dz, params.container.ry, params.container.color)
}

export type RailwayParams = {
  houses: { count: number; first: number; pitch: number; north: { z: number; colors: readonly number[] }; south: { z: number; color: number } }
  poles: { at: readonly number[]; z: number; transformerFrom: number }
  wires: { half: number; height: number }
}

/** Company houses in a row, all alike, with residential poles and a single wire. */
export const composeRailwayVillage: Composer<RailwayParams> = ({ b, kit, pattern, params, x0, z0, pole, house, isLit }) => {
  kit.streets.road(b, x0, z0, pattern.streetWidth, 60, 'x')
  const { houses } = params
  for (let i = 0; i < houses.count; i++) {
    const x = x0 + houses.first + i * houses.pitch
    house('company_house', { x, z: z0 + houses.north.z, color: b.pick(houses.north.colors) })
    house('company_house', { x, z: z0 + houses.south.z, color: houses.south.color, ry: Math.PI })
  }
  for (const u of params.poles.at) pole({ x: x0 + u, z: z0 + params.poles.z, dir: 1, on: isLit(pattern.lit), transformer: u > params.poles.transformerFrom })
  kit.props.wires(b, [[x0 - params.wires.half, z0 + params.poles.z], [x0 + params.wires.half, z0 + params.poles.z]], params.wires.height)
}

export type MountainParams = {
  road: { y: number; length: number; color: number }
  chalets: { count: number; first: number; pitch: number; northZ: number; southZ: number; southShift: number; northColors: readonly number[]; southColors: readonly number[] }
  poles: { from: number; to: number; step: number; z: number; sideOffset: number }
  pines: { count: number; first: number; span: number; rowZ: number; minScale: number; scaleRange: number }
}

/** A mountain-resort street: wooden chalets, cast-iron lanterns and pines at both edges. */
export const composeMountainResort: Composer<MountainParams> = ({ b, pattern, params, x0, z0, pole, house, plant, isLit }) => {
  b.plane(x0, params.road.y, z0, params.road.length, pattern.streetWidth, params.road.color)
  const { chalets } = params
  for (let i = 0; i < chalets.count; i++) {
    house('chalet', { x: x0 + chalets.first + i * chalets.pitch, z: z0 + chalets.northZ, color: b.pick(chalets.northColors) })
    house('chalet', { x: x0 + chalets.first + i * chalets.pitch + chalets.southShift, z: z0 + chalets.southZ, color: b.pick(chalets.southColors), ry: Math.PI })
  }
  for (let u = params.poles.from; u <= params.poles.to; u += params.poles.step) {
    for (const s of [-1, 1]) pole({ x: x0 + u + (s > 0 ? params.poles.sideOffset : 0), z: z0 + s * params.poles.z, on: isLit(pattern.lit) })
  }
  const { pines } = params
  for (let i = 0; i < pines.count; i++) plant({ kind: 'pine', x: x0 + pines.first + b.random() * pines.span, z: z0 + (b.random() < 0.5 ? -pines.rowZ : pines.rowZ), scale: pines.minScale + b.random() * pines.scaleRange })
}

export type StiltParams = {
  water: { y: number; z: number; length: number; depth: number; color: number; roughness: number; metalness: number }
  bank: { z: number; length: number; depth: number; color: number }
  boardwalk: { y: number; length: number; width: number; color: number; pilesFrom: number; pilesTo: number; pilesStep: number }
  houses: { count: number; first: number; pitch: number; z: number; colors: readonly number[]; lantern: { dx: number; y: number; dz: number; lit: number; unlit: number } }
  lamp: { dx: number; y: number; dz: number; color: number; intensity: number; distance: number }
  boat: { dx: number; dz: number; color: number }
}

/** Stilt houses over water along a boardwalk, with no public lighting: a lantern on each odd house and a lamp light. */
export const composeStiltVillage: Composer<StiltParams> = ({ b, params, x0, z0, house }) => {
  const { water, bank, boardwalk, houses } = params
  b.plane(x0, water.y, z0 + water.z, water.length, water.depth, water.color, { roughness: water.roughness, metalness: water.metalness })
  b.box(x0, 0, z0 + bank.z, bank.length, 0.2, bank.depth, bank.color)
  b.box(x0, boardwalk.y, z0, boardwalk.length, 0.2, boardwalk.width, boardwalk.color)
  for (let u = boardwalk.pilesFrom; u <= boardwalk.pilesTo; u += boardwalk.pilesStep) b.cylinder(x0 + u, -1.5, z0 + 0.9, 0.1, 0.1, 2.9, 0x3a2a1c, -1, 5)
  for (let i = 0; i < houses.count; i++) {
    const x = x0 + houses.first + i * houses.pitch
    house('stilt', { x, z: z0 + houses.z, color: b.pick(houses.colors) })
    const lit = i % 2 === 1
    b.box(x + houses.lantern.dx, houses.lantern.y, z0 + houses.lantern.dz, 0.2, 0.28, 0.2, lit ? houses.lantern.lit : houses.lantern.unlit, { emissive: lit })
  }
  b.light({ x: x0 + params.lamp.dx, y: params.lamp.y, z: z0 + params.lamp.dz, color: params.lamp.color, intensity: params.lamp.intensity, distance: params.lamp.distance })
  b.box(x0 + params.boat.dx, -0.2, z0 + params.boat.dz, 1.6, 0.5, 4.6, params.boat.color)
}

export type MilitaryParams = {
  yard: { length: number; color: number }
  fence: { from: number; to: number; step: number; z: number; height: number; color: number; wireColor: number }
  towers: { dx: readonly number[]; dz: number }
  alarm: { dz: number; color: number; intensity: number; distance: number; y: number; lampDz: number; lampY: number }
  sandbags: { dz: number; length: number; rows: number }
  tents: { count: number; first: number; pitch: number; dz: number; width: number; depth: number }
}

/** A military perimeter: a mesh fence, watch towers with searchlights, a red emergency lamp, sandbags and tents. */
export const composeMilitary: Composer<MilitaryParams> = ({ b, kit, pattern, params, x0, z0 }) => {
  b.plane(x0, 0.02, z0, params.yard.length, pattern.streetWidth, params.yard.color)
  const { fence } = params
  for (let u = fence.from; u <= fence.to; u += fence.step) b.cylinder(x0 + u, 0, z0 + fence.z, 0.06, 0.06, 3, fence.color, -1, 4)
  b.line([[x0 + fence.from, 2.9, z0 + fence.z], [x0 + fence.to, 2.9, z0 + fence.z]], fence.wireColor)
  for (const u of params.towers.dx) kit.props.watchtower(b, x0 + u, z0 + params.towers.dz, true)
  const { alarm } = params
  b.light({ x: x0, y: alarm.y, z: z0 + alarm.dz, color: alarm.color, intensity: alarm.intensity, distance: alarm.distance })
  b.box(x0, alarm.lampY, z0 + alarm.lampDz, 0.3, 0.3, 0.3, alarm.color, { emissive: true })
  kit.props.sandbags(b, x0, z0 + params.sandbags.dz, params.sandbags.length, 'x', params.sandbags.rows)
  for (let i = 0; i < params.tents.count; i++) kit.props.tent(b, x0 + params.tents.first + i * params.tents.pitch, z0 + params.tents.dz, 0, params.tents.width, params.tents.depth)
}

export type RuralParams = {
  road: { length: number; color: number }
  field: { y: number; dz: number; length: number; depth: number; color: number }
  farmhouse: { dx: number; dz: number }
  pole: { dx: number; dz: number }
  fence: { dz: number; half: number; height: number; color: number }
  trees: { count: number; first: number; span: number; dz: number; spread: number; minScale: number; scaleRange: number }
  crops: { rows: number; perRow: number; first: number; pitch: number; dz: number; rowPitch: number; width: number; minHeight: number; heightRange: number; color: number }
}

/** A farm: dirt road, farmhouse with a veranda, one wooden pole at the junction, a fence, trees and rows of crops. */
export const composeRural: Composer<RuralParams> = ({ b, pattern, params, x0, z0, pole, house, plant }) => {
  b.plane(x0, 0.02, z0, params.road.length, pattern.streetWidth, params.road.color)
  b.plane(x0, params.field.y, z0 + params.field.dz, params.field.length, params.field.depth, params.field.color)
  house('farmhouse', { x: x0 + params.farmhouse.dx, z: z0 + params.farmhouse.dz })
  pole({ x: x0 + params.pole.dx, z: z0 + params.pole.dz, on: true })
  b.fence(x0 - params.fence.half, z0 + params.fence.dz, x0 + params.fence.half, z0 + params.fence.dz, params.fence.height, params.fence.color)
  const { trees, crops } = params
  for (let i = 0; i < trees.count; i++) plant({ kind: 'tree', x: x0 + trees.first + b.random() * trees.span, z: z0 + trees.dz + b.random() * trees.spread, scale: trees.minScale + b.random() * trees.scaleRange })
  for (let r = 0; r < crops.rows; r++) {
    for (let i = 0; i < crops.perRow; i++) b.item(x0 + crops.first + i * crops.pitch, 0, z0 + crops.dz + r * crops.rowPitch, crops.width, crops.minHeight + b.random() * crops.heightRange, crops.width, crops.color)
  }
}

/** The composers the ten default patterns use; a game adds its own through `createUrban({ composers })`. */
export const COMPOSERS: Readonly<Record<string, Composer>> = {
  downtown: composeDowntown,
  suburb: composeSuburb,
  working_class: composeWorkingClass,
  historic_street: composeHistoricStreet,
  industrial_port: composeIndustrial,
  railway_village: composeRailwayVillage,
  mountain_resort: composeMountainResort,
  stilt_village: composeStiltVillage,
  military: composeMilitary,
  rural: composeRural,
}
