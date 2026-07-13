import React from 'react'
import './BackButton.css'

export const BackButton: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return (
    <button
      className="back-button"
      onClick={onBack}
      aria-label="返回封面"
      type="button"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  )
}
