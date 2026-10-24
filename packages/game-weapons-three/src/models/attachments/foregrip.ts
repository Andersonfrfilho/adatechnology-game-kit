import type { AttachmentModelBuilder } from './types'

const RIBS = 4

/** The vertical grip: a clamp on the rail and a ribbed handle hanging from it, as long as the data says. */
export const buildForegrip: AttachmentModelBuilder = ({ kit, attachment }) => {
  const { M, box, cylinderY } = kit
  const length = attachment.dims?.length ?? 0.1
  const group = kit.group()
  box(group, 0.045, 0.014, 0.034, M.dark, 0, -0.007, 0)
  cylinderY(group, 0.0135, length, M.poly, 0, -0.014 - length / 2, 0, 14)
  for (let i = 0; i < RIBS; i++) cylinderY(group, 0.0145, 0.004, M.rubber, 0, -0.03 - i * (length / (RIBS + 1)), 0, 14)
  cylinderY(group, 0.0155, 0.01, M.dark, 0, -0.014 - length, 0, 14)
  return group
}
