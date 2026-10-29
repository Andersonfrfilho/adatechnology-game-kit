import type { ModuleScenario, Vec3 } from '@adatechnology/game-contracts'
import { createArcadeDriver, createSemiSimDriver, createSurfaces, vehicleCorners } from '@adatechnology/game-vehicles-driving'
import type { SemiInput, SemiWorld } from '@adatechnology/game-vehicles-driving'
import type { VehicleContext } from '@adatechnology/game-vehicles'

import { fill } from './text'
import type { VehiclesText } from './text'
import type { PartView, VehiclesContext, VehiclesRoom } from './types'

type Destructible = {
  partWorldCenter(part: string): Vec3
  detachedParts(): string[]
  describe(): { parts: { id: string; hp: number; shape: { size: Vec3 } }[] }
  status(): { leaking: unknown[]; exploded: boolean; lightsOn: boolean; canStart: boolean; canDrive: boolean }
  state(): { groups: unknown[] }
  rollover(): void
  vehicle: { flipped?: boolean }
}

type Spawned = { id: string; d: Destructible }

export type ScenarioDeps = {
  readonly text: VehiclesText
  readonly locale: string
}

const add = (p: Vec3, dx: number, dy: number, dz: number): Vec3 => [p[0] + dx, p[1] + dy, p[2] + dz]

/**
 * The scenarios of the vehicles area. The first eleven are the Frota test page's, literal (same shots, same hits, same checks and the same sentences); the vehicle faces +z,
 * its left is +x and its right -x. Then the burnt sedan built by the kit's `burnt` scenario, the arcade driver down a lane that ends in a wall, and the semi-simulation braking on three surfaces (new in the kit).
 */
