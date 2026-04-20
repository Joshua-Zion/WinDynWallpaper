import React from 'react'
import { Outlet, NavLink } from 'react-router-dom'

const Layout: React.FC = () => {
  return (
    <div className="app-container">
      <div className="app-body">
        <nav className="sidebar">
          <ul className="nav-menu">
            <li>
              <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>
                <span className="nav-icon">🏠</span>
                <span>首页</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/library" className={({ isActive }) => isActive ? 'active' : ''}>
                <span className="nav-icon">📁</span>
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
        </nav>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
