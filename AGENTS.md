# AGENTS.md — KeyPet

Guidance for agentic coding agents working in this repository.

---

## Project Overview

**KeyPet** is an Electron 33 desktop app that displays a pixel-art pet that reacts to keystrokes. It is a macOS-first (Phase 1) product with a Node.js main process, plain HTML/JS renderers, and no frontend framework.

**Architecture layers:**
- `src/main/` — Electron main process (Node.js + TypeScript). Compiled by `tsc`.
- `src/preload/` — Context bridge scripts (TypeScript). Compiled by `tsc`.
- `src/shared/` — Shared types and constants (TypeScript). Compiled by `tsc`.
- `src/renderer/` — Browser-side UI (plain HTML + vanilla JS). **NOT compiled** — copied verbatim to `dist/renderer/` by `scripts/copy-renderer.js`.

---

## Build & Run Commands

```bash
# Install dependencies (also triggers electron-rebuild for native modules)
npm install

# Build only (tsc + copy renderer)
npm run build

# Build and launch the Electron app
npm run dev
# or
npm run start

# Rebuild native modules against current Electron version
npm run rebuild
```

The build output mirrors `src/` under `dist/`. The entry point is `dist/main/index.js`.

---

## Testing

**There is currently no test framework configured.** No Jest, Vitest, Playwright, or Mocha. No test files exist and no `test` script is in `package.json`.

When adding tests, prefer **Vitest** (compatible with the ES2020 target and TypeScript strict mode already in use). A single test file would be run with:

```bash
npx vitest run src/main/stats-engine.test.ts
```

Until a test runner is installed, validate logic changes by running the app:

```bash
npm run dev
```

---

## TypeScript Configuration

From `tsconfig.json`:
- `target: ES2020`, `module: commonjs`
- `strict: true` — all strict checks are enabled (no implicit `any`, strict null checks, etc.)
- `esModuleInterop: true`
- `outDir: dist`, `rootDir: src`
- `src/renderer/**/*` is **explicitly excluded** from compilation

Always run `npm run build` to confirm there are no TypeScript errors before considering a change done. There is no separate type-check script.

---

## Code Style

No ESLint or Prettier is configured. Follow the conventions below consistently.

### Formatting
- 2-space indentation
- Single quotes for strings
- Semicolons at end of statements
- No trailing commas in function parameters; trailing commas acceptable in multi-line object/array literals

### Imports
- Use ES module `import` syntax (compiled to CommonJS by `tsc`)
- Named imports for local modules and for `electron`
- Default imports for Node built-ins and third-party packages (`import path from 'path'`, `import Database from 'better-sqlite3'`)
- No barrel/index re-export files
- Import order: Node built-ins → third-party → local (`../shared/` before `./` siblings)

```typescript
import path from 'path';
import Database from 'better-sqlite3';
import { app, ipcMain } from 'electron';
import { Settings, PetState } from '../shared/types';
import { initDatabase, getSettings } from './database';
```

### Naming Conventions
| Kind | Convention | Example |
|---|---|---|
| Files | `kebab-case` | `stats-engine.ts`, `pet-preload.ts` |
| Classes | `PascalCase` | `KeyboardListener` |
| Interfaces / Types | `PascalCase` | `DailyStats`, `PetState`, `Settings` |
| Functions / variables | `camelCase` | `incrementKeyCount`, `createPetWindow` |
| Constants (module-level immutable) | `SCREAMING_SNAKE_CASE` | `DEFAULT_SETTINGS`, `EVOLUTION_THRESHOLDS` |
| IPC channel names | `kebab-case` strings | `'get-stats'`, `'tray:toggle-pet'` |

### Types
- Always provide explicit return types on exported functions
- Use `| null` for nullable singletons (`let tray: Tray | null = null`)
- Use `ReturnType<typeof setInterval>` for timer handles
- Prefer type assertions only where necessary (e.g., `better-sqlite3` returns `unknown`): `const row = stmt.get() as { value: string } | undefined`
- Do not use `any`; use `unknown` and narrow with type guards when the shape is truly unknown

