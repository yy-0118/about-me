import React, { useEffect, useRef, useState } from 'react'
import {
  getAdminSettings,
  resetAdminSettings,
  testLlmConnection,
  updateAdminSettings,
} from '../../../lib/api'
import { AI_STYLE_OPTIONS, type AdminSettings, type AiStyle } from '../../../lib/types'

interface FormState {
  deepseek_api_key: string
  deepseek_base_url: string
  llm_model: string
  embedding_base_url: string
  embedding_api_key: string
  embedding_model: string
  temperature: number
  top_k: number
  system_prompt: string
  ai_style: AiStyle
}

const defaultStylePresets: Record<string, string> = {
  professional:
    '你是一个知识库问答助手。请基于以下检索到的文档内容回答用户问题。如果你不确定答案，请如实说不知道，不要编造。引用相关文档内容来支持你的回答。请用中文回答。',
  friendly:
    '你是一个友善、亲切的知识库助手。请用温暖、鼓励的语气回答用户问题，多用共情表达。请用中文回答。',
  concise:
    '你是一个知识库问答助手。请用简洁的语言直接回答用户问题，去除冗余表达，控制在关键信息以内。请用中文回答。',
  detailed:
    '你是一个知识库问答助手。请尽可能详细地展开回答，给出充分的背景、定义、举例与延伸说明。请用中文回答。',
  free: '',
}

const KeyIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
)
const ServerIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="6" rx="2" />
    <rect x="2" y="15" width="20" height="6" rx="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
)
const ModelIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="6" width="16" height="12" rx="3" />
    <circle cx="9" cy="12" r="1.5" fill="currentColor" />
    <circle cx="15" cy="12" r="1.5" fill="currentColor" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="8" y1="22" x2="16" y2="22" />
  </svg>
)
const ParamIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
)

const StatusPill: React.FC<{
  result: { ok: boolean; llm?: { ok: boolean }; embedding?: { ok: boolean } }
  onClick?: () => void
}> = ({ result, onClick }) => {
  const llmOk = result.llm?.ok
  const embOk = result.embedding?.ok
  const allOk = llmOk && embOk
  const allFail = llmOk === false && embOk === false
  const variant = allOk ? 'ok' : allFail ? 'fail' : 'partial'
  const label = `LLM ${llmOk ? '✓' : '✗'}  Embedding ${embOk ? '✓' : '✗'}`
  return (
    <button
      type="button"
      className={`admin-status-pill admin-status-pill--${variant}`}
      onClick={onClick}
      title="点击查看完整结果"
    >
      <span className="admin-status-pill__dot" />
      <span>{label}</span>
      <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 2 }}>查看</span>
    </button>
  )
}

