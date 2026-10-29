import { heatify } from './kit'
import type { ModelKit } from './kit'
import { buildBrake } from './attachments/muzzle-brake'
import { captured, recordFitting } from './capture'
import { rail } from './details'
import { buildFittings } from './rifle-fittings'
import { buildForend } from './rifle-forend'
import { buildGrip, buildMagazine } from './rifle-controls'
import { buildStock } from './rifle-stock'
import type { RifleContext } from './rifle-context'
import type { BuiltModel, ModelFamily, ModelOptions, ModelParts } from './types'

const PI = Math.PI

/** Receiver by kind (round, AR, plain), the AK and G3 extras, the ejection port, the bolt and its charging handle. */
function buildReceiver(context: RifleContext): void {
  const { kit, group, parts, options: o, length: L, receiverStart: x0, receiverEnd: x1, receiverHeight: hR, receiverWidth: wR, receiverLength: RL, barrelY: by } = context
  const { M, box, cylinderX, cylinderY, cylinderZ, sphere } = kit
  const receiverMaterial = o.tan ? M.tan : M.metal
  const middle = (x0 + x1) / 2
  if (o.round) {
    cylinderX(group, hR * 0.36, RL, M.steel, middle, by, 0, 20)
    cylinderX(group, hR * 0.32, 0.05, M.steel, x0 - 0.01, by, 0, 18)
  } else if (o.ar) {
    box(group, RL, hR * 0.5, wR, receiverMaterial, middle, hR * 0.25, 0)
    box(group, RL * 0.92, hR * 0.52, wR * 0.96, receiverMaterial, middle - RL * 0.02, -hR * 0.24, 0)
    box(group, 0.05, 0.03, wR * 1.15, receiverMaterial, x0 + RL * 0.62, -hR * 0.5 - 0.01, 0)
    cylinderZ(group, 0.006, 0.012, M.metal, x1 - 0.03, hR * 0.28, wR / 2 + 0.006, 12)
    box(group, 0.012, 0.01, 0.012, M.metal, x1 - 0.05, hR * 0.12, wR / 2 + 0.006)
    box(group, 0.03, 0.008, 0.012, M.dark, x0 + 0.02, hR / 2 + 0.004, 0)
    box(group, 0.012, 0.006, 0.004, M.dark, x0 + RL * 0.55, -hR * 0.15, -wR / 2 - 0.002)
  } else box(group, RL, hR, wR, receiverMaterial, middle, 0, 0)
  if (o.ak) {
    box(group, RL * 0.86, hR * 0.28, wR * 0.95, M.metal, middle - 0.008, hR / 2 + 0.004, 0)
    for (let i = 0; i < 3; i++) box(group, 0.004, hR * 0.3, wR * 0.97, M.dark, x0 + RL * 0.25 + i * 0.02, hR / 2 + 0.004, 0)
    box(group, RL * 0.5, 0.012, 0.003, M.metal, x0 + RL * 0.55, -hR * 0.02, wR / 2 + 0.0015, -0.05)
    box(group, 0.012, 0.014, 0.003, M.dark, x0 + RL * 0.32, -hR * 0.05, wR / 2 + 0.002)
  }
  if (o.g3) {
    cylinderX(group, 0.009, (L - x1) * 0.6, M.metal, x1 + (L - x1) * 0.28, hR * 0.48, 0, 14)
    box(group, 0.012, 0.024, 0.008, M.dark, x1 + (L - x1) * 0.5, hR * 0.48, -0.012)
    cylinderY(group, 0.012, 0.016, M.dark, x0 + 0.03, hR / 2 + 0.008, 0, 12)
  }
  const ejectX = x1 - (o.ejectBack || 0.07)
  const ejectY = o.ar ? hR * 0.2 : by
  box(group, 0.05, hR * 0.36, 0.004, M.hole, ejectX, ejectY, wR / 2 - 0.0004)
  const bolt = kit.pivot(group)
  parts.bolt = bolt
  parts.stroke = Math.min(0.1, RL * 0.32)
  box(bolt, 0.044, hR * 0.26, 0.006, M.steelL, ejectX, ejectY, wR / 2 - 0.0012)
  if (o.charge) {
    box(bolt, 0.012, 0.01, 0.03, M.metal, ejectX + 0.04, ejectY + 0.004, wR / 2 + 0.012)
    sphere(bolt, 0.0065, M.metal, ejectX + 0.04, ejectY + 0.004, wR / 2 + 0.028, 1)
  }
  if (o.ar) box(group, 0.012, 0.016, 0.006, receiverMaterial, ejectX - 0.03, ejectY + 0.004, wR / 2 + 0.004)
  if (o.rail) rail(kit, group, x0 - 0.005, RL + 0.07, hR / 2 + (o.ar ? 0 : 0.003), 0, wR * 0.68)
}

