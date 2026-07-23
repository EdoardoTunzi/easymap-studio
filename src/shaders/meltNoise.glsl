// NAME: Melt Noise
uniform float speed; // @min 0.0 @max 2.0 @default 0.6
uniform float scale; // @min 1.0 @max 10.0 @default 4.0
uniform float hue; // @min 0.0 @max 1.0 @default 0.1
uniform float sharp; // @min 0.5 @max 4.0 @default 1.5

float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.0, 0.33, 0.67)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv * scale;
  float t = time * speed;
  float n = noise(p + vec2(0.0, t) + noise(p * 2.0 - t));
  vec3 col = pal(pow(n, sharp) + hue);
  return vec4(col, 1.0);
}
