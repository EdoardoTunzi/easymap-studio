// NAME: Psy Chrome Ripple
uniform float speed; // @min 0.0 @max 4.0 @default 1.2
uniform float frequency; // @min 2.0 @max 40.0 @default 14.0
uniform float amplitude; // @min 0.0 @max 1.0 @default 0.4
uniform float metal; // @min 0.5 @max 8.0 @default 3.0
uniform vec3 tint; // @default 0.6,0.75,1.0

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv - 0.5;
  float t = time * speed;
  // somma di onde circolari da sorgenti diverse: interferenza a specchio
  float h = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 src = 0.35 * vec2(sin(fi * 2.1 + t * 0.4), cos(fi * 1.7 + t * 0.3));
    h += sin(length(p - src) * frequency - t * 2.0) / 4.0;
  }
  h *= amplitude;
  // gradiente dell'altezza -> riflesso cromato
  float e = 0.005;
  float hx = sin(length(p + vec2(e, 0.0)) * frequency - t * 2.0) * amplitude - h;
  float hy = sin(length(p + vec2(0.0, e)) * frequency - t * 2.0) * amplitude - h;
  vec3 n = normalize(vec3(-hx, -hy, 0.05));
  float f = pow(1.0 - abs(n.z), metal);
  vec3 col = tint * (0.3 + 0.7 * f);
  col += vec3(1.0) * pow(max(n.y, 0.0), metal * 3.0) * 0.6;
  return vec4(col, 1.0);
}
