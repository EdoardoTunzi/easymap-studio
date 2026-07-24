# MEMORY — Registro modifiche EasyVJ

Ogni modifica al progetto va registrata qui con data, descrizione e motivazione. Le voci più recenti in alto dentro ogni giornata.

## 2026-07-24 — Multi-layer (Fase A): scene = pila di layer indipendenti

Refactor architetturale grosso: lo stato "piatto" (un media, uno shader, una posizione, una palette) diventa una **scena = array ordinato di Layer**, ognuno unità completa e autonoma. Fedele al modello Resolume/MadMapper concordato con l'utente (vedi TODO Fase 2). Fase A = scaffold multi-layer + mixing; maschere (Fase B) e media dinamici gif/video (Fase C) restano da fare.

- **Nuovo `src/store/layersStore.ts`** = sorgente di verità unica. `Layer` = { id, name, visible, opacity, blendMode, media, lumaKey, shaderName, size, params (per-shader), palette, corners, transform }. Azioni per struttura (add/remove/duplicate/reorder/rename/select, setLayerVisible/Opacity/BlendMode) e per il layer attivo (setActive{Media,Shader,Size,Param,Corner(s),Transform,LumaKey} + palette). Helper `patchActive`. `setScene()` per persistence/sync. Sempre ≥1 layer.
- **`projectStore.ts` svuotato dello store**: resta solo modulo di tipi/helper geometrici (MediaAsset, Corner(s), Transform, computeContainCorners, DEFAULT_CORNERS/TRANSFORM). Motivo: media/corner/transform/lumaKey vivono ora nel layer.
- **`effectsStore.ts` ridotto** alla sola libreria shader globale (`shaders`) + costanti (DEFAULT_SIZE, DEFAULT_SHADER_NAME, defaultParamsFor). Shader attivo/size/params sono per-layer.
- **`paletteStore.ts` de-storizzato**: da store Zustand a modulo di costanti + tipo `Palette` + `createDefaultPalette()`/`clonePresetColors` esportati. La palette è per-layer.
- **`isfParser.ts`**: aggiunto uniform `uOpacity`; output ora **premoltiplicato** (`vec4(rgb*a, a)`). Necessario perché il compositing multi-layer usa `CustomBlending`: così opacità e blend mode (add/screen/multiply) si comportano correttamente e le zone mascherate (alpha 0) non inquinano i layer sotto.
- **`ShaderPlane.tsx` riscritto**: `ShaderPlane` mappa i layer → N `LayerMesh` impilate con `renderOrder = index` (0 = sfondo). Ogni mesh: geometria warpata dai suoi corner, texture dal suo media, uniform dal suo shader/palette letti live in useFrame via `getState`. `depthTest/Write=false` + `CustomBlending` (fattori per blend mode, equation Add). Key del materiale = `shaderName|blendMode` per ricompilare al cambio.
- **`AutoFit.tsx`**: adatta i corner del **layer attivo** (non più globali).
- **Pannelli agganciati al layer attivo**: EffectsPanel, PalettePanel, MovePanel, PositioningPanel, BackgroundKeyPanel, MediaUploader, CornerPinOverlay (guardie per corners/transform undefined).
- **Nuovo `src/components/Layers/LayersPanel.tsx`**: lista riordinabile via drag&drop (mostrata top-first = primo piano in cima), toggle occhio, duplica, elimina (disabilitato se resta 1 layer), rinomina, slider opacità, select blend mode. Nuova sezione toolbar "Layers" (icona lucide `Layers`), pannello di default.
- **`sync.ts`**: broadcast di `{ layers (blob strippati), activeLayerId }` → Output via `setScene`.
- **`persistence.ts` DB v3**: StoredProject ora ha `layers: StoredLayer[]` + `activeLayerId` (media serializzato come blob, url rigenerato al load). Upgrade v<3 svuota lo store `projects` (formato incompatibile). Effect preset = look del layer attivo (shader+params+size+palette), applicato al layer attivo. Autosave/restore basato su `isSceneEmpty()` (1 layer senza media).
- **`debug.ts`, `uiStore.ts` (+ tipo Panel 'layers'), `TopToolbar`, `ControlPage`** aggiornati.
- **Verificato nel browser** (porta 5188): type-check pulito; 2 layer con shader diversi (Plasma Bloom + 3D Surface Morph Spirals) e blend Add compositano correttamente; parametri per-layer indipendenti; finestra Output specchia i layer via BroadcastChannel.

## 2026-07-24 — Sidebar shadcn (Provider/Sidebar/Inset) + resize + collapse nativo

