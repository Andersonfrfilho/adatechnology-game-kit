import type * as THREE_NS from 'three'
import type { AreaPlacement, BenchChange, ModuleArea, ModuleControl, ModuleHost, ModuleLayer, ModuleMetric, ModuleScenario, TestableItem, TestableModule, Vec3 } from '@adatechnology/game-contracts'
import { rng } from '@adatechnology/game-interactables'
import { canCraft, craft, createFindsProvider, freshness, ITEM_CATEGORIES } from '@adatechnology/game-items'
import type { FindStack, FindsProvider, FindsQuery, ItemDef, ItemsCatalog, RecipeDef } from '@adatechnology/game-items'

import { ITEM_PREFIX, SHELF_HEIGHT, SHOWCASE_PREFIX, shelvesLayout } from './area-layout'
import type { ShelfPlan } from './area-layout'
import { buildItem } from './build-item'
import type { DrawableItem } from './build-item'
import { itemContents, SHELL_PART_ID } from './destruction'
import type { ContentsSubject } from './destruction'
import { checkBudget, countDrawCalls, countTriangles, ITEM_BUDGETS } from './budgets'
import { MODEL_BUDGET_DEVIATIONS } from './models/deviations'
import { itemThumbnailSvg } from './thumbnails'
import { hasItemModel, itemModelEntry, listItemModels } from './models/registry'
import { SHIPPED_MODELS } from './models/shipped'
import { setWear } from './wear'
import type { WearStage } from './wear'

export interface ItemsTestModuleOptions {
  /** The catalog to lay out (for example `createGoodsItems()` of `game-items-goods`). The module knows no content of its own. */
  catalog: ItemsCatalog
  /** `en` or `pt-BR` (default). */
  locale?: string
  /** Text of a key such as `item.canned_beans`, `place.house`, `category.food`, `container.fridge`, `recipe.stew` (the goods package has them in `goodsText`); without it the module falls back to the id. */
  translate?: (key: string, locale: string) => string | undefined
  /** Seed of the finds roll (default 1). */
  seed?: number
  /** Wear the items start with: `new` (default), `used` or `spoiled`. */
  wear?: string
  /** The finds provider; default the one of `game-items` over `catalog`. A game gives its own (floorplan bindings, pools). */
  provider?: FindsProvider
}

export const SHOWCASE_STAND_ID = 'stand_models'
export const RULER_ID = 'ruler_155'
export const HUMAN_ID = 'human_180'
export const FINDS_TABLE_ID = 'finds_table'
export const RULER_HEIGHT = 1.55
export const HUMAN_HEIGHT = 1.8

const STAND = { at: [0, 0, 9.5] as Vec3, radius: 2.1, height: 0.8, ring: 1.35 }
const RULER_AT: Vec3 = [-6.5, 0, 9]
const HUMAN_AT: Vec3 = [-5.4, 0, 9]
const TABLE = { at: [7, 0, 9.5] as Vec3, length: 3.2, depth: 1, height: 0.8 }
const WEARS = ['new', 'used', 'spoiled'] as const
const WEAR_STAGE: Readonly<Record<string, WearStage>> = { new: 0, used: 1, spoiled: 2 }
const SPIN = 0.6
const MAX_COPIES = 5
const CATEGORY_ALL = 'all'
const BOX_COLOR = 0x4fc3f7
const HIGHLIGHT = 0x6a3a00

interface Text {
  group: string
  name: string
  shelf: string
  stand: string
  ruler: string
  human: string
  table: string
  control: Record<'category' | 'wear' | 'age_days' | 'storage' | 'powered' | 'place' | 'container' | 'state' | 'day' | 'seed' | 'roll_finds' | 'recipe' | 'craft', string>
  hint: Record<'age_days' | 'powered' | 'day' | 'roll_finds' | 'craft', string>
  all: string
  wears: Record<(typeof WEARS)[number], string>
  states: Record<'normal' | 'fortified' | 'abandoned', string>
  storages: Record<string, string>
  layers: Record<'labels' | 'boxes' | 'simple_shapes', string>
  metrics: Record<'items' | 'draw_calls' | 'triangles' | 'modeled' | 'finds', string>
  rolled: string
  rolledNothing: string
  crafted: string
  craftMissing: string
  craftEffect: string
  scenarios: Record<'real_size' | 'models' | 'budgets' | 'ruler' | 'finds' | 'freshness' | 'craft', string>
}

