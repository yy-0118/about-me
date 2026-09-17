import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AdminLoginModal } from '../components/AdminLoginModal'
import { CoverEditor } from '../components/CoverEditor'
import { useAuth } from '../contexts/AuthContext'
import { coverBackgroundUrl, getCoverConfig } from '../lib/api'
import {
  COVER_CENTER_X,
  COVER_CENTER_Y,
  COVER_REF_HEIGHT,
  COVER_REF_WIDTH,
  clampLineWidth,
  DEFAULT_COVER_HINT,
  DEFAULT_COVER_LABELS,
  DEFAULT_COVER_LINE_WIDTH,
  DEFAULT_COVER_TITLE,
} from '../lib/coverDefaults'
import type { CoverConfig, CoverDraft, CoverLabel } from '../lib/types'
import './CoverPage.css'
import '../components/Modal.css'

type LineStyle = {
  len: number
  angle: number
  /** 相对参考视口的等比系数：hideStart / hideEnd 是按参考视口量的像素值，要按它换算 */
  scale: number
}

type DragState = {
  index: number
  pointerId: number
  /** 按下时鼠标相对小字中心的偏移，拖动时保持住，避免小字“跳”到指针下 */
  offsetX: number
  offsetY: number
}

const POS_MIN = -6
const POS_MAX = 106

const clampPercent = (value: number) =>
  Math.min(POS_MAX, Math.max(POS_MIN, Math.round(value * 100) / 100))

/** 小字坐标是视口百分比，连线长度需要按实际像素换算 */
const computeLineStyles = (
  labels: CoverLabel[],
  width: number,
  height: number,
): LineStyle[] =>
  labels.map((label) => {
    const dx = ((label.x - COVER_CENTER_X) / 100) * width
    const dy = ((label.y - COVER_CENTER_Y) / 100) * height
    const refDx = ((label.x - COVER_CENTER_X) / 100) * COVER_REF_WIDTH
    const refDy = ((label.y - COVER_CENTER_Y) / 100) * COVER_REF_HEIGHT
    const len = Math.hypot(dx, dy)
    const refLen = Math.hypot(refDx, refDy)
    return {
      len,
      angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      scale: refLen > 0 ? len / refLen : 1,
    }
  })

const toDraft = (config: CoverConfig | null): CoverDraft => ({
  title: config?.title ?? '',
  hint: config?.hint ?? '',
  // 从未自定义过时，把内置默认值“物化”进草稿，这样可以直接改
  labels: (config?.labels ?? DEFAULT_COVER_LABELS).map((label) => ({ ...label })),
  // 注意用 ?? 而不是 ||：0 是合法值（不显示连线）
  lineWidth: clampLineWidth(config?.line_width ?? DEFAULT_COVER_LINE_WIDTH),
})

