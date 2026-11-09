/**
 * Plans that crack or fall in the destruction world with nothing hitting them (2026-11-08, docs/plantas-validacao.md): the pillars and walls of an upper
 * storey stand at mid span on a 10 cm slab panel instead of on the pillar under them or on a beam. The fix is in how the load reaches the pillars
 * (game-floorplan-structure slab panels and the destruction world's load path); a key that stands leaves the list (the test fails until it does).
 */
export const AT_REST_FAILING: ReadonlySet<string> = new Set<string>(['high_end_contemporary {"floors":3}', 'mansion {}', 'mansion {"floors":3}'])
