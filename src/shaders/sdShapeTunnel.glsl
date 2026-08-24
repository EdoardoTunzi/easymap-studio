// NAME: SD Shape Tunnel
// Il PROFILO ESTERNO della sagoma, replicato in copie sempre più piccole che collassano verso il
// centro dell'oggetto: un tunnel fatto con la forma dell'asset stesso.
//
// Come funziona: la copia numero i è la sagoma scalata di s(i) attorno al centro, quindi per
// sapere se il pixel corrente le appartiene basta campionare la texture al punto "de-scalato"
// p = centro + (uv - centro) / s. Nessun passaggio extra, nessuno stato: tutto il tunnel si
// disegna in un solo fragment, un pugno di campioni per copia.
//
// Costo: ogni copia attiva sono 6 prelievi di texture per pixel. Con "copie" a 40 il conto sale a
// ~240 — se in Output il frame rate cala, è il primo slider da abbassare.
//
// Come tutta la famiglia SD campiona su vUv (la uv ORIGINALE del layer) e non su quella
// trasformata: la copia più grande deve coincidere ESATTAMENTE con la sagoma proiettata, quindi
// Size/pan/kaleido globali non la spostano. Un contorno che scivola via dalla forma non serve.
uniform float rings; // @min 3.0 @max 40.0 @default 10.0 @step 1.0
uniform float ringDistance; // @min 0.05 @max 1.0 @default 1.0
uniform float speed; // @min 0.0 @max 4.0 @default 0.5
uniform float cycleMode; // @min 0.0 @max 1.0 @default 0.0 @step 1.0 @options continuo|a blocco
uniform float perspective; // @min 0.0 @max 1.0 @default 0.0
uniform float lineWidth; // @min 0.5 @max 24.0 @default 4.0
uniform float holeFill; // @min 0.0 @max 60.0 @default 0.0
uniform float lineGain; // @min 0.0 @max 4.0 @default 1.6
uniform float lineSharp; // @min 0.5 @max 6.0 @default 1.6
uniform float fade; // @min 0.0 @max 1.0 @default 0.75
uniform float glow; // @min 0.0 @max 3.0 @default 0.0
uniform float twist; // @min -3.14 @max 3.14 @default 0.0
uniform float centerX; // @min -0.5 @max 0.5 @default 0.0
uniform float centerY; // @min -0.5 @max 0.5 @default 0.0
uniform float minScale; // @min 0.0 @max 0.6 @default 0.0
uniform float shapeKey; // @min 0.0 @max 0.5 @default 0.05
uniform float sourceAmount; // @min 0.0 @max 1.0 @default 0.0
uniform vec3 nearColor; // @default 0.35,0.85,1.0
uniform vec3 farColor; // @default 1.0,0.35,0.85

/** Numero massimo di copie: il limite del loop deve essere costante in GLSL ES 1.0. */
#define ST_MAX_RINGS 40
/** Scala minima consentita: sotto, la copia è più piccola di un pixel e il bordo esplode. */
#define ST_MIN_SCALE 0.02

float stLum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

/**
 * Sagoma dell'oggetto: alpha del PNG scontornato, più — se `shapeKey` > 0 — le zone scure
 * trattate come vuoto, perché molti asset sono RGB con lo sfondo semplicemente nero e lì
 * l'alpha vale 1 ovunque (stessa logica di SD Edge Pulse; si usa il più permissivo fra shapeKey
 * e il luma key del layer, per non contraddire la maschera).
 *
 * Fuori dall'intervallo uv la sagoma NON esiste: senza questo controllo il wrap ClampToEdge
 * ripeterebbe i texel di bordo all'infinito e ogni copia rimpicciolita si porterebbe dietro
 * quattro strisce che escono dal quadro.
 */
float stShape(sampler2D tex, vec2 p) {
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return 0.0;
  vec4 s = texture2D(tex, p);
  float key = max(shapeKey, uLumaKey);
  if (key <= 0.0) return s.a;
  return s.a * smoothstep(0.0, key, stLum(s.rgb));
}

