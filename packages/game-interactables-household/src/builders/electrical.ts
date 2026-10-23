import type { Vec3 } from '@adatechnology/game-interactables'
import type { Ctx } from '../ctx'
import { HANDLE, hingedDoor, plugged, shell } from '../parts'
import { round3, shade } from '../util'

/** Plate with the holes of the region's socket standard on its front face. */
export function wallSocket(c: Ctx): void {
  const { hd, w, h, y0 } = c
  const cx = 0
  const cy = y0 + h / 2
  const zp = -hd + 0.012
  const plate = c.main(0xf1f1ee)
  c.b('plain', -w / 2, y0, -hd, w / 2, y0 + h, zp, plate)
  c.b('plain', -w / 2 + 0.006, y0 + 0.006, zp, w / 2 - 0.006, y0 + h - 0.006, zp + 0.003, shade(plate, 0.97)) // raised face
  c.rod('plain', 'z', cx, cy, zp + 0.0035, 0.0285, 0.0015, shade(plate, 0.92))
  const dark = 0x1c1c1e
  if (c.region.socket.layout === 'br') {
    // NBR 14136: two 4 mm round holes and the earth hole, in a triangle
    for (const s of [-1, 1]) c.rod('plain', 'z', cx + s * 0.0095, cy + 0.008, zp + 0.004, 0.0045, 0.002, dark, 'cyl6')
    c.rod('plain', 'z', cx, cy - 0.011, zp + 0.004, 0.0045, 0.002, dark, 'cyl6')
  } else {
    // NEMA 5-15: two flat slots and the round earth hole
    for (const s of [-1, 1]) c.b('plain', cx + s * 0.0095 - 0.0015, cy + 0.002, zp + 0.0034, cx + s * 0.0095 + 0.0015, cy + 0.016, zp + 0.0046, dark)
    c.rod('plain', 'z', cx, cy - 0.012, zp + 0.004, 0.0045, 0.002, dark, 'cyl6')
  }
  c.b('metal', -0.002, y0 + h - 0.012, zp + 0.003, 0.002, y0 + h - 0.008, zp + 0.0045, 0x8a8c90) // screw
  c.b('metal', -0.002, y0 + 0.008, zp + 0.003, 0.002, y0 + 0.012, zp + 0.0045, 0x8a8c90)
  const s: { id: string; pos: Vec3; circuit?: string } = { id: 'socket', pos: [cx, round3(cy), round3(zp + 0.004)] }
  if (c.M.circuit) s.circuit = c.M.circuit
  c.add('sockets', s)
  c.spec.colliders = []
}

export function wallSwitch(c: Ctx): void {
  const { hd, w, h, y0 } = c
  const cy = y0 + h / 2
  const zp = -hd + 0.012
  const plate = c.main(0xf1f1ee)
  c.b('plain', -w / 2, y0, -hd, w / 2, y0 + h, zp, plate)
  c.b('plain', -w / 2 + 0.006, y0 + 0.006, zp, w / 2 - 0.006, y0 + h - 0.006, zp + 0.003, shade(plate, 0.97))
  c.b('plain', -0.018, cy - 0.032, zp + 0.003, 0.018, cy + 0.032, zp + 0.006, shade(plate, 0.85)) // key frame
  c.part(
    'rocker', [0, cy, zp + 0.006], { kind: 'rocker', axis: [1, 0, 0], angle: 0.25 },
    () => {
      c.b('plain', -0.014, cy - 0.028, zp + 0.006, 0.014, cy + 0.028, zp + 0.016, shade(plate, 1.02))
      c.b('plain', -0.012, cy + 0.004, zp + 0.016, 0.012, cy + 0.028, zp + 0.0175, shade(plate, 0.9))
    },
    { label: 'prompt.switch', at: false, radius: 1.0, noSweep: true },
  )
  c.add('switches', { id: 'switch', part: 'rocker', controls: [...(c.M.controls ?? [])] })
  c.interact('use_switch', [0, round3(cy), round3(zp + 0.02)], { do: 'toggle_switch', switch: 'switch' }, 'prompt.switch', 1.0)
  c.spec.colliders = []
}

