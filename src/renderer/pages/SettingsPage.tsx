import React, { useState, useEffect } from 'react'
import { toast } from '../components/Toast'

interface DependencyInfo {
  name: string
  displayName: string
  description: string
  required: boolean
  installed: boolean
  version?: string
  path?: string
}

const DEPS_KEY = 'windyn_deps_last_check'
const THEME_KEY = 'windyn_theme'

const SettingsPage: React.FC = () => {
  const [deps, setDeps] = useState<DependencyInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [actionDep, setActionDep] = useState<string | null>(null)
  const [autoLaunch, setAutoLaunch] = useState(false)
  const [autoLaunchLoading, setAutoLaunchLoading] = useState(false)
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [wallpaperDir, setWallpaperDir] = useState({ currentDir: '', defaultDir: '', isDefault: true })
  const [dirLoading, setDirLoading] = useState(false)

  useEffect(() => {
    loadAutoLaunch()
    loadWallpaperDir()
    const stored = localStorage.getItem(DEPS_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setDeps(parsed.deps)
        setLastChecked(new Date(parsed.checkedAt).toLocaleString('zh-CN'))
      } catch { /* ignore */ }
    }
    const savedTheme = localStorage.getItem(THEME_KEY) || 'light'
    setIsDarkMode(savedTheme === 'dark')
  }, [])

  const loadWallpaperDir = async () => {
    try {
      const result = await window.electronAPI.getWallpaperDir()
      setWallpaperDir(result)
    } catch { /* ignore */ }
  }

  const handleSelectDir = async () => {
    setDirLoading(true)
    try {
      const selectedDir = await window.electronAPI.selectDirectory(wallpaperDir.currentDir)

      if (!selectedDir) {
        setDirLoading(false)
        return
      }

      const setResult = await window.electronAPI.setWallpaperDir(selectedDir)
      if (!setResult.success) {
        toast.error(setResult.message)
        setDirLoading(false)
        return
      }

      await loadWallpaperDir()

      const scanResult = await window.electronAPI.scanDirectory(selectedDir)
      toast.success(setResult.message)
      if (scanResult.addedCount > 0) {
        toast.success(scanResult.message)
      }
    } catch (e: any) {
      toast.error('选择目录失败: ' + e.message)
    } finally {
      setDirLoading(false)
    }
  }

  const loadAutoLaunch = async () => {
    try {
      const enabled = await window.electronAPI.getAutoLaunch()
      setAutoLaunch(enabled)
    } catch { /* ignore */ }
  }

  const handleAutoLaunchChange = async (enabled: boolean) => {
    setAutoLaunchLoading(true)
    try {
      const result = await window.electronAPI.setAutoLaunch(enabled)
      if (result.success) {
        setAutoLaunch(enabled)
        toast.success(enabled ? '已开启开机自启' : '已关闭开机自启')
      } else {
        toast.error(result.message)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setAutoLaunchLoading(false)
    }
  }

  const handleThemeChange = (enabled: boolean) => {
    setIsDarkMode(enabled)
    if (enabled) {
      document.body.classList.add('dark')
      localStorage.setItem(THEME_KEY, 'dark')
      toast.success('已切换到深色模式')
    } else {
      document.body.classList.remove('dark')
      localStorage.setItem(THEME_KEY, 'light')
      toast.success('已切换到浅色模式')
    }
  }

  const loadDependencies = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.checkDependencies()
      setDeps(result)
      localStorage.setItem(DEPS_KEY, JSON.stringify({ deps: result, checkedAt: Date.now() }))
      setLastChecked(new Date().toLocaleString('zh-CN'))
      toast.success('依赖检查完成')
    } catch (e: any) {
      toast.error('依赖检查失败: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const doAction = async (
    action: 'install' | 'uninstall' | 'repair',
    dep: string
  ) => {
    setActionDep(dep)
    try {
      const result = action === 'install'
        ? await window.electronAPI.installDependency(dep)
        : action === 'uninstall'
        ? await window.electronAPI.uninstallDependency(dep)
        : await window.electronAPI.repairDependency(dep)
      toast[result.success ? 'success' : 'error'](result.message)
      if (result.success) await loadDependencies()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setActionDep(null)
    }
  }

  const handleInstallAll = async () => {
    const missing = deps.filter(d => !d.installed)
    if (missing.length === 0) {
      toast.success('所有依赖已安装')
      return
    }
    toast.info(`正在安装 ${missing.length} 个缺失依赖...`)
    for (const d of missing) {
      await doAction('install', d.name)
    }
  }

  return (
    <div className="settings-page">
      {/* ========== 通用设置模块 ========== */}
      <div className="settings-section">
        <div className="section-header-bar">
          <h3>通用</h3>
        </div>
        <div className="section-body">
          {/* 壁纸目录 */}
          <div className="setting-item">
            <div className="setting-info">
              <div className="setting-label">壁纸存储目录</div>
              <div className="setting-desc">壁纸文件的存储位置，修改后将自动扫描新目录</div>
              <div className="dir-path-row">
                <div className="dir-path-box">
                  <span className="dir-path-text">{wallpaperDir.currentDir || '加载中...'}</span>
                </div>
                <button className="btn btn-primary dir-btn" onClick={handleSelectDir} disabled={dirLoading}>
                  {dirLoading ? '处理中...' : '修改目录'}
                </button>
              </div>
            </div>
          </div>

          {/* 开机自启 */}
          <div className="setting-item">
            <div className="setting-info">
              <div className="setting-label">开机自启</div>
              <div className="setting-desc">系统启动时自动运行 DynWallpaper</div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={autoLaunch}
                onChange={e => handleAutoLaunchChange(e.target.checked)}
                disabled={autoLaunchLoading}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* 深色模式 */}
          <div className="setting-item">
            <div className="setting-info">
              <div className="setting-label">深色模式</div>
              <div className="setting-desc">切换界面显示主题</div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={isDarkMode}
                onChange={e => handleThemeChange(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </div>

      {/* ========== 依赖管理模块 ========== */}
      <div className="settings-section">
        <div className="section-header-bar">
          <div className="section-title-group">
            <h3>依赖管理</h3>
            {lastChecked && <span className="last-checked">上次检查: {lastChecked}</span>}
          </div>
          <div className="section-actions">
            <button className="btn btn-neutral" onClick={loadDependencies} disabled={loading}>
              {loading ? '检查中...' : '重新检查'}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleInstallAll}
              disabled={loading || (deps.length > 0 && deps.every(d => d.installed))}
            >
              一键安装
            </button>
          </div>
        </div>
        <div className="section-body">
          <div className="deps-list">
            {deps.length === 0 && (
              <div className="deps-empty-hint">点击「重新检查」扫描依赖安装情况</div>
            )}
            {deps.map(dep => (
              <div key={dep.name} className={`dep-item ${dep.installed ? 'installed' : 'missing'}`}>
                <div className="dep-status">
                  <span className="status-icon">{dep.installed ? '✅' : '❌'}</span>
                  <div className="dep-info">
                    <h4>
                      {dep.displayName}
                      {dep.required && <span className="required-badge">必需</span>}
                    </h4>
                    <div className="dep-desc">{dep.description}</div>
                    {dep.installed && dep.version && (
                      <div className="dep-version">v{dep.version}</div>
                    )}
                    <div className="dep-path-row">
                      {dep.installed && dep.path && (
                        <div className="dep-path-box" title={dep.path}>{dep.path}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="dep-btn-group">
                  {!dep.installed ? (
                    <button
                      className="btn btn-install"
                      onClick={() => doAction('install', dep.name)}
                      disabled={actionDep === dep.name}
                    >
                      {actionDep === dep.name ? '安装中...' : '安装'}
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn btn-repair"
                        onClick={() => doAction('repair', dep.name)}
                        disabled={actionDep === dep.name}
                      >
                        {actionDep === dep.name ? '修复中...' : '修复'}
                      </button>
                      <button
                        className="btn btn-uninstall"
                        onClick={() => doAction('uninstall', dep.name)}
                        disabled={actionDep === dep.name}
                      >
                        卸载
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========== 关于模块 ========== */}
      <div className="settings-section">
        <div className="section-header-bar">
          <h3>关于</h3>
        </div>
        <div className="section-body about-body">
          <div className="about-row">
            <div className="about-label">软件名称</div>
            <div className="about-value">DynWallpaper</div>
          </div>
          <div className="about-row">
            <div className="about-label">版本</div>
            <div className="about-value">v{import.meta.env.PACKAGE_VERSION}</div>
          </div>
          <div className="about-row">
            <div className="about-label">作者</div>
            <div className="about-value">Joshua</div>
          </div>
          <div className="about-row">
            <div className="about-label">介绍</div>
            <div className="about-value about-desc">简洁高效的 Windows 动态壁纸管理工具，支持视频与静态图片作为桌面壁纸。</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
