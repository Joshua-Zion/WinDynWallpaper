import { existsSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'
import { app } from 'electron'

/**
 * 查找 ffmpeg 可执行文件路径
 * 搜索顺序：项目 bin 目录 → 系统 PATH → 常见安装位置
 */
export function findFfmpegPath(): string | null {
  // 1. 项目 bin 目录（开发/打包时手动放置的）
  const devPath = join(__dirname, '..', '..', 'bin', 'ffmpeg', 'ffmpeg.exe')
  if (existsSync(devPath)) return devPath

  // 2. 生产资源目录
  const prodPath = join(process.resourcesPath || '', 'bin', 'ffmpeg', 'ffmpeg.exe')
  if (existsSync(prodPath)) return prodPath

  // 3. 用户数据目录
  const userDataPath = join(app.getPath('userData'), 'bin', 'ffmpeg', 'ffmpeg.exe')
  if (existsSync(userDataPath)) return userDataPath

  // 4. 常见系统安装位置
  const systemPaths = [
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
  ]
  for (const p of systemPaths) {
    if (existsSync(p)) return p
  }

  // 5. 从 PATH 环境变量查找
  try {
    const result = execSync('where ffmpeg 2>nul', { encoding: 'utf-8', shell: 'cmd.exe' }).trim()
    if (result) return result.split('\n')[0].trim()
  } catch {}

  return null
}

/**
 * 查找 ffprobe 可执行文件路径
 */
export function findFfprobePath(): string | null {
  // 1. 项目 bin 目录（开发/打包时手动放置的）
  const devPath = join(__dirname, '..', '..', 'bin', 'ffmpeg', 'ffprobe.exe')
  if (existsSync(devPath)) return devPath

  // 2. 生产资源目录
  const prodPath = join(process.resourcesPath || '', 'bin', 'ffmpeg', 'ffprobe.exe')
  if (existsSync(prodPath)) return prodPath

  // 3. 用户数据目录
  const userDataPath = join(app.getPath('userData'), 'bin', 'ffmpeg', 'ffprobe.exe')
  if (existsSync(userDataPath)) return userDataPath

  // 4. 常见系统安装位置
  const systemPaths = [
    'C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe',
    'C:\\ffmpeg\\bin\\ffprobe.exe',
  ]
  for (const p of systemPaths) {
    if (existsSync(p)) return p
  }

  // 5. 从 PATH 环境变量查找
  try {
    const result = execSync('where ffprobe 2>nul', { encoding: 'utf-8', shell: 'cmd.exe' }).trim()
    if (result) return result.split('\n')[0].trim()
  } catch {}

  return null
}

/**
 * 查找 mpv 可执行文件路径
 */
export function findMpvPath(): string | null {
  // 1. 项目 bin 目录
  const devPath = join(__dirname, '..', '..', 'bin', 'mpv', 'mpv.exe')
  if (existsSync(devPath)) return devPath

  // 2. 生产资源目录
  const prodPath = join(process.resourcesPath || '', 'bin', 'mpv', 'mpv.exe')
  if (existsSync(prodPath)) return prodPath

  // 3. 用户数据目录
  const userDataPath = join(app.getPath('userData'), 'bin', 'mpv', 'mpv.exe')
  if (existsSync(userDataPath)) return userDataPath

  // 4. 常见系统安装位置
  const systemPaths = [
    'C:\\Program Files\\MPV Player\\mpv.exe',
    'C:\\Program Files\\mpv\\mpv.exe',
  ]
  for (const p of systemPaths) {
    if (existsSync(p)) return p
  }

  // 5. 从 PATH 环境变量查找
  try {
    const result = execSync('where mpv 2>nul', { encoding: 'utf-8', shell: 'cmd.exe' }).trim()
    if (result) return result.split('\n')[0].trim()
  } catch {}

  return null
}
