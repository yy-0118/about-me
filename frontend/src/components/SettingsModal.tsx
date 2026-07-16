import React, { useEffect, useState } from 'react'
import { getSettings } from '../lib/api'
import type { ChatSettings } from '../lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onChanged?: (s: ChatSettings) => void
}

export const SettingsModal: React.FC<Props> = ({ open, onClose, onChanged }) => {
  const [settings, setSettings] = useState<ChatSettings | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    getSettings()
      .then((s) => {
        setSettings(s)
        onChanged?.(s)
      })
      .catch(() => setError('读取设置失败'))
  }, [open, onChanged])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>系统设置（只读）</h3>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>
        <div className="modal__body">
          {!settings ? (
            <div className="modal__hint">加载中...</div>
          ) : (
            <>
              <label className="modal__label">
                Temperature ({settings.temperature.toFixed(2)})
                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.05}
                  value={settings.temperature}
                  disabled
                />
              </label>
              <label className="modal__label">
                Top K
                <input
                  type="number"
                  className="modal__input"
                  min={1}
                  max={20}
                  value={settings.top_k}
                  disabled
                />
              </label>
              <label className="modal__label">
                LLM Model
                <input
                  type="text"
                  className="modal__input"
                  value={settings.llm_model}
                  disabled
                />
              </label>
              <label className="modal__label">
                System Prompt
                <textarea
                  className="modal__input modal__input--area"
                  rows={5}
                  value={settings.system_prompt}
                  disabled
                />
              </label>
              <div className="modal__hint">如需修改设置，请进入「管理后台 → LLM API」</div>
              {error && <div className="modal__error">{error}</div>}
              <div className="modal__actions">
                <button className="modal__btn" onClick={onClose}>
                  关闭
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

