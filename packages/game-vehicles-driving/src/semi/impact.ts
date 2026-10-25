/** Kinetic energy of a vehicle against a body: `0.5 * mass * speed²` (joules, with kg and m/s). Frota document, section 08. */
export const impactEnergy = (vehicleMass: number, relativeSpeed: number): number => 0.5 * vehicleMass * relativeSpeed * relativeSpeed

/** Damage to the body that was hit: `energy * bumperMultiplier * zoneFactor`. The zone factors (head, torso, legs) belong to the game. */
export const bodyDamage = (energy: number, bumperMultiplier: number, zoneFactor: number): number => energy * bumperMultiplier * zoneFactor

/** Damage to the vehicle: `energy * 0.04 * (1 - frontArmor)`, with the armour from 0 to 1. */
export const vehicleDamageFromImpact = (energy: number, frontArmor: number, factor = 0.04): number => energy * factor * (1 - frontArmor)

/** Speed the vehicle loses: `bodyMass / (vehicleMass + bodyMass) * speed`. */
export const speedLoss = (bodyMass: number, vehicleMass: number, speed: number): number => (bodyMass / (vehicleMass + bodyMass)) * speed
