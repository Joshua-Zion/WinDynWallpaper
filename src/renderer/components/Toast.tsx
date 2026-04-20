import React, { useState, useCallback, useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
}

let showToastFn: ((type: ToastType, message: string) => void) | null = null

export const toast = {
  success: (msg: string) => showToastFn?.('success', msg),
  error: (msg: string) => showToastFn?.('error', msg),
  warning: (msg: string) => showToastFn?.('warning', msg),
  info: (msg: string) => showToastFn?.('info', msg),
}

const ICONS: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
}

const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    showToastFn = (type, message) => {
      const id = `toast-${Date.now()}-${Math.random()}`
      setToasts(prev => [...prev, { id, type, message }])
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 3500)
    }
    return () => { showToastFn = null }
  }, [])

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span className="toast-icon">{ICONS[t.type]}</span>
          <span className="toast-msg">{t.message}</span>
          <button className="toast-close" onClick={() => remove(t.id)}>×</button>
        </div>
      ))}
    </div>
  )
}

export default ToastContainer
