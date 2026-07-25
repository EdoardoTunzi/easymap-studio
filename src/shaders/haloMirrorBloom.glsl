// NAME: Halo Mirror Bloom
uniform float seed; // @min 0.0 @max 100.0 @default 0.0
uniform float colorShift; // @min 0.0 @max 10.0 @default 3.0
uniform float intensity; // @min 0.0 @max 1.0 @default 0.85
uniform float petals; // @min 3.0 @max 16.0 @default 8.0
uniform float bloom; // @min 0.0 @max 3.0 @default 1.5

vec3 palette(float t) {
  return vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(0.2, 0.5, 0.3) * t + vec3(0.3, 0.6, 0.9)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float stime = time + seed * 7.3;
  vec2 uv_sym = vec2(0.5 + abs(uv.x - 0.5), 0.5 + abs(uv.y - 0.5));
  vec4 source = texture2D(tex, uv_sym);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  vec2 p = uv_sym * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float r = length(p);
  float a = atan(p.y, p.x);
  float f = abs(sin(a * petals * 0.5 + stime + source.r * colorShift)) * exp(-r * 1.5);
  vec3 col = palette(f * bloom + r + source.g * colorShift * 0.1) * (f * bloom * 3.0);
  vec3 blended = mix(source.rgb, col, intensity * smoothstep(0.0, 0.4, lum));
  return vec4(blended, source.a);
}
