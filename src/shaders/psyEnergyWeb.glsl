// NAME: Psy Energy Web
uniform float speed; // @min 0.0 @max 4.0 @default 1.2
uniform float nodes; // @min 2.0 @max 8.0 @default 6.0
uniform float thickness; // @min 0.002 @max 0.08 @default 0.03
uniform float chaos; // @min 0.0 @max 2.0 @default 0.8
uniform vec3 webColor; // @default 0.3,0.9,1.0

// distanza da un segmento: base per disegnare i filamenti tra i nodi
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

vec2 nodePos(float i, float t, float chaosAmt) {
  float a = i * 2.399963 + t * 0.3;
  float r = 0.15 + 0.3 * fract(sin(i * 91.7) * 43758.5453);
  return vec2(cos(a), sin(a)) * r + chaosAmt * 0.12 * vec2(sin(t * 1.3 + i), cos(t * 1.1 + i * 2.0));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv - 0.5;
  float t = time * speed;
  float acc = 0.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= nodes) break;
    vec2 a = nodePos(float(i), t, chaos);
    for (int j = 1; j < 8; j++) {
      if (float(j) >= nodes) break;
      if (j <= i) continue;
      vec2 b = nodePos(float(j), t, chaos);
      float d = segDist(p, a, b);
      // il filamento pulsa lungo la sua lunghezza
      acc += smoothstep(thickness, 0.0, d) * (0.5 + 0.5 * sin(t * 3.0 + float(i + j)));
    }
    acc += smoothstep(0.045, 0.0, length(p - a)) * 2.0;
  }
  return vec4(webColor * acc, 1.0);
}
