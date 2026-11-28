// @ts-check
// The bare room page (base/test-room.html) and the area pages built over it (examples/<lib>-test-area/dist/sala-*.html).
//
// The room's physics is Jolt (`window.__roomPhysics`, made by the Jolt boot of build.mjs), and Jolt's wasm loads asynchronously: the room cannot be made
// in the first synchronous script of the page anymore. So the bare room carries its bundle as inert text, and its boot script loads Jolt, runs the room
// bundle (which sets `window.__testRoom`) and then runs, in document order, every area script appended with `withArea` (inert text as well). An area's
// boot expression still reads `window.__testRoom` as a room that exists. `window.__testRoomReady` is the promise of that room once its shaders are
// warm (`window.__testRoomWarm`), for a page that drives its own loading screen (the floorplan area) and for the checks that photograph it.

/** The attribute that marks an area script of the bare room: the boot runs these after the room exists. */
export const AREA_SCRIPT_ATTRIBUTE = 'data-room-area'

/**
 * The boot script of the bare room: waits for the document (the area scripts come after this one), loads Jolt, runs the room bundle, then the area scripts.
 * A failure is thrown into `window.__testRoomError` and the console, so a check that waits for its report sees why it never came.
 */
export const BARE_ROOM_BOOT = `(function () {
  var parsed = document.readyState === 'loading' ? new Promise(function (resolve) { document.addEventListener('DOMContentLoaded', resolve, { once: true }) }) : Promise.resolve()
  var run = function (source) {
    var script = document.createElement('script')
    script.textContent = source
    document.body.appendChild(script)
  }
  window.__testRoomReady = parsed.then(function () {
    return window.__joltBoot()
  }).then(function () {
    run(document.getElementById('room-bundle').textContent)
    if (!window.__testRoom) throw new Error('the room bundle did not make window.__testRoom')
    var areas = document.querySelectorAll('script[type="text/plain"][${AREA_SCRIPT_ATTRIBUTE}]')
    for (var i = 0; i < areas.length; i++) run(areas[i].textContent)
    // the shaders of the room and of the areas are linked over several tasks, and nothing is drawn meanwhile (game-kit-defaults' render): a check that
    // photographs the room waits for __testRoomWarm, or its first picture is the last frame drawn before the warm-up (an empty floor)
    var room = window.__testRoom
    return Promise.resolve(typeof room.warmUpAsync === 'function' ? room.warmUpAsync() : undefined).then(function () {
      window.__testRoomWarm = true
      return room
    })
  }).catch(function (error) {
    window.__testRoomError = String(error && error.message ? error.message : error)
    console.error('test room: ' + window.__testRoomError)
    throw error
  })
})()`

/** Script text inlined in a page: no `</script>` inside it. */
const safe = (/** @type {string} */ s) => s.replace(/<\/(script)/gi, '<\\/$1')

/**
 * The bare room page with an area loaded: `bundle` (the area's IIFE) and `boot` (the expression that loads it into `window.__testRoom`) ride as an
 * area script, which the bare room's boot runs once the room exists.
 * @param {string} roomPage the bare room page (base/test-room.html)
 * @param {string} bundle the area's bundle
 * @param {string} boot the expression that loads the area into the room
 * @returns {string} the area page
 */
export function withArea(roomPage, bundle, boot) {
  if (!roomPage.includes('id="room-bundle"') || !roomPage.includes('__testRoomReady')) throw new Error('the room page is not the bare room of examples/test-room (base/test-room.html): build examples/test-room again')
  const at = roomPage.lastIndexOf('</body>')
  if (at < 0) throw new Error('the room page has no </body>')
  return `${roomPage.slice(0, at)}<script type="text/plain" ${AREA_SCRIPT_ATTRIBUTE}>${safe(bundle)}\n${boot}</script>\n${roomPage.slice(at)}`
}
