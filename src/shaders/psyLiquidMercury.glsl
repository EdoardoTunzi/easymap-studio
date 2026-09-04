// NAME: Liquid Mercury
uniform float speed; // @min 0.0 @max 3.0 @default 0.7
uniform float scale; // @min 1.0 @max 10.0 @default 3.5
uniform float ripple; // @min 0.0 @max 3.0 @default 1.2
uniform float shine; // @min 0.5 @max 6.0 @default 2.5
uniform vec3 tint; // @default 0.7,0.8,1.0

float hash1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash1(i), hash1(i + vec2(1.0, 0.0)), u.x),
             mix(hash1(i + vec2(0.0, 1.0)), hash1(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm2(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise2(p); p *= 2.03; a *= 0.5; }
  return v;
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv * scale;
  float t = time * speed;
  float h = fbm2(p + ripple * vec2(fbm2(p + t), fbm2(p - t)));
  // normale approssimata dal campo di altezza: da' la riflessione metallica
  float e = 0.02;
  float hx = fbm2(p + vec2(e, 0.0) + ripple * vec2(fbm2(p + t), fbm2(p - t))) - h;
  float hy = fbm2(p + vec2(0.0, e) + ripple * vec2(fbm2(p + t), fbm2(p - t))) - h;
  vec3 n = normalize(vec3(-hx, -hy, 0.12));
  vec3 l = normalize(vec3(sin(t * 0.6), cos(t * 0.5), 0.8));
  float spec = pow(max(dot(n, l), 0.0), shine * 8.0);
  float diff = 0.4 + 0.6 * max(dot(n, l), 0.0);
  return vec4(tint * diff + vec3(spec), 1.0);
}
