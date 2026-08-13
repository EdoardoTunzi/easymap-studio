// NAME: SD Silk Weave
uniform float speed; // @min -6.0 @max 6.0 @default 0.8
uniform float threads; // @min 2.0 @max 80.0 @default 26.0
uniform float weaveDepth; // @min 0.0 @max 2.0 @default 0.6
uniform float morphDepth; // @min 0.0 @max 10.0 @default 4.5
uniform float drapeAmount; // @min 0.0 @max 4.0 @default 1.6
uniform float sampleRadius; // @min 0.5 @max 8.0 @default 3.0
uniform float lightAngle; // @min 0.0 @max 6.28 @default 0.8
uniform float sheen; // @min 0.0 @max 6.0 @default 2.2
uniform float blendAmount; // @min 0.0 @max 1.0 @default 0.85
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 warpColor; // @default 0.9,0.2,0.5
uniform vec3 weftColor; // @default 0.2,0.7,1.0

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

  // il tessuto si adagia sul soggetto: trama e ordito vengono tirati dalla pendenza
  vec2 p = uv + slope * drapeAmount;
  float lift = lum * morphDepth * 0.5;

  float warpThread = 0.5 + 0.5 * sin(p.x * threads + lift + time * speed);
  float weftThread = 0.5 + 0.5 * sin(p.y * threads - lift + time * speed * 0.6);

  // intreccio: sopra/sotto alternati come in un tessuto reale
  float over = step(warpThread, weftThread);
  float fiber = mix(pow(warpThread, 1.0 + weaveDepth * 4.0), pow(weftThread, 1.0 + weaveDepth * 4.0), over);

  vec2 lightDir = vec2(cos(lightAngle), sin(lightAngle));
  float gloss = pow(clamp(dot(sdNormalize(slope, vec2(0.0, 1.0)), lightDir), 0.0, 1.0), 1.0 + sheen) * sheen;

  vec3 col = mix(warpColor, weftColor, over) * fiber * (0.35 + lum * 0.8 + gloss * 0.3);

  source.rgb = mix(source.rgb, col + source.rgb * col, blendAmount);
  return source;
}
