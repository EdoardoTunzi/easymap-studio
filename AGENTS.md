# EasyMap Studio

Webapp frontend per projection mapping e VJ live: l'utente carica una foto (PNG con sfondo rimosso) di una statua/palco/superficie, allinea la proiezione col corner-pin, applica shader GLSL ritagliati automaticamente dentro i bordi dell'immagine, e proietta da una finestra Output dedicata.

## Regole di lavoro (obbligatorie)

1. **Ogni modifica al codice va registrata in `MEMORY.md`** — una riga per modifica con data, cosa è stato fatto e perché. Aggiornare il file nella stessa sessione in cui si fa la modifica, mai rimandare.
2. **Dopo ogni modifica aggiornare `TODO.md`** — spuntare gli step completati e aggiungere eventuali nuovi step emersi.
3. Verificare sempre le modifiche visivamente nel browser (dev server + screenshot) prima di considerarle complete.
4. Rispondere e commentare sempre in italiano; identificatori di codice in inglese.

## Stack

- **React 19 + Vite 8 + TypeScript** — shell dell'app
- **Tailwind CSS v4** (plugin `@tailwindcss/vite`, import via `@import "tailwindcss"` in `index.css`)
- **Zustand** — stato globale (`src/store/projectStore.ts`, `src/store/effectsStore.ts`)
- **React Three Fiber / Three.js** — rendering GPU degli shader
- **idb** (IndexedDB) — persistenza progetti (`src/lib/persistence.ts`)
- **react-router-dom** — route `/control` (editor) e `/output` (finestra proiettore)
- **vite-plugin-pwa** — offline-first per uso live senza rete

## Architettura in breve

- **Due finestre sincronizzate** via `BroadcastChannel` (`src/lib/sync.ts`): Control pubblica lo stato, Output lo specchia; l'Output appena aperto invia `hello` per ricevere lo stato corrente.
- **Corner-pin**: i 4 angoli (ordine TL, TR, BL, BR, coerente con PlaneGeometry) vivono in `projectStore.corners` in coordinate mondo (frustum: half-height 1, half-width = aspect del canvas). Overlay drag: `src/components/Positioning/CornerPinOverlay.tsx`.
- **Maschera automatica**: il wrapper GLSL in `src/engine/isfParser.ts` moltiplica l'alpha finale per l'alpha della texture sorgente — ogni effetto è confinato dentro i bordi dell'immagine.
- **Shader ISF-like**: uniform float con commenti `@min @max @default` → slider UI auto-generati. Libreria in `src/shaders/*.glsl` (import con `?raw`).
- **Fit automatico**: solo su upload nuovo o richiesta esplicita (`requestFit()`), mai al ripristino di un progetto salvato (`src/engine/AutoFit.tsx`).

## Comandi

- `npm run dev` — dev server (la porta 5173 è spesso occupata: il server usa la porta assegnata via env `PORT`, vedi `.Codex/launch.json`)
- `npm run build` — type-check + build
- `npx tsc -b --noEmit` — solo type-check

## Trappole note

- **Canvas R3F nero/inerte (300x150) senza errori in console**: succede quando Vite ri-ottimizza le dipendenze a caldo (nuovo import di libreria → "optimized dependencies changed"). Non è un bug del codice: riavviare il dev server.
- L'HMR non ri-renderizza in modo affidabile i componenti dentro `<Canvas>` di R3F: dopo modifiche a componenti del canvas, verificare con un reload completo della pagina.
- La maschera usa il **canale alpha**: immagini con sfondo nero (non trasparente) non vengono ritagliate.
