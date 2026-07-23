// NAME: Halo Radial Kaleido
uniform float seed; // @min 0.0 @max 100.0 @default 0.0
uniform float segments; // @min 2.0 @max 16.0 @default 6.0
uniform float colorShift; // @min 0.0 @max 10.0 @default 3.0
uniform float intensity; // @min 0.0 @max 1.0 @default 0.85
uniform float swirlAmount; // @min 0.0 @max 2.0 @default 0.6

vec3 palette(float t) {
  return vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(0.4, 0.2, 0.6) * t + vec3(0.1, 0.4, 0.7)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float stime = time + seed * 13.7;
  vec4 source = texture2D(tex, uv);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float r = length(p);
  float a = atan(p.y, p.x);
  float seg = 6.28318 / segments;
  a = abs(mod(a, seg) - seg * 0.5);
  a += swirlAmount * r * sin(stime * 0.5 + r * 3.0 + source.r * colorShift);
  float pattern = 0.5 + 0.5 * sin(a * 6.0 + r * 8.0 - stime * 1.5);
  vec3 col = palette(pattern + r + source.g * colorShift * 0.2) * pow(pattern, 2.0) * 2.0;
  vec3 blended = mix(source.rgb, col, intensity * smoothstep(0.0, 0.4, lum));
  return vec4(blended, source.a);
}
