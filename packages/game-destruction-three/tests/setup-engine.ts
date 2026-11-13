import { loadRapierEngine } from '@adatechnology/game-physics-rapier'

// spike only: with PIECE_ENGINE=rapier every renderer the suite makes steps its pieces through Rapier
if (process.env.PIECE_ENGINE === 'rapier') (globalThis as { __KIT_PHYSICS_ENGINE__?: unknown }).__KIT_PHYSICS_ENGINE__ = await loadRapierEngine()
