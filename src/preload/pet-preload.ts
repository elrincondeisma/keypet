import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('keypet', {
  onPetState: (callback: (data: { state: string; level: number; character: string }) => void) => {
    ipcRenderer.on('pet-state', (_event, data) => callback(data));
  },
  getCharacter: () => ipcRenderer.invoke('get-character'),
  onPetResize: (callback: (data: { w: number; h: number }) => void) => {
    ipcRenderer.on('pet-resize', (_event, data) => callback(data));
  },
  setIgnoreMouseEvents: (ignore: boolean) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore);
  },
  moveWindow: (x: number, y: number) => {
    ipcRenderer.send('move-window', { x, y });
  },
  showContextMenu: () => {
    ipcRenderer.send('show-pet-context-menu');
  },
  // Pomodoro controls (available for future renderer use)
  pomodoroStart:     () => ipcRenderer.send('pomodoro:start'),
  pomodoroPause:     () => ipcRenderer.send('pomodoro:pause'),
  pomodoroResume:    () => ipcRenderer.send('pomodoro:resume'),
  pomodoroSkipBreak: () => ipcRenderer.send('pomodoro:skip-break'),
  pomodoroCancel:    () => ipcRenderer.send('pomodoro:cancel'),
  pomodoroGetState:  () => ipcRenderer.invoke('pomodoro:get-state'),
});