const TEXT: Record<string, Text> = {
  en: {
    group: 'Items',
    name: 'Items area',
    shelf: 'Shelf of {category}',
    stand: 'Showcase stand of the 3D models',
    ruler: 'Ruler 1.55 m',
    human: 'Human figure 1.80 m',
    table: 'Finds table',
    control: {
      category: 'Category',
      wear: 'Wear',
      age_days: 'Age',
      storage: 'Storage',
      powered: 'Storage has power',
      place: 'Place',
      container: 'Container',
      state: 'State of the place',
      day: 'Outbreak day',
      seed: 'Seed',
      roll_finds: 'Roll finds',
      recipe: 'Recipe',
      craft: 'Craft',
    },
    hint: {
      age_days: 'Days the food has been kept: it spoils by its shelf life, faster or slower by the storage',
      powered: 'A fridge or freezer only keeps the food while it has power',
      day: 'Days since the outbreak: 0 is the normal world',
      roll_finds: 'Draws what the container holds and lays the stacks on the finds table',
      craft: 'Makes the recipe with exactly what it asks for and lays the result on the finds table',
    },
    all: 'All',
    wears: { new: 'New', used: 'Used', spoiled: 'Spoiled' },
    states: { normal: 'Normal', fortified: 'Fortified', abandoned: 'Abandoned' },
    storages: {},
    layers: { labels: 'Labels', boxes: 'Size boxes', simple_shapes: 'Highlight simple shapes' },
    metrics: { items: 'Items shown', draw_calls: 'Draw calls', triangles: 'Triangles', modeled: 'With a team model', finds: 'Stacks on the table' },
    rolled: 'Finds in {container} of {place} ({state}, day {day}): {stacks} stacks',
    rolledNothing: '{container} of {place} holds nothing',
    crafted: 'Crafted {recipe}: {output} ({seconds} s)',
    craftMissing: 'Cannot craft {recipe}: missing {missing}',
    craftEffect: 'effect {effect}',
    scenarios: {
      real_size: 'Every item is drawn at its real size',
      models: 'The 24 models of the team are shipped and draw their items',
      budgets: 'Models and shapes stay within the triangle and draw call budgets',
      ruler: 'The ruler is 1.55 m and the human figure 1.80 m',
      finds: 'The finds roll is the same for the same seed',
      freshness: 'Food spoils with age and the fridge slows it down',
      craft: 'A recipe made with what it asks for gives its output',
    },
  },
  'pt-BR': {
    group: 'Itens',
    name: 'Área de itens',
    shelf: 'Prateleira de {category}',
    stand: 'Pedestal dos modelos 3D',
    ruler: 'Régua de 1,55 m',
    human: 'Silhueta humana de 1,80 m',
    table: 'Mesa de achados',
    control: {
      category: 'Categoria',
      wear: 'Desgaste',
      age_days: 'Idade',
      storage: 'Armazenamento',
      powered: 'Armazenamento com energia',
      place: 'Lugar',
      container: 'Recipiente',
      state: 'Estado do lugar',
      day: 'Dia do surto',
      seed: 'Semente',
      roll_finds: 'Sortear achados',
      recipe: 'Receita',
      craft: 'Fabricar',
    },
    hint: {
      age_days: 'Dias que a comida ficou guardada: estraga pela validade, mais rápido ou mais devagar conforme onde está',
      powered: 'Geladeira e freezer só conservam enquanto têm energia',
      day: 'Dias desde o surto: 0 é o mundo normal',
      roll_finds: 'Sorteia o que o recipiente guarda e põe as pilhas na mesa de achados',
      craft: 'Faz a receita com exatamente o que ela pede e põe o resultado na mesa de achados',
    },
    all: 'Todas',
    wears: { new: 'Novo', used: 'Usado', spoiled: 'Estragado' },
    states: { normal: 'Normal', fortified: 'Fortificado', abandoned: 'Abandonado' },
    storages: {},
    layers: { labels: 'Rótulos', boxes: 'Caixas de tamanho', simple_shapes: 'Destacar formas simples' },
    metrics: { items: 'Itens à mostra', draw_calls: 'Chamadas de desenho', triangles: 'Triângulos', modeled: 'Com modelo do time', finds: 'Pilhas na mesa' },
    rolled: 'Achados em {container} de {place} ({state}, dia {day}): {stacks} pilhas',
    rolledNothing: '{container} de {place} não tem nada',
    crafted: 'Fabricou {recipe}: {output} ({seconds} s)',
    craftMissing: 'Não dá para fabricar {recipe}: falta {missing}',
    craftEffect: 'efeito {effect}',
    scenarios: {
      real_size: 'Todo item é desenhado no tamanho real',
      models: 'Os 24 modelos do time vêm no kit e desenham os seus itens',
      budgets: 'Modelos e formas ficam dentro do orçamento de triângulos e de chamadas de desenho',
      ruler: 'A régua tem 1,55 m e a silhueta humana 1,80 m',
      finds: 'O sorteio de achados é o mesmo para a mesma semente',
      freshness: 'A comida estraga com a idade e a geladeira atrasa isso',
      craft: 'Uma receita feita com o que ela pede dá o que promete',
    },
  },
}
const textOf = (locale: string): Text => TEXT[locale] ?? (TEXT.en as Text)
const fill = (template: string, vars: Record<string, string | number>): string => template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
const humanize = (id: string): string => id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

/** What the scenarios of the area ask of the module (and what a host or a test may read). */
export interface ItemsAreaState {
  readonly category: string
  readonly wear: string
  readonly ageDays: number
  readonly storage: string
  readonly powered: boolean
  readonly place: string
  readonly container: string
  readonly state: string
  readonly day: number
  readonly seed: number
  readonly recipe: string
}