### Module Pattern (non-class modules)
Most modules use a **module-level singleton** pattern — a `let` variable at the top and exported functions that close over it. Do not introduce classes where this pattern already exists.

```typescript
// Correct — follow existing module pattern
let db: Database.Database;
export function initDatabase(): void { db = new Database(dbPath); }
export function getSettings(): Settings { /* uses db */ }
```

### Class Pattern
When a class is needed (e.g., `KeyboardListener` extending `EventEmitter`), export a single **singleton instance** at the bottom of the file:

```typescript
class KeyboardListener extends EventEmitter {
  private running = false;
  start(): void { ... }
  stop(): void { ... }
}
export const keyboardListener = new KeyboardListener();
```

### Error Handling
- The project currently does **not use `try/catch`** — errors propagate or crash the process intentionally at MVP stage
- Use early returns with null guards: `if (!tray) return;`
- Use optional chaining for potentially-destroyed window handles: `petWindow?.show()`
- Guard destroyed windows: `if (petWindow && !petWindow.isDestroyed()) { ... }`
- For user-facing permission errors, use `dialog.showMessageBox` and return `false` to abort initialization

### IPC Conventions
- Main → Renderer push: `webContents.send('channel-name', payload)`
- Renderer → Main with response: `ipcMain.handle('channel-name', () => getData())`
- Renderer → Main fire-and-forget: `ipcMain.on('channel-name', () => doAction())`
- All preload scripts expose a single `keypet` namespace via `contextBridge.exposeInMainWorld('keypet', { ... })` with `contextIsolation: true` and `nodeIntegration: false`

### Renderer Code (HTML + vanilla JS)
- Plain JavaScript inside `<script>` tags — no TypeScript, no bundler, no framework
- Use `async/await` for IPC calls: `const stats = await window.keypet.getStats()`
- DOM queries: `document.getElementById`, `querySelectorAll`, `textContent`, `innerHTML`

---

## Key Files Reference

| File | Purpose |
|---|---|
| `src/shared/types.ts` | All shared interfaces, type aliases, and constants (`DEFAULT_SETTINGS`, `EVOLUTION_THRESHOLDS`, etc.) |
| `src/main/index.ts` | App entry — `app.whenReady`, IPC handlers, lifecycle |
| `src/main/database.ts` | SQLite layer via `better-sqlite3` |
| `src/main/stats-engine.ts` | Keystroke stats, evolution logic, state computation |
| `src/main/keyboard-listener.ts` | Global keyboard hook via `uiohook-napi`, `KeyboardListener` class |
| `src/main/tray.ts` | Menu bar tray icon and popover window |
| `src/main/windows.ts` | `BrowserWindow` creation and management |
| `src/preload/pet-preload.ts` | Exposes `onPetState` to the pet renderer |
| `src/preload/stats-preload.ts` | Exposes `getStats`, `getSettings`, `saveSettings` |
| `src/preload/tray-preload.ts` | Exposes `onStatsUpdate`, `togglePet`, `openStats`, `quit` |
| `src/renderer/pet/index.html` | Transparent canvas window — pixel-art pet animation |
| `src/renderer/stats/index.html` | Statistics panel — charts, tabs, settings UI |
| `src/renderer/tray/index.html` | Tray popover — today count and streak |
| `scripts/copy-renderer.js` | Post-build: copies `src/renderer/` → `dist/renderer/` |

---

## Platform Notes

- **macOS is the primary target.** Accessibility permissions are required for the global keyboard hook (`uiohook-napi`). The app checks and requests this permission on startup.
- Native modules (`better-sqlite3`, `uiohook-napi`) must be compiled against the installed Electron version. Run `npm run rebuild` after switching Electron versions or after a fresh `npm install` on a new machine.
- Performance targets from the PRD: `<0.5% CPU` at idle, `<80 MB RAM`.
