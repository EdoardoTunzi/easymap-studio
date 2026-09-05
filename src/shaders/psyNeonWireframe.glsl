// NAME: Neon Wireframe
uniform float speed; // @min 0.0 @max 4.0 @default 1.0
uniform float gridSize; // @min 2.0 @max 30.0 @default 12.0
uniform float horizon; // @min 0.1 @max 0.9 @default 0.5
uniform float lineWidth; // @min 0.01 @max 0.2 @default 0.06
uniform vec3 gridColor; // @default 1.0,0.1,0.7

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv - vec2(0.5, horizon);
  // sotto l'orizzonte: piano prospettico che scorre verso l'osservatore
  if (p.y > -0.001) {
    // sopra l orizzonte: sole a bande, cifra stilistica synthwave
    float sun = smoothstep(0.28, 0.26, length(p * vec2(1.0, 1.6)));
    sun *= step(0.35, fract(p.y * 26.0));
    vec3 sky = gridColor * sun * 1.3;
    sky += gridColor * 0.12 * exp(-p.y * 6.0);
    return vec4(sky, 1.0);
  }
  float z = 1.0 / (-p.y);
  float x = p.x * z;
  float depth = z * 0.15;
  float lz = abs(fract(depth + time * speed * 0.5) - 0.5) * 2.0;
  float lx = abs(fract(x * gridSize * 0.1) - 0.5) * 2.0;
  float w = lineWidth * (1.0 + depth * 2.0);
  float line = max(smoothstep(w, 0.0, 1.0 - lz), smoothstep(w, 0.0, 1.0 - lx));
  float fade = exp(-depth * 0.5);
  return vec4(gridColor * line * fade * 2.2, 1.0);
}
