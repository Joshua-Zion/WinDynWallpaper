#!/usr/bin/env node
// 自定义 dev 启动脚本 - 替代 electron-vite dev
// 直接启动 electron-vite dev server 和 electron，分离进程避免 exit code 混淆

const { spawn } = require('child_process')
const path = require('path')

const root = process.cwd()

// 1. 启动 vite dev server (electron-vite 的 main/preload build + renderer dev server)
console.log('[dev] Starting vite dev server...')
const vite = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['electron-vite', 'dev', '--skipBuild'],
  { 
    cwd: root, 
    stdio: 'inherit',
    shell: true,
    detached: true
  }
)

// 不要等待 vite 退出 - 它应该在后台运行
vite.unref()

// 给 vite 一些时间启动
setTimeout(() => {
  console.log('[dev] Starting electron...')
  
  // 2. 直接启动 electron
  const electronBin = path.join(root, 'node_modules', '.bin', 
    process.platform === 'win32' ? 'electron.cmd' : 'electron')
  
  const electron = spawn(
    electronBin,
    ['.'],
    {
      cwd: root,
      stdio: 'inherit',
      shell: true,
      detached: true,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        ELECTRON_IS_DEV: '1'
      }
    }
  )
  
  electron.unref()
  console.log('[dev] Electron started, pid:', electron.pid)
  
  // 不等待 electron 退出
}, 5000)
