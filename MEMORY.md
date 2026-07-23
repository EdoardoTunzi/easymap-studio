# MEMORY — Registro modifiche EasyVJ

Ogni modifica al progetto va registrata qui con data, descrizione e motivazione. Le voci più recenti in alto dentro ogni giornata.

## 2026-07-23 — Luma key per asset con sfondo nero opaco

### Problema segnalato dall'utente
Con l'asset reale, solo "Symmetrical Halo Swirl" appariva ritagliato; gli altri 22 shader riempivano tutto lo schermo. Causa: Halo Swirl **campiona la texture** e colora in base ad essa (lo sfondo nero resta nero → sembra mascherato), mentre gli shader generativi si affidano al **canale alpha**. L'immagine dell'utente ha lo sfondo **nero opaco** (alpha=1 ovunque), quindi la maschera alpha non ritaglia nulla.

### Soluzione: luma key
- **Wrapper (`isfParser`)**: aggiunto uniform `uLumaKey`. `mask = src.a`; se `uLumaKey > 0`, `mask *= smoothstep(0.0, uLumaKey, luma)` (luma = luminanza del pixel). Così le zone scure dell'immagine diventano trasparenti. La maschera usa sempre la uv originale.
- **`projectStore.lumaKey`** (default 0 = off) + `setLumaKey`, incluso in sync e persistence (con fallback 0 per progetti vecchi). Uniform `uLumaKey` aggiornato ogni frame in ShaderPlane.
- **Auto-rilevamento all'upload (`MediaUploader`)**: `isFullyOpaque()` disegna l'immagine ridotta (max 128px) su canvas e controlla l'alpha; se totalmente opaca → `setLumaKey(0.12)` automatico, altrimenti 0. Accettati anche i JPEG. Verificato: immagine con sfondo nero opaco → lumaKey 0.12 auto, effetto ritagliato sul soggetto per tutti gli shader.
- **UI (`BackgroundKeyPanel`)**: slider "Rimuovi sfondo scuro" (0–0.6, 0=off) nel pannello Assets, per regolare/attivare manualmente anche sull'immagine già caricata.

## 2026-07-23 — 22 shader psichedelici, size globale, fix maschera

### Libreria shader (22 nuovi + 1 esistente = 23)
- **`effectsStore` refactor**: gli shader si caricano automaticamente con `import.meta.glob('../shaders/*.glsl', {query:'?raw', eager:true})`, ordinati alfabeticamente. Basta aggiungere un `.glsl` in `src/shaders/` e appare nella libreria.
- Aggiunti 22 shader generativi in stile psichedelico (tutti compilano, verificato compilando ogni fragment in un contesto WebGL): Plasma Bloom, Kaleido Prism, Hypno Tunnel, Julia Dream, Kali Fractal, Voronoi Cells, Liquid Marble, Rainbow Spiral, Electric Web, Mandala Pulse, Acid Waves, Neon Rings, Warp Grid, Psy Flower, Melt Noise, Star Nest, Trippy Checker, Fractal Onion, Aurora Flow, Digital Vortex, Bubbling Metaballs, Interference Moire. Sono tutti puramente generativi (non campionano il media): la maschera alpha del wrapper li ritaglia da sola.

### Size globale dello shader
- **`effectsStore.size`** (default 1) + `setSize`, incluso in sync e persistence. Uniform `uScale` aggiunto in ShaderPlane e nel wrapper.
- **Wrapper (`isfParser`)**: la maschera usa SEMPRE `vUv` originale; l'effetto usa `fxUv = (vUv-0.5)/uScale + 0.5`. Così Size scala il pattern dell'effetto ma la forma dell'immagine non cambia mai. Aggiunto anche early-out `if (sourceAlpha <= 0.0) { gl_FragColor = vec4(0.0); return; }`.
- **Slider Size** nel pannello Shader (sopra i controlli per-shader, con Separator), valido per tutti gli effetti.

### Fix maschera persa al cambio shader (bug reale)
- Cambiando shader il `<shaderMaterial key={shader.name}>` si rimonta e l'uniform `uTexture` tornava al FALLBACK (alpha=1) → l'effetto riempiva tutto il quad invece di stare dentro i bordi. L'effect che carica la texture non ri-partiva (media invariato).
- **Fix in ShaderPlane**: la texture del media vive in `textureRef` persistente; l'effect di load aggiorna il ref; in `useFrame` si riassegna `uTexture = textureRef.current` ogni frame, così sopravvive al rimontaggio. Verificato: dopo aver ciclato più shader, Plasma Bloom resta ritagliato nella sagoma.

