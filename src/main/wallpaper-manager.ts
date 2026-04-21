import { exec, execSync, spawn } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { app, BrowserWindow, screen } from 'electron'
import { existsSync, writeFileSync, readFileSync } from 'fs'
import { createHash } from 'crypto'
import { findFfmpegPath, findMpvPath } from './utils'

const execAsync = promisify(exec)

/**
 * Windows 壁纸管理器
 * 静态壁纸：SystemParametersInfo API
 * 动态壁纸：WorkerW + mpv --wid 嵌入桌面图标下方
 */
export class WallpaperManager {
  private mpvProcess: ReturnType<typeof spawn> | null = null
  private mpvPid: number | null = null  // 跟踪 mpv 进程 PID
  private previousWallpaper: string | null = null
  private workerWSctiptPath: string | null = null
  private currentWallpaperPath: string | null = null

  constructor() {
    this.previousWallpaper = this.readCurrentWallpaper()
    this.currentWallpaperPath = this.readCurrentDynamicWallpaper()
  }

  /** 读取当前系统壁纸 */
  private readCurrentWallpaper(): string {
    try {
      return execSync(
        `(Get-ItemProperty 'HKCU:\\Control Panel\\Desktop' -Name Wallpaper).Wallpaper`,
        { encoding: 'utf-8', shell: 'powershell.exe' }
      ).trim()
    } catch { return '' }
  }

  /** 读取当前动态壁纸路径 */
  private readCurrentDynamicWallpaper(): string | null {
    try {
      const dataPath = join(app.getPath('userData'), 'dynamic_wallpaper.json')
      if (!existsSync(dataPath)) return null
      const data = JSON.parse(readFileSync(dataPath, 'utf-8'))
      return data.path || null
    } catch { return null }
  }

  /** 保存当前动态壁纸路径 */
  private writeCurrentDynamicWallpaper(path: string): void {
    try {
      const dataPath = join(app.getPath('userData'), 'dynamic_wallpaper.json')
      writeFileSync(dataPath, JSON.stringify({ path, time: Date.now() }), 'utf-8')
      this.currentWallpaperPath = path
    } catch {}
  }

  /** 清除动态壁纸记录 */
  private clearCurrentDynamicWallpaper(): void {
    try {
      const dataPath = join(app.getPath('userData'), 'dynamic_wallpaper.json')
      if (existsSync(dataPath)) {
        const { unlinkSync } = require('fs')
        unlinkSync(dataPath)
      }
      this.currentWallpaperPath = null
    } catch {}
  }

  /** 恢复动态壁纸（应用启动时调用） */
  async restoreDynamicWallpaper(): Promise<boolean> {
    if (!this.currentWallpaperPath) return false
    if (!existsSync(this.currentWallpaperPath)) {
      this.clearCurrentDynamicWallpaper()
      return false
    }
    const result = await this.setDynamicWallpaper(this.currentWallpaperPath)
    return result.success
  }

  /** 设置静态壁纸 */
  async setStaticWallpaper(filePath: string): Promise<{ success: boolean; message: string }> {
    if (!existsSync(filePath)) return { success: false, message: '文件不存在' }
    try {
      this.stopDynamicWallpaper()
      this.clearCurrentDynamicWallpaper()
      const bmpPath = join(app.getPath('userData'), 'current_wallpaper.bmp')
      await this.convertToBmp(filePath, bmpPath)

      const script = `
        $path = '${bmpPath.replace(/'/g, "''")}'
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WP {
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
}
"@
        [WP]::SystemParametersInfo(0x0014, 0, $path, 0x01 -bor 0x02)
      `
      const encoded = Buffer.from(script, 'utf16le').toString('base64')
      await execAsync(`powershell -NoProfile -EncodedCommand ${encoded}`)
      return { success: true, message: '壁纸设置成功' }
    } catch (err: any) {
      return { success: false, message: `设置壁纸失败: ${err.message}` }
    }
  }

