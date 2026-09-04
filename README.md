# EasyMap Studio

![Logo EasyMap Studio](public/logo.png)

**Live preview**: https://easymap-studio-nine.vercel.app

**Webapp frontend per projection mapping e performance VJ live**, pensata per essere usata sul palco: si carica l'immagine di una statua, un palco o una superficie qualsiasi, si allinea la proiezione con un corner-pin, si applicano shader GLSL generativi ritagliati automaticamente dentro i bordi del soggetto, e si proietta da una finestra dedicata sincronizzata in tempo reale con l'editor di controllo.

EasyMap Studio è nato come **esperimento estivo di collaborazione con Claude Code**, con l'obiettivo di verificare fino a che punto fosse possibile progettare e sviluppare un'applicazione completa sfruttando un workflow di sviluppo assistito dall'intelligenza artificiale, mantenendo però il pieno controllo sulle decisioni architetturali, sulla progettazione della UX e sull'implementazione tecnica.

L'obiettivo del progetto è rendere il **projection mapping semplice, intuitivo e accessibile**, anche per chi si avvicina per la prima volta a questo mondo. L'intera esperienza è stata progettata mettendo al centro **facilità d'uso, chiarezza dell'interfaccia e rapidità del workflow**, così da permettere di ottenere risultati dall'aspetto professionale con pochi passaggi e senza dover essere esperti di software complessi.

L'intera UI/UX è quindi costruita attorno a un principio fondamentale: **ridurre al minimo la curva di apprendimento**, rendendo ogni funzione facilmente individuabile, comprensibile e utilizzabile anche durante performance live.

Progetto solista, sviluppato in modo iterativo con un ciclo di lavoro rigoroso (ogni modifica documentata, verificata visivamente nel browser prima di essere considerata completa).

> Stato: in sviluppo attivo. Fase 1 (MVP) e Fase 2 (multi-layer) sostanzialmente complete; Fase 3 (audio-reactive, MIDI, DMX) da avviare.

---

## Novità della versione 4

