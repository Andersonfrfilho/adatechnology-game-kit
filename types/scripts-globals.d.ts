// What the test pages publish on `window` for the scripts that drive them (Playwright `page.evaluate`): the room, its three.js and the
// reports each area writes. Read by tsconfig.scripts.json only.
import type { TestRoom } from '@adatechnology/game-test-room'
import type * as THREE from 'three'

import type * as Golden from '../tools/golden/src/browser'
import type { Determinism } from '../tools/golden/src/determinism'

declare global {
  // The capture scripts (`tools/golden/captures`, `tools/characters-catalog/captures`) run inside a page as plain scripts: what the page gives them.
  /** golden-tool's browser bundle on a capture page, with the frame stepper of the determinism the recorder installed. */
  const GoldenTool: typeof Golden & { stepFrames: Determinism['stepFrames'] }
  /** What the capture is asked for: the recorder's `--seed` and its `--param name=value` (`tools/golden/bin/record.mjs`). */
  var __GOLDEN_PARAMS: GoldenParams
  /** What the recorder's `--expose` opened of the page's closure; each capture describes the part it reads. */
  var GoldenExposed: unknown
  /** The garage page's vehicle SDK, described by the capture that reads it. */
  var VehicleSDK: unknown
  /** The plan generator of the Visor de casas 3D (`window.PlantasSDK`), as the floorplan captures read it. */
  var PlantasSDK: TeamPlans
  /** The house renderer of the Visor de casas 3D (`window.Casa3DSDK`), as the floorplan captures read it. */
  var Casa3DSDK: TeamHouses
  /** The houses area bundle of the old room page (`sala-de-testes/area-casas`). */
  var HouseArea: { loadInto(room: TestRoom): unknown }
  /** The furniture builders the house renderer takes (`window.Moveis3DSDK`). */
  var Moveis3DSDK: unknown
  /** What the recorder cut out of the sources for the capture (`tools/characters-catalog/src/golden/chrome-goldens.ts`). */
  var __SLICES: CaptureSlices
  /** The closure of a team page the recorder patched open; each capture describes the part it reads. */
  var __team: unknown
  /** Set by the harness page once its three.js and the game code are in. */
  var __harnessReady: boolean | undefined

  /** A record of a team page (a room, a wall, a door, an item...) as a capture reads it: JSON-like fields that go to a hash or an event. */
  type TeamRecord = { readonly [field: string]: Golden.EventValue }
  /** An item of a plan: the fields a capture filters by, then the rest. */
  type TeamPlanItem = TeamRecord & { readonly id: string; readonly tipo: string }
  /** A path of a lot: `para` is the id it leads to. */
  type TeamLotPath = TeamRecord & { readonly para: string }
  interface TeamLot {
    readonly rect: Golden.EventValue
    readonly recuo: Golden.EventValue
    readonly quintal: Golden.EventValue
    readonly estilo: Golden.EventValue
    readonly piscina: Golden.EventValue
    readonly zonas: readonly TeamRecord[]
    readonly perimetro: readonly TeamRecord[]
    readonly portoes: readonly TeamRecord[]
    readonly caminhos: readonly TeamLotPath[]
  }
  /** The structure of a plan: its pieces and supports, and its levels. */
  interface TeamStructure {
    readonly pecas: readonly TeamRecord[]
    readonly apoios: readonly TeamRecord[]
    readonly niveis: Golden.EventValue
    readonly elevacao: Golden.EventValue
  }
  /** What `PlantasSDK.gerar` returns, as far as the captures read it. */
  interface TeamPlan {
    readonly template: string
    readonly estilo: string
    readonly w: number
    readonly d: number
    readonly comodos: readonly TeamPlanItem[]
    readonly paredes: readonly TeamRecord[]
    readonly portas: readonly TeamPlanItem[]
    readonly janelas: readonly TeamPlanItem[]
    readonly abertos: readonly Golden.EventValue[]
    readonly moveis: readonly TeamPlanItem[]
    readonly estadoItens: readonly TeamPlanItem[]
    readonly andares: readonly unknown[]
    readonly faltando: readonly unknown[]
    readonly lote: TeamLot | null | undefined
    readonly estrutura: TeamStructure
    readonly construcao: unknown
    readonly telhado: unknown
    readonly caixaDagua: unknown
    readonly edificacoes: unknown
    readonly gas: unknown
    readonly eletrica: unknown
    readonly paineisSolares: unknown
    readonly hidraulica: unknown
  }
  interface TeamPlans {
    readonly estados: readonly string[]
    listarTemplates(): readonly { readonly id: string }[]
    gerar(template: string, options: { readonly semente: number; readonly estado: string }): TeamPlan
  }
  /** A house `Casa3DSDK.criar(...).construir` drew: its groups, its floors and the stats and LOD level the planner reads. */
  interface TeamHouse {
    readonly grupo: THREE.Group
    readonly lote?: THREE.Object3D
    readonly telhado?: THREE.Object3D
    readonly andares: readonly THREE.Object3D[]
    readonly stats: { readonly drawCalls: number; readonly drawCallsLOD1: number; readonly triangulos: number }
    readonly lod?: number
    readonly lodAtual: number
  }
  interface TeamHouses {
    specDe(structure: TeamStructure, options: { readonly vedacao?: boolean }): { readonly parts: readonly TeamRecord[]; readonly joints: readonly TeamRecord[] }
    criar(three: unknown, options: { readonly Moveis3DSDK: unknown; readonly document: Document }): { construir(plan: TeamPlan, options: { readonly qualidade: string; readonly noite: boolean }): TeamHouse }
    planejaLOD(houses: readonly TeamHouse[], focus: { x: number; y: number; z: number }, budget: number): { readonly total: number; readonly niveis: Golden.EventValue; readonly casas: readonly TeamHouse[] }
  }

  /** A row of the lists the gallery page keeps before its `flush()` (instanced boxes `IT`, lit and dark windows `WL`, `WD`). */
  type GalleryRow = readonly (number | string)[]
  /** A builder of the gallery page (`poleLED`, `road`, `sobrado`...): its arguments are the page's, it draws into `root`. */
  type GalleryBuilder = (...args: readonly (number | string | boolean | object | undefined)[]) => void
  type GalleryBuilderName = 'poleLED' | 'poleConcrete' | 'poleIron' | 'poleWood' | 'floodTower' | 'road' | 'walk' | 'ground' | 'streetGrid' | 'fillBlock' | 'building' | 'fence' | 'tent' | 'pine' | 'tree' | 'container' | 'watchtower' | 'sandbags' | 'stripLabel' | 'wires' | 'sobrado' | 'laje' | 'colonial' | 'chalet' | 'companyHouse' | 'stilt' | 'farmhouse' | 'house'
  /** What `--expose` opens of the Galeria do Vale Cinzento's closure for the urban and silhouette captures. */
  type GalleryPage = GalleryState & { readonly [name in GalleryBuilderName]: GalleryBuilder }
  interface GalleryState {
    root: THREE.Group
    R: () => number
    rng(seed: number): () => number
    LB: number
    readonly IT: GalleryRow[]
    readonly WL: GalleryRow[]
    readonly WD: GalleryRow[]
    readonly FAC: object
    flush: () => void
    env: () => void
    car: () => void
    pin: (x: number, y: number, z: number, kind: string, label: string, detail: string) => void
    buildPadraoRuas(): void
    buildWorld(): void
    hW(x: number, y: number): number
    forestF(x: number, y: number): number
  }
  /** A node of a gallery scene as the surface pass reads it; the light fields are read only when `isLight` is set. */
  type GallerySurfaceNode = THREE.Object3D & {
    material?: THREE.MeshStandardMaterial
    isLight?: boolean
    color: THREE.Color
    intensity: number
    distance: number
    decay: number
    angle: number
    penumbra: number
    count?: number
  }

  /** The `--seed` of the recorder (a number) and the `--param`s the captures read (strings, as given on the command line). */
  interface GoldenParams {
    readonly seed: number
    readonly key?: string
    readonly gameOnlyFlags?: string
    readonly mode?: string
    readonly indexes?: string
    readonly lines?: string
    readonly pairs?: string
    readonly state?: string
    readonly seedFrom?: string
    readonly seedTo?: string
    readonly states?: string
    readonly templates?: string
    readonly rows?: string
  }

  /** A scene of a capture's record: the snapshot's object count and hash (`lines` stay empty). */
  interface GoldenScene {
    readonly objects: number
    readonly hash: string
    readonly lines: readonly string[]
  }

  /** The slices of the captures: code cut out of the game (`best`, `instanced`, `animals`) and the ids it is run for. */
  interface CaptureSlices {
    readonly best: string
    readonly instanced: string
    readonly animals: string
    readonly species: readonly { readonly id: string; readonly sourceId: string }[]
    readonly types: readonly { readonly id: string; readonly name: string; readonly index: number }[]
    readonly variantCounts: Readonly<Record<string, number>>
  }

  /** A node of the page's scene as the scripts read it while they walk it: any object, with what a mesh, line, points or sprite adds when it is one. */
  type ScriptSceneNode = THREE.Object3D & {
    isMesh?: boolean
    isLine?: boolean
    isPoints?: boolean
    isSprite?: boolean
    isInstancedMesh?: boolean
    material?: THREE.Material | THREE.Material[]
    geometry?: THREE.BufferGeometry
    count?: number
  }

  /** The report `loadInto` of an area's entry returns. */
  type AreaReport<Dir extends AreaEntryDir> = ReturnType<AreaEntries[Dir]['loadInto']>
  type AreaEntryDir = keyof AreaEntries
  interface AreaEntries {
    'items-test-area': typeof import('../examples/items-test-area/src/entry.js')
    'floorplan-test-area': typeof import('../examples/floorplan-test-area/src/entry.js')
    'weather-test-area': typeof import('../examples/weather-test-area/src/entry.js')
    'vfx-test-area': typeof import('../examples/vfx-test-area/src/entry.js')
    'stories-test-area': typeof import('../examples/stories-test-area/src/entry.js')
    'audio-test-area': typeof import('../examples/audio-test-area/src/entry.js')
    'animals-test-area': typeof import('../examples/animals-test-area/src/entry.js')
    'characters-test-area': typeof import('../examples/characters-test-area/src/entry.js')
    'urban-test-area': typeof import('../examples/urban-test-area/src/entry.js')
    'vegetation-test-area': typeof import('../examples/vegetation-test-area/src/entry.js')
    'vehicles-test-area': typeof import('../examples/vehicles-test-area/src/entry.js')
    'weapons-test-area': typeof import('../examples/weapons-test-area/src/entry.js')
  }

  interface Window {
    /** The test room once its content is loaded (`examples/test-room/src/main.js`). */
    __testRoom: TestRoom
    /** The room of a deferred page, before its areas are open. */
    __bootRoom?: TestRoom
    __THREE: typeof THREE
    // What each area's `loadInto` returned, as its build.mjs boot line keeps it.
    __itemsReport: AreaReport<'items-test-area'>
    __floorplanReport: AreaReport<'floorplan-test-area'>
    __weatherReport: AreaReport<'weather-test-area'>
    __vfxReport: AreaReport<'vfx-test-area'>
    __storiesReport: AreaReport<'stories-test-area'>
    __audioReport: AreaReport<'audio-test-area'>
    __animalsReport: AreaReport<'animals-test-area'>
    __charactersReport: AreaReport<'characters-test-area'>
    __urbanReport: AreaReport<'urban-test-area'>
    __vegetationReport: AreaReport<'vegetation-test-area'>
    __vehiclesReport: AreaReport<'vehicles-test-area'>
    __weaponsReport: AreaReport<'weapons-test-area'>
  }
}
export {}
