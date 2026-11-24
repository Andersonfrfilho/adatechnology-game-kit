/** What one builder's result costs to draw: counts, the same on every machine. */
export type Cost = {
  /** The id of the bench entry (`<group>/<builder>`). */
  readonly id: string
  /** One per mesh and material, one more when the mesh casts a shadow (as `tools/kit-audit/cost.mjs` counts in the room). */
  readonly draws: number
  readonly triangles: number
  /** Distinct materials. */
  readonly materials: number
}

export type CostCounts = Omit<Cost, 'id'>

export type CostBaseline = {
  /** A builder fails past `draws × (1 + drawSlack)`, at least one draw more; the materials use the same slack. */
  readonly drawSlack: number
  /** A builder fails past `triangles × (1 + triangleSlack)`. */
  readonly triangleSlack: number
  /** The most draws of one piece, per group (the first part of the id). A group not listed has no limit. */
  readonly limits: Readonly<Record<string, number>>
  /** The pieces accepted over the limit of their group, with their draws: each may only go down. */
  readonly over: Readonly<Record<string, number>>
  readonly entries: Readonly<Record<string, CostCounts>>
}

export type CostVerdict = 'ok' | 'better' | 'worse' | 'over' | 'new' | 'gone'

export type CostComparison = {
  readonly id: string
  readonly verdict: CostVerdict
  readonly cost?: CostCounts
  readonly base?: CostCounts
  /** Why it fails, in words; empty when it passes. */
  readonly reason: string
}