/** Barrel with its jacket, gas tube and muzzle device. */
function buildBarrel(context: RifleContext): void {
  const { kit, group, parts, options: o, length: L, barrelLength: Bl, receiverEnd: x1, barrelRadius: r, barrelY: by } = context
  const { M, box, cylinderX } = kit
  heatify(parts.glow, cylinderX(group, r, Bl, M.metal, L - Bl / 2, by, 0, 16))
  if (o.jacket) {
    cylinderX(group, r * 2, (L - x1) * 0.6, M.dark, x1 + (L - x1) * 0.3, by, 0, 16)
    for (let i = 0; i < 6; i++) cylinderX(group, r * 2.15, 0.004, M.metal, x1 + (L - x1) * (0.05 + i * 0.09), by, 0, 16)
  }
  if (o.gas) cylinderX(group, r * 0.75, (L - x1) * 0.55, M.metal, x1 + (L - x1) * 0.3, by + r * 2.2, 0, 14)
  if (o.brake) {
    const kind = o.brake === 2 ? 2 : 1
    recordFitting(parts, kind === 2 ? 'muzzle_brake_heavy' : 'muzzle_brake', group, () => buildBrake(kit, group, kind, L, by, r, (body) => void heatify(parts.glow, body)))
  } else if (!o.noFH) {
    recordFitting(parts, 'muzzle_default', group, () => {
      heatify(parts.glow, cylinderX(group, r * 1.45, 0.042, M.dark, L - 0.021, by, 0, 16))
      for (let i = 0; i < 4; i++) {
        const angle = (i * PI) / 2 + PI / 4
        box(group, 0.026, 0.0025, 0.004, M.hole, L - 0.02, by + Math.cos(angle) * r * 1.42, Math.sin(angle) * r * 1.42, 0, 0, angle)
      }
    })
  }
  cylinderX(group, r * 0.55, 0.004, M.hole, L + 0.0005, by, 0, 12)
}

const familyOf = (o: ModelOptions): ModelFamily => {
  if (o.mag === 'belt') return 'belt'
  if (o.pump) return 'pump'
  if (o.lever) return 'lever'
  if (o.tube) return 'semi12'
  if (o.bolt) return o.mag === 'box' ? 'boltmag' : 'bolt'
  return o.mag === 'internal' ? 'semiint' : 'rifle'
}

/** Port of the gallery's `rifle`, the builder of 51 of the weapons: receiver, barrel, forend, grip, magazine, stock and what is fitted on them. */
export function buildRifle(kit: ModelKit, options: ModelOptions): BuiltModel {
  const { M } = kit
  const group = kit.group()
  const parts: ModelParts = { family: 'rifle', glow: [] }
  const length = (options.L ?? 0) / 1000
  const barrelLength = (options.B ?? 0) / 1000
  const isTraditional = options.stock === 'trad' || options.stock === 'straight'
  const stockLength = options.stock === 'none' ? 0 : options.stockLen || Math.min(0.36, Math.max(0.2, 0.3 * length))
  const receiverStart = stockLength
  const receiverEnd = Math.max(receiverStart + 0.12, length - barrelLength * 0.92)
  const receiverHeight = options.hR || 0.06
  const context: RifleContext = {
    kit,
    group,
    parts,
    options,
    furniture: options.wood ? M.wood : options.olive ? M.olive : options.tan ? M.tan : M.poly,
    isTraditional,
    length,
    barrelLength,
    stockLength,
    receiverStart,
    receiverEnd,
    receiverHeight,
    receiverWidth: options.wR || 0.034,
    barrelRadius: options.br || 0.0085,
    barrelY: receiverHeight * 0.15,
    receiverLength: receiverEnd - receiverStart,
  }
  buildReceiver(context)
  buildBarrel(context)
  buildForend(context)
  const gripX = buildGrip(context)
  const magazineX = buildMagazine(context, gripX)
  parts.stockMeshes = context.isTraditional ? [] : captured(group, () => buildStock(context, magazineX))
  if (context.isTraditional) buildStock(context, magazineX)
  buildFittings(context, gripX)
  const hasHandguard = !context.isTraditional && options.hg !== 'none'
  parts.frames = {
    length,
    barrelY: context.barrelY,
    barrelRadius: context.barrelRadius,
    receiverStart,
    receiverEnd,
    receiverHeight,
    receiverWidth: context.receiverWidth,
    handguardEnd: receiverEnd + (length - receiverEnd) * (hasHandguard ? options.hgFrac || 0.5 : 0.4),
    magazineX,
    gripX,
    hasRail: Boolean(options.rail),
  }
  const { barrelY: by, receiverWidth: wR } = context
  const ejectX = receiverEnd - (options.ejectBack || 0.07)
  const ejectY = options.ar ? receiverHeight * 0.2 : by
  parts.muzzle = kit.mark(group, length + 0.01, by, 0)
  parts.eject = kit.mark(group, ejectX, ejectY, wR / 2 + 0.006)
  parts.loadPort = kit.mark(group, receiverEnd - 0.05, -receiverHeight / 2 - 0.004, 0)
  parts.topLoad = kit.mark(group, ejectX, receiverHeight / 2 + 0.004, 0)
  parts.family = familyOf(options)
  return { group, parts }
}
