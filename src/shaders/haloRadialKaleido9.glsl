// NAME: Radial Kaleido 9
uniform float seed; // @min 0.0 @max 100.0 @default 0.0
uniform float segments; // @min 2.0 @max 16.0 @default 6.0
uniform float warp; // @min 0.0 @max 1.5 @default 0.5
uniform float noiseScale; // @min 0.5 @max 8.0 @default 2.5
uniform float flow; // @min 0.0 @max 3.0 @default 1.0
uniform float rings; // @min 1.0 @max 20.0 @default 7.0
uniform float smear; // @min 0.0 @max 1.0 @default 0.4
uniform float colorShift; // @min 0.0 @max 10.0 @default 3.0
uniform float hue; // @min 0.0 @max 1.0 @default 0.55
uniform float sat; // @min 0.0 @max 2.0 @default 1.0
uniform float intensity; // @min 0.0 @max 1.0 @default 0.85
uniform float speed; // @min 0.0 @max 3.0 @default 1.0

vec3 palette(float t) {
  vec3 base = vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(0.35, 0.3, 0.55) * t + vec3(0.1, 0.45, 0.65) + hue));
  return mix(vec3(dot(base, vec3(0.299, 0.587, 0.114))), base, sat);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float stime = time * speed + seed * 3.3;
  vec4 source = texture2D(tex, uv);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  // il dominio si deforma PRIMA della piega: la simmetria resta, i bordi diventano liquidi
  vec2 n = vec2(vnoise(p * noiseScale + stime * flow * 0.2),
                vnoise(p * noiseScale - stime * flow * 0.15 + 5.2));
  p += (n - 0.5) * warp * (1.0 + smear * lum);
  float r = length(p);
  float a = atan(p.y, p.x);
  float sg = 6.28318 / segments;
  a = abs(mod(a, sg) - sg * 0.5);
  float pattern = 0.5 + 0.5 * sin(a * 6.0 + r * rings - stime * 1.5 + source.r * colorShift);
  vec3 col = palette(pattern + r + n.x * 0.3 + source.g * colorShift * 0.2) * pow(pattern, 2.0) * 2.0;
  vec3 blended = mix(source.rgb, col, intensity * smoothstep(0.0, 0.4, lum));
  return vec4(blended, source.a);
}
