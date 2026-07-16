import React, { useEffect, useRef, useState } from 'react'
import { Sidebar } from '../components/Sidebar'
import { ChatPanel } from '../components/ChatPanel'
import { TopBar } from '../components/TopBar'
import { AdminLoginModal } from '../components/AdminLoginModal'
import { SettingsModal } from '../components/SettingsModal'
import { useAuth } from '../contexts/AuthContext'
import {
  ApiError,
  chatStream,
  createSession,
  getSession,
} from '../lib/api'
import type { Message } from '../lib/types'
import './RagPage.css'
import '../components/Sidebar.css'
import '../components/ChatPanel.css'
import '../components/Modal.css'
import '../components/TopBar.css'

type Phase = 'enter' | 'idle' | 'exit'

interface Props {
  onBack: () => void
  onEnterAdmin: () => void
}

const RagPageInner: React.FC<Props> = ({ onBack, onEnterAdmin }) => {
  const { logout } = useAuth()
  const [phase, setPhase] = useState<Phase>('enter')
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light')
    const id = requestAnimationFrame(() => setPhase('idle'))
    return () => cancelAnimationFrame(id)
  }, [])

  const loadSession = async (id: number) => {
    try {
      const s = await getSession(id)
      setCurrentId(s.id)
      setMessages(
        s.messages.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          sources: m.sources || undefined,
          created_at: m.created_at,
        })),
      )
    } catch {
      // ignore
    }
  }

  const startNewChat = async () => {
    try {
      const s = await createSession('新对话')
      setCurrentId(s.id)
      setMessages([])
      setRefreshKey((k) => k + 1)
    } catch {
      // ignore
    }
  }

  const send = async (text: string) => {
    if (streaming) return

    let sessionId = currentId
    if (!sessionId) {
      try {
        const s = await createSession('新对话')
        sessionId = s.id
        setCurrentId(s.id)
        setRefreshKey((k) => k + 1)
      } catch {
        return
      }
    }

    const userMsg: Message = { role: 'user', content: text }
    const asstId = `asst-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: asstId, role: 'assistant', content: '', streaming: true },
    ])
    setStreaming(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      let first = true
      for await (const ev of chatStream(text, sessionId, ctrl.signal)) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.debug('[RagPage.send] ev =', ev.type, ev.content?.slice(0, 40) ?? '')
        }
        if (ev.type === 'sources' && ev.sources) {
          setMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, sources: ev.sources! } : m)),
          )
        } else if (ev.type === 'chunk' && ev.content) {
          if (first) first = false
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstId ? { ...m, content: m.content + ev.content! } : m,
            ),
          )
        } else if (ev.type === 'error' && ev.content) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstId
                ? { ...m, content: m.content + `\n\n⚠️ ${ev.content}` }
                : m,
            ),
          )
        } else if (ev.type === 'done') {
          setMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, streaming: false } : m)),
          )
        }
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setMessages((prev) => prev.filter((m) => m.id !== asstId))
      } else if (e instanceof ApiError && e.status === 401) {
        logout()
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstId
              ? { ...m, content: m.content || '请求失败：会话已失效', streaming: false }
              : m,
          ),
        )
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstId
              ? { ...m, content: m.content || `请求失败: ${e?.message || e}`, streaming: false }
              : m,
          ),
        )
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const handleRegenerate = async (assistantIdx: number) => {
    if (assistantIdx < 1) return
    const userMsg = messages[assistantIdx - 1]
    if (!userMsg || userMsg.role !== 'user') return
    setMessages((prev) => prev.slice(0, assistantIdx))
    await send(userMsg.content)
  }

  const handleClearChat = () => {
    if (window.confirm('确认清空当前对话？')) {
      setMessages([])
      setCurrentId(null)
      setRefreshKey((k) => k + 1)
    }
  }

  const className =
    phase === 'enter'
      ? 'rag-page rag-page--enter'
      : phase === 'exit'
        ? 'rag-page rag-page--exit'
        : 'rag-page'

  return (
    <div className={className}>
      <div className="rag-page__body">
        <Sidebar
          currentId={currentId}
          onSelect={loadSession}
          onNewChat={startNewChat}
          onBack={onBack}
          onOpenAdminLogin={() => setShowAdmin(true)}
          onEnterAdmin={onEnterAdmin}
          refreshKey={refreshKey}
        />
        <div className="rag-page__main">
          <TopBar
            onOpenSettings={() => setShowSettings(true)}
            onClearChat={handleClearChat}
            onNewChat={startNewChat}
          />
          <ChatPanel
            messages={messages}
            streaming={streaming}
            onSend={send}
            onRegenerate={handleRegenerate}
          />
        </div>
      </div>

      <AdminLoginModal
        open={showAdmin}
        onClose={() => setShowAdmin(false)}
      />
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  )
}

export const RagPage: React.FC<Props> = (props) => <RagPageInner {...props} />
