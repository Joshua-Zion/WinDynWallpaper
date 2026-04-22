import { execSync } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'

/** 桌面图标信息 */
export interface DesktopIcon {
  name: string
  path: string
  ext: string
  isFolder: boolean
  isSystem: boolean
}

/** 整理结果 */
export interface OrganizeResult {
  success: boolean
  message: string
  stats?: Record<string, number>
}

export class DesktopOrganizer {
  private toolPath: string
  private snapshotPath: string

  constructor() {
    // PowerShell 脚本路径
    if (is.dev) {
      this.toolPath = join(__dirname, '..', '..', 'resources', 'bin', 'DesktopOrganizer.ps1')
    } else {
      this.toolPath = join(process.resourcesPath, 'bin', 'DesktopOrganizer.ps1')
    }

    // 快照路径
    this.snapshotPath = join(app.getPath('userData'), 'desktop-snapshot.json')
  }

  /** 获取桌面图标列表 */
  getDesktopIcons(): DesktopIcon[] {
    if (!existsSync(this.toolPath)) {
      throw new Error(`DesktopOrganizer.ps1 不存在: ${this.toolPath}`)
    }

    try {
      const result = execSync(`powershell -ExecutionPolicy Bypass -File "${this.toolPath}" -Command get-items`, {
        encoding: 'utf-8',
        timeout: 15000,
        maxBuffer: 1024 * 1024 * 10
      })

      const icons: DesktopIcon[] = JSON.parse(result.trim())
      return icons
    } catch (e: any) {
      return { success: false, message: `获取桌面图标失败: ${e.message}` }
    }
  }

  /** 一键整理 */
  organize(): OrganizeResult {
    if (!existsSync(this.toolPath)) {
      return { success: false, message: `DesktopOrganizer.ps1 不存在` }
    }

    try {
      const result = execSync(`powershell -ExecutionPolicy Bypass -File "${this.toolPath}" -Command organize -SnapshotPath "${this.snapshotPath}"`, {
        encoding: 'utf-8',
        timeout: 30000,
        maxBuffer: 1024 * 1024
      })

      const res: OrganizeResult = JSON.parse(result.trim())
      return res
    } catch (e: any) {
      return { success: false, message: `整理失败: ${e.message}` }
    }
  }

  /** 恢复布局 */
  restore(): OrganizeResult {
    if (!existsSync(this.toolPath)) {
      return { success: false, message: `DesktopOrganizer.ps1 不存在` }
    }

    try {
      const result = execSync(`powershell -ExecutionPolicy Bypass -File "${this.toolPath}" -Command restore -SnapshotPath "${this.snapshotPath}"`, {
        encoding: 'utf-8',
        timeout: 30000,
        maxBuffer: 1024 * 1024
      })

      const res: OrganizeResult = JSON.parse(result.trim())
      return res
    } catch (e: any) {
      return { success: false, message: `恢复失败: ${e.message}` }
    }
  }

  /** 检查工具是否可用 */
  isToolAvailable(): boolean {
    return existsSync(this.toolPath)
  }

  /** 获取工具路径 */
  getToolPath(): string {
    return this.toolPath
  }
}