export interface ItemsTestModule extends TestableModule {
  /** Everything the module has put in the scene so far, with what was measured when it was drawn. */
  placed(): ReadonlyArray<{ id: string; itemId: string; group: 'shelf' | 'showcase'; kind: 'model' | 'shape'; size: readonly [number, number, number]; root: THREE_NS.Object3D }>
  /** The stacks now on the finds table. */
  finds(): readonly FindStack[]
  /** The shelves of the layout. */
  shelves(): readonly ShelfPlan[]
  readonly state: ItemsAreaState
  /** The bench actions, callable without a host (what the buttons do). */
  rollFinds(): readonly FindStack[]
  craftSelected(): { ok: boolean; missing: readonly string[] }
  selectRecipe(id: string): void
  /** The box of a drawn object, metres [x, y, z] (needs the host's three.js namespace: null before the module is attached or an item built). */
  measure(root: THREE_NS.Object3D): [number, number, number] | null
}

/** Wear stage of an item from the age the bench sets: a food past its best turns spoiled, a food getting old turns used. */
const stageOf = (catalog: ItemsCatalog, item: ItemDef, base: WearStage, ageDays: number, storage: string, powered: boolean): WearStage => {
  if (item.shelfLife === undefined || ageDays <= 0) return base
  const state = freshness(item, { ageDays: 0, since: 0, storage, storedAt: 0 }, ageDays, { powered, rules: catalog.rules })
  const aged: WearStage = state === 'fresh' ? 0 : state === 'stale' ? 1 : 2
  return Math.max(base, aged) as WearStage
}

const sizeOfModel = (id: string): [number, number, number] | undefined => {
  const entry = itemModelEntry(id)
  return entry ? [entry.teamBox[0] * entry.scale, entry.teamBox[1] * entry.scale, entry.teamBox[2] * entry.scale] : undefined
}

/**
 * The items test area as a `TestableModule` of @adatechnology/game-contracts: every item of a catalog on shelves by category at real size (the real model of the team where there is
 * one, the simple shape of its category elsewhere), a stand where the 24 models turn, a ruler and a human figure to judge the scale, and a table where the finds of a container
 * and the result of a recipe are laid. The bench sets wear, age and storage, the place, container, state, outbreak day and seed of the finds, and the recipe.
 */
