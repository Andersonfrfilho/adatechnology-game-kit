/**
 * The player at the wheel of the proving ground's vehicle: the keyboard read into the vehicle controls of `game-vehicles-driving` (pedals, wheel, gearbox,
 * handbrake, ignition, drive mode, lamps, indicators, wipers, belt, horn, alarm and radio), the semi driver stepped with them, the car's systems
 * (`createVehicleSystems`: battery, coolant, spare tyre) stepped after it, the lamps of the built vehicle
 * switched (`createVehicleLamps`, the beacon of an emergency vehicle flashing with them), the glovebox and the trunk holding items (`createVehicleStorage`), the
 * glass misting up inside by the weather and the people in it (`createWindshieldFog`, drawn by `createWindshieldMist`) and the cabin sounds asked of the host.
 * Without the key (`hasKey: false`) the ignition key held hotwires the car. The driving keys are taken before the room sees them (capture phase), so W does
 * not also walk and F gets the driver out instead of the room's own use. Everything is removed by `stop`.
 */
import { RADIO_TRACKS } from '@adatechnology/game-audio'
import type { ModuleHost } from '@adatechnology/game-contracts'
import { bumperDistance, createSemiSimDriver, createVehicleControls, createVehicleStorage, createVehicleSystems, createWindshieldFog, GLOVEBOX, parkingBeepInterval, trunkFor } from '@adatechnology/game-vehicles-driving'
import type { CompartmentSpec, ControlEvent, SemiDriver, SemiEvent, StorageAccess, StorageStack, SystemsEvent, VehicleControls, VehicleStorage, VehicleSystems, WindshieldFog } from '@adatechnology/game-vehicles-driving'
import { subjectSpec } from '@adatechnology/game-vehicles-proving'
import type { ProvingSubject } from '@adatechnology/game-vehicles-proving'

import { createVehicleDestructible } from '@adatechnology/game-vehicles'
import type { VehicleContext, VehicleDestructible, VehicleKit } from '@adatechnology/game-vehicles'

import { createVehicleBody } from '../../body'
import type { BodyEvent, BodyThree, VehicleBody, WindowId } from '../../body'
import type { BuiltVehicle } from '../../build'
import { createVehicleDashboard } from '../../dashboard'
import type { VehicleDashboard } from '../../dashboard'
import { createVehicleLamps } from '../../lamps'
import type { VehicleLamps } from '../../lamps'
import { createWindshieldMist } from '../../windshield-mist'
import type { MistThree, WindshieldMist } from '../../windshield-mist'

/** The cabin's sounds; an empty name stays silent (the starter, when the host's engine sound turns the key itself). */
export type CockpitSounds = { horn: string; blinker: string; starter: string; alarm: string; chirp: string; wiper: string; chime: string; radio: string; beep: string; wail: string; yelp: string; spark: string; glovebox: string }
export const DEFAULT_COCKPIT_SOUNDS: CockpitSounds = {
  horn: 'horn',
  blinker: 'blinker_tick',
  starter: 'starter_crank',
  alarm: 'car_alarm',
  chirp: 'alarm_chirp',
  wiper: 'wiper_swish',
  chime: 'seatbelt_chime',
  radio: 'radio_static',
  beep: 'parking_beep',
  wail: 'siren_wail',
  yelp: 'siren_yelp',
  spark: 'hotwire_spark',
  glovebox: 'glovebox_latch',
}

/** The weather around the car, for the mist on its glass: air temperature (°C) and rain on the glass (0..1). */
export interface CockpitWeather {
  outsideC: number
  rain: number
}

/** What the cockpit reports: a control used or refused, the engine (stall, out of fuel) and the systems (flat battery, overheating, spare). */
export type CockpitEvent = ControlEvent | SemiEvent | SystemsEvent | BodyEvent

