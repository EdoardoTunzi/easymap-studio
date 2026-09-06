// NAME: Radial Kaleido 2
uniform float seed; // @min 0.0 @max 100.0 @default 0.0
uniform float segments; // @min 2.0 @max 16.0 @default 6.0
uniform float twist; // @min -4.0 @max 4.0 @default 1.5
uniform float rings; // @min 1.0 @max 20.0 @default 8.0
uniform float colorShift; // @min 0.0 @max 10.0 @default 3.0
uniform float hue; // @min 0.0 @max 1.0 @default 0.0
uniform float sat; // @min 0.0 @max 2.0 @default 1.0
uniform float sharpness; // @min 0.5 @max 6.0 @default 2.0
uniform float zoom; // @min 0.3 @max 3.0 @default 1.0
uniform float intensity; // @min 0.0 @max 1.0 @default 0.85
uniform float speed; // @min 0.0 @max 3.0 @default 1.0

vec3 palette(float t) {
  vec3 base = vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(0.4, 0.2, 0.6) * t + vec3(0.1, 0.4, 0.7) + hue));
  return mix(vec3(dot(base, vec3(0.299, 0.587, 0.114))), base, sat);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float stime = time * speed + seed * 13.7;
  vec4 source = texture2D(tex, uv);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  p /= max(zoom, 0.01);
  float r = length(p);
  // spirale logaritmica: il braccio non si chiude mai, la piega segmentale lo replica
  float a = atan(p.y, p.x) + twist * log(r + 0.15) - stime * 0.3;
  float seg = 6.28318 / segments;
  a = abs(mod(a, seg) - seg * 0.5);
  float pattern = 0.5 + 0.5 * sin(a * 6.0 + r * rings - stime * 1.5 + source.r * colorShift);
  vec3 col = palette(pattern + r + source.g * colorShift * 0.2) * pow(pattern, sharpness) * 2.0;
  vec3 blended = mix(source.rgb, col, intensity * smoothstep(0.0, 0.4, lum));
  return vec4(blended, source.a);
}
