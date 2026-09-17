import React, { useEffect, useRef, useState } from 'react'
import {
  ApiError,
  coverBackgroundUrl,
  deleteCoverBackground,
  updateCoverConfig,
  uploadCoverBackground,
} from '../lib/api'
import {
  COVER_LINE_WIDTH_MAX,
  COVER_LINE_WIDTH_MIN,
  COVER_LINE_WIDTH_STEP,
  DEFAULT_COVER_HINT,
  DEFAULT_COVER_LABELS,
  DEFAULT_COVER_LINE_WIDTH,
  DEFAULT_COVER_TITLE,
  nextLabelPosition,
  referenceLineLength,
} from '../lib/coverDefaults'
import type { CoverConfig, CoverDraft, CoverLabel } from '../lib/types'
import './CoverEditor.css'

interface Props {
  config: CoverConfig | null
  /** 草稿由 CoverPage 持有：封面上的拖动 / 缩放都要和这里的输入框同步 */
  draft: CoverDraft
  activeLabel: number | null
  onChange: (draft: CoverDraft) => void
  /** 背景图已在服务端改好（上传 / 恢复默认） */
  onBackgroundChange: (cfg: CoverConfig) => void
  /** 文字保存成功 */
  onSaved: (cfg: CoverConfig) => void
  onClose: () => void
  /** 让封面高亮当前正在编辑的那条小字 */
  onActiveLabel: (index: number | null) => void
}

const MAX_LABELS = 60

