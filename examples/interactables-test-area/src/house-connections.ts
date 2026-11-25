// What a house puts on its utility connection, side by side (`?area=house_connections`): a labelled row of every piece of the SDK that goes there (the padrão post of a network
// street with its meter box and conduit, the old own-pole padrão, the facade mast, the board, a street pole), a sign where the SDK has no piece yet (water meter box, inspection
// box cover, downspout mouth, sewer lateral), and behind it one whole house lot connected to a short street segment (pole, power and telecom drops, padrão, water, sewer points).
// Every piece comes from the module that owns it, by its catalogue id; the lot is the house and the networks of the SDK drawn in the room's destruction world.
import { coincidentFacesOf } from '@adatechnology/game-shapes-three'
import type { GroundLayout, ModuleArea, ModuleHost, ModuleScenario, TestableItem, TestableModule } from '@adatechnology/game-contracts'
import type { HouseRendererOptions } from '@adatechnology/game-floorplan-three'
import type { ItemSize, ScenarioContext } from '@adatechnology/game-test-room'
import type * as ThreeNamespace from 'three'

import { CONNECTION_GAPS, CONNECTION_PIECES, HOUSE_CONNECTIONS_ID, HOUSE_CONNECTIONS_MISSING_LOG } from './house-connections-data.js'
import { layConnections } from './house-connections-layout.js'
import type { ConnectionsLayout } from './house-connections-layout.js'
import { drawConnectedLot, planConnectedLot } from './house-connections-lot.js'
import type { ConnectedLotPlan, DrawnLot, PlanEngine } from './house-connections-lot.js'
import { trialOf } from './house-complete.js'
import type { Locale } from './house-tables-data.js'

export { HOUSE_CONNECTIONS_ID }

type Three = typeof ThreeNamespace

export interface HouseConnectionsOptions {
  readonly locale?: string
  readonly measure: (itemId: string) => ItemSize | null
  /** The floorplan engine with its packs registered. */
  readonly engine: PlanEngine
  /** Passed to the house renderer: the room's destruction world and renderer, the interactives and the vegetation. */
  readonly house: Partial<HouseRendererOptions>
}

const localeOf = (locale: string | undefined): Locale => (locale === 'en' ? 'en' : 'pt-BR')

export interface HouseConnectionsModule extends TestableModule<ScenarioContext> {
  /** Draws the lot now (the module does it on the first frame after its area opens). */
  build(): DrawnLot | null
  lot(): DrawnLot | null
  planned(): ConnectedLotPlan
}

