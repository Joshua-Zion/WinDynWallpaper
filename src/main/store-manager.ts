import { join } from 'path'
import { app } from 'electron'
import { existsSync, mkdirSync, copyFileSync, unlinkSync, statSync, writeFileSync, readFileSync, readdirSync, renameSync } from 'fs'
import { createHash } from 'crypto'
import { exec, spawn, execSync } from 'child_process'
import { findFfmpegPath, findFfprobePath, findMpvPath } from './utils'

interface WallpaperEntry {
  id: string
  name: string
  type: 'static' | 'dynamic'
  sourcePath: string
  localPath: string
  thumbnailPath: string
  addedAt: number
  fileSize: number
  width?: number
  height?: number
  resolutionTier?: 'SD' | 'HD' | '1K' | '2K' | '4K' | '8K'
  aspectRatio?: string
}

interface StoreConfig {
  wallpaperDir: string  // 自定义壁纸目录，若为空则用默认值
  currentWallpaperId: string | null  // 当前应用的壁纸ID
}

/**
 * 壁纸库存储管理器
 */
export class StoreManager {
  private appDataDir: string
  private defaultWallpaperDir: string
  private defaultThumbnailDir: string
  private defaultIndexFile: string
  private configFile: string
  private config: StoreConfig

  /** 实际使用的壁纸目录（可能来自配置） */
  public get wallpaperDir(): string {
    return this.config.wallpaperDir || this.defaultWallpaperDir
  }

  /** 实际使用的缩略图目录 */
  private get thumbnailDir(): string {
    return this.wallpaperDir ? join(this.wallpaperDir, 'thumbnails') : this.defaultThumbnailDir
  }

  /** 计算分辨率等级 */
  private calculateResolutionTier(width: number): '<1K' | '1K' | '2K' | '4K' | '8K' | '>8K' {
    if (width < 1920) return '<1K'
    if (width < 2560) return '1K'
    if (width < 3840) return '2K'
    if (width < 7680) return '4K'
    if (width < 8192) return '8K'
    return '>8K'
  }

  /** 计算宽高比（直接显示宽×高） */
  private calculateAspectRatio(width: number, height: number): string {
    return `${width}×${height}`
  }

  private index: WallpaperEntry[] = []

  constructor() {
    this.appDataDir = join(app.getPath('userData'), 'wallpaper-store')
    this.defaultWallpaperDir = join(this.appDataDir, 'wallpapers')
    this.defaultThumbnailDir = join(this.appDataDir, 'thumbnails')
    this.defaultIndexFile = join(this.appDataDir, 'index.json')
    this.configFile = join(this.appDataDir, 'config.json')

    this.config = this.loadConfig()
    this.initDirectories()
    this.loadIndex()
  }

  private getConfigFile(): string {
    return this.configFile
  }

  private loadConfig(): StoreConfig {
    try {
      if (existsSync(this.getConfigFile())) {
        const data = readFileSync(this.getConfigFile(), 'utf-8')
        const cfg = JSON.parse(data)
        // 验证目录有效性
        if (cfg.wallpaperDir && !existsSync(cfg.wallpaperDir)) {
          cfg.wallpaperDir = ''
        }
        return cfg
      }
    } catch { /* ignore */ }
    return { wallpaperDir: '', currentWallpaperId: null }
  }

  private saveConfig(): void {
    try {
      const data = JSON.stringify(this.config, null, 2)
      writeFileSync(this.getConfigFile(), Buffer.from(data, 'utf-8'))
    } catch (err) { console.error('保存配置失败:', err) }
  }

  private getIndexFile(): string {
    return this.wallpaperDir ? join(this.wallpaperDir, 'index.json') : this.defaultIndexFile
  }