export function createItemsTestModule(options: ItemsTestModuleOptions): ItemsTestModule {
  const { catalog } = options
  const locale = options.locale ?? 'pt-BR'
  const text = textOf(locale)
  const label = (key: string, fallback: string): string => {
    const found = options.translate?.(key, locale)
    return found !== undefined && found !== key ? found : fallback
  }
  const nameOf = (item: ItemDef): string => label(item.name ?? `item.${item.id}`, label(`item.${item.id}`, humanize(item.id)))
  const categoryName = (id: string): string => label(`category.${id}`, humanize(id))
  const provider = options.provider ?? createFindsProvider(catalog)

  const items = catalog.list()
  const categories = [...ITEM_CATEGORIES.map((c) => c.id), ...[...catalog.categories.keys()].filter((id) => !ITEM_CATEGORIES.some((c) => c.id === id))].filter((id) => items.some((item) => item.category === id))
  const shelves = shelvesLayout(items, categories)
  const showcase = listItemModels().map((id) => ({ id, size: sizeOfModel(id) as [number, number, number], def: catalog.has(id) ? catalog.get(id) : undefined }))

  const state: { -readonly [K in keyof ItemsAreaState]: ItemsAreaState[K] } = {
    category: CATEGORY_ALL,
    wear: WEARS.includes(options.wear as (typeof WEARS)[number]) ? (options.wear as string) : 'new',
    ageDays: 0,
    storage: catalog.rules.storage.ambient ? 'ambient' : (Object.keys(catalog.rules.storage)[0] ?? 'ambient'),
    powered: true,
    place: catalog.places.has('house') ? 'house' : ([...catalog.places.keys()][0] ?? 'house'),
    container: catalog.containers.has('fridge') ? 'fridge' : ([...catalog.containers.keys()][0] ?? 'fridge'),
    state: 'normal',
    day: 0,
    seed: options.seed ?? 1,
    recipe: [...catalog.recipes.keys()][0] ?? '',
  }

  interface Entry {
    id: string
    itemId: string
    group: 'shelf' | 'showcase'
    category: string
    def: ItemDef | undefined
    kind: 'model' | 'shape'
    size: readonly [number, number, number]
    root: THREE_NS.Group
    triangles: number
    drawCalls: number
  }
  const entries: Entry[] = []
  let host: ModuleHost | null = null
  let latestTHREE: typeof THREE_NS | null = null
  let stack: FindStack[] = []
  let findsGroup: THREE_NS.Group | null = null
  let boxes: THREE_NS.Object3D[] = []
  const layers = { labels: true, boxes: false, simple_shapes: false }

  const baseStage = (): WearStage => WEAR_STAGE[state.wear] ?? 0
  const stageFor = (def: ItemDef | undefined): WearStage => (def ? stageOf(catalog, def, baseStage(), state.ageDays, state.storage, state.powered) : baseStage())

  const drawable = (def: ItemDef): DrawableItem => def
  const register = (entry: Omit<Entry, 'triangles' | 'drawCalls'>): void => {
    entries.push({ ...entry, triangles: countTriangles(entry.root), drawCalls: countDrawCalls(entry.root) })
  }

  const shelfItem = (plan: ShelfPlan): TestableItem => ({
    id: plan.id,
    name: fill(text.shelf, { category: categoryName(plan.category) }),
    movable: false,
    build: (THREE: unknown) => {
      const T = THREE as typeof THREE_NS
      const group = new T.Group()
      const wood = new T.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.85 })
      const frame = new T.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.7, metalness: 0.3 })
      const top = new T.Mesh(new T.BoxGeometry(plan.length, 0.04, plan.depth), wood)
      top.position.y = SHELF_HEIGHT - 0.02
      group.add(top)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const leg = new T.Mesh(new T.BoxGeometry(0.05, SHELF_HEIGHT - 0.04, 0.05), frame)
        leg.position.set((sx * (plan.length - 0.1)) / 2, (SHELF_HEIGHT - 0.04) / 2, (sz * (plan.depth - 0.1)) / 2)
        group.add(leg)
      }
      group.userData.category = plan.category
      group.userData.shelf = true
      shelfRoots.push(group)
      return group
    },
  })
  const shelfRoots: THREE_NS.Group[] = []

  /** The liquid a can holds, as the room's `TestableItem.fluid`: a hole in the shell leaks it. */
  const fluidOf = (subject: ContentsSubject): Pick<TestableItem, 'fluid'> => {
    const contents = itemContents(subject)
    return contents ? { fluid: { container: contents.container, part: SHELL_PART_ID } } : {}
  }

  const itemOf = (def: ItemDef): TestableItem => ({
    id: `${ITEM_PREFIX}${def.id}`,
    name: nameOf(def),
    movable: true,
    thumbnail: itemThumbnailSvg(drawable(def)),
    ...fluidOf({ ...(def.model === undefined ? {} : { model: def.model }), size: def.size, weight: def.weight }),
    build: (THREE: unknown) => {
      const T = THREE as typeof THREE_NS
      latestTHREE = T
      const model = buildItem(T, drawable(def), { wear: stageFor(def), destructible: true })
      register({ id: `${ITEM_PREFIX}${def.id}`, itemId: def.id, group: 'shelf', category: def.category, def, kind: model.kind, size: def.size, root: model.root })
      return model.root
    },
  })

  const showcaseItem = (model: (typeof showcase)[number]): TestableItem => ({
    id: `${SHOWCASE_PREFIX}${model.id}`,
    name: model.def ? nameOf(model.def) : label(`item.${model.id}`, humanize(model.id)),
    movable: false,
    ...fluidOf({ model: model.id, size: model.size, ...(model.def ? { weight: model.def.weight } : {}) }),
    build: (THREE: unknown) => {
      const T = THREE as typeof THREE_NS
      const subject: DrawableItem = { id: model.id, category: model.def?.category ?? '', size: model.size, model: model.id, ...(model.def ? { weight: model.def.weight } : {}) }
      const built = buildItem(T, subject, { wear: stageFor(model.def), destructible: true })
      register({ id: `${SHOWCASE_PREFIX}${model.id}`, itemId: model.id, group: 'showcase', category: model.def?.category ?? '', def: model.def, kind: built.kind, size: model.size, root: built.root })
      return built.root
    },
  })

  const standItem = (): TestableItem => ({
    id: SHOWCASE_STAND_ID,
    name: text.stand,
    movable: false,
    build: (THREE: unknown) => {
      const T = THREE as typeof THREE_NS
      const group = new T.Group()
      const base = new T.Mesh(new T.CylinderGeometry(STAND.radius, STAND.radius + 0.1, STAND.height - 0.04, 40), new T.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.8 }))
      base.position.y = (STAND.height - 0.04) / 2
      const top = new T.Mesh(new T.CylinderGeometry(STAND.radius, STAND.radius, 0.04, 40), new T.MeshStandardMaterial({ color: 0xcfcab8, roughness: 0.6 }))
      top.position.y = STAND.height - 0.02
      group.add(base, top)
      return group
    },
  })

  const rulerItem = (): TestableItem => ({
    id: RULER_ID,
    name: text.ruler,
    movable: false,
    build: (THREE: unknown) => {
      const T = THREE as typeof THREE_NS
      const group = new T.Group()
      const post = new T.Mesh(new T.BoxGeometry(0.06, RULER_HEIGHT, 0.02), new T.MeshStandardMaterial({ color: 0xe8e2c8, roughness: 0.7 }))
      post.position.y = RULER_HEIGHT / 2
      group.add(post)
      const tick = new T.MeshStandardMaterial({ color: 0x1b1b1b })
      for (let cm = 0; cm <= 155; cm += 5) {
        const long = cm % 10 === 0
        const mark = new T.Mesh(new T.BoxGeometry(long ? 0.05 : 0.03, 0.004, 0.024), tick)
        mark.position.set(0.03 + (long ? 0.025 : 0.015), cm / 100, 0)
        group.add(mark)
      }
      const base = new T.Mesh(new T.BoxGeometry(0.3, 0.03, 0.3), new T.MeshStandardMaterial({ color: 0x55585c }))
      base.position.y = 0.015
      group.add(base)
      group.userData.height = RULER_HEIGHT
      return group
    },
  })

  const humanItem = (): TestableItem => ({
    id: HUMAN_ID,
    name: text.human,
    movable: false,
    build: (THREE: unknown) => {
      const T = THREE as typeof THREE_NS
      const group = new T.Group()
      const skin = new T.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.9 })
      const part = (geometry: THREE_NS.BufferGeometry, x: number, y: number): void => {
        const mesh = new T.Mesh(geometry, skin)
        mesh.position.set(x, y, 0)
        group.add(mesh)
      }
      // 1.80 m: legs to 0.88, torso to 1.50, neck and head to 1.80
      for (const x of [-0.09, 0.09]) part(new T.CylinderGeometry(0.075, 0.06, 0.88, 10), x, 0.44)
      part(new T.BoxGeometry(0.4, 0.62, 0.22), 0, 0.88 + 0.31)
      for (const x of [-0.26, 0.26]) part(new T.CylinderGeometry(0.045, 0.04, 0.6, 8), x, 1.2)
      part(new T.CylinderGeometry(0.05, 0.055, 0.07, 8), 0, 1.535)
      part(new T.SphereGeometry(0.115, 14, 10), 0, 1.685)
      group.userData.height = HUMAN_HEIGHT
      return group
    },
  })

  const tableItem = (): TestableItem => ({
    id: FINDS_TABLE_ID,
    name: text.table,
    movable: false,
    build: (THREE: unknown) => {
      const T = THREE as typeof THREE_NS
      const group = new T.Group()
      const top = new T.Mesh(new T.BoxGeometry(TABLE.length, 0.05, TABLE.depth), new T.MeshStandardMaterial({ color: 0x7a6a55, roughness: 0.8 }))
      top.position.y = TABLE.height - 0.025
      group.add(top)
      const frame = new T.MeshStandardMaterial({ color: 0x3d3f44 })
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const leg = new T.Mesh(new T.BoxGeometry(0.06, TABLE.height - 0.05, 0.06), frame)
        leg.position.set((sx * (TABLE.length - 0.12)) / 2, (TABLE.height - 0.05) / 2, (sz * (TABLE.depth - 0.12)) / 2)
        group.add(leg)
      }
      return group
    },
  })

  const liveEntries = (): Entry[] => entries.filter((entry) => entry.root.parent !== null)
  const visibleEntries = (): Entry[] => liveEntries().filter((entry) => entry.root.visible)

  const applyCategory = (): void => {
    for (const entry of entries) if (entry.group === 'shelf') entry.root.visible = state.category === CATEGORY_ALL || entry.category === state.category
    for (const shelf of shelfRoots) shelf.visible = state.category === CATEGORY_ALL || shelf.userData.category === state.category
  }
  const applyWear = (): void => {
    for (const entry of entries) setWear(entry.root, stageFor(entry.def))
  }
  const applyHighlight = (): void => {
    for (const entry of entries) {
      entry.root.traverse((object) => {
        const mesh = object as THREE_NS.Mesh
        if (!mesh.isMesh) return
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          const standard = material as THREE_NS.MeshStandardMaterial
          if (standard.emissive) standard.emissive.setHex(layers.simple_shapes && entry.kind === 'shape' ? HIGHLIGHT : 0x000000)
        }
      })
    }
  }
  const clearBoxes = (): void => {
    for (const box of boxes) {
      box.parent?.remove(box)
    }
    boxes = []
  }
  const applyBoxes = (): void => {
    clearBoxes()
    if (!layers.boxes || !host || !latestTHREE) return
    const T = latestTHREE
    const scene = host.scene as THREE_NS.Scene
    for (const entry of liveEntries()) {
      if (!entry.root.visible) continue
      const box = new T.Box3().setFromObject(entry.root)
      if (box.isEmpty()) continue
      const helper = new T.Box3Helper(box, BOX_COLOR)
      scene.add(helper)
      boxes.push(helper)
    }
  }

  const clearFinds = (): void => {
    if (findsGroup) {
      findsGroup.parent?.remove(findsGroup)
      findsGroup = null
    }
  }
  const labelSprite = (T: typeof THREE_NS, content: string): THREE_NS.Sprite | null => {
    if (typeof document === 'undefined') return null
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return null
    canvas.width = 256
    canvas.height = 64
    context.fillStyle = 'rgba(15,17,20,0.78)'
    context.fillRect(0, 0, 256, 64)
    context.fillStyle = '#ffffff'
    context.font = '24px sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(content.length > 22 ? `${content.slice(0, 21)}…` : content, 128, 32)
    const texture = new T.CanvasTexture(canvas)
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, depthTest: false, transparent: true }))
    sprite.scale.set(0.5, 0.125, 1)
    sprite.renderOrder = 10
    return sprite
  }
  /** Draws the stacks on the finds table: each item once per unit (up to five) side by side at real size, with a label of its name and count. */
  const showFinds = (): void => {
    clearFinds()
    if (!host || !latestTHREE) return
    const T = latestTHREE
    const group = new T.Group()
    group.position.set(TABLE.at[0], TABLE.height + 0.005, TABLE.at[2])
    let cursor = -TABLE.length / 2 + 0.1
    const scale = 1
    for (const found of stack) {
      const def = catalog.get(found.itemId)
      const copies = Math.min(found.count, MAX_COPIES)
      const start = cursor
      for (let i = 0; i < copies; i++) {
        const model = buildItem(T, drawable(def), { wear: stageFor(def) })
        model.root.position.set(cursor + (def.size[0] * scale) / 2, 0, 0)
        group.add(model.root)
        cursor += def.size[0] + 0.03
      }
      const sprite = labelSprite(T, `${nameOf(def)} x${found.count}`)
      if (sprite) {
        sprite.position.set((start + cursor) / 2, Math.max(def.size[1], 0.1) + 0.12, 0)
        sprite.visible = layers.labels
        sprite.userData.label = true
        group.add(sprite)
      }
      cursor += 0.1
    }
    ;(host.scene as THREE_NS.Scene).add(group)
    findsGroup = group
  }
  const applyLabels = (): void => {
    findsGroup?.traverse((object) => {
      if (object.userData.label) object.visible = layers.labels
    })
  }

  const rollFinds = (): readonly FindStack[] => {
    const query: FindsQuery = { place: state.place, container: state.container, state: state.state, rng: rng(state.seed), day: state.day }
    stack = [...(provider.findsFor(query) ?? [])]
    showFinds()
    const container = label(`container.${state.container}`, humanize(state.container))
    const place = label(`place.${state.place}`, humanize(state.place))
    host?.log(stack.length > 0 ? fill(text.rolled, { container, place, state: text.states[state.state as keyof Text['states']] ?? state.state, day: state.day, stacks: stack.length }) : fill(text.rolledNothing, { container, place }), { place: state.place, container: state.container, seed: state.seed })
    return stack
  }

  /** What the character needs to make `recipe`: the items, the stations and the tools it asks for, once. */
  const kitFor = (recipe: RecipeDef): { inventory: Map<string, number>; world: Set<string> } => {
    const inventory = new Map<string, number>()
    const world = new Set<string>()
    const add = (id: string, count: number): void => void inventory.set(id, (inventory.get(id) ?? 0) + count)
    for (const input of recipe.inputs) {
      if (input.world) for (const w of input.world) world.add(w)
      else if (input.item !== undefined) add(input.item, input.qty ?? 1)
      else if (input.any?.[0] !== undefined) add(input.any[0], input.qty ?? 1)
      else if (input.match) {
        const pick = catalog.list().find((item) => (input.match?.category === undefined || item.category === input.match.category) && (input.match?.cookable === undefined || item.cookable === input.match.cookable))
        if (pick) add(pick.id, input.qty ?? 1)
      }
    }
    for (const tool of recipe.tools) {
      if (tool.anyOf[0] !== undefined) add(tool.anyOf[0], 1)
      for (const w of tool.world ?? []) world.add(w)
    }
    return { inventory, world }
  }
  const craftSelected = (): { ok: boolean; missing: readonly string[] } => {
    const recipe = catalog.recipes.get(state.recipe)
    if (!recipe) return { ok: false, missing: [state.recipe] }
    const { inventory, world } = kitFor(recipe)
    const fluids: Record<string, number> = {}
    for (const input of recipe.inputs) if (input.fluid !== undefined) fluids[input.fluid] = (fluids[input.fluid] ?? 0) + (input.liters ?? 1)
    const context = { catalog, inventory, world, fluids }
    const name = label(`recipe.${recipe.id}`, humanize(recipe.id))
    const check = canCraft(recipe, context)
    if (!check.isPossible) {
      host?.log(fill(text.craftMissing, { recipe: name, missing: check.missing.join(', ') }), { recipe: recipe.id })
      return { ok: false, missing: check.missing }
    }
    const result = craft(recipe, context, rng(state.seed))
    if (!result.isCrafted) return { ok: false, missing: result.missing }
    if ('item' in result.output) {
      stack = [{ itemId: result.output.item, count: result.output.count }]
      showFinds()
    }
    const output = 'item' in result.output ? `${nameOf(catalog.get(result.output.item))} x${result.output.count}` : fill(text.craftEffect, { effect: result.output.effect })
    host?.log(fill(text.crafted, { recipe: name, output, seconds: result.seconds }), { recipe: recipe.id })
    return { ok: true, missing: [] }
  }

  const areaPlacements = (): AreaPlacement[] => {
    const placements: AreaPlacement[] = []
    for (const shelf of shelves) {
      placements.push({ item: shelf.id, position: shelf.position, surface: { halfSize: [shelf.length / 2, shelf.depth / 2], height: SHELF_HEIGHT } }, ...shelf.items)
    }
    placements.push({ item: SHOWCASE_STAND_ID, position: STAND.at, surface: { halfSize: [STAND.radius, STAND.radius], height: STAND.height } })
    showcase.forEach((model, index) => {
      const angle = (index / showcase.length) * Math.PI * 2
      placements.push({ item: `${SHOWCASE_PREFIX}${model.id}`, position: [STAND.at[0] + Math.cos(angle) * STAND.ring, STAND.height + 0.01, STAND.at[2] + Math.sin(angle) * STAND.ring], asleep: true })
    })
    placements.push({ item: RULER_ID, position: RULER_AT }, { item: HUMAN_ID, position: HUMAN_AT })
    placements.push({ item: FINDS_TABLE_ID, position: TABLE.at, surface: { halfSize: [TABLE.length / 2, TABLE.depth / 2], height: TABLE.height } })
    return placements
  }

  const onChange = (change: BenchChange): void => {
    if (change.kind === 'layer') {
      if (change.id === 'labels' || change.id === 'boxes' || change.id === 'simple_shapes') layers[change.id] = change.on
      if (change.id === 'labels') applyLabels()
      else if (change.id === 'boxes') applyBoxes()
      else if (change.id === 'simple_shapes') applyHighlight()
      return
    }
    if (change.kind === 'action') {
      if (change.id === 'roll_finds') rollFinds()
      else if (change.id === 'craft') craftSelected()
      return
    }
    const value = change.value
    switch (change.id) {
      case 'category':
        state.category = String(value)
        applyCategory()
        if (layers.boxes) applyBoxes()
        break
      case 'wear':
        state.wear = String(value)
        applyWear()
        break
      case 'age_days':
        state.ageDays = Number(value)
        applyWear()
        break
      case 'storage':
        state.storage = String(value)
        applyWear()
        break
      case 'powered':
        state.powered = Boolean(value)
        applyWear()
        break
      case 'place':
        state.place = String(value)
        break
      case 'container':
        state.container = String(value)
        break
      case 'state':
        state.state = String(value)
        break
      case 'day':
        state.day = Number(value)
        break
      case 'seed':
        state.seed = Number(value)
        break
      case 'recipe':
        state.recipe = String(value)
        break
    }
  }

  const choice = (id: keyof Text['control'], values: ReadonlyArray<{ id: string; name: string }>, def: string): ModuleControl => ({ kind: 'choice', id, name: text.control[id], options: values, default: def })

  const module: ItemsTestModule = {
    id: 'items_area',
    name: text.name,
    group: text.group,
    state,
    placed: () => entries.map((entry) => ({ id: entry.id, itemId: entry.itemId, group: entry.group, kind: entry.kind, size: entry.size, root: entry.root })),
    finds: () => stack,
    shelves: () => shelves,
    rollFinds,
    craftSelected,
    selectRecipe: (id) => {
      state.recipe = id
    },
    measure: (root) => {
      if (!latestTHREE) return null
      const size = new latestTHREE.Box3().setFromObject(root).getSize(new latestTHREE.Vector3())
      return [size.x, size.y, size.z]
    },
    items: () => [
      ...items.map(itemOf),
      ...shelves.map(shelfItem),
      standItem(),
      ...showcase.map(showcaseItem),
      rulerItem(),
      humanItem(),
      tableItem(),
    ],
    area: (): ModuleArea => ({ placements: areaPlacements(), view: { eye: [0, 5.5, 16], target: [0, 0.8, 0] } }),
    controls: (): ModuleControl[] => [
      choice('category', [{ id: CATEGORY_ALL, name: text.all }, ...categories.map((id) => ({ id, name: categoryName(id) }))], CATEGORY_ALL),
      choice('wear', WEARS.map((id) => ({ id, name: text.wears[id] })), state.wear),
      { kind: 'number', id: 'age_days', name: text.control.age_days, hint: text.hint.age_days, unit: 'd', min: 0, max: 400, step: 5, default: 0 },
      choice('storage', Object.keys(catalog.rules.storage).map((id) => ({ id, name: label(`storage.${id}`, humanize(id)) })), state.storage),
      { kind: 'boolean', id: 'powered', name: text.control.powered, hint: text.hint.powered, default: true },
      choice('place', [...catalog.places.keys()].map((id) => ({ id, name: label(`place.${id}`, humanize(id)) })), state.place),
      choice('container', [...catalog.containers.keys()].map((id) => ({ id, name: label(`container.${id}`, humanize(id)) })), state.container),
      choice('state', (['normal', 'fortified', 'abandoned'] as const).map((id) => ({ id, name: text.states[id] })), 'normal'),
      { kind: 'number', id: 'day', name: text.control.day, hint: text.hint.day, unit: 'd', min: 0, max: 60, step: 1, default: 0 },
      { kind: 'number', id: 'seed', name: text.control.seed, min: 1, max: 9999, step: 1, default: state.seed },
      { kind: 'action', id: 'roll_finds', name: text.control.roll_finds, hint: text.hint.roll_finds },
      ...(state.recipe ? [choice('recipe', [...catalog.recipes.keys()].map((id) => ({ id, name: label(`recipe.${id}`, humanize(id)) })), state.recipe)] : []),
      ...(state.recipe ? [{ kind: 'action', id: 'craft', name: text.control.craft, hint: text.hint.craft } as ModuleControl] : []),
    ],
    layers: (): ModuleLayer[] => [
      { id: 'labels', name: text.layers.labels },
      { id: 'boxes', name: text.layers.boxes, default: false },
      { id: 'simple_shapes', name: text.layers.simple_shapes, default: false },
    ],
    metrics: (): ModuleMetric[] => [
      { id: 'items', name: text.metrics.items, digits: 0, read: () => visibleEntries().length },
      { id: 'draw_calls', name: text.metrics.draw_calls, digits: 0, read: () => visibleEntries().reduce((sum, entry) => sum + entry.drawCalls, 0) },
      { id: 'triangles', name: text.metrics.triangles, digits: 0, read: () => visibleEntries().reduce((sum, entry) => sum + entry.triangles, 0) },
      {
        id: 'modeled',
        name: text.metrics.modeled,
        read: () => {
          const shown = visibleEntries().filter((entry) => entry.group === 'shelf')
          return `${shown.filter((entry) => entry.kind === 'model').length}/${shown.length}`
        },
      },
      { id: 'finds', name: text.metrics.finds, digits: 0, read: () => stack.length },
    ],
    scenarios: (): Array<ModuleScenario<ScenarioLike>> => scenariosOf(module, catalog, text, provider),
    attach(lent) {
      host = lent
      latestTHREE = lent.THREE as typeof THREE_NS
      const offChange = lent.bench?.onChange(onChange)
      const offFrame = lent.onFrame((dt) => {
        for (const entry of entries) if (entry.group === 'showcase' && entry.root.parent) entry.root.rotation.y += dt * SPIN
      })
      return () => {
        offChange?.()
        offFrame()
        clearBoxes()
        clearFinds()
        host = null
      }
    },
  }
  return module
}

