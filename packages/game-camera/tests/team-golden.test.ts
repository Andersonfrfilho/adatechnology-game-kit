import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cutDeclaration, cutFunction, evaluateSlice } from '@adatechnology/golden-tool/cut-source'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { create } from '../src'

/**
 * G-camera: `cameraUpdate` of the game (jogo.js, 69043) is cut from the source and run with stubs for what it reads (`worldRay`, `player`, `view`, `ARMAS`, `camera`, the mouse, the keys and the
 * host's random numbers), and `game-camera` with `smoothing: 12` (its defaults are the game's numbers) is run on the same frames. Every frame the two place the camera at the same spot, with the same
 * look and the same field of view, and turn the look by the same amount: walking, aiming with two weapons, swapping shoulder, crouching, a wall behind the player, the fever, the panic and the death.
 */
const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(here, '../../../specs/001-migracao-entregas-dos-times/artefatos/2UG1Mhe9LqJkQKKVsJkTWR/jogo.js'), 'utf8')
const code = `${cutDeclaration(source, 'camTarget')}\n${cutFunction(source, 'cameraUpdate')}`

const FRAMES = 640
const WALL_Z = 2.4
const FEVER = 100
const COMPOSURE = 10

/** The numbers of the host's `R()`: the same sequence for the page and for the SDK. */
const sequence = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** What the player and the world do on frame `i`. */
const frameOf = (i: number) => ({
  dt: i === 90 ? 1 / 30 : i === 91 ? 1 / 144 : 1 / 60,
  dx: i < 60 ? 3 : i < 180 ? -2 : i < 240 ? 4 : i < 400 ? Math.sin(i * 0.1) * 5 : 0,
  dy: i < 60 ? 0 : i < 180 ? 1 : i < 240 ? -1 : i < 400 ? Math.cos(i * 0.13) * 3 : 0,
  aim: (i >= 60 && i < 180) || (i >= 520 && i < 600),
  weapon: i < 120 ? 0 : 1,
  swap: i === 100 || i === 300,
  crouch: i >= 180 && i < 260,
  wall: i >= 240 && i < 360,
  fever: i >= 280 && i < 420,
  panic: i >= 400 && i < 470,
  alive: !(i >= 470 && i < 560),
  deathT: (i - 470) / 60,
  time: i / 60,
})

const ZOOMS = [4, 2.5]
const world = (wall: boolean) => (ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number): number | null => {
  if (!wall || dz <= 0) return null
  const t = (WALL_Z - oz) / dz
  return t > 0 && t <= max ? t : null
}