/** Keys of the body (doors 1-4, hood 5, trunk 6, the windows with Shift, the sunroof Shift+5, the central locking V). */
export const BODY_KEYS: Readonly<Record<string, string>> = {
  Digit1: 'door_front_left',
  Digit2: 'door_front_right',
  Digit3: 'door_rear_left',
  Digit4: 'door_rear_right',
  Digit5: 'hood',
  Digit6: 'lid',
}
const WINDOW_KEYS: Readonly<Record<string, WindowId>> = { Digit1: 'front_left', Digit2: 'front_right', Digit3: 'rear_left', Digit4: 'rear_right' }
const LOCK_KEY = 'KeyV'
/** Sweeps a second of the wiper blades in each mode (intermittent sweeps once every four seconds or so). */
const WIPE_RATE: Readonly<Record<string, number>> = { off: 0, intermittent: 0.25, slow: 0.7, fast: 1.4 }

export interface Cockpit {
  readonly driver: SemiDriver
  readonly controls: VehicleControls
  readonly systems: VehicleSystems
  /** The doors, windows, sunroof, wipers and locks (null on a vehicle drawn without its damage model). */
  readonly body: VehicleBody | null
  /** The car's damage model (null without the kit). */
  readonly destructible: VehicleDestructible | null
  /** What is left of the radiator, 0..1 (a punctured one barely cools). */
  radiator: number
  readonly lamps: VehicleLamps
  readonly dashboard: VehicleDashboard | null
  /** The gas this step, 0..1 (what the engine's sound loads by). */
  readonly throttle: number
  /** The glovebox and the trunk (only those the vehicle has: no trunk without a lid). */
  readonly storage: VehicleStorage
  /** What reaches the glovebox and the trunk now (the driver is seated). */
  access(): StorageAccess
  /** The glass misting up inside, and its look on the panes. */
  readonly fog: WindshieldFog
  readonly mist: WindshieldMist
  /** The weather the mist reads; change it at will. */
  weather: CockpitWeather
  /** The vehicle has a siren and a beacon. */
  readonly emergency: boolean
  step(dt: number): void
  stop(): void
}

