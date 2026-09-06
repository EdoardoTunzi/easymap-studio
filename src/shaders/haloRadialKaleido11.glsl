// NAME: Radial Kaleido 11
uniform float seed; // @min 0.0 @max 100.0 @default 0.0
uniform float segments; // @min 2.0 @max 20.0 @default 8.0
uniform float rings; // @min 1.0 @max 24.0 @default 10.0
uniform float lineWidth; // @min 0.02 @max 0.6 @default 0.12
uniform float weave; // @min 0.0 @max 2.0 @default 0.8
uniform float swirlAmount; // @min 0.0 @max 2.0 @default 0.4
uniform float glow; // @min 0.0 @max 2.0 @default 0.5
uniform float colorShift; // @min 0.0 @max 10.0 @default 3.0
uniform float hue; // @min 0.0 @max 1.0 @default 0.3
uniform float sat; // @min 0.0 @max 2.0 @default 1.0
uniform float intensity; // @min 0.0 @max 1.0 @default 0.85
uniform float speed; // @min 0.0 @max 3.0 @default 1.0

vec3 palette(float t) {
  vec3 base = vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(0.4, 0.4, 0.5) * t + vec3(0.25, 0.5, 0.85) + hue));
  return mix(vec3(dot(base, vec3(0.299, 0.587, 0.114))), base, sat);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float stime = time * speed + seed * 2.7;
  vec4 source = texture2D(tex, uv);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float r = length(p);
  float a = atan(p.y, p.x);
  float sg = 6.28318 / segments;
  a = abs(mod(a, sg) - sg * 0.5);
  a += swirlAmount * r * sin(stime * 0.5 + r * 3.0 + source.r * colorShift);
  // filigrana: si tiene solo la cresta della sinusoide, il resto e' vuoto
  float radial = abs(sin(a * 6.0 + r * rings - stime * 1.5));
  float circular = abs(sin(r * rings * weave - stime + source.b * colorShift * 0.3));
  float line = (1.0 - smoothstep(0.0, lineWidth, radial)) + weave * (1.0 - smoothstep(0.0, lineWidth, circular));
  line = clamp(line, 0.0, 1.5);
  vec3 col = palette(r + line * 0.4 + source.g * colorShift * 0.2) * (line * 2.0 + glow * line * line);
  vec3 blended = mix(source.rgb, col, intensity * smoothstep(0.0, 0.4, lum));
  return vec4(blended, source.a);
}
