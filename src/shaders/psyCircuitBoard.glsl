// NAME: Circuit Board
uniform float speed; // @min 0.0 @max 5.0 @default 1.5
uniform float density; // @min 4.0 @max 40.0 @default 14.0
uniform float width; // @min 0.02 @max 0.4 @default 0.1
uniform float pulseLength; // @min 0.05 @max 1.0 @default 0.3
uniform vec3 traceColor; // @default 0.1,1.0,0.8

float hash1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 g = (uv - 0.5) * density;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float rnd = hash1(id);
  // ogni cella contiene un segmento orizzontale o verticale: sembra una pista stampata
  float d = rnd < 0.5 ? abs(f.y) : abs(f.x);
  float trace = smoothstep(width, width * 0.4, d);
  // impulso di corrente che scorre lungo la pista
  float along = rnd < 0.5 ? f.x : f.y;
  float head = fract(time * speed * 0.5 + rnd);
  float pos = along + 0.5;
  float pulse = smoothstep(pulseLength, 0.0, abs(pos - head));
  float pad = smoothstep(0.18, 0.1, length(f)) * step(0.85, rnd);
  vec3 col = traceColor * (trace * (0.18 + pulse) + pad * 0.8);
  return vec4(col, 1.0);
}
