// NAME: Psy Mandel Slice
uniform float speed; // @min 0.0 @max 2.0 @default 0.3
uniform float zoom; // @min 0.3 @max 4.0 @default 1.2
uniform float iterations; // @min 8.0 @max 80.0 @default 40.0
uniform float colorCycle; // @min 0.0 @max 4.0 @default 1.0
uniform vec3 tint; // @default 0.2,0.7,1.0

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = (uv - 0.5) * 3.0 / zoom;
  float t = time * speed;
  // Julia con parametro su un'orbita chiusa: morphing continuo senza salti
  vec2 c = 0.7885 * vec2(cos(t * 0.7), sin(t * 0.5));
  vec2 z = p;
  float n = 0.0;
  for (int i = 0; i < 80; i++) {
    if (float(i) >= iterations) break;
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    if (dot(z, z) > 16.0) break;
    n += 1.0;
  }
  // smooth iteration count: elimina le bande a gradino
  float sm = n - log2(max(log2(dot(z, z)), 1.0)) + 4.0;
  float m = sm / iterations;
  vec3 col = tint * (0.5 + 0.5 * cos(6.28318 * (m * colorCycle + vec3(0.0, 0.33, 0.67))));
  col *= step(m, 0.999);
  return vec4(col, 1.0);
}
