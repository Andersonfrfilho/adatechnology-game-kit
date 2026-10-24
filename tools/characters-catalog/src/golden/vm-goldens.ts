import { fixturePath } from '../paths'

import { recordBodyChunkGolden } from './vm-body-chunk'
import { recordDamageRegionsGolden } from './vm-damage'
import { recordWalkGaitGolden } from './vm-gait'
import { recordPenetrationGolden } from './vm-penetration'
import { recordSpawnGolden } from './vm-spawn'

export const VM_GOLDENS = [
  { id: 'game-spawn', path: fixturePath('game-characters-undead', 'game-spawn.json'), record: recordSpawnGolden },
  { id: 'game-damage-regions', path: fixturePath('game-characters', 'game-damage-regions.json'), record: recordDamageRegionsGolden },
  { id: 'game-penetration', path: fixturePath('game-characters', 'game-penetration.json'), record: recordPenetrationGolden },
  { id: 'game-walk-gait', path: fixturePath('game-characters', 'game-walk-gait.json'), record: recordWalkGaitGolden },
  { id: 'game-body-chunk', path: fixturePath('game-characters-three', 'game-body-chunk.json'), record: recordBodyChunkGolden },
] as const