- **Qualità dell'immagine proiettata** — un pannello di controlli dedicato a quanto bene l'immagine arriva sul proiettore, più gli strumenti per misurarlo invece di andare a tentativi. **Supersampling** fino a 2× (l'unico antialiasing che agisce sui contorni disegnati dagli shader e sul bordo della sagoma), **buffer interno a mezza precisione float** perché i blend Add/Screen non vengano tagliati sul bianco, **dithering** contro il banding dei gradienti — che al buio è la cosa che più fa sembrare "povera" una proiezione — e **grana** opzionale. Sulla finestra di proiezione: `S` apre un **pannello diagnostico** con i pixel realmente disegnati, gli fps e l'avviso quando la finestra non copre lo schermo; `C` accende un **cartello di prova** (righe da un pixel, rampa, barre sature, gradini di nero e bianco) per capire in dieci secondi se il limite è l'app, il proiettore o il sistema. Corretto anche un difetto nella gestione del colore delle sorgenti: le immagini venivano linearizzate senza essere ri-codificate, e un grigio 128 nel file arrivava a schermo come 55 — **foto, video e riprese live ora hanno la luminosità giusta**, con le mezze luci al loro posto.
- **Ingresso video live (webcam, cam USB, capture card HDMI)** — un layer può avere come contenuto una **ripresa dal vivo** invece di un file: si riprende il DJ, il pubblico o il palco e lo si proietta effettato in tempo reale. La sorgente si comporta come qualunque altro media — shader, palette, maschere, corner-pin, blend e opacità valgono senza differenze — e il pulsante **"Nuovo strato"** duplica il feed su un layer sopra, già allineato e in Screen, per impilare più effetti sulla stessa ripresa. Il device resta aperto **una volta sola** qualunque sia il numero di strati. Sul proiettore la ripresa arriva senza latenza aggiunta, perché la finestra Output apre la camera per conto proprio. Se la cam si scollega o viene presa da un altro programma il layer si riaggancia da solo; restano comunque un pulsante di riavvio della sorgente e una diagnostica che spiega perché un'attivazione non riesce (permesso bloccato, pagina non sicura, device occupato).
- **Loop delle palette casuali** — accanto a "Genera" c'è ora un interruttore **Loop**: la palette si rigenera da sola a intervalli regolari (**0,5–60 secondi**, preimpostati a 5) e **si dissolve** da una all'altra invece di cambiare di scatto. Basta accenderlo per avere un colore che evolve per conto suo mentre ci si occupa di mapping, layer o playlist. Se durante il loop tocchi "Genera", il numero di colori o un color picker, la dissolvenza successiva riparte da quello che c'è sullo schermo, senza stacchi.
- **Cambio effetto rapido e Random dei controlli** — frecce accanto alla lista degli effetti e scorciatoie `⌥A` / `⌥S` per scorrere la libreria senza aprire il menu, più un pulsante che estrae valori casuali per tutti i parametri dell'effetto attivo.
- **Barra spaziatrice per "Esegui in output"** in modalità Live, così l'invio al proiettore non passa dal mouse.

---

## Cosa fa, in pratica

1. Carichi una foto con sfondo trasparente (o nero, con rilevamento automatico) di ciò su cui vuoi proiettare.
2. Allinei i 4 angoli dell'immagine alla superficie reale tramite corner-pin, direttamente da finestra di controllo.
3. Scegli tra **123 shader GLSL** generativi/psichedelici, ognuno con parametri regolabili via slider e colori personalizzabili — scorribili al volo con le frecce o da tastiera, e randomizzabili con un pulsante.
4. Regoli l'effetto con i **controlli globali** (velocità, rotazione, kaleidoscopio, mirror, pixelate, colore): funzionano su qualsiasi shader, senza doverne conoscere i parametri.
5. Componi più layer indipendenti (immagine, video, GIF o **ripresa live** da webcam/capture card), ciascuno con la propria maschera, il proprio effetto, opacità e blend mode.
6. Costruisci una **playlist di effetti** con transizioni a crossfade, per sequenze automatizzate durante il live.
7. Apri la finestra **Output** (che nasce da sola sul secondo monitor/proiettore, se il browser lo consente) che riceve lo stato in tempo reale via `BroadcastChannel`, con una modalità **Live** per decidere manualmente quando "mandare in onda" le modifiche.
8. Tari la **qualità di resa** sul proiettore che hai davanti — supersampling, dithering, grana — usando il cartello di prova e il pannello diagnostico per vedere cosa sta arrivando davvero sullo schermo.
9. Il progetto si salva da solo in locale (IndexedDB) e funziona anche offline (PWA), utile a bordo palco senza rete.

---

## Funzionalità disponibili

Tutto quello che puoi fare dall'editor, pannello per pannello.

### Layer e maschere

- Scena come pila di **layer indipendenti**: aggiungi, duplichi, riordini (drag&drop), rinomini, nascondi/mostri, regoli opacità e **blend mode** di ognuno — tredici modalità: Normal, Add, Screen, Multiply, Overlay, Soft Light, Hard Light, Difference, Exclusion, Darken, Lighten, Color Burn, Color Dodge.
- Per ogni layer: upload di **immagine, GIF o video**, oppure **ingresso video live** da una camera collegata, con rilevamento automatico dello sfondo opaco e slider manuale "rimuovi sfondo scuro" (luma key) per le immagini senza canale alpha.
- **Corner-pin** a 4 maniglie trascinabili per allineare la proiezione alla superficie reale, pad direzionale + zoom per spostare/ridimensionare l'intera proiezione, fit automatico al caricamento.
- **Zoom e pan della vista di anteprima**, indipendenti dall'output: utile per raggiungere le maniglie del corner-pin quando l'asset è ingrandito oltre i bordi del canvas.
- **Riferimenti di mapping nascondibili** (pulsante a forma di occhio sul canvas): cornice e maniglie servono a posizionare, ma coprono l'effetto quando lo vuoi valutare davvero. L'Output non li ha mai disegnati.
- **Maschere per-layer**: forme rettangolo/ellisse (con sfumatura bordo, rotazione, inversione), più forme sommabili, oppure maschera da immagine PNG (stencil).
- **Nitidezza del bordo** della sagoma: il contorno di un PNG è largo pochi pixel e il corner-pin lo ingrandisce fino a decine di pixel di proiettore, dove si legge come un alone sfocato. Il controllo restringe quella rampa **senza spostarla**, così il mapping non si muove — utile quando l'effetto deve fermarsi esattamente sullo spigolo dell'oggetto. Con il luma key attivo toglie anche il pulviscolo di pixel semitrasparenti attorno al soggetto.
- **Sincronizzazione effetto** tra i layer che scegli: le modifiche a shader, parametri, size, palette e controlli globali del layer attivo si propagano subito a quelli spuntati.

### Effetti e palette colori

- Libreria di **123 shader GLSL** generativi/psichedelici, in cinque famiglie principali (più una manciata di effetti singoli fuori famiglia, "Altri", e uno audio-reattivo):
  - **Halo** (12 effetti) e **Liquid** (12 effetti) — simmetrie radiali e superfici fluide;
  - **Psy** (40 effetti) — pensati per stage psytrance e techno: strobo, tunnel, laser, griglie esagonali, digital rain, wireframe synthwave, glitch, barre spettro, geometria sacra, frattali, caleidoscopi 3D a raymarch;
  - **Morph** (31 effetti) — _source-driven_: usano la luminanza del tuo asset come mappa di profondità (`morphDepth`), così il pattern non ci si appoggia sopra ma lo **modella**, seguendone i rilievi. Include anche i tre Morphogen (Growth, Mitosis, Turing), reaction-diffusion vere con stato che girano su una griglia dedicata in ping-pong, non calcolabili in un solo passaggio.
  - **SD** (12 effetti) — source-driven di seconda generazione: oltre alla luminanza leggono la **pendenza locale** dell'immagine (il gradiente), cioè la direzione in cui la superficie sale. Così creste, trame e onde si orientano lungo le curve reali dell'oggetto e ne ricevono anche l'illuminazione. Ognuno espone 11-12 controlli, tra cui il raggio di campionamento del rilievo e l'angolo della luce.
- **Cambio effetto rapido**: frecce ◀ ▶ accanto alla lista e scorciatoie **⌥A / ⌥S** (Alt su Windows/Linux) per scorrere la libreria senza aprire il menu a tendina — lo scorrimento è ciclico e salta "Nessun effetto", così durante un live si passa da un visual all'altro con un tasto.
- **Random dei controlli**: un pulsante estrae valori casuali per tutti i parametri dell'effetto attivo, dentro i range dichiarati dallo shader. È il modo più veloce di far emergere look che a mano non si proverebbero, senza dover capire cosa fa ogni slider.
- **Controlli globali dell'effetto**, validi per **qualsiasi** shader (anche quelli che espongono pochi parametri propri): velocità, rotazione, pan X/Y, kaleidoscopio, mirror X/Y, pixelate, luminosità, contrasto, saturazione, posterize, negativo — con reset immediato.
- Opzione **"Nessun effetto"** per mostrare il contenuto grezzo del layer.
- **Palette colori** con 7 preset fluorescenti pronti, editor a 5 colori personalizzabile e **generatore di palette casuali** con numero di colori a scelta (2–5) e schemi di armonia (analoga, complementare, triadica, split-complementare, monocromatica). Essendo una gradient map, ricolora ogni effetto della libreria; disponibile sia dal pannello Palette sia direttamente da quello Shader.
- **Loop delle palette casuali** _(novità v4)_: l'interruttore **Loop** fa rigenerare la palette da sola a ogni intervallo — regolabile da 0,5 a 60 secondi anche mentre gira, per andare a tempo di musica — con una **dissolvenza morbida** al posto del cambio secco. Il loop resta attivo anche spostandosi su un altro pannello, e in modalità Live segue la regola di tutto il resto: i colori raggiungono il proiettore solo quando premi "Esegui in output".

### Assets

- Caricamento diretto di immagine/GIF/video dal pannello Assets, con anteprima del file selezionato.
- **Ingresso video live** _(novità v4)_: attivi la camera dal pannello Asset e scegli quale usare da una tendina che si aggiorna da sola quando colleghi o stacchi un device. La ripresa viene adattata automaticamente al suo formato, si può stratificare con "Nuovo strato" (stesso feed, layer sopra, già allineato e in blend Screen) e si riavvia a freddo con un pulsante se durante un set l'immagine si pianta. Cambiando camera la precedente viene spenta subito, perché due webcam USB sullo stesso controller spesso non stanno insieme per banda disponibile.
- Un **asset dimostrativo** è precaricato automaticamente alla primissima apertura dell'app, per poter provare subito il programma senza dover cercare un'immagine propria.

> Sugli effetti da usare con una ripresa live: circa 66 shader della libreria (famiglie _Halo_, _Liquid_, _Morph_, _SD_) campionano la sorgente e quindi **elaborano davvero l'immagine della camera**. Gli altri sono puramente generativi: siccome un feed video è opaco e non ha una sagoma da ritagliare, lo coprono — vanno messi su uno strato sopra in Add/Screen, o con opacità ridotta.

### Output e modalità Live

- Finestra **Output** dedicata, sincronizzata in tempo reale con l'editor via `BroadcastChannel`. Si apre **direttamente sullo schermo secondario** quando il browser espone la Window Management API, altrimenti va trascinata a mano; pieno schermo con `F` o doppio click.
- Modalità **Live**: le modifiche restano "in prova" nell'editor di controllo e vengono inviate all'Output solo quando premi esplicitamente "Esegui in output" — utile per sperimentare senza disturbare la proiezione dal vivo. Il pulsante segnala con un pallino quando ci sono modifiche in sospeso, e l'invio si comanda anche con la **barra spaziatrice**.

### Qualità dell'immagine proiettata _(novità v4)_

Un proiettore perdona molto meno di un monitor: la sala non è mai completamente buia, il contrasto è quello che è, e i difetti che a schermo non si notano lì diventano evidenti. Questi controlli stanno nel pannello **Output** e agiscono sulla sola finestra di proiezione, così l'anteprima non ruba GPU al proiettore durante un set.

- **Supersampling** 1× / 1.25× / 1.5× / 2×, preimpostato a **2×**: la scena viene disegnata più grande di quanto verrà proiettata e poi ridotta. È l'unico antialiasing che agisce su ciò che si vede davvero — i contorni disegnati dal fragment shader e il bordo della sagoma — perché il multisampling classico lavora solo sui lati del quad, che con un PNG scontornato sono trasparenti e quindi invisibili.

  **La scala si ferma a 2×, e la ragione è misurata, non prudenziale.** Il costo cresce col quadrato del fattore, il guadagno no. Su un canvas da 1080p con un layer:

  | Fattore | Buffer interno | Memoria | FPS |
  | ------- | -------------- | ------- | --- |
  | 1×      | 1336×1522      | 16 MB   | 124 |
  | 2×      | 2672×3044      | 62 MB   | 126 |
  | 3×      | 4008×4566      | 140 MB  | 93  |
  | 4×      | 5344×6088      | 248 MB  | 56  |

  A 2× il costo è **nullo** — 126 fps contro 124, in entrambi i casi il limite è il vsync e non la GPU — ed è per questo che è il default. 3× e 4× sono stati implementati e provati **sul proiettore**: nessun miglioramento visibile, perché a quel punto il limite della nitidezza non è più l'aliasing ma l'ottica (messa a fuoco, contrasto, dimensione del pixel proiettato). Sono stati quindi rimossi: un'opzione che non migliora nulla ma dimezza gli fps, in un'app che si usa dal vivo, è solo un modo di sbagliare in serata. Restano invece le protezioni che quel lavoro ha prodotto — tetto di memoria video sul buffer interno e **fattore effettivo mostrato nel pannello** quando una riduzione automatica scatta, perché credere di proiettare a una qualità che non si ha è peggio che saperlo.
- **Buffer interno a mezza precisione float**: i blend Add e Screen possono superare il fondo scala invece di essere tagliati subito.
- **Sfondamento morbido**: quando un colore supera il fondo scala, l'eccesso vira verso il bianco invece di far scivolare la tinta (senza, un rosso che sfonda diventa giallo). Non tocca nulla che stia già dentro il range — su un proiettore il bianco pieno è luce che si paga in lumen, e non si regala a una curva.
- **Dithering**: distribuisce l'errore di quantizzazione sugli 8 bit finali. È ciò che toglie le strisce dai gradienti larghi degli shader generativi, che al buio sono la cosa che più fa sembrare "povera" una proiezione.
- **Grana** regolabile: un video ha dettaglio ad alta frequenza ovunque, uno shader generativo no — ed è anche per questo che sullo stesso proiettore un video "sembra migliore" a parità di pixel. Un filo di grana riavvicina le due cose.
- **Pannello diagnostico** (`S` sulla finestra di proiezione): pixel realmente disegnati dal canvas, dimensione del buffer interno, supersampling effettivo, precisione, fps, e l'avviso quando la finestra non copre tutto lo schermo — ogni pixel non usato è risoluzione buttata.
- **Cartello di prova** (`C`): righe da un pixel, rampa continua, barre sature, gradini di nero e di bianco. Dice in dieci secondi dove sta il limite. Se le righe da un pixel non si leggono nette **non stai proiettando alla risoluzione nativa**, e nessuna impostazione dell'app può rimediare: quasi sempre è il keystone digitale del proiettore acceso (ricampiona l'immagine — la deformazione va lasciata al corner-pin) o la risoluzione del sistema impostata su "scalata" invece che nativa. Se le barre sature sembrano slavate è la modalità immagine del proiettore, perché qui escono a fondo scala per costruzione.

