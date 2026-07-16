import React, { useEffect, useState } from 'react'
import { getAdminStats } from '../../../lib/api'
import type { AdminStats } from '../../../lib/types'

const fmtTime = (s: string | null) => {
  if (!s) return '—'
  const d = new Date(s)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const ICONS = {
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h4',
  chunk: 'M4 6h16 M4 12h16 M4 18h10',
  session: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z M8 9h8 M8 13h5',
  msg: 'M4 4h16v12H7l-3 3z M8 8h8 M8 12h5',
}

export const DashboardTab: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const s = await getAdminStats()
      setStats(s)
    } catch (e: any) {
      setError(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="admin-tab">
      <div className="admin-tab__head">
        <div>
          <h2 className="admin-tab__title">系统概览</h2>
          <p className="admin-tab__subtitle">知识库与对话系统的实时状态</p>
        </div>
        <button className="admin-btn" onClick={load} disabled={loading}>
          {loading ? '加载中…' : '刷新数据'}
        </button>
      </div>

      {error && <div className="admin-error">⚠ {error}</div>}

      {stats && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card__icon stat-card__icon--blue">
                <Icon d={ICONS.doc} />
              </div>
              <div className="stat-card__label">文档总数</div>
              <div className="stat-card__value stat-card__accent">{stats.documents}</div>
              <div className="stat-card__sub">最近上传：{fmtTime(stats.latest_document_at)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__icon stat-card__icon--green">
                <Icon d={ICONS.chunk} />
              </div>
              <div className="stat-card__label">文本块</div>
              <div className="stat-card__value">{stats.chunks}</div>
              <div className="stat-card__sub">已建立向量索引</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__icon stat-card__icon--purple">
                <Icon d={ICONS.session} />
              </div>
              <div className="stat-card__label">对话会话</div>
              <div className="stat-card__value stat-card__accent">{stats.sessions}</div>
              <div className="stat-card__sub">最近活跃：{fmtTime(stats.latest_session_at)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__icon stat-card__icon--orange">
                <Icon d={ICONS.msg} />
              </div>
              <div className="stat-card__label">消息总数</div>
              <div className="stat-card__value">{stats.messages}</div>
              <div className="stat-card__sub">
                用户 {stats.user_messages} · 助手 {stats.assistant_messages}
              </div>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card__head">
              <div className="admin-card__head-l">
                <div className="admin-card__head-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <div>
                  <h3 className="admin-card__title">功能导览</h3>
                  <p className="admin-card__hint">通过左侧导航快速进入各管理模块</p>
                </div>
              </div>
            </div>
            <div className="info-grid">
              <div className="info-card">
                <div className="info-card__icon">
                  <Icon d={ICONS.doc} />
                </div>
                <div>
                  <div className="info-card__title">文档管理</div>
                  <div className="info-card__desc">上传、删除知识库文档；自动分块与向量化</div>
                </div>
              </div>
              <div className="info-card">
                <div className="info-card__icon">
                  <Icon d={ICONS.session} />
                </div>
                <div>
                  <div className="info-card__title">用户对话</div>
                  <div className="info-card__desc">查看所有用户会话的完整 Q&amp;A 与引用源</div>
                </div>
              </div>
              <div className="info-card">
                <div className="info-card__icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="6" width="16" height="12" rx="3" />
                    <circle cx="9" cy="12" r="1.2" fill="currentColor" />
                    <circle cx="15" cy="12" r="1.2" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <div className="info-card__title">LLM API</div>
                  <div className="info-card__desc">配置 API Key、模型、检索参数与回复风格</div>
                </div>
              </div>
              <div className="info-card">
                <div className="info-card__icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div>
                  <div className="info-card__title">危险操作</div>
                  <div className="info-card__desc">清空所有会话或重置系统设置</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
