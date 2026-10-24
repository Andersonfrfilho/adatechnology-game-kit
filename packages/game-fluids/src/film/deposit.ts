import type { FilmField, FilmProfile, FilmRandom } from './types'

export interface DepositContext {
  readonly field: FilmField
  readonly random: FilmRandom
  readonly profile: () => FilmProfile
}

const VISIBLE_THICKNESS = 0.035

export function depositCell(context: DepositContext, rowIn: number, columnIn: number, amount: number): void {
  const { field } = context
  const row = Math.round(rowIn)
  const column = Math.round(columnIn)
  if (row < 0 || column < 0 || row >= field.height || column >= field.width || !(amount > 0)) return
  const index = row * field.width + column
  field.thickness[index]! += amount
  if (amount > 0.02) field.dryness[index]! *= 0.15
  field.dampness[index] = 1
}

export function wetCellCount(field: FilmField): number {
  let cells = 0
  for (let index = 0; index < field.thickness.length; index++) if (field.thickness[index]! > VISIBLE_THICKNESS) cells++
  return cells
}

/** A filled ellipse with a noisy outline; `along` runs along (directionColumn, directionRow) and `across` is the other half axis, `amount` is the thickness at the centre in mm. */
export function depositBlob(context: DepositContext, centerRow: number, centerColumn: number, along: number, across: number, directionColumn: number, directionRow: number, amount: number, roughness: number): void {
  const random = context.random
  const phaseA = random() * 6.28
  const phaseB = random() * 6.28
  const phaseC = random() * 6.28
  const phaseD = random() * 6.28
  const reach = Math.ceil(Math.max(along, across) * (1 + roughness) + 1.5)
  for (let row = Math.floor(centerRow - reach); row <= centerRow + reach; row++) {
    for (let column = Math.floor(centerColumn - reach); column <= centerColumn + reach; column++) {
      const dx = column + 0.5 - centerColumn
      const dy = row + 0.5 - centerRow
      const alongDistance = dx * directionColumn + dy * directionRow
      const acrossDistance = -dx * directionRow + dy * directionColumn
      const angle = Math.atan2(acrossDistance / across, alongDistance / along)
      const edge = 1 + roughness * (0.45 * Math.sin(3 * angle + phaseA) + 0.3 * Math.sin(5 * angle + phaseB) + 0.18 * Math.sin(8 * angle + phaseC) + 0.12 * Math.sin(13 * angle + phaseD))
      const squared = ((alongDistance / along) * (alongDistance / along) + (acrossDistance / across) * (acrossDistance / across)) / (edge * edge)
      if (squared < 1) depositCell(context, row, column, amount * Math.sqrt(1 - squared))
    }
  }
}

/** A tapered stroke from one cell to another. */
export function depositStroke(context: DepositContext, fromRow: number, fromColumn: number, toRow: number, toColumn: number, startWidth: number, endWidth: number, amount: number): void {
  const { field } = context
  const length = Math.hypot(toRow - fromRow, toColumn - fromColumn)
  const samples = Math.max(2, Math.ceil(length * 2.5))
  for (let sample = 0; sample <= samples; sample++) {
    const progress = sample / samples
    const row = fromRow + (toRow - fromRow) * progress
    const column = fromColumn + (toColumn - fromColumn) * progress
    const width = startWidth + (endWidth - startWidth) * progress
    const reach = Math.ceil(width + 1)
    for (let cellRow = Math.floor(row - reach); cellRow <= row + reach; cellRow++) {
      for (let cellColumn = Math.floor(column - reach); cellColumn <= column + reach; cellColumn++) {
        if (cellRow < 0 || cellColumn < 0 || cellRow >= field.height || cellColumn >= field.width) continue
        const distance = Math.hypot(cellRow + 0.5 - row, cellColumn + 0.5 - column)
        if (distance >= width) continue
        const index = cellRow * field.width + cellColumn
        const target = amount * (1 - distance / width) * 0.5
        if (field.thickness[index]! < target) depositCell(context, cellRow, cellColumn, target - field.thickness[index]!)
      }
    }
  }
}