Le impostazioni di resa vivono nel browser e non dentro i progetti: dipendono dalla macchina e dal proiettore, non dal lavoro. Per la stessa ragione raggiungono la finestra di proiezione **sempre**, modalità Live compresa — non sono la scena, sono il modo di disegnarla, e durante un set devono avere effetto subito.

### Scorciatoie da tastiera

Pensate per il palco: le operazioni che si ripetono di continuo durante una performance non devono passare dal mouse.

Nell'**editor di controllo**:

| Tasto               | Azione                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------- |
| `⌥A` / `⌥S`         | Effetto precedente / successivo nella libreria (Alt su Windows e Linux)                |
| `Spazio`            | "Esegui in output": manda all'Output le modifiche in sospeso (solo in Live)            |
| `↑ ↓ ← →`           | Spostamento fine dell'angolo selezionato, o dell'intera proiezione; `Shift` = ×5       |
| `Spazio` + trascina | Pan della vista di anteprima (anche col tasto centrale del mouse)                      |
| Rotellina           | Zoom della vista di anteprima                                                          |
| `Alt` + click       | Sui pulsanti larghezza/altezza della toolbar di mapping: restringe invece di allargare |
| `⌘B` / `Ctrl+B`     | Mostra/nasconde il pannello laterale                                                   |