export function serviceEntrance(c: Ctx): void {
  const { hw, h } = c
  const pole = c.main(0xa9a9a1)
  const top = h - 0.1
  // tapered concrete pole in two sections with a flared base
  c.cyl('plain', 0, 0, 0, 0.15, 0.25, shade(pole, 0.9), 'cyl')
  c.cyl('plain', 0, 0.25, 0, 0.13, top * 0.55, pole, 'cyl')
  c.cyl('plain', 0, 0.25 + top * 0.55, 0, 0.11, top * 0.45 - 0.15, shade(pole, 1.04), 'cyl')
  for (let y = 0.9; y < top; y += 0.9) c.cyl('plain', 0, y, 0, y < top * 0.55 ? 0.134 : 0.114, 0.015, shade(pole, 0.82), 'cyl')
  // cross arm and insulators
  const ay = top - 0.25
  c.b('wood', -hw + 0.02, ay, -0.045, hw - 0.02, ay + 0.09, 0.045, 0x6b5a42)
  c.b('metal', -0.04, ay - 0.12, -0.02, 0.04, ay, 0.02, 0x6a6e72)
  const ins: Vec3[] = []
  for (const x of [-0.22, 0.0, 0.22]) {
    c.cyl('plain', x, ay + 0.09, 0, 0.022, 0.05, 0x6a8a9a, 'cyl')
    c.cyl('plain', x, ay + 0.14, 0, 0.03, 0.03, 0x7a9aaa, 'cyl')
    ins.push([x, round3(ay + 0.17), 0])
  }
  if (c.M.variant === 'gato') {
    // illegal tap ("gato"): the drop wire is hooked straight onto the line, there is no meter, no breaker box and no riser
    const gh: Vec3 = c.M.house ?? [0, 3.2, 8]
    const g0: Vec3 = ins[1]
    const gp: Vec3[] = []
    for (let i = 0; i <= 14; i++) {
      const t = i / 14
      gp.push([round3(g0[0] + (gh[0] - g0[0]) * t), round3(g0[1] + (gh[1] - g0[1]) * t - (c.M.sag ?? 0.5) * 4 * t * (1 - t)), round3(g0[2] + (gh[2] - g0[2]) * t)])
    }
    c.add('wires', { id: 'drop', kind: 'drop', radius: 0.006, points: gp })
    c.add('wires', { id: 'hook', kind: 'cable', radius: 0.004, points: [[0.22, round3(ay + 0.17), 0], [0.12, round3(ay + 0.06), 0.05], [round3(g0[0]), round3(g0[1]), 0]] })
    c.spec.colliders = []
    c.collider('pole', -0.15, 0, -0.15, 0.15, h, 0.15)
    c.add('damage', { target: 'self', kind: 'masonry', hp: 600 })
    return
  }
  // meter box on the pole front with a door part and a window
  const mx = 0.19
  const my = 1.45
  const mz = 0.14
  c.b('metal', -mx, my, mz - 0.06, mx, my + 0.5, mz + 0.06, 0x8a8e92)
  c.b('plain', -mx + 0.02, my + 0.02, mz + 0.0, mx - 0.02, my + 0.48, mz + 0.06, 0xd4d6d6) // inner liner
  c.cyl('plain', 0, my + 0.28, mz + 0.03, 0.09, 0.02, 0xf2f2f0, 'cyl') // the meter
  c.rod('plain', 'z', 0, my + 0.28, mz + 0.045, 0.07, 0.004, 0xe8e8e0)
  for (let i = 0; i < 4; i++) c.b('plain', -0.06 + i * 0.03, my + 0.34, mz + 0.047, -0.04 + i * 0.03, my + 0.37, mz + 0.05, 0x2a2a2a)
  c.b('plain', -0.06, my + 0.12, mz + 0.03, 0.06, my + 0.2, mz + 0.045, 0x4a4a4e) // breaker
  c.part(
    'meter_door', [-mx, my + 0.25, mz + 0.062], { kind: 'hinge', axis: [0, 1, 0], angle: -1.7 },
    () => {
      c.b('metal', -mx - 0.01, my - 0.01, mz + 0.06, mx + 0.01, my + 0.51, mz + 0.072, 0x9a9ea2)
      c.plane('glass', 0, my + 0.28, mz + 0.0735, 0.2, 0.2, 0x8aa0aa)
      c.b('metal', mx - 0.04, my + 0.2, mz + 0.072, mx - 0.015, my + 0.3, mz + 0.082, 0x5a5e62)
    },
    { label: 'prompt.meter_door', at: [0, my + 0.25, mz + 0.09], radius: 1.4 },
  )
  // wires: drop to the house point, riser conduit from the meter to the arm, earth cable
  const house: Vec3 = c.M.house ?? [0, 3.2, 8]
  const sag = c.M.sag ?? 0.35
  const A: Vec3 = ins[1]
  const pts: Vec3[] = []
  const n = 14
  for (let i = 0; i <= n; i++) {
    const t = i / n
    pts.push([round3(A[0] + (house[0] - A[0]) * t), round3(A[1] + (house[1] - A[1]) * t - sag * 4 * t * (1 - t)), round3(A[2] + (house[2] - A[2]) * t)])
  }
  c.add('wires', { id: 'drop', kind: 'drop', radius: 0.008, points: pts })
  c.add('wires', { id: 'riser', kind: 'conduit', radius: 0.014, points: [[0.05, my + 0.5, mz], [0.05, my + 0.7, 0.14], [0.05, round3(ay + 0.05), 0.115], [0, round3(A[1]), 0.0]] })
  c.add('wires', { id: 'earth', kind: 'cable', radius: 0.006, points: [[-0.1, my, mz], [-0.16, 0.9, 0.16], [-0.16, 0.05, 0.18]] })
  c.cyl('metal', -0.16, 0.001, 0.18, 0.01, 0.3, 0xb87333, 'cyl6') // earth rod
  c.spec.colliders = []
  c.collider('pole', -0.15, 0, -0.15, 0.15, h, 0.15)
  c.collider('meter', -mx, my, mz - 0.06, mx, my + 0.5, mz + 0.08)
  c.add('damage', { target: 'self', kind: 'masonry', hp: 600 })
}

