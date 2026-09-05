// NAME: Oscilloscope
// Traccia di un oscilloscopio pilotata dall'ingresso audio: il pennello disegna una polilinea
// sui campioni della forma d'onda, con fosforo che si spegne dietro la testa (persistence).
//
// `shape` sceglie COSA disegna il pennello, con morphing continuo fra una figura e la
// successiva: 0 traccia temporale, 1 cerchio, 2 rosa (fiore), 3 poligono, 4 stella, 5 piano XY.
// Nelle figure chiuse il suono non scuote una linea ma **increspa il contorno** (`waveDepth`):
// è così che restano riconoscibili — un cerchio resta un cerchio — e insieme reattive.
// In XY il secondo asse è la stessa onda letta con un ritardo, quindi le figure di Lissajous
// nascono anche da un ingresso mono, senza gestire due canali.
//
// Senza microfono aperto la forma d'onda è sintetica (vedi easyvj_wave nel wrapper): i
// parametri si regolano lo stesso, e la miniatura in playlist non resta vuota.
uniform float amplitude; // @min 0.0 @max 2.0 @default 0.9
uniform float autoGain; // @min 0.0 @max 1.0 @default 0.6
uniform float thickness; // @min 0.2 @max 8.0 @default 1.6
uniform float glow; // @min 0.0 @max 2.0 @default 0.8
uniform float shape; // @min 0.0 @max 5.0 @default 0.0
uniform float shapeSides; // @min 2.0 @max 12.0 @default 5.0
uniform float waveDepth; // @min 0.0 @max 1.0 @default 0.3
uniform float spin; // @min -2.0 @max 2.0 @default 0.0
uniform float xyDelay; // @min 0.002 @max 0.5 @default 0.08
uniform float span; // @min 0.05 @max 2.0 @default 1.0
uniform float sweep; // @min -2.0 @max 2.0 @default 0.25
uniform float persistence; // @min 0.0 @max 1.0 @default 0.35
uniform float traceSamples; // @min 24.0 @max 160.0 @default 84.0
uniform float reactivity; // @min 0.0 @max 2.0 @default 1.0
uniform float grid; // @min 0.0 @max 1.0 @default 0.25
uniform float gridDivs; // @min 2.0 @max 16.0 @default 8.0
uniform float jitter; // @min 0.0 @max 1.0 @default 0.0
uniform vec3 beamColor; // @default 0.35,1.0,0.55
uniform vec3 gridColor; // @default 0.12,0.40,0.22

float oscHash(float n) {
  return fract(sin(n * 127.1) * 43758.5453);
}

/** Distanza dal segmento a→b: la traccia è una polilinea, non una funzione y(x). */
float oscSegDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

/**
 * Raggio del contorno di una stella a `k` punte all'angolo `theta`, con lati DRITTI: è la
 * differenza dalla rosa, che ha invece petali arrotondati. Il contorno è una spezzata fra
 * vertici alternati (punta a raggio 1, rientranza a `inner`), e il raggio del lato corrente si
 * ricava dalla formula della retta per due punti in coordinate polari.
 */
float oscStarRadius(float theta, float k, float inner) {
  float seg = 3.14159265359 / k; // mezzo settore: da una punta alla rientranza successiva
  float a = mod(theta, 2.0 * seg);
  float rA = a < seg ? 1.0 : inner; // vertice iniziale del lato
  float rB = a < seg ? inner : 1.0; // vertice finale
  float t0 = a < seg ? a : a - seg; // angolo percorso dentro il lato
  float denom = rA * sin(t0) + rB * sin(seg - t0);
  return (rA * rB * sin(seg)) / max(denom, 1e-4);
}

/**
 * Una delle figure disegnabili, al parametro t (0..1). `w` è l'onda già normalizzata: nelle
 * figure chiuse moltiplica il raggio (il contorno respira col suono), nella traccia e nel
 * piano XY è direttamente una coordinata.
 */
