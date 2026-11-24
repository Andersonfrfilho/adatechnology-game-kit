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
  const materials = Array.isArray(node.material) ? (node.material as unknown[]) : [node.material]
  const vertices = node.geometry?.index ? node.geometry.index.count : (node.geometry?.attributes?.position?.count ?? 0)
  tally.draws += materials.length + (node.castShadow ? 1 : 0)
  tally.triangles += Math.floor(vertices / 3) * (node.count ?? 1)
  for (const material of materials) tally.materials.add(material)
}

function tallyNode(node: SceneNode, tally: Tally): void {
  if (node.visible === false || tally.visited.has(node)) return
  tally.visited.add(node)
  if (isDrawable(node)) tallyDrawable(node, tally)
  // of a LOD only the nearest level is drawn at once: the most expensive one
  const nearest = node.isLOD ? node.levels?.[0]?.object : undefined
  const children = nearest ? [nearest] : (node.children ?? [])
  for (const child of children) tallyNode(child, tally)
}

/** The cost of what a builder returned, or null when it returned nothing drawn (a geometry alone, plain data). */
export function costOf(id: string, result: unknown): Cost | null {
  const nodes = sceneNodesIn(result)
  if (nodes.length === 0) return null
  const tally: Tally = { draws: 0, triangles: 0, materials: new Set(), visited: new Set() }
  for (const node of nodes) tallyNode(node, tally)
  return { id, draws: tally.draws, triangles: tally.triangles, materials: tally.materials.size }
}

const groupOf = (id: string): string => id.split('/')[0] as string
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
  if (!base) return { id, verdict: 'new', cost: counts, reason: 'no recorded cost' }
  const over = overLimitOf(cost, baseline)
  if (over) return { id, verdict: 'over', cost: counts, base, reason: over }
  const growth = growthOf(counts, base, baseline)
  if (growth) return { id, verdict: 'worse', cost: counts, base, reason: growth }
  const isBetter = counts.draws < base.draws || counts.triangles < base.triangles
  return { id, verdict: isBetter ? 'better' : 'ok', cost: counts, base, reason: '' }
}

/** Every builder against its recorded cost, then the recorded ones that no builder made. */
export function compareCosts(costs: readonly Cost[], baseline: CostBaseline): CostComparison[] {
  const made = new Set(costs.map((cost) => cost.id))
  const gone = Object.keys(baseline.entries).filter((id) => !made.has(id))
  return [...costs.map((cost) => compareOne(cost, baseline)), ...gone.map((id): CostComparison => ({ id, verdict: 'gone', base: baseline.entries[id] as CostCounts, reason: 'recorded, no builder makes it' }))]
}

export const FAILING_COST_VERDICTS: readonly CostVerdict[] = ['worse', 'over', 'new', 'gone']

export const DEFAULT_COST_BASELINE: CostBaseline = { drawSlack: 0.1, triangleSlack: 0.15, limits: {}, over: {}, entries: {} }

export type CostBaselineResult = {
  readonly baseline: CostBaseline
  /** The pieces newly over the limit of their group, or worse than accepted, that were not accepted by id: with any, the baseline must not be written. */
  readonly refused: readonly string[]
}

/** The baseline of this run: every cost recorded; a piece over the limit of its group stays accepted only at its draws or fewer, and a new one enters only by id. */
export function toCostBaseline(costs: readonly Cost[], previous: CostBaseline, accepted: readonly string[]): CostBaselineResult {
  const over: Record<string, number> = {}
  const refused: string[] = []
  for (const cost of costs) {
    const limit = previous.limits[groupOf(cost.id)]
    if (limit === undefined || cost.draws <= limit) continue
    const before = previous.over[cost.id]
    if ((before !== undefined && cost.draws <= before) || accepted.includes(cost.id)) over[cost.id] = cost.draws
    else refused.push(cost.id)
  }
  const entries = Object.fromEntries(costs.map(({ id, ...counts }) => [id, counts]))
  return { baseline: { ...previous, over, entries }, refused }
}

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
