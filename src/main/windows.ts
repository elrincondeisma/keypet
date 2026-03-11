import { BrowserWindow, screen } from 'electron';
import path from 'path';
import { PetCorner, PetState, SIZE_MAP, MIN_WINDOW, PetSize } from '../shared/types';
import { getSettings } from './database';

let petWindow: BrowserWindow | null = null;
let statsWindow: BrowserWindow | null = null;

export function createPetWindow(corner: PetCorner, size: PetSize): BrowserWindow {
  const dims = SIZE_MAP[size];
  const winW = Math.max(dims.w, MIN_WINDOW.w);
  const winH = Math.max(dims.h, MIN_WINDOW.h);
  const display = screen.getPrimaryDisplay();
  const { workArea } = display;
  const margin = 20;

  let x: number, y: number;
  switch (corner) {
    case 'top-left':
      x = workArea.x + margin;
      y = workArea.y + margin;
      break;
    case 'top-right':
      x = workArea.x + workArea.width - winW - margin;
      y = workArea.y + margin;
      break;
    case 'bottom-left':
      x = workArea.x + margin;
      y = workArea.y + workArea.height - winH - margin;
      break;
    case 'bottom-right':
    default:
      x = workArea.x + workArea.width - winW - margin;
      y = workArea.y + workArea.height - winH - margin;
      break;
  }

  petWindow = new BrowserWindow({
    width: winW,
    height: winH,
    x,
    y,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'pet-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  petWindow.setIgnoreMouseEvents(true, { forward: true });
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  petWindow.loadFile(path.join(__dirname, '..', 'renderer', 'pet', 'index.html'));

  petWindow.webContents.on('did-finish-load', () => {
    petWindow?.webContents.send('pet-resize', { w: dims.w, h: dims.h });
  });

  petWindow.on('closed', () => {
    petWindow = null;
  });

  return petWindow;
}

export function updatePetState(state: PetState, level: number): void {
  if (petWindow && !petWindow.isDestroyed()) {
    const character = getSettings().character;
    petWindow.webContents.send('pet-state', { state, level, character });
  }
}

export function repositionPet(corner: PetCorner, size: PetSize): void {
  if (!petWindow || petWindow.isDestroyed()) return;

  const dims = SIZE_MAP[size];
  const winW = Math.max(dims.w, MIN_WINDOW.w);
  const winH = Math.max(dims.h, MIN_WINDOW.h);
  const display = screen.getPrimaryDisplay();
  const { workArea } = display;
  const margin = 20;

  let x: number, y: number;
  switch (corner) {
    case 'top-left':
      x = workArea.x + margin;
      y = workArea.y + margin;
      break;
    case 'top-right':
      x = workArea.x + workArea.width - winW - margin;
      y = workArea.y + margin;
      break;
    case 'bottom-left':
      x = workArea.x + margin;
      y = workArea.y + workArea.height - winH - margin;
      break;
    case 'bottom-right':
    default:
      x = workArea.x + workArea.width - winW - margin;
      y = workArea.y + workArea.height - winH - margin;
      break;
  }

  petWindow.setBounds({ x, y, width: winW, height: winH });
  petWindow.webContents.send('pet-resize', { w: dims.w, h: dims.h });
}

export function showPet(): void {
  petWindow?.show();
}

export function hidePet(): void {
  petWindow?.hide();
}

export function isPetVisible(): boolean {
  return petWindow?.isVisible() ?? false;
}

export function setPetIgnoreMouseEvents(ignore: boolean): void {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
}

export function movePet(x: number, y: number): void {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.setPosition(Math.round(x), Math.round(y));
  }
}

export function createStatsWindow(): BrowserWindow {
  if (statsWindow && !statsWindow.isDestroyed()) {
    statsWindow.focus();
    return statsWindow;
  }

  statsWindow = new BrowserWindow({
    width: 700,
    height: 550,
    minWidth: 500,
    minHeight: 400,
    title: 'KeyPet - Statistics',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'stats-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  statsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'stats', 'index.html'));

  statsWindow.on('closed', () => {
    statsWindow = null;
  });

  return statsWindow;
}

export function destroyAllWindows(): void {
  if (petWindow && !petWindow.isDestroyed()) petWindow.destroy();
  if (statsWindow && !statsWindow.isDestroyed()) statsWindow.destroy();
  petWindow = null;
  statsWindow = null;
}
