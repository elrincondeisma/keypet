import { Tray, nativeImage, BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';
import { getSettings } from './database';

let tray: Tray | null = null;
let trayWindow: BrowserWindow | null = null;

function createTrayIcon(): Electron.NativeImage {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray_icon.png');
  const img = nativeImage.createFromPath(iconPath);
  const resized = img.resize({ width: 22, height: 22 });
  resized.setTemplateImage(true);
  return resized;
}

export function createTray(onTogglePet: () => void, onOpenStats: () => void, onOpenSettings: () => void, onChangeSize: (size: string) => void): Tray {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('KeyPet');

  tray.on('click', () => {
    if (trayWindow && trayWindow.isVisible()) {
      trayWindow.hide();
      return;
    }
    showTrayWindow(onTogglePet, onOpenStats, onOpenSettings, onChangeSize);
  });

  return tray;
}

function showTrayWindow(onTogglePet: () => void, onOpenStats: () => void, onOpenSettings: () => void, onChangeSize: (size: string) => void): void {
  if (!tray) return;

  if (!trayWindow) {
    trayWindow = new BrowserWindow({
      width: 340,
      height: 460,
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
    ipcMain.on('tray:change-size', (_event, size: string) => onChangeSize(size));
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
  trayWindow.webContents.send('size-update', getSettings().size);
}

export function updateTrayStats(today: number, streak: number): void {
  if (trayWindow && !trayWindow.isDestroyed()) {
    trayWindow.webContents.send('stats-update', { today, streak });
  }
}

export function updateTraySize(size: string): void {
  if (trayWindow && !trayWindow.isDestroyed()) {
    trayWindow.webContents.send('size-update', size);
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