export const createScenarios = (deps: ScenarioDeps): ModuleScenario<VehiclesContext>[] => {
  const { text, locale } = deps
  const say = (id: string, ...values: unknown[]): string => fill(text, locale, text.checks[id] as string, ...values)
  const scenario = (id: string, run: ModuleScenario<VehiclesContext>['run']): ModuleScenario<VehiclesContext> => ({ id, name: text.scenarios[id] ?? id, run })
  const put = (room: VehiclesRoom, item: string, z = -7): Spawned => {
    const spawned = room.spawn(item, [0, 0, z], 0)
    return { id: spawned.objectId, d: spawned.root.userData.destructible as Destructible }
  }
  const part = (room: VehiclesRoom, v: Spawned, id: string): PartView => room.world.part(v.id, id)
  const events = (room: VehiclesRoom, type: string, v: Spawned): number => room.log.entries({ type, objectId: v.id }).length

  return [
    scenario('vehicles_9mm_windshield', ({ room, step, expect }) => {
      const v = put(room, 'hatch')
      const c = v.d.partWorldCenter('windshield')
      room.setTool('pistol_9mm')
      room.waitUntilReady()
      room.look(add(c, 0, 0.5, 3), c)
      step(0.1)
      room.use()
      step(0.4)
      const w = part(room, v, 'windshield')
      expect(w.holes.length >= 1 && !!w.holes[0]?.through, say('windshield_holes', w.holes.length, w.holes[0]?.through))
      expect(w.cracks.length >= 1 && w.status === 'damaged', say('windshield_cracks', w.cracks.length, w.status))
    }),
    scenario('vehicles_shotgun_door', ({ room, step, expect }) => {
      const v = put(room, 'sedan')
      const c = v.d.partWorldCenter('door_front_left')
      room.setTool('shotgun_pump_12')
      room.waitUntilReady()
      room.look(add(c, 2.5, 0, 0), c)
      step(0.1)
      room.use()
      step(0.4)
      const p = part(room, v, 'door_front_left')
      const marks = p.holes.length + p.dents.length
      expect(marks >= 2 && p.hp < p.maxHp, say('door_marks', p.holes.length, p.dents.length, Math.round(p.hp), p.maxHp))
    }),
    scenario('vehicles_ram_front', ({ room, step, expect }) => {
      const v = put(room, 'hatch')
      const c = v.d.partWorldCenter('bumper_front')
      room.world.hit(v.id, { type: 'blunt', point: c, direction: [0, 0, -1], energy: 45000, radius: 0.6, source: 'teste' })
      step(2.5)
      const b = part(room, v, 'bumper_front')
      const h = part(room, v, 'hood')
      expect(b.dents.length >= 1 && h.dents.length >= 1, say('front_crush', b.dents.length, h.dents.length))
      const det = v.d.detachedParts()
      expect(det.indexOf('bumper_front') >= 0, say('bumper_off', det.join(', ')))
    }),
    scenario('vehicles_engine_fire', ({ room, step, expect }) => {
      const v = put(room, 'pickup')
      const c = v.d.partWorldCenter('engine')
      for (let i = 0; i < 80; i++) {
        room.world.hit(v.id, { type: 'fire', point: c, temperature: 900, radius: 0.5, duration: 0.1, source: 'teste' })
        step(0.1)
      }
      const e = part(room, v, 'engine')
      expect(e.burning && e.temperature > 250, say('engine_burning', e.burning, Math.round(e.temperature)))
      expect(events(room, 'ignite', v) >= 1, say('ignite_lines', events(room, 'ignite', v)))
    }),
    scenario('vehicles_fuel_tank', ({ room, step, expect }) => {
      const v = put(room, 'hatch')
      const spec = v.d.describe().parts.filter((p) => p.id === 'fuel_tank')[0] as { shape: { size: Vec3 } }
      const c = v.d.partWorldCenter('fuel_tank')
      // the shot comes in from below, under the fuel level
      const low: Vec3 = [c[0], c[1] - spec.shape.size[1] / 2 + 0.06, c[2]]
      room.setTool('pistol_9mm')
      room.waitUntilReady()
      room.look(add(low, 0, 0, -2.5), low)
      step(0.1)
      room.use()
      step(1)
      const t = part(room, v, 'fuel_tank')
      const nl = v.d.status().leaking.length
      expect(nl >= 1 && t.liters < 55, say('tank_leaking', nl, t.liters.toFixed(1)))
      for (let i = 0; i < 160 && !events(room, 'explode', v); i++) {
        room.world.hit(v.id, { type: 'fire', point: c, temperature: 900, radius: 0.6, duration: 0.1, source: 'teste' })
        step(0.1)
      }
      expect(events(room, 'ignite', v) >= 1, say('ignited', events(room, 'ignite', v)))
      step(2)
      expect(events(room, 'explode', v) === 1 && v.d.status().exploded, say('exploded', events(room, 'explode', v)))
      const vc = v.d.partWorldCenter('engine')
      room.look(add(vc, 4, 0, -3), vc)
    }),
    scenario('vehicles_unbolt_wheel', ({ room, step, expect }) => {
      const v = put(room, 'sedan')
      const joint = 'wheel_front_left~underbody'
      const c = v.d.partWorldCenter('wheel_front_left')
      room.setTool('wrench')
      // the wrench turns the hub bolts (the wheel~chassis joint), the same path as the first-person use
      for (let k = 0; k < 120 && room.world.disassemble(v.id, joint, 'wrench', 0.1) < 1; k++) step(0.1)
      step(1)
      const st = room.world.state(v.id)
      const open = !!st.joints.filter((j) => j.id === joint)[0]?.open
      expect(open && st.groups.length >= 2 && events(room, 'detach', v) >= 1, say('wheel_wrench', open, st.groups.length, events(room, 'detach', v)))
      step(2)
      room.look(add(c, 2.2, 0, 0.2), add(c, 0, -0.1, 0))
    }),
    scenario('vehicles_tear_bumper', ({ room, step, expect }) => {
      const v = put(room, 'hatch')
      const c = v.d.partWorldCenter('bumper_front')
      room.world.hit(v.id, { type: 'blunt', point: c, direction: [0, 0, -1], energy: 30000, radius: 0.6, source: 'teste' })
      step(2.5)
      const det = v.d.detachedParts()
      expect(det.indexOf('bumper_front') >= 0, say('loose_parts', det.join(', ')))
      room.look(add(c, 2, 0, 3.5), add(c, 0, 0, -0.5))
    }),
    scenario('vehicles_break_mirror', ({ room, step, expect }) => {
      const v = put(room, 'sedan')
      const c = v.d.partWorldCenter('mirror_left')
      room.world.hit(v.id, { type: 'blunt', point: c, direction: [-1, 0, 0], energy: 2500, radius: 0.1, source: 'teste' })
      step(2)
      const m = part(room, v, 'mirror_left')
      expect(m.status === 'broken' && v.d.state().groups.length >= 1, say('mirror_broken', m.status))
    }),
    scenario('vehicles_kill_battery', ({ room, step, expect }) => {
      const v = put(room, 'pickup')
      expect(v.d.status().lightsOn && v.d.status().canStart, say('battery_before'))
      room.playAnimation('open_hood', v.id)
      step(1.5)
      for (let i = 0; i < 80 && room.world.disassemble(v.id, 'battery~underbody', 'wrench', 0.1) < 1; i++) step(0.1)
      step(0.5)
      const s = v.d.status()
      expect(!s.lightsOn && !s.canStart && !s.canDrive, say('battery_after', s.lightsOn, s.canStart))
    }),
    scenario('vehicles_rollover', ({ room, step, expect }) => {
      const v = put(room, 'sedan')
      const maxRoof = (v.d.describe().parts.filter((p) => p.id === 'roof')[0] as { hp: number }).hp
      v.d.rollover()
      step(8)
      const roof = part(room, v, 'roof')
      expect(!!v.d.vehicle.flipped, say('rolled_over', !!v.d.vehicle.flipped))
      expect(roof.hp < maxRoof && roof.dents.length >= 1, say('roof', Math.round(roof.hp), maxRoof, roof.dents.length))
    }),
    scenario('vehicles_melt', ({ room, step, expect }) => {
      const v = put(room, 'hatch')
      const c = v.d.partWorldCenter('tyre_front_left')
      for (let i = 0; i < 60; i++) {
        room.world.hit(v.id, { type: 'fire', point: c, temperature: 900, radius: 0.7, duration: 0.1, source: 'teste' })
        step(0.1)
      }
      step(30)
      const t = part(room, v, 'tyre_front_left')
      expect(events(room, 'melt', v) >= 1 && (t.status === 'melted' || t.melt > 0.5), say('tyre_melt', t.status, Math.round(t.melt * 100), events(room, 'melt', v)))
    }),
    // new in the kit: the burnt wreck comes ready from the kit (the fleet's `burnt` scenario built into the vehicle), no damage applied by the area
    scenario('vehicles_burnt_wreck', ({ room, expect }) => {
      const c = room.spawn('sedan_burnt', [0, 0, -7], 0).root.userData.vehicle as VehicleContext
      expect(c.zoneState.flags.burnt === true, say('wreck_burnt', c.zoneState.flags.burnt === true))
      const glass = c.zones.filter((z) => z.type === 'glass')
      const up = glass.filter((z) => (c.zoneState.health[z.id] ?? 100) > 0)
      expect(glass.length >= 1 && up.length === 0, say('wreck_glass', glass.length, up.length))
    }),
    // new in the kit: the drivers, headless (no vehicle is spawned)
    scenario('vehicles_drive_arcade', ({ expect }) => {
      const driver = createArcadeDriver()
      const wallX = 60
      driver.place(0, 0, 0)
      const world = { blocked: (x: number, z: number, yaw: number) => vehicleCorners(driver.spec, x, z, yaw).some(([px]) => px >= wallX) }
      let crashSpeed = 0
      let engine = 0
      let crashNoise = 0
      let after = 0
      for (let t = 0; t < 12; t += 1 / 60) {
        const { events: out } = driver.step({ throttle: 1, brake: 0, steer: 0, handbrake: false }, 1 / 60, world)
        for (const e of out) {
          if (e.type === 'crash' && !crashSpeed) {
            crashSpeed = e.speed
            after = driver.state.v
          }
          if (e.type === 'noise' && e.source === 'engine') engine++
          if (e.type === 'noise' && e.source === 'crash') crashNoise++
        }
      }
      expect(crashSpeed > driver.spec.crash.damageSpeed && crashSpeed <= driver.spec.maxForward + 1e-6, say('arcade_crash', crashSpeed.toFixed(1), driver.spec.maxForward))
      expect(after < 0, say('arcade_bounce', after.toFixed(1)))
      expect(engine >= 1 && crashNoise >= 1, say('arcade_noise', engine, crashNoise))
    }),
    scenario('vehicles_drive_semi', ({ expect }) => {
      const surfaces = createSurfaces()
      const coast: SemiInput = { throttle: 0, brake: 0, steer: 0, handbrake: false }
      const dt = 1 / 60
      const world = (surface: string): SemiWorld => ({ ground: () => ({ surface }) })
      const braking = (surface: string): number => {
        const driver = createSemiSimDriver({}, { surfaces })
        driver.state.u = 80 / 3.6
        for (let t = 0; t < 1; t += dt) driver.step({ ...coast, throttle: 0.3 }, dt, world(surface))
        driver.state.u = 80 / 3.6
        const start = driver.state.x
        for (let t = 0; t < 30 && driver.state.u > 0.1; t += dt) driver.step({ ...coast, brake: 1 }, dt, world(surface))
        return driver.state.x - start
      }
      const dry = braking('dry_asphalt')
      const wet = braking('wet_asphalt')
      const mud = braking('mud')
      expect(dry < wet && wet < mud, say('semi_order', dry.toFixed(1), wet.toFixed(1), mud.toFixed(1)))
      const bog = createSemiSimDriver({}, { surfaces })
      let bogged = 0
      for (let t = 0; t < 8; t += dt) bogged += bog.step({ ...coast, throttle: 1 }, dt, world('mud')).events.filter((e) => e.type === 'bogged').length
      expect(bog.state.bogged && bogged >= 1, say('semi_mud', bog.state.bogged))
    }),
  ]
}
