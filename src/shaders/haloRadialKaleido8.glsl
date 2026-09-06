// NAME: Radial Kaleido 8
uniform float seed; // @min 0.0 @max 100.0 @default 0.0
uniform float segments; // @min 2.0 @max 16.0 @default 7.0
uniform float depth; // @min 0.1 @max 2.0 @default 0.6
uniform float travel; // @min -3.0 @max 3.0 @default 1.0
uniform float stripes; // @min 1.0 @max 20.0 @default 6.0
uniform float fog; // @min 0.0 @max 2.0 @default 0.8
uniform float parallax; // @min 0.0 @max 1.5 @default 0.4
uniform float colorShift; // @min 0.0 @max 10.0 @default 3.0
uniform float hue; // @min 0.0 @max 1.0 @default 0.72
uniform float sat; // @min 0.0 @max 2.0 @default 1.0
uniform float intensity; // @min 0.0 @max 1.0 @default 0.85
uniform float speed; // @min 0.0 @max 3.0 @default 1.0

vec3 palette(float t) {
  vec3 base = vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(0.4, 0.25, 0.6) * t + vec3(0.2, 0.5, 0.8) + hue));
  return mix(vec3(dot(base, vec3(0.299, 0.587, 0.114))), base, sat);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float stime = time * speed + seed * 8.8;
  vec4 source = texture2D(tex, uv);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float r = max(length(p), 0.02);
  float a = atan(p.y, p.x);
  float seg = 6.28318 / segments;
  a = abs(mod(a, seg) - seg * 0.5);
  // 1/r: il centro diventa infinitamente lontano, il rosone si legge come imbuto
  float z = depth / r + travel * stime * 0.3 + parallax * lum;
  float pattern = 0.5 + 0.5 * sin(z * stripes + a * 6.0 + source.b * colorShift);
  float haze = 1.0 - exp(-r * fog * 2.0);
  vec3 col = palette(z * 0.15 + pattern * 0.4 + source.g * colorShift * 0.2);
  col *= pow(pattern, 2.0) * 2.0 * mix(1.0, haze, fog * 0.5);
  vec3 blended = mix(source.rgb, col, intensity * smoothstep(0.0, 0.4, lum));
  return vec4(blended, source.a);
}
