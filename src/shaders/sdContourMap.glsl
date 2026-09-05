// NAME: Contour Map
uniform float speed; // @min -6.0 @max 6.0 @default 1.0
uniform float levels; // @min 2.0 @max 40.0 @default 14.0
uniform float thickness; // @min 0.01 @max 0.6 @default 0.12
uniform float morphDepth; // @min 0.0 @max 10.0 @default 4.0
uniform float warpAmount; // @min 0.0 @max 3.0 @default 0.8
uniform float sampleRadius; // @min 0.5 @max 8.0 @default 2.0
uniform float glow; // @min 0.0 @max 4.0 @default 1.4
uniform float colorFreq; // @min 0.1 @max 8.0 @default 3.0
uniform float blendAmount; // @min 0.0 @max 1.0 @default 0.85
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 lineColor; // @default 0.1,1.0,0.7
uniform vec3 fieldColor; // @default 0.5,0.1,0.9

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

  // ricampiona spostandosi lungo la pendenza: le isoipse si gonfiano dove l'oggetto sale
  vec2 warped = uv + slope * warpAmount;
  float height = sdLum(texture2D(tex, warped).rgb) * morphDepth;

  // curve di livello: bande a quota costante che scorrono nel tempo
  float band = fract(height * levels - time * speed * 0.5);
  float line = 1.0 - smoothstep(0.0, thickness, abs(band - 0.5) * 2.0 - (1.0 - thickness));
  line = clamp(line, 0.0, 1.0);

  // la ripidità decide quanto la linea brilla: i bordi netti dell'oggetto si accendono
  float steep = clamp(length(slope) * 12.0, 0.0, 1.0);

  vec3 tint = 0.5 + 0.5 * cos(time * 0.3 + height * colorFreq * 4.0 + vec3(0.0, 0.35, 0.7) * 6.28318);
  vec3 col = mix(fieldColor * 0.25, lineColor * tint, line) * (0.35 + steep * glow);

  source.rgb = mix(source.rgb, col + source.rgb * col, blendAmount);
  return source;
}
