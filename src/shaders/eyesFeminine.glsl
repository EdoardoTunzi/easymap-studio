// NAME: Female Eyes
// Due occhi femminili (mandorla, eyeliner alato, ciglia lunghe) che sbattono le palpebre a
// intervalli irregolari e spostano lo sguardo a destra/sinistra con saccadi rapide.
// Tutto ciò che non è occhio resta trasparente: pensato come layer sopra altri layer.
uniform float eyeSpacing;  // @min 0.0 @max 0.9 @default 0.44
uniform float eyeSize;     // @min 0.05 @max 0.5 @default 0.2
uniform float eyeHeight;   // @min 0.2 @max 1.6 @default 0.9
uniform float blinkRate;   // @min 0.0 @max 2.0 @default 0.35
uniform float gazeRate;    // @min 0.0 @max 3.0 @default 0.45
uniform float gazeAmount;  // @min 0.0 @max 1.0 @default 0.7
uniform float irisSize;    // @min 0.2 @max 1.2 @default 0.72
uniform float pupilSize;   // @min 0.1 @max 0.9 @default 0.45
uniform float lashLength;  // @min 0.0 @max 1.5 @default 0.7
uniform float linerWidth;  // @min 0.0 @max 2.0 @default 0.8
uniform float glow;        // @min 0.0 @max 1.0 @default 0.35
uniform vec3 irisColor;    // @default 0.25,0.75,0.95
uniform vec3 scleraColor;  // @default 0.97,0.95,0.94
uniform vec3 linerColor;   // @default 0.03,0.02,0.04
uniform vec3 glowColor;    // @default 0.9,0.25,0.6

const float FE_PI = 3.14159265;

float feHash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

// Apertura delle palpebre 0..1: 1 = occhio spalancato, ~0 = chiuso.
// Il battito parte in un punto casuale del ciclo e ogni tanto è doppio, così non è metronomico.
float feOpen(float t) {
  float cyc = t * max(blinkRate, 0.0);
  float i = floor(cyc);
  float f = fract(cyc);
  float start = 0.12 + 0.55 * feHash(i);
  float dur = 0.16;
  float k = clamp((f - start) / dur, 0.0, 1.0);
  float b1 = sin(k * FE_PI);
  // secondo battito ravvicinato solo in alcuni cicli
  float k2 = clamp((f - start - dur * 1.4) / dur, 0.0, 1.0);
  float b2 = sin(k2 * FE_PI) * step(0.72, feHash(i + 7.3));
  float closed = pow(clamp(max(b1, b2), 0.0, 1.0), 0.55);
  return mix(1.0, 0.02, closed);
}

// Sguardo orizzontale -1..1: direzioni discrete (sinistra / centro / destra) raggiunte con una
// saccade veloce a inizio ciclo, poi fissazione fino al cambio successivo.
float feGaze(float t) {
  float cyc = t * max(gazeRate, 0.0);
  float i = floor(cyc);
  float f = fract(cyc);
  float a = floor(feHash(i) * 3.0) - 1.0;
  float b = floor(feHash(i + 1.0) * 3.0) - 1.0;
  return mix(a, b, smoothstep(0.0, 0.13, f));
}

