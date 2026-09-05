// NAME: Kaleido Cloud Tunnel
// Adattato da uno shader Gaijin Entertainment (Shadertoy sctXDn) — licenza: uso libero non
// commerciale come prodotto a sé stante, nessun diritto sui marchi Gaijin. Vedi il link originale.
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float segments; // @min 2.0 @max 8.0 @default 3.0
uniform float cloudScale; // @min 0.2 @max 1.0 @default 0.45
uniform float fov; // @min 0.3 @max 1.5 @default 0.7
uniform float brightness; // @min 0.5 @max 3.0 @default 1.5
uniform float edgeStrength; // @min 0.0 @max 1.0 @default 0.7
uniform float aberration; // @min 0.0 @max 2.0 @default 1.0
uniform vec3 edgeHue; // @default 0.0,1.0,0.65

const float PI = 3.14159265358979;

// GLSL ES 1.00 (WebGL1) non ha tanh nativo: approssimazione stabile via exp, senza overflow
// perché l'esponente è sempre <= 0.
vec4 kctTanh(vec4 x) {
  vec4 e = exp(-2.0 * abs(x));
  return sign(x) * (1.0 - e) / (1.0 + e);
}

vec4 kctMarch(vec3 rayDir, mat2 worldRot, float marchTime) {
  vec4 accumulated = vec4(0.0);
  vec3 rayPos = vec3(0.0);
  float rayDist = 0.0;
  float stepSize = 0.0;
  for (float i = 1.0; i <= 30.0; i += 1.0) {
    rayPos = rayDir * rayDist;
    rayPos.z -= 10.0;
    vec2 rotatedXZ = worldRot * vec2(rayPos.x, rayPos.z);
    rayPos.x = rotatedXZ.x;
    rayPos.z = rotatedXZ.y;
    for (stepSize = 0.04; stepSize < 3.0; stepSize += stepSize) {
      rayPos += cos(2.0 * marchTime + rayPos.yzx / 10.0) * 0.6;
      rayPos -= abs(dot(sin(0.03 * rayPos.z + marchTime + rayPos / stepSize / 3.2), vec3(stepSize)));
    }
    rayPos.xy /= 4.0;
    stepSize = 0.08 + 0.5 * abs(length(rayPos) - 30.0);
    rayDist += stepSize;
    accumulated += vec4(3.9, 2.0, 1.0, 0.0) / stepSize * rayDist
      + 10.0 * (1.0 + cos(i * 0.4 + vec4(2.0, 1.0, 0.0, 0.0))) / stepSize;
  }
  return accumulated;
}

vec4 processColor(sampler2D tex, vec2 uvIn, float rawTime, vec2 resolution) {
  float time = rawTime * speed;
  vec2 uv = uvIn * 2.0 - 1.0;
  uv.x *= resolution.x / resolution.y;

  // sequenza di rivelazione a scatti: 15s di apertura, poi uno scatto di rotazione ogni 4s
  float stepDuration = 4.0;
  float firstStepDuration = 15.0;
  float animDuration = 0.5;
  float rotPerStep = PI / 3.0;
  bool inFirstStep = time < firstStepDuration;
  float stepIndex = inFirstStep ? 0.0 : (1.0 + floor((time - firstStepDuration) / stepDuration));
  float localTime = inFirstStep ? time : fract((time - firstStepDuration) / stepDuration) * stepDuration;
  float currentStepDur = inFirstStep ? firstStepDuration : stepDuration;
  float animProgress = clamp((localTime - (currentStepDur - animDuration)) / animDuration, 0.0, 1.0);
  float easedProgress = animProgress * animProgress * animProgress;
  float rotationPhase = sin(animProgress * PI);
  float mirrorAngle = mix(stepIndex * rotPerStep, (stepIndex + 1.0) * rotPerStep, easedProgress);

  float radius = length(uv);
  float period = 2.0 * PI / max(segments, 1.0);
  float foldAngle = atan(uv.y, uv.x) + PI * 0.5 + mirrorAngle;
  foldAngle = mod(foldAngle, period);
  foldAngle = abs(foldAngle - period * 0.5);

  uv = radius * vec2(cos(foldAngle - mirrorAngle * 2.0), sin(foldAngle - mirrorAngle * 2.0));
  uv *= mix(1.0, 1.25, rotationPhase);

  float slowTime = time / 20.0;
  vec4 rotCos = cos(slowTime + vec4(0.0, 33.0, 11.0, 0.0));
  mat2 worldRot = mat2(rotCos.x, rotCos.y, rotCos.z, rotCos.w);

  float flashDuration = 0.4;
  float flashFade = 1.0 - smoothstep(0.0, flashDuration, localTime);
  float aberrationAmount = mix(0.003, 0.02, flashFade) * aberration;
  float marchTime = time / 4.0;
  vec2 uvScaled = uv * cloudScale;

  // canale rosso campionato con un piccolo offset (aberrazione cromatica), verde/blu senza
  vec4 sampleR = kctMarch(normalize(vec3(uvScaled + vec2(0.0, aberrationAmount), fov)), worldRot, marchTime);
  vec4 sampleGB = kctMarch(normalize(vec3(uvScaled, fov)), worldRot, marchTime);
  vec4 color = vec4(sampleR.r, sampleGB.g, sampleGB.b, 1.0);

  float edgeBlend = clamp(smoothstep(0.0, 0.6, length(uv) / 2.0) * edgeStrength, 0.0, 1.0);
  vec4 edgeColor = vec4(color.b * edgeHue.r, color.g * edgeHue.g, color.r * edgeHue.b, 1.0);
  color = mix(color, edgeColor, edgeBlend);

  color = kctTanh(color * color / 9e8);

  vec3 shadowLift = vec3(0.02, 0.01, 0.0);
  color.rgb += shadowLift * (1.0 - color.rgb);

  float startFade = smoothstep(0.0, 3.0, time);
  float vigInnerRadius = mix(0.4, 0.1, rotationPhase);
  float vigOuterRadius = mix(1.8, 1.3, rotationPhase);
  float vignetteMask = 1.0 - smoothstep(vigInnerRadius, vigOuterRadius, radius);
  color *= vignetteMask;
  color *= brightness;
  color *= 1.0 + flashFade;
  color *= startFade;

  return vec4(color.rgb, 1.0);
}