export function createCockpit(o: {
  THREE: Parameters<typeof createVehicleLamps>[0] & Parameters<typeof createVehicleDashboard>[0] & BodyThree & MistThree
  /** World points (x, z) the parking sensors see: obstacles near the bumpers. */
  obstacles?: () => ReadonlyArray<readonly [number, number]>
  /** The vehicle kit: with it the car gets its damage model, whose hinges the doors, hood and lid open on. */
  kit?: VehicleKit
  /** The kit's dial material (`kit.materials.gauge`): with it the cluster reads live. */
  gauge?: unknown
  /** The kit's needle material (`kit.materials.amber`). */
  needle?: unknown
  host: ModuleHost
  built: BuiltVehicle
  subject: ProvingSubject
  sounds?: Partial<CockpitSounds>
  /** The driver has the key. Default true; without it the ignition key held hotwires the car. */
  hasKey?: boolean
  /** What the glovebox and the trunk hold when the driver gets in (the host's items), by compartment id. */
  stock?: (compartment: string) => readonly StorageStack[]
  /** Trunk size, litres. Default 450. */
  trunkLitres?: number
  weather?: CockpitWeather
  place: [number, number, number]
  onEvent?: (event: CockpitEvent) => void
  onExit: () => void
}): Cockpit {
  const sounds = { ...DEFAULT_COCKPIT_SOUNDS, ...o.sounds }
  const spec = subjectSpec(o.subject)
  const driver = createSemiSimDriver(spec)
  driver.place(o.place[0], o.place[1], o.place[2])
  const lamps = createVehicleLamps(o.THREE, o.built, { lights: o.host.lights, owner: 'proving-ground' })
  const mist = createWindshieldMist(o.THREE, o.built)
  const fog = createWindshieldFog()
  const audio = o.host.audio
  // the cluster: the speedometer to the next 20 km/h over the vehicle's top speed, the rev counter to its red line
  const top = o.subject.stats.maxSpeedKmh
  const dashboard = o.gauge ? createVehicleDashboard(o.THREE, o.built, { gauge: o.gauge, needle: o.needle, redlineRpm: spec.engine.redlineRpm, maxKmh: top ? Math.ceil((top + 10) / 20) * 20 : undefined }) : null
  const at = (): [number, number, number] => [o.built.group.position.x, 1, o.built.group.position.z]
  const play = (sound: string, volume = 1): void => void audio?.play?.({ sound, position: at(), volume })
  let alarmAgain = 0
  let hornAgain = 0
  let wipeAgain = 0
  let chimeAgain = 0
  let radioAgain = 0
  let beepAgain = 0
  let bar = 0
  let exitAsked = false
  let sirenAgain = 0
  let sparkAgain = 0
  let wiresBefore = 0
  let gas = 0
  const systems = createVehicleSystems()
  const context = o.built.context as VehicleContext | null
  const destructible: VehicleDestructible | null = o.kit && context ? createVehicleDestructible(o.kit, context, { id: 'driven', frame: o.built.group }) : null
  const body = destructible ? createVehicleBody(o.built, { THREE: o.THREE, clips: destructible.animations() }) : null
  // the glovebox behind the dashboard of a vehicle with doors, the trunk behind its lid
  const compartments: CompartmentSpec[] = []
  if (!body || body.parts.some((p) => p.startsWith('door'))) compartments.push(GLOVEBOX)
  if (body?.parts.includes('lid')) compartments.push(trunkFor(o.trunkLitres))
  const storage = createVehicleStorage({ compartments })
  for (const c of compartments) storage.stock(c.id, o.stock?.(c.id) ?? [])
  const access = (): StorageAccess => ({
    seated: true,
    frontDoorOpen: (body?.openness('door_front_left') ?? 0) >= 0.5 || (body?.openness('door_front_right') ?? 0) >= 0.5,
    gloveboxOpen: controls.state.glovebox,
    lid: body?.openness('lid') ?? 0,
  })
  const bodyEvents = (events: readonly BodyEvent[]): void => {
    for (const event of events) {
      if (event.type === 'sound') play(event.key, 0.9)
      o.onEvent?.(event)
    }
  }

  const controls = createVehicleControls({
    canCrank: systems.canCrank,
    onCrank: systems.crank,
    powerLimit: systems.powerLimit,
    gears: spec.gears?.length ?? 5,
    fourWheelDrive: !!o.subject.body.fourWheelDrive,
    fogLamps: lamps.has.fog,
    clutchPedal: true,
    radioTracks: RADIO_TRACKS.length,
    hasKey: o.hasKey,
    emergency: lamps.has.beacon,
    onEvent: (event) => {
      if (event.type === 'command') {
        if (event.command === 'ignition' && !event.state.ignition) driver.state.engineOn = false
        if (event.command === 'alarm' && event.state.alarm === 'armed') play(sounds.chirp)
        if (event.command === 'alarm') alarmAgain = 0
        if (event.command === 'radio' || event.command === 'radio_source' || event.command === 'radio_track') {
          radioAgain = 0
          bar = 0
        }
        if (event.command === 'exit') exitAsked = true
        if (event.command === 'siren') sirenAgain = 0
        if (event.command === 'glovebox') play(sounds.glovebox, 0.8)
      }
      o.onEvent?.(event)
    },
  })
  // the driver gets in with the engine off: the key (I) or the gas pedal starts it
  driver.state.engineOn = false

  const target: Window | null = typeof window !== 'undefined' ? window : null
  const bodyKey = (e: KeyboardEvent): boolean => {
    if (!body) return false
    if (e.code === LOCK_KEY) bodyEvents(body.lock(!body.locked))
    else if (e.shiftKey && e.code === 'Digit5') body.toggleSunroof()
    else if (e.shiftKey && WINDOW_KEYS[e.code]) body.toggleWindow(WINDOW_KEYS[e.code] as WindowId)
    else if (!e.shiftKey && BODY_KEYS[e.code]) bodyEvents(body.toggle(BODY_KEYS[e.code] as string))
    else return false
    return true
  }
  const down = (e: KeyboardEvent): void => {
    if (!e.repeat && bodyKey(e)) {
      e.stopImmediatePropagation()
      return
    }
    if (!controls.key(e.code, true)) return
    // the room listens on the window too: a driving key stops here
    e.stopImmediatePropagation()
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault()
  }
  const up = (e: KeyboardEvent): void => {
    if (controls.key(e.code, false)) e.stopImmediatePropagation()
  }
  const blur = (): void => controls.release()
  target?.addEventListener('keydown', down, true)
  target?.addEventListener('keyup', up, true)
  target?.addEventListener('blur', blur)

  const cockpit: Cockpit = {
    radiator: 1,
    storage,
    access,
    fog,
    mist,
    weather: { ...(o.weather ?? { outsideC: 25, rain: 0 }) },
    emergency: lamps.has.beacon,
    driver,
    controls,
    systems,
    body,
    destructible,
    lamps,
    dashboard,
    get throttle() {
      return gas
    },
    step(dt) {
      const input = controls.input(dt, driver)
      gas = input.throttle
      if (input.start && sounds.starter) play(sounds.starter)
      const engine = driver.step(input, dt).events
      controls.after(driver, dt)
      const s = controls.state
      const report = [...engine.filter((e) => e.type !== 'shift'), ...systems.step({ driver, controls: s, throttle: input.throttle, dt, radiator: cockpit.radiator })]
      for (const event of report) o.onEvent?.(event)
      // a flat battery with the engine off lights nothing
      const powered = driver.state.engineOn || systems.state.charge > 0
      const high = s.lamps.mode === 'high' || s.lamps.flash
      lamps.set({
        mode: !powered ? 'off' : s.lamps.flash ? 'high' : s.lamps.mode,
        fog: s.lamps.fog,
        interior: s.lamps.interior,
        brake: s.brakeLights,
        reverse: s.reverseLights,
        left: s.blinkOn && (s.indicator === 'left' || s.indicator === 'hazard'),
        right: s.blinkOn && (s.indicator === 'right' || s.indicator === 'hazard'),
        beacon: s.beacon && powered ? s.beaconSide : null,
      })
      // the glass mists by the people inside (the driver), the weather and the rain on it; the windows and the demister clear it
      const w = cockpit.weather
      const windows = body ? body.windows.reduce((sum, id) => sum + body.window(id), 0) / Math.max(1, body.windows.length) : 0
      const warm = systems.state.temperature
      const cabinC = s.climate.on ? 22 : w.outsideC + (driver.state.engineOn ? 3 + 5 * Math.min(1, warm * 2) : 2)
      mist.set(fog.step({ dt, occupants: 1, outsideC: w.outsideC, cabinC, rain: w.rain, speed: Math.abs(driver.state.u), windows, climate: s.climate, engineWarm: driver.state.engineOn ? Math.min(1, warm * 2) : 0 }).fog)
      // the siren: its tone again as it ends; the wires sparking while the hotwire key is held
      if (s.siren !== 'off' && powered && (sirenAgain -= dt) <= 0) {
        play(s.siren === 'wail' ? sounds.wail : sounds.yelp)
        sirenAgain = s.siren === 'wail' ? 2.95 : 1.95
      }
      const working = s.hotwire.progress > wiresBefore
      wiresBefore = s.hotwire.progress
      if (working && (sparkAgain -= dt) <= 0) {
        play(sounds.spark, 0.7)
        sparkAgain = 0.45 + 0.4 * ((s.hotwire.progress * 7) % 1)
      }
      dashboard?.update(
        {
          kmh: Math.abs(driver.state.u) * 3.6,
          rpm: driver.state.engineOn ? driver.state.rpm : 0,
          gear: driver.state.gear,
          ignition: s.ignition,
          engineOn: driver.state.engineOn,
          left: s.blinkOn && (s.indicator === 'left' || s.indicator === 'hazard'),
          right: s.blinkOn && (s.indicator === 'right' || s.indicator === 'hazard'),
          highBeam: high,
          fuel: driver.state.fuel / spec.tank.capacity,
          temperature: systems.state.temperature,
          cruise: s.cruise.on,
          profile: s.profile,
          tractionOff: !s.tractionControl,
          absOff: !s.abs,
          charging: systems.state.netW >= 0,
          lowBeam: s.lamps.mode === 'low' || s.lamps.mode === 'position',
          fog: s.lamps.fog,
          parkingBrake: s.parkingBrake,
          seatbelt: s.seatbelt,
          fourWheel: s.fourWheelEngaged,
        },
        dt,
      )
      if (body) bodyEvents(body.update(dt, s.washer ? 1.2 : (WIPE_RATE[s.wipers] ?? 0)))
      if (s.tick) play(sounds.blinker, 0.8)
      // parking sensors: in reverse the rear bumper, creeping forward the front one
      const near = o.obstacles?.() ?? []
      if (s.ignition && near.length && Math.abs(driver.state.u) < 3) {
        const g = o.built.group as { position: { x: number; z: number }; rotation: { y: number } }
        const reversing = driver.state.gear < 0 || driver.state.u < -0.05
        const distance = bumperDistance({ x: g.position.x, z: g.position.z, heading: [Math.sin(g.rotation.y), Math.cos(g.rotation.y)], length: o.built.length, width: o.built.width, forward: !reversing, obstacles: near })
        const every = parkingBeepInterval(distance)
        if (every != null && (beepAgain -= dt) <= 0) {
          play(sounds.beep, 0.7)
          beepAgain = every === 0 ? 0.09 : every
        }
      }
      // the horn's note is 0.6 s: held, it sounds again before the last one ends
      if (s.horn && (hornAgain -= dt) <= 0) {
        play(sounds.horn)
        hornAgain = 0.5
      } else if (!s.horn) hornAgain = 0
      if (s.alarm === 'ringing' && (alarmAgain -= dt) <= 0) {
        play(sounds.alarm)
        alarmAgain = 2.9
      }
      if ((s.wipers !== 'off' || s.washer) && (wipeAgain -= dt) <= 0) {
        play(sounds.wiper, 0.7)
        wipeAgain = s.washer || s.wipers === 'fast' ? 0.6 : s.wipers === 'slow' ? 1.4 : 4
      }
      // moving without the belt: the chime, every few seconds
      const kmh = Math.abs(driver.state.u) * 3.6
      if (!s.seatbelt && s.ignition && kmh > 10 && (chimeAgain -= dt) <= 0) {
        play(sounds.chime, 0.6)
        chimeAgain = 6
      }
      // the radio: the track picked, from the station (a little hiss under it) or the tape; a loop plays again when it ends
      if (s.radio.on && (radioAgain -= dt) <= 0) {
        const song = RADIO_TRACKS[s.radio.track % RADIO_TRACKS.length]
        if (song) {
          play(song.bars[bar % song.bars.length] as string, s.radio.source === 'tape' ? 0.8 : 0.7)
          bar++
        }
        if (s.radio.source === 'radio') play(sounds.radio, 0.12)
        radioAgain = song?.barSeconds ?? 2
      }
      if (exitAsked) {
        exitAsked = false
        o.onExit()
      }
    },
    stop() {
      target?.removeEventListener('keydown', down, true)
      target?.removeEventListener('keyup', up, true)
      target?.removeEventListener('blur', blur)
      controls.release()
      lamps.dispose()
      mist.dispose()
      storage.clear()
      dashboard?.dispose()
      body?.dispose()
      destructible?.dispose?.()
    },
  }
  return cockpit
}