// Tratto a punta (usato per la coda dell'eyeliner): spesso all'attacco, affilato in punta.
float feStroke(vec2 p, vec2 a, vec2 b, float w) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
  float d = length(pa - ba * h);
  float tw = mix(w, 0.004, h * h);
  return 1.0 - smoothstep(tw, tw + 0.022, d);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  // uQuadAspect (wrapper): forma del quad del layer. Senza questa correzione gli occhi
  // si schiaccerebbero su un mapping largo. eyeSize è in frazioni di ALTEZZA del layer.
  float aspect = max(uQuadAspect, 0.01);
  vec2 p = uv - 0.5;
  p.x *= aspect;
  float open = feOpen(time);
  float gaze = feGaze(time) * gazeAmount;

  // due occhi speculari: si disegna un occhio solo, in coordinate locali isotropiche
  // (stessa scala sui due assi, così l'iride resta circolare) con q.x > 0 = coda esterna
  float side = p.x < 0.0 ? -1.0 : 1.0;
  vec2 q = (p - vec2(side * eyeSpacing * 0.5 * aspect, 0.0)) / max(eyeSize, 0.001);
  q.x *= side;
  q.y -= q.x * 0.1; // taglio "cat eye": la coda esterna sale leggermente

  // --- forma a mandorla: palpebra superiore più curva, inferiore più piatta ---
  float hgt = max(eyeHeight, 0.05);
  float tt = max(1.0 - q.x * q.x, 0.0);
  float topL = 0.55 * hgt * pow(tt, 0.6) * open;
  float botL = 0.42 * hgt * pow(tt, 0.9) * open;
  float aa = 0.012;
  float xin = 1.0 - smoothstep(0.96, 1.0, abs(q.x));
  float shape = (1.0 - smoothstep(topL - aa, topL + aa, q.y))
              * smoothstep(-botL - aa, -botL + aa, q.y)
              * xin;

  // --- bulbo: sclera con l'ombra portata dalla palpebra superiore ---
  vec3 eyeCol = scleraColor * (0.6 + 0.4 * smoothstep(topL, topL - 0.6 * hgt, q.y));
  eyeCol *= 0.86 + 0.14 * smoothstep(-botL, -botL + 0.3 * hgt, q.y);

  // --- iride: segue lo sguardo (specchiata con l'occhio, così guardano nella stessa direzione) ---
  vec2 ic = vec2(side * gaze * 0.4, 0.03 * sin(time * 0.7));
  vec2 d = q - ic;
  float rd = length(d);
  float ir = irisSize * hgt * 0.5;

  float ang = atan(d.y, d.x);
  float rr = rd / max(ir, 1e-3); // 0 al centro, 1 sul bordo dell'iride
  // fibre radiali: due frequenze sfasate, con un lentissimo drift che tiene viva l'iride
  float fibers = 0.6 * (0.5 + 0.5 * sin(ang * 32.0 + time * 0.25))
               + 0.4 * (0.5 + 0.5 * sin(ang * 13.0 - 1.7 - time * 0.15));
  vec3 iris = irisColor * mix(0.55, 1.2, smoothstep(0.1, 1.0, rr));
  iris *= 0.7 + 0.6 * fibers * smoothstep(0.15, 0.85, rr);
  iris = mix(iris * 0.4, iris, smoothstep(0.0, 0.5, rr)); // alone scuro attorno alla pupilla
  iris = mix(iris, iris * 0.1, smoothstep(0.84, 1.0, rr)); // limbal ring
  float irisMask = 1.0 - smoothstep(ir - 0.012, ir + 0.006, rd);
  eyeCol = mix(eyeCol, iris, irisMask);

  // pupilla che respira lentamente
  float pr = ir * pupilSize * 0.9 * (1.0 + 0.09 * sin(time * 1.3));
  eyeCol = mix(eyeCol, vec3(0.015), 1.0 - smoothstep(pr - 0.01, pr + 0.006, rd));

  // riflessi speculari
  float hl = 1.0 - smoothstep(ir * 0.14, ir * 0.24, length(d - vec2(-0.36, 0.36) * ir));
  hl += 0.45 * (1.0 - smoothstep(ir * 0.08, ir * 0.15, length(d - vec2(0.34, -0.34) * ir)));
  eyeCol = mix(eyeCol, vec3(1.0), clamp(hl, 0.0, 1.0) * 0.9);

  // --- eyeliner: linea sulla palpebra superiore, più spessa verso la coda ---
  float lw = linerWidth * 0.028 * hgt * (0.55 + 1.1 * smoothstep(-0.8, 1.0, q.x));
  float liner = (1.0 - smoothstep(lw, lw + 0.02, abs(q.y - topL))) * xin;
  // coda alata: si stacca dalla palpebra prima dell'angolo e prosegue in fuori verso l'alto
  float tx = 0.82;
  vec2 tail = vec2(tx, 0.55 * hgt * pow(max(1.0 - tx * tx, 0.0), 0.6) * open);
  float wingLen = 0.3 + 0.25 * linerWidth;
  liner = max(liner, feStroke(q, tail, tail + vec2(0.78, 0.42) * wingLen,
                              linerWidth * 0.03 * hgt + 0.008));
  // linea d'acqua inferiore, sottile
  liner = max(liner, (1.0 - smoothstep(lw * 0.4, lw * 0.4 + 0.018, abs(q.y + botL))) * xin * 0.75);

  // --- ciglia: lunghe, inclinate verso l'esterno e più fitte sulla coda ---
  float above = q.y - topL;
  float lashSpan = lashLength * 0.35 * (0.5 + 0.75 * smoothstep(-0.9, 1.0, q.x));
  float sx = q.x - above * 0.5;
  float stripe = abs(fract(sx * 8.5) - 0.5) * 2.0;
  float taper = 1.0 - smoothstep(0.0, max(lashSpan, 1e-4), above);
  float lash = (1.0 - smoothstep(0.3 * taper + 0.02, 0.3 * taper + 0.3, stripe))
             * taper * step(0.0, above) * (1.0 - smoothstep(0.86, 0.99, abs(q.x)));
  // ciglia inferiori, corte e rade
  float below = -q.y - botL;
  float lowSpan = lashSpan * 0.32;
  float lowTaper = 1.0 - smoothstep(0.0, max(lowSpan, 1e-4), below);
  float lowStripe = abs(fract((q.x + below * 0.3) * 7.0) - 0.5) * 2.0;
  lash = max(lash, (1.0 - smoothstep(0.22 * lowTaper + 0.02, 0.22 * lowTaper + 0.3, lowStripe))
                   * lowTaper * step(0.0, below) * (1.0 - smoothstep(0.7, 0.92, abs(q.x))) * 0.8);

  float ink = clamp(max(liner, lash), 0.0, 1.0);

  // --- alone/ombretto: dà il tono da visual anche quando l'occhio è chiuso ---
  float halo = (1.0 - smoothstep(0.15, 1.15, length(vec2(q.x * 0.75, (q.y - 0.25 * hgt) / hgt)))) * glow;

  vec3 col = glowColor;
  float alpha = halo * 0.5;
  col = mix(col, eyeCol, shape);
  alpha = max(alpha, shape);
  col = mix(col, linerColor, ink);
  alpha = max(alpha, ink);
  // bagliore dell'iride, che tiene acceso l'occhio anche su sfondi carichi
  col += irisColor * irisMask * shape * glow * 0.45;

  return vec4(col, clamp(alpha, 0.0, 1.0));
}