Sulla **finestra di proiezione** (comandi locali, perché il pieno schermo il browser lo concede solo a chi ha ricevuto un gesto nella finestra che lo chiede):

| Tasto                | Azione                                                          |
| -------------------- | --------------------------------------------------------------- |
| `F` o doppio click   | Pieno schermo                                                    |
| `S`                  | Pannello diagnostico (risoluzione reale, buffer interno, fps)     |
| `C`                  | Cartello di prova — chi tara la proiezione sta davanti al proiettore, non al portatile |

Fuori dalla modalità Live la barra spaziatrice resta interamente al pan della vista; nei campi di testo nessuna scorciatoia ruba i tasti.

### Playlist

- Barra **playlist** con timeline dei clip di effetti, riordinabili e con durata regolabile trascinando il bordo del clip.
- Ogni clip mostra una **thumbnail** dell'effetto e si apre in un editor rapido (effetto, parametri, colori, size) con anteprima immediata sul layer.
- Transizioni **crossfade** (durata regolabile) o **taglio secco** tra un clip e il successivo, a scelta.
- Riproduzione con **play/pause** e **loop** on/off per ripetere la sequenza durante il live.

### Progetti, template e preset

- **Salvataggio progetti con nome**, richiamabili in qualsiasi momento, più **autosave automatico** che ripristina l'ultima sessione al riavvio.
- **Preset degli effetti**: salvi il "look" di un layer (shader + parametri + size + palette) con un nome e lo riapplichi su qualsiasi layer o progetto, anche come punto di partenza per un nuovo clip in playlist.
- I **controlli globali** restano invece proprietà del layer e non vengono catturati dai preset né dai clip: è voluto, così velocità, kaleidoscopio o correzioni di colore che hai impostato sul layer non si azzerano a ogni cambio di effetto o transizione della playlist.