## 2026-07-23 — shadcn/ui, layout MAPSHROOM-style, controller Move

### File di tracciamento
- Creati `CLAUDE.md` (contesto + regole di lavoro obbligatorie: ogni modifica → MEMORY.md → TODO.md), `MEMORY.md`, `TODO.md` in root del progetto. Confermato che la root è la posizione corretta per CLAUDE.md (caricato automaticamente da Claude Code solo se in root).

### shadcn/ui
- **Installato shadcn/ui** (CLI: `init --template vite -b radix -p nova`) su Vite + Tailwind v4. Path alias `@`→`src` in `vite.config.ts` (resolve.alias) e in tsconfig (`paths`, senza `baseUrl` che è deprecato in TS 6). CSS variables e tema in `index.css` (riscritto dal CLI). Aggiunto `class="dark"` all'`<html>` in index.html per attivare i token scuri; rimosso l'override colore hardcoded dal blocco custom in index.css (restano solo height/overflow).
- Componenti aggiunti in `src/components/ui/`: button, slider, card, input, label, tabs, tooltip, separator, toggle, toggle-group, select, scroll-area. App avvolta in `<TooltipProvider>` in main.tsx.
- **Ricostruiti con shadcn** MediaUploader, EffectsPanel (Select+Slider), ProjectsPanel (Input+Button), OutputLauncher, PositioningPanel — tutti con icone lucide-react.
- Nota: dopo l'aggiunta dei pacchetti Radix, Vite ha ri-ottimizzato le deps a caldo causando "Invalid hook call" (doppia copia di React). Risolto riavviando il dev server (stessa classe di problema già documentata per idb).

### Layout ispirato a MAPSHROOM (solo struttura, colori dopo)
- **Creato `src/store/uiStore.ts`**: pannello attivo (`move|shader|assets|output`).
- **Creato `src/components/layout/TopToolbar.tsx`**: top bar con logo EASYVJ + nav MOVE/SHADER/ASSETS/OUTPUT (icone lucide) + settings. Il pulsante attivo cambia il contenuto del pannello sinistro.
- **Riscritto `ControlPage`**: colonna [TopToolbar | (sidebar sinistra con ScrollArea che mostra il pannello attivo) + canvas centrale]. Sidebar con header di sezione.

### Controller Move (posizione + zoom)
- **`projectStore`**: aggiunto `transform {zoom, offsetX, offsetY}` (default 1/0/0) applicato all'intero mesh via `<group position scale>` in ShaderPlane, sopra il corner-pin warp. Funzioni `setTransform`/`resetTransform`. Incluso in `sync.ts` (payload broadcast) e in `persistence.ts` (snapshot/apply, con fallback `DEFAULT_TRANSFORM` per progetti vecchi).
- **Creato `src/components/Positioning/MovePanel.tsx`**: pad direzionale 3x3 (pan ±0.05), centra, slider zoom 0.1–4 con pulsanti +/-, reset. Componenti shadcn.
- **`CornerPinOverlay` aggiornato**: le maniglie ora sono disegnate sulla posizione *renderizzata* (base·zoom+offset) e il drag inverte il transform (÷zoom) — così gli angoli seguono l'immagine anche con zoom/pan attivi. Aggiunto `overflow-hidden` al `<main>` per non far sbordare le maniglie sopra la sidebar quando un angolo esce dal canvas. Verificato numericamente (a zoom 0.5 le maniglie si avvicinano al centro).

## 2026-07-23 — Sessione iniziale: scaffolding → persistenza

