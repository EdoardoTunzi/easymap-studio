// NAME: Synthetic Aperture Sun
// Interferenza di N sorgenti d'onda coerenti disposte su un anello (Shadertoy ldlSzX).
// L'originale pilota le modalità con la tastiera speciale di Shadertoy (iChannel2): a tasti non
// premuti il comportamento reale è MODE=4 (anello, spaziatura quasi-casuale) e display "energia"
// (il doppio ciclo di interferenza, non la somma semplice delle onde) — il MODE=5 dichiarato
// all'inizio del file è codice morto, sovrascritto subito dopo. Portato il comportamento di
// default realmente visibile, con gli switch da tastiera trasformati in slider.
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float sourceCount; // @min 4.0 @max 23.0 @default 23.0
uniform float distanceFalloff; // @min 0.0 @max 2.0 @default 1.0
uniform float waveMode; // @min 0.0 @max 1.0 @default 0.0 @step 1
uniform float randomSpacing; // @min 0.0 @max 1.0 @default 1.0 @step 1
uniform float driftSpeed; // @min 0.0 @max 2.0 @default 0.0
uniform float brightness; // @min 0.3 @max 3.0 @default 1.0
uniform vec3 tint; // @default 1.0,0.5,0.25

const int SA_N = 23;
const float SA_K = 2.0 * 3.14159 / 0.04;
const float SA_C = 0.1;

float saRnd(float i) {
  return mod(4000.0 * sin(23464.345 * i + 45.345), 1.0);
}
float saSrnd(float i) {
  return 2.0 * saRnd(i) - 1.0;
}

vec4 processColor(sampler2D tex, vec2 uv, float rawTime, vec2 resolution) {
  float t = rawTime * speed;
  vec2 uvp = (uv - 0.5) * 2.0;
  uvp.x *= resolution.x / resolution.y;

  // moto sintetico dell'attrattore (equivalente del ramo "mouse non premuto" dell'originale)
  vec2 mouse = vec2(1.5 * cos(0.2345 * t) - 0.7 * sin(t), sin(0.3214 * t) + 0.5 * cos(1.234 * t)) / 1.5;

  int n = int(sourceCount);
  float xt = -0.75 + driftSpeed * 0.03 * t;
  const float stp = 1.54 / float(SA_N);

  float Phi[SA_N];
  float D2[SA_N];
  for (int i = 0; i < SA_N; i++) {
    if (i >= n) break;
    vec2 P = 0.99 * vec2(sin(4.0 * xt), -cos(4.0 * xt));
    xt += (randomSpacing > 0.5) ? stp * (1.0 + 0.7 * saSrnd(float(i))) : stp;

    float dm = length(mouse - P);
    float phim = dm;
    float d = length(uvp - P);
    float phi = d - SA_C * t;
    Phi[i] = SA_K * (phi - phim);
    D2[i] = pow(max(d, 1e-4), distanceFalloff);
  }

  float v = 0.0;
  if (waveMode > 0.5) {
    // somma semplice delle onde: più economica, pattern più a "increspatura"
    for (int i = 0; i < SA_N; i++) {
      if (i >= n) break;
      v += cos(Phi[i]) / D2[i];
    }
  } else {
    // energia: interferenza vera fra ogni coppia di sorgenti (O(n^2)), il "sole" a diffrazione
    for (int i = 0; i < SA_N; i++) {
      if (i >= n) break;
      for (int j = 0; j < SA_N; j++) {
        if (j >= n) break;
        v += cos(Phi[j] - Phi[i]) / (D2[i] * D2[j]);
      }
    }
    v = sqrt(max(v, 0.0) / 2.0);
  }
  v = v * 4.5 / float(n);

  vec3 col = v * tint * brightness;
  return vec4(col, 1.0);
}