- **Installato il componente shadcn `sidebar`** (CLI: `add sidebar`, coerente con lo stile `radix-nova` già in `components.json`): porta `sidebar.tsx`, `use-mobile.ts`, `sheet.tsx`, `skeleton.tsx`.
- **Scoperta chiave sull'architettura shadcn sidebar**: nelle modalità collassabili reali (`offcanvas`/`icon`, il default), il componente usa `position: fixed inset-y-0` per il contenitore visivo — assume che la Sidebar occupi l'intera altezza del viewport, senza nulla sopra. Il nostro TopToolbar a piena larghezza sopra la riga sidebar+canvas andava quindi in conflitto (la sidebar fixed si sarebbe sovrapposta al toolbar).
- **Prima iterazione** (poi superata): usato `collapsible="none"` per evitare il conflitto, mantenendo TopToolbar sopra — ma l'utente ha chiesto esplicitamente anche il **pulsante di collapse nativo** (`SidebarTrigger`), che con `collapsible="none"` è inerte.
- **Architettura finale**: `SidebarProvider` avvolge l'intera pagina (non più annidato sotto TopToolbar). `Sidebar` (default `collapsible="offcanvas"`) è a tutta altezza a sinistra, con `SidebarHeader` che ora contiene il brand "EASYVJ" (spostato lì dal TopToolbar). `TopToolbar` (nav Move/Shader/Palette/Assets/Output + settings) si è spostato **dentro `SidebarInset`** insieme a `SidebarTrigger` — pattern standard delle dashboard shadcn (sidebar full-height + header locale nel content pane).
- **Resizable**: nessun supporto nativo shadcn per il resize (confermato via fetch della doc ufficiale). Creato `src/hooks/use-resizable-width.ts` (drag via Pointer Events su `window`, clamp min 240/max 520, persistito in localStorage) + `src/components/layout/SidebarResizeHandle.tsx` (striscia 8px sul bordo destro, si nasconde quando `useSidebar().state !== 'expanded'`). La larghezza pilota `--sidebar-width` passato come CSS var inline a `SidebarProvider`.
- **Bug fix importante — flex stretch rotto da `h-full`**: il wrapper `<div className="relative flex h-full shrink-0">` attorno a Sidebar+handle aveva altezza 0. Causa: `SidebarProvider` ha `min-h-svh` (min-height), non `height` esplicito; per lo spec CSS, `height:100%` su un figlio richiede che il genitore abbia un'altezza "specificata" in modo esplicito — `min-height` non conta, quindi `h-full` si risolve come se il genitore avesse altezza indefinita. Il flex stretch di default (`align-items:stretch`) invece funziona SOLO se la cross-size del figlio calcola `auto` — impostare `h-full` (che calcola a `100%`, non `auto`) disattiva lo stretch automatico. **Fix: rimosso `h-full`**, lasciando che lo stretch flex di default (nessuna classe di altezza) faccia il suo lavoro.
- **Bug fix minore — persistenza stale su drag rapidissimi**: `onUp` scriveva su localStorage leggendo un `ref` sincronizzato via `useEffect` (che flush in modo asincrono); su drag simulati molto rapidi (pointerdown+move+up nello stesso tick) il valore letto poteva essere quello di un update precedente. Fix: tracciare il valore più recente in una variabile locale sincrona dentro `onMove`, letta direttamente da `onUp` — indipendente dai tempi di render/effect di React.
- Verificato: collapse/espandi funziona, drag-resize aggiorna live style E localStorage in sync, persistenza sopravvive al reload, nessun errore console su /control e /output.

## 2026-07-23 — Preset degli effetti (salva/carica look)

- **Cosa**: salvare il "look" corrente come preset riusabile. Un preset cattura shaderName + parametri di quello shader + size globale + palette (enabled/colors/count/amount/activePreset). NON include media/posizionamento, così è riapplicabile su qualsiasi asset.
- **Persistence**: nuovo object store `effectPresets` in IndexedDB. **DB portato a versione 2** con upgrade incrementale (`if oldVersion < 1` crea projects, `if oldVersion < 2` crea effectPresets) → i DB esistenti degli utenti non perdono i progetti. Funzioni: `saveEffectPreset`, `loadEffectPreset`, `deleteEffectPreset`, `listEffectPresets`, + `applyEffectPreset`/`effectPresetSnapshot`.
- **UI `EffectPresetsPanel`**: in fondo al pannello Shader (sotto gli slider). Input nome + salva, lista preset con nome + shader di provenienza + carica/elimina.
- Verificato end-to-end: salvato "Mandala Fuoco" (Halo Mandala, size 1.8, petals 16, palette Fire), cambiato tutto, ricaricato → ripristino esatto; preset sopravvive al reload.

## 2026-07-23 — Sistema palette colori (gradient map globale)

Feature richiesta: poter scegliere/creare la palette colori per ogni shader, con preset fluorescenti caldi.

