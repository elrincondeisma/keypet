import { app, ipcMain, Menu, BrowserWindow, Notification, systemPreferences, dialog } from 'electron';
import { initDatabase, incrementKeyCount, getSettings, saveSettings, resetAll, closeDatabase } from './database';
import { keyboardListener } from './keyboard-listener';
import { getFullStats, determinePetState, checkAndRecordEvolution } from './stats-engine';
import { createTray, updateTrayStats, updateTraySize, destroyTray } from './tray';
import { createPetWindow, updatePetState, repositionPet, showPet, hidePet, isPetVisible, createStatsWindow, destroyAllWindows, setPetIgnoreMouseEvents, movePet } from './windows';
import { pomodoroEngine } from './pomodoro-engine';
import { Settings, PetState, PetSize, PomodoroState } from '../shared/types';

let currentPetState: PetState = 'idle';
let currentLevel = 1;
let statsUpdateInterval: ReturnType<typeof setInterval> | null = null;

async function checkAccessibilityPermission(): Promise<boolean> {
  if (process.platform !== 'darwin') return true;

  const trusted = systemPreferences.isTrustedAccessibilityClient(false);
  if (trusted) return true;

  const result = await dialog.showMessageBox({
    type: 'info',
    title: 'KeyPet - Permiso de accesibilidad requerido',
    message: 'KeyPet necesita permiso de accesibilidad para contar tus pulsaciones.',
    detail: 'KeyPet NO registra qué teclas pulsas, solo la cantidad.\n\nTodos los datos se guardan en tu ordenador.\n\nHaz clic en "Abrir ajustes" para conceder el permiso y luego reinicia KeyPet.',
    buttons: ['Abrir ajustes', 'Salir'],
    defaultId: 0,
  });

  if (result.response === 0) {
    systemPreferences.isTrustedAccessibilityClient(true);
  }

  return false;
}

async function initialize(): Promise<void> {
  initDatabase();

  const settings = getSettings();

  // Sync login item with stored setting on every launch
  app.setLoginItemSettings({ openAtLogin: settings.autoStart });

  const hasPermission = await checkAccessibilityPermission();
  if (!hasPermission) {
    app.quit();
    return;
  }

  // Create pet window
  if (settings.petVisible) {
    createPetWindow(settings.corner, settings.size);
  }

  // Start keyboard listener
  keyboardListener.on('keypress', () => {
    incrementKeyCount();
  });

  keyboardListener.on('rate', ({ rate, timeSinceLastKey, continuousMinutes }: { rate: number; timeSinceLastKey: number; continuousMinutes: number }) => {
    // During a Pomodoro break the pet stays idle regardless of typing
    const pomState = pomodoroEngine.getState();
    if (pomState.active && pomState.phase !== 'work') return;

    const newState = determinePetState(rate, timeSinceLastKey, continuousMinutes);
    if (newState !== currentPetState) {
      currentPetState = newState;
      updatePetState(currentPetState, currentLevel);
    }
  });

  keyboardListener.start();

  // Pomodoro events
  setupPomodoroEvents();

  // Create tray
  createTray(
    () => {
      // Toggle pet visibility
      if (isPetVisible()) {
        hidePet();
        const s = getSettings();
        s.petVisible = false;
        saveSettings(s);
      } else {
        const s = getSettings();
        s.petVisible = true;
        saveSettings(s);
        createPetWindow(s.corner, s.size);
      }
    },
    () => {
      createStatsWindow();
    },
    () => {
      const win = createStatsWindow();
      win.webContents.once('did-finish-load', () => {
        win.webContents.send('navigate-tab', 'settings');
      });
      if (!win.webContents.isLoading()) {
        win.webContents.send('navigate-tab', 'settings');
      }
    },
    (size: string) => {
      const s = getSettings();
      s.size = size as PetSize;
      saveSettings(s);
      repositionPet(s.corner, s.size, false);
    }
  );

  // Periodic stats update (every 30s)
  statsUpdateInterval = setInterval(() => {
    updateStats();
  }, 30000);

  // Initial stats
  updateStats();

  // Set up IPC handlers
  setupIPC();
}

function setupPomodoroEvents(): void {
  // During a break: force pet to idle
  // When a work phase starts: restore normal state
  pomodoroEngine.on('tick', (state: PomodoroState) => {
    if (!state.active) return;
    if (state.phase !== 'work') {
      updatePetState('idle', currentLevel);
    }
  });

  pomodoroEngine.on('complete', (phase: string) => {
    const settings = getSettings();
    if (phase === 'work') {
      // Work session done — celebrate briefly
      updatePetState('celebration', currentLevel);
      setTimeout(() => updatePetState('idle', currentLevel), 4000);

      if (settings.notifications !== 'none') {
        new Notification({
          title: 'Pomodoro completado',
          body: 'Buen trabajo. Es hora de descansar.',
        }).show();
      }
    } else {
      // Break done — nudge to get back to work
      updatePetState('celebration', currentLevel);
      setTimeout(() => {
        updatePetState(currentPetState, currentLevel);
      }, 3000);

      if (settings.notifications !== 'none') {
        new Notification({
          title: 'Descanso terminado',
          body: 'A por el siguiente Pomodoro.',
        }).show();
      }
    }
  });

  pomodoroEngine.on('cancelled', () => {
    updatePetState(currentPetState, currentLevel);
  });
}

