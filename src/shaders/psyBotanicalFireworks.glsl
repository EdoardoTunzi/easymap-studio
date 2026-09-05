// NAME: Botanical Fireworks
// Leon Denise 2021 ("taste of noise 7", Shadertoy NddSWs, licenza libera "hippie love
// conspiracy"). Hash di David Hoskins (CC BY-SA 4.0, shadertoy 4djSRW), smin/smoothing di Inigo
// Quilez, differenza delle normali di NuSan (shadertoy 3sBGzV).
//
// L'originale accumula il raymarch in un buffer con decadimento (`max(nuovo, precedente-0.01)`)
// per ammorbidire nel tempo il rumore che cambia a ogni frame, creando una scia organica. Qui non
// c'è un buffer persistente a piena risoluzione (solo la griglia fissa 320x320 usata dagli
// effetti Gray-Scott, non adatta a un raymarch 3D per pixel): il seme casuale viene invece
// aggiornato a `flickerRate` scatti al secondo invece che a ogni frame, per ridurre lo sfarfallio
// senza il buffer — resa più "a scatti" e meno vellutata dell'originale.
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float flickerRate; // @min 0.0 @max 10.0 @default 3.0
uniform float gridSize; // @min 2.0 @max 10.0 @default 5.0
uniform float iterations; // @min 2.0 @max 6.0 @default 4.0
uniform float zoom; // @min 0.5 @max 3.0 @default 1.0
uniform float brightness; // @min 0.3 @max 3.0 @default 1.0
uniform vec3 colorPhase; // @default 3.0,2.0,1.0
uniform vec3 lightTint; // @default 1.0,1.0,1.0

float bfMaterial;
float bfRng;

float bfHash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

float bfSmin(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}

float bfSmoothing(float d1, float d2, float k) {
  return clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
}

mat2 bfRot(float a) {
  return mat2(cos(a), -sin(a), sin(a), cos(a));
}

vec3 bfRepeat(vec3 p, float r) {
  return mod(p, r) - r * 0.5;
}

// IFS caleidoscopica: sfere ripiegate e ruotate ricorsivamente, fuse con smin
float bfMap(vec3 p, float time) {
  float t = time + bfRng * 0.9;
  vec3 cell = floor(p / gridSize);
  p = bfRepeat(p, gridSize);
  float dp = length(p);
  vec3 angle = vec3(0.1, -0.5, 0.1) + dp * 0.5 + p * 0.1 + cell;
  float size = sin(bfRng * 3.14);
  float wave = sin(-dp + t + bfHash13(cell) * 6.28) * 0.5;

  int count = int(iterations);
  float a = 1.0;
  float scene = 1000.0;
  float shape = 1000.0;
  for (int index = 0; index < 6; index++) {
    if (index >= count) break;
    p.xz = abs(p.xz) - (0.5 + wave) * a;
    p.xz *= bfRot(angle.y / a);
    p.yz *= bfRot(angle.x / a);
    p.yx *= bfRot(angle.z / a);
    shape = length(p) - 0.2 * a * size;
    bfMaterial = mix(bfMaterial, float(index), bfSmoothing(shape, scene, 0.3 * a));
    scene = bfSmin(scene, shape, a);
    a /= 1.9;
  }
  return scene;
}

vec4 processColor(sampler2D tex, vec2 uv, float rawTime, vec2 resolution) {
  float time = rawTime * speed;
  bfMaterial = 0.0;

  vec2 su = (uv - 0.5) * resolution / resolution.y / zoom;
  vec3 eye = vec3(1.0, 1.0, 1.0);
  vec3 at = vec3(0.0);
  vec3 fwd = normalize(at - eye);
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, fwd);
  vec3 ray = normalize(fwd + su.x * right + su.y * up);
  vec3 pos = eye;

  // seme rng a scatti discreti nel tempo invece che a ogni frame (vedi nota sul buffer sopra)
  float rate = max(flickerRate, 0.001);
  float seedTime = floor(time * rate) / rate;
  bfRng = bfHash13(vec3(uv * resolution, seedTime));

  const float STEPS = 30.0;
  float index = STEPS;
  for (; index > 0.0; index -= 1.0) {
    float dist = bfMap(pos, time);
    if (dist < 0.01) break;
    dist *= 0.9 + 0.1 * bfRng;
    pos += ray * dist;
  }
  float shade = index / STEPS;

  vec2 off = vec2(0.001, 0.0);
  float centerD = bfMap(pos, time);
  vec3 normal = normalize(vec3(
    centerD - bfMap(pos - off.xyy, time),
    centerD - bfMap(pos - off.yxy, time),
    centerD - bfMap(pos - off.yyx, time)
  ));

  vec3 tint = 0.5 + 0.5 * cos(colorPhase + bfMaterial * 0.5 + length(pos) * 0.5);

  float ld = dot(reflect(ray, normal), vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
  vec3 light = vec3(1.000, 0.502, 0.502) * sqrt(max(ld, 0.0));
  ld = dot(reflect(ray, normal), vec3(0.0, 0.0, -1.0)) * 0.5 + 0.5;
  light += vec3(0.400, 0.714, 0.145) * sqrt(max(ld, 0.0)) * 0.5;
  light *= lightTint;

  vec3 col = (tint + light) * shade * brightness;
  return vec4(col, 1.0);
}