vec2 oscFigure(float id, float t, float w1, float w2, float aspect, float time) {
  float theta = t * 6.28318530718 + spin * time;
  vec2 dir = vec2(cos(theta), sin(theta));
  float baseR = amplitude * 0.85;
  float radial = 1.0 + w1 * waveDepth;

  if (id < 0.5) {
    // traccia temporale: tempo sull'asse X, onda sull'asse Y
    return vec2((t - 0.5) * 2.0 * aspect, w1 * amplitude);
  }
  if (id < 1.5) {
    return dir * baseR * radial; // cerchio
  }
  if (id < 2.5) {
    // rosa polare: con |cos(k·θ/2)| i petali sono esattamente `shapeSides`, pari o dispari
    float k = max(floor(shapeSides), 2.0);
    float petal = abs(cos(k * theta * 0.5));
    return dir * baseR * (0.22 + 0.78 * petal) * radial;
  }
  if (id < 3.5) {
    // poligono regolare: raggio del bordo in coordinate polari (apotema / coseno dell'angolo
    // dentro il settore), così `shapeSides` = 3 dà il triangolo, 4 il quadrato e così via
    float k = max(floor(shapeSides), 3.0);
    float seg = 6.28318530718 / k;
    float r = cos(seg * 0.5) / max(cos(mod(theta, seg) - seg * 0.5), 1e-3);
    return dir * baseR * r * radial;
  }
  if (id < 4.5) {
    // stella a punte aguzze. La profondità delle rientranze scende al crescere delle punte:
    // con una decina di raggi una stella profonda diventa un riccio illeggibile
    float k = max(floor(shapeSides), 3.0);
    float inner = clamp(0.62 - 0.04 * k, 0.22, 0.5);
    return dir * baseR * oscStarRadius(theta, k, inner) * radial;
  }
  // piano XY: entrambi gli assi dall'onda, sfasati di xyDelay (phase plot)
  return vec2(w2, w1) * amplitude;
}

/**
 * Posizione del campione a t nello spazio isotropico del quad, con morphing continuo fra la
 * figura scelta e quella successiva: il costo è solo matematica, le due letture dell'onda
 * (le uniche cose care) restano condivise.
 */
