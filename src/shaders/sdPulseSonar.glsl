// NAME: SD Pulse Sonar
uniform float speed; // @min -6.0 @max 6.0 @default 1.6
uniform float pulseRate; // @min 0.5 @max 12.0 @default 3.0
uniform float waveLength; // @min 1.0 @max 40.0 @default 12.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 6.0
uniform float echoAmount; // @min 0.0 @max 4.0 @default 1.5
uniform float sampleRadius; // @min 0.5 @max 8.0 @default 3.0
uniform float rippleWidth; // @min 0.5 @max 8.0 @default 3.0
uniform float crestBias; // @min 0.0 @max 1.0 @default 0.5
uniform float blendAmount; // @min 0.0 @max 1.0 @default 0.85
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 sonarColor; // @default 0.1,1.0,0.9

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

  // le onde nascono dalle creste dell'oggetto (non da un centro fisso) e si propagano
  // verso il basso della pendenza: sembrano emesse dalla superficie stessa
  float steep = length(slope);
  float emitter = mix(lum, steep * 8.0, crestBias);
  float travel = emitter * morphDepth - time * speed;

  float ripple = sin(travel * waveLength - time * pulseRate);
  float band = pow(clamp(ripple, 0.0, 1.0), rippleWidth);

  // eco secondaria sfasata, che dà profondità al fronte d'onda
  float echoWave = sin(travel * waveLength * 0.5 - time * pulseRate * 0.6 + 1.57);
  float echo = pow(clamp(echoWave, 0.0, 1.0), rippleWidth + 2.0) * echoAmount * 0.3;

  vec3 col = sonarColor * (band + echo);
  col *= 0.35 + clamp(steep * 10.0, 0.0, 1.0) * 0.9;

  source.rgb = mix(source.rgb, col + source.rgb * col, blendAmount);
  return source;
}
