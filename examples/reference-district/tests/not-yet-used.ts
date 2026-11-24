/**
 * What brings a package into the assembly: a task of spec 011 (`proposed` when tasks.md has none yet and the owner has to add it), a lacuna of its section 8, or, for a package that is not
 * made to be in a scene, the reason why. There is no "undecided": a package nobody plans to use is a decision the table has to state.
 */
export type Bringer =
  | { readonly task: string; readonly proposed?: true; readonly note?: string }
  | { readonly lacuna: string; readonly note?: string }
  | { readonly notScenePackage: string }

/** The task ids of `specs/011-cena-de-referencia/tasks.md` (on `spec/011-passo-0`; the spec files are not on this branch, so the list is typed here). */
export const SPEC_TASKS: readonly string[] = [
  'T0.1', 'T0.2', 'T0.3',
  'T1.1', 'T1.2', 'T1.3', 'T1.4', 'T1.5', 'T1.6a', 'T1.6', 'T1.7', 'T1.8', 'T1.9',
  'T2.1', 'T2.2', 'T2.3', 'T2.4', 'T2.5', 'T2.6',
  'T3.1', 'T3.2', 'T3.3', 'T3.4', 'T3.5', 'T3.6', 'T3.7', 'T3.8', 'T3.9', 'T3.10', 'T3.11', 'T3.12', 'T3.13',
  'T4.1', 'T4.2', 'T4.3', 'T4.4',
  'T5.1', 'T5.2', 'T5.3',
]

/** The lacunas L1 to L18 of section 8 of the spec. */
export const SPEC_LACUNAS: readonly string[] = Array.from({ length: 18 }, (_, index) => `L${index + 1}`)

/**
 * The packages of `packages/` the assembly does not use today and that no `missing` entry of the site waits for. The coverage test fails when a package is used and still listed here, when it is listed
 * and does not exist, and when a package is neither used, pending by `missing` nor listed. A package leaves this table in the commit that makes the assembly use it.
 */
export const NOT_YET_USED: Readonly<Record<string, Bringer>> = {
  'game-animals': { task: 'T3.10', note: 'the fish and the heron of the river' },
  'game-animals-three': { task: 'T3.10', note: 'draws the fish and the heron' },
  'game-characters': { lacuna: 'L16', note: 'the uniformed police and survivors of the crossing, who aim and shoot' },
  'game-characters-people': { lacuna: 'L16', note: 'the survivors behind the barricade' },
  'game-characters-uniformed': { lacuna: 'L16', note: 'military, civil and riot police behind the barricade' },
  'game-devtools': { notScenePackage: 'in-game test tooling (panels, logs, bench) for the room, not something a game scene instantiates' },
  'game-graphics': { task: 'T5.1', note: 'the player\'s graphics settings and tuner: createKitWorld takes them with `graphics`, which the page leaves off; T5.1 runs the gauge with the tuner on (R7)' },
  'game-graphics-three': { task: 'T4.3', note: 'the post-processing steps of the tuner' },
  'game-infection': { task: 'T3.14', proposed: true, note: 'bindInfection of game-crowd ties the horde to a region model: the zones of the site become regions and a release materializes agents; it changes how the horde is born, so it is a task of its own, not wiring' },
  'game-items': { task: 'T3.11', note: 'finds in the wardrobe: open_container waits for L6' },
  'game-items-three': { task: 'T3.11', note: 'draws the finds' },
  'game-load-path': { task: 'T3.3', note: 'the load path of the bridge' },
  'game-shapes': { notScenePackage: 'the shape generator the -three packages draw from: the assembly reaches it only through game-shapes-three' },
  'game-vegetation-three': { notScenePackage: 'the nursery test module of the shared room (its README says so); the vegetation drawing is game-vegetation/three' },
  'game-vehicles-driving': { lacuna: 'L7', note: 'the drive of the street and the armored truck of the crossing; run_over reaches the horde only with L8' },
  'game-weapons': { lacuna: 'L1', note: 'shots and explosives: only the script runner of src/test calls it (N5) until T1.7 moves them into the SDK' },
  'game-weapons-three': { lacuna: 'L1', note: 'the weapon in the hand: T1.8' },
}
