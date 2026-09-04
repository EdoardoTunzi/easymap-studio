// NAME: Fractal Pyramid
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float orbitSpeed; // @min 0.0 @max 3.0 @default 1.0
uniform float camDist; // @min 15.0 @max 90.0 @default 50.0
uniform float fov; // @min 1.0 @max 8.0 @default 3.0
uniform float scale; // @min 0.3 @max 3.0 @default 1.0
uniform float fold; // @min 0.2 @max 1.0 @default 0.5
uniform float iterations; // @min 2.0 @max 12.0 @default 8.0
uniform float glow; // @min 0.3 @max 3.0 @default 1.0
uniform vec3 colorA; // @default 0.2,0.7,0.9
uniform vec3 colorB; // @default 1.0,0.0,1.0

vec3 fracPalette(float d) {
  return mix(colorA, colorB, clamp(d, 0.0, 1.0));
}

vec2 fracRotate(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return p * mat2(c, s, -s, c);
}

// stima di distanza pseudo-L1 (dot(sign(p),p)) su un punto ripiegato ricorsivamente:
// lo stesso trucco dell'originale Shadertoy, non una SDF esatta ma abbastanza stabile per il raymarch
float fracMap(vec3 p, float time) {
  for (int i = 0; i < 12; i++) {
    if (float(i) >= iterations) break;
    float t = time * 0.2 * speed;
    p.xz = fracRotate(p.xz, t);
    p.xy = fracRotate(p.xy, t * 1.89);
    p.xz = abs(p.xz);
    p.xz -= fold;
  }
  return dot(sign(p), p) / 5.0;
}

vec4 fracRaymarch(vec3 ro, vec3 rd, float time) {
  float t = 0.0;
  vec3 col = vec3(0.0);
  float d = 0.0;
  for (float i = 0.0; i < 64.0; i++) {
    vec3 p = ro + rd * t;
    // marciare nello spazio scalato e dividere il passo per `scale` tiene il raymarch stabile
    // qualunque sia la taglia apparente del frattale
    d = fracMap(p * scale, time) * 0.5 / scale;
    if (d < 0.02) break;
    if (d > 100.0) break;
    col += fracPalette(length(p) * 0.1) * glow / (400.0 * d);
    t += d;
  }
  return vec4(col, 1.0);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;

  vec3 ro = vec3(0.0, 0.0, -camDist);
  ro.xz = fracRotate(ro.xz, time * orbitSpeed);
  vec3 cf = normalize(-ro);
  vec3 cs = normalize(cross(cf, vec3(0.0, 1.0, 0.0)));
  vec3 cu = normalize(cross(cf, cs));

  vec3 uuv = ro + cf * fov + p.x * cs + p.y * cu;
  vec3 rd = normalize(uuv - ro);

  vec4 col = fracRaymarch(ro, rd, time);
  return vec4(col.rgb, 1.0);
}
