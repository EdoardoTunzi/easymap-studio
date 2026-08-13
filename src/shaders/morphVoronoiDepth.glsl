// NAME: Morph Voronoi Depth
uniform float speed; // @min -10.0 @max 10.0 @default 1.5
uniform float density; // @min 2.0 @max 24.0 @default 8.0
uniform float edge; // @min 0.01 @max 0.5 @default 0.12
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.5
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 cellColor; // @default 0.2,1.0,0.6
vec2 mhash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
// la densita' delle celle segue il rilievo: piu' fitte sulle zone chiare
vec2 p = uv * density * (1.0 + lum * morphDepth * 0.08);
vec2 g = floor(p), f = fract(p);
float md = 8.0;
vec2 mp = vec2(0.0);
for (int j = -1; j <= 1; j++) {
  for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i), float(j));
    vec2 r = o + 0.5 + 0.45 * sin(time * speed * 0.4 + 6.28318 * mhash2(g + o)) - f;
    float d = dot(r, r);
    if (d < md) { md = d; mp = g + o; }
  }
}
float cell = smoothstep(0.0, edge, sqrt(md));
vec3 psyColor = 0.5 + 0.5 * cos(time * 0.5 + mhash2(mp).x * colorFreq * 6.0 + lum * 3.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= cellColor;
vec3 fx = psyColor * cell + psyColor * 0.12;
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
