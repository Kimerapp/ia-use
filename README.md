# IA-Use — Multi-AI Desktop Workspace & Orchestrator

[![License: MIT](https://img.shields.io/badge/License-MIT-6366F1.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-10B981.svg)](#come-scaricare-e-avviare-il-programma-metodo-facile--senza-terminale)
[![Built with Electron](https://img.shields.io/badge/Electron-34-47848F.svg)](https://www.electronjs.org/)

**IA-Use** è un'applicazione desktop open-source che riunisce in un unico ambiente di lavoro le Web UI ufficiali delle Intelligenze Artificiali che usi e paghi ogni giorno (**ChatGPT**, **Claude**, **Google Gemini**, **Venice AI**, **Perplexity**, **DeepSeek**, **Grok** e **Google AI Studio**).

Nessuna chiave API a consumo richiesta: **fai il login una sola volta con i tuoi normali abbonamenti (Plus, Pro, Max, Advanced)** e fai dialogare le AI tra loro in tempo reale.

---

## A cosa serve e perché usarlo?

Chi lavora o studia con più intelligenze artificiali si ritrova sempre con decine di schede del browser aperte, facendo continuamente *copia-incolla* da una scheda all'altra per verificare una risposta, migliorare del codice o aggirare i limiti di un singolo modello.

**IA-Use** risolve questo problema trasformando le singole chat in una **squadra coordinata**:

### 1. Split-Screen Persistente (`1x`, `2x`, `3x`, `2x2`)
- Visualizza 1, 2, 3 o 4 intelligenze artificiali affiancate nella stessa finestra.
- **Zero Reload**: quando cambi vista o passi da un'AI all'altra (`⌘1` – `⌘8`), i pannelli restano attivi in memoria senza mai ricaricare la pagina né interrompere una generazione in corso.
- **Preset Rapidi in 1 Click**:
  - **Triade Classica**: *ChatGPT + Claude + Gemini*
  - **Coding & Review**: *Claude + ChatGPT*
  - **Deep Research**: *Perplexity + Gemini + Claude*
  - **Arena 4x**: *ChatGPT + Claude + Gemini + DeepSeek*
  - **Venice + Claude**: *Venice AI + Claude*

### 2. Multi-Prompt in Parallelo (`⌘K`)
- Scrivi il tuo prompt **una sola volta** nella barra inferiore e invialo simultaneamente a tutte le AI visibili a schermo (o a un sottoinsieme a tua scelta).
- Confronta all'istante le risposte di ChatGPT, Claude, Gemini e Venice AI fianco a fianco.

### 3. Passaggio di Contesto in 1 Click (`Passa a…`)
- Prendi l'ultima risposta (o qualsiasi porzione di testo selezionata con il mouse) da un'AI e inviala a un'altra con **template operativi pronti all'uso**:
  - `Staffetta (Completa da qui)` — riprende esattamente dall'ultima frase senza ripetizioni.
  - `Sblocca e Prosegui (Senza Filtri)` — passa il contesto a un modello non censurato come Venice AI.
  - `Verifica e Critica` — fa controllare errori, allucinazioni o imprecisioni a una seconda AI.
  - `Revisione Codice` — chiede una code review architetturale e refactoring del codice generato.
  - `Secondo Parere` — chiede un approccio alternativo sullo stesso problema.
  - `Sintesi e Checklist` — trasforma una risposta lunga in una lista operativa.

### 4. Documento a Staffetta (Divisione 60% / 40% & Unione Automatica)
Devi scrivere una ricerca scolastica, una tesi, un report o un articolo lungo?
Aprendo il pannello **`Documento Staffetta`** in alto a destra puoi scegliere tra due modalità:

- **Modalità Per Percentuale (es. 60% ChatGPT → 40% altra AI)**:
  1. Imposti l'argomento e la percentuale con lo slider (es. **60%** alla prima AI e **40%** alla seconda).
  2. Clicchi **`1. Genera il primo 60%`**: la prima AI crea l'indice completo e redige solo il primo 60% dei capitoli.
  3. Clicchi **`2. Cattura 1ª parte e completa il 40%`**: l'app copia il 60% nel **Foglio Unificato** e ordina alla seconda AI di riprendere esattamente dall'ultimo punto fino al 100%.
  4. Clicchi **`3. Cattura finale e unisci al Documento`**: i due blocchi vengono fusi in un unico documento continuo, pronto da scaricare in **Word (`.doc`)** o **Markdown (`.md`)**.

- **Modalità "Fino al Limite → Uncensored" (es. ChatGPT → Venice AI)**:
  - Vuoi trattare un tema complesso o non filtrato che su ChatGPT verrebbe bloccato?
  - **Passo 1**: l'app istruisce **ChatGPT** a *non rifiutare* l'intera richiesta, ma a strutturare il documento e scrivere tutta la parte di inquadramento/contesto consentita dalle sue linee guida fin dove può arrivare, inserendo il marcatore `[PASSAGGIO A VENICE AI]` appena tocca il suo limite.
  - **Direttiva Riservata**: hai un campo dedicato per i dettagli più spinti/non filtrati che **non viene mostrato a ChatGPT** (evitando blocchi preventivi sul filtro di input), ma viene inviato automaticamente solo a **Venice AI**.
  - **Passo 2 & 3**: l'app pulisce automaticamente il marcatore `[PASSAGGIO A VENICE AI]`, salva la prima parte nel Foglio Unificato e fa completare senza censure né preamboli tutta la parte restante a **Venice AI**.

---

## Ambienti AI Integrati

| Scorciatoia | AI Provider | URL | Punti di forza tipici |
| :---: | :--- | :--- | :--- |
| `⌘1` / `Ctrl+1` | **ChatGPT** | `chatgpt.com` | Struttura, versatilità, ragionamento generale |
| `⌘2` / `Ctrl+2` | **Claude** | `claude.ai` | Scrittura naturale, programmazione, analisi profonda |
| `⌘3` / `Ctrl+3` | **Gemini** | `gemini.google.com` | Contesto enorme, integrazione ecosistema Google |
| `⌘4` / `Ctrl+4` | **Perplexity** | `perplexity.ai` | Ricerca web in tempo reale con fonti verificate |
| `⌘5` / `Ctrl+5` | **DeepSeek** | `chat.deepseek.com` | Ragionamento logico/matematico (R1) e codice |
| `⌘6` / `Ctrl+6` | **Grok** | `grok.com` | Dati real-time e stile diretto |
| `⌘7` / `Ctrl+7` | **Google AI Studio** | `aistudio.google.com` | Controllo parametri avanzati e prompt engineering |
| `⌘8` / `Ctrl+8` | **Venice AI** | `venice.ai/chat` | Modelli non censurati e orientati alla privacy |

---

## Prima volta su GitHub? Leggi qui (Guida semplice per tutti)

Se non sei un programmatore e questa pagina piena di cartelle e scritte ti sembra complicata, **niente paura**: sei nel posto giusto.

- **Cos'è l'Open Source?** Significa semplicemente che questo programma è **gratuito, trasparente e aperto a tutti**. Chiunque può scaricarlo, usarlo sul proprio computer e vedere come è stato costruito, senza costi nascosti e senza pubblicità.
- **Cos'è GitHub?** È come una grande libreria mondiale dove vengono custoditi i file dei programmi open source. Non serve nemmeno registrarsi per scaricare il programma.

---

## Come scaricare e avviare il programma (Metodo Facile — Senza Terminale)

Anche se non hai mai usato GitHub in vita tua, ti bastano **3 passaggi** per avere **IA-Use** funzionante sul tuo Mac o PC Windows:

### Passo 1: Installa il motore gratuito Node.js (solo la prima volta)
Il programma usa una tecnologia chiamata *Node.js* per funzionare sul tuo computer.
1. Vai sul sito ufficiale **[https://nodejs.org](https://nodejs.org/)**
2. Clicca sul bottone verde **`Scarica Node.js (LTS)`**.
3. Apri il file scaricato e installalo come un normalissimo programma (cliccando sempre *"Avanti / Continua"* fino alla fine).

### Passo 2: Scarica la cartella del programma da questa pagina
1. Guarda in alto a destra in questa pagina di GitHub: vedrai un **bottone verde con scritto `<> Code`**.
2. Cliccaci sopra: si aprirà un piccolo menu.
3. Clicca su **`Download ZIP`** (ultima voce in basso).
4. Vai nella tua cartella *Download* ed **estrai il file `.zip`** (su Mac basta farci doppio click sopra; su Windows clicca col tasto destro → *"Estrai tutto..."*).

### Passo 3: Avvia IA-Use con un doppio click
Apri la cartella `ia-use-main` appena estratta:
- **Su Mac:** fai doppio click sul file **`Avvia-IA-Use-Mac.command`**.
  *(Nota: se il Mac ti chiede conferma perché il file proviene da internet, clicca su "Apri" oppure vai in Impostazioni di Sistema → Privacy e Sicurezza → "Apri comunque").*
- **Su Windows:** fai doppio click sul file **`Avvia-IA-Use-Windows.bat`**.

Al primo avvio la finestra preparerà il programma in automatico (ci vogliono circa 20 secondi) e subito dopo si aprirà **IA-Use**. Dalle volte successive si aprirà istantaneamente.

---

## Installazione da Terminale (Per Sviluppatori / Utenti Esperti)

Se conosci già Git e il Terminale, ti bastano questi 3 comandi:

```bash
# 1. Clona il repository
git clone https://github.com/Kimerapp/ia-use.git
cd ia-use

# 2. Installa le dipendenze
npm install

# 3. Avvia l'applicazione desktop
npm start
```

> **Nota sul primo avvio:** Lo script automatico `prestart` verifica che il binario nativo di Electron per il tuo sistema operativo (macOS Apple Silicon / Intel, Windows o Linux) sia estratto e pronto all'uso.

### Generare l'app `.app` per macOS (Opzionale)

Se vuoi creare il pacchetto `.app` da trascinare nella tua cartella **Applicazioni**:

```bash
npm run build:mac
```

Troverai l'applicazione pronta nella cartella `dist/mac-arm64/IA-Use.app` (o `dist/mac/IA-Use.app` su Mac Intel).

---

## Scorciatoie da Tastiera

| Scorciatoia (macOS / Win-Linux) | Azione |
| :--- | :--- |
| `⌘1` … `⌘8` (`Ctrl+1` … `Ctrl+8`) | Passa all'ambiente AI corrispondente |
| `⇧⌘1` (`Ctrl+Shift+1`) | Vista Singola (`1x Focus`) |
| `⇧⌘2` (`Ctrl+Shift+2`) | Vista Doppia affiancata (`2x Split`) |
| `⇧⌘3` (`Ctrl+Shift+3`) | Vista Tripla affiancata (`3x Tripla`) |
| `⇧⌘4` (`Ctrl+Shift+4`) | Griglia 4 AI (`2x2 Grid`) |
| `⌘K` (`Ctrl+K`) | Mostra e porta il cursore sulla barra **Multi-Prompt** |
| `⇧⌘C` (`Ctrl+Shift+C`) | Cattura l'ultima risposta dell'AI attiva e apri il menu **`Passa a…`** |
| `⌘B` (`Ctrl+B`) | Mostra / Nascondi la barra laterale sinistra |
| `⌘R` (`Ctrl+R`) | Ricarica solo il pannello AI attualmente attivo |

---

## Privacy & Sicurezza

- **100% Locale**: IA-Use non utilizza alcun server esterno o proxy intermedio. Tutte le connessioni avvengono direttamente tra il tuo computer e i siti ufficiali dei provider AI (`chatgpt.com`, `claude.ai`, `gemini.google.com`, `venice.ai`, ecc.).
- **Sessioni Isolate e Persistenti**: I cookie di sessione e i login OAuth (Google, Apple, Microsoft, GitHub) vengono salvati esclusivamente in locale nella partizione Chromium `persist:ia-use` sul tuo computer.
- **Zero Telemetria**: Nessun prompt, documento o credenziale viene mai raccolto o inviato a terze parti.

---

## Struttura del Progetto

```text
ia-use/
├── src/
│   ├── main/
│   │   ├── main.js          # Processo principale Electron, gestione sessioni OAuth e scorciatoie
│   │   └── preload.js       # Context bridge sicuro tra host e renderer
│   ├── shared/
│   │   └── providers.js     # Configurazione AI providers, selettori DOM, preset e template Relay
│   └── renderer/
│       ├── index.html       # Interfaccia Workspace, Omnibar e pannello Documento Staffetta
│       ├── styles.css       # Design system dark-native
│       ├── injector.js      # Motore di iniezione DOM (React/ProseMirror/Quill) ed estrazione risposte
│       └── app.js           # Logica Split-Screen, Multi-Prompt e Staffetta 60/40 + Uncensored
├── scripts/
│   └── ensure-electron.js   # Verifica multipiattaforma del binario Electron
├── DESIGN.md                # Specifiche del Design System
├── LICENSE                  # Licenza Open Source MIT
└── package.json
```

---

## Contribuire

Contributi, segnalazioni di bug e richieste di nuovi provider AI sono benvenuti:
1. Fai un fork del repository
2. Crea il tuo feature branch (`git switch -c feature/nuova-funzione`)
3. Fai commit delle modifiche (`git commit -m 'feat: aggiungi nuova funzione'`)
4. Apri una Pull Request verso `main`

---

## Licenza

Distribuito sotto licenza **MIT**. Vedi il file [LICENSE](file:///Users/AngeloRaucci_1/Desktop/Claude/Progetti/IA-Use/LICENSE) per maggiori dettagli.
