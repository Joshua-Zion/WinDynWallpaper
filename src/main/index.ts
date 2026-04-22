import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { WallpaperManager } from './wallpaper-manager'
import { StoreManager } from './store-manager'
import { DesktopOrganizer } from './desktop-organizer'
import { findFfmpegPath, findMpvPath } from './utils'
import { execSync } from 'child_process'
import { existsSync, createWriteStream } from 'fs'

// 日志重定向到文件
const logStream = createWriteStream(join(app.getPath('userData'), 'debug.log'), { flags: 'a' })
const originalConsoleLog = console.log
console.log = (...args: any[]) => {
  originalConsoleLog(...args)
  logStream.write(new Date().toISOString() + ' - ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\n')
}

// 台式机多 GPU 环境修复：优先禁用硬件加速
app.disableHardwareAcceleration()

// 单实例锁
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// 扩展 App 类型以支持 isQuitting 标志
declare module 'electron' {
  interface App {
    isQuitting?: boolean
  }
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let wallpaperManager: WallpaperManager
let storeManager: StoreManager
let desktopOrganizer: DesktopOrganizer

/** 开机自启注册表路径 */
const AUTO_LAUNCH_REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
const APP_NAME = 'DynWallpaper'

/** 依赖信息接口 */
interface DependencyInfo {
  name: string
  displayName: string
  description: string
  required: boolean
  installed: boolean
  version?: string
  path?: string
  installCommand?: string
  uninstallCommand?: string
}

/** 检查单个依赖 */
function checkDependency(name: string): DependencyInfo {
  const deps: Record<string, DependencyInfo> = {
    mpv: {
      name: 'mpv',
      displayName: 'MPV 播放器',
      description: '动态壁纸播放引擎，用于在桌面渲染视频',
      required: true,
      installed: false
    },
    ffmpeg: {
      name: 'ffmpeg',
      displayName: 'FFmpeg',
      description: '视频缩略图生成工具',
      required: false,
      installed: false
    }
  }

  const dep = deps[name]
  if (!dep) return dep

  // 检查 mpv — 复用 utils.ts 的查找逻辑
  if (name === 'mpv') {
    const mpvPath = findMpvPath()
    if (mpvPath) {
      dep.installed = true
      dep.path = mpvPath
      try {
        const version = execSync(`"${mpvPath}" --version`, { encoding: 'utf-8', timeout: 5000 })
        dep.version = version.split('\n')[0].trim()
      } catch {}
    }
  }

  // 检查 ffmpeg — 复用 utils.ts 的查找逻辑
  if (name === 'ffmpeg') {
    const ffmpegPath = findFfmpegPath()
    if (ffmpegPath) {
      dep.installed = true
      dep.path = ffmpegPath
      try {
        const version = execSync(`"${ffmpegPath}" -version`, { encoding: 'utf-8', timeout: 5000 })
        dep.version = version.split('\n')[0].trim()
      } catch {}
    }
  }

  return dep
}

/** 检查所有依赖 */
function checkDependencies(): DependencyInfo[] {
  return ['mpv', 'ffmpeg'].map(checkDependency)
}

/** 安装依赖 */
async function installDependency(name: string): Promise<{ success: boolean; message: string }> {
  if (name === 'mpv') {
    try {
      // 使用 winget 安装 mpv
      execSync('winget install --id MPV.MPV --accept-source-agreements --accept-package-agreements', {
        encoding: 'utf-8',
        shell: 'cmd.exe',
        timeout: 120000
      })
      return { success: true, message: 'MPV 安装成功' }
    } catch (e: any) {
      return { success: false, message: `安装失败: ${e.message}` }
    }
  }

  if (name === 'ffmpeg') {
    try {
      // 使用 winget 安装 ffmpeg
      execSync('winget install --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements', {
        encoding: 'utf-8',
        shell: 'cmd.exe',
        timeout: 120000
      })
      return { success: true, message: 'FFmpeg 安装成功' }
    } catch (e: any) {
      return { success: false, message: `安装失败: ${e.message}` }
    }
  }

  return { success: false, message: '未知的依赖' }
}

/** 卸载依赖 */
async function uninstallDependency(name: string): Promise<{ success: boolean; message: string }> {
  if (name === 'mpv') {
    try {
      execSync('winget uninstall --id MPV.MPV', {
        encoding: 'utf-8',
        shell: 'cmd.exe',
        timeout: 60000
      })
      return { success: true, message: 'MPV 卸载成功' }
    } catch (e: any) {
      return { success: false, message: `卸载失败: ${e.message}` }
    }
  }

  if (name === 'ffmpeg') {
    try {
      execSync('winget uninstall --id Gyan.FFmpeg', {
        encoding: 'utf-8',
        shell: 'cmd.exe',
        timeout: 60000
      })
      return { success: true, message: 'FFmpeg 卸载成功' }
    } catch (e: any) {
      return { success: false, message: `卸载失败: ${e.message}` }
    }
  }

  return { success: false, message: '未知的依赖' }
}

/** 修复依赖 */
async function repairDependency(name: string): Promise<{ success: boolean; message: string }> {
  // 修复 = 先卸载再安装
  const uninstallResult = await uninstallDependency(name)
  if (!uninstallResult.success && !uninstallResult.message.includes('未找到')) {
    return uninstallResult
  }

  // 等待一下
  await new Promise(resolve => setTimeout(resolve, 1000))

  return installDependency(name)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1200,
    minHeight: 800,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  })

  // 移除默认菜单栏
  mainWindow.setMenu(null)

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
    // DEBUG
    // mainWindow!.webContents.openDevTools()
  })

  // 关闭按钮 → 隐藏窗口，最小化到托盘
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow!.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupIpcHandlers(): void {
  // 壁纸管理
  ipcMain.handle('wallpaper:set-static', async (_e, filePath: string) => {
    return wallpaperManager.setStaticWallpaper(filePath)
  })

  ipcMain.handle('wallpaper:set-dynamic', async (_e, filePath: string) => {
    return wallpaperManager.setDynamicWallpaper(filePath)
  })

  ipcMain.handle('wallpaper:restore-default', async () => {
    return wallpaperManager.restoreDefault()
  })

  ipcMain.handle('wallpaper:stop-dynamic', async () => {
    wallpaperManager.stopDynamic()
    return { success: true, message: '动态壁纸已停止' }
  })

  ipcMain.handle('wallpaper:get-current', async () => {
    // 优先从配置中读取当前壁纸ID
    const storedId = storeManager.getCurrentWallpaperId()
    if (storedId) {
      const wallpaper = storeManager.getWallpaperById(storedId)
      if (wallpaper) {
        return {
          id: wallpaper.id,
          path: wallpaper.localPath,
          type: wallpaper.type
        }
      }
    }
    // 回退到旧逻辑：通过路径匹配
    const current = wallpaperManager.getCurrentWallpaper()
    if (!current) return null
    const wallpapers = storeManager.getWallpapers()
    const found = wallpapers.find(w => w.localPath === current.path)
    return { ...current, id: found?.id || null }
  })

  // 壁纸库管理
  ipcMain.handle('store:set-current-wallpaper-id', async (_e, id: string | null) => {
    storeManager.setCurrentWallpaperId(id)
    return { success: true }
  })

  ipcMain.handle('store:add-wallpaper', async (_e, filePath: string, type: 'static' | 'dynamic') => {
    return storeManager.addWallpaper(filePath, type)
  })

  ipcMain.handle('store:remove-wallpaper', async (_e, id: string) => {
    return storeManager.removeWallpaper(id)
  })

  ipcMain.handle('store:get-wallpapers', async () => {
    return storeManager.getWallpapers()
  })

  ipcMain.handle('store:batch-update-dimensions', async () => {
    return storeManager.batchUpdateDimensions()
  })

  // 壁纸详情管理
  ipcMain.handle('store:get-wallpaper-by-id', async (_e, id: string) => {
    return storeManager.getWallpaperById(id)
  })

  ipcMain.handle('store:rename-wallpaper', async (_e, id: string, newName: string) => {
    return storeManager.renameWallpaper(id, newName)
  })

  ipcMain.handle('store:delete-wallpapers', async (_e, ids: string[]) => {
    return storeManager.deleteWallpapers(ids)
  })

  // 壁纸目录管理
  ipcMain.handle('store:get-wallpaper-dir', () => {
    return {
      currentDir: storeManager.getWallpaperDir(),
      defaultDir: storeManager.getDefaultWallpaperDir(),
      isDefault: storeManager.isUsingDefaultDir()
    }
  })

  ipcMain.handle('store:set-wallpaper-dir', async (_e, dir: string) => {
    return storeManager.setWallpaperDir(dir)
  })

  ipcMain.handle('store:scan-directory', async (_e, dir: string) => {
    return storeManager.scanDirectory(dir)
  })

  // 目录选择对话框
  ipcMain.handle('dialog:select-directory', async (_e, defaultPath?: string) => {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      defaultPath
    })
    if (result.canceled || !result.filePaths.length) return null
    return result.filePaths[0]
  })

  // 文件对话框（支持多选）
  ipcMain.handle('dialog:open-file', async (_e, filters: Electron.FileFilter[]) => {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile', 'multiSelections'],
      filters
    })
    return result
  })

  // 开机自启
  ipcMain.handle('auto-launch:get', () => getAutoLaunch())
  ipcMain.handle('auto-launch:set', (_e, enabled: boolean) => setAutoLaunch(enabled))

  // 系统信息
  ipcMain.handle('system:get-displays', () => {
    const { screen } = require('electron')
    return screen.getAllDisplays().map((d: Electron.Display, index: number) => ({
      id: d.id.toString(),
      name: d.label || `显示器 ${index + 1}`,
      width: d.bounds.width,
      height: d.bounds.height,
      scaleFactor: d.scaleFactor
    }))
  })

  // 裁剪壁纸
  ipcMain.handle('wallpaper:crop', async (_e, id: string, crop: { x: number, y: number, width: number, height: number }) => {
    try {
      const wallpaper = storeManager.getWallpaperById(id)
      if (!wallpaper) {
        return { success: false, message: '壁纸不存在' }
      }
      if (wallpaper.type !== 'static') {
        return { success: false, message: '只能裁剪静态图片' }
      }
      
      const result = await storeManager.cropWallpaper(id, crop)
      return result
    } catch (error: any) {
      return { success: false, message: error.message }
    }
  })

  // 桌面整理
  ipcMain.handle('desktop:organize', async () => {
    return desktopOrganizer.organize()
  })

  ipcMain.handle('desktop:restore-layout', async () => {
    return desktopOrganizer.restore()
  })

  ipcMain.handle('desktop:get-icons', async () => {
    try {
      const icons = desktopOrganizer.getDesktopIcons()
      return { success: true, icons }
    } catch (e: any) {
      return { success: false, message: e.message }
    }
  })
}

