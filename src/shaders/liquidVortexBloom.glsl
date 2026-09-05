// NAME: Vortex Bloom
uniform float speed; // @min -10.0 @max 10.0 @default 4.0
uniform float twist; // @min 0.0 @max 40.0 @default 12.0
uniform float arms; // @min 1.0 @max 12.0 @default 3.0
uniform float bloom; // @min 0.0 @max 4.0 @default 1.5
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.5
uniform float morphDepth; // @min 0.0 @max 10.0 @default 4.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 vortexColor; // @default 0.4,0.8,1.0
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = uv - 0.5;
float r = length(p);
float a = atan(p.y, p.x);
// vortice liquido: la torsione cresce verso il centro, gonfiata dalla luminanza
float swirl = a + twist * (0.3 / (r + 0.05)) * 0.1 + lum * morphDepth * 0.3;
float field = sin(swirl * arms + r * 20.0 - time * speed);
float soft = sin(swirl * arms * 0.5 - r * 12.0 + time * speed * 0.6);
float mixfield = field * 0.6 + soft * 0.4;
vec3 psyColor = 0.5 + 0.5 * cos(time * 2.0 + swirl * colorFreq + r * 8.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= vortexColor;
float glow = exp(-r * 3.0) * bloom;
vec3 fx = psyColor * (mixfield * 0.5 + 0.5) * (1.0 + glow);
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