function scenariosOf(locale: Locale, module: () => HouseConnectionsModule, layout: () => ConnectionsLayout, three: () => Three | null): Array<ModuleScenario<ScenarioContext>> {
  const T = (pt: string, en: string): string => (locale === 'en' ? en : pt)
  return [
    {
      id: 'house_connections_laid',
      name: T('Ligação da casa: toda peça da ligação está na sala e o lote ligado à rua foi montado', 'House connection: every connection piece is in the room and the lot connected to its street is built'),
      run: ({ room, step, expect }) => {
        const spawned = room.openArea(HOUSE_CONNECTIONS_ID)
        step(1)
        const here = new Set(spawned.map((so) => so.itemId))
        const absent = CONNECTION_PIECES.map((piece) => piece.item).filter((id) => !here.has(id))
        expect(absent.length === 0 && layout().missing.length === 0, T(`Peças na sala: ${here.size}; faltando: ${absent.length}`, `Pieces in the room: ${here.size}; missing: ${absent.length}`), { absent, missing: layout().missing })
        const lot = module().build()
        const planned = module().planned()
        expect(lot !== null, T('Lote montado: casa e redes da rua', 'Lot built: the house and the street networks'))
        const networks = new Set(planned.connections.map((connection) => connection.network))
        expect(['power', 'telecom', 'sewer', 'storm', 'water'].every((network) => networks.has(network)), T('A casa declara as cinco ligações (energia, telecom, esgoto, pluvial, água)', 'The house declares its five connections (power, telecom, sewer, storm, water)'), { networks: [...networks] })
        const edges = new Set(planned.generated.networks.edges.map((edge) => edge.kind))
        expect(edges.has('service_drop') && edges.has('telecom_drop'), T('Ramais de energia e telecom chegam ao poste do padrão', 'Power and telecom drops reach the service post'), { edges: [...edges] })
        expect(planned.violations.length === 0, T(`Violações das redes: ${planned.violations.length}`, `Network violations: ${planned.violations.length}`), { violations: planned.violations })
        const gaps = CONNECTION_GAPS.filter((gap) => !layout().gapPoints.has(gap.id))
        expect(gaps.length === 0, T(`Pontos sem peça marcados no chão: ${CONNECTION_GAPS.length - gaps.length} de ${CONNECTION_GAPS.length}`, `Points with no piece marked on the floor: ${CONNECTION_GAPS.length - gaps.length} of ${CONNECTION_GAPS.length}`), { gaps: gaps.map((gap) => gap.id) })
      },
    },
    {
      id: 'house_connections_trials',
      name: T('Ligação da casa: cada peça é vista, leva tiro e quebra (o poste da rua é cenário: ainda sem destruição, T2.8f)', 'House connection: each piece is seen, takes a shot and breaks (the street pole is scenery: no destruction yet, T2.8f)'),
      run: ({ room, step, expect }) => {
        const spawned = room.openArea(HOUSE_CONNECTIONS_ID)
        step(1)
        const THREE = three()
        if (!THREE) return expect(false, T('A sala emprestou o three.js', 'The room lent its three.js'))
        const scenery = new Set(CONNECTION_PIECES.filter((piece) => piece.isScenery).map((piece) => piece.item))
        const trials = spawned.map((so) => trialOf({ room, step, THREE }, so))
        const fails = (key: 'looked' | 'shot' | 'broken', only: (item: string) => boolean): string[] => trials.filter((trial) => only(trial.item) && !trial[key]).map((trial) => trial.item)
        expect(fails('looked', (item) => !scenery.has(item)).length === 0, T(`Vistas pela mira; falharam: ${fails('looked', (item) => !scenery.has(item)).join(', ') || 'nenhuma'}`, `Seen by the aim; failed: ${fails('looked', (item) => !scenery.has(item)).join(', ') || 'none'}`), { failed: fails('looked', (item) => !scenery.has(item)) })
        expect(fails('shot', (item) => !scenery.has(item)).length === 0, T(`Levaram o tiro; falharam: ${fails('shot', (item) => !scenery.has(item)).join(', ') || 'nenhuma'}`, `Took the shot; failed: ${fails('shot', (item) => !scenery.has(item)).join(', ') || 'none'}`), { failed: fails('shot', (item) => !scenery.has(item)) })
        expect(fails('broken', (item) => !scenery.has(item)).length === 0, T(`As peças da casa quebram; falharam: ${fails('broken', (item) => !scenery.has(item)).join(', ') || 'nenhuma'}`, `The house pieces break; failed: ${fails('broken', (item) => !scenery.has(item)).join(', ') || 'none'}`), { failed: fails('broken', (item) => !scenery.has(item)) })
      },
    },
    {
      id: 'house_connections_no_z_fighting',
      name: T('Ligação da casa: nenhuma face coincidente entre as peças da fileira nem entre peças vizinhas', 'House connection: no coincident faces among the row pieces or between neighbouring pieces'),
      run: ({ room, step, expect }) => {
        const spawned = room.openArea(HOUSE_CONNECTIONS_ID)
        step(1)
        const THREE = three()
        if (!THREE) return expect(false, T('A sala emprestou o three.js', 'The room lent its three.js'))
        const options = { maxHits: Number.POSITIVE_INFINITY }
        const boxes = spawned.map((so) => new THREE.Box3().setFromObject(so.root))
        const overlaps = boxes.flatMap((a, i) => boxes.slice(i + 1).map((b, j) => (a.intersectsBox(b) ? [spawned[i]?.itemId, spawned[i + 1 + j]?.itemId] : null)).filter((pair) => pair !== null))
        expect(overlaps.length === 0, T(`Peças da fileira que se tocam: ${overlaps.length}`, `Row pieces that touch: ${overlaps.length}`), { overlaps })
        const group = new THREE.Group()
        for (const so of spawned) group.add(so.root.clone())
        const together = coincidentFacesOf(group as never, options).length
        const alone = spawned.reduce((sum, so) => sum + coincidentFacesOf(so.root as never, options).length, 0)
        expect(together <= alone, T(`Faces coincidentes juntas: ${together}; cada peça sozinha somada: ${alone} (nenhuma nova entre peças)`, `Coincident faces together: ${together}; each piece alone summed: ${alone} (none new between pieces)`), { together, alone })
        const lot = module().build()
        const own = lot ? coincidentFacesOf(lot.networks.root as never, options).length : -1
        expect(own === 0, T(`Faces coincidentes nas redes desenhadas da rua: ${own}`, `Coincident faces in the drawn street networks: ${own}`))
      },
    },
  ]
}

/** The area module for `room.loadModule`: the plan is made when the module is created (no three.js), the layout the first time the area opens, the lot on the first frame after it opens. */
export function createHouseConnectionsArea(options: HouseConnectionsOptions): HouseConnectionsModule {
  const locale = localeOf(options.locale)
  const name = locale === 'en' ? 'House connections (every piece)' : 'Ligação da casa (todas as peças)'
  const planned = planConnectedLot(options.engine)
  let made: ConnectionsLayout | null = null
  let host: ModuleHost | null = null
  let THREE: Three | null = null
  let lot: DrawnLot | null = null
  let isPending = false
  const layout = (): ConnectionsLayout => {
    if (made) return made
    made = layConnections({ measure: options.measure, locale, planned })
    if (made.missing.length > 0) host?.log(`${name}: ${made.missing.join(', ')}`, { missing: made.missing }, HOUSE_CONNECTIONS_MISSING_LOG)
    return made
  }
  const clear = (): void => {
    lot?.dispose()
    lot = null
  }
  const module: HouseConnectionsModule = {
    id: HOUSE_CONNECTIONS_ID,
    name,
    group: name,
    items: (): TestableItem[] => [],
    area: (): ModuleArea => {
      isPending = true
      return layout().area
    },
    get ground(): GroundLayout {
      return layout().ground
    },
    build: () => {
      isPending = false
      if (lot) return lot
      if (!host || !THREE) return null
      lot = drawConnectedLot({ THREE, scene: host.scene as ThreeNamespace.Object3D, planned, house: options.house, isActive: options.house.destruction !== undefined })
      return lot
    },
    lot: () => lot,
    planned: () => planned,
    attach: (lent) => {
      host = lent
      THREE = lent.THREE as Three
      const stopClear = lent.onClear?.(clear)
      const stopFrame = lent.onFrame((dt) => {
        if (isPending) module.build()
        lot?.update(dt, performance.now() / 1000)
      })
      return () => {
        stopClear?.()
        stopFrame()
        clear()
        host = null
        THREE = null
      }
    },
    scenarios: () => scenariosOf(locale, () => module, layout, () => THREE),
  }
  return module
}