function updateStats(): void {
  const stats = getFullStats();
  currentLevel = stats.evolutionLevel;
  updateTrayStats(stats.today, stats.streak);

  // Check for evolution
  const evolution = checkAndRecordEvolution();
  if (evolution) {
    currentLevel = evolution.newLevel;
    updatePetState('celebration', currentLevel);

    const settings = getSettings();
    if (settings.notifications !== 'none') {
      new Notification({
        title: '¡KeyPet ha evolucionado!',
        body: `¡Tu pet ha alcanzado el nivel ${evolution.newLevel}!`,
      }).show();
    }

    // Reset to normal state after celebration
    setTimeout(() => {
      updatePetState(currentPetState, currentLevel);
    }, 5000);
  }
}

function setupIPC(): void {
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('get-stats', () => {
    return getFullStats();
  });

  ipcMain.handle('get-settings', () => {
    return getSettings();
  });

  ipcMain.handle('get-character', () => {
    return getSettings().character;
  });

  ipcMain.handle('save-settings', (_event, newSettings: Settings) => {
    const oldSettings = getSettings();
    saveSettings(newSettings);

    if (newSettings.corner !== oldSettings.corner || newSettings.size !== oldSettings.size) {
      const cornerChanged = newSettings.corner !== oldSettings.corner;
      repositionPet(newSettings.corner, newSettings.size, cornerChanged);
    }

    if (newSettings.autoStart !== oldSettings.autoStart) {
      app.setLoginItemSettings({ openAtLogin: newSettings.autoStart });
    }

    // Push new character to pet renderer immediately
    if (newSettings.character !== oldSettings.character) {
      updatePetState(currentPetState, currentLevel);
    }

    return true;
  });

  ipcMain.handle('reset-pet', () => {
    resetAll();
    currentLevel = 1;
    currentPetState = 'idle';
    updatePetState('idle', 1);
    return true;
  });

  ipcMain.on('set-ignore-mouse-events', (_event, ignore: boolean) => {
    setPetIgnoreMouseEvents(ignore);
  });

  ipcMain.on('move-window', (_event, { x, y }: { x: number; y: number }) => {
    movePet(x, y);
  });

  ipcMain.on('show-pet-context-menu', (event) => {
    const stats = getFullStats();
    const pom = pomodoroEngine.getState();
    const win = BrowserWindow.fromWebContents(event.sender);

    const formatTime = (secs: number): string => {
      const m = Math.floor(secs / 60).toString().padStart(2, '0');
      const s = (secs % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    };

    // Build Pomodoro section dynamically based on current state
    type MenuItemConstructorOptions = Parameters<typeof Menu.buildFromTemplate>[0][number];
    const pomodoroItems: MenuItemConstructorOptions[] = [];

    if (!pom.active) {
      const workMins = getSettings().pomodoroWork;
      pomodoroItems.push({ label: `Iniciar Pomodoro (${workMins} min)`, click: () => pomodoroEngine.start() });
    } else {
      const phaseLabel = pom.phase === 'work' ? 'Trabajando' : pom.phase === 'short-break' ? 'Descanso corto' : 'Descanso largo';
      pomodoroItems.push({ label: `${phaseLabel} · ${formatTime(pom.remainingSeconds)}`, enabled: false });

      if (pom.phase === 'work') {
        if (pom.paused) {
          pomodoroItems.push({ label: 'Reanudar Pomodoro', click: () => pomodoroEngine.resume() });
        } else {
          pomodoroItems.push({ label: 'Pausar Pomodoro', click: () => pomodoroEngine.pause() });
        }
      } else {
        pomodoroItems.push({ label: 'Saltarse el descanso', click: () => pomodoroEngine.skipBreak() });
      }

      pomodoroItems.push({ label: 'Cancelar Pomodoro', click: () => pomodoroEngine.cancel() });
    }

    const menu = Menu.buildFromTemplate([
      {
        label: `Hoy: ${stats.today.toLocaleString()} teclas`,
        enabled: false,
      },
      {
        label: `Racha: ${stats.streak} día${stats.streak !== 1 ? 's' : ''}`,
        enabled: false,
      },
      {
        label: `Nivel: ${stats.evolutionLevel}`,
        enabled: false,
      },
      { type: 'separator' },
      ...pomodoroItems,
      { type: 'separator' },
      {
        label: 'Ver estadísticas',
        click: () => createStatsWindow(),
      },
    ]);
    if (win) menu.popup({ window: win });
  });

  // Pomodoro control — also callable from other renderers in the future
  ipcMain.on('pomodoro:start',      () => pomodoroEngine.start());
  ipcMain.on('pomodoro:pause',      () => pomodoroEngine.pause());
  ipcMain.on('pomodoro:resume',     () => pomodoroEngine.resume());
  ipcMain.on('pomodoro:skip-break', () => pomodoroEngine.skipBreak());
  ipcMain.on('pomodoro:cancel',     () => pomodoroEngine.cancel());

  ipcMain.handle('pomodoro:get-state', () => pomodoroEngine.getState());
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.whenReady().then(initialize);
}

app.on('window-all-closed', () => {
  // Don't quit when windows close - keep running in tray
});

app.on('before-quit', () => {
  pomodoroEngine.cancel();
  keyboardListener.stop();
  if (statsUpdateInterval) clearInterval(statsUpdateInterval);
  destroyTray();
  destroyAllWindows();
  closeDatabase();
});

// macOS: keep in dock if needed
app.dock?.hide();
