/* global GoldenTool */
// Capture for the Retratos do Vale page: the 44 named people built by the page's `buildPerson` (the survivor body with its accessories), one scene
// hash each. The page draws from a shared seeded stream (`rng(77)`), so the people are built in the order of `PEOPLE`, once. Only the hash is kept.
(() => {
  const { seed } = globalThis.__GOLDEN_PARAMS
  const { buildPerson, PEOPLE } = globalThis.__team
  const recorder = GoldenTool.createEventRecorder()
  const scenes = {}
  for (const person of PEOPLE) {
    const built = buildPerson(person, false)
    const snapshot = GoldenTool.snapshotScene(built.root)
    scenes[`person_${person.id}`] = { objects: snapshot.objects, hash: snapshot.hash, lines: [] }
    recorder.record('person', { id: person.id, characters: built.chars.length, objects: snapshot.objects })
  }
  return { schema: 1, name: 'portraits-people', seed: Number(seed), events: recorder.events(), scenes }
})()
