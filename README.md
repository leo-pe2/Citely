# Citely - Research App

I originally built this to streamline how I work through lecture slides—quickly jumping between pages, marking key points, and exporting clean summaries. That’s still the core, but the scope has grown: the app now treats research papers and lecture decks as first-class citizens. You can import PDFs, highlight text and figures, capture screenshots with context, and export your notes as a tidy, shareable PDF.

I owe heavy credit to Zotero for the inspiration of some features. My goal is to build an app which feels native, has a clean design and boosts productivity. I'm open for any feature requests (dm me on discord: leo123037)

**Notice:** The app is in very early stages and some pages don't exist yet. The project is maintained as long as I need it or have ideas for it.

<img width="2778" height="1774" alt="17 09-24 09 2025@2x" src="https://github.com/user-attachments/assets/ede6945c-f2a3-477c-b5b8-b991ee1aa7b0" />

<img width="2786" height="1778" alt="17 09-24 09 2025@2x" src="https://github.com/user-attachments/assets/c28f8b34-e2b1-4857-8b28-ce1f4ac50506" />

<img width="3590" height="2252" alt="17 08-24 09 2025@2x" src="https://github.com/user-attachments/assets/4adb90db-a473-4200-9c82-a5391f1ff55f" />


### Current Features

- **PDF importing + light metadata:** Auto-parses title, authors, year, and DOI/ISBN where present. 
- **Persistent highlights per PDF:** Highlights are saved with the file; a document auto-moves to **Ongoing** once the first highlight exists.
- **Lightweight Kanban (PDF status only):** Track PDFs as **To Do → Ongoing → Done**. The board is just for files, not tasks. You can switch between a table and kanban view (inspired by Notion).
- **Comments:** Add a comment to Highlight.
- **Screenshot capture:** Haven't seen this feature before in this kind of app. Capture graphs, formulas and save it as a "highlight"
- **100% offline:** No account, no server—everything runs locally.

### Future Features: 
- AI Integration


## Requirements

- Node.js
- npm
- macOS, Windows, or Linux (for packaging, build tools per OS are required)
- electron

## Install

```bash
npm install

npm run transpile:electron
```

## Develop

Run the React dev server and Electron together:

```bash
npm run dev
```

- React dev server: http://localhost:5123
- Electron auto-loads that URL with a custom application menu and preload bridge.

If you need to run them separately:

```bash
# React only
npm run dev:react

# Electron only (expects dev server on port 5123)
npm run dev:electron
```

## Build (production assets)

Transpile Electron and build the React app to `dist-electron/` and `dist-react/`:

```bash
npm run build
```

- Vite output: `dist-react/`
- Electron main/preload transpiled via TypeScript: `dist-electron/`

## Package installers

Build native installers using electron-builder. These commands will transpile Electron, build the React app, and then package:

```bash
# macOS (arm64 dmg)
npm run dist:mac

# Windows (portable exe + MSI x64)
npm run dist:win

# Linux (AppImage x64)
npm run dist:linux
```

Icons and targets are configured in `electron-builder.json`.

## File structure (top-level)

- `src/ui` — React + Tailwind UI
- `src/electron` — Electron main process and preload bridge. If you made any file changes in this dir, make sure to run npm run transpile:electron and restart the dev server.
- `dist-react` — Vite build output
- `dist-electron` — Transpiled Electron output
- `electron-builder.json` — Packaging configuration
- `vite.config.ts` — Vite config (aliases `@` → `src/ui`, `@features` → `src/ui/features`)

## Features overview

- Projects are stored under the app's userData directory in a `projects/` folder
- Import PDFs into projects; basic metadata parsing (title, authors, year, pages, DOI/ISBN)
- Persistent highlights per PDF; auto-promote Kanban status to "ongoing" when highlights exist
- Screenshot capture (full-screen via electron-screenshots if available, or window-rect capture)
- Safe file access via `preload` bridge with `contextIsolation: true`

## Developer notes

- Electron dev mode loads `http://localhost:5123` and sets the dock/taskbar icon in dev when available
- External links open in the default system browser
- Preload is emitted as `dist-electron/preload.cjs` and referenced by the main window
- Tailwind v4 with the Vite plugin is used for styling
