// NAME: Radial Kaleido 3
uniform float seed; // @min 0.0 @max 100.0 @default 0.0
uniform float segments; // @min 2.0 @max 16.0 @default 8.0
uniform float rings; // @min 1.0 @max 24.0 @default 10.0
uniform float pulse; // @min 0.0 @max 4.0 @default 1.2
uniform float ringWidth; // @min 0.05 @max 1.0 @default 0.45
uniform float relief; // @min 0.0 @max 1.5 @default 0.5
uniform float glow; // @min 0.0 @max 2.0 @default 0.6
uniform float colorShift; // @min 0.0 @max 10.0 @default 3.0
uniform float hue; // @min 0.0 @max 1.0 @default 0.15
uniform float sat; // @min 0.0 @max 2.0 @default 1.0
uniform float intensity; // @min 0.0 @max 1.0 @default 0.85
uniform float speed; // @min 0.0 @max 3.0 @default 1.0

vec3 palette(float t) {
  vec3 base = vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(0.5, 0.3, 0.7) * t + vec3(0.0, 0.35, 0.6) + hue));
  return mix(vec3(dot(base, vec3(0.299, 0.587, 0.114))), base, sat);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float stime = time * speed + seed * 7.3;
  vec4 source = texture2D(tex, uv);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float r = length(p);
  float a = atan(p.y, p.x);
  float seg = 6.28318 / segments;
  a = abs(mod(a, seg) - seg * 0.5);
  // il rilievo spinge le onde verso l'esterno dove la sorgente e' chiara: gli anelli seguono il soggetto
  float rr = r - relief * lum + 0.05 * sin(a * segments + stime * pulse);
  float band = 0.5 + 0.5 * sin(rr * rings * 6.28318 - stime * pulse * 2.0 + source.b * colorShift);
  float pattern = smoothstep(1.0 - ringWidth, 1.0, band);
  vec3 col = palette(rr + band * 0.5 + source.g * colorShift * 0.2);
  col *= pattern * 2.0 + glow / (1.0 + r * r * 8.0);
  vec3 blended = mix(source.rgb, col, intensity * smoothstep(0.0, 0.4, lum));
  return vec4(blended, source.a);
}
