// NAME: Morphogen Mycelium
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float density; // @min 4.0 @max 48.0 @default 16.0
uniform float branching; // @min 0.0 @max 1.0 @default 0.8
uniform float thickness; // @min 0.0 @max 1.0 @default 0.35
uniform float stretch; // @min 0.5 @max 8.0 @default 3.5
uniform float reach; // @min 0.2 @max 2.5 @default 1.6
uniform float pulse; // @min 0.0 @max 1.0 @default 0.5
uniform float posX; // @min -0.5 @max 0.5 @default 0.0
uniform float posY; // @min -0.5 @max 0.5 @default 0.0
uniform float glow; // @min 0.0 @max 1.0 @default 0.45
uniform float sourceInfluence; // @min 0.0 @max 1.0 @default 0.6
uniform float blendAmount; // @min 0.0 @max 1.0 @default 1.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 filamentColor; // @default 0.35,1.0,0.55
uniform vec3 tipColor; // @default 1.0,0.92,0.5

float mgHash(vec2 p) {
  p = fract(p * vec2(127.61, 311.19));
  p += dot(p, p + 47.31);
  return fract(p.x * p.y);
}

/**
 * Value noise CICLICO sulla prima coordinata: l'angolo torna su se stesso a giro completo, e
 * senza il mod sulla cella il micelio si spaccherebbe lungo la semiretta a 180 gradi (dove
 * atan salta da +PI a -PI), con una cucitura verticale ben visibile in proiezione.
 * `period` deve essere intero: chi chiama passa multipli di floor(density).
 */
float mgNoiseCyc(vec2 p, float period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x0 = mod(i.x, period);
  float x1 = mod(i.x + 1.0, period);
  float a = mgHash(vec2(x0, i.y));
  float b = mgHash(vec2(x1, i.y));
  float c = mgHash(vec2(x0, i.y + 1.0));
  float d = mgHash(vec2(x1, i.y + 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

/**
 * Distanza (approssimata, in frazioni di cella) dalla isolinea n = 0.5 di una generazione.
 *
 * Le creste di un ridged noise si spezzano dove il massimo locale non arriva al valore pieno,
 * e la rete si riduce a tratti staccati. La isolinea invece esiste ovunque il campo attraversi
 * il livello: da' un filo continuo che si biforca sulle selle e si richiude in anelli, che e'
 * come si legge una vera rete di ife.
 *
 * La divisione per il gradiente e' cio' che tiene il filo di spessore costante: senza, dove il
 * campo e' piatto la fascia attorno al livello si apre in una chiazza larga invece di restare
 * un filamento. Il dominio e' molto piu' fitto in angolo che in raggio, quindi i fili nascono
 * allungati verso l'esterno invece che isotropi.
 */
float mgHyphaeDist(float an, float radial, float period) {
  vec2 q = vec2(an * period, radial);
  float n = mgNoiseCyc(q, period);
  float nx = mgNoiseCyc(q + vec2(0.035, 0.0), period);
  float ny = mgNoiseCyc(q + vec2(0.0, 0.035), period);
  float g = max(length(vec2(nx - n, ny - n)) / 0.035, 0.03);
  return abs(n - 0.5) / g;
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec4 source = texture2D(tex, uv);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  float t = time * speed;

  // uQuadAspect (wrapper): senza correzione il micelio si irradierebbe da un centro ellittico
  // su un mapping largo, con i rami piu' fitti in orizzontale che in verticale.
  float aspect = max(uQuadAspect, 0.05);
  vec2 p = uv - 0.5 - vec2(posX, posY);
  p.x *= aspect;
  float r = length(p);
  float an = atan(p.y, p.x) * 0.15915494 + 0.5; // angolo normalizzato 0..1

  float N = max(floor(density), 4.0);
  // il dominio scorre verso l'esterno: le ife sembrano allungarsi invece di stare ferme
  float radial = r * stretch * (1.0 + lum * 0.7 * sourceInfluence) - t * 0.28;

  // Tre generazioni: a ogni passo i rami sul giro raddoppiano, e la generazione entra solo
  // oltre una certa distanza. Cosi' la rete si infittisce allontanandosi dal centro, come una
  // colonia che si ramifica, invece di partire gia' fitta dal bulbo.
  float d0 = mgHyphaeDist(an, radial, N);
  float d1 = mgHyphaeDist(an, radial, N * 2.0);
  float d2 = mgHyphaeDist(an, radial, N * 4.0);
  float b1 = branching * smoothstep(0.08, 0.30, r);
  float b2 = branching * smoothstep(0.26, 0.58, r);
  // Verso il centro le celle angolari si stringono e i fili collassano in una raggiera di
  // righe sottili: la fascia si allarga per compensare, e il bulbo copre quel che resta.
  float w = mix(0.012, 0.11, thickness) * (1.0 - lum * 0.3 * sourceInfluence)
          * clamp(0.28 / max(r, 0.02), 1.0, 5.0);
  float fil = max(smoothstep(w, w * 0.25, d0),
                  max(smoothstep(w, w * 0.25, d1) * b1, smoothstep(w, w * 0.25, d2) * b2));

  // ogni direzione ha la sua portata: senza, la colonia morirebbe su un cerchio perfetto
  // invece che sul margine irregolare che ha una vera coltura
  float edgeSeed = mgNoiseCyc(vec2(an * N * 0.5, 3.0), max(floor(N * 0.5), 2.0));
  float reachLocal = reach * (0.55 + 0.6 * edgeSeed) * (1.0 + lum * 0.5 * sourceInfluence);
  float alive = 1.0 - smoothstep(reachLocal * 0.7, reachLocal, r);
  float tip = alive * (1.0 - alive) * 4.0; // massimo a meta' spegnimento: la punta che avanza

  // impulsi che corrono lungo i rami verso l'esterno: e' cio' che fa leggere la rete come viva
  // e in crescita, invece che come un disegno fermo
  float flow = 0.6 + 0.4 * sin(r * 26.0 - t * 2.4 + an * 18.0);
  fil *= mix(1.0, flow, pulse);
  // al centro le celle angolari collassano in una raggiera di righe: li' comanda il bulbo
  float centerFade = smoothstep(0.0, 0.085, r);
  fil *= centerFade;
  fil *= mix(1.0, 0.3 + lum * 1.6, sourceInfluence);

  vec3 col = filamentColor * fil * alive;
  col += tipColor * fil * tip * 1.2;
  // alone: le stesse distanze lette con una fascia piu' larga, quindi segue esattamente i rami
  float hw = w * 3.5;
  float halo = max(smoothstep(hw, 0.0, d0),
                   max(smoothstep(hw, 0.0, d1) * b1, smoothstep(hw, 0.0, d2) * b2));
  col += filamentColor * halo * centerFade * alive * glow * 0.28;
  col += tipColor * exp(-r * r * 420.0) * 0.9;

  float dark = step(length(source.rgb), blackThreshold);
  float cover = blendAmount * (1.0 - dark * sourceInfluence);
  return vec4(mix(source.rgb, col, cover), 1.0);
}