export function conduitRun(c: Ctx): void {
  const pts: Vec3[] = c.M.points && c.M.points.length >= 2 ? c.M.points.map((p) => [...p] as Vec3) : [[-0.05, 0.1, 0], [0.05, 0.1, 0]]
  c.add('wires', { id: 'conduit', kind: 'conduit', radius: 0.012, points: pts })
  c.spec.colliders = []
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Appliances
// ---------------------------------------------------------------------------------------------------------------------------------

export function tv(c: Ctx): void {
  const { hw, hd, w, h, y0 } = c
  const bz = 0.04 // panel thickness
  const py = y0 + 0.07
  const ph = h - 0.07
  const frame = 0x24272b
  // stand: foot plate and neck
  c.b('plain', -0.22, y0, -hd * 0.5, 0.22, y0 + 0.02, hd * 0.9, 0x1e2024)
  c.b('plain', -0.04, y0 + 0.02, -0.03, 0.04, py + 0.05, 0.03, 0x1e2024)
  // panel: bezel, back shell, screen
  c.b('plain', -hw, py, -0.02, hw, py + ph, -0.02 + bz, frame)
  c.b('plain', -hw + 0.1, py + 0.05, -0.02 - 0.03, hw - 0.1, py + ph - 0.06, -0.02, shade(frame, 1.3)) // bulge at the back
  c.b('plain', -hw + 0.012, py + 0.012, -0.02 + bz, hw - 0.012, py + ph - 0.012, -0.02 + bz + 0.002, 0x0a0b0d) // inner border
  c.plane('emissive', 0, py + ph / 2, -0.02 + bz + 0.003, w - 0.05, ph - 0.05, 0x161c26)
  c.b('plain', -hw + 0.004, py - 0.012, -0.02 + bz - 0.01, hw - 0.004, py, -0.02 + bz, shade(frame, 1.4)) // chin
  c.b('plain', -0.02, py + 0.006, -0.02 + bz, 0.02, py + 0.009, -0.02 + bz + 0.002, 0x888a90) // logo
  // power button
  const bx = hw - 0.06
  c.part('power', [bx, py + 0.005, -0.02 + bz], { kind: 'rocker', axis: [1, 0, 0], angle: 0.2 }, () => {
    c.b('plain', bx - 0.01, py - 0.008, -0.02 + bz - 0.004, bx + 0.01, py + 0.002, -0.02 + bz + 0.006, 0x3a3c40)
  }, { label: 'prompt.tv_power', at: false, noSweep: true, radius: 1.2 })
  plugged(c, 'tv', 'screen', 90, [hw * 0.5, py + 0.1, -0.02 - 0.03], { part: 'power', channels: 6, on: c.M.on })
  c.interact('use_tv', [0, py + ph / 2, hd], { do: 'toggle_device', device: 'tv' }, 'prompt.tv', 2.5)
  c.interact('channel_tv', [hw * 0.5, py + ph * 0.5, hd], { do: 'cycle_device', device: 'tv' }, 'prompt.tv_channel', 2.5)
}

export function microwave(c: Ctx): void {
  const { hw, hd, h, y0 } = c
  const body = c.main(0xd9dcdf)
  const zf = hd - HANDLE
  const dt = 0.03
  const zb = zf - dt - 0.003
  const y1 = y0 + h
  const sh = shell(c, { x0: -hw, x1: hw, y0: y0 + 0.012, y1, z0: -hd, z1: zb, color: body, inner: 0xe8eaec, t: 0.014, tBack: 0.012, material: 'plain' })
  for (const sx of [-1, 1]) c.b('plain', sx * (hw - 0.04) - 0.02, y0, -hd + 0.04, sx * (hw - 0.04) + 0.02, y0 + 0.012, zb - 0.04, 0x2a2a2c) // feet
  const px = hw * 0.55 // start of the control panel
  c.b('plain', px, y0 + 0.012, zb - 0.002, hw - 0.014, y1 - 0.014, zf, shade(body, 0.7)) // panel
  c.cyl('metal', (sh.ix0 + px) / 2, y0 + 0.026, (sh.iz0 + zb) / 2, 0.14, 0.012, 0xcfe0e6, 'cyl') // turntable plate
  c.cyl('plain', (sh.ix0 + px) / 2, y0 + 0.014, (sh.iz0 + zb) / 2, 0.03, 0.012, 0x888a8c, 'cyl6')
  for (let i = 0; i < 6; i++) c.b('plain', px + 0.02, y1 - 0.06 - i * 0.034, zf, hw - 0.04, y1 - 0.04 - i * 0.034, zf + 0.004, i === 5 ? 0x4a8a4a : 0x4a4c50) // buttons
  c.b('plain', px + 0.02, y1 - 0.045, zf, hw - 0.04, y1 - 0.024, zf + 0.002, 0x0c1a10) // display
  hingedDoor(c, {
    id: 'door', x0: sh.ix0 - 0.014 + 0.003, x1: px - 0.003, y0: y0 + 0.014, y1: y1 - 0.014, zf, t: dt, side: 'left', color: shade(body, 0.9), inner: 0xd0d4d6, style: 'flat', handle: 'bar_v', handleLen: 0.16, angle: 1.7, label: 'prompt.microwave_door',
    extra: () => {
      c.plane('glass', (-hw + 0.017 + px - 0.003) / 2 - 0.02, y0 + h / 2, zf + 0.0015, px + hw - 0.17, h - 0.07, 0x16181a)
    },
  })
  c.part('dial', [hw - 0.07, y0 + 0.07, zf], { kind: 'knob', axis: [0, 0, 1], angle: 3.2 }, () => {
    c.rod('plain', 'z', hw - 0.07, y0 + 0.07, zf + 0.008, 0.016, 0.016, 0x3a3c40)
    c.b('plain', hw - 0.073, y0 + 0.075, zf + 0.012, hw - 0.067, y0 + 0.085, zf + 0.018, 0xe8e8e8)
  }, { label: 'prompt.microwave_dial', at: false, noSweep: true })
  plugged(c, 'microwave', 'appliance', 1200, [hw * 0.5, y0 + 0.08, -hd], { part: 'dial', on: c.M.on })
  c.interact('use_microwave', [hw - 0.07, y0 + 0.07, zf + 0.03], { do: 'toggle_device', device: 'microwave' }, 'prompt.microwave', 1.2)
}

export function washingMachine(c: Ctx): void {
  const { hw, hd, h } = c
  const body = c.main(0xf0f2f3)
  const zf = hd - HANDLE
  const cy = 0.4
  const R = 0.2
  // cabinet: sides, top, back, plinth; the front is four plates around the square porthole opening
  c.b('plain', -hw, 0.03, -hd, -hw + 0.02, h, zf, body)
  c.b('plain', hw - 0.02, 0.03, -hd, hw, h, zf, body)
  c.b('plain', -hw + 0.02, 0.03, -hd, hw - 0.02, h, -hd + 0.015, shade(body, 0.9))
  c.b('plain', -hw + 0.02, h - 0.02, -hd + 0.015, hw - 0.02, h, zf, shade(body, 0.97))
  c.b('plain', -hw + 0.02, 0.03, -hd + 0.015, hw - 0.02, 0.05, zf, shade(body, 0.85))
  c.b('plain', -hw + 0.02, 0, -hd + 0.03, hw - 0.02, 0.03, zf - 0.02, 0x2c2e30)
  const o = R + 0.03
  c.b('plain', -hw + 0.02, cy + o, zf - 0.03, hw - 0.02, h - 0.02, zf, body) // above opening (control strip)
  c.b('plain', -hw + 0.02, 0.05, zf - 0.03, hw - 0.02, cy - o, zf, body)
  c.b('plain', -hw + 0.02, cy - o, zf - 0.03, -o, cy + o, zf, body)
  c.b('plain', o, cy - o, zf - 0.03, hw - 0.02, cy + o, zf, body)
  // drum seen through the opening
  c.rod('plain', 'z', 0, cy, zf - 0.26, R + 0.005, 0.5, 0x2a2c30)
  c.rod('metal', 'z', 0, cy, zf - 0.035, R + 0.02, 0.02, 0xb4b8bc)
  c.rod('plain', 'z', 0, cy, zf - 0.026, R - 0.01, 0.02, 0x1c1e22)
  // control strip: soap drawer, display and dial
  c.b('plain', -hw + 0.04, h - 0.1, zf, -hw + 0.18, h - 0.04, zf + 0.004, 0xdcdfe0)
  c.b('plain', hw - 0.2, h - 0.085, zf, hw - 0.12, h - 0.055, zf + 0.004, 0x0c1a10)
  c.part('dial', [hw * 0.0 + 0.04, h - 0.07, zf], { kind: 'knob', axis: [0, 0, 1], angle: 3.0 }, () => {
    c.rod('plain', 'z', 0.04, h - 0.07, zf + 0.008, 0.026, 0.016, 0x3a3c40)
    c.b('plain', 0.037, h - 0.05, zf + 0.012, 0.043, h - 0.035, zf + 0.018, 0xe8e8e8)
  }, { label: 'prompt.washing_dial', at: false, noSweep: true })
  // round door hinged on the left side of the porthole
  const dz = zf + 0.004
  c.part(
    'door', [-R - 0.03, cy, dz], { kind: 'hinge', axis: [0, 1, 0], angle: -1.7 },
    () => {
      c.rod('plain', 'z', 0, cy, dz + 0.02, R + 0.03, 0.04, 0xe2e5e6)
      c.rod('plain', 'z', 0, cy, dz + 0.0405, R - 0.02, 0.001, 0x8a8e92)
      c.rod('glass', 'z', 0, cy, dz + 0.042, R - 0.035, 0.003, 0x7e98a4)
      c.b('plain', R - 0.0, cy - 0.04, dz + 0.02, R + 0.045, cy + 0.04, dz + 0.04, 0xcdd0d2) // latch
    },
    { label: 'prompt.washing_door', at: [0, cy, dz + 0.06], radius: 1.3 },
  )
  // water inlet at the back: the hose draws 12 l/min while a cycle runs (the device drives the fixture)
  c.add('fixtures', { id: 'inlet', kind: 'hose', outlet: [round3(-hw * 0.6), 0.2, -hd], dir: [0, 0, -1], flow: 12 })
  plugged(c, 'washer', 'appliance', 500, [hw * 0.5, 0.15, -hd], { part: 'dial', on: c.M.on, fixture: 'inlet' })
  c.interact('use_washer', [0.04, h - 0.07, zf + 0.03], { do: 'toggle_device', device: 'washer' }, 'prompt.washing_machine', 1.2)
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Breaker panel and meter box
// ---------------------------------------------------------------------------------------------------------------------------------

/** Wall breaker panel: a door over a DIN rail with one rocker part per circuit (`item.circuits`), each toggling its building circuit. */
export function electricalPanel(c: Ctx): void {
  const { hw, hd, h, y0 } = c
  const circuits = c.M.circuits && c.M.circuits.length > 0 ? c.M.circuits : [{ id: 'main' }]
  const n = circuits.length
  const body = c.main(0xc9cdd0)
  const y1 = y0 + h
  const dt = 0.012
  const zf = hd
  const sh = shell(c, { x0: -hw, x1: hw, y0, y1, z0: -hd, z1: zf - dt - 0.003, color: body, inner: 0xe4e6e8, t: 0.012, tBack: 0.008, material: 'metal' })
  const cols = n > 6 ? 2 : 1
  const rows = Math.ceil(n / cols)
  const top = sh.iy1 - 0.04
  const bottom = sh.iy0 + 0.04
  const pitch = Math.min(0.07, (top - bottom) / rows)
  const colW = (sh.ix1 - sh.ix0 - 0.04) / cols
  const bw = Math.min(0.06, colW - 0.05)
  const zb = sh.iz0 + 0.04
  for (let k = 0; k < cols; k++) c.b('metal', sh.ix0 + 0.02 + k * colW + colW / 2 - 0.008, bottom - 0.01, sh.iz0, sh.ix0 + 0.02 + k * colW + colW / 2 + 0.008, top + 0.01, sh.iz0 + 0.012, 0x8a8e92) // DIN rail
  const used = new Set<string>()
  circuits.forEach((circ, i) => {
    const col = Math.floor(i / rows)
    const row = i % rows
    const cx = sh.ix0 + 0.02 + col * colW + colW / 2
    const cy = top - (row + 0.5) * pitch
    let part = `breaker_${circ.id.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
    if (used.has(part)) part = `${part}_${i}`
    used.add(part)
    c.b('plain', cx - bw / 2, cy - pitch / 2 + 0.004, sh.iz0 + 0.012, cx + bw / 2, cy + pitch / 2 - 0.004, zb, 0x2a2c30) // breaker module
    c.b('plain', cx - bw / 2 - 0.045, cy - 0.008, sh.iz0 + 0.012, cx - bw / 2 - 0.006, cy + 0.008, sh.iz0 + 0.016, 0xf4f4f0) // label tag
    c.part(
      part, [cx, cy, zb], { kind: 'rocker', axis: [1, 0, 0], angle: 0.4 },
      () => {
        c.b('plain', cx - bw * 0.3, cy - pitch * 0.3, zb, cx + bw * 0.3, cy + pitch * 0.3, zb + 0.016, 0xe8e8e8)
        c.b('plain', cx - bw * 0.3, cy + pitch * 0.05, zb + 0.016, cx + bw * 0.3, cy + pitch * 0.3, zb + 0.0175, 0xd04030)
      },
      { t0: 1, requires: 'door', at: false, noSweep: true },
    )
    const action: { do: 'toggle_breaker'; circuit: string; part: string; name?: string } = { do: 'toggle_breaker', circuit: circ.id, part }
    if (circ.label) action.name = circ.label
    c.interact(`toggle_${part}`, [round3(cx), round3(cy), round3(zb + 0.02)], action, 'prompt.breaker', 0.9)
  })
  hingedDoor(c, {
    id: 'door', x0: -hw + 0.003, x1: hw - 0.003, y0: y0 + 0.003, y1: y1 - 0.003, zf, t: dt, side: 'left', color: shade(body, 1.04), inner: 0xd8dadc, style: 'flat', handle: 'none', angle: 1.7, label: 'prompt.panel_door',
    extra: () => {
      c.b('plain', hw - 0.05, (y0 + y1) / 2 - 0.02, zf, hw - 0.02, (y0 + y1) / 2 + 0.02, zf + 0.008, 0x5a5e62) // latch
      c.b('plain', -hw + 0.04, y1 - 0.06, zf, hw - 0.04, y1 - 0.03, zf + 0.002, 0xe8e8e0) // circuit directory card
    },
  })
  c.spec.colliders = []
}

/** Utility meter box: grey case, a dial meter behind a glass window in the door, a lead seal on the latch. */
export function powerMeter(c: Ctx): void {
  const { hw, hd, h, y0 } = c
  const body = c.main(0x8a8e92)
  const y1 = y0 + h
  const dt = 0.014
  const zf = hd
  const sh = shell(c, { x0: -hw, x1: hw, y0, y1, z0: -hd, z1: zf - dt - 0.004, color: body, inner: 0xd4d6d6, t: 0.012, tBack: 0.01, material: 'metal' })
  const cx = 0
  const cy = (y0 + y1) / 2 + 0.02
  const R = Math.min(hw - 0.04, 0.09)
  c.rod('plain', 'z', cx, cy, sh.iz0 + 0.03, R, 0.03, 0xf2f2f0) // meter body
  c.rod('plain', 'z', cx, cy, sh.iz0 + 0.046, R - 0.012, 0.004, 0xe8e8e0) // dial face
  for (let i = 0; i < 5; i++) c.b('plain', cx - 0.05 + i * 0.02, cy + 0.025, sh.iz0 + 0.048, cx - 0.034 + i * 0.02, cy + 0.05, sh.iz0 + 0.05, 0x2a2a2a) // digits
  c.rod('plain', 'z', cx, cy - 0.02, sh.iz0 + 0.049, 0.026, 0.002, 0xd8d0c0) // rotating disc seen through the slot
  c.b('plain', cx - 0.05, y0 + 0.025, sh.iz0, cx + 0.05, y0 + 0.07, sh.iz0 + 0.04, 0x4a4a4e) // terminal block
  const px = -hw + 0.004
  const f = 0.028
  const wy0 = y0 + 0.02
  const wy1 = y1 - 0.02
  const wx0 = -hw + 0.004
  const wx1 = hw - 0.004
  c.part(
    'door', [px, (y0 + y1) / 2, zf - dt / 2], { kind: 'hinge', axis: [0, 1, 0], angle: -1.7 },
    () => {
      const z0 = zf - dt
      c.b('metal', wx0, wy0, z0, wx1, wy0 + f, zf, shade(body, 1.1)) // frame around the window
      c.b('metal', wx0, wy1 - f, z0, wx1, wy1, zf, shade(body, 1.1))
      c.b('metal', wx0, wy0 + f, z0, wx0 + f, wy1 - f, zf, shade(body, 1.1))
      c.b('metal', wx1 - f, wy0 + f, z0, wx1, wy1 - f, zf, shade(body, 1.1))
      c.plane('glass', 0, (wy0 + wy1) / 2, z0 + dt * 0.6, wx1 - wx0 - 2 * f, wy1 - wy0 - 2 * f, 0x8aa0aa)
      c.b('metal', wx1 - f - 0.012, (wy0 + wy1) / 2 - 0.025, zf, wx1 - f + 0.012, (wy0 + wy1) / 2 + 0.025, zf + 0.008, 0x5a5e62) // latch
      c.rod('metal', 'z', wx1 - f, (wy0 + wy1) / 2 - 0.04, zf + 0.012, 0.008, 0.012, 0xc4c4cc) // lead seal
      c.b('plain', wx1 - f - 0.002, (wy0 + wy1) / 2 - 0.036, zf + 0.002, wx1 - f + 0.002, (wy0 + wy1) / 2 - 0.02, zf + 0.004, 0xb8b8c0) // seal wire
    },
    { label: 'prompt.meter_door', at: [0, (y0 + y1) / 2, zf + 0.06], radius: 1.4 },
  )
  c.spec.colliders = []
}
