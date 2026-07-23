// NAME: Plasma Bloom
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float hue; // @min 0.0 @max 1.0 @default 0.0
uniform float intensity; // @min 0.2 @max 2.0 @default 1.0
uniform float density; // @min 1.0 @max 12.0 @default 5.0

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.0, 0.33, 0.67)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float t = time * speed;
  vec2 p = uv * density;
  float v = sin(p.x + t) + sin(p.y + t) + sin(p.x + p.y + t)
          + sin(length(p - density * 0.5) + t);
  v *= 0.25;
  vec3 col = pal(v + hue + t * 0.05);
  return vec4(col * intensity, 1.0);
}
