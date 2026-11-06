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
  /** The proving ground's certificates by vehicle id (`examples/vehicles-proving-area/src/entry.js`), for a page or a test to read. */
  var __provingCertificates: Record<string, import('@adatechnology/game-vehicles-proving').ProvingCertificate> | undefined
  /** The page's three.js, when the page exposes it (`window.__THREE`). */
  var __THREE: typeof THREE | undefined
  // The interactables showroom page (examples/interactables-showroom/src/showroom.js): its objects and the API it puts on `window.__showroom`.
  // The page assigns `window.__showroom` against this type, so a change on either side fails the check.
  type ShowroomVec3 = [number, number, number]
  interface ShowroomView { readonly x?: number; readonly z?: number; readonly eye?: number; readonly yaw?: number; readonly pitch?: number; readonly fov?: number }
  interface ShowroomEntryView { dist?: number; look?: number[]; at?: number[] }
  interface ShowroomEntryBase { id: string; type: string; x: number; z: number; ry: number; name?: string; root: THREE.Group; view?: ShowroomEntryView }
  /** A household object of the pack, drawn by the three adapter. */
  type ShowroomHouseholdEntry = ShowroomEntryBase & { hh: true; custom?: undefined; item: import('@adatechnology/game-interactables-household').HouseholdItem; group: THREE.Group; parts: Record<string, THREE.Group>; nth?: number }
  /** A showroom-only object (the lamps, the water tank), still driven by the engine. */
  type ShowroomCustomEntry = ShowroomEntryBase & { hh?: undefined; custom: true }
  type ShowroomEntry = ShowroomHouseholdEntry | ShowroomCustomEntry
  type ShowroomEnvMaterial = THREE.MeshLambertMaterial | THREE.MeshStandardMaterial
  type ShowroomEnvMaterials = Record<'vc' | 'glassMat' | 'woodFloor' | 'tileKitchen' | 'tileBath' | 'grass' | 'concrete' | 'rug' | 'ceilingMat', ShowroomEnvMaterial>
  interface ShowroomPlayer {
    x: number
    z: number
    yaw: number
    pitch: number
    vx: number
    vz: number
    seat: { object: string; seat: string; eye: ShowroomVec3; pose: string } | null
    eye: number
  }
  interface ShowroomSlot { id: string; container: string; slot: number; stack: import('@adatechnology/game-interactables').ItemStack; pos: ShowroomVec3; angle: number; dist: number }
  type ShowroomLayoutRow = [string, string, number, number, number, import('@adatechnology/game-interactables-household').HouseholdItem?]
  interface ShowroomApi {
    readonly THREE: typeof THREE
    readonly world: import('@adatechnology/game-interactables').World
    readonly hh: import('@adatechnology/game-interactables-household').Household
    readonly scene: THREE.Scene
    readonly camera: THREE.PerspectiveCamera
    readonly renderer: THREE.WebGLRenderer
    readonly player: ShowroomPlayer
    readonly entries: Map<string, ShowroomEntry>
    readonly state: { quality: 'high' | 'game'; night: boolean; rain: boolean; wind: boolean }
    readonly env: { wallRects: number[][]; solidRects: number[][]; group: THREE.Group; materials: ShowroomEnvMaterials | null }
    readonly gfx: import('@adatechnology/game-interactables-three').ThreeAdapter
    readonly effects: import('@adatechnology/game-interactables-three').Effects
    readonly mirrors: import('@adatechnology/game-interactables-three').Mirrors
    readonly screens: Map<string, import('@adatechnology/game-interactables-three').Screen>
    readonly lamps: { id: string; light: THREE.PointLight; bulbMat: THREE.MeshBasicMaterial; on: boolean }[]
    readonly pack: import('@adatechnology/game-interactables').ItemStack[]
    readonly events: import('@adatechnology/game-interactables').WorldEvent[]
    readonly sweeps: Record<string, ReturnType<import('@adatechnology/game-interactables').World['fitSweep']>>
    readonly items: Record<'cyl' | 'box' | 'sph', THREE.InstancedMesh>
    readonly TANK: { id: string; x: number; z: number; gauge: null; fill: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial> | null }
    readonly LAYOUT: ShowroomLayoutRow[]
    sim(dt: number): void
    render(): void
    step(seconds: number, hz?: number): void
    pause(on?: boolean): void
    teleport(id: string): boolean
    setView(v: ShowroomView): void
    lookAt(x: number, y: number, z: number): void
    pickSlot(maxAngle: number): ShowroomSlot | null
    currentTarget(): ReturnType<import('@adatechnology/game-interactables').World['target']>
    pressUse(): boolean
    pressTake(): boolean
    standUp(): boolean
    drainTank(): void
    fitAll(): void
    buildCords(): void
    wallBlocked(x: number, z: number): boolean
    collides(x: number, z: number): boolean
    setQuality(q: string | null | undefined): void
    setNight(on: boolean): void
    setRain(on: boolean): void
    setWind(on: boolean): void
    setPanel(open?: boolean): void
    seatEye(objectId: string, seatId: string): { eye: ShowroomVec3; yaw: number; pose: import('@adatechnology/game-interactables').SeatPose; exit: ShowroomVec3 }
    hud(): void
    drawCalls(): number
    itemCount(): number
    walk(dx: number, dz: number, seconds: number): void
    showToast(text: string | null, kind?: string, ms?: number): void
  }
  // The interactables showroom page's bundle globals (examples/interactables-showroom/src/entry.js puts them on window for src/showroom.js).
  const GameInteractables: typeof import('@adatechnology/game-interactables')
  const GameInteractablesHousehold: typeof import('@adatechnology/game-interactables-household')
  const GameInteractablesThree: typeof import('@adatechnology/game-interactables-three')
  const GameTerrain: typeof import('@adatechnology/game-terrain')
  const GameTerrainThree: typeof import('@adatechnology/game-terrain-three')
  const Reflector: typeof import('three/examples/jsm/objects/Reflector.js').Reflector
  const RoomEnvironment: typeof import('three/examples/jsm/environments/RoomEnvironment.js').RoomEnvironment
  /** The recorded sfx the test room page inlines (`examples/test-room/build.mjs`): the manifest and each file as a `data:` url. */
  var __kitSfx: { readonly manifest: NonNullable<NonNullable<Parameters<typeof import('@adatechnology/game-weapons-three/testing').createWeaponsTestModule>[0]>['samples']>['manifest']; readonly files: Readonly<Record<string, string>> } | undefined
  /** The room page's build flag (`examples/test-room/build.mjs` defines it): true on the default page, false on the bare room the areas build over. */
  const __ROOM_FULL__: boolean
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

  /** A module's metrics (`room.metrics().module`) as the checks read them: numbers; a text one (`context`) is read with `typeof`. */
  type NumericMetrics = { readonly [name: string]: number }

  /** The state of an object of the room's world the script knows is there (`room.world.state(id)`). */
  type WorldObjectState = NonNullable<ReturnType<TestRoom['world']['state']>>

  /** A room drawn with WebGL, as every test page is (`room.webgl`). */
  type GlRoom = TestRoom & { readonly webgl: NonNullable<TestRoom['webgl']> }

  /** A point or a direction as the room takes them: x, y, z. */
  type Vec3 = [number, number, number]
  /** An object the room spawned (`room.spawned()`) the script knows is there. */
  type SpawnedObject = ReturnType<TestRoom['spawned']>[number]

  /** The room's avatar when it is the player's body (`toRoomAvatar(createPlayerAvatar(THREE))`): it keeps the player's avatar. */
  type PlayerRoomAvatar = import('@adatechnology/game-test-room').RoomAvatar & { readonly avatar: ReturnType<typeof import('@adatechnology/game-characters-three').createPlayerAvatar> }

  /** A room with its sound engine on, as the sound scripts open it (`room.audio`). */
  type AudioRoom = TestRoom & { readonly audio: NonNullable<TestRoom['audio']> }

  /** A bench of the room (`room.bench(id)`) the scripts know is there. */
  type RoomBench = NonNullable<ReturnType<TestRoom['bench']>>

  /** The report `loadInto` of an area's entry returns. */
  type AreaReport<Dir extends AreaEntryDir> = ReturnType<AreaEntries[Dir]['loadInto']>
  type AreaEntryDir = keyof AreaEntries
  interface AreaEntries {
    'items-test-area': typeof import('../examples/items-test-area/src/entry.js')
    'interactables-test-area': typeof import('../examples/interactables-test-area/src/entry.js')
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
    'vehicles-proving-area': typeof import('../examples/vehicles-proving-area/src/entry.js')
    'player-test-area': typeof import('../examples/player-test-area/src/entry.js')
    'crowd-test-area': typeof import('../examples/crowd-test-area/src/entry.js')
  }

  interface Window {
    /** The test room once its content is loaded (`examples/test-room/src/main.js`). */
    __testRoom: TestRoom
    /** The room of a deferred page, before its areas are open. */
    __bootRoom?: TestRoom
    __THREE: typeof THREE
    // What the room page (`examples/test-room/src/main.js`) publishes as its sounds load and its scenarios run
    __sfxReport?: import('@adatechnology/game-audio').SampleLoadReport
    __localSoundPack?: ReturnType<typeof import('@adatechnology/game-audio').applyLocalSoundPack>
    __localSoundReport?: import('@adatechnology/game-audio').LocalPackReport
    __testRoomReport?: Awaited<ReturnType<TestRoom['runScenarios']>>
    /** The default page's start, run by its boot script once the teams' content is loaded. */
    __roomStart?: () => Promise<void>
    /** What `examples/audio-test-area/body-reel.mjs` puts on its page: the body sounds and the engine that plays them. */
    reel: {
      readonly BODY_FOLEY_BANK: typeof import('@adatechnology/game-audio').BODY_FOLEY_BANK
      readonly createAudioEngine: typeof import('@adatechnology/game-audio').createAudioEngine
      readonly SURFACE_IDS: typeof import('@adatechnology/game-contracts').SURFACE_IDS
      readonly SWING_LEAD_SECONDS: typeof import('@adatechnology/game-contracts').SWING_LEAD_SECONDS
    }
    // What the test scripts keep on the page between two `evaluate` calls
    __lastZ?: number
    // What the sound probe (`examples/test-room/sound-probe.mjs`) records on the page
    __soundStarts: { kind: string; at: number; when: number; wall: number }[]
    __soundCalls: { readonly type: string; readonly id?: string; readonly wall: number; readonly [field: string]: unknown }[]
    __soundRecording?: { rec: MediaRecorder; chunks: Blob[]; ctx: BaseAudioContext; startedWall: number; startedCtx: number }
    __frames: number
    /** What the impact sound audit (`examples/test-room/sound-audit-impacts.mjs`) keeps on the page: the sounds and events of a hit, and its helpers. */
    __snd: {
      sounds: { id: string; t: number; volume: number; played: boolean; position: number[] | null }[]
      events: { type: string; t: number; damageType?: unknown; style?: unknown }[]
      so?: SpawnedObject
      at: Vec3
      fresh(material: string): string
      aim(tool: string, distance?: number, y?: number): void
      material(): (string | undefined)[] | undefined
    }
    __roomLines: { line: string; wall: number }[]
    /** Set by the weather test once the storm picture is taken. */
    __stormShot?: boolean
    /** The hooks of the first-person body prototype (`examples/player-test-area/first-person-body.mjs`). */
    __proto: {
      readonly neckFound: number
      readonly headMeshes: number
      eye(): THREE.Vector3
      hide(way: string): void
      nearest(camera: THREE.Camera): { at: string; d: number }[]
    }
    /** The memory warnings of the room counted across the cycles of `leak.mjs`. */
    __memoryWarnings?: number
    /** What `leak.mjs` counts in the page: live GL objects, canvases, listeners and intervals. */
    __leakCount: () => Record<string, number>
    /** The stories area bundle (its `loadContent` takes a game's content). */
    StoriesArea: AreaEntries['stories-test-area']
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
    __provingReport: AreaReport<'vehicles-proving-area'>
    __playerReport: AreaReport<'player-test-area'>
    __crowdReport: AreaReport<'crowd-test-area'>
    __furnitureReport: AreaReport<'interactables-test-area'>
    __showroom: ShowroomApi
  }
}
export {}
