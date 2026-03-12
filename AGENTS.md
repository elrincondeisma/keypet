# AGENTS.md — KeyPet

Guidance for agentic coding agents working in this repository.

---

## Project Overview

**KeyPet** is an Electron 33 desktop app that displays a pixel-art pet reacting to keystrokes. macOS-first (Phase 1). Node.js main process, plain HTML/JS renderers, no frontend framework.

**Architecture layers:**
- `src/main/` — Electron main process (Node.js + TypeScript). Compiled by `tsc`.
- `src/preload/` — Context-bridge scripts (TypeScript). Compiled by `tsc`.
- `src/shared/` — Shared types and constants (TypeScript). Compiled by `tsc`.
- `src/renderer/` — Browser-side UI (plain HTML + vanilla JS). **NOT compiled** — copied verbatim to `dist/renderer/` by `scripts/copy-renderer.js`.

---

## Build & Run Commands

```bash
npm install          # Install deps; triggers electron-rebuild for native modules
npm run build        # tsc + copy renderer → dist/
npm run dev          # build then launch Electron (alias: npm start)
npm run rebuild      # Recompile native modules against current Electron version
npm run dist         # build + electron-builder → release/ (DMG for arm64)
```

The build output mirrors `src/` under `dist/`. Entry point: `dist/main/index.js`.

Always run `npm run build` to confirm no TypeScript errors before marking a change done.

---

## Testing

**No test framework is configured.** No Jest, Vitest, Playwright, or Mocha.

When adding tests, prefer **Vitest** (compatible with ES2020 + TypeScript strict). Run a single file:

```bash
npx vitest run src/main/stats-engine.test.ts
```

Until a runner is installed, validate logic changes by running the app:

```bash
npm run dev
```

---

## TypeScript Configuration (`tsconfig.json`)

- `target: ES2020`, `module: commonjs`, `lib: ["ES2020"]`
- `strict: true` — no implicit `any`, strict null checks, etc.
- `esModuleInterop: true`, `resolveJsonModule: true`, `sourceMap: true`
- `outDir: dist`, `rootDir: src`
- `src/renderer/**/*` is **explicitly excluded** from compilation

---

## Code Style

No ESLint or Prettier. Follow these conventions exactly.

### Formatting
- 2-space indentation
- Single quotes for strings
- Semicolons required
- No trailing commas in function parameters; trailing commas allowed in multi-line object/array literals

### Imports

Order: Node built-ins → third-party → local (`../shared/` before `./` siblings).

```typescript
import path from 'path';
import Database from 'better-sqlite3';
import { app, ipcMain } from 'electron';
import { Settings, PetState } from '../shared/types';
import { initDatabase, getSettings } from './database';
```

- Default imports for Node built-ins and third-party packages
- Named imports for `electron` and all local modules
- No barrel/index re-export files

### Naming Conventions

| Kind | Convention | Example |
|---|---|---|
| Files | `kebab-case` | `stats-engine.ts`, `pet-preload.ts` |
| Classes | `PascalCase` | `KeyboardListener`, `PomodoroEngine` |
| Interfaces / Types | `PascalCase` | `DailyStats`, `PetState`, `Settings` |
| Functions / variables | `camelCase` | `incrementKeyCount`, `createPetWindow` |
| Module-level constants | `SCREAMING_SNAKE_CASE` | `DEFAULT_SETTINGS`, `EVOLUTION_THRESHOLDS` |
| IPC channel names | `kebab-case` strings | `'get-stats'`, `'pomodoro:start'` |

### Types

- Always provide explicit return types on exported functions
- Use `| null` for nullable singletons: `let tray: Tray | null = null`
- Use `ReturnType<typeof setInterval>` for timer handles
- Type assertions only where unavoidable (e.g. `better-sqlite3` returns `unknown`):
  `const row = stmt.get() as { value: string } | undefined`
- Never use `any`; use `unknown` + type guards when the shape is truly unknown

### Module Pattern (non-class modules)

Most modules use a **module-level singleton** — a `let` at the top, exported functions close over it. Do not introduce classes where this pattern already exists.

```typescript
let db: Database.Database;
export function initDatabase(): void { db = new Database(dbPath); }
export function getSettings(): Settings { /* uses db */ }
```

### Class Pattern

