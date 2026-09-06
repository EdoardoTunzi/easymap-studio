// NAME: Radial Kaleido 6
uniform float seed; // @min 0.0 @max 100.0 @default 0.0
uniform float segments; // @min 3.0 @max 24.0 @default 9.0
uniform float radialSteps; // @min 1.0 @max 16.0 @default 6.0
uniform float edge; // @min 0.0 @max 0.5 @default 0.08
uniform float bevel; // @min 0.0 @max 2.0 @default 0.9
uniform float drift; // @min -2.0 @max 2.0 @default 0.4
uniform float colorShift; // @min 0.0 @max 10.0 @default 3.0
uniform float hue; // @min 0.0 @max 1.0 @default 0.6
uniform float sat; // @min 0.0 @max 2.0 @default 1.0
uniform float intensity; // @min 0.0 @max 1.0 @default 0.85
uniform float speed; // @min 0.0 @max 3.0 @default 1.0

vec3 palette(float t) {
  vec3 base = vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(0.45, 0.25, 0.65) * t + vec3(0.15, 0.45, 0.75) + hue));
  return mix(vec3(dot(base, vec3(0.299, 0.587, 0.114))), base, sat);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float stime = time * speed + seed * 4.4;
  vec4 source = texture2D(tex, uv);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float r = length(p);
  float a = atan(p.y, p.x) + drift * stime * 0.2;
  float seg = 6.28318 / segments;
  float cellA = floor(a / seg);
  a = abs(mod(a, seg) - seg * 0.5);
  // griglia polare a celle: ogni faccetta e' una tessera piatta con il suo tono
  float rc = r * radialSteps - stime * 0.5 + lum * bevel;
  float cellR = floor(rc);
  float id = cellA * 0.137 + cellR * 0.271;
  float inner = min(a / (seg * 0.5), fract(rc));
  float facet = smoothstep(0.0, edge + 0.001, inner);
  vec3 col = palette(fract(id) + source.g * colorShift * 0.2) * (0.6 + 0.9 * facet) * 1.8;
  vec3 blended = mix(source.rgb, col, intensity * smoothstep(0.0, 0.4, lum));
  return vec4(blended, source.a);
}
