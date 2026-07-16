import React, { useEffect, useRef } from 'react'
import type { Message } from '../lib/types'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'

interface Props {
  messages: Message[]
  streaming: boolean
  emptyHint?: string
  onSend: (text: string) => void
  onRegenerate: (assistantIdx: number) => void
}

const EXAMPLES = [
  '介绍一下你的项目经历',
  '你的学历背景是什么?',
  '你的爱好特长有哪些?',
  '你的职业规划是什么?',
  '说说你常用的技术栈',
]

export const ChatPanel: React.FC<Props> = ({
  messages,
  streaming,
  emptyHint = '向我问任何问题...',
  onSend,
  onRegenerate,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, streaming])

  return (
    <div className="chat-panel">
      <div className="chat-panel__stream">
        {messages.length === 0 && (
          <div className="chat-panel__empty">
            <div className="chat-panel__empty-icon">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="chat-panel__empty-hint">{emptyHint}</div>
            <div className="chat-panel__examples">
              {EXAMPLES.map((q) => (
                <button
                  key={q}
                  className="example-chip"
                  onClick={() => onSend(q)}
                  disabled={streaming}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble
            key={i}
            message={m}
            onRegenerate={
              m.role === 'assistant' && !m.streaming ? () => onRegenerate(i) : undefined
            }
            onCopy={() => navigator.clipboard?.writeText(m.content)}
          />
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="chat-panel__input-wrap">
        <ChatInput
          onSend={onSend}
          disabled={streaming}
        />
      </div>
    </div>
  )
}
