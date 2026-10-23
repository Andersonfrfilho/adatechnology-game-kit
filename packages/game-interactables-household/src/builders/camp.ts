import type { Vec3 } from '@adatechnology/game-interactables'
import type { Ctx } from '../ctx'
import { HANDLE } from '../parts'
import { mix, round3, shade } from '../util'

const ALU = 0xb4b8bc
const DARK = 0x2e3034

// ---------------------------------------------------------------------------------------------------------------------------------
// Cooler
// ---------------------------------------------------------------------------------------------------------------------------------

export function cooler(c: Ctx): void {
  const { hw, hd, h } = c
  const body = c.main(0x2e6fb7)
  const white = 0xf2f4f5
  const t = 0.035
  const lidT = 0.06
  const top = h - lidT
  const liner = 0xe9eef0
  // hollow insulated box: floor, four walls, lighter liner inside
  c.b('plain', -hw, 0.015, -hd, hw, 0.015 + t, hd, shade(body, 0.8))
  c.b('plain', -hw, 0.015 + t, -hd, hw, top, -hd + t, shade(body, 0.92))
  c.b('plain', -hw, 0.015 + t, hd - t, hw, top, hd, body)
  c.b('plain', -hw, 0.015 + t, -hd + t, -hw + t, top, hd - t, shade(body, 0.96))
  c.b('plain', hw - t, 0.015 + t, -hd + t, hw, top, hd - t, shade(body, 0.96))
  const l = 0.004
  const ix0 = -hw + t
  const ix1 = hw - t
  const iz0 = -hd + t
  const iz1 = hd - t
  const iy0 = 0.015 + t
  c.b('plain', ix0, iy0, iz0, ix1, iy0 + l, iz1, shade(liner, 0.9))
  c.b('plain', ix0, iy0 + l, iz0, ix1, top - 0.002, iz0 + l, liner)
  c.b('plain', ix0, iy0 + l, iz1 - l, ix1, top - 0.002, iz1, liner)
  c.b('plain', ix0, iy0 + l, iz0 + l, ix0 + l, top - 0.002, iz1 - l, mix(liner, body, 0.06))
  c.b('plain', ix1 - l, iy0 + l, iz0 + l, ix1, top - 0.002, iz1 - l, mix(liner, body, 0.06))
  c.b('plain', -hw + 0.02, 0, -hd + 0.02, -hw + 0.07, 0.015, -hd + 0.07, DARK) // feet
  c.b('plain', hw - 0.07, 0, -hd + 0.02, hw - 0.02, 0.015, -hd + 0.07, DARK)
  c.b('plain', -hw + 0.02, 0, hd - 0.07, -hw + 0.07, 0.015, hd - 0.02, DARK)
  c.b('plain', hw - 0.07, 0, hd - 0.07, hw - 0.02, 0.015, hd - 0.02, DARK)
  for (const s of [-1, 1]) c.b('plain', s * hw, top - 0.1, -0.1, s * hw + s * 0.015, top - 0.07, 0.1, DARK) // molded side handles
  c.b('plain', hw - 0.003, 0.05, hd - 0.14, hw, 0.09, hd - 0.1, DARK) // drain plug
  // lid: hinged at the back, a rim that drops into the box
  c.part(
    'lid',
    [0, h, -hd],
    { kind: 'hinge', axis: [1, 0, 0], angle: -1.5 },
    () => {
      c.b('plain', -hw, top, -hd, hw, h, hd, white)
      c.b('plain', -hw + 0.02, top - 0.012, -hd + 0.02, hw - 0.02, top, hd - 0.02, shade(white, 0.92)) // rim under the lid
      c.b('plain', -0.09, h - 0.012, hd - 0.05, 0.09, h, hd, shade(body, 0.8)) // front latch
      c.b('plain', -hw + 0.04, h - 0.006, -hd + 0.04, -hw + 0.07, h, hd - 0.04, shade(white, 0.9)) // molded ribs
      c.b('plain', hw - 0.07, h - 0.006, -hd + 0.04, hw - 0.04, h, hd - 0.04, shade(white, 0.9))
    },
    { label: 'prompt.cooler_lid', at: [0, h, hd - 0.03], radius: 1.6 },
  )
  // loot slots: two rows on the bottom layer (bottles lie across the rows), a tall one for a stack
  const iy1 = top - 0.004
  const cols = 3
  const slots = [
    ...c.row(ix0 + 0.01, ix1 - 0.01, iy0 + l, (iz0 + iz1) / 2 - (iz1 - iz0) / 4, cols, [1, iy1 - iy0 - l, (iz1 - iz0) / 2 - 0.01]),
    ...c.row(ix0 + 0.01, ix1 - 0.01, iy0 + l, (iz0 + iz1) / 2 + (iz1 - iz0) / 4, cols, [1, iy1 - iy0 - l, (iz1 - iz0) / 2 - 0.01]),
  ]
  c.container({ id: 'cooler', access: 'lid', from: [ix0, iy0, iz0], to: [ix1, iy1, iz1], slots, loot: 'cooler' })
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Campfire
// ---------------------------------------------------------------------------------------------------------------------------------

export function campfire(c: Ctx): void {
  const { hw, hd } = c
  const bark = 0x5a3e2a
  const ringR = Math.min(0.4, hw - 0.2, hd - 0.2)
  // ring of stones with a second, sparser course
  const n = 10
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + c.rnd() * 0.1
    const r = ringR + (c.rnd() - 0.5) * 0.04
    const px = Math.sin(a) * r
    const pz = Math.cos(a) * r
    const s = 0.17 + c.rnd() * 0.06
    c.box('plain', px, 0, pz, s, 0.13 + c.rnd() * 0.05, s * 0.9, shade(0x8d8982, 0.7 + c.rnd() * 0.5), a + c.rnd() * 0.5)
    if (i % 3 === 0) c.box('plain', px * 0.96, 0.13, pz * 0.96, s * 0.8, 0.08, s * 0.7, shade(0x8d8982, 0.8 + c.rnd() * 0.4), a)
  }
  c.cyl('plain', 0, 0.001, 0, ringR - 0.1, 0.03, 0x3a3836, 'cyl') // ash bed inside the ring
  c.cyl('plain', 0, 0.031, 0, ringR - 0.2, 0.012, 0x56504a, 'cyl')
  // logs: two lying across, four leaning in like a teepee
  c.rod('wood', 'x', 0, 0.08, 0.05, 0.05, 0.62, bark)
  c.rod('wood', 'z', 0.04, 0.14, 0, 0.05, 0.6, shade(bark, 0.85))
  const tilt = 0.42
  c.cyl('wood', 0.15, 0.3, 0, 0.045, 0.62, shade(bark, 1.05), 'cyl', 0, tilt)
  c.cyl('wood', -0.15, 0.3, 0, 0.045, 0.62, shade(bark, 0.95), 'cyl', 0, -tilt)
  c.cyl('wood', 0, 0.3, 0.15, 0.045, 0.62, shade(bark, 1.1), 'cyl', -tilt, 0)
  c.cyl('wood', 0, 0.3, -0.15, 0.045, 0.62, shade(bark, 0.9), 'cyl', tilt, 0)
  // log seats (only when the footprint leaves room for them)
  const seatR = Math.min(hw, hd) - 0.2
  const seats = seatR >= 0.8
  if (seats) {
    for (const s of [-1, 1]) {
      c.rod('wood', 'x', 0, 0.17, s * seatR, 0.17, 0.9, shade(bark, 1.2))
    }
  }
  c.add('fuels', { id: 'wood', kind: 'wood', capacity: 6, level: 6 })
  const bed: Vec3 = [0, 0.2, 0]
  c.add('burners', { id: 'fire', pos: bed, fuel: 'wood', rate: 0.0008, needsIgnition: true })
  c.add('emitters', { id: 'fire_flame', kind: 'fire', pos: bed, dir: [0, 1, 0], source: 'fire', size: 0.5 })
  c.add('emitters', { id: 'fire_smoke', kind: 'smoke', pos: [0, round3(Math.min(c.h - 0.02, 0.62)), 0], dir: [0, 1, 0], source: 'fire', size: 0.45 })
  c.interact('ignite_fire', [0, 0.5, 0], { do: 'ignite', burner: 'fire' }, 'prompt.campfire_ignite', 1.8)
  c.interact('toggle_fire', [ringR * 0.7, 0.25, ringR * 0.7], { do: 'toggle_burner', burner: 'fire' }, 'prompt.campfire', 1.8)
  if (seats) {
    for (const [i, s] of [-1, 1].entries()) {
      c.add('seats', { id: `seat_${i + 1}`, pose: 'sit', pos: [0, 0.36, round3(s * seatR)], ry: s < 0 ? 0 : Math.PI, exit: [0, 0, round3(s * (seatR + 0.6))] })
      c.interact(`sit_seat_${i + 1}`, [0, 0.6, round3(s * seatR)], { do: 'sit', seat: `seat_${i + 1}` }, 'prompt.sit', 1.5)
    }
  }
  c.spec.colliders = []
  c.collider('ring', -ringR - 0.1, 0, -ringR - 0.1, ringR + 0.1, 0.2, ringR + 0.1)
  if (seats) for (const [i, s] of [-1, 1].entries()) c.collider(`log_${i + 1}`, -0.45, 0, s * seatR - 0.17, 0.45, 0.34, s * seatR + 0.17)
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Camp stove and gas canister
// ---------------------------------------------------------------------------------------------------------------------------------

export function campStove(c: Ctx): void {
  const { hw, hd, h } = c
  const Y = c.y0 // mounting height (the stove stands on a table in a camp)
  const steel = c.metal(ALU)
  const enamel = c.main(0xc0392b)
  const zf = hd - HANDLE
  // case: low tray with the burner head on a stem, three pot supports, a wind guard on three sides
  c.b('metal', -hw, Y + 0.02, -hd, hw, Y + 0.09, zf, enamel)
  c.b('metal', -hw + 0.01, Y + 0.09, -hd + 0.01, hw - 0.01, Y + 0.095, zf - 0.01, shade(enamel, 0.8)) // recessed top
  c.b('metal', -hw + 0.02, Y + 0.001, -hd + 0.02, -hw + 0.06, Y + 0.02, -hd + 0.06, DARK) // feet
  c.b('metal', hw - 0.06, Y + 0.001, -hd + 0.02, hw - 0.02, Y + 0.02, -hd + 0.06, DARK)
  c.b('metal', -hw + 0.02, Y + 0.001, zf - 0.06, -hw + 0.06, Y + 0.02, zf - 0.02, DARK)
  c.b('metal', hw - 0.06, Y + 0.001, zf - 0.06, hw - 0.02, Y + 0.02, zf - 0.02, DARK)
  const burnerY = Y + 0.095
  c.cyl('metal', 0, burnerY, 0, 0.022, 0.03, DARK, 'cyl')
  c.cyl('metal', 0, burnerY + 0.03, 0, 0.055, 0.018, shade(steel, 0.7), 'cyl')
  c.cyl('metal', 0, burnerY + 0.048, 0, 0.042, 0.006, 0x1c1c1e, 'cyl') // flame cap
  for (const a of [0, 2.094, 4.189]) {
    const px = Math.sin(a) * 0.085
    const pz = Math.cos(a) * 0.085
    c.b('metal', px - 0.008, burnerY + 0.02, pz - 0.008, px + 0.008, Y + h - 0.005, pz + 0.008, DARK) // pot supports
  }
  c.cyl('metal', 0, Y + h - 0.012, 0, 0.1, 0.008, DARK, 'cyl6') // support ring
  c.b('metal', -hw + 0.005, burnerY, -hd + 0.005, -hw + 0.012, Y + h - 0.01, zf - 0.04, shade(steel, 0.9)) // wind guard: left, right, back
  c.b('metal', hw - 0.012, burnerY, -hd + 0.005, hw - 0.005, Y + h - 0.01, zf - 0.04, shade(steel, 0.9))
  c.b('metal', -hw + 0.012, burnerY, -hd + 0.005, hw - 0.012, Y + h - 0.01, -hd + 0.012, shade(steel, 0.8))
  // control knob on the front
  const kx = hw * 0.55
  const ky = Y + 0.055
  c.part(
    'knob',
    [kx, ky, zf],
    { kind: 'knob', axis: [0, 0, 1], angle: -2.0 },
    () => {
      c.rod('plain', 'z', kx, ky, zf + 0.006, 0.008, 0.012, 0x2a2a2c, 'cyl6')
      c.rod('plain', 'z', kx, ky, zf + 0.0165, 0.017, 0.011, 0x1e1e20)
      c.b('plain', kx - 0.0025, ky + 0.001, zf + 0.021, kx + 0.0025, ky + 0.016, zf + 0.0225, 0xe8e8e8)
    },
    { label: 'prompt.camp_stove_knob', at: false, noSweep: true, radius: 0.9 },
  )
  c.add('burners', { id: 'burner', pos: [0, round3(burnerY + 0.056), 0], part: 'knob', fuel: 'auto', rate: 0.00004 })
  c.add('emitters', { id: 'burner_flame', kind: 'flame', pos: [0, round3(burnerY + 0.056), 0], dir: [0, 1, 0], source: 'burner', size: 0.05 })
  c.add('wires', {
    id: 'gas_hose', kind: 'cable', radius: 0.005,
    points: [[round3(-hw * 0.6), Y + 0.05, -hd], [round3(-hw * 0.6), Y + 0.03, round3(-hd - 0.08)], [round3(-hw * 0.6 - 0.04), Y + 0.02, round3(-hd - 0.22)]],
  })
  c.interact('use_burner', [kx, ky, round3(zf + HANDLE)], { do: 'toggle_burner', burner: 'burner' }, 'prompt.camp_stove', 0.9)
}

export function gasCanister(c: Ctx): void {
  const g = c.region.canister
  const Y = c.y0
  const R = Math.min(g.diameter, c.w, c.d) / 2
  const H = Math.min(g.height, c.h)
  const col = Number.parseInt(g.color.replace('#', ''), 16)
  c.cyl('metal', 0, Y + 0.001, 0, R * 0.96, 0.011, 0x6a6e72, 'cyl') // rolled bottom
  c.cyl('metal', 0, Y + 0.012, 0, R, H - 0.012 - 0.045, col, 'cyl')
  c.cyl('metal', 0, Y + 0.012 + (H - 0.057) * 0.35, 0, R + 0.001, (H - 0.057) * 0.3, 0xf0ece0, 'cyl') // label band
  c.cyl('metal', 0, Y + H - 0.075, 0, R * 0.96, 0.04, col, 'sphere') // shoulder
  c.cyl('metal', 0, Y + H - 0.05, 0, R * 0.45, 0.012, 0x9a9ea2, 'cyl') // crimped top
  c.cyl('metal', 0, Y + H - 0.04, 0, R * 0.3, 0.02, 0xb08a34, 'cyl6') // valve neck
  c.part(
    'valve',
    [0, Y + H - 0.02, 0],
    { kind: 'knob', axis: [0, 1, 0], angle: 1.6 },
    () => {
      c.cyl('metal', 0, Y + H - 0.02, 0, 0.012, 0.02, 0x8a6a2a, 'cyl6')
      c.b('metal', -0.022, Y + H - 0.004, -0.004, 0.022, Y + H, 0.004, 0xd8d8dc)
    },
    { label: 'prompt.canister_valve', at: false, noSweep: true, radius: 0.9 },
  )
  c.add('fuels', { id: 'gas', kind: 'gas', capacity: g.capacityKg, level: g.capacityKg, valve: 'valve' })
  c.add('damage', { target: 'gas', kind: 'gas', hp: 12 })
  // A small steel can of liquefied butane / propane: it ruptures in a fire and leaks gas through punctures.
  c.spec.destruction = {
    material: 'steel',
    joint: 'weld',
    explodes: { energy: Math.round(g.capacityKg * 46000), radius: 3, atC: 180 },
    contains: { fluid: 'gas', liters: Math.max(0.1, round3(g.capacityKg / 0.54)), pressurized: true },
  }
  c.interact('use_gas', [0, Y + H, 0], { do: 'toggle_fuel', fuel: 'gas' }, 'prompt.canister_valve', 0.9, c.M.requires)
  c.spec.colliders = []
  c.collider('body', -R, Y, -R, R, Y + H, R)
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Lantern
// ---------------------------------------------------------------------------------------------------------------------------------

export function lanternLamp(c: Ctx): void {
  const { h } = c
  const Y = c.y0 // a table lantern stands on a table, a hanging one hangs at this height
  const hanging = c.M.variant === 'hanging'
  const brass = c.metal(0xb08a34)
  const chain = hanging ? 0.1 : 0
  const bodyTop = h - chain
  const baseR = 0.085
  const globeR = 0.062
  // fuel font (reservoir), burner collar, glass globe inside a wire cage, chimney, cap and bail
  c.cyl('metal', 0, Y + 0.001, 0, baseR, 0.029, shade(brass, 0.8), 'cyl')
  c.cyl('metal', 0, Y + 0.03, 0, baseR * 0.9, 0.05, brass, 'sphere')
  c.cyl('metal', 0, Y + 0.075, 0, baseR * 0.75, 0.025, shade(brass, 1.1), 'cyl')
  const gy = Y + 0.1
  const gh = bodyTop - 0.2
  c.cyl('glass', 0, gy, 0, globeR, gh * 0.75, 0xe8f0f2, 'cyl')
  c.cyl('glass', 0, gy + gh * 0.55, 0, globeR * 0.98, gh * 0.45, 0xe8f0f2, 'sphere')
  for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.b('metal', sx * (globeR + 0.012) - 0.003, gy, sz * (globeR + 0.012) - 0.003, sx * (globeR + 0.012) + 0.003, gy + gh, sz * (globeR + 0.012) + 0.003, shade(brass, 0.9))
  c.cyl('metal', 0, gy + gh, 0, baseR * 0.85, 0.03, brass, 'cone')
  c.cyl('metal', 0, gy + gh + 0.03, 0, 0.02, 0.04, shade(brass, 0.8), 'cyl')
  c.cyl('metal', 0, gy + gh + 0.07, 0, 0.045, 0.01, brass, 'cyl')
  c.cyl('plain', 0, gy, 0, 0.012, 0.03, 0xf0e8d0, 'cyl6') // wick
  // bail over the top
  const by = gy + gh + 0.08
  for (const s of [-1, 1]) c.b('metal', s * baseR - 0.003, Y + 0.08, -0.003, s * baseR + 0.003, by + 0.02, 0.003, DARK)
  c.b('metal', -baseR + 0.007, by + 0.014, -0.003, baseR - 0.007, by + 0.02, 0.003, DARK)
  if (hanging) {
    for (let y = by + 0.02; y < Y + h - 0.012; y += 0.022) c.b('metal', -0.004, y, -0.004, 0.004, y + 0.016, 0.004, DARK) // chain links
    c.b('metal', -0.012, Y + h - 0.012, -0.012, 0.012, Y + h, 0.012, DARK)
  }
  // wick wheel
  const kx = baseR * 0.85
  const ky = Y + 0.055
  c.part(
    'wick',
    [kx, ky, 0],
    { kind: 'knob', axis: [1, 0, 0], angle: 1.4 },
    () => {
      c.rod('metal', 'x', kx + 0.01, ky, 0, 0.018, 0.012, DARK)
      c.rod('metal', 'x', kx + 0.016, ky, 0, 0.008, 0.01, brass)
    },
    { label: 'prompt.lantern_knob', at: false, noSweep: true, radius: 0.9 },
  )
  c.add('devices', { id: 'lamp', kind: 'lamp', watts: 0, electric: false, part: 'wick', ...(c.M.on ? { on: true } : {}) })
  c.add('emitters', { id: 'lamp_flame', kind: 'flame', pos: [0, round3(gy + 0.04), 0], dir: [0, 1, 0], source: 'lamp', size: 0.04 })
  c.interact('toggle_lamp', [kx + 0.02, ky, 0], { do: 'toggle_device', device: 'lamp' }, 'prompt.lantern', 1.2)
  c.spec.colliders = []
  if (!hanging) c.collider('body', -baseR, Y, -baseR, baseR, Y + bodyTop, baseR)
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Folding chair and table
// ---------------------------------------------------------------------------------------------------------------------------------

export function campChair(c: Ctx): void {
  const { hw, hd, h } = c
  const tube = c.metal(0x4a4e52)
  const fab = c.fabric(0x2f5d8a)
  const seatY = 0.44
  const tilt = 0.5
  // scissor legs on both sides: two crossing tubes in the y-z plane
  for (const s of [-1, 1]) {
    const x = s * (hw - 0.03)
    c.cyl('metal', x, 0.22, 0, 0.011, 0.5, tube, 'cyl6', tilt, 0)
    c.cyl('metal', x, 0.22, 0, 0.011, 0.5, tube, 'cyl6', -tilt, 0)
    c.rod('metal', 'z', x, seatY - 0.005, 0, 0.012, 2 * hd - 0.1, tube) // seat rail
    c.cyl('metal', x, seatY, hd - 0.05, 0.012, 0.64 - seatY, tube, 'cyl6') // front arm post
    c.rod('metal', 'z', x, 0.64, 0.0, 0.012, 2 * hd - 0.12, shade(tube, 1.1)) // arm rest
    c.cyl('metal', x, seatY, -hd + 0.05, 0.012, h - seatY - 0.02, tube, 'cyl6') // back post
    c.cyl('plain', x, 0.001, 0.12, 0.016, 0.008, DARK, 'cyl6') // rubber feet
    c.cyl('plain', x, 0.001, -0.12, 0.016, 0.008, DARK, 'cyl6')
  }
  // canvas seat and back
  c.b('fabric', -hw + 0.04, seatY - 0.004, -hd + 0.06, hw - 0.04, seatY + 0.006, hd - 0.06, fab)
  c.b('fabric', -hw + 0.045, seatY + 0.006, -hd + 0.065, hw - 0.045, seatY + 0.009, hd - 0.065, shade(fab, 1.1))
  c.b('fabric', -hw + 0.04, seatY + 0.02, -hd + 0.035, hw - 0.04, h - 0.04, -hd + 0.045, fab, 0, -0.1)
  c.b('fabric', -hw + 0.04, h - 0.06, -hd + 0.03, hw - 0.04, h - 0.03, -hd + 0.05, shade(fab, 0.8), 0, -0.1) // stitched top hem
  // cup holder on the right arm
  c.cyl('metal', hw - 0.03, 0.56, 0.02, 0.04, 0.012, shade(tube, 1.3), 'cyl')
  c.add('seats', { id: 'seat', pose: 'sit', pos: [0, round3(seatY + 0.05), 0.02], ry: 0, exit: [0, 0, round3(hd + 0.45)] })
  c.interact('sit', [0, seatY + 0.3, 0.1], { do: 'sit', seat: 'seat' }, 'prompt.sit', 1.5)
}

export function campTable(c: Ctx): void {
  const { hw, hd, h } = c
  const alu = c.metal(ALU)
  const top = c.main(0xd9d4c6)
  const t = 0.025
  // laminate top with an aluminium rim
  c.b('plain', -hw, h - t, -hd, hw, h, hd, top)
  c.b('metal', -hw, h - t - 0.02, -hd, hw, h - t, -hd + 0.025, shade(alu, 0.85))
  c.b('metal', -hw, h - t - 0.02, hd - 0.025, hw, h - t, hd, shade(alu, 0.85))
  c.b('metal', -hw, h - t - 0.02, -hd + 0.025, -hw + 0.025, h - t, hd - 0.025, shade(alu, 0.85))
  c.b('metal', hw - 0.025, h - t - 0.02, -hd + 0.025, hw, h - t, hd - 0.025, shade(alu, 0.85))
  // two scissor frames, one under each end, a cross rod between them
  const tilt = 0.46
  const L = (h - t - 0.02) / Math.cos(tilt)
  for (const s of [-1, 1]) {
    const x = s * (hw - 0.14)
    c.cyl('metal', x, (h - t - 0.02) / 2, 0, 0.014, L, alu, 'cyl6', tilt, 0)
    c.cyl('metal', x, (h - t - 0.02) / 2, 0, 0.014, L, alu, 'cyl6', -tilt, 0)
    c.b('metal', x - 0.02, h - t - 0.035, -hd + 0.06, x + 0.02, h - t - 0.02, hd - 0.06, shade(alu, 0.7)) // frame rail
  }
  c.rod('metal', 'x', 0, 0.2, 0, 0.01, 2 * hw - 0.28, shade(alu, 0.8))
}
