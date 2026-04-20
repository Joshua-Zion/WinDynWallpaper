import React, { useState, useEffect } from 'react'
import { toast } from './Toast'

interface ImportTask {
  id: string
  filePath: string
  type: 'static' | 'dynamic'
  status: 'pending' | 'processing' | 'success' | 'failed'
  fileName: string
}

interface ImportProgressProps {
  isOpen: boolean
  tasks: ImportTask[]
  currentIndex: number
  totalCount: number
  onClose: () => void
}

const ImportProgress: React.FC<ImportProgressProps> = ({
  isOpen,
  tasks,
  currentIndex,
  totalCount,
  onClose
}) => {
  const [isMinimized, setIsMinimized] = useState(false)

  if (!isOpen) return null

  const successCount = tasks.filter(t => t.status === 'success').length
  const failedCount = tasks.filter(t => t.status === 'failed').length
  const progress = totalCount > 0 ? Math.round((successCount + failedCount) / totalCount * 100) : 0
  const isCompleted = successCount + failedCount === totalCount

  return (
    <>
      {/* 最小化状态 */}
      {isMinimized && (
        <div className="import-progress-minimized" onClick={() => setIsMinimized(false)}>
          <div className="progress-icon">{isCompleted ? '✅' : '📥'}</div>
          <div className="progress-info">
            <span className="progress-text">{isCompleted ? '导入完成' : '导入中...'}</span>
            <span className="progress-count">{successCount + failedCount}/{totalCount}</span>
          </div>
          <div className="progress-bar-minimized">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      {/* 完整状态 */}
      {!isMinimized && (
        <div className="import-progress-overlay">
          <div className="import-progress-dialog">
            <div className="import-progress-header">
              <h3>导入壁纸</h3>
              <button className="btn-minimize" onClick={() => setIsMinimized(true)}>−</button>
            </div>

            <div className="import-progress-body">
              <div className="progress-summary">
                <div className="progress-bar-large">
                  <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <div className="progress-stats">
                  <span className="stat-item success">成功: {successCount}</span>
                  <span className="stat-item failed">失败: {failedCount}</span>
                  <span className="stat-item total">总计: {totalCount}</span>
                </div>
              </div>

              <div className="task-list">
                {tasks.map(task => (
                  <div key={task.id} className={`task-item ${task.status}`}>
                    <div className="task-icon">
                      {task.status === 'pending' && '⏳'}
                      {task.status === 'processing' && '⏳'}
                      {task.status === 'success' && '✅'}
                      {task.status === 'failed' && '❌'}
                    </div>
                    <div className="task-info">
                      <div className="task-name">{task.fileName}</div>
                      <div className="task-type">{task.type === 'static' ? '静态' : '动态'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="import-progress-footer">
              <button className="btn-minimize-footer" onClick={() => setIsMinimized(true)}>最小化</button>
              {isCompleted && (
                <button className="btn-close" onClick={onClose}>关闭</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ImportProgress
