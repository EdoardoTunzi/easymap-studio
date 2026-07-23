// NAME: Aurora Flow
uniform float speed; // @min 0.0 @max 2.0 @default 0.7
uniform float scale; // @min 1.0 @max 8.0 @default 3.0
uniform float hue; // @min 0.0 @max 1.0 @default 0.45
uniform float bands; // @min 1.0 @max 10.0 @default 4.0

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.0, 0.4, 0.7)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv;
  float t = time * speed;
  float n = noise(vec2(p.x * scale, p.y * scale * 0.5 + t));
  float band = sin((p.y + n * 0.3) * bands * 3.14159 + t);
  float glow = smoothstep(0.3, 1.0, band);
  vec3 col = pal(p.y + hue + n * 0.2) * glow * 1.5;
  return vec4(col, 1.0);
}