  private initDirectories(): void {
    // 默认目录始终初始化（保证 config.json 和旧数据能访问）
    if (!existsSync(this.appDataDir)) mkdirSync(this.appDataDir, { recursive: true })
    if (!existsSync(this.defaultWallpaperDir)) mkdirSync(this.defaultWallpaperDir, { recursive: true })
    if (!existsSync(this.defaultThumbnailDir)) mkdirSync(this.defaultThumbnailDir, { recursive: true })
    // 自定义目录也需要初始化
    if (this.config.wallpaperDir && !existsSync(this.config.wallpaperDir)) {
      mkdirSync(this.config.wallpaperDir, { recursive: true })
    }
  }

  private loadIndex(): void {
    const idxFile = this.getIndexFile()
    try {
      if (existsSync(idxFile)) {
        const data = readFileSync(idxFile, 'utf-8')
        this.index = JSON.parse(data)
        if (!Array.isArray(this.index)) this.index = []
      }
    } catch { this.index = [] }
  }

  private saveIndex(): void {
    const idxFile = this.getIndexFile()
    try {
      // 确保目录存在
      const dir = join(idxFile, '..')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const data = JSON.stringify(this.index, null, 2)
      writeFileSync(idxFile, Buffer.from(data, 'utf-8'))
    } catch (err) { console.error('保存索引失败:', err) }
  }

  private generateId(filePath: string): string {
    return createHash('sha256').update(filePath + Date.now()).digest('hex').substring(0, 16)
  }

  private getFileExtension(filePath: string): string {
    const match = filePath.match(/\.([a-z0-9]+)$/i)
    return match ? match[1].toLowerCase() : 'bin'
  }

  private isVideoFile(filePath: string): boolean {
    const videoExts = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpeg', 'mpg']
    const ext = this.getFileExtension(filePath).toLowerCase()
    return videoExts.includes(ext)
  }

  // ===== 公开方法 =====

  /** 获取当前壁纸目录 */
  getWallpaperDir(): string {
    return this.wallpaperDir
  }

  /** 获取默认壁纸目录 */
  getDefaultWallpaperDir(): string {
    return this.defaultWallpaperDir
  }

  /** 是否使用默认目录 */
  isUsingDefaultDir(): boolean {
    return !this.config.wallpaperDir
  }

