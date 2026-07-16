import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'

export type AdminTabKey = 'dashboard' | 'documents' | 'conversations' | 'llm' | 'danger'

interface TabDef {
  key: AdminTabKey
  label: string
}

interface Props {
  current: AdminTabKey
  onChange: (k: AdminTabKey) => void
  tabs: TabDef[]
  onBackToChat: () => void
}

const ICONS: Record<AdminTabKey, React.ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  documents: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="14" y2="17" />
    </svg>
  ),
  conversations: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="13" x2="13" y2="13" />
    </svg>
  ),
  llm: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="6" width="16" height="12" rx="3" />
      <circle cx="9" cy="12" r="1.5" fill="currentColor" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="8" y1="22" x2="16" y2="22" />
      <line x1="3" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="21" y2="12" />
    </svg>
  ),
  danger: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
}

const fmtDateTime = (s: string) => {
  const d = new Date(s)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const AdminSidebar: React.FC<Props> = ({ current, onChange, tabs, onBackToChat }) => {
  const { logout, expiresAt } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={`admin-sidebar ${collapsed ? 'admin-sidebar--collapsed' : ''}`}>
      <div className="admin-sidebar__head">
        <div className="admin-sidebar__logo">A</div>
        {!collapsed && (
          <div className="admin-sidebar__brand">
            <div className="admin-sidebar__brand-name">管理后台</div>
            <div className="admin-sidebar__brand-sub">KNOWLEDGE RAG</div>
          </div>
        )}
        <button
          className="admin-sidebar__collapse"
          onClick={() => setCollapsed((c) => !c)}
          aria-label="折叠"
          title={collapsed ? '展开' : '折叠'}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      <nav className="admin-sidebar__nav">
        {!collapsed && <div className="admin-sidebar__section">导航</div>}
        {tabs.map((t) => {
          const isDanger = t.key === 'danger'
          const isActive = current === t.key
          return (
            <button
              key={t.key}
              className={`admin-sidebar__item ${isActive ? 'admin-sidebar__item--active' : ''} ${
                isDanger ? 'admin-sidebar__item-danger' : ''
              } ${isDanger && isActive ? 'admin-sidebar__item-danger--active' : ''}`}
              onClick={() => onChange(t.key)}
              title={collapsed ? t.label : undefined}
            >
              {ICONS[t.key]}
              {!collapsed && <span>{t.label}</span>}
            </button>
          )
        })}
      </nav>

      <div className="admin-sidebar__bottom">
        {!collapsed && expiresAt && (
          <div className="admin-sidebar__session">
            <div className="admin-sidebar__session-row">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2a8a3e' }} />
              <span>登录会话</span>
            </div>
            <div className="admin-sidebar__session-time">
              有效期至 {fmtDateTime(expiresAt)}
            </div>
          </div>
        )}
        <button
          className="admin-sidebar__exit admin-sidebar__exit--danger"
          onClick={() => {
            if (window.confirm('退出管理员登录？')) {
              logout()
            }
          }}
          title={collapsed ? '退出登录' : undefined}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {!collapsed && <span>退出登录</span>}
        </button>
        <button
          className="admin-sidebar__exit"
          onClick={onBackToChat}
          title={collapsed ? '返回聊天' : undefined}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          {!collapsed && <span>返回聊天</span>}
        </button>
      </div>
    </aside>
  )
}