export const CoverEditor: React.FC<Props> = ({
  config,
  draft,
  activeLabel,
  onChange,
  onBackgroundChange,
  onSaved,
  onClose,
  onActiveLabel,
}) => {
  // 打开时的快照：用来判断“有没有改过”，以及保存后对比
  const baseline = useRef<CoverDraft>(draft)
  const [bgVersion, setBgVersion] = useState(config?.bg_version ?? '')
  const [customBg, setCustomBg] = useState(config?.custom_bg ?? false)
  const [busy, setBusy] = useState<'save' | 'bg' | ''>('')
  const [error, setError] = useState('')
  // 收起面板 → 露出整张封面，方便把右侧的小字也拖到位
  const [collapsed, setCollapsed] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (collapsed) setCollapsed(false)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [collapsed, onClose])

  const patch = (next: Partial<CoverDraft>) => onChange({ ...draft, ...next })

  const changeLabelText = (index: number, text: string) => {
    patch({ labels: draft.labels.map((l, i) => (i === index ? { ...l, text } : l)) })
  }

  const removeLabel = (index: number) => {
    patch({ labels: draft.labels.filter((_, i) => i !== index) })
    onActiveLabel(null)
  }

  const addLabel = () => {
    if (draft.labels.length >= MAX_LABELS) return
    const pos = nextLabelPosition(draft.labels.length)
    const next: CoverLabel[] = [
      ...draft.labels,
      { text: '', x: pos.x, y: pos.y, hideStart: 60, hideEnd: 12 },
    ]
    patch({ labels: next })
    onActiveLabel(next.length - 1)
  }

  const restoreText = () => {
    onChange({
      title: '',
      hint: '',
      labels: DEFAULT_COVER_LABELS.map((l) => ({ ...l })),
      lineWidth: DEFAULT_COVER_LINE_WIDTH,
    })
  }

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许再次选择同一个文件
    if (!file || busy) return
    setError('')
    setBusy('bg')
    try {
      const cfg = await uploadCoverBackground(file)
      setBgVersion(cfg.bg_version)
      setCustomBg(cfg.custom_bg)
      onBackgroundChange(cfg)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : ''
      setError(`背景图上传失败${msg ? '：' + msg : '，请重试'}`)
    } finally {
      setBusy('')
    }
  }

  const restoreBackground = async () => {
    if (busy) return
    setError('')
    setBusy('bg')
    try {
      const cfg = await deleteCoverBackground()
      setBgVersion(cfg.bg_version)
      setCustomBg(cfg.custom_bg)
      onBackgroundChange(cfg)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : ''
      setError(`恢复默认背景失败${msg ? '：' + msg : '，请重试'}`)
    } finally {
      setBusy('')
    }
  }

  const save = async () => {
    if (busy) return
    setError('')
    setBusy('save')
    try {
      const cfg = await updateCoverConfig({
        title: draft.title.trim(),
        hint: draft.hint.trim(),
        labels: draft.labels
          .map((l) => ({ ...l, text: l.text.trim() }))
          .filter((l) => l.text),
        line_width: draft.lineWidth,
      })
      onSaved(cfg)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('登录已失效，请关闭后重新点击气泡登录')
      } else {
        const msg = err instanceof ApiError ? err.message : ''
        setError(`保存失败${msg ? '：' + msg : '，请重试'}`)
      }
      setBusy('')
    }
  }

  const dirty =
    draft.title !== baseline.current.title ||
    draft.hint !== baseline.current.hint ||
    draft.lineWidth !== baseline.current.lineWidth ||
    JSON.stringify(draft.labels) !== JSON.stringify(baseline.current.labels)

  const bgPreview = bgVersion ? coverBackgroundUrl(bgVersion) : '/cover-bg.png'
  const blocked = busy !== ''
  const focused = activeLabel !== null ? draft.labels[activeLabel] : undefined

  // 「排版」区：作用对象默认取当前选中的小字，没有选中就取第一条
  const targetIndex =
    activeLabel !== null && draft.labels[activeLabel] ? activeLabel : 0
  const target = draft.labels[targetIndex]
  const refLen = target ? referenceLineLength(target) : 0
  const startMax = Math.max(50, Math.round(refLen))
  const startValue = Math.min(target?.hideStart ?? 0, startMax)
  const endValue = target?.hideEnd ?? 0
  const startPercent = refLen > 0 ? Math.round((startValue / refLen) * 100) : 0

  const setSpacing = (next: { hideStart?: number; hideEnd?: number }) => {
    patch({
      labels: draft.labels.map((l, i) => (i === targetIndex ? { ...l, ...next } : l)),
    })
  }

  const applySpacingToAll = () => {
    if (!target) return
    const { hideStart, hideEnd } = target
    patch({ labels: draft.labels.map((l) => ({ ...l, hideStart, hideEnd })) })
  }

  if (collapsed) {
    return (
      <div className="cover-editor__mini" role="dialog" aria-label="封面小字定位">
        <span className="cover-editor__mini-hint">
          拖动封面上的小字调整位置，连线会跟着走；按 Esc 回到编辑面板
        </span>
        <button
          type="button"
          className="cover-editor__file-btn"
          onClick={() => setCollapsed(false)}
        >
          回到面板
        </button>
      </div>
    )
  }

  return (
    <div
      className="cover-editor"
      role="dialog"
      aria-modal="true"
      aria-label="编辑封面"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="cover-editor__head">
        <div>
          <h3>编辑封面</h3>
          <p className="cover-editor__sub">文字改动实时预览，背景图上传后立即生效</p>
        </div>
        <button
          className="modal__close"
          type="button"
          onClick={onClose}
          aria-label="关闭编辑器"
        >
          ×
        </button>
      </div>

      <div className="cover-editor__body">
        <section className="cover-editor__section">
          <h4 className="cover-editor__section-title">封面文字</h4>
          <label className="modal__label">
            主标题
            <input
              className="modal__input"
              value={draft.title}
              placeholder={DEFAULT_COVER_TITLE}
              onChange={(e) => patch({ title: e.target.value })}
              disabled={blocked}
            />
          </label>
          <label className="modal__label">
            提示小字
            <input
              className="modal__input"
              value={draft.hint}
              placeholder={DEFAULT_COVER_HINT}
              onChange={(e) => patch({ hint: e.target.value })}
              disabled={blocked}
            />
          </label>
          <p className="cover-editor__hint">留空 = 用默认文案</p>
        </section>

        <section className="cover-editor__section">
          <h4 className="cover-editor__section-title">背景图</h4>
          <div className="cover-editor__bg">
            <img className="cover-editor__bg-thumb" src={bgPreview} alt="当前封面背景预览" />
            <div className="cover-editor__bg-actions">
              <label className={`cover-editor__file-btn${blocked ? ' is-disabled' : ''}`}>
                {busy === 'bg' ? '处理中…' : '上传图片'}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp"
                  onChange={pickFile}
                  disabled={blocked}
                  hidden
                />
              </label>
              <button
                type="button"
                className="cover-editor__ghost-btn"
                onClick={restoreBackground}
                disabled={blocked || !customBg}
              >
                恢复默认背景
              </button>
              <p className="cover-editor__hint">横图更好看；png / jpg / webp，≤ 12MB</p>
            </div>
          </div>
        </section>

        <section className="cover-editor__section">
          <h4 className="cover-editor__section-title">小字（连线文字）</h4>
          <p className="cover-editor__hint">
            在左侧封面上<b>直接拖动小字</b>即可改位置（连线会跟着走）；选中后也能用方向键微调。
            被面板挡住的小字，用下方「排版」里的「收起面板」再拖。
          </p>
          {focused ? (
            <p className="cover-editor__pos">
              <span className="cover-editor__pos-name">{focused.text || '未命名小字'}</span>
              <span className="cover-editor__pos-coord">x {focused.x}%</span>
              <span className="cover-editor__pos-coord">y {focused.y}%</span>
            </p>
          ) : (
            <p className="cover-editor__pos cover-editor__pos--idle">
              鼠标移到小字上即可看到坐标
            </p>
          )}
          <div className="cover-editor__labels">
            {draft.labels.map((label, i) => (
              <div
                className={`cover-editor__label-row${activeLabel === i ? ' is-active' : ''}`}
                key={i}
                onMouseEnter={() => onActiveLabel(i)}
                onMouseLeave={() => onActiveLabel(null)}
              >
                <input
                  className="modal__input cover-editor__label-input"
                  value={label.text}
                  placeholder={`第 ${i + 1} 个小字`}
                  onChange={(e) => changeLabelText(i, e.target.value)}
                  onFocus={() => onActiveLabel(i)}
                  onBlur={() => onActiveLabel(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault()
                  }}
                  disabled={blocked}
                />
                <button
                  type="button"
                  className="cover-editor__label-del"
                  onClick={() => removeLabel(i)}
                  aria-label={`删除小字 ${label.text || i + 1}`}
                  disabled={blocked}
                >
                  删除
                </button>
              </div>
            ))}
            {draft.labels.length === 0 && (
              <p className="cover-editor__hint">已经没有小字了，点下面的按钮可以加回来</p>
            )}
          </div>
          <div className="cover-editor__label-tools">
            <button
              type="button"
              className="cover-editor__ghost-btn"
              onClick={addLabel}
              disabled={blocked || draft.labels.length >= MAX_LABELS}
            >
              + 添加小字
            </button>
          </div>
        </section>

        <section className="cover-editor__section">
          <h4 className="cover-editor__section-title">排版</h4>
          {!target ? (
            <p className="cover-editor__hint">
              还没有小字，先在「小字」里加一条再来调排版
            </p>
          ) : (
            <>
              <label className="modal__label">
                作用对象
                <select
                  className="modal__input"
                  value={targetIndex}
                  onChange={(e) => onActiveLabel(Number(e.target.value))}
                  disabled={blocked}
                >
                  {draft.labels.map((label, i) => (
                    <option key={i} value={i}>
                      {label.text || `第 ${i + 1} 个小字`}
                    </option>
                  ))}
                </select>
              </label>

              <div className="cover-editor__field">
                <div className="cover-editor__field-head">
                  <span>线条粗细</span>
                  <span className="cover-editor__field-value">
                    {draft.lineWidth.toFixed(2)} px
                    {draft.lineWidth === 0 ? '（不显示连线）' : ' · 全部连线'}
                  </span>
                </div>
                <input
                  className="cover-editor__range"
                  type="range"
                  min={COVER_LINE_WIDTH_MIN}
                  max={COVER_LINE_WIDTH_MAX}
                  step={COVER_LINE_WIDTH_STEP}
                  value={draft.lineWidth}
                  onChange={(e) => patch({ lineWidth: Number(e.target.value) })}
                  disabled={blocked}
                  aria-label="线条粗细"
                />
                <p className="cover-editor__hint">
                  线宽会被浏览器对齐到整像素：100% 缩放下 0.05–1→1px、1.05–2→2px；拖到 0 则不显示连线
                  （屏幕缩放 200% 时每档都有变化）
                </p>
              </div>

              <div className="cover-editor__field">
                <div className="cover-editor__field-head">
                  <span>起点位置（离中心）</span>
                  <span className="cover-editor__field-value">
                    {Math.round(startValue)} px · 约线长的 {startPercent}%
                  </span>
                </div>
                <input
                  className="cover-editor__range"
                  type="range"
                  min={0}
                  max={startMax}
                  step={1}
                  value={startValue}
                  onChange={(e) => setSpacing({ hideStart: Number(e.target.value) })}
                  disabled={blocked}
                  aria-label="连线起点位置"
                />
              </div>

              <div className="cover-editor__field">
                <div className="cover-editor__field-head">
                  <span>终点位置（离小字）</span>
                  <span className="cover-editor__field-value">
                    {Math.round(endValue)} px
                  </span>
                </div>
                <input
                  className="cover-editor__range"
                  type="range"
                  min={0}
                  max={80}
                  step={1}
                  value={endValue}
                  onChange={(e) => setSpacing({ hideEnd: Number(e.target.value) })}
                  disabled={blocked}
                  aria-label="连线终点位置"
                />
              </div>

              <div className="cover-editor__label-tools">
                <button
                  type="button"
                  className="cover-editor__ghost-btn"
                  onClick={applySpacingToAll}
                  disabled={blocked}
                >
                  把这套间距应用到全部小字
                </button>
              </div>
            </>
          )}

          <div className="cover-editor__label-tools">
            <button
              type="button"
              className="cover-editor__ghost-btn"
              onClick={() => setCollapsed(true)}
              disabled={blocked}
            >
              收起面板，露出整张封面
            </button>
          </div>
          <p className="cover-editor__hint">
            收起后可以在封面上拖动任意小字（包括被面板挡住的），按 Esc 回到面板
          </p>
        </section>

        {error && <div className="modal__error">{error}</div>}
      </div>

      <div className="cover-editor__foot">
        <button
          type="button"
          className="cover-editor__ghost-btn"
          onClick={restoreText}
          disabled={blocked}
        >
          恢复默认文字
        </button>
        <div className="cover-editor__foot-right">
          <button
            type="button"
            className="modal__btn modal__btn--ghost"
            onClick={onClose}
            disabled={blocked}
          >
            取消
          </button>
          <button
            type="button"
            className="modal__btn"
            onClick={save}
            disabled={blocked || !dirty}
          >
            {busy === 'save' ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
