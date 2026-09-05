// NAME: Radial Shards
uniform float speed; // @min -10.0 @max 10.0 @default 2.0
uniform float shards; // @min 3.0 @max 60.0 @default 18.0
uniform float taper; // @min 0.5 @max 8.0 @default 2.5
uniform float colorFreq; // @min 0.1 @max 10.0 @default 3.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 shardColor; // @default 1.0,0.2,0.5
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = uv - 0.5;
float r = length(p);
// l'angolo viene torto dalla luminanza: le schegge si piegano sull'asset
float a = atan(p.y, p.x) + lum * morphDepth * 0.3 + time * speed * 0.1;
float w = fract(a / 6.28318 * shards);
float shard = pow(1.0 - abs(w * 2.0 - 1.0), taper);
float falloff = exp(-r * 2.0);
vec3 psyColor = 0.5 + 0.5 * cos(time * 0.7 + a * colorFreq + r * 4.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= shardColor;
vec3 fx = psyColor * shard * (0.4 + falloff) + psyColor * 0.12;
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