---

## Funzionalità principali

### Motore di rendering shader

- Parser **ISF-like** che legge uniform GLSL commentati (`// @min @max @default`) e genera automaticamente slider e color picker nell'UI — basta aggiungere un file `.glsl` per far apparire un nuovo effetto, senza toccare codice React.
- Libreria di **123 shader** originali (famiglie _Halo_, _Liquid_, _Psy_, _Morph_, _SD_, più alcuni singoli fuori famiglia), molti dei quali source-driven: reagiscono alla luminanza dell'immagine sorgente e restano sempre ritagliati dentro la sua sagoma. Gli shader _Morph_ spingono l'idea oltre, usando quella luminanza come **campo di quota** che deforma la geometria dell'effetto — i tre Morphogen (Growth, Mitosis, Turing) sono simulazioni vere con stato, calcolate su una griglia dedicata in ping-pong; gli _SD_ aggiungono il **gradiente** della luminanza, che dà la direzione della pendenza: i pattern seguono le curve dell'oggetto e ricevono un'illuminazione coerente con la superficie.
- **Controlli globali nel wrapper GLSL**: trasformazioni della uv (`easyvj_fxUv`: mirror, kaleidoscopio, rotazione, pan, pixelate) e correzioni di colore (`easyvj_fxColor`: luminosità, contrasto, saturazione, posterize, negativo) applicate rispettivamente prima e dopo `processColor`. Valgono per ogni shader senza modificarne il codice — con oltre 120 effetti in libreria, aggiungere uniform uno per uno non sarebbe scalabile.
- **Maschera automatica per canale alpha**, con **luma key** opzionale (rilevata automaticamente all'upload) per le immagini con sfondo nero opaco anziché trasparente.
- Palette colori con 7 preset fluorescenti, editor a 5 colori, generatore di **palette casuali** a numero di stop variabile con cinque schemi di armonia, e colori assegnabili ai singoli parametri `vec3` di ogni shader.
- **Loop delle palette** con dissolvenza calcolata **in HSL anziché in RGB**: interpolando i canali RGB, due tinte opposte si incontrano a metà strada su un grigio slavato, mentre ruotando la tinta sul percorso più corto la palette resta satura per tutta la transizione. Il motore vive in un `requestAnimationFrame` montato sulla pagina di controllo e smette di riscrivere la palette a dissolvenza conclusa, per non tenere occupati sync e autosave a ogni frame.

### Pipeline di output

- **Compositore a due passaggi**: la scena non va diritta a schermo ma dentro un buffer interno (`WebGLRenderTarget` a mezza precisione float), seguito da un passaggio finale che riduce, gestisce lo sfondamento delle alte luci, applica dither e grana. È ciò che rende possibile il supersampling con un filtro di riduzione controllato da noi — a 4 prelievi quando il rapporto fra le due risoluzioni non è intero (1.25×, 1.5×), dove un prelievo solo lascerebbe fuori dei texel.
- **Nessun MSAA sul buffer interno, di proposito**: un framebuffer multisample non si può copiare con `copyTexSubImage2D`, e la copia del backdrop per i blend avanzati avviene proprio mentre quel buffer è legato. Visto che il multisampling salverebbe soltanto i lati del quad — trasparenti con un PNG scontornato, quindi invisibili — l'antialiasing lo fa interamente il supersampling.
- **Spazio colore uniforme in gamma**: le texture di contenuto non vengono linearizzate. Marcarle sRGB le farebbe caricare in un formato che l'hardware linearizza a ogni prelievo, ma la conversione inversa in uscita Three la inserisce **solo** nei materiali che includono il chunk `colorspace_fragment` — e i nostri sono `ShaderMaterial` con sorgente scritta a mano. Mezza conversione, a senso unico: un grigio 128 nel file arrivava a schermo come 55, con le mezze luci schiacciate verso il nero. Lavorare tutti in spazio gamma è anche coerente con lo spazio in cui sono pensati gli shader della libreria, le palette prese dai color picker e le formule dei blend mode, che come in Photoshop sono definite su valori non lineari.
- **Filtro anisotropico** sulle texture di contenuto: nel projection mapping il quad è sempre guardato di sbieco, ed è il caso in cui il mip-mapping isotropo sfoca i lati inclinati molto prima di quelli frontali. Il valore massimo lo conosce solo il renderer, che nasce col canvas — cioè dopo che qualche texture può già esistere: le texture si registrano e vengono aggiornate a ritroso.
- **Diagnostica fuori da React**: i numeri del rendering vengono pubblicati dal ciclo di disegno tramite un modulo con sottoscrittori, non da uno store. Far ripartire il reconciler sessanta volte al secondo per scrivere un contatore di fps sarebbe esattamente il tipo di costo che quel pannello dovrebbe aiutare a scovare.

### Multi-layer (stile Resolume/MadMapper)

- Scena come pila di layer indipendenti: ognuno con proprio media, effetto, corner-pin, maschere, opacità e blend mode.
- **Tredici blend mode su due strade diverse**: Normal, Add, Screen e Multiply li calcola il blending hardware (`CustomBlending` con alpha premoltiplicato, costo zero); Overlay, Soft/Hard Light, Difference, Exclusion, Darken, Lighten, Color Burn e Color Dodge hanno invece bisogno di **leggere il colore sottostante**, cosa che un fragment shader non può fare sul framebuffer su cui scrive. Per questi, la mesh copia lo schermo in una texture subito prima di disegnarsi e lo shader calcola la formula, scrivendo il risultato già composto — una copia a schermo pieno per layer, e nessun costo per le scene che non li usano.
- Maschere per-layer (rettangolo/ellisse con feather, rotazione, invert) o da stencil PNG, editabili direttamente sul canvas.
- Sorgenti dinamiche: immagini, **video** (`THREE.VideoTexture`), **GIF animate** (decodifica frame via `gifuct-js`) e **camere live** (`getUserMedia`), con stream condivisi per device a conteggio di riferimenti: più layer sulla stessa ripresa significano un solo device aperto e un solo upload di frame sulla GPU.
- Sincronizzazione dell'effetto tra layer selezionati, con propagazione live dei parametri.

### Playlist / sequencer live

- Timeline di clip riordinabili con durata trascinabile, thumbnail renderizzata offscreen per ogni effetto, transizioni **crossfade** a durata regolabile o taglio secco, loop, editor rapido per clip.

### Controllo del palco

- Corner-pin a 4 maniglie con pan/zoom di vista indipendente dall'output (per correggere il mapping anche quando l'asset è ingrandito oltre i bordi del canvas).
- Modalità **Live**: le modifiche restano "in prova" nell'editor finché non vengono inviate esplicitamente all'Output (pulsante o barra spaziatrice), per non disturbare la proiezione mentre si sperimenta.
- **Scorciatoie da tastiera** per i gesti che si ripetono durante una performance — cambio effetto (`⌥A`/`⌥S`), invio all'Output (`Spazio`), nudge del corner-pin (frecce) — progettate per non sovrapporsi tra loro: ogni tasto è attivo solo nel contesto in cui non ne serve un altro (per esempio `Spazio` comanda l'invio solo in Live, altrove resta il modificatore del pan).
- Persistenza automatica del progetto (autosave + salvataggi con nome) e libreria di preset effetto riutilizzabili tra progetti diversi.