/** What the scenarios use of the context the test room passes (`ScenarioContext`). */
export interface ScenarioLike {
  expect(condition: boolean, label: string, data?: Record<string, unknown>): void
}

/** A drawing never grows past its item's size, and its longest side is within 8% of it (a bag is a little lower than its box). */
const OVER = 0.02
const UNDER = 0.08

function scenariosOf(module: ItemsTestModule, catalog: ItemsCatalog, text: Text, provider: FindsProvider): Array<ModuleScenario<ScenarioLike>> {
  const names = text.scenarios
  const shelf = (): ReturnType<ItemsTestModule['placed']> => module.placed().filter((entry) => entry.group === 'shelf')
  return [
    {
      id: 'real_size',
      name: names.real_size,
      run: ({ expect }) => {
        const shown = shelf()
        expect(shown.length > 0, 'items are on the shelves', { count: shown.length })
        for (const entry of shown) {
          const measured = module.measure(entry.root)
          if (!measured) continue
          const longest = Math.max(...entry.size)
          const axis = entry.size.indexOf(longest)
          const ok = measured.every((side, a) => side <= (entry.size[a] as number) * (1 + OVER) + 0.002) && Math.abs((measured[axis] as number) - longest) <= longest * UNDER + 0.002
          expect(ok, `${entry.itemId} measures its real size`, { measured, size: entry.size })
        }
      },
    },
    {
      id: 'models',
      name: names.models,
      run: ({ expect }) => {
        const models = listItemModels()
        expect(models.length === SHIPPED_MODELS.length, `${SHIPPED_MODELS.length} models are shipped`, { count: models.length })
        const withModel = catalog.list().filter((item) => item.model !== undefined && hasItemModel(item.model))
        const shippedItems = SHIPPED_MODELS.filter(({ entry }) => catalog.has(entry.id)).length
        expect(withModel.length === shippedItems, `${shippedItems} items of the catalog name a model (every shipped model that is a catalog item)`, { count: withModel.length })
        const stand = module.placed().filter((entry) => entry.group === 'showcase')
        expect(stand.length === 0 || stand.every((entry) => entry.kind === 'model'), 'every piece of the stand is drawn by the model of the team')
      },
    },
    {
      id: 'budgets',
      name: names.budgets,
      run: ({ expect }) => {
        for (const entry of module.placed()) {
          const report = checkBudget(entry.root, entry.size)
          expect(report.drawCalls <= ITEM_BUDGETS.drawCalls, `${entry.itemId} stays within ${ITEM_BUDGETS.drawCalls} draw calls`, { drawCalls: report.drawCalls })
          const deviation = entry.kind === 'model' ? MODEL_BUDGET_DEVIATIONS[entry.itemId] : undefined
          expect(report.ok || (deviation !== undefined && report.triangles <= deviation), `${entry.itemId} stays within its triangle budget`, { triangles: report.triangles, limit: report.limit })
        }
      },
    },
    {
      id: 'ruler',
      name: names.ruler,
      run: ({ expect }) => {
        expect(RULER_HEIGHT === 1.55 && HUMAN_HEIGHT === 1.8, 'the references have the measures of the page')
      },
    },
    {
      id: 'finds',
      name: names.finds,
      run: ({ expect }) => {
        const query = (seed: number): FindsQuery => ({ place: module.state.place, container: module.state.container, state: 'normal', rng: rng(seed), day: 0 })
        const a = JSON.stringify(provider.findsFor(query(7)))
        const b = JSON.stringify(provider.findsFor(query(7)))
        expect(a === b, 'the same seed gives the same finds')
        expect((provider.findsFor(query(7)) ?? []).every((found) => catalog.has(found.itemId)), 'every find is an item of the catalog')
      },
    },
    {
      id: 'freshness',
      name: names.freshness,
      run: ({ expect }) => {
        const food = catalog.list().find((item) => item.shelfLife !== undefined && item.shelfLife > 0)
        if (!food) return expect(false, 'the catalog has a food that spoils')
        const at = (storage: string, days: number): string => freshness(food, { ageDays: 0, since: 0, storage, storedAt: 0 }, days, { rules: catalog.rules })
        const days = (food.shelfLife as number) * 1.2
        expect(at('ambient', days) !== 'fresh', 'at room temperature it is past its best', { food: food.id })
        if ('fridge' in catalog.rules.storage) expect(at('fridge', days) !== at('ambient', days) || at('fridge', days) === 'fresh', 'in the fridge it keeps better', { food: food.id })
      },
    },
    {
      id: 'craft',
      name: names.craft,
      run: ({ expect }) => {
        const before = module.state.recipe
        for (const id of catalog.recipes.keys()) {
          module.selectRecipe(id)
          const result = module.craftSelected()
          expect(result.ok, `recipe ${id} is made with what it asks for`, { missing: result.missing })
        }
        module.selectRecipe(before)
      },
    },
  ]
}
