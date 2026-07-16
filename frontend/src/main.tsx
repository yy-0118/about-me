import React from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CoverPage } from './pages/CoverPage'
import { RagPage } from './pages/RagPage'
import { AdminPage } from './pages/AdminPage'
import './index.css'

type Page = 'cover' | 'rag' | 'admin'

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = React.useState<Page>('cover')
  const { isAdmin } = useAuth()
  const prevAdminRef = React.useRef<boolean>(isAdmin)

  // 登录成功 → 自动进入管理后台
  // 退出登录 → 如果当前在管理后台，自动回到聊天页
  React.useEffect(() => {
    const wasAdmin = prevAdminRef.current
    prevAdminRef.current = isAdmin
    if (!wasAdmin && isAdmin) {
      setCurrentPage('admin')
    } else if (wasAdmin && !isAdmin && currentPage === 'admin') {
      setCurrentPage('rag')
    }
  }, [isAdmin, currentPage])

  return (
    <div className="app">
      {currentPage === 'cover' && (
        <CoverPage onEnter={() => setCurrentPage('rag')} />
      )}
      {currentPage === 'rag' && (
        <RagPage
          onBack={() => setCurrentPage('cover')}
          onEnterAdmin={() => setCurrentPage('admin')}
        />
      )}
      {currentPage === 'admin' && (
        <AdminPage onBack={() => setCurrentPage('rag')} />
      )}
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(
  <ThemeProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </ThemeProvider>,
)
