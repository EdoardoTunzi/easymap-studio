// NAME: Radial Kaleido 7
uniform float seed; // @min 0.0 @max 100.0 @default 0.0
uniform float segments; // @min 2.0 @max 24.0 @default 12.0
uniform float rayPower; // @min 1.0 @max 20.0 @default 7.0
uniform float rayLength; // @min 0.2 @max 3.0 @default 1.2
uniform float core; // @min 0.0 @max 2.0 @default 0.8
uniform float flicker; // @min 0.0 @max 2.0 @default 0.6
uniform float swirlAmount; // @min 0.0 @max 2.0 @default 0.3
uniform float colorShift; // @min 0.0 @max 10.0 @default 3.0
uniform float hue; // @min 0.0 @max 1.0 @default 0.08
uniform float sat; // @min 0.0 @max 2.0 @default 1.0
uniform float intensity; // @min 0.0 @max 1.0 @default 0.85
uniform float speed; // @min 0.0 @max 3.0 @default 1.0

vec3 palette(float t) {
  vec3 base = vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(0.6, 0.35, 0.2) * t + vec3(0.05, 0.3, 0.6) + hue));
  return mix(vec3(dot(base, vec3(0.299, 0.587, 0.114))), base, sat);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float stime = time * speed + seed * 6.1;
  vec4 source = texture2D(tex, uv);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float r = length(p);
  float a = atan(p.y, p.x);
  a += swirlAmount * r * sin(stime * 0.5 + r * 3.0 + source.r * colorShift);
  // raggi: coseno elevato = lame sottili, la potenza li assottiglia senza cambiarne il numero
  float ray = pow(abs(cos(a * segments * 0.5)), rayPower);
  ray *= 1.0 + flicker * sin(a * segments + stime * 3.0);
  float fall = exp(-r / max(rayLength, 0.01));
  float pattern = clamp(ray * fall + core / (1.0 + r * r * 24.0), 0.0, 2.0);
  vec3 col = palette(pattern * 0.6 + r + source.g * colorShift * 0.2) * pattern * 2.0;
  vec3 blended = mix(source.rgb, col, intensity * smoothstep(0.0, 0.4, lum));
  return vec4(blended, source.a);
}
