# EasyMap Studio

Webapp frontend per projection mapping e VJ live: l'utente carica una foto (PNG con sfondo rimosso) di una statua/palco/superficie, allinea la proiezione col corner-pin, applica shader GLSL ritagliati automaticamente dentro i bordi dell'immagine, e proietta da una finestra Output dedicata.

## Regole di lavoro (obbligatorie)

1. **Ogni modifica al codice va registrata in `MEMORY.md`** — una riga per modifica con data, un breve e concisa descrizione di cosa è stato fatto e perché. Aggiornare il file nella stessa sessione in cui si fa la modifica, mai rimandare.
2. **Dopo ogni modifica aggiornare `TODO.md`** — spuntare gli step completati e aggiungere eventuali nuovi step emersi.
3. Se la modifica è corposa, chiedere sempre se verificare le modifiche visivamente nel browser (dev server + screenshot) prima di considerarle complete.
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

- `npm run dev` — dev server (la porta 5173 è spesso occupata: il server usa la porta assegnata via env `PORT`, vedi `.claude/launch.json`)
- `npm run build` — type-check + build
- `npx tsc -b --noEmit` — solo type-check

## Trappole note

- **Canvas R3F nero/inerte (300x150) senza errori in console**: succede quando Vite ri-ottimizza le dipendenze a caldo (nuovo import di libreria → "optimized dependencies changed"). Non è un bug del codice: riavviare il dev server.
- L'HMR non ri-renderizza in modo affidabile i componenti dentro `<Canvas>` di R3F: dopo modifiche a componenti del canvas, verificare con un reload completo della pagina.
- La maschera usa il **canale alpha**: immagini con sfondo nero (non trasparente) non vengono ritagliate.
- **Camera che non si attiva**: quasi sempre è il permesso, non il codice. Un tentativo fallito lascia l'origine bloccata in Chrome e i successivi falliscono all'istante senza prompt (`NotAllowedError`); su macOS l'autorizzazione di sistema alla fotocamera ha effetto solo dopo aver riavviato il browser. Il pannello "Ingresso video live" ha la diagnostica in-app ("Perché non si attiva?") che distingue permesso bloccato, contesto non sicuro (app aperta dall'IP di rete invece che da localhost), device occupato e nessuna camera vista.
- Le cache degli stream/texture della camera vivono nei moduli `src/lib/cameraSources.ts` e `src/engine/mediaTexture.ts`: entrambi forzano un reload completo invece dell'hot-replace, altrimenti in sviluppo i componenti montati restano agganciati a cache orfane (immagine congelata, device occupato).
- **Righe oblique che lampeggiano sulle tinte piatte**: è la **grana** del pannello Output alzata, non un bug del motore. È temporale (si rigenera a ogni frame, quindi lampeggia) e usa `hash(sin(dot(p, vec2(12.9898, 78.233))))`, le cui linee di livello sono perpendicolari a quel vettore: il rumore si legge come righe diagonali. Si nota solo dove ci sono grandi campiture uniformi (es. il `substrate` dei Morphogen); sugli shader ricchi di dettaglio si mimetizza. Per usarla senza artefatti tenerla bassa (0,02–0,04).
