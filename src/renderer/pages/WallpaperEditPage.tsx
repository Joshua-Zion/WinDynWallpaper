import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from '../components/Toast'

// 预设比例
const PRESET_RATIOS = [
  { label: '自由', value: 'free', width: 0, height: 0 },
  { label: '1:1', value: '1:1', width: 1, height: 1 },
  { label: '16:9', value: '16:9', width: 16, height: 9 },
  { label: '9:16', value: '9:16', width: 9, height: 16 },
  { label: '4:3', value: '4:3', width: 4, height: 3 },
  { label: '3:4', value: '3:4', width: 3, height: 4 },
  { label: '21:9', value: '21:9', width: 21, height: 9 },
  { label: '9:21', value: '9:21', width: 9, height: 21 },
]

interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

interface DisplayInfo {
  id: string
  name: string
  width: number
  height: number
  scaleFactor: number
}

const WallpaperEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [wallpaperName, setWallpaperName] = useState('')
  const [imageLoaded, setImageLoaded] = useState(false)
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [selectedRatio, setSelectedRatio] = useState('free')
  const [customRatio, setCustomRatio] = useState({ width: 16, height: 9 })
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 0, height: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragMode, setDragMode] = useState<'none' | 'move' | 'resize' | 'create'>('none')
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragStartCrop, setDragStartCrop] = useState<CropArea>({ x: 0, y: 0, width: 0, height: 0 })
  const [resizeHandle, setResizeHandle] = useState<number>(-1)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [isHoveringCanvas, setIsHoveringCanvas] = useState(false)

  // 加载壁纸和显示器信息
  useEffect(() => {
    loadWallpaper()
    loadDisplays()
  }, [id])

  const loadWallpaper = async () => {
    if (!id) return
    try {
      const result = await window.electronAPI.getWallpaperById(id)
      if (result && result.type === 'static') {
        setWallpaperName(result.name)
        loadImage(result.localPath)
      } else {
        toast.error('只能编辑静态图片')
        navigate(`/wallpaper/${id}`)
      }
    } catch (error: any) {
      toast.error('加载壁纸失败：' + error.message)
      navigate('/library')
    }
  }

  const loadDisplays = async () => {
    try {
      const displayList = await window.electronAPI.getDisplays()
      setDisplays(displayList)
    } catch (err) {
      console.error('获取显示器信息失败:', err)
    }
  }

  const loadImage = (path: string) => {
    const img = new Image()
    img.onload = () => {
      imageRef.current = img
      setImageSize({ width: img.width, height: img.height })
      setImageLoaded(true)
      setIsLoading(false)
      // 初始化裁剪区域为全图
      initCanvas(img)
    }
    img.onerror = () => {
      toast.error('加载图片失败')
      setIsLoading(false)
    }
    img.src = `file://${path}`
  }

  const initCanvas = (img: HTMLImageElement) => {
    const container = containerRef.current
    if (!container) return

    // 如果容器还没准备好，延迟重试
    if (container.clientWidth === 0 || container.clientHeight === 0) {
      setTimeout(() => initCanvas(img), 100)
      return
    }

    const containerWidth = container.clientWidth - 32 // 减去padding
    const containerHeight = container.clientHeight - 32

    // 计算适应容器的尺寸，保持比例
    const scale = Math.min(
      containerWidth / img.width,
      containerHeight / img.height,
      1 // 不放大超过原始尺寸
    )

    const canvasWidth = Math.floor(img.width * scale)
    const canvasHeight = Math.floor(img.height * scale)

    setCanvasSize({ width: canvasWidth, height: canvasHeight })
    setCropArea({
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight
    })
  }

  // 监听容器尺寸变化
  useEffect(() => {
    if (!imageLoaded || !imageRef.current) return
    
    const resizeObserver = new ResizeObserver(() => {
      initCanvas(imageRef.current!)
    })
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }
    
    return () => resizeObserver.disconnect()
  }, [imageLoaded])

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 绘制图片
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    // 绘制遮罩层（暗化未选中区域）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 清除选中区域（显示原图）
    ctx.clearRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height)
    ctx.drawImage(
      img,
      (cropArea.x / canvas.width) * img.width,
      (cropArea.y / canvas.height) * img.height,
      (cropArea.width / canvas.width) * img.width,
      (cropArea.height / canvas.height) * img.height,
      cropArea.x,
      cropArea.y,
      cropArea.width,
      cropArea.height
    )

    // 绘制选中框边框
    ctx.strokeStyle = '#5b7fff'
    ctx.lineWidth = 2
    ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height)

    // 绘制四角手柄
    const handleSize = 8
    ctx.fillStyle = '#5b7fff'
    const handles = [
      { x: cropArea.x - handleSize/2, y: cropArea.y - handleSize/2 },
      { x: cropArea.x + cropArea.width - handleSize/2, y: cropArea.y - handleSize/2 },
      { x: cropArea.x - handleSize/2, y: cropArea.y + cropArea.height - handleSize/2 },
      { x: cropArea.x + cropArea.width - handleSize/2, y: cropArea.y + cropArea.height - handleSize/2 },
    ]
    handles.forEach(h => {
      ctx.fillRect(h.x, h.y, handleSize, handleSize)
    })
  }, [cropArea])

  useEffect(() => {
    if (imageLoaded) {
      drawCanvas()
    }
  }, [drawCanvas, imageLoaded])

  // 判断鼠标位置（用于确定操作类型）
  const getMousePosition = (x: number, y: number): { mode: 'move' | 'resize' | 'create'; handle?: number } => {
    // 如果选区无效，只能创建
    if (cropArea.width <= 0 || cropArea.height <= 0) {
      return { mode: 'create' }
    }

    const handleSize = 12
    const handles = [
      { x: cropArea.x, y: cropArea.y }, // 左上
      { x: cropArea.x + cropArea.width, y: cropArea.y }, // 右上
      { x: cropArea.x, y: cropArea.y + cropArea.height }, // 左下
      { x: cropArea.x + cropArea.width, y: cropArea.y + cropArea.height }, // 右下
    ]

    // 检查是否在角落手柄上
    for (let i = 0; i < handles.length; i++) {
      const h = handles[i]
      if (Math.abs(x - h.x) <= handleSize && Math.abs(y - h.y) <= handleSize) {
        return { mode: 'resize', handle: i }
      }
    }

    // 检查是否在选区内（留一点边距，避免和手柄冲突）
    if (x > cropArea.x + handleSize/2 &&
        x < cropArea.x + cropArea.width - handleSize/2 &&
        y > cropArea.y + handleSize/2 &&
        y < cropArea.y + cropArea.height - handleSize/2) {
      return { mode: 'move' }
    }

    // 在选区外，创建新选区
    return { mode: 'create' }
  }

  // 将鼠标坐标转换为 canvas 逻辑坐标
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }

  // 处理鼠标事件
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { x, y } = getCanvasCoordinates(e)

    const pos = getMousePosition(x, y)
    setDragMode(pos.mode)
    setDragStart({ x, y })
    setDragStartCrop({ ...cropArea })
    if (pos.handle !== undefined && pos.handle >= 0) setResizeHandle(pos.handle)
    setIsDragging(true)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return

    const canvas = canvasRef.current
    if (!canvas) return

    const { x, y } = getCanvasCoordinates(e)
    const deltaX = x - dragStart.x
    const deltaY = y - dragStart.y

    if (dragMode === 'move') {
      // 移动选区
      let newX = Math.max(0, Math.min(dragStartCrop.x + deltaX, canvas.width - cropArea.width))
      let newY = Math.max(0, Math.min(dragStartCrop.y + deltaY, canvas.height - cropArea.height))
      setCropArea(prev => ({ ...prev, x: newX, y: newY }))
    } else if (dragMode === 'resize') {
      // 调整大小
      let newCrop = { ...dragStartCrop }

      if (resizeHandle === 0) { // 左上
        newCrop.x = Math.min(dragStartCrop.x + deltaX, dragStartCrop.x + dragStartCrop.width - 10)
        newCrop.y = Math.min(dragStartCrop.y + deltaY, dragStartCrop.y + dragStartCrop.height - 10)
        newCrop.width = dragStartCrop.x + dragStartCrop.width - newCrop.x
        newCrop.height = dragStartCrop.y + dragStartCrop.height - newCrop.y
      } else if (resizeHandle === 1) { // 右上
        newCrop.y = Math.min(dragStartCrop.y + deltaY, dragStartCrop.y + dragStartCrop.height - 10)
        newCrop.width = Math.max(10, dragStartCrop.width + deltaX)
        newCrop.height = dragStartCrop.y + dragStartCrop.height - newCrop.y
        newCrop.x = dragStartCrop.x
      } else if (resizeHandle === 2) { // 左下
        newCrop.x = Math.min(dragStartCrop.x + deltaX, dragStartCrop.x + dragStartCrop.width - 10)
        newCrop.width = dragStartCrop.x + dragStartCrop.width - newCrop.x
        newCrop.height = Math.max(10, dragStartCrop.height + deltaY)
        newCrop.y = dragStartCrop.y
      } else if (resizeHandle === 3) { // 右下
        newCrop.width = Math.max(10, dragStartCrop.width + deltaX)
        newCrop.height = Math.max(10, dragStartCrop.height + deltaY)
      }

      // 应用比例约束
      if (selectedRatio !== 'free') {
        const ratio = getCurrentRatio()
        if (ratio.width > 0 && ratio.height > 0) {
          const targetRatio = ratio.width / ratio.height
          const currentRatio = newCrop.width / newCrop.height

          if (currentRatio > targetRatio) {
            newCrop.width = newCrop.height * targetRatio
          } else {
            newCrop.height = newCrop.width / targetRatio
          }
        }
      }

      // 限制在画布内
      newCrop.x = Math.max(0, Math.min(newCrop.x, canvas.width - 10))
      newCrop.y = Math.max(0, Math.min(newCrop.y, canvas.height - 10))
      newCrop.width = Math.min(newCrop.width, canvas.width - newCrop.x)
      newCrop.height = Math.min(newCrop.height, canvas.height - newCrop.y)

      setCropArea(newCrop)
    } else if (dragMode === 'create') {
      // 创建新选区
      let newX = Math.min(dragStart.x, x)
      let newY = Math.min(dragStart.y, y)
      let newWidth = Math.abs(x - dragStart.x)
      let newHeight = Math.abs(y - dragStart.y)

      // 应用比例约束
      if (selectedRatio !== 'free') {
        const ratio = getCurrentRatio()
        if (ratio.width > 0 && ratio.height > 0) {
          const targetRatio = ratio.width / ratio.height
          const currentRatio = newWidth / newHeight

          if (currentRatio > targetRatio) {
            newWidth = newHeight * targetRatio
          } else {
            newHeight = newWidth / targetRatio
          }

          if (x < dragStart.x) newX = dragStart.x - newWidth
          if (y < dragStart.y) newY = dragStart.y - newHeight
        }
      }

      // 限制在画布内
      newX = Math.max(0, Math.min(newX, canvas.width - newWidth))
      newY = Math.max(0, Math.min(newY, canvas.height - newHeight))
      newWidth = Math.min(newWidth, canvas.width - newX)
      newHeight = Math.min(newHeight, canvas.height - newY)

      setCropArea({ x: newX, y: newY, width: newWidth, height: newHeight })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setDragMode('none')
    setResizeHandle(-1)
  }

  // 处理鼠标悬停，更新光标
  const handleMouseMoveHover = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return

    const canvas = canvasRef.current
    if (!canvas) return

    const { x, y } = getCanvasCoordinates(e)

    const pos = getMousePosition(x, y)
    const cursors: Record<string, string> = {
      move: 'move',
      resize: 'nwse-resize',
      create: 'crosshair'
    }
    canvas.style.cursor = cursors[pos.mode] || 'default'
  }

  const getCurrentRatio = () => {
    if (selectedRatio === 'custom') {
      return customRatio
    }
    const preset = PRESET_RATIOS.find(r => r.value === selectedRatio)
    return preset || { width: 0, height: 0 }
  }

  // 应用推荐比例
  const applyDisplayRatio = (display: DisplayInfo) => {
    // 简化比例
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
    const divisor = gcd(display.width, display.height)
    const ratioWidth = display.width / divisor
    const ratioHeight = display.height / divisor

    // 找到最接近的预设或设为自定义
    const exactRatio = ratioWidth / ratioHeight
    let closestPreset = PRESET_RATIOS[0]
    let minDiff = Infinity

    for (const preset of PRESET_RATIOS) {
      if (preset.width > 0) {
        const presetRatio = preset.width / preset.height
        const diff = Math.abs(presetRatio - exactRatio)
        if (diff < minDiff) {
          minDiff = diff
          closestPreset = preset
        }
      }
    }

    if (minDiff < 0.01) {
      setSelectedRatio(closestPreset.value)
    } else {
      setSelectedRatio('custom')
      setCustomRatio({ width: Math.round(ratioWidth), height: Math.round(ratioHeight) })
    }

    // 重置裁剪区域
    if (canvasRef.current) {
      const canvas = canvasRef.current
      const ratio = ratioWidth / ratioHeight
      let newWidth = canvas.width
      let newHeight = canvas.width / ratio

      if (newHeight > canvas.height) {
        newHeight = canvas.height
        newWidth = canvas.height * ratio
      }

      setCropArea({
        x: (canvas.width - newWidth) / 2,
        y: (canvas.height - newHeight) / 2,
        width: newWidth,
        height: newHeight
      })
    }
  }

  // 保存裁剪结果
  const handleSave = async () => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img || !id) return

    // 计算原始图片上的裁剪坐标
    const scaleX = img.width / canvas.width
    const scaleY = img.height / canvas.height

    const originalCrop = {
      x: Math.round(cropArea.x * scaleX),
      y: Math.round(cropArea.y * scaleY),
      width: Math.round(cropArea.width * scaleX),
      height: Math.round(cropArea.height * scaleY)
    }

    try {
      setIsLoading(true)
      await window.electronAPI.cropWallpaper(id, originalCrop)
      toast.success('裁剪成功')
      navigate(`/wallpaper/${id}`)
    } catch (error: any) {
      toast.error('裁剪失败：' + error.message)
      setIsLoading(false)
    }
  }

  // 取消
  const handleCancel = () => {
    navigate(`/wallpaper/${id}`)
  }

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="loading-state">加载中...</div>
      </div>
    )
  }

  return (
    <div className="page-container edit-page">
      {/* 顶部工具栏 */}
      <div className="edit-toolbar">
        <button className="toolbar-btn" onClick={handleCancel}>
          <span className="toolbar-icon">←</span>
          <span>返回</span>
        </button>
        <div className="toolbar-spacer" />
        <span className="edit-title">编辑: {wallpaperName}</span>
        <div className="toolbar-spacer" />
        <button className="toolbar-btn btn-primary" onClick={handleSave}>
          <span className="toolbar-icon">✓</span>
          <span>保存</span>
        </button>
      </div>

      {/* 编辑区域 */}
      <div className="edit-container">
        {/* 左侧比例选择 */}
        <div className="edit-sidebar">
        <div className="sidebar-section">
          <h3>裁剪比例</h3>
          <div className="ratio-list">
            {PRESET_RATIOS.map(ratio => (
              <button
                key={ratio.value}
                className={`ratio-btn ${selectedRatio === ratio.value ? 'active' : ''}`}
                onClick={() => {
                  setSelectedRatio(ratio.value)
                  // 清空选区，让用户自己框选
                  setCropArea({ x: 0, y: 0, width: 0, height: 0 })
                }}
              >
                {ratio.label}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-section">
          <h3>自定义比例</h3>
          <div className="custom-ratio-inputs">
            <input
              type="number"
              value={customRatio.width}
              onChange={(e) => {
                const width = parseInt(e.target.value) || 1
                setCustomRatio({ ...customRatio, width })
                setSelectedRatio('custom')
                // 清空选区，让用户自己框选
                setCropArea({ x: 0, y: 0, width: 0, height: 0 })
              }}
              min={1}
            />
            <span>:</span>
            <input
              type="number"
              value={customRatio.height}
              onChange={(e) => {
                const height = parseInt(e.target.value) || 1
                setCustomRatio({ ...customRatio, height })
                setSelectedRatio('custom')
                // 清空选区，让用户自己框选
                setCropArea({ x: 0, y: 0, width: 0, height: 0 })
              }}
              min={1}
            />
          </div>
        </div>

        {displays.length > 0 && (
          <div className="sidebar-section">
            <h3>显示器推荐</h3>
            <div className="display-list">
              {displays.map((display, index) => (
                <button
                  key={display.id}
                  className="display-btn"
                  onClick={() => applyDisplayRatio(display)}
                >
                  <span className="display-name">显示器 {index + 1}</span>
                  <span className="display-resolution">{display.width} × {display.height}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="sidebar-section crop-info">
          <h3>裁剪信息</h3>
          <div className="info-row">
            <span>选中尺寸:</span>
            <span>{Math.round(cropArea.width * (imageSize.width / canvasSize.width))} × {Math.round(cropArea.height * (imageSize.height / canvasSize.height))}</span>
          </div>
          <div className="info-row">
            <span>原始尺寸:</span>
            <span>{imageSize.width} × {imageSize.height}</span>
          </div>
        </div>
        </div>

      {/* 右侧画布区域 */}
      <div className="edit-canvas-container" ref={containerRef}>
        {canvasSize.width > 0 && (
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            onMouseDown={handleMouseDown}
            onMouseMove={(e) => {
              handleMouseMove(e)
              handleMouseMoveHover(e)
            }}
            onMouseUp={handleMouseUp}
            onMouseLeave={(e) => {
              handleMouseUp(e)
              setIsHoveringCanvas(false)
            }}
            onMouseEnter={() => setIsHoveringCanvas(true)}
            className="edit-canvas"
          />
        )}
        {!isHoveringCanvas && (
          <div className="canvas-hint">
            在图片上拖拽选择裁剪区域
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

export default WallpaperEditPage
