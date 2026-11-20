import { availableParallelism } from 'node:os'

/**
 * How many test processes a heavy package runs at once: a quarter of the cores, 2 to 6. The pre-push tests two packages at once and CI runners
 * have few cores, so an uncapped pool (one fork per core) makes the packages fight for the CPU; one fork for every file is the other extreme.
 */
export const MAX_TEST_FORKS = Math.min(6, Math.max(2, Math.floor(availableParallelism() / 4)))
