// NAME: Tunnel Depth
uniform float speed; // @min -10.0 @max 10.0 @default 2.5
uniform float rings; // @min 2.0 @max 40.0 @default 12.0
uniform float spokes; // @min 0.0 @max 24.0 @default 8.0
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 tunnelColor; // @default 0.9,0.2,1.0
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = uv - 0.5;
float r = max(length(p), 1e-4);
float a = atan(p.y, p.x);
// la profondita' del tunnel e' spinta dalla luminanza: le zone chiare vengono verso di te
float z = 0.25 / r + time * speed * 0.3 + lum * morphDepth;
float band = fract(z * rings * 0.1);
float ring = pow(1.0 - abs(band * 2.0 - 1.0), 2.0);
float spoke = 0.5 + 0.5 * sin(a * spokes + z);
vec3 psyColor = 0.5 + 0.5 * cos(time * 0.5 + z * colorFreq + a * 2.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= tunnelColor;
vec3 fx = psyColor * ring * (0.4 + 0.6 * spoke) + psyColor * exp(-r * 6.0) * 0.6;
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
