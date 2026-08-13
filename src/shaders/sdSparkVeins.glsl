// NAME: SD Spark Veins
uniform float speed; // @min -8.0 @max 8.0 @default 2.5
uniform float veinDensity; // @min 2.0 @max 60.0 @default 22.0
uniform float veinSharp; // @min 1.0 @max 12.0 @default 5.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.5
uniform float edgeBoost; // @min 0.0 @max 20.0 @default 8.0
uniform float sampleRadius; // @min 0.5 @max 8.0 @default 2.0
uniform float branchWarp; // @min 0.0 @max 4.0 @default 1.5
uniform float flicker; // @min 0.0 @max 1.0 @default 0.4
uniform float blendAmount; // @min 0.0 @max 1.0 @default 0.85
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 sparkColor; // @default 0.4,0.8,1.0

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

  // le vene corrono lungo i solchi: dove la pendenza è ripida la corrente si concentra
  float steep = clamp(length(slope) * edgeBoost, 0.0, 1.0);

  vec2 p = uv + vec2(-slope.y, slope.x) * branchWarp;
  float w1 = sin(p.x * veinDensity + lum * morphDepth * 4.0 + time * speed);
  float w2 = sin(p.y * veinDensity * 0.8 - lum * morphDepth * 3.0 - time * speed * 0.7);
  float web = abs(w1 * w2);
  float vein = pow(1.0 - web, veinSharp);

  // scintillio irregolare, più marcato sulle creste
  float spark = mix(1.0, 0.5 + 0.5 * sin(time * speed * 6.0 + lum * 40.0), flicker);

  vec3 col = sparkColor * vein * spark * (0.25 + steep);
  col += sparkColor * steep * 0.15;

  source.rgb = mix(source.rgb, col + source.rgb * col, blendAmount);
  return source;
}
