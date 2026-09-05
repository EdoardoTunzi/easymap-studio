// NAME: Bumped Sinusoidal Warp
// Adattato da Shadertoy 4l2XWK. iChannel0 (texture generica sull'originale) sostituito con
// l'asset stesso: la superficie bump-mapped increspa e illumina la foto dell'utente invece di una
// texture decorativa qualsiasi. Conversione gamma manuale dell'originale (sRGB->lineare in
// entrata, sqrt in uscita) rimossa: la pipeline colore del progetto lavora già in spazio gamma.
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float bumpFactor; // @min 0.0 @max 0.2 @default 0.05
uniform float warpSoften; // @min 2.0 @max 20.0 @default 8.0
uniform float shininess; // @min 2.0 @max 40.0 @default 12.0
uniform float envAmount; // @min 0.0 @max 3.0 @default 1.0
uniform float blendAmount; // @min 0.0 @max 1.0 @default 1.0
uniform vec3 lightTint; // @default 1.0,0.97,0.92

// dominio deformato da un feedback sinusoidale a strati (Fabrice "Plop 2")
vec2 bwWarp(vec2 p, float t) {
  p = (p + 3.0) * 4.0;
  for (int i = 0; i < 3; i++) {
    p += cos(p.yx * 3.0 + vec2(t, 1.57)) / 3.0;
    p += sin(p.yx + t + vec2(1.57, 0.0)) / 2.0;
    p *= 1.3;
  }
  p += fract(sin(p + vec2(13.0, 7.0)) * 5e5) * 0.03 - 0.015;
  return mod(p, 2.0) - 1.0;
}

float bwBump(vec2 p, float t) {
  return length(bwWarp(p, t)) * 0.7071;
}

vec4 processColor(sampler2D tex, vec2 uv, float rawTime, vec2 resolution) {
  vec4 source = texture2D(tex, uv);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  float time = rawTime * speed;

  vec2 sp = uv - 0.5;
  sp.x *= resolution.x / resolution.y;
  vec3 rd = normalize(vec3(sp, 1.0));
  vec3 lp = vec3(cos(time) * 0.5, sin(time) * 0.2, -1.0);
  vec3 sn = vec3(0.0, 0.0, -1.0);

  // la luminanza della sorgente spinge la fase del warp: le zone chiare "increspano" diverso
  float t = time * 0.5 + (lum - 0.5) * morphDepth * 0.1;

  vec2 eps = vec2(4.0 / resolution.y, 0.0);
  float f = bwBump(sp, t);
  float fx = (bwBump(sp - eps.xy, t) - f) / eps.x;
  float fy = (bwBump(sp - eps.yx, t) - f) / eps.x;
  sn = normalize(sn + vec3(fx, fy, 0.0) * bumpFactor);

  vec3 ld = lp - vec3(sp, 0.0);
  float lDist = max(length(ld), 0.0001);
  ld /= lDist;

  float atten = 1.0 / (1.0 + lDist * lDist * 0.15);
  atten *= f * 0.9 + 0.1;

  float diff = max(dot(sn, ld), 0.0);
  diff = pow(diff, 4.0) * 0.66 + pow(diff, 8.0) * 0.34;
  float spec = pow(max(dot(reflect(-ld, sn), -rd), 0.0), shininess);

  vec2 warpUV = clamp(uv + bwWarp(sp, t) / warpSoften, 0.0, 1.0);
  vec3 texCol = texture2D(tex, warpUV).rgb;
  texCol = smoothstep(0.05, 0.75, pow(texCol, vec3(0.75, 0.8, 0.85)));

  vec3 col = (texCol * (diff * lightTint * 2.0 + 0.5) + vec3(1.0, 0.6, 0.2) * spec * 2.0) * atten;

  // faux environment map
  float ref = max(dot(reflect(rd, sn), vec3(1.0)), 0.0);
  col += col * pow(ref, 4.0) * vec3(0.25, 0.5, 1.0) * envAmount;

  source.rgb = mix(source.rgb, clamp(col, 0.0, 1.0), blendAmount);
  return source;
}
