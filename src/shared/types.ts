export interface ElectronAPI {
  setStaticWallpaper: (filePath: string) => Promise<{ success: boolean; message: string }>
  setDynamicWallpaper: (filePath: string) => Promise<{ success: boolean; message: string }>
  restoreDefault: () => Promise<{ success: boolean; message: string }>
  getCurrentWallpaper: () => Promise<{ path: string; type: 'static' | 'dynamic' | 'default' }>
  addWallpaper: (filePath: string, type: 'static' | 'dynamic') => Promise<{ success: boolean; message: string; id?: string }>
  removeWallpaper: (id: string) => Promise<{ success: boolean; message: string }>
  getWallpapers: () => Promise<any[]>
  openFile: (filters: { name: string; extensions: string[] }[]) => Promise<any>
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
