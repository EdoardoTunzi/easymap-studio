// NAME: Liquid Symmetry
uniform float seed; // @min 0.0 @max 100.0 @default 0.0
uniform float scale; // @min 1.0 @max 8.0 @default 3.0
uniform float colorShift; // @min 0.0 @max 10.0 @default 3.0
uniform float intensity; // @min 0.0 @max 1.0 @default 0.85
uniform float flow; // @min 0.0 @max 2.0 @default 0.7
uniform float mirror; // @min 0.0 @max 1.0 @default 1.0 @step 1

float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float nz(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), u.x),
             mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * nz(p); p *= 2.0; a *= 0.5; }
  return v;
}

vec3 palette(float t) {
  return vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(0.2, 0.5, 0.4) * t + vec3(0.4, 0.2, 0.6)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float stime = time + seed * 9.2;
  vec2 uv_sym = mix(uv, vec2(0.5 + abs(uv.x - 0.5), uv.y), mirror);
  vec4 source = texture2D(tex, uv_sym);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  vec2 p = uv_sym * scale;
  float t = stime * flow;
  vec2 q = vec2(fbm(p + t + source.r * colorShift * 0.1), fbm(p + vec2(3.1, 1.7) - t));
  float f = fbm(p + 3.0 * q);
  vec3 col = palette(f * 1.5 + source.g * colorShift * 0.2) * 1.8;
  vec3 blended = mix(source.rgb, col, intensity * smoothstep(0.0, 0.4, lum));
  return vec4(blended, source.a);
}