/**
 * Quanto il punto è vicino al PROFILO della sagoma: 0 nel pieno e nel vuoto, →1 sul bordo.
 *
 * Si misura come media della sagoma su un anello di raggio `w`: nel pieno vale 1, nel vuoto 0,
 * a cavallo del contorno circa 0.5 — quindi `1 - |2m - 1|` è una banda centrata sul bordo e
 * larga ~2w, senza gradini e senza direzione privilegiata. Un gradiente a differenze centrali
 * darebbe invece una riga spessa un texel, che sul proiettore sparisce.
 *
 * L'anello è tondo *a schermo*: la x è divisa per l'aspect del quad, altrimenti su un mapping
 * largo il contorno risulterebbe più spesso sui fianchi che sopra e sotto.
 */
float stRim(sampler2D tex, vec2 p, float w, float aspect) {
  float acc = 0.0;
  for (int i = 0; i < 6; i++) {
    float a = float(i) * 1.04719755; // 60°
    vec2 o = vec2(cos(a) / aspect, sin(a)) * w;
    acc += stShape(tex, p + o);
  }
  float m = acc / 6.0;
  return clamp(1.0 - abs(2.0 * m - 1.0), 0.0, 1.0);
}

/**
 * Quanto il punto è "immerso" nell'oggetto: media della sagoma su un anello LARGO di raggio `r`.
 *
 * Serve a distinguere i due tipi di bordo, che `stRim` da solo non sa separare — per lui una
 * finestra dentro il palco e il profilo del palco sono la stessa transizione pieno/vuoto:
 *   - profilo ESTERNO: metà dell'anello grande cade nel vuoto attorno all'oggetto → ~0.5 o meno;
 *   - bordo di un foro o di un dettaglio INTERNO: l'anello grande è quasi tutto dentro la
 *     sagoma, perché il foro è più piccolo del raggio → verso 1.
 * Da qui la soglia in `holeFill`: si tengono i bordi con immersione bassa.
 *
 * Il limite è dichiarato dal raggio stesso: un foro più grande di `r` ha un bordo che localmente
 * è indistinguibile da un profilo esterno, e resta. È il motivo per cui il controllo è un raggio
 * e non un interruttore — si alza finché i dettagli da togliere spariscono.
 */
