// NAME: Pulse Beacon
uniform float posX; // @min 0.0 @max 1.0 @default 0.5
uniform float posY; // @min 0.0 @max 1.0 @default 0.5
uniform float zoomAmount; // @min 0.0 @max 1.0 @default 0.5
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
// f0/f1 = centro del campo (spazio 0..1), f2 = zoom: stessi range dello shader originale
float f0 = mix(0.05, 0.95, posX);
float f1 = mix(0.05, 0.95, posY);
float f2 = mix(0.2, 0.95, zoomAmount);
vec2 position = 2.0 * (uv - vec2(f0, f1));
position.x *= resolution.x / resolution.y;
// il raggio viene spinto in fuori dalla luminanza dell'asset: il campo pulsante
// segue i rilievi della statua/stage invece di appoggiarsi sopra come un piano piatto
float u = sqrt(dot(position, position)) * f2 + lum * morphDepth * 0.08;
u = max(u, 0.001);
float v = atan(position.y, position.x);
float t = time + 1.0 / u;
float val = smoothstep(0.0, 1.0, sin(5.0 * (time + sin(1.0 / u * 7.0)) + 10.0 * v) + cos(t * 10.0));
vec3 beacon = vec3(val * 0.8, val, 0.0) + (1.0 - val) * vec3(0.05, 0.05, 0.05);
beacon *= clamp(u, 0.0, 1.0);
source.rgb = mix(source.rgb, beacon + source.rgb * beacon, 0.85);
}
return source;
}
