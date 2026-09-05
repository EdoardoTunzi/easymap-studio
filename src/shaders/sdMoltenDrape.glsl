// NAME: Molten Drape
uniform float speed; // @min -6.0 @max 6.0 @default 1.2
uniform float flowScale; // @min 1.0 @max 30.0 @default 8.0
uniform float dripAmount; // @min 0.0 @max 4.0 @default 1.5
uniform float morphDepth; // @min 0.0 @max 10.0 @default 4.0
uniform float sampleRadius; // @min 0.5 @max 8.0 @default 3.0
uniform float lightAngle; // @min 0.0 @max 6.28 @default 4.2
uniform float specular; // @min 0.0 @max 6.0 @default 2.5
uniform float heatSpread; // @min 0.1 @max 6.0 @default 2.0
uniform float blendAmount; // @min 0.0 @max 1.0 @default 0.85
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 hotColor; // @default 1.0,0.65,0.15
uniform vec3 coolColor; // @default 0.15,0.05,0.35

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

  // il materiale cola verso il basso ma viene deviato dalla pendenza: sembra colare SUL soggetto
  vec2 drip = uv;
  drip.y += time * speed * 0.05;
  drip -= slope * dripAmount;

  float wave = sin(drip.y * flowScale + lum * morphDepth * 2.0)
             * cos(drip.x * flowScale * 0.7 - time * speed * 0.4);
  float molten = 0.5 + 0.5 * wave;

  vec2 lightDir = vec2(cos(lightAngle), sin(lightAngle));
  vec2 n = sdNormalize(slope, vec2(0.0, 1.0));
  float spec = pow(clamp(dot(n, lightDir), 0.0, 1.0), 1.0 + specular) * specular;

  float heat = clamp(pow(molten, heatSpread) + spec * 0.4, 0.0, 1.0);
  vec3 col = mix(coolColor, hotColor, heat);
  col *= 0.35 + lum * 0.9;

  source.rgb = mix(source.rgb, col + source.rgb * col, blendAmount);
  return source;
}
