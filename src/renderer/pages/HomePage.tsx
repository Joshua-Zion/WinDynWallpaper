import React, { useState, useRef } from 'react'
import { toast } from '../components/Toast'
import ImportProgress from '../components/ImportProgress'

interface ImportTask {
  id: string
  filePath: string
  type: 'static' | 'dynamic'
  status: 'pending' | 'processing' | 'success' | 'failed'
  fileName: string
}

const HomePage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [importTasks, setImportTasks] = useState<ImportTask[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [currentImportIndex, setCurrentImportIndex] = useState(0)
  const processingRef = useRef(false)

  const getFileType = (filePath: string): 'static' | 'dynamic' => {
    const ext = filePath.split('.').pop()?.toLowerCase() || ''
    const imageExts = ['jpg', 'jpeg', 'png', 'bmp', 'webp', 'gif']
    const videoExts = ['mp4', 'webm', 'mkv', 'avi', 'mov']
    if (imageExts.includes(ext)) return 'static'
    if (videoExts.includes(ext)) return 'dynamic'
    return 'static'
  }

  const getFileName = (filePath: string): string => {
    return filePath.split('\\').pop() || filePath.split('/').pop() || filePath
  }

  const handleImportStatic = async () => {
    const result = await window.electronAPI.openFile([
      { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'webp', 'gif'] }
    ])

    if (!result.canceled && result.filePaths.length > 0) {
      // 创建导入任务
      const tasks: ImportTask[] = result.filePaths.map((filePath, index) => ({
        id: `task-${Date.now()}-${index}`,
        filePath,
        type: 'static',
        status: 'pending',
        fileName: getFileName(filePath)
      }))

      setImportTasks(tasks)
      setIsImporting(true)
      setCurrentImportIndex(0)

      // 异步处理导入任务
      processImportTasks(tasks)
    }
  }

  const handleImportDynamic = async () => {
    const result = await window.electronAPI.openFile([
      { name: '视频文件', extensions: ['mp4', 'webm', 'mkv', 'avi', 'mov'] }
    ])

    if (!result.canceled && result.filePaths.length > 0) {
      // 创建导入任务
      const tasks: ImportTask[] = result.filePaths.map((filePath, index) => ({
        id: `task-${Date.now()}-${index}`,
        filePath,
        type: 'dynamic',
        status: 'pending',
        fileName: getFileName(filePath)
      }))

      setImportTasks(tasks)
      setIsImporting(true)
      setCurrentImportIndex(0)

      // 异步处理导入任务
      processImportTasks(tasks)
    }
  }

  const processImportTasks = async (tasks: ImportTask[]) => {
    if (processingRef.current) return
    processingRef.current = true

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]

      // 更新任务状态为处理中
      setImportTasks(prev =>
        prev.map(t =>
          t.id === task.id ? { ...t, status: 'processing' } : t
        )
      )
      setCurrentImportIndex(i)

      try {
        const res = await window.electronAPI.addWallpaper(task.filePath, task.type)

        // 更新任务状态
        setImportTasks(prev =>
          prev.map(t =>
            t.id === task.id
              ? { ...t, status: res.success ? 'success' : 'failed' }
              : t
          )
        )
      } catch (error) {
        // 更新任务状态为失败
        setImportTasks(prev =>
          prev.map(t =>
            t.id === task.id ? { ...t, status: 'failed' } : t
          )
        )
      }
    }

    processingRef.current = false

    // 所有任务完成后，显示总结
    const successCount = tasks.filter(t => t.status === 'success').length
    const failedCount = tasks.filter(t => t.status === 'failed').length

    if (successCount > 0 && failedCount === 0) {
      toast.success(`成功导入 ${successCount} 个壁纸`)
    } else if (successCount > 0 && failedCount > 0) {
      toast.warning(`成功 ${successCount} 个，失败 ${failedCount} 个`)
    } else {
      toast.error('导入失败，请重试')
    }
  }

  const handleRestoreDefault = async () => {
    setIsLoading(true)
    const res = await window.electronAPI.restoreDefault()
    toast[res.success ? 'success' : 'error'](res.message)
    if (res.success) {
      await window.electronAPI.setCurrentWallpaperId(null)
    }
    setIsLoading(false)
  }

  const handleCloseImportProgress = () => {
    setIsImporting(false)
    setImportTasks([])
    setCurrentImportIndex(0)
  }

  return (
    <div className="home-page">
      <div className="page-header">
        <h1>首页</h1>
        <p className="subtitle">快速导入和管理你的壁纸</p>
      </div>

      <div className="action-grid">
        <button
          className="action-card primary"
          onClick={handleImportStatic}
          disabled={isLoading || isImporting}
        >
          <div className="action-icon">🖼️</div>
          <h3>导入静态壁纸</h3>
          <p className="action-desc">支持 JPG、PNG、WebP 等格式</p>
        </button>

        <button
          className="action-card primary"
          onClick={handleImportDynamic}
          disabled={isLoading || isImporting}
        >
          <div className="action-icon">🎬</div>
          <h3>导入动态壁纸</h3>
          <p className="action-desc">支持 MP4、WebM、MKV 等格式</p>
        </button>

        <button
          className="action-card danger"
          onClick={handleRestoreDefault}
          disabled={isLoading || isImporting}
        >
          <div className="action-icon">↩️</div>
          <h3>恢复默认壁纸</h3>
          <p className="action-desc">恢复 Windows 系统原始壁纸</p>
        </button>
      </div>

      <ImportProgress
        isOpen={isImporting}
        tasks={importTasks}
        currentIndex={currentImportIndex}
        totalCount={importTasks.length}
        onClose={handleCloseImportProgress}
      />
    </div>
  )
}

export default HomePage
