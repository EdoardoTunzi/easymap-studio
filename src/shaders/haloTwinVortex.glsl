// NAME: Halo Twin Vortex
uniform float seed; // @min 0.0 @max 100.0 @default 0.0
uniform float colorShift; // @min 0.0 @max 10.0 @default 3.0
uniform float intensity; // @min 0.0 @max 1.0 @default 0.85
uniform float vortex; // @min 0.0 @max 4.0 @default 2.0
uniform float freq; // @min 2.0 @max 20.0 @default 8.0

vec3 palette(float t) {
  return vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(0.3, 0.4, 0.5) * t + vec3(0.5, 0.2, 0.8)));
}

vec2 swirl(vec2 p, float amt, float t) {
  float r = length(p);
  float a = atan(p.y, p.x) + amt * r * sin(t * 0.5 + r * 2.0);
  return r * vec2(cos(a), sin(a));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float stime = time + seed * 11.9;
  vec2 uv_sym = vec2(0.5 + abs(uv.x - 0.5), uv.y);
  vec4 source = texture2D(tex, uv_sym);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  vec2 p = uv_sym * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  p = swirl(p, vortex + source.r * colorShift * 0.1, stime);
  float v = sin(p.x * freq + stime) * cos(p.y * freq - stime);
  vec3 col = palette(v * 0.5 + source.g * colorShift * 0.2 + length(p)) * (0.5 + 0.5 * v) * 2.0;
  vec3 blended = mix(source.rgb, col, intensity * smoothstep(0.0, 0.4, lum));
  return vec4(blended, source.a);
}