---

## Stack tecnologico

| Ambito                 | Tecnologie                                                              |
| ---------------------- | ----------------------------------------------------------------------- |
| Framework / linguaggio | React 19, TypeScript, Vite 8                                            |
| Rendering 3D/shader    | Three.js, React Three Fiber, GLSL custom (parser ISF-like proprietario) |
| Stato globale          | Zustand (store separati per scena, effetti, palette, playlist, UI)      |
| Persistenza            | IndexedDB (`idb`), autosave con debounce                                |
| UI                     | Tailwind CSS v4, shadcn/ui (Radix), lucide-react                        |
| Sync multi-finestra    | `BroadcastChannel` API con handshake `hello`                            |
| Media                  | `THREE.VideoTexture`, `gifuct-js` per GIF animate, `MediaDevices.getUserMedia` per le sorgenti live |
| Offline                | `vite-plugin-pwa`                                                       |
| Routing                | react-router-dom                                                        |

---

## Architettura in breve

- **Due finestre sincronizzate**: `/control` (editor) e `/output` (proiettore, fullscreen, nessuna UI) comunicano via `BroadcastChannel`. Control pubblica lo stato della scena, Output lo specchia; una finestra Output appena aperta richiede lo stato corrente con un handshake `hello`.
- **`layersStore`** è la sorgente di verità unica della scena: un array ordinato di layer, ciascuno unità completa e autonoma (media, shader, parametri, corner-pin, maschere, mixing).
- **Corner-pin**: i 4 angoli vivono in coordinate mondo, coerenti con la geometria del piano renderizzato; l'overlay di editing converte schermo↔mondo usando lo stesso frustum della camera ortografica.
- **Maschera automatica**: il wrapper GLSL generato dal parser ISF moltiplica sempre l'alpha finale per l'alpha (o luma) della texture sorgente — ogni effetto resta confinato dentro i bordi dell'immagine, qualunque sia lo shader.
- **Shader "ISF-like"**: uniform `float`/`vec3` con commenti `@min @max @default` letti a build-time (`import.meta.glob`) → slider e color picker generati automaticamente in UI.
- **Sorgenti live tra le due finestre**: un `MediaStream` non è serializzabile, quindi sul canale di sincronizzazione viaggia **solo l'identificativo del device** e la finestra Output apre la camera per conto suo. Niente inoltro di frame tra finestre (che aggiungerebbe latenza e un canale WebRTC da mantenere), a costo di dover consentire l'accesso alla camera anche lì.
- **Controlli globali nel wrapper**: essendo applicati attorno a `processColor`, ogni nuovo shader li eredita automaticamente — l'autore dell'effetto non deve prevederli.
- **Due canali di sincronizzazione con ruoli diversi**: la scena viaggia sul payload di stato e in modalità Live resta ferma finché non la si manda in onda; le impostazioni di resa e i tick del loop palette hanno messaggi propri che passano **sempre**. La distinzione non è tecnica ma di significato — congelare la scena serve a non mostrare un lavoro in corso, congelare la qualità di rendering vorrebbe solo dire non poterla correggere durante un set.

