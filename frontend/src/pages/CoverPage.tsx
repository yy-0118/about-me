import React, { useEffect, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import './CoverPage.css'

type Label = {
  text: string
  x: number
  y: number
}

type LineStyle = {
  len: string
  angle: number
}

const CENTER_X = 50
const CENTER_Y = 53

const labels: Label[] = [
  { text: '性格', x: 16.8, y: 10.1 },
  { text: '美食', x: 49.2, y: 7.4 },
  { text: '校园经历', x: 87.3, y: 8.5 },
  { text: '音乐', x: 10.8, y: 33.5 },
  { text: '爱好', x: 63.8, y: 28.7 },
  { text: '项目经历', x: 91.5, y: 34.0 },
  { text: '职业规划', x: 90.8, y: 55.9 },
  { text: 'MBTI', x: 70.8, y: 65.4 },
  { text: '联系方式', x: 49.6, y: 72.9 },
  { text: '社交', x: 91.5, y: 81.9 },
  { text: '体质特征', x: 50.4, y: 85.1 },
  { text: '星座', x: 29.2, y: 86.7 },
  { text: '特长', x: 16.5, y: 71.3 },
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
    window.setTimeout(onEnter, 950)
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
              style={{ width: lineStyles[i]?.len ?? '0px' }}
            />
          </div>
        ))}
      </div>

      <div className="cover-center">
        <h1 className="cover-title">About me</h1>
        <p className="cover-hint">(点此处进入问答)</p>
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
