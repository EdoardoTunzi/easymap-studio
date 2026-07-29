// NAME: Morph Aurora Depth
uniform float speed; // @min -10.0 @max 10.0 @default 1.0
uniform float veils; // @min 1.0 @max 10.0 @default 4.0
uniform float waviness; // @min 0.0 @max 3.0 @default 1.0
uniform float softness; // @min 0.02 @max 0.6 @default 0.18
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 auroraColor; // @default 0.3,1.0,0.6
float mhash1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mhash1(i), mhash1(i + vec2(1.0, 0.0)), u.x),
             mix(mhash1(i + vec2(0.0, 1.0)), mhash1(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
float t = time * speed * 0.3;
vec3 acc = vec3(0.0);
for (int i = 0; i < 10; i++) {
  if (float(i) >= veils) break;
  float fi = float(i);
  float offset = fi / max(veils, 1.0);
  // ogni velo e' spinto in alto dal rilievo dell'asset
  float wob = mnoise(vec2(uv.x * 2.5 + fi * 3.1, t + fi)) - 0.5;
  float center = 0.5 + (offset - 0.5) * 0.7 + wob * waviness - lum * morphDepth * 0.04;
  float veil = smoothstep(softness, 0.0, abs(uv.y - center));
  veil *= 0.5 + 0.5 * mnoise(vec2(uv.x * 16.0 + fi * 7.0, t * 2.0));
  vec3 psyColor = 0.5 + 0.5 * cos(t + offset * colorFreq * 4.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
  acc += psyColor * veil;
}
vec3 psyColor = auroraColor;
vec3 fx = acc * auroraColor / max(veils * 0.4, 1.0) * 1.6;
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
