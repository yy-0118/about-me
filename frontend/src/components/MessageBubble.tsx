import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message } from '../lib/types'
import { SourceCard } from './SourceCard'

interface Props {
  message: Message
  onRegenerate?: () => void
  onCopy?: () => void
}

export const MessageBubble: React.FC<Props> = ({ message, onRegenerate, onCopy }) => {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!onCopy) return
    onCopy()
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  if (isUser) {
    return (
      <div className="bubble-row bubble-row--user">
        <div className="bubble-user">
          <div className="bubble-user__content">{message.content}</div>
          <span className="bubble-user__tail" />
        </div>
      </div>
    )
  }

  return (
    <div className="bubble-row bubble-row--assistant">
      <div className="bubble-assistant">
        <div className="bubble-assistant__head">
          <span className="bubble-assistant__brand">
            <span className="bubble-assistant__brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="7" width="14" height="10" rx="3" />
                <path d="M12 3v4" />
                <path d="M8 21h8" />
                <path d="M9 12h.01" />
                <path d="M15 12h.01" />
              </svg>
            </span>
            <span>AI助手</span>
          </span>
          <button
            className="bubble-assistant__collapse"
            aria-label="收起"
            onClick={(e) => e.currentTarget.closest('.bubble-assistant')?.classList.toggle('bubble-assistant--collapsed')}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
        <div className="bubble-assistant__body markdown-body">
          {message.content ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          ) : message.streaming ? (
            <span className="bubble-assistant__thinking">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </span>
          ) : null}
          {message.streaming && message.content && (
            <span className="bubble-assistant__caret">▌</span>
          )}
        </div>
        {message.sources && message.sources.length > 0 && (
          <div className="bubble-assistant__sources">
            <div className="bubble-assistant__sources-label">引用 ({message.sources.length})</div>
            {message.sources.map((src, i) => (
              <SourceCard key={i} source={src} />
            ))}
          </div>
        )}
        {!message.streaming && message.content && (
          <div className="bubble-assistant__actions">
            <button className="bubble-assistant__action" onClick={handleCopy}>
              {copied ? '已复制' : '复制'}
            </button>
            {onRegenerate && (
              <button className="bubble-assistant__action" onClick={onRegenerate}>
                重新生成
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
