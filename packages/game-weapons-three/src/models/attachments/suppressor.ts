import type { AttachmentModelBuilder } from './types'

const BAFFLES = 5

/**
 * A suppressor: a dark tube with baffle rings and a capped end, from the length and diameter of the data. Screwed on the muzzle it goes past it and the muzzle moves to its end;
 * an integral one is the front of the barrel and ends at the muzzle. The oil filter is the improvised one: a rusty can taped on.
 */
export const buildSuppressor: AttachmentModelBuilder = ({ kit, attachment, fitted }) => {
  const { M, cylinderX } = kit
  const length = attachment.dims?.length ?? 0.2
  const radius = (attachment.dims?.diameter ?? 0.045) / 2
  const isImprovised = attachment.id === 'oil_filter_suppressor'
  const group = kit.group()
  const middle = fitted.integral === true ? -length / 2 : length / 2
  cylinderX(group, radius, length, isImprovised ? M.rust : M.dark, middle, 0, 0, 18)
  if (isImprovised) {
    for (const along of [0.2, 0.8]) cylinderX(group, radius * 1.04, 0.012, M.tape, middle - length / 2 + length * along, 0, 0, 18)
    cylinderX(group, radius * 0.7, 0.008, M.rustD, middle + length / 2 - 0.004, 0, 0, 14)
  } else {
    for (let i = 0; i < BAFFLES; i++) cylinderX(group, radius * 1.03, 0.004, M.metal, middle - length / 2 + (length * (i + 0.5)) / BAFFLES, 0, 0, 18)
    cylinderX(group, radius * 0.9, 0.006, M.steel, middle - length / 2 + 0.003, 0, 0, 18)
  }
  cylinderX(group, radius * 0.22, 0.004, M.hole, middle + length / 2 + 0.0005, 0, 0, 12)
  return { object: group, ...(fitted.integral === true ? {} : { muzzleOffset: length }) }
}