/**
 * The impact: the body is stretched by 1 / sin(angle), with spikes (long only along the travel), satellites and tails.
 * `size` is the radius in cells of the main body; `profile.spikes` below 1 turns the spikes short and the blobs thick.
 */
export function depositSplat(context: DepositContext, row: number, column: number, size: number, directionColumn: number, directionRow: number, sinAngleIn: number, amount: number): void {
  const random = context.random
  const spikes = context.profile().spikes
  const sinAngle = Math.max(0.17, Math.min(1, sinAngleIn))
  const stretch = Math.min(5.5, 1 / sinAngle)
  const along = size * Math.pow(stretch, 0.75)
  const across = size / Math.pow(stretch, 0.25)
  const frontRow = row + directionRow * along * 0.25
  const frontColumn = column + directionColumn * along * 0.25
  depositBlob(context, frontRow, frontColumn, along, across, directionColumn, directionRow, amount, 0.1 + 0.12 * (1 - sinAngle) + (size < 1.4 ? 0 : 0.06))
  const sideColumn = -directionRow
  const sideRow = directionColumn
  const spikeCount = Math.round(Math.min(18, (size < 1.2 ? 1 : 4) + size * 1.6 + 5 * (1 - sinAngle)) * spikes)
  for (let spike = 0; spike < spikeCount; spike++) {
    const spread = Math.PI * (0.25 + 0.75 * sinAngle * sinAngle)
    let theta = (random() * 2 - 1) * spread
    if (sinAngle > 0.9) theta = random() * 6.283
    const cosine = Math.cos(theta)
    const sine = Math.sin(theta)
    const dx = cosine * directionColumn + sine * sideColumn
    const dy = cosine * directionRow + sine * sideRow
    const length = size * (0.25 + random() * 0.55) * (1 + 2.6 * (1 - sinAngle) * Math.max(0, cosine)) * (sinAngle > 0.9 ? 0.6 : 1) * (0.5 + 0.5 * spikes)
    const startRow = frontRow + (along * cosine * directionRow + across * sine * sideRow) * 0.75
    const startColumn = frontColumn + (along * cosine * directionColumn + across * sine * sideColumn) * 0.75
    const endRow = startRow + dy * length
    const endColumn = startColumn + dx * length
    depositStroke(context, startRow, startColumn, endRow, endColumn, Math.max(0.55, size * 0.22), 0.42, amount * 0.75)
    if (random() < 0.5) {
      const gap = 1 + random() * 2.2
      depositBlob(context, endRow + dy * gap, endColumn + dx * gap, 0.55 + random() * 0.7, 0.5 + random() * 0.4, dx, dy, amount * 0.55, 0.08)
    }
  }
  const satelliteCount = Math.round((1 + size * 0.9) * (1.4 - sinAngle * 0.6) * (0.5 + 0.5 * spikes))
  for (let satellite = 0; satellite < satelliteCount; satellite++) {
    const cone = sinAngle > 0.9 ? Math.PI : 0.18 + 0.6 * sinAngle
    const theta = (random() * 2 - 1) * cone
    const cosine = Math.cos(theta)
    const sine = Math.sin(theta)
    const dx = cosine * directionColumn + sine * sideColumn
    const dy = cosine * directionRow + sine * sideRow
    const distance = along + size * (0.8 + random() * 3.2)
    const radius = 0.45 + random() * Math.min(1.2, size * 0.22)
    const satelliteRow = frontRow + dy * distance
    const satelliteColumn = frontColumn + dx * distance
    depositBlob(context, satelliteRow, satelliteColumn, radius * Math.sqrt(stretch), radius, dx, dy, amount * 0.6, 0.08)
    if (sinAngle < 0.8) depositStroke(context, satelliteRow + dy * radius * stretch * 0.7, satelliteColumn + dx * radius * stretch * 0.7, satelliteRow + dy * radius * stretch * 1.8, satelliteColumn + dx * radius * stretch * 1.8, 0.5, 0.3, amount * 0.35)
  }
}
