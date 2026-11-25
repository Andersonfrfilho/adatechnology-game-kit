import { NETWORK_VIOLATION } from './codes'
import { dropMisfitOf, lotUnderDrop } from './drop-rules'
import { edgeEnds } from './validate-context'
import type { ValidationContext } from './validate-context'

/**
 * The street's practice for drops (with the lots' `frontages`): a drop leaves a pole in front of its lot or goes straight across the street,
 * never along it, and never passes over another lot; no pole holds more than `dropsPerPole` service drops. A drop from a service pole inside a lot
 * is judged only by the lots it passes over.
 */
export function validateDrops(context: ValidationContext): void {
  const frontages = context.options.frontages
  const perPole = new Map<string, number>()
  for (const edge of context.graph.edges.values()) {
    if (edge.kind !== 'service_drop' && edge.kind !== 'telecom_drop') continue
    const ends = edgeEnds(context, edge)
    if (!ends) continue
    const [pole, end] = ends
    if (edge.kind === 'service_drop') perPole.set(pole.id, (perPole.get(pole.id) ?? 0) + 1)
    const lot = end.lot
    if (frontages === undefined || lot === undefined) continue
    const frontage = frontages.find((entry) => entry.lot === lot)
    const misfit = frontage && dropMisfitOf({ frontage, pole: { x: pole.at[0], z: pole.at[2] }, anchor: end.at, rules: context.rules.power })
    if (misfit === 'skewed') context.report({ code: NETWORK_VIOLATION.DROP_SKEWED, id: edge.id, limit: context.rules.power.dropMaxSkew })
    if (misfit === 'off_frontage') context.report({ code: NETWORK_VIOLATION.DROP_OFF_FRONTAGE, id: edge.id, detail: pole.id })
    const other = lotUnderDrop({ from: [pole.at[0], pole.at[2]], to: [end.at[0], end.at[2]], lot, frontages })
    if (other !== undefined) context.report({ code: NETWORK_VIOLATION.DROP_OVER_OTHER_LOT, id: edge.id, detail: other })
  }
  for (const [pole, count] of perPole) {
    if (count > context.rules.power.dropsPerPole) context.report({ code: NETWORK_VIOLATION.POLE_TOO_MANY_DROPS, id: pole, value: count, limit: context.rules.power.dropsPerPole })
  }
}