When a class is needed (e.g. `KeyboardListener` or `PomodoroEngine` extending `EventEmitter`), export a single **singleton instance** at the bottom:

```typescript
class PomodoroEngine extends EventEmitter {
  private interval: ReturnType<typeof setInterval> | null = null;
  start(): void { ... }
  cancel(): void { ... }
}
export const pomodoroEngine = new PomodoroEngine();
```

### Error Handling

- No `try/catch` — errors propagate or crash intentionally at MVP stage
- Early returns with null guards: `if (!tray) return;`
- Optional chaining for potentially-destroyed handles: `petWindow?.show()`
- Destroyed-window guard before `webContents` access: `if (petWindow && !petWindow.isDestroyed()) { ... }`
- User-facing permission errors: use `dialog.showMessageBox` then return `false` to abort

### IPC Conventions

- Main → Renderer push: `webContents.send('channel-name', payload)`
- Renderer → Main with response: `ipcMain.handle('channel-name', () => getData())`
- Renderer → Main fire-and-forget: `ipcMain.on('channel-name', () => doAction())`
- Preload scripts expose a single `keypet` namespace: `contextBridge.exposeInMainWorld('keypet', { ... })` with `contextIsolation: true` and `nodeIntegration: false`
- IPC channel naming: simple actions use `kebab-case` (`'get-stats'`); namespaced actions use `namespace:verb` (`'pomodoro:start'`, `'tray:toggle-pet'`)

### Database Migrations (`src/main/database.ts`)

- Schema versioned via `meta` table key `db_version`
- Add new migrations to the `MIGRATIONS` array; **never edit existing entries**
- Only additive DDL: `ALTER TABLE … ADD COLUMN`, `CREATE TABLE IF NOT EXISTS`, etc.
- Increment `CURRENT_SCHEMA_VERSION` with each new migration

### Renderer Code (HTML + vanilla JS)

- Plain JavaScript inside `<script>` tags — no TypeScript, no bundler, no framework
- `async/await` for IPC: `const stats = await window.keypet.getStats()`
- DOM queries: `getElementById`, `querySelectorAll`, `textContent`, `innerHTML`

---

## Key Files Reference

| File | Purpose |
|---|---|
| `src/shared/types.ts` | All interfaces, type aliases, and constants (`DEFAULT_SETTINGS`, `EVOLUTION_THRESHOLDS`, `SIZE_MAP`, etc.) |
| `src/main/index.ts` | App entry — `app.whenReady`, IPC handlers, lifecycle |
| `src/main/database.ts` | SQLite layer via `better-sqlite3`; migration runner |
| `src/main/stats-engine.ts` | Keystroke stats, evolution logic, state computation |
| `src/main/keyboard-listener.ts` | Global keyboard hook via `uiohook-napi`, `KeyboardListener` class |
| `src/main/pomodoro-engine.ts` | Pomodoro timer state machine, `PomodoroEngine` class |
| `src/main/tray.ts` | Menu bar tray icon and popover window |
| `src/main/windows.ts` | `BrowserWindow` creation and management |
| `src/preload/pet-preload.ts` | Exposes `onPetState` to the pet renderer |
| `src/preload/stats-preload.ts` | Exposes `getStats`, `getSettings`, `saveSettings`, `resetPet` |
| `src/preload/tray-preload.ts` | Exposes `onStatsUpdate`, `togglePet`, `openStats`, `quit` |
| `src/renderer/pet/index.html` | Transparent canvas window — pixel-art pet animation |
| `src/renderer/stats/index.html` | Statistics panel — charts, tabs, settings UI |
| `src/renderer/tray/index.html` | Tray popover — today count and streak |
| `scripts/copy-renderer.js` | Post-build: copies `src/renderer/` → `dist/renderer/` |

---

## Platform Notes

- **macOS is the primary target.** Accessibility permissions are required for `uiohook-napi`. The app checks and prompts on startup; if denied it calls `app.quit()`.
- Native modules (`better-sqlite3`, `uiohook-napi`) must be compiled against the installed Electron version. Run `npm run rebuild` after switching Electron versions or after a fresh clone.
- Performance targets: `<0.5% CPU` at idle, `<80 MB RAM`.
- `app.dock?.hide()` keeps the app out of the macOS Dock; it lives exclusively in the menu bar tray.
