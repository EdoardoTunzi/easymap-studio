// NAME: SD Relief Lattice
uniform float speed; // @min -6.0 @max 6.0 @default 1.0
uniform float cells; // @min 2.0 @max 60.0 @default 16.0
uniform float barWidth; // @min 0.02 @max 0.6 @default 0.14
uniform float morphDepth; // @min 0.0 @max 10.0 @default 4.0
uniform float skew; // @min 0.0 @max 3.0 @default 1.0
uniform float sampleRadius; // @min 0.5 @max 8.0 @default 2.5
uniform float lightAngle; // @min 0.0 @max 6.28 @default 1.0
uniform float relief; // @min 0.0 @max 4.0 @default 2.0
uniform float pulse; // @min 0.0 @max 6.0 @default 2.0
uniform float blendAmount; // @min 0.0 @max 1.0 @default 0.85
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 latticeColor; // @default 1.0,0.55,0.15

float sdLum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

vec2 sdSlope(sampler2D tex, vec2 uv, vec2 texel) {
  float l = sdLum(texture2D(tex, uv - vec2(texel.x, 0.0)).rgb);
  float r = sdLum(texture2D(tex, uv + vec2(texel.x, 0.0)).rgb);
  float d = sdLum(texture2D(tex, uv - vec2(0.0, texel.y)).rgb);
  float u = sdLum(texture2D(tex, uv + vec2(0.0, texel.y)).rgb);
  return vec2(r - l, u - d);
}

vec2 sdNormalize(vec2 v, vec2 fallback) {
  float len = length(v);
  return len > 0.0001 ? v / len : fallback;
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec4 source = texture2D(tex, uv);
  if (length(source.rgb) <= blackThreshold) return source;

  vec2 texel = sampleRadius / resolution;
  vec2 slope = sdSlope(tex, uv, texel);
  float lum = sdLum(source.rgb);

  // la griglia viene inclinata dalla pendenza: le maglie si stirano sui fianchi del soggetto
  vec2 g = uv;
  g += slope * skew;
  g.x += lum * morphDepth * 0.08;
  g *= cells;

  vec2 f = abs(fract(g) - 0.5);
  float bar = 1.0 - smoothstep(0.5 - barWidth, 0.5, max(f.x, f.y));

  // ogni maglia respira con una fase legata alla quota locale
  float breathe = 0.6 + 0.4 * sin(time * pulse + lum * 8.0);

  vec2 lightDir = vec2(cos(lightAngle), sin(lightAngle));
  float shade = clamp(0.5 + dot(sdNormalize(slope, vec2(0.0, 1.0)), lightDir) * relief, 0.0, 1.0);

  vec3 col = latticeColor * bar * breathe * (0.3 + shade);
  col += latticeColor * 0.06 * lum;

  source.rgb = mix(source.rgb, col + source.rgb * col, blendAmount);
  return source;
}