  /** 获取 ffmpeg 路径 */
  private getFfmpegPath(): string | null {
    // 开发模式：__dirname = out/main，需要向上两级到项目根
    // 生产模式：resourcesPath 指向 resources 目录
    const devPath = join(__dirname, '..', '..', 'bin', 'ffmpeg', 'ffmpeg.exe')
    const prodPath = join(process.resourcesPath || '', 'bin', 'ffmpeg', 'ffmpeg.exe')
    const userDataPath = join(app.getPath('userData'), 'bin', 'ffmpeg', 'ffmpeg.exe')

    if (existsSync(devPath)) {
      return devPath
    }
    if (existsSync(prodPath)) {
      return prodPath
    }
    if (existsSync(userDataPath)) {
      return userDataPath
    }

    // 检查 PATH
    try {
      const result = execSync('where ffmpeg 2>nul', { encoding: 'utf-8', shell: 'cmd.exe' }).trim()
      if (result) {
        return result.split('\n')[0].trim()
      }
    } catch {}
    return null
  }

  /** 生成无声视频（去除音频轨道）- 按源文件缓存 */
  private async generateSilentVideo(sourcePath: string): Promise<string | null> {
    const ffmpegPath = findFfmpegPath()
    if (!ffmpegPath) {
      return null
    }

    // 使用源文件的 hash 作为缓存文件名，避免冲突
    const sourceHash = createHash('md5').update(sourcePath).digest('hex').substring(0, 12)
    const silentPath = join(app.getPath('userData'), `silent_${sourceHash}.mp4`)

    // 如果已存在且源文件未修改，直接返回缓存
    if (existsSync(silentPath)) {
      try {
        const sourceStat = execSync(`(Get-Item '${sourcePath}').LastWriteTime.Ticks`, { encoding: 'utf-8', shell: 'powershell.exe' }).trim()
        const silentStat = execSync(`(Get-Item '${silentPath}').LastWriteTime.Ticks`, { encoding: 'utf-8', shell: 'powershell.exe' }).trim()
        if (silentStat > sourceStat) {
          return silentPath
        }
      } catch {}
    }

    // 用 ffmpeg 提取视频轨道（无音频）
    try {
      const { stdout, stderr } = await execAsync(
        `"${ffmpegPath}" -y -i "${sourcePath}" -c:v copy -an "${silentPath}"`,
        { timeout: 30000 }
      )
      if (existsSync(silentPath)) {
        return silentPath
      }
    } catch (err: any) {
      console.error('生成无声视频失败:', err.message)
    }
    return null
  }

  /**
   * 设置动态壁纸 — WorkerW 方案
   * 原理：发送 0x052C 给 Progman 创建 WorkerW，
   * 找到不含 SHELLDLL_DefView 的 WorkerW（图标层下方），
   * 用 mpv --wid 嵌入该窗口
   */
  async setDynamicWallpaper(filePath: string): Promise<{ success: boolean; message: string }> {
    if (!existsSync(filePath)) return { success: false, message: '文件不存在' }

    const mpvPath = findMpvPath()
    if (!mpvPath) {
      return { success: false, message: '动态壁纸需要 mpv 播放器，请安装 mpv 或放入 bin/mpv/ 目录' }
    }

    try {
      this.stopDynamicWallpaper()
      this.previousWallpaper = this.readCurrentWallpaper()

      // 1. 获取 WorkerW 窗口句柄
      const workerWHwnd = await this.getWorkerWHwnd()
      if (!workerWHwnd) {
        return { success: false, message: '无法获取桌面壁纸窗口句柄' }
      }

      // 2. 尝试生成无声视频
      const videoPath = await this.generateSilentVideo(filePath) || filePath

      // 3. 用 mpv --wid 嵌入 WorkerW 窗口
      this.mpvProcess = spawn(mpvPath, [
        '--wid=' + workerWHwnd,
        '--loop-file=inf',
        '--no-osc',
        '--no-osd-bar',
        '--panscan=1.0',
        '--keep-open=yes',
        '--framedrop=vo',
        '--video-sync=display-resample',
        '--no-media-controls',  // 禁用 Windows 媒体控制，不在系统媒体控制中显示
        '--really-quiet',       // 静默模式，不输出播放状态
        '--msg-level=all=no',   // 禁用所有日志输出
        videoPath
      ], {
        detached: true,
        stdio: 'ignore'  // 忽略 stdout/stderr，不捕获输出
      })

      // 保存当前动态壁纸路径
      this.writeCurrentDynamicWallpaper(filePath)

      return { success: true, message: '动态壁纸设置成功' }
    } catch (err: any) {
      console.error('设置动态壁纸错误:', err)
      return { success: false, message: `设置动态壁纸失败: ${err.message}` }
    }
  }

