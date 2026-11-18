/**
 * A page that reproduces the multithreaded build with a JS contact listener: a 1500-box pile, `workerThreads` job threads, the listener on or off, 120 steps.
 * It writes `window.__probe` (step times, which thread ran the callbacks) or `window.__probeError`. Served next to `jolt-physics.multithread.wasm-compat.js`.
 */
export const PROBE_HTML = `<!doctype html><meta charset="utf-8"><script type="module">
const q = new URLSearchParams(location.search)
const threads = Number(q.get('threads') ?? 4)
const listen = q.get('listener') !== 'off'
const fail = (error) => { window.__probeError = String(error && error.message || error) }
window.addEventListener('error', (event) => fail(event.message))
window.addEventListener('unhandledrejection', (event) => fail(event.reason))
try {
  const J = await (await import('./jolt-physics.multithread.wasm-compat.js')).default()
  const s = new J.JoltSettings()
  s.mMaxWorkerThreads = threads
  const pairs = new J.ObjectLayerPairFilterTable(2); pairs.EnableCollision(0, 1); pairs.EnableCollision(1, 1)
  const bp = new J.BroadPhaseLayerInterfaceTable(2, 2)
  bp.MapObjectToBroadPhaseLayer(0, new J.BroadPhaseLayer(0)); bp.MapObjectToBroadPhaseLayer(1, new J.BroadPhaseLayer(1))
  s.mObjectLayerPairFilter = pairs; s.mBroadPhaseLayerInterface = bp
  s.mObjectVsBroadPhaseLayerFilter = new J.ObjectVsBroadPhaseLayerFilterTable(bp, 2, pairs, 2)
  const iface = new J.JoltInterface(s)
  const system = iface.GetPhysicsSystem(), bodies = system.GetBodyInterface()
  let added = 0
  if (listen) {
    const l = new J.ContactListenerJS()
    l.OnContactValidate = () => J.ValidateResult_AcceptAllContactsForThisBodyPair
    l.OnContactAdded = () => { added++ }
    l.OnContactPersisted = () => {}
    l.OnContactRemoved = () => {}
    system.SetContactListener(l)
  }
  bodies.CreateAndAddBody(new J.BodyCreationSettings(new J.BoxShape(new J.Vec3(50, 1, 50)), new J.RVec3(0, -1, 0), new J.Quat(0, 0, 0, 1), J.EMotionType_Static, 0), J.EActivation_DontActivate)
  const box = new J.BoxShape(new J.Vec3(0.2, 0.2, 0.2))
  for (let i = 0; i < 1500; i++) {
    const x = (i % 30) * 0.5 - 7.5, z = (Math.floor(i / 30) % 30) * 0.5 - 7.5, y = 0.3 + Math.floor(i / 900) * 0.45
    bodies.CreateAndAddBody(new J.BodyCreationSettings(box, new J.RVec3(x, y, z), new J.Quat(0, 0, 0, 1), J.EMotionType_Dynamic, 1), J.EActivation_Activate)
  }
  const times = []
  for (let f = 0; f < 120; f++) { const t = performance.now(); iface.Step(1 / 60, 1); times.push(performance.now() - t) }
  window.__probe = { threads, listener: listen, contactsAddedOnMainThread: added, meanMs: times.slice(20).reduce((a, b) => a + b, 0) / 100 }
} catch (error) { fail(error) }
</script>`
