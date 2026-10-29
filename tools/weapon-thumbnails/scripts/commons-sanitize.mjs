// Sizing of a sanitized SVG for drawing. The sanitizer itself is src/sanitize.ts (sanitizeSvg, exported by the tool).
const attribute = (tag, name) => new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag)?.slice(2).find((value) => value !== undefined)

/** The sanitized text with a root `viewBox` (from width/height when missing) and a `width`/`height` of `longSide` pixels on the long side, ready to be drawn. Undefined when it is not an SVG. */
export function sizedSvg(clean, longSide) {
  const root = /<svg\b[^>]*>/i.exec(clean)
  if (!root) return undefined
  let viewBox = attribute(root[0], 'viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (!viewBox || viewBox.length !== 4 || viewBox.some((value) => !Number.isFinite(value))) {
    const width = parseFloat(attribute(root[0], 'width') ?? '')
    const height = parseFloat(attribute(root[0], 'height') ?? '')
    if (!(width > 0) || !(height > 0)) return undefined
    viewBox = [0, 0, width, height]
  }
  if (!(viewBox[2] > 0) || !(viewBox[3] > 0)) return undefined
  const scale = longSide / Math.max(viewBox[2], viewBox[3])
  const width = Math.max(1, Math.round(viewBox[2] * scale))
  const height = Math.max(1, Math.round(viewBox[3] * scale))
  const stripped = root[0].replace(/\s(?:width|height|viewBox|preserveAspectRatio)\s*=\s*("[^"]*"|'[^']*')/gi, '').replace(/<svg\b/i, '')
  const open = `<svg xmlns="http://www.w3.org/2000/svg"${/xmlns:xlink/.test(stripped) ? ' xmlns:xlink="http://www.w3.org/1999/xlink"' : ''} width="${width}" height="${height}" viewBox="${viewBox.join(' ')}"${stripped.replace(/\sxmlns(?::xlink)?\s*=\s*("[^"]*"|'[^']*')/gi, '')}`
  return { svg: clean.replace(root[0], open), width, height }
}
