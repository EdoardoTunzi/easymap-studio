// NAME: Psy Techno Scanlines
uniform float speed; // @min 0.0 @max 8.0 @default 2.0
uniform float lines; // @min 20.0 @max 300.0 @default 90.0
uniform float sweepWidth; // @min 0.02 @max 0.8 @default 0.2
uniform float glitch; // @min 0.0 @max 1.0 @default 0.3
uniform vec3 lineColor; // @default 0.1,1.0,1.0

float hash1(float x) { return fract(sin(x * 127.1) * 43758.5453); }

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  // spostamento a blocchi orizzontali: il classico tearing da segnale rotto
  float blockY = floor(uv.y * 24.0);
  float shift = (hash1(blockY + floor(time * 8.0)) - 0.5) * glitch * 0.4;
  float x = uv.x + shift * step(0.75, hash1(blockY * 1.7 + floor(time * 8.0)));
  float scan = 0.5 + 0.5 * sin(uv.y * lines * 3.14159);
  // banda luminosa che spazza verticalmente
  float sweepPos = fract(time * speed * 0.2);
  float sweep = smoothstep(sweepWidth, 0.0, abs(uv.y - sweepPos));
  float edge = smoothstep(0.0, 0.02, x) * smoothstep(1.0, 0.98, x);
  vec3 col = lineColor * (scan * 0.35 + sweep * 1.2) * edge;
  return vec4(col, 1.0);
}
