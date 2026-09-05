// NAME: Acid Melt
uniform float speed; // @min 0.0 @max 3.0 @default 0.8
uniform float scale; // @min 1.0 @max 12.0 @default 4.0
uniform float melt; // @min 0.0 @max 3.0 @default 1.4
uniform float bands; // @min 1.0 @max 20.0 @default 6.0
uniform vec3 tint; // @default 0.6,1.0,0.1

float hash1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash1(i), hash1(i + vec2(1.0, 0.0)), u.x),
             mix(hash1(i + vec2(0.0, 1.0)), hash1(i + vec2(1.0, 1.0)), u.x), u.y);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv * scale;
  float t = time * speed;
  // lo scorrimento verso il basso cresce col noise: sembra vernice che cola
  float drip = noise2(vec2(p.x * 2.0, t * 0.5)) * melt;
  p.y += drip;
  float n = noise2(p + vec2(0.0, t));
  float band = fract(n * bands + t * 0.3);
  float edge = smoothstep(0.0, 0.08, band) * smoothstep(1.0, 0.92, band);
  vec3 col = tint * (0.25 + 0.75 * edge);
  col *= 0.5 + 0.9 * cos(6.28318 * (n + vec3(0.0, 0.33, 0.67)));
  return vec4(abs(col), 1.0);
}
