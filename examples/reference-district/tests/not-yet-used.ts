/** What brings a package into the assembly: a task of spec 011, a lacuna of its section 8, or nothing decided yet (the owner has to say). */
export type Bringer = { readonly task: string; readonly note?: string } | { readonly lacuna: string; readonly note?: string } | { readonly undecided: string }

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
  'game-devtools': { undecided: 'in-game test tooling; no task of the spec puts it in the page (T2.5/T2.6 may)' },
  'game-floorplan-interactables': { lacuna: 'L6', note: 'plan to working objects and networks: the house is entered by hand only in the test area' },
  'game-floorplan-rural': { undecided: 'no lot of recorte 1 is rural; R2 asks for every package, so the owner decides whether the cut gets one' },
  'game-infection': { undecided: 'bindInfection (spec 011 section 3) is wired by no task' },
  'game-items': { task: 'T3.11', note: 'finds in the wardrobe: open_container waits for L6' },
  'game-items-three': { task: 'T3.11', note: 'draws the finds' },
  'game-load-path': { task: 'T3.3', note: 'the load path of the bridge' },
  'game-shapes': { undecided: 'reached only through game-shapes-three; the assembly instantiates no shape of its own' },
  'game-vegetation-three': { undecided: 'a test module of the room (the nursery), not a drawing package; R2 lists only two exceptions' },
  'game-vehicles-driving': { lacuna: 'L7', note: 'the drive of the street and the armored truck of the crossing; run_over reaches the horde only with L8' },
  'game-weapons': { lacuna: 'L1', note: 'shots and explosives: only the script runner of src/test calls it (N5) until T1.7 moves them into the SDK' },
  'game-weapons-three': { lacuna: 'L1', note: 'the weapon in the hand: T1.8' },
}
