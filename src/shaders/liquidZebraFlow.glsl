// NAME: Liquid Zebra Flow
// Bande ad altissimo contrasto piegate in vortici organici, come una mappa di curve di livello
// che scorre sul soggetto.
//
// Il motore è il domain warping: un campo di rumore deforma le coordinate, un secondo campo
// deforma il risultato, e solo alla fine si tagliano le bande con una soglia netta. È la piega
// ripetuta a produrre gli occhi e le spirali; alzando `stripes` senza `warp` si otterrebbero
// soltanto righe dritte.
//
// `edge` governa il passaggio fra le due tinte: a 0 il bordo è tagliato di netto (l'aspetto
// serigrafico), alzandolo diventa una sfumatura morbida da marmo.
uniform float stripes; // @min 2.0 @max 60.0 @default 26.0
uniform float warp; // @min 0.0 @max 3.0 @default 1.9
uniform float detail; // @min 1.0 @max 6.0 @default 4.0
uniform float speed; // @min 0.0 @max 3.0 @default 0.35
uniform float swirl; // @min -3.0 @max 3.0 @default 0.8
uniform float flow; // @min 0.0 @max 3.0 @default 1.5
uniform float edge; // @min 0.0 @max 1.0 @default 0.05
uniform float balance; // @min 0.1 @max 0.9 @default 0.5
uniform float sourceWarp; // @min 0.0 @max 3.0 @default 0.0
uniform vec3 lightColor; // @default 1.00,1.00,1.00
uniform vec3 darkColor; // @default 0.02,0.02,0.03

float lzHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float lzNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(lzHash(i), lzHash(i + vec2(1.0, 0.0)), u.x),
    mix(lzHash(i + vec2(0.0, 1.0)), lzHash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

/** Rumore a più ottave; `oct` le sceglie a runtime, il ciclo ha comunque un tetto costante. */
float lzFbm(vec2 p, float oct) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= oct) break;
    v += a * lzNoise(p);
    p = p * 2.03 + vec2(37.0, 17.0);
    a *= 0.5;
  }
  return v;
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float aspect = max(uQuadAspect, 0.05);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 2.0;
  float t = time * speed;

  // Torsione: rotazione crescente col raggio, che avvolge le bande in spirale.
  // NON si usa l'angolo polare (atan): salta da +π a −π sul semiasse negativo e quel salto
  // si vedrebbe come un taglio netto attraverso l'immagine.
  float twist = swirl * length(p) * 0.9;
  float ct = cos(twist);
  float st = sin(twist);
  p = vec2(ct * p.x - st * p.y, st * p.x + ct * p.y);

  // primo warp: sposta il piano
  vec2 q = vec2(
    lzFbm(p + vec2(0.0, t), detail),
    lzFbm(p + vec2(5.2, 1.3) - t * 0.6, detail)
  );
  // secondo warp sul piano già deformato: è questo passaggio a creare gli occhi e le spirali
  vec2 r = vec2(
    lzFbm(p + warp * q + vec2(1.7, 9.2) + t * 0.4, detail),
    lzFbm(p + warp * q + vec2(8.3, 2.8) - t * 0.3, detail)
  );

  // campo scalare delle bande: una direzione di base più il warp (la spirale è già nella torsione)
  float field = (p.x * 0.7 + p.y * 0.45) + flow * (r.x + r.y);
  // il soggetto può fare da mappa di quota, come negli effetti Morph: le bande seguono i rilievi
  if (sourceWarp > 0.001) {
    vec3 src = texture2D(tex, vUv).rgb;
    field += sourceWarp * dot(src, vec3(0.299, 0.587, 0.114));
  }

  float s = sin(field * stripes);
  // soglia spostabile: `balance` decide quanta parte del ciclo resta chiara
  float threshold = cos(3.14159265 * clamp(balance, 0.05, 0.95));
  float soft = max(edge, 0.012); // sotto questa soglia il taglio netto diventerebbe scalettato
  float band = smoothstep(threshold - soft, threshold + soft, s);

  vec3 col = mix(darkColor, lightColor, band);
  return vec4(col, 1.0);
}
