// NAME: Julia Dream
uniform float speed; // @min 0.0 @max 2.0 @default 0.5
uniform float zoom; // @min 0.5 @max 3.0 @default 1.2
uniform float hue; // @min 0.0 @max 1.0 @default 0.6
uniform float iterations; // @min 8.0 @max 60.0 @default 32.0

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.0, 0.4, 0.8)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = (uv * 2.0 - 1.0) / zoom;
  p.x *= resolution.x / resolution.y;
  vec2 c = vec2(0.7885 * cos(time * speed), 0.7885 * sin(time * speed));
  vec2 z = p;
  float it = 0.0;
  for (int i = 0; i < 60; i++) {
    if (float(i) >= iterations) break;
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    if (dot(z, z) > 4.0) break;
    it += 1.0;
  }
  float m = it / iterations;
  vec3 col = pal(m + hue);
  return vec4(col, 1.0);
}
