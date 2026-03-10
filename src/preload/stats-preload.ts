import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('keypet', {
  getStats: () => ipcRenderer.invoke('get-stats'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: unknown) => ipcRenderer.invoke('save-settings', settings),
  resetPet: () => ipcRenderer.invoke('reset-pet'),
  onNavigateTab: (callback: (tab: string) => void) => {
    ipcRenderer.on('navigate-tab', (_event, tab) => callback(tab));
  },
});
