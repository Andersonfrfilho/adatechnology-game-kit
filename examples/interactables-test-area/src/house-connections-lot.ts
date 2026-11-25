// One house lot connected to a short street segment: the plan of a house on a street with a utility network (`street: 'network'`), the networks laid for it by game-urban and
// drawn by game-urban-three, and the house drawn by game-floorplan-three with its padrão post, meter box and conduit as objects of the kit. Planning is pure; drawing needs three.js.
import type * as THREE_NS from 'three'

import type { FloorplanResult } from '@adatechnology/game-floorplan'
import { create as createHouseRenderer } from '@adatechnology/game-floorplan-three'
import type { House, HouseRendererOptions } from '@adatechnology/game-floorplan-three'
import { connectionsInWorld } from '@adatechnology/game-floorplan-structure'
import type { CityPlanInput } from '@adatechnology/game-urban'
import { createUrbanThree } from '@adatechnology/game-urban-three'
import type { DrawnNetworks } from '@adatechnology/game-urban-three'
import { generateNetworks, validateNetworks } from '@adatechnology/game-urban/networks'
import type { GeneratedNetworks, NetworkViolation } from '@adatechnology/game-urban/networks'
import type { UtilityConnection } from '@adatechnology/game-contracts'

/** The street runs along x at z = 0, 10 m wide with 2.5 m sidewalks; the lot is north of it (smaller z) and its house faces +z, toward the player. */
export const STREET = { axis: 0, width: 10, sidewalk: 2.5, halfLength: 40 } as const
const LOT_RECT = [-6, -32.5, 6, -7.5] as const
const LOT_ID = 'connections_lot'
const TEMPLATE = 'budget_slab_house'
const SEED = 3
const FRONT_TURN = Math.PI

/** The part of the floorplan engine the plan needs (`engine` of game-floorplan with its packs registered). */
export interface PlanEngine {
  generate(template: string, options?: { seed?: number; street?: 'network' | 'own' }): FloorplanResult
}

export interface ConnectedLotPlan {
  readonly plan: FloorplanResult
  readonly placement: { readonly x: number; readonly z: number; readonly ry: number }
  readonly lotRect: readonly [number, number, number, number]
  readonly connections: readonly UtilityConnection[]
  readonly generated: GeneratedNetworks
  readonly violations: readonly NetworkViolation[]
}

/** The plan of the house, where it stands, what it declares and the networks laid for it. */
export function planConnectedLot(engine: PlanEngine): ConnectedLotPlan {
  const plan = engine.generate(TEMPLATE, { seed: SEED, street: 'network' })
  const yard = Math.max(0, -(plan.lot?.rect[1] ?? 0))
  const width = Number(plan.w) || 10
  const [x0, , x1, z1] = LOT_RECT
  const placement = { x: (x0 + x1) / 2 + width / 2, z: z1 - yard, ry: FRONT_TURN }
  const connections = connectionsInWorld({ plan, lot: LOT_ID, placement, kerb: STREET.sidewalk })
  const city: CityPlanInput = {
    id: 'house_connections',
    scale: 'town',
    size: [200, 200],
    districts: [{ id: 'periphery', kind: 'residential_popular', rect: [-100, -100, 100, 100] }],
    lines: [{ id: 'main_street', kind: 'street', width: STREET.width, points: [[-STREET.halfLength, STREET.axis], [STREET.halfLength, STREET.axis]] }],
  }
  const power = connections.find((connection) => connection.network === 'power')
  const avoid = power ? ([[power.at[0] - 1.5, -STREET.width / 2 - STREET.sidewalk, power.at[0] + 1.5, -STREET.width / 2]] as const) : []
  const generated = generateNetworks({ plan: city, lots: [{ id: LOT_ID, rect: LOT_RECT }], seed: SEED, connections, avoid })
  const violations = validateNetworks(generated.networks, { connections: generated.connections, surfaceAt: generated.surfaceAt, frontages: generated.frontages })
  return { plan, placement, lotRect: LOT_RECT, connections, generated, violations }
}

export interface DrawnLot {
  readonly house: House
  readonly networks: DrawnNetworks
  update(dt: number, time: number): void
  dispose(): void
}

export interface DrawLotParams {
  readonly THREE: typeof THREE_NS
  readonly scene: THREE_NS.Object3D
  readonly planned: ConnectedLotPlan
  readonly house: Partial<HouseRendererOptions>
  readonly document?: unknown
  readonly isActive: boolean
}

/** Draws the planned lot in the scene: the house (registered in the room's destruction when the options carry it) and the networks of its street. */
export function drawConnectedLot({ THREE, scene, planned, house: houseOptions, document, isActive }: DrawLotParams): DrawnLot {
  const renderer = createHouseRenderer(THREE, { locale: 'pt-BR', quality: 'game', ...houseOptions } as HouseRendererOptions)
  const house = renderer.build(planned.plan, { quality: 'game', terrain: false })
  house.group.rotation.y = planned.placement.ry
  house.group.position.set(planned.placement.x, 0, planned.placement.z)
  house.group.updateMatrixWorld(true)
  scene.add(house.group)
  if (isActive) house.destruction.activate()
  const urban = createUrbanThree(THREE, document ? { document: document as never } : {})
  const networks = urban.drawNetworks(planned.generated.networks, { surfaceAt: planned.generated.surfaceAt, isNight: false })
  scene.add(networks.root)
  return {
    house,
    networks,
    update: (dt, time) => house.update(dt, time),
    dispose() {
      networks.dispose()
      house.dispose()
      renderer.dispose?.()
    },
  }
}
