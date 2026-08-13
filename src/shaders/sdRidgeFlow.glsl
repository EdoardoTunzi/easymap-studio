// NAME: SD Ridge Flow
uniform float speed; // @min -6.0 @max 6.0 @default 1.5
uniform float ridgeDensity; // @min 2.0 @max 60.0 @default 18.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float flowAmount; // @min 0.0 @max 4.0 @default 1.2
uniform float sampleRadius; // @min 0.5 @max 8.0 @default 2.0
uniform float lightAngle; // @min 0.0 @max 6.28 @default 2.2
uniform float relief; // @min 0.0 @max 4.0 @default 1.5
uniform float colorFreq; // @min 0.1 @max 8.0 @default 2.0
uniform float blendAmount; // @min 0.0 @max 1.0 @default 0.85
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 ridgeColor; // @default 0.3,0.9,1.0

float sdLum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// Pendenza locale della luminanza: è la direzione in cui l'oggetto "sale".
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

  // le creste scorrono LUNGO le isoipse (perpendicolari alla pendenza): avvolgono il rilievo
  vec2 along = vec2(-slope.y, slope.x);
  vec2 p = uv + along * flowAmount;
  float phase = (p.x + p.y) * ridgeDensity + lum * morphDepth * 3.0 - time * speed;
  float ridge = pow(0.5 + 0.5 * sin(phase), 2.0);

  vec2 lightDir = vec2(cos(lightAngle), sin(lightAngle));
  float shade = clamp(0.5 + dot(sdNormalize(slope, vec2(0.0, 1.0)), lightDir) * relief, 0.0, 1.0);

  vec3 col = 0.5 + 0.5 * cos(time * 0.4 + lum * colorFreq * 6.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
  col *= ridgeColor * ridge * (0.4 + shade);

  source.rgb = mix(source.rgb, col + source.rgb * col, blendAmount);
  return source;
}
