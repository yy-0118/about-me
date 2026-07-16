import React, { useState } from 'react'
import type { ChatSource } from '../lib/types'

export const SourceCard: React.FC<{ source: ChatSource }> = ({ source }) => {
  const [open, setOpen] = useState(false)
  const pct = (source.score * 100).toFixed(1)
  return (
    <div className={`source-card ${open ? 'source-card--open' : ''}`}>
      <button className="source-card__head" onClick={() => setOpen((o) => !o)}>
        <span className="source-card__name">{source.document_name}</span>
        <span className="source-card__score">{pct}%</span>
        <svg
          className="source-card__chevron"
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div className="source-card__body">
        <div className="source-card__text">{source.chunk_text}</div>
      </div>
    </div>
  )
}
