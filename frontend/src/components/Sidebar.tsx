import React, { useEffect, useState } from 'react'
import { createSession, deleteSession, listSessions } from '../lib/api'
import type { ChatSession } from '../lib/types'
import { useAuth } from '../contexts/AuthContext'
import { BackButton } from './BackButton'

interface Props {
  currentId: number | null
  onSelect: (id: number) => void
  onNewChat: () => void
  onBack: () => void
  onOpenAdminLogin: () => void
  onEnterAdmin: () => void
  refreshKey?: number
}

export const Sidebar: React.FC<Props> = ({
  currentId,
  onSelect,
  onNewChat,
  onBack,
  onOpenAdminLogin,
  onEnterAdmin,
  refreshKey,
}) => {
  const { isAdmin } = useAuth()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const reload = async () => {
    try {
      const resp = await listSessions()
      setSessions(resp.items)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    reload()
  }, [refreshKey])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)')
    const sync = () => {
      setIsMobile(query.matches)
      setCollapsed(query.matches)
    }
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  const handleNew = async () => {
    try {
      const s = await createSession('新对话')
      await reload()
      onNewChat()
      onSelect(s.id)
      if (isMobile) setCollapsed(true)
    } catch {
      // ignore
    }
  }

  const handleSelect = (id: number) => {
    onSelect(id)
    if (isMobile) setCollapsed(true)
  }

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!window.confirm('确认删除该对话？')) return
    try {
      await deleteSession(id)
      if (id === currentId) onNewChat()
      await reload()
    } catch {
      // ignore
    }
  }

  return (
    <>
    {isMobile && !collapsed && (
      <button
        className="sidebar__scrim"
        aria-label="Close sidebar"
        onClick={() => setCollapsed(true)}
      />
    )}
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__head">
        {!collapsed && <BackButton onBack={onBack} />}
        {!collapsed && (
          <div className="sidebar__brand">
            <span className="sidebar__brand-name">about me</span>
          </div>
        )}
        <button
          className="sidebar__collapse"
          onClick={() => setCollapsed((c) => !c)}
          aria-label="折叠"
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      {!collapsed && (
        <>
          <button className="sidebar__primary" onClick={handleNew}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>新对话</span>
          </button>

          <div className="sidebar__section-label">对话</div>
          <ul className="sidebar__list">
            {sessions.length === 0 && (
              <li className="sidebar__list-empty">暂无对话</li>
            )}
            {sessions.map((s) => (
              <li
                key={s.id}
                className={`sidebar__item ${s.id === currentId ? 'sidebar__item--active' : ''}`}
                onClick={() => handleSelect(s.id)}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span className="sidebar__item-title">{s.title}</span>
                <button
                  className="sidebar__item-del"
                  onClick={(e) => handleDelete(e, s.id)}
                  aria-label="删除"
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          <div className="sidebar__bottom">
            {isAdmin ? (
              <button
                className="sidebar__mode sidebar__mode--active"
                onClick={onEnterAdmin}
                style={{ width: '100%' }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1l3 6 6 1-4.5 4.5L18 19l-6-3-6 3 1.5-6.5L3 8l6-1z" />
                </svg>
                <span>进入管理后台</span>
              </button>
            ) : (
              <button
                className="sidebar__mode"
                onClick={onOpenAdminLogin}
                style={{ width: '100%' }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>管理员登录</span>
              </button>
            )}
          </div>
        </>
      )}
    </aside>
    </>
  )
}