type SceneNode = {
  readonly isObject3D?: boolean
  readonly isLOD?: boolean
  readonly isMesh?: boolean
  readonly isLine?: boolean
  readonly isPoints?: boolean
  readonly isSprite?: boolean
  readonly visible?: boolean
  readonly castShadow?: boolean
  readonly count?: number
  readonly layers?: { readonly mask: number }
  readonly levels?: ReadonlyArray<{ readonly object: SceneNode }>
  readonly children?: readonly SceneNode[]
  readonly material?: unknown
  readonly geometry?: { readonly index?: { readonly count: number } | null; readonly attributes?: { readonly position?: { readonly count: number } } }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const isSceneNode = (value: unknown): value is SceneNode => isRecord(value) && value.isObject3D === true

const SEARCH_DEPTH = 3

/** The objects a builder's result holds: itself, or the ones in its fields (a spec with its group, a build with its root), a few levels down. */
function sceneNodesIn(value: unknown, depth = 0, seen = new Set<unknown>()): SceneNode[] {
  if (!isRecord(value) || seen.has(value)) return []
  seen.add(value)
  if (isSceneNode(value)) return [value]
  if (depth >= SEARCH_DEPTH || ArrayBuffer.isView(value)) return []
  return Object.values(value).flatMap((field) => sceneNodesIn(field, depth + 1, seen))
}

type Tally = { draws: number; triangles: number; readonly materials: Set<unknown>; readonly visited: Set<SceneNode> }

const isDrawable = (node: SceneNode): boolean => node.isMesh === true || node.isLine === true || node.isPoints === true || node.isSprite === true

function tallyDrawable(node: SceneNode, tally: Tally): void {
  // a mesh drawn inside a batch is off the camera layer: the batch is what costs
  if (node.layers && (node.layers.mask & 1) === 0) return
  const materials: readonly unknown[] = Array.isArray(node.material) ? node.material : [node.material]
  tally.draws += materials.length + (node.castShadow ? 1 : 0)
  tally.triangles += trianglesOf(node.geometry) * (node.count ?? 1)
  for (const material of materials) tally.materials.add(material)
}

function tallyNode(node: SceneNode, tally: Tally): void {
  if (node.visible === false || tally.visited.has(node)) return
  tally.visited.add(node)
  if (isDrawable(node)) tallyDrawable(node, tally)
  // of a LOD only the nearest level is drawn at once: the most expensive one
  const lowerLevels = new Set(node.isLOD ? (node.levels ?? []).slice(1).map((level) => level.object) : [])
  for (const child of node.children ?? []) if (!lowerLevels.has(child)) tallyNode(child, tally)
}

type BareGeometry = NonNullable<SceneNode['geometry']> & { readonly isBufferGeometry: true }

const isBareGeometry = (value: unknown): value is BareGeometry => isRecord(value) && value.isBufferGeometry === true

/** The geometries a builder's result holds when it holds no object: a baked body, drawn by whoever instances it. */
function geometriesIn(value: unknown, depth = 0, seen = new Set<unknown>()): BareGeometry[] {
  if (!isRecord(value) || seen.has(value)) return []
  seen.add(value)
  if (isBareGeometry(value)) return [value]
  if (depth >= SEARCH_DEPTH || ArrayBuffer.isView(value)) return []
  return Object.values(value).flatMap((field) => geometriesIn(field, depth + 1, seen))
}

const trianglesOf = (geometry: SceneNode['geometry']): number => Math.floor((geometry?.index ? geometry.index.count : (geometry?.attributes?.position?.count ?? 0)) / 3)

/** The cost of geometries alone: one draw each, no material of their own. */
function geometryCost(id: string, geometries: readonly BareGeometry[]): Cost | null {
  if (geometries.length === 0) return null
  return { id, draws: geometries.length, triangles: geometries.reduce((sum, geometry) => sum + trianglesOf(geometry), 0), materials: 0 }
}

/** The cost of what a builder returned, or null when it returned nothing drawn (plain data). A result with geometries and no object counts one draw per geometry. */
export function costOf(id: string, result: unknown): Cost | null {
  const nodes = sceneNodesIn(result)
  if (nodes.length === 0) return geometryCost(id, geometriesIn(result))
  const tally: Tally = { draws: 0, triangles: 0, materials: new Set(), visited: new Set() }
  for (const node of nodes) tallyNode(node, tally)
  return { id, draws: tally.draws, triangles: tally.triangles, materials: tally.materials.size }
}

const groupOf = (id: string): string => id.split('/')[0] ?? id
const countCap = (base: number, slack: number): number => Math.max(base + 1, Math.floor(base * (1 + slack)))

/** Why this cost is worse than its recorded one, or '' when it is within the slack. */
function growthOf(cost: CostCounts, base: CostCounts, baseline: CostBaseline): string {
  const reasons: string[] = []
  if (cost.draws > countCap(base.draws, baseline.drawSlack)) reasons.push(`draws ${base.draws} -> ${cost.draws}`)
  if (cost.materials > countCap(base.materials, baseline.drawSlack)) reasons.push(`materials ${base.materials} -> ${cost.materials}`)
  if (cost.triangles > Math.floor(base.triangles * (1 + baseline.triangleSlack))) reasons.push(`triangles ${base.triangles} -> ${cost.triangles}`)
  return reasons.join(', ')
}

/** Why this cost breaks the limit of its group, or '' when it is under it or accepted over it and no worse. */
function overLimitOf(cost: Cost, baseline: CostBaseline): string {
  const limit = baseline.limits[groupOf(cost.id)]
  if (limit === undefined || cost.draws <= limit) return ''
  const accepted = baseline.over[cost.id]
  if (accepted === undefined) return `${cost.draws} draws, over the limit of ${limit} of ${groupOf(cost.id)}`
  return cost.draws > accepted ? `${cost.draws} draws, accepted over the limit at ${accepted}` : ''
}

function compareOne(cost: Cost, baseline: CostBaseline): CostComparison {
  const { id, ...counts } = cost
  const base = baseline.entries[id]
  // before `new`: a new piece over the limit of its group is over it, and enters only accepted by id
  const over = overLimitOf(cost, baseline)
  if (over) return { id, verdict: 'over', cost: counts, ...(base ? { base } : {}), reason: over }
  if (!base) return { id, verdict: 'new', cost: counts, reason: 'no recorded cost' }
  const growth = growthOf(counts, base, baseline)
  if (growth) return { id, verdict: 'worse', cost: counts, base, reason: growth }
  const isBetter = counts.draws < base.draws || counts.triangles < base.triangles
  return { id, verdict: isBetter ? 'better' : 'ok', cost: counts, base, reason: '' }
}

/** Every builder against its recorded cost, then the recorded ones that no builder made. */
export function compareCosts(costs: readonly Cost[], baseline: CostBaseline): CostComparison[] {
  const made = new Set(costs.map((cost) => cost.id))
  const gone = Object.entries(baseline.entries).filter(([id]) => !made.has(id))
  const goneComparisons = gone.map(([id, base]): CostComparison => ({ id, verdict: 'gone', base, reason: 'recorded, no builder makes it' }))
  return [...costs.map((cost) => compareOne(cost, baseline)), ...goneComparisons]
}

export const FAILING_COST_VERDICTS: readonly CostVerdict[] = ['worse', 'over', 'new', 'gone']

export const DEFAULT_COST_BASELINE: CostBaseline = { drawSlack: 0.1, triangleSlack: 0.15, limits: {}, over: {}, entries: {} }

export type CostBaselineParams = {
  readonly costs: readonly Cost[]
  readonly previous: CostBaseline
  /** The ids accepted worse, over the limit of their group, or gone, in this update. */
  readonly accepted: readonly string[]
}

export type CostBaselineResult = {
  readonly baseline: CostBaseline
  /** What got worse, went over the limit of its group or is gone, and was not accepted by id: with any, the baseline must not be written. */
  readonly refused: readonly CostComparison[]
  /** Every builder whose recorded cost this update changes, new ones included: what the reviewer reads. */
  readonly changed: readonly CostComparison[]
}

const REFUSED_COST_VERDICTS: readonly CostVerdict[] = ['worse', 'over', 'gone']

const isSameCost = (a: CostCounts | undefined, b: CostCounts | undefined): boolean => a?.draws === b?.draws && a?.triangles === b?.triangles && a?.materials === b?.materials

/**
 * The baseline of this run. A new builder and a cheaper one are recorded; one that got worse past the slack, went over the limit of its group, or is gone, only when
 * accepted by id. A piece over the limit stays in `over` at its draws. With anything refused the baseline is not to be written.
 */
export function toCostBaseline({ costs, previous, accepted }: CostBaselineParams): CostBaselineResult {
  const comparisons = compareCosts(costs, previous)
  const refused = comparisons.filter((comparison) => REFUSED_COST_VERDICTS.includes(comparison.verdict) && !accepted.includes(comparison.id))
  const kept = comparisons.flatMap(({ id, cost }): Array<[string, CostCounts]> => (cost ? [[id, cost]] : []))
  const over = Object.fromEntries(kept.filter(([id, cost]) => cost.draws > (previous.limits[groupOf(id)] ?? Infinity)).map(([id, cost]) => [id, cost.draws]))
  const entries = Object.fromEntries(kept)
  const changed = comparisons.filter((comparison) => !isSameCost(comparison.cost, comparison.base))
  return { baseline: { ...previous, over, entries }, refused, changed }
}

const countsText = (counts: CostCounts | undefined): string => (counts ? `${counts.draws} draws, ${counts.triangles} triangles, ${counts.materials} materials` : 'none')

/** One line per builder: its recorded cost and the cost of this run. */
export const costChangeLines = (comparisons: readonly CostComparison[]): string[] => comparisons.map(({ id, verdict, base, cost }) => `  ${verdict.padEnd(6)} ${id}: ${countsText(base)} -> ${countsText(cost)}`)

/** The table of the failing builders and the totals per group. */
export function costSummary(comparisons: readonly CostComparison[]): string {
  const groups = new Map<string, { count: number; draws: number; triangles: number }>()
  for (const { id, cost } of comparisons) {
    if (!cost) continue
    const group = groups.get(groupOf(id)) ?? { count: 0, draws: 0, triangles: 0 }
    groups.set(groupOf(id), { count: group.count + 1, draws: group.draws + cost.draws, triangles: group.triangles + cost.triangles })
  }
  const lines = ['| group | builders | draws | triangles |', '|---|---|---|---|']
  for (const [group, total] of groups) lines.push(`| ${group} | ${total.count} | ${total.draws} | ${total.triangles} |`)
  const failing = comparisons.filter((comparison) => FAILING_COST_VERDICTS.includes(comparison.verdict))
  if (failing.length === 0) return `${lines.join('\n')}\n\nevery builder within its recorded cost`
  lines.push('', '| builder | verdict | why |', '|---|---|---|')
  for (const { id, verdict, reason } of failing) lines.push(`| ${id} | ${verdict} | ${reason} |`)
  return lines.join('\n')
}