/** 获取开机自启状态 */
function getAutoLaunch(): boolean {
  try {
    const result = execSync(`reg query "${AUTO_LAUNCH_REG_KEY}" /v "${APP_NAME}" 2>nul`, {
      encoding: 'utf-8',
      shell: 'cmd.exe'
    })
    return result.includes(APP_NAME)
  } catch {
    return false
  }
}

/** 设置开机自启 */
function setAutoLaunch(enabled: boolean): { success: boolean; message: string } {
  try {
    if (enabled) {
      // 获取可执行文件路径（生产模式使用 --hidden 参数后台启动）
      const appPath = is.dev
        ? process.execPath
        : `"${app.getPath('exe')}" --hidden`

      execSync(`reg add "${AUTO_LAUNCH_REG_KEY}" /v "${APP_NAME}" /t REG_SZ /d "${appPath}" /f`, {
        encoding: 'utf-8',
        shell: 'cmd.exe'
      })
      return { success: true, message: is.dev ? '开机自启已开启（开发模式）' : '开机自启已开启' }
    } else {
      // 删除注册表项
      execSync(`reg delete "${AUTO_LAUNCH_REG_KEY}" /v "${APP_NAME}" /f 2>nul`, {
        encoding: 'utf-8',
        shell: 'cmd.exe'
      })
      return { success: true, message: '开机自启已关闭' }
    }
  } catch (e: any) {
    return { success: false, message: `操作失败: ${e.message}` }
  }
}

