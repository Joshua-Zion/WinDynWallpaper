interface ElectronAPI {
  // 窗口控制
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  // 文件
  openFile: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>
  selectDirectory: () => Promise<Electron.OpenDialogReturnValue>
  // 壁纸管理
  addWallpaper: (filePath: string, type: 'static' | 'dynamic') => Promise<{ success: boolean; message: string; id?: string }>
  removeWallpaper: (id: string) => Promise<{ success: boolean; message: string }>
  setStaticWallpaper: (filePath: string) => Promise<{ success: boolean; message: string }>
  setDynamicWallpaper: (filePath: string) => Promise<{ success: boolean; message: string }>
  stopDynamicWallpaper: () => Promise<void>
  restoreDefault: () => Promise<{ success: boolean; message: string }>
  getCurrentWallpaper: () => Promise<{ path: string; type: 'static' | 'dynamic' | 'default' } | null>
  setCurrentWallpaperId: (id: string | null) => Promise<{ success: boolean }>
  getWallpapers: () => Promise<Array<{
    id: string
    name: string
    type: 'static' | 'dynamic'
    thumbnailPath?: string
    localPath: string
    addedAt: number
    fileSize: number
    width?: number
    height?: number
    resolutionTier?: 'SD' | 'HD' | '1K' | '2K' | '4K' | '8K'
    aspectRatio?: string
  }>>
  getWallpaperById: (id: string) => Promise<{
    id: string
    name: string
    type: 'static' | 'dynamic'
    thumbnailPath: string
    localPath: string
    addedAt: number
    fileSize: number
    width?: number
    height?: number
    resolutionTier?: 'SD' | 'HD' | '1K' | '2K' | '4K' | '8K'
    aspectRatio?: string
  } | null>
  renameWallpaper: (id: string, newName: string) => Promise<{ success: boolean; message: string }>
  deleteWallpapers: (ids: string[]) => Promise<{ success: boolean; message: string; deletedCount: number }>
  batchUpdateDimensions: () => Promise<{ success: boolean; message: string; updatedCount: number }>
  // 壁纸目录配置
  getWallpaperDir: () => Promise<{ currentDir: string; defaultDir: string; isDefault: boolean }>
  setWallpaperDir: (dir: string) => Promise<{ success: boolean; message: string; migratedCount: number }>
  scanDirectory: (dir: string) => Promise<{ success: boolean; message: string; addedCount: number }>
  // 依赖
  checkDependencies: () => Promise<Array<{
    name: string
    displayName: string
    description: string
    required: boolean
    installed: boolean
    version?: string
    path?: string
  }>>
  installDependency: (dep: string) => Promise<{ success: boolean; message: string }>
  uninstallDependency: (dep: string) => Promise<{ success: boolean; message: string }>
  repairDependency: (dep: string) => Promise<{ success: boolean; message: string }>
  // 开机自启
  getAutoLaunch: () => Promise<boolean>
  setAutoLaunch: (enabled: boolean) => Promise<{ success: boolean; message: string }>
  // 编辑功能
  getDisplays: () => Promise<Array<{
    id: string
    name: string
    width: number
    height: number
    scaleFactor: number
  }>>
  cropWallpaper: (id: string, crop: { x: number; y: number; width: number; height: number }) => Promise<{ success: boolean; message: string }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
