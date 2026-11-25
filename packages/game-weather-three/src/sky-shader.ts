export const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

/** One dome: the vertical gradient, sunset warmth, stars, moon, sun with its glow and one procedural cloud layer (4 octaves of value noise on a plane projected from the dome). */
export const SKY_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uTint;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform vec3 uDrift;
uniform float uSunsetAmount;
uniform float uSunVis;
uniform float uMoonVis;
uniform float uStars;
uniform float uCover;
uniform float uTime;
uniform float uFlash;
varying vec3 vDir;

float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 4; octave++) {
    value += amplitude * noise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec3 d = normalize(vDir);
  float height = max(d.y, 0.0);
  vec3 color = mix(uHorizon, uZenith, pow(height, 0.6));

  vec2 azimuth = normalize(d.xz + vec2(1e-5));
  vec2 sunAzimuth = normalize(uSunDir.xz + vec2(1e-5));
  float towardSun = max(dot(azimuth, sunAzimuth), 0.0);
  color = mix(color, uTint, uSunsetAmount * exp(-height * 6.0) * (0.25 + 0.75 * towardSun * towardSun));

  float aboveHorizon = smoothstep(-0.05, 0.05, d.y);
  if (uStars > 0.001 && d.y > 0.0) {
    vec3 p = d * 120.0;
    vec3 cell = floor(p);
    float pick = hash3(cell);
    if (pick > 0.985) {
      vec3 spot = vec3(hash3(cell + 1.7), hash3(cell + 5.3), hash3(cell + 9.1)) * 0.4 + 0.3;
      float twinkle = 0.78 + 0.22 * sin(uTime * 2.0 + pick * 60.0);
      float star = (1.0 - smoothstep(0.04, 0.32, length(fract(p) - spot))) * (0.45 + 0.55 * fract(pick * 97.0)) * twinkle;
      color += vec3(0.85, 0.9, 1.0) * star * uStars * smoothstep(0.0, 0.12, d.y);
    }
  }

  if (uMoonVis > 0.001) {
    float toMoon = dot(d, uMoonDir);
    vec3 tangent = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
    vec2 onDisc = vec2(dot(d, tangent), dot(d, cross(uMoonDir, tangent))) / 0.045;
    float disc = (1.0 - smoothstep(0.93, 1.0, length(onDisc))) * step(0.0, toMoon);
    vec3 moon = vec3(0.7, 0.73, 0.8) * (0.62 + 0.38 * fbm(onDisc * 3.0 + 3.0));
    color += (moon * disc + vec3(0.55, 0.62, 0.8) * pow(max(toMoon, 0.0), 220.0) * 0.5) * uMoonVis * aboveHorizon;
  }

  if (uSunVis > 0.001) {
    float toSun = dot(d, uSunDir);
    float disc = smoothstep(0.99935, 0.99965, toSun);
    float glow = pow(max(toSun, 0.0), 48.0) * 0.5 + pow(max(toSun, 0.0), 6.0) * 0.14;
    color += uSunColor * (glow + disc * 2.5) * uSunVis * aboveHorizon;
  }

  if (d.y > -0.05) {
    vec2 uv = d.xz / (height + 0.18) * 1.1 + uDrift.xy;
    float density = fbm(uv);
    float threshold = 0.74 - uCover * 0.9;
    float coverage = smoothstep(threshold, threshold + 0.22, density) * smoothstep(-0.05, 0.12, d.y);
    float thick = smoothstep(threshold, threshold + 0.5, density);
    vec3 cloud = mix(uCloudLit, uCloudShade, thick * 0.8);
    cloud = mix(uHorizon, cloud, smoothstep(0.0, 0.3, d.y));
    color = mix(color, cloud, coverage);
  }

  color = mix(color, vec3(0.78, 0.82, 0.95), uFlash * 0.7);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`
