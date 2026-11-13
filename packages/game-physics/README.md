# @adatechnology/game-physics (spike)

The kit's engine-agnostic rigid-body contract: bodies, colliders (box, sphere, capsule, cylinder, convex, trimesh, heightfield), joints (fixed, hinge,
ball with per-axis limits, slider, rope), queries (all hits along a ray, first hit, sphere cast, sphere overlap), contact-force and sensor events,
snapshot and restore. Types plus tiny helpers (`packTag`, `energyHeight`). An engine lives in an adapter package (`game-physics-rapier`).

Spike of 2026-11-13 (engine decision, Jolt vs Rapier): not published, not stable.
