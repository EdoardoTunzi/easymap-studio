// NAME: DNA Helix
uniform float speed; // @min 0.0 @max 5.0 @default 1.5
uniform float turns; // @min 1.0 @max 12.0 @default 4.0
uniform float radius; // @min 0.05 @max 0.5 @default 0.22
uniform float dotSize; // @min 0.005 @max 0.1 @default 0.025
uniform vec3 strandA; // @default 0.1,1.0,0.9
uniform vec3 strandB; // @default 1.0,0.2,0.6

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv - 0.5;
  float t = p.y * turns * 6.28318 + time * speed;
  float xa = sin(t) * radius;
  float xb = sin(t + 3.14159) * radius;
  // la profondita' apparente modula la dimensione dei nodi
  float da = abs(p.x - xa);
  float db = abs(p.x - xb);
  float za = 0.5 + 0.5 * cos(t);
  float zb = 0.5 + 0.5 * cos(t + 3.14159);
  float ba = smoothstep(dotSize * (0.5 + za), 0.0, da);
  float bb = smoothstep(dotSize * (0.5 + zb), 0.0, db);
  // gradini tra i due filamenti
  float rung = smoothstep(0.012, 0.0, abs(p.x - mix(xa, xb, 0.5)) - abs(xa - xb) * 0.5)
             * smoothstep(0.35, 0.5, fract(t / 6.28318 * 2.0));
  vec3 col = strandA * ba + strandB * bb + mix(strandA, strandB, 0.5) * rung * 0.35;
  return vec4(col, 1.0);
}