float stFill(sampler2D tex, vec2 p, float r, float aspect) {
  float acc = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.78539816; // 45°
    vec2 o = vec2(cos(a) / aspect, sin(a)) * r;
    acc += stShape(tex, p + o);
  }
  return acc / 8.0;
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float aspect = max(uQuadAspect, 0.05);
  vec2 texel = 1.0 / max(resolution, vec2(1.0));
  // centro del collasso: baricentro della sagoma (uniform globale, pesato sull'alpha) più lo
  // scostamento manuale. Il default cade quindi dentro l'oggetto anche quando è decentrato.
  vec2 center = uShapeCentroid + vec2(centerX, centerY);

  float ringCount = max(floor(rings + 0.5), 1.0);
  float phase = time * speed;
  float f = fract(phase);

  float smin = max(minScale, ST_MIN_SCALE);
  vec3 col = vec3(0.0);
  float amp = 0.0;

  for (int i = 0; i < ST_MAX_RINGS; i++) {
    if (float(i) > ringCount - 0.5) break;
    float offset = float(i) / ringCount;
    // v = a che punto è la copia del PROPRIO giro, 0 (nasce) → 1 (finisce). È la progressione
    // relativa, la stessa in tutte le configurazioni: da qui nascita e morte.
    //
    // continuo: le copie si susseguono a intervalli regolari e il flusso non si interrompe mai —
    //   appena una finisce, un'altra nasce sul bordo.
    // a blocco: le copie nascono UNA DOPO L'ALTRA dal bordo nella prima metà del ciclo e ognuna
    //   percorre il tunnel nella metà successiva. Verso la fine il quadro si svuota (le prime
    //   sono già sparite, non ne nascono di nuove), poi la sequenza riparte dal bordo. Fuori dal
    //   proprio intervallo di vita la copia non esiste: si salta, così non costa nemmeno un
    //   prelievo di texture.
    float v;
    if (cycleMode < 0.5) {
      v = fract(phase + offset);
    } else {
      v = (f - offset * 0.5) / 0.5;
      if (v < 0.0 || v > 1.0) continue;
    }

    // u = quanto la copia ha percorso del tunnel: 0 sul bordo (sagoma piena), 1 al centro.
    //
    // `ringDistance` è la PROFONDITÀ del percorso, ed è così che regola la distanza fra le copie:
    // a parità di numero, accorciare il tratto le avvicina. A 1 il tunnel arriva fino al centro;
    // sotto, le copie svaniscono a mezza strada e restano più fitte fra loro.
    //
    // Il primo tentativo comprimeva invece gli *offset* di partenza (`i * ringDistance / N`):
    // matematicamente le avvicinava, ma le raggruppava in un plotone seguito da un vuoto rotante,
    // e in "continuo" il risultato era indistinguibile da "a blocco" — cioè il selettore delle due
    // modalità sembrava non funzionare più. Con la profondità il flusso resta continuo a qualsiasi
    // distanza, e le due modalità tornano distinguibili.
    float u = v * ringDistance;

    // scala: lineare = velocità costante; prospettica = progressione geometrica, cioè la copia
    // accelera avvicinandosi al centro e la spaziatura si stringe come in un tunnel vero
    float s = mix(mix(1.0, smin, u), pow(smin, u), perspective);
    s = max(s, ST_MIN_SCALE);

    // de-scalatura attorno al centro, con la torsione progressiva (ogni copia più ruotata della
    // precedente). La rotazione avviene in spazio schermo — x moltiplicata per l'aspect —
    // altrimenti su un quad non quadrato la sagoma si deformerebbe ruotando.
    vec2 q = (vUv - center) * vec2(aspect, 1.0);
    float a = twist * u;
    q = vec2(cos(a) * q.x - sin(a) * q.y, sin(a) * q.x + cos(a) * q.y);
    vec2 p = center + q / vec2(aspect, 1.0) / s;

    // spessore costante a schermo: in spazio sorgente va diviso per la scala della copia.
    // Il clamp evita che sulle copie minuscole la banda inghiotta l'intera texture.
    float w = min(lineWidth * texel.y / s, 0.5);
    float rim = stRim(tex, p, w, aspect);

    // "solo contorno esterno": spegne i bordi che stanno DENTRO l'oggetto — fori, finestre,
    // dettagli della texture — e lascia il solo profilo della silhouette. A 0 il controllo è
    // spento e non costa nulla; sopra, sono 8 prelievi in più per copia.
    if (holeFill > 0.0) {
      float r = min(holeFill * texel.y / s, 0.5);
      rim *= 1.0 - smoothstep(0.60, 0.86, stFill(tex, p, r, aspect));
    }

    float band = pow(rim, lineSharp) * lineGain;
    // alone: stessa distanza dal bordo, esponente più basso → sfuma più lontano dalla linea
    float halo = pow(rim, lineSharp * 0.35) * glow * 0.5;

    // Nascita e morte: la nascita è quasi istantanea di proposito. Con una rampa lunga la copia
    // diventava visibile solo dopo aver già percorso un pezzo di tunnel, e il primo contorno
    // sembrava comparire *dentro* la sagoma invece che sul suo bordo. A u = 0 la copia coincide
    // esattamente con la silhouette, ed è lì che deve accendersi: il pop non si vede perché la
    // maschera del layer taglia comunque tutto sul contorno. La morte resta morbida, altrimenti
    // le copie sparirebbero di scatto al centro.
    // Si misura su `v`, non su `u`: con un tunnel corto (`ringDistance` basso) la copia finisce
    // il proprio giro a metà strada, e una dissolvenza legata alla profondità non scatterebbe mai
    // — le copie sparirebbero di colpo.
    float life = smoothstep(0.0, 0.02, v) * (1.0 - smoothstep(0.86, 1.0, v));
    float dim = mix(1.0, 1.0 - u, fade);
    float amount = (band + halo) * life * dim;

    col += mix(nearColor, farColor, u) * amount;
    amp = max(amp, clamp(amount, 0.0, 1.0));
  }

  vec4 source = texture2D(tex, vUv);
  col += source.rgb * sourceAmount;

  // alpha = quanto il pixel è acceso: fuori dalle linee il layer resta trasparente, così il
  // tunnel si sovrappone in Add/Screen senza coprire i layer sotto con un rettangolo nero
  float peak = max(max(col.r, col.g), col.b);
  float outA = clamp(max(max(sqrt(clamp(peak, 0.0, 1.0)), amp), sourceAmount), 0.0, 1.0);
  return vec4(col, outA);
}
