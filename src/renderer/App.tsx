import React, { useEffect } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LibraryPage from './pages/LibraryPage'
import WallpaperDetailPage from './pages/WallpaperDetailPage'
import SettingsPage from './pages/SettingsPage'
import ToastContainer from './components/Toast'
import './styles/index.css'

const App: React.FC = () => {
  // 主题初始化
  useEffect(() => {
    const savedTheme = localStorage.getItem('windyn_theme') || 'light'
    if (savedTheme === 'dark') {
      document.body.classList.add('dark')
    } else {
      document.body.classList.remove('dark')
    }
  }, [])

  return (
    <div className="app-container">
      <div className="app-body">
        {/* 侧边栏 */}
        <aside className="sidebar">
          <ul className="nav-menu">
            <li>
              <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>
                <span className="nav-icon">🏠</span>
                <span>首页</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/library" className={({ isActive }) => isActive ? 'active' : ''}>
                <span className="nav-icon">🖼️</span>
                <span>壁纸库</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/settings" className={({ isActive }) => isActive ? 'active' : ''}>
                <span className="nav-icon">⚙️</span>
                <span>设置</span>
              </NavLink>
            </li>
          </ul>
        </aside>

        {/* 主内容 */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/library/:id" element={<WallpaperDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}

export default App