  /** 设置壁纸目录 */
  setWallpaperDir(dir: string): { success: boolean; message: string; migratedCount: number } {
    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      const oldDir = this.wallpaperDir
      const oldIndexFile = this.getIndexFile()

      // 保存旧数据路径
      const oldIndex = [...this.index]

      // 更新配置
      this.config.wallpaperDir = dir
      this.saveConfig()

      // 重新初始化目录
      this.initDirectories()
      this.index = []

      // 迁移现有壁纸到新目录
      let migratedCount = 0
      for (const entry of oldIndex) {
        if (existsSync(entry.localPath)) {
          try {
            const ext = this.getFileExtension(entry.localPath)
            const newPath = join(dir, `${entry.id}.${ext}`)
            copyFileSync(entry.localPath, newPath)
            // 迁移缩略图
            let newThumb = ''
            if (entry.thumbnailPath && existsSync(entry.thumbnailPath)) {
              newThumb = join(dir, 'thumbnails', `${entry.id}.jpg`)
              const thumbDir = join(dir, 'thumbnails')
              if (!existsSync(thumbDir)) mkdirSync(thumbDir, { recursive: true })
              copyFileSync(entry.thumbnailPath, newThumb)
            }
            this.index.push({ ...entry, localPath: newPath, thumbnailPath: newThumb })
            // 删除旧文件
            unlinkSync(entry.localPath)
            if (entry.thumbnailPath && existsSync(entry.thumbnailPath)) unlinkSync(entry.thumbnailPath)
            migratedCount++
          } catch (e: any) {
            console.error('迁移壁纸失败:', entry.name, e.message)
          }
        }
      }

      this.saveIndex()

      // 清理旧目录（如果不同）
      if (oldDir !== dir && existsSync(oldDir)) {
        try {
          const oldThumbDir = join(oldDir, 'thumbnails')
          if (existsSync(oldThumbDir)) {
            const oldThumbs = readdirSync(oldThumbDir)
            for (const f of oldThumbs) {
              try { unlinkSync(join(oldThumbDir, f)) } catch {}
            }
          }
          const oldWallpaperFiles = readdirSync(oldDir)
          for (const f of oldWallpaperFiles) {
            if (f !== 'index.json' && f !== 'thumbnails') {
              try { unlinkSync(join(oldDir, f)) } catch {}
            }
          }
        } catch {}
      }

      return {
        success: true,
        message: migratedCount > 0 ? `目录已切换，${migratedCount} 个壁纸已迁移` : '目录已切换',
        migratedCount
      }
    } catch (err: any) {
      return { success: false, message: `设置目录失败: ${err.message}`, migratedCount: 0 }
    }
  }

  /** 扫描指定目录，将其中的图片/视频注册到壁纸库 */
  async scanDirectory(dir: string): Promise<{ success: boolean; message: string; addedCount: number }> {
    if (!existsSync(dir)) return { success: false, message: '目录不存在', addedCount: 0 }

    const supportedExts = [
      'jpg', 'jpeg', 'png', 'bmp', 'gif', 'webp', 'tiff', 'tif',
      'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpeg', 'mpg'
    ]

    let addedCount = 0
    let skippedCount = 0

    try {
      const files = readdirSync(dir)
      for (const file of files) {
        if (file === 'index.json' || file === 'thumbnails' || file === 'config.json') continue
        const filePath = join(dir, file)
        try {
          const stat = statSync(filePath)
          if (!stat.isFile()) continue
        } catch { continue }

        const ext = this.getFileExtension(file).toLowerCase()
        if (!supportedExts.includes(ext)) continue

        // 检查是否已在库中（按文件名判断）
        const alreadyExists = this.index.some(w => {
          const wName = w.name || ''
          return wName === file
        })
        if (alreadyExists) { skippedCount++; continue }

        // 复制到壁纸目录
        const id = this.generateId(filePath)
        const localPath = join(dir, `${id}.${ext}`)
        try {
          copyFileSync(filePath, localPath)
        } catch { continue }

        const fileStat = statSync(localPath)
        const type: 'static' | 'dynamic' = this.isVideoFile(filePath) ? 'dynamic' : 'static'

        // 生成缩略图
        let thumbnailPath = ''
        try {
          thumbnailPath = type === 'static'
            ? await this.generateImageThumbnail(localPath, id)
            : await this.generateVideoThumbnail(localPath, id)
        } catch {}

        const entry: WallpaperEntry = {
          id, name: file, type,
          sourcePath: filePath, localPath, thumbnailPath,
          addedAt: Date.now(), fileSize: fileStat.size
        }

        this.index.push(entry)
        addedCount++
      }

      if (addedCount > 0) this.saveIndex()

      let msg = `已导入 ${addedCount} 个壁纸`
      if (skippedCount > 0) msg += `（${skippedCount} 个已存在已跳过）`
      return { success: true, message: msg, addedCount }
    } catch (err: any) {
      return { success: false, message: `扫描失败: ${err.message}`, addedCount: 0 }
    }
  }

  /** 添加壁纸（复制到目录） */
  async addWallpaper(filePath: string, type: 'static' | 'dynamic'): Promise<{ success: boolean; message: string; id?: string }> {
    try {
      if (!existsSync(filePath)) return { success: false, message: '文件不存在' }

      const existing = this.index.find(item => item.sourcePath === filePath || item.localPath === filePath)
      if (existing) return { success: false, message: '该壁纸已在壁纸库中' }

      const id = this.generateId(filePath)
      const ext = this.getFileExtension(filePath)
      const localPath = join(this.wallpaperDir, `${id}.${ext}`)

      copyFileSync(filePath, localPath)

      const fileStat = statSync(filePath)
      const pathParts = filePath.split(/[/\\]/)
      const name = pathParts[pathParts.length - 1] || `${id}.${ext}`

      const finalType = type || (this.isVideoFile(filePath) ? 'dynamic' : 'static')

      let thumbnailPath = ''
      try {
        thumbnailPath = finalType === 'static'
          ? await this.generateImageThumbnail(localPath, id)
          : await this.generateVideoThumbnail(localPath, id)
      } catch {}

      let width: number | undefined
      let height: number | undefined

      try {
        if (finalType === 'static') {
          // 静态图片获取宽高
          const escapedPath = localPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
          const script = `Add-Type -AssemblyName System.Drawing; $img = [System.Drawing.Image]::FromFile('${escapedPath}'); Write-Host "$($img.Width) $($img.Height)"; $img.Dispose()`
          console.log('[StoreManager] Getting image size for:', localPath)
          console.log('[StoreManager] PowerShell script:', script)
          const result = execSync(`powershell -NoProfile -Command "${script}"`, { encoding: 'utf8' }).toString().trim()
          console.log('[StoreManager] PowerShell result:', result)
          const [w, h] = result.split(' ').map(Number)
          console.log('[StoreManager] Parsed width/height:', w, h)
          if (w && h) {
            width = w
            height = h
          }
        } else {
          // 动态视频获取宽高
          try {
            const ffprobePath = findFfprobePath()
            if (!ffprobePath) {
              console.log('[StoreManager] ffprobe not found')
            } else {
              const escapedPath = localPath.replace(/\\/g, '\\\\')
              console.log('[StoreManager] Getting video size for:', localPath)
              console.log('[StoreManager] ffprobe path:', ffprobePath)
              const ffprobeResult = execSync(`"${ffprobePath}" -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${escapedPath}"`, { encoding: 'utf8' }).toString().trim()
              console.log('[StoreManager] ffprobe result:', ffprobeResult)
              const [w, h] = ffprobeResult.split('x').map(Number)
              console.log('[StoreManager] Parsed width/height:', w, h)
              if (w && h) {
                width = w
                height = h
              }
            }
          } catch (err: any) {
            console.log('[StoreManager] Error getting video dimensions:', err.message)
          }
        }
      } catch (err: any) {
        console.log('[StoreManager] Error getting dimensions:', err.message)
      }

      console.log('[StoreManager] Final width/height:', width, height)
      console.log('[StoreManager] Entry:', { id, name, width, height, resolutionTier: width ? this.calculateResolutionTier(width) : undefined, aspectRatio: width && height ? this.calculateAspectRatio(width, height) : undefined })

      const entry: WallpaperEntry = {
        id, name, type: finalType, sourcePath: filePath, localPath, thumbnailPath,
        addedAt: Date.now(), fileSize: fileStat.size,
        width, height,
        resolutionTier: width ? this.calculateResolutionTier(width) : undefined,
        aspectRatio: width && height ? this.calculateAspectRatio(width, height) : undefined
      }

      this.index.push(entry)
      this.saveIndex()
      return { success: true, message: '壁纸已添加到壁纸库', id }
    } catch (err: any) {
      return { success: false, message: `添加失败: ${err.message}` }
    }
  }

  private async generateImageThumbnail(imagePath: string, id: string): Promise<string> {
    const thumbDir = join(this.wallpaperDir, 'thumbnails')
    if (!existsSync(thumbDir)) mkdirSync(thumbDir, { recursive: true })
    const thumbnailPath = join(thumbDir, `${id}.jpg`)
    const script = `
      $src = '${imagePath.replace(/'/g, "''")}'
      $dst = '${thumbnailPath.replace(/'/g, "''")}'
      Add-Type -AssemblyName System.Drawing
      try {
        $img = [System.Drawing.Image]::FromFile($src)
        $maxW = 320; $maxH = 180
        $ratio = [Math]::Min($maxW / $img.Width, $maxH / $img.Height)
        $w = [int]($img.Width * $ratio); $h = [int]($img.Height * $ratio)
        $bmp = New-Object System.Drawing.Bitmap($w, $h)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($img, 0, 0, $w, $h)
        $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Jpeg)
        $img.Dispose(); $bmp.Dispose(); $g.Dispose()
      } catch { Copy-Item -Path $src -Destination $dst -Force }
    `
    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    try {
      await new Promise<void>((resolve, reject) => {
        exec(`powershell -NoProfile -EncodedCommand ${encoded}`, (err) => err ? reject(err) : resolve())
      })
    } catch {
      if (existsSync(imagePath)) copyFileSync(imagePath, thumbnailPath)
    }
    return thumbnailPath
  }

  private async generateVideoThumbnail(videoPath: string, id: string): Promise<string> {
    const thumbDir = join(this.wallpaperDir, 'thumbnails')
    if (!existsSync(thumbDir)) mkdirSync(thumbDir, { recursive: true })
    const thumbnailPath = join(thumbDir, `${id}.jpg`)

    const ffmpegPath = findFfmpegPath()
    if (ffmpegPath) {
      return new Promise((resolve) => {
        const proc = spawn(ffmpegPath, [
          '-y', '-ss', '0.5', '-i', videoPath,
          '-vframes', '1', '-vf', 'scale=320:-1', thumbnailPath
        ], { stdio: 'pipe' })
        proc.on('close', () => {
          resolve(existsSync(thumbnailPath) ? thumbnailPath : '')
        })
        proc.on('error', () => resolve(''))
        setTimeout(() => { try { proc.kill() } catch {}; resolve('') }, 10000)
      })
    }

    const mpvPath = findMpvPath()
    if (!mpvPath) return ''

    return new Promise((resolve) => {
      const proc = spawn(mpvPath, [
        '--no-audio', '--vo=image:format=jpg', '--start=0.5', '--frames=1', videoPath
      ], { cwd: thumbDir, stdio: 'pipe' })
      proc.on('close', () => {
        try {
          const files = readdirSync(thumbDir)
          const jpg = files.find(f => f.startsWith('mpv-shot') && f.endsWith('.jpg'))
          if (jpg) { renameSync(join(thumbDir, jpg), thumbnailPath); resolve(thumbnailPath) }
          else resolve('')
        } catch { resolve('') }
      })
      proc.on('error', () => resolve(''))
      setTimeout(() => { try { proc.kill() } catch {}; resolve('') }, 10000)
    })
  }

  async removeWallpaper(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const entry = this.index.find(item => item.id === id)
      if (!entry) return { success: false, message: '壁纸不存在' }

      if (existsSync(entry.localPath)) unlinkSync(entry.localPath)
      if (entry.thumbnailPath && existsSync(entry.thumbnailPath)) unlinkSync(entry.thumbnailPath)

      this.index = this.index.filter(item => item.id !== id)
      this.saveIndex()
      return { success: true, message: '壁纸已删除' }
    } catch (err: any) {
      return { success: false, message: `删除失败: ${err.message}` }
    }
  }

  getWallpapers(): WallpaperEntry[] {
    return JSON.parse(JSON.stringify(this.index))
  }

  getWallpapersByType(type: 'static' | 'dynamic'): WallpaperEntry[] {
    return JSON.parse(JSON.stringify(this.index.filter(item => item.type === type)))
  }

  /** 根据ID获取壁纸 */
  getWallpaperById(id: string): WallpaperEntry | null {
    const wallpaper = this.index.find(item => item.id === id)
    return wallpaper ? JSON.parse(JSON.stringify(wallpaper)) : null
  }

  /** 重命名壁纸 */
  renameWallpaper(id: string, newName: string): { success: boolean; message: string } {
    const wallpaper = this.index.find(item => item.id === id)
    if (!wallpaper) {
      return { success: false, message: '壁纸不存在' }
    }

    wallpaper.name = newName
    this.saveIndex()
    return { success: true, message: '重命名成功' }
  }

  /** 批量删除壁纸 */
  deleteWallpapers(ids: string[]): { success: boolean; message: string; deletedCount: number } {
    let deletedCount = 0

    for (const id of ids) {
      const index = this.index.findIndex(item => item.id === id)
      if (index === -1) continue

      const wallpaper = this.index[index]

      // 删除壁纸文件
      try {
        if (existsSync(wallpaper.localPath)) {
          unlinkSync(wallpaper.localPath)
        }
      } catch (err: any) {
        console.error(`删除壁纸文件失败: ${wallpaper.localPath}`, err.message)
      }

      // 删除缩略图
      try {
        if (existsSync(wallpaper.thumbnailPath)) {
          unlinkSync(wallpaper.thumbnailPath)
        }
      } catch (err: any) {
        console.error(`删除缩略图失败: ${wallpaper.thumbnailPath}`, err.message)
      }

      // 从索引中移除
      this.index.splice(index, 1)
      deletedCount++
    }

    if (deletedCount > 0) {
      this.saveIndex()
    }

    return { success: true, message: `已删除 ${deletedCount} 个壁纸`, deletedCount }
  }

  /** 批量更新壁纸的宽高数据 */
  async batchUpdateDimensions(): Promise<{ success: boolean; message: string; updatedCount: number }> {
    let updatedCount = 0

    for (const entry of this.index) {
      try {
        let needsUpdate = false
        let width = entry.width
        let height = entry.height

        // 如果没有宽高，获取宽高
        if (!width || !height) {
          if (entry.type === 'static') {
            const escapedPath = entry.localPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
            const script = `Add-Type -AssemblyName System.Drawing; $img = [System.Drawing.Image]::FromFile('${escapedPath}'); Write-Host "$($($img.Width)) $($($img.Height))"; $img.Dispose()`
            const result = execSync(`powershell -NoProfile -Command "${script}"`, { encoding: 'utf8' }).toString().trim()
            const [w, h] = result.split(' ').map(Number)
            if (w && h) {
              width = w
              height = h
              needsUpdate = true
            }
          } else {
            try {
              const ffprobePath = findFfprobePath()
              if (!ffprobePath) {
                console.log('[StoreManager] ffprobe not found')
              } else {
                const escapedPath = entry.localPath.replace(/\\/g, '\\\\')
                const ffprobeResult = execSync(`"${ffprobePath}" -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${escapedPath}"`, { encoding: 'utf8' }).toString().trim()
                const [w, h] = ffprobeResult.split('x').map(Number)
                if (w && h) {
                  width = w
                  height = h
                  needsUpdate = true
                }
              }
            } catch (err: any) {
              console.log('[StoreManager] Error getting video dimensions:', err.message)
            }
          }
        }

        // 如果有宽高，检查是否需要更新 aspectRatio
        if (width && height) {
          const newAspectRatio = `${width}×${height}`
          if (entry.aspectRatio !== newAspectRatio) {
            needsUpdate = true
          }

          if (needsUpdate) {
            entry.width = width
            entry.height = height
            entry.resolutionTier = this.calculateResolutionTier(width)
            entry.aspectRatio = newAspectRatio
            updatedCount++
          }
        }
      } catch (err: any) {
        console.error(`更新壁纸 ${entry.name} 失败:`, err.message)
      }
    }

    if (updatedCount > 0) {
      this.saveIndex()
    }

    return { success: true, message: `已更新 ${updatedCount} 个壁纸`, updatedCount }
  }

  /** 设置当前壁纸ID */
  setCurrentWallpaperId(id: string | null): void {
    this.config.currentWallpaperId = id
    this.saveConfig()
  }

  /** 获取当前壁纸ID */
  getCurrentWallpaperId(): string | null {
    return this.config.currentWallpaperId || null
  }
}
