// NAME: Disco Sun Vortex
// Adattato da "Abstract Shine" di @Frostbyte via il remix di @WorkingClassHacker (Shadertoy
// 7cfGzn), licenza CC-BY-NC-SA-4.0: uso non commerciale, attribuzione richiesta.
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform float tunnelRadius; // @min 4.0 @max 20.0 @default 10.0
uniform float waveAmount; // @min 0.0 @max 3.0 @default 1.0
uniform float glow; // @min 0.3 @max 3.0 @default 1.0
uniform float shimmer; // @min 0.0 @max 2.0 @default 1.0
uniform float vignette; // @min 0.0 @max 2.0 @default 1.0
uniform vec3 tint; // @default 1.0,1.0,1.0

// rotazione 2D via fase del coseno (cos(a+33)≈-sin(a), cos(a+11)≈sin(a)): stessa approssimazione
// compatta dell'originale, evita sin() nel corpo del raymarch
mat2 masRot(float a) {
  vec4 c = cos(a + vec4(0.0, 33.0, 11.0, 0.0));
  return mat2(c.x, c.y, c.z, c.w);
}

// palette coseno di IQ
vec3 masPalette(float i) {
  const vec3 a = vec3(0.50, 0.38, 0.26);
  const vec3 b = vec3(0.50, 0.35, 0.25);
  const vec3 c = vec3(1.00);
  const vec3 d = vec3(0.00, 0.12, 0.25);
  return a + b * cos(6.2831853 * (c * i + d));
}

// GLSL ES 1.00 (WebGL1) non ha tanh nativo: approssimazione stabile via exp, senza overflow.
vec4 masTanh(vec4 x) {
  vec4 e = exp(-2.0 * abs(x));
  return sign(x) * (1.0 - e) / (1.0 + e);
}

vec4 processColor(sampler2D tex, vec2 uv, float rawTime, vec2 resolution) {
  vec4 source = texture2D(tex, uv);
  if (length(source.rgb) > blackThreshold) {
    float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
    float tt = rawTime * speed;
    float t = mod(tt, 6.283185);

    vec2 u = uv * resolution;
    vec2 suv = (u - 0.5 * resolution + 0.5) / resolution.y;
    vec3 d = normalize(vec3(2.0 * u - resolution, resolution.y));

    vec3 p;
    // la luminanza della sorgente spinge la profondità di partenza nel tunnel: le zone chiare
    // dell'immagine sembrano più vicine, come un rilievo scavato nel corridoio
    p.z = t + lum * morphDepth;

    vec4 acc = vec4(0.0);
    for (float i = 0.0; i < 20.0; i++) {
      p.xy *= masRot(-p.z * 0.01 - t * 0.05);
      float s = 0.6;
      s = max(s, 4.0 * (-length(p.xy) + tunnelRadius));
      s += abs(p.y * 0.004 + sin(t - p.x * 0.5) * 0.9 * waveAmount + 1.0);
      p += d * s;
      acc += glow / (s * 0.2);
    }

    acc *= vec4(masPalette(length(p) / (abs(sin(tt * 0.02) * 50.0) + 6.0)), 1.0);

    acc -= 20.0 * shimmer * smoothstep(
      0.001,
      abs(sin(tt * 5.0)),
      0.7 - length(sin(suv * 200.0) / 1.5) - abs(suv.y) + 0.2
    );

    acc /= 0.5e2;

    float l = length(suv);
    acc *= mix(1.0, 1.2 - l, vignette);

    vec3 centerGlow = masPalette(l - 0.23);
    acc = mix(acc, centerGlow.rgbr, (1.0 - smoothstep(0.01, 0.95, l)) * vignette);

    acc = masTanh(acc + acc);

    vec3 fx = acc.rgb * tint;
    source.rgb = mix(source.rgb, fx + source.rgb * fx, 0.85);
  }
  return source;
}
