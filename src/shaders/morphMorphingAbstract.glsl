// NAME: Morphing Abstract
// Frostbyte (Shadertoy sfsSDs), licenza CC-BY-NC-SA-4.0: uso non commerciale, attribuzione
// richiesta. Supersampling 2x2 interno dell'originale rimosso: l'Output di questo progetto ha
// già il proprio supersampling, raddoppiarlo qui costerebbe 4x il raymarch per pixel.
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform float detail; // @min 5.0 @max 40.0 @default 20.0
uniform float waveAmount; // @min 0.0 @max 3.0 @default 1.0
uniform float glow; // @min 0.3 @max 3.0 @default 1.0
uniform vec3 tint; // @default 1.0,1.0,1.0

vec2 masRotate(vec2 v, float t) {
  float s = sin(t);
  float c = cos(t);
  return mat2(c, -s, s, c) * v;
}

// ACES tonemap (Shadertoy Xc3yzM)
vec3 masACES(vec3 c) {
  mat3 m1 = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  mat3 m2 = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  vec3 v = m1 * c;
  vec3 num = v * (v + 0.0245786) - 0.000090537;
  vec3 den = v * (0.983729 * v + 0.4329510) + 0.238081;
  return m2 * (num / den);
}

// Xor's Dot Noise (Shadertoy wfsyRX)
float masNoise(vec3 p) {
  const float PHI = 1.618033988;
  const mat3 GOLD = mat3(
    -0.571464913, 0.814921382, 0.096597072,
    -0.278044873, -0.303026659, 0.911518454,
    0.772087367, 0.494042493, 0.399753815);
  return dot(cos(GOLD * p), sin(PHI * p * GOLD));
}

vec4 processColor(sampler2D tex, vec2 uv, float rawTime, vec2 resolution) {
  vec4 source = texture2D(tex, uv);
  if (length(source.rgb) > blackThreshold) {
    float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
    float t = rawTime * speed;

    vec2 u = uv * resolution;
    vec3 d = normalize(vec3(2.0 * u - resolution, resolution.y));

    vec3 p;
    // la luminanza spinge la profondità di partenza, come negli altri effetti Morph a raymarch
    p.z = -1.0 - 0.5 * sin(t * 0.1) + lum * morphDepth * 0.3;
    vec3 l = vec3(0.0);

    for (float i = 0.0; i < 10.0; i++) {
      vec3 b = p;
      b.xy = masRotate(sin(b.xy * 0.25), t * 0.5 + b.z * 2.0);
      float s = 0.001 + abs(masNoise(b * detail) / detail - masNoise(b)) * 0.7;
      s += abs(p.y * 0.2 + sin(p.z * 2.0 + abs(p.x) * 0.5)) * 0.5 * waveAmount;
      p += d * s;
      l += (1.0 + 1.5 * sin(i + length(p.xy * 0.1) + 2.0 + vec3(3.0, 1.5, 0.5))) / s;
    }

    vec3 fx = masACES(l * l * glow / 5e2) * tint;
    source.rgb = mix(source.rgb, fx + source.rgb * fx, 0.85);
  }
  return source;
}