---

## Avvio del progetto

```bash
npm install
npm run dev
```

Altri comandi utili:

```bash
npm run build        # type-check completo + build di produzione
npx tsc -b --noEmit   # solo type-check
```

Apri `/control` per l'editor e `/output` (idealmente su un secondo monitor) per la finestra di proiezione.

---

## Roadmap

Il progetto segue una roadmap tracciata in dettaglio in `TODO.md`. Macro-fasi:

- ✅ **Fase 1 — MVP core**: upload, corner-pin, libreria shader, palette colori, preset, persistenza, layout UI.
- ✅ **Fase 2 — Multi-layer**: layer indipendenti, maschere, media dinamici (video/GIF), modalità Live, playlist con transizioni, controlli globali validi per qualsiasi effetto.
- ⏳ **Fase 3 — Live performance**: ingresso video live da webcam/capture card ✅, pipeline di output ad alta qualità con supersampling, dithering e strumenti di taratura del proiettore ✅, poi audio-reactive (Web Audio API + FFT), BPM sync, controller MIDI, bridge OSC/DMX, multi-output.
- 🔭 **Oltre**: motore particellare 3D GPU-instanced (point cloud reali con profondità e camera) e feedback buffer per le scie accumulate — i due passi che avvicinerebbero davvero l'estetica delle _data sculpture_.

---

## Nota sul processo di sviluppo

Ogni modifica al codice viene registrata in `MEMORY.md` con motivazione e dettagli tecnici, e verificata visivamente in browser prima di essere considerata conclusa — un log che oggi conta oltre 15 sessioni di sviluppo documentate, utile a chi vuole ripercorrere le decisioni architetturali prese lungo il percorso (es. perché le maschere sono in spazio-corner e non UV, perché il compositing multi-layer richiede alpha premoltiplicato, come funziona il crossfade della playlist senza canali dedicati).

---

## Autore

Sviluppato da Edoardo Tunzi.

> ⭐ Se EasyMap Studio ti è stato utile o ti è piaciuto, lascia una **Star** su GitHub.
>
> 🚀 Se vuoi contribuire allo sviluppo del progetto o collaborare alla sua evoluzione, scrivimi: sarò felice di confrontarmi.
