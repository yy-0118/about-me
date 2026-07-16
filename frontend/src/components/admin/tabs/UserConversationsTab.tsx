import React, { useEffect, useState } from 'react'
import {
  adminClearSessions,
  adminDeleteSession,
  adminGetSession,
  adminListSessions,
} from '../../../lib/api'
import type {
  AdminSessionDetail,
  AdminSessionItem,
} from '../../../lib/types'

interface Props {
  onChanged?: () => void
}

const fmtTime = (s: string) => {
  const d = new Date(s)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const fmtRelative = (s: string) => {
  const d = new Date(s).getTime()
  const diff = Date.now() - d
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return new Date(s).toLocaleDateString()
}

export const UserConversationsTab: React.FC<Props> = ({ onChanged }) => {
  const [sessions, setSessions] = useState<AdminSessionItem[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [detail, setDetail] = useState<AdminSessionDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')

  const reload = async () => {
    setLoading(true)
    setError('')
    try {
      const r = await adminListSessions(500, 0)
      setSessions(r.items)
    } catch (e: any) {
      setError(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  useEffect(() => {
    if (activeId == null) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    setError('')
    adminGetSession(activeId)
      .then(setDetail)
      .catch((e) => setError(e?.message || '加载会话失败'))
      .finally(() => setDetailLoading(false))
  }, [activeId])

  const handleDelete = async (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!window.confirm('确认删除该会话？会话内所有消息会一并删除')) return
    try {
      await adminDeleteSession(id)
      if (activeId === id) setActiveId(null)
      await reload()
      onChanged?.()
    } catch (e: any) {
      setError(e?.message || '删除失败')
    }
  }

  const handleClearAll = async () => {
    if (!window.confirm('确认清空所有用户对话？此操作不可恢复')) return
    try {
      await adminClearSessions()
      setActiveId(null)
      await reload()
      onChanged?.()
    } catch (e: any) {
      setError(e?.message || '清空失败')
    }
  }

  return (
    <div className="admin-tab">
      <div className="admin-tab__head">
        <div>
          <h2 className="admin-tab__title">用户对话</h2>
          <p className="admin-tab__subtitle">查看所有用户会话的完整问答与引用来源</p>
        </div>
      </div>

      {error && <div className="admin-error">⚠ {error}</div>}

      <div className="uc-layout">
        <div className="uc-list">
          <div className="uc-list__head">
            <div className="uc-list__head-title">
              会话列表
              <span className="uc-list__head-count">{sessions.length}</span>
            </div>
            <div className="uc-list__head-actions">
              <button
                className="admin-btn admin-btn--ghost admin-btn--sm"
                onClick={reload}
                title="刷新"
              >
                ↻
              </button>
              <button
                className="admin-btn admin-btn--ghost admin-btn--sm"
                onClick={handleClearAll}
                disabled={sessions.length === 0}
                style={{ color: '#d9534f' }}
                title="清空所有"
              >
                清空
              </button>
            </div>
          </div>
          <div className="uc-list__body">
            {loading && sessions.length === 0 && <div className="uc-list__empty">加载中…</div>}
            {!loading && sessions.length === 0 && (
              <div className="uc-list__empty">暂无会话</div>
            )}
            {sessions.map((s) => (
              <button
                key={s.id}
                className={`uc-list__item ${s.id === activeId ? 'uc-list__item--active' : ''}`}
                onClick={() => setActiveId(s.id)}
              >
                <div className="uc-list__title">
                  <span className="uc-list__title-text">{s.title || '新对话'}</span>
                  <span
                    className="uc-list__del"
                    onClick={(e) => handleDelete(s.id, e)}
                    title="删除会话"
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </span>
                </div>
                <div className="uc-list__meta">
                  <span className="uc-list__meta-icon">
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    {s.message_count}
                  </span>
                  <span>·</span>
                  <span>{fmtRelative(s.updated_at)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="uc-detail">
          {!activeId && (
            <div className="uc-detail__empty">
              <svg className="uc-detail__empty-icon" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <div>← 从左侧选择一个会话查看完整 Q&amp;A</div>
            </div>
          )}
          {activeId && detailLoading && <div className="uc-detail__empty">加载中…</div>}
          {activeId && detail && (
            <>
              <div className="uc-detail__head">
                <div className="uc-detail__title-block">
                  <div className="uc-detail__title">{detail.title || '新对话'}</div>
                  <div className="uc-detail__meta">
                    <span>创建 {fmtTime(detail.created_at)}</span>
                    <span>·</span>
                    <span>更新 {fmtTime(detail.updated_at)}</span>
                    <span>·</span>
                    <span>{detail.messages.length} 条消息</span>
                  </div>
                </div>
                <button
                  className="admin-btn admin-btn--danger admin-btn--sm"
                  onClick={() => handleDelete(detail.id)}
                >
                  删除会话
                </button>
              </div>
              <div className="uc-detail__messages">
                {detail.messages.length === 0 && (
                  <div className="uc-detail__empty">该会话无消息</div>
                )}
                {detail.messages.map((m) => (
                  <div key={m.id} className={`uc-msg uc-msg--${m.role}`}>
                    <div className="uc-msg__avatar">
                      {m.role === 'user' ? 'U' : 'AI'}
                    </div>
                    <div className="uc-msg__body">
                      <div className="uc-msg__role">
                        {m.role === 'user' ? '用户' : 'AI 助手'} · {fmtTime(m.created_at)}
                      </div>
                      <div className="uc-msg__bubble">{m.content}</div>
                      {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                        <div className="uc-msg__sources">
                          <div className="uc-msg__sources-title">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </svg>
                            引用来源（{m.sources.length}）
                          </div>
                          {m.sources.map((s, i) => (
                            <div className="uc-msg__source" key={i}>
                              <span className="uc-msg__source-score">{s.score.toFixed(3)}</span>
                              <span className="uc-msg__source-name">{s.document_name}</span>
                              <span className="uc-msg__source-text">
                                {s.chunk_text.slice(0, 80)}
                                {s.chunk_text.length > 80 ? '…' : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
