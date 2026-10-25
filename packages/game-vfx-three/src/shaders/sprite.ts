/** The soft round point sprite of the game's sprite kinds (moved verbatim from the destruction renderer's particles). */
export const SPRITE_VERTEX = `
uniform float uScale;
attribute float size;
attribute float alpha;
attribute vec3 pcolor;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vAlpha = alpha;
  vColor = pcolor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(size * uScale / max(0.1, -mv.z), 256.0);
  gl_Position = projectionMatrix * mv;
}`

export const SPRITE_FRAGMENT = `
varying float vAlpha;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
  float a = (1.0 - smoothstep(0.35, 1.0, d)) * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor, a);
}`
