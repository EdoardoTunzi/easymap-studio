// NAME: Noise Animation - Lava
// nimitz (stormoid.com, Shadertoy lslXRS), licenza CC BY-NC-SA 3.0: uso non commerciale,
// attribuzione richiesta. iChannel0 (texture di rumore di Shadertoy) sostituito con value-noise
// procedurale (hash + interpolazione bilineare), come per "Noise Animation - Electric".
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float zoom; // @min 1.0 @max 8.0 @default 3.0
uniform float octaves; // @min 2.0 @max 8.0 @default 6.0
uniform float flowSpeed; // @min 0.0 @max 3.0 @default 1.0
uniform float displaceAmount; // @min 0.0 @max 2.0 @default 0.5
uniform float rotSpeed; // @min 0.0 @max 15.0 @default 6.0
uniform float advection; // @min 0.0 @max 0.98 @default 0.77
uniform float contrast; // @min 0.5 @max 3.0 @default 1.4
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 tint; // @default 0.2,0.07,0.01

mat2 nlMakem2(float theta) {
  float c = cos(theta);
  float s = sin(theta);
  return mat2(c, -s, s, c);
}

float nlHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float nlNoise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  float a = nlHash(i);
  float b = nlHash(i + vec2(1.0, 0.0));
  float c = nlHash(i + vec2(0.0, 1.0));
  float d = nlHash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

vec2 nlGradn(vec2 p) {
  float ep = 0.09;
  float gradx = nlNoise(vec2(p.x + ep, p.y)) - nlNoise(vec2(p.x - ep, p.y));
  float grady = nlNoise(vec2(p.x, p.y + ep)) - nlNoise(vec2(p.x, p.y - ep));
  return vec2(gradx, grady);
}

// flow noise: ogni ottava viene spostata da un campo vettoriale ruotato, invece che sommata
// direttamente come in un fbm classico
float nlFlow(vec2 p, float time) {
  float z = 2.0;
  float rz = 0.0;
  vec2 bp = p;
  for (int idx = 0; idx < 8; idx++) {
    if (float(idx) >= octaves) break;
    float i = float(idx) + 1.0;
    p += time * 0.6 * flowSpeed;
    bp += time * 1.9 * flowSpeed;

    vec2 gr = nlGradn(i * p * 0.34 + time);
    gr *= nlMakem2(time * rotSpeed - (0.05 * p.x + 0.03 * p.y) * 40.0);
    p += gr * displaceAmount;

    rz += (sin(nlNoise(p) * 7.0) * 0.5 + 0.5) / z;
    p = mix(bp, p, advection);

    z *= 1.4;
    p *= 2.0;
    bp *= 1.9;
  }
  return rz;
}

vec4 processColor(sampler2D tex, vec2 uv, float rawTime, vec2 resolution) {
  vec4 source = texture2D(tex, uv);
  if (length(source.rgb) > blackThreshold) {
    float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
    float time = rawTime * speed * 0.1;
    // la luminanza della sorgente spinge la fase del flow: la lava scorre diversa sulle zone chiare
    time += lum * morphDepth * 0.05;

    vec2 p = uv - 0.5;
    p.x *= resolution.x / resolution.y;
    p *= zoom;

    float rz = nlFlow(p, time);
    vec3 fx = tint / max(rz, 1e-4);
    fx = pow(abs(fx), vec3(contrast));
    source.rgb = mix(source.rgb, fx + source.rgb * fx, 0.85);
  }
  return source;
}
