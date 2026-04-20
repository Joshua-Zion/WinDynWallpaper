import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

interface WallpaperItem {
  id: string
  name: string
  type: 'static' | 'dynamic'
  localPath: string
  thumbnailPath: string
  addedAt: number
  fileSize: number
  width?: number
  height?: number
  resolutionTier?: '<1K' | '1K' | '2K' | '4K' | '8K' | '>8K'
  aspectRatio?: string
}

type TabType = 'all' | 'static' | 'dynamic'

const ITEMS_PER_PAGE = 8

const LibraryPage: React.FC = () => {
  const navigate = useNavigate()
  const [wallpapers, setWallpapers] = useState<WallpaperItem[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [currentWallpaperId, setCurrentWallpaperId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSelectAll, setIsSelectAll] = useState(false)
  const [selectScope, setSelectScope] = useState<'page' | 'all'>('page')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'addedAt' | 'fileSize' | 'resolution'>('addedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filterResolution, setFilterResolution] = useState<'all' | '<1K' | '1K' | '2K' | '4K' | '8K' | '>8K'>('all')
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  })
  const cachedImages = useRef<Record<string, string>>({})

  const loadWallpapers = async () => {
    try {
      const items = await window.electronAPI.getWallpapers()
      setWallpapers(Array.isArray(items) ? items : [])
    } catch {
      setWallpapers([])
    }
  }

  const loadCurrentWallpaper = async () => {
    try {
      const current = await window.electronAPI.getCurrentWallpaper()
      setCurrentWallpaperId(current?.id || null)
    } catch {
      setCurrentWallpaperId(null)
    }
  }

  useEffect(() => {
    loadWallpapers()
    loadCurrentWallpaper()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchKeyword, sortBy, sortOrder, filterResolution])

  const filteredWallpapers = wallpapers
    .filter(item => {
      if (activeTab === 'all') return true
      return item.type === activeTab
    })
    .filter(item => {
      if (!searchKeyword) return true
      return item.name.toLowerCase().includes(searchKeyword.toLowerCase())
    })
    .filter(item => {
      if (filterResolution === 'all') return true
      return item.resolutionTier === filterResolution
    })
    .sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'addedAt':
          comparison = a.addedAt - b.addedAt
          break
        case 'fileSize':
          comparison = a.fileSize - b.fileSize
          break
        case 'resolution':
          comparison = (a.width || 0) - (b.width || 0)
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

  const totalPages = Math.ceil(filteredWallpapers.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const currentWallpapers = filteredWallpapers.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const staticCount = wallpapers.filter(i => i.type === 'static').length
  const dynamicCount = wallpapers.filter(i => i.type === 'dynamic').length

  const handleApply = async (item: WallpaperItem) => {
    setIsLoading(true)
    try {
      const res = item.type === 'static'
        ? await window.electronAPI.setStaticWallpaper(item.localPath)
        : await window.electronAPI.setDynamicWallpaper(item.localPath)
      toast[res.success ? 'success' : 'error'](res.message)
      if (res.success) {
        setCurrentWallpaperId(item.id)
        await window.electronAPI.setCurrentWallpaperId(item.id)
      }
    } catch (err: any) {
      toast.error(`应用失败: ${err.message}`)
    }
    setIsLoading(false)
  }

  const handleRemove = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '确认删除',
      message: '确定要删除这个壁纸吗？',
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} })
        setIsLoading(true)
        const res = await window.electronAPI.removeWallpaper(id)
        toast[res.success ? 'success' : 'error'](res.message)
        if (res.success) {
          await loadWallpapers()
          const newCount = filteredWallpapers.length - 1
          const newTotal = Math.ceil(newCount / ITEMS_PER_PAGE)
          if (currentPage > newTotal && newTotal > 0) setCurrentPage(newTotal)
        }
        setIsLoading(false)
      }
    })
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      toast.warning('请先选择要删除的壁纸')
      return
    }
    setConfirmDialog({
      isOpen: true,
      title: '确认删除',
      message: `确定要删除选中的 ${selectedIds.size} 个壁纸吗？`,
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} })
        setIsLoading(true)
        let successCount = 0
        for (const id of selectedIds) {
          const res = await window.electronAPI.removeWallpaper(id)
          if (res.success) successCount++
        }
        toast.success(`已删除 ${successCount} 个壁纸`)
        setSelectedIds(new Set())
        setIsSelectAll(false)
        await loadWallpapers()
        setIsLoading(false)
      }
    })
  }

  const handleSelectAll = (scope: 'page' | 'all') => {
    const targetIds = scope === 'page' ? currentWallpapers.map(w => w.id) : filteredWallpapers.map(w => w.id)
    setSelectedIds(new Set(targetIds))
    setIsSelectAll(true)
  }

  const handleInvertSelect = (scope: 'page' | 'all') => {
    const targetIds = scope === 'page' ? currentWallpapers.map(w => w.id) : filteredWallpapers.map(w => w.id)
    const newSelected = new Set<string>()
    targetIds.forEach(id => {
      if (!selectedIds.has(id)) {
        newSelected.add(id)
      }
    })
    setSelectedIds(newSelected)
    setIsSelectAll(newSelected.size === targetIds.length)
  }

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('zh-CN')
  const formatSize = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`

  return (
    <div className="library-page">
      <div className="library-page-header">
        <div className="page-header">
          <h1>壁纸库</h1>
          <p className="subtitle">共 {wallpapers.length} 个壁纸</p>
        </div>

        <div className="tab-bar">
          <button className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
            全部 ({wallpapers.length})
          </button>
          <button className={`tab ${activeTab === 'static' ? 'active' : ''}`} onClick={() => setActiveTab('static')}>
            静态 ({staticCount})
          </button>
          <button className={`tab ${activeTab === 'dynamic' ? 'active' : ''}`} onClick={() => setActiveTab('dynamic')}>
            动态 ({dynamicCount})
          </button>
        </div>

        <div className="toolbar">
          <div className="toolbar-left">
            <input
              type="text"
              className="search-input"
              placeholder="搜索壁纸..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
            <select
              className="filter-select"
              value={filterResolution}
              onChange={(e) => setFilterResolution(e.target.value as any)}
            >
              <option value="all">全部</option>
              <option value="<1K">&lt;1K</option>
              <option value="1K">1K</option>
              <option value="2K">2K</option>
              <option value="4K">4K</option>
              <option value="8K">8K</option>
              <option value=">8K">&gt;8K</option>
            </select>
            <select
              className="sort-select"
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('-')
                setSortBy(by as any)
                setSortOrder(order as any)
              }}
            >
              <option value="addedAt-desc">最新添加</option>
              <option value="addedAt-asc">最早添加</option>
              <option value="name-asc">名称 A-Z</option>
              <option value="name-desc">名称 Z-A</option>
              <option value="fileSize-desc">文件大小（大→小）</option>
              <option value="fileSize-asc">文件大小（小→大）</option>
              <option value="resolution-desc">分辨率（高→低）</option>
              <option value="resolution-asc">分辨率（低→高）</option>
            </select>
          </div>
          <div className="toolbar-right">
            {selectedIds.size > 0 && <span className="batch-info">已选 {selectedIds.size} 个</span>}
            <select
              className="select-dropdown"
              value=""
              onChange={(e) => {
                const action = e.target.value
                if (action === 'select-page') {
                  setSelectScope('page')
                  handleSelectAll('page')
                } else if (action === 'select-all') {
                  setSelectScope('all')
                  handleSelectAll('all')
                } else if (action === 'clear') {
                  setSelectedIds(new Set())
                  setIsSelectAll(false)
                } else if (action === 'invert') {
                  handleInvertSelect(selectScope)
                }
                // 重置下拉框
                e.target.value = ''
              }}
            >
              <option value="" disabled>选择壁纸</option>
              <option value="select-page">选择当页</option>
              <option value="select-all">选择全部</option>
              {selectedIds.size > 0 && <option value="clear">取消选择</option>}
              {selectedIds.size > 0 && <option value="invert">反选</option>}
            </select>
            <button className="btn btn-danger" onClick={handleBatchDelete} disabled={isLoading || selectedIds.size === 0}>
              删除
            </button>
          </div>
        </div>
      </div>

      <div className="library-page-content">
        {filteredWallpapers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📁</div>
            <h3>{activeTab === 'all' ? '壁纸库为空' : `暂无${activeTab === 'static' ? '静态' : '动态'}壁纸`}</h3>
            <p>在首页导入壁纸后会显示在这里</p>
          </div>
        ) : (
          <>
            <div className="wallpaper-grid">
              {currentWallpapers.map(item => (
                <div
                  key={item.id}
                  className={`wallpaper-card ${selectedIds.has(item.id) ? 'selected' : ''}`}
                  onMouseEnter={() => setHoveredCardId(item.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                >
                  {/* 复选框 */}
                  <div
                    className={`card-checkbox ${selectedIds.has(item.id) ? 'checked' : ''}`}
                    onClick={(e) => { e.stopPropagation(); handleSelectOne(item.id) }}
                  />

                  {/* 图片区域 4:3 */}
                  <div className="card-image" onClick={() => navigate(`/library/${item.id}`)}>
                    {currentWallpaperId === item.id && (
                      <span className="current-badge">当前使用</span>
                    )}
                    {item.thumbnailPath ? (
                      <img
                        src={cachedImages.current[item.id] || (cachedImages.current[item.id] = `file://${item.thumbnailPath.replace(/\\/g, '/')}`)}
                        alt={item.name}
                        loading="lazy"
                      />
                    ) : (
                      <div className="no-preview">{item.type === 'static' ? '🖼️' : '🎬'}</div>
                    )}
                  </div>

                  {/* 卡片信息 */}
                  <div className="card-body">
                    <h3 className="card-name" title={item.name}>{item.name}</h3>
                    <div className="card-tags">
                      <span className={`tag tag-type ${item.type}`}>
                        {item.type === 'static' ? '静态' : '动态'}
                      </span>
                      {item.resolutionTier && <span className="tag tag-resolution">{item.resolutionTier}</span>}
                      {item.aspectRatio && <span className="tag tag-ratio">{item.aspectRatio}</span>}
                      <span className="tag tag-size">{formatSize(item.fileSize)}</span>
                    </div>
                    <div className="card-buttons">
                      <button
                        className="btn btn-sm btn-apply"
                        onClick={() => handleApply(item)}
                        disabled={isLoading || currentWallpaperId === item.id}
                      >
                        {currentWallpaperId === item.id ? '使用中' : '应用'}
                      </button>
                      <button
                        className="btn btn-sm btn-del"
                        onClick={() => handleRemove(item.id)}
                        disabled={isLoading || currentWallpaperId === item.id}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                  上一页
                </button>
                <div className="page-numbers">
                  {(() => {
                    const pages: (number | string)[] = []
                    const maxVisible = 5
                    const halfVisible = Math.floor(maxVisible / 2)

                    if (totalPages <= maxVisible) {
                      for (let i = 1; i <= totalPages; i++) {
                        pages.push(i)
                      }
                    } else {
                      if (currentPage <= halfVisible + 1) {
                        for (let i = 1; i <= halfVisible + 2; i++) {
                          pages.push(i)
                        }
                        pages.push('...')
                        pages.push(totalPages)
                      } else if (currentPage >= totalPages - halfVisible) {
                        pages.push(1)
                        pages.push('...')
                        for (let i = totalPages - halfVisible - 1; i <= totalPages; i++) {
                          pages.push(i)
                        }
                      } else {
                        pages.push(1)
                        pages.push('...')
                        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                          pages.push(i)
                        }
                        pages.push('...')
                        pages.push(totalPages)
                      }
                    }

                    return pages.map((page, index) => (
                      page === '...' ? (
                        <span key={`ellipsis-${index}`} className="page-ellipsis">...</span>
                      ) : (
                        <button
                          key={page}
                          className={`page-num ${currentPage === page ? 'active' : ''}`}
                          onClick={() => setCurrentPage(page as number)}
                        >
                          {page}
                        </button>
                      )
                    ))
                  })()}
                </div>
                <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                  下一页
                </button>
                <span className="page-info">第 {currentPage}/{totalPages} 页，共 {filteredWallpapers.length} 个</span>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} })}
      />
    </div>
  )
}

export default LibraryPage
