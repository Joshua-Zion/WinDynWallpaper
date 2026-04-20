import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

interface WallpaperDetail {
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

const WallpaperDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [wallpaper, setWallpaper] = useState<WallpaperDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState('')
  const [showInfo, setShowInfo] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [fileNameWithoutExt, setFileNameWithoutExt] = useState('')
  const [fileExt, setFileExt] = useState('')
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

  useEffect(() => {
    loadWallpaperDetail()
  }, [id])

  const loadWallpaperDetail = async () => {
    if (!id) return

    setIsLoading(true)
    try {
      const result = await window.electronAPI.getWallpaperById(id)
      if (result) {
        setWallpaper(result)
        setNewName(result.name)
        // 解析文件名和后缀
        const lastDotIndex = result.name.lastIndexOf('.')
        if (lastDotIndex > 0) {
          setFileNameWithoutExt(result.name.substring(0, lastDotIndex))
          setFileExt(result.name.substring(lastDotIndex))
        } else {
          setFileNameWithoutExt(result.name)
          setFileExt('')
        }
      } else {
        toast.error('壁纸不存在')
        navigate('/library')
      }
    } catch (error: any) {
      toast.error('加载壁纸详情失败：' + error.message)
      navigate('/library')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRename = () => {
    if (!wallpaper) return
    setShowRenameDialog(true)
  }

  const handleRenameConfirm = async () => {
    if (!wallpaper || !fileNameWithoutExt.trim()) {
      toast.error('请输入新名称')
      return
    }

    const fullNewName = fileNameWithoutExt.trim() + fileExt

    try {
      await window.electronAPI.renameWallpaper(wallpaper.id, fullNewName)
      toast.success('重命名成功')
      setWallpaper({ ...wallpaper, name: fullNewName })
      setNewName(fullNewName)
      setShowRenameDialog(false)
    } catch (error: any) {
      toast.error('重命名失败：' + error.message)
    }
  }

  const handleRenameCancel = () => {
    if (!wallpaper) return
    setNewName(wallpaper.name)
    const lastDotIndex = wallpaper.name.lastIndexOf('.')
    if (lastDotIndex > 0) {
      setFileNameWithoutExt(wallpaper.name.substring(0, lastDotIndex))
      setFileExt(wallpaper.name.substring(lastDotIndex))
    } else {
      setFileNameWithoutExt(wallpaper.name)
      setFileExt('')
    }
    setShowRenameDialog(false)
  }

  const handleDelete = () => {
    if (!wallpaper) return

    setConfirmDialog({
      isOpen: true,
      title: '删除壁纸',
      message: `确定要删除壁纸"${wallpaper.name}"吗？此操作不可恢复。`,
      onConfirm: async () => {
        try {
          await window.electronAPI.deleteWallpapers([wallpaper.id])
          toast.success('删除成功')
          navigate('/library')
        } catch (error: any) {
          toast.error('删除失败：' + error.message)
        }
      }
    })
  }

  const handleEdit = () => {
    // 预留编辑功能入口
    toast.info('编辑功能即将推出')
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
  }

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>壁纸详情</h1>
        </div>
        <div className="loading-state">加载中...</div>
      </div>
    )
  }

  if (!wallpaper) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>壁纸详情</h1>
        </div>
        <div className="empty-state">壁纸不存在</div>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* 顶部操作栏 */}
      <div className="detail-toolbar">
        <button className="toolbar-btn" onClick={() => navigate('/library')}>
          <span className="toolbar-icon">←</span>
          <span>返回</span>
        </button>
        <div className="toolbar-spacer" />
        <button className="toolbar-btn" onClick={() => setShowInfo(!showInfo)}>
          <span className="toolbar-icon">ℹ️</span>
          <span>信息</span>
        </button>
        <button className="toolbar-btn" onClick={handleRename}>
          <span className="toolbar-icon">✏️</span>
          <span>重命名</span>
        </button>
        <button className="toolbar-btn" onClick={handleEdit}>
          <span className="toolbar-icon">🎨</span>
          <span>编辑</span>
        </button>
        <button className="toolbar-btn btn-danger" onClick={handleDelete}>
          <span className="toolbar-icon">🗑️</span>
          <span>删除</span>
        </button>
      </div>

      {/* 预览区域 */}
      <div className="detail-preview">
        {wallpaper.type === 'static' ? (
          <img
            src={`file://${wallpaper.localPath}`}
            alt={wallpaper.name}
            className="detail-thumbnail"
          />
        ) : (
          <video
            src={`file://${wallpaper.localPath}`}
            className="detail-thumbnail"
            autoPlay
            loop
            muted
            playsInline
          />
        )}
      </div>

      {/* 信息面板 */}
      {showInfo && (
        <div className="detail-info-panel">
          <div className="info-panel-header">
            <h2>壁纸信息</h2>
            <button className="btn btn-close" onClick={() => setShowInfo(false)}>×</button>
          </div>
          <div className="info-panel-content">
            <div className="info-item">
              <label>名称</label>
              <div className="info-value">{wallpaper.name}</div>
            </div>
            <div className="info-item">
              <label>类型</label>
              <div className="info-value">
                {wallpaper.type === 'static' ? '静态图片' : '动态视频'}
              </div>
            </div>
            <div className="info-item">
              <label>文件大小</label>
              <div className="info-value">{formatFileSize(wallpaper.fileSize)}</div>
            </div>
            <div className="info-item">
              <label>添加时间</label>
              <div className="info-value">{formatDate(wallpaper.addedAt)}</div>
            </div>
            {wallpaper.width && wallpaper.height && (
              <>
                <div className="info-item">
                  <label>分辨率</label>
                  <div className="info-value">
                    {wallpaper.width} × {wallpaper.height}
                    {wallpaper.resolutionTier && (
                      <span className="tag tag-resolution">{wallpaper.resolutionTier}</span>
                    )}
                  </div>
                </div>
                <div className="info-item">
                  <label>宽高比</label>
                  <div className="info-value">
                    {wallpaper.aspectRatio || '未知'}
                  </div>
                </div>
              </>
            )}
            <div className="info-item">
              <label>文件路径</label>
              <div className="info-value path-value">{wallpaper.localPath}</div>
            </div>
          </div>
        </div>
      )}

      {/* 重命名弹窗 */}
      {showRenameDialog && (
        <div className="dialog-overlay-rename">
          <div className="dialog-content-rename">
            <div className="dialog-header-rename">
              <h3>重命名壁纸</h3>
              <button className="btn btn-close" onClick={handleRenameCancel}>×</button>
            </div>
            <div className="dialog-body-rename">
              <div className="rename-input-wrapper">
                <label>新名称</label>
                <div className="rename-input-container">
                  <input
                    type="text"
                    value={fileNameWithoutExt}
                    onChange={(e) => setFileNameWithoutExt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameConfirm()
                      if (e.key === 'Escape') handleRenameCancel()
                    }}
                    autoFocus
                  />
                  {fileExt && <span className="file-extension">{fileExt}</span>}
                </div>
              </div>
            </div>
            <div className="dialog-footer-rename">
              <button className="btn btn-cancel" onClick={handleRenameCancel}>取消</button>
              <button className="btn btn-confirm" onClick={handleRenameConfirm}>确定</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </div>
  )
}

export default WallpaperDetailPage