  /**
   * 获取 WorkerW 窗口句柄
   * 使用编译好的 GetWorkerW.exe（.NET Framework C#）调用 Win32 API
   * 绕过 PowerShell 子进程 Window Station 隔离问题
   */
  private async getWorkerWHwnd(): Promise<string | null> {
    try {
      // 查找 GetWorkerW.exe 路径
      const paths = [
        join(__dirname, '..', '..', 'resources', 'bin', 'GetWorkerW.exe'),
        join(process.resourcesPath || '', 'bin', 'GetWorkerW.exe'),
      ]
      let exePath = paths.find(p => existsSync(p))
      if (!exePath) return null

      const { stdout } = await execAsync(`"${exePath}"`, { timeout: 5000 })
      const hwnd = stdout.trim()
      if (!hwnd || isNaN(Number(hwnd))) return null
      return hwnd
    } catch {
      return null
    }
  }

  /** 恢复默认壁纸 */
  async restoreDefault(): Promise<{ success: boolean; message: string }> {
    this.stopDynamicWallpaper()
    try {
      const defaultWp = join(process.env.SystemRoot || 'C:\\Windows', 'Web', 'Wallpaper', 'Windows', 'img0.jpg')
      if (existsSync(defaultWp)) return await this.setStaticWallpaper(defaultWp)
      return { success: true, message: '已恢复默认壁纸' }
    } catch (err: any) {
      return { success: false, message: `恢复默认壁纸失败: ${err.message}` }
    }
  }

  /** 获取当前壁纸信息 */
  getCurrentWallpaper(): { path: string; type: 'static' | 'dynamic' | 'default' } | null {
    // 优先检查动态壁纸
    if (this.currentWallpaperPath && this.mpvProcess) {
      return { path: this.currentWallpaperPath, type: 'dynamic' }
    }
    const current = this.readCurrentWallpaper()
    if (!current) return null
    const defaultPath = join(process.env.SystemRoot || 'C:\\Windows', 'Web', 'Wallpaper', 'Windows', 'img0.jpg')
    if (current === defaultPath) return { path: current, type: 'default' }
    return { path: current, type: 'static' }
  }

  /** 停止动态壁纸 - 精确只杀自己启动的进程 */
  private stopDynamicWallpaper(): void {
    // 1. 优先用保存的进程引用杀掉
    if (this.mpvProcess) {
      try {
        this.mpvProcess.kill('SIGKILL')
      } catch {}
      this.mpvProcess = null
    }

    // 2. 用 PID 精确杀掉（保险措施）
    if (this.mpvPid) {
      try {
        // taskkill /pid 只杀掉指定进程，不误杀其他 mpv
        execSync(`taskkill /f /pid ${this.mpvPid} 2>nul`, { shell: 'cmd.exe' })
      } catch (e) {
        // 进程可能已退出，忽略错误
      }
      this.mpvPid = null
    }
  }

  /** 图片转 BMP */
  private async convertToBmp(sourcePath: string, targetPath: string): Promise<void> {
    if (sourcePath.toLowerCase().endsWith('.bmp')) {
      if (sourcePath !== targetPath) {
        const { copyFileSync } = await import('fs')
        copyFileSync(sourcePath, targetPath)
      }
      return
    }
    const script = `
      $src = '${sourcePath.replace(/'/g, "''")}'
      $dst = '${targetPath.replace(/'/g, "''")}'
      Add-Type -AssemblyName System.Drawing
      $img = [System.Drawing.Image]::FromFile($src)
      $img.Save($dst, [System.Drawing.Imaging.ImageFormat]::Bmp)
      $img.Dispose()
    `
    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    await execAsync(`powershell -NoProfile -EncodedCommand ${encoded}`)
  }

  /** 停止动态壁纸（公开方法） */
  stopDynamic(): void {
    this.stopDynamicWallpaper()
    this.clearCurrentDynamicWallpaper()
  }

  /** 清理资源 */
  cleanup(): void {
    this.stopDynamicWallpaper()
  }
}
