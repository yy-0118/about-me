import React, { useEffect, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import './CoverPage.css'

type Label = {
  text: string
  x: number
  y: number
  hideStart?: number
  hideEnd?: number
}

type LineStyle = {
  len: string
  angle: number
}

const CENTER_X = 50
const CENTER_Y = 53

/**
 * 每条线的两端遮罩距离(单位 px),用于在 mask-image 渐变中让两端透明。
 *   hideStart: 起点端(中心/About me 方向)隐藏距离,加大 → 离 About me 更远
 *   hideEnd:   终点端(文字方向)隐藏距离,加大 → 离文字更远;默认 0 → 精确对齐文字中点
 * 不写则 fallback 到 CSS 默认 40 / 0。
 */
const labels: Label[] = [
  { text: '性格', x: 30, y: 15, hideStart: 100, hideEnd: 10 },
  { text: '口味', x: 49.2, y: 7.4, hideStart: 65, hideEnd: 10 },
  { text: '校园经历', x: 87.3, y: 8.5, hideStart: 120, hideEnd:20 },
  { text: '音乐品味', x: 8, y: 20, hideStart: 220, hideEnd: 15 },
  { text: '爱好', x: 60, y: 28.7, hideStart: 100, hideEnd: 18 },
  { text: '项目经历', x: 91.5, y: 34.0, hideStart: 255, hideEnd: 30 },
  { text: '职业规划', x: 90.8, y: 65, hideStart: 110, hideEnd: 33 },
  { text: 'MBTI', x: 70.8, y: 65.4, hideStart: 100, hideEnd: 20 },
  { text: '联系方式', x: 49.6, y: 72.9, hideStart: 32, hideEnd: 10 },
  { text: '社交', x: 70, y: 81.9, hideStart: 70, hideEnd: 18 },
  { text: '体质特征', x: 58, y: 85.1, hideStart: 50, hideEnd: 10 },
  { text: '星座', x: 29.2, y: 86.7, hideStart: 55, hideEnd: 10 },
  { text: '特长', x: 16.5, y: 65, hideStart: 105, hideEnd: 19 },
]

const computeLineStyles = (): LineStyle[] => {
  if (typeof window === 'undefined') {
    return labels.map(() => ({ len: '0px', angle: 0 }))
  }
  const W = window.innerWidth
  const H = window.innerHeight
  return labels.map((label) => {
    const dx = ((label.x - CENTER_X) / 100) * W
    const dy = ((label.y - CENTER_Y) / 100) * H
    const lenPx = Math.hypot(dx, dy)
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI
    return { len: `${lenPx}px`, angle }
  })
}

export const CoverPage: React.FC<{ onEnter: () => void }> = ({ onEnter }) => {
  const [phase, setPhase] = useState<'enter' | 'idle' | 'exit'>('enter')
  const [ready, setReady] = useState(false)
  const [lineStyles, setLineStyles] = useState<LineStyle[]>(() => computeLineStyles())
  const { setTheme } = useTheme()

  useEffect(() => {
    const update = () => setLineStyles(computeLineStyles())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    setTheme('light')
    const t = window.setTimeout(() => {
      setPhase('idle')
      setReady(true)
    }, 2700)
    return () => window.clearTimeout(t)
  }, [setTheme])

  const handleClick = () => {
    if (!ready || phase === 'exit') return
    setPhase('exit')
    window.setTimeout(onEnter, 1550)
  }

  return (
    <div
      className={`cover-page phase-${phase}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      <div className="cover-lines">
        {labels.map((label, i) => (
          <div
            key={label.text}
            className="cover-line-outer"
            style={
              {
                transform: `rotate(${lineStyles[i]?.angle ?? 0}deg)`,
                '--line-delay': `${0.55 + i * 0.045}s`,
              } as React.CSSProperties
            }
          >
            <div
              className="cover-line-inner"
              style={
                {
                  width: lineStyles[i]?.len ?? '0px',
                  '--hide-start': `${label.hideStart ?? 40}px`,
                  '--hide-end': `${label.hideEnd ?? 0}px`,
                } as React.CSSProperties
              }
            />
          </div>
        ))}
      </div>

      <div className="cover-center">
        <h1 className="cover-title">About me</h1>
        <p className="cover-hint">(点击任意处进入问答页)</p>
      </div>

      {labels.map((label, i) => {
        const dx = CENTER_X - label.x
        const dy = CENTER_Y - label.y
        return (
          <span
            key={label.text}
            className="cover-label"
            style={
              {
                left: `${label.x}%`,
                top: `${label.y}%`,
                '--dx': `${dx}%`,
                '--dy': `${dy}%`,
                '--enter-delay': `${1.35 + i * 0.05}s`,
                '--sway-delay': `${(i * 0.41) % 3.2}s`,
              } as React.CSSProperties
            }
          >
            <span className="cover-label-inner">{label.text}</span>
          </span>
        )
      })}
    </div>
  )
}
