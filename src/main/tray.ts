import { Tray, nativeImage, BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';

let tray: Tray | null = null;
let trayWindow: BrowserWindow | null = null;

function createTrayIcon(): Electron.NativeImage {
  // Create a 22x22 template image for macOS menubar
  const size = 22;
  const buf = Buffer.alloc(size * size * 4, 0);

  // Draw a simple pet silhouette (cat face)
  const pixels: [number, number][] = [
    // Ears
    [3, 4], [4, 3], [5, 4],
    [16, 4], [17, 3], [18, 4],
    // Head outline
    [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [11, 5], [12, 5], [13, 5], [14, 5], [15, 5], [16, 5],
    [4, 6], [17, 6],
    [4, 7], [17, 7],
    [3, 8], [18, 8],
    [3, 9], [18, 9],
    [3, 10], [18, 10],
    [4, 11], [17, 11],
    [5, 12], [16, 12],
    [6, 13], [7, 13], [8, 13], [9, 13], [10, 13], [11, 13], [12, 13], [13, 13], [14, 13], [15, 13],
    // Eyes
    [7, 8], [8, 8], [13, 8], [14, 8],
    [7, 9], [8, 9], [13, 9], [14, 9],
    // Nose
    [10, 10], [11, 10],
    // Mouth
    [9, 11], [10, 11], [11, 11], [12, 11],
    // Body
    [6, 14], [7, 14], [8, 14], [9, 14], [10, 14], [11, 14], [12, 14], [13, 14], [14, 14], [15, 14],
    [5, 15], [16, 15],
    [5, 16], [16, 16],
    [5, 17], [6, 17], [7, 17], [8, 17], [9, 17], [10, 17], [11, 17], [12, 17], [13, 17], [14, 17], [15, 17], [16, 17],
  ];

  for (const [x, y] of pixels) {
    if (x >= 0 && x < size && y >= 0 && y < size) {
      const idx = (y * size + x) * 4;
      buf[idx] = 0;     // R
      buf[idx + 1] = 0; // G
      buf[idx + 2] = 0; // B
      buf[idx + 3] = 255; // A
    }
  }

  const img = nativeImage.createFromBuffer(buf, { width: size, height: size });
  img.setTemplateImage(true);
  return img;
}

export function createTray(onTogglePet: () => void, onOpenStats: () => void, onOpenSettings: () => void): Tray {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('KeyPet');

  tray.on('click', () => {
    if (trayWindow && trayWindow.isVisible()) {
      trayWindow.hide();
      return;
    }
    showTrayWindow(onTogglePet, onOpenStats, onOpenSettings);
  });

  return tray;
}

function showTrayWindow(onTogglePet: () => void, onOpenStats: () => void, onOpenSettings: () => void): void {
  if (!tray) return;

  if (!trayWindow) {
    trayWindow = new BrowserWindow({
      width: 300,
      height: 340,
      show: false,
      frame: false,
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'tray-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    trayWindow.loadFile(path.join(__dirname, '..', 'renderer', 'tray', 'index.html'));

    trayWindow.on('blur', () => {
      trayWindow?.hide();
    });

    ipcMain.on('tray:toggle-pet', () => onTogglePet());
    ipcMain.on('tray:open-stats', () => {
      trayWindow?.hide();
      onOpenStats();
    });
    ipcMain.on('tray:open-settings', () => {
      trayWindow?.hide();
      onOpenSettings();
    });
    ipcMain.on('tray:quit', () => {
      const { app } = require('electron');
      app.quit();
    });
  }

  // Position window near tray icon
  const trayBounds = tray.getBounds();
  const windowBounds = trayWindow.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });

  const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  const y = Math.round(trayBounds.y + trayBounds.height);

  trayWindow.setPosition(
    Math.max(display.workArea.x, Math.min(x, display.workArea.x + display.workArea.width - windowBounds.width)),
    y
  );
  trayWindow.show();
  trayWindow.focus();
}

export function updateTrayStats(today: number, streak: number): void {
  if (trayWindow && !trayWindow.isDestroyed()) {
    trayWindow.webContents.send('stats-update', { today, streak });
  }
}

export function destroyTray(): void {
  if (trayWindow) {
    trayWindow.destroy();
    trayWindow = null;
  }
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
