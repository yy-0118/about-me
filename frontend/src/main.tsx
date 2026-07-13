import React from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './contexts/ThemeContext'
import { CoverPage } from './pages/CoverPage'
import { RagPage } from './pages/RagPage'
import './index.css'

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = React.useState<'cover' | 'rag'>('cover')

  return (
    <div className="app">
      {currentPage === 'cover' ? (
        <CoverPage onEnter={() => setCurrentPage('rag')} />
      ) : (
        <RagPage onBack={() => setCurrentPage('cover')} />
      )}
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
)
