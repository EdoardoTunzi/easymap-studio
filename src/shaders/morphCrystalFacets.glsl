// NAME: Morph Crystal Facets
uniform float speed; // @min -10.0 @max 10.0 @default 1.0
uniform float facets; // @min 2.0 @max 24.0 @default 8.0
uniform float sharpness; // @min 0.5 @max 8.0 @default 3.0
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 crystalColor; // @default 0.5,0.8,1.0
vec2 mhash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = (uv - 0.5) * facets;
// i semi si spostano con la luminanza: le faccette si rompono sui rilievi
vec2 g = floor(p), f = fract(p);
float f1 = 8.0, f2 = 8.0;
for (int j = -1; j <= 1; j++) {
  for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i), float(j));
    vec2 h = mhash2(g + o);
    vec2 c = o + 0.5 + 0.4 * sin(time * speed * 0.3 + 6.28318 * h + lum * morphDepth) - f;
    float d = length(c);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
  }
}
float facet = pow(clamp(f2 - f1, 0.0, 1.0), 1.0 / sharpness);
vec3 psyColor = 0.5 + 0.5 * cos(time * 0.5 + (f2 - f1) * colorFreq * 8.0 + lum * 3.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= crystalColor;
vec3 fx = psyColor * (1.0 - facet) + psyColor * 0.15;
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
