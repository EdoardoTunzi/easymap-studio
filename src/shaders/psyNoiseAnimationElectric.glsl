// NAME: Noise Animation - Electric
// nimitz (stormoid.com, Shadertoy ldlXRS), licenza CC BY-NC-SA 3.0: uso non commerciale,
// attribuzione richiesta. iChannel0 (texture di rumore di Shadertoy) sostituito con value-noise
// procedurale (hash + interpolazione bilineare): non disponibile nel motore, ma la turbolenza
// dell'fbm ne risulta praticamente identica.
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float zoom; // @min 1.0 @max 10.0 @default 4.0
uniform float warpAmount; // @min 0.0 @max 3.0 @default 1.0
uniform float octaves; // @min 2.0 @max 8.0 @default 5.0
uniform float ringFreq; // @min 1.0 @max 10.0 @default 4.0
uniform float pulseSpeed; // @min 0.0 @max 20.0 @default 10.0
uniform float brightness; // @min 0.3 @max 3.0 @default 1.0
uniform vec3 tint; // @default 0.2,0.1,0.4

mat2 ecMakem2(float theta) {
  float c = cos(theta);
  float s = sin(theta);
  return mat2(c, -s, s, c);
}

float ecHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float ecNoise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  float a = ecHash(i);
  float b = ecHash(i + vec2(1.0, 0.0));
  float c = ecHash(i + vec2(0.0, 1.0));
  float d = ecHash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float ecFbm(vec2 p) {
  float z = 2.0;
  float rz = 0.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= octaves) break;
    rz += abs((ecNoise(p) - 0.5) * 2.0) / z;
    z *= 2.0;
    p *= 2.0;
  }
  return rz;
}

// due fbm ruotati che spostano il dominio l'uno dell'altro (domain warping), poi un terzo fbm
// campiona il dominio spostato e ruotato nel tempo
float ecDualfbm(vec2 p, float t) {
  vec2 p2 = p * 0.7;
  vec2 basis = vec2(ecFbm(p2 - t * 1.6), ecFbm(p2 + t * 1.7));
  basis = (basis - 0.5) * 0.2 * warpAmount;
  p += basis;
  return ecFbm(p * ecMakem2(t * 0.2));
}

float ecCirc(vec2 p, float freq) {
  float r = length(p);
  r = log(sqrt(max(r, 1e-6)));
  return abs(mod(r * freq, 6.2831853) - 3.14159) * 3.0 + 0.2;
}

vec4 processColor(sampler2D tex, vec2 uv, float rawTime, vec2 resolution) {
  float t = rawTime * speed * 0.15;
  vec2 p = uv - 0.5;
  p.x *= resolution.x / resolution.y;
  p *= zoom;

  float rz = ecDualfbm(p, t);

  p /= exp(mod(t * pulseSpeed, 3.14159));
  rz *= pow(abs(0.1 - ecCirc(p, ringFreq)), 0.9);

  vec3 col = tint / max(rz, 1e-4);
  col = pow(abs(col), vec3(0.99)) * brightness;
  return vec4(col, 1.0);
}
