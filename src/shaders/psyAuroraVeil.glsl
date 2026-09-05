// NAME: Aurora Veil
uniform float speed; // @min 0.0 @max 2.0 @default 0.5
uniform float bands; // @min 1.0 @max 10.0 @default 3.0
uniform float waviness; // @min 0.0 @max 2.0 @default 0.8
uniform float softness; // @min 0.02 @max 0.6 @default 0.2
uniform vec3 colorA; // @default 0.1,1.0,0.5
uniform vec3 colorB; // @default 0.5,0.1,1.0

float hash1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash1(i), hash1(i + vec2(1.0, 0.0)), u.x),
             mix(hash1(i + vec2(0.0, 1.0)), hash1(i + vec2(1.0, 1.0)), u.x), u.y);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float t = time * speed;
  vec3 col = vec3(0.0);
  // piu' veli sovrapposti, ognuno con la sua ondulazione e velocita'
  for (int i = 0; i < 10; i++) {
    if (float(i) >= bands) break;
    float fi = float(i);
    float offset = fi / max(bands, 1.0);
    float wob = noise2(vec2(uv.x * 2.5 + fi * 3.1, t * 0.4 + fi)) - 0.5;
    float center = 0.5 + (offset - 0.5) * 0.8 + wob * waviness;
    float d = abs(uv.y - center);
    float veil = smoothstep(softness, 0.0, d);
    // le tende verticali tipiche dell'aurora
    veil *= 0.5 + 0.5 * noise2(vec2(uv.x * 18.0 + fi * 7.0, t * 0.8));
    col += mix(colorA, colorB, offset) * veil;
  }
  return vec4(col / max(bands * 0.5, 1.0) * 1.6, 1.0);
}
