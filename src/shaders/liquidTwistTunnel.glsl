// NAME: Liquid Twist Tunnel
uniform float speed; // @min -10.0 @max 10.0 @default 4.0
uniform float rings; // @min 2.0 @max 40.0 @default 16.0
uniform float twist; // @min 0.0 @max 20.0 @default 6.0
uniform float depth; // @min 0.05 @max 1.0 @default 0.25
uniform float colorFreq; // @min 0.1 @max 10.0 @default 3.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.5
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 tunnelColor; // @default 1.0,0.6,0.2
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = uv - 0.5;
float r = length(p) + 0.0001;
float a = atan(p.y, p.x);
// tunnel liquido: profondità prospettica + torsione angolare che "cola" col tempo
float z = depth / r + lum * morphDepth;
float ang = a + z * twist * 0.1 + sin(z * 2.0 - time * speed) * 0.3;
float tunnel = sin(z * rings * 0.5 - time * speed + sin(ang * 4.0) * 1.5);
vec3 psyColor = 0.5 + 0.5 * cos(time * 1.5 + z * colorFreq + ang * 2.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= tunnelColor;
float fog = smoothstep(0.0, 0.15, r);
vec3 fx = psyColor * (tunnel * 0.5 + 0.5) * fog * (1.0 + exp(-r * 2.5));
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
