// NAME: Hex Lattice
uniform float speed; // @min -10.0 @max 10.0 @default 1.5
uniform float density; // @min 2.0 @max 30.0 @default 10.0
uniform float edge; // @min 0.01 @max 0.5 @default 0.15
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 cellColor; // @default 0.9,0.3,1.0
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
// la griglia si dilata dove l'asset e' chiaro
vec2 p = (uv - 0.5) * density * (1.0 - lum * morphDepth * 0.06);
vec2 s = vec2(1.0, 1.7320508);
vec2 a = mod(p, s) - s * 0.5;
vec2 b = mod(p - s * 0.5, s) - s * 0.5;
vec2 gv = dot(a, a) < dot(b, b) ? a : b;
vec2 q = abs(gv);
float d = 0.5 - max(dot(q, normalize(vec2(1.0, 1.7320508))), q.x);
float wall = 1.0 - smoothstep(0.0, edge, d);
float pulse = 0.5 + 0.5 * sin(time * speed + lum * morphDepth * 3.0);
vec3 psyColor = 0.5 + 0.5 * cos(time * 0.7 + lum * colorFreq * 6.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= cellColor;
vec3 fx = psyColor * wall * (0.5 + pulse) + psyColor * 0.12;
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
