// NAME: Morph Kaleido Depth
uniform float speed; // @min -10.0 @max 10.0 @default 1.0
uniform float segments; // @min 3.0 @max 24.0 @default 8.0
uniform float zoom; // @min 0.5 @max 8.0 @default 3.0
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.5
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 kaleidoColor; // @default 1.0,0.9,0.2
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = (uv - 0.5) * zoom;
float r = length(p);
float a = atan(p.y, p.x);
// piegatura caleidoscopica con offset dato dal rilievo
float seg = 6.28318 / segments;
a = abs(mod(a + lum * morphDepth * 0.2 + seg * 0.5, seg) - seg * 0.5);
vec2 q = vec2(cos(a), sin(a)) * r;
float pattern = sin(q.x * 8.0 + time * speed) * sin(q.y * 8.0 - time * speed * 0.7);
float shape = pow(abs(pattern), 0.6);
vec3 psyColor = 0.5 + 0.5 * cos(time * 0.5 + pattern * colorFreq * 3.0 + r * 3.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= kaleidoColor;
vec3 fx = psyColor * shape + psyColor * 0.12;
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
