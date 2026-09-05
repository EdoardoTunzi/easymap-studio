// NAME: Nebula Drift
uniform float speed; // @min -4.0 @max 4.0 @default 0.6
uniform float cloudScale; // @min 1.0 @max 20.0 @default 5.0
uniform float octaveGain; // @min 0.1 @max 0.9 @default 0.5
uniform float morphDepth; // @min 0.0 @max 10.0 @default 5.0
uniform float driftAmount; // @min 0.0 @max 5.0 @default 2.0
uniform float sampleRadius; // @min 0.5 @max 8.0 @default 3.5
uniform float density; // @min 0.5 @max 6.0 @default 2.0
uniform float colorFreq; // @min 0.1 @max 8.0 @default 2.0
uniform float blendAmount; // @min 0.0 @max 1.0 @default 0.85
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 nebulaColor; // @default 0.6,0.3,1.0

float sdLum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

vec2 sdSlope(sampler2D tex, vec2 uv, vec2 texel) {
  float l = sdLum(texture2D(tex, uv - vec2(texel.x, 0.0)).rgb);
  float r = sdLum(texture2D(tex, uv + vec2(texel.x, 0.0)).rgb);
  float d = sdLum(texture2D(tex, uv - vec2(0.0, texel.y)).rgb);
  float u = sdLum(texture2D(tex, uv + vec2(0.0, texel.y)).rgb);
  return vec2(r - l, u - d);
}

float sdHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float sdNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(sdHash(i), sdHash(i + vec2(1.0, 0.0)), u.x),
             mix(sdHash(i + vec2(0.0, 1.0)), sdHash(i + vec2(1.0, 1.0)), u.x), u.y);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec4 source = texture2D(tex, uv);
  if (length(source.rgb) <= blackThreshold) return source;

  vec2 texel = sampleRadius / resolution;
  vec2 slope = sdSlope(tex, uv, texel);
  float lum = sdLum(source.rgb);

  // la nube deriva lungo la pendenza: si accumula nei solchi e si assottiglia sulle creste,
  // come fumo che avvolge la superficie
  vec2 p = uv * cloudScale + slope * driftAmount * 4.0;
  p += vec2(time * speed * 0.1, -time * speed * 0.06);
  p += lum * morphDepth * 0.2;

  float fbm = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 5; i++) {
    fbm += sdNoise(p) * amp;
    norm += amp;
    p *= 2.02;
    amp *= octaveGain;
  }
  // normalizzato sulla somma delle ampiezze: senza, con octaveGain basso la nube resta quasi nera
  fbm /= max(norm, 0.001);

  float cloud = pow(clamp(fbm * 1.35, 0.0, 1.0), density);
  vec3 tint = 0.5 + 0.5 * cos(time * 0.3 + fbm * colorFreq * 6.0 + vec3(0.0, 0.4, 0.8) * 6.28318);
  vec3 col = nebulaColor * tint * cloud * (0.5 + lum * 1.2) * 1.7;

  source.rgb = mix(source.rgb, col + source.rgb * col, blendAmount);
  return source;
}
