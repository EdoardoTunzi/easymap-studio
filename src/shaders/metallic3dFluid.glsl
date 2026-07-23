// NAME: Metallic 3D Fluid Shadows
uniform float patternScale; // @min 5.0 @max 50.0 @default 25.0
uniform float speed; // @min 0.0 @max 2.0 @default 0.4
uniform float colorIntensity; // @min 0.0 @max 1.0 @default 0.8
uniform float bgThreshold; // @min 0.0 @max 0.5 @default 0.05
uniform float edgeWidth; // @min -0.8 @max 0.8 @default 0.0
uniform float dotSize; // @min 2.0 @max 30.0 @default 6.0
uniform float noiseIntensity; // @min 0.0 @max 2.0 @default 0.6
uniform float metallic; // @min 0.0 @max 2.0 @default 1.2
uniform float glossiness; // @min 0.0 @max 1.0 @default 0.8

// Helper mancanti: nell'ambiente MAPSHROOM/ISF originale node_rand/node_noise sono forniti
// dal runtime; qui il wrapper non li definisce, quindi vanno inclusi nel file.
float node_rand(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float node_noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(node_rand(i), node_rand(i + vec2(1.0, 0.0)), u.x),
               mix(node_rand(i + vec2(0.0, 1.0)), node_rand(i + vec2(1.0, 1.0)), u.x), u.y);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
    vec4 source = texture2D(tex, uv);
    float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
    
    // Strict threshold to isolate the statue and keep the background pure black
    float statueMask = smoothstep(bgThreshold, bgThreshold + 0.02, lum) * source.a;
    
    // Base coordinates for warping
    vec2 p = uv * patternScale;
    p *= (0.8 + 0.4 * lum);
    
    // Create a second set of coordinates for the opposite-oriented dots
    vec2 p_inv = p;
    
    // Slowly rotate the colored pattern in random directions
    float rotAngle = time * 0.1 + node_noise(vec2(time * 0.05, 0.0)) * 4.0;
    mat2 rot = mat2(cos(rotAngle), -sin(rotAngle), sin(rotAngle), cos(rotAngle));
    p = rot * p;
    
    // Iterative warping to create labyrinthine/coral Turing patterns
    for(int i = 0; i < 6; i++) {
        float t = time * speed;
        
        // Forward warp for the main colored pattern
        p = vec2(
            p.x + 0.65 * sin(p.y * 1.3 + t),
            p.y + 0.65 * cos(p.x * 1.3 - t * 0.8)
        );
        
        // Inverse warp for the dot noise (orienting it the opposite way)
        p_inv = vec2(
            p_inv.x - 0.65 * sin(p_inv.y * 1.3 + t),
            p_inv.y - 0.65 * cos(p_inv.x * 1.3 - t * 0.8)
        );
    }
    
    // Calculate pattern value and its analytical derivatives for bump mapping
    float val = sin(p.x) * cos(p.y);
    float dx = cos(p.x) * cos(p.y);
    float dy = -sin(p.x) * sin(p.y);
    
    float pattern = smoothstep(edgeWidth - 0.1, edgeWidth + 0.1, val);
    
    // Generate shifting psychedelic colors based on the pattern, time, and position
    vec3 psychColor = vec3(
        0.5 + 0.5 * sin(pattern * 3.14 + time * 1.5 + uv.x * 5.0),
        0.5 + 0.5 * sin(pattern * 3.14 + time * 1.8 + uv.y * 5.0 + 2.0),
        0.5 + 0.5 * sin(pattern * 3.14 + time * 1.2 + (uv.x + uv.y) * 5.0 + 4.0)
    );
    
    // Create dark, intensive noise made of a pixel-based grid of dots using inversely warped coordinates
    vec2 dotGridUv = (p_inv / patternScale) * (resolution.xy / dotSize);
    vec2 dotGrid = fract(dotGridUv) - 0.5;
    float dots = 1.0 - smoothstep(0.2, 0.35, length(dotGrid));
    
    // Add randomness to the dots (removed time from seed to prevent flashing/strobing)
    float randomIntensity = node_rand(floor(dotGridUv));
    dots *= 0.3 + 0.7 * randomIntensity;
    
    vec3 darkDotNoiseEffect = source.rgb * dots * noiseIntensity;
    
    // Base color mix
    vec3 baseColor = mix(darkDotNoiseEffect, source.rgb * psychColor * 2.5, pattern * colorIntensity);
    
    // --- Metallic & Glossy Lighting Calculation ---
    vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfVector = normalize(lightDir + viewDir);
    
    // Create a pseudo-normal from the pattern derivatives
    vec3 normal = normalize(vec3(dx, dy, 1.5 - min(metallic, 1.4)));
    
    // Self-shadowing based on pattern height differences towards the light source
    vec2 lightOffset = lightDir.xy * 0.8;
    float shadowVal = sin(p.x + lightOffset.x) * cos(p.y + lightOffset.y);
    float shadow = smoothstep(-0.3, 0.7, val - shadowVal + 0.4);
    
    // Diffuse shading with shadow applied
    float diffuse = max(dot(normal, lightDir), 0.0) * shadow;
    
    // Specular highlight (Glossiness) with shadow applied
    float specPower = mix(5.0, 100.0, glossiness);
    float specular = pow(max(dot(normal, halfVector), 0.0), specPower) * metallic * 1.5 * shadow;
    
    // Fake environment reflection
    float envRefl = node_noise(normal.xy * 4.0 + time * 0.2);
    vec3 reflection = vec3(envRefl) * metallic * 0.4;
    
    // Combine lighting with base color
    vec3 statueEffect = baseColor * (0.2 + 0.8 * diffuse) + specular + (reflection * baseColor);
    
    // Blend the statue effect over a pure black background using the strict mask
    vec3 finalColor = mix(vec3(0.0), statueEffect, statueMask);
    
    // Output final color, preserving original alpha for transparency
    return vec4(finalColor, source.a);
}