import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('keypet', {
  onStatsUpdate: (callback: (data: { today: number; streak: number }) => void) => {
    ipcRenderer.on('stats-update', (_event, data) => callback(data));
  },
  onSizeUpdate: (callback: (size: string) => void) => {
    ipcRenderer.on('size-update', (_event, size) => callback(size));
  },
  changeSize: (size: string) => ipcRenderer.send('tray:change-size', size),
  togglePet: () => ipcRenderer.send('tray:toggle-pet'),
  openStats: () => ipcRenderer.send('tray:open-stats'),
  openSettings: () => ipcRenderer.send('tray:open-settings'),
  quit: () => ipcRenderer.send('tray:quit'),
});
