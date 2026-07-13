import React, { useEffect, useState } from 'react'
import { ThemeToggle } from '../components/ThemeToggle'
import { BackButton } from '../components/BackButton'
import { useTheme } from '../contexts/ThemeContext'
import './RagPage.css'

const steps = [
  {
    number: '1',
    title: '文档解析',
    description: '支持 PDF、Word、TXT 等多种格式文档的智能解析与内容提取'
  },
  {
    number: '2',
    title: '向量化存储',
    description: '将文本内容转换为向量表示，存储于向量数据库中便于检索'
  },
  {
    number: '3',
    title: '智能检索',
    description: '基于语义相似度匹配，快速检索相关知识片段'
  },
  {
    number: '4',
    title: '精准回答',
    description: '结合检索内容与 LLM 生成准确、专业的回答'
  }
]

type Phase = 'enter' | 'idle' | 'exit'

export const RagPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [phase, setPhase] = useState<Phase>('enter')
  const { setTheme } = useTheme()

  useEffect(() => {
    setTheme('dark')
    const id = requestAnimationFrame(() => setPhase('idle'))
    return () => cancelAnimationFrame(id)
  }, [setTheme])

  const handleBack = () => {
    if (phase === 'exit') return
    setPhase('exit')
    window.setTimeout(onBack, 400)
  }

  const className =
    phase === 'enter'
      ? 'rag-page rag-page--enter'
      : phase === 'exit'
        ? 'rag-page rag-page--exit'
        : 'rag-page'

  return (
    <div className={className}>
      <BackButton onBack={handleBack} />
      <ThemeToggle />

      <div className="rag-header">
        <h1 className="rag-title">智能问答系统 — RAG 增强</h1>
        <p className="rag-subtitle">Retrieval-Augmented Generation</p>
      </div>

      <div className="steps-grid">
        {steps.map((step) => (
          <div key={step.number} className="step-card">
            <div className="step-number">{step.number}</div>
            <h3 className="step-title">{step.title}</h3>
            <p className="step-description">{step.description}</p>
          </div>
        ))}
      </div>

      <div className="rag-footer">
        <p>基于 LangChain 构建的 RAG 智能问答系统</p>
      </div>
    </div>
  )
}