- **Approccio**: gradient map globale nel wrapper. Dopo `processColor`, si calcola la luminanza dell'effetto e la si mappa sulla palette scelta (`easyvj_gradient`), poi `mix` con l'originale per l'intensità. Universale: funziona su OGNI shader (generativi, source-driven, metallic, spirali) preservando la struttura ma cambiando i colori. Uniforms nel wrapper: `uPalette[5]`, `uPaletteCount`, `uPaletteAmount`, `uPaletteOn` (gradient con loop a indice costante per compatibilità WebGL1).
- **`paletteStore`**: enabled, colors[5] (RGB 0..1), count (2..5), amount (0..1), activePreset. 7 preset fluorescenti caldi: Neon Red, Jungle Green, Neon Blue, Dark Violet, Earth, Jungle, Fire (ognuno da scuro → acceso). `applyPreset` attiva anche la palette. `setColor` marca "Custom".
- **ShaderPlane**: uniforms palette inizializzati (array di 5 `THREE.Vector3`) e aggiornati ogni frame da paletteStore.
- **UI `PalettePanel`** (nuova tab toolbar "Palette", icona lucide): toggle on/off, anteprima gradiente CSS, griglia preset con swatch, 5 color picker nativi (`input type=color`) per creare palette al volo, slider "Numero colori" e "Intensità".
- Incluso in sync (BroadcastChannel → Output), persistence (snapshot/apply + autosave subscribe a paletteStore). Debug: esposti anche usePaletteStore e useUiStore in `window.__easyvj`.
- Verificato: Plasma → verde (Jungle Green), Halo Twin Vortex → viola (Dark Violet), sempre ritagliato sul soggetto. Nessun errore.
- **Nota UX**: la palette è globale (vale per lo shader attivo e tutti). Se in futuro serve una palette diversa memorizzata per-shader, va esteso il paletteStore.

## 2026-07-23 — Supporto uniform vec3 + fix 3D Surface Morph Spirals

- **3D Surface Morph Spirals** compilava ma era invisibile: ha un `uniform vec3 spiralColor` che il parser ISF (solo `float`) ignorava, quindi Three.js lo lasciava a `(0,0,0)` e `psyColor *= spiralColor` azzerava l'effetto.
- **Fix generale nel parser (`isfParser`)**: aggiunto `VEC3_RE` per gli uniform `vec3 nome; // @default r,g,b` → nuovo campo `ParsedShader.colorControls`. In `ShaderPlane` questi uniform vengono inizializzati con `new THREE.Vector3(...default)`. Così questo e ogni futuro shader MAPSHROOM con uniform colore renderizzano col loro default. Verificato: le due spirali psichedeliche ora si vedono, ritagliate sul soggetto.
- **Nota**: manca ancora una UI per cambiare i colori (color picker); per ora si usa il @default. (in TODO).

## 2026-07-23 — 10 varianti Halo Swirl + fix metallic3dFluid

### Fix metallic3dFluid.glsl
- Non compilava (schermo nero) perché usava `node_noise()` e `node_rand()`, funzioni fornite dal runtime MAPSHROOM/ISF ma non presenti nel nostro wrapper. Aggiunte le due funzioni (hash + value noise) direttamente nel file. Ora "Metallic 3D Fluid Shadows" renderizza correttamente.
- **Nota generale**: gli shader importati dall'app MAPSHROOM possono usare helper del loro runtime (`node_noise`, `node_rand`, ecc.) che qui vanno inclusi nel file .glsl.

### 10 varianti in stile Symmetrical Halo Swirl
- L'utente ne aveva 2 (`symmetricalHaloSwirl.glsl` + `symmetricalHaloSwirl-2.glsl`) e ha curato la lista rimuovendo alcuni dei generativi.
- Aggiunti 10 shader nello stesso stile (file `halo*.glsl`): Halo Radial Kaleido, Halo Mirror Bloom, Halo Spiral Drift, Halo Twin Vortex, Halo Petal Kaleido, Halo Liquid Symmetry, Halo Concentric Pulse, Halo Prismatic Swirl, Halo Mandala, Halo Fractal Bloom.
- **DNA condiviso dello stile**: campionano la texture sorgente, simmetria a specchio (`uv_sym = 0.5 + abs(uv.x-0.5)`) o quad/radiale, warp con swirl, colori da palette psichedelica, e soprattutto `blended = mix(source.rgb, col, intensity * smoothstep(0.0, 0.4, lum))` + `return vec4(blended, source.a)`. Questo blend per luminanza fa sì che l'effetto compaia solo sul soggetto e lo sfondo scuro resti tale → si "mascherano" naturalmente anche su asset con sfondo nero, come piace all'utente.
- Verificato: tutti i 27 shader compilano (compilazione fragment in WebGL), metallic e Halo Radial Kaleido testati visivamente su immagine a sfondo nero.

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
