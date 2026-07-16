import React from 'react'
import { ThemeToggle } from '../ThemeToggle'

interface Props {
  currentLabel: string
}

export const AdminTopBar: React.FC<Props> = ({ currentLabel }) => {
  return (
    <div className="admin-topbar">
      <div className="admin-topbar__title">
        <div className="admin-topbar__breadcrumb">
          <div className="admin-topbar__breadcrumb-eyebrow">管理后台</div>
          <div className="admin-topbar__breadcrumb-title">{currentLabel}</div>
        </div>
      </div>
      <div className="admin-topbar__actions">
        <div className="admin-topbar__badge">
          <span className="admin-topbar__badge-dot" />
          <span>已登录</span>
        </div>
        <ThemeToggle />
      </div>
    </div>
  )
}
