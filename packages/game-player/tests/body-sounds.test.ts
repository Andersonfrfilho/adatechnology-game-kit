import { describe, expect, it } from 'vitest'

import { createPlayer } from '../src'
import type { PlayerCrowd, PlayerEventMap, PlayerInput, PlayerWorld } from '../src'

type Sound = PlayerEventMap['sound']

const listen = (player: ReturnType<typeof createPlayer>): Sound[] => {
  const sounds: Sound[] = []
  player.on('sound', (e) => sounds.push(e))
  return sounds
}

/** One agent standing `ahead` metres in front of the player (the view at yaw 0 looks down -z), on the ground or not. */
const oneAgent = (ahead: number, down = false): PlayerCrowd => ({
  count: () => 1,
  active: () => true,
  x: () => 0,
  z: () => -ahead,
  y: () => 0,
  floor: () => 0,
  chasing: () => true,
  down: () => down,
  hold: () => undefined,
  stun: () => undefined,
  chase: () => undefined,
  damage: () => undefined,
})

const walk = (player: ReturnType<typeof createPlayer>, seconds: number, input: PlayerInput = {}, world?: PlayerWorld): void => {
  for (let t = 0; t < seconds; t += 0.05) player.update(0.05, { forward: 1, yaw: 0, ...input }, world)
}

describe('footsteps', () => {
  it('names the surface under the feet and the gait', () => {
    const player = createPlayer({ seed: 1 })
    const sounds = listen(player)
    walk(player, 3, {}, { surfaceAt: () => 'wood_hard' })
    const steps = sounds.filter((s) => s.sound === 'step')
    expect(steps.length).toBeGreaterThan(2)
    for (const s of steps) {
      expect(s.ids).toEqual(['footstep_wood_walk'])
      expect(s.surface).toBe('wood')
    }
    sounds.length = 0
    walk(player, 2, { run: true }, { surfaceAt: () => 'gravel' })
    expect(sounds.filter((s) => s.sound === 'step').every((s) => s.ids[0] === 'footstep_gravel_run')).toBe(true)
  })

  it('splashes in water whatever the floor is, and steps on concrete when nobody says', () => {
    const wet = createPlayer({ seed: 1 })
    const splashes = listen(wet)
    walk(wet, 2, {}, { inWater: () => true, surfaceAt: () => 'turf' })
    expect(splashes.find((s) => s.sound === 'step')?.ids).toEqual(['footstep_water_walk'])
    const plain = createPlayer({ seed: 1 })
    const steps = listen(plain)
    walk(plain, 2)
    expect(steps.find((s) => s.sound === 'step')?.ids).toEqual(['footstep_concrete_walk'])
  })

  it('steps on the frames the host puts a foot down once it sends them, not on its own timer', () => {
    const player = createPlayer({ seed: 1 })
    const sounds = listen(player)
    const noises: number[] = []
    player.on('noise', (e) => noises.push(e.radius))
    const frames: boolean[] = []
    for (let i = 0; i < 80; i++) {
      const footfall = i % 9 === 0
      frames.push(footfall)
      const before = sounds.length
      player.update(0.05, { forward: 1, yaw: 0, footfall, surface: 'tile' })
      const stepped = sounds.slice(before).some((s) => s.sound === 'step')
      expect(stepped, `frame ${i}`).toBe(footfall)
    }
    expect(sounds.filter((s) => s.sound === 'step')[0]!.ids).toEqual(['footstep_tile_walk'])
    // every footstep still makes its noise for the horde
    expect(noises.length).toBe(frames.filter(Boolean).length)
  })
})

describe('blows and the body', () => {
  it('a punch that lands plays the swing and the hit; one into the air only the swing', () => {
    const player = createPlayer({ seed: 4 })
    const sounds = listen(player)
    player.update(0.05, { yaw: 0, pressed: { knife: true } }, { crowd: oneAgent(0.8) })
    const landed = sounds.find((s) => s.sound === 'flesh')!
    expect(landed.ids[0]).toBe('punch_swing')
    expect(['punch_hit_body', 'punch_hit_face']).toContain(landed.ids[1])
    sounds.length = 0
    player.update(0.05, { yaw: 0, pressed: { knife: true } }, { crowd: oneAgent(30) })
    expect(sounds.find((s) => s.sound === 'flesh')!.ids).toEqual(['punch_swing'])
  })

  it('a blow on a body on the ground goes to the head; a knife stabs, a club thuds', () => {
    const player = createPlayer({ seed: 4 })
    const sounds = listen(player)
    player.update(0.05, { yaw: 0, pressed: { knife: true } }, { crowd: oneAgent(0.8, true) })
    expect(sounds.at(-1)!.ids).toEqual(['punch_swing', 'punch_hit_face'])
    player.update(0.05, { yaw: 0, melee: { damage: 30, crit: 0.4, reach: 0.3 }, pressed: { knife: true } }, { crowd: oneAgent(0.8) })
    expect(sounds.at(-1)!.ids).toEqual(['knife_swing', 'knife_stab'])
    player.update(0.05, { yaw: 0, melee: { damage: 40, kg: 1, blow: 'blunt' }, pressed: { knife: true } }, { crowd: oneAgent(0.8) })
    expect(sounds.at(-1)!.ids).toEqual(['blunt_swing', 'blunt_hit'])
  })

  it('hurt, bite and grab each have their own sound', () => {
    const player = createPlayer({ seed: 2 })
    const sounds = listen(player)
    player.hurt(5)
    player.bite()
    player.grab(0)
    expect(sounds.map((s) => s.ids)).toEqual([['player_hurt'], ['bite', 'player_hurt'], ['grab']])
    // the team's class stays what the game played
    expect(sounds.map((s) => s.sound)).toEqual(['flesh', 'flesh', 'flesh'])
  })
})
