// @ts-check
// The build stamp of the test-room page: the commit, the dirty flag and the build time, in a <meta> the gauge reads back from a saved html file.
// The hash that tells two pages apart ignores the stamp (it changes on every build), so "same hash" still means "same code".

import { createHash } from 'node:crypto'

/**
 * @typedef {{ commit: string, dirty: boolean, builtAt: string }} PageBuild
 */

const STAMP_PATTERN = /<meta name="kit-build" content='([^']*)'>\n?/

/** The <meta> for the page's head. @param {PageBuild} build @returns {string} */
export const stampMarkupOf = (build) => `<meta name="kit-build" content='${JSON.stringify({ commit: build.commit, dirty: build.dirty, builtAt: build.builtAt }).replaceAll("'", '&#39;')}'>\n`

/** The stamp of a page, or null when it has none or it does not parse. @param {string} html @returns {PageBuild | null} */
export const parsePageStamp = (html) => {
  const found = STAMP_PATTERN.exec(html)
  if (!found) return null
  try {
    const value = JSON.parse(found[1] ?? '')
    if (typeof value?.commit !== 'string' || typeof value.dirty !== 'boolean' || typeof value.builtAt !== 'string') return null
    return { commit: value.commit, dirty: value.dirty, builtAt: value.builtAt }
  } catch {
    return null
  }
}

/** @param {string} html @returns {string} */
export const stripPageStamp = (html) => html.replace(STAMP_PATTERN, '')

/** The sha256 of the page without its stamp. @param {string} html @returns {string} */
export const pageHashOf = (html) => createHash('sha256').update(stripPageStamp(html)).digest('hex')

/**
 * A page this run built must carry the commit the repository is at: another one means the build did not run here or the stamp is lost.
 * @param {{ stamp: PageBuild | null, head: string }} run
 */
export const assertStampIsHead = ({ stamp, head }) => {
  if (stamp === null) throw new Error('room-explosion: the page this run built has no build stamp (examples/test-room/build.mjs did not write it)')
  if (stamp.commit !== head) throw new Error(`room-explosion: the page was built at ${stamp.commit.slice(0, 12)} but HEAD is ${head.slice(0, 12)}: the build is not of this commit`)
}
