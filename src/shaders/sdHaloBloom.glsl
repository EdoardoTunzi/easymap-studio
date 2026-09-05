// NAME: Halo Bloom
uniform float speed; // @min -6.0 @max 6.0 @default 1.4
uniform float rings; // @min 1.0 @max 40.0 @default 12.0
uniform float ringSharp; // @min 0.5 @max 8.0 @default 2.5
uniform float morphDepth; // @min 0.0 @max 10.0 @default 5.0
uniform float bloomSpread; // @min 0.0 @max 4.0 @default 1.2
uniform float sampleRadius; // @min 0.5 @max 8.0 @default 3.0
uniform float centerX; // @min 0.0 @max 1.0 @default 0.5
uniform float centerY; // @min 0.0 @max 1.0 @default 0.5
uniform float colorFreq; // @min 0.1 @max 8.0 @default 2.5
uniform float blendAmount; // @min 0.0 @max 1.0 @default 0.85
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 haloColor; // @default 1.0,0.3,0.8

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

  // gli anelli partono dal centro scelto, ma il raggio è "sollevato" dalla quota del soggetto:
  // le onde salgono sui rilievi invece di attraversarli piatte
  vec2 p = uv - vec2(centerX, centerY);
  p += slope * bloomSpread;
  p.x *= resolution.x / resolution.y;

  float radius = length(p) + lum * morphDepth * 0.12;
  float wave = fract(radius * rings - time * speed * 0.4);
  float ring = pow(1.0 - abs(wave * 2.0 - 1.0), ringSharp);

  vec3 tint = 0.5 + 0.5 * cos(time * 0.5 + radius * colorFreq * 6.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
  vec3 col = haloColor * tint * ring * 1.7;
  col += haloColor * 0.14 * lum;

  source.rgb = mix(source.rgb, col + source.rgb * col, blendAmount);
  return source;
}
