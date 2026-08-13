// NAME: Psy Fractal Flower
uniform float speed; // @min 0.0 @max 2.0 @default 0.4
uniform float petals; // @min 3.0 @max 24.0 @default 8.0
uniform float depth; // @min 1.0 @max 6.0 @default 4.0
uniform float openness; // @min 0.1 @max 1.5 @default 0.7
uniform vec3 innerColor; // @default 1.0,0.9,0.2
uniform vec3 outerColor; // @default 0.8,0.0,0.9

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv - 0.5;
  float t = time * speed;
  float acc = 0.0;
  float scale = 1.0;
  // corone di petali annidate, ognuna piu' piccola e ruotata
  for (int i = 0; i < 6; i++) {
    if (float(i) >= depth) break;
    float rot = t * (1.0 + float(i) * 0.3);
    float c = cos(rot), s = sin(rot);
    vec2 q = mat2(c, -s, s, c) * p * scale;
    float a = atan(q.y, q.x);
    float r = length(q);
    // rosa polare: r = cos(k*theta) disegna i petali
    float petal = abs(cos(a * petals * 0.5)) * openness;
    // contorno marcato piu un riempimento morbido: i petali si leggono anche da lontano
    acc += smoothstep(0.06, 0.0, abs(r - petal)) * (1.0 - float(i) / depth);
    acc += smoothstep(petal, petal * 0.25, r) * 0.25 * (1.0 - float(i) / depth);
    scale *= 1.6;
  }
  float r = length(p);
  vec3 col = mix(innerColor, outerColor, clamp(r * 2.5, 0.0, 1.0)) * acc;
  return vec4(col, 1.0);
}
