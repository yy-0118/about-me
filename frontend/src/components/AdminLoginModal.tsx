import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { ApiError } from '../lib/api'

interface Props {
  open: boolean
  onClose: () => void
}

export const AdminLoginModal: React.FC<Props> = ({ open, onClose }) => {
  const { login } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const close = () => {
    setPassword('')
    setError('')
    setBusy(false)
    onClose()
  }

  const submit = async () => {
    const pwd = password.trim()
    if (!pwd || busy) return
    setBusy(true)
    setError('')
    try {
      await login(pwd)
      // 成功：AuthContext 已更新 token，App 层会监听 isAdmin 并自动跳转
      close()
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        setError('密码错误')
      } else if (err?.message) {
        setError(err.message)
      } else {
        setError('登录失败：' + (err?.toString() || '未知错误'))
      }
      setBusy(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit()
  }

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>管理员登录</h3>
          <button className="modal__close" onClick={close} type="button">×</button>
        </div>
        <form onSubmit={handleSubmit} className="modal__body">
          <label className="modal__label">
            密码
            <input
              type="password"
              className="modal__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              autoFocus
              disabled={busy}
              placeholder="请输入管理员密码"
            />
          </label>
          {error && <div className="modal__error">{error}</div>}
          <div className="modal__actions">
            <button
              type="button"
              className="modal__btn modal__btn--ghost"
              onClick={close}
              disabled={busy}
            >
              取消
            </button>
            <button
              type="submit"
              className="modal__btn"
              disabled={busy || !password.trim()}
            >
              {busy ? '验证中…' : '登录'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
