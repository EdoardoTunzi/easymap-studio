// NAME: Marble
uniform float speed; // @min 0.0 @max 2.0 @default 0.5
uniform float scale; // @min 1.0 @max 8.0 @default 3.0
uniform float hue; // @min 0.0 @max 1.0 @default 0.55
uniform float contrast; // @min 0.5 @max 3.0 @default 1.5

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.0, 0.4, 0.7)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv * scale;
  float t = time * speed;
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  float f = fbm(p + 4.0 * q);
  vec3 col = pal(f * contrast + hue);
  return vec4(col, 1.0);
}
