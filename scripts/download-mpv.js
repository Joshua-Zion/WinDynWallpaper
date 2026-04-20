/**
 * 下载 mpv 播放器到项目中
 */

const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// SourceForge 镜像（更稳定）
const MPV_URL = 'https://downloads.sourceforge.net/project/mpv-player-windows/mpv-x86_64/mpv-x86_64-20240414-git-494a8bc.7z'

const ROOT_DIR = path.join(__dirname, '..')
const BIN_DIR = path.join(ROOT_DIR, 'bin')
const MPV_DIR = path.join(BIN_DIR, 'mpv')
const MPV_EXE = path.join(MPV_DIR, 'mpv.exe')

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`下载: ${url}`)
    const file = fs.createWriteStream(dest)
    
    const request = (urlStr, redirects = 0) => {
      if (redirects > 10) {
        reject(new Error('重定向次数过多'))
        return
      }
      
      const lib = urlStr.startsWith('https') ? https : http
      lib.get(urlStr, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301 || res.statusCode === 303 || res.statusCode === 307) {
          request(res.headers.location, redirects + 1)
          return
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`下载失败: HTTP ${res.statusCode}`))
          return
        }
        
        const total = parseInt(res.headers['content-length'] || '0', 10)
        let downloaded = 0
        
        res.on('data', (chunk) => {
          downloaded += chunk.length
          if (total > 0) {
            const percent = ((downloaded / total) * 100).toFixed(1)
            process.stdout.write(`\r下载进度: ${percent}% (${(downloaded/1024/1024).toFixed(1)}MB/${(total/1024/1024).toFixed(1)}MB)`)
          }
        })
        
        res.pipe(file)
        
        file.on('finish', () => {
          file.close()
          console.log('\n下载完成')
          resolve()
        })
      }).on('error', reject)
    }
    
    request(url)
  })
}

function find7z() {
  const paths = [
    'C:\\Program Files\\7-Zip\\7z.exe',
    'C:\\Program Files (x86)\\7-Zip\\7z.exe'
  ]
  
  for (const p of paths) {
    if (fs.existsSync(p)) return p
  }
  
  try {
    return execSync('where 7z', { encoding: 'utf-8' }).trim().split('\n')[0]
  } catch {}
  
  return null
}

function extractArchive(archivePath, targetDir) {
  const sevenZip = find7z()
  if (!sevenZip) {
    console.log('未找到 7-Zip，尝试使用 PowerShell...')
    
    // 检查是否有 Windows 内置的解压功能
    try {
      // PowerShell 可以解压 .zip 但不能解压 .7z
      console.log('提示: 需要安装 7-Zip 来解压 .7z 文件')
      console.log(`下载地址: https://www.7-zip.org/download.html`)
      return false
    } catch {
      return false
    }
  }
  
  try {
    console.log('使用 7-Zip 解压...')
    execSync(`"${sevenZip}" x "${archivePath}" -o"${targetDir}" -y`, { stdio: 'inherit' })
    return true
  } catch (err) {
    console.error('解压失败:', err.message)
    return false
  }
}

function findMpvExe(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true })
  for (const item of items) {
    const fullPath = path.join(dir, item.name)
    if (item.isDirectory()) {
      const result = findMpvExe(fullPath)
      if (result) return result
    } else if (item.name === 'mpv.exe') {
      return fullPath
    }
  }
  return null
}

async function main() {
  console.log('=== mpv 下载工具 ===\n')
  
  // 检查是否已存在
  if (fs.existsSync(MPV_EXE)) {
    console.log('✓ mpv 已存在，跳过下载')
    console.log(`  路径: ${MPV_EXE}`)
    return
  }
  
  // 创建目录
  if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true })
  
  const archivePath = path.join(BIN_DIR, 'mpv.7z')
  
  // 尝试下载
  try {
    await downloadFile(MPV_URL, archivePath)
  } catch (err) {
    console.error('\n下载失败:', err.message)
    console.log('\n请手动下载 mpv:')
    console.log('  1. 访问 https://mpv.io/installation/')
    console.log('  2. 下载 "mpv-x86_64" 的 Windows 便携版')
    console.log(`  3. 解压并将 mpv.exe 放到: ${MPV_DIR}`)
    return
  }
  
  // 解压
  console.log('\n开始解压...')
  
  const tempDir = path.join(BIN_DIR, 'mpv-temp')
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true })
  
  if (!extractArchive(archivePath, tempDir)) {
    console.log(`\n请手动解压 ${archivePath} 到 ${MPV_DIR}`)
    return
  }
  
  // 查找 mpv.exe
  const mpvFound = findMpvExe(tempDir)
  if (!mpvFound) {
    console.error('错误: 解压后未找到 mpv.exe')
    fs.rmSync(tempDir, { recursive: true })
    return
  }
  
  const mpvDir = path.dirname(mpvFound)
  
  // 移动到目标位置
  if (fs.existsSync(MPV_DIR)) fs.rmSync(MPV_DIR, { recursive: true })
  fs.renameSync(mpvDir, MPV_DIR)
  
  // 清理
  fs.rmSync(tempDir, { recursive: true })
  try { fs.unlinkSync(archivePath) } catch {}
  
  console.log('\n✓ mpv 安装完成!')
  console.log(`  路径: ${MPV_EXE}`)
}

main().catch(err => {
  console.error('\n错误:', err.message)
  process.exit(1)
})
