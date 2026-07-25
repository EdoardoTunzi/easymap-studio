// NAME: Halo Spiral Drift
uniform float seed; // @min 0.0 @max 100.0 @default 0.0
uniform float arms; // @min 1.0 @max 10.0 @default 4.0
uniform float twist; // @min 0.0 @max 12.0 @default 5.0
uniform float colorShift; // @min 0.0 @max 10.0 @default 3.0
uniform float intensity; // @min 0.0 @max 1.0 @default 0.85

vec3 palette(float t) {
  return vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(0.5, 0.3, 0.2) * t + vec3(0.0, 0.3, 0.6)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float stime = time + seed * 17.1;
  vec2 uv_sym = vec2(0.5 + abs(uv.x - 0.5), uv.y);
  vec4 source = texture2D(tex, uv_sym);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  vec2 p = uv_sym * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float r = length(p);
  float a = atan(p.y, p.x);
  float s = sin(arms * a + twist * log(r + 0.15) - stime * 1.2 + source.b * colorShift);
  vec3 col = palette(s * 0.5 + r + source.r * colorShift * 0.2) * (0.5 + 0.5 * s) * 2.0;
  vec3 blended = mix(source.rgb, col, intensity * smoothstep(0.0, 0.4, lum));
  return vec4(blended, source.a);
}
