import React, { useEffect, useRef, useState } from 'react'

interface Props {
  onSend: (text: string) => void
  disabled: boolean
}

export const ChatInput: React.FC<Props> = ({
  onSend,
  disabled,
}) => {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }, [text])

  const submit = () => {
    const v = text.trim()
    if (!v || disabled) return
    onSend(v)
    setText('')
  }

  return (
    <div className="chat-input">
      <textarea
        ref={ref}
        className="chat-input__field"
        rows={1}
        placeholder="向我问任何问题..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
        disabled={disabled}
      />
      <button
        className="chat-input__send"
        onClick={submit}
        disabled={disabled || !text.trim()}
        aria-label="发送"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      </button>
    </div>
  )
}
