import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('keypet', {
  onStatsUpdate: (callback: (data: { today: number; streak: number }) => void) => {
    ipcRenderer.on('stats-update', (_event, data) => callback(data));
  },
  togglePet: () => ipcRenderer.send('tray:toggle-pet'),
  openStats: () => ipcRenderer.send('tray:open-stats'),
  openSettings: () => ipcRenderer.send('tray:open-settings'),
  quit: () => ipcRenderer.send('tray:quit'),
});
