import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { AdminSidebar, type AdminTabKey } from '../components/admin/AdminSidebar'
import { AdminTopBar } from '../components/admin/AdminTopBar'
import { DashboardTab } from '../components/admin/tabs/DashboardTab'
import { DocumentsTab } from '../components/admin/tabs/DocumentsTab'
import { UserConversationsTab } from '../components/admin/tabs/UserConversationsTab'
import { LLMApiTab } from '../components/admin/tabs/LLMApiTab'
import { DangerZoneTab } from '../components/admin/tabs/DangerZoneTab'
import './AdminPage.css'
import '../components/Sidebar.css'
import '../components/TopBar.css'
import '../components/Modal.css'

type Phase = 'enter' | 'idle' | 'exit'

interface Props {
  onBack: () => void
}

const TABS: { key: AdminTabKey; label: string }[] = [
  { key: 'dashboard', label: '系统概览' },
  { key: 'documents', label: '文档管理' },
  { key: 'conversations', label: '用户对话' },
  { key: 'llm', label: 'LLM API' },
  { key: 'danger', label: '危险操作' },
]

const AdminPageInner: React.FC<Props> = ({ onBack }) => {
  const { isAdmin } = useAuth()
  const [phase, setPhase] = useState<Phase>('enter')
  const [tab, setTab] = useState<AdminTabKey>('dashboard')
  const [refreshKey, setRefreshKey] = useState(0)

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light')
    const id = requestAnimationFrame(() => setPhase('idle'))
    return () => cancelAnimationFrame(id)
  }, [])

  const className =
    phase === 'enter'
      ? 'admin-page admin-page--enter'
      : phase === 'exit'
        ? 'admin-page admin-page--exit'
        : 'admin-page'

  if (!isAdmin) {
    return (
      <div className={className}>
        <div className="admin-page__body">
          <div className="admin-page__main">
            <div className="admin-tab">
              <h2 className="admin-tab__title">需要管理员登录</h2>
              <p className="admin-tab__subtitle">请返回聊天页登录管理员后再进入后台</p>
              <button className="admin-btn admin-btn--primary" onClick={onBack}>
                返回聊天
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="admin-page__body">
        <AdminSidebar
          current={tab}
          onChange={setTab}
          tabs={TABS}
          onBackToChat={onBack}
        />
        <div className="admin-page__main">
          <AdminTopBar currentLabel={TABS.find((t) => t.key === tab)?.label || ''} />
          {tab === 'dashboard' && <DashboardTab key={`dash-${refreshKey}`} />}
          {tab === 'documents' && (
            <DocumentsTab key={`docs-${refreshKey}`} onChanged={() => setRefreshKey((k) => k + 1)} />
          )}
          {tab === 'conversations' && (
            <UserConversationsTab
              key={`conv-${refreshKey}`}
              onChanged={() => setRefreshKey((k) => k + 1)}
            />
          )}
          {tab === 'llm' && <LLMApiTab />}
          {tab === 'danger' && (
            <DangerZoneTab onChanged={() => setRefreshKey((k) => k + 1)} />
          )}
        </div>
      </div>
    </div>
  )
}

export const AdminPage: React.FC<Props> = (props) => {
  return <AdminPageInner {...props} />
}
