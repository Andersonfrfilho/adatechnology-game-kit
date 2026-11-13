import { initPiecePhysics } from '../src/rapier-pieces'

// spike only: PIECE_SOLVER=own runs the suite on the kit's own solver, to compare
if (process.env.PIECE_SOLVER === 'own') (globalThis as { __PIECE_SOLVER__?: string }).__PIECE_SOLVER__ = 'own'
await initPiecePhysics()
