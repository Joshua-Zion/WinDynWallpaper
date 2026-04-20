import { contextBridge, ipcRenderer } from 'electron'

// 暴露完整的 API
contextBridge.exposeInMainWorld('electronAPI', {
  openFile: (options) => ipcRenderer.invoke('dialog:open-file', options),
  selectDirectory: (defaultPath?: string) => ipcRenderer.invoke('dialog:select-directory', defaultPath),
  addWallpaper: (filePath, type) => ipcRenderer.invoke('store:add-wallpaper', filePath, type),
  removeWallpaper: (id) => ipcRenderer.invoke('store:remove-wallpaper', id),
  setStaticWallpaper: (filePath) => ipcRenderer.invoke('wallpaper:set-static', filePath),
  setDynamicWallpaper: (filePath) => ipcRenderer.invoke('wallpaper:set-dynamic', filePath),
  stopDynamicWallpaper: () => ipcRenderer.invoke('wallpaper:stop-dynamic'),
  restoreDefault: () => ipcRenderer.invoke('wallpaper:restore-default'),
  getCurrentWallpaper: () => ipcRenderer.invoke('wallpaper:get-current'),
  setCurrentWallpaperId: (id: string | null) => ipcRenderer.invoke('store:set-current-wallpaper-id', id),
  getWallpapers: () => ipcRenderer.invoke('store:get-wallpapers'),
  getWallpaperById: (id: string) => ipcRenderer.invoke('store:get-wallpaper-by-id', id),
  renameWallpaper: (id: string, newName: string) => ipcRenderer.invoke('store:rename-wallpaper', id, newName),
  deleteWallpapers: (ids: string[]) => ipcRenderer.invoke('store:delete-wallpapers', ids),
  batchUpdateDimensions: () => ipcRenderer.invoke('store:batch-update-dimensions'),
  // 壁纸目录配置
  getWallpaperDir: () => ipcRenderer.invoke('store:get-wallpaper-dir'),
  setWallpaperDir: (dir: string) => ipcRenderer.invoke('store:set-wallpaper-dir', dir),
  scanDirectory: (dir: string) => ipcRenderer.invoke('store:scan-directory', dir),
  // 依赖检查
  checkDependencies: () => ipcRenderer.invoke('deps:check'),
  installDependency: (dep) => ipcRenderer.invoke('deps:install', dep),
  uninstallDependency: (dep) => ipcRenderer.invoke('deps:uninstall', dep),
  repairDependency: (dep) => ipcRenderer.invoke('deps:repair', dep),
  // 开机自启
  getAutoLaunch: () => ipcRenderer.invoke('auto-launch:get'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('auto-launch:set', enabled)
})