/** 创建系统托盘 */
function createTray(): void {
  // 托盘图标路径
  const devPath = join(__dirname, '..', '..', 'resources', 'icon.ico')
  const prodPath = join(process.resourcesPath!, 'resources', 'icon.ico')

  let icon: nativeImage | null = null
  if (!is.dev && existsSync(prodPath)) {
    icon = nativeImage.createFromPath(prodPath)
  } else if (is.dev && existsSync(devPath)) {
    icon = nativeImage.createFromPath(devPath)
  }

  // 回退：纯色图标（16x16 PNG base64）
  if (!icon || icon.isEmpty()) {
    const blueIconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAO0lEQVQ4y2P4//8/AwMDA8N/BgYGBob/DAwMDP8ZGBgYGBgY/jMwMDAwMPxnYGDIYWBgYPjPwMDAwPCfgYGB4T/DfwYGBgZG/BoAAQAA3/8DwOqK5hYAAAAASUVORK5CYII='
    icon = nativeImage.createFromDataURL(`data:image/png;base64,${blueIconBase64}`)
  }

  tray = new Tray(icon)
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主面板',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true
        wallpaperManager?.cleanup()
        app.quit()
      }
    }
  ])

  tray.setToolTip('DynWallpaper - 动态壁纸')
  tray.setContextMenu(contextMenu)

  // 双击托盘图标显示窗口
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.dynwallpaper.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  wallpaperManager = new WallpaperManager()
  storeManager = new StoreManager()
  desktopOrganizer = new DesktopOrganizer()
  setupIpcHandlers()
  createWindow()
  createTray()  // 创建系统托盘

  // 检查是否为开机自启后台模式（--hidden 参数）
  const isHiddenLaunch = process.argv.includes('--hidden')
  if (!isHiddenLaunch) {
    mainWindow?.show()
  }

  // 恢复动态壁纸
  wallpaperManager.restoreDynamicWallpaper()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else if (mainWindow) mainWindow.show()
  })
})

// 依赖检查
ipcMain.handle('deps:check', async () => {
  return checkDependencies()
})

ipcMain.handle('deps:install', async (_e, dep: string) => {
  return installDependency(dep)
})

ipcMain.handle('deps:uninstall', async (_e, dep: string) => {
  return uninstallDependency(dep)
})

ipcMain.handle('deps:repair', async (_e, dep: string) => {
  return repairDependency(dep)
})

app.on('window-all-closed', () => {
  // 不退出应用，保持在托盘运行
  // 只有在 app.isQuitting = true 时才真正退出
})

app.on('before-quit', () => {
  app.isQuitting = true
  wallpaperManager?.cleanup()
})