export const CoverPage: React.FC<{ onEnter: () => void }> = ({ onEnter }) => {
  const { isAdmin } = useAuth()
  const [phase, setPhase] = useState<'enter' | 'idle' | 'exit'>('enter')
  const [ready, setReady] = useState(false)
  const [config, setConfig] = useState<CoverConfig | null>(null)
  const [bgVersion, setBgVersion] = useState('')
  const [draft, setDraft] = useState<CoverDraft | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [pendingEdit, setPendingEdit] = useState(false)
  const [activeLabel, setActiveLabel] = useState<number | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const [viewport, setViewport] = useState(() => ({
    w: typeof window === 'undefined' ? 0 : window.innerWidth,
    h: typeof window === 'undefined' ? 0 : window.innerHeight,
  }))
  const toastTimer = useRef<number | null>(null)
  const dragRef = useRef<DragState | null>(null)

  // 封面自定义配置（读取失败就用内置默认，不影响正常进入问答页）
  useEffect(() => {
    let alive = true
    getCoverConfig()
      .then((cfg) => {
        if (!alive) return
        setConfig(cfg)
        setBgVersion(cfg.bg_version)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => {
      setPhase('idle')
      setReady(true)
    }, 2700)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    },
    [],
  )

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2000)
  }, [])

  const openEditor = useCallback(() => {
    if (!isAdmin) {
      // 未登录先走管理员验证，登录成功后自动接着打开编辑器
      setPendingEdit(true)
      setLoginOpen(true)
      return
    }
    setDraft(toDraft(config))
    setEditorOpen(true)
  }, [config, isAdmin])

  // 登录成功 → 自动打开编辑器
  useEffect(() => {
    if (pendingEdit && isAdmin) {
      setPendingEdit(false)
      setLoginOpen(false)
      setDraft(toDraft(config))
      setEditorOpen(true)
    }
  }, [pendingEdit, isAdmin, config])

  const closeEditor = useCallback(() => {
    dragRef.current = null
    setDragging(null)
    setEditorOpen(false)
    setDraft(null)
    setActiveLabel(null)
  }, [])

  const handleSaved = useCallback(
    (cfg: CoverConfig) => {
      dragRef.current = null
      setDragging(null)
      setConfig(cfg)
      setDraft(null)
      setEditorOpen(false)
      setActiveLabel(null)
      showToast('封面已保存')
    },
    [showToast],
  )

  const handleBackgroundChange = useCallback(
    (cfg: CoverConfig) => {
      setConfig(cfg)
      setBgVersion(cfg.bg_version)
      showToast(cfg.custom_bg ? '背景图已更新' : '已恢复默认背景')
    },
    [showToast],
  )

  const moveLabel = useCallback((index: number, x: number, y: number) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            labels: prev.labels.map((label, i) =>
              i === index ? { ...label, x: clampPercent(x), y: clampPercent(y) } : label,
            ),
          }
        : prev,
    )
  }, [])

  const nudgeLabel = useCallback(
    (index: number, dx: number, dy: number) => {
      setDraft((prev) => {
        if (!prev) return prev
        const label = prev.labels[index]
        if (!label) return prev
        return {
          ...prev,
          labels: prev.labels.map((l, i) =>
            i === index
              ? { ...l, x: clampPercent(l.x + dx), y: clampPercent(l.y + dy) }
              : l,
          ),
        }
      })
    },
    [],
  )

  const handleLabelPointerDown = (
    e: React.PointerEvent<HTMLSpanElement>,
    index: number,
  ) => {
    if (!editorOpen || !draft) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // 某些浏览器在元素被移除时会抛，忽略即可
    }
    // preventDefault 会挡掉默认聚焦，这里手动聚焦，松手后可直接用方向键微调
    e.currentTarget.focus({ preventScroll: true })
    const rect = e.currentTarget.getBoundingClientRect()
    dragRef.current = {
      index,
      pointerId: e.pointerId,
      offsetX: e.clientX - (rect.left + rect.width / 2),
      offsetY: e.clientY - (rect.top + rect.height / 2),
    }
    setDragging(index)
    setActiveLabel(index)
  }

  const handleLabelPointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    e.preventDefault()
    e.stopPropagation()
    moveLabel(
      drag.index,
      ((e.clientX - drag.offsetX) / window.innerWidth) * 100,
      ((e.clientY - drag.offsetY) / window.innerHeight) * 100,
    )
  }

  const handleLabelPointerEnd = (e: React.PointerEvent<HTMLSpanElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    e.stopPropagation()
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // 忽略
    }
    dragRef.current = null
    setDragging(null)
  }

  const handleLabelKeyDown = (
    e: React.KeyboardEvent<HTMLSpanElement>,
    index: number,
  ) => {
    if (!editorOpen) return
    const step = e.shiftKey ? 2 : 0.5
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const delta = deltas[e.key]
    if (!delta) return
    e.preventDefault()
    e.stopPropagation()
    setActiveLabel(index)
    nudgeLabel(index, delta[0], delta[1])
  }

  const view = draft ?? config
  const title = (view?.title ?? '').trim() || DEFAULT_COVER_TITLE
  const hint = (view?.hint ?? '').trim() || DEFAULT_COVER_HINT
  const labels = view?.labels ?? DEFAULT_COVER_LABELS
  const lineWidth = draft
    ? draft.lineWidth
    : clampLineWidth(config?.line_width ?? DEFAULT_COVER_LINE_WIDTH)
  const lineStyles = useMemo(
    () => computeLineStyles(labels, viewport.w, viewport.h),
    [labels, viewport],
  )
  const bgUrl = bgVersion ? coverBackgroundUrl(bgVersion) : ''

  const handleClick = () => {
    if (!ready || phase === 'exit') return
    if (editorOpen || loginOpen) return
    setPhase('exit')
    window.setTimeout(onEnter, 1550)
  }

  return (
    <div className="cover-root">
      <div
        className={`cover-page phase-${phase}${editorOpen ? ' is-editing' : ''}`}
        style={
          bgUrl ? ({ backgroundImage: `url("${bgUrl}")` } as React.CSSProperties) : undefined
        }
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label="进入问答页"
      >
        <div className="cover-lines">
          {labels.map((label, i) => (
            <div
              key={i}
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
                    width: `${lineStyles[i]?.len ?? 0}px`,
                    height: `${lineWidth}px`,
                    '--hide-start': `${(label.hideStart ?? 40) * (lineStyles[i]?.scale ?? 1)}px`,
                    '--hide-end': `${(label.hideEnd ?? 0) * (lineStyles[i]?.scale ?? 1)}px`,
                  } as React.CSSProperties
                }
              />
            </div>
          ))}
        </div>

        <div className="cover-center">
          <h1 className="cover-title">{title}</h1>
          <p className="cover-hint">{hint}</p>
        </div>

        {labels.map((label, i) => {
          const dx = COVER_CENTER_X - label.x
          const dy = COVER_CENTER_Y - label.y
          const editable = editorOpen && !!draft
          return (
            <span
              key={i}
              className={
                'cover-label' +
                (activeLabel === i ? ' is-active' : '') +
                (editable ? ' is-editable' : '') +
                (dragging === i ? ' is-dragging' : '')
              }
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
              onPointerDown={editable ? (e) => handleLabelPointerDown(e, i) : undefined}
              onPointerMove={editable ? handleLabelPointerMove : undefined}
              onPointerUp={editable ? handleLabelPointerEnd : undefined}
              onPointerCancel={editable ? handleLabelPointerEnd : undefined}
              onKeyDown={editable ? (e) => handleLabelKeyDown(e, i) : undefined}
              onMouseEnter={editable ? () => setActiveLabel(i) : undefined}
              role={editable ? 'button' : undefined}
              tabIndex={editable ? 0 : undefined}
              aria-label={editable ? `拖动调整「${label.text}」的位置` : undefined}
              title={editable ? '拖动改位置（方向键微调）' : undefined}
            >
              <span className="cover-label-inner">{label.text}</span>
            </span>
          )
        })}
      </div>

      <div className={`cover-edit-bubble-wrap${phase === 'exit' ? ' is-hidden' : ''}`}>
        <button
          className="cover-edit-bubble"
          type="button"
          aria-label="编辑封面文字与背景图"
          title="编辑封面"
          onClick={openEditor}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        </button>
      </div>

      {toast && (
        <div className="cover-toast" role="status">
          {toast}
        </div>
      )}

      <AdminLoginModal
        open={loginOpen}
        onClose={() => {
          setLoginOpen(false)
          setPendingEdit(false)
        }}
      />

      {editorOpen && draft && (
        <CoverEditor
          config={config}
          draft={draft}
          activeLabel={activeLabel}
          onChange={setDraft}
          onBackgroundChange={handleBackgroundChange}
          onSaved={handleSaved}
          onClose={closeEditor}
          onActiveLabel={setActiveLabel}
        />
      )}
    </div>
  )
}