describe('team golden: cameraUpdate of the game against game-camera', () => {
  it('places the camera, turns the look and moves the field of view like the game in every frame', () => {
    // the game side
    const pageCamera = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 500)
    const pageRandom = sequence(11)
    const state = {
      player: { alive: true, deathT: 0, x: 0, y: 0, z: 0, crouch: false, infected: false, infT: 0, panic: 0, yaw: 0, vx: 0, vz: 0 },
      view: { yaw: 0.4, pitch: 0.1, aim: 0, shoulder: 1 } as Record<string, number>,
      mouse: { dx: 0, dy: 0, r: 0 },
      inv: { cur: 0 },
      timeU: { value: 0 },
      pressed: false,
      wall: false,
    }
    const scope = {
      THREE,
      Math,
      camera: pageCamera,
      player: state.player,
      view: state.view,
      mouse: state.mouse,
      inv: state.inv,
      ARMAS: ZOOMS.map((zoom) => ({ zoom })),
      INFEC: { febre: FEVER },
      DV: { compostura: COMPOSURE },
      timeU: state.timeU,
      ANDARES: { casaP: false },
      andaresCamera: () => undefined,
      gunGroup: { position: { set: () => undefined }, rotation: { set: () => undefined } },
      gunMeshes: [] as unknown[],
      shotKick: 0,
      playerHand: () => [0, 0, 0],
      clamp: (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v),
      lerp: (a: number, b: number, t: number) => a + (b - a) * t,
      wasPressed: (key: string) => key === 'KeyQ' && state.pressed,
      R: pageRandom,
      worldRay: (ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number) => {
        const t = world(state.wall)(ox, oy, oz, dx, dy, dz, max)
        return t === null ? null : { t }
      },
    }
    const { cameraUpdate } = evaluateSlice<{ cameraUpdate: (dt: number) => void }>(code, ['cameraUpdate'], scope)

    // the SDK side
    const rig = create(THREE, { storageKey: null, smoothing: 12 })
    const sdkCamera = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 500)
    const sdkRandom = sequence(11)
    const look = { yaw: 0.4, pitch: 0.1 }
    let aimBefore = false
    let worst = 0
    let lowestFov = 65
    let shortestBoom = Infinity
    let orbitFrames = 0

    for (let i = 0; i < FRAMES; i++) {
      const f = frameOf(i)
      // the game's frame
      state.player.alive = f.alive
      state.player.deathT = f.deathT
      state.player.crouch = f.crouch
      state.player.infected = f.fever
      state.player.infT = f.fever ? FEVER + 50 : 0
      state.player.panic = f.panic ? COMPOSURE : 0
      state.mouse.dx = f.dx
      state.mouse.dy = f.dy
      state.mouse.r = f.aim ? 1 : 0
      state.inv.cur = f.weapon
      state.timeU.value = f.time
      state.pressed = f.swap
      state.wall = f.wall
      cameraUpdate(f.dt)

      // the SDK's frame: the host turns the look with the sights of the frame before (as the game's sensitivity reads `view.aim` before it is set), then places the camera
      const zoom = ZOOMS[f.weapon] as number
      if (f.alive) {
        rig.look(look, { dx: f.dx, dy: f.dy, zoom, aiming: aimBefore, time: f.time, fever: f.fever, panic: f.panic, random: sdkRandom })
        if (f.swap) rig.flipSide()
      }
      rig.update(sdkCamera as never, { x: 0, y: 0, z: 0, yaw: look.yaw, pitch: look.pitch, aiming: f.aim, crouching: f.crouch, zoom, alive: f.alive, deathT: f.deathT }, f.dt, world(f.wall))
      if (f.alive) aimBefore = f.aim
      lowestFov = Math.min(lowestFov, pageCamera.fov)
      shortestBoom = Math.min(shortestBoom, state.view.cd as number)
      if (!f.alive) orbitFrames += 1

      const spots: [number, number][] = [
        [pageCamera.position.x, sdkCamera.position.x],
        [pageCamera.position.y, sdkCamera.position.y],
        [pageCamera.position.z, sdkCamera.position.z],
        [pageCamera.quaternion.x, sdkCamera.quaternion.x],
        [pageCamera.quaternion.y, sdkCamera.quaternion.y],
        [pageCamera.quaternion.z, sdkCamera.quaternion.z],
        [pageCamera.quaternion.w, sdkCamera.quaternion.w],
        [pageCamera.fov, sdkCamera.fov],
        [state.view.yaw as number, look.yaw],
        [state.view.pitch as number, look.pitch],
      ]
      for (const [page, sdk] of spots) worst = Math.max(worst, Math.abs(page - sdk))
      for (const [index, [page, sdk]] of spots.entries()) expect(Math.abs(page - sdk), `frame ${i}, value ${index}: page ${page}, sdk ${sdk}`).toBeLessThan(1e-9)
    }
    expect(worst).toBeLessThan(1e-9)
    // the script really did what it says: the zoom narrowed the field of view, the wall pushed the camera in and the body was circled
    expect(lowestFov).toBeLessThan(30)
    expect(shortestBoom).toBeLessThan(2)
    expect(orbitFrames).toBe(90)
  })

  it('smoothing 0 and the game preset are the two ends: the preset is the default of the rig', () => {
    expect(create(THREE, { storageKey: null }).config.smoothing).toBe(12)
    expect(create(THREE, { storageKey: null }).config.shoulder).toMatchObject({ distance: 3.8, aimDistance: 1.7, side: 0.9, height: 1.95, crouchHeight: 1.4 })
  })
})
