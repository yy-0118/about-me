import React, { useState } from 'react'
import { adminClearSessions, resetAdminSettings } from '../../../lib/api'

interface Props {
  onChanged?: () => void
}

const WarnIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

export const DangerZoneTab: React.FC<Props> = ({ onChanged }) => {
  const [confirmClear, setConfirmClear] = useState('')
  const [busy, setBusy] = useState<null | 'clear' | 'reset'>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleClear = async () => {
    if (confirmClear !== '确认清空') {
      setError('请在输入框中输入"确认清空"')
      return
    }
    if (!window.confirm('二次确认：清空后所有用户对话不可恢复，是否继续？')) return
    setBusy('clear')
    setError('')
    setSuccess('')
    try {
      const r = await adminClearSessions()
      setSuccess(`已清空 ${r.deleted_sessions} 个会话`)
      setConfirmClear('')
      onChanged?.()
    } catch (e: any) {
      setError(e?.message || '清空失败')
    } finally {
      setBusy(null)
    }
  }

  const handleReset = async () => {
    if (!window.confirm('确认重置系统设置为默认值？API Key 不会被清空')) return
    setBusy('reset')
    setError('')
    setSuccess('')
    try {
      await resetAdminSettings()
      setSuccess('系统设置已重置为默认值')
      onChanged?.()
    } catch (e: any) {
      setError(e?.message || '重置失败')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="admin-tab">
      <div className="admin-tab__head">
        <div>
          <h2 className="admin-tab__title">危险操作</h2>
          <p className="admin-tab__subtitle">不可恢复的操作，请谨慎执行</p>
        </div>
      </div>

      {error && <div className="admin-error">⚠ {error}</div>}
      {success && <div className="admin-success">✓ {success}</div>}

      <div className="admin-card danger-card">
        <div className="danger-card__head">
          <div className="danger-card__icon">{WarnIcon}</div>
          <div>
            <h3 className="danger-card__title">清空所有用户对话</h3>
            <p className="danger-card__hint">
              删除全部 chat_sessions 与 chat_messages。<strong style={{ color: '#b9443f' }}>此操作不可恢复</strong>，文档、设置不受影响。
            </p>
          </div>
        </div>
        <div className="danger-card__body">
          <div className="admin-field danger-card__confirm">
            <label className="admin-field__label">
              请输入 <code style={{ background: 'var(--bg-app)', padding: '2px 6px', borderRadius: 4 }}>确认清空</code> 以启用按钮
            </label>
            <input
              className="admin-input"
              value={confirmClear}
              onChange={(e) => setConfirmClear(e.target.value)}
              placeholder="确认清空"
            />
          </div>
          <div className="admin-actions">
            <button
              className="admin-btn admin-btn--danger"
              disabled={busy !== null || confirmClear !== '确认清空'}
              onClick={handleClear}
            >
              {busy === 'clear' ? '执行中…' : '清空所有对话'}
            </button>
          </div>
        </div>
      </div>

      <div className="admin-card danger-card">
        <div className="danger-card__head">
          <div className="danger-card__icon">{WarnIcon}</div>
          <div>
            <h3 className="danger-card__title">重置系统设置</h3>
            <p className="danger-card__hint">
              把 temperature / top_k / llm_model / embedding_model / system_prompt / ai_style /
              base_url 恢复为默认值。<strong style={{ color: '#2a8a3e' }}>不会清空 API Key</strong>。
            </p>
          </div>
        </div>
        <div className="danger-card__body">
          <div className="admin-actions">
            <button
              className="admin-btn admin-btn--danger"
              disabled={busy !== null}
              onClick={handleReset}
            >
              {busy === 'reset' ? '执行中…' : '重置系统设置'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
