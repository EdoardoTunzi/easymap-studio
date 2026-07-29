// NAME: Morph Liquid Dunes
uniform float speed; // @min -10.0 @max 10.0 @default 1.5
uniform float scale; // @min 1.0 @max 16.0 @default 5.0
uniform float relief; // @min 0.5 @max 8.0 @default 3.0
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 duneColor; // @default 1.0,0.75,0.35
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
vec2 p = uv * scale;
float t = time * speed * 0.2;
// campo di altezza: noise sommato al rilievo dell'asset
float h = mnoise(p + vec2(t, 0.0)) * 0.6 + mnoise(p * 2.0 - t) * 0.3 + lum * morphDepth * 0.2;
// creste: linee dove il campo attraversa i livelli
float crest = pow(abs(sin(h * 6.28318 * relief)), 4.0);
vec3 psyColor = 0.5 + 0.5 * cos(t + h * colorFreq * 6.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= duneColor;
vec3 fx = psyColor * crest + psyColor * h * 0.4;
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