### Persistenza progetti (IndexedDB)
- **Creato `src/lib/persistence.ts`**: DB `easyvj` via `idb`, store `projects`. Autosave con debounce 600ms su slot `__autosave__`, ripristino all'avvio della Control page, salvataggi manuali con nome (save/load/delete/list). Il media è salvato come Blob perché i blob URL non sopravvivono al refresh.
- **Creato `src/components/ControlPanel/ProjectsPanel.tsx`**: pannello sidebar con input nome + Salva, lista progetti con load/delete.
- **Fix race restore-vs-upload**: il ripristino autosave ricontrolla `media == null` anche dopo l'await IDB, per non sovrascrivere un upload fatto nel frattempo.
- **Aggiunto campo `blob` a `MediaAsset`** (projectStore) e escluso dal payload BroadcastChannel in `sync.ts` (il blob serve solo alla persistenza locale).
- **Creato `src/lib/debug.ts`** (dev-only): espone gli store in `window.__easyvj` per ispezione da console.
- **Debug canvas R3F morto**: dopo l'introduzione di `idb`, Vite ha ri-ottimizzato le deps a caldo rompendo silenziosamente il mount dei child di `<Canvas>` (canvas fermo a 300x150, zero errori). Risolto riavviando il dev server. Documentato in CLAUDE.md → Trappole note.

### AutoFit ripensato
- **`src/engine/AutoFit.tsx`**: il fit dei corner avviene solo su richiesta esplicita (`requestFit()`: chiamato da upload nuovo e dal pulsante "Reset posizione"), non più al cambio media — così i progetti ripristinati mantengono i corner salvati. Fix precedente: il calcolo usa il frustum reale della camera (half-width = aspect canvas, half-height = 1), non `viewport` di R3F che ignora il frustum custom.

### Maschera alpha automatica
- **`src/engine/isfParser.ts`**: il fragment shader wrapper moltiplica l'alpha del colore finale per l'alpha della texture sorgente → ogni shader è ritagliato automaticamente dentro i bordi dell'immagine caricata, indipendentemente da come gestisce l'alpha internamente. (Richiesta esplicita dell'utente: "l'effetto solo all'interno dei bordi dell'immagine".)

### Corner-pin editor
- **Creato `src/components/Positioning/CornerPinOverlay.tsx`**: overlay SVG+div sopra il canvas della Control page — 4 maniglie trascinabili agli angoli, drag del poligono per pan. Conversioni schermo↔mondo coerenti col frustum della camera.
- **Creato `src/components/Positioning/PositioningPanel.tsx`**: istruzioni + pulsante "Reset posizione".
- **`projectStore` ristrutturato**: rimosso il vecchio `transform` (x/y/scale/rotation) in favore dei soli `corners` (il corner-pin copre tutto); ordine TL,TR,BL,BR coerente con PlaneGeometry.

### Sync Control ↔ Output
- **`src/lib/sync.ts`**: handshake `hello` → una finestra Output aperta dopo i cambi di stato richiede e riceve lo stato corrente (prima mostrava lo stato di default).

### Scaffolding iniziale
- Progetto Vite + React 19 + TS; installati zustand, three, @react-three/fiber, @react-three/drei, idb, vite-plugin-pwa, react-router-dom, tailwindcss v4 (@tailwindcss/vite), @types/three.
- Config PWA in `vite.config.ts` (manifest EasyVJ, autoUpdate); `server.port` legge env `PORT` con `strictPort` (porta 5173 spesso occupata da altro processo).
- Struttura `src/`: components/{ControlPanel,Positioning,EffectsLibrary}, engine, store, lib, shaders, routes/{control,output}.
- **`src/engine/isfParser.ts`**: parser degli uniform `@min @max @default` → controlli UI auto-generati; wrapper vertex/fragment per Three.js.
- **`src/engine/ShaderPlane.tsx`**: mesh 4 vertici con posizioni = corners (warp), texture dal media con fallback, uniform aggiornati per-frame da `effectsStore`; `DoubleSide` per winding invertiti durante il drag.
- **`src/engine/StageCanvas.tsx`**: canvas R3F condiviso; `ResponsiveCamera` ortografica con frustum aspect-corretto (fix distorsione tra finestre con aspect diversi).
- **`src/shaders/symmetricalHaloSwirl.glsl`**: primo shader (fornito dall'utente, troncato nell'originale — completato in modo minimale per compilare).
- **Route** `/control` e `/output`; `/` reindirizza a `/control`. Output = canvas fullscreen pulito.
- Store Zustand: `projectStore` (media, corners, fit), `effectsStore` (shader, parametri live).
- UI base: MediaUploader (PNG/WebP con alpha), EffectsPanel (select shader + slider generati), OutputLauncher (window.open /output).
