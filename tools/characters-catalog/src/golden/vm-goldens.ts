import { fixturePath } from '../paths'

import { recordBodyChunkGolden } from './vm-body-chunk'
import { recordCrowdCiviliansGolden, recordCrowdGolden, recordCrowdHerdGolden, recordCrowdRenderGolden } from './vm-crowd'
import { recordDamageRegionsGolden } from './vm-damage'
import { recordWalkGaitGolden } from './vm-gait'
import { recordPenetrationGolden } from './vm-penetration'
import { recordPlayerGolden } from './vm-player'
import { recordSpawnGolden } from './vm-spawn'
import { recordStoriesGolden } from './vm-stories'

export const VM_GOLDENS = [
  { id: 'game-spawn', path: fixturePath('game-characters-undead', 'game-spawn.json'), record: recordSpawnGolden },
  { id: 'game-damage-regions', path: fixturePath('game-characters', 'game-damage-regions.json'), record: recordDamageRegionsGolden },
  { id: 'game-penetration', path: fixturePath('game-characters', 'game-penetration.json'), record: recordPenetrationGolden },
  { id: 'game-walk-gait', path: fixturePath('game-characters', 'game-walk-gait.json'), record: recordWalkGaitGolden },
  { id: 'game-body-chunk', path: fixturePath('game-characters-three', 'game-body-chunk.json'), record: recordBodyChunkGolden },
  { id: 'game-player', path: fixturePath('game-player', 'game-player.json'), record: recordPlayerGolden },
  { id: 'game-crowd', path: fixturePath('game-crowd', 'game-crowd.json'), record: recordCrowdGolden },
  { id: 'game-crowd-civilians', path: fixturePath('game-crowd', 'game-crowd-civilians.json'), record: recordCrowdCiviliansGolden },
  { id: 'game-crowd-herd', path: fixturePath('game-crowd', 'game-crowd-herd.json'), record: recordCrowdHerdGolden },
  { id: 'game-crowd-render', path: fixturePath('game-crowd-three', 'game-crowd-render.json'), record: recordCrowdRenderGolden },
  { id: 'game-stories-life', path: fixturePath('game-stories', 'game-stories-life.json'), record: recordStoriesGolden },
] as const