vec2 oscPoint(float t, float time, float aspect, float gain, float window) {
  float w1 = easyvj_wave(t * span + window, time) * gain;
  float w2 = easyvj_wave(t * span + window + xyDelay, time) * gain;
  float s = clamp(shape, 0.0, 5.0);
  // Figure chiuse: l'ultimo campione deve ricongiungersi al primo, altrimenti resta lo scalino
  // del "retrace" — tollerabile su una traccia, brutto su un cerchio. Si dissolve la lettura in
  // quella di un giro prima: a t=1 vale esattamente il campione di t=0. Il fetch in più si paga
  // solo qui (il ramo dipende da un uniform, quindi traccia e piano XY non lo eseguono).
  if (s > 0.5 && s < 4.5) {
    w1 = mix(w1, easyvj_wave((t - 1.0) * span + window, time) * gain, t);
  }
  float id = floor(s);
  vec2 p = oscFigure(id, t, w1, w2, aspect, time);
  float blend = fract(s);
  if (blend > 0.001) p = mix(p, oscFigure(id + 1.0, t, w1, w2, aspect, time), blend);
  // tremolio analogico: il pennello di un CRT non è mai perfettamente fermo
  if (jitter > 0.001) {
    vec2 n = vec2(oscHash(t * 311.7 + time * 13.0), oscHash(t * 517.3 - time * 7.0));
    p += (n - 0.5) * jitter * 0.05;
  }
  return p;
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float aspect = max(uQuadAspect, 0.05);
  vec2 p = (uv - 0.5) * 2.0;
  p.x *= aspect; // spazio isotropico: le figure XY restano tonde qualunque sia il mapping

  float lvl = easyvj_level(time);
  // autoGain normalizza la scala sul volume misurato: un'uscita di linea dal mixer e un
  // microfono a tre metri dalle casse danno segnali di ampiezza diversissima, e senza questo
  // la traccia sarebbe fuori scala nel primo caso e un filo piatto nel secondo. reactivity
  // agisce dopo, ed è invece la manopola "quanto il volume gonfia la figura".
  // il fattore è limitato: senza tetto, una pausa del brano manderebbe la traccia fuori scala
  float norm = mix(1.0, clamp(0.42 / max(lvl, 0.12), 0.5, 2.5), clamp(autoGain, 0.0, 1.0));
  float gain = norm * (1.0 + reactivity * lvl);
  float window = time * sweep;                       // base dei tempi: scorre la finestra letta
  float head = fract(time * (0.35 + abs(sweep)));    // testa del pennello, per il fosforo

  float n = max(floor(traceSamples), 8.0);
  float w = max(thickness * 0.0035, 0.0004);         // semi-spessore del nucleo
  float gr = w * (1.5 + glow * 3.0);                 // raggio caratteristico dell'alone
  // oltre questa distanza in X un segmento non può illuminare il pixel: serve al taglio sotto
  float cull = gr * 4.5 + w * 2.0;
  // solo nella traccia pura la X dei campioni è nota senza leggere l'onda, quindi i segmenti
  // lontani si saltano PRIMA di campionare: è il numero di letture, non la matematica, a pesare.
  // Nelle figure chiuse il percorso si avvolge e il taglio non è applicabile.
  bool cullable = shape < 0.001;

  float core = 0.0;
  float halo = 0.0;
  vec2 prev = oscPoint(0.0, time, aspect, gain, window);
  bool prevStale = false;

  for (int i = 1; i <= 160; i++) {
    float fi = float(i);
    if (fi > n) break;
    float t = fi / n;
    if (cullable) {
      float xi = (t - 0.5) * 2.0 * aspect;
      if (abs(xi - p.x) > cull) {
        prevStale = true;
        continue;
      }
    }
    // rientrando dalla zona saltata il vertice precedente va ricostruito, altrimenti il primo
    // segmento utile partirebbe da un punto vecchio
    if (prevStale) {
      prev = oscPoint((fi - 1.0) / n, time, aspect, gain, window);
      prevStale = false;
    }
    vec2 cur = oscPoint(t, time, aspect, gain, window);
    float d = oscSegDist(p, prev, cur);
    // fosforo: quanto tempo è passato da quando il pennello ha scritto questo tratto
    float age = fract(head - t);
    float life = mix(1.0, exp(-age * 5.0), persistence);
    core = max(core, smoothstep(w, w * 0.25, d) * life);
    halo = max(halo, exp(-d / gr) * life);
    prev = cur;
  }

  // reticolo dello strumento, agganciato al quad (uv) e non allo spazio isotropico
  float gridTerm = 0.0;
  if (grid > 0.001) {
    float divs = max(floor(gridDivs), 2.0);
    vec2 gf = abs(fract(uv * divs) - 0.5) / divs;
    float lines = 1.0 - smoothstep(0.0, 0.0035, min(gf.x, gf.y));
    float axes = 1.0 - smoothstep(0.0, 0.006, min(abs(uv.x - 0.5), abs(uv.y - 0.5)));
    gridTerm = grid * (lines * 0.45 + axes * 0.9);
  }

  float beam = core * (1.1 + lvl * reactivity * 0.9) + halo * glow;
  vec3 col = beamColor * beam + gridColor * gridTerm;
  // alpha = quanto il pixel è acceso: fuori dalla traccia il layer resta trasparente, così
  // l'oscilloscopio si sovrappone in Add/Screen a ciò che sta sotto senza coprirlo di nero
  float a = clamp(max(beam, gridTerm), 0.0, 1.0);
  return vec4(col, a);
}
