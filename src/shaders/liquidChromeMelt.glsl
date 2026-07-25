// NAME: Liquid Chrome Melt
uniform float speed; // @min -10.0 @max 10.0 @default 2.0
uniform float meltScale; // @min 1.0 @max 15.0 @default 5.0
uniform float drip; // @min 0.0 @max 4.0 @default 1.5
uniform float contrast; // @min 0.5 @max 6.0 @default 2.5
uniform float colorFreq; // @min 0.1 @max 10.0 @default 1.5
uniform float morphDepth; // @min 0.0 @max 10.0 @default 4.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 chromeColor; // @default 0.8,0.9,1.0
float lcm_hash(vec2 p) {
return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float lcm_noise(vec2 p) {
vec2 i = floor(p);
vec2 f = fract(p);
vec2 u = f * f * (3.0 - 2.0 * f);
return mix(mix(lcm_hash(i), lcm_hash(i + vec2(1.0, 0.0)), u.x),
           mix(lcm_hash(i + vec2(0.0, 1.0)), lcm_hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = (uv - 0.5) * meltScale;
float t = time * speed;
// cromo fuso: noise che cola verso il basso, riflessi speculari finti
p.y += t * 0.3 * drip + lcm_noise(p * 0.7 + t * 0.2) * drip;
float n = lcm_noise(p + vec2(0.0, t * 0.5));
n += lcm_noise(p * 2.1 - t * 0.3) * 0.5;
n += lum * morphDepth * 0.3;
// gradiente finto-normale per il riflesso metallico
float spec = pow(abs(sin(n * 6.28318)), contrast);
vec3 psyColor = 0.5 + 0.5 * cos(n * colorFreq * 4.0 + t * 0.5 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor = mix(vec3(spec), psyColor, 0.45) * chromeColor;
vec3 fx = psyColor * (0.4 + spec);
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
