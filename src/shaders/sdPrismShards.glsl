// NAME: Prism Shards
uniform float speed; // @min -6.0 @max 6.0 @default 1.0
uniform float shardScale; // @min 1.0 @max 40.0 @default 10.0
uniform float facetSharp; // @min 0.5 @max 8.0 @default 3.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 4.0
uniform float dispersion; // @min 0.0 @max 6.0 @default 2.0
uniform float sampleRadius; // @min 0.5 @max 8.0 @default 2.5
uniform float refractAmount; // @min 0.0 @max 4.0 @default 1.8
uniform float edgeGlow; // @min 0.0 @max 6.0 @default 2.0
uniform float blendAmount; // @min 0.0 @max 1.0 @default 0.85
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 prismColor; // @default 0.7,0.8,1.0

float sdLum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

vec2 sdSlope(sampler2D tex, vec2 uv, vec2 texel) {
  float l = sdLum(texture2D(tex, uv - vec2(texel.x, 0.0)).rgb);
  float r = sdLum(texture2D(tex, uv + vec2(texel.x, 0.0)).rgb);
  float d = sdLum(texture2D(tex, uv - vec2(0.0, texel.y)).rgb);
  float u = sdLum(texture2D(tex, uv + vec2(0.0, texel.y)).rgb);
  return vec2(r - l, u - d);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec4 source = texture2D(tex, uv);
  if (length(source.rgb) <= blackThreshold) return source;

  vec2 texel = sampleRadius / resolution;
  vec2 slope = sdSlope(tex, uv, texel);
  float lum = sdLum(source.rgb);

  // la pendenza fa da normale del prisma: i tre canali vengono rifratti di quantità diverse,
  // così i bordi del soggetto sfrangiano nei colori come vetro spesso
  vec2 refr = slope * refractAmount * 0.15;
  float rC = texture2D(tex, uv + refr * (1.0 + dispersion * 0.12)).r;
  float gC = texture2D(tex, uv + refr).g;
  float bC = texture2D(tex, uv + refr * (1.0 - dispersion * 0.12)).b;

  // sfaccettature: celle quantizzate spostate dalla quota
  vec2 p = uv * shardScale + slope * morphDepth;
  vec2 cell = floor(p);
  vec2 f = fract(p) - 0.5;
  float facet = pow(1.0 - max(abs(f.x), abs(f.y)) * 2.0, facetSharp);
  float tilt = 0.5 + 0.5 * sin(cell.x * 1.7 + cell.y * 2.3 + time * speed + lum * 6.0);

  float edge = clamp(length(slope) * 14.0, 0.0, 1.0);
  vec3 col = vec3(rC, gC, bC) * prismColor * (facet * tilt * 2.4 + edge * edgeGlow * 0.35);
  col += prismColor * edge * 0.18;
  col *= 0.7 + lum * 0.9;

  source.rgb = mix(source.rgb, col + source.rgb * col, blendAmount);
  return source;
}
