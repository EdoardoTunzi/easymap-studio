// NAME: Lightning Web
uniform float speed; // @min -10.0 @max 10.0 @default 2.0
uniform float branches; // @min 1.0 @max 12.0 @default 5.0
uniform float sharpness; // @min 1.0 @max 12.0 @default 5.0
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 boltColor; // @default 0.6,0.9,1.0
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
vec2 p = (uv - 0.5) * 3.0;
float t = time * speed * 0.5;
// somma di scariche: ogni ramo e' una linea di noise che si spezza sul rilievo
float acc = 0.0;
for (int i = 0; i < 12; i++) {
  if (float(i) >= branches) break;
  float fi = float(i);
  float n = mnoise(vec2(p.x * 2.0 + fi * 7.3, t + fi)) - 0.5;
  float target = n * 1.2 + lum * morphDepth * 0.2;
  float d = abs(p.y - target + (fi - branches * 0.5) * 0.35);
  acc += pow(max(1.0 - d * 6.0, 0.0), sharpness);
}
float flicker = 0.6 + 0.4 * mnoise(vec2(t * 6.0, 0.0));
vec3 psyColor = 0.5 + 0.5 * cos(t + acc * colorFreq * 2.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= boltColor;
vec3 fx = psyColor * acc * flicker + psyColor * 0.1;
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