export const LLMApiTab: React.FC = () => {
  const [form, setForm] = useState<FormState | null>(null)
  const [original, setOriginal] = useState<AdminSettings | null>(null)
  const [showLlmKey, setShowLlmKey] = useState(false)
  const [showEmbKey, setShowEmbKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [testResult, setTestResult] = useState<{
    ok: boolean
    llm?: { ok: boolean; error?: string }
    embedding?: { ok: boolean; error?: string }
  } | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    setTestResult(null)
    try {
      const s = await getAdminSettings()
      setOriginal(s)
      setForm({
        deepseek_api_key: '',
        deepseek_base_url: s.deepseek_base_url,
        llm_model: s.llm_model,
        embedding_base_url: s.embedding_base_url,
        embedding_api_key: '',
        embedding_model: s.embedding_model,
        temperature: s.temperature,
        top_k: s.top_k,
        system_prompt: s.system_prompt,
        ai_style: s.ai_style as AiStyle,
      })
    } catch (e: any) {
      setError(e?.message || '加载设置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading || !form) {
    return (
      <div className="admin-tab">
        <div className="admin-tab__head">
          <div>
            <h2 className="admin-tab__title">LLM API</h2>
            <p className="admin-tab__subtitle">加载中…</p>
          </div>
        </div>
      </div>
    )
  }

  const dirty =
    !!original &&
    (form.deepseek_base_url !== original.deepseek_base_url ||
      form.llm_model !== original.llm_model ||
      form.embedding_base_url !== original.embedding_base_url ||
      form.embedding_model !== original.embedding_model ||
      form.temperature !== original.temperature ||
      form.top_k !== original.top_k ||
      form.system_prompt !== original.system_prompt ||
      form.ai_style !== original.ai_style ||
      (form.deepseek_api_key.trim().length > 0 && original.deepseek_api_key_set) ||
      (form.embedding_api_key.trim().length > 0 && original.embedding_api_key_set))

  const save = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    setTestResult(null)
    try {
      const payload = {
        deepseek_api_key: form.deepseek_api_key.trim() ? form.deepseek_api_key.trim() : null,
        deepseek_base_url: form.deepseek_base_url.trim(),
        llm_model: form.llm_model.trim(),
        embedding_base_url: form.embedding_base_url.trim(),
        embedding_api_key: form.embedding_api_key.trim() ? form.embedding_api_key.trim() : null,
        embedding_model: form.embedding_model.trim(),
        temperature: form.temperature,
        top_k: form.top_k,
        system_prompt: form.system_prompt,
        ai_style: form.ai_style,
      }
      const updated = await updateAdminSettings(payload)
      setOriginal(updated)
      setForm({ ...form, deepseek_api_key: '', embedding_api_key: '' })
      setSuccess('设置已保存')
    } catch (e: any) {
      setError(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setError('')
    setSuccess('')
    setTestResult(null)
    try {
      const payload = {
        deepseek_api_key: form.deepseek_api_key.trim() ? form.deepseek_api_key.trim() : null,
        deepseek_base_url: form.deepseek_base_url.trim() || null,
        llm_model: form.llm_model.trim() || null,
        embedding_base_url: form.embedding_base_url.trim() || null,
        embedding_api_key: form.embedding_api_key.trim() || null,
        embedding_model: form.embedding_model.trim() || null,
      }
      const r = await testLlmConnection(payload)
      setTestResult(r)
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 60)
    } catch (e: any) {
      setError(e?.message || '测试失败')
    } finally {
      setTesting(false)
    }
  }

  const handleReset = async () => {
    if (!window.confirm('确认把系统设置（除 API Key 外）恢复为默认值？')) return
    setError('')
    setSuccess('')
    setTestResult(null)
    try {
      await resetAdminSettings()
      await load()
      setSuccess('已重置为默认值')
    } catch (e: any) {
      setError(e?.message || '重置失败')
    }
  }

  const applyStylePreset = (style: AiStyle) => {
    if (style !== 'free' && defaultStylePresets[style]) {
      setForm((f) => (f ? { ...f, ai_style: style, system_prompt: defaultStylePresets[style] } : f))
    } else {
      setForm((f) => (f ? { ...f, ai_style: style } : f))
    }
  }

  return (
    <div className="admin-tab">
      <div className="admin-tab__head">
        <div>
          <h2 className="admin-tab__title">LLM API</h2>
          <p className="admin-tab__subtitle">配置大模型与 Embedding 服务；两者可使用不同 provider</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="admin-btn" onClick={handleTest} disabled={testing}>
            {testing ? <span className="admin-spinner" /> : (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            )}
            {testing ? '测试中…' : '测试连接'}
          </button>
          {testing && (
            <span className="admin-status-pill admin-status-pill--testing" title="正在测试 LLM 与 Embedding 连接">
              <span className="admin-status-pill__dot" />
              <span>测试中…</span>
            </span>
          )}
          {testResult && !testing && (
            <StatusPill
              result={testResult}
              onClick={() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            />
          )}
          <button className="admin-btn" onClick={handleReset}>
            重置默认值
          </button>
        </div>
      </div>

      {error && <div className="admin-error">⚠ {error}</div>}
      {success && <div className="admin-success">✓ {success}</div>}

      <div className="admin-card">
        <div className="admin-card__head">
          <div className="admin-card__head-l">
            <div className="admin-card__head-icon">{KeyIcon}</div>
            <div>
              <h3 className="admin-card__title">LLM 凭证（对话模型）</h3>
              <p className="admin-card__hint">配置调用对话模型所需的 Key 与服务端点</p>
            </div>
          </div>
        </div>

        <div className="admin-field">
          <div className="admin-field__label-row">
            <label className="admin-field__label">DEEPSEEK_API_KEY</label>
            {original?.deepseek_api_key_set && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                当前：<code>{original.deepseek_api_key_masked}</code>
              </span>
            )}
          </div>
          <div className="admin-input-group">
            <input
              className="admin-input admin-input--mono"
              type={showLlmKey ? 'text' : 'password'}
              value={form.deepseek_api_key}
              placeholder={
                original?.deepseek_api_key_set ? '留空保持原值不变' : '尚未配置，输入新的 Key'
              }
              onChange={(e) => setForm({ ...form, deepseek_api_key: e.target.value })}
              autoComplete="off"
            />
            <button
              type="button"
              className="admin-btn"
              onClick={() => setShowLlmKey((s) => !s)}
            >
              {showLlmKey ? '隐藏' : '显示'}
            </button>
          </div>
          <div className="admin-field__hint">修改后立即生效；留空则保持原 Key</div>
        </div>

        <div className="admin-field">
          <label className="admin-field__label">DEEPSEEK_BASE_URL</label>
          <input
            className="admin-input admin-input--mono"
            value={form.deepseek_base_url}
            onChange={(e) => setForm({ ...form, deepseek_base_url: e.target.value })}
            placeholder="https://api.deepseek.com"
          />
          <div className="admin-field__hint">DeepSeek chat 端点；支持中转/自建地址</div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card__head">
          <div className="admin-card__head-l">
            <div className="admin-card__head-icon">{ServerIcon}</div>
            <div>
              <h3 className="admin-card__title">Embedding 凭证（向量模型）</h3>
              <p className="admin-card__hint">
                {original?.embedding_use_llm_credentials
                  ? '当前复用上方 LLM 凭据；填入下方可独立配置'
                  : '当前使用独立凭据；清空可恢复复用 LLM 凭据'}
              </p>
            </div>
          </div>
        </div>

        <div className="admin-field">
          <div className="admin-field__label-row">
            <label className="admin-field__label">EMBEDDING_API_KEY</label>
            {original?.embedding_api_key_set && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                当前：<code>{original.embedding_api_key_masked}</code>
              </span>
            )}
            {original?.embedding_use_llm_credentials && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                （未配置 → 复用 LLM Key）
              </span>
            )}
          </div>
          <div className="admin-input-group">
            <input
              className="admin-input admin-input--mono"
              type={showEmbKey ? 'text' : 'password'}
              value={form.embedding_api_key}
              placeholder={
                original?.embedding_use_llm_credentials
                  ? '输入独立的 Key（留空保持原状态）'
                  : original?.embedding_api_key_set
                    ? '留空保持原值不变'
                    : '尚未配置，输入新的 Key'
              }
              onChange={(e) => setForm({ ...form, embedding_api_key: e.target.value })}
              autoComplete="off"
            />
            <button
              type="button"
              className="admin-btn"
              onClick={() => setShowEmbKey((s) => !s)}
            >
              {showEmbKey ? '隐藏' : '显示'}
            </button>
          </div>
          <div className="admin-field__hint">
            若 Embedding 走与 LLM 不同的 provider（如 OpenAI / Ollama），这里填对应 Key；否则留空复用 LLM Key
          </div>
        </div>

        <div className="admin-field">
          <label className="admin-field__label">EMBEDDING_BASE_URL</label>
          <input
            className="admin-input admin-input--mono"
            value={form.embedding_base_url}
            onChange={(e) => setForm({ ...form, embedding_base_url: e.target.value })}
            placeholder="https://api.deepseek.com"
          />
          <div className="admin-field__hint">
            常见示例：<code>https://api.openai.com/v1</code>（OpenAI）/<code>http://localhost:11434/v1</code>（Ollama）
          </div>
        </div>

        <div className="admin-field" style={{ marginTop: 18 }}>
          <label className="admin-field__label">EMBEDDING_MODEL</label>
          <input
            className="admin-input admin-input--mono"
            value={form.embedding_model}
            onChange={(e) => setForm({ ...form, embedding_model: e.target.value })}
          />
          <div className="admin-field__hint">
            OpenAI: <code>text-embedding-3-small</code> · Ollama: <code>nomic-embed-text</code> · DeepSeek 不支持
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card__head">
          <div className="admin-card__head-l">
            <div className="admin-card__head-icon">{ModelIcon}</div>
            <div>
              <h3 className="admin-card__title">LLM 模型选择</h3>
              <p className="admin-card__hint">指定对话模型名称</p>
            </div>
          </div>
        </div>

        <div className="admin-field">
          <label className="admin-field__label">LLM_MODEL</label>
          <input
            className="admin-input admin-input--mono"
            value={form.llm_model}
            onChange={(e) => setForm({ ...form, llm_model: e.target.value })}
          />
          <div className="admin-field__hint">DeepSeek: <code>deepseek-chat</code> / <code>deepseek-reasoner</code></div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card__head">
          <div className="admin-card__head-l">
            <div className="admin-card__head-icon">{ParamIcon}</div>
            <div>
              <h3 className="admin-card__title">检索与生成参数</h3>
              <p className="admin-card__hint">调整回答的随机性、检索数量与系统提示词</p>
            </div>
          </div>
        </div>

        <div className="admin-field-inline">
          <div className="admin-field-inline__label">
            <span className="admin-field-inline__label-main">Temperature</span>
            <span className="admin-field-inline__label-hint">越高越有创造性</span>
          </div>
          <div className="admin-field-inline__value">
            <input
              className="admin-range"
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={form.temperature}
              onChange={(e) =>
                setForm({ ...form, temperature: parseFloat(e.target.value) })
              }
            />
            <span className="admin-field-inline__value-text">
              {form.temperature.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="admin-field-inline">
          <div className="admin-field-inline__label">
            <span className="admin-field-inline__label-main">Top K</span>
            <span className="admin-field-inline__label-hint">检索返回的文本块数量</span>
          </div>
          <div className="admin-field-inline__value">
            <input
              className="admin-input"
              type="number"
              min={1}
              max={50}
              value={form.top_k}
              style={{ maxWidth: 120 }}
              onChange={(e) =>
                setForm({ ...form, top_k: parseInt(e.target.value || '5', 10) })
              }
            />
          </div>
        </div>

        <div className="admin-field-inline">
          <div className="admin-field-inline__label">
            <span className="admin-field-inline__label-main">AI 回复风格</span>
            <span className="admin-field-inline__label-hint">快速套用预设或自由编辑</span>
          </div>
          <div className="admin-field-inline__value">
            <select
              className="admin-select"
              value={form.ai_style}
              onChange={(e) => applyStylePreset(e.target.value as AiStyle)}
              style={{ maxWidth: 240 }}
            >
              {AI_STYLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} —— {o.hint}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="admin-field" style={{ marginTop: 20 }}>
          <label className="admin-field__label">System Prompt</label>
          <textarea
            className="admin-textarea"
            rows={6}
            value={form.system_prompt}
            onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
            placeholder="定义 AI 的角色、回答规则与输出格式…"
          />
          <div className="admin-field__hint">回复风格会作为前缀注入到 system prompt 之前</div>
        </div>
      </div>

      {testResult && (
        <div className="admin-card" ref={resultRef} id="admin-test-result">
          <div className="admin-card__head">
            <div className="admin-card__head-l">
              <div className="admin-card__head-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <div>
                <h3 className="admin-card__title">连接测试结果</h3>
                <p className="admin-card__hint">使用当前表单的值实测 LLM 与 Embedding 接口</p>
              </div>
            </div>
          </div>
          <div className="test-result">
            <div className="test-result__row">
              <div className="test-result__label">LLM</div>
              <div className="test-result__value">
                {testResult.llm?.ok ? (
                  <span className="test-result__status test-result__status--ok">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    连接正常
                  </span>
                ) : (
                  <span className="test-result__status test-result__status--fail">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    连接失败
                  </span>
                )}
                {!testResult.llm?.ok && testResult.llm?.error && (
                  <span className="test-result__error">{testResult.llm.error}</span>
                )}
              </div>
            </div>
            <div className="test-result__row">
              <div className="test-result__label">Embedding</div>
              <div className="test-result__value">
                {testResult.embedding?.ok ? (
                  <span className="test-result__status test-result__status--ok">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    连接正常
                  </span>
                ) : (
                  <span className="test-result__status test-result__status--fail">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    连接失败
                  </span>
                )}
                {!testResult.embedding?.ok && testResult.embedding?.error && (
                  <span className="test-result__error">{testResult.embedding.error}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="admin-actions admin-actions--end">
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {dirty ? '有未保存的更改' : '所有更改已保存'}
        </span>
        <button
          className="admin-btn admin-btn--primary"
          onClick={save}
          disabled={saving || !dirty}
        >
          {saving ? '保存中…' : '保存所有设置'}
        </button>
      </div>
    </div>
  )
}
